# OpenClaw Architecture Analysis

이 폴더는 OpenClaw 에이전트 시스템의 아키텍처와 동작 방식에 대한 상세 분석 자료를 포함합니다.

**분석 날짜**: 2026-02-04

---

## 📚 문서 목록

### 1. [extension-guide.md](./extension-guide.md) ⭐ NEW

**OpenClaw 확장 가이드 (실전 가이드)**

신규 메신저, Custom LLM, Skills, CLI 명령을 추가하는 방법을 단계별로 설명합니다.

**내용**:
1. **신규 메신저 API 통합**
   - Channel Plugin 시스템 소개
   - 실전 예시: KakaoTalk 플러그인 추가
   - 메시지 발송/수신, Webhook, 온보딩, 상태 확인
   - Channel Tool 추가
2. **Custom LLM (OpenAI Compatible API) 추가**
   - models.json 설정
   - 실전 예시: Custom LLM 추가
   - 프로그래매틱 추가 (동적 모델 발견)
   - Auth Profile 관리
   - Custom Provider API 인터페이스
3. **Skill 개발 및 추가**
   - Skill 구조 및 Frontmatter 필드
   - 실전 예시: Git Helper Skill
   - Tool Dispatch Skill
   - Skill 설정 (필터링)
4. **CLI 명령 추가**
   - CLI 명령 구조
   - 실전 예시: `analyze` 명령 추가
   - SubCLI 등록
   - Plugin CLI 추가
5. **종합 예시**: 전체 통합 시나리오
6. **디버깅 및 테스트**
7. **배포 및 공유**

**분량**: 약 1,500 라인 (코드 예시 포함)

**대상 독자**: 개발자, 확장 기여자

---

### 2. [openclaw-architecture-analysis.md](./openclaw-architecture-analysis.md)

**OpenClaw 에이전트 아키텍처 상세 분석 (주요 문서)**

전체 시스템의 아키텍처와 핵심 컴포넌트를 코드 레벨에서 분석한 문서입니다.

**내용**:
- 개요 및 기술 스택
- 전체 아키텍처 (레이어별 구조)
- 사용자 질의 처리 흐름
  - CLI Entry → Command Router → Agent Handler
  - Gateway vs Local 모드
- 오케스트레이션 레이어
  - 세션 라우팅 (채널/계정/피어 기반)
  - Auth Profile 순환
  - 모델 폴백
  - Context window 관리
- 런타임 액션 실행
  - Embedded Agent Runner
  - Attempt Executor
  - Tool Execution
- 핵심 컴포넌트
  - Configuration Management
  - Session Store
  - Auth Profiles
  - Tool Policy Engine
  - Sandbox Isolation
- 주요 설계 패턴
  - Command Queue Pattern
  - Retry with Fallback Pattern
  - Hook System
  - Stream Processing
- 코드 레벨 분석
  - Entry to Agent Command
  - Embedded Agent Runner
  - Tool Execution Flow
  - Session File Format

**분량**: 약 2,500 라인

**대상 독자**: 개발자, 시스템 아키텍트

---

### 2. [architecture-diagrams.md](./architecture-diagrams.md)

**OpenClaw 아키텍처 Mermaid 다이어그램 모음**

시스템의 구조와 동작을 시각화한 12개의 Mermaid 다이어그램을 포함합니다.

**다이어그램 목록**:

1. **전체 시스템 아키텍처** (Graph)
   - Entry → Command → Orchestration → Runtime → Tools

2. **사용자 질의 처리 흐름** (Sequence Diagram)
   - User → CLI → Route → Fallback → Runner → LLM → Tools

3. **세션 라우팅 메커니즘** (Flowchart)
   - 채널/계정/피어/길드/팀 매칭 우선순위

4. **모델 폴백 및 Auth Profile 순환** (State Diagram)
   - Profile 순환 → Model 폴백 상태 전이

5. **Embedded Agent Runner 실행 흐름** (Flowchart)
   - 큐 → 워크스페이스 → 모델 → Auth → Thinking → Attempt

