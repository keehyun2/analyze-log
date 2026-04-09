import { useState, useEffect } from 'react';
import { GetCustomFormats, AddCustomFormat, UpdateCustomFormat, DeleteCustomFormat } from '../../wailsjs/go/main/App';
import { parser } from '../../wailsjs/go/models';

interface CustomFormatPanelProps {
  onClose: () => void;
}

// CustomFormat type matching the Go struct
interface CustomFormat {
  id: string;
  name: string;
  pattern: string;
  description: string;
  createdAt: Date;
  enabled: boolean;
}

interface TestResult {
  success: boolean;
  error?: string;
  entry?: {
    timestamp: string;
    level: string;
    source: string;
    class: string;
    message: string;
  };
}

export default function CustomFormatPanel({ onClose }: CustomFormatPanelProps) {
  const [formats, setFormats] = useState<CustomFormat[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingFormat, setEditingFormat] = useState<CustomFormat | null>(null);
  const [testPattern, setTestPattern] = useState('');
  const [testLine, setTestLine] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFormats();
  }, []);

  const loadFormats = async () => {
    try {
      const result = await GetCustomFormats();
      setFormats(result as any);
    } catch (error) {
      console.error('Failed to load custom formats:', error);
    }
  };

  const handleAdd = () => {
    setEditingFormat(null);
    setShowEditor(true);
  };

  const handleEdit = (format: CustomFormat) => {
    setEditingFormat(format);
    setShowEditor(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this format?')) return;

    try {
      await DeleteCustomFormat(id);
      await loadFormats();
    } catch (error) {
      console.error('Failed to delete format:', error);
      alert('Failed to delete format: ' + error);
    }
  };

  const handleToggleEnabled = async (format: CustomFormat) => {
    const updated = { ...format, enabled: !format.enabled };
    try {
      await UpdateCustomFormat(format.id, updated as any);
      await loadFormats();
    } catch (error) {
      console.error('Failed to update format:', error);
      alert('Failed to update format: ' + error);
    }
  };

  const handleTest = async () => {
    if (!testPattern || !testLine) {
      alert('Please enter both pattern and test line');
      return;
    }

    setLoading(true);
    setTestResult(null);

    try {
      const result = await TestCustomFormat(testPattern, testLine);
      setTestResult(result);
    } catch (error) {
      console.error('Test failed:', error);
      setTestResult({ success: false, error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFormat = async (format: Omit<CustomFormat, 'id' | 'createdAt'>) => {
    try {
      if (editingFormat) {
        await UpdateCustomFormat(editingFormat.id, { ...format, id: editingFormat.id, createdAt: editingFormat.createdAt } as any);
      } else {
        await AddCustomFormat(format as any);
      }
      await loadFormats();
      setShowEditor(false);
      setEditingFormat(null);
    } catch (error) {
      console.error('Failed to save format:', error);
      alert('Failed to save format: ' + error);
      throw error;
    }
  };

  if (showEditor) {
    return (
      <CustomFormatEditor
        format={editingFormat}
        onSave={handleSaveFormat}
        onCancel={() => {
          setShowEditor(false);
          setEditingFormat(null);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative bg-bg-header border border-border rounded-lg shadow-2xl px-8 py-6 max-w-4xl w-full mx-4 animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Custom Log Formats</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main text-2xl transition-colors"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* Format List */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-text-muted uppercase tracking-wide">Your Formats</h3>
              <button
                onClick={handleAdd}
                className="px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all text-sm font-medium"
              >
                + Add New Format
              </button>
            </div>

            {!formats || formats.length === 0 ? (
              <div className="text-center py-8 bg-border/30 rounded-lg">
                <p className="text-text-muted">No custom formats defined yet.</p>
                <p className="text-text-muted text-sm mt-1">Create one to parse logs with custom patterns.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {formats.map((format) => (
                  <div
                    key={format.id}
                    className={`p-4 bg-border/30 rounded-lg border ${
                      format.enabled ? 'border-primary/30' : 'border-transparent opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-text-main">{format.name}</h4>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            format.enabled
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {format.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted font-mono bg-bg-main px-2 py-1 rounded overflow-x-auto">
                          {format.pattern}
                        </p>
                        {format.description && (
                          <p className="text-sm text-text-muted mt-2">{format.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleEnabled(format)}
                          className={`p-2 rounded-lg transition-all ${
                            format.enabled
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                          }`}
                          title={format.enabled ? 'Disable' : 'Enable'}
                        >
                          {format.enabled ? '✓' : '○'}
                        </button>
                        <button
                          onClick={() => handleEdit(format)}
                          className="p-2 bg-border/50 rounded-lg hover:bg-primary hover:text-white transition-all"
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDelete(format.id)}
                          className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                          title="Delete"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Test Format */}
          <div className="border-t border-border/50 pt-4">
            <h3 className="text-sm font-medium text-text-muted uppercase tracking-wide mb-3">Test a Pattern</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Regex Pattern (with named groups)</label>
                <input
                  type="text"
                  value={testPattern}
                  onChange={(e) => setTestPattern(e.target.value)}
                  placeholder="(?P<timestamp>\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{3}) (?P<level>\\w+) (?P<message>.*)"
                  className="w-full px-3 py-2 bg-bg-main border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Test Log Line</label>
                <input
                  type="text"
                  value={testLine}
                  onChange={(e) => setTestLine(e.target.value)}
                  placeholder="2024-01-01 12:00:00.000 INFO This is a test message"
                  className="w-full px-3 py-2 bg-bg-main border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTest}
                  disabled={loading || !testPattern || !testLine}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Testing...' : 'Test Pattern'}
                </button>
                <button
                  onClick={() => {
                    setTestPattern('');
                    setTestLine('');
                    setTestResult(null);
                  }}
                  className="px-4 py-2 bg-border/50 text-text-muted rounded-lg hover:bg-border hover:text-text-main transition-all"
                >
                  Clear
                </button>
              </div>

              {testResult && (
                <div className={`p-3 rounded-lg ${
                  testResult.success
                    ? 'bg-green-500/20 border border-green-500/30'
                    : 'bg-red-500/20 border border-red-500/30'
                }`}>
                  {testResult.success ? (
                    <div>
                      <p className="text-green-400 font-medium mb-2">✓ Matched!</p>
                      <div className="text-xs space-y-1">
                        <p><span className="text-text-muted">Timestamp:</span> {testResult.entry?.timestamp}</p>
                        <p><span className="text-text-muted">Level:</span> {testResult.entry?.level}</p>
                        <p><span className="text-text-muted">Source:</span> {testResult.entry?.source}</p>
                        <p><span className="text-text-muted">Class:</span> {testResult.entry?.class}</p>
                        <p><span className="text-text-muted">Message:</span> {testResult.entry?.message}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-red-400">✗ {testResult.error}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Help */}
          <div className="border-t border-border/50 pt-4">
            <h3 className="text-sm font-medium text-text-muted uppercase tracking-wide mb-3">Help & Examples</h3>
            <div className="text-sm text-text-muted space-y-2">
              <p><strong>Required named groups:</strong> <code>timestamp</code>, <code>level</code>, <code>message</code></p>
              <p><strong>Optional named groups:</strong> <code>source</code>, <code>class</code></p>
              <p className="mt-3"><strong>Example patterns:</strong></p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Simple: <code>(?P&lt;timestamp&gt;\\S+) (?P&lt;level&gt;\\w+) (?P&lt;message&gt;.*)</code></li>
                <li>With brackets: <code>(?P&lt;timestamp&gt;[^\\[]+)\\[(?P&lt;level&gt;\\w+)\\] (?P&lt;message&gt;.*)</code></li>
                <li>Java log: <code>(?P&lt;timestamp&gt;\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{3}) (?P&lt;level&gt;\\w+) \\[(?P&lt;source&gt;[^\\]]+)\\] (?P&lt;message&gt;.*)</code></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-6 border-t border-border/50 mt-6">
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

// Custom Format Editor Component
interface CustomFormatEditorProps {
  format: CustomFormat | null;
  onSave: (format: Omit<CustomFormat, 'id' | 'createdAt'>) => Promise<void>;
  onCancel: () => void;
}

function CustomFormatEditor({ format, onSave, onCancel }: CustomFormatEditorProps) {
  const [name, setName] = useState(format?.name || '');
  const [pattern, setPattern] = useState(format?.pattern || '');
  const [description, setDescription] = useState(format?.description || '');
  const [enabled, setEnabled] = useState(format?.enabled ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !pattern.trim()) {
      alert('Name and pattern are required');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        pattern: pattern.trim(),
        description: description.trim(),
        enabled,
      });
    } catch (error) {
      // Error already handled in parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
      />
      <div className="relative bg-bg-header border border-border rounded-lg shadow-2xl px-8 py-6 max-w-2xl w-full mx-4 animate-scale-in">
        <h2 className="text-xl font-semibold mb-6">
          {format ? 'Edit Format' : 'Add New Format'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1 block">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Log Format"
              className="w-full px-3 py-2 bg-bg-main border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1 block">
              Regex Pattern *
            </label>
            <textarea
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder='(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) (?P<level>\w+) (?P<message>.*)'
              rows={4}
              className="w-full px-3 py-2 bg-bg-main border border-border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <p className="text-xs text-text-muted mt-1">
              Must include: <code>timestamp</code>, <code>level</code>, <code>message</code> named groups
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this format"
              rows={2}
              className="w-full px-3 py-2 bg-bg-main border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex items-center gap-3 px-3 py-2 bg-border/30 rounded-lg">
            <input
              type="checkbox"
              id="format-enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <label htmlFor="format-enabled" className="text-sm text-text-main">
              Enable this format
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-border/50 text-text-muted rounded-lg hover:bg-border hover:text-text-main transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim() || !pattern.trim()}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? 'Saving...' : 'Save Format'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Import TestCustomFormat
async function TestCustomFormat(pattern: string, testLine: string): Promise<TestResult> {
  // This will be replaced by Wails binding
  const { TestCustomFormat } = await import('../../wailsjs/go/main/App');
  return TestCustomFormat(pattern, testLine);
}
