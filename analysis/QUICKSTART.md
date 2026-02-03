# OpenClaw 확장 개발 퀵 스타트

> **빠르게 시작하기**: 5분 안에 첫 번째 확장 추가하기

---

## 🚀 시작하기 전에

이 가이드를 따라하기 전에:

- ✅ OpenClaw가 설치되어 있어야 합니다
- ✅ 기본적인 TypeScript 지식이 필요합니다
- ✅ 터미널 사용에 익숙해야 합니다

**필요한 시간**: 각 5-10분

---

## 1️⃣ 첫 번째 Skill 만들기 (5분)

### Step 1: Skill 디렉토리 생성

```bash
mkdir -p ~/.openclaw/skills/hello-skill
```

### Step 2: Skill 파일 작성

`~/.openclaw/skills/hello-skill/skill.md`:

```markdown
---
name: hello-skill
description: My first OpenClaw skill
emoji: 👋
user-invocable: true
---

# Hello Skill

이것은 나의 첫 번째 OpenClaw 스킬입니다!

## 사용 방법

이 스킬은 인사하는 방법을 알려줍니다.

### 예시

```bash
echo "Hello, OpenClaw!"
```

### 주의사항

- 친절하게 인사하세요!
```

### Step 3: 테스트

```bash
# Skill 목록 확인
openclaw skills list

# Skill 사용
openclaw agent --message "/hello-skill"
```

**완료!** 🎉 첫 번째 Skill을 만들었습니다!

---

## 2️⃣ Custom LLM 추가하기 (5분)

### Step 1: 환경 변수 설정

```bash
export MY_LLM_API_KEY="your-api-key-here"
```

### Step 2: Config 파일 수정

`~/.openclaw/config.yaml`에 추가:

```yaml
models:
  providers:
    my-llm:
      api: openai
      baseUrl: https://api.my-llm.com/v1
      apiKey: ${MY_LLM_API_KEY}
      models:
        - id: my-model
          name: My Custom Model
          contextWindow: 128000
          maxTokens: 4096
```

### Step 3: 테스트

```bash
# 모델 목록 확인
openclaw models list | grep my-llm

# 모델 사용
openclaw agent --message "Hello" --model my-llm/my-model
```

**완료!** 🎉 Custom LLM을 추가했습니다!

---

## 3️⃣ 간단한 CLI 명령 추가하기 (10분)

### Step 1: 명령 파일 생성

`src/cli/program/register.hello.ts`:

```typescript
import type { Command } from "commander";

export function registerHelloCommand(program: Command) {
  program
    .command("hello")
    .description("Say hello")
    .option("--name <name>", "Your name", "World")
    .action(async (opts) => {
      console.log(`Hello, ${opts.name}! 👋`);
    });
}
```

### Step 2: 프로그램에 등록

`src/cli/program/build-program.ts`에 추가:

```typescript
import { registerHelloCommand } from "./register.hello.js";

export async function buildProgram() {
  // ... 기존 코드 ...

  registerHelloCommand(program);

  return program;
}
```

### Step 3: 빌드 및 테스트

```bash
# 빌드
npm run build

# 테스트
openclaw hello
openclaw hello --name "OpenClaw"
```

**완료!** 🎉 첫 번째 CLI 명령을 추가했습니다!

---

## 📚 다음 단계

### 더 배우기

1. **[Extension Guide](./extension-guide.md)**
   - 신규 메신저 통합 (KakaoTalk 예시)
   - Advanced LLM 설정
   - Tool Dispatch Skill
   - 복잡한 CLI 명령 (SubCLI)

2. **[Architecture Analysis](./openclaw-architecture-analysis.md)**
   - 시스템 내부 동작 이해
   - 핵심 컴포넌트 파악

3. **[Templates](./templates/)**
   - Channel Plugin 템플릿
   - Skill 템플릿
   - CLI Command 템플릿

### 실전 프로젝트 아이디어

#### 초급

- ✅ 간단한 유틸리티 Skill (날씨, 시간, 계산기)
- ✅ Custom LLM 추가 (Ollama, LM Studio)
- ✅ 정보 조회 CLI 명령 (status, info)

#### 중급

- 🔶 메신저 통합 (Line, WeChat, Viber)
- 🔶 API 연동 Skill (GitHub, Jira, Notion)
- 🔶 데이터 분석 CLI 명령

#### 고급

- 🔴 복잡한 Channel Plugin (음성 메시지, 스티커)
- 🔴 Multi-step Skill (대화형 워크플로우)
- 🔴 Agent 확장 (Custom Tool, Hook)

---

## 💡 팁 & 트릭

### 개발 모드

```bash
# Watch 모드로 빌드
npm run dev

# 빠른 테스트
npm test -- --watch
```

### 디버깅

```bash
# 디버그 로그 활성화
export DEBUG=openclaw:*

# 특정 모듈만
export DEBUG=openclaw:skills:*
```

### 코드 스타일

```bash
# Lint
npm run lint

# Format
npm run format
```

---

## 🆘 도움말

### 자주 묻는 질문

**Q: Skill이 목록에 안 나와요**
```bash
# Skill 디렉토리 확인
ls -la ~/.openclaw/skills/

# 권한 확인
chmod -R 755 ~/.openclaw/skills/
```

**Q: Custom LLM이 작동 안 해요**
```bash
# API 키 확인
echo $MY_LLM_API_KEY

# 연결 테스트
curl -H "Authorization: Bearer $MY_LLM_API_KEY" https://api.my-llm.com/v1/models
```

**Q: CLI 명령이 안 보여요**
```bash
# 빌드 확인
npm run build

# 명령 목록 확인
openclaw --help
```

### 더 많은 도움

- 📖 [Full Extension Guide](./extension-guide.md)
- 🎨 [Code Templates](./templates/)
- 💬 GitHub Issues
- 📧 Community Forum

---

**행운을 빕니다! 🚀**

첫 번째 OpenClaw 확장을 만들어보세요!
