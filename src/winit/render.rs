//! Simple pixel buffer rendering module
//!
//! Provides a minimal, cross-platform API for rendering RGBA pixel buffers to Winit windows.
//! Uses softbuffer for all platforms (Linux, macOS, Windows) for consistency.

use crate::winit::enums::ScaleMode;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::cell::RefCell;
use std::num::NonZeroU32;

/// Render options for pixel buffer display
#[napi(object)]
#[derive(Debug, Clone)]
pub struct RenderOptions {
  /// Width of the source buffer in pixels
  pub buffer_width: u32,
  /// Height of the source buffer in pixels
  pub buffer_height: u32,
  /// Scaling mode (default: Fit)
  pub scale_mode: Option<ScaleMode>,
  /// Background color for letterboxing [R, G, B, A] (default: [0, 0, 0, 255])
  pub background_color: Option<Vec<u8>>,
}

impl Default for RenderOptions {
  fn default() -> Self {
    Self {
      buffer_width: 800,
      buffer_height: 600,
      scale_mode: Some(ScaleMode::Fit),
      background_color: Some(vec![0, 0, 0, 255]),
    }
  }
}

/// Per-window rendering state using softbuffer
struct RenderState {
  #[allow(dead_code)]
  context: softbuffer::Context<&'static winit::window::Window>,
  surface: softbuffer::Surface<&'static winit::window::Window, &'static winit::window::Window>,
  last_window_width: u32,
  last_window_height: u32,
}

/// Global cache for rendering state to avoid resource exhaustion.
/// The key is the window ID (hashed to u64).
static RENDER_STATE_CACHE: std::sync::LazyLock<
  std::sync::Mutex<RefCell<std::collections::HashMap<u64, RenderState>>>,
> = std::sync::LazyLock::new(|| {
  std::sync::Mutex::new(RefCell::new(std::collections::HashMap::new()))
});

/// Simple pixel renderer for Winit windows
///
/// Uses softbuffer for cross-platform rendering (works on Linux, macOS, Windows).
/// Rendering resources are cached per-window to avoid resource exhaustion.
#[napi]
pub struct PixelRenderer {
  buffer_width: u32,
  buffer_height: u32,
  scale_mode: ScaleMode,
  bg_color: [u8; 4],
}

#[napi]
impl PixelRenderer {
  /// Creates a new pixel renderer with the given buffer dimensions
  #[napi(constructor)]
  pub fn new(buffer_width: u32, buffer_height: u32) -> Self {
    Self {
      buffer_width,
      buffer_height,
      scale_mode: ScaleMode::Fit,
      bg_color: [0, 0, 0, 255],
    }
  }

  /// Creates a new pixel renderer with options
  #[napi(factory)]
  pub fn with_options(options: RenderOptions) -> Self {
    let bg_color = options
      .background_color
      .as_ref()
      .and_then(|c| {
        if c.len() >= 4 {
          Some([c[0], c[1], c[2], c[3]])
        } else {
          None
        }
      })
      .unwrap_or([0, 0, 0, 255]);

    Self {
      buffer_width: options.buffer_width,
      buffer_height: options.buffer_height,
      scale_mode: options.scale_mode.unwrap_or(ScaleMode::Fit),
      bg_color,
    }
  }

  /// Sets the scaling mode
  #[napi]
  pub fn set_scale_mode(&mut self, mode: ScaleMode) {
    self.scale_mode = mode;
  }

  /// Sets the background color
  #[napi]
  pub fn set_background_color(&mut self, r: u8, g: u8, b: u8, a: u8) {
    self.bg_color = [r, g, b, a];
  }

