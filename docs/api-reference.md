# API Reference

Complete list of the exported types from `webview-napi` (`.`) and `webview-napi/runtime`.

## Main entry (`webview-napi`)

### Classes

| Class | Description |
| --- | --- |
| `Application` | High-level entry point; owns an event loop, creates `BrowserWindow`s. |
| `BrowserWindow` | A native window created by `Application`. |
| `EventLoop` | Low-level system event queue; drive with `run()` / `runIteration()`. |
| `EventLoopBuilder` | Builds an `EventLoop`. |
| `EventLoopProxy` | Sends events to / wakes an event loop from another thread. |
| `EventLoopWindowTarget` | The modal target behind an event loop. |
| `PixelRenderer` | Renders raw RGBA buffers to a window (results cached per-window). |
| `WebContext` | Web/storage context with a data directory. |
| `Webview` | A webview created via `BrowserWindow.createWebview` (`webview-napi`). |
| `WebView` | A webview from the builder pipeline (`WebViewBuilder`). |
| `WebViewBuilder` | Fluent builder for `WebView`. |
| `Window` | A native window from `WindowBuilder`. |
| `WindowBuilder` | Fluent builder for `Window`. |

### `Application`

```typescript
new Application(options?: ApplicationOptions)
onEvent(handler) / bind(handler)        // subscribe to ApplicationEvent
exitOnLastWindowClosed: boolean         // get/set
keepAlive: boolean                      // get/set (hint to the JS pump driver)
windowCount: number
createBrowserWindow(options?): BrowserWindow
exit(code?: number): void
run(): void                             // blocks the calling thread
pollEvents(): ApplicationStatus         // pump once: { windowCount, hasWindows, exitRequested }
runIteration(): boolean                 // deprecated alias for pollEvents
```

### `BrowserWindow`

```typescript
id: number | null                       // null until created by the loop
isCreated: boolean
close(): void
setCloseGuard(enabled): void / closeGuard: boolean
createWebview(options?): Webview
isChild: boolean
isFocused() / isVisible() / isDecorated()
isMaximizable() / isMaximized() / isMinimized() / isResizable()
setClosable / setMaximizable / setMinimizable
setTitle(title) / title: string
theme: Theme (get/set)
setWindowIcon(buffer, w, h) / removeWindowIcon()
setVisible / setProgressBar(state) / setMaximized / setMinimized / focus()
getAvailableMonitors() / getPrimaryMonitor()
setContentProtection / setAlwaysOnTop / setAlwaysOnBottom / setDecorations
fullscreen: FullscreenType | null
show()
```

### `Webview` (high-level)

```typescript
id: string / label: string
onIpcMessage(handler) / on(handler)     // handler: (err, message) => …
send(message): void
loadUrl / loadHtml / evaluateScript
openDevtools / closeDevtools / isDevtoolsOpen / reload / print
```

### `Window` (builder)

```typescript
id: bigint
title() / setTitle(title)
isVisible / setVisible
isResizable / setResizable
isDecorated / setDecorated
outerPosition() / setOuterPosition(x, y)
innerSize() / setInnerSize(w, h)
isMaximized / setMaximized
isMinimized / setMinimized
isAlwaysOnTop / setAlwaysOnTop
isFocused / requestFocus
cursorIcon / setCursorIcon / setCursorPosition / cursorPosition
dragWindow()
setTheme(theme) / theme()
setWindowIcon(w, h, rgba)
setIgnoreCursorEvents / requestRedraw
close() / isClosed()
```

### `WebView` (builder)

```typescript
id: string / label: string
evaluateScript / openDevtools / closeDevtools / isDevtoolsOpen / reload / print
loadUrl / loadHtml
loadFromFile(filePath)                          // sets base URL for relative imports
loadHtmlWithBaseUrl(html, baseUrl)
loadUrlWithHeaders(url, [[k, v], …])
evaluateScriptWithCallback(js, cb)
clearAllBrowsingData
setCookie(name, value, domain?, path?)
getCookies() / getCookiesForUrl(url) / deleteCookie(name, value, domain?, path?)
url: string | null
setZoom(z) / bounds() / setBounds(rect)
setBackgroundColor(r, g, b, a) / setVisible / focus / focusParent
on(callback) / send(message)                    // IPC
gtkWidget(): bigint                             // Unix only
```

