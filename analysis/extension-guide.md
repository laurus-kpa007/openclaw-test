# OpenClaw 확장 가이드

> **작성일**: 2026-02-04
> **목적**: OpenClaw에 신규 메신저, Custom LLM, Skills, CLI 명령을 추가하는 방법

---

## 목차

1. [신규 메신저 API 통합](#1-신규-메신저-api-통합)
2. [Custom LLM (OpenAI Compatible API) 추가](#2-custom-llm-openai-compatible-api-추가)
3. [Skill 개발 및 추가](#3-skill-개발-및-추가)
4. [CLI 명령 추가](#4-cli-명령-추가)

---

## 1. 신규 메신저 API 통합

### 1.1 개요

OpenClaw는 Channel Plugin 시스템을 통해 다양한 메신저를 지원합니다. 신규 메신저를 추가하려면 `ChannelPlugin` 인터페이스를 구현해야 합니다.

### 1.2 Channel Plugin 구조

**파일 위치**: `src/channels/plugins/<channel-id>.ts`

**핵심 인터페이스**:

```typescript
// src/channels/plugins/types.plugin.ts

export type ChannelPlugin<ResolvedAccount = any> = {
  // 필수 필드
  id: ChannelId;                          // 채널 고유 ID (예: "telegram", "whatsapp")
  meta: ChannelMeta;                      // 메타데이터 (이름, 설명, 순서)
  capabilities: ChannelCapabilities;      // 채널 기능 (text, media, reactions 등)

  // 설정
  config: ChannelConfigAdapter<ResolvedAccount>;
  configSchema?: ChannelConfigSchema;     // 설정 스키마 (UI 생성용)

  // 온보딩
  onboarding?: ChannelOnboardingAdapter;  // CLI 설정 마법사

  // 메시지 송수신
  outbound?: ChannelOutboundAdapter;      // 메시지 발송
  gateway?: ChannelGatewayAdapter<ResolvedAccount>;  // 메시지 수신 (Gateway 모드)

  // 인증 및 권한
  auth?: ChannelAuthAdapter;
  security?: ChannelSecurityAdapter<ResolvedAccount>;

  // 기타
  status?: ChannelStatusAdapter<ResolvedAccount>;  // 상태 확인
  messaging?: ChannelMessagingAdapter;    // 메시징 기능
  threading?: ChannelThreadingAdapter;    // 스레드 지원
  streaming?: ChannelStreamingAdapter;    // 스트리밍 응답
  agentTools?: ChannelAgentToolFactory | ChannelAgentTool[];  // 채널 전용 도구
  heartbeat?: ChannelHeartbeatAdapter;    // 하트비트
  // ...
};
```

### 1.3 실전 예시: KakaoTalk 플러그인 추가

#### Step 1: 플러그인 파일 생성

`src/channels/plugins/kakaotalk.ts`:

```typescript
import type { ChannelPlugin } from "./types.js";

export const kakaotalkPlugin: ChannelPlugin = {
  // 1. 기본 정보
  id: "kakaotalk",
  meta: {
    name: "KakaoTalk",
    label: "카카오톡",
    description: "카카오톡 메신저",
    order: 5,  // 표시 순서
  },

  // 2. 기능 명세
  capabilities: {
    text: true,           // 텍스트 메시지
    media: true,          // 미디어 (이미지, 비디오)
    reactions: true,      // 리액션 (이모지)
    threads: false,       // 스레드 미지원
    inlineButtons: true,  // 인라인 버튼
  },

  // 3. 설정 어댑터
  config: {
    // 계정 목록 반환
    listAccounts: async ({ cfg }) => {
      const kakaoConfig = cfg.channels?.kakaotalk;
      if (!kakaoConfig || typeof kakaoConfig !== "object") {
        return [];
      }

      const accounts = Object.keys(kakaoConfig);
      return accounts.map(accountId => ({
        accountId,
        label: `KakaoTalk (${accountId})`,
      }));
    },

    // 계정 설정 해결
    resolveAccount: async ({ cfg, accountId }) => {
      const kakaoConfig = cfg.channels?.kakaotalk;
      if (!kakaoConfig || typeof kakaoConfig !== "object") {
        return null;
      }

      const accountConfig = kakaoConfig[accountId];
      if (!accountConfig || typeof accountConfig !== "object") {
        return null;
      }

      return {
        accountId,
        apiKey: accountConfig.apiKey as string,
        secretKey: accountConfig.secretKey as string,
        webhookUrl: accountConfig.webhookUrl as string,
      };
    },
  },

  // 4. 설정 스키마 (UI 자동 생성용)
  configSchema: {
    schema: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          description: "KakaoTalk API Key",
        },
        secretKey: {
          type: "string",
          description: "KakaoTalk Secret Key",
        },
        webhookUrl: {
          type: "string",
          description: "Webhook URL for receiving messages",
        },
      },
      required: ["apiKey", "secretKey"],
    },
    uiHints: {
      apiKey: {
        label: "API Key",
        sensitive: true,
      },
      secretKey: {
        label: "Secret Key",
        sensitive: true,
      },
      webhookUrl: {
        label: "Webhook URL",
        placeholder: "https://your-domain.com/webhook/kakaotalk",
      },
    },
  },

  // 5. 메시지 발송 어댑터
  outbound: {
    deliveryMode: "direct",  // "direct" | "queue"
    chunker: async (text) => {
      // 텍스트를 청크로 분할 (KakaoTalk 최대 길이)
      const maxLength = 2000;
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += maxLength) {
        chunks.push(text.slice(i, i + maxLength));
      }
      return chunks;
    },
    textChunkLimit: 2000,

    // 텍스트 메시지 전송
    sendText: async ({ to, text, accountId, deps }) => {
      // KakaoTalk API 호출
      const account = await kakaotalkPlugin.config.resolveAccount({
        cfg: deps.config,
        accountId: accountId ?? "default",
      });

      if (!account) {
        throw new Error("KakaoTalk account not configured");
      }

      const response = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${account.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template_object: {
            object_type: "text",
            text: text,
            link: {
              web_url: account.webhookUrl,
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`KakaoTalk API error: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        channel: "kakaotalk",
        messageId: result.msg_id,
        chatId: to,
      };
    },

    // 미디어 메시지 전송
    sendMedia: async ({ to, text, mediaUrl, accountId, deps }) => {
      const account = await kakaotalkPlugin.config.resolveAccount({
        cfg: deps.config,
        accountId: accountId ?? "default",
      });

      if (!account) {
        throw new Error("KakaoTalk account not configured");
      }

      // 미디어 업로드 및 전송 로직
      // ...

      return {
        channel: "kakaotalk",
        messageId: "msg_123",
        chatId: to,
      };
    },
  },

  // 6. Gateway 어댑터 (메시지 수신)
  gateway: {
    // Gateway에서 호출할 메서드 목록
    methods: ["sendMessage", "handleWebhook"],

    // Webhook 핸들러
    handleWebhook: async ({ req, cfg, accountId }) => {
      // KakaoTalk Webhook 처리
      const body = await req.json();

      // Webhook 검증
      if (body.event === "message") {
        return {
          channel: "kakaotalk",
          accountId: accountId ?? "default",
          peer: {
            kind: "dm",
            id: body.user_key,
          },
          message: {
            text: body.content,
            messageId: body.msg_id,
            timestamp: Date.now(),
          },
        };
      }

      return null;
    },
  },

  // 7. 온보딩 어댑터 (CLI 설정)
  onboarding: {
    // 설정 마법사
    wizard: async ({ inquirer }) => {
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "apiKey",
          message: "KakaoTalk API Key:",
        },
        {
          type: "password",
          name: "secretKey",
          message: "KakaoTalk Secret Key:",
        },
        {
          type: "input",
          name: "webhookUrl",
          message: "Webhook URL:",
          default: "https://your-domain.com/webhook/kakaotalk",
        },
      ]);

      return {
        config: {
          channels: {
            kakaotalk: {
              default: {
                apiKey: answers.apiKey,
                secretKey: answers.secretKey,
                webhookUrl: answers.webhookUrl,
              },
            },
          },
        },
      };
    },
  },

  // 8. 상태 확인
  status: {
    check: async ({ accountId, cfg }) => {
      const account = await kakaotalkPlugin.config.resolveAccount({
        cfg,
        accountId: accountId ?? "default",
      });

      if (!account) {
        return {
          status: "error",
          message: "Account not configured",
        };
      }

      // API 연결 확인
      try {
        const response = await fetch("https://kapi.kakao.com/v2/user/me", {
          headers: {
            "Authorization": `Bearer ${account.apiKey}`,
          },
        });

        if (response.ok) {
          return {
            status: "ok",
            message: "Connected",
          };
        }

        return {
          status: "error",
          message: `API error: ${response.statusText}`,
        };
      } catch (error) {
        return {
          status: "error",
          message: String(error),
        };
      }
    },
  },
};
```

#### Step 2: 플러그인 등록

`extensions/index.ts` (또는 별도 플러그인 디렉토리):

```typescript
import { kakaotalkPlugin } from "./kakaotalk.js";

