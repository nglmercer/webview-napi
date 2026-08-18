import type { EventEmitter } from 'node:events';
import type { Application, ApplicationOptions, BrowserWindowOptions, WebviewOptions } from './index.js';

export type RuntimeMode = 'embedded' | 'process' | 'auto';

export interface RuntimeOptions extends ApplicationOptions {
  /**
   * `auto` (default) uses the out-of-process host when its binary is available
   * and falls back to the embedded N-API backend otherwise.
   */
  mode?: RuntimeMode;
  /** Terminate once the last window is destroyed. Defaults to `true`. */
  exitOnLastWindowClosed?: boolean;
  /** Embedded backend only: hold the host runtime alive. Defaults to `true`. */
  keepAlive?: boolean;
  /** Embedded backend only: pump interval in ms when `keepAlive` is `false`. */
  interval?: number;
  /** Process backend only: explicit path to the `webview-host` binary. */
  hostPath?: string;
  /** Process backend only: extra environment variables for the host process. */
  env?: Record<string, string>;
}

export interface WindowEventPayload {
  windowId: number | null;
  window?: RuntimeWindow;
}

export interface RuntimeWebview {
  readonly id: string | number;
  on(event: 'ipc', listener: (message: string) => void): this;
  off(event: 'ipc', listener: (message: string) => void): this;
  loadUrl(url: string): Promise<void>;
  loadHtml(html: string): Promise<void>;
  evaluateScript(js: string): Promise<void>;
  send(message: string | object): Promise<void>;
  openDevtools(): Promise<void>;
  closeDevtools(): Promise<void>;
  reload(): Promise<void>;
  print(): Promise<void>;
}

export interface RuntimeWindow {
  readonly id: number | null;
  readonly destroyed: boolean;
  readonly webviews: RuntimeWebview[];
  on(event: 'close-requested' | 'destroyed', listener: (payload: { windowId: number }) => void): this;
  off(event: 'close-requested' | 'destroyed', listener: (payload: { windowId: number }) => void): this;
  createWebview(options?: WebviewOptions): Promise<RuntimeWebview>;
  close(): Promise<void>;
  /**
   * Keep the window alive when the user requests a close; the
   * `close-requested` event still fires and it is up to you to call `close()`.
   */
  setCloseGuard(enabled: boolean): Promise<void>;
  setTitle(title: string): Promise<void>;
  setVisible(visible: boolean): Promise<void>;
  setMaximized(value: boolean): Promise<void>;
  setMinimized(value: boolean): Promise<void>;
  setAlwaysOnTop(value: boolean): Promise<void>;
  setDecorations(value: boolean): Promise<void>;
  focus(): Promise<void>;
}

export interface Runtime extends EventEmitter {
  readonly mode: 'embedded' | 'process';
  readonly windowCount: number;
  createWindow(options?: BrowserWindowOptions): Promise<RuntimeWindow>;
  exit(code?: number): Promise<void>;
  /** Resolves once the event loop (or host process) has stopped. */
  whenExit(): Promise<void>;
}

export interface EmbeddedRuntime extends Runtime {
  readonly mode: 'embedded';
  /** The underlying N-API application. */
  readonly app: Application;
  readonly pump: Pump;
}

export interface ProcessRuntime extends Runtime {
  readonly mode: 'process';
  /** Terminates the host process without a graceful shutdown. */
  kill(): void;
}

export declare class Pump {
  constructor(app: Application, options?: { keepAlive?: boolean; interval?: number });
  readonly running: boolean;
  readonly done: Promise<Error | null>;
  start(): this;
  stop(error?: Error): void;
}

export declare const EmbeddedRuntime: new (options?: RuntimeOptions) => EmbeddedRuntime;
export declare const ProcessRuntime: new (options?: RuntimeOptions) => ProcessRuntime;

export declare const WebviewRuntime: {
  start(options?: RuntimeOptions): Promise<Runtime>;
  hostAvailable(hostPath?: string): boolean;
  resolveHostBinary(hostPath?: string): string;
};

export declare function hostAvailable(hostPath?: string): boolean;
export declare function resolveHostBinary(hostPath?: string): string;
