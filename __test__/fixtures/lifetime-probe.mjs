/**
 * Runs the window/application lifetime scenarios in a dedicated process (the
 * native event loop is a per-process singleton) and prints the observations as
 * a single JSON line for the test to assert on.
 */
import { EmbeddedRuntime } from '../../runtime.js';

const result = { events: [] };

function pump(runtime, times = 5) {
  let status;
  for (let i = 0; i < times; i++) status = runtime.app.pollEvents();
  return status;
}

const runtime = new EmbeddedRuntime({ exitOnLastWindowClosed: false, keepAlive: false });
runtime.on('window-destroyed', (e) => result.events.push(`destroyed:${e.windowId}`));
runtime.on('exit', () => result.events.push('exit'));

const first = await runtime.createWindow({ title: 'first', width: 320, height: 240, visible: false });
const second = await runtime.createWindow({ title: 'second', width: 320, height: 240, visible: false });

result.firstId = first.id;
result.secondId = second.id;
result.idsAreNumbers = typeof first.id === 'number' && typeof second.id === 'number';
result.idsAreDistinct = first.id !== second.id;
result.windowCountAfterCreate = runtime.windowCount;

// A webview requested *after* the window exists must still be created.
const view = await first.createWebview({ html: '<h1>late</h1>' });
pump(runtime);
result.lateWebviewCreated = view.native.id === 'webview';

// Closing one window leaves the other one alone.
await first.close();
pump(runtime);
result.windowCountAfterFirstClose = runtime.windowCount;
result.exitAfterFirstClose = pump(runtime).exitRequested;

// With exitOnLastWindowClosed disabled the loop survives an empty window set.
await second.close();
pump(runtime);
result.windowCountAfterAllClosed = runtime.windowCount;
result.exitAfterAllClosed = pump(runtime).exitRequested;

// The deprecated shim keeps reporting "still running".
result.runIterationBeforeExit = runtime.app.runIteration();

// Explicit application exit is the only thing that stops the loop here.
await runtime.exit(0);
const status = pump(runtime);
result.exitAfterExplicitExit = status.exitRequested;
result.runIterationAfterExit = runtime.app.runIteration();

// Threadsafe-function callbacks are delivered on a later turn of the host
// event loop; give them one before reporting.
await new Promise((resolve) => setTimeout(resolve, 250));

process.stdout.write(`\n__RESULT__${JSON.stringify(result)}\n`);
process.exit(0);
