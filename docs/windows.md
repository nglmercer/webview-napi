# Windows

Windows can be created with the high-level `Application` API or the low-level
`WindowBuilder`. The control methods are the same either way.

## High-level

```typescript
import { Application } from 'webview-napi';

const app = new Application();
const win = app.createBrowserWindow({
  title: 'My App',
  width: 800,
  height: 600,
  x: 100,
  y: 100,
  resizable: true,
  decorations: true,        // show the native frame/titlebar
  transparent: false,
  alwaysOnTop: false,
  visible: true,
  maximized: false,
  maximizable: true,
  minimizable: true,
  focused: true,
  fullscreen: 1,            // FullscreenType.Borderless
});

app.run();
```

`BrowserWindowOptions` also accepts `contentProtection`, `alwaysOnBottom`,
`visibleOnAllWorkspaces`, and `fullscreen`.

## Low-level builder

```typescript
import { EventLoop, WindowBuilder, TaoTheme } from 'webview-napi';

const loop = new EventLoop();
const win = new WindowBuilder()
  .withTitle('My App')
  .withInnerSize(1024, 768)
  .withPosition(100, 100)
  .withResizable(true)
  .withDecorated(true)
  .withAlwaysOnTop(false)
  .withVisible(true)
  .withFocused(true)
  .withMenubar(true)
  .withTransparent(false)
  .withMaximized(false)
  .withTheme(TaoTheme.Dark)
  .withIcon(32, 32, rgbaBuffer) // RGBA buffer for the window icon
  .build(loop);
```

## Controlling a window at runtime

`BrowserWindow` (high-level) and `Window` (builder) expose the same operations:

```typescript
win.setTitle('New title');
win.focus();
win.show();

// state queries
win.isVisible();
win.isFocused();
win.isMaximized();
win.isMinimized();
win.isResizable();
win.isDecorated();

// behavior
win.setMaximized(true);
win.setMinimized(true);
win.setVisible(true);
win.setAlwaysOnTop(true);
win.setDecorations(true);          // show/hide the native frame
win.setClosable(true);
win.setMaximizable(true);
win.setMinimizable(true);
win.setWindowIcon(rgba, 32, 32);   // or removeWindowIcon()
win.setProgressBar({ status: 1, progress: 50 }); // ProgressBarStatus.Normal
win.setContentProtection(false);

// fullscreen + theme
win.fullscreen;                    // FullscreenType | null
win.theme;                         // read the current theme
win.theme = /* Theme */;
```

The builder-level `Window` adds lower-level access you won't find on `BrowserWindow`:
`position()`/`size()` getters, `setCursorIcon()`, `setCursorPosition()`,
`dragWindow()`, `requestRedraw()`, and `requestFocus()`.

## Monitors

```typescript
import { primaryMonitor, availableMonitors } from 'webview-napi';

const primary = primaryMonitor();            // MonitorInfo | null
const all = availableMonitors();              // MonitorInfo[]

win.getPrimaryMonitor();                      // via a window handle
win.getAvailableMonitors();
```

A `MonitorInfo` has `name?`, `position`, `size`, and `scaleFactor`. Monitor queries return
`null`/`[]` on error, e.g. if an `EventLoop` already exists on Linux.

## See also

- [`examples/application/01-hello-window.ts`](../examples/application/01-hello-window.ts)
- [`examples/builders/01-basic-window.ts`](../examples/builders/01-basic-window.ts)
- [`examples/application/05-multi-window.ts`](../examples/application/05-multi-window.ts)