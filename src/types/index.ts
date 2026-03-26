/// 论文摘要（列表展示）
export interface PaperSummary {
  pmid: string;
  title: string;
  journal: string;
  year: string;
  authors: string[];
  citation_count: number;
}

/// 核心论文（带排名）
export interface CorePaper {
  pmid: string;
  title: string;
  journal: string;
  year: string;
  citation_score: number;
  degree_centrality: number;
  rank: number;
}

/// 网络节点
export interface NetworkNode {
  id: string;
  label: string;
  title: string;
  value: number;
  color: string;
  is_core: boolean;
}

/// 网络边
export interface NetworkEdge {
  from: string;
  to: string;
}

/// 网络数据
export interface NetworkData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

/// LLM 配置
export interface LlmConfig {
  base_url: string;
  api_key: string;
  model: string;
}

/// 应用设置
export interface AppSettings {
  llm: LlmConfig;
  max_results: number;
}

/// 搜索历史条目
export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  resultCount: number;
}
