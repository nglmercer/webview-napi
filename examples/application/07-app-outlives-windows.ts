/**
 * An application that outlives its windows.
 *
 * With `exitOnLastWindowClosed: false` the event loop stays up with zero
 * windows, so a backend can keep running and open a new window later. This
 * example reopens a window the first time it hits zero, then exits.
 *
 *   bun examples/application/07-app-outlives-windows.ts
 */
import { Application, WebviewApplicationEvent } from '../../index.js';

const app = new Application({ exitOnLastWindowClosed: false });

function openWindow(title: string, x: number) {
  const win = app.createBrowserWindow({ title, width: 480, height: 360, x, y: 120 });
  win.createWebview({ html: `<body style="font-family:system-ui; display:grid; place-items:center; height:100vh"><h1>${title}</h1></body>` });
  return win;
}

openWindow('First', 100);
openWindow('Second', 620);

let reopened = false;

app.bind((err, event) => {
  if (err) return;

  if (event.event === WebviewApplicationEvent.WindowDestroyed) {
    console.log(`window ${event.windowId} destroyed — ${app.windowCount} left`);

    if (app.windowCount === 0 && !reopened) {
      // Still alive with no windows: prove it by opening one more.
      reopened = true;
      console.log('no windows left, but the app is still running — opening one more');
      openWindow('Reopened', 360);
    } else if (app.windowCount === 0) {
      console.log('done, exiting');
      app.exit();
    }
  }
});

app.run();