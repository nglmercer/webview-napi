/**
 * Close guards — decide in JavaScript whether a close request is honored.
 *
 * With `setCloseGuard(true)`, the user's close request becomes a
 * `WindowCloseRequested` event instead of destroying the window. The example
 * ignores the first request and honors the second.
 *
 *   bun examples/application/06-close-guard.ts
 */
import { Application, WebviewApplicationEvent } from '../../index.js';

const app = new Application();

const win = app.createBrowserWindow({ title: 'Close Guard', width: 800, height: 600 });
win.createWebview({
  html: '<body style="font-family:system-ui; padding:2rem"><h1>Close Guard</h1><p>Try closing. The first request is ignored.</p></body>',
});

win.setCloseGuard(true);

let confirmed = false;

app.bind((err, event) => {
  if (err) return;

  if (event.event === WebviewApplicationEvent.WindowCloseRequested) {
    console.log(`close requested for window ${event.windowId}`);
    if (confirmed) {
      win.close(); // second request: really close
    } else {
      console.log('first request ignored — close again to exit');
      confirmed = true;
    }
  }

  if (event.event === WebviewApplicationEvent.WindowDestroyed) {
    console.log(`window ${event.windowId} destroyed`);
  }
});

app.run();