  /// Renders a pixel buffer to the given window
  ///
  /// # Arguments
  /// * `window` - The Winit window to render to
  /// * `buffer` - RGBA pixel buffer (must be buffer_width * buffer_height * 4 bytes)
  #[napi]
  pub fn render(&self, window: &crate::winit::structs::Window, buffer: Buffer) -> napi::Result<()> {
    let window_arc = window.inner.as_ref().ok_or_else(|| {
      napi::Error::new(
        napi::Status::GenericFailure,
        "Window not initialized".to_string(),
      )
    })?;

    let window_guard = window_arc.lock().map_err(|_| {
      napi::Error::new(
        napi::Status::GenericFailure,
        "Failed to lock window".to_string(),
      )
    })?;

    // Get the window ID for caching
    let window_id = window_guard.id();
    let window_id_u64 = window_id_to_u64(window_id);

    let window_size = window_guard.inner_size();
    let window_width = window_size.width;
    let window_height = window_size.height;

    // Validate buffer size
    let expected_len = (self.buffer_width * self.buffer_height * 4) as usize;
    if buffer.len() != expected_len {
      return Err(napi::Error::new(
        napi::Status::GenericFailure,
        format!(
          "Buffer size mismatch: got {} bytes, expected {} bytes for {}x{}",
          buffer.len(),
          expected_len,
          self.buffer_width,
          self.buffer_height
        ),
      ));
    }

    // Get or create the rendering state from the global cache
    let cache = RENDER_STATE_CACHE.lock().map_err(|_| {
      napi::Error::new(
        napi::Status::GenericFailure,
        "Failed to lock render state cache".to_string(),
      )
    })?;

    // Check if we need to create a new state for this window
    let needs_create = {
      let cache_ref = cache.borrow();
      !cache_ref.contains_key(&window_id_u64)
    };

    if needs_create {
      // SAFETY: We need to extend the lifetime of the window reference.
      // This is safe because:
      // 1. The window is guaranteed to be alive during rendering
      // 2. We clean up the cache when the window is destroyed
      // 3. The window_id is unique per window instance
      let window_ref: &'static winit::window::Window =
        unsafe { std::mem::transmute(&*window_guard) };

      let context = softbuffer::Context::new(window_ref).map_err(|e| {
        napi::Error::new(
          napi::Status::GenericFailure,
          format!("Failed to create softbuffer context: {:?}", e),
        )
      })?;

      let surface = softbuffer::Surface::new(&context, window_ref).map_err(|e| {
        napi::Error::new(
          napi::Status::GenericFailure,
          format!("Failed to create softbuffer surface: {:?}", e),
        )
      })?;

      cache.borrow_mut().insert(
        window_id_u64,
        RenderState {
          context,
          surface,
          last_window_width: window_width,
          last_window_height: window_height,
        },
      );
    }

    // Get mutable reference to state from cache
    let mut cache_mut = cache.borrow_mut();
    let state = cache_mut.get_mut(&window_id_u64).ok_or_else(|| {
      napi::Error::new(
        napi::Status::GenericFailure,
        "Render state not available in cache".to_string(),
      )
    })?;

    // Check if window was resized and we need to recreate the surface
    let needs_resize =
      state.last_window_width != window_width || state.last_window_height != window_height;

    if needs_resize {
      // Drop the current state and recreate
      drop(cache_mut);
      cache.borrow_mut().remove(&window_id_u64);

      // Recreate with new dimensions
      let window_ref: &'static winit::window::Window =
        unsafe { std::mem::transmute(&*window_guard) };

      let context = softbuffer::Context::new(window_ref).map_err(|e| {
        napi::Error::new(
          napi::Status::GenericFailure,
          format!("Failed to create softbuffer context: {:?}", e),
        )
      })?;

      let surface = softbuffer::Surface::new(&context, window_ref).map_err(|e| {
        napi::Error::new(
          napi::Status::GenericFailure,
          format!("Failed to create softbuffer surface: {:?}", e),
        )
      })?;

      cache.borrow_mut().insert(
        window_id_u64,
        RenderState {
          context,
          surface,
          last_window_width: window_width,
          last_window_height: window_height,
        },
      );

      cache_mut = cache.borrow_mut();
    }

    let state = cache_mut.get_mut(&window_id_u64).ok_or_else(|| {
      napi::Error::new(
        napi::Status::GenericFailure,
        "Render state not available after resize".to_string(),
      )
    })?;

    // Resize surface to match window
    state
      .surface
      .resize(
        NonZeroU32::new(window_width).unwrap_or(NonZeroU32::new(1).unwrap()),
        NonZeroU32::new(window_height).unwrap_or(NonZeroU32::new(1).unwrap()),
      )
      .map_err(|e| {
        napi::Error::new(
          napi::Status::GenericFailure,
          format!("Failed to resize softbuffer surface: {:?}", e),
        )
      })?;

    // Get the surface buffer
    let mut surface_buffer = state.surface.buffer_mut().map_err(|e| {
      napi::Error::new(
        napi::Status::GenericFailure,
        format!("Failed to get softbuffer buffer: {:?}", e),
      )
    })?;

    // Apply scaling and render
    self.render_to_buffer(&mut surface_buffer, &buffer, window_width, window_height);

    // Present the buffer
    surface_buffer.present().map_err(|e| {
      napi::Error::new(
        napi::Status::GenericFailure,
        format!("Failed to present softbuffer: {:?}", e),
      )
    })
  }

