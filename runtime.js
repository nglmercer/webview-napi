/**
 * ESM entry point for the webview-napi runtime.
 *
 * The implementation lives in `runtime.cjs`; this file only re-exports it so
 * both module systems share one implementation.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const runtime = require('./runtime.cjs');

export const WebviewRuntime = runtime.WebviewRuntime;
export const EmbeddedRuntime = runtime.EmbeddedRuntime;
export const ProcessRuntime = runtime.ProcessRuntime;
export const EmbeddedWindow = runtime.EmbeddedWindow;
export const EmbeddedWebview = runtime.EmbeddedWebview;
export const ProcessWindow = runtime.ProcessWindow;
export const ProcessWebview = runtime.ProcessWebview;
export const HostClient = runtime.HostClient;
export const Pump = runtime.Pump;
export const hostAvailable = runtime.hostAvailable;
export const resolveHostBinary = runtime.resolveHostBinary;

export default runtime;
