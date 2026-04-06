# 개발 계획

## Phase 1 — 파서 + SQLite (Go)

### 1-1. 프로젝트 초기화
```bash
wails init -n analyze-log -t react-ts
cd analyze-log
go get github.com/mattn/go-sqlite3
```

### 1-2. 파서 구현 (`parser/parser.go`)
- 정규식으로 로그 엔트리 시작 감지
- 멀티라인 처리 (스택트레이스, REQUEST/RESPONSE 블록)
- `[]LogEntry` 반환

### 1-3. SQLite 스토어 구현 (`store/store.go`)
- `log_entries` 테이블 생성
- FTS5 가상 테이블 생성
- `Insert`, `Search`, `GetStats` 메서드

### 1-4. Wails 바인딩 (`app.go`)
- `LoadFile(path string) (LoadResult, error)`
- `SearchLogs(query SearchQuery) (SearchResult, error)`
- `GetStats() (Stats, error)`

---

## Phase 2 — React UI

### 2-1. 레이아웃
```
┌─────────────────────────────────┐
│  파일 드롭존 (로드 전) /         │
│  검색바 + 필터 (로드 후)         │
├─────────────────────────────────┤
│  레벨 카운트 배지                │
├─────────────────────────────────┤
│  로그 목록                       │
│  - timestamp | level | source   │
│  - message (스택트레이스 접기)   │
└─────────────────────────────────┘
```

### 2-2. 컴포넌트
- `FileDropZone` — 파일 드래그앤드롭
- `FilterBar` — 레벨 체크박스, 키워드, 클래스, 시간범위
- `StatsBadge` — 레벨별 카운트
- `LogList` — 가상 스크롤 목록
- `LogEntry` — 단일 로그 행 (스택트레이스 토글)

---

## Phase 3 — 마무리

- [ ] 대용량 파일 테스트 (100MB+)
- [ ] 검색 성능 튜닝 (FTS5 인덱스 확인)
- [ ] `wails build` → exe 테스트
- [ ] Windows Defender 경고 확인

---

## SQLite 스키마

```sql
CREATE TABLE log_entries (
    id        INTEGER PRIMARY KEY,
    timestamp TEXT NOT NULL,
    level     TEXT NOT NULL,
    source    TEXT NOT NULL,
    class     TEXT NOT NULL,
    message   TEXT NOT NULL
);

CREATE VIRTUAL TABLE logs_fts USING fts5(
    level, source, class, message,
    content='log_entries',
    content_rowid='id',
    tokenize='unicode61'
);

-- 트리거: log_entries 삽입 시 FTS 자동 동기화
CREATE TRIGGER log_entries_ai AFTER INSERT ON log_entries BEGIN
    INSERT INTO logs_fts(rowid, level, source, class, message)
    VALUES (new.id, new.level, new.source, new.class, new.message);
END;
```

---

## 검색 쿼리 예시

```sql
-- 키워드 + 레벨 필터
SELECT e.* FROM logs_fts f
JOIN log_entries e ON e.id = f.rowid
WHERE logs_fts MATCH 'RequestRejectedException'
  AND e.level = 'ERROR'
ORDER BY e.timestamp DESC
LIMIT 100 OFFSET 0;

-- 시간 범위
SELECT * FROM log_entries
WHERE timestamp BETWEEN '2026-01-01 14:00:00' AND '2026-01-01 15:00:00'
ORDER BY timestamp DESC;
```
