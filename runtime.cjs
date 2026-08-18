/**
 * webview-napi — high-level runtime.
 *
 * Exposes one API on top of two backends:
 *
 *   WebviewRuntime
 *     ├── EmbeddedRuntime  → the N-API Application, pumped with pollEvents()
 *     └── ProcessRuntime   → the `webview-host` binary, driven over stdio JSON-RPC
 *
 * Every method is promise-returning in both backends so switching `mode` never
 * changes call sites; the embedded backend simply resolves immediately.
 */
'use strict';

const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const native = require('./index.cjs');
const { Application, WebviewApplicationEvent } = native;

// `WebviewApplicationEvent` is a `const enum` in the type definitions, so the
// runtime object may be empty depending on the host. Fall back to the numeric
// discriminants emitted by the Rust side.
const EVENT = {
  WindowCloseRequested: WebviewApplicationEvent?.WindowCloseRequested ?? 0,
  ApplicationCloseRequested: WebviewApplicationEvent?.ApplicationCloseRequested ?? 1,
  WindowDestroyed: WebviewApplicationEvent?.WindowDestroyed ?? 2,
  ApplicationExit: WebviewApplicationEvent?.ApplicationExit ?? 3,
};

/* -------------------------------------------------------------------------- */
/* Embedded backend                                                            */
/* -------------------------------------------------------------------------- */

/** Drives `Application.pollEvents()` from the host runtime's event loop. */
class Pump {
  constructor(app, { keepAlive = true, interval = 4 } = {}) {
    this.app = app;
    this.keepAlive = keepAlive;
    this.interval = interval;
    this.running = false;
    this.status = { windowCount: 0, hasWindows: false, exitRequested: false };
    this._handle = null;
    this._resolve = null;
    this.done = new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  start() {
    if (this.running) return this;
    this.running = true;
    this._schedule();
    return this;
  }

  _schedule() {
    if (!this.running) return;
    if (this.keepAlive) {
      this._handle = setImmediate(() => this._tick());
    } else {
      this._handle = setTimeout(() => this._tick(), this.interval);
      // Let the host runtime exit if nothing else is pending.
      if (typeof this._handle.unref === 'function') this._handle.unref();
    }
  }

  _tick() {
    if (!this.running) return;
    try {
      this.status = this.app.pollEvents();
    } catch (err) {
      this.stop(err);
      return;
    }
    if (this.status.exitRequested) {
      this.stop();
      return;
    }
    this._schedule();
  }

  stop(error) {
    if (!this.running) return;
    this.running = false;
    if (this._handle) {
      clearImmediate(this._handle);
      clearTimeout(this._handle);
      this._handle = null;
    }
    this._resolve(error ?? null);
  }
}

class EmbeddedWebview {
  constructor(native, window) {
    this.native = native;
    this.window = window;
    this._emitter = new EventEmitter();
    this.native.onIpcMessage((err, message) => {
      if (!err) this._emitter.emit('ipc', message);
    });
  }

  get id() {
    return this.native.id;
  }

  on(event, listener) {
    this._emitter.on(event, listener);
    return this;
  }

  off(event, listener) {
    this._emitter.off(event, listener);
    return this;
  }

  async loadUrl(url) {
    this.native.loadUrl(url);
  }
  async loadHtml(html) {
    this.native.loadHtml(html);
  }
  async evaluateScript(js) {
    this.native.evaluateScript(js);
  }
  async send(message) {
    this.native.send(typeof message === 'string' ? message : JSON.stringify(message));
  }
  async openDevtools() {
    this.native.openDevtools();
  }
  async closeDevtools() {
    this.native.closeDevtools();
  }
  async reload() {
    this.native.reload();
  }
  async print() {
    this.native.print();
  }
}

class EmbeddedWindow {
  constructor(native, runtime) {
    this.native = native;
    this.runtime = runtime;
    this.webviews = [];
    this._emitter = new EventEmitter();
    this.destroyed = false;
  }

  get id() {
    return this.native.id;
  }

  on(event, listener) {
    this._emitter.on(event, listener);
    return this;
  }

  off(event, listener) {
    this._emitter.off(event, listener);
    return this;
  }

