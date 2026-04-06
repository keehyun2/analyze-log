import { useState } from 'react';
import { store } from '../../wailsjs/go/models';
import LogEntry from './LogEntry';

interface LogListProps {
  entries: store.LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}

export default function LogList({ entries, total, page, pageSize, onPageChange, isLoading }: LogListProps) {
  const [pageInput, setPageInput] = useState('');

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-gray-500 text-xl text-left">Loading...</div>;
  }

  if (!entries || entries.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-gray-500 text-xl text-left">No results found</div>;
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
          <LogEntry key={entry.id} entry={entry} />
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
