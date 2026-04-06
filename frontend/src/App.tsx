import { useState, useEffect } from 'react';
import './index.css';
import { LoadFile, SearchLogs, GetStats } from '../wailsjs/go/main/App';
import { main, store } from '../wailsjs/go/models';
import FileDropZone from './components/FileDropZone';
import FilterBar from './components/FilterBar';
import StatsBadge from './components/StatsBadge';
import LogList from './components/LogList';
import SettingsPanel from './components/SettingsPanel';

const LOG_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];
const DEFAULT_PAGE_SIZE = 100;

type Theme = 'dark' | 'darker' | 'midnight';

function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [stats, setStats] = useState<main.Stats | null>(null);
  const [entries, setEntries] = useState<store.LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [selectedLevels, setSelectedLevels] = useState<string[]>(LOG_LEVELS);
  const [keyword, setKeyword] = useState('');
  const [classNameFilter, setClassNameFilter] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Settings
  const [theme, setTheme] = useState<Theme>('dark');
  const [fontSize, setFontSize] = useState(14); // px
  const [showSettings, setShowSettings] = useState(false);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    const themes: Record<Theme, { bg: string; header: string; text: string; border: string }> = {
      dark: { bg: '#1a1a2e', header: '#16213e', text: '#e5e7eb', border: '#0f3460' },
      darker: { bg: '#0d0d1a', header: '#0a0a12', text: '#d1d5db', border: '#1a1a2e' },
      midnight: { bg: '#0f172a', header: '#1e293b', text: '#f1f5f9', border: '#334155' },
    };
    const current = themes[theme];
    root.style.setProperty('--color-bg-main', current.bg);
    root.style.setProperty('--color-bg-header', current.header);
    root.style.setProperty('--color-border', current.border);
  }, [theme]);

  // Apply font size
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  const handleFileLoad = async (filePath: string) => {
    console.log('[App] handleFileLoad called with:', filePath);
    setIsLoading(true);
    setErrorMessage('');

    try {
      console.log('[App] Calling LoadFile...');
      const result = await LoadFile(filePath);
      console.log('[App] LoadFile result:', result);
      if (result.success) {
        if (result.count === 0) {
          setErrorMessage('No valid log entries found. The file format may not match expected pattern.');
          setIsLoading(false);
          return;
        }
        console.log('[App] LoadFile successful, count:', result.count);
        // Load stats first
        const statsResult = await GetStats();
        console.log('[App] Stats result:', statsResult);
        setStats(statsResult);
        // Then search before setting isLoaded
        await handleSearch();
        console.log('[App] Search completed, entries:', entries.length);
        setIsLoaded(true);
      } else {
        setErrorMessage(result.message);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[App] File load error:', error);
      setErrorMessage(String(error));
      setIsLoading(false);
    }
  };

  const handleSearch = async (searchPage: number = 1) => {
    setIsLoading(true);
    setPage(searchPage);

    try {
      const query: main.SearchQuery = {
        keyword,
        level: selectedLevels.length === LOG_LEVELS.length ? '' : selectedLevels.join(','),
        class: classNameFilter,
        startTime,
        endTime,
        page: searchPage,
        pageSize: DEFAULT_PAGE_SIZE,
      };

      const result = await SearchLogs(query);
      setEntries(result.entries || []);
      setTotal(result.total || 0);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLevelToggle = (level: string) => {
    setSelectedLevels((prev) => {
      const newLevels = prev.includes(level)
        ? prev.filter((l) => l !== level)
        : [...prev, level];
      return newLevels.length === 0 ? [level] : newLevels; // At least one level
    });
  };

  const handlePageChange = (newPage: number) => {
    handleSearch(newPage);
  };

  return (
    <div className="h-screen flex flex-col bg-bg-main text-gray-200 font-sans">
      {!isLoaded ? (
        <FileDropZone onFileLoad={handleFileLoad} isLoading={isLoading} errorMessage={errorMessage} />
      ) : (
        <>
          <div className="bg-bg-header px-4 py-2 border-b border-border flex justify-between items-center">
            <div className="flex gap-2">
              {stats && <StatsBadge stats={stats} />}
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-3 py-1 text-sm bg-border rounded hover:bg-primary transition-colors"
            >
              ⚙️ Settings
            </button>
          </div>

          {showSettings && (
            <SettingsPanel
              theme={theme}
              onThemeChange={setTheme}
              fontSize={fontSize}
              onFontSizeChange={setFontSize}
              onClose={() => setShowSettings(false)}
            />
          )}

          <FilterBar
            levels={LOG_LEVELS}
            selectedLevels={selectedLevels}
            onLevelToggle={handleLevelToggle}
            keyword={keyword}
            onKeywordChange={setKeyword}
            className={classNameFilter}
            onClassNameChange={setClassNameFilter}
            startTime={startTime}
            onStartTimeChange={setStartTime}
            endTime={endTime}
            onEndTimeChange={setEndTime}
            onSearch={() => handleSearch(1)}
          />

          <LogList
            entries={entries}
            total={total}
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            onPageChange={handlePageChange}
            isLoading={isLoading}
          />
        </>
      )}
    </div>
  );
}

export default App;
