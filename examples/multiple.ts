/**
 * Two independent windows.
 *
 * Each window has its own lifetime: closing one leaves the other running. The
 * application exits by itself once the last one is destroyed (the default
 * `exitOnLastWindowClosed` policy).
 */
import { Application, WebviewApplicationEvent } from '../index.js';

const app = new Application();

const window1 = app.createBrowserWindow({
  title: 'Window 1 - Node.js',
  width: 800,
  height: 600,
  x: 100,
  y: 100,
});
window1.createWebview({ url: 'https://nodejs.org' });

const window2 = app.createBrowserWindow({
  title: 'Window 2 - Wikipedia',
  width: 800,
  height: 600,
  x: 920,
  y: 100,
});
window2.createWebview({ url: 'https://wikipedia.org' });

app.bind((err, event) => {
  if (err) return;

  if (event.event === WebviewApplicationEvent.WindowDestroyed) {
    console.log(`window ${event.windowId} closed, ${app.windowCount} still open`);
  }

  if (event.event === WebviewApplicationEvent.ApplicationExit) {
    console.log('all windows closed, application exiting');
  }
});

console.log('Close both windows to exit.');

app.run();