  async createWebview(options = {}) {
    const view = new EmbeddedWebview(this.native.createWebview(options), this);
    this.webviews.push(view);
    return view;
  }

  async close() {
    this.native.close();
  }

  /** Keep the window alive on a user close request and decide from JS. */
  async setCloseGuard(enabled) {
    this.native.setCloseGuard(enabled);
  }

  async setTitle(title) {
    this.native.setTitle(title);
  }
  async setVisible(visible) {
    this.native.setVisible(visible);
  }
  async setMaximized(value) {
    this.native.setMaximized(value);
  }
  async setMinimized(value) {
    this.native.setMinimized(value);
  }
  async setAlwaysOnTop(value) {
    this.native.setAlwaysOnTop(value);
  }
  async setDecorations(value) {
    this.native.setDecorations(value);
  }
  async focus() {
    this.native.focus();
  }
}

class EmbeddedRuntime extends EventEmitter {
  constructor(options = {}) {
    super();
    const { keepAlive = true, interval, ...appOptions } = options;
    this.mode = 'embedded';
    this.app = new Application({ keepAlive, ...appOptions });
    this.windows = new Map();
    this._pendingWindows = [];
    this.exited = false;

    this.app.bind((err, event) => {
      if (err) return;
      const id = event.windowId ?? null;
      const window = this._lookup(id);
      switch (event.event) {
        case EVENT.WindowCloseRequested:
          this.emit('window-close-requested', { windowId: id, window });
          window?._emitter.emit('close-requested', { windowId: id });
          break;
        case EVENT.WindowDestroyed:
          if (window) window.destroyed = true;
          if (id !== null) this.windows.delete(id);
          this.emit('window-destroyed', { windowId: id, window });
          window?._emitter.emit('destroyed', { windowId: id });
          break;
        case EVENT.ApplicationCloseRequested:
          this.emit('exit-requested', {});
          break;
        case EVENT.ApplicationExit:
          this.exited = true;
          this.emit('exit', {});
          break;
        default:
          break;
      }
    });

    this.pump = new Pump(this.app, { keepAlive, interval });
  }

  /** Windows only get their id once the loop has created them. */
  _lookup(id) {
    if (id === null || id === undefined) return undefined;
    this._reindex();
    return this.windows.get(id);
  }

  _reindex() {
    if (this._pendingWindows.length === 0) return;
    const still = [];
    for (const window of this._pendingWindows) {
      const id = window.native.id;
      if (id === null || id === undefined) still.push(window);
      else this.windows.set(id, window);
    }
    this._pendingWindows = still;
  }

  async start() {
    this.pump.start();
    return this;
  }

  async createWindow(options = {}) {
    const window = new EmbeddedWindow(this.app.createBrowserWindow(options), this);
    this._pendingWindows.push(window);
    // One pump so the native window exists (and has an id) on return.
    this.app.pollEvents();
    this._reindex();
    return window;
  }

  async exit(code) {
    this.app.exit(code);
    this.app.pollEvents();
  }

  get windowCount() {
    return this.app.windowCount;
  }

  /** Resolves when the event loop has stopped. */
  whenExit() {
    return this.pump.done.then(() => undefined);
  }
}

/* -------------------------------------------------------------------------- */
/* Process backend                                                             */
/* -------------------------------------------------------------------------- */

const HOST_EXT = process.platform === 'win32' ? '.exe' : '';

function hostBinaryName() {
  return `webview-host${HOST_EXT}`;
}

/** Locates the `webview-host` binary shipped next to this module. */
function resolveHostBinary(explicit) {
  const candidates = [];
  if (explicit) candidates.push(explicit);
  if (process.env.WEBVIEW_NAPI_HOST) candidates.push(process.env.WEBVIEW_NAPI_HOST);

  // Platform-suffixed name first (that is how prebuilt hosts are published),
  // then the plain name, then local cargo builds.
  const platformName = `webview-host-${process.platform}-${process.arch}${HOST_EXT}`;
  const name = hostBinaryName();
  for (const dir of [__dirname, path.join(__dirname, 'bin')]) {
    candidates.push(path.join(dir, platformName));
    candidates.push(path.join(dir, name));
  }
  candidates.push(path.join(__dirname, 'target', 'release', name));
  candidates.push(path.join(__dirname, 'target', 'debug', name));

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `webview-napi: could not find the '${name}' binary. Build it with ` +
      `\`bun run build:host\` (or \`cargo build -p webview-host --release\`), ` +
      `or set WEBVIEW_NAPI_HOST to its path.`,
  );
}

