import { useState, useEffect } from 'react';
import { getCorePapers } from '../services/tauriCommands';
import type { CorePaper } from '../types';
import { PUBMED_BASE_URL } from '../config/constants';
import '../styles/TopPapers.css';

export default function TopPapers() {
  const [papers, setPapers] = useState<CorePaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getCorePapers()
      .then(setPapers)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="empty-state">
        <div className="loading-spinner" style={{ margin: '0 auto 1rem' }} />
        正在分析核心论文...
      </div>
    );
  }

  if (error) {
    return <div className="empty-state">❌ {error}</div>;
  }

  if (papers.length === 0) {
    return <div className="empty-state">未找到核心论文</div>;
  }

  const topPapers = papers.slice(0, 10);

  return (
    <div className="top-papers">
      <div className="top-papers-title">Top 10 核心论文</div>
      {topPapers.map((paper, i) => (
        <div
          key={paper.pmid}
          className="top-paper-card"
          style={{ animationDelay: `${i * 0.06}s` }}
        >
          <div className={`rank-badge ${paper.rank <= 3 ? 'top3' : 'normal'}`}>
            {paper.rank}
          </div>
          <div className="top-paper-info">
            <div className="top-paper-title">{paper.title}</div>
            <div className="top-paper-meta">
              <span className="top-paper-journal">{paper.journal}</span>
              <span className="top-paper-year">{paper.year}</span>
            </div>
            <div className="top-paper-scores">
              <span className="score-tag">
                Score: {paper.citation_score.toFixed(1)}
              </span>
              <span className="score-tag">
                Centrality: {paper.degree_centrality.toFixed(3)}
              </span>
            </div>
            <a
              href={`${PUBMED_BASE_URL}/${paper.pmid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="top-paper-pubmed-link"
            >
              📖 在 PubMed 中打开 ↗
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
