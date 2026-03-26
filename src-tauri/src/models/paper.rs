use serde::{Deserialize, Serialize};

/// 单篇论文的完整信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Paper {
    pub pmid: String,
    pub title: String,
    pub journal: String,
    pub year: String,
    pub authors: Vec<String>,
    #[serde(rename = "abstract")]
    pub abstract_text: String,
    pub citation_count: u32,
    /// 引用该论文的 PMID 列表（cited-by）
    pub references: Vec<String>,
}

/// 搜索结果摘要（列表展示用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaperSummary {
    pub pmid: String,
    pub title: String,
    pub journal: String,
    pub year: String,
    pub authors: Vec<String>,
    pub citation_count: u32,
}

/// 核心论文（带排名指标）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorePaper {
    pub pmid: String,
    pub title: String,
    pub journal: String,
    pub year: String,
    pub citation_score: f64,
    pub degree_centrality: f64,
    pub rank: u32,
}

/// 自交不亲和植物信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlantInfo {
    pub genus: String,
    pub species: String,
    pub affinity: String,
    pub title: String,
    pub journal: String,
    pub year: String,
}
