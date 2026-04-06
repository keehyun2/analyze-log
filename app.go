package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"analyze-log/parser"
	"analyze-log/store"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx   context.Context
	store *store.Store
}

// AppSettings holds application settings
type AppSettings struct {
	LastOpenedFile   string `json:"lastOpenedFile"`
	AutoLoadLastFile bool   `json:"autoLoadLastFile"`
	Theme            string `json:"theme"`
	FontSize         int    `json:"fontSize"`
	DisplayMode      string `json:"displayMode"`
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	fmt.Println("[App] Startup completed")
}

// shutdown is called when the app exits
func (a *App) shutdown(ctx context.Context) {
	if a.store != nil {
		a.store.Close()
	}
}

// LoadResult represents the result of loading a log file
type LoadResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Count   int    `json:"count"`
}

// LoadFile loads a log file and indexes it
//wails:export
func (a *App) LoadFile(path string) (LoadResult, error) {
	// Parse the file
	entries, err := parser.ParseFile(path)
	if err != nil {
		return LoadResult{
			Success: false,
			Message: fmt.Sprintf("Parse failed: %v", err),
		}, err
	}

	// Create or recreate store
	if a.store != nil {
		a.store.Close()
	}

	newStore, err := store.NewStore()
	if err != nil {
		return LoadResult{
			Success: false,
			Message: fmt.Sprintf("Store init failed: %v", err),
		}, err
	}
	a.store = newStore

	// Insert all entries
	for _, entry := range entries {
		_, err := a.store.Insert(entry.Timestamp, entry.Level, entry.Source, entry.Class, entry.Message)
		if err != nil {
			return LoadResult{
				Success: false,
				Message: fmt.Sprintf("Insert failed: %v", err),
			}, err
		}
	}

	// Save to settings
	if err := a.SaveLastFile(path); err != nil {
		fmt.Printf("[App] Failed to save last file: %v\n", err)
	}

	return LoadResult{
		Success: true,
		Message: fmt.Sprintf("Loaded %d entries", len(entries)),
		Count:   len(entries),
	}, nil
}

// SearchQuery represents search parameters (must match frontend type)
type SearchQuery struct {
	Keyword   string `json:"keyword"`
	Level     string `json:"level"`
	Class     string `json:"class"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
	Page      int    `json:"page"`
	PageSize  int    `json:"pageSize"`
}

// SearchResult represents search results
type SearchResult struct {
	Entries []store.LogEntry `json:"entries"`
	Total   int              `json:"total"`
	Page    int              `json:"page"`
}

// SearchLogs searches the indexed logs
//wails:export
func (a *App) SearchLogs(query SearchQuery) (SearchResult, error) {
	if a.store == nil {
		return SearchResult{
			Entries: []store.LogEntry{},
			Total:   0,
			Page:    query.Page,
		}, nil
	}

	q := store.SearchQuery{
		Keyword:   query.Keyword,
		Level:     query.Level,
		Class:     query.Class,
		StartTime: query.StartTime,
		EndTime:   query.EndTime,
		Page:      query.Page,
		PageSize:  query.PageSize,
	}

	result, err := a.store.Search(q)
	if err != nil {
		return SearchResult{}, err
	}

	return SearchResult{
		Entries: result.Entries,
		Total:   result.Total,
		Page:    result.Page,
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

// GetStats returns statistics about the loaded logs
//wails:export
func (a *App) GetStats() (Stats, error) {
	if a.store == nil {
		return Stats{
			ByClass: make(map[string]int),
		}, nil
	}

	s, err := a.store.GetStats()
	if err != nil {
		return Stats{}, err
	}

	return Stats{
		Total:  s.Total,
		Trace:  s.Trace,
		Debug:  s.Debug,
		Info:   s.Info,
		Warn:   s.Warn,
		Error:  s.Error,
		ByClass: s.ByClass,
	}, nil
}

// Greet returns a greeting (kept for testing)
//wails:export
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// OpenFileDialog opens a file dialog and returns the selected path
//wails:export
func (a *App) OpenFileDialog() (string, error) {
	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Log File",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Log Files",
				Pattern:     "*.log;*.txt",
			},
			{
				DisplayName: "All Files",
				Pattern:     "*.*",
			},
		},
	})
	if err != nil {
		return "", err
	}
	return selection, nil
}

// GetSettings returns the current application settings
//wails:export
func (a *App) GetSettings() (AppSettings, error) {
	settingsPath, err := a.getSettingsPath()
	if err != nil {
		return AppSettings{AutoLoadLastFile: false}, nil
	}

	data, err := os.ReadFile(settingsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return AppSettings{AutoLoadLastFile: false}, nil
		}
		return AppSettings{AutoLoadLastFile: false}, err
	}

	var settings AppSettings
	if err := json.Unmarshal(data, &settings); err != nil {
		return AppSettings{AutoLoadLastFile: false}, err
	}

	return settings, nil
}

// SetSettings updates the application settings
//wails:export
func (a *App) SetSettings(settings AppSettings) error {
	settingsPath, err := a.getSettingsPath()
	if err != nil {
		return err
	}

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(settingsPath), 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(settingsPath, data, 0644)
}

// GetLastFile returns the last opened file path
//wails:export
func (a *App) GetLastFile() (string, error) {
	settings, err := a.GetSettings()
	if err != nil {
		return "", err
	}
	return settings.LastOpenedFile, nil
}

// SaveLastFile saves the last opened file path
func (a *App) SaveLastFile(path string) error {
	settings, err := a.GetSettings()
	if err != nil {
		return err
	}
	settings.LastOpenedFile = path
	return a.SetSettings(settings)
}

// getSettingsPath returns the path to the settings file
func (a *App) getSettingsPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "analyze-log", "settings.json"), nil
}
