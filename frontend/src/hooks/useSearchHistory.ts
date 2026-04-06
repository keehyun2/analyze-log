import { useState, useEffect, useCallback } from 'react';

const HISTORY_KEY = 'search-history';
const MAX_HISTORY = 10;

interface HistoryEntry {
  value: string;
  timestamp: number;
}

interface SearchHistory {
  keywords: HistoryEntry[];
  classNames: HistoryEntry[];
}

const getDefaultHistory = (): SearchHistory => ({
  keywords: [],
  classNames: [],
});

const loadHistory = (): SearchHistory => {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[useSearchHistory] Failed to load history:', error);
  }
  return getDefaultHistory();
};

const saveHistory = (history: SearchHistory) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('[useSearchHistory] Failed to save history:', error);
  }
};

export const useSearchHistory = () => {
  const [history, setHistory] = useState<SearchHistory>(getDefaultHistory);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const addToHistory = useCallback((type: 'keywords' | 'classNames', value: string) => {
    if (!value.trim()) return;

    const trimmedValue = value.trim();
    setHistory((prev) => {
      const list = prev[type];
      // Remove if already exists
      const filtered = list.filter((item) => item.value !== trimmedValue);
      // Add to front
      const newList = [
        { value: trimmedValue, timestamp: Date.now() },
        ...filtered,
      ].slice(0, MAX_HISTORY);

      const newHistory = { ...prev, [type]: newList };
      saveHistory(newHistory);
      return newHistory;
    });
  }, []);

  const removeFromHistory = useCallback((type: 'keywords' | 'classNames', value: string) => {
    setHistory((prev) => {
      const newList = prev[type].filter((item) => item.value !== value);
      const newHistory = { ...prev, [type]: newList };
      saveHistory(newHistory);
      return newHistory;
    });
  }, []);

  const clearHistory = useCallback((type?: 'keywords' | 'classNames') => {
    setHistory((prev) => {
      const newHistory = type
        ? { ...prev, [type]: [] }
        : getDefaultHistory();
      saveHistory(newHistory);
      return newHistory;
    });
  }, []);

  const getHistoryList = useCallback((type: 'keywords' | 'classNames') => {
    return history[type].map((item) => item.value);
  }, [history]);

  return {
    keywords: history.keywords.map((item) => item.value),
    classNames: history.classNames.map((item) => item.value),
    addToHistory,
    removeFromHistory,
    clearHistory,
    getHistoryList,
  };
};