export function registerChannels(registry: PluginRegistry) {
  registry.registerChannel(kakaotalkPlugin);
}
```

#### Step 3: 설정 파일 추가

`~/.openclaw/config.yaml`:

```yaml
channels:
  kakaotalk:
    default:
      apiKey: "your-api-key"
      secretKey: "your-secret-key"
      webhookUrl: "https://your-domain.com/webhook/kakaotalk"

routing:
  bindings:
    - match:
        channel: kakaotalk
        accountId: default
      agentId: main
```

#### Step 4: CLI 온보딩

```bash
# KakaoTalk 설정
openclaw onboard kakaotalk

# 상태 확인
openclaw status kakaotalk
```

### 1.4 Channel Tool 추가 (선택 사항)

채널 전용 도구를 추가하여 에이전트가 KakaoTalk 특수 기능을 사용하도록 할 수 있습니다.

`src/channels/plugins/kakaotalk.ts` (계속):

```typescript
export const kakaotalkPlugin: ChannelPlugin = {
  // ... (이전 내용)

  // 9. 채널 전용 도구
  agentTools: [
    {
      name: "send_kakao_template",
      description: "Send a KakaoTalk template message",
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description: "Recipient user key",
          },
          templateType: {
            type: "string",
            enum: ["feed", "list", "location", "commerce"],
            description: "Template type",
          },
          content: {
            type: "object",
            description: "Template content",
          },
        },
        required: ["to", "templateType", "content"],
      },
      execute: async (params) => {
        // 템플릿 메시지 전송 로직
        // ...
        return {
          status: "sent",
          messageId: "msg_456",
        };
      },
    },
  ],
};
```

---

## 2. Custom LLM (OpenAI Compatible API) 추가

### 2.1 개요

OpenClaw는 `models.json`을 통해 LLM 제공자를 관리합니다. OpenAI Compatible API를 추가하려면 provider 설정과 모델 정의를 추가해야 합니다.

### 2.2 설정 파일 구조

**파일 위치**: `~/.openclaw/config.yaml`

```yaml
models:
  mode: merge  # "merge" | "replace"

  providers:
    # Custom LLM Provider
    my-custom-llm:
      api: openai        # OpenAI Compatible
      baseUrl: https://api.my-llm.com/v1
      apiKey: ${MY_LLM_API_KEY}  # 환경 변수

      models:
        - id: my-model-v1
          name: My Custom Model V1
          contextWindow: 128000
          maxTokens: 4096
          reasoning: false
          input: ["text", "image"]
          cost:
            input: 10     # per 1M tokens (cents)
            output: 30
            cacheRead: 1
            cacheWrite: 5
