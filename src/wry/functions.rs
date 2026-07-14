//! Wry functions
//!
//! This module contains all functions from the wry crate.

use napi::Result;
use napi_derive::napi;

/// Wry crate version, extracted from Cargo.lock at compile time.
const WRY_VERSION: &str = env!("WRY_VERSION", env!("CARGO_PKG_VERSION"));

/// Parses a semver string like "0.53.5" into a (major, minor, patch) tuple.
/// Falls back to (0, 0, 0) if parsing fails.
fn parse_semver(version: &str) -> (u32, u32, u32) {
  let parts: Vec<&str> = version.splitn(3, '.').collect();
  if parts.len() == 3 {
    (
      parts[0].parse().unwrap_or(0),
      parts[1].parse().unwrap_or(0),
      parts[2].parse().unwrap_or(0),
    )
  } else {
    (0, 0, 0)
  }
}

/// Returns the version of the wry webview library as (major, minor, patch).
/// The value is extracted from Cargo.lock at compile time and always matches
/// the actual wry crate version used in the build.
#[napi]
pub fn webview_version() -> Result<(u32, u32, u32)> {
  Ok(parse_semver(WRY_VERSION))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_parse_semver_valid() {
    assert_eq!(parse_semver("0.53.5"), (0, 53, 5));
    assert_eq!(parse_semver("1.2.3"), (1, 2, 3));
    assert_eq!(parse_semver("10.20.30"), (10, 20, 30));
  }

  #[test]
  fn test_parse_semver_invalid() {
    assert_eq!(parse_semver("invalid"), (0, 0, 0));
    assert_eq!(parse_semver(""), (0, 0, 0));
    assert_eq!(parse_semver("1"), (0, 0, 0));
    assert_eq!(parse_semver("1.2"), (0, 0, 0));
  }
}
