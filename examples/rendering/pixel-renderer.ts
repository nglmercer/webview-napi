/**
 * Render animated RGBA frames without creating a webview.
 *
 *   bun examples/rendering/pixel-renderer.ts
 */
import { EventLoop, PixelRenderer, RenderOptions, ScaleMode, WindowBuilder } from '../../index.js';

const width = 320;
const height = 240;
const loop = new EventLoop();
const window = new WindowBuilder().withTitle('Pixel renderer').withInnerSize(640, 480).build(loop);

const options: RenderOptions = {
  bufferWidth: width,
  bufferHeight: height,
  scaleMode: ScaleMode.Fit,
  backgroundColor: [12, 18, 32, 255],
};
const renderer = PixelRenderer.withOptions(options);

function frameBuffer(frame: number): Buffer {
  const buffer = Buffer.alloc(width * height * 4);
  const hue = frame % 255;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      buffer[offset] = (x + hue) % 255;
      buffer[offset + 1] = (y * 2 + hue) % 255;
      buffer[offset + 2] = hue;
      buffer[offset + 3] = 255;
    }
  }

  return buffer;
}

let frame = 0;
const renderTimer = setInterval(() => {
  renderer.render(window, frameBuffer(frame));
  frame += 1;
}, 33);

console.log('Rendering at roughly 30 FPS. Close the window to finish.');

const poll = () => {
  if (loop.runIteration()) {
    setTimeout(poll, 10);
  } else {
    clearInterval(renderTimer);
  }
};
poll();
