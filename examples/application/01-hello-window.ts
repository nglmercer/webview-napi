/**
 * Hello window — the smallest possible `webview-napi` app.
 *
 * Opens a native window with the high-level `Application` API, shows a webview,
 * and runs until the window is closed.
 *
 *   bun examples/application/01-hello-window.ts
 */
import { Application, Theme, getWebviewVersion } from '../../index.js';

const app = new Application();

const win = app.createBrowserWindow({ title: 'Hello webview-napi', width: 800, height: 600 });
win.theme = Theme.Dark;

win.createWebview({
  html: `
    <!DOCTYPE html>
    <html><body style="font-family: system-ui; padding: 2rem; background: #0f172a; color: #e2e8f0">
      <h1>It works!</h1>
      <p>Native window + wry webview.</p>
      <p>WebKit version: ${getWebviewVersion()}</p>
    </body></html>
  `,
});

app.run();
console.log('app exited');