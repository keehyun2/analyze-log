import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';
import { LoadFile, SearchLogs, GetStats, GetSettings, SetSettings } from '../wailsjs/go/main/App';
import { main, store } from '../wailsjs/go/models';
import FileDropZone from './components/FileDropZone';
import FilterBar from './components/FilterBar';
import StatsBadge from './components/StatsBadge';
import LogList from './components/LogList';
import SettingsPanel from './components/SettingsPanel';
import ToastContainer, { Toast } from './components/Toast';

const LOG_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];
const DEFAULT_PAGE_SIZE = 100;

type Theme = 'dark' | 'darker' | 'midnight';
type DisplayMode = 'pagination' | 'infinite-scroll';

interface AppSettings {
  lastOpenedFile: string;
  autoLoadLastFile: boolean;
}

function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [stats, setStats] = useState<main.Stats | null>(null);
  const [entries, setEntries] = useState<store.LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [selectedLevels, setSelectedLevels] = useState<string[]>(LOG_LEVELS);
  const [selectedLevelFromBadge, setSelectedLevelFromBadge] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [classNameFilter, setClassNameFilter] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Settings
  const [theme, setTheme] = useState<Theme>('dark');
  const [fontSize, setFontSize] = useState(14); // px
  const [displayMode, setDisplayMode] = useState<DisplayMode>('infinite-scroll');
  const [autoLoadLastFile, setAutoLoadLastFile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdCounter = useRef(0);

  // Refs for keyboard shortcuts
  const keywordInputRef = useRef<HTMLInputElement>(null);

  // Load settings on startup
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await GetSettings();
        setAutoLoadLastFile(settings.autoLoadLastFile);
        if (settings.theme) setTheme(settings.theme as Theme);
        if (settings.fontSize) setFontSize(settings.fontSize);
        if (settings.displayMode) setDisplayMode(settings.displayMode as DisplayMode);

        // Auto-load last file if enabled
        if (settings.autoLoadLastFile && settings.lastOpenedFile) {
          console.log('[App] Auto-loading last file:', settings.lastOpenedFile);
          await handleFileLoad(settings.lastOpenedFile);
        }
      } catch (error) {
        console.error('[App] Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []); // Run once on startup

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

  // Toast functions
  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = toastIdCounter.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Allow Escape to close settings even when typing
        if (e.key === 'Escape' && showSettings) {
          e.preventDefault();
          setShowSettings(false);
        }
        return;
      }

      // Ctrl+O / Cmd+O: Open file
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        if (!isLoaded) return;
        handleOpenFileDialog();
      }

      // Ctrl+F / Cmd+F: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        keywordInputRef.current?.focus();
      }

      // Ctrl+K / Cmd+K: Clear filters
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        clearFilters();
      }

      // Escape: Close settings
      if (e.key === 'Escape' && showSettings) {
        e.preventDefault();
        setShowSettings(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoaded, showSettings, keyword]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSelectedLevels(LOG_LEVELS);
    setKeyword('');
    setClassNameFilter('');
    setStartTime('');
    setEndTime('');
    showToast('Filters cleared', 'info');
  }, [showToast]);

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
          showToast('No valid log entries found', 'error');
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
        showToast(`Loaded ${result.count} log entries`, 'success');
      } else {
        setErrorMessage(result.message);
        showToast(result.message, 'error');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[App] File load error:', error);
      const errorMsg = String(error);
      setErrorMessage(errorMsg);
      showToast(errorMsg, 'error');
      setIsLoading(false);
    }
  };

  const handleOpenFileDialog = async () => {
    try {
      const { OpenFileDialog } = await import('../wailsjs/go/main/App');
      const path = await OpenFileDialog();
      if (path) {
        handleFileLoad(path);
      }
    } catch (error) {
      console.error('[App] Error opening file dialog:', error);
      showToast('Failed to open file dialog', 'error');
    }
  };

  const handleSearch = async (searchPage: number = 1, overrideLevel?: string) => {
    setIsLoading(true);

    try {
      let levelToUse: string;
      if (overrideLevel !== undefined) {
        // overrideLevel is explicitly provided (even if empty string)
        levelToUse = overrideLevel;
      } else {
        // Use selectedLevels state
        levelToUse = selectedLevels.length === LOG_LEVELS.length ? '' : selectedLevels.join(',');
      }

      const query: main.SearchQuery = {
        keyword,
        level: levelToUse,
        class: classNameFilter,
        startTime,
        endTime,
        page: searchPage,
        pageSize: DEFAULT_PAGE_SIZE,
      };

      const result = await SearchLogs(query);

      if (displayMode === 'pagination') {
        // Pagination mode: always replace entries
        setEntries(result.entries || []);
        setCurrentPage(searchPage);
      } else {
        // Infinite scroll mode: append for additional pages
        if (searchPage === 1) {
          setEntries(result.entries || []);
          setCurrentPage(1);
        } else {
          setEntries((prev) => [...prev, ...(result.entries || [])]);
          setCurrentPage(searchPage);
        }
      }

      setTotal(result.total || 0);
      setHasMore((result.entries?.length || 0) === DEFAULT_PAGE_SIZE && (result.entries?.length || 0) < (result.total || 0));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (isLoading || !hasMore) return;
    await handleSearch(currentPage + 1);
  };

  const handlePageChange = (newPage: number) => {
    handleSearch(newPage);
  };

  const handleDisplayModeChange = async (mode: DisplayMode) => {
    setDisplayMode(mode);
    await saveSettings({ displayMode: mode });
    // Reset to page 1 when switching modes
    handleSearch(1);
  };

  const handleAutoLoadToggle = async (value: boolean) => {
    setAutoLoadLastFile(value);
    await saveSettings({ autoLoadLastFile: value });
  };

  const handleThemeChange = async (newTheme: Theme) => {
    setTheme(newTheme);
    await saveSettings({ theme: newTheme });
  };

  const handleFontSizeChange = async (newSize: number) => {
    setFontSize(newSize);
    await saveSettings({ fontSize: newSize });
  };

  const saveSettings = async (updates: Partial<main.AppSettings>) => {
    try {
      const current = await GetSettings();
      await SetSettings({
        lastOpenedFile: current.lastOpenedFile,
        autoLoadLastFile: current.autoLoadLastFile,
        theme: updates.theme ?? current.theme ?? 'dark',
        fontSize: updates.fontSize ?? current.fontSize ?? 14,
        displayMode: updates.displayMode ?? current.displayMode ?? 'infinite-scroll',
        ...updates,
      });
    } catch (error) {
      console.error('[App] Failed to save settings:', error);
    }
  };

  const handleCopyEntry = useCallback(() => {
    showToast('Copied to clipboard', 'success');
  }, [showToast]);

  const handleTimePresetChange = useCallback((start: string, end: string) => {
    setStartTime(start);
    setEndTime(end);
    // Auto-search after preset is applied
    setTimeout(() => handleSearch(1), 100);
  }, [handleSearch]);

  const handleLevelClick = useCallback((level: string) => {
    const normalizedLevel = level.toLowerCase();
    setSelectedLevelFromBadge(normalizedLevel);
    if (level) {
      setSelectedLevels([level]);
      // Search immediately with the new level
      handleSearch(1, level);
    } else {
      setSelectedLevels(LOG_LEVELS);
      // Search immediately with all levels
      handleSearch(1, '');
    }
  }, [handleSearch]);

  // Sync selectedLevels with selectedLevelFromBadge when FilterBar checkboxes change
  const handleLevelToggle = (level: string) => {
    setSelectedLevels((prev) => {
      const newLevels = prev.includes(level)
        ? prev.filter((l) => l !== level)
        : [...prev, level];
      const result = newLevels.length === 0 ? [level] : newLevels;

      // Update selectedLevelFromBadge based on new selection
      if (result.length === LOG_LEVELS.length) {
        setSelectedLevelFromBadge('');
      } else if (result.length === 1) {
        setSelectedLevelFromBadge(result[0].toLowerCase());
      } else {
        setSelectedLevelFromBadge('custom');
      }

      return result;
    });
  };


  return (
    <div className="h-screen flex flex-col bg-bg-main text-gray-200 font-sans">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {!isLoaded ? (
        <FileDropZone onFileLoad={handleFileLoad} isLoading={isLoading} errorMessage={errorMessage} onOpenFileDialog={handleOpenFileDialog} />
      ) : (
        <>
          <div className="bg-bg-header px-4 py-2 border-b border-border flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <button
                onClick={handleOpenFileDialog}
                className="px-3 py-1 text-sm bg-primary rounded hover:bg-primary-hover transition-colors"
                title="Open another file (Ctrl+O)"
              >
                📁 Open File
              </button>
              {stats && <StatsBadge stats={stats} onLevelClick={handleLevelClick} selectedLevel={selectedLevelFromBadge.toLowerCase()} />}
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
              onThemeChange={handleThemeChange}
              fontSize={fontSize}
              onFontSizeChange={handleFontSizeChange}
              displayMode={displayMode}
              onDisplayModeChange={handleDisplayModeChange}
              autoLoadLastFile={autoLoadLastFile}
              onAutoLoadToggle={handleAutoLoadToggle}
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
            keywordInputRef={keywordInputRef}
            onTimePresetChange={handleTimePresetChange}
            showLevels={false}
          />

          <LogList
            entries={entries}
            total={total}
            loaded={entries.length}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            page={currentPage}
            onPageChange={handlePageChange}
            pageSize={DEFAULT_PAGE_SIZE}
            isLoading={isLoading}
            displayMode={displayMode}
            keyword={keyword}
            onCopyEntry={handleCopyEntry}
          />
        </>
      )}
    </div>
  );
}

export default App;
