# Desktop Framework (NAPI-RS + Tao + Wry)

A high-performance desktop application framework for Node.js. This library provides native bindings to **Tao** for cross-platform window management and **Wry** for rendering web-based user interfaces.

## 🚀 Features

* **Native Performance**: Built with Rust via NAPI-RS for minimal overhead.
* **Window Management**: Robust window control (positioning, sizing, monitors) powered by Tao.
* **Webview Rendering**: Modern webview integration with IPC support via Wry.
* **Pixel Rendering**: Low-level `PixelRenderer` for software rendering or custom graphics buffers.
* **Event-Driven**: Flexible event loop management for responsive applications.

---

## 🛠 Architecture

The framework consists of three main layers:

1. **Event Loop**: The core engine that manages system events.
2. **Window (Tao)**: The native OS window container.
3. **Webview (Wry)**: The browser engine running inside the window.

---

## 📖 Basic Usage

### 1. Simple Application Pattern

The `Application` class provides a high-level wrapper to get started quickly.

```typescript
import { Application } from './index';

const app = new Application({
  controlFlow: 0 // Poll
});

const window = app.createBrowserWindow({
  title: "My Desktop App",
  width: 800,
  height: 600,
  visible: true
});

app.run();

```

### 2. Advanced Manual Control (Builder Pattern)

For more control, use the `EventLoop`, `WindowBuilder`, and `WebViewBuilder`.

```typescript
import { EventLoopBuilder, WindowBuilder, WebViewBuilder } from './index';

const eventLoop = new EventLoopBuilder().build();
const window = new WindowBuilder()
  .withTitle("Advanced Window")
  .withInnerSize(1024, 768)
  .build(eventLoop);

const webview = new WebViewBuilder()
  .withUrl("https://github.com")
  .build(eventLoop, "main-view");

eventLoop.run();

```

---

## 📨 Inter-Process Communication (IPC)

Communicate between your Node.js logic and the JavaScript running inside the Webview.

### Node.js side

```typescript
webview.on((err, message) => {
  console.log("Received from Webview:", message);
});

// Send message to Webview
webview.send("Hello from Node!");

```

### Webview side (Frontend)

The framework injects a global handler:

```javascript
window.__webview_on_message__ = (message) => {
  console.log("Message from Node:", message);
};

// Send to Node
window.ipc.postMessage("Data from Frontend");

```

---

## 🎨 Low-Level Rendering

If you aren't using a Webview and want to draw pixels directly (e.g., for an emulator or custom UI):

```typescript
import { PixelRenderer, Window } from './index';

const win = new Window();
const renderer = new PixelRenderer(800, 600);

// buffer is a Node.js Buffer containing RGBA data
renderer.render(win, pixelBuffer);

```

---

## 🗂 API Reference Summary

### Core Classes

| Class | Description |
| --- | --- |
| `Application` | High-level entry point for window/app management. |
| `EventLoop` | Manages the system event queue and window lifecycle. |
| `Window` | Controls native window properties (title, size, decorations). |
| `WebView` | The browser engine component (loads URLs, HTML, IPC). |
| `PixelRenderer` | Tool for rendering raw RGBA buffers to a window. |

### Key Utilities

* `primaryMonitor()`: Get details about the main display.
* `availableMonitors()`: List all connected displays and their resolutions.
* `getWebviewVersion()`: Check the underlying engine version.
