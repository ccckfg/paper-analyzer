use crate::models::paper::{Paper, PaperSummary};
use crate::services::{citation, pubmed};
use std::sync::Mutex;
use tauri::State;

/// 全局论文缓存，搜索结果在后续操作中共享
pub struct PaperCache(pub Mutex<Vec<Paper>>);

/// 搜索 PubMed 文献
#[tauri::command]
pub async fn search_papers(
    query: String,
    max_results: u32,
    cache: State<'_, PaperCache>,
) -> Result<Vec<PaperSummary>, String> {
    let max = if max_results == 0 { 50 } else { max_results };

    // 1. 搜索 PMID
    let pmids = pubmed::search_pmids(&query, max).await?;
    if pmids.is_empty() {
        return Ok(Vec::new());
    }

    // 2. 获取论文详情
    let mut papers = pubmed::fetch_papers(&pmids).await?;

    // 3. 获取引用关系
    let _ = citation::fetch_citations(&mut papers).await;

    // 4. 缓存到全局
    let summaries = pubmed::to_summaries(&papers);
    let mut cache_lock = cache.0.lock().map_err(|e| e.to_string())?;
    *cache_lock = papers;

    Ok(summaries)
}

/// 获取缓存的论文数量
#[tauri::command]
pub fn get_paper_count(cache: State<'_, PaperCache>) -> Result<usize, String> {
    let lock = cache.0.lock().map_err(|e| e.to_string())?;
    Ok(lock.len())
}
