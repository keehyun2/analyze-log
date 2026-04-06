import { useState, useRef, useEffect, useCallback } from 'react';
import { main } from '../../wailsjs/go/models';
import SearchHistoryDropdown from './SearchHistoryDropdown';
import DatePicker from './DatePicker';

interface FilterBarProps {
  levels: string[];
  selectedLevels: string[];
  onLevelToggle: (level: string) => void;
  keyword: string;
  onKeywordChange: (value: string) => void;
  className: string;
  onClassNameChange: (value: string) => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  endTime: string;
  onEndTimeChange: (value: string) => void;
  onSearch: (overrideStart?: string, overrideEnd?: string) => void;
  keywordInputRef?: React.RefObject<HTMLInputElement>;
  onTimePresetChange?: (start: string, end: string) => void;
  showLevels?: boolean;
  // StatsBadge props
  stats?: main.Stats | null;
  onLevelClickFromBadge?: (level: string) => void;
  selectedLevelsFromBadge?: string[];
  // History props
  keywordHistory: string[];
  classNameHistory: string[];
  onAddToKeywordHistory: (value: string) => void;
  onAddToClassNameHistory: (value: string) => void;
  onRemoveFromKeywordHistory: (value: string) => void;
  onRemoveFromClassNameHistory: (value: string) => void;
  onClearKeywordHistory: () => void;
  onClearClassNameHistory: () => void;
}

const LOG_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];

const levelColors: Record<string, string> = {
  trace: 'text-level-trace',
  debug: 'text-level-debug',
  info: 'text-level-info',
  warn: 'text-level-warn',
  error: 'text-level-error',
};

const badgeStyles: Record<string, string> = {
  total: 'bg-border',
  error: 'bg-level-error',
  warn: 'bg-level-warn text-bg-main',
  info: 'bg-level-info',
  debug: 'bg-level-debug text-bg-main',
  trace: 'bg-level-trace',
};

type TimePreset = '1h' | '24h' | '7d' | 'today' | 'yesterday';

const timePresets: { value: TimePreset; label: string }[] = [
  { value: '1h', label: 'Last 1h' },
  { value: '24h', label: 'Last 24h' },
  { value: '7d', label: 'Last 7d' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
];

const getTimeRangeForPreset = (preset: TimePreset): { start: string; end: string } => {
  const now = new Date();
  const formatDateTime = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  };

  let start: Date;
  const end = now;

  switch (preset) {
    case '1h':
      start = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      break;
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
      const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      return { start: formatDateTime(start), end: formatDateTime(yesterdayEnd) };
  }

  return { start: formatDateTime(start), end: formatDateTime(end) };
};

// Format for text input: YYYY-MM-DD HH:mm:ss
const toDateTimeInput = (dateStr: string): string => {
  if (!dateStr) return '';
  // Convert "2026-01-01 00:00:00.000" to "2026-01-01 00:00:00"
  return dateStr.substring(0, 19);
};

const fromDateTimeInput = (dateTimeStr: string): string => {
  if (!dateTimeStr) return '';
  // Convert "2026-01-01 00:00:00" to "2026-01-01 00:00:00.000"
  // Support partial formats: YYYY-MM-DD, YYYY-MM-DD HH:mm, YYYY-MM-DD HH:mm:ss
  const trimmed = dateTimeStr.trim();
  if (trimmed.length === 10) {
    return trimmed + ' 00:00:00.000';
  } else if (trimmed.length === 16) {
    return trimmed + ':00.000';
  } else if (trimmed.length === 19) {
    return trimmed + '.000';
  }
  return trimmed;
};

