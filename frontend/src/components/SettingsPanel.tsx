type Theme = 'dark' | 'darker' | 'midnight';

interface SettingsPanelProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onClose: () => void;
}

const themes: { value: Theme; label: string; preview: string }[] = [
  { value: 'dark', label: 'Dark', preview: '#1a1a2e' },
  { value: 'darker', label: 'Darker', preview: '#0d0d1a' },
  { value: 'midnight', label: 'Midnight', preview: '#0f172a' },
];

export default function SettingsPanel({ theme, onThemeChange, fontSize, onFontSizeChange, onClose }: SettingsPanelProps) {
  return (
    <div className="bg-bg-header border-b border-border px-8 py-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Settings</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xl"
        >
          ×
        </button>
      </div>

      <div className="flex gap-8 flex-wrap">
        {/* Theme Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">Theme</label>
          <div className="flex gap-2">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => onThemeChange(t.value)}
                className={`px-4 py-2 rounded transition-all ${
                  theme === t.value
                    ? 'ring-2 ring-primary'
                    : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: t.preview }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400">
            Font Size: {fontSize}px
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onFontSizeChange(Math.max(10, fontSize - 1))}
              className="px-3 py-1 bg-border rounded hover:bg-primary transition-colors"
            >
              -
            </button>
            <input
              type="range"
              min="10"
              max="20"
              value={fontSize}
              onChange={(e) => onFontSizeChange(parseInt(e.target.value))}
              className="w-32"
            />
            <button
              onClick={() => onFontSizeChange(Math.min(20, fontSize + 1))}
              className="px-3 py-1 bg-border rounded hover:bg-primary transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
