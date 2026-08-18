//! Window/webview registry and request dispatch.
//!
//! Everything in here runs on the event-loop thread: tao requires windows to be
//! created and destroyed there, and wry's webviews inherit that constraint.

use crate::protocol::{write_event, WebviewParams, WindowParams};
use serde_json::{json, Value};
use std::collections::HashMap;
use tao::event_loop::EventLoopWindowTarget;
use tao::window::{Window, WindowBuilder, WindowId};

pub struct HostWindow {
  pub window: Window,
  /// Webview ids attached to this window, in creation order.
  pub webviews: Vec<u64>,
  /// When set, a user close request is only reported and never acted upon.
  pub close_guard: bool,
}

pub struct HostState {
  windows: HashMap<u64, HostWindow>,
  /// Native window id → protocol window id.
  by_native: HashMap<WindowId, u64>,
  webviews: HashMap<u64, wry::WebView>,
  /// Protocol webview id → owning window id.
  webview_owner: HashMap<u64, u64>,
  next_window_id: u64,
  next_webview_id: u64,
  pub exit_on_last_window_closed: bool,
  pub exit_requested: bool,
  pub exit_code: i32,
}

impl HostState {
  pub fn new() -> Self {
    Self {
      windows: HashMap::new(),
      by_native: HashMap::new(),
      webviews: HashMap::new(),
      webview_owner: HashMap::new(),
      next_window_id: 1,
      next_webview_id: 1,
      exit_on_last_window_closed: true,
      exit_requested: false,
      exit_code: 0,
    }
  }

  pub fn window_count(&self) -> usize {
    self.windows.len()
  }

  pub fn protocol_id(&self, native: WindowId) -> Option<u64> {
    self.by_native.get(&native).copied()
  }

  pub fn close_guard(&self, window_id: u64) -> bool {
    self
      .windows
      .get(&window_id)
      .map(|w| w.close_guard)
      .unwrap_or(false)
  }

  /// Destroys a window and everything attached to it. Returns whether it existed.
  pub fn destroy_window(&mut self, window_id: u64) -> bool {
    let Some(state) = self.windows.remove(&window_id) else {
      return false;
    };
    self.by_native.retain(|_, id| *id != window_id);

    // Webviews are child widgets of the window: drop them first.
    for webview_id in &state.webviews {
      self.webviews.remove(webview_id);
      self.webview_owner.remove(webview_id);
    }
    drop(state);

    write_event("window.destroyed", json!({ "windowId": window_id }));

    if self.exit_on_last_window_closed && self.windows.is_empty() {
      self.exit_requested = true;
    }
    true
  }

  pub fn request_exit(&mut self, code: i32) {
    self.exit_code = code;
    self.exit_requested = true;
  }

