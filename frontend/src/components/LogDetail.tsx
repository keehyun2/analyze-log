import React, { useState, useEffect, useRef } from 'react';
import { store } from '../../wailsjs/go/models';
import Prism from 'prismjs';
import { ClipboardIcon, CheckIcon, PaletteIcon, FileTextIcon, CloseIcon } from './Icons';

// Import Prism.js CSS
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-json';
import './LogDetail.scss';

// Define custom log language for Prism
const defineLogLanguage = () => {
  if (Prism.languages.log) return; // Already defined

  Prism.languages.log = {
    // Java Stack Trace: "at com.example.Class.method(Class.java:123)"
    // Supports: module paths (java.base/...), inner classes ($), generics (<>)
    stacktrace: {
      pattern: /\bat\s+(?:[\w.]+\/)?[\w.$]+\.[\w<>$]+\([\w.]+:\d+\)/,
      inside: {
        keyword: /\bat\b/,
        'module-path': /(?:[\w.]+\/)/,
        'class-name': /[\w.$]+(?=\.[\w<>$]+\()/,
        'method-name': /(?<=\.)[\w<>$]+(?=\()/,
        'file-name': /[\w.]+(?=:\d)/,
        'line-number': /\d+(?=\))/,
      },
    },

    // "Caused by:" prefix
    'caused-by': /\bCaused by:/,

    // Exception header line: "SomeException: message" or just "Exception in ..."
    'exception-header': {
      pattern: /^.*(?:[A-Z][\w$]*Exception|[A-Z][\w$]*Error):.*/m,
      inside: {
        exception: /[A-Z][\w$]*(?:Exception|Error)/,
      },
    },

    // Java Exception / Error types (standalone)
    exception: /\b[A-Z][\w$]*(?:Exception|Error)\b|\bException\b|\bThrowable\b/,

    // Thread/goroutine names: "[main]" "[pool-1-thread-2]"
    'thread-name': /\[(?:main|pool-[\w-]+|thread-[\w-]+|worker-[\w-]+|[\w.-]+-\d+)\]/i,

    // Log levels — with or without brackets
    'log-level': /\b(?:\[(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|SEVERE)\]|(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|SEVERE))(?=\b|\s)/,

    // HTTP Methods
    'http-method': /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/,

    // HTTP Status Codes (100-599)
    'http-status': /\b[1-5]\d{2}\b/,

    // URLs / URIs
    url: /https?:\/\/[^\s"'>]+|\b(?:\/[\w./%-]+)+(?:\?[^\s"'>]*)?/,

    // IP addresses (IPv4)
    'ip-address': /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{2,5})?\b/,

    // Durations: 123ms, 1.5s, 200μs
    duration: /\b\d+(?:\.\d+)?(?:ms|μs|ns|s(?:ec)?)\b/,

    // JSON key-value strings
    'json-string': /"([^"\\]|\\.)*"\s*:/,
    'json-number': /:\s*-?\d+\.?\d*/,
    'json-boolean': /:\s*(true|false|null)\b/,

    // key=value patterns (e.g. status=200, userId=abc123)
    'key-value': /\b[\w.]+=[\w./:@%-]+/,

    // Timestamps (ISO 8601 + common variants)
    timestamp: /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/,

    // UUIDs
    uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,

    // Numbers (last — catch-all)
    number: /\b-?\d+(?:\.\d+)?\b/,
  };
};

interface LogDetailProps {
  entry: store.LogEntry | null;
  keyword?: string;
  onClose?: () => void;
}

const levelColors: Record<string, string> = {
  TRACE: 'text-level-trace bg-level-trace/10',
  DEBUG: 'text-level-debug bg-level-debug/10',
  INFO: 'text-level-info bg-level-info/10',
  WARN: 'text-level-warn bg-level-warn/10',
  ERROR: 'text-level-error bg-level-error/10',
};

export default function LogDetail({ entry, keyword, onClose }: LogDetailProps) {
  const [copied, setCopied] = useState(false);
  const [colorize, setColorize] = useState(true);
  const codeRef = useRef<HTMLElement>(null);

  // Initialize Prism language
  useEffect(() => {
    defineLogLanguage();
  }, []);

  // Highlight with Prism when message or colorize changes
  useEffect(() => {
    if (colorize && codeRef.current && entry?.message) {
      Prism.highlightElement(codeRef.current);
    }
  }, [entry?.message, colorize]);

  const handleCopy = () => {
    if (!entry) return;
    const text = `[${entry.timestamp}] [${entry.level}] ${entry.source}\n${entry.message}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!entry) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-muted">
        <ClipboardIcon className="mb-4" size={64} />
        <p className="text-lg">Select a log entry to view details</p>
        <p className="text-sm mt-2">Click on any entry in the list</p>
      </div>
    );
  }

  const timestamp = entry.timestamp.replace('T', ' ');

  return (
    <div className="h-full flex flex-col bg-bg-main">
      {/* Header */}
      <div className="bg-bg-header border-b border-border px-2 py-1">
        <div className="flex items-center justify-between mb-1">
          <span className={`px-2 py-0.5 rounded font-bold text-xs ${levelColors[entry.level] || 'text-text-muted'}`}>
            {entry.level}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setColorize(!colorize)}
              className={`px-2 py-0.5 text-xs rounded transition-colors flex items-center gap-1 ${
                colorize
                  ? 'bg-primary text-white'
                  : 'bg-border text-text-muted hover:bg-primary hover:text-white'
              }`}
              title="Toggle colorizing"
            >
              {colorize ? <PaletteIcon size={12} /> : <FileTextIcon size={12} />}
            </button>
            <button
              onClick={handleCopy}
              className={`px-2 py-0.5 text-xs rounded transition-colors flex items-center gap-1 ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-border text-text-muted hover:bg-primary hover:text-white'
              }`}
            >
              {copied ? <><CheckIcon size={12} /> Copied</> : <><ClipboardIcon size={12} /> Copy</>}
            </button>
            <button
              onClick={onClose}
              className="px-2 py-0.5 text-xs rounded bg-border text-text-muted hover:bg-primary hover:text-white transition-colors"
              title="Close (Escape)"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        </div>
        <div className="space-y-0.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-text-muted w-16">Timestamp:</span>
            <span className="font-mono text-text-main">{timestamp}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted w-16">Source:</span>
            <span className="font-mono text-text-main">{entry.source}</span>
          </div>
        </div>
      </div>

      {/* Message */}
      <div className="flex-1 overflow-auto text-left">
        {colorize ? (
          <pre className="log-detail-pre" style={{ margin: 0, padding: '0.5em' }}>
            <code ref={codeRef} className="language-log">
              {entry.message}
            </code>
          </pre>
        ) : (
          <pre className="log-detail-pre" style={{ margin: 0, padding: '0.5em' }}>
            {entry.message}
          </pre>
        )}
      </div>
    </div>
  );
}
