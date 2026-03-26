import { useState, type FormEvent } from 'react';
import PaperList from '../components/PaperList';
import NetworkGraph from '../components/NetworkGraph';
import TopPapers from '../components/TopPapers';
import AiReport from '../components/AiReport';
import { searchPapers } from '../services/tauriCommands';
import { RESULT_TABS, DEFAULT_MAX_RESULTS, type TabKey } from '../config/constants';
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

  const handleNewSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim() || loading) return;
    setLoading(true);
    try {
      const results = await searchPapers(searchInput.trim(), DEFAULT_MAX_RESULTS);
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
          ← 
        </button>
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
            {loading ? '⏳' : '🔍'} 搜索
          </button>
        </form>
        <div className="header-actions">
          <button className="header-settings-btn" onClick={onOpenSettings}>
            ⚙️
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
          「{query}」共找到 {papers.length} 篇文献
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
          <div className="loading-text">正在搜索...</div>
        </div>
      )}
    </div>
  );
}
