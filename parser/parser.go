package parser

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"time"

	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"
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
// Pattern 5: dd.log format - "2026-04-07 08:48:09.582 [INFO   ] [worker-0] MESSAGE"
var logPatterns = []*regexp.Regexp{
	// dd.log format: timestamp [LEVEL] [thread] message
	regexp.MustCompile(`^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+\[(TRACE|DEBUG|INFO|FINE|WARN|WARNING|ERROR|SEVERE)\s*\]\s+\[([^\]]+)\]\s*(.*)$`),
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

	// Try to detect and handle UTF-16 encoding (common in Windows Java logs)
	// Read first few bytes to check for BOM
	buf := make([]byte, 3)
	n, _ := file.Read(buf)
	file.Seek(0, io.SeekStart)

	var reader io.Reader = file
	if n >= 2 {
		// Check for UTF-16 LE BOM (FF FE) or UTF-16 BE BOM (FE FF)
		if buf[0] == 0xFF && buf[1] == 0xFE {
			// UTF-16 LE
			reader = transform.NewReader(file, unicode.UTF16(unicode.LittleEndian, unicode.UseBOM).NewDecoder())
		} else if buf[0] == 0xFE && buf[1] == 0xFF {
			// UTF-16 BE
			reader = transform.NewReader(file, unicode.UTF16(unicode.BigEndian, unicode.UseBOM).NewDecoder())
		}
	}

	var entries []LogEntry
	var currentEntry *LogEntry
	var messageLines []string

	scanner := bufio.NewScanner(reader)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()

		// Try each pattern to see if this line starts a new log entry
		var parsedEntry *LogEntry
		var parsedMessage string

		// Try all patterns in order
		for i, pattern := range logPatterns {
			matches := pattern.FindStringSubmatch(line)
			if matches != nil {
				ts, err := time.Parse("2006-01-02 15:04:05.000", matches[1])
				if err != nil {
					return nil, fmt.Errorf("parser: invalid timestamp at line %d: %w", lineNum, err)
				}

				switch i {
				case 0: // dd.log format: timestamp [LEVEL] [thread] message
					parsedEntry = &LogEntry{
						Timestamp: ts,
						Level:     normalizeLevel(matches[2]),
						Source:    matches[3],
						Class:     matches[3],
					}
					parsedMessage = matches[4]

				case 1: // rtls format: timestamp LEVEL [Source:line] - message
					source := matches[3]
					parsedEntry = &LogEntry{
						Timestamp: ts,
						Level:     matches[2],
						Source:    source,
						Class:     extractClass(source),
					}
					parsedMessage = matches[4]

				case 2: // thread-first format: timestamp [thread] LEVEL class.method - message
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

				case 3: // security format: timestamp LEVEL [CONTEXT] TYPE key=value pairs
					context := matches[3]
					logType := matches[4]
					parsedEntry = &LogEntry{
						Timestamp: ts,
						Level:     matches[2],
						Source:    context,
						Class:     context,
					}
					parsedMessage = logType + " " + matches[5]

				case 4: // generic fallback: timestamp LEVEL ...
					rest := matches[3]
					parsedEntry = &LogEntry{
						Timestamp: ts,
						Level:     matches[2],
						Source:    rest,
						Class:     extractClassFromGeneric(rest),
					}
					parsedMessage = rest
				}
				break
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

// normalizeLevel converts various log level names to standard ones
func normalizeLevel(level string) string {
	switch level {
	case "FINE":
		return "DEBUG"
	case "SEVERE":
		return "ERROR"
	case "WARNING":
		return "WARN"
	default:
		return level
	}
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

// FileContext holds information about the current file state
type FileContext struct {
	Path       string    `json:"path"`
	LastPos    int64     `json:"lastPos"`     // Last byte position read
	LastEntry  LogEntry  `json:"lastEntry"`   // Last successfully parsed entry
	FileSize   int64     `json:"fileSize"`    // File size at last read
	ModTime    time.Time `json:"modTime"`     // File modification time at last read
}

// ParseFileIncremental parses only new entries from a log file
// Returns new entries and updated file context
func ParseFileIncremental(ctx FileContext) ([]LogEntry, FileContext, error) {
	file, err := os.Open(ctx.Path)
	if err != nil {
		return nil, ctx, fmt.Errorf("parser: failed to open file: %w", err)
	}
	defer file.Close()

	// Get current file info
	fileInfo, err := file.Stat()
	if err != nil {
		return nil, ctx, fmt.Errorf("parser: failed to stat file: %w", err)
	}

	currentSize := fileInfo.Size()
	currentModTime := fileInfo.ModTime()

	// Check if file was truncated (log rotation)
	if currentSize < ctx.LastPos {
		// File was truncated, need full reload
		entries, err := ParseFile(ctx.Path)
		if err != nil {
			return nil, ctx, err
		}

		newCtx := FileContext{
			Path:      ctx.Path,
			LastPos:   currentSize,
			FileSize:  currentSize,
			ModTime:   currentModTime,
		}
		if len(entries) > 0 {
			newCtx.LastEntry = entries[len(entries)-1]
		}
		return entries, newCtx, nil
	}

	// Check if file was modified
	if currentModTime.Equal(ctx.ModTime) && currentSize == ctx.FileSize {
		// No changes
		return []LogEntry{}, ctx, nil
	}

	// Try to detect and handle UTF-16 encoding
	// For incremental parsing, we need to handle the encoding at the specific offset
	// Read first few bytes to check for BOM
	buf := make([]byte, 3)
	n, _ := file.Read(buf)
	file.Seek(0, io.SeekStart)

	var reader io.Reader = file
	isUTF16 := false
	var byteOrder unicode.Endianness

	if n >= 2 {
		if buf[0] == 0xFF && buf[1] == 0xFE {
			isUTF16 = true
			byteOrder = unicode.LittleEndian
		} else if buf[0] == 0xFE && buf[1] == 0xFF {
			isUTF16 = true
			byteOrder = unicode.BigEndian
		}
	}

	// Seek to last position
	_, err = file.Seek(ctx.LastPos, io.SeekStart)
	if err != nil {
		return nil, ctx, fmt.Errorf("parser: failed to seek to position %d: %w", ctx.LastPos, err)
	}

	// For UTF-16, we need to handle the offset carefully
	// UTF-16 characters are 2 bytes, so we need to ensure we're at a character boundary
	if isUTF16 {
		// Adjust position if needed to be on character boundary
		pos := ctx.LastPos
		if pos%2 != 0 {
			pos-- // Align to even boundary
			file.Seek(pos, io.SeekStart)
		}
		reader = transform.NewReader(file, unicode.UTF16(byteOrder, unicode.UseBOM).NewDecoder())
	} else {
		reader = file
	}

	var entries []LogEntry
	var currentEntry *LogEntry
	var messageLines []string
	var lastValidEntry *LogEntry

	scanner := bufio.NewScanner(reader)
	// Increase buffer size for long lines
	bufSize := 1024 * 1024 // 1MB
	scanner.Buffer(make([]byte, bufSize), bufSize)

	for scanner.Scan() {
		line := scanner.Text()

		// Try each pattern to see if this line starts a new log entry
		var parsedEntry *LogEntry
		var parsedMessage string

		for i, pattern := range logPatterns {
			matches := pattern.FindStringSubmatch(line)
			if matches != nil {
				ts, err := time.Parse("2006-01-02 15:04:05.000", matches[1])
				if err != nil {
					continue // Skip invalid timestamp
				}

				switch i {
				case 0: // dd.log format
					parsedEntry = &LogEntry{
						Timestamp: ts,
						Level:     normalizeLevel(matches[2]),
						Source:    matches[3],
						Class:     matches[3],
					}
					parsedMessage = matches[4]

				case 1: // rtls format
					source := matches[3]
					parsedEntry = &LogEntry{
						Timestamp: ts,
						Level:     matches[2],
						Source:    source,
						Class:     extractClass(source),
					}
					parsedMessage = matches[4]

				case 2: // thread-first format
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

				case 3: // security format
					context := matches[3]
					logType := matches[4]
					parsedEntry = &LogEntry{
						Timestamp: ts,
						Level:     matches[2],
						Source:    context,
						Class:     context,
					}
					parsedMessage = logType + " " + matches[5]

				case 4: // generic fallback
					rest := matches[3]
					parsedEntry = &LogEntry{
						Timestamp: ts,
						Level:     matches[2],
						Source:    rest,
						Class:     extractClassFromGeneric(rest),
					}
					parsedMessage = rest
				}
				break
			}
		}

		if parsedEntry != nil {
			// Save the previous entry if exists
			if currentEntry != nil {
				currentEntry.Message = strings.Join(messageLines, "\n")
				// Check if this is a duplicate of the last entry from context
				if currentEntry.Timestamp.Format("2006-01-02 15:04:05.000") != ctx.LastEntry.Timestamp.Format("2006-01-02 15:04:05.000") ||
					currentEntry.Message != ctx.LastEntry.Message {
					entries = append(entries, *currentEntry)
					lastValidEntry = currentEntry
				}
			}

			currentEntry = parsedEntry
			messageLines = []string{parsedMessage}
		} else if currentEntry != nil {
			// Continuation of previous entry
			messageLines = append(messageLines, line)
		}
	}

	// Don't forget the last entry
	if currentEntry != nil {
		currentEntry.Message = strings.Join(messageLines, "\n")
		// Check if this is a duplicate of the last entry from context
		if currentEntry.Timestamp.Format("2006-01-02 15:04:05.000") != ctx.LastEntry.Timestamp.Format("2006-01-02 15:04:05.000") ||
			currentEntry.Message != ctx.LastEntry.Message {
			entries = append(entries, *currentEntry)
			lastValidEntry = currentEntry
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, ctx, fmt.Errorf("parser: scanner error: %w", err)
	}

	// Update file context
	newCtx := FileContext{
		Path:      ctx.Path,
		LastPos:   currentSize,
		FileSize:  currentSize,
		ModTime:   currentModTime,
		LastEntry: ctx.LastEntry, // Keep old entry if no new entries
	}

	if lastValidEntry != nil {
		newCtx.LastEntry = *lastValidEntry
	}

	return entries, newCtx, nil
}
