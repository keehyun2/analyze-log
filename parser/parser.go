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

// logPatterns lists supported log formats in priority order
// Pattern 1: rtls format - "2026-01-01 09:14:29.567 DEBUG [Class.method:line] - msg"
// Pattern 2: database/application-rolling format - "2024-03-15 09:00:00.001 [main] INFO  com.class.Class - msg"
// Pattern 3: exceptions format - "2024-03-15 10:00:01.000 ERROR [thread] com.class.Class - msg"
// Pattern 4: security format - "2024-03-15 08:00:00.000 INFO  [SECURITY] EVENT key=val"
var logPatterns = []*regexp.Regexp{
	// Original rtls format: timestamp LEVEL [Source:line] - message
	regexp.MustCompile(`^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+(TRACE|DEBUG|INFO|WARN|ERROR)\s+\[([^\]]+:\d+)\]\s*-\s*(.*)$`),
	// Thread-first format: timestamp [thread] LEVEL class.method - message
	// This handles database.log, application-rolling.log, exceptions.log
	regexp.MustCompile(`^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+\[([^\]]+)\]\s+(TRACE|DEBUG|INFO|WARN|ERROR)\s+(\S+)\s*-\s*(.*)$`),
	// Security/structured format: timestamp LEVEL [CONTEXT] EVENT key=value pairs
	regexp.MustCompile(`^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+(TRACE|DEBUG|INFO|WARN|ERROR)\s+\[([^\]]+)\]\s+(\S+)\s+(.*)$`),
	// Generic fallback: timestamp LEVEL ... (capture rest)
	regexp.MustCompile(`^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+(TRACE|DEBUG|INFO|WARN|ERROR)\s+(.*)$`),
}

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

		// Try each pattern to see if this line starts a new log entry
		var parsedEntry *LogEntry
		var parsedMessage string

		// Pattern 1: rtls format - timestamp LEVEL [Source:line] - message
		matches := logPatterns[0].FindStringSubmatch(line)
		if matches != nil {
			ts, err := time.Parse("2006-01-02 15:04:05.000", matches[1])
			if err != nil {
				return nil, fmt.Errorf("parser: invalid timestamp at line %d: %w", lineNum, err)
			}
			source := matches[3]
			parsedEntry = &LogEntry{
				Timestamp: ts,
				Level:     matches[2],
				Source:    source,
				Class:     extractClass(source),
			}
			parsedMessage = matches[4]
		}

		// Pattern 2: thread-first format - timestamp [thread] LEVEL class.method - message
		if parsedEntry == nil {
			matches = logPatterns[1].FindStringSubmatch(line)
			if matches != nil {
				ts, err := time.Parse("2006-01-02 15:04:05.000", matches[1])
				if err != nil {
					return nil, fmt.Errorf("parser: invalid timestamp at line %d: %w", lineNum, err)
				}
				thread := matches[2]
				class := matches[4]
				source := class + ":" + thread
				parsedEntry = &LogEntry{
					Timestamp: ts,
					Level:     matches[3],
					Source:    source,
					Class:     extractClass(class),
				}
				parsedMessage = matches[5]
			}
		}

		// Pattern 3: security format - timestamp LEVEL [CONTEXT] TYPE key=value pairs
		if parsedEntry == nil {
			matches = logPatterns[2].FindStringSubmatch(line)
			if matches != nil {
				ts, err := time.Parse("2006-01-02 15:04:05.000", matches[1])
				if err != nil {
					return nil, fmt.Errorf("parser: invalid timestamp at line %d: %w", lineNum, err)
				}
				context := matches[3]
				logType := matches[4]
				// Combine type with key-value pairs for full message
				parsedEntry = &LogEntry{
					Timestamp: ts,
					Level:     matches[2],
					Source:    context,
					Class:     context,
				}
				parsedMessage = logType + " " + matches[5]
			}
		}

		// Pattern 4: generic fallback - timestamp LEVEL ...
		if parsedEntry == nil {
			matches = logPatterns[3].FindStringSubmatch(line)
			if matches != nil {
				ts, err := time.Parse("2006-01-02 15:04:05.000", matches[1])
				if err != nil {
					return nil, fmt.Errorf("parser: invalid timestamp at line %d: %w", lineNum, err)
				}
				rest := matches[3]
				parsedEntry = &LogEntry{
					Timestamp: ts,
					Level:     matches[2],
					Source:    rest,
					Class:     extractClassFromGeneric(rest),
				}
				parsedMessage = rest
			}
		}

		if parsedEntry != nil {
			// Save the previous entry if exists
			if currentEntry != nil {
				currentEntry.Message = strings.Join(messageLines, "\n")
				entries = append(entries, *currentEntry)
			}

			currentEntry = parsedEntry
			messageLines = []string{parsedMessage}
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

// extractClassFromGeneric tries to extract a class name from generic log format
// Handles formats like "com.example.Class - message" or "Class.method message"
func extractClassFromGeneric(rest string) string {
	// Look for common patterns in the rest string

	// Pattern: "com.example.ClassName - message"
	if idx := strings.Index(rest, " - "); idx > 0 {
		candidate := strings.TrimSpace(rest[:idx])
		if looksLikeClass(candidate) {
			return extractClass(candidate)
		}
	}

	// Pattern: "ClassName.methodName message"
	if idx := strings.Index(rest, " "); idx > 0 {
		candidate := strings.TrimSpace(rest[:idx])
		if strings.Contains(candidate, ".") && looksLikeClass(candidate) {
			return extractClass(candidate)
		}
	}

	// Fallback: return first "word" that looks like a class
	parts := strings.Fields(rest)
	for _, part := range parts {
		if looksLikeClass(part) {
			return extractClass(part)
		}
	}

	return "Unknown"
}

// looksLikeClass checks if a string looks like a Java class name
func looksLikeClass(s string) bool {
	// Must contain at least one dot (package) or be capitalized
	return strings.Contains(s, ".") || (len(s) > 0 && s[0] >= 'A' && s[0] <= 'Z')
}
