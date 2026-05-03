# analyze-log

A local Windows desktop application for analyzing Java log files.

## Overview

A log analysis tool built with Wails v2 (Go + React). Distributed as a single `.exe` file without a server, supporting SQLite FTS5 full-text search.

## Download

The latest release is available on [GitHub Releases](https://github.com/keehyun2/analyze-log/releases).

## Key Features

- Log level filtering (TRACE/DEBUG/INFO/WARN/ERROR)
- Fast keyword search powered by FTS5
- Class name filtering
- Time range filtering
- Paginated log list view
- Stack trace collapse/expand

## Development

```bash
wails dev
```

The Vite dev server will run with hot reload for frontend changes.
You can test Go methods by accessing http://localhost:34115 in your browser.

## Build

```bash
wails build
```

A single executable file `build/bin/analyze-log.exe` will be generated.

## System Requirements

- Windows 11 Pro 10.0.26200 or higher
- CGO (MinGW-w64) - Required due to SQLite dependency

## License

This project is distributed under the [MIT License](LICENSE).

## Code Signing Policy

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.io/foundation/).

### Team Roles

**Committers/Reviewers:**
- [@keehyun2](https://github.com/keehyun2) - Project maintainer with source code modification rights

**Approvers:**
- [@keehyun2](https://github.com/keehyun2) - Responsible for approving release signing

All release builds are automatically signed using SignPath Foundation's code signing certificate through GitHub Actions.

## Privacy Policy

This program will not transfer any information to other networked systems unless specifically requested by the user or the person installing or operating it.

- analyze-log is a fully local application that runs entirely on your machine
- No data is sent to any external servers
- All log file processing happens locally on your computer
- No telemetry or analytics are collected
