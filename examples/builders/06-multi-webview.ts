/**
 * Place two webviews side by side in one native window.
 *
 *   bun examples/builders/06-multi-webview.ts
 */
import { EventLoop, WebViewBuilder, WindowBuilder } from '../../index.js';

const loop = new EventLoop();
const window = new WindowBuilder().withTitle('Multiple webviews').withInnerSize(1000, 600).build(loop);

const page = (name: string) => `<!doctype html>
<html><body style="font-family:system-ui;padding:2rem;background:#0f172a;color:#e2e8f0">
  <h1>${name}</h1>
  <button onclick="window.ipc.postMessage('hello from ${name}')">Send IPC</button>
</body></html>`;

new WebViewBuilder()
  .withHtml(page('Left view'))
  .withX(0)
  .withY(0)
  .withWidth(500)
  .withHeight(600)
  .withIpcHandler((_error, message) => console.log('left:', message))
  .buildOnWindow(window, 'left');

new WebViewBuilder()
  .withHtml(page('Right view'))
  .withX(500)
  .withY(0)
  .withWidth(500)
  .withHeight(600)
  .withIpcHandler((_error, message) => console.log('right:', message))
  .buildOnWindow(window, 'right');

const poll = () => {
  if (loop.runIteration()) setTimeout(poll, 10);
};
poll();
