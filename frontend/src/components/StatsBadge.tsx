import { main } from '../../wailsjs/go/models';

interface StatsBadgeProps {
  stats: main.Stats | null;
  onLevelClick?: (level: string) => void;
  selectedLevel?: string;
}

const levelStyles: Record<string, string> = {
  total: 'bg-border',
  error: 'bg-level-error',
  warn: 'bg-level-warn text-bg-main',
  info: 'bg-level-info',
  debug: 'bg-level-debug text-bg-main',
  trace: 'bg-level-trace',
};

export default function StatsBadge({ stats, onLevelClick, selectedLevel }: StatsBadgeProps) {
  if (!stats || stats.total === 0) {
    return null;
  }

  const levels: Array<{ key: keyof main.Stats; label: string; value: number; style: string }> = [
    { key: 'error', label: 'Error', value: stats.error, style: levelStyles.error },
    { key: 'warn', label: 'Warn', value: stats.warn, style: levelStyles.warn },
    { key: 'info', label: 'Info', value: stats.info, style: levelStyles.info },
    { key: 'debug', label: 'Debug', value: stats.debug, style: levelStyles.debug },
    { key: 'trace', label: 'Trace', value: stats.trace, style: levelStyles.trace },
  ];

  return (
    <div className="flex gap-4 px-8 py-3 bg-bg-header border-b border-border flex-wrap items-center">
      <div
        className={`px-3 py-1 rounded text-sm font-medium cursor-pointer transition-all ${levelStyles.total} ${selectedLevel === 'total' ? 'ring-2 ring-white' : ''}`}
        onClick={() => onLevelClick?.('')}
        title="Show all levels"
      >
        Total: {stats.total}
      </div>
      {levels.filter(l => l.value > 0).map((level) => (
        <div
          key={level.key}
          className={`px-3 py-1 rounded text-sm font-medium cursor-pointer transition-all hover:opacity-80 ${level.style} ${selectedLevel === level.key ? 'ring-2 ring-white' : ''}`}
          onClick={() => onLevelClick?.(level.label.toUpperCase())}
          title={`Filter by ${level.label}`}
        >
          {level.label}: {level.value}
        </div>
      ))}
    </div>
  );
}
