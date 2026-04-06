import { useState } from 'react';
import { main } from '../../wailsjs/go/models';

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
  onSearch: () => void;
}

const LOG_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];

const levelColors: Record<string, string> = {
  trace: 'text-level-trace',
  debug: 'text-level-debug',
  info: 'text-level-info',
  warn: 'text-level-warn',
  error: 'text-level-error',
};

// datetime-local input format: YYYY-MM-DDTHH:mm
const toDateTimeLocal = (dateStr: string): string => {
  if (!dateStr) return '';
  // Convert "2026-01-01 00:00:00" to "2026-01-01T00:00"
  return dateStr.replace(' ', 'T').substring(0, 16);
};

const fromDateTimeLocal = (dateTimeLocal: string): string => {
  if (!dateTimeLocal) return '';
  // Convert "2026-01-01T00:00" to "2026-01-01 00:00:00"
  return dateTimeLocal.replace('T', ' ') + ':00';
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
}: FilterBarProps) {
  const [showTimeFilters, setShowTimeFilters] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onStartTimeChange(fromDateTimeLocal(e.target.value));
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onEndTimeChange(fromDateTimeLocal(e.target.value));
  };

  return (
    <div className="flex gap-4 px-8 py-4 bg-bg-header border-b border-border flex-wrap items-center">
      <div className="flex gap-2 items-center">
        <label className="text-sm text-gray-400">Levels:</label>
        {LOG_LEVELS.map((level) => (
          <label key={level} className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedLevels.includes(level)}
              onChange={() => onLevelToggle(level)}
              className="cursor-pointer"
            />
            <span className={`text-sm font-medium px-1 py-0.5 rounded ${levelColors[level.toLowerCase()]}`}>
              {level}
            </span>
          </label>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Keyword..."
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="px-3 py-2 border border-border rounded bg-bg-main text-gray-200 text-sm focus:outline-none focus:border-primary"
        />
      </div>

      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Class name..."
          value={className}
          onChange={(e) => onClassNameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="px-3 py-2 border border-border rounded bg-bg-main text-gray-200 text-sm focus:outline-none focus:border-primary"
        />
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={() => setShowTimeFilters(!showTimeFilters)}
          className={`px-3 py-2 border rounded text-sm transition-colors ${
            showTimeFilters || startTime || endTime
              ? 'border-primary text-primary bg-primary/10'
              : 'border-border text-gray-400 hover:border-gray-500'
          }`}
        >
          📅 Time Filter
        </button>
      </div>

      {showTimeFilters && (
        <div className="flex gap-2 items-center">
          <input
            type="datetime-local"
            value={toDateTimeLocal(startTime)}
            onChange={handleStartTimeChange}
            className="px-3 py-2 border border-border rounded bg-bg-main text-gray-200 text-sm focus:outline-none focus:border-primary"
          />
          <span className="text-gray-500">~</span>
          <input
            type="datetime-local"
            value={toDateTimeLocal(endTime)}
            onChange={handleEndTimeChange}
            className="px-3 py-2 border border-border rounded bg-bg-main text-gray-200 text-sm focus:outline-none focus:border-primary"
          />
          {(startTime || endTime) && (
            <button
              onClick={() => {
                onStartTimeChange('');
                onEndTimeChange('');
              }}
              className="px-2 py-1 text-red-400 hover:text-red-300 text-sm"
              title="Clear time filters"
            >
              ✕
            </button>
          )}
        </div>
      )}

      <button
        className="px-6 py-2 bg-primary text-white rounded cursor-pointer text-sm ml-auto hover:bg-primary-hover"
        onClick={onSearch}
      >
        Search
      </button>
    </div>
  );
}
