/**
 * Windows outlive each other, and the application outlives its windows.
 *
 * `exitOnLastWindowClosed: false` keeps the event loop alive with zero windows,
 * so a backend can stay up and open a new window later. Run with:
 *
 *   bun examples/two-windows-independent-close.ts
 */
import { Application, WebviewApplicationEvent } from '../index.js';

const app = new Application({ exitOnLastWindowClosed: false });

function openWindow(title: string, x: number) {
  const win = app.createBrowserWindow({ title, width: 480, height: 360, x, y: 120 });
  win.createWebview({
    html: `<body style="font-family: system-ui; display:grid; place-items:center; height:100vh">
             <h1>${title}</h1>
           </body>`,
  });
  return win;
}

openWindow('First', 100);
openWindow('Second', 620);

let reopened = false;

app.bind((err, event) => {
  if (err) return;
  console.log(err,event)
  if (event.event === WebviewApplicationEvent.WindowDestroyed) {
    console.log(`window ${event.windowId} destroyed — ${app.windowCount} left`);

    // The application is still alive with no windows at all: prove it by
    // opening a fresh one the first time we hit zero.
    if (app.windowCount === 0 && !reopened) {
      reopened = true;
      console.log('no windows left, but the app is still running — opening one more');
      openWindow('Reopened', 360);
    } else if (app.windowCount === 0) {
      console.log('done, exiting');
      app.exit();
    }
  }
});

const poll = () => {
    if (app.pollEvents()) {
        setTimeout(poll, 10);
    } else {
        process.exit(0);
    }
};
poll();
