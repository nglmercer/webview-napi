import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hostAvailable } from '../runtime.cjs';

const isInCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const headless = !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
// The host binary is built separately (`bun run build:host`).
const skip = isInCI || headless || !hostAvailable();

describe('process runtime (webview-host)', () => {
  test.skipIf(skip)('windows and the host have independent lifetimes', () => {
    const path = fileURLToPath(new URL('./fixtures/process-probe.mjs', import.meta.url));
    const proc = spawnSync(process.execPath, [path], { encoding: 'utf8', timeout: 90_000 });
    const marker = proc.stdout.lastIndexOf('__RESULT__');
    if (marker < 0) throw new Error(`probe produced no result:\n${proc.stdout}\n${proc.stderr}`);
    const r = JSON.parse(proc.stdout.slice(marker + '__RESULT__'.length).trim());

    expect(r.mode).toBe('process');
    expect(r.firstId).toBe(1);
    expect(r.secondId).toBe(2);
    expect(r.windowCountAfterCreate).toBe(2);

    // A webview created after the window, and a message coming back from the page.
    expect(r.webviewId).toBe(1);
    expect(r.ipc).toBe('ping');

    // Closing one window leaves the other alone, and the dead window reports an
    // error instead of taking the host down.
    expect(r.windowCountAfterFirstClose).toBe(1);
    expect(r.closedWindowError).toContain('unknown window');
    expect(r.events).toContain('destroyed:1');

    // The host outlives its windows; only exit() stops it.
    expect(r.windowCountAfterAllClosed).toBe(0);
    expect(r.hostAliveWithNoWindows).toBe(true);
    expect(r.exited).toBe(true);
  });
});
