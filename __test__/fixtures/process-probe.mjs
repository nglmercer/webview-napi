/**
 * Exercises the out-of-process backend: window lifetimes, late webview
 * creation, page → host IPC, and the host surviving an empty window set.
 */
import { WebviewRuntime } from '../../runtime.js';

const result = { events: [] };

const runtime = await WebviewRuntime.start({ mode: 'process', exitOnLastWindowClosed: false });
result.mode = runtime.mode;
runtime.on('window-destroyed', (e) => result.events.push(`destroyed:${e.windowId}`));

const first = await runtime.createWindow({ title: 'first', width: 320, height: 240, visible: false });
const second = await runtime.createWindow({ title: 'second', width: 320, height: 240, visible: false });
result.firstId = first.id;
result.secondId = second.id;
result.windowCountAfterCreate = runtime.windowCount;

// Webviews are created on demand, long after the window exists.
const view = await first.createWebview({
  html: `<body><script>window.ipc.postMessage('ping')</script></body>`,
});
result.webviewId = view.id;
result.ipc = await new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), 10_000);
  view.on('ipc', (body) => {
    clearTimeout(timer);
    resolve(body);
  });
});

// Talking to a window that no longer exists is an error, not a crash.
await first.close();
await new Promise((r) => setTimeout(r, 200));
result.windowCountAfterFirstClose = runtime.windowCount;
try {
  await first.setTitle('gone');
  result.closedWindowError = null;
} catch (err) {
  result.closedWindowError = String(err.message ?? err);
}

await second.close();
await new Promise((r) => setTimeout(r, 200));
result.windowCountAfterAllClosed = runtime.windowCount;
result.hostAliveWithNoWindows = !runtime.exited;

await runtime.exit(0);
await runtime.whenExit();
result.exited = runtime.exited;

process.stdout.write(`\n__RESULT__${JSON.stringify(result)}\n`);
process.exit(0);
