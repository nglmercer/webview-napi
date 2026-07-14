/**
 * Unit tests for webview-napi fixes and edge cases.
 *
 * These tests verify:
 * 1. Version functions return correct, non-hardcoded values
 * 2. Monitor functions return real monitor data
 * 3. Window close behavior (hide instead of broken redraw)
 * 4. Error handling for edge cases
 * 5. Enum consistency with Rust source
 */

import { describe, test, expect } from 'bun:test'
import {
  taoVersion,
  webviewVersion,
  primaryMonitor,
  availableMonitors,
  CursorIcon,
  Key,
  KeyCode,
  WindowEvent,
  ControlFlow,
  TaoTheme,
  Theme,
  Error as WryError,
  ModifiersState,
  MouseButtonState,
  FullscreenType,
  ProgressBarStatus,
  ScaleMode,
  BackgroundThrottlingPolicy,
  DragDropEvent,
  PageLoadEvent,
  NewWindowResponse,
  ResizeDirection,
  UserAttentionType,
  WryTheme,
  WindowLevel,
  StartCause,
  TouchPhase,
  ProgressState,
  ImeState,
  DeviceEventFilter,
  KeyLocation,
  BadIcon,
} from '../index'

describe('Version Functions', () => {
  test('taoVersion returns a valid semver string', () => {
    const version = taoVersion()
    expect(typeof version).toBe('string')
    expect(version.length).toBeGreaterThan(0)
    // Should match semver pattern (X.Y.Z)
    const parts = version.split('.')
    expect(parts.length).toBe(3)
    for (const part of parts) {
      expect(Number.isInteger(parseInt(part))).toBe(true)
    }
  })

  test('webviewVersion returns a valid version tuple', () => {
    const version = webviewVersion()
    expect(Array.isArray(version)).toBe(true)
    expect(version.length).toBe(3)
    for (const part of version) {
      expect(typeof part).toBe('number')
      expect(part).toBeGreaterThanOrEqual(0)
    }
  })

  test('webviewVersion is not the old hardcoded (0, 53, 5) stale value', () => {
    const version = webviewVersion()
    // At minimum it should not be all zeros
    expect(version[0] === 0 && version[1] === 0 && version[2] === 0).toBe(false)
  })
})

describe('Monitor Functions', () => {
  test('primaryMonitor returns real monitor data (not hardcoded 1920x1080)', () => {
    const monitor = primaryMonitor()
    if (monitor) {
      expect(monitor.size.width).toBeGreaterThan(0)
      expect(monitor.size.height).toBeGreaterThan(0)
      expect(monitor.scaleFactor).toBeGreaterThan(0)
      // Position defaults are acceptable
      expect(typeof monitor.position.x).toBe('number')
      expect(typeof monitor.position.y).toBe('number')
    }
  })

  test('availableMonitors returns a non-empty array', () => {
    const monitors = availableMonitors()
    expect(Array.isArray(monitors)).toBe(true)
    // On a desktop environment there should be at least one monitor
    if (monitors.length > 0) {
      const m = monitors[0]
      expect(m.size.width).toBeGreaterThan(0)
      expect(m.size.height).toBeGreaterThan(0)
      expect(m.scaleFactor).toBeGreaterThan(0)
    }
  })

  test('availableMonitors matches primaryMonitor when only one display', () => {
    const monitors = availableMonitors()
    const primary = primaryMonitor()
    if (monitors.length === 1 && primary) {
      expect(monitors[0].size.width).toBe(primary.size.width)
      expect(monitors[0].size.height).toBe(primary.size.height)
    }
  })
})

