# Getting Started

Install `webview-napi`, open a window, and render a webview in about fifteen lines of
code. It works on Node.js (≥ 24), Bun, and Deno — Windows, macOS, Linux, Android, and
FreeBSD.

## Installation

```bash
# npm
npm install webview-napi

# yarn
yarn add webview-napi

# pnpm
pnpm add webview-napi

# bun
bun add webview-napi
```

## Platform requirements

**Linux** needs the WebKitGTK 4.1 dev package and friends:

```bash
# Debian / Ubuntu
sudo apt-get install libwebkit2gtk-4.0-dev libappindicator3-dev libsoup2.4-dev

# Fedora
sudo dnf install webkit2gtk3-devel libappindicator-gtk3-devel libsoup-devel

# Arch Linux
sudo pacman -S webkit2gtk libappindicator-gtk3 libsoup
```

**macOS** and **Windows** require no additional dependencies.

## Your first window

The high-level `Application` API is the quickest way in:

```typescript
import { Application } from 'webview-napi';

const app = new Application();

const window = app.createBrowserWindow({ title: 'Hello', width: 800, height: 600 });
window.createWebview({ url: 'https://nodejs.org' });

app.run();
```

`app.run()` takes over the calling thread and drives the event loop until the app exits.
It ends by default when the last window is closed.

## Next steps

- Understand the pieces: [Architecture](architecture.md)
- Control your windows: [Windows](windows.md)
- Render HTML or URLs: [Webviews](webviews.md)
- Talk between Node and the page: [IPC](ipc.md)

## Run the examples

The [`examples/`](../examples/README.md) folder has a runnable example for every topic.
From the repo root:

```bash
bun examples/application/01-hello-window.ts
```

> The example files import the local bindings (`../index.js`) so they run straight from
> the repo. In your own project you would import `webview-napi` as shown above.