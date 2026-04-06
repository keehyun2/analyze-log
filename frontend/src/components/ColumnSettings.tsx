import { useState } from 'react';

export type ColumnKey = 'timestamp' | 'level' | 'source' | 'message';

export interface ColumnConfig {
  key: ColumnKey;
  label: string;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'timestamp', label: 'Time', visible: true },
  { key: 'level', label: 'Level', visible: true },
  { key: 'source', label: 'Source', visible: true },
  { key: 'message', label: 'Message', visible: true },
];

interface ColumnSettingsProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  onClose: () => void;
}

export default function ColumnSettings({ columns, onColumnsChange, onClose }: ColumnSettingsProps) {
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>(columns);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleToggle = (index: number) => {
    const newColumns = [...localColumns];
    newColumns[index].visible = !newColumns[index].visible;
    setLocalColumns(newColumns);
    // 실시간 반영
    onColumnsChange(newColumns);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newColumns = [...localColumns];
    const draggedItem = newColumns[draggedIndex];
    newColumns.splice(draggedIndex, 1);
    newColumns.splice(index, 0, draggedItem);
    setLocalColumns(newColumns);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    // 드래그 완료 시 실시간 반영
    onColumnsChange(localColumns);
  };

  const handleReset = () => {
    const resetColumns = [...DEFAULT_COLUMNS];
    setLocalColumns(resetColumns);
    onColumnsChange(resetColumns);
  };

  return (
    <div className="absolute right-0 top-12 w-64 bg-bg-header border border-border rounded shadow-lg z-20">
      <div className="p-3 border-b border-border flex justify-between items-center">
        <h3 className="text-sm font-semibold text-text-main">Column Settings</h3>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-main text-lg leading-none"
        >
          ×
        </button>
      </div>
      <div className="p-2 max-h-64 overflow-y-auto">
        {localColumns.map((col, index) => (
          <div
            key={col.key}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-2 p-2 rounded cursor-move ${
              draggedIndex === index ? 'bg-primary/20' : 'hover:bg-bg-main'
            }`}
          >
            <span className="text-text-muted cursor-grab">⋮⋮</span>
            <input
              type="checkbox"
              checked={col.visible}
              onChange={() => handleToggle(index)}
              className="w-4 h-4"
            />
            <span className="flex-1 text-sm text-text-main">{col.label}</span>
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-border">
        <button
          onClick={handleReset}
          className="w-full px-2 py-1 text-xs bg-border text-text-main rounded hover:bg-primary"
        >
          Reset to Default
        </button>
      </div>
    </div>
  );
}

export function getDefaultColumns(): ColumnConfig[] {
  return [...DEFAULT_COLUMNS];
}
