/**
 * Transparent window.
 *
 * Three things must agree for real transparency: a transparent window, a
 * transparent webview, and CSS that does not paint an opaque background.
 *
 *   bun examples/application/08-transparency.ts
 */
import { Application } from '../../index.js';

const app = new Application();

const win = app.createBrowserWindow({
  title: 'Transparent',
  width: 600,
  height: 400,
  transparent: true,
  decorations: false,
});

win.createWebview({
  transparent: true,
  enableDevtools: true,
  html: `
    <!DOCTYPE html>
    <html><head><style>
      html, body { background: transparent !important; margin: 0; height: 100%; }
    </style></head>
    <body>
      <div style="background: rgba(0, 122, 255, 0.55); height: 100%;
                  display: grid; place-items: center;
                  border: 2px solid #007aff; border-radius: 1rem;
                  font-family: system-ui; color: #fff; text-align: center;">
        <h1>Hello, transparency!</h1>
      </div>
    </body></html>
  `,
});

app.run();