use crate::commands::search::PaperCache;
use crate::models::config::LlmConfig;
use crate::models::paper::CorePaper;
use crate::services::{graph, llm};
use serde::Serialize;
use tauri::{Emitter, State, Window};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AiReportStreamEvent {
    request_id: String,
    status: String,
    chunk: Option<String>,
    error: Option<String>,
}

/// 获取 Top 10 核心论文
#[tauri::command]
pub fn get_core_papers(cache: State<'_, PaperCache>) -> Result<Vec<CorePaper>, String> {
    let lock = cache.0.lock().map_err(|e| e.to_string())?;
    if lock.is_empty() {
        return Err("No papers loaded. Please search first.".to_string());
    }
    Ok(graph::find_core_papers(&lock, 10))
}

/// 生成 AI 分析报告
#[tauri::command]
pub async fn generate_ai_report(
    config: LlmConfig,
    cache: State<'_, PaperCache>,
) -> Result<String, String> {
    // 在 block scope 中使用 lock，确保 MutexGuard 在 await 前释放
    let (papers_summary, core_text) = {
        let lock = cache.0.lock().map_err(|e| e.to_string())?;
        if lock.is_empty() {
            return Err("No papers loaded. Please search first.".to_string());
        }

        let summary = lock
            .iter()
            .take(20)
            .map(|p| {
                format!(
                    "- [{}] {} | {} | {} | Cited: {}",
                    p.pmid, p.title, p.journal, p.year, p.citation_count
                )
            })
            .collect::<Vec<_>>()
            .join("\n");

        let core = graph::find_core_papers(&lock, 10);
        let ct = core
            .iter()
            .map(|c| {
                format!(
                    "{}. [{}] {} | {} | {} | Score: {:.1} | Centrality: {:.3}",
                    c.rank,
                    c.pmid,
                    c.title,
                    c.journal,
                    c.year,
                    c.citation_score,
                    c.degree_centrality
                )
            })
            .collect::<Vec<_>>()
            .join("\n");

        (summary, ct)
    }; // MutexGuard 在此处释放

    llm::generate_report(&config, &papers_summary, &core_text).await
}

/// 流式生成 AI 分析报告（通过事件推送增量文本）
#[tauri::command]
pub async fn generate_ai_report_stream(
    config: LlmConfig,
    request_id: String,
    window: Window,
    cache: State<'_, PaperCache>,
) -> Result<(), String> {
    let (papers_summary, core_text) = {
        let lock = cache.0.lock().map_err(|e| e.to_string())?;
        if lock.is_empty() {
            return Err("No papers loaded. Please search first.".to_string());
        }

        let summary = lock
            .iter()
            .take(20)
            .map(|p| {
                format!(
                    "- [{}] {} | {} | {} | Cited: {}",
                    p.pmid, p.title, p.journal, p.year, p.citation_count
                )
            })
            .collect::<Vec<_>>()
            .join("\n");

        let core = graph::find_core_papers(&lock, 10);
        let ct = core
            .iter()
            .map(|c| {
                format!(
                    "{}. [{}] {} | {} | {} | Score: {:.1} | Centrality: {:.3}",
                    c.rank,
                    c.pmid,
                    c.title,
                    c.journal,
                    c.year,
                    c.citation_score,
                    c.degree_centrality
                )
            })
            .collect::<Vec<_>>()
            .join("\n");

        (summary, ct)
    };

    let emit_chunk = |chunk: &str| -> Result<(), String> {
        window
            .emit(
                "ai-report-stream",
                AiReportStreamEvent {
                    request_id: request_id.clone(),
                    status: "chunk".to_string(),
                    chunk: Some(chunk.to_string()),
                    error: None,
                },
            )
            .map_err(|e| e.to_string())
    };

    match llm::generate_report_stream(&config, &papers_summary, &core_text, emit_chunk).await {
        Ok(_) => {
            window
                .emit(
                    "ai-report-stream",
                    AiReportStreamEvent {
                        request_id,
                        status: "done".to_string(),
                        chunk: None,
                        error: None,
                    },
                )
                .map_err(|e| e.to_string())?;
            Ok(())
        }
        Err(err) => {
            let _ = window.emit(
                "ai-report-stream",
                AiReportStreamEvent {
                    request_id,
                    status: "error".to_string(),
                    chunk: None,
                    error: Some(err.clone()),
                },
            );
            Err(err)
        }
    }
}

/// 测试 LLM API 连接
#[tauri::command]
pub async fn test_llm_connection(config: LlmConfig) -> Result<String, String> {
    llm::test_connection(&config).await
}