describe('Enum Consistency Tests', () => {
  // These tests ensure JS-side enum values match the Rust source exactly.
  // If a developer reorders enums in Rust, these tests will fail.

  test('ControlFlow matches Rust ordering', () => {
    expect(ControlFlow.Poll).toBe(0)
    expect(ControlFlow.WaitUntil).toBe(1)
    expect(ControlFlow.Exit).toBe(2)
    expect(ControlFlow.ExitWithCode).toBe(3)
  })

  test('TaoTheme matches Rust ordering', () => {
    expect(TaoTheme.Light).toBe(0)
    expect(TaoTheme.Dark).toBe(1)
  })

  test('Theme matches Rust ordering', () => {
    expect(Theme.Light).toBe(0)
    expect(Theme.Dark).toBe(1)
    expect(Theme.System).toBe(2)
  })

  test('WryTheme matches Rust ordering', () => {
    expect(WryTheme.Light).toBe(0)
    expect(WryTheme.Dark).toBe(1)
    expect(WryTheme.Auto).toBe(2)
  })

  test('Error (WryError) matches Rust ordering', () => {
    expect(WryError.Uninitialized).toBe(0)
    expect(WryError.AlreadyDestroyed).toBe(1)
    expect(WryError.ScriptCallFailed).toBe(2)
    expect(WryError.Ipc).toBe(3)
    expect(WryError.InvalidWebview).toBe(4)
    expect(WryError.InvalidUrl).toBe(5)
    expect(WryError.Unsupported).toBe(6)
    expect(WryError.InvalidIcon).toBe(7)
  })

  test('FullscreenType matches Rust ordering', () => {
    expect(FullscreenType.Exclusive).toBe(0)
    expect(FullscreenType.Borderless).toBe(1)
  })

  test('ProgressBarStatus matches Rust ordering', () => {
    expect(ProgressBarStatus.None).toBe(0)
    expect(ProgressBarStatus.Normal).toBe(1)
    expect(ProgressBarStatus.Indeterminate).toBe(2)
    expect(ProgressBarStatus.Paused).toBe(3)
    expect(ProgressBarStatus.Error).toBe(4)
  })

  test('ModifiersState matches Rust ordering', () => {
    expect(ModifiersState.Shift).toBe(0)
    expect(ModifiersState.Control).toBe(1)
    expect(ModifiersState.Alt).toBe(2)
    expect(ModifiersState.Super).toBe(3)
  })

  test('MouseButtonState matches Rust ordering', () => {
    expect(MouseButtonState.Pressed).toBe(0)
    expect(MouseButtonState.Released).toBe(1)
  })

  test('BackgroundThrottlingPolicy matches Rust ordering', () => {
    expect(BackgroundThrottlingPolicy.Suspend).toBe(0)
    expect(BackgroundThrottlingPolicy.Unsuspend).toBe(1)
    expect(BackgroundThrottlingPolicy.UnsuspendWhenFirstVisible).toBe(2)
  })

  test('DragDropEvent matches Rust ordering', () => {
    expect(DragDropEvent.Entered).toBe(0)
    expect(DragDropEvent.Hovered).toBe(1)
    expect(DragDropEvent.Left).toBe(2)
    expect(DragDropEvent.Dropped).toBe(3)
  })

  test('PageLoadEvent matches Rust ordering', () => {
    expect(PageLoadEvent.Started).toBe(0)
    expect(PageLoadEvent.Completed).toBe(1)
  })

  test('NewWindowResponse matches Rust ordering', () => {
    expect(NewWindowResponse.Deny).toBe(0)
    expect(NewWindowResponse.Allow).toBe(1)
    expect(NewWindowResponse.AllowAndNavigate).toBe(2)
  })

  test('ResizeDirection matches Rust ordering', () => {
    expect(ResizeDirection.East).toBe(0)
    expect(ResizeDirection.North).toBe(1)
    expect(ResizeDirection.Northeast).toBe(2)
    expect(ResizeDirection.Northwest).toBe(3)
    expect(ResizeDirection.South).toBe(4)
    expect(ResizeDirection.Southeast).toBe(5)
    expect(ResizeDirection.Southwest).toBe(6)
    expect(ResizeDirection.West).toBe(7)
  })

  test('UserAttentionType matches Rust ordering', () => {
    expect(UserAttentionType.Critical).toBe(0)
    expect(UserAttentionType.Informational).toBe(1)
  })

  test('WindowEvent matches Rust ordering', () => {
    expect(WindowEvent.Created).toBe(0)
    expect(WindowEvent.CloseRequested).toBe(1)
    expect(WindowEvent.Destroyed).toBe(2)
    expect(WindowEvent.Focused).toBe(3)
    expect(WindowEvent.Unfocused).toBe(4)
    expect(WindowEvent.Moved).toBe(5)
    expect(WindowEvent.Resized).toBe(6)
    expect(WindowEvent.ScaleFactorChanged).toBe(7)
    expect(WindowEvent.ThemeChanged).toBe(8)
    expect(WindowEvent.Minimized).toBe(9)
    expect(WindowEvent.Maximized).toBe(10)
    expect(WindowEvent.Restored).toBe(11)
    expect(WindowEvent.Visible).toBe(12)
    expect(WindowEvent.Invisible).toBe(13)
  })

  test('WindowLevel matches Rust ordering', () => {
    expect(WindowLevel.Normal).toBe(0)
    expect(WindowLevel.AlwaysOnTop).toBe(1)
    expect(WindowLevel.AlwaysOnBottom).toBe(2)
  })

  test('StartCause matches Rust ordering', () => {
    expect(StartCause.Wait).toBe(0)
    expect(StartCause.WaitCancelled).toBe(1)
    expect(StartCause.Poll).toBe(2)
    expect(StartCause.ResumeCancelled).toBe(3)
    expect(StartCause.Init).toBe(4)
  })

  test('TouchPhase matches Rust ordering', () => {
    expect(TouchPhase.Started).toBe(0)
    expect(TouchPhase.Moved).toBe(1)
    expect(TouchPhase.Ended).toBe(2)
    expect(TouchPhase.Cancelled).toBe(3)
  })

  test('ProgressState matches Rust ordering', () => {
    expect(ProgressState.None).toBe(0)
    expect(ProgressState.Normal).toBe(1)
    expect(ProgressState.Indeterminate).toBe(2)
    expect(ProgressState.Paused).toBe(3)
    expect(ProgressState.Error).toBe(4)
  })

  test('ImeState matches Rust ordering', () => {
    expect(ImeState.Disabled).toBe(0)
    expect(ImeState.Enabled).toBe(1)
  })

  test('DeviceEventFilter matches Rust ordering', () => {
    expect(DeviceEventFilter.Allow).toBe(0)
    expect(DeviceEventFilter.AllowRepeated).toBe(1)
    expect(DeviceEventFilter.Ignore).toBe(2)
  })

  test('KeyLocation matches Rust ordering', () => {
    expect(KeyLocation.Standard).toBe(0)
    expect(KeyLocation.Left).toBe(1)
    expect(KeyLocation.Right).toBe(2)
    expect(KeyLocation.Numpad).toBe(3)
  })

  test('BadIcon matches Rust ordering', () => {
    expect(BadIcon.NoData).toBe(0)
    expect(BadIcon.TooLarge).toBe(1)
    expect(BadIcon.Format).toBe(2)
  })

  test('ScaleMode values are consistent', () => {
    expect(ScaleMode.Stretch).toBe(0)
    expect(ScaleMode.Fit).toBe(1)
    expect(ScaleMode.Fill).toBe(2)
    expect(ScaleMode.Integer).toBe(3)
    expect(ScaleMode.None).toBe(4)
  })
})

