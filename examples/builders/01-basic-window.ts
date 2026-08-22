/**
 * Build a window with `WindowBuilder` and control it at runtime.
 *
 * The event loop is pumped with `runIteration()` so timers keep firing while
 * the window is open. Try it: the title changes, the window maximizes, then it
 * closes itself.
 *
 *   bun examples/builders/01-basic-window.ts
 */
import { EventLoop, WindowBuilder, TaoTheme } from '../../index.js';
import { createLogger } from '../_shared/logger.js';

const logger = createLogger('BasicWindow');

const loop = new EventLoop();

const win = new WindowBuilder()
  .withTitle('Basic Window')
  .withInnerSize(800, 600)
  .withPosition(100, 100)
  .withResizable(true)
  .withDecorated(true)
  .withVisible(true)
  .withFocused(true)
  .withMenubar(true)
  .withTheme(TaoTheme.Dark)
  .build(loop);

logger.info('window created', { id: win.id.toString() });

// A quick scripted tour of the runtime controls (pumped every second).
let step = 0;
const tour = setInterval(() => {
  step += 1;
  logger.info(`step ${step}`);

  if (step === 1) win.setTitle('Step 2: maximized');
  if (step === 2) win.setMaximized(true);
  if (step === 3) {
    logger.info('window state', {
      visible: win.isVisible(),
      resizable: win.isResizable(),
      decorated: win.isDecorated(),
    });
  }
  if (step === 4) {
    win.close();
    clearInterval(tour);
  }
}, 1000);

// Pump the loop so timers and window events are processed.
const poll = () => {
  if (loop.runIteration()) setTimeout(poll, 10);
};
poll();
