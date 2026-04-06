import { useState, useEffect, useRef, useCallback } from 'react';

interface DatePickerProps {
  value: string; // "2026-01-01 19:16:57.000" format
  onChange: (value: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
  onApply?: (value: string) => void; // Callback when Apply is clicked
}

// Format: YYYY-MM-DD HH:mm:ss.000 -> Date object and parts
const parseDateTime = (dateStr: string) => {
  if (!dateStr) return new Date();
  // Parse "2026-01-01 19:16:57.000"
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const [, year, month, day, hour, min, sec] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(min),
      parseInt(sec)
    );
  }
  return new Date();
};

// Format Date object to "YYYY-MM-DD HH:mm:ss.000"
const formatDateTime = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.000`;
};

export default function DatePicker({ value, onChange, onClose, position, onApply }: DatePickerProps) {
  const [currentDate, setCurrentDate] = useState(() => parseDateTime(value));
  const [viewMonth, setViewMonth] = useState(() => parseDateTime(value));
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Generate calendar days
  const getCalendarDays = () => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();

    const days: Date[] = [];
    // Empty cells for days before month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(new Date(year, month, -startDayOfWeek + i + 1));
    }
    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const handleDateSelect = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(currentDate.getHours());
    newDate.setMinutes(currentDate.getMinutes());
    newDate.setSeconds(currentDate.getSeconds());
    setCurrentDate(newDate);
  };

  const handleTimeChange = (field: 'hours' | 'minutes' | 'seconds', delta: number) => {
    const newDate = new Date(currentDate);
    if (field === 'hours') {
      newDate.setHours(newDate.getHours() + delta);
    } else if (field === 'minutes') {
      newDate.setMinutes(newDate.getMinutes() + delta);
    } else {
      newDate.setSeconds(newDate.getSeconds() + delta);
    }
    setCurrentDate(newDate);
  };

  const handleTimeInputChange = (field: 'hours' | 'minutes' | 'seconds', val: string) => {
    const num = parseInt(val);
    if (isNaN(num)) return;
    const newDate = new Date(currentDate);
    if (field === 'hours') {
      newDate.setHours(Math.min(23, Math.max(0, num)));
    } else if (field === 'minutes') {
      newDate.setMinutes(Math.min(59, Math.max(0, num)));
    } else {
      newDate.setSeconds(Math.min(59, Math.max(0, num)));
    }
    setCurrentDate(newDate);
  };

  const handleNow = () => {
    const now = new Date();
    setCurrentDate(now);
    setViewMonth(now);
  };

  const handleApply = () => {
    const formatted = formatDateTime(currentDate);
    onChange(formatted);
    onApply?.(formatted); // 새 값을 직접 전달
    onClose();
  };

  const calendarDays = getCalendarDays();
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const isCurrentDate = (day: Date) => {
    return day.getDate() === currentDate.getDate() &&
      day.getMonth() === currentDate.getMonth() &&
      day.getFullYear() === currentDate.getFullYear();
  };
  const isToday = (day: Date) => {
    const now = new Date();
    return day.getDate() === now.getDate() &&
      day.getMonth() === now.getMonth() &&
      day.getFullYear() === now.getFullYear();
  };
  const isOtherMonth = (day: Date) => day.getMonth() !== viewMonth.getMonth();

  return (
    <div
      ref={panelRef}
      className="fixed bg-bg-header border border-border rounded shadow-lg z-50 p-3"
      style={{ top: position.top, left: position.left }}
    >
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1))}
          className="px-2 py-1 text-xs border border-border rounded hover:bg-bg-main"
        >
          &lt;
        </button>
        <span className="text-sm font-medium">
          {viewMonth.getFullYear()}-{String(viewMonth.getMonth() + 1).padStart(2, '0')}
        </span>
        <button
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1))}
          className="px-2 py-1 text-xs border border-border rounded hover:bg-bg-main"
        >
          &gt;
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((d) => (
          <div key={d} className="text-center text-xs text-text-muted py-1">{d}</div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {calendarDays.map((day, i) => (
          <button
            key={i}
            onClick={() => handleDateSelect(day)}
            className={`
              py-1 text-xs rounded hover:bg-bg-main
              ${isOtherMonth(day) ? 'text-text-muted opacity-50' : ''}
              ${isCurrentDate(day) ? 'bg-primary text-white' : ''}
              ${isToday(day) && !isCurrentDate(day) ? 'border border-primary' : ''}
            `}
          >
            {day.getDate()}
          </button>
        ))}
      </div>

      {/* Time Picker */}
      <div className="flex items-center gap-2 mb-3 border-t border-border pt-2">
        <span className="text-xs text-text-muted">Time:</span>
        {(['hours', 'minutes', 'seconds'] as const).map((field) => (
          <div key={field} className="flex items-center border border-border rounded">
            <button
              onClick={() => handleTimeChange(field, 1)}
              className="px-1 py-0.5 text-xs hover:bg-bg-main border-r border-border"
            >
              ▲
            </button>
            <input
              type="text"
              value={String(currentDate[field === 'hours' ? 'getHours' : field === 'minutes' ? 'getMinutes' : 'getSeconds']()).padStart(2, '0')}
              onChange={(e) => handleTimeInputChange(field, e.target.value)}
              className="w-8 text-center text-xs bg-transparent focus:outline-none"
              maxLength={2}
            />
            <button
              onClick={() => handleTimeChange(field, -1)}
              className="px-1 py-0.5 text-xs hover:bg-bg-main border-l border-border"
            >
              ▼
            </button>
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleNow}
          className="flex-1 px-2 py-1 text-xs border border-border rounded hover:bg-bg-main"
        >
          Now
        </button>
        <button
          onClick={handleApply}
          className="flex-1 px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primary-hover"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
