import { useState, useEffect, useRef, useCallback } from 'react';
import { CloseIcon } from './Icons';

interface SearchHistoryDropdownProps {
  items: string[];
  onSelect: (value: string) => void;
  onRemove: (value: string) => void;
  onClear: () => void;
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number; width: number };
}

export default function SearchHistoryDropdown({
  items,
  onSelect,
  onRemove,
  onClear,
  isOpen,
  onClose,
  position,
}: SearchHistoryDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [items]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen || items.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          onSelect(items[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, items, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || items.length === 0) return null;

  return (
    <div
      ref={dropdownRef}
      className="fixed z-50 bg-bg-header border border-border rounded-lg shadow-xl overflow-hidden"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
        maxHeight: '300px',
      }}
    >
      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
        {items.map((item, index) => (
          <div
            key={item}
            className={`group flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
              index === selectedIndex
                ? 'bg-primary bg-opacity-30'
                : 'hover:bg-bg-main'
            }`}
            onClick={() => onSelect(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="text-sm text-text-main truncate flex-1">{item}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item);
              }}
              className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-level-error transition-all px-1"
              title="Remove from history"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        ))}
      </div>
      {items.length > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="w-full px-3 py-2 text-xs text-text-muted hover:text-level-error hover:bg-bg-main transition-colors border-t border-border"
        >
          Clear all history
        </button>
      )}
    </div>
  );
}
