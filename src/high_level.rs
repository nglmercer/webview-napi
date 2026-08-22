use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

#[napi]
pub type IpcHandler = ThreadsafeFunction<String>;

/// Represents a pending action to be applied to a webview once it's initialized.
pub(crate) enum PendingWebviewAction {
  LoadUrl(String),
  LoadHtml(String),
  EvaluateScript(String),
  OpenDevtools,
  CloseDevtools,
  Reload,
  Print,
}

#[allow(unused_imports)]
use crate::tao::enums::{TaoControlFlow, TaoFullscreenType, TaoTheme};
use crate::tao::structs::Position;
#[cfg(target_os = "macos")]
use tao::platform::macos::WindowBuilderExtMacOS;
#[cfg(any(
  target_os = "linux",
  target_os = "dragonfly",
  target_os = "freebsd",
  target_os = "netbsd",
  target_os = "openbsd"
))]
use tao::platform::unix::WindowBuilderExtUnix;
#[cfg(target_os = "windows")]
use tao::platform::windows::WindowBuilderExtWindows;

/// Detects whether the native module is running under a non-Node N-API runtime
/// (e.g. bun or deno) and applies GL workarounds to avoid crashes.
///
/// On Linux, WebKit/GTK initializes a hardware GL (Mesa/Gallium/EGL) context when
/// the first `WebContext` is created. Under bun and deno this hardware-GL path
/// crashes with a SIGSEGV inside `driCreateNewScreen3`, while Node.js is unaffected.
/// Forcing software rendering (`LIBGL_ALWAYS_SOFTWARE=1` + `GALLIUM_DRIVER=llvmpipe`)
/// sidesteps the crash and keeps the module working across all runtimes. We only do
/// this for non-Node runtimes so that Node.js users keep hardware acceleration.
///
/// This workaround is **backend-agnostic**: the software GL stack (llvmpipe) drives
/// both the X11 and the native Wayland (SHM subsurface) rendering paths of the
/// GTK3 / webkit2gtk-4.1 stack used here. We therefore no longer force the X11
/// backend and let GTK auto-detect Wayland, which gives native Wayland support.
///
/// Users who still need the X11 backend (e.g. to run under XWayland) can opt in by
/// setting `WEBVIEW_NAPI_PREFER_X11=1`, or by setting `GDK_BACKEND` directly. An
/// explicit `GDK_BACKEND` is always respected and never overridden.
#[cfg(target_os = "linux")]
pub(crate) fn apply_runtime_gl_workaround() {
  use std::sync::Once;
  static INIT: Once = Once::new();
  INIT.call_once(|| {
    let running_under_other_runtime = std::fs::read_link("/proc/self/exe")
      .ok()
      .and_then(|p| {
        p.file_name()
          .map(|n| n.to_string_lossy().to_ascii_lowercase())
      })
      .map(|name| name.contains("bun") || name.contains("deno"))
      .unwrap_or(false);

    if running_under_other_runtime {
      let mut changed = false;

      // Force software GL. This is what actually avoids the Mesa hardware-GL crash
      // and works on both X11 and native Wayland.
      if std::env::var_os("LIBGL_ALWAYS_SOFTWARE").is_none() {
        std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1");
        // Ensure a software rasterizer is actually selected for the Mesa GL stack.
        if std::env::var_os("GALLIUM_DRIVER").is_none() {
          std::env::set_var("GALLIUM_DRIVER", "llvmpipe");
        }
        changed = true;
      }

      // Backend selection. When no backend is pinned by the user:
      // - If `WEBVIEW_NAPI_PREFER_X11` is set, force X11 (runs under XWayland).
      // - Otherwise, explicitly select the native Wayland backend when a Wayland
      //   session is detected, so GTK doesn't fall back to X11/XWayland when both
      //   `WAYLAND_DISPLAY` and `DISPLAY` are present. This is only done when the
      //   user has not set `GDK_BACKEND` themselves.
      if std::env::var_os("GDK_BACKEND").is_none() {
        if std::env::var_os("WEBVIEW_NAPI_PREFER_X11").is_some() {
          if std::env::var_os("WAYLAND_DISPLAY").is_some() {
            std::env::set_var("GDK_BACKEND", "x11");
            changed = true;
          }
        } else if std::env::var_os("WAYLAND_DISPLAY").is_some() {
          std::env::set_var("GDK_BACKEND", "wayland");
          changed = true;
        }
      }

      // Disable the WebKit DMABUF renderer. This is a no-op on the current GTK3
      // (webkit2gtk-4.1) stack, but becomes required if/when we move to GTK4
      // (webkitgtk-6.0), where DMABUF depends on hardware GL that llvmpipe can't
      // drive. Keeping it set is harmless and future-proofs the build.
      if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        changed = true;
      }

      if changed {
        eprintln!(
          "[webview-napi] Detected a non-Node runtime (bun/deno). Forcing software GL \
           (LIBGL_ALWAYS_SOFTWARE=1 / GALLIUM_DRIVER=llvmpipe) to avoid a Mesa \
           hardware-GL crash (driCreateNewScreen3). Native Wayland is used when \
           available; set WEBVIEW_NAPI_PREFER_X11=1 to force the X11 backend."
        );
      }
    }
  });
}

#[cfg(not(target_os = "linux"))]
fn apply_runtime_gl_workaround() {}

#[napi]
pub enum WebviewApplicationEvent {
  WindowCloseRequested,
  ApplicationCloseRequested,
  /// A window and all of its webviews have been destroyed.
  WindowDestroyed,
  /// The event loop is about to terminate.
  ApplicationExit,
}

