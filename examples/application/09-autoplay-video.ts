/**
 * Autoplay a <video> in a webview.
 *
 *   bun examples/application/09-autoplay-video.ts
 */
import { Application } from '../../index.js';

const app = new Application();

const win = app.createBrowserWindow({ title: 'Autoplay', width: 800, height: 600 });
win.createWebview({
  html: `<!DOCTYPE html>
<html><body style="font-family:system-ui; padding:2rem; background:#0f172a; color:#e2e8f0">
  <h1>Autoplay</h1>
  <video width="640" height="360" controls muted autoplay>
    <source
      src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
      type="video/mp4" />
  </video>
</body></html>`,
});

app.run();