import { main } from '../../wailsjs/go/models';

interface StatsBadgeProps {
  stats: main.Stats | null;
}

const levelStyles: Record<string, string> = {
  total: 'bg-border',
  error: 'bg-level-error',
  warn: 'bg-level-warn text-bg-main',
  info: 'bg-level-info',
  debug: 'bg-level-debug text-bg-main',
  trace: 'bg-level-trace',
};

export default function StatsBadge({ stats }: StatsBadgeProps) {
  if (!stats || stats.total === 0) {
    return null;
  }

  return (
    <div className="flex gap-4 px-8 py-3 bg-bg-header border-b border-border flex-wrap">
      <div className={`px-3 py-1 rounded text-sm font-medium ${levelStyles.total}`}>
        Total: {stats.total}
      </div>
      {stats.error > 0 && (
        <div className={`px-3 py-1 rounded text-sm font-medium ${levelStyles.error}`}>
          Error: {stats.error}
        </div>
      )}
      {stats.warn > 0 && (
        <div className={`px-3 py-1 rounded text-sm font-medium ${levelStyles.warn}`}>
          Warn: {stats.warn}
        </div>
      )}
      {stats.info > 0 && (
        <div className={`px-3 py-1 rounded text-sm font-medium ${levelStyles.info}`}>
          Info: {stats.info}
        </div>
      )}
      {stats.debug > 0 && (
        <div className={`px-3 py-1 rounded text-sm font-medium ${levelStyles.debug}`}>
          Debug: {stats.debug}
        </div>
      )}
      {stats.trace > 0 && (
        <div className={`px-3 py-1 rounded text-sm font-medium ${levelStyles.trace}`}>
          Trace: {stats.trace}
        </div>
      )}
    </div>
  );
}
