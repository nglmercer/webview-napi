# Architecture

`webview-napi` is a NAPI-RS binding over two Tauri components: **Tao** for native window
management and **Wry** for rendering web UIs. Everything is reachable from TypeScript with
no FFI ceremony.

## Three layers

```
┌───────────────────────────────────────────┐
│      Application / Event Loop             │   owns the system event loop
├───────────────────────────────────────────┤
│              Window (Tao)                 │   a native OS window
├───────────────────────────────────────────┤
│             WebView (Wry)                 │   a browser engine + IPC layer
└───────────────────────────────────────────┘
```

| Layer | Backing library | You reach it with |
| --- | --- | --- |
| Event loop | tao | `Application`, `EventLoop`, `EventLoopBuilder` |
| Window | tao | `BrowserWindow` (via `Application`), `Window`/`WindowBuilder` |
| WebView | wry | `Webview` (via `BrowserWindow`), `WebView`/`WebViewBuilder` |

## Two ways to drive it

There are two levels of API built on the same native core:

### 1. High-level — `Application`

Creates windows and webviews for you and owns its own event loop. Best for most programs.

```typescript
import { Application } from 'webview-napi';

const app = new Application();
const win = app.createBrowserWindow({ title: 'App' });
win.createWebview({ html: '<h1>Hi</h1>' });
app.run();
```

### 2. Low-level — builders

`WindowBuilder`, `WebViewBuilder`, and `EventLoop` expose every option and let you compose
an event loop yourself. Use this when you need full control or reuse of a single loop.

```typescript
import { EventLoop, WindowBuilder, WebViewBuilder } from 'webview-napi';

const loop = new EventLoop();
const win = new WindowBuilder().withTitle('App').withInnerSize(800, 600).build(loop);
new WebViewBuilder().withUrl('https://nodejs.org').buildOnWindow(win, 'main-view');
loop.run();
```

> Which to pick? Start with `Application`. Reach for the builders when you need an option
> the high-level API doesn't expose, or a single event loop shared by many windows.

## Two runtimes, one API

The native Tao event loop and the JavaScript event loop cannot both own the main thread.
`webview-napi` offers two ways out, behind the same promise-based API:

```
WebviewRuntime  (import from 'webview-napi/runtime')
      │
      ├── EmbeddedRuntime  → N-API in-process, pumped with pollEvents()
      │
      └── ProcessRuntime   → `webview-host` binary, JSON-RPC over stdio
```

- **Embedded** is the classic mode: the UI lives in your process and the loop is pumped
  from the host runtime, so timers, promises, and I/O keep running.
- **Process** puts the UI in a separate Rust binary that owns the Tao loop outright, so
  nothing blocks Node/Bun, a UI crash no longer takes the backend down, and Bun/Deno get
  hardware GL back.

Read [Webview runtime](webview-runtime.md) for details, and
[Application & event loop](application-and-event-loop.md) for pumping embedded.

## Next

- [Application & event loop](application-and-event-loop.md)
- [Webview runtime](webview-runtime.md)