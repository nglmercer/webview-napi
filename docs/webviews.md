# Webviews

A webview is the browser-engine component of a window. It loads a URL, HTML, or a local
file and can run scripts, open devtools, and talk IPC.

## High-level

```typescript
import { Application } from 'webview-napi';

const app = new Application();
const win = app.createBrowserWindow({ title: 'App' });

const view = win.createWebview({
  url: 'https://nodejs.org',          // either a url…
  html: '<h1>Or inline HTML</h1>',    // …or html (one of the two)
  width: 800,
  height: 600,
  x: 0,
  y: 0,
  enableDevtools: true,
  transparent: false,
  theme: 0,                           // Theme.Light | Dark | System
  userAgent: 'my-app/1.0',
  incognito: false,
  autoplay: false,
  clipboard: true,
  hotkeysZoom: true,
});

app.run();
```

`WebviewOptions` also accepts `backForwardNavigationGestures` and `preload`.

## Low-level builder

```typescript
import { EventLoop, WebViewBuilder, WryTheme } from 'webview-napi';

const loop = new EventLoop();

// Attach to an existing window…
new WebViewBuilder()
  .withUrl('https://nodejs.org')
  .withTheme(WryTheme.Dark)
  .withDevtools(true)
  .withInitializationScript({ js: 'console.log("hello")', once: false })
  .buildOnWindow(window, 'main-view');

// …or build a standalone webview window with a label.
new WebViewBuilder().withHtml('<h1>Hi</h1>').build(loop, 'standalone');

loop.run();
```

`WebViewBuilder` exposes many options that mirror `WebViewAttributes`:
`withWidth`/`withHeight`/`withX`/`withY`, `withResizable`, `withMenubar`,
`withMaximized`, `withMinimized`, `withVisible`, `withDecorated`, `withAlwaysOnTop`,
`withTransparent`, `withFocused`, `withIcon`, `withUserAgent`, `withDragDrop`,
`withBackgroundColor`, `withIncognito`, `withHotkeysZoom`, `withClipboard`,
`withAutoplay`, `withBackForwardNavigationGestures`. The security options
`withWebsecurity` and `withUnsandboxed` exist too — use only for trusted content.

## Loading content

```typescript
view.loadUrl('https://nodejs.org');
view.loadHtml('<h1>Hello</h1>');
view.loadFromFile('/absolute/path/index.html');            // base URL set so relative
                                                           // imports resolve
view.loadHtmlWithBaseUrl('<h1>Hi</h1>', 'https://example.com/');
view.loadUrlWithHeaders('https://x.com', [['Authorization', 'token']]);
view.reload();
view.print();
```

## Executing JavaScript

```typescript
view.evaluateScript('document.title');
view.evaluateScriptWithCallback('1 + 1', (err, result) => {
  console.log('result:', result);
});

// read/write state
view.getUrl();                  // current URL | null
view.setZoom(1.25);
view.setBounds({ x: 0, y: 0, width: 400, height: 300 });   // or view.bounds()
view.setBackgroundColor(255, 255, 255, 255);
view.setVisible(true);
view.focus();
```

## Devtools

```typescript
view.openDevtools();
view.closeDevtools();
view.isDevtoolsOpen();
```

## Cookies & browsing data

```typescript
view.setCookie('sid', 'abc123', 'example.com');
view.getCookies();                       // CookieInfo[]
view.getCookiesForUrl('https://example.com');
view.deleteCookie('sid', 'abc123', 'example.com');
view.clearAllBrowsingData();
```

A `WebContext` can back a webview's storage with a data directory:
`new WebContext('/path/to/data')`.

## See also

- [`examples/application/02-load-url.ts`](../examples/application/02-load-url.ts)
- [`examples/application/03-load-html.ts`](../examples/application/03-load-html.ts)
- [`examples/builders/02-basic-webview.ts`](../examples/builders/02-basic-webview.ts)
- [`examples/builders/04-url-navigation.ts`](../examples/builders/04-url-navigation.ts)