#[napi(object)]
pub struct ApplicationEvent {
  pub event: WebviewApplicationEvent,
  /// Identifier of the window this event refers to, for window-scoped events.
  /// `null` for application-level events.
  pub window_id: Option<f64>,
}

#[napi(object)]
pub struct ApplicationOptions {
  pub control_flow: Option<ControlFlow>,
  /// Milliseconds used by `ControlFlow::WaitUntil`. Defaults to 16.
  pub wait_time: Option<u32>,
  pub exit_code: Option<i32>,
  /// Terminate the event loop once the last window has been destroyed.
  /// Defaults to `true`, matching the pre-0.3 behaviour.
  pub exit_on_last_window_closed: Option<bool>,
  /// Hint for the JS pump driver: keep the host runtime (Node/Bun/Deno) alive
  /// while the application is running. Defaults to `false`.
  pub keep_alive: Option<bool>,
}

/// Result of a single `Application.pollEvents()` pump.
#[napi(object)]
pub struct ApplicationStatus {
  /// Number of live windows.
  pub window_count: u32,
  pub has_windows: bool,
  /// Whether the application has been asked to stop (`exit()`, or the
  /// `exitOnLastWindowClosed` policy kicking in).
  pub exit_requested: bool,
}

#[napi]
#[derive(Clone, Copy)]
pub enum ControlFlow {
  Poll = 0,
  WaitUntil = 1,
  Exit = 2,
  ExitWithCode = 3,
  /// Block until the next event arrives. This is the default.
  Wait = 4,
}

#[napi(object)]
pub struct Dimensions {
  pub width: f64,
  pub height: f64,
}

#[napi]
pub enum FullscreenType {
  Exclusive = 0,
  Borderless = 1,
}

#[napi(object)]
pub struct HeaderData {
  pub key: String,
  pub value: Option<String>,
}

#[napi(object)]
pub struct IpcMessage {
  pub body: Buffer,
  pub method: String,
  pub headers: Vec<HeaderData>,
  pub uri: String,
}

#[napi]
pub enum ProgressBarStatus {
  None = 0,
  Normal = 1,
  Indeterminate = 2,
  Paused = 3,
  Error = 4,
}

#[napi(object)]
pub struct ProgressBarState {
  /// The progress status.
  pub status: ProgressBarStatus,
  /// The progress value (0-100).
  pub progress: f64,
}

#[napi]
pub enum Theme {
  Light = 0,
  Dark = 1,
  System = 2,
}

#[napi(object)]
pub struct VideoMode {
  pub size: Dimensions,
  pub bit_depth: u32,
  pub refresh_rate: u32,
}

#[napi(object)]
pub struct Monitor {
  pub name: Option<String>,
  pub scale_factor: f64,
  pub size: Dimensions,
  pub position: Position,
  pub video_modes: Vec<VideoMode>,
}

#[napi(object)]
pub struct BrowserWindowOptions {
  pub resizable: Option<bool>,
  pub title: Option<String>,
  pub width: Option<f64>,
  pub height: Option<f64>,
  pub x: Option<f64>,
  pub y: Option<f64>,
  pub content_protection: Option<bool>,
  pub always_on_top: Option<bool>,
  pub always_on_bottom: Option<bool>,
  pub visible: Option<bool>,
  pub decorations: Option<bool>,
  pub visible_on_all_workspaces: Option<bool>,
  pub maximized: Option<bool>,
  pub maximizable: Option<bool>,
  pub minimizable: Option<bool>,
  pub focused: Option<bool>,
  pub transparent: Option<bool>,
  pub fullscreen: Option<FullscreenType>,
}

#[napi(object)]
pub struct WebviewOptions {
  pub url: Option<String>,
  pub html: Option<String>,
  pub width: Option<f64>,
  pub height: Option<f64>,
  pub x: Option<f64>,
  pub y: Option<f64>,
  pub enable_devtools: Option<bool>,
  pub incognito: Option<bool>,
  pub user_agent: Option<String>,
  pub preload: Option<String>,
  pub transparent: Option<bool>,
  pub theme: Option<Theme>,
  pub hotkeys_zoom: Option<bool>,
  pub clipboard: Option<bool>,
  pub autoplay: Option<bool>,
  pub back_forward_navigation_gestures: Option<bool>,
}

/// A window queued for creation on the next event-loop iteration.
pub(crate) struct PendingWindow {
  pub(crate) options: BrowserWindowOptions,
  pub(crate) window: Arc<Mutex<Option<crate::tao::structs::Window>>>,
  pub(crate) pending_webviews: Arc<Mutex<Vec<PendingWebview>>>,
  pub(crate) id: Arc<Mutex<Option<u64>>>,
  pub(crate) close_guard: Arc<AtomicBool>,
}

type PendingWebview = (
  WebviewOptions,
  Arc<Mutex<Option<crate::wry::structs::WebView>>>,
  Arc<Mutex<Vec<crate::wry::structs::IpcHandler>>>,
  Arc<Mutex<Vec<PendingWebviewAction>>>,
);

/// Commands issued from the JS thread that must be applied on the event-loop
/// thread (tao requires window destruction to happen there).
pub(crate) enum AppCommand {
  /// Destroy the window behind this id handle. The handle is resolved when the
  /// command is drained, so `close()` works even if it is called before the
  /// window has actually been created.
  CloseWindow(Arc<Mutex<Option<u64>>>),
}

/// Everything the `Application` owns for a single live window.
struct WindowState {
  window: Arc<Mutex<Option<crate::tao::structs::Window>>>,
  webviews: Vec<Arc<Mutex<Option<crate::wry::structs::WebView>>>>,
  pending_webviews: Arc<Mutex<Vec<PendingWebview>>>,
  close_guard: Arc<AtomicBool>,
}

