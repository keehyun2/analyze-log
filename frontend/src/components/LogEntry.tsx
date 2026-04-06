import React, { useState } from 'react';
import { store } from '../../wailsjs/go/models';
import { ColumnConfig } from './ColumnSettings';

interface ColumnWidths {
  timestamp: number;
  level: number;
  source: number;
}

interface LogEntryProps {
  entry: store.LogEntry;
  keyword?: string;
  onCopy?: () => void;
  columnWidths?: ColumnWidths;
  columnConfigs?: ColumnConfig[];
}

const levelBorderColors: Record<string, string> = {
  trace: 'border-level-trace',
  debug: 'border-level-debug',
  info: 'border-level-info',
  warn: 'border-level-warn',
  error: 'border-level-error',
};

const levelBgColors: Record<string, string> = {
  trace: 'bg-level-trace/20 text-level-trace',
  debug: 'bg-level-debug/20 text-level-debug',
  info: 'bg-level-info/20 text-level-info',
  warn: 'bg-level-warn/20 text-level-warn',
  error: 'bg-level-error/20 text-level-error',
};

export default function LogEntry({ entry, keyword, onCopy, columnWidths = { timestamp: 160, level: 56, source: 128 }, columnConfigs = [] }: LogEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasStackTrace = entry.message.includes('\n');

  const formatTimestamp = (ts: string) => {
    return ts.replace('T', ' ');
  };

  const levelLower = entry.level.toLowerCase();

  const handleCopy = () => {
    const text = `[${entry.timestamp}] [${entry.level}] ${entry.source}\n${entry.message}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (onCopy) onCopy();
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const highlightKeyword = (text: string) => {
    if (!keyword) return text;

    const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => {
      if (regex.test(part)) {
        return <mark key={i} className="bg-yellow-500/50 text-white rounded px-0.5">{part}</mark>;
      }
      return part;
    });
  };

  const formatMessage = (message: string) => {
    return message.split('\n').map((line, i) => (
      <div key={i} className="leading-relaxed">
        {line || '\u00A0'}
      </div>
    ));
  };

  // Render column based on config
  const renderColumn = (colKey: string) => {
    switch (colKey) {
      case 'timestamp':
        return (
          <span className="text-text-muted font-mono text-xs shrink-0" style={{ width: columnWidths.timestamp }}>
            {formatTimestamp(entry.timestamp)}
          </span>
        );
      case 'level':
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-semibold shrink-0 text-center ${levelBgColors[levelLower]}`} style={{ width: columnWidths.level }}>
            {entry.level}
          </span>
        );
      case 'source':
        return (
          <span className="text-text-muted text-xs shrink-0 truncate" title={entry.source} style={{ width: columnWidths.source }}>
            {entry.source}
          </span>
        );
      case 'message':
        return (
          <div className={`flex-1 text-text-main font-mono text-xs truncate ${expanded ? '' : 'max-h-5 overflow-hidden'}`}>
            {keyword ? highlightKeyword(entry.message.split('\n')[0]) : entry.message.split('\n')[0]}
          </div>
        );
      default:
        return null;
    }
  };

  const visibleColumns = columnConfigs.filter(c => c.visible);

  return (
    <div className={`border-l-3 border-b border-border py-1 px-2 ${levelBorderColors[levelLower]} animate-fade-in group`}>
      <div className="flex gap-3 items-center">
        {visibleColumns.map((col) => (
          <React.Fragment key={col.key}>
            {renderColumn(col.key)}
          </React.Fragment>
        ))}
        <button
          onClick={handleCopy}
          className={`px-2 py-1 text-xs rounded transition-colors shrink-0 ${
            copied
              ? 'bg-green-600 text-white'
              : 'bg-border text-text-muted hover:bg-primary hover:text-white opacity-0 group-hover:opacity-100'
          }`}
          title="Copy to clipboard"
        >
          {copied ? '✓' : '📋'}
        </button>
        {hasStackTrace && (
          <span
            className="text-text-muted cursor-pointer select-none hover:text-text-main shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '▼' : '▶'}
          </span>
        )}
      </div>
      {expanded && hasStackTrace && (
        <div className="text-text-main font-mono text-xs whitespace-pre-wrap break-all mt-1" style={{ paddingLeft: `calc(${columnWidths.timestamp}px + ${columnWidths.level}px + ${columnWidths.source}px + 1rem + 1rem)` }}>
          {keyword ? highlightKeyword(entry.message) : formatMessage(entry.message)}
        </div>
      )}
    </div>
  );
}
