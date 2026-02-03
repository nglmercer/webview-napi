//! Platform detection and utilities
//!
//! This module provides utilities for detecting the current display server
//! and platform-specific configurations.

use std::env;

/// Display server type
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DisplayServer {
  /// X11 display server (Linux)
  X11,
  /// Windows Desktop Window Manager / Win32
  Windows,
  /// Unknown or other display server (e.g., Wayland pure, Cocoa on macOS)
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
  pub fn detect() -> Self {
    // --- LINUX CONFIGURATION ---
    #[cfg(target_os = "linux")]
    {
      // Force X11 on Linux by removing Wayland environment variables
      env::remove_var("WAYLAND_DISPLAY");
      env::set_var("GDK_BACKEND", "x11");
      // Ensure DISPLAY is set for X11
      if env::var("DISPLAY").is_err() {
        env::set_var("DISPLAY", ":0");
      }

      PlatformInfo {
        display_server: DisplayServer::X11,
        supports_transparency: true,
        supports_positioning: true,
        supports_direct_rendering: true,
      }
    }

    // --- WINDOWS CONFIGURATION ---
    #[cfg(target_os = "windows")]
    {
      PlatformInfo {
        display_server: DisplayServer::Windows,
        // Windows suporta transparência (Layered Windows) desde o Win2000/XP
        supports_transparency: true,
        // Posicionamento absoluto funciona bem no Windows
        supports_positioning: true,
        // Suporta rendering via GDI, Direct2D, OpenGL, etc.
        supports_direct_rendering: true,
      }
    }

    // --- MACOS / OUTROS CONFIGURATION ---
    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
      PlatformInfo {
        display_server: DisplayServer::Unknown,
        supports_transparency: cfg!(target_os = "macos"),
        supports_positioning: true,
        supports_direct_rendering: true,
      }
    }
  }

  /// Returns true if running on X11
  pub fn is_x11(&self) -> bool {
    self.display_server == DisplayServer::X11
  }

  /// Returns true if running on Windows
  pub fn is_windows(&self) -> bool {
    self.display_server == DisplayServer::Windows
  }
}

/// Global platform information
pub fn platform_info() -> PlatformInfo {
  PlatformInfo::detect()
}
