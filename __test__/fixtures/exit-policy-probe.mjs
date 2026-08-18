/**
 * `exitOnLastWindowClosed: true` (the default) must stop the loop when the last
 * window is destroyed — and a close guard must keep a window alive until JS
 * explicitly closes it.
 */
import { EmbeddedRuntime } from '../../runtime.js';

const result = {};
const runtime = new EmbeddedRuntime({ keepAlive: false });

const win = await runtime.createWindow({ title: 'guarded', width: 320, height: 240, visible: false });
await win.setCloseGuard(true);
result.guardArmed = win.native.closeGuard;
result.windowCount = runtime.windowCount;

await win.close();
for (let i = 0; i < 5; i++) runtime.app.pollEvents();

result.windowCountAfterClose = runtime.windowCount;
result.exitRequested = runtime.app.pollEvents().exitRequested;

process.stdout.write(`\n__RESULT__${JSON.stringify(result)}\n`);
process.exit(0);
