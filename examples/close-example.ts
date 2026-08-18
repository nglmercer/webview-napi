/**
 * Window close semantics.
 *
 * Closing a window destroys that window only. The application exits when its
 * policy says so — here `exitOnLastWindowClosed` is left at its default (true),
 * so the app ends once the last window is gone.
 *
 * The window also arms a close guard, which turns the user's close request into
 * a plain event: nothing is destroyed until we call `window.close()` ourselves.
 */
import { Application, WebviewApplicationEvent } from '../index.js';

const app = new Application();

const browserWindow = app.createBrowserWindow({
  title: 'Close Example',
  width: 800,
  height: 600,
});

browserWindow.createWebview({
  html: `
    <!DOCTYPE html>
    <html>
      <body style="font-family: system-ui; padding: 24px">
        <h1>Close Example</h1>
        <p>Closing this window asks JavaScript first.</p>
        <button onclick="window.ipc.postMessage('confirm-close')">Close window</button>
      </body>
    </html>
  `,
});

// Ask before closing: with the guard armed, a close request only notifies us.
browserWindow.setCloseGuard(true);

let confirmed = false;

app.bind((err, event) => {
  if (err) return;

  if (event.event === WebviewApplicationEvent.WindowCloseRequested) {
    console.log(`close requested for window ${event.windowId}`);
    if (confirmed) {
      browserWindow.close();
    } else {
      console.log('first request ignored — click again (or press the button) to close');
      confirmed = true;
    }
  }

  if (event.event === WebviewApplicationEvent.WindowDestroyed) {
    console.log(`window ${event.windowId} destroyed`);
  }

  if (event.event === WebviewApplicationEvent.ApplicationExit) {
    console.log('application exiting');
  }
});

// `app.exit()` stops the event loop regardless of how many windows are open.
// setTimeout(() => app.exit(), 5000)

app.run();
