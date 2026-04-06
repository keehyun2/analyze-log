import { useState } from 'react';
import { store } from '../../wailsjs/go/models';

interface LogEntryProps {
  entry: store.LogEntry;
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

export default function LogEntry({ entry }: LogEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const hasStackTrace = entry.message.includes('\n');

  const formatTimestamp = (ts: string) => {
    return ts.replace('T', ' ');
  };

  const levelLower = entry.level.toLowerCase();

  return (
    <div className={`border-l-3 border-b border-border py-2 px-2 ${levelBorderColors[levelLower]}`}>
      <div
        className="flex gap-4 items-center py-1 cursor-default hover:bg-white/5"
        onClick={() => hasStackTrace && setExpanded(!expanded)}
      >
        <span className="text-gray-500 font-mono text-sm min-w-45">
          {formatTimestamp(entry.timestamp)}
        </span>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold min-w-15 text-center ${levelBgColors[levelLower]}`}>
          {entry.level}
        </span>
        <span className="text-gray-400 text-xs flex-1">
          {entry.source}
        </span>
        {hasStackTrace && (
          <span className="text-gray-500 cursor-pointer select-none">
            {expanded ? '▼' : '▶'}
          </span>
        )}
      </div>
      <div className={`pl-45 text-gray-300 font-mono text-sm whitespace-pre-wrap break-all ${expanded ? '' : 'max-h-12 overflow-hidden'}`}>
        {entry.message.split('\n').map((line, i) => (
          <div key={i} className="leading-relaxed">
            {line || '\u00A0'}
          </div>
        ))}
      </div>
    </div>
  );
}