```

### 2.3 실전 예시: Custom LLM 추가

#### Step 1: 환경 변수 설정

`.env` 또는 셸 설정:

```bash
export MY_LLM_API_KEY="your-api-key-here"
```

#### Step 2: Config 파일 작성

`~/.openclaw/config.yaml`:

```yaml
models:
  mode: merge

  providers:
    # 1. OpenAI Compatible API (일반)
    my-custom-llm:
      api: openai
      baseUrl: https://api.my-llm.com/v1
      apiKey: ${MY_LLM_API_KEY}

      models:
        - id: custom-gpt-4
          name: Custom GPT-4
          contextWindow: 128000
          maxTokens: 4096
          reasoning: false
          input: ["text", "image"]
          cost:
            input: 15
            output: 45
            cacheRead: 2
            cacheWrite: 10

    # 2. Anthropic Compatible API (Claude 호환)
    my-claude-clone:
      api: anthropic
      baseUrl: https://api.my-claude.com
      apiKey: ${MY_CLAUDE_CLONE_KEY}

      models:
        - id: claude-clone-sonnet
          name: Claude Clone Sonnet
          contextWindow: 200000
          maxTokens: 8192
          reasoning: false
          input: ["text", "image"]
          cost:
            input: 3
            output: 15
            cacheRead: 0.3
            cacheWrite: 3.75

    # 3. Ollama (로컬)
    ollama:
      api: openai
      baseUrl: http://127.0.0.1:11434/v1
      apiKey: "ollama"  # Ollama는 API 키 불필요

      models:
        - id: llama3.2:latest
          name: Llama 3.2 (Local)
          contextWindow: 128000
          maxTokens: 4096
          reasoning: false
          input: ["text"]
          cost:
            input: 0
            output: 0
```

#### Step 3: 프로그래매틱 추가 (Advanced)

복잡한 인증이나 동적 모델 발견이 필요한 경우:

`src/agents/models-config.providers.ts` (기존 파일 수정):

```typescript
// 1. Custom Provider 상수 정의
const MY_CUSTOM_LLM_BASE_URL = "https://api.my-llm.com/v1";
const MY_CUSTOM_LLM_ENV_KEY = "MY_LLM_API_KEY";

