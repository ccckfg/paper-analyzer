use serde::{Deserialize, Serialize};

/// LLM API 配置（OpenAI 兼容格式）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LlmConfig {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

/// 应用设置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    pub llm: LlmConfig,
    pub max_results: u32,
}
