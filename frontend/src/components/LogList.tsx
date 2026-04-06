import { useState, useRef, useCallback, useEffect } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { store } from '../../wailsjs/go/models';
import LogEntry from './LogEntry';
import { ColumnConfig } from './ColumnSettings';

type DisplayMode = 'pagination' | 'infinite-scroll';
type SortField = 'timestamp' | 'level' | 'source' | 'message';
type SortOrder = 'asc' | 'desc';

interface ColumnWidths {
  timestamp: number;
  level: number;
  source: number;
}

interface LogListProps {
  entries: store.LogEntry[];
  total: number;
  loaded: number; // Number of entries currently loaded
  hasMore: boolean; // Whether more entries can be loaded
  onLoadMore: () => void; // Callback to load more entries
  page: number; // Current page (for pagination mode)
  onPageChange: (page: number) => void; // Page change callback (for pagination mode)
  pageSize: number; // Page size (for pagination mode)
  isLoading: boolean;
  displayMode: DisplayMode;
  endMessage?: string; // Message to show at the end
  keyword?: string; // Search keyword for highlighting
  onCopyEntry?: () => void; // Callback when entry is copied
  onSort?: (field: SortField, order: SortOrder) => void; // Sort callback
  sortField?: SortField;
  sortOrder?: SortOrder;
  columnWidths?: ColumnWidths;
  onColumnWidthChange?: (column: keyof ColumnWidths, width: number) => void;
  columnConfigs?: ColumnConfig[];
}

export default function LogList({
  entries,
  total,
  loaded,
  hasMore,
  onLoadMore,
  page,
  onPageChange,
  pageSize,
  isLoading,
  displayMode,
  endMessage,
  keyword,
  onCopyEntry,
  onSort,
  sortField,
  sortOrder,
  columnWidths = { timestamp: 160, level: 56, source: 128 },
  onColumnWidthChange,
  columnConfigs = []
}: LogListProps) {
  const [resizingColumn, setResizingColumn] = useState<keyof ColumnWidths | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleResizeStart = useCallback((column: keyof ColumnWidths, e: React.MouseEvent) => {
    e.preventDefault();
    setResizingColumn(column);
    startX.current = e.clientX;
    startWidth.current = columnWidths[column];
  }, [columnWidths]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (resizingColumn && onColumnWidthChange) {
      const diff = e.clientX - startX.current;
      const newWidth = Math.max(50, startWidth.current + diff);
      onColumnWidthChange(resizingColumn, newWidth);
    }
  }, [resizingColumn, onColumnWidthChange]);

  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null);
  }, []);

  useEffect(() => {
    if (resizingColumn) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizingColumn, handleResizeMove, handleResizeEnd]);
  const handleSort = (field: SortField) => {
    if (!onSort) return;

    const newOrder: SortOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    onSort(field, newOrder);
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <span className="text-text-muted">⇅</span>;
    return sortOrder === 'asc' ? <span className="text-primary">↑</span> : <span className="text-primary">↓</span>;
  };

  const TableHeader = () => {
    const visibleColumns = columnConfigs.filter(c => c.visible);

    return (
      <div className="flex gap-3 items-center bg-bg-header px-2 py-1 border-b border-border sticky top-0 z-10">
        {visibleColumns.map((col) => {
          if (col.key === 'message') {
            return (
              <div key={col.key} className="text-text-muted text-xs font-semibold flex-1 text-left">
                Message
              </div>
            );
          }

          return (
            <div key={col.key} className="flex items-center shrink-0" style={{ width: columnWidths[col.key as keyof ColumnWidths] }}>
              <button
                onClick={() => handleSort(col.key as SortField)}
                className="text-text-muted text-xs font-semibold hover:text-primary text-left flex items-center gap-1 flex-1"
              >
                {col.label} {renderSortIcon(col.key as SortField)}
              </button>
              <div
                className="w-1 h-4 bg-text-muted hover:bg-primary cursor-col-resize rounded-full"
                onMouseDown={(e) => handleResizeStart(col.key as keyof ColumnWidths, e)}
                title="Drag to resize"
              />
            </div>
          );
        })}
        <div className="w-12 shrink-0"></div>
      </div>
    );
  };

  // Pagination mode
  if (displayMode === 'pagination') {
    if (isLoading) {
      return <div className="flex-1 flex items-center justify-center text-text-muted text-xl text-left">Loading...</div>;
    }

    if (!entries || entries.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-text-muted text-left py-16">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-xl mb-2">No results found</p>
          <p className="text-sm text-text-muted mb-6">Try adjusting your filters or search terms</p>
        </div>
      );
    }

    const totalPages = Math.ceil(total / pageSize);

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <TableHeader />
        <div className="flex-1 overflow-y-auto text-left">
          {entries.map((entry) => (
            <LogEntry key={entry.id} entry={entry} keyword={keyword} onCopy={onCopyEntry} columnWidths={columnWidths} columnConfigs={columnConfigs} />
          ))}
        </div>

        <div className="flex justify-between items-center px-3 py-1 bg-bg-header border-t border-border">
          <span className="text-text-muted text-xs pl-2">
            Total: {total.toLocaleString()}
          </span>

          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 text-xs bg-border text-text-main rounded cursor-pointer hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
            >
              Prev
            </button>

            <span className="text-text-muted text-xs">
              {page} / {totalPages}
            </span>

            <button
              className="px-2 py-1 text-xs bg-border text-text-main rounded cursor-pointer hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Infinite scroll mode
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <TableHeader />
      <div className="flex-1 overflow-hidden text-left">
        <Virtuoso
          style={{ height: '100%' }}
          data={entries}
          itemContent={(index, entry) => (
            <LogEntry key={entry.id} entry={entry} keyword={keyword} onCopy={onCopyEntry} columnWidths={columnWidths} columnConfigs={columnConfigs} />
          )}
          endReached={() => {
            if (hasMore && !isLoading) {
              onLoadMore();
            }
          }}
          components={{
            Footer: () => {
              if (!hasMore && entries.length > 0) {
                return (
                  <div className="py-4 text-center text-text-muted text-sm">
                    {endMessage || `Showing all ${total} entries`}
                  </div>
                );
              }
              if (isLoading) {
                return (
                  <div className="py-4 text-center text-text-muted text-sm">
                    Loading more entries...
                  </div>
                );
              }
              return null;
            },
          }}
        />
      </div>

      {/* Total count indicator */}
      <div className="px-4 py-2 bg-bg-header border-t border-border text-center">
        <span className="text-text-muted text-sm">
          {loaded < total ? `Showing ${loaded} of ${total} entries` : `All ${total} entries loaded`}
        </span>
      </div>
    </div>
  );
}
