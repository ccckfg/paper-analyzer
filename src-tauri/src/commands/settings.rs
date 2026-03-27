use crate::models::config::AppSettings;

const DEFAULT_MAX_RESULTS: u32 = 50;
const MIN_MAX_RESULTS: u32 = 10;
const MAX_MAX_RESULTS: u32 = 200;

fn normalize_max_results(value: u32) -> u32 {
    if value == 0 {
        DEFAULT_MAX_RESULTS
    } else {
        value.clamp(MIN_MAX_RESULTS, MAX_MAX_RESULTS)
    }
}

/// 保存设置到本地文件
#[tauri::command]
pub async fn save_settings(app: tauri::AppHandle, mut settings: AppSettings) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;
    settings.max_results = normalize_max_results(settings.max_results);
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    store.set(
        "app_settings",
        serde_json::to_value(&settings).map_err(|e| e.to_string())?,
    );
    // 兼容历史 key
    store.set(
        "settings",
        serde_json::to_value(&settings).map_err(|e| e.to_string())?,
    );
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// 读取设置
#[tauri::command]
pub async fn load_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    use tauri_plugin_store::StoreExt;
    let store = app.store("settings.json").map_err(|e| e.to_string())?;
    let val = store.get("app_settings").or_else(|| store.get("settings"));
    match val {
        Some(v) => {
            let mut settings: AppSettings = serde_json::from_value(v.clone()).unwrap_or_default();
            settings.max_results = normalize_max_results(settings.max_results);
            Ok(settings)
        }
        None => Ok(AppSettings::default()),
    }
}
