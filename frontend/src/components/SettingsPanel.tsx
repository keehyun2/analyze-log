type Theme = 'dark' | 'darker' | 'midnight' | 'light';
type DisplayMode = 'pagination' | 'infinite-scroll';

// Toggle Switch Component
function ToggleSwitch({ checked, onChange, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg-header ${
        checked ? 'bg-primary' : 'bg-border'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

interface SettingsPanelProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  autoLoadLastFile: boolean;
  onAutoLoadToggle: (value: boolean) => void;
  showResourceUsage: boolean;
  onShowResourceToggle: (value: boolean) => void;
  autoRefreshEnabled: boolean;
  onAutoRefreshEnabledChange: (value: boolean) => void;
  autoRefreshInterval: number;
  onAutoRefreshIntervalChange: (value: number) => void;
  onClose: () => void;
}

const themes: { value: Theme; label: string; preview: string }[] = [
  { value: 'dark', label: 'Dark', preview: '#1a1a2e' },
  { value: 'darker', label: 'Darker', preview: '#0d0d1a' },
  { value: 'midnight', label: 'Midnight', preview: '#0f172a' },
  { value: 'light', label: 'Light', preview: '#f3f4f6' },
];

const displayModes: { value: DisplayMode; label: string; description: string }[] = [
  { value: 'pagination', label: 'Pagination', description: 'Show 100 entries per page with navigation buttons' },
  { value: 'infinite-scroll', label: 'Infinite Scroll', description: 'Automatically load more entries as you scroll' },
];

export default function SettingsPanel({ theme, onThemeChange, fontSize, onFontSizeChange, displayMode, onDisplayModeChange, autoLoadLastFile, onAutoLoadToggle, showResourceUsage, onShowResourceToggle, autoRefreshEnabled, onAutoRefreshEnabledChange, autoRefreshInterval, onAutoRefreshIntervalChange, onClose }: SettingsPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Modal Content */}
      <div className="relative bg-bg-header border border-border rounded-lg shadow-2xl px-8 py-6 max-w-3xl w-full mx-4 animate-scale-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main text-2xl transition-colors"
          >
            ×
          </button>
        </div>

      <div className="flex gap-8 flex-wrap">
        {/* Display Mode Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-text-muted">Scroll Mode</label>
          <div className="flex gap-2">
            {displayModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => onDisplayModeChange(mode.value)}
                className={`px-4 py-2 rounded transition-all text-sm ${
                  displayMode === mode.value
                    ? 'bg-primary text-white'
                    : 'bg-border hover:bg-primary/70'
                }`}
                title={mode.description}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Theme Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-text-muted">Theme</label>
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
          <label className="text-sm text-text-muted">
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

        {/* Auto Load Last File */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-text-muted">Startup</label>
          <div className="flex items-center gap-2">
            <ToggleSwitch checked={autoLoadLastFile} onChange={onAutoLoadToggle} />
            <span className="text-sm text-text-main">Auto-load last file</span>
          </div>
        </div>

        {/* Resource Monitor */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-text-muted">Display</label>
          <div className="flex items-center gap-2">
            <ToggleSwitch checked={showResourceUsage} onChange={onShowResourceToggle} />
            <span className="text-sm text-text-main">Show CPU & Memory</span>
          </div>
        </div>

        {/* Auto Refresh */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-text-muted">Auto Refresh</label>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <ToggleSwitch checked={autoRefreshEnabled} onChange={onAutoRefreshEnabledChange} />
              <span className="text-sm text-text-main">Enable</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-muted">every</span>
              <input
                type="number"
                min="5"
                max="600"
                value={autoRefreshInterval}
                onChange={(e) => onAutoRefreshIntervalChange(Math.max(5, Math.min(600, parseInt(e.target.value) || 60)))}
                disabled={!autoRefreshEnabled}
                className="w-16 px-2 py-1 bg-border border border-border rounded text-sm text-text-main disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-sm text-text-muted">seconds</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end pt-4 border-t border-border">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-primary text-white rounded hover:bg-primary-hover transition-colors"
        >
          Done
        </button>
      </div>
      </div>
    </div>
  );
}
