# CLAUDE.md — analyze-log

## 프로젝트 개요

Java 로그 파일 분석용 **로컬 Windows 데스크탑 앱**.
Wails v2 (Go + React) 기반. 서버 없이 `.exe` 단일 파일로 배포.

## 기술 스택

- Go 1.21+, Wails v2, SQLite FTS5 (`mattn/go-sqlite3`)
- React 18 + TypeScript + Vite
- CSS: Tailwind or plain CSS (외부 UI 라이브러리 최소화)

---

## 아키텍처 원칙

### Go ↔ React 통신
- HTTP 서버 사용 금지. Wails 바인딩으로만 통신
- Go 메서드는 모두 `app.go`에 정의, `wails:expose` 태그로 export
- 에러는 반드시 반환값으로 처리 (`(Result, error)` 패턴)

```go
// app.go 패턴
func (a *App) SearchLogs(query SearchQuery) (SearchResult, error) { ... }
func (a *App) LoadFile(path string) (LoadResult, error) { ... }
func (a *App) GetStats() (Stats, error) { ... }
```

### 파서 규칙
- 로그 엔트리 시작: `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\s+(TRACE|DEBUG|INFO|WARN|ERROR)`
- 멀티라인: 위 패턴으로 시작하지 않는 행은 이전 엔트리의 message에 append
- 스택트레이스는 message 필드에 포함 (별도 파싱 불필요)

### SQLite FTS5
- 인덱싱 테이블: `log_entries` (원본), `logs_fts` (FTS5 가상 테이블)
- 검색 시 `MATCH` 연산자 사용, `bm25()` 로 정렬
- 파일 로드 시 기존 DB 초기화 후 재인덱싱

---

## 코드 규칙

### Go
- 패키지: `parser`, `store` 분리
- 에러 래핑: `fmt.Errorf("store: %w", err)`
- 대용량 파일 대비 `bufio.Scanner` 사용 (한 줄씩 읽기)
- goroutine 사용 시 반드시 에러 채널 또는 WaitGroup 처리

### React / TypeScript
- `any` 타입 사용 금지
- Wails 자동생성 타입 (`frontend/wailsjs/go/`) 그대로 사용
- 컴포넌트는 `components/` 디렉토리에 기능별 분리
- 상태관리: useState/useReducer로 충분, 외부 라이브러리 불필요
- **브라우저 가상 요소 사용 금지** (`::-webkit-`, `::-moz-` 등 - 크로스 브라우저 호환성 문제)

---

## 주요 데이터 구조

```go
type LogEntry struct {
    ID        int64     `json:"id"`
    Timestamp time.Time `json:"timestamp"`
    Level     string    `json:"level"`      // TRACE|DEBUG|INFO|WARN|ERROR
    Source    string    `json:"source"`     // "LogAspect.logging:39"
    Class     string    `json:"class"`      // "LogAspect"
    Message   string    `json:"message"`    // 멀티라인 포함
}

type SearchQuery struct {
    Keyword   string `json:"keyword"`
    Level     string `json:"level"`      // 빈 문자열 = 전체
    Class     string `json:"class"`
    StartTime string `json:"startTime"`  // "2026-01-01 00:00:00"
    EndTime   string `json:"endTime"`
    Page      int    `json:"page"`
    PageSize  int    `json:"pageSize"`   // 기본 100
}

type SearchResult struct {
    Entries    []LogEntry `json:"entries"`
    Total      int        `json:"total"`
    Page       int        `json:"page"`
}
```

---

## UI 기능 목록

### 필수 구현
- [ ] 파일 드래그앤드롭 + 파일 선택 버튼
- [ ] 로드 진행률 표시
- [ ] 레벨 필터 (TRACE/DEBUG/INFO/WARN/ERROR 체크박스)
- [ ] 키워드 검색 (FTS5)
- [ ] 클래스명 필터
- [ ] 시간 범위 필터
- [ ] 로그 목록 (페이징 or 가상 스크롤)
- [ ] 스택트레이스 접기/펼치기

### 선택 구현
- [ ] 레벨별 카운트 통계 (상단 배지)
- [ ] 로그 라인 클릭 시 상세 보기
- [ ] 여러 파일 탭 지원

---

## 빌드

```bash
wails dev      # 개발 (핫리로드)
wails build    # 프로덕션 → build/bin/analyze-log.exe
```

## 주의사항

- `mattn/go-sqlite3` 는 CGO 필요 → Windows에서 MinGW-w64 설치 필요
- Wails 빌드 전 `wails doctor` 로 환경 확인
- SQLite DB 파일은 임시 (`os.TempDir()`) 에 생성, 앱 종료 시 삭제
