/**
 * Localhost Web Server Example
 *
 * This example demonstrates how to:
 * 1. Start a local HTTP server using Node.js built-in 'http' module.
 * 2. Create a desktop window and webview using @webviewjs/webview.
 * 3. Load the localhost URL into the webview.
 * 4. Communicate between the web page and the Node.js host via IPC.
 */

import http from 'node:http';
import { WindowBuilder, WebViewBuilder, EventLoop, TaoTheme } from '../index.js';
import { createLogger } from './logger.js';

const logger = createLogger('Localhost-Example');
const PORT = 3000;

/**
 * 1. Start a simple HTTP server
 */
function startServer() {
  const server = http.createServer((req: any, res: any) => {
    logger.info(`Server received request: ${req.method} ${req.url}`);

    // Serve a simple HTML page
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Localhost Web Server</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              background: #f0f2f5;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .card {
              background: white;
              padding: 2rem;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
            }
            h1 { color: #1a73e8; }
            button {
              background: #1a73e8;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 1rem;
              margin-top: 1rem;
            }
            button:hover { background: #1557b0; }
            #status { margin-top: 1rem; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Localhost Server</h1>
            <p>This page is being served from <code>http://localhost:${PORT}</code></p>
            <button id="ping">Send IPC Ping to Node.js</button>
            <div id="status"></div>
          </div>

          <script>
            const btn = document.getElementById('ping');
            const status = document.getElementById('status');

            btn.onclick = () => {
              status.textContent = 'Sending ping...';
              // window.ipc is injected by the webview-napi library
              if (window.ipc && window.ipc.postMessage) {
                window.ipc.postMessage('ping');
              } else {
                status.textContent = 'Error: IPC not available';
              }
            };

            // This global function is called when Node.js calls webview.send()
            window.__webview_on_message__ = (msg) => {
              status.textContent = 'Received from Node.js: ' + msg;
              status.style.color = '#34a853';
            };
          </script>
        </body>
      </html>
    `);
  });

  server.listen(PORT, 'localhost', () => {
    logger.success(`HTTP server running at http://localhost:${PORT}`);
  });

  return server;
}

/**
 * 2. Main Application
 */
async function main() {
  logger.banner('Localhost Web Server Example', 'Serving content via HTTP and loading it in Webview');

  const server = startServer();
  const eventLoop = new EventLoop();

  try {
    logger.info('Creating window...');
    const window = new WindowBuilder()
      .withTitle('Localhost Webview')
      .withInnerSize(800, 600)
      .withTheme(TaoTheme.Light)
      .build(eventLoop);

    logger.info('Creating webview...');
    const webview = new WebViewBuilder()
      .withUrl(`http://localhost:${PORT}`)
      .withIpcHandler((err: any, msg: string) => {
        if (err) {
          logger.error('IPC Error:', err);
          return;
        }

        logger.info(`Received IPC from Webview: ${msg}`);
        if (msg === 'ping') {
          setTimeout(() => {
            webview.send('Pong from Node.js! Time: ' + new Date().toLocaleTimeString());
            logger.info('Sent IPC reply to Webview');
          }, 500);
        }
      })
      .buildOnWindow(window, 'main-view');

    logger.success('Application started successfully');
    logger.info('Close the window to exit');

    // Simple run loop
    const interval = setInterval(() => {
      if (!eventLoop.runIteration()) {
        logger.info('Event loop stopped, exiting...');
        clearInterval(interval);
        server.close();
        process.exit(0);
      }
    }, 16);

  } catch (error: any) {
    logger.error('Failed to start application:', { error: error.message });
    server.close();
    process.exit(1);
  }
}

main();
