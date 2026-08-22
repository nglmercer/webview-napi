/**
 * Bidirectional IPC between the host and the page.
 *
 * Demo flow:
 *   1. The page posts messages to Node with `window.ipc.postMessage`.
 *   2. Node listens with `view.onIpcMessage`.
 *   3. Node replies with `view.send`, which the page receives in
 *      `window.__webview_on_message__`.
 *
 *   bun examples/application/04-ipc.ts
 */
import { Application } from '../../index.js';

const page = `<!DOCTYPE html>
<html><body style="font-family: system-ui; padding: 2rem">
  <h1 id="out">waiting for the host…</h1>
  <button id="send">Send message to Node</button>

  <script>
    // 1. page -> Node
    document.getElementById('send').onclick = () => {
      window.ipc.postMessage('ping from the page');
    };

    // 4. Node -> page
    window.__webview_on_message__ = (msg) => {
      document.getElementById('out').textContent = msg;
    };
  </script>
</body></html>`;

const app = new Application();
const win = app.createBrowserWindow({ title: 'IPC', width: 640, height: 480 });
const view = win.createWebview({ html: page });

// 2. register the listener before the loop runs
view.onIpcMessage((err, message) => {
  if (err) return;
  console.log('page said:', message);
  // 3. reply after a short tick
  setTimeout(() => view.send('pong from Node: ' + message), 200);
});

app.run();