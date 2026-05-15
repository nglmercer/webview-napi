/**
 * Remote Headless Bridge Example
 *
 * This example demonstrates how to use @webviewjs/webview patterns in a
 * headless / console-only environment (e.g., a remote Linux server).
 *
 * Since the native webview requires a display environment (X11/Wayland),
 * this example shows:
 * 1. A console-only Node.js server (The Agent).
 * 2. Serving a "Remote View" that connects to the agent.
 * 3. Bidirectional communication (Bridge) that mimics the `webview.send` and `ipc.postMessage` patterns.
 * 4. Documentation on how to run native webviews headlessly using Xvfb.
 */

import http from 'node:http';
import { createLogger } from './logger.js';

const logger = createLogger('Remote-Headless');
const PORT = 3001;

// Simple state to track messages for the bridge
let lastAgentMessage = '';
let lastRemoteMessage = '';

/**
 * 1. Start the Remote Bridge Server
 */
function startRemoteBridge() {
  const server = http.createServer((req, res) => {
    // Enable CORS for remote access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Agent sending a message to the Remote View (Poll-based for simplicity)
    if (req.url === '/agent-to-remote' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: lastAgentMessage }));
      lastAgentMessage = ''; // Clear after sending
      return;
    }

    // Remote View sending a message to the Agent
    if (req.url === '/remote-to-agent' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          lastRemoteMessage = data.message;
          logger.info(`Agent received from Remote: ${lastRemoteMessage}`);
          res.writeHead(200);
          res.end('OK');
        } catch {
          res.writeHead(400);
          res.end('Invalid JSON');
        }
      });
      return;
    }

    // Serve the Remote View UI
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Remote Webview Bridge</title>
            <style>
              body { font-family: sans-serif; background: #2c3e50; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: #34495e; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); text-align: center; width: 80%; max-width: 500px; }
              input { padding: 10px; border-radius: 4px; border: none; width: 70%; margin-bottom: 10px; }
              button { padding: 10px 20px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; }
              #log { margin-top: 20px; background: #1a252f; padding: 10px; border-radius: 4px; text-align: left; height: 150px; overflow-y: auto; font-family: monospace; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Remote Webview</h1>
              <p>Connected to Console Agent at <code>localhost:${PORT}</code></p>
              <input type="text" id="msgInput" placeholder="Type message to agent...">
              <button onclick="sendMessage()">Send to Agent</button>
              <div id="log">--- Connection Log ---<br></div>
            </div>

            <script>
              const logEl = document.getElementById('log');
              function log(msg) {
                logEl.innerHTML += '[' + new Date().toLocaleTimeString() + '] ' + msg + '<br>';
                logEl.scrollTop = logEl.scrollHeight;
              }

              async function sendMessage() {
                const input = document.getElementById('msgInput');
                const message = input.value;
                log('Sending to agent: ' + message);
                await fetch('/remote-to-agent', {
                  method: 'POST',
                  body: JSON.stringify({ message })
                });
                input.value = '';
              }

              // Poll for messages from Agent (Mimics webview.onMessage)
              setInterval(async () => {
                const res = await fetch('/agent-to-remote');
                const data = await res.json();
                if (data.message) {
                  log('Received from agent: ' + data.message);
                }
              }, 1000);

              log('Remote View Ready.');
            </script>
          </body>
        </html>
      `);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, '0.0.0.0', () => {
    logger.banner('Remote Headless Bridge', 'Agent running in console-only mode');
    logger.success(`Bridge Server running at http://localhost:${PORT}`);
    logger.info('HOW TO USE:');
    logger.info(`1. Open http://localhost:${PORT} in your browser.`);
    logger.info('2. Type messages in the browser to send to this console.');
    logger.info('3. Messages from this console will appear in the browser.');
    logger.info('---------------------------------------------------------');
    logger.info('HEADLESS NATIVE WEBVIEW TIP:');
    logger.info('To run a NATIVE webview on a headless Linux server, use Xvfb:');
    logger.info('  sudo apt install xvfb');
    logger.info('  xvfb-run -a bun run your-app.ts');
    logger.info('---------------------------------------------------------');
  });

  return server;
}

/**
 * 2. Main Agent Loop
 */
async function main() {
  const server = startRemoteBridge();

  // Mimic an agent doing work and sending "events" to the remote UI
  let counter = 0;
  const agentWork = setInterval(() => {
    counter++;
    if (counter % 10 === 0) {
      lastAgentMessage = `Agent Heartbeat #${counter} - All systems green.`;
      logger.info('Sent heartbeat to Remote View');
    }

    // Check for messages from Remote
    if (lastRemoteMessage) {
      const msg = lastRemoteMessage;
      lastRemoteMessage = '';

      logger.success(`Agent processing command: "${msg}"`);

      // Send a response back
      setTimeout(() => {
        lastAgentMessage = `Command "${msg}" executed successfully at ${new Date().toLocaleTimeString()}`;
      }, 500);
    }
  }, 1000);

  // Keep process alive
  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    clearInterval(agentWork);
    server.close();
    process.exit(0);
  });
}

main();