#[napi]
pub struct Application {
  #[allow(clippy::arc_with_non_send_sync)]
  event_loop: Arc<Mutex<Option<tao::event_loop::EventLoop<()>>>>,
  event_loop_proxy: tao::event_loop::EventLoopProxy<()>,
  handler: Arc<Mutex<Option<ThreadsafeFunction<ApplicationEvent>>>>,
  #[allow(clippy::arc_with_non_send_sync)]
  windows_to_create: Arc<Mutex<Vec<PendingWindow>>>,
  // Registry of live windows keyed by the native window id. The `Application`
  // holds the only strong reference that is guaranteed to survive: the JS
  // wrapper objects share the same `Arc`s, so once a window is removed from
  // here (and its handles cleared) the native resources are released even if a
  // JS wrapper is still reachable.
  #[allow(clippy::arc_with_non_send_sync, clippy::type_complexity)]
  windows: Arc<Mutex<HashMap<u64, WindowState>>>,
  #[allow(clippy::arc_with_non_send_sync)]
  commands: Arc<Mutex<Vec<AppCommand>>>,
  exit_requested: Arc<Mutex<bool>>,
  exit_emitted: Arc<AtomicBool>,
  exit_on_last_window_closed: Arc<AtomicBool>,
  keep_alive: Arc<AtomicBool>,
  exit_code: Arc<Mutex<i32>>,
  control_flow: Option<ControlFlow>,
  wait_time: u32,
}

#[napi]
impl Application {
  #[napi(constructor)]
  pub fn new(options: Option<ApplicationOptions>) -> Result<Self> {
    // Apply GL runtime workarounds (e.g. force software GL under bun/deno)
    // before any WebKit/GTK initialization happens.
    apply_runtime_gl_workaround();

    // Resolve the platform/backend before the event loop is created; on Linux
    // this must happen first to prevent Wayland protocol errors.
    #[cfg(target_os = "linux")]
    {
      let _ = crate::tao::platform::platform_info();
    }

    let options = options.unwrap_or(ApplicationOptions {
      control_flow: None,
      wait_time: None,
      exit_code: None,
      exit_on_last_window_closed: None,
      keep_alive: None,
    });

    crate::tao::structs::claim_event_loop()?;

    let event_loop = tao::event_loop::EventLoop::new();
    let event_loop_proxy = event_loop.create_proxy();
    Ok(Self {
      #[allow(clippy::arc_with_non_send_sync)]
      event_loop: Arc::new(Mutex::new(Some(event_loop))),
      event_loop_proxy,
      handler: Arc::new(Mutex::new(None)),
      #[allow(clippy::arc_with_non_send_sync)]
      windows_to_create: Arc::new(Mutex::new(Vec::new())),
      #[allow(clippy::arc_with_non_send_sync)]
      windows: Arc::new(Mutex::new(HashMap::new())),
      #[allow(clippy::arc_with_non_send_sync)]
      commands: Arc::new(Mutex::new(Vec::new())),
      exit_requested: Arc::new(Mutex::new(false)),
      exit_emitted: Arc::new(AtomicBool::new(false)),
      exit_on_last_window_closed: Arc::new(AtomicBool::new(
        options.exit_on_last_window_closed.unwrap_or(true),
      )),
      keep_alive: Arc::new(AtomicBool::new(options.keep_alive.unwrap_or(false))),
      exit_code: Arc::new(Mutex::new(options.exit_code.unwrap_or(0))),
      control_flow: options.control_flow,
      wait_time: options.wait_time.unwrap_or(16),
    })
  }

  #[napi]
  pub fn on_event(&self, handler: Option<ThreadsafeFunction<ApplicationEvent>>) {
    *self.handler.lock().unwrap() = handler;
  }

  #[napi]
  pub fn bind(&self, handler: Option<ThreadsafeFunction<ApplicationEvent>>) {
    self.on_event(handler);
  }

  /// Whether the event loop terminates once the last window is destroyed.
  #[napi(getter)]
  pub fn exit_on_last_window_closed(&self) -> bool {
    self.exit_on_last_window_closed.load(Ordering::SeqCst)
  }

  #[napi(setter)]
  pub fn set_exit_on_last_window_closed(&self, value: bool) {
    self
      .exit_on_last_window_closed
      .store(value, Ordering::SeqCst);
  }

  /// Hint for the JS pump driver: keep the host runtime alive while running.
  #[napi(getter)]
  pub fn keep_alive(&self) -> bool {
    self.keep_alive.load(Ordering::SeqCst)
  }

  #[napi(setter)]
  pub fn set_keep_alive(&self, value: bool) {
    self.keep_alive.store(value, Ordering::SeqCst);
  }

  /// Number of live (created and not yet destroyed) windows.
  #[napi(getter)]
  pub fn window_count(&self) -> u32 {
    self.windows.lock().unwrap().len() as u32
  }

  #[napi]
  pub fn create_browser_window(&self, options: Option<BrowserWindowOptions>) -> BrowserWindow {
    #[allow(clippy::arc_with_non_send_sync)]
    let inner = Arc::new(Mutex::new(None));
    #[allow(clippy::arc_with_non_send_sync)]
    let webviews_to_create = Arc::new(Mutex::new(Vec::new()));
    let id = Arc::new(Mutex::new(None));
    let close_guard = Arc::new(AtomicBool::new(false));
    let options = options.unwrap_or(BrowserWindowOptions {
      resizable: Some(true),
      title: Some("Webview".to_string()),
      width: Some(800.0),
      height: Some(600.0),
      x: None,
      y: None,
      content_protection: None,
      always_on_top: None,
      always_on_bottom: None,
      visible: Some(true),
      decorations: Some(true),
      visible_on_all_workspaces: None,
      maximized: None,
      maximizable: None,
      minimizable: None,
      focused: None,
      transparent: None,
      fullscreen: None,
    });

    self.windows_to_create.lock().unwrap().push(PendingWindow {
      options,
      window: inner.clone(),
      pending_webviews: webviews_to_create.clone(),
      id: id.clone(),
      close_guard: close_guard.clone(),
    });

    // Wake the loop so a window created while `run()` is already blocked in
    // `ControlFlow::Wait` is picked up immediately.
    let _ = self.event_loop_proxy.send_event(());

    BrowserWindow {
      inner,
      webviews_to_create,
      id,
      close_guard,
      commands: self.commands.clone(),
      event_loop_proxy: self.event_loop_proxy.clone(),
    }
  }

