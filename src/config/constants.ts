/// 应用常量配置

export const APP_NAME = 'ScholarLens';

export const MIN_MAX_RESULTS = 10;
export const MAX_MAX_RESULTS = 200;
export const DEFAULT_MAX_RESULTS = 50;

export const PUBMED_BASE_URL = 'https://pubmed.ncbi.nlm.nih.gov';

/// 搜索建议
export const SEARCH_SUGGESTIONS = [
  'genomic selection',
  'AI breeding',
  'self-incompatibility plant',
  'CRISPR crop improvement',
  'machine learning phenotype prediction',
];

export const RESULT_TABS = [
  { key: 'papers', label: '文献列表' },
  { key: 'network', label: '引用网络' },
  { key: 'core', label: '核心文献' },
  { key: 'report', label: '研究报告' },
] as const;

export type TabKey = (typeof RESULT_TABS)[number]['key'];

/// 搜索历史 localStorage key
export const SEARCH_HISTORY_KEY = 'scholar_lens_history';
export const MAX_HISTORY_ITEMS = 10;

export function normalizeMaxResults(value?: number): number {
  if (!value || Number.isNaN(value)) return DEFAULT_MAX_RESULTS;
  return Math.min(MAX_MAX_RESULTS, Math.max(MIN_MAX_RESULTS, Math.floor(value)));
}
