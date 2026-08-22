# Application & Event Loop

The `Application` class is the high-level entry point. It creates `BrowserWindow`s, groups
event handling, and drives the event loop.

## Constructing

```typescript
import { Application, ControlFlow } from 'webview-napi';

const app = new Application({
  controlFlow: ControlFlow.Wait,   // 'Wait' | 'Poll' | 'WaitUntil' (defaults to Wait)
  waitTime: 16,                    // ms used by WaitUntil
  exitCode: 0,                     // code used by exit()
  exitOnLastWindowClosed: true,    // terminate once the last window is destroyed
  keepAlive: false,                // keep the host runtime alive while pumping
});
```

## `run()` vs `pollEvents()`

```typescript
app.run();            // takes over the calling thread until the app exits
```

`run()` is fine for a UI-only program. To keep Node/Bun/Deno's own loop responsive, pump
instead:

```typescript
const status = app.pollEvents();       // pump once, return control
// status: { windowCount, hasWindows, exitRequested }
```

A common embedded pattern:

```typescript
while (!app.pollEvents().exitRequested) {
  // your backend work; await promises, I/O, timers
}
```

`runIteration()` still exists as a deprecated alias that returns `!status.exitRequested`.

The `WebviewRuntime` embedded backend drives this loop for you — see
[Webview runtime](webview-runtime.md).

## Exiting

```typescript
app.exit(0);   // stop the event loop, independent of the windows
```

Closing every window only ends the application when `exitOnLastWindowClosed` is enabled
(the default). Read [Lifecycle & close](lifecycle-and-close.md) for the full flow.

## Events

```typescript
import { Application, WebviewApplicationEvent } from 'webview-napi';

app.bind((err, event) => {
  if (err) return;
  switch (event.event) {
    case WebviewApplicationEvent.WindowCloseRequested:
      console.log('close requested for window', event.windowId);
      break;
    case WebviewApplicationEvent.WindowDestroyed:
      console.log('window destroyed', event.windowId, '| still open:', app.windowCount);
      break;
    case WebviewApplicationEvent.ApplicationExit:
      console.log('application exiting');
      break;
  }
});
```

`onEvent(handler)` is an alias for `bind`.

## See also

- [`examples/application/01-hello-window.ts`](../examples/application/01-hello-window.ts)
- [`examples/application/05-multi-window.ts`](../examples/application/05-multi-window.ts)