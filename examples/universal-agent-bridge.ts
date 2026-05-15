/**
 * Universal Agent Bridge Example
 *
 * This example addresses the requirement of managing a web-based UI from a
 * remote browser when the host system is console-only (headless).
 *
 * SCENARIO:
 * 1. You have a headless server (Agent).
 * 2. You want to manage/interact with it from a remote computer's browser.
 * 3. You want bidirectional communication (Agent <-> Remote UI).
 *
 * THIS EXAMPLE PROVIDES:
 * - A headless HTTP server that serves a "Command Center" UI.
 * - An IPC-like bridge using a simple REST/Polling mechanism.
 * - Demonstration of how the Agent can "push" data to the remote browser.
 * - Demonstration of how the remote browser can "control" the Agent.
 */

import http from 'node:http';
import { createLogger } from './logger.js';

const logger = createLogger('Agent-Bridge');
const PORT = 3005;

// Shared state between Agent and Remote View
const agentState = {
  status: 'Idle',
  lastCommand: 'None',
  uptime: 0,
  logs: [] as string[],
  pendingMessagesForRemote: [] as string[]
};

/**
 * 1. The Headless Agent Bridge
 */
function startAgentServer() {
  const server = http.createServer((req, res) => {
    // Basic Routing
    const url = req.url || '/';

    // --- API: Get Agent State (Polling for Remote View) ---
    if (url === '/api/state' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...agentState,
        pendingMessages: agentState.pendingMessagesForRemote
      }));
      agentState.pendingMessagesForRemote = []; // Clear queue after send
      return;
    }

    // --- API: Send Command to Agent (From Remote View) ---
    if (url === '/api/command' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => {
        try {
          const { command, data } = JSON.parse(body);
          handleRemoteCommand(command, data);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
        } catch {
          res.writeHead(400);
          res.end('Invalid Command');
        }
      });
      return;
    }

    // --- Serve Command Center UI ---
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(createCommandCenterHtml());
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  server.listen(PORT, '0.0.0.0', () => {
    logger.banner('Universal Agent Bridge', 'Headless Management System');
    logger.success(`Agent running at http://localhost:${PORT}`);
    logger.info('To manage this agent from a remote computer, use its IP address.');
    logger.info('e.g., http://192.168.1.10:3005');
  });

  return server;
}

/**
 * Handle commands sent from the remote browser
 */
function handleRemoteCommand(command: string, data: any) {
  logger.info(`Received Remote Command: ${command}`, { data });
  agentState.lastCommand = command;

  switch (command) {
    case 'START_TASK':
      agentState.status = 'Processing...';
      agentState.logs.push(`Started task: ${data.taskName}`);
      setTimeout(() => {
        agentState.status = 'Task Completed';
        agentState.pendingMessagesForRemote.push(`Task "${data.taskName}" finished successfully!`);
      }, 2000);
      break;
    case 'SHUTDOWN':
      agentState.status = 'Shutting down';
      logger.warning('Shutdown command received via remote UI');
      setTimeout(() => process.exit(0), 1000);
      break;
    default:
      agentState.logs.push(`Unknown command: ${command}`);
  }
}

/**
 * HTML for the Remote Management Interface
 */
function createCommandCenterHtml() {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Agent Command Center</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          :root { --primary: #2563eb; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; }
          body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); padding: 20px; margin: 0; }
          .container { max-width: 800px; margin: 0 auto; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
          .card { background: var(--card); padding: 20px; border-radius: 12px; border: 1px solid #334155; }
          h1 { color: var(--primary); margin-top: 0; }
          .status { font-size: 1.5rem; font-weight: bold; color: #10b981; }
          button { background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; width: 100%; margin-bottom: 10px; font-weight: 600; }
          button.danger { background: #ef4444; }
          #logs { height: 200px; overflow-y: auto; background: #000; padding: 10px; font-family: monospace; font-size: 0.9rem; border-radius: 6px; border: 1px solid #334155; }
          .log-entry { margin-bottom: 4px; border-left: 2px solid var(--primary); padding-left: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Agent Command Center</h1>

          <div class="grid">
            <div class="card">
              <h3>System Status</h3>
              <div id="status" class="status">Connecting...</div>
              <p>Uptime: <span id="uptime">0</span>s</p>
            </div>
            <div class="card">
              <h3>Actions</h3>
              <button onclick="sendCommand('START_TASK', {taskName: 'Remote Web Scan'})">Start Remote Task</button>
              <button class="danger" onclick="sendCommand('SHUTDOWN')">Shutdown Agent</button>
            </div>
          </div>

          <div class="card">
            <h3>Activity Log</h3>
            <div id="logs"></div>
          </div>
        </div>

        <script>
          async function sendCommand(command, data = {}) {
            await fetch('/api/command', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command, data })
            });
          }

          function addLog(msg) {
            const logs = document.getElementById('logs');
            const div = document.createElement('div');
            div.className = 'log-entry';
            div.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
            logs.prepend(div);
          }

          async function sync() {
            try {
              const res = await fetch('/api/state');
              const state = await res.json();

              document.getElementById('status').textContent = state.status;
              document.getElementById('uptime').textContent = state.uptime;

              if (state.pendingMessages) {
                state.pendingMessages.forEach(msg => {
                  alert('Agent Message: ' + msg);
                  addLog('PUSH: ' + msg);
                });
              }
            } catch (e) {
              document.getElementById('status').textContent = 'OFFLINE';
              document.getElementById('status').style.color = '#ef4444';
            }
          }

          setInterval(sync, 1000);
          addLog('Remote UI Initialized.');
        </script>
      </body>
    </html>
  `;
}

/**
 * 2. Main Execution
 */
async function main() {
  startAgentServer();

  // Simulated Agent Background Logic
  setInterval(() => {
    agentState.uptime++;
    if (agentState.uptime % 30 === 0) {
      agentState.logs.push(`Routine maintenance performed at ${agentState.uptime}s`);
    }
  }, 1000);

  // Graceful exit
  process.on('SIGINT', () => {
    logger.info('Shutting down Agent...');
    process.exit(0);
  });
}

main();
