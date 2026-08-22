/**
 * Share one low-level event loop between multiple windows.
 *
 *   bun examples/builders/05-multiple-windows.ts
 */
import { EventLoop, WebViewBuilder, WindowBuilder } from '../../index.js';

const loop = new EventLoop();

const first = new WindowBuilder().withTitle('Builder window 1').withInnerSize(640, 480).withPosition(80, 80).build(loop);
new WebViewBuilder().withUrl('https://nodejs.org').buildOnWindow(first, 'node');

const second = new WindowBuilder()
  .withTitle('Builder window 2')
  .withInnerSize(640, 480)
  .withPosition(760, 80)
  .build(loop);
new WebViewBuilder().withUrl('https://www.wikipedia.org').buildOnWindow(second, 'wikipedia');

console.log('Close both windows to finish.');

const poll = () => {
  if (loop.runIteration()) setTimeout(poll, 10);
};
poll();
