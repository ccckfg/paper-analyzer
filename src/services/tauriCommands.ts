import { invoke } from '@tauri-apps/api/core';
import type {
  PaperSummary,
  NetworkData,
  CorePaper,
  LlmConfig,
  AppSettings,
} from '../types';

/// 搜索 PubMed 文献
export async function searchPapers(
  query: string,
  maxResults: number
): Promise<PaperSummary[]> {
  return invoke<PaperSummary[]>('search_papers', {
    query,
    maxResults,
  });
}

/// 获取缓存论文数量
export async function getPaperCount(): Promise<number> {
  return invoke<number>('get_paper_count');
}

/// 构建引用网络
export async function buildNetwork(): Promise<NetworkData> {
  return invoke<NetworkData>('build_network');
}

/// 获取 Top 10 核心论文
export async function getCorePapers(): Promise<CorePaper[]> {
  return invoke<CorePaper[]>('get_core_papers');
}

/// 生成 AI 分析报告
export async function generateAiReport(
  config: LlmConfig
): Promise<string> {
  return invoke<string>('generate_ai_report', { config });
}

/// 流式生成 AI 分析报告（通过事件推送 chunk）
export async function generateAiReportStream(
  config: LlmConfig,
  requestId: string
): Promise<void> {
  return invoke<void>('generate_ai_report_stream', { config, requestId });
}

/// 测试 LLM API 连接
export async function testLlmConnection(
  config: LlmConfig
): Promise<string> {
  return invoke<string>('test_llm_connection', { config });
}

/// 保存设置
export async function saveSettings(
  settings: AppSettings
): Promise<void> {
  return invoke<void>('save_settings', { settings });
}

/// 加载设置
export async function loadSettings(): Promise<AppSettings> {
  return invoke<AppSettings>('load_settings');
}
