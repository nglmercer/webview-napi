/**
 * The high-level runtime, embedded backend.
 *
 * The native event loop is pumped from the host runtime's loop, so timers,
 * promises and I/O keep running alongside the UI.
 *
 *   bun examples/runtime-embedded.ts
 */
import { WebviewRuntime } from '../runtime.js';

const runtime = await WebviewRuntime.start({
  mode: 'embedded',
  exitOnLastWindowClosed: false,
});

const win = await runtime.createWindow({ title: 'Runtime', width: 900, height: 640 });
const view = await win.createWebview({
  html: `<body style="font-family: system-ui; padding: 24px">
           <h1>Backend is alive</h1>
           <p id="tick">waiting…</p>
         </body>`,
});

win.on('close-requested', ({ windowId }) => console.log('close requested', windowId));
win.on('destroyed', ({ windowId }) => console.log('destroyed', windowId));

// Node/Bun keeps working while the window is open.
let ticks = 0;
const timer = setInterval(async () => {
  ticks += 1;
  console.log('backend alive', ticks);
  if (!win.destroyed) {
    await view.evaluateScript(`document.getElementById('tick').textContent = 'tick ${ticks}'`);
  }
  if (ticks === 15) {
    clearInterval(timer);
    await runtime.exit();
  }
}, 1000);

await runtime.whenExit();
console.log('runtime stopped');
