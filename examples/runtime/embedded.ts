/**
 * Run the UI in-process while the host runtime keeps handling timers and I/O.
 *
 *   bun examples/runtime/embedded.ts
 */
import { WebviewRuntime } from '../../runtime.js';

const runtime = await WebviewRuntime.start({
  mode: 'embedded',
  exitOnLastWindowClosed: false,
});

const window = await runtime.createWindow({ title: 'Embedded runtime', width: 900, height: 640 });
const view = await window.createWebview({
  html: '<body style="font-family:system-ui;padding:2rem"><h1>Embedded runtime</h1><p id="tick">waiting…</p></body>',
});

window.on('destroyed', ({ windowId }) => console.log('window destroyed:', windowId));

let tick = 0;
const timer = setInterval(async () => {
  tick += 1;
  console.log('backend tick:', tick);
  if (!window.destroyed) await view.evaluateScript(`document.querySelector('#tick').textContent = 'tick ${tick}'`);
  if (tick === 15) {
    clearInterval(timer);
    await runtime.exit();
  }
}, 1000);

await runtime.whenExit();
console.log('embedded runtime stopped');