### `PixelRenderer`

```typescript
new PixelRenderer(bufferWidth, bufferHeight)
static withOptions(options: RenderOptions)
setScaleMode(mode) / setBackgroundColor(r, g, b, a)
render(window, buffer: Buffer)                   // RGBA, w*h*4 bytes
```

### Free functions

| Function | Description |
| --- | --- |
| `availableMonitors()` | `MonitorInfo[]` for all displays. |
| `primaryMonitor()` | `MonitorInfo | null` for the primary display. |
| `getWebviewVersion()` | Underlying WebKit engine version string. |
| `taoVersion()` | Tao crate version (from Cargo.lock). |
| `webviewVersion()` | Wry version tuple `[major, minor, patch]`. |
| `renderPixels(window, buffer, w, h)` | One-shot render; prefer `PixelRenderer` for repeated use. |

### Key enums

- `ControlFlow` / `TaoControlFlow`: `Poll`, `WaitUntil`, `Exit`, `ExitWithCode`, `Wait`.
- `WebviewApplicationEvent`: `WindowCloseRequested`, `ApplicationCloseRequested`,
  `WindowDestroyed`, `ApplicationExit`.
- `Theme`: `Light`, `Dark`, `System`. · `TaoTheme`: `Light`, `Dark`. · `WryTheme`: `Light`,
  `Dark`, `Auto`.
- `ScaleMode`: `Stretch`, `Fit`, `Fill`, `Integer`, `None`.
- `FullscreenType`: `Exclusive`, `Borderless`.
- `CursorIcon`, `MouseButtonState`, `KeyCode`, `Key`, window/event enums, etc.

### Key interfaces

`ApplicationOptions`, `ApplicationStatus`, `BrowserWindowOptions`, `WebviewOptions`,
`WebViewAttributes`, `WindowOptions`, `WindowAttributes`, `RenderOptions`,
`InitializationScript`, `MonitorInfo`, `Rect`, `Size`, `Position`,
`WindowSizeConstraints`, `IpcHandler`, `CookieInfo`, `ProgressBarState`, and more.

---

## Runtime entry (`webview-napi/runtime`)

### `WebviewRuntime`

```typescript
WebviewRuntime.start(options?): Promise<Runtime>
WebviewRuntime.hostAvailable(hostPath?): boolean
WebviewRuntime.resolveHostBinary(hostPath?): string
```

### `Runtime`

```typescript
mode: 'embedded' | 'process'
windowCount: number
createWindow(options?): Promise<RuntimeWindow>
exit(code?): Promise<void>
whenExit(): Promise<void>
on / off                              // EventEmitter
```

`EmbeddedRuntime` adds `app: Application` and `pump: Pump`; `ProcessRuntime` adds
`kill()`.

### Runtime types

- `RuntimeWindow`: `id`, `destroyed`, `webviews[]`; events `close-requested` /
  `destroyed`; `createWebview`, `close`, `setCloseGuard`, `setTitle`, `setVisible`,
  `setMaximized`, `setMinimized`, `setAlwaysOnTop`, `setDecorations`, `focus`.
- `RuntimeWebview`: `on('ipc', fn)` / `off('ipc', fn)`, `loadUrl`, `loadHtml`,
  `evaluateScript`, `send`, `openDevtools`, `closeDevtools`, `reload`, `print` (all async).
- `RuntimeOptions`: `mode`, `exitOnLastWindowClosed`, `keepAlive`, `interval`,
  `hostPath`, `env`.
- `Pump`: `running`, `done`, `start()`, `stop(error?)`.