import type { PaperSummary } from '../types';
import PaperCard from './PaperCard';
import '../styles/PaperCard.css';

interface Props {
  papers: PaperSummary[];
}

export default function PaperList({ papers }: Props) {
  if (papers.length === 0) {
    return <div className="empty-state">暂无文献数据</div>;
  }

  return (
    <div className="paper-list">
      {papers.map((paper, i) => (
        <PaperCard key={paper.pmid} paper={paper} index={i} />
      ))}
    </div>
  );
}
