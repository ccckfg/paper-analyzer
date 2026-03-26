import { useState, useEffect, type FormEvent } from 'react';
import { searchPapers } from '../services/tauriCommands';
import {
  SEARCH_SUGGESTIONS,
  SEARCH_HISTORY_KEY,
  MAX_HISTORY_ITEMS,
  DEFAULT_MAX_RESULTS,
} from '../config/constants';
import type { PaperSummary, SearchHistoryItem } from '../types';
import '../styles/SearchPage.css';

interface Props {
  onSearchComplete: (papers: PaperSummary[], query: string) => void;
  onOpenSettings: () => void;
}

export default function SearchPage({ onSearchComplete, onOpenSettings }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  const saveHistory = (item: SearchHistoryItem) => {
    const updated = [item, ...history.filter(h => h.query !== item.query)]
      .slice(0, MAX_HISTORY_ITEMS);
    setHistory(updated);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  };

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');

    try {
      const results = await searchPapers(searchQuery.trim(), DEFAULT_MAX_RESULTS);
      saveHistory({
        query: searchQuery.trim(),
        timestamp: Date.now(),
        resultCount: results.length,
      });
      onSearchComplete(results, searchQuery.trim());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  return (
    <div className="search-page">
      <button className="settings-btn" onClick={onOpenSettings} title="Settings">
        ⚙️
      </button>

      <div className="search-header">
        <div className="search-logo">🔬</div>
        <h1 className="search-title">ScholarLens</h1>
        <p className="search-subtitle">智能科研文献分析 · 引用网络 · 核心论文发现</p>
      </div>

      <div className="search-box-wrapper">
        <form className="search-box" onSubmit={onSubmit}>
          <input
            className="search-input"
            type="text"
            placeholder="输入研究主题，例如 genomic selection..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <button className="search-btn" type="submit" disabled={loading || !query.trim()}>
            🔍 搜索
          </button>
        </form>

        <div className="search-suggestions">
          {SEARCH_SUGGESTIONS.map(s => (
            <button key={s} className="suggestion-chip" onClick={() => {
              setQuery(s);
              handleSearch(s);
            }}>
              {s}
            </button>
          ))}
        </div>

        {error && <div className="error-message">❌ {error}</div>}
      </div>

      {history.length > 0 && (
        <div className="search-history">
          <div className="history-title">最近搜索</div>
          <div className="history-items">
            {history.slice(0, 5).map(h => (
              <button
                key={h.query}
                className="history-item"
                onClick={() => { setQuery(h.query); handleSearch(h.query); }}
              >
                <span>🕐 {h.query}</span>
                <span className="history-count">{h.resultCount} 篇</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-text">正在搜索 PubMed 文献...</div>
        </div>
      )}
    </div>
  );
}
