# SignPath.io 코드 서명 설정 가이드

## 개요

이 프로젝트는 SignPath Foundation의 무료 오픈소스 코드 서명 인증서를 사용하여 Windows 실행 파일에 서명합니다.

## 설정 단계

### 1. SignPath Foundation 신청

1. [SignPath 오픈소스 프로그램](https://signpath.io/product/open-source) 페이지에서 신청
2. 프로젝트 정보 제출:
   - 프로젝트 이름: analyze-log
   - 리포지토리: https://github.com/keehyun2/analyze-log
   - 설명: Java 로그 파일 분석용 Windows 데스크탑 앱

### 2. SignPath 조직 설정

1. SignPath 대시보드에서 조직 생성 또는 로그인
2. 다음 값들을 기록해 두세요:
   - **Organization ID**: 대시보드 URL에서 확인 (`https://app.signpath.io/OrganizationId/...`)
   - **Project Slug**: 프로젝트 설정에서 확인
   - **Signing Policy Slug**: 서명 정책 설정에서 확인

### 3. API 토큰 생성

1. SignPath → Users → API Tokens
2. "CI User" 또는 본인 계정에 API 토큰 생성
3. 토큰을 안전하게 보관 (한 번만 표시됨)

### 4. GitHub Secrets 설정

리포지토리 Settings → Secrets and variables → Actions → New repository secret:

| Secret 이름 | 값 | 설명 |
|------------|-----|------|
| `SIGNPATH_API_TOKEN` | 생성한 API 토큰 | SignPath API 인증 |
| `SIGNPATH_ORGANIZATION_ID` | 조직 ID | 예: `c2099ac1-b4b5-4b30-934e-3933c2d9922d` |
| `SIGNPATH_PROJECT_SLUG` | 프로젝트 슬러그 | 예: `analyze-log` |
| `SIGNPATH_SIGNING_POLICY_SLUG` | 서명 정책 슬러그 | 예: `release-signing` |
| `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` | 아티팩트 설정 슬러그 | 예: `windows-executable` |

### 5. 아티팩트 설정 (SignPath)

SignPath 대시보드에서:
1. Project → Artifact Configurations
2. Windows 실행 파일용 설정 추가:
   - **File extensions**: `.exe`
   - **Description**: Windows executable
3. 생성된 설정의 **Slug**를 기록해두세요 (예: `windows-executable`)

## 워크플로우 동작

태그 푸시 (`v*`) 시 자동으로:
1. Wails로 Windows 빌드
2. SignPath에 서명 요청 제출
3. 서명된 아티팩트 다운로드
4. GitHub Release에 업로드

## 참고 문서

- [SignPath 문서](https://docs.signpath.io/)
- [빌드 시스템 통합](https://docs.signpath.io/build-system-integration)
- [오픈소스 프로그램](https://signpath.io/product/open-source)
