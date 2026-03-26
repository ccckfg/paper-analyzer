/// 应用常量配置

export const APP_NAME = 'ScholarLens';

export const DEFAULT_MAX_RESULTS = 200;

export const PUBMED_BASE_URL = 'https://pubmed.ncbi.nlm.nih.gov';

/// 搜索建议
export const SEARCH_SUGGESTIONS = [
  'genomic selection',
  'AI breeding',
  'self-incompatibility plant',
  'CRISPR crop improvement',
  'machine learning phenotype prediction',
];

/// Tab 标签
export const RESULT_TABS = [
  { key: 'papers', label: '📋 论文列表', icon: '📋' },
  { key: 'network', label: '🕸️ 引用网络', icon: '🕸️' },
  { key: 'core', label: '🏆 核心论文', icon: '🏆' },
  { key: 'report', label: '📄 AI 报告', icon: '📄' },
] as const;

export type TabKey = (typeof RESULT_TABS)[number]['key'];

/// 搜索历史 localStorage key
export const SEARCH_HISTORY_KEY = 'scholar_lens_history';
export const MAX_HISTORY_ITEMS = 10;