// 2. 동적 모델 발견 함수
async function discoverMyCustomLLMModels(): Promise<ModelDefinitionConfig[]> {
  const apiKey = process.env[MY_CUSTOM_LLM_ENV_KEY];
  if (!apiKey) {
    return [];
  }

  try {
    // API를 통해 사용 가능한 모델 목록 조회
    const response = await fetch(`${MY_CUSTOM_LLM_BASE_URL}/models`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(`Failed to discover My Custom LLM models: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const models = data.data || [];

    return models.map((model: any) => ({
      id: model.id,
      name: model.name || model.id,
      contextWindow: model.context_length || 128000,
      maxTokens: model.max_tokens || 4096,
      reasoning: model.capabilities?.includes("reasoning") || false,
      input: model.capabilities?.includes("vision") ? ["text", "image"] : ["text"],
      cost: {
        input: model.pricing?.input_cost || 10,
        output: model.pricing?.output_cost || 30,
        cacheRead: model.pricing?.cache_read_cost || 1,
        cacheWrite: model.pricing?.cache_write_cost || 5,
      },
    }));
  } catch (error) {
    console.warn(`Failed to discover My Custom LLM models: ${String(error)}`);
    return [];
  }
}

// 3. Implicit Provider 해결 함수에 추가
export async function resolveImplicitProviders(params: {
  agentDir: string;
}): Promise<Record<string, ProviderConfig>> {
  const providers: Record<string, ProviderConfig> = {};

  // ... (기존 코드)

  // My Custom LLM
  const myCustomLLMKey = process.env[MY_CUSTOM_LLM_ENV_KEY];
  if (myCustomLLMKey) {
    const models = await discoverMyCustomLLMModels();
    if (models.length > 0) {
      providers["my-custom-llm"] = {
        api: "openai",
        baseUrl: MY_CUSTOM_LLM_BASE_URL,
        apiKey: myCustomLLMKey,
        models,
      };
    }
  }

  return providers;
}
```

#### Step 4: 모델 사용

```bash
# 1. 사용 가능한 모델 목록 확인
openclaw models list

# 2. 특정 모델로 에이전트 실행
openclaw agent --message "Hello" --model my-custom-llm/custom-gpt-4

# 3. 설정 파일에서 기본 모델로 설정
```

`~/.openclaw/config.yaml`:

```yaml
agents:
  defaults:
    model:
      primary: my-custom-llm/custom-gpt-4
      fallbacks:
        - provider: anthropic
          model: claude-3-5-sonnet-20241022
        - provider: openai
          model: gpt-4-turbo
```

### 2.4 Auth Profile 추가 (다중 API 키)

여러 API 키를 관리하려면:

```bash
# Auth profile 추가
openclaw auth add --provider my-custom-llm --profile work
# API Key 입력: your-work-api-key

openclaw auth add --provider my-custom-llm --profile personal
# API Key 입력: your-personal-api-key

# Profile 목록 확인
openclaw auth list

# Profile 우선순위 설정
```

`~/.openclaw/config.yaml`:

```yaml
agents:
  defaults:
    authProfiles:
      my-custom-llm:
        order:
          - work      # 우선순위 1
          - personal  # 우선순위 2
```

### 2.5 Custom Provider API 인터페이스

OpenAI Compatible API가 아닌 경우, 커스텀 어댑터 구현:

`src/providers/my-custom-provider.ts`:

```typescript
import type { AgentStreamChunk } from "@mariozechner/pi-ai";

export async function* streamMyCustomLLM(params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  tools?: Array<any>;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}): AsyncGenerator<AgentStreamChunk> {
  const response = await fetch(`${params.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      tools: params.tools,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      stream: true,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter(line => line.trim().startsWith("data: "));

    for (const line of lines) {
      const data = line.replace("data: ", "");
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;

        if (delta?.content) {
          yield {
            type: "text",
            text: delta.content,
          };
        }

        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            yield {
              type: "tool_use",
              id: toolCall.id,
              name: toolCall.function.name,
              input: JSON.parse(toolCall.function.arguments),
            };
          }
        }
      } catch (error) {
        console.warn(`Failed to parse chunk: ${data}`);
      }
    }
  }
}
```

---

## 3. Skill 개발 및 추가

### 3.1 개요

Skills는 에이전트가 특정 작업을 수행하는 방법을 알려주는 재사용 가능한 가이드입니다. Markdown 파일로 작성되며, YAML frontmatter로 메타데이터를 정의합니다.

### 3.2 Skill 구조

**파일 구조**:

```
~/.openclaw/skills/
  ├── my-skill/
  │   ├── skill.md          # 스킬 메인 파일 (필수)
  │   ├── examples/         # 예시 파일 (선택)
  │   └── scripts/          # 보조 스크립트 (선택)
  └── another-skill/
      └── skill.md
```

**Skill 파일 템플릿** (`skill.md`):

```markdown
---
name: my-skill
description: Short description of what this skill does
emoji: 🔧
homepage: https://docs.example.com/my-skill
os:
  - linux
  - darwin
  - win32
requires:
  bins:
    - python3
    - pip
  env:
    - MY_SKILL_API_KEY
install:
  - kind: brew
    formula: my-tool
    os: [darwin, linux]
  - kind: node
    package: my-tool-cli
    bins: [my-tool]
  - kind: uv
    package: my-python-tool
    bins: [my-tool]