  /// Dispatches one request. `Ok` values are sent back as the `result` field.
  pub fn dispatch(
    &mut self,
    method: &str,
    params: Value,
    target: &EventLoopWindowTarget<crate::HostCommand>,
  ) -> Result<Value, String> {
    match method {
      "app.ping" => Ok(json!({ "pong": true })),

      "app.configure" => {
        if let Some(value) = params
          .get("exitOnLastWindowClosed")
          .and_then(Value::as_bool)
        {
          self.exit_on_last_window_closed = value;
        }
        Ok(json!({
          "exitOnLastWindowClosed": self.exit_on_last_window_closed,
          "version": env!("CARGO_PKG_VERSION"),
        }))
      }

      "app.status" => Ok(json!({
        "windowCount": self.window_count(),
        "exitRequested": self.exit_requested,
      })),

      "app.exit" => {
        let code = params.get("code").and_then(Value::as_i64).unwrap_or(0) as i32;
        self.request_exit(code);
        Ok(json!({ "ok": true }))
      }

      "window.create" => {
        let opts: WindowParams =
          serde_json::from_value(params).map_err(|e| format!("invalid params: {e}"))?;
        self.create_window(opts, target)
      }

      "window.close" => {
        let id = window_id(&params)?;
        let existed = self.destroy_window(id);
        Ok(json!({ "closed": existed }))
      }

      "window.setCloseGuard" => {
        let id = window_id(&params)?;
        let enabled = params
          .get("enabled")
          .and_then(Value::as_bool)
          .unwrap_or(false);
        self.with_window(id, |w| w.close_guard = enabled)?;
        Ok(json!({ "closeGuard": enabled }))
      }

      "window.setTitle" => {
        let id = window_id(&params)?;
        let title = params
          .get("title")
          .and_then(Value::as_str)
          .unwrap_or_default()
          .to_string();
        self.with_window(id, |w| w.window.set_title(&title))?;
        Ok(json!({ "ok": true }))
      }

      "window.setVisible" => {
        let id = window_id(&params)?;
        let visible = params
          .get("visible")
          .and_then(Value::as_bool)
          .unwrap_or(true);
        self.with_window(id, |w| w.window.set_visible(visible))?;
        Ok(json!({ "ok": true }))
      }

      "window.setMaximized" => {
        let id = window_id(&params)?;
        let value = flag(&params);
        self.with_window(id, |w| w.window.set_maximized(value))?;
        Ok(json!({ "ok": true }))
      }

      "window.setMinimized" => {
        let id = window_id(&params)?;
        let value = flag(&params);
        self.with_window(id, |w| w.window.set_minimized(value))?;
        Ok(json!({ "ok": true }))
      }

      "window.setAlwaysOnTop" => {
        let id = window_id(&params)?;
        let value = flag(&params);
        self.with_window(id, |w| w.window.set_always_on_top(value))?;
        Ok(json!({ "ok": true }))
      }

      "window.setDecorations" => {
        let id = window_id(&params)?;
        let value = flag(&params);
        self.with_window(id, |w| w.window.set_decorations(value))?;
        Ok(json!({ "ok": true }))
      }

      "window.focus" => {
        let id = window_id(&params)?;
        self.with_window(id, |w| w.window.set_focus())?;
        Ok(json!({ "ok": true }))
      }

      "webview.create" => {
        let opts: WebviewParams =
          serde_json::from_value(params).map_err(|e| format!("invalid params: {e}"))?;
        self.create_webview(opts)
      }

      "webview.loadUrl" => {
        let id = webview_id(&params)?;
        let url = string_param(&params, "url")?;
        self.with_webview(id, |wv| wv.load_url(&url).map_err(|e| e.to_string()))?
      }

      "webview.loadHtml" => {
        let id = webview_id(&params)?;
        let html = string_param(&params, "html")?;
        self.with_webview(id, |wv| wv.load_html(&html).map_err(|e| e.to_string()))?
      }

      "webview.evaluateScript" => {
        let id = webview_id(&params)?;
        let js = string_param(&params, "js")?;
        self.with_webview(id, |wv| wv.evaluate_script(&js).map_err(|e| e.to_string()))?
      }

      "webview.openDevtools" => {
        let id = webview_id(&params)?;
        self.with_webview(id, |wv| {
          wv.open_devtools();
          Ok(())
        })?
      }

      "webview.closeDevtools" => {
        let id = webview_id(&params)?;
        self.with_webview(id, |wv| {
          wv.close_devtools();
          Ok(())
        })?
      }

      "webview.reload" => {
        let id = webview_id(&params)?;
        self.with_webview(id, |wv| wv.reload().map_err(|e| e.to_string()))?
      }

      "webview.print" => {
        let id = webview_id(&params)?;
        self.with_webview(id, |wv| wv.print().map_err(|e| e.to_string()))?
      }

      other => Err(format!("unknown method '{other}'")),
    }
  }

  fn with_window<T>(&mut self, id: u64, f: impl FnOnce(&mut HostWindow) -> T) -> Result<T, String> {
    self
      .windows
      .get_mut(&id)
      .map(f)
      .ok_or_else(|| format!("unknown window {id}"))
  }

  fn with_webview(
    &mut self,
    id: u64,
    f: impl FnOnce(&wry::WebView) -> Result<(), String>,
  ) -> Result<Result<Value, String>, String> {
    let webview = self
      .webviews
      .get(&id)
      .ok_or_else(|| format!("unknown webview {id}"))?;
    Ok(f(webview).map(|_| json!({ "ok": true })))
  }

  fn create_window(
    &mut self,
    opts: WindowParams,
    target: &EventLoopWindowTarget<crate::HostCommand>,
  ) -> Result<Value, String> {
    let mut builder = WindowBuilder::new()
      .with_title(opts.title.clone().unwrap_or_else(|| "Webview".to_string()))
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

    if let (Some(x), Some(y)) = (opts.x, opts.y) {
      builder = builder.with_position(tao::dpi::LogicalPosition::new(x, y));
    }

    let window = builder.build(target).map_err(|e| e.to_string())?;
    let native_id = window.id();
    let id = self.next_window_id;
    self.next_window_id += 1;

    self.by_native.insert(native_id, id);
    self.windows.insert(
      id,
      HostWindow {
        window,
        webviews: Vec::new(),
        close_guard: false,
      },
    );

    Ok(json!({ "windowId": id }))
  }

