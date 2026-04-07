import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';
import { LoadFile, SearchLogs, GetStats, GetSettings, SetSettings, GetDateRange, RefreshLogs } from '../wailsjs/go/main/App';
import { main, store } from '../wailsjs/go/models';
import FileDropZone from './components/FileDropZone';
import FilterBar from './components/FilterBar';
import LogList from './components/LogList';
import LogDetail from './components/LogDetail';
import SettingsPanel from './components/SettingsPanel';
import ColumnSettings, { ColumnConfig, getDefaultColumns } from './components/ColumnSettings';
import ResourceMonitor from './components/ResourceMonitor';
import ToastContainer, { Toast } from './components/Toast';
import { useSearchHistory } from './hooks/useSearchHistory';
import { FolderOpenIcon, RefreshIcon, ColumnIcon, SettingsIcon } from './components/Icons';

const LOG_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];
const DEFAULT_PAGE_SIZE = 100;

type Theme = 'dark' | 'darker' | 'midnight' | 'light';
type DisplayMode = 'pagination' | 'infinite-scroll';
type SortField = 'detail' | 'timestamp' | 'level' | 'source' | 'message';
type SortOrder = 'asc' | 'desc';

interface ColumnWidths {
  timestamp: number;
  level: number;
  source: number;
}

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
  const [selectedEntry, setSelectedEntry] = useState<store.LogEntry | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [selectedLevels, setSelectedLevels] = useState<string[]>(LOG_LEVELS);
  const [keyword, setKeyword] = useState('');
  const [classNameFilter, setClassNameFilter] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Sort state
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Settings
  const [theme, setTheme] = useState<Theme>('dark');
  const [fontSize, setFontSize] = useState(14); // px
  const [displayMode, setDisplayMode] = useState<DisplayMode>('infinite-scroll');
  const [autoLoadLastFile, setAutoLoadLastFile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showResourceUsage, setShowResourceUsage] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(60); // seconds

  // Column widths (stored in localStorage)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    const saved = localStorage.getItem('columnWidths');
    if (saved) {
      return JSON.parse(saved);
    }
    return { timestamp: 160, level: 56, source: 128 };
  });

  // Column visibility and order (stored in localStorage)
  const [columnConfigs, setColumnConfigs] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('columnConfigs');
    if (saved) {
      const configs = JSON.parse(saved) as ColumnConfig[];
      // Migration: add 'detail' column if missing
      if (!configs.some(c => c.key === 'detail')) {
        return [{ key: 'detail', label: 'Detail', visible: true }, ...configs];
      }
      return configs;
    }
    return getDefaultColumns();
  });
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // Panel split width (stored in localStorage)
  const [panelSplitWidth, setPanelSplitWidth] = useState<number>(() => {
    const saved = localStorage.getItem('panelSplitWidth');
    if (saved) {
      return JSON.parse(saved);
    }
    return 50; // Default 50%
  });
  const [isResizing, setIsResizing] = useState(false);

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdCounter = useRef(0);

  // Refs for keyboard shortcuts
  const keywordInputRef = useRef<HTMLInputElement>(null);

  // Search history
  const {
    keywords: keywordHistory,
    classNames: classNameHistory,
    addToHistory,
    removeFromHistory,
    clearHistory,
  } = useSearchHistory();

  // Load settings on startup
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await GetSettings();
        setAutoLoadLastFile(settings.autoLoadLastFile);
        if (settings.theme) setTheme(settings.theme as Theme);
        if (settings.fontSize) setFontSize(settings.fontSize);
        if (settings.displayMode) setDisplayMode(settings.displayMode as DisplayMode);
        if (settings.showResourceUsage) setShowResourceUsage(settings.showResourceUsage);
        if (settings.autoRefreshEnabled !== undefined) setAutoRefreshEnabled(settings.autoRefreshEnabled);
        if (settings.autoRefreshInterval) setAutoRefreshInterval(settings.autoRefreshInterval);

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
    const themes: Record<Theme, { bg: string; header: string; text: string; textMuted: string; border: string; levelTrace: string; levelDebug: string; levelInfo: string; levelWarn: string; levelError: string }> = {
      dark: { bg: '#1a1a2e', header: '#16213e', text: '#e5e7eb', textMuted: '#9ca3af', border: '#0f3460', levelTrace: '#7f8c8d', levelDebug: '#95a5a6', levelInfo: '#3498db', levelWarn: '#f39c12', levelError: '#e94560' },
      darker: { bg: '#0d0d1a', header: '#0a0a12', text: '#d1d5db', textMuted: '#6b7280', border: '#1a1a2e', levelTrace: '#7f8c8d', levelDebug: '#95a5a6', levelInfo: '#3498db', levelWarn: '#f39c12', levelError: '#e94560' },
      midnight: { bg: '#0f172a', header: '#1e293b', text: '#f1f5f9', textMuted: '#94a3b8', border: '#334155', levelTrace: '#7f8c8d', levelDebug: '#95a5a6', levelInfo: '#3498db', levelWarn: '#f39c12', levelError: '#e94560' },
      light: { bg: '#ffffff', header: '#f3f4f6', text: '#1f2937', textMuted: '#6b7280', border: '#e5e7eb', levelTrace: '#6b7280', levelDebug: '#9ca3af', levelInfo: '#3b82f6', levelWarn: '#f59e0b', levelError: '#ef4444' },
    };
    const current = themes[theme];
    root.style.setProperty('--color-bg-main', current.bg);
    root.style.setProperty('--color-bg-header', current.header);
    root.style.setProperty('--color-border', current.border);
    root.style.setProperty('--color-text-main', current.text);
    root.style.setProperty('--color-text-muted', current.textMuted);
    root.style.setProperty('--color-level-trace', current.levelTrace);
    root.style.setProperty('--color-level-debug', current.levelDebug);
    root.style.setProperty('--color-level-info', current.levelInfo);
    root.style.setProperty('--color-level-warn', current.levelWarn);
    root.style.setProperty('--color-level-error', current.levelError);

    // Set data-theme attribute for CSS targeting
    root.setAttribute('data-theme', theme);
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

      // F5: Refresh logs
      if (e.key === 'F5') {
        e.preventDefault();
        if (isLoaded) {
          handleRefresh();
        }
      }

      // Escape: Close settings or detail panel
      if (e.key === 'Escape') {
        if (showSettings) {
          e.preventDefault();
          setShowSettings(false);
        } else if (selectedEntry) {
          e.preventDefault();
          setSelectedEntry(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoaded, showSettings, selectedEntry, keyword]);

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
        // Load date range
        const dateRange = await GetDateRange();
        // Then search before setting isLoaded - explicitly search all levels
        console.log('[App] About to call handleSearch after file load');
        await handleSearch(1, '', dateRange.min || '', dateRange.max || '');
        console.log('[App] handleSearch completed');
        // Update state after search
        if (dateRange.min && dateRange.max) {
          setStartTime(dateRange.min);
          setEndTime(dateRange.max);
        }
        setIsLoaded(true);
        setIsLoading(false);
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

  const handleRefresh = async () => {
    if (!isLoaded) return;

    setIsLoading(true);
    try {
      const result = await RefreshLogs();
      if (result.success) {
        if (result.newCount > 0) {
          showToast(`Loaded ${result.newCount} new entries`, 'success');
          // Refresh stats and search
          const statsResult = await GetStats();
          setStats(statsResult);
          // Reload current search
          await handleSearch(currentPage);
        } else {
          showToast('No new entries', 'info');
        }
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) {
      console.error('[App] Refresh error:', error);
      showToast('Refresh failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto refresh timer
  useEffect(() => {
    if (!autoRefreshEnabled || !isLoaded) return;

    const interval = setInterval(() => {
      handleRefresh();
    }, autoRefreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, autoRefreshInterval, isLoaded]);

  const handleSearch = async (searchPage: number = 1, overrideLevel?: string, overrideStart?: string, overrideEnd?: string) => {
    const actualStart = overrideStart !== undefined ? overrideStart : startTime;
    const actualEnd = overrideEnd !== undefined ? overrideEnd : endTime;
    console.log('[App] handleSearch called with:', {
      searchPage,
      overrideLevel,
      overrideStart,
      overrideEnd,
      actualStart,
      actualEnd,
      selectedLevels,
      keyword
    });
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
        startTime: overrideStart !== undefined ? overrideStart : startTime,
        endTime: overrideEnd !== undefined ? overrideEnd : endTime,
        page: searchPage,
        pageSize: DEFAULT_PAGE_SIZE,
        sortField: sortField,
        sortOrder: sortOrder,
      };

      const result = await SearchLogs(query);
      console.log('[App] SearchLogs result:', { total: result.total, entriesCount: result.entries?.length });

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

  const handleShowResourceToggle = async (value: boolean) => {
    setShowResourceUsage(value);
    await saveSettings({ showResourceUsage: value });
  };

  const handleAutoRefreshEnabledChange = async (value: boolean) => {
    setAutoRefreshEnabled(value);
    await saveSettings({ autoRefreshEnabled: value });
  };

  const handleAutoRefreshIntervalChange = async (value: number) => {
    setAutoRefreshInterval(value);
    await saveSettings({ autoRefreshInterval: value });
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
        showResourceUsage: updates.showResourceUsage ?? current.showResourceUsage ?? false,
        autoRefreshEnabled: updates.autoRefreshEnabled ?? current.autoRefreshEnabled ?? false,
        autoRefreshInterval: updates.autoRefreshInterval ?? current.autoRefreshInterval ?? 60,
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
    console.log('[App] handleTimePresetChange called:', { start, end });
    setStartTime(start);
    setEndTime(end);
    // Use override params to search immediately with new values
    handleSearch(1, undefined, start, end);
  }, [handleSearch]);

  const handleSort = useCallback((field: SortField, order: SortOrder) => {
    setSortField(field);
    setSortOrder(order);

    // Trigger new search with server-side sorting
    handleSearch(1);
  }, [handleSearch]);

  const handleColumnWidthChange = useCallback((column: keyof ColumnWidths, width: number) => {
    setColumnWidths((prev) => {
      const newWidths = { ...prev, [column]: width };
      localStorage.setItem('columnWidths', JSON.stringify(newWidths));
      return newWidths;
    });
  }, []);

  const handleColumnConfigsChange = useCallback((configs: ColumnConfig[]) => {
    setColumnConfigs(configs);
    localStorage.setItem('columnConfigs', JSON.stringify(configs));
  }, []);

  // Panel resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const container = document.querySelector('.split-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newWidth = ((e.clientX - rect.left) / rect.width) * 100;
      const clampedWidth = Math.max(20, Math.min(80, newWidth)); // 20%-80%
      setPanelSplitWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        localStorage.setItem('panelSplitWidth', JSON.stringify(panelSplitWidth));
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, panelSplitWidth]);

  const handleEntryClick = useCallback((entry: store.LogEntry) => {
    // Only show detail panel for entries with multi-line messages (stack traces)
    const hasMultiLine = entry.message.includes('\n');
    if (hasMultiLine) {
      setSelectedEntry(entry);
    } else {
      setSelectedEntry(null);
    }
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedEntry(null);
  }, []);

  const handleLevelClick = useCallback((level: string) => {
    if (level === 'all') {
      // Toggle: if all levels selected, deselect all; otherwise select all
      setSelectedLevels((prev) => {
        const allSelected = prev.length === LOG_LEVELS.length;
        const newLevels = allSelected ? [] : [...LOG_LEVELS];

        // Search immediately with the new levels
        const levelParam = newLevels.length === LOG_LEVELS.length ? '' : newLevels.join(',');
        handleSearch(1, levelParam);

        return newLevels;
      });
      return;
    }

    setSelectedLevels((prev) => {
      const newLevels = prev.includes(level)
        ? prev.filter((l) => l !== level)
        : [...prev, level];

      // Ensure at least one level is selected
      const result = newLevels.length === 0 ? [level] : newLevels;

      // Search immediately with the new levels
      const levelParam = result.length === LOG_LEVELS.length ? '' : result.join(',');
      handleSearch(1, levelParam);

      return result;
    });
  }, [handleSearch]);

  // Sync selectedLevels when FilterBar checkboxes change
  const handleLevelToggle = (level: string) => {
    setSelectedLevels((prev) => {
      const newLevels = prev.includes(level)
        ? prev.filter((l) => l !== level)
        : [...prev, level];

      // Ensure at least one level is selected
      const result = newLevels.length === 0 ? [level] : newLevels;

      // Search immediately with the new levels
      const levelParam = result.length === LOG_LEVELS.length ? '' : result.join(',');
      handleSearch(1, levelParam);

      return result;
    });
  };


  return (
    <div className="h-screen flex flex-col bg-bg-main text-text-main font-sans">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {!isLoaded ? (
        <FileDropZone onFileLoad={handleFileLoad} isLoading={isLoading} errorMessage={errorMessage} onOpenFileDialog={handleOpenFileDialog} />
      ) : (
        <>
          <div className="bg-bg-header px-3 py-1 border-b border-border flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <button
                onClick={handleOpenFileDialog}
                className="px-2 py-0.5 text-xs bg-primary rounded hover:bg-primary-hover transition-colors flex items-center gap-1"
                title="Open another file (Ctrl+O)"
              >
                <FolderOpenIcon size={14} /> Open
              </button>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="px-2 py-0.5 text-xs bg-primary rounded hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                title="Refresh logs (F5)"
              >
                <RefreshIcon size={14} /> Refresh
              </button>
            </div>
            <div className="flex gap-3 items-center">
              <ResourceMonitor enabled={showResourceUsage} />
              <div className="flex gap-2 items-center relative">
                <button
                  onClick={() => setShowColumnSettings(!showColumnSettings)}
                  className="p-1 text-xs bg-border rounded hover:bg-primary transition-colors"
                  title="Column settings"
                >
                  <ColumnIcon size={14} />
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-1 text-xs bg-border rounded hover:bg-primary transition-colors"
                >
                  <SettingsIcon size={14} />
                </button>
                {showColumnSettings && (
                  <ColumnSettings
                    columns={columnConfigs}
                    onColumnsChange={handleColumnConfigsChange}
                    onClose={() => setShowColumnSettings(false)}
                  />
                )}
              </div>
            </div>
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
              showResourceUsage={showResourceUsage}
              onShowResourceToggle={handleShowResourceToggle}
              autoRefreshEnabled={autoRefreshEnabled}
              onAutoRefreshEnabledChange={handleAutoRefreshEnabledChange}
              autoRefreshInterval={autoRefreshInterval}
              onAutoRefreshIntervalChange={handleAutoRefreshIntervalChange}
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
            onSearch={(overrideStart, overrideEnd) => handleSearch(1, undefined, overrideStart, overrideEnd)}
            keywordInputRef={keywordInputRef}
            onTimePresetChange={handleTimePresetChange}
            showLevels={false}
            stats={stats}
            onLevelClickFromBadge={handleLevelClick}
            selectedLevelsFromBadge={selectedLevels.map(l => l.toLowerCase())}
            keywordHistory={keywordHistory}
            classNameHistory={classNameHistory}
            onAddToKeywordHistory={(value) => addToHistory('keywords', value)}
            onAddToClassNameHistory={(value) => addToHistory('classNames', value)}
            onRemoveFromKeywordHistory={(value) => removeFromHistory('keywords', value)}
            onRemoveFromClassNameHistory={(value) => removeFromHistory('classNames', value)}
            onClearKeywordHistory={() => clearHistory('keywords')}
            onClearClassNameHistory={() => clearHistory('classNames')}
          />

          <div className="flex-1 flex overflow-hidden split-container">
            <div className="flex-none flex flex-col" style={{ width: selectedEntry ? `${panelSplitWidth}%` : '100%', minWidth: '300px' }}>
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
                onSort={handleSort}
                sortField={sortField}
                sortOrder={sortOrder}
                columnWidths={columnWidths}
                onColumnWidthChange={handleColumnWidthChange}
                columnConfigs={columnConfigs}
                selectedEntry={selectedEntry}
                onEntryClick={handleEntryClick}
              />
            </div>
            {selectedEntry && (
              <>
                <div
                  className={`relative flex items-center justify-center ${isResizing ? 'bg-primary' : ''}`}
                  style={{ width: '12px' }}
                  onMouseDown={handleResizeStart}
                  title="Drag to resize"
                >
                  <div className="w-2 h-full bg-border hover:bg-primary transition-colors" />
                </div>
                <div className="flex-none flex flex-col border-l border-border" style={{ width: `${100 - panelSplitWidth}%`, minWidth: '300px' }}>
                  <LogDetail entry={selectedEntry} keyword={keyword} onClose={handleCloseDetail} />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
