extern crate napi_build;

fn main() {
  napi_build::setup();

  let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
  let lock_path = std::path::Path::new(&manifest_dir).join("Cargo.lock");
  if let Ok(contents) = std::fs::read_to_string(&lock_path) {
    let lines: Vec<&str> = contents.lines().collect();
    for (i, line) in lines.iter().enumerate() {
      let trimmed = line.trim();
      if trimmed.starts_with("name = \"wry\"") {
        if let Some(next_line) = lines.get(i + 1) {
          if let Some(version_str) = next_line
            .trim()
            .strip_prefix("version = \"")
            .and_then(|s| s.strip_suffix('"'))
          {
            println!("cargo:rustc-env=WRY_VERSION={}", version_str);
          }
        }
        break;
      }
    }
    for (i, line) in lines.iter().enumerate() {
      let trimmed = line.trim();
      if trimmed.starts_with("name = \"tao\"") {
        if let Some(next_line) = lines.get(i + 1) {
          if let Some(version_str) = next_line
            .trim()
            .strip_prefix("version = \"")
            .and_then(|s| s.strip_suffix('"'))
          {
            println!("cargo:rustc-env=CARGO_PKG_TAO_VERSION={}", version_str);
          }
        }
        break;
      }
    }
  }
}
