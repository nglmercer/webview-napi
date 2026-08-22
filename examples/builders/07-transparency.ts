/**
 * Configure transparency through the builder APIs.
 *
 *   bun examples/builders/07-transparency.ts
 */
import { EventLoop, WebViewBuilder, WindowBuilder } from '../../index.js';

const loop = new EventLoop();
const window = new WindowBuilder()
  .withTitle('Builder transparency')
  .withInnerSize(700, 450)
  .withTransparent(true)
  .withDecorated(false)
  .build(loop);

new WebViewBuilder()
  .withTransparent(true)
  .withHtml(`<!doctype html>
<html><head><style>
  html, body { height: 100%; margin: 0; background: transparent; }
</style></head><body style="display:grid;place-items:center;font:24px system-ui;color:white">
  <div style="padding:3rem;border:2px solid #38bdf8;border-radius:1rem;background:#0f172acc">
    Transparent window
  </div>
</body></html>`)
  .buildOnWindow(window, 'transparent');

const poll = () => {
  if (loop.runIteration()) setTimeout(poll, 10);
};
poll();