command-dispatch: tool
command-tool: exec
user-invocable: true
disable-model-invocation: false
always: false
---

# My Skill

이 스킬은 [작업 설명]을 수행합니다.

## 사용 방법

\`\`\`bash
# 예시 명령어
my-tool --option value
\`\`\`

## 예시

\`\`\`python
# Python 예시 코드
import my_tool

result = my_tool.do_something()
print(result)
\`\`\`

## 주의사항

- 주의사항 1
- 주의사항 2
```

### 3.3 Skill Frontmatter 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | string | Skill 이름 (고유) |
| `description` | string | 짧은 설명 |
| `emoji` | string | 아이콘 이모지 |
| `homepage` | string | 공식 문서 URL |
| `os` | string[] | 지원 OS (`linux`, `darwin`, `win32`) |
| `requires.bins` | string[] | 필수 바이너리 |
| `requires.anyBins` | string[] | 선택적 바이너리 (하나 이상 필요) |
| `requires.env` | string[] | 필수 환경 변수 |
| `install` | object[] | 설치 방법 |
| `command-dispatch` | string | 명령 디스패치 (`tool`) |
| `command-tool` | string | 디스패치할 도구 이름 |
| `user-invocable` | boolean | 사용자가 `/skill-name`으로 호출 가능 |
| `disable-model-invocation` | boolean | 모델이 자동 호출 금지 |
| `always` | boolean | 항상 프롬프트에 포함 |

### 3.4 실전 예시: Git Helper Skill

#### Step 1: Skill 디렉토리 생성

```bash
mkdir -p ~/.openclaw/skills/git-helper
```

#### Step 2: Skill 파일 작성

`~/.openclaw/skills/git-helper/skill.md`:

```markdown
---
name: git-helper
description: Git repository management and best practices
emoji: 🔀
homepage: https://git-scm.com/doc
os:
  - linux
  - darwin
  - win32
requires:
  bins:
    - git
install:
  - kind: brew
    formula: git
    os: [darwin, linux]
  - kind: download
    url: https://git-scm.com/downloads
    os: [win32]
user-invocable: true
disable-model-invocation: false
---

# Git Helper

이 스킬은 Git 저장소 관리 및 모범 사례를 제공합니다.

## 일반적인 작업

### 1. 커밋 메시지 작성

커밋 메시지는 다음 형식을 따릅니다:

\`\`\`
<type>(<scope>): <subject>

<body>

<footer>
\`\`\`

**Type**:
- `feat`: 새 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 코드 포맷팅
- `refactor`: 리팩토링
- `test`: 테스트 추가
- `chore`: 빌드/도구 변경

**예시**:

\`\`\`
feat(auth): add OAuth2 login

Implement OAuth2 authentication using Google provider.
Added redirect handling and token refresh logic.

Closes #123
\`\`\`

### 2. 브랜치 전략

\`\`\`bash
# Feature 브랜치 생성
git checkout -b feature/my-feature

# 작업 완료 후
git add .
git commit -m "feat: implement my feature"
git push origin feature/my-feature

# PR 생성 후 병합
git checkout main
git pull origin main
git branch -d feature/my-feature
\`\`\`

### 3. 되돌리기

\`\`\`bash
# 마지막 커밋 취소 (변경사항 유지)
git reset --soft HEAD~1

# 마지막 커밋 취소 (변경사항 삭제)
git reset --hard HEAD~1

# 특정 파일만 되돌리기
git checkout HEAD -- <file>
\`\`\`

### 4. 충돌 해결

\`\`\`bash
# 충돌 발생 시
git merge feature-branch
# ... conflicts ...

# 충돌 파일 수정 후
git add <resolved-files>
git commit -m "chore: resolve merge conflicts"
\`\`\`

## 유용한 명령어

\`\`\`bash
# 상태 확인
git status

# 로그 보기 (깔끔한 버전)
git log --oneline --graph --all

# 스태시 사용
git stash
git stash pop

# 원격 브랜치 정리
git remote prune origin
\`\`\`

## 모범 사례

1. **자주 커밋**: 작은 단위로 자주 커밋
2. **의미 있는 메시지**: 무엇을, 왜 변경했는지 명확히
3. **Pull 먼저**: Push 전에 항상 Pull
4. **리뷰 받기**: 중요한 변경은 PR로
```

#### Step 3: 설치 스크립트 추가 (선택)

`~/.openclaw/skills/git-helper/scripts/setup.sh`:

```bash
#!/bin/bash

# Git 설정
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Git aliases
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.lg "log --oneline --graph --all"

echo "Git helper setup complete!"
```

#### Step 4: Skill 활성화 확인

```bash
# Skill 목록 확인
openclaw skills list

# 출력:
# Available skills:
#   🔀 git-helper - Git repository management and best practices
```

#### Step 5: Skill 사용