6. **Attempt Executor 상세 흐름** (Sequence Diagram)
   - Sandbox → Skills → Tools → Session → Agent → LLM

7. **Tool Execution 아키텍처** (Graph)
   - Tool Creation → Policy → Wrappers → Execution

8. **Bash/Exec Tool 실행 흐름** (Flowchart)
   - Security Check → Approval → Sandbox/PTY → Output

9. **Session Lock 및 동시성 제어** (Sequence Diagram)
   - 병렬 요청의 직렬화 과정

10. **Tool Policy 해결 흐름** (Flowchart)
    - Global → Agent → Provider → Group → Sandbox → Subagent

11. **데이터 흐름 다이어그램** (Graph)
    - Input → Session → Runtime → Execution → Output

12. **Error Handling 및 Retry 전략** (State Diagram)
    - Context Overflow/Auth Error/Rate Limit/Thinking Error/Timeout

**분량**: 약 800 라인 (다이어그램 코드 포함)

**대상 독자**: 모든 사용자 (시각적 이해)

---

### 3. [conversation-summary.md](./conversation-summary.md)

**분석 대화 및 프로세스 요약**

OpenClaw 분석 과정, 주요 발견 사항, 핵심 인사이트를 정리한 문서입니다.

**내용**:
- 대화 개요
  - 사용자 요청
  - 분석 범위
- 분석 프로세스
  - Phase 1: 코드베이스 탐색
  - Phase 2: 핵심 파일 상세 분석
  - Phase 3: 문서 작성
- 주요 발견 사항
  1. 멀티 레이어 아키텍처
  2. 강력한 Fallback 메커니즘
  3. 세밀한 Tool Policy 시스템
  4. 큐 기반 동시성 제어
  5. Hook System으로 확장성
  6. 샌드박스 격리
  7. Approval Flow
- 핵심 인사이트
  - 설계 철학 (Resilience/Security/Multi-Channel/Developer-Friendly)
  - 기술적 강점
  - 개선 가능 영역
- 코드 품질 평가
- 학습 포인트
  - Retry with Multiple Fallback Layers
  - Policy Composition
  - Session-based Queueing
  - Stream Processing
  - Hook System
- 아키텍처 패턴 정리
- 결론 및 향후 분석 주제

**분량**: 약 1,000 라인

**대상 독자**: 개발자, 프로젝트 관리자

---

## 🎯 읽는 순서 추천

### 초심자 (OpenClaw 처음 접하는 경우)

1. **[conversation-summary.md](./conversation-summary.md)** - 전체 개요 파악
2. **[architecture-diagrams.md](./architecture-diagrams.md)** - 시각적 이해
   - 다이어그램 1-3 먼저 보기 (전체 구조)
3. **[openclaw-architecture-analysis.md](./openclaw-architecture-analysis.md)** - 상세 분석
   - 관심 있는 섹션부터 읽기

### 개발자 (기여하려는 경우)

1. **[openclaw-architecture-analysis.md](./openclaw-architecture-analysis.md)**
   - 섹션 2-5: 아키텍처 및 핵심 로직
   - 섹션 6: 핵심 컴포넌트
   - 섹션 8: 코드 레벨 분석
2. **[architecture-diagrams.md](./architecture-diagrams.md)**
   - 관련 다이어그램 참조
3. **[conversation-summary.md](./conversation-summary.md)**
   - 학습 포인트 및 개선 가능 영역

### 아키텍트 (시스템 설계 참고)

1. **[conversation-summary.md](./conversation-summary.md)**
   - 설계 철학 및 아키텍처 패턴
2. **[openclaw-architecture-analysis.md](./openclaw-architecture-analysis.md)**
   - 섹션 2, 4, 7: 아키텍처 및 설계 패턴
3. **[architecture-diagrams.md](./architecture-diagrams.md)**
   - 다이어그램 1, 4, 10, 12 (전체/폴백/정책/에러)

