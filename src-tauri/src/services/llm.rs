use crate::models::config::LlmConfig;
use futures_util::StreamExt;
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f64,
    max_tokens: u32,
    stream: bool,
}

#[derive(Serialize, Clone)]
struct ChatMessage {
    role: String,
    content: String,
}

/// 调用 OpenAI 兼容 API 生成分析报告
pub async fn generate_report(
    config: &LlmConfig,
    papers_summary: &str,
    core_papers: &str,
) -> Result<String, String> {
    if config.base_url.is_empty() || config.api_key.is_empty() || config.model.is_empty() {
        return Err("LLM API not configured. Please configure in Settings.".to_string());
    }

    let prompt = format!(
        r#"你是一位科研文献分析专家。请基于以下数据生成一份结构化分析报告（Markdown 格式）：

## 论文数据摘要
{}

## 核心论文 Top 10
{}

请按以下结构输出报告：
1. **领域概述** - 该研究领域的背景与发展趋势
2. **核心论文分析** - 逐一分析排名前 5 的核心论文，说明其重要性
3. **研究热点与趋势** - 基于论文数据识别主要研究方向
4. **领域结构总结** - 引用网络的结构特征
5. **建议与展望** - 未来研究方向建议

请用中文输出，格式清晰。"#,
        papers_summary, core_papers
    );

    let request = ChatRequest {
        model: config.model.clone(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: prompt,
        }],
        temperature: 0.7,
        max_tokens: 4096,
        stream: false,
    };

    let body = send_chat_completion(config, &request).await?;

    extract_llm_text(&body).map_err(|e| {
        format!(
            "Failed to parse LLM response: {}. Response preview: {}",
            e,
            truncate_text(&body, 600)
        )
    })
}

/// 测试 LLM API 连接
pub async fn test_connection(config: &LlmConfig) -> Result<String, String> {
    if config.base_url.is_empty() || config.api_key.is_empty() || config.model.is_empty() {
        return Err("Please fill in all LLM API fields.".to_string());
    }

    let request = ChatRequest {
        model: config.model.clone(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: "Hello, respond with just 'OK'.".to_string(),
        }],
        temperature: 0.0,
        max_tokens: 10,
        stream: false,
    };

    let body = send_chat_completion(config, &request).await?;
    extract_llm_text(&body)
        .map(|_| "Connection successful!".to_string())
        .map_err(|e| {
            format!(
                "Connection succeeded but response format is unsupported: {}",
                e
            )
        })
}

async fn send_chat_completion(config: &LlmConfig, request: &ChatRequest) -> Result<String, String> {
    let urls = build_chat_completion_urls(&config.base_url);
    if urls.is_empty() {
        return Err("Base URL is empty or invalid.".to_string());
    }

    let client = reqwest::Client::new();
    let mut attempts = Vec::new();

    for url in urls {
        let resp = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", config.api_key))
            .header("Content-Type", "application/json")
            .json(request)
            .send()
            .await
            .map_err(|e| format!("Request failed for {}: {}", url, e));

        let resp = match resp {
            Ok(resp) => resp,
            Err(err) => {
                attempts.push(err);
                continue;
            }
        };

        let status = resp.status();
        let body = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read response body from {}: {}", url, e));

        let body = match body {
            Ok(body) => body,
            Err(err) => {
                attempts.push(err);
                continue;
            }
        };

        if !status.is_success() {
            let error_msg =
                extract_api_error_message(&body).unwrap_or_else(|| truncate_text(&body, 300));
            attempts.push(format!("{} -> HTTP {}: {}", url, status, error_msg));
            continue;
        }

        if looks_like_html(&body) {
            attempts.push(format!("{} -> returned HTML page, not JSON", url));
            continue;
        }

        return Ok(body);
    }

    let hint = base_url_hint(&config.base_url);
    if attempts.is_empty() {
        Err(format!("LLM request failed. {}", hint))
    } else {
        Err(format!(
            "LLM request failed. {} Attempts: {}",
            hint,
            attempts.join(" | ")
        ))
    }
}

pub async fn generate_report_stream<F>(
    config: &LlmConfig,
    papers_summary: &str,
    core_papers: &str,
    mut on_chunk: F,
) -> Result<String, String>
where
    F: FnMut(&str) -> Result<(), String>,
{
    if config.base_url.is_empty() || config.api_key.is_empty() || config.model.is_empty() {
        return Err("LLM API not configured. Please configure in Settings.".to_string());
    }

    let prompt = format!(
        r#"你是一位科研文献分析专家。请基于以下数据生成一份结构化分析报告（Markdown 格式）：

## 论文数据摘要
{}

## 核心论文 Top 10
{}

请按以下结构输出报告：
1. **领域概述** - 该研究领域的背景与发展趋势
2. **核心论文分析** - 逐一分析排名前 5 的核心论文，说明其重要性
3. **研究热点与趋势** - 基于论文数据识别主要研究方向
4. **领域结构总结** - 引用网络的结构特征
5. **建议与展望** - 未来研究方向建议

请用中文输出，格式清晰。"#,
        papers_summary, core_papers
    );

    let request = ChatRequest {
        model: config.model.clone(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: prompt,
        }],
        temperature: 0.7,
        max_tokens: 4096,
        stream: true,
    };

    send_chat_completion_stream(config, &request, &mut on_chunk).await
}