class ProcessWebview {
  constructor(id, window, client) {
    this.id = id;
    this.window = window;
    this.client = client;
    this._emitter = new EventEmitter();
  }

  on(event, listener) {
    this._emitter.on(event, listener);
    return this;
  }

  off(event, listener) {
    this._emitter.off(event, listener);
    return this;
  }

  loadUrl(url) {
    return this.client.request('webview.loadUrl', { webviewId: this.id, url });
  }
  loadHtml(html) {
    return this.client.request('webview.loadHtml', { webviewId: this.id, html });
  }
  evaluateScript(js) {
    return this.client.request('webview.evaluateScript', { webviewId: this.id, js });
  }
  send(message) {
    const body = typeof message === 'string' ? message : JSON.stringify(message);
    return this.client.request('webview.evaluateScript', {
      webviewId: this.id,
      js: `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(body)}}))`,
    });
  }
  openDevtools() {
    return this.client.request('webview.openDevtools', { webviewId: this.id });
  }
  closeDevtools() {
    return this.client.request('webview.closeDevtools', { webviewId: this.id });
  }
  reload() {
    return this.client.request('webview.reload', { webviewId: this.id });
  }
  print() {
    return this.client.request('webview.print', { webviewId: this.id });
  }
}

class ProcessWindow {
  constructor(id, runtime) {
    this.id = id;
    this.runtime = runtime;
    this.client = runtime.client;
    this.webviews = [];
    this.destroyed = false;
    this._emitter = new EventEmitter();
  }

  on(event, listener) {
    this._emitter.on(event, listener);
    return this;
  }

  off(event, listener) {
    this._emitter.off(event, listener);
    return this;
  }

  async createWebview(options = {}) {
    const { webviewId } = await this.client.request('webview.create', {
      windowId: this.id,
      ...options,
    });
    const view = new ProcessWebview(webviewId, this, this.client);
    this.webviews.push(view);
    this.runtime.webviews.set(webviewId, view);
    return view;
  }

  close() {
    return this.client.request('window.close', { windowId: this.id });
  }
  setCloseGuard(enabled) {
    return this.client.request('window.setCloseGuard', { windowId: this.id, enabled });
  }
  setTitle(title) {
    return this.client.request('window.setTitle', { windowId: this.id, title });
  }
  setVisible(visible) {
    return this.client.request('window.setVisible', { windowId: this.id, visible });
  }
  setMaximized(value) {
    return this.client.request('window.setMaximized', { windowId: this.id, value });
  }
  setMinimized(value) {
    return this.client.request('window.setMinimized', { windowId: this.id, value });
  }
  setAlwaysOnTop(value) {
    return this.client.request('window.setAlwaysOnTop', { windowId: this.id, value });
  }
  setDecorations(value) {
    return this.client.request('window.setDecorations', { windowId: this.id, value });
  }
  focus() {
    return this.client.request('window.focus', { windowId: this.id });
  }
}

