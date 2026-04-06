import { main } from '../../wailsjs/go/models';

interface StatsBadgeProps {
  stats: main.Stats | null;
  onLevelClick?: (level: string) => void;
  selectedLevels?: string[];
}

const levelStyles: Record<string, string> = {
  total: 'bg-border',
  error: 'bg-level-error',
  warn: 'bg-level-warn text-bg-main',
  info: 'bg-level-info',
  debug: 'bg-level-debug text-bg-main',
  trace: 'bg-level-trace',
};

export default function StatsBadge({ stats, onLevelClick, selectedLevels = [] }: StatsBadgeProps) {
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
    <div className="flex gap-2 px-3 py-1 bg-bg-header border-b border-border flex-wrap items-center">
      <div
        className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-all ${levelStyles.total} ${selectedLevels.length === 0 ? 'ring-2 ring-primary' : ''}`}
        onClick={() => onLevelClick?.('')}
        title="Show all levels"
      >
        All:{stats.total}
      </div>
      {levels.filter(l => l.value > 0).map((level) => (
        <div
          key={level.key}
          className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer transition-all hover:opacity-80 ${level.style} ${selectedLevels.includes(level.key) ? 'ring-2 ring-primary' : ''}`}
          onClick={() => onLevelClick?.(level.label.toUpperCase())}
          title={`Filter by ${level.label}`}
        >
          {level.key.charAt(0).toUpperCase() + level.key.slice(1)}:{level.value}
        </div>
      ))}
    </div>
  );
}
