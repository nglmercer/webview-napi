/**
 * Navigate a builder-created webview after it has been shown.
 *
 *   bun examples/builders/04-url-navigation.ts
 */
import { EventLoop, WebViewBuilder, WindowBuilder } from '../../index.js';

const loop = new EventLoop();
const window = new WindowBuilder().withTitle('URL navigation').withInnerSize(1024, 700).build(loop);

const view = new WebViewBuilder().withUrl('https://nodejs.org').withDevtools(true).buildOnWindow(window, 'browser');

setTimeout(() => view.loadUrl('https://www.rust-lang.org'), 3000);

const poll = () => {
  if (loop.runIteration()) setTimeout(poll, 10);
};
poll();
