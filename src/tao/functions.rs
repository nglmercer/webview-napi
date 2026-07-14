//! Tao functions
//!
//! This module contains all functions from the tao crate.

use napi_derive::napi;

use crate::tao::structs::MonitorInfo;

/// Returns the current version of the tao crate.
/// This value is extracted from Cargo.lock at compile time.
/// The Cargo.toml dependency is: tao = "0.34.5"
#[napi]
pub fn tao_version() -> String {
  env!("CARGO_PKG_TAO_VERSION", "unknown").to_string()
}

/// Creates a temporary event loop for monitor queries.
/// On Linux/GTK, only one EventLoop can exist per process.
/// Returns None if an EventLoop already exists or creation fails.
#[cfg(target_os = "linux")]
fn try_create_event_loop() -> Option<tao::event_loop::EventLoop<()>> {
  // If the main EventLoop was already created via the NAPI constructor,
  // GTK is already initialized and a second creation will panic.
  if crate::tao::structs::EVENT_LOOP_CREATED.load(std::sync::atomic::Ordering::SeqCst) {
    return None;
  }

  let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
    crate::tao::platform::platform_info();
    tao::event_loop::EventLoop::<()>::new()
  }));

  result.ok()
}

#[cfg(not(target_os = "linux"))]
fn try_create_event_loop() -> Option<tao::event_loop::EventLoop<()>> {
  Some(tao::event_loop::EventLoop::<()>::new())
}

/// Returns the primary monitor information.
/// Returns Some(MonitorInfo) if a primary monitor exists, None on error or
/// if the monitor cannot be queried (e.g., when an EventLoop already exists on Linux).
#[napi]
pub fn primary_monitor() -> Option<MonitorInfo> {
  let event_loop = try_create_event_loop()?;
  let monitor = event_loop.primary_monitor()?;
  Some(MonitorInfo {
    name: monitor.name(),
    size: crate::tao::structs::Size {
      width: monitor.size().width as f64,
      height: monitor.size().height as f64,
    },
    position: crate::tao::structs::Position {
      x: monitor.position().x as f64,
      y: monitor.position().y as f64,
    },
    scale_factor: monitor.scale_factor(),
  })
}

/// Returns a list of all available monitors.
/// Returns an empty vector if no monitors are found, on error, or
/// if monitors cannot be queried (e.g., when an EventLoop already exists on Linux).
#[napi]
pub fn available_monitors() -> Vec<MonitorInfo> {
  let Some(event_loop) = try_create_event_loop() else {
    return Vec::new();
  };
  event_loop
    .available_monitors()
    .map(|m| MonitorInfo {
      name: m.name(),
      size: crate::tao::structs::Size {
        width: m.size().width as f64,
        height: m.size().height as f64,
      },
      position: crate::tao::structs::Position {
        x: m.position().x as f64,
        y: m.position().y as f64,
      },
      scale_factor: m.scale_factor(),
    })
    .collect()
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_tao_version_not_empty() {
    let version = tao_version();
    assert!(!version.is_empty(), "tao_version returned empty string");
  }

  #[test]
  fn test_tao_version_format() {
    let version = tao_version();
    let parts: Vec<&str> = version.split('.').collect();
    assert!(parts.len() >= 2, "tao_version should have at least 2 parts");
    for part in &parts {
      assert!(
        part.parse::<u32>().is_ok(),
        "Each version part should be a valid integer"
      );
    }
  }

  #[test]
  fn test_available_monitors_returns_vec() {
    // On non-linux, this should always succeed
    // On linux, it depends on GTK state but should not panic
    let monitors = available_monitors();
    // At minimum returns an empty vec, never panics
    let _ = monitors.len();
  }

  #[test]
  fn test_primary_monitor_returns_option() {
    let monitor = primary_monitor();
    if let Some(m) = monitor {
      assert!(m.size.width > 0.0, "Monitor width should be > 0");
      assert!(m.size.height > 0.0, "Monitor height should be > 0");
      assert!(m.scale_factor > 0.0, "Scale factor should be > 0");
    }
  }
}