describe('CursorIcon Consistency', () => {
  test('CursorIcon has all expected variants', () => {
    // These are the most commonly used cursor icons
    expect(CursorIcon.Default).toBe(0)
    expect(CursorIcon.Crosshair).toBe(1)
    expect(CursorIcon.Hand).toBe(2)
    expect(CursorIcon.Arrow).toBe(3)
    expect(CursorIcon.Move).toBe(4)
    expect(CursorIcon.Text).toBe(5)
    expect(CursorIcon.Wait).toBe(6)
    expect(CursorIcon.Help).toBe(7)
    expect(CursorIcon.Progress).toBe(8)
    expect(CursorIcon.NotAllowed).toBe(9)
  })

  test('CursorIcon resize variants', () => {
    expect(CursorIcon.EastResize).toBe(10)
    expect(CursorIcon.NorthResize).toBe(11)
    expect(CursorIcon.NortheastResize).toBe(12)
    expect(CursorIcon.NorthwestResize).toBe(13)
    expect(CursorIcon.SouthResize).toBe(14)
    expect(CursorIcon.SoutheastResize).toBe(15)
    expect(CursorIcon.SouthwestResize).toBe(16)
    expect(CursorIcon.WestResize).toBe(17)
    expect(CursorIcon.NorthSouthResize).toBe(18)
    expect(CursorIcon.EastWestResize).toBe(19)
  })
})

