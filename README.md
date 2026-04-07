# analyze-log

Java 로그 파일 분석용 로컬 Windows 데스크탑 애플리케이션.

## 개요

Wails v2 (Go + React) 기반으로 제작된 로그 분석 도구입니다. 서버 없이 `.exe` 단일 파일로 배포되며, SQLite FTS5 전체 텍스트 검색을 지원합니다.

## 주요 기능

- 파일 드래그앤드롭 및 파일 선택으로 로그 로드
- 로그 레벨 필터링 (TRACE/DEBUG/INFO/WARN/ERROR)
- FTS5 기반 빠른 키워드 검색
- 클래스명 필터링
- 시간 범위 필터링
- 페이징된 로그 목록 보기
- 스택트레이스 접기/펼치기

## 개발

```bash
wails dev
```

Vite 개발 서버가 실행되며 프론트엔드 변경사항이 핫 리로드됩니다.
브라우저에서 http://localhost:34115 에 접속하면 Go 메서드를 테스트할 수 있습니다.

## 빌드

```bash
wails build
```

`build/bin/analyze-log.exe` 단일 실행 파일이 생성됩니다.

## 사양 요구사항

- Windows 11 Pro 10.0.26200 이상
- CGO (MinGW-w64) - SQLite 의존성으로 인해 필요
