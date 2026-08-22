/**
 * Build a webview from an HTML string.
 *
 *   bun examples/builders/03-html-content.ts
 */
import { EventLoop, WebViewBuilder, WindowBuilder, WryTheme } from '../../index.js';
import { titleCard } from '../_shared/html.js';

const loop = new EventLoop();
const window = new WindowBuilder().withTitle('HTML content').withInnerSize(800, 600).build(loop);

const view = new WebViewBuilder()
  .withHtml(titleCard('Builder HTML', 'This page came from a plain string.'))
  .withTheme(WryTheme.Dark)
  .buildOnWindow(window, 'html-view');

view.evaluateScript(`document.querySelector('h1').textContent = 'HTML content is live'`);

const poll = () => {
  if (loop.runIteration()) setTimeout(poll, 10);
};
poll();
