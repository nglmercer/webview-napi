import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The native event loop is a per-process singleton, so each scenario runs in
// its own child process and reports back over stdout.
const isInCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const headless = !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
const skip = isInCI || headless;

function runProbe(fixture: string): Record<string, unknown> {
  const path = fileURLToPath(new URL(`./fixtures/${fixture}`, import.meta.url));
  const proc = spawnSync(process.execPath, [path], { encoding: 'utf8', timeout: 60_000 });
  const marker = proc.stdout.lastIndexOf('__RESULT__');
  if (marker < 0) {
    throw new Error(`probe ${fixture} produced no result:\n${proc.stdout}\n${proc.stderr}`);
  }
  return JSON.parse(proc.stdout.slice(marker + '__RESULT__'.length).trim());
}

describe('window / application lifetime', () => {
  test.skipIf(skip)('windows are independent of the application', () => {
    const r = runProbe('lifetime-probe.mjs') as any;

    // Windows expose a real numeric id once the loop has created them.
    expect(r.idsAreNumbers).toBe(true);
    expect(r.idsAreDistinct).toBe(true);
    expect(r.windowCountAfterCreate).toBe(2);

    // A webview requested after the window was built is still created.
    expect(r.lateWebviewCreated).toBe(true);

    // Closing one window destroys only that window.
    expect(r.windowCountAfterFirstClose).toBe(1);
    expect(r.exitAfterFirstClose).toBe(false);
    expect(r.events).toContain(`destroyed:${r.firstId}`);

    // With the policy disabled, zero windows does not mean "application dead".
    expect(r.windowCountAfterAllClosed).toBe(0);
    expect(r.exitAfterAllClosed).toBe(false);
    expect(r.runIterationBeforeExit).toBe(true);

    // Only exit() stops the loop.
    expect(r.exitAfterExplicitExit).toBe(true);
    expect(r.runIterationAfterExit).toBe(false);
    expect(r.events).toContain('exit');
  });

  test.skipIf(skip)('exitOnLastWindowClosed and close guards', () => {
    const r = runProbe('exit-policy-probe.mjs') as any;

    expect(r.guardArmed).toBe(true);
    expect(r.windowCount).toBe(1);
    // An explicit close() still works with the guard armed.
    expect(r.windowCountAfterClose).toBe(0);
    // Default policy: the last window closing ends the application.
    expect(r.exitRequested).toBe(true);
  });
});
