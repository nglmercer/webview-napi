# Desktop Framework (NAPI-RS + Tao + Wry)

<div align="center">

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/Node-%3E%3D24-339933?logo=node.js)
![Platforms](https://img.shields.io/badge/Platforms-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

A high-performance desktop application framework for Node.js and Bun. This library provides native bindings to **Tao** for cross-platform window management and **Wry** for rendering web-based user interfaces.

</div>

## 🚀 Features

- **Native Performance**: Built with Rust via NAPI-RS for minimal overhead
- **Window Management**: Robust window control (positioning, sizing, monitors) powered by Tao
- **Webview Rendering**: Modern webview integration with IPC support via Wry
- **Pixel Rendering**: Low-level `PixelRenderer` for software rendering or custom graphics buffers
- **Event-Driven**: Flexible event loop management for responsive applications
- **Cross-Platform**: Supports Windows, macOS, Linux, Android, and FreeBSD

---

## 📦 Installation

```bash
# Using npm
npm install webview-napi

# Using yarn
yarn add webview-napi

# Using pnpm
pnpm add webview-napi

# Using bun
bun add webview-napi
```

### Platform-Specific Requirements

**Linux:**
```bash
# Debian/Ubuntu
sudo apt-get install libwebkit2gtk-4.0-dev libappindicator3-dev libsoup2.4-dev

# Fedora
sudo dnf install webkit2gtk3-devel libappindicator-gtk3-devel libsoup-devel

# Arch Linux
sudo pacman -S webkit2gtk libappindicator-gtk3 libsoup
```

**macOS:** No additional dependencies required

**Windows:** No additional dependencies required

---

## 🛠 Architecture

The framework consists of three main layers:

```
┌─────────────────────────────────────────────┐
│           Application / Event Loop          │
│         (System Event Management)           │
├─────────────────────────────────────────────┤
│              Window (Tao)                   │
│       (Native OS Window Container)          │
├─────────────────────────────────────────────┤
│             WebView (Wry)                   │
│      (Browser Engine & IPC Layer)           │
└─────────────────────────────────────────────┘
```

---

## 📖 Basic Usage

### 1. Simple Application Pattern

The `Application` class provides a high-level wrapper to get started quickly.

```typescript
import { Application, ControlFlow } from 'webview-napi';

const app = new Application({
  controlFlow: ControlFlow.Poll
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
import { EventLoop, WindowBuilder, WebViewBuilder } from 'webview-napi';

const eventLoop = new EventLoop();
const window = new WindowBuilder()
  .withTitle("Advanced Window")
  .withInnerSize(1024, 768)
  .build(eventLoop);

const webview = new WebViewBuilder()
  .withUrl("https://github.com")
  .buildOnWindow(window, "main-view");

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
// Listen for messages from Node
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
import { PixelRenderer, Window } from 'webview-napi';

const win = new Window();
const renderer = new PixelRenderer(800, 600);

// buffer is a Node.js Buffer containing RGBA data
renderer.render(win, pixelBuffer);
```

---

## 📂 Examples

Check the [`examples/`](examples/) directory for complete working examples:

| Example | Description |
|---------|-------------|
| [`basic-window-example.ts`](examples/basic-window-example.ts) | Basic window creation |
| [`basic-webview-example.ts`](examples/basic-webview-example.ts) | Simple webview with URL |
| [`ipc-example.ts`](examples/ipc-example.ts) | IPC communication |
| [`html.ts`](examples/html.ts) | Render custom HTML |
| [`transparency.ts`](examples/transparency.ts) | Transparent window |
| [`multi-webview.ts`](examples/multi-webview.ts) | Multiple webviews |

---

## 🗂 API Reference

### Core Classes

| Class | Description |
|-------|-------------|
| `Application` | High-level entry point for window/app management |
| `EventLoop` | Manages the system event queue and window lifecycle |
| `Window` | Controls native window properties (title, size, decorations) |
| `WebView` | The browser engine component (loads URLs, HTML, IPC) |
| `PixelRenderer` | Tool for rendering raw RGBA buffers to a window |

### Key Utilities

- `primaryMonitor()`: Get details about the main display
- `availableMonitors()`: List all connected displays and their resolutions
- `getWebviewVersion()`: Check the underlying engine version

---

## 🔧 Configuration

### Window Builder Options

```typescript
const window = new WindowBuilder()
  .withTitle("My App")
  .withInnerSize(1024, 768)
  .withPosition(100, 100)
  .withResizable(true)
  .withDecorations(true)
  .withAlwaysOnTop(false)
  .withVisible(true)
  .build(eventLoop);
```

### WebView Builder Options

```typescript
const webview = new WebViewBuilder()
  .withUrl("https://example.com")
  .withTransparent(false)
  .withIncognito(false)
  .build(eventLoop, "webview-id");
```

---

## 🐧 Linux / Wayland Support

On Linux the module uses the GTK3 / `webkit2gtk-4.1` stack. When it detects a
non-Node N-API runtime (bun/deno) it forces **software GL** (`LIBGL_ALWAYS_SOFTWARE=1`
+ `GALLIUM_DRIVER=llvmpipe`) to avoid a Mesa hardware-GL crash (`driCreateNewScreen3`)
that affects those runtimes. This is backend-agnostic, so **native Wayland works** — the
module lets GTK auto-detect Wayland and does not force the X11 backend.

### Environment variables

| Variable | Effect |
|----------|--------|
| `GDK_BACKEND` | Set to `wayland` or `x11` to pin the backend. Always respected and never overridden. |
| `WEBVIEW_NAPI_PREFER_X11` | If set, forces `GDK_BACKEND=x11` (runs under XWayland) instead of native Wayland. |
| `LIBGL_ALWAYS_SOFTWARE` | Forced to `1` under bun/deno (unless already set) to avoid the Mesa crash. |
| `GALLIUM_DRIVER` | Forced to `llvmpipe` under bun/deno (unless already set). |
| `WEBKIT_DISABLE_DMABUF_RENDERER` | Set to `1`; a no-op on GTK3 but required on a future GTK4 build. |

### Known limitations on Wayland

- Absolute window positioning (`withPosition`) is ignored because Wayland compositors
  control window placement. Use it only on X11.
- Window transparency is supported but handled via the Wayland subsurface compositor,
  not the X11 RGBA visual path.

---

## 📚 Related Projects

- [Tao](https://github.com/tauri-apps/tao) - Cross-platform windowing library
- [Wry](https://github.com/tauri-apps/wry) - WebView rendering library
- [NAPI-RS](https://github.com/napi-rs/napi-rs) - Node.js API bindings for Rust

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.