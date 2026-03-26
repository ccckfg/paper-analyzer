mod commands;
mod models;
mod services;

use commands::search::PaperCache;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(PaperCache(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            commands::search::search_papers,
            commands::search::get_paper_count,
            commands::network::build_network,
            commands::analysis::get_core_papers,
            commands::analysis::generate_ai_report,
            commands::analysis::generate_ai_report_stream,
            commands::analysis::test_llm_connection,
            commands::settings::save_settings,
            commands::settings::load_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