  /// Internal method to render the buffer with the configured scale mode
  fn render_to_buffer(
    &self,
    surface_buffer: &mut [u32],
    buffer: &[u8],
    window_width: u32,
    window_height: u32,
  ) {
    // Calculate scaled dimensions
    let (offset_x, offset_y, scaled_width, scaled_height) = calculate_scaled_dimensions(
      self.buffer_width,
      self.buffer_height,
      window_width,
      window_height,
      self.scale_mode,
    );

    // Clear with background color first (convert RGBA to ARGB for softbuffer)
    let bg_argb = u32::from_le_bytes([self.bg_color[2], self.bg_color[1], self.bg_color[0], 255]);
    for pixel in surface_buffer.iter_mut() {
      *pixel = bg_argb;
    }

    // Copy source buffer with scaling (RGBA to ARGB conversion)
    match self.scale_mode {
      ScaleMode::Stretch => {
        copy_buffer_stretch(
          surface_buffer,
          buffer,
          self.buffer_width,
          self.buffer_height,
          window_width,
          window_height,
        );
      }
      ScaleMode::None => {
        copy_buffer_centered(
          surface_buffer,
          buffer,
          self.buffer_width,
          self.buffer_height,
          window_width,
          window_height,
        );
      }
      _ => {
        copy_buffer_scaled(
          surface_buffer,
          buffer,
          CopyBufferParams {
            buffer_width: self.buffer_width,
            buffer_height: self.buffer_height,
            window_width,
            window_height,
            offset_x,
            offset_y,
            scaled_width,
            scaled_height,
          },
        );
      }
    }
  }
}

/// Helper function to convert WindowId to u64 for caching
fn window_id_to_u64(window_id: winit::window::WindowId) -> u64 {
  use std::hash::{Hash, Hasher};
  let mut hasher = std::collections::hash_map::DefaultHasher::new();
  window_id.hash(&mut hasher);
  hasher.finish()
}

/// Calculates scaled dimensions based on the render options
fn calculate_scaled_dimensions(
  buffer_width: u32,
  buffer_height: u32,
  window_width: u32,
  window_height: u32,
  scale_mode: ScaleMode,
) -> (u32, u32, u32, u32) {
  match scale_mode {
    ScaleMode::Stretch => (0, 0, window_width, window_height),
    ScaleMode::Fit => {
      let scale_x = window_width as f64 / buffer_width as f64;
      let scale_y = window_height as f64 / buffer_height as f64;
      let scale = scale_x.min(scale_y);
      let scaled_width = (buffer_width as f64 * scale) as u32;
      let scaled_height = (buffer_height as f64 * scale) as u32;
      let offset_x = (window_width - scaled_width) / 2;
      let offset_y = (window_height - scaled_height) / 2;
      (offset_x, offset_y, scaled_width, scaled_height)
    }
    ScaleMode::Fill => {
      let scale_x = window_width as f64 / buffer_width as f64;
      let scale_y = window_height as f64 / buffer_height as f64;
      let scale = scale_x.max(scale_y);
      let scaled_width = (buffer_width as f64 * scale) as u32;
      let scaled_height = (buffer_height as f64 * scale) as u32;
      let offset_x = (window_width - scaled_width) / 2;
      let offset_y = (window_height - scaled_height) / 2;
      (offset_x, offset_y, scaled_width, scaled_height)
    }
    ScaleMode::Integer => {
      let scale_x = window_width as f64 / buffer_width as f64;
      let scale_y = window_height as f64 / buffer_height as f64;
      let scale = scale_x.min(scale_y).floor() as u32;
      let scale = scale.max(1);
      let scaled_width = buffer_width * scale;
      let scaled_height = buffer_height * scale;
      let offset_x = (window_width - scaled_width) / 2;
      let offset_y = (window_height - scaled_height) / 2;
      (offset_x, offset_y, scaled_width, scaled_height)
    }
    ScaleMode::None => {
      let offset_x = (window_width.saturating_sub(buffer_width)) / 2;
      let offset_y = (window_height.saturating_sub(buffer_height)) / 2;
      (offset_x, offset_y, buffer_width, buffer_height)
    }
  }
}

/// Parameters for buffer copying with scaling
struct CopyBufferParams {
  buffer_width: u32,
  buffer_height: u32,
  window_width: u32,
  window_height: u32,
  offset_x: u32,
  offset_y: u32,
  scaled_width: u32,
  scaled_height: u32,
}

