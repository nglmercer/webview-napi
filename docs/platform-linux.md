# Linux / Wayland

On Linux the module uses the GTK3 / `webkit2gtk-4.1` stack.

## Software GL for bun/deno

When the module detects a non-Node N-API runtime (bun/deno) it forces **software GL**
(`LIBGL_ALWAYS_SOFTWARE=1` + `GALLIUM_DRIVER=llvmpipe`) to avoid a Mesa hardware-GL crash
(`driCreateNewScreen3`) that affects those runtimes. This is backend-agnostic, so **native
Wayland still works** — the module lets GTK auto-detect Wayland and does not force the X11
backend.

## Environment variables

| Variable | Effect |
| --- | --- |
| `GDK_BACKEND` | `wayland` or `x11` to pin the backend; always respected, never overridden. |
| `WEBVIEW_NAPI_PREFER_X11` | If set, forces `GDK_BACKEND=x11` (runs under XWayland) instead of native Wayland. |
| `LIBGL_ALWAYS_SOFTWARE` | Forced to `1` under bun/deno (unless already set) to avoid the Mesa crash. |
| `GALLIUM_DRIVER` | Forced to `llvmpipe` under bun/deno (unless already set). |
| `WEBKIT_DISABLE_DMABUF_RENDERER` | Set to `1`; a no-op on GTK3 but required on a future GTK4 build. |

## Known limitations on Wayland

- Absolute window positioning (`withPosition`) is ignored because Wayland compositors
  control placement. Use it only on X11.
- Window transparency is supported but handled via the Wayland subsurface compositor, not
  the X11 RGBA visual path.