```bash
# 1. 사용자가 직접 호출 (/command 형식)
openclaw agent --message "/git-helper"

# 2. 에이전트가 자동으로 사용 (대화 중)
openclaw agent --message "커밋 메시지 작성법 알려줘"
# 에이전트가 git-helper 스킬을 참조하여 답변
```

### 3.5 Advanced: Tool Dispatch Skill

특정 도구를 직접 호출하는 Skill:

`~/.openclaw/skills/python-runner/skill.md`:

```markdown
---
name: python-runner
description: Run Python scripts quickly
emoji: 🐍
requires:
  bins:
    - python3
command-dispatch: tool
command-tool: exec
command-arg-mode: raw
user-invocable: true
---

# Python Runner

이 스킬은 Python 스크립트를 빠르게 실행합니다.

사용자가 `/python-runner <code>`를 입력하면 자동으로 Python 코드를 실행합니다.

## 예시

\`\`\`
User: /python-runner print("Hello, World!")
Agent: [Executes: python3 -c 'print("Hello, World!")']
Output: Hello, World!
\`\`\`
```

**동작 방식**:
- `command-dispatch: tool` → Skill 호출 시 도구 실행
- `command-tool: exec` → `exec` 도구 사용
- `command-arg-mode: raw` → 사용자 입력을 그대로 전달

### 3.6 Skill 설정 (Config)

특정 에이전트에만 Skill 적용:

`~/.openclaw/config.yaml`:

```yaml
agents:
  list:
    - id: coding-expert
      workspace: ~/Documents/coding-workspace
      skillsFilter:
        allow:
          - git-helper
          - python-runner
          - typescript-helper

    - id: general-assistant
      workspace: ~/Documents/general-workspace
      skillsFilter:
        deny:
          - git-helper  # Git 스킬 제외
```

**Skill 로드 경로 추가**:

```yaml
skills:
  load:
    extraDirs:
      - ~/my-custom-skills
      - /usr/share/openclaw/skills
```

---

## 4. CLI 명령 추가

### 4.1 개요

OpenClaw는 Commander.js 기반 CLI를 사용합니다. 신규 명령을 추가하려면 `register.<command>.ts` 파일을 생성하고 프로그램에 등록해야 합니다.

### 4.2 CLI 명령 구조

**파일 위치**: `src/cli/program/register.<command>.ts`

**등록 위치**: `src/cli/program/build-program.ts`

### 4.3 실전 예시: `analyze` 명령 추가

#### Step 1: Command 파일 생성

`src/cli/program/register.analyze.ts`:

```typescript
import type { Command } from "commander";
import type { CliDeps } from "../deps.js";
import { loadConfig } from "../../config/config.js";
import { resolveAgentWorkspaceDir } from "../../agents/agent-scope.js";
import { ensureAgentWorkspace } from "../../agents/workspace.js";
import fs from "node:fs/promises";
import path from "node:path";

export type AnalyzeCommandOpts = {
  workspace?: string;
  format?: "json" | "yaml" | "table";
  output?: string;
};

export async function analyzeCommand(
  opts: AnalyzeCommandOpts,
  deps: CliDeps
) {
  const cfg = loadConfig();

  // 워크스페이스 해결
  const workspaceDir = opts.workspace ?? resolveAgentWorkspaceDir(cfg, "main");
  const workspace = await ensureAgentWorkspace({ dir: workspaceDir });

  console.log(`Analyzing workspace: ${workspace.dir}`);

  // 분석 로직
  const stats = await analyzeWorkspace(workspace.dir);

  // 출력 포맷
  const format = opts.format ?? "table";
  const output = formatOutput(stats, format);

  // 파일 저장 또는 콘솔 출력
  if (opts.output) {
    await fs.writeFile(opts.output, output, "utf-8");
    console.log(`Analysis saved to: ${opts.output}`);
  } else {
    console.log(output);
  }
}

async function analyzeWorkspace(dir: string) {
  const files = await fs.readdir(dir, { recursive: true, withFileTypes: true });

  const stats = {
    totalFiles: 0,
    totalSize: 0,
    fileTypes: new Map<string, number>(),
    largestFiles: [] as Array<{ path: string; size: number }>,
  };

  for (const file of files) {
    if (file.isFile()) {
      stats.totalFiles++;

      const fullPath = path.join(file.path, file.name);
      const stat = await fs.stat(fullPath);
      stats.totalSize += stat.size;

      const ext = path.extname(file.name) || "(no extension)";
      stats.fileTypes.set(ext, (stats.fileTypes.get(ext) || 0) + 1);

      stats.largestFiles.push({ path: fullPath, size: stat.size });
    }
  }

  // 상위 10개 큰 파일만
  stats.largestFiles.sort((a, b) => b.size - a.size);
  stats.largestFiles = stats.largestFiles.slice(0, 10);

  return stats;
}

function formatOutput(stats: any, format: string): string {
  if (format === "json") {
    return JSON.stringify(stats, null, 2);
  }

  if (format === "yaml") {
    // YAML 변환 로직
    return `totalFiles: ${stats.totalFiles}\ntotalSize: ${stats.totalSize}\n...`;
  }

  // Table 포맷 (기본)
  let output = `\n📊 Workspace Analysis\n`;
  output += `${"=".repeat(50)}\n`;
  output += `Total Files: ${stats.totalFiles}\n`;
  output += `Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB\n\n`;

  output += `📁 File Types:\n`;
  for (const [ext, count] of stats.fileTypes.entries()) {
    output += `  ${ext.padEnd(20)} ${count}\n`;
  }

  output += `\n📈 Largest Files:\n`;
  for (const file of stats.largestFiles) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(2);
    output += `  ${sizeMb} MB  ${file.path}\n`;
  }

  return output;
}

export function registerAnalyzeCommand(program: Command) {
  program
    .command("analyze")
    .description("Analyze workspace statistics")
    .option("-w, --workspace <path>", "Workspace directory")
    .option("-f, --format <format>", "Output format (json|yaml|table)", "table")
    .option("-o, --output <file>", "Output file path")
    .action(async (opts: AnalyzeCommandOpts) => {
      const deps = await import("../deps.js");
      await analyzeCommand(opts, deps.createDefaultDeps());
    });
}
```

