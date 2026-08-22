# Webview Runtime

The `webview-napi/runtime` module is a promise-based facade over the embedded and process
backends. Import `WebviewRuntime` and `start()` it to get a promise-friendly
`Runtime` — no manual pumping required.

## Modes

```typescript
import { WebviewRuntime } from 'webview-napi/runtime';

const runtime = await WebviewRuntime.start({
  mode: 'auto',            // 'auto' (default) | 'embedded' | 'process'
  exitOnLastWindowClosed: false,
  keepAlive: true,         // embedded only: hold the host runtime alive
});
```

- **`embedded`** — the UI lives in your process; the native loop is pumped from the host
  loop so timers, promises, and I/O keep running.
- **`process`** — the UI runs in the `webview-host` binary (JSON-RPC over stdio). Node/Bun
  keeps its loop to itself, nothing blocks, and a UI crash never takes the backend down.
- **`auto`** — uses the process host when its binary exists, else embedded.

## Getting windows

```typescript
const win = await runtime.createWindow({ title: 'App', width: 900, height: 640 });
const view = await win.createWebview({ html: '<p id="tick">…</p>' });

view.on('ipc', (message) => console.log('page:', message));
view.evaluateScript(`document.getElementById('tick').textContent = 'x'`);

win.on('close-requested', ({ windowId }) => console.log('close', windowId));
win.on('destroyed', ({ windowId }) => console.log('destroyed', windowId));
```

### RuntimeWindow

`close()`, `setCloseGuard(enabled)`, `setTitle`, `setVisible`, `setMaximized`,
`setMinimized`, `setAlwaysOnTop`, `setDecorations`, `focus()` — all return promises.
Ready-only `id` (number | null), `destroyed`, and `webviews[]`.

### RuntimeWebview

`loadUrl`, `loadHtml`, `evaluateScript`, `send`, `openDevtools`, `closeDevtools`,
`reload`, `print` — all async. `on('ipc', listener)` / `off('ipc', listener)`.

## Backend specifics

```typescript
const runtime = await WebviewRuntime.start({ mode: 'embedded' });
runtime.mode;                    // 'embedded' | 'process'
runtime.windowCount;
await runtime.exit();
await runtime.whenExit();        // resolves once the loop (or host) stops
```

- **Embedded**: `runtime.app` is the underlying NAPI `Application`; `runtime.pump` is the
  `Pump` that drives `pollEvents()` on an interval.
- **Process**: `runtime.on('log', line => …)` streams the host's stderr, and `runtime.kill()`
  terminates the host without a graceful shutdown.

## Building the host

The process backend needs the `webview-host` binary:

```bash
bun run build:host     # cargo build -p webview-host --release
```

`WebviewRuntime.hostAvailable()` and `resolveHostBinary(hostPath?)` tell you whether the
host is present and where it lives.

## See also

- [`examples/runtime/embedded.ts`](../examples/runtime/embedded.ts)
- [`examples/runtime/process.ts`](../examples/runtime/process.ts)
- [Architecture](architecture.md)