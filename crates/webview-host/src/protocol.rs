//! Wire types for the stdio protocol.
//!
//! Newline-delimited JSON, three shapes:
//!
//! ```text
//! → {"id":42,"method":"window.create","params":{"title":"Hello"}}
//! ← {"id":42,"result":{"windowId":1}}
//! ← {"event":"window.closeRequested","params":{"windowId":1}}
//! ```
//!
//! stdout carries the protocol and nothing else; stderr is for logs.

use serde::Deserialize;
use serde_json::{json, Value};
use std::io::Write;

#[derive(Debug, Deserialize)]
pub struct Request {
  pub id: Option<u64>,
  pub method: String,
  #[serde(default)]
  pub params: Value,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct WindowParams {
  pub title: Option<String>,
  pub width: Option<f64>,
  pub height: Option<f64>,
  pub x: Option<f64>,
  pub y: Option<f64>,
  pub resizable: Option<bool>,
  pub decorations: Option<bool>,
  pub always_on_top: Option<bool>,
  pub maximized: Option<bool>,
  pub focused: Option<bool>,
  pub transparent: Option<bool>,
  pub visible: Option<bool>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct WebviewParams {
  pub window_id: u64,
  pub url: Option<String>,
  pub html: Option<String>,
  pub width: Option<f64>,
  pub height: Option<f64>,
  pub x: Option<f64>,
  pub y: Option<f64>,
  pub user_agent: Option<String>,
  pub preload: Option<String>,
  pub transparent: Option<bool>,
  pub enable_devtools: Option<bool>,
  pub incognito: Option<bool>,
  pub hotkeys_zoom: Option<bool>,
  pub clipboard: Option<bool>,
  pub autoplay: Option<bool>,
  pub back_forward_navigation_gestures: Option<bool>,
}

/// Writes one protocol frame to stdout.
pub fn write_frame(value: Value) {
  let stdout = std::io::stdout();
  let mut lock = stdout.lock();
  if writeln!(lock, "{}", value).is_ok() {
    let _ = lock.flush();
  }
}

pub fn write_result(id: Option<u64>, result: Value) {
  if let Some(id) = id {
    write_frame(json!({ "id": id, "result": result }));
  }
}

pub fn write_error(id: Option<u64>, message: impl std::fmt::Display) {
  if let Some(id) = id {
    write_frame(json!({ "id": id, "error": { "message": message.to_string() } }));
  }
}

pub fn write_event(event: &str, params: Value) {
  write_frame(json!({ "event": event, "params": params }));
}

/// Logs go to stderr so they never corrupt the protocol stream.
pub fn log(message: impl std::fmt::Display) {
  eprintln!("[webview-host] {}", message);
}
