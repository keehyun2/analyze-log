package parser

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"
)

// LogEntry represents a single log entry
type LogEntry struct {
	ID        int64     `json:"id"`
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"`      // TRACE|DEBUG|INFO|WARN|ERROR
	Source    string    `json:"source"`     // "LogAspect.logging:39"
	Class     string    `json:"class"`      // "LogAspect"
	Message   string    `json:"message"`    // 멀티라인 포함
}

// logEntryRegex matches the start of a log entry
// Example: 2026-04-06 10:30:45.123 INFO [LogAspect.logging:39] - Log message
//         2026-01-01 11:34:22.814 DEBUG [JwtFilter.doFilterInternal:40] - message
var logEntryRegex = regexp.MustCompile(`^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+(TRACE|DEBUG|INFO|WARN|ERROR)\s+\[([^\]]+:\d+)\]\s*-\s*(.*)$`)

// ParseFile parses a log file and returns log entries
func ParseFile(filePath string) ([]LogEntry, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("parser: failed to open file: %w", err)
	}
	defer file.Close()

	var entries []LogEntry
	var currentEntry *LogEntry
	var messageLines []string

	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()

		// Check if this line starts a new log entry
		matches := logEntryRegex.FindStringSubmatch(line)
		if matches != nil {
			// Save the previous entry if exists
			if currentEntry != nil {
				currentEntry.Message = strings.Join(messageLines, "\n")
				entries = append(entries, *currentEntry)
			}

			// Parse timestamp
			ts, err := time.Parse("2006-01-02 15:04:05.000", matches[1])
			if err != nil {
				return nil, fmt.Errorf("parser: invalid timestamp at line %d: %w", lineNum, err)
			}

			// Parse source to extract class name
			// Source format: "LogAspect.logging:39" -> Class: "LogAspect"
			source := matches[3]
			class := extractClass(source)

			currentEntry = &LogEntry{
				Timestamp: ts,
				Level:     matches[2],
				Source:    source,
				Class:     class,
			}
			messageLines = []string{matches[4]}
		} else if currentEntry != nil {
			// Continuation of previous entry (multiline message/stacktrace)
			messageLines = append(messageLines, line)
		}
	}

	// Don't forget the last entry
	if currentEntry != nil {
		currentEntry.Message = strings.Join(messageLines, "\n")
		entries = append(entries, *currentEntry)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("parser: scanner error: %w", err)
	}

	return entries, nil
}

// extractClass extracts the class name from the source string
// "LogAspect.logging:39" -> "LogAspect"
// "com.example.MyClass.method:123" -> "com.example.MyClass"
func extractClass(source string) string {
	// Remove the method/line part (after the last colon)
	parts := strings.Split(source, ":")
	if len(parts) < 2 {
		return source
	}

	// Get the class.method part
	classMethod := strings.Join(parts[:len(parts)-1], ":")

	// Extract just the class name (before the last dot if exists)
	lastDot := strings.LastIndex(classMethod, ".")
	if lastDot == -1 {
		return classMethod
	}

	return classMethod[:lastDot]
}