export default function FilterBar({
  selectedLevels,
  onLevelToggle,
  keyword,
  onKeywordChange,
  className,
  onClassNameChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  onSearch,
  keywordInputRef,
  onTimePresetChange,
  showLevels = false,
  stats,
  onLevelClickFromBadge,
  selectedLevelsFromBadge,
  keywordHistory,
  classNameHistory,
  onAddToKeywordHistory,
  onAddToClassNameHistory,
  onRemoveFromKeywordHistory,
  onRemoveFromClassNameHistory,
  onClearKeywordHistory,
  onClearClassNameHistory,
}: FilterBarProps) {
  const internalKeywordRef = useRef<HTMLInputElement>(null);
  const internalClassNameRef = useRef<HTMLInputElement>(null);
  const inputRef = keywordInputRef || internalKeywordRef;

  // Advanced search toggle
  const [showAdvanced, setShowAdvanced] = useState(false);

  // History dropdown states
  const [keywordDropdownOpen, setKeywordDropdownOpen] = useState(false);
  const [classNameDropdownOpen, setClassNameDropdownOpen] = useState(false);
  const [keywordDropdownPos, setKeywordDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const [classNameDropdownPos, setClassNameDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  // DatePicker states
  const [startTimePickerOpen, setStartTimePickerOpen] = useState(false);
  const [endTimePickerOpen, setEndTimePickerOpen] = useState(false);
  const [startTimePickerPos, setStartTimePickerPos] = useState({ top: 0, left: 0 });
  const [endTimePickerPos, setEndTimePickerPos] = useState({ top: 0, left: 0 });
  const startTimeInputRef = useRef<HTMLInputElement>(null);
  const endTimeInputRef = useRef<HTMLInputElement>(null);

  // Debounce refs for time input changes
  const startTimeSearchTimeout = useRef<number | null>(null);
  const endTimeSearchTimeout = useRef<number | null>(null);

  // Focus the input when requested
  useEffect(() => {
    if (keywordInputRef && keywordInputRef.current) {
      keywordInputRef.current.focus();
    }
  }, [keywordInputRef]);

  // Calculate dropdown position
  const calculateDropdownPosition = useCallback((element: HTMLInputElement) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    };
  }, []);

  // Handle keyword input focus
  const handleKeywordFocus = useCallback(() => {
    if (inputRef.current && keywordHistory.length > 0) {
      setKeywordDropdownPos(calculateDropdownPosition(inputRef.current));
      setKeywordDropdownOpen(true);
    }
  }, [keywordHistory, calculateDropdownPosition, inputRef]);

  // Handle classname input focus
  const handleClassNameFocus = useCallback(() => {
    if (internalClassNameRef.current && classNameHistory.length > 0) {
      setClassNameDropdownPos(calculateDropdownPosition(internalClassNameRef.current));
      setClassNameDropdownOpen(true);
    }
  }, [classNameHistory, calculateDropdownPosition]);

  // Handle keyword history select
  const handleKeywordHistorySelect = useCallback((value: string) => {
    onKeywordChange(value);
    setKeywordDropdownOpen(false);
    inputRef.current?.focus();
  }, [onKeywordChange, inputRef]);

  // Handle classname history select
  const handleClassNameHistorySelect = useCallback((value: string) => {
    onClassNameChange(value);
    setClassNameDropdownOpen(false);
    internalClassNameRef.current?.focus();
  }, [onClassNameChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Add to history before search
      if (keyword.trim()) onAddToKeywordHistory(keyword);
      if (className.trim()) onAddToClassNameHistory(className);
      onSearch();
    }
  };

  const handleSearchClick = () => {
    // Add to history before search
    if (keyword.trim()) onAddToKeywordHistory(keyword);
    if (className.trim()) onAddToClassNameHistory(className);
    onSearch();
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = fromDateTimeInput(e.target.value);
    onStartTimeChange(newValue);
    // Clear previous timeout and schedule new search with new value
    if (startTimeSearchTimeout.current) {
      clearTimeout(startTimeSearchTimeout.current);
    }
    startTimeSearchTimeout.current = setTimeout(() => {
      onSearch(newValue, endTime);
    }, 500);
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = fromDateTimeInput(e.target.value);
    onEndTimeChange(newValue);
    // Clear previous timeout and schedule new search with new value
    if (endTimeSearchTimeout.current) {
      clearTimeout(endTimeSearchTimeout.current);
    }
    endTimeSearchTimeout.current = setTimeout(() => {
      onSearch(startTime, newValue);
    }, 500);
  };

  return (
    <>
      <div className="flex gap-3 px-3 py-2 bg-bg-header border-b border-border flex-wrap items-center">
        {stats && stats.total > 0 && (
          <>
            <div
              className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-all ${badgeStyles.total} ${selectedLevelsFromBadge?.length === 5 ? 'ring-2 ring-primary' : ''}`}
              onClick={() => onLevelClickFromBadge?.('all')}
              title="Toggle all levels"
            >
              All:{stats.total}
            </div>
            {stats.error > 0 && (
              <div
                className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-all hover:opacity-80 ${badgeStyles.error} ${selectedLevelsFromBadge?.includes('error') ? 'ring-2 ring-primary' : ''}`}
                onClick={() => onLevelClickFromBadge?.('ERROR')}
                title="Filter by Error"
              >
                Error:{stats.error}
              </div>
            )}
            {stats.warn > 0 && (
              <div
                className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-all hover:opacity-80 ${badgeStyles.warn} ${selectedLevelsFromBadge?.includes('warn') ? 'ring-2 ring-primary' : ''}`}
                onClick={() => onLevelClickFromBadge?.('WARN')}
                title="Filter by Warn"
              >
                Warn:{stats.warn}
              </div>
            )}
            {stats.info > 0 && (
              <div
                className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-all hover:opacity-80 ${badgeStyles.info} ${selectedLevelsFromBadge?.includes('info') ? 'ring-2 ring-primary' : ''}`}
                onClick={() => onLevelClickFromBadge?.('INFO')}
                title="Filter by Info"
              >
                Info:{stats.info}
              </div>
            )}
            {stats.debug > 0 && (
              <div
                className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-all hover:opacity-80 ${badgeStyles.debug} ${selectedLevelsFromBadge?.includes('debug') ? 'ring-2 ring-primary' : ''}`}
                onClick={() => onLevelClickFromBadge?.('DEBUG')}
                title="Filter by Debug"
              >
                Debug:{stats.debug}
              </div>
            )}
            {stats.trace > 0 && (
              <div
                className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-all hover:opacity-80 ${badgeStyles.trace} ${selectedLevelsFromBadge?.includes('trace') ? 'ring-2 ring-primary' : ''}`}
                onClick={() => onLevelClickFromBadge?.('TRACE')}
                title="Filter by Trace"
              >
                Trace:{stats.trace}
              </div>
            )}
            <div className="w-px h-4 bg-border self-center"></div>
          </>
        )}
      {showLevels && (
        <div className="flex gap-2 items-center">
          <label className="text-xs text-text-muted">Levels:</label>
          {LOG_LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => onLevelToggle(level)}
              className={`
                text-xs font-medium px-2 py-0.5 rounded cursor-pointer transition-all
                ${levelColors[level.toLowerCase()]}
                ${selectedLevels.includes(level)
                  ? 'bg-opacity-100 ring-1 ring-current'
                  : 'bg-opacity-20 opacity-50 hover:opacity-80'}
              `}
            >
              {level}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-center relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Keyword... (Ctrl+F)"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleKeywordFocus}
          className="px-2 py-1 border border-border rounded bg-bg-main text-text-main text-xs focus:outline-none focus:border-primary"
        />
        <SearchHistoryDropdown
          items={keywordHistory}
          onSelect={handleKeywordHistorySelect}
          onRemove={onRemoveFromKeywordHistory}
          onClear={() => {
            onClearKeywordHistory();
            setKeywordDropdownOpen(false);
          }}
          isOpen={keywordDropdownOpen}
          onClose={() => setKeywordDropdownOpen(false)}
          position={keywordDropdownPos}
        />
      </div>

      <div className="flex gap-2 items-center relative">
        <input
          ref={internalClassNameRef}
          type="text"
          placeholder="Class..."
          value={className}
          onChange={(e) => onClassNameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleClassNameFocus}
          className="px-2 py-1 border border-border rounded bg-bg-main text-text-main text-xs focus:outline-none focus:border-primary"
        />
        <SearchHistoryDropdown
          items={classNameHistory}
          onSelect={handleClassNameHistorySelect}
          onRemove={onRemoveFromClassNameHistory}
          onClear={() => {
            onClearClassNameHistory();
            setClassNameDropdownOpen(false);
          }}
          isOpen={classNameDropdownOpen}
          onClose={() => setClassNameDropdownOpen(false)}
          position={classNameDropdownPos}
        />
      </div>

      {/* Advanced Search Toggle & Search Button */}
      <button
        className="px-2 py-1 text-xs border border-border rounded hover:bg-bg-main text-text-muted mr-2"
        onClick={() => setShowAdvanced(!showAdvanced)}
        title="Toggle advanced search options"
      >
        {showAdvanced ? '▼' : '▶'} Advanced
      </button>
      <button
        className="px-3 py-1 bg-primary text-white rounded cursor-pointer text-xs hover:bg-primary-hover"
        onClick={handleSearchClick}
      >
        Search
      </button>
    </div>

    {/* Advanced Search Panel */}
    {showAdvanced && (
      <div className="px-3 py-2 bg-bg-header border-b border-border flex-wrap items-center gap-3">
        {/* Time Filter Presets */}
        {onTimePresetChange && (
          <div className="flex gap-1 items-center">
            <span className="text-xs text-text-muted mr-1">Quick:</span>
            {timePresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => {
                  const { start, end } = getTimeRangeForPreset(preset.value);
                  console.log('[FilterBar] Time preset clicked:', preset.value, { start, end });
                  onTimePresetChange(start, end);
                }}
                className="px-1.5 py-0.5 text-xs border border-border rounded bg-bg-header text-text-muted hover:border-primary hover:text-primary transition-colors"
                title={`Set time range to ${preset.label}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}

        {/* Time Filter */}
        <div className="flex gap-2 items-center">
          <span className="text-xs text-text-muted">Date Range:</span>
          <div className="relative">
            <input
              ref={startTimeInputRef}
              type="text"
              placeholder="YYYY-MM-DD HH:mm:ss"
              value={toDateTimeInput(startTime)}
              onChange={handleStartTimeChange}
              className="w-44 px-2 py-1 pr-8 border border-border rounded bg-bg-main text-text-main text-xs focus:outline-none focus:border-primary"
            />
            <button
              onClick={() => {
                if (startTimeInputRef.current) {
                  const rect = startTimeInputRef.current.getBoundingClientRect();
                  setStartTimePickerPos({ top: rect.bottom + 4, left: rect.left });
                  setStartTimePickerOpen(true);
                }
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary"
              title="Open date picker"
            >
              📅
            </button>
            {startTimePickerOpen && (
              <DatePicker
                value={startTime}
                onChange={onStartTimeChange}
                onClose={() => setStartTimePickerOpen(false)}
                position={startTimePickerPos}
                onApply={(newVal) => onSearch(newVal, endTime)}
              />
            )}
          </div>
          <span className="text-text-muted text-xs">~</span>
          <div className="relative">
            <input
              ref={endTimeInputRef}
              type="text"
              placeholder="YYYY-MM-DD HH:mm:ss"
              value={toDateTimeInput(endTime)}
              onChange={handleEndTimeChange}
              className="w-44 px-2 py-1 pr-8 border border-border rounded bg-bg-main text-text-main text-xs focus:outline-none focus:border-primary"
            />
            <button
              onClick={() => {
                if (endTimeInputRef.current) {
                  const rect = endTimeInputRef.current.getBoundingClientRect();
                  setEndTimePickerPos({ top: rect.bottom + 4, left: rect.left });
                  setEndTimePickerOpen(true);
                }
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary"
              title="Open date picker"
            >
              📅
            </button>
            {endTimePickerOpen && (
              <DatePicker
                value={endTime}
                onChange={onEndTimeChange}
                onClose={() => setEndTimePickerOpen(false)}
                position={endTimePickerPos}
                onApply={(newVal) => onSearch(startTime, newVal)}
              />
            )}
          </div>
          {(startTime || endTime) && (
            <button
              onClick={() => {
                onStartTimeChange('');
                onEndTimeChange('');
                onSearch('', '');
              }}
              className="px-1.5 py-0.5 text-level-error hover:text-level-error text-xs"
              title="Clear time filters"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    )}
    </>
  );
}