  /// Requests the application to stop its event loop.
  ///
  /// This is independent from closing windows: closing every window only ends
  /// the application when `exitOnLastWindowClosed` is enabled.
  #[napi]
  pub fn exit(&self, code: Option<i32>) {
    if let Some(code) = code {
      *self.exit_code.lock().unwrap() = code;
    }
    *self.exit_requested.lock().unwrap() = true;
    self.emit(WebviewApplicationEvent::ApplicationCloseRequested, None);
    let _ = self.event_loop_proxy.send_event(());
  }

  fn emit(&self, event: WebviewApplicationEvent, window_id: Option<u64>) {
    let mut handler = self.handler.lock().unwrap();
    if let Some(handler) = handler.as_mut() {
      let _ = handler.call(
        Ok(ApplicationEvent {
          event,
          window_id: window_id.map(|id| id as f64),
        }),
        ThreadsafeFunctionCallMode::NonBlocking,
      );
    }
  }

  /// Destroys a window and every webview attached to it, then applies the
  /// `exitOnLastWindowClosed` policy. Returns `true` if the window existed.
  fn destroy_window(&self, window_id: u64) -> bool {
    let state = self.windows.lock().unwrap().remove(&window_id);
    let Some(state) = state else {
      return false;
    };

    // Drop the webviews before the window: on GTK/WebKit the webview is a child
    // widget of the window and must not outlive it.
    for webview in state.webviews {
      *webview.lock().unwrap() = None;
    }
    state.pending_webviews.lock().unwrap().clear();
    *state.window.lock().unwrap() = None;

    self.emit(WebviewApplicationEvent::WindowDestroyed, Some(window_id));

    if self.exit_on_last_window_closed.load(Ordering::SeqCst)
      && self.windows.lock().unwrap().is_empty()
    {
      *self.exit_requested.lock().unwrap() = true;
    }
    true
  }

