package store

import (
	"database/sql"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// Store handles SQLite database operations
type Store struct {
	db       *sql.DB
	dbPath   string
	mu       sync.RWMutex
	hasFTS5  bool
}

// NewStore creates a new store with a temporary database file
func NewStore() (*Store, error) {
	// Create temp file for SQLite DB
	tmpFile, err := os.CreateTemp("", "analyze-log-*.db")
	if err != nil {
		return nil, fmt.Errorf("store: failed to create temp file: %w", err)
	}
	dbPath := tmpFile.Name()
	tmpFile.Close()

	db, err := sql.Open("sqlite3", dbPath+"?_foreign_keys=on")
	if err != nil {
		os.Remove(dbPath)
		return nil, fmt.Errorf("store: failed to open database: %w", err)
	}

	// Enable WAL mode for better concurrent access
	if _, err := db.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		db.Close()
		os.Remove(dbPath)
		return nil, fmt.Errorf("store: failed to enable WAL: %w", err)
	}

	store := &Store{
		db:      db,
		dbPath:  dbPath,
		hasFTS5: false,
	}

	if err := store.initSchema(); err != nil {
		db.Close()
		os.Remove(dbPath)
		return nil, fmt.Errorf("store: schema init failed: %w", err)
	}

	return store, nil
}