/** Newline-delimited JSON-RPC over the host process' stdio. */
class HostClient extends EventEmitter {
  constructor(child) {
    super();
    this.child = child;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = '';
    this.closed = false;

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => this._onData(chunk));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => this.emit('log', chunk));
    child.on('exit', (code, signal) => {
      this.closed = true;
      const error = new Error(`webview-host exited (code=${code}, signal=${signal})`);
      for (const { reject } of this.pending.values()) reject(error);
      this.pending.clear();
      this.emit('host-exit', { code, signal });
    });
  }

  _onData(chunk) {
    this.buffer += chunk;
    let index;
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        this.emit('log', `webview-host: unparseable frame: ${line}\n`);
        continue;
      }
      if (message.id !== undefined && message.id !== null) {
        const entry = this.pending.get(message.id);
        if (!entry) continue;
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(message.error.message ?? String(message.error)));
        else entry.resolve(message.result ?? {});
      } else if (message.event) {
        this.emit('event', message);
      }
    }
  }

  request(method, params = {}) {
    if (this.closed) return Promise.reject(new Error('webview-host is not running'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  kill() {
    if (!this.closed) this.child.kill();
  }
}

class ProcessRuntime extends EventEmitter {
  constructor(options = {}) {
    super();
    this.mode = 'process';
    this.options = options;
    this.windows = new Map();
    this.webviews = new Map();
    this.exited = false;
    this._exitResolvers = [];
  }

  async start() {
    const binary = resolveHostBinary(this.options.hostPath);
    const child = spawn(binary, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...this.options.env },
      windowsHide: true,
    });
    this.client = new HostClient(child);
    this.client.on('log', (chunk) => this.emit('log', chunk));
    this.client.on('host-exit', (info) => {
      this.exited = true;
      this.emit('exit', info);
      for (const resolve of this._exitResolvers) resolve();
      this._exitResolvers = [];
    });
    this.client.on('event', (message) => this._onEvent(message));

    await this.client.request('app.configure', {
      exitOnLastWindowClosed: this.options.exitOnLastWindowClosed ?? true,
    });
    return this;
  }

  _onEvent(message) {
    const params = message.params ?? {};
    switch (message.event) {
      case 'window.closeRequested': {
        const window = this.windows.get(params.windowId);
        this.emit('window-close-requested', { windowId: params.windowId, window });
        window?._emitter.emit('close-requested', params);
        break;
      }
      case 'window.destroyed': {
        const window = this.windows.get(params.windowId);
        if (window) window.destroyed = true;
        this.windows.delete(params.windowId);
        this.emit('window-destroyed', { windowId: params.windowId, window });
        window?._emitter.emit('destroyed', params);
        break;
      }
      case 'webview.ipc': {
        const view = this.webviews.get(params.webviewId);
        this.emit('ipc', params);
        view?._emitter.emit('ipc', params.body);
        break;
      }
      case 'app.exit': {
        this.emit('exit-requested', params);
        break;
      }
      default:
        this.emit('host-event', message);
    }
  }

  async createWindow(options = {}) {
    const { windowId } = await this.client.request('window.create', options);
    const window = new ProcessWindow(windowId, this);
    this.windows.set(windowId, window);
    return window;
  }

  async exit(code = 0) {
    try {
      await this.client.request('app.exit', { code });
    } catch {
      // The host may exit before answering; that is the expected outcome.
    }
  }

  get windowCount() {
    return this.windows.size;
  }

  whenExit() {
    if (this.exited) return Promise.resolve();
    return new Promise((resolve) => this._exitResolvers.push(resolve));
  }

  kill() {
    this.client?.kill();
  }
}

/* -------------------------------------------------------------------------- */
/* Facade                                                                      */
/* -------------------------------------------------------------------------- */

function hostAvailable(hostPath) {
  try {
    resolveHostBinary(hostPath);
    return true;
  } catch {
    return false;
  }
}

const WebviewRuntime = {
  /**
   * Starts a runtime.
   *
   * @param {object} [options]
   * @param {'embedded'|'process'|'auto'} [options.mode='auto'] `auto` picks the
   *   out-of-process host when its binary is available, otherwise embedded.
   * @param {boolean} [options.exitOnLastWindowClosed=true]
   * @param {boolean} [options.keepAlive=true] embedded only.
   * @param {string}  [options.hostPath] process only.
   */
  async start(options = {}) {
    const requested = options.mode ?? 'auto';
    const mode = requested === 'auto' ? (hostAvailable(options.hostPath) ? 'process' : 'embedded') : requested;
    const runtime = mode === 'process' ? new ProcessRuntime(options) : new EmbeddedRuntime(options);
    await runtime.start();
    return runtime;
  },
  hostAvailable,
  resolveHostBinary,
};

module.exports = {
  WebviewRuntime,
  EmbeddedRuntime,
  ProcessRuntime,
  EmbeddedWindow,
  EmbeddedWebview,
  ProcessWindow,
  ProcessWebview,
  HostClient,
  Pump,
  hostAvailable,
  resolveHostBinary,
};
