import { useState } from 'react';
import SearchPage from './pages/SearchPage';
import ResultsPage from './pages/ResultsPage';
import SettingsPage from './pages/SettingsPage';
import type { PaperSummary } from './types';
import './index.css';

type Page = 'search' | 'results' | 'settings';

// ── 调试模式：浏览器访问 ?page=results 或 ?page=settings 可直接跳转 ──
const debugParams = new URLSearchParams(window.location.search);
const debugPage = debugParams.get('page') as Page | null;

const MOCK_PAPERS: PaperSummary[] = debugPage === 'results' ? [
  { pmid: '00001', title: 'Deep Learning for Medical Image Analysis', journal: 'Nature Medicine', year: '2024', authors: ['Zhang W', 'Li X'], citation_count: 128 },
  { pmid: '00002', title: 'Transformer Models in Genomics', journal: 'Science', year: '2023', authors: ['Chen Y', 'Wang H', 'Liu M'], citation_count: 95 },
  { pmid: '00003', title: 'Single-cell RNA Sequencing Methods', journal: 'Cell', year: '2024', authors: ['Park J'], citation_count: 76 },
  { pmid: '00004', title: 'CRISPR-based Diagnostics for Infectious Diseases', journal: 'The Lancet', year: '2023', authors: ['Kim S', 'Lee D'], citation_count: 54 },
  { pmid: '00005', title: 'Protein Structure Prediction with AlphaFold', journal: 'Nature', year: '2024', authors: ['Brown T', 'Davis R', 'Miller K'], citation_count: 210 },
] : [];

function App() {
  const [currentPage, setCurrentPage] = useState<Page>(debugPage || 'search');
  const [papers, setPapers] = useState<PaperSummary[]>(MOCK_PAPERS);
  const [currentQuery, setCurrentQuery] = useState(debugPage === 'results' ? 'deep learning medical' : '');

  const handleSearchComplete = (
    results: PaperSummary[],
    query: string
  ) => {
    setPapers(results);
    setCurrentQuery(query);
    setCurrentPage('results');
  };

  const handleBackToSearch = () => {
    setCurrentPage('search');
  };

  const handleOpenSettings = () => {
    setCurrentPage('settings');
  };

  const handleCloseSettings = () => {
    setCurrentPage(papers.length > 0 ? 'results' : 'search');
  };

  return (
    <div className="app-container">
      {currentPage === 'search' && (
        <SearchPage
          onSearchComplete={handleSearchComplete}
          onOpenSettings={handleOpenSettings}
        />
      )}
      {currentPage === 'results' && (
        <ResultsPage
          papers={papers}
          query={currentQuery}
          onBack={handleBackToSearch}
          onOpenSettings={handleOpenSettings}
          onNewSearch={handleSearchComplete}
        />
      )}
      {currentPage === 'settings' && (
        <SettingsPage onClose={handleCloseSettings} />
      )}
    </div>
  );
}

export default App;