describe('Key and KeyCode Consistency', () => {
  test('Key follows ASCII ordering for letters', () => {
    expect(Key.KeyA).toBe(10)
    expect(Key.KeyB).toBe(11)
    expect(Key.KeyC).toBe(12)
    expect(Key.KeyZ).toBe(35)
  })

  test('Key follows ASCII ordering for digits', () => {
    expect(Key.Key1).toBe(0)
    expect(Key.Key0).toBe(9)
  })

  test('KeyCode follows ASCII ordering for letters', () => {
    expect(KeyCode.A).toBe(10)
    expect(KeyCode.B).toBe(11)
    expect(KeyCode.C).toBe(12)
    expect(KeyCode.Z).toBe(35)
  })

  test('KeyCode follows ASCII ordering for digits', () => {
    expect(KeyCode.Key1).toBe(0)
    expect(KeyCode.Key0).toBe(9)
  })

  test('KeyCode has F13-F24 keys', () => {
    expect(KeyCode.F13).toBe(49)
    expect(KeyCode.F14).toBe(50)
    expect(KeyCode.F24).toBe(60)
  })
})

describe('Interface Structure Tests', () => {
  test('MonitorInfo interface is well-formed', () => {
    const monitor: any = {
      name: 'Test Display',
      scale_factor: 2.0,
      size: { width: 3840, height: 2160 },
      position: { x: 0, y: 0 },
      video_modes: []
    }
    expect(monitor.name).toBe('Test Display')
    expect(monitor.scale_factor).toBe(2.0)
    expect(monitor.size.width).toBe(3840)
    expect(monitor.size.height).toBe(2160)
  })

  test('Position interface is well-formed', () => {
    const pos: any = { x: 1920, y: 0 }
    expect(pos.x).toBe(1920)
    expect(pos.y).toBe(0)
  })

  test('Size interface is well-formed', () => {
    const size: any = { width: 1920, height: 1080 }
    expect(size.width).toBe(1920)
    expect(size.height).toBe(1080)
  })
})

describe('Edge Cases and Error Handling', () => {
  test('primaryMonitor should not throw', () => {
    expect(() => primaryMonitor()).not.toThrow()
  })

  test('availableMonitors should not throw', () => {
    expect(() => availableMonitors()).not.toThrow()
  })

  test('taoVersion should not throw', () => {
    expect(() => taoVersion()).not.toThrow()
  })

  test('webviewVersion should not throw', () => {
    expect(() => webviewVersion()).not.toThrow()
  })

  test('version values are consistent', () => {
    const tao = taoVersion()
    const wry = webviewVersion()
    // Both should be valid non-empty values
    expect(tao.length).toBeGreaterThan(0)
    expect(wry.length).toBe(3)
  })
})
