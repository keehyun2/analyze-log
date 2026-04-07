type Theme = 'dark' | 'darker' | 'midnight' | 'light';
type DisplayMode = 'pagination' | 'infinite-scroll';

// Toggle Switch Component
function ToggleSwitch({ checked, onChange, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-bg-header ${
        checked ? 'bg-primary shadow-md shadow-primary/40' : 'bg-border/50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-all duration-300 ease-in-out shadow-sm ${
          checked ? 'translate-x-5' : 'translate-x-1'
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

const themes: { value: Theme; label: string; preview: string; textColor: string }[] = [
  { value: 'dark', label: 'Dark', preview: '#1a1a2e', textColor: '#ffffff' },
  { value: 'darker', label: 'Darker', preview: '#0d0d1a', textColor: '#ffffff' },
  { value: 'midnight', label: 'Midnight', preview: '#0f172a', textColor: '#ffffff' },
  { value: 'light', label: 'Light', preview: '#f3f4f6', textColor: '#1f2937' },
];

const displayModes: { value: DisplayMode; label: string; icon: string }[] = [
  { value: 'pagination', label: 'Pagination', icon: '⊞' },
  { value: 'infinite-scroll', label: 'Infinite Scroll', icon: '≋' },
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
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Scroll Mode</label>
          <div className="flex gap-2">
            {displayModes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => onDisplayModeChange(mode.value)}
                className={`px-3 py-2 rounded-lg transition-all text-sm font-medium flex items-center gap-2 ${
                  displayMode === mode.value
                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                    : 'bg-border/50 text-text-muted hover:bg-border hover:text-text-main'
                }`}
              >
                <span className="text-base">{mode.icon}</span>
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Theme Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Theme</label>
          <div className="flex gap-2">
            {themes.map((t) => (
              <button
                key={t.value}
                onClick={() => onThemeChange(t.value)}
                className={`relative px-4 py-2 rounded-lg transition-all text-sm font-medium overflow-hidden ${
                  theme === t.value
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-bg-header shadow-lg scale-105'
                    : 'opacity-70 hover:opacity-100 hover:scale-105'
                }`}
                style={{ backgroundColor: t.preview, color: t.textColor }}
              >
                {t.label}
                {theme === t.value && (
                  <span className="absolute inset-0 bg-white/10 animate-pulse" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">
            Font Size: <span className="text-text-main font-semibold">{fontSize}px</span>
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onFontSizeChange(Math.max(10, fontSize - 1))}
              className="w-8 h-8 flex items-center justify-center bg-border/50 rounded-lg hover:bg-primary hover:text-white transition-all text-text-muted font-medium"
            >
              −
            </button>
            <input
              type="range"
              min="10"
              max="20"
              value={fontSize}
              onChange={(e) => onFontSizeChange(parseInt(e.target.value))}
              className="flex-1 h-2 bg-border/50 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <button
              onClick={() => onFontSizeChange(Math.min(20, fontSize + 1))}
              className="w-8 h-8 flex items-center justify-center bg-border/50 rounded-lg hover:bg-primary hover:text-white transition-all text-text-muted font-medium"
            >
              +
            </button>
          </div>
        </div>

        {/* Auto Load Last File */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Startup</label>
          <div className="flex items-center gap-3 px-3 py-2 bg-border/30 rounded-lg">
            <ToggleSwitch checked={autoLoadLastFile} onChange={onAutoLoadToggle} />
            <span className="text-sm text-text-main">Auto-load last file</span>
          </div>
        </div>

        {/* Resource Monitor */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Display</label>
          <div className="flex items-center gap-3 px-3 py-2 bg-border/30 rounded-lg">
            <ToggleSwitch checked={showResourceUsage} onChange={onShowResourceToggle} />
            <span className="text-sm text-text-main">Show CPU & Memory</span>
          </div>
        </div>

        {/* Auto Refresh */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wide">Auto Refresh</label>
          <div className="flex items-center gap-3 px-3 py-2 bg-border/30 rounded-lg">
            <div className="flex items-center gap-3">
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
                className="w-16 px-2 py-1 bg-bg-main border border-border rounded text-sm text-text-main disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-sm text-text-muted">sec</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end pt-6 border-t border-border/50">
        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all hover:shadow-lg hover:shadow-primary/30 font-medium"
        >
          Done
        </button>
      </div>
      </div>
    </div>
  );
}
