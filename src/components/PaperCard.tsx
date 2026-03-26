import type { PaperSummary } from '../types';
import { PUBMED_BASE_URL } from '../config/constants';

interface Props {
  paper: PaperSummary;
  index: number;
}

export default function PaperCard({ paper, index }: Props) {
  const pubmedUrl = `${PUBMED_BASE_URL}/${paper.pmid}`;

  return (
    <div
      className="paper-card"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="paper-title">{paper.title}</div>
      <div className="paper-meta">
        <span className="paper-journal">{paper.journal}</span>
        <span className="paper-year">{paper.year}</span>
        <span className="paper-pmid">PMID: {paper.pmid}</span>
        {paper.citation_count > 0 && (
          <span className="paper-citations">
            🔥 {paper.citation_count} cited
          </span>
        )}
      </div>
      {paper.authors.length > 0 && (
        <div className="paper-authors">
          {paper.authors.slice(0, 5).join(', ')}
          {paper.authors.length > 5 && ` ... +${paper.authors.length - 5}`}
        </div>
      )}
      <a
        className="paper-link"
        href={pubmedUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        📖 View on PubMed ↗
      </a>
    </div>
  );
}
