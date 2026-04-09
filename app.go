package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	stdruntime "runtime"

	"analyze-log/parser"
	"analyze-log/store"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/process"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"regexp"
)

// App struct
type App struct {
	ctx          context.Context
	store        *store.Store
	fileContext  *parser.FileContext
}

// AppSettings holds application settings
type AppSettings struct {
	LastOpenedFile       string                  `json:"lastOpenedFile"`
	AutoLoadLastFile     bool                    `json:"autoLoadLastFile"`
	Theme                string                  `json:"theme"`
	FontSize             int                     `json:"fontSize"`
	DisplayMode          string                  `json:"displayMode"`
	ShowResourceUsage    bool                    `json:"showResourceUsage"`
	AutoRefreshEnabled   bool                    `json:"autoRefreshEnabled"`
	AutoRefreshInterval  int                     `json:"autoRefreshInterval"` // seconds
	CustomFormats        []parser.CustomFormat   `json:"customFormats"`       // User-defined log formats
}

// SystemResource holds system resource usage information
type SystemResource struct {
	CPUUsage    float64 `json:"cpuUsage"`    // Percentage
	MemoryUsage float64 `json:"memoryUsage"` // Percentage in MB
	MemoryMB    float64 `json:"memoryMB"`    // Actual usage in MB
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
func (a *App) LoadFile(path string) LoadResult {
	// Load custom patterns from settings
	settings, _ := a.GetSettings()
	var customPatterns []*regexp.Regexp
	if len(settings.CustomFormats) > 0 {
		patterns, err := parser.LoadCustomPatterns(settings.CustomFormats)
		if err != nil {
			fmt.Printf("[App] Failed to load custom patterns: %v\n", err)
		} else {
			customPatterns = patterns
		}
	}

	// Parse the file
	entries, err := parser.ParseFile(path, customPatterns)
	if err != nil {
		return LoadResult{
			Success: false,
			Message: fmt.Sprintf("Parse failed: %v", err),
		}
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
		}
	}
	a.store = newStore

	// Insert all entries
	for _, entry := range entries {
		_, err := a.store.Insert(entry.Timestamp, entry.Level, entry.Source, entry.Class, entry.Message)
		if err != nil {
			return LoadResult{
				Success: false,
				Message: fmt.Sprintf("Insert failed: %v", err),
			}
		}
	}

	// Save file context for incremental refresh
	fileInfo, _ := os.Stat(path)
	var lastEntry parser.LogEntry
	if len(entries) > 0 {
		lastEntry = entries[len(entries)-1]
	}
	a.fileContext = &parser.FileContext{
		Path:      path,
		LastPos:   fileInfo.Size(),
		FileSize:  fileInfo.Size(),
		ModTime:   fileInfo.ModTime(),
		LastEntry: lastEntry,
	}

	// Save to settings
	if err := a.SaveLastFile(path); err != nil {
		fmt.Printf("[App] Failed to save last file: %v\n", err)
	}

	return LoadResult{
		Success: true,
		Message: fmt.Sprintf("Loaded %d entries", len(entries)),
		Count:   len(entries),
	}
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
	SortField string `json:"sortField"`
	SortOrder string `json:"sortOrder"`
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
		SortField: query.SortField,
		SortOrder: query.SortOrder,
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

// DateRange holds the min and max timestamps from the loaded logs
type DateRange struct {
	Min string `json:"min"`
	Max string `json:"max"`
}

// GetDateRange returns the minimum and maximum timestamps from the loaded logs
//wails:export
func (a *App) GetDateRange() (DateRange, error) {
	if a.store == nil {
		return DateRange{}, nil
	}

	dr, err := a.store.GetDateRange()
	if err != nil {
		return DateRange{}, err
	}

	return DateRange{
		Min: dr.Min,
		Max: dr.Max,
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

// RefreshResult represents the result of refreshing logs
type RefreshResult struct {
	Success    bool   `json:"success"`
	Message    string `json:"message"`
	NewCount   int    `json:"newCount"`
	TotalCount int    `json:"totalCount"`
}

// RefreshLogs refreshes the log file and loads newly appended entries
//wails:export
func (a *App) RefreshLogs() RefreshResult {
	if a.store == nil {
		return RefreshResult{
			Success: false,
			Message: "No file loaded",
		}
	}

	if a.fileContext == nil {
		return RefreshResult{
			Success: false,
			Message: "No file context available. Please load a file first.",
		}
	}

	// Load custom patterns from settings
	settings, _ := a.GetSettings()
	var customPatterns []*regexp.Regexp
	if len(settings.CustomFormats) > 0 {
		patterns, err := parser.LoadCustomPatterns(settings.CustomFormats)
		if err != nil {
			fmt.Printf("[App] Failed to load custom patterns: %v\n", err)
		} else {
			customPatterns = patterns
		}
	}

	// Parse incremental entries
	newEntries, newCtx, err := parser.ParseFileIncremental(*a.fileContext, customPatterns)
	if err != nil {
		return RefreshResult{
			Success: false,
			Message: fmt.Sprintf("Refresh failed: %v", err),
		}
	}

	// Check if file was truncated (need full reload)
	if newCtx.LastPos < a.fileContext.LastPos {
		// Clear and reload
		a.store.Close()
		newStore, err := store.NewStore()
		if err != nil {
			return RefreshResult{
				Success: false,
				Message: fmt.Sprintf("Store init failed: %v", err),
			}
		}
		a.store = newStore

		// Re-parse entire file
		entries, err := parser.ParseFile(a.fileContext.Path, customPatterns)
		if err != nil {
			return RefreshResult{
				Success: false,
				Message: fmt.Sprintf("Parse failed: %v", err),
			}
		}

		for _, entry := range entries {
			_, err := a.store.Insert(entry.Timestamp, entry.Level, entry.Source, entry.Class, entry.Message)
			if err != nil {
				return RefreshResult{
					Success: false,
					Message: fmt.Sprintf("Insert failed: %v", err),
				}
			}
		}
		a.fileContext = &newCtx

		return RefreshResult{
			Success:    true,
			Message:    fmt.Sprintf("File was truncated. Reloaded %d entries", len(entries)),
			NewCount:   len(entries),
			TotalCount: len(entries),
		}
	}

	// Insert new entries
	for _, entry := range newEntries {
		_, err := a.store.Insert(entry.Timestamp, entry.Level, entry.Source, entry.Class, entry.Message)
		if err != nil {
			return RefreshResult{
				Success: false,
				Message: fmt.Sprintf("Insert failed: %v", err),
			}
		}
	}

	// Update file context
	a.fileContext = &newCtx

	// Get total count
	stats, err := a.store.GetStats()
	totalCount := 0
	if err == nil {
		totalCount = stats.Total
	}

	if len(newEntries) == 0 {
		return RefreshResult{
			Success:    true,
			Message:    "No new entries",
			NewCount:   0,
			TotalCount: totalCount,
		}
	}

	return RefreshResult{
		Success:    true,
		Message:    fmt.Sprintf("Loaded %d new entries", len(newEntries)),
		NewCount:   len(newEntries),
		TotalCount: totalCount,
	}
}

// GetSystemResource returns current system resource usage
//wails:export
func (a *App) GetSystemResource() (SystemResource, error) {
	// Get CPU usage
	cpuPercent, err := cpu.Percent(0, false)
	if err != nil {
		cpuPercent = []float64{0}
	}

	// Get memory usage
	var memStats stdruntime.MemStats
	stdruntime.ReadMemStats(&memStats)

	// Get system memory info
	vmStat, err := mem.VirtualMemory()
	if err != nil {
		return SystemResource{
			CPUUsage:    cpuPercent[0],
			MemoryUsage: 0,
			MemoryMB:    float64(memStats.Alloc) / 1024 / 1024,
		}, nil
	}

	// Get current process memory usage
	currentProcess, err := process.NewProcess(int32(os.Getpid()))
	var processMem float64
	if err == nil {
		memInfo, err := currentProcess.MemoryInfo()
		if err == nil {
			processMem = float64(memInfo.RSS) / 1024 / 1024 // MB
		} else {
			processMem = float64(memStats.Alloc) / 1024 / 1024
		}
	} else {
		processMem = float64(memStats.Alloc) / 1024 / 1024
	}

	return SystemResource{
		CPUUsage:    cpuPercent[0],
		MemoryUsage: (processMem / float64(vmStat.Total)) * 100 * 1024 * 1024, // Percentage
		MemoryMB:    processMem,
	}, nil
}

// TestFormatResult represents the result of testing a custom format
type TestFormatResult struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
	Entry   parser.LogEntry `json:"entry,omitempty"`
}

// GetCustomFormats returns the list of custom formats
//wails:export
func (a *App) GetCustomFormats() ([]parser.CustomFormat, error) {
	settings, err := a.GetSettings()
	if err != nil {
		return []parser.CustomFormat{}, err
	}
	return settings.CustomFormats, nil
}

// AddCustomFormat adds a new custom format
//wails:export
func (a *App) AddCustomFormat(format parser.CustomFormat) error {
	settings, err := a.GetSettings()
	if err != nil {
		return err
	}

	// Generate ID if not provided
	if format.ID == "" {
		format = parser.NewCustomFormat(format.Name, format.Pattern, format.Description, format.Enabled)
	}

	settings.CustomFormats = append(settings.CustomFormats, format)
	return a.SetSettings(settings)
}

// UpdateCustomFormat updates an existing custom format
//wails:export
func (a *App) UpdateCustomFormat(id string, updated parser.CustomFormat) error {
	settings, err := a.GetSettings()
	if err != nil {
		return err
	}

	for i, format := range settings.CustomFormats {
		if format.ID == id {
			// Preserve ID and creation time
			updated.ID = id
			updated.CreatedAt = format.CreatedAt
			settings.CustomFormats[i] = updated
			return a.SetSettings(settings)
		}
	}

	return fmt.Errorf("custom format with id '%s' not found", id)
}

// DeleteCustomFormat deletes a custom format by ID
//wails:export
func (a *App) DeleteCustomFormat(id string) error {
	settings, err := a.GetSettings()
	if err != nil {
		return err
	}

	for i, format := range settings.CustomFormats {
		if format.ID == id {
			// Delete by removing from slice
			settings.CustomFormats = append(settings.CustomFormats[:i], settings.CustomFormats[i+1:]...)
			return a.SetSettings(settings)
		}
	}

	return fmt.Errorf("custom format with id '%s' not found", id)
}

// TestCustomFormat tests a custom format pattern against a sample log line
//wails:export
func (a *App) TestCustomFormat(pattern string, testLine string) TestFormatResult {
	// Validate required named groups
	if err := parser.ValidateNamedGroups(pattern); err != nil {
		return TestFormatResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	// Compile the pattern
	re, err := parser.CompileRegexp(pattern)
	if err != nil {
		return TestFormatResult{
			Success: false,
			Error:   fmt.Sprintf("Invalid regex: %v", err),
		}
	}

	// Try to parse the test line
	entry, _, err := parser.ParseCustomPattern(re, testLine, 0)
	if err != nil {
		return TestFormatResult{
			Success: false,
			Error:   err.Error(),
		}
	}

	if entry == nil {
		return TestFormatResult{
			Success: false,
			Error:   "Pattern did not match the test line",
		}
	}

	return TestFormatResult{
		Success: true,
		Entry:   *entry,
	}
}