  fn create_webview(&mut self, opts: WebviewParams) -> Result<Value, String> {
    let window_id = opts.window_id;
    if !self.windows.contains_key(&window_id) {
      return Err(format!("unknown window {window_id}"));
    }
    let webview_id = self.next_webview_id;

    let mut builder = wry::WebViewBuilder::new()
      .with_transparent(opts.transparent.unwrap_or(false))
      .with_devtools(opts.enable_devtools.unwrap_or(false))
      .with_hotkeys_zoom(opts.hotkeys_zoom.unwrap_or(false))
      .with_clipboard(opts.clipboard.unwrap_or(false))
      .with_autoplay(opts.autoplay.unwrap_or(false))
      .with_back_forward_navigation_gestures(
        opts.back_forward_navigation_gestures.unwrap_or(false),
      );

    if let (Some(width), Some(height)) = (opts.width, opts.height) {
      builder = builder.with_bounds(wry::Rect {
        position: tao::dpi::LogicalPosition::new(opts.x.unwrap_or(0.0), opts.y.unwrap_or(0.0))
          .into(),
        size: tao::dpi::LogicalSize::new(width, height).into(),
      });
    }
    if let Some(url) = &opts.url {
      builder = builder.with_url(url);
    } else if let Some(html) = &opts.html {
      builder = builder.with_html(html);
    }
    if let Some(user_agent) = &opts.user_agent {
      builder = builder.with_user_agent(user_agent);
    }
    if let Some(preload) = &opts.preload {
      builder = builder.with_initialization_script(preload);
    }
    #[cfg(any(
      target_os = "windows",
      target_os = "macos",
      target_os = "ios",
      target_os = "android"
    ))]
    {
      builder = builder.with_incognito(opts.incognito.unwrap_or(false));
    }

    // Page → host messages become `webview.ipc` events.
    builder = builder.with_ipc_handler(move |request| {
      write_event(
        "webview.ipc",
        json!({
          "webviewId": webview_id,
          "windowId": window_id,
          "body": request.into_body(),
        }),
      );
    });

    let webview = self.build_webview(window_id, builder)?;

    self.webviews.insert(webview_id, webview);
    self.webview_owner.insert(webview_id, window_id);
    self.next_webview_id += 1;
    if let Some(window) = self.windows.get_mut(&window_id) {
      window.webviews.push(webview_id);
    }

    Ok(json!({ "webviewId": webview_id, "windowId": window_id }))
  }

  #[cfg(any(
    target_os = "linux",
    target_os = "dragonfly",
    target_os = "freebsd",
    target_os = "netbsd",
    target_os = "openbsd"
  ))]
  fn build_webview(
    &mut self,
    window_id: u64,
    builder: wry::WebViewBuilder<'_>,
  ) -> Result<wry::WebView, String> {
    use tao::platform::unix::WindowExtUnix;
    use wry::WebViewBuilderExtUnix;

    // On GTK the webview replaces the window's child widget, so a window hosts
    // exactly one webview — same constraint as the in-process backend.
    let window = self
      .windows
      .get(&window_id)
      .ok_or_else(|| format!("unknown window {window_id}"))?;
    if !window.webviews.is_empty() {
      return Err(format!(
        "window {window_id} already has a webview (one webview per window on GTK)"
      ));
    }

    // A tao window is a `GtkApplicationWindow`, i.e. a `GtkBin`: it already
    // holds a container child that would collide with the WebKit widget. Detach
    // it first, then show the new widget tree.
    extern "C" {
      fn gtk_bin_get_child(bin: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
      fn gtk_container_remove(container: *mut std::ffi::c_void, widget: *mut std::ffi::c_void);
      fn gtk_widget_show_all(widget: *mut std::ffi::c_void);
    }

    let gtk_window = window.window.gtk_window();
    let raw = unsafe { *(gtk_window as *const _ as *const *mut std::ffi::c_void) };
    if raw.is_null() {
      return Err("GTK window pointer is null".to_string());
    }
    unsafe {
      let child = gtk_bin_get_child(raw);
      if !child.is_null() {
        gtk_container_remove(raw, child);
      }
    }

    let webview = builder.build_gtk(gtk_window).map_err(|e| e.to_string())?;
    unsafe {
      gtk_widget_show_all(raw);
    }
    Ok(webview)
  }

  #[cfg(not(any(
    target_os = "linux",
    target_os = "dragonfly",
    target_os = "freebsd",
    target_os = "netbsd",
    target_os = "openbsd"
  )))]
  fn build_webview(
    &mut self,
    window_id: u64,
    builder: wry::WebViewBuilder<'_>,
  ) -> Result<wry::WebView, String> {
    let window = self
      .windows
      .get(&window_id)
      .ok_or_else(|| format!("unknown window {window_id}"))?;
    builder.build(&window.window).map_err(|e| e.to_string())
  }
}

fn window_id(params: &Value) -> Result<u64, String> {
  params
    .get("windowId")
    .and_then(Value::as_u64)
    .ok_or_else(|| "missing windowId".to_string())
}

fn webview_id(params: &Value) -> Result<u64, String> {
  params
    .get("webviewId")
    .and_then(Value::as_u64)
    .ok_or_else(|| "missing webviewId".to_string())
}

fn string_param(params: &Value, key: &str) -> Result<String, String> {
  params
    .get(key)
    .and_then(Value::as_str)
    .map(str::to_string)
    .ok_or_else(|| format!("missing {key}"))
}

fn flag(params: &Value) -> bool {
  params
    .get("value")
    .and_then(Value::as_bool)
    .unwrap_or_else(|| {
      params
        .get("enabled")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    })
}

impl Default for HostState {
  fn default() -> Self {
    Self::new()
  }
}
