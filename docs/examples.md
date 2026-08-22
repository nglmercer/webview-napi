# Examples

The [`examples/`](../examples/README.md) folder is a runnable, curated set. Each file
teaches one concept, has a `bun` run command in its header, and imports the local bindings
so it runs straight from the repo.

## Running

From the repo root:

```bash
bun examples/application/01-hello-window.ts
bun examples/builders/01-basic-window.ts
bun examples/rendering/pixel-renderer.ts
bun examples/runtime/embedded.ts          # requires a display; press Ctrl+C to exit
```

The runtime examples are the exception — they need a built host for `process` mode:

```bash
bun run build:host
bun examples/runtime/process.ts
```

## Layout

| Folder | API | What it shows |
| --- | --- | --- |
| `examples/application/` | High-level `Application` | hello window, url, html, IPC, multi-window, close guards, outliving windows, transparency, autoplay |
| `examples/builders/` | Low-level `WindowBuilder` / `WebViewBuilder` / `EventLoop` | basic window/webview, html, url navigation, multi-window, multi-webview, transparency |
| `examples/rendering/` | `PixelRenderer` | RGBA pixel rendering + scale modes |
| `examples/runtime/` | `webview-napi/runtime` | embedded + process backends |
| `examples/http/` | `Application` + worker HTTP server | webview rendering a local server |
| `examples/_shared/` | — | `logger.ts` (pretty output) and `html.ts` (reusable templates) |

See [`examples/README.md`](../examples/README.md) for the full table of every example.