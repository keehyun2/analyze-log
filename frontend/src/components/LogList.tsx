import { useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { store } from '../../wailsjs/go/models';
import LogEntry from './LogEntry';

type DisplayMode = 'pagination' | 'infinite-scroll';

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
  onCopyEntry
}: LogListProps) {
  const [pageInput, setPageInput] = useState('');

  // Pagination mode
  if (displayMode === 'pagination') {
    if (isLoading) {
      return <div className="flex-1 flex items-center justify-center text-gray-500 text-xl text-left">Loading...</div>;
    }

    if (!entries || entries.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-left py-16">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-xl mb-2">No results found</p>
          <p className="text-sm text-gray-400 mb-6">Try adjusting your filters or search terms</p>
        </div>
      );
    }

    const totalPages = Math.ceil(total / pageSize);
    const startIdx = (page - 1) * pageSize + 1;
    const endIdx = Math.min(page * pageSize, total);

    const handlePageInputSubmit = () => {
      const pageNum = parseInt(pageInput);
      if (pageNum >= 1 && pageNum <= totalPages) {
        onPageChange(pageNum);
        setPageInput('');
      }
    };

    const handlePageInputKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handlePageInputSubmit();
      }
    };

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto py-2 text-left">
          {entries.map((entry) => (
            <LogEntry key={entry.id} entry={entry} keyword={keyword} onCopy={onCopyEntry} />
          ))}
        </div>

        <div className="flex justify-center items-center gap-4 px-4 py-4 bg-bg-header border-t border-border">
          <button
            className="px-4 py-2 bg-border text-gray-200 rounded cursor-pointer hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
          >
            Previous
          </button>

          <span className="text-gray-400 text-sm">
            {startIdx}-{endIdx} / {total} (Page {page} / {totalPages})
          </span>

          <input
            type="number"
            className="w-15 px-2 py-1.5 bg-bg-main text-gray-200 border border-border rounded text-center text-sm focus:outline-none focus:border-primary"
            placeholder="Go to"
            min={1}
            max={totalPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyDown={handlePageInputKeyDown}
            onBlur={handlePageInputSubmit}
          />

          <button
            className="px-4 py-2 bg-border text-gray-200 rounded cursor-pointer hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  // Infinite scroll mode
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden text-left">
        <Virtuoso
          style={{ height: '100%' }}
          data={entries}
          itemContent={(index, entry) => (
            <LogEntry key={entry.id} entry={entry} keyword={keyword} onCopy={onCopyEntry} />
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
                  <div className="py-4 text-center text-gray-500 text-sm">
                    {endMessage || `Showing all ${total} entries`}
                  </div>
                );
              }
              if (isLoading) {
                return (
                  <div className="py-4 text-center text-gray-500 text-sm">
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
        <span className="text-gray-400 text-sm">
          {loaded < total ? `Showing ${loaded} of ${total} entries` : `All ${total} entries loaded`}
        </span>
      </div>
    </div>
  );
}
