# Pixel Rendering

When you don't need a webview — an emulator, a canvas, a custom video player — render raw
RGBA pixel buffers straight to a window with `PixelRenderer`.

## Renderer

```typescript
import { EventLoop, WindowBuilder, PixelRenderer, RenderOptions, ScaleMode } from 'webview-napi';

const loop = new EventLoop();
const win = new WindowBuilder().withTitle('Render').withInnerSize(400, 300).build(loop);

const renderer = PixelRenderer.withOptions({
  bufferWidth: 400,
  bufferHeight: 300,
  scaleMode: ScaleMode.Fit,          // see below
  backgroundColor: [0, 0, 0, 255],   // letterbox color
});
```

Or construct directly with `new PixelRenderer(bufferWidth, bufferHeight)`.

## Buffers

A buffer is a plain Node.js `Buffer` of `width * height * 4` bytes in RGBA order:

```typescript
const pixels = Buffer.alloc(400 * 300 * 4);
for (let i = 0; i < pixels.length; i += 4) {
  pixels[i] = 0;      // R
  pixels[i + 1] = 0;  // G
  pixels[i + 2] = 0;  // B
  pixels[i + 3] = 255; // A
}
renderer.render(win, pixels);
```

For repeated rendering, create one `PixelRenderer` and reuse it. It caches per-window
contexts internally to avoid resource-exhaustion from too many new surfaces.

## Scale modes

`ScaleMode` controls how the source buffer maps onto the window when they differ in size:

| Mode | Behavior |
| --- | --- |
| `Stretch` | Distorts to fill the window |
| `Fit` | Aspect-ratio preserved, letterboxed (default) |
| `Fill` | Aspect-ratio preserved, cropped to fill |
| `Integer` | Pixel-perfect integer scaling |
| `None` | Original size, centered |

Runtime controls: `renderer.setScaleMode(mode)` and `renderer.setBackgroundColor(r, g, b, a)`.

## One-shot helper

For a single render you can use the `renderPixels(window, buffer, width, height)`
convenience function. Do **not** use it repeatedly — creating surfaces every call can hit
resource limits. Use a `PixelRenderer` instead.

## See also

- [`examples/rendering/pixel-renderer.ts`](../examples/rendering/pixel-renderer.ts)