async fn send_chat_completion_stream<F>(
    config: &LlmConfig,
    request: &ChatRequest,
    on_chunk: &mut F,
) -> Result<String, String>
where
    F: FnMut(&str) -> Result<(), String>,
{
    let urls = build_chat_completion_urls(&config.base_url);
    if urls.is_empty() {
        return Err("Base URL is empty or invalid.".to_string());
    }

    let client = reqwest::Client::new();
    let mut attempts = Vec::new();

    for url in urls {
        let resp = client
            .post(&url)
            .header("Authorization", format!("Bearer {}", config.api_key))
            .header("Content-Type", "application/json")
            .json(request)
            .send()
            .await
            .map_err(|e| format!("Request failed for {}: {}", url, e));

        let resp = match resp {
            Ok(resp) => resp,
            Err(err) => {
                attempts.push(err);
                continue;
            }
        };

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            let error_msg =
                extract_api_error_message(&body).unwrap_or_else(|| truncate_text(&body, 300));
            attempts.push(format!("{} -> HTTP {}: {}", url, status, error_msg));
            continue;
        }

        let content_type = resp
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_ascii_lowercase();

        if content_type.contains("text/event-stream") {
            match consume_sse_stream(resp, on_chunk).await {
                Ok(text) => return Ok(text),
                Err(err) => {
                    attempts.push(format!("{} -> {}", url, err));
                    continue;
                }
            }
        }

        // 非 SSE：回退到普通 JSON 响应（部分兼容网关会忽略 stream=true）
        let body = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read response body from {}: {}", url, e));
        let body = match body {
            Ok(body) => body,
            Err(err) => {
                attempts.push(err);
                continue;
            }
        };

        if looks_like_html(&body) {
            attempts.push(format!("{} -> returned HTML page, not JSON", url));
            continue;
        }

        match extract_llm_text(&body) {
            Ok(text) => {
                on_chunk(&text)?;
                return Ok(text);
            }
            Err(err) => {
                attempts.push(format!("{} -> {}", url, err));
                continue;
            }
        }
    }

    let hint = base_url_hint(&config.base_url);
    if attempts.is_empty() {
        Err(format!("LLM request failed. {}", hint))
    } else {
        Err(format!(
            "LLM request failed. {} Attempts: {}",
            hint,
            attempts.join(" | ")
        ))
    }
}

fn build_chat_completion_urls(base_url: &str) -> Vec<String> {
    let base = base_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Vec::new();
    }
    if base.ends_with("/chat/completions") {
        return vec![base.to_string()];
    }

    let mut urls = vec![format!("{}/chat/completions", base)];
    if !base.ends_with("/v1") && !base.contains("/v1/") {
        urls.push(format!("{}/v1/chat/completions", base));
    }
    urls
}

fn base_url_hint(base_url: &str) -> String {
    let clean = base_url.trim().trim_end_matches('/');
    format!(
        "Please make sure Base URL points to an OpenAI-compatible API root (usually ends with `/v1`), e.g. `{}/v1`.",
        clean
    )
}

fn extract_llm_text(raw: &str) -> Result<String, String> {
    if looks_like_html(raw) {
        return Err(
            "server returned HTML page instead of JSON; Base URL is likely a website homepage, not an API endpoint"
                .to_string(),
        );
    }

    let json: Value =
        serde_json::from_str(raw).map_err(|e| format!("response is not valid JSON: {}", e))?;

    if let Some(message) = extract_error_from_json(&json) {
        return Err(message);
    }

    if let Some(text) = extract_text_from_choices(&json) {
        return Ok(text);
    }

    if let Some(text) = extract_text_from_responses_api(&json) {
        return Ok(text);
    }

    Err("no readable assistant content found".to_string())
}

