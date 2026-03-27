import { useState, useEffect, type FormEvent } from 'react';
import { loadSettings, searchPapers } from '../services/tauriCommands';
import {
  SEARCH_SUGGESTIONS,
  SEARCH_HISTORY_KEY,
  MAX_HISTORY_ITEMS,
  DEFAULT_MAX_RESULTS,
  normalizeMaxResults,
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
  const [maxResults, setMaxResults] = useState(DEFAULT_MAX_RESULTS);

  useEffect(() => {
    const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch { /* ignore */ }
    }

    loadSettings()
      .then(s => setMaxResults(normalizeMaxResults(s.max_results)))
      .catch(() => setMaxResults(DEFAULT_MAX_RESULTS));
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
      const results = await searchPapers(searchQuery.trim(), maxResults);
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
      <button className="settings-btn" onClick={onOpenSettings} title="设置">
        设置
      </button>

      <div className="search-header">
        <h1 className="search-title">ScholarLens</h1>
        <p className="search-subtitle">为您梳理学术脉络与核心文献</p>
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
            搜索
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

        {error && <div className="error-message">{error}</div>}
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
                <span className="history-query">{h.query}</span>
                <span className="history-count">{h.resultCount} 篇</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-text">正在检索文献，请稍候...</div>
        </div>
      )}
    </div>
  );
}
