//! `webview-host` — the out-of-process UI runtime for webview-napi.
//!
//! Node/Bun owns its libuv loop; this process owns the tao event loop. They
//! talk over newline-delimited JSON on stdio (see `protocol`). Because tao's
//! `EventLoop::run()` never returns and must live on the main thread, giving it
//! a process of its own removes the whole class of "GUI loop vs. JS loop"
//! problems the embedded N-API backend has to work around.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod protocol;
mod state;

use protocol::{log, write_error, write_event, write_result, Request};
use serde_json::json;
use state::HostState;
use std::io::BufRead;
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoopBuilder};

/// Messages the stdin reader thread hands to the event loop.
#[derive(Debug)]
pub enum HostCommand {
  Request(Request),
  /// stdin closed — the parent process is gone, so shut down.
  Shutdown,
}

fn main() {
  let event_loop = EventLoopBuilder::<HostCommand>::with_user_event().build();
  let proxy = event_loop.create_proxy();

  // Reading stdin on a separate thread keeps the GUI loop free; `EventLoopProxy`
  // is `Send` precisely for this.
  std::thread::spawn(move || {
    let stdin = std::io::stdin();
    for line in stdin.lock().lines() {
      let Ok(line) = line else { break };
      let line = line.trim();
      if line.is_empty() {
        continue;
      }
      match serde_json::from_str::<Request>(line) {
        Ok(request) => {
          if proxy.send_event(HostCommand::Request(request)).is_err() {
            break;
          }
        }
        Err(err) => {
          log(format!("dropping unparseable frame: {err}"));
        }
      }
    }
    let _ = proxy.send_event(HostCommand::Shutdown);
  });

  let mut state = HostState::new();
  write_event("app.ready", json!({ "pid": std::process::id() }));

  event_loop.run(move |event, target, control_flow| {
    *control_flow = ControlFlow::Wait;

    match event {
      Event::UserEvent(HostCommand::Request(request)) => {
        let Request { id, method, params } = request;
        match state.dispatch(&method, params, target) {
          Ok(result) => write_result(id, result),
          Err(message) => write_error(id, message),
        }
      }

      Event::UserEvent(HostCommand::Shutdown) => {
        state.request_exit(0);
      }

      Event::WindowEvent {
        event: WindowEvent::CloseRequested,
        window_id,
        ..
      } => {
        if let Some(id) = state.protocol_id(window_id) {
          write_event("window.closeRequested", json!({ "windowId": id }));
          // A close guard leaves the decision to the client, which answers with
          // an explicit `window.close`.
          if !state.close_guard(id) {
            state.destroy_window(id);
          }
        }
      }

      _ => {}
    }

    if state.exit_requested {
      write_event("app.exit", json!({ "code": state.exit_code }));
      *control_flow = if state.exit_code == 0 {
        ControlFlow::Exit
      } else {
        ControlFlow::ExitWithCode(state.exit_code)
      };
    }
  });
}