#### Step 2: 프로그램에 등록

`src/cli/program/build-program.ts` (기존 파일 수정):

```typescript
import { registerAnalyzeCommand } from "./register.analyze.js";

export async function buildProgram(): Promise<Command> {
  const program = new Command();

  // ... (기존 코드)

  // 기존 명령들
  registerAgentCommand(program);
  registerStatusCommand(program);
  registerOnboardCommand(program);
  // ...

  // 신규 명령 추가
  registerAnalyzeCommand(program);

  return program;
}
```

#### Step 3: SubCLI로 등록 (선택 사항)

복잡한 명령은 SubCLI로 분리:

`src/cli/program/register.subclis.ts` (기존 파일 수정):

```typescript
const entries: SubCliEntry[] = [
  // ... (기존 항목)

  {
    name: "analyze",
    description: "Workspace analysis tools",
    register: async (program) => {
      const mod = await import("../analyze-cli.js");
      mod.registerAnalyzeCli(program);
    },
  },
];
```

`src/cli/analyze-cli.ts` (신규 파일):

```typescript
import type { Command } from "commander";

export function registerAnalyzeCli(program: Command) {
  const analyze = program
    .command("analyze")
    .description("Workspace analysis tools");

  // analyze workspace
  analyze
    .command("workspace")
    .description("Analyze workspace files")
    .option("-w, --workspace <path>", "Workspace directory")
    .option("-f, --format <format>", "Output format")
    .action(async (opts) => {
      const mod = await import("./program/register.analyze.js");
      await mod.analyzeCommand(opts, createDefaultDeps());
    });

  // analyze sessions
  analyze
    .command("sessions")
    .description("Analyze session history")
    .option("--agent <id>", "Agent ID")
    .action(async (opts) => {
      // Session 분석 로직
    });

  // analyze costs
  analyze
    .command("costs")
    .description("Analyze API usage costs")
    .option("--from <date>", "Start date")
    .option("--to <date>", "End date")
    .action(async (opts) => {
      // 비용 분석 로직
    });
}
```

#### Step 4: 명령 사용

```bash
# 기본 사용
openclaw analyze

# 옵션 사용
openclaw analyze --workspace ~/my-workspace --format json

# SubCLI 사용
openclaw analyze workspace --format table
openclaw analyze sessions --agent main
openclaw analyze costs --from 2026-01-01 --to 2026-01-31
```

### 4.4 Plugin CLI 추가

플러그인으로 CLI 명령 추가:

`extensions/my-plugin/cli.ts`:

```typescript
import type { Command } from "commander";

export function registerMyPluginCli(program: Command) {
  program
    .command("my-plugin")
    .description("My plugin commands")
    .option("--config <path>", "Plugin config file")
    .action(async (opts) => {
      console.log("My plugin command executed!");
      console.log("Config:", opts.config);
    });
}
```

`extensions/index.ts`:

```typescript
import { registerMyPluginCli } from "./my-plugin/cli.js";

export function registerCli(registry: PluginRegistry) {
  registry.registerCli({
    name: "my-plugin",
    description: "My plugin commands",
    register: registerMyPluginCli,
  });
}
```

---

## 5. 종합 예시: 전체 통합

### 5.1 시나리오

새로운 메신저 "Line"을 추가하고, Custom LLM을 사용하며, Line 전용 스킬과 CLI 명령을 추가합니다.

### 5.2 구현

#### 1. Line Channel Plugin

`src/channels/plugins/line.ts`:

```typescript
export const linePlugin: ChannelPlugin = {
  id: "line",
  meta: { name: "Line", description: "Line Messenger" },
  capabilities: { text: true, media: true },
  config: { /* ... */ },
  outbound: { /* ... */ },
  gateway: { /* ... */ },
};
```

#### 2. Custom LLM 추가

`~/.openclaw/config.yaml`:

```yaml
models:
  providers:
    my-llm:
      api: openai
      baseUrl: https://api.my-llm.com/v1
      apiKey: ${MY_LLM_KEY}
      models:
        - id: custom-model
          name: My Custom Model
          contextWindow: 128000
```

#### 3. Line 스킬 추가

`~/.openclaw/skills/line-sticker/skill.md`:

```markdown
---
name: line-sticker
description: Send Line stickers
command-dispatch: tool
command-tool: send_line_sticker
user-invocable: true
---

# Line Sticker Skill

Send Line stickers to express emotions.

## Usage

\`/line-sticker <sticker-id>\`
```

#### 4. Line CLI 명령

`src/cli/program/register.line.ts`:

```typescript
export function registerLineCommand(program: Command) {
  program
    .command("line")
    .description("Line messenger commands")
    .command("send")
    .action(async (opts) => {
      // Line 메시지 전송
    });
}
```

#### 5. 설정 통합

`~/.openclaw/config.yaml`:

```yaml
channels:
  line:
    default:
      channelAccessToken: ${LINE_ACCESS_TOKEN}
      channelSecret: ${LINE_CHANNEL_SECRET}

agents:
  defaults:
    model:
      primary: my-llm/custom-model

routing:
  bindings:
    - match:
        channel: line
        accountId: default
      agentId: main

skills:
  load:
    extraDirs:
      - ~/.openclaw/skills
```

#### 6. 전체 사용 흐름

```bash
# 1. Line 설정
openclaw onboard line

# 2. Custom LLM 확인
openclaw models list | grep my-llm

# 3. Line으로 메시지 전송
openclaw agent --to "U123456" --message "안녕하세요" --channel line

# 4. 스킬 사용
openclaw agent --to "U123456" --message "/line-sticker 12345"

# 5. CLI 명령 사용
openclaw line send --to "U123456" --text "Hello from CLI"
```

---

## 6. 디버깅 및 테스트

### 6.1 로깅

```bash
# 디버그 로그 활성화
export DEBUG=openclaw:*

# 특정 서브시스템만
export DEBUG=openclaw:channels:*
export DEBUG=openclaw:agents:*
```

### 6.2 테스트

```typescript
// src/channels/plugins/line.test.ts

import { describe, it, expect } from "vitest";
import { linePlugin } from "./line.js";

describe("Line Plugin", () => {
  it("should have correct ID", () => {
    expect(linePlugin.id).toBe("line");
  });

  it("should support text messaging", () => {
    expect(linePlugin.capabilities.text).toBe(true);
  });

  it("should send text message", async () => {
    const result = await linePlugin.outbound!.sendText({
      to: "U123456",
      text: "Hello",
      accountId: "default",
      deps: mockDeps,
    });

    expect(result.channel).toBe("line");
    expect(result.messageId).toBeDefined();
  });
});
```

### 6.3 Dry Run

```bash
# 실제 전송 없이 테스트
openclaw agent --message "test" --dry-run

# 설정 검증
openclaw config validate
```

---

## 7. 배포 및 공유

### 7.1 Plugin Package 구조

```
my-openclaw-plugin/
  ├── package.json
  ├── README.md
  ├── src/
  │   ├── channels/
  │   │   └── my-channel.ts
  │   ├── skills/
  │   │   └── my-skill/
  │   │       └── skill.md
  │   └── index.ts
  └── dist/
      └── index.js
```

`package.json`:

```json
{
  "name": "@my-org/openclaw-plugin",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["openclaw", "plugin"],
  "peerDependencies": {
    "openclaw": "^1.0.0"
  }
}
```

### 7.2 사용자 설치

```bash
npm install -g @my-org/openclaw-plugin
```

`~/.openclaw/config.yaml`:

```yaml
plugins:
  paths:
    - node_modules/@my-org/openclaw-plugin
```

---

## 마무리

이 가이드를 통해 OpenClaw를 확장하는 방법을 배웠습니다:

1. ✅ **신규 메신저 통합**: Channel Plugin 시스템
2. ✅ **Custom LLM 추가**: models.json 설정
3. ✅ **Skills 개발**: Markdown + YAML frontmatter
4. ✅ **CLI 명령 추가**: Commander.js 기반 명령 등록

**다음 단계**:
- [OpenClaw Architecture Analysis](./openclaw-architecture-analysis.md)에서 시스템 구조 이해
- [Architecture Diagrams](./architecture-diagrams.md)에서 시각적 참조
- 공식 문서 및 예시 코드 참조

**Happy Extending! 🚀**