/// Copies buffer with stretch scaling (RGBA to ARGB conversion)
fn copy_buffer_stretch(
  surface_buffer: &mut [u32],
  buffer: &[u8],
  buffer_width: u32,
  buffer_height: u32,
  window_width: u32,
  window_height: u32,
) {
  let scale_x = buffer_width as f64 / window_width as f64;
  let scale_y = buffer_height as f64 / window_height as f64;

  for y in 0..window_height {
    let src_y = (y as f64 * scale_y).min(buffer_height as f64 - 1.0) as u32;

    for x in 0..window_width {
      let src_x = (x as f64 * scale_x).min(buffer_width as f64 - 1.0) as u32;

      let src_idx = ((src_y * buffer_width + src_x) * 4) as usize;
      let dst_idx = (y * window_width + x) as usize;

      if src_idx + 4 <= buffer.len() && dst_idx < surface_buffer.len() {
        // Convert RGBA to ARGB (softbuffer uses ARGB format)
        surface_buffer[dst_idx] = u32::from_le_bytes([
          buffer[src_idx + 2], // B
          buffer[src_idx + 1], // G
          buffer[src_idx],     // R
          255,                 // A (softbuffer doesn't use alpha, set to opaque)
        ]);
      }
    }
  }
}

/// Copies buffer centered without scaling (RGBA to ARGB conversion)
fn copy_buffer_centered(
  surface_buffer: &mut [u32],
  buffer: &[u8],
  buffer_width: u32,
  buffer_height: u32,
  window_width: u32,
  window_height: u32,
) {
  let offset_x = ((window_width.saturating_sub(buffer_width)) / 2) as usize;
  let offset_y = ((window_height.saturating_sub(buffer_height)) / 2) as usize;

  for y in 0..buffer_height.min(window_height) {
    let src_row_start = (y * buffer_width * 4) as usize;

    for x in 0..buffer_width.min(window_width) {
      let src_idx = src_row_start + (x * 4) as usize;
      let dst_idx = (offset_y + y as usize) * window_width as usize + offset_x + x as usize;

      if src_idx + 4 <= buffer.len() && dst_idx < surface_buffer.len() {
        // Convert RGBA to ARGB
        surface_buffer[dst_idx] = u32::from_le_bytes([
          buffer[src_idx + 2], // B
          buffer[src_idx + 1], // G
          buffer[src_idx],     // R
          255,                 // A
        ]);
      }
    }
  }
}

/// Copies buffer with scaling (RGBA to ARGB conversion)
fn copy_buffer_scaled(surface_buffer: &mut [u32], buffer: &[u8], params: CopyBufferParams) {
  let CopyBufferParams {
    buffer_width,
    buffer_height,
    window_width,
    window_height,
    offset_x,
    offset_y,
    scaled_width,
    scaled_height,
  } = params;

  let scale_x = buffer_width as f64 / scaled_width as f64;
  let scale_y = buffer_height as f64 / scaled_height as f64;

  for y in 0..scaled_height {
    let src_y = (y as f64 * scale_y).min(buffer_height as f64 - 1.0) as u32;
    let dst_y = offset_y + y;

    if dst_y >= window_height {
      break;
    }

    for x in 0..scaled_width {
      let src_x = (x as f64 * scale_x).min(buffer_width as f64 - 1.0) as u32;
      let dst_x = offset_x + x;

      if dst_x >= window_width {
        break;
      }

      let src_idx = ((src_y * buffer_width + src_x) * 4) as usize;
      let dst_idx = (dst_y * window_width + dst_x) as usize;

      if src_idx + 4 <= buffer.len() && dst_idx < surface_buffer.len() {
        // Convert RGBA to ARGB
        surface_buffer[dst_idx] = u32::from_le_bytes([
          buffer[src_idx + 2], // B
          buffer[src_idx + 1], // G
          buffer[src_idx],     // R
          255,                 // A
        ]);
      }
    }
  }
}

/// Simple function to render a pixel buffer to a window
///
/// This is a convenience function for one-off renders.
/// For repeated rendering, use [`PixelRenderer`] instead.
#[napi]
pub fn render_pixels(
  window: &crate::winit::structs::Window,
  buffer: Buffer,
  buffer_width: u32,
  buffer_height: u32,
) -> napi::Result<()> {
  let renderer = PixelRenderer::new(buffer_width, buffer_height);
  renderer.render(window, buffer)
}

/// Clears the render state cache for a specific window.
/// Call this when a window is closed to free up resources.
#[napi]
pub fn clear_render_cache(window_id: i64) {
  if let Ok(cache) = RENDER_STATE_CACHE.lock() {
    cache.borrow_mut().remove(&(window_id as u64));
  }
}

/// Clears all render state caches.
/// Use with caution - this will force recreation of all rendering resources.
#[napi]
pub fn clear_all_render_caches() {
  if let Ok(cache) = RENDER_STATE_CACHE.lock() {
    cache.borrow_mut().clear();
  }
}