  fn process_pending_items(&self, event_loop_target: &tao::event_loop::EventLoopWindowTarget<()>) {
    // 1. Create the windows queued from JS.
    let pending: Vec<PendingWindow> = self.windows_to_create.lock().unwrap().drain(..).collect();
    for pending_window in pending {
      let opts = &pending_window.options;
      let mut builder = tao::window::WindowBuilder::new()
        .with_title(opts.title.clone().unwrap_or_default())
        .with_inner_size(tao::dpi::LogicalSize::new(
          opts.width.unwrap_or(800.0),
          opts.height.unwrap_or(600.0),
        ))
        .with_resizable(opts.resizable.unwrap_or(true))
        .with_decorations(opts.decorations.unwrap_or(true))
        .with_always_on_top(opts.always_on_top.unwrap_or(false))
        .with_maximized(opts.maximized.unwrap_or(false))
        .with_focused(opts.focused.unwrap_or(true))
        .with_transparent(opts.transparent.unwrap_or(false))
        .with_visible(opts.visible.unwrap_or(true));

      if opts.transparent.unwrap_or(false) {
        #[cfg(target_os = "windows")]
        {
          builder = builder.with_undecorated_shadow(false);
        }
        #[cfg(target_os = "macos")]
        {
          builder = builder
            .with_titlebar_transparent(true)
            .with_fullsize_content_view(true);
        }
        #[cfg(any(
          target_os = "linux",
          target_os = "dragonfly",
          target_os = "freebsd",
          target_os = "netbsd",
          target_os = "openbsd"
        ))]
        {
          builder = builder.with_rgba_visual(true);
        }
      }

      if let Some(x) = opts.x {
        if let Some(y) = opts.y {
          builder = builder.with_position(tao::dpi::LogicalPosition::new(x, y));
        }
      }

      if let Ok(window) = builder.build(event_loop_target) {
        let window_id = crate::tao::structs::window_id_to_u64(window.id());
        {
          let mut handle = pending_window.window.lock().unwrap();
          *handle = Some(crate::tao::structs::Window {
            #[allow(clippy::arc_with_non_send_sync)]
            inner: Some(Arc::new(Mutex::new(window))),
          });
        }
        *pending_window.id.lock().unwrap() = Some(window_id);

        self.windows.lock().unwrap().insert(
          window_id,
          WindowState {
            window: pending_window.window.clone(),
            webviews: Vec::new(),
            pending_webviews: pending_window.pending_webviews.clone(),
            close_guard: pending_window.close_guard.clone(),
          },
        );
      }
    }

    // 2. Drain the webview queue of *every* live window, not only the ones
    //    created in this pass, so `createWebview()` also works after the window
    //    has been built.
    #[allow(clippy::type_complexity)]
    let entries: Vec<(
      u64,
      Arc<Mutex<Option<crate::tao::structs::Window>>>,
      Arc<Mutex<Vec<PendingWebview>>>,
    )> = self
      .windows
      .lock()
      .unwrap()
      .iter()
      .map(|(id, state)| (*id, state.window.clone(), state.pending_webviews.clone()))
      .collect();

    for (window_id, window_handle, pending_webviews) in entries {
      let batch: Vec<PendingWebview> = pending_webviews.lock().unwrap().drain(..).collect();
      for pending_webview in batch {
        if let Some(handle) = build_pending_webview(&window_handle, pending_webview) {
          if let Some(state) = self.windows.lock().unwrap().get_mut(&window_id) {
            state.webviews.push(handle);
          }
        }
      }
    }

    // 3. Apply commands issued from the JS thread.
    let commands: Vec<AppCommand> = self.commands.lock().unwrap().drain(..).collect();
    for command in commands {
      match command {
        AppCommand::CloseWindow(id_handle) => {
          let id = *id_handle.lock().unwrap();
          if let Some(id) = id {
            self.destroy_window(id);
          }
        }
      }
    }
  }

  /// Handles a single tao event. Returns `true` when the loop should exit.
  fn handle_event(
    &self,
    event: &tao::event::Event<'_, ()>,
    event_loop_target: &tao::event_loop::EventLoopWindowTarget<()>,
  ) -> bool {
    self.process_pending_items(event_loop_target);

    if let tao::event::Event::WindowEvent {
      event: tao::event::WindowEvent::CloseRequested,
      window_id,
      ..
    } = event
    {
      let window_id = crate::tao::structs::window_id_to_u64(*window_id);
      self.emit(
        WebviewApplicationEvent::WindowCloseRequested,
        Some(window_id),
      );

      // With a close guard set the window is kept alive and it is up to JS to
      // call `window.close()` (or not) once it has decided.
      let guarded = self
        .windows
        .lock()
        .unwrap()
        .get(&window_id)
        .map(|state| state.close_guard.load(Ordering::SeqCst))
        .unwrap_or(false);

      if !guarded {
        self.destroy_window(window_id);
      }
    }

    *self.exit_requested.lock().unwrap()
  }

  fn exit_control_flow(&self) -> tao::event_loop::ControlFlow {
    if !self.exit_emitted.swap(true, Ordering::SeqCst) {
      self.emit(WebviewApplicationEvent::ApplicationExit, None);
    }
    let code = *self.exit_code.lock().unwrap();
    if code == 0 {
      tao::event_loop::ControlFlow::Exit
    } else {
      tao::event_loop::ControlFlow::ExitWithCode(code)
    }
  }

  fn idle_control_flow(&self) -> tao::event_loop::ControlFlow {
    match self.control_flow {
      Some(ControlFlow::Poll) => tao::event_loop::ControlFlow::Poll,
      Some(ControlFlow::WaitUntil) => tao::event_loop::ControlFlow::WaitUntil(
        std::time::Instant::now() + std::time::Duration::from_millis(self.wait_time as u64),
      ),
      _ => tao::event_loop::ControlFlow::Wait,
    }
  }

  /// Runs the event loop, taking over the calling thread until the application
  /// exits. Use `pollEvents()` instead when the host runtime (Node/Bun/Deno)
  /// needs to keep servicing its own event loop.
  #[napi]
  pub fn run(&mut self) {
    let event_loop = self.event_loop.lock().unwrap().take();
    if let Some(event_loop) = event_loop {
      #[allow(clippy::arc_with_non_send_sync)]
      let app = Arc::new(self.clone_internal());
      let idle = self.idle_control_flow();

      event_loop.run(move |event, event_loop_target, control_flow| {
        *control_flow = idle;

        if app.handle_event(&event, event_loop_target) {
          *control_flow = app.exit_control_flow();
        }
      });
    }
  }

  /// Pumps the event loop once and returns control to the host runtime.
  ///
  /// Closing a window no longer terminates the application: inspect the
  /// returned status to decide when to stop pumping.
  #[napi]
  pub fn poll_events(&mut self) -> ApplicationStatus {
    let mut event_loop_lock = self.event_loop.lock().unwrap();

    if let Some(event_loop) = event_loop_lock.as_mut() {
      if !*self.exit_requested.lock().unwrap() {
        use tao::platform::run_return::EventLoopExtRunReturn;

        #[allow(clippy::arc_with_non_send_sync)]
        let app = Arc::new(self.clone_internal());

        event_loop.run_return(|event, event_loop_target, control_flow| {
          *control_flow = tao::event_loop::ControlFlow::Poll;

          let exit = app.handle_event(&event, event_loop_target);

          // Hand control back to the host runtime once this iteration's events
          // have been drained.
          if exit || matches!(event, tao::event::Event::RedrawEventsCleared) {
            *control_flow = tao::event_loop::ControlFlow::Exit;
          }
        });
      }
    }
    drop(event_loop_lock);

    let exit_requested = *self.exit_requested.lock().unwrap();
    if exit_requested && !self.exit_emitted.swap(true, Ordering::SeqCst) {
      self.emit(WebviewApplicationEvent::ApplicationExit, None);
    }

    let window_count = self.windows.lock().unwrap().len() as u32;
    ApplicationStatus {
      window_count,
      has_windows: window_count > 0,
      exit_requested,
    }
  }

  /// Deprecated: use `pollEvents()`.
  ///
  /// Returns `false` once the application has been asked to exit. Note that,
  /// unlike previous versions, closing a window does not by itself stop the
  /// application unless `exitOnLastWindowClosed` is enabled.
  #[napi]
  pub fn run_iteration(&mut self) -> bool {
    !self.poll_events().exit_requested
  }

  fn clone_internal(&self) -> Self {
    Self {
      event_loop: self.event_loop.clone(),
      event_loop_proxy: self.event_loop_proxy.clone(),
      handler: self.handler.clone(),
      windows_to_create: self.windows_to_create.clone(),
      windows: self.windows.clone(),
      commands: self.commands.clone(),
      exit_requested: self.exit_requested.clone(),
      exit_emitted: self.exit_emitted.clone(),
      exit_on_last_window_closed: self.exit_on_last_window_closed.clone(),
      keep_alive: self.keep_alive.clone(),
      exit_code: self.exit_code.clone(),
      control_flow: self.control_flow,
      wait_time: self.wait_time,
    }
  }
}

