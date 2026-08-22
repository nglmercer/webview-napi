/**
 * Multiple windows with independent lifetimes.
 *
 * Each window closes on its own; the application exits once the last one is
 * destroyed (the default `exitOnLastWindowClosed` policy).
 *
 *   bun examples/application/05-multi-window.ts
 */
import { Application, WebviewApplicationEvent } from '../../index.js';

const app = new Application();

const win1 = app.createBrowserWindow({ title: 'Window 1', width: 800, height: 600, x: 100, y: 100 });
win1.createWebview({ url: 'https://nodejs.org' });

const win2 = app.createBrowserWindow({ title: 'Window 2', width: 800, height: 600, x: 920, y: 100 });
win2.createWebview({ url: 'https://wikipedia.org' });

app.bind((err, event) => {
  if (err) return;
  if (event.event === WebviewApplicationEvent.WindowDestroyed) {
    console.log(`window ${event.windowId} closed — ${app.windowCount} still open`);
  }
  if (event.event === WebviewApplicationEvent.ApplicationExit) {
    console.log('all windows closed, application exiting');
  }
});

console.log('Close both windows to exit.');
app.run();