async fn consume_sse_stream<F>(resp: reqwest::Response, on_chunk: &mut F) -> Result<String, String>
where
    F: FnMut(&str) -> Result<(), String>,
{
    let mut stream = resp.bytes_stream();
    let mut pending = String::new();
    let mut full_text = String::new();

    while let Some(next) = stream.next().await {
        let bytes = next.map_err(|e| format!("failed reading stream chunk: {}", e))?;
        pending.push_str(&String::from_utf8_lossy(&bytes));

        while let Some(pos) = pending.find('\n') {
            let line = pending[..pos].trim_end_matches('\r').to_string();
            pending = pending[pos + 1..].to_string();
            handle_sse_line(&line, on_chunk, &mut full_text)?;
        }
    }

    if !pending.trim().is_empty() {
        handle_sse_line(pending.trim(), on_chunk, &mut full_text)?;
    }

    if full_text.trim().is_empty() {
        Err("stream ended without usable content".to_string())
    } else {
        Ok(full_text)
    }
}

fn handle_sse_line<F>(line: &str, on_chunk: &mut F, full_text: &mut String) -> Result<(), String>
where
    F: FnMut(&str) -> Result<(), String>,
{
    let line = line.trim();
    if line.is_empty() || line.starts_with(':') || !line.starts_with("data:") {
        return Ok(());
    }

    let data = line.trim_start_matches("data:").trim();
    if data.eq_ignore_ascii_case("[done]") {
        return Ok(());
    }

    if let Some(delta) = extract_stream_delta(data)? {
        if !delta.is_empty() {
            full_text.push_str(&delta);
            on_chunk(&delta)?;
        }
    }

    Ok(())
}

fn extract_stream_delta(raw_json: &str) -> Result<Option<String>, String> {
    let json: Value =
        serde_json::from_str(raw_json).map_err(|e| format!("invalid JSON chunk: {}", e))?;

    if let Some(message) = extract_error_from_json(&json) {
        return Err(message);
    }

    if let Some(choice) = json
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())
    {
        let candidates = [
            choice.pointer("/delta/content"),
            choice.pointer("/message/content"),
            choice.get("text"),
        ];
        for candidate in candidates.into_iter().flatten() {
            if let Some(text) = value_to_text(candidate) {
                return Ok(Some(text));
            }
        }
    }

    if let Some(text) = extract_text_from_responses_api(&json) {
        return Ok(Some(text));
    }

    Ok(None)
}

fn extract_error_from_json(json: &Value) -> Option<String> {
    let error = json.get("error")?;
    if let Some(msg) = error.get("message").and_then(Value::as_str) {
        return Some(msg.to_string());
    }
    Some(error.to_string())
}

fn extract_text_from_choices(json: &Value) -> Option<String> {
    let choice = json
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|choices| choices.first())?;

    let candidates = [
        choice.pointer("/message/content"),
        choice.pointer("/message/reasoning_content"),
        choice.pointer("/delta/content"),
        choice.get("text"),
    ];

    for candidate in candidates.into_iter().flatten() {
        if let Some(text) = value_to_text(candidate) {
            return Some(text);
        }
    }

    None
}

fn extract_text_from_responses_api(json: &Value) -> Option<String> {
    // 兼容部分服务返回的 Responses API 风格：
    // { "output": [ { "content": [ { "type": "output_text", "text": "..." } ] } ] }
    let output = json.get("output")?.as_array()?;
    let mut parts = Vec::new();

    for item in output {
        if let Some(content) = item.get("content").and_then(Value::as_array) {
            for block in content {
                if let Some(text) = block.get("text").and_then(value_to_text) {
                    parts.push(text);
                }
            }
        }
    }

    let combined = parts.join("\n").trim().to_string();
    if combined.is_empty() {
        None
    } else {
        Some(combined)
    }
}

fn value_to_text(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => {
            let text = s.trim().to_string();
            if text.is_empty() {
                None
            } else {
                Some(text)
            }
        }
        Value::Array(arr) => {
            let mut parts = Vec::new();
            for item in arr {
                if let Some(text) = value_to_text(item) {
                    parts.push(text);
                }
            }
            let combined = parts.join("\n").trim().to_string();
            if combined.is_empty() {
                None
            } else {
                Some(combined)
            }
        }
        Value::Object(map) => {
            let keys = ["text", "content", "value"];
            for key in keys {
                if let Some(inner) = map.get(key).and_then(value_to_text) {
                    return Some(inner);
                }
            }
            None
        }
        _ => None,
    }
}

fn extract_api_error_message(raw: &str) -> Option<String> {
    let json: Value = serde_json::from_str(raw).ok()?;
    extract_error_from_json(&json)
}

fn truncate_text(text: &str, max_chars: usize) -> String {
    let truncated: String = text.chars().take(max_chars).collect();
    if text.chars().count() > max_chars {
        format!("{}...", truncated)
    } else {
        truncated
    }
}

fn looks_like_html(text: &str) -> bool {
    let trimmed = text.trim_start().to_ascii_lowercase();
    trimmed.starts_with("<!doctype html")
        || trimmed.starts_with("<html")
        || trimmed.starts_with("<head")
}
