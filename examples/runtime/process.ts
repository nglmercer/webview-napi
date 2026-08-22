/**
 * Run the UI in the separate `webview-host` process.
 *
 *   bun run build:host
 *   bun examples/runtime/process.ts
 */
import { WebviewRuntime } from '../../runtime.js';

const runtime = await WebviewRuntime.start({
  mode: 'process',
  exitOnLastWindowClosed: false,
});

runtime.on('log', (line) => process.stderr.write(`[webview-host] ${line}\n`));

const window = await runtime.createWindow({ title: 'Process runtime', width: 900, height: 640 });
const view = await window.createWebview({
  html: `<body style="font-family:system-ui;padding:2rem">
    <h1>Process runtime</h1>
    <p id="tick">waiting…</p>
    <button onclick="window.ipc.postMessage('hello from the page')">Send IPC</button>
  </body>`,
});

view.on('ipc', (message) => console.log('page says:', message));
window.on('destroyed', () => void runtime.exit());

let tick = 0;
const timer = setInterval(async () => {
  tick += 1;
  console.log('backend tick:', tick);
  if (!window.destroyed) await view.evaluateScript(`document.querySelector('#tick').textContent = 'tick ${tick}'`);
}, 1000);

await runtime.whenExit();
clearInterval(timer);
console.log('process runtime stopped');