/// Builds a queued webview on an already-created window.
fn build_pending_webview(
  window_handle: &Arc<Mutex<Option<crate::tao::structs::Window>>>,
  pending: PendingWebview,
) -> Option<Arc<Mutex<Option<crate::wry::structs::WebView>>>> {
  let (webview_opts, webview_handle, ipc_listeners, pending_actions) = pending;

  let Ok(mut builder) = crate::wry::structs::WebViewBuilder::new() else {
    return None;
  };

  if let Some(url) = webview_opts.url {
    let _ = builder.with_url(url);
  }
  if let Some(html) = webview_opts.html {
    let _ = builder.with_html(html);
  }
  if let Some(width) = webview_opts.width {
    let _ = builder.with_width(width as u32);
  }
  if let Some(height) = webview_opts.height {
    let _ = builder.with_height(height as u32);
  }
  if let Some(x) = webview_opts.x {
    let _ = builder.with_x(x as i32);
  }
  if let Some(y) = webview_opts.y {
    let _ = builder.with_y(y as i32);
  }
  if let Some(user_agent) = webview_opts.user_agent {
    let _ = builder.with_user_agent(user_agent);
  }
  if let Some(transparent) = webview_opts.transparent {
    let _ = builder.with_transparent(transparent);
  }
  if let Some(devtools) = webview_opts.enable_devtools {
    let _ = builder.with_devtools(devtools);
  }
  if let Some(incognito) = webview_opts.incognito {
    let _ = builder.with_incognito(incognito);
  }
  if let Some(hotkeys_zoom) = webview_opts.hotkeys_zoom {
    let _ = builder.with_hotkeys_zoom(hotkeys_zoom);
  }
  if let Some(clipboard) = webview_opts.clipboard {
    let _ = builder.with_clipboard(clipboard);
  }
  if let Some(autoplay) = webview_opts.autoplay {
    let _ = builder.with_autoplay(autoplay);
  }
  if let Some(back_forward_navigation_gestures) = webview_opts.back_forward_navigation_gestures {
    let _ = builder.with_back_forward_navigation_gestures(back_forward_navigation_gestures);
  }
  // Apply preload script as initialization script
  if let Some(preload) = webview_opts.preload {
    let init_script = crate::wry::structs::InitializationScript {
      js: preload,
      once: false,
    };
    let _ = builder.with_initialization_script(init_script);
  }

  let window_lock = window_handle.lock().unwrap();
  let window_ref = window_lock.as_ref()?;
  let webview = builder
    .build_on_window(window_ref, "webview".to_string(), Some(ipc_listeners))
    .ok()?;
  drop(window_lock);

  let mut wv_handle = webview_handle.lock().unwrap();
  *wv_handle = Some(webview);
  // Apply any pending actions that were called before the webview existed.
  if let Some(wv) = wv_handle.as_ref() {
    apply_pending_actions(wv, &pending_actions);
  }
  drop(wv_handle);

  Some(webview_handle)
}

#[napi]
pub struct BrowserWindow {
  pub(crate) inner: Arc<Mutex<Option<crate::tao::structs::Window>>>,
  pub(crate) webviews_to_create: Arc<Mutex<Vec<PendingWebview>>>,
  pub(crate) id: Arc<Mutex<Option<u64>>>,
  pub(crate) close_guard: Arc<AtomicBool>,
  pub(crate) commands: Arc<Mutex<Vec<AppCommand>>>,
  pub(crate) event_loop_proxy: tao::event_loop::EventLoopProxy<()>,
}

#[napi]
impl BrowserWindow {
  /// Native identifier of the window, or `null` until the window has actually
  /// been created by the event loop (i.e. after the first pump).
  #[napi(getter)]
  pub fn id(&self) -> Option<f64> {
    self.id.lock().unwrap().map(|id| id as f64)
  }

  /// Whether the native window exists.
  #[napi(getter)]
  pub fn is_created(&self) -> bool {
    self.inner.lock().unwrap().is_some()
  }

  /// Destroys this window and every webview attached to it. The application
  /// keeps running unless `exitOnLastWindowClosed` is enabled and this was the
  /// last window.
  #[napi]
  pub fn close(&self) {
    self
      .commands
      .lock()
      .unwrap()
      .push(AppCommand::CloseWindow(self.id.clone()));
    let _ = self.event_loop_proxy.send_event(());
  }

  /// When enabled, a user close request only emits `WindowCloseRequested` and
  /// leaves the window alive; call `close()` to actually destroy it.
  ///
  /// This is the synchronous equivalent of `preventDefault()`: a JS handler
  /// cannot answer from inside the native event callback, so the decision has
  /// to be armed up front.
  #[napi]
  pub fn set_close_guard(&self, enabled: bool) {
    self.close_guard.store(enabled, Ordering::SeqCst);
  }

  #[napi(getter)]
  pub fn close_guard(&self) -> bool {
    self.close_guard.load(Ordering::SeqCst)
  }

