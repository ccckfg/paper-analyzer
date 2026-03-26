import { useState } from 'react';
import SearchPage from './pages/SearchPage';
import ResultsPage from './pages/ResultsPage';
import SettingsPage from './pages/SettingsPage';
import type { PaperSummary } from './types';
import './index.css';

type Page = 'search' | 'results' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('search');
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');

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
