# Inter-Process Communication (IPC)

Send messages between your Node/Bun logic and the JavaScript running inside the webview.
Two directions, one channel.

## Node → page

`webview.send(message)` invokes a global handler you define on the page,
`window.__webview_on_message__`:

```typescript
import { Application } from 'webview-napi';

const app = new Application();
const win = app.createBrowserWindow({ title: 'IPC' });
const view = win.createWebview({
  html: `
    <script>
      window.__webview_on_message__ = (msg) => {
        document.querySelector('#out').textContent = 'Node said: ' + msg;
      };
    </script>
    <div id="out">waiting…</div>
  `,
});

setTimeout(() => view.send('hello from Node'), 1000);
app.run();
```

## page → Node

On the page, call `window.ipc.postMessage(...)`. Register the listener before the loop
runs:

```typescript
const view = win.createWebview({ html: `<button onclick="window.ipc.postMessage('hi')">send</button>` });

view.onIpcMessage((err, message) => {
  if (err) return;
  console.log('page says:', message);
});
```

`on(handler)` is an alias for `onIpcMessage`. On the builder API, use
`new WebViewBuilder().withIpcHandler((err, msg) => …)`.

## Full round-trip

```typescript
const view = win.createWebview({
  html: `<script>
    window.ipc.postMessage('hello');
    window.__webview_on_message__ = (m) => console.log('got', m);
  </script>`,
});

view.onIpcMessage((err, message) => {
  if (err) return;
  view.send('echo: ' + message); // bounces it back to the page
});
```

## Example

- [`examples/application/04-ipc.ts`](../examples/application/04-ipc.ts)