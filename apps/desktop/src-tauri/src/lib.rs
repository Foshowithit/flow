mod mcp;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(mcp::McpState::new())
        .invoke_handler(tauri::generate_handler![
            mcp::commands::mcp_availability,
            mcp::commands::mcp_list_servers,
            mcp::commands::mcp_upsert_server,
            mcp::commands::mcp_delete_server,
            mcp::commands::mcp_list_audit,
            mcp::commands::mcp_prepare_tool_call,
            mcp::commands::mcp_resolve_tool_call,
            mcp::commands::mcp_fixture_list_tools,
            mcp::commands::mcp_fixture_status,
            mcp::commands::mcp_fixture_start,
            mcp::commands::mcp_fixture_stop,
            mcp::commands::mcp_fixture_restart,
        ])
        .setup(|app| {
            // Initialise MCP config store and audit store in the app data directory
            if let Ok(app_data) = app.path().app_data_dir() {
                let mcp_dir = app_data.join("mcp");
                let state = app.state::<mcp::McpState>();
                if let Err(e) = state.init_config_store(mcp_dir.clone()) {
                    log::error!("Failed to initialise MCP config store: {}", e);
                }
                if let Err(e) = state.init_audit_store(mcp_dir) {
                    log::error!("Failed to initialise MCP audit store: {}", e);
                }
            } else {
                log::warn!("Could not determine app data directory; MCP data will not persist.");
            }

            #[cfg(not(debug_assertions))]
            if let Some(window) = app.get_webview_window("main") {
                let url = "https://web-sigma-khaki-61.vercel.app/desktop"
                    .parse::<tauri::Url>()
                    .expect("valid url");
                let _ = window.navigate(url);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
