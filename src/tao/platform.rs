//! Platform detection and utilities
//!
//! This module provides utilities for detecting the current display server
//! and platform-specific configurations.

use std::env;

/// Display server type - X11 only (Wayland support removed)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DisplayServer {
  /// X11 display server
  X11,
  /// Unknown or other display server
  Unknown,
}

/// Platform information
#[derive(Debug, Clone)]
pub struct PlatformInfo {
  /// The display server type
  pub display_server: DisplayServer,
  /// Whether the platform supports transparency
  pub supports_transparency: bool,
  /// Whether the platform supports window positioning
  pub supports_positioning: bool,
  /// Whether the platform supports direct pixel buffer rendering
  pub supports_direct_rendering: bool,
}

impl Default for PlatformInfo {
  fn default() -> Self {
    Self::detect()
  }
}

impl PlatformInfo {
  /// Detects the current platform information
  /// Forces X11 mode on Linux by clearing WAYLAND_DISPLAY
  pub fn detect() -> Self {
    // Force X11 on Linux by removing Wayland environment variables
    #[cfg(target_os = "linux")]
    {
      env::remove_var("WAYLAND_DISPLAY");
      env::set_var("GDK_BACKEND", "x11");
      // Ensure DISPLAY is set for X11
      if env::var("DISPLAY").is_err() {
        env::set_var("DISPLAY", ":0");
      }
    }

    #[cfg(target_os = "linux")]
    {
      PlatformInfo {
        display_server: DisplayServer::X11,
        supports_transparency: true,
        supports_positioning: true,
        supports_direct_rendering: true,
      }
    }

    #[cfg(not(target_os = "linux"))]
    {
      PlatformInfo {
        display_server: DisplayServer::Unknown,
        supports_transparency: cfg!(target_os = "macos") || cfg!(target_os = "windows"),
        supports_positioning: true,
        supports_direct_rendering: true,
      }
    }
  }

  /// Returns true if running on X11 (always true for Linux, this library forces X11)
  pub fn is_x11(&self) -> bool {
    self.display_server == DisplayServer::X11
  }
}

/// Global platform information
pub fn platform_info() -> PlatformInfo {
  PlatformInfo::detect()
}
