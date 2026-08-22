/**
 * Load inline HTML in a webview.
 *
 * The page's global `window.__webview_on_message__` receives any message the
 * host sends with `webview.send()`, and the page calls `window.ipc.postMessage`
 * to send back.
 *
 *   bun examples/application/03-load-html.ts
 */
import { titleCard } from '../_shared/html.js';
import { Application } from '../../index.js';

const app = new Application();

const win = app.createBrowserWindow({ title: 'Inline HTML', width: 800, height: 600 });
const view = win.createWebview({ html: titleCard('Inline HTML', 'Hello from a string.') });

// Push a message to the page once it has a second to load.
setTimeout(() => view.send('hello from the host'), 1500);

app.run();
