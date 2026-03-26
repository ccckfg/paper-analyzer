use crate::models::paper::Paper;
use serde::Deserialize;
use std::collections::HashMap;

const ICITE_API_URL: &str = "https://icite.od.nih.gov/api/pubs";

/// 单批最大 PMID 数量（避免 URL 过长）
const BATCH_SIZE: usize = 100;

/// iCite API 返回的单篇论文数据
#[derive(Debug, Deserialize)]
struct ICiteEntry {
    pmid: u64,
    citation_count: Option<u32>,
    cited_by_clin: Option<Vec<u64>>,
    cited_by: Option<Vec<u64>>,
}

/// iCite API 批量响应
#[derive(Debug, Deserialize)]
struct ICiteResponse {
    data: Vec<ICiteEntry>,
}

/// 使用 iCite API 批量获取引用数据，填充每篇论文的 citation_count 和 references
pub async fn fetch_citations(papers: &mut Vec<Paper>) -> Result<(), String> {
    if papers.is_empty() {
        return Ok(());
    }

    let client = reqwest::Client::new();
    let pmids: Vec<String> = papers.iter().map(|p| p.pmid.clone()).collect();

    // 收集所有批次结果
    let mut citation_map: HashMap<String, (u32, Vec<String>)> = HashMap::new();

    for chunk in pmids.chunks(BATCH_SIZE) {
        let id_list = chunk.join(",");

        let resp = client
            .get(ICITE_API_URL)
            .query(&[("pmids", &id_list), ("format", &"json".to_string())])
            .send()
            .await
            .map_err(|e| format!("iCite request failed: {}", e))?;

        let body = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read iCite response: {}", e))?;

        let parsed: ICiteResponse = serde_json::from_str(&body)
            .map_err(|e| format!("iCite JSON parse error: {}", e))?;

        for entry in parsed.data {
            let pmid_str = entry.pmid.to_string();
            let count = entry.citation_count.unwrap_or(0);

            // cited_by 优先使用，fallback 到 cited_by_clin
            let cited_by = entry
                .cited_by
                .or(entry.cited_by_clin)
                .unwrap_or_default()
                .into_iter()
                .map(|id| id.to_string())
                .collect::<Vec<_>>();

            citation_map.insert(pmid_str, (count, cited_by));
        }

        // 批次间短暂延迟，避免 rate limit
        if pmids.len() > BATCH_SIZE {
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        }
    }

    // 将查询结果写回论文数据
    for paper in papers.iter_mut() {
        if let Some((count, cited_by)) = citation_map.get(&paper.pmid) {
            paper.citation_count = *count;
            paper.references = cited_by.clone();
        }
    }

    Ok(())
}
