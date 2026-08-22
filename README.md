# webview-napi

Cross-platform native windows and webviews for Node.js, Bun, and Deno, backed by Rust,
Tao, and Wry.

## Start here

Install the package and open your first window with the [getting started guide](docs/getting-started.md).

```bash
bun add webview-napi
```

The documentation is organized by task:

- [Architecture](docs/architecture.md) — how the application, window, and webview layers fit together
- [Application and event loop](docs/application-and-event-loop.md) — high-level lifecycle and event pumping
- [Windows](docs/windows.md) — native window creation and control
- [Webviews](docs/webviews.md) — URLs, HTML, scripts, cookies, and devtools
- [IPC](docs/ipc.md) — messages between the host and page
- [Pixel rendering](docs/rendering.md) — direct RGBA rendering without a webview
- [Webview runtime](docs/webview-runtime.md) — embedded and out-of-process backends
- [Lifecycle and close](docs/lifecycle-and-close.md) — window destruction and close guards
- [Linux / Wayland](docs/platform-linux.md) — platform notes and environment variables
- [API reference](docs/api-reference.md) — exported classes, methods, and enums
- [Examples](examples/README.md) — runnable examples grouped by API
- [Contributing](docs/contributing.md) — setup and development commands

## Installation

```bash
npm install webview-napi
# or: pnpm add webview-napi
# or: bun add webview-napi
```

Linux also needs the WebKitGTK development packages described in the [platform guide](docs/getting-started.md#platform-requirements).

## Minimal example

```typescript
import { Application } from 'webview-napi';

const app = new Application();
const window = app.createBrowserWindow({ title: 'Hello', width: 800, height: 600 });
window.createWebview({ url: 'https://nodejs.org' });
app.run();
```

## License

[MIT](LICENSE)
