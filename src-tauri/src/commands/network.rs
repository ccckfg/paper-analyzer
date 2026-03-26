use crate::commands::search::PaperCache;
use crate::models::network::NetworkData;
use crate::services::graph;
use tauri::State;

/// 构建引用网络数据
#[tauri::command]
pub fn build_network(cache: State<'_, PaperCache>) -> Result<NetworkData, String> {
    let lock = cache.0.lock().map_err(|e| e.to_string())?;
    if lock.is_empty() {
        return Err("No papers loaded. Please search first.".to_string());
    }
    Ok(graph::build_network(&lock))
}