  #[napi]
  pub fn create_webview(&self, options: Option<WebviewOptions>) -> Result<Webview> {
    #[allow(clippy::arc_with_non_send_sync)]
    let inner = Arc::new(Mutex::new(None));
    let ipc_listeners = Arc::new(Mutex::new(Vec::new()));
    let pending_actions = Arc::new(Mutex::new(Vec::new()));
    let options = options.unwrap_or(WebviewOptions {
      url: None,
      html: None,
      width: None,
      height: None,
      x: None,
      y: None,
      enable_devtools: None,
      incognito: None,
      user_agent: None,
      preload: None,
      transparent: None,
      theme: None,
      hotkeys_zoom: None,
      clipboard: None,
      autoplay: None,
      back_forward_navigation_gestures: None,
    });

    self.webviews_to_create.lock().unwrap().push((
      options,
      inner.clone(),
      ipc_listeners.clone(),
      pending_actions.clone(),
    ));

    Ok(Webview {
      inner,
      ipc_listeners,
      pending_actions,
    })
  }

  #[napi(getter)]
  pub fn is_child(&self) -> bool {
    false
  }

  #[napi]
  pub fn is_focused(&self) -> bool {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      win.is_focused().unwrap_or(false)
    } else {
      false
    }
  }

  #[napi]
  pub fn is_visible(&self) -> bool {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      win.is_visible().unwrap_or(false)
    } else {
      true
    }
  }

  #[napi]
  pub fn is_decorated(&self) -> bool {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      win.is_decorated().unwrap_or(true)
    } else {
      true
    }
  }

  #[napi]
  pub fn is_minimizable(&self) -> bool {
    true
  }

  #[napi]
  pub fn is_maximized(&self) -> bool {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      win.is_maximized().unwrap_or(false)
    } else {
      false
    }
  }

  #[napi]
  pub fn is_minimized(&self) -> bool {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      win.is_minimized().unwrap_or(false)
    } else {
      false
    }
  }

  #[napi]
  pub fn is_resizable(&self) -> bool {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      win.is_resizable().unwrap_or(true)
    } else {
      true
    }
  }

  #[napi]
  pub fn set_closable(&self, _closable: bool) {}

  #[napi]
  pub fn set_maximizable(&self, _maximizable: bool) {}

  #[napi]
  pub fn set_minimizable(&self, _minimizable: bool) {}

  #[napi]
  pub fn set_title(&self, title: String) {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      let _ = win.set_title(title);
    }
  }

  #[napi(getter)]
  pub fn title(&self) -> String {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      win.title().unwrap_or_default()
    } else {
      String::new()
    }
  }

  #[napi(getter)]
  pub fn theme(&self) -> Theme {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      match win.theme() {
        Ok(Some(crate::tao::enums::TaoTheme::Dark)) => Theme::Dark,
        _ => Theme::Light,
      }
    } else {
      Theme::Light
    }
  }

  #[napi(setter)]
  pub fn set_theme(&self, theme: Theme) {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      let t = match theme {
        Theme::Dark => crate::tao::enums::TaoTheme::Dark,
        _ => crate::tao::enums::TaoTheme::Light,
      };
      let _ = win.set_theme(t);
    }
  }

  #[napi]
  pub fn set_window_icon(&self, icon: Either<Buffer, String>, width: u32, height: u32) {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      let buf = match icon {
        Either::A(b) => b,
        Either::B(_) => return, // Skipping path-based for now
      };
      let _ = win.set_window_icon(width, height, buf);
    }
  }

  #[napi]
  pub fn remove_window_icon(&self) {}

  #[napi]
  pub fn set_visible(&self, visible: bool) {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      let _ = win.set_visible(visible);
    }
  }

  #[napi]
  pub fn set_progress_bar(&self, _state: ProgressBarState) {}

  #[napi]
  pub fn set_maximized(&self, value: bool) {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      let _ = win.set_maximized(value);
    }
  }

  #[napi]
  pub fn set_minimized(&self, value: bool) {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      let _ = win.set_minimized(value);
    }
  }

  #[napi]
  pub fn focus(&self) {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      let _ = win.request_focus();
    }
  }

  #[napi]
  pub fn get_available_monitors(&self) -> Vec<Monitor> {
    let mut monitors = Vec::new();
    for m in crate::tao::functions::available_monitors() {
      monitors.push(Monitor {
        name: m.name,
        scale_factor: m.scale_factor,
        size: Dimensions {
          width: m.size.width,
          height: m.size.height,
        },
        position: m.position,
        video_modes: Vec::new(),
      });
    }
    monitors
  }

  #[napi]
  pub fn get_primary_monitor(&self) -> Option<Monitor> {
    let m = crate::tao::functions::primary_monitor()?;
    Some(Monitor {
      name: m.name,
      scale_factor: m.scale_factor,
      size: Dimensions {
        width: m.size.width,
        height: m.size.height,
      },
      position: m.position,
      video_modes: Vec::new(),
    })
  }

  #[napi]
  pub fn set_content_protection(&self, _enabled: bool) {}

  #[napi]
  pub fn set_always_on_top(&self, enabled: bool) {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      let _ = win.set_always_on_top(enabled);
    }
  }

  #[napi]
  pub fn set_always_on_bottom(&self, _enabled: bool) {}

  #[napi]
  pub fn set_decorations(&self, enabled: bool) {
    if let Some(win) = self.inner.lock().unwrap().as_ref() {
      let _ = win.set_decorated(enabled);
    }
  }

  #[napi(getter)]
  pub fn fullscreen(&self) -> Option<FullscreenType> {
    None
  }

  #[napi]
  pub fn show(&self) {
    self.set_visible(true);
  }
}

#[napi]
pub struct Webview {
  #[allow(clippy::arc_with_non_send_sync)]
  inner: Arc<Mutex<Option<crate::wry::structs::WebView>>>,
  ipc_listeners: Arc<Mutex<Vec<crate::wry::structs::IpcHandler>>>,
  #[allow(clippy::arc_with_non_send_sync)]
  pending_actions: Arc<Mutex<Vec<PendingWebviewAction>>>,
}

