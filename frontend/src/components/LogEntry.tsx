import { useState } from 'react';
import { store } from '../../wailsjs/go/models';

interface LogEntryProps {
  entry: store.LogEntry;
  keyword?: string;
  onCopy?: () => void;
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

export default function LogEntry({ entry, keyword, onCopy }: LogEntryProps) {
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

  return (
    <div className={`border-l-3 border-b border-border py-2 px-2 ${levelBorderColors[levelLower]} animate-fade-in group`}>
      <div className="flex gap-4 items-center py-1">
        <span className="text-gray-500 font-mono text-sm min-w-45">
          {formatTimestamp(entry.timestamp)}
        </span>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold min-w-15 text-center ${levelBgColors[levelLower]}`}>
          {entry.level}
        </span>
        <span className="text-gray-400 text-xs flex-1">
          {entry.source}
        </span>
        <button
          onClick={handleCopy}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            copied
              ? 'bg-green-600 text-white'
              : 'bg-border text-gray-400 hover:bg-primary hover:text-white opacity-0 group-hover:opacity-100'
          }`}
          title="Copy to clipboard"
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
        {hasStackTrace && (
          <span
            className="text-gray-500 cursor-pointer select-none hover:text-gray-300"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '▼' : '▶'}
          </span>
        )}
      </div>
      <div className={`pl-45 text-gray-300 font-mono text-sm whitespace-pre-wrap break-all ${expanded ? '' : 'max-h-12 overflow-hidden'}`}>
        {keyword ? highlightKeyword(entry.message) : formatMessage(entry.message)}
      </div>
    </div>
  );
}
