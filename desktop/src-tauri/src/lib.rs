mod commands;

use commands::agent::{
    get_agent_status, get_autostart_status, get_pairing_session, restart_agent, set_autostart,
    start_agent, stop_agent,
};
use commands::files::{get_beamed_files, open_downloads_folder, open_file_in_explorer};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Window,
};

#[tauri::command]
fn window_minimize(window: Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn window_toggle_maximize(window: Window) {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
fn window_close(window: Window) {
    let _ = window.hide();
}

#[tauri::command]
fn window_start_drag(window: Window) {
    let _ = window.start_dragging();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Auto-start Go agent in background on launch if not running
            std::thread::spawn(|| {
                let _ = start_agent();
            });

            // Build system tray menu
            let quit_i = MenuItem::with_id(app, "quit", "Quit Remote Deck", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Control Center", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Remote Deck Control Center")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // Minimize to tray on close
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_agent_status,
            get_autostart_status,
            set_autostart,
            start_agent,
            stop_agent,
            restart_agent,
            get_pairing_session,
            get_beamed_files,
            open_file_in_explorer,
            open_downloads_folder,
            window_minimize,
            window_toggle_maximize,
            window_close,
            window_start_drag,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
