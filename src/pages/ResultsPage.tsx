import { useEffect, useState, type FormEvent } from 'react';
import PaperList from '../components/PaperList';
import NetworkGraph from '../components/NetworkGraph';
import TopPapers from '../components/TopPapers';
import AiReport from '../components/AiReport';
import { loadSettings, searchPapers } from '../services/tauriCommands';
import {
  RESULT_TABS,
  DEFAULT_MAX_RESULTS,
  normalizeMaxResults,
  type TabKey,
} from '../config/constants';
import type { PaperSummary } from '../types';
import '../styles/ResultsPage.css';

interface Props {
  papers: PaperSummary[];
  query: string;
  onBack: () => void;
  onOpenSettings: () => void;
  onNewSearch: (papers: PaperSummary[], query: string) => void;
}

export default function ResultsPage({
  papers,
  query,
  onBack,
  onOpenSettings,
  onNewSearch,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('papers');
  const [searchInput, setSearchInput] = useState(query);
  const [loading, setLoading] = useState(false);
  const [maxResults, setMaxResults] = useState(DEFAULT_MAX_RESULTS);

  useEffect(() => {
    loadSettings()
      .then(s => setMaxResults(normalizeMaxResults(s.max_results)))
      .catch(() => setMaxResults(DEFAULT_MAX_RESULTS));
  }, []);

  const handleNewSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim() || loading) return;
    setLoading(true);
    try {
      const results = await searchPapers(searchInput.trim(), maxResults);
      onNewSearch(results, searchInput.trim());
      setActiveTab('papers');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="results-page">
      {/* Header */}
      <div className="results-header">
        <button className="back-btn" onClick={onBack} title="返回首页">
          返回
        </button>
        <div className="mobile-header-title">{query}</div>
        <form className="results-search-box" onSubmit={handleNewSearch}>
          <input
            className="results-search-input"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="搜索新主题..."
          />
          <button
            className="results-search-btn"
            type="submit"
            disabled={loading}
          >
            {loading ? '检索中...' : '搜索'}
          </button>
        </form>
        <div className="header-actions">
          <button className="header-settings-btn" onClick={onOpenSettings}>
            设置
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {RESULT_TABS.map(tab => (
          <button
            key={tab.key}
            className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="results-content">
        <div className="result-count">
          关于 “{query}” 的检索结果 ({papers.length} 篇文献)
        </div>

        <div className="tab-panel">
          {activeTab === 'papers' && <PaperList papers={papers} />}
          {activeTab === 'network' && <NetworkGraph papers={papers} />}
          {activeTab === 'core' && <TopPapers />}
          {activeTab === 'report' && <AiReport />}
        </div>
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-text">正在检索，请稍候...</div>
        </div>
      )}
    </div>
  );
}
