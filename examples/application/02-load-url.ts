/**
 * Load a remote URL in a webview.
 *
 *   bun examples/application/02-load-url.ts
 */
import { Application } from '../../index.js';

const app = new Application();

const win = app.createBrowserWindow({
  title: 'Load URL',
  width: 1024,
  height: 768,
});

win.createWebview({ url: 'https://nodejs.org' });

app.run();