# Lifecycle & Close

The single most important mental model: **closing a window destroys that window only.** The
application stops when it is told to.

## The close flow

```
CloseRequested
     │
     ├── close guard armed ──► emit close-requested, window stays alive
     │
     ▼
destroy window + its webviews  ──►  emit window-destroyed
     │
     ▼
exitOnLastWindowClosed && no windows left ──► exit
```

## Close guards

A close guard turns the user's close request into a plain event so you can decide in
JavaScript whether to honor it. Because a JS handler cannot answer from inside the native
callback, the decision is *armed up front*:

```typescript
import { Application, WebviewApplicationEvent } from 'webview-napi';

const app = new Application();
const win = app.createBrowserWindow({ title: 'Close' });
win.createWebview({ html: '<h1>Close me</h1>' });

win.setCloseGuard(true);           // close requests no longer destroy the window
let confirmed = false;

app.bind((err, event) => {
  if (err) return;
  if (event.event === WebviewApplicationEvent.WindowCloseRequested) {
    console.log('close requested for window', event.windowId);
    if (!confirmed) {
      confirmed = true;            // first request: ignore (ask the user)
      console.log('still open — request again to close');
    } else {
      win.close();                 // now honor it
    }
  }
  if (event.event === WebviewApplicationEvent.WindowDestroyed) {
    console.log('window', event.windowId, 'destroyed');
  }
});

app.run();
```

`win.closeGuard` / `win.setCloseGuard(enabled)` toggle the behavior at any time.

## Exit policies

`createBrowserWindow` windows are destroyed individually. The application exits when:

- `app.exit()` is called, or
- `exitOnLastWindowClosed: true` (default) and the last window is destroyed.

Keep the backend alive past its windows with `exitOnLastWindowClosed: false`, then open a
new window whenever needed:

```typescript
const app = new Application({ exitOnLastWindowClosed: false });
// … open / close windows freely …
if (app.windowCount === 0) {
  app.createBrowserWindow({ title: 'Reopened' });   // still alive, open again
}
```

## Events

`WebviewApplicationEvent`:

| Value | Meaning |
| --- | --- |
| `WindowCloseRequested` | A window is being asked to close |
| `ApplicationCloseRequested` | The whole app has been asked to close |
| `WindowDestroyed` | A window and all its webviews are gone |
| `ApplicationExit` | The event loop is about to terminate |

## See also

- [`examples/application/06-close-guard.ts`](../examples/application/06-close-guard.ts)
- [`examples/application/07-app-outlives-windows.ts`](../examples/application/07-app-outlives-windows.ts)