### 확장 개발자 (신규 기능 추가)

1. **[extension-guide.md](./extension-guide.md)** ⭐
   - 단계별 확장 가이드
   - 실전 코드 예시
2. **[templates/](./templates/)** 폴더의 템플릿 활용
   - Channel Plugin 템플릿
   - Skill 템플릿
   - CLI Command 템플릿
3. **[openclaw-architecture-analysis.md](./openclaw-architecture-analysis.md)**
   - 섹션 6: 핵심 컴포넌트 이해

---

## 📦 코드 템플릿

### [templates/](./templates/) 폴더

실제 개발에 바로 사용 가능한 코드 템플릿을 제공합니다.

#### 1. [channel-plugin-template.ts](./templates/channel-plugin-template.ts)

**신규 메신저 채널 플러그인 템플릿**

```typescript
// 복사하여 사용: src/channels/plugins/<your-channel>.ts
export const myChannelPlugin: ChannelPlugin = {
  id: "my-channel",
  meta: { /* ... */ },
  capabilities: { /* ... */ },
  config: { /* ... */ },
  outbound: { /* ... */ },
  gateway: { /* ... */ },
  // ...
};
```

**포함 내용**:
- ✅ 기본 플러그인 구조
- ✅ 메시지 발송/수신 어댑터
- ✅ Webhook 처리
- ✅ 온보딩 마법사
- ✅ 상태 확인
- ✅ 설정 스키마
- ✅ TODO 체크리스트

#### 2. [skill-template.md](./templates/skill-template.md)

**Skill 개발 템플릿**

```markdown
---
name: my-skill
description: Brief description
emoji: 🔧
requires:
  bins: [python3]
user-invocable: true
---

# My Skill

## 사용 방법
...
```

**포함 내용**:
- ✅ YAML Frontmatter 전체 필드
- ✅ 구조화된 문서 템플릿
- ✅ 설치 방법 섹션
- ✅ 예시 및 코드 샘플
- ✅ 문제 해결 가이드

#### 3. [cli-command-template.ts](./templates/cli-command-template.ts)

**CLI 명령 추가 템플릿**

```typescript
// 복사하여 사용: src/cli/program/register.<command>.ts
export function registerMyCommand(program: Command) {
  program
    .command("my-command")
    .description("...")
    .option("--input <path>", "...")
    .action(async (opts) => { /* ... */ });
}
```

**포함 내용**:
- ✅ 명령 등록 구조
- ✅ 옵션 정의 및 검증
- ✅ 에러 핸들링
- ✅ 출력 포맷 (JSON/YAML/Table)
- ✅ SubCLI 패턴
- ✅ TODO 체크리스트

---

## 🔍 주요 키워드

- **Architecture**: 멀티 레이어, 마이크로서비스 패턴
- **Orchestration**: 세션 라우팅, Auth profile 순환, 모델 폴백
- **Execution**: Embedded runner, Attempt executor, Tool execution
- **Concurrency**: 큐 기반 제어, Session lock
- **Security**: Tool policy, Approval flow, Sandbox isolation
- **Resilience**: 다층 폴백, 자동 복구, Graceful degradation
- **Extensibility**: Hook system, Plugin architecture

---

## 🛠️ 핵심 컴포넌트 파일 위치

| 컴포넌트 | 파일 위치 | 역할 |
|---------|----------|------|
| Agent Command Handler | `src/commands/agent.ts` | 에이전트 명령 처리 |
| Route Resolver | `src/routing/resolve-route.ts` | 세션 라우팅 |
| Model Fallback | `src/agents/model-fallback.ts` | 모델 폴백 로직 |
| Embedded Runner | `src/agents/pi-embedded-runner/run.ts` | 에이전트 실행 |
| Attempt Executor | `src/agents/pi-embedded-runner/run/attempt.ts` | 단일 시도 실행 |
| Tool Creator | `src/agents/pi-tools.ts` | 도구 생성 및 필터링 |
| Bash Tool | `src/agents/bash-tools.exec.ts` | Bash/Exec 도구 |
| Channel Tools | `src/agents/channel-tools.ts` | 채널 통합 도구 |
| Config Manager | `src/config/config.ts` | 설정 관리 |
| Session Store | `src/config/sessions.ts` | 세션 저장소 |

---

## 📊 통계

- **분석 소요 시간**: 약 60분
- **생성된 문서**: 5개 (README 포함)
- **코드 템플릿**: 3개
- **총 라인 수**: 약 8,000 라인
- **다이어그램 수**: 12개
- **분석한 주요 파일**: 12개
- **코드 예시**: 100+ 개

---

## 💡 활용 방법

### 1. 온보딩 자료

신규 개발자가 OpenClaw 시스템을 이해하는 데 활용할 수 있습니다.

**추천 순서**:
1. conversation-summary.md 읽기
2. architecture-diagrams.md의 다이어그램 1-3 보기
3. openclaw-architecture-analysis.md의 섹션 3-5 읽기
4. 실제 코드 읽으면서 다이어그램 참조

### 2. 시스템 설계 참고

유사한 AI 에이전트 시스템을 설계할 때 참고 자료로 활용할 수 있습니다.

**참고할 패턴**:
- Command Queue Pattern (동시성 제어)
- Chain of Responsibility (Tool Policy)
- Retry with Multiple Fallback Layers
- Hook System (확장성)

### 3. 코드 리뷰 가이드

코드 리뷰 시 아키텍처 일관성을 확인하는 데 활용할 수 있습니다.

**체크리스트**:
- [ ] 새 기능이 기존 레이어 구조를 따르는가?
- [ ] Tool policy가 적절히 적용되었는가?
- [ ] Fallback 메커니즘이 있는가?
- [ ] Error handling이 적절한가?

### 4. 기술 문서 작성

프로젝트 문서를 작성할 때 템플릿으로 활용할 수 있습니다.

**재사용 가능한 섹션**:
- 아키텍처 다이어그램
- 컴포넌트 설명
- 설계 패턴
- 코드 예시

### 5. 확장 개발

신규 기능을 추가할 때 가이드와 템플릿을 활용할 수 있습니다.

**개발 프로세스**:
1. [extension-guide.md](./extension-guide.md)에서 해당 섹션 읽기
2. [templates/](./templates/) 폴더에서 템플릿 복사
3. TODO 주석 따라가며 구현
4. 테스트 작성
5. 문서 업데이트

**예시**:

```bash
# 1. 템플릿 복사
cp analysis/templates/channel-plugin-template.ts src/channels/plugins/line.ts

# 2. TODO 검색 및 구현
grep -n "TODO" src/channels/plugins/line.ts

# 3. 테스트
npm test src/channels/plugins/line.test.ts

# 4. 문서 업데이트
# extension-guide.md에 예시 추가
```

---

## 🔗 관련 리소스

### OpenClaw 프로젝트

- **메인 리포지토리**: (프로젝트 URL)
- **문서**: (문서 URL)
- **Issues**: (이슈 트래커 URL)

### 참고 기술

- **pi-agent-core**: AI 에이전트 코어 라이브러리
- **pi-coding-agent**: 코딩 에이전트 SDK
- **Node.js**: 런타임 환경
- **TypeScript**: 타입 시스템

---

## 📝 피드백 및 개선

이 분석 자료에 대한 피드백이나 개선 제안이 있으시면:

1. **이슈 생성**: 프로젝트 이슈 트래커에 등록
2. **Pull Request**: 직접 수정하여 PR 제출
3. **토론**: 프로젝트 디스커션에 의견 남기기

---

## 📜 라이선스

이 분석 자료는 OpenClaw 프로젝트와 동일한 라이선스를 따릅니다.

---

## ✍️ 작성자

**Claude Sonnet 4.5** (Anthropic)

**작성일**: 2026-02-04

**버전**: 1.0

---

**Happy Coding! 🚀**
