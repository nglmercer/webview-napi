/**
 * The high-level runtime, out-of-process backend.
 *
 * The UI lives in the `webview-host` binary, which owns the tao event loop;
 * Node/Bun keeps its own loop entirely to itself. Nothing blocks, and a host
 * crash no longer takes the backend down.
 *
 * Build the host once, then run:
 *
 *   bun run build:host
 *   bun examples/runtime-process.ts
 */
import { WebviewRuntime } from '../runtime.js';

const runtime = await WebviewRuntime.start({
  mode: 'process',
  exitOnLastWindowClosed: false,
});

runtime.on('log', (line) => process.stderr.write(`[host] ${line}`));

const win = await runtime.createWindow({ title: 'Process runtime', width: 900, height: 640 });
const view = await win.createWebview({
  html: `<body style="font-family: system-ui; padding: 24px">
           <h1>UI process</h1>
           <p id="tick">waiting…</p>
           <button onclick="window.ipc.postMessage('hello from the page')">send IPC</button>
         </body>`,
});

view.on('ipc', (message) => console.log('page says:', message));
win.on('close-requested', ({ windowId }) => console.log('close requested', windowId));
win.on('destroyed', ({ windowId }) => console.log('destroyed', windowId));

// The backend keeps working while the UI is up.
let ticks = 0;
const timer = setInterval(async () => {
  ticks += 1;
  console.log('backend alive', ticks);
  if (!win.destroyed) {
    await view.evaluateScript(`document.getElementById('tick').textContent = 'tick ${ticks}'`);
  }
}, 1000);

// Closing the window leaves the runtime up; stop it explicitly.
runtime.on('window-destroyed', async () => {
  if (runtime.windowCount === 0) {
    clearInterval(timer);
    await runtime.exit();
  }
});

await runtime.whenExit();
console.log('host stopped');