// initSchema creates the necessary tables and FTS5 index
func (s *Store) initSchema() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Main log entries table
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS log_entries (
			id        INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp TEXT NOT NULL,
			level     TEXT NOT NULL,
			source    TEXT NOT NULL,
			class     TEXT NOT NULL,
			message   TEXT NOT NULL
		);
	`)
	if err != nil {
		return fmt.Errorf("create log_entries: %w", err)
	}

	// Try to create FTS5 virtual table - if it fails, we'll use LIKE queries
	_, err = s.db.Exec(`
		CREATE VIRTUAL TABLE IF NOT EXISTS logs_fts USING fts5(
			level, source, class, message,
			content='log_entries',
			content_rowid='id',
			tokenize='unicode61'
		);
	`)
	if err == nil {
		s.hasFTS5 = true
		// Trigger to sync FTS with main table
		_, err = s.db.Exec(`
			CREATE TRIGGER IF NOT EXISTS log_entries_ai AFTER INSERT ON log_entries BEGIN
				INSERT INTO logs_fts(rowid, level, source, class, message)
				VALUES (new.id, new.level, new.source, new.class, new.message);
			END;
		`)
		if err != nil {
			return fmt.Errorf("create trigger: %w", err)
		}
	}
	// If FTS5 fails, we'll use LIKE queries (hasFTS5 remains false)

	return nil
}

// Insert inserts a log entry into the database
func (s *Store) Insert(timestamp time.Time, level, source, class, message string) (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	result, err := s.db.Exec(
		"INSERT INTO log_entries (timestamp, level, source, class, message) VALUES (?, ?, ?, ?, ?)",
		timestamp.Format("2006-01-02 15:04:05.000"),
		level,
		source,
		class,
		message,
	)
	if err != nil {
		return 0, fmt.Errorf("store: insert failed: %w", err)
	}

	return result.LastInsertId()
}

// Clear removes all entries from the database
func (s *Store) Clear() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, err := s.db.Exec("DELETE FROM log_entries;")
	if err != nil {
		return fmt.Errorf("store: clear failed: %w", err)
	}

	return nil
}

// SearchQuery represents search parameters
type SearchQuery struct {
	Keyword   string
	Level     string // empty = all
	Class     string
	StartTime string
	EndTime   string
	Page      int
	PageSize  int
}

// SearchResult represents search results
type SearchResult struct {
	Entries []LogEntry
	Total   int
	Page    int
}

// LogEntry represents a log entry from the database
type LogEntry struct {
	ID        int64  `json:"id"`
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Source    string `json:"source"`
	Class     string `json:"class"`
	Message   string `json:"message"`
}

// Search performs a search with the given query
func (s *Store) Search(q SearchQuery) (*SearchResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if q.PageSize <= 0 {
		q.PageSize = 100
	}
	if q.Page < 1 {
		q.Page = 1
	}
	offset := (q.Page - 1) * q.PageSize

	// Build query based on parameters
	var query string
	var args []interface{}
	var countQuery string
	var countArgs []interface{}

	if q.Keyword != "" && s.hasFTS5 {
		// Use FTS5 for keyword search
		query = `
			SELECT e.id, e.timestamp, e.level, e.source, e.class, e.message
			FROM logs_fts f
			JOIN log_entries e ON e.id = f.rowid
			WHERE logs_fts MATCH ?
		`
		countQuery = `
			SELECT COUNT(DISTINCT e.id)
			FROM logs_fts f
			JOIN log_entries e ON e.id = f.rowid
			WHERE logs_fts MATCH ?
		`
		args = append(args, q.Keyword)
		countArgs = append(countArgs, q.Keyword)
	} else {
		// Use LIKE queries (fallback)
		query = `
			SELECT id, timestamp, level, source, class, message
			FROM log_entries
			WHERE 1=1
		`
		countQuery = `
			SELECT COUNT(*)
			FROM log_entries
			WHERE 1=1
		`

		if q.Keyword != "" {
			// Split keyword by spaces and search for each part
			keywords := strings.Fields(q.Keyword)
			for _, kw := range keywords {
				query += " AND (message LIKE ? OR class LIKE ? OR source LIKE ?)"
				countQuery += " AND (message LIKE ? OR class LIKE ? OR source LIKE ?)"
				likePattern := "%" + kw + "%"
				args = append(args, likePattern, likePattern, likePattern)
				countArgs = append(countArgs, likePattern, likePattern, likePattern)
			}
		}
	}

	// Add filters
	if q.Level != "" {
		// Handle comma-separated levels
		levels := strings.Split(q.Level, ",")
		if len(levels) == 1 {
			query += " AND level = ?"
			countQuery += " AND level = ?"
			args = append(args, q.Level)
			countArgs = append(countArgs, q.Level)
		} else {
			placeholders := make([]string, len(levels))
			levelArgs := make([]interface{}, len(levels))
			for i, lvl := range levels {
				placeholders[i] = "?"
				levelArgs[i] = strings.TrimSpace(lvl)
			}
			query += " AND level IN (" + strings.Join(placeholders, ",") + ")"
			countQuery += " AND level IN (" + strings.Join(placeholders, ",") + ")"
			args = append(args, levelArgs...)
			countArgs = append(countArgs, levelArgs...)
		}
	}

	if q.Class != "" {
		query += " AND class LIKE ?"
		countQuery += " AND class LIKE ?"
		args = append(args, "%"+q.Class+"%")
		countArgs = append(countArgs, "%"+q.Class+"%")
	}

	if q.StartTime != "" {
		query += " AND timestamp >= ?"
		countQuery += " AND timestamp >= ?"
		args = append(args, q.StartTime)
		countArgs = append(countArgs, q.StartTime)
	}

	if q.EndTime != "" {
		query += " AND timestamp <= ?"
		countQuery += " AND timestamp <= ?"
		args = append(args, q.EndTime)
		countArgs = append(countArgs, q.EndTime)
	}

	// Get total count
	fmt.Printf("[Store] Search query: %s\n", query)
	fmt.Printf("[Store] Count query: %s\n", countQuery)
	fmt.Printf("[Store] Args: %+v\n", args)
	var total int
	err := s.db.QueryRow(countQuery, countArgs...).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("store: count failed: %w", err)
	}
	fmt.Printf("[Store] Total count: %d\n", total)

	// Add ordering and pagination
	query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
	args = append(args, q.PageSize, offset)

	// Execute query
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("store: search failed: %w", err)
	}
	defer rows.Close()

	var entries []LogEntry
	for rows.Next() {
		var e LogEntry
		err := rows.Scan(&e.ID, &e.Timestamp, &e.Level, &e.Source, &e.Class, &e.Message)
		if err != nil {
			return nil, fmt.Errorf("store: scan failed: %w", err)
		}
		entries = append(entries, e)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("store: rows error: %w", err)
	}

	return &SearchResult{
		Entries: entries,
		Total:   total,
		Page:    q.Page,
	}, nil
}

// Stats holds statistics about log entries
type Stats struct {
	Total  int            `json:"total"`
	Trace  int            `json:"trace"`
	Debug  int            `json:"debug"`
	Info   int            `json:"info"`
	Warn   int            `json:"warn"`
	Error  int            `json:"error"`
	ByClass map[string]int `json:"byClass"`
}

// GetStats returns statistics about the log entries
func (s *Store) GetStats() (*Stats, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stats := &Stats{
		ByClass: make(map[string]int),
	}

	// Get counts by level
	rows, err := s.db.Query(`
		SELECT level, COUNT(*) as count
		FROM log_entries
		GROUP BY level
	`)
	if err != nil {
		return nil, fmt.Errorf("store: stats query failed: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var level string
		var count int
		if err := rows.Scan(&level, &count); err != nil {
			return nil, fmt.Errorf("store: stats scan failed: %w", err)
		}
		switch level {
		case "TRACE":
			stats.Trace = count
		case "DEBUG":
			stats.Debug = count
		case "INFO":
			stats.Info = count
		case "WARN":
			stats.Warn = count
		case "ERROR":
			stats.Error = count
		}
		stats.Total += count
	}

	// Get top 20 classes
	classRows, err := s.db.Query(`
		SELECT class, COUNT(*) as count
		FROM log_entries
		GROUP BY class
		ORDER BY count DESC
		LIMIT 20
	`)
	if err != nil {
		return nil, fmt.Errorf("store: class stats query failed: %w", err)
	}
	defer classRows.Close()

	for classRows.Next() {
		var class string
		var count int
		if err := classRows.Scan(&class, &count); err != nil {
			return nil, fmt.Errorf("store: class stats scan failed: %w", err)
		}
		stats.ByClass[class] = count
	}

	return stats, nil
}

// DateRange holds min and max timestamps
type DateRange struct {
	Min string
	Max string
}

// GetDateRange returns the minimum and maximum timestamps from log entries
func (s *Store) GetDateRange() (*DateRange, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var min, max string

	// Get min timestamp
	err := s.db.QueryRow("SELECT MIN(timestamp) FROM log_entries").Scan(&min)
	if err != nil {
		return nil, fmt.Errorf("store: min timestamp failed: %w", err)
	}

	// Get max timestamp
	err = s.db.QueryRow("SELECT MAX(timestamp) FROM log_entries").Scan(&max)
	if err != nil {
		return nil, fmt.Errorf("store: max timestamp failed: %w", err)
	}

	return &DateRange{
		Min: min,
		Max: max,
	}, nil
}

// Close closes the database connection and removes the temp file
func (s *Store) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db != nil {
		if err := s.db.Close(); err != nil {
			return err
		}
	}

	if s.dbPath != "" {
		os.Remove(s.dbPath)
		// Also remove WAL files
		os.Remove(s.dbPath + "-wal")
		os.Remove(s.dbPath + "-shm")
	}

	return nil
}
