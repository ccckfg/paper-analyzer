use serde::{Deserialize, Serialize};

/// LLM API 配置（OpenAI 兼容格式）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct LlmConfig {
    #[serde(alias = "baseUrl")]
    pub base_url: String,
    #[serde(alias = "apiKey")]
    pub api_key: String,
    pub model: String,
}

/// 应用设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppSettings {
    pub llm: LlmConfig,
    #[serde(alias = "maxResults", default = "default_max_results")]
    pub max_results: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            llm: LlmConfig::default(),
            max_results: default_max_results(),
        }
    }
}

fn default_max_results() -> u32 {
    50
}