/// Applies all pending actions to the webview after it's been initialized.
fn apply_pending_actions(
  webview: &crate::wry::structs::WebView,
  pending_actions: &Arc<Mutex<Vec<PendingWebviewAction>>>,
) {
  let mut actions = pending_actions.lock().unwrap();
  let actions_vec = std::mem::take(&mut *actions);
  drop(actions);
  for action in actions_vec {
    match action {
      PendingWebviewAction::LoadUrl(url) => {
        let _ = webview.load_url(url);
      }
      PendingWebviewAction::LoadHtml(html) => {
        let _ = webview.load_html(html);
      }
      PendingWebviewAction::EvaluateScript(js) => {
        let _ = webview.evaluate_script(js);
      }
      PendingWebviewAction::OpenDevtools => {
        let _ = webview.open_devtools();
      }
      PendingWebviewAction::CloseDevtools => {
        let _ = webview.close_devtools();
      }
      PendingWebviewAction::Reload => {
        let _ = webview.reload();
      }
      PendingWebviewAction::Print => {
        let _ = webview.print();
      }
    }
  }
}

#[napi]
impl Webview {
  #[napi(getter)]
  pub fn id(&self) -> String {
    if let Some(webview) = self.inner.lock().unwrap().as_ref() {
      webview.id().unwrap_or_default()
    } else {
      "uninitialized".to_string()
    }
  }

  #[napi(getter)]
  pub fn label(&self) -> String {
    if let Some(webview) = self.inner.lock().unwrap().as_ref() {
      webview.label().unwrap_or_default()
    } else {
      "uninitialized".to_string()
    }
  }

  #[napi]
  pub fn on_ipc_message(&self, handler: Option<crate::wry::structs::IpcHandler>) {
    if let Some(h) = handler {
      self.ipc_listeners.lock().unwrap().push(h);
    }
  }

  #[napi]
  pub fn on(&self, handler: crate::wry::structs::IpcHandler) {
    self.ipc_listeners.lock().unwrap().push(handler);
  }

  #[napi]
  pub fn send(&self, message: String) -> Result<()> {
    if let Some(webview) = self.inner.lock().unwrap().as_ref() {
      webview.send(message)
    } else {
      Ok(())
    }
  }

  #[napi]
  pub fn load_url(&self, url: String) -> Result<()> {
    if let Some(webview) = self.inner.lock().unwrap().as_ref() {
      webview.load_url(url)
    } else {
      // Queue the action to be applied when the webview is initialized
      self
        .pending_actions
        .lock()
        .unwrap()
        .push(PendingWebviewAction::LoadUrl(url));
      Ok(())
    }
  }

  #[napi]
  pub fn load_html(&self, html: String) -> Result<()> {
    if let Some(webview) = self.inner.lock().unwrap().as_ref() {
      webview.load_html(html)
    } else {
      // Queue the action to be applied when the webview is initialized
      self
        .pending_actions
        .lock()
        .unwrap()
        .push(PendingWebviewAction::LoadHtml(html));
      Ok(())
    }
  }

  #[napi]
  pub fn evaluate_script(&self, js: String) -> Result<()> {
    if let Some(webview) = self.inner.lock().unwrap().as_ref() {
      webview.evaluate_script(js)
    } else {
      // Queue the action to be applied when the webview is initialized
      self
        .pending_actions
        .lock()
        .unwrap()
        .push(PendingWebviewAction::EvaluateScript(js));
      Ok(())
    }
  }

  #[napi]
  pub fn open_devtools(&self) {
    if let Some(webview) = self.inner.lock().unwrap().as_ref() {
      let _ = webview.open_devtools();
    } else {
      // Queue the action to be applied when the webview is initialized
      self
        .pending_actions
        .lock()
        .unwrap()
        .push(PendingWebviewAction::OpenDevtools);
    }
  }

  #[napi]
  pub fn close_devtools(&self) {
    if let Some(webview) = self.inner.lock().unwrap().as_ref() {
      let _ = webview.close_devtools();
    } else {
      // Queue the action to be applied when the webview is initialized
      self
        .pending_actions
        .lock()
        .unwrap()
        .push(PendingWebviewAction::CloseDevtools);
    }
  }

  #[napi]
  pub fn is_devtools_open(&self) -> bool {
    if let Some(webview) = self.inner.lock().unwrap().as_ref() {
      webview.is_devtools_open().unwrap_or(false)
    } else {
      // Check if we have a pending OpenDevtools action
      let pending = self.pending_actions.lock().unwrap();
      pending
        .iter()
        .any(|action| matches!(action, PendingWebviewAction::OpenDevtools))
    }
  }

  #[napi]
  pub fn reload(&self) {
    if let Some(webview) = self.inner.lock().unwrap().as_ref() {
      let _ = webview.reload();
    } else {
      // Queue the action to be applied when the webview is initialized
      self
        .pending_actions
        .lock()
        .unwrap()
        .push(PendingWebviewAction::Reload);
    }
  }

  #[napi]
  pub fn print(&self) {
    if let Some(webview) = self.inner.lock().unwrap().as_ref() {
      let _ = webview.print();
    } else {
      // Queue the action to be applied when the webview is initialized
      self
        .pending_actions
        .lock()
        .unwrap()
        .push(PendingWebviewAction::Print);
    }
  }
}

#[napi]
pub fn get_webview_version() -> String {
  apply_runtime_gl_workaround();
  wry::webview_version().unwrap_or("unknown".to_string())
}
