# Examples

The examples are small, runnable programs grouped by the API they demonstrate. Run them
from the repository root with Bun; they use the local generated bindings instead of an
installed package.

## Quick start

```bash
bun examples/application/01-hello-window.ts
bun examples/builders/01-basic-window.ts
bun examples/rendering/pixel-renderer.ts
bun examples/runtime/embedded.ts
```

The runtime process example needs the Rust host binary first:

```bash
bun run build:host
bun examples/runtime/process.ts
```

## Application API

| Example | Demonstrates |
| --- | --- |
| [01-hello-window.ts](application/01-hello-window.ts) | The smallest high-level application |
| [02-load-url.ts](application/02-load-url.ts) | Loading a remote URL |
| [03-load-html.ts](application/03-load-html.ts) | Loading inline HTML |
| [04-ipc.ts](application/04-ipc.ts) | Host/page message exchange |
| [05-multi-window.ts](application/05-multi-window.ts) | Independent window lifetimes |
| [06-close-guard.ts](application/06-close-guard.ts) | Intercepting close requests |
| [07-app-outlives-windows.ts](application/07-app-outlives-windows.ts) | Keeping the app alive without windows |
| [08-transparency.ts](application/08-transparency.ts) | Transparent windows and webviews |
| [09-autoplay-video.ts](application/09-autoplay-video.ts) | Autoplaying video content |

## Builder API

| Example | Demonstrates |
| --- | --- |
| [01-basic-window.ts](builders/01-basic-window.ts) | WindowBuilder and runtime controls |
| [02-basic-webview.ts](builders/02-basic-webview.ts) | WebViewBuilder on an existing window |
| [03-html-content.ts](builders/03-html-content.ts) | Builder-created inline HTML |
| [04-url-navigation.ts](builders/04-url-navigation.ts) | Loading and navigating URLs |
| [05-multiple-windows.ts](builders/05-multiple-windows.ts) | One event loop shared by windows |
| [06-multi-webview.ts](builders/06-multi-webview.ts) | Multiple views in one window |
| [07-transparency.ts](builders/07-transparency.ts) | Builder-level transparency |

## Other APIs

| Example | Demonstrates |
| --- | --- |
| [pixel-renderer.ts](rendering/pixel-renderer.ts) | Animated RGBA rendering with `PixelRenderer` |
| [embedded.ts](runtime/embedded.ts) | The in-process `WebviewRuntime` backend |
| [process.ts](runtime/process.ts) | The out-of-process `WebviewRuntime` backend |
| [webview.mts](http/webview.mts) | A webview backed by a worker HTTP server |

The [`_shared/`](./_shared/) directory contains helpers used by examples and is not
intended to be run directly.
