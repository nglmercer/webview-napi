/**
 * Build a webview on an existing window with `WebViewBuilder`.
 *
 * Shows a page, runs a script, and opens the devtools.
 *
 *   bun examples/builders/02-basic-webview.ts
 */
import { EventLoop, WindowBuilder, WebViewBuilder, TaoTheme, WryTheme } from '../../index.js';

const loop = new EventLoop();

const win = new WindowBuilder()
  .withTitle('Basic Webview')
  .withInnerSize(800, 600)
  .withTheme(TaoTheme.Dark)
  .build(loop);

const view = new WebViewBuilder()
  .withHtml(`<!DOCTYPE html>
<html><body style="font-family:system-ui; padding:2rem; background:#0f172a; color:#e2e8f0">
  <h1>Built with WebViewBuilder</h1>
  <p id="out">no script ran yet</p>
</body></html>`)
  .withTheme(WryTheme.Dark)
  .withDevtools(true)
  .buildOnWindow(win, 'main-view');

view.evaluateScript(`document.getElementById('out').textContent = 'script ran!'`);
view.openDevtools();

const poll = () => {
  if (loop.runIteration()) setTimeout(poll, 10);
};
poll();