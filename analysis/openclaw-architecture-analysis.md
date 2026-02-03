# OpenClaw 에이전트 아키텍처 상세 분석

> **작성일**: 2026-02-04
> **분석 대상**: OpenClaw Personal AI Assistant Agent
> **분석 목적**: 사용자 질의 처리, 오케스트레이션, 런타임 액션 실행 메커니즘 이해

---

## 목차

1. [개요](#1-개요)
2. [전체 아키텍처](#2-전체-아키텍처)
3. [사용자 질의 처리 흐름](#3-사용자-질의-처리-흐름)
4. [오케스트레이션 레이어](#4-오케스트레이션-레이어)
5. [런타임 액션 실행](#5-런타임-액션-실행)
6. [핵심 컴포넌트](#6-핵심-컴포넌트)
7. [주요 설계 패턴](#7-주요-설계-패턴)
8. [코드 레벨 분석](#8-코드-레벨-분석)

---

## 1. 개요

OpenClaw는 다중 채널(WhatsApp, Slack, Discord, Telegram 등)을 지원하는 개인 비서 AI 에이전트 시스템입니다. 핵심 특징은 다음과 같습니다:

### 주요 특징

- **멀티 채널 지원**: WhatsApp, Slack, Discord, Telegram, Signal 등
- **분산 실행**: 로컬 실행 또는 Gateway를 통한 분산 실행
- **에이전트 라우팅**: 채널/계정/피어 기반 자동 라우팅
- **모델 폴백**: Auth profile 순환 및 모델 폴백 자동화
- **도구 정책 엔진**: 세밀한 도구 접근 제어 (전역/에이전트/그룹/샌드박스)
- **세션 관리**: 지속적 대화 컨텍스트 유지 및 동시성 제어
- **샌드박스 격리**: Docker 기반 안전한 코드 실행

### 기술 스택

- **런타임**: Node.js (TypeScript)
- **AI SDK**: `@mariozechner/pi-agent-core`, `@mariozechner/pi-ai`
- **코딩 에이전트**: `@mariozechner/pi-coding-agent`
- **LLM 제공자**: Anthropic, OpenAI, Google Gemini, AWS Bedrock 등
- **격리 환경**: Docker (샌드박스)
- **통신**: WebSocket (Gateway RPC)

---

## 2. 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Entry                           │
│  (openclaw.mjs → src/entry.ts → src/index.ts)             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Command Router                           │
│  (src/cli/program/build-program.ts)                        │
│  • agent command                                            │
│  • gateway server/client                                    │
│  • channel adapters                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
┌────────────────────┐         ┌────────────────────┐
│  Gateway Mode      │         │   Local Mode       │
│  (RPC over WS)     │         │   (Embedded)       │
└─────────┬──────────┘         └─────────┬──────────┘
          │                              │
          └──────────┬───────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Agent Command Handler                      │
│  (src/commands/agent.ts::agentCommand)                     │
│  • Session resolution                                       │
│  • Config loading                                           │
│  • Model selection                                          │
│  • Auth profile management                                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Route Resolution                          │
│  (src/routing/resolve-route.ts::resolveAgentRoute)        │
│  • Channel/Account/Peer matching                            │
│  • Session key generation                                   │
│  • Agent binding lookup                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Model Fallback Layer                       │
│  (src/agents/model-fallback.ts::runWithModelFallback)     │
│  • Auth profile rotation                                    │
│  • Model fallback on failure                                │
│  • Cooldown tracking                                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                Embedded Agent Runner                        │
│  (src/agents/pi-embedded-runner/run.ts)                    │
│  • Workspace setup                                          │
│  • Tool policy resolution                                   │
│  • Session lock acquisition                                 │
│  • Context window guard                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Attempt Executor                           │
│  (src/agents/pi-embedded-runner/run/attempt.ts)           │
│  • Session file loading                                     │
│  • System prompt generation                                 │
│  • Tool creation & filtering                                │
│  • LLM streaming                                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Tool Execution                            │
│  (src/agents/pi-tools.ts)                                  │
│  • Bash/Exec (PTY, approval flows)                         │
│  • File operations (Read, Write, Edit)                     │
│  • Web operations (Fetch, Search)                          │
│  • Messaging (Send, React)                                 │
│  • Memory (Store, Retrieve)                                │
│  • Subagent spawning                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 사용자 질의 처리 흐름

### 3.1 엔트리 포인트

사용자가 `openclaw agent --message "안녕"` 명령을 실행하면:

```typescript
// openclaw.mjs (바이너리 엔트리)
└─> src/entry.ts (프로세스 환경 설정)
    └─> src/index.ts (설정 로드 및 에러 핸들링)
        └─> src/cli/run-main.ts (CLI 초기화)
            └─> src/cli/program/build-program.ts (명령어 라우팅)
                └─> src/cli/program/register.agent.ts (agent 명령 등록)
```

**파일 위치**: `src/cli/program/register.agent.ts:36-60`

```typescript
export function registerAgentCommand(program: Command) {
  program
    .command("agent")
    .option("--message <text>", "User message to send to the agent")
    .option("--to <E.164>", "Phone number in E.164 format")
    .option("--session-id <id>", "Session ID")
    .option("--agent <id>", "Agent ID to use")
    .option("--local", "Run locally (default: via gateway)")
    .action(async (opts) => {
      if (opts.local) {
        await agentCommand(opts); // 로컬 실행
      } else {
        await agentViaGateway(opts); // Gateway를 통한 분산 실행
      }
    });
}
```

### 3.2 Gateway vs Local 모드

#### Gateway 모드 (기본값)

**파일**: `src/commands/agent-via-gateway.ts:15-45`

```typescript
export async function agentViaGateway(opts: AgentCommandOpts) {
  const cfg = loadConfig();
  const gateway = cfg.gateway?.endpoint ?? "ws://localhost:3737";

  // Gateway RPC 호출
  const result = await callGateway({
    endpoint: gateway,
    method: "agent.run",
    params: {
      sessionKey: opts.sessionKey,
      message: opts.message,
      to: opts.to,
      // ...
    }
  });

  // 결과 스트리밍 수신
  for await (const chunk of result.stream) {
    if (chunk.type === "text") {
      process.stdout.write(chunk.data);
    }
  }
}
```

**장점**:
- 분산 처리 가능
- 채널 통합 (WhatsApp, Slack 등)
- 중앙 집중식 세션 관리

#### Local 모드

**파일**: `src/commands/agent.ts:64-529`

```typescript
export async function agentCommand(opts: AgentCommandOpts) {
  // 1. 설정 로드
  const cfg = loadConfig();

  // 2. 세션 해결
  const { sessionKey, sessionEntry, sessionStore } =
    resolveSession({ cfg, to: opts.to, sessionId: opts.sessionId });

  // 3. 워크스페이스 준비
  const workspace = await ensureAgentWorkspace({ dir: workspaceDir });

  // 4. 모델 폴백과 함께 에이전트 실행
  const result = await runWithModelFallback({
    cfg,
    provider,
    model,
    run: (providerOverride, modelOverride) => {
      return runEmbeddedPiAgent({
        sessionKey,
        prompt: opts.message,
        provider: providerOverride,
        model: modelOverride,
        // ...
      });
    }
  });

  return result;
}
```

**장점**:
- 네트워크 의존성 없음
- 로컬 개발/테스트에 적합
- 단순한 배포

---

## 4. 오케스트레이션 레이어

### 4.1 세션 라우팅

OpenClaw는 **채널/계정/피어** 기반으로 에이전트를 자동 라우팅합니다.

**파일**: `src/routing/resolve-route.ts:167-260`

```typescript
export function resolveAgentRoute(input: ResolveAgentRouteInput): ResolvedAgentRoute {
  const channel = normalizeToken(input.channel);  // e.g., "whatsapp"
  const accountId = normalizeAccountId(input.accountId);  // e.g., "+821012345678"
  const peer = input.peer;  // e.g., { kind: "dm", id: "+821087654321" }

  // 설정에서 바인딩 검색
  const bindings = listBindings(cfg).filter(binding => {
    return matchesChannel(binding.match, channel) &&
           matchesAccountId(binding.match?.accountId, accountId);
  });

  // 우선순위 순으로 매칭
  // 1. Peer 매칭 (직접 메시지/그룹)
  if (peer) {
    const peerMatch = bindings.find(b => matchesPeer(b.match, peer));
    if (peerMatch) {
      return choose(peerMatch.agentId, "binding.peer");
    }
  }

  // 2. 스레드 부모 상속
  if (parentPeer) {
    const parentMatch = bindings.find(b => matchesPeer(b.match, parentPeer));
    if (parentMatch) {
      return choose(parentMatch.agentId, "binding.peer.parent");
    }
  }

  // 3. Guild 매칭 (Discord)
  if (guildId) {
    const guildMatch = bindings.find(b => matchesGuild(b.match, guildId));
    if (guildMatch) return choose(guildMatch.agentId, "binding.guild");
  }

  // 4. Team 매칭 (Slack)
  if (teamId) {
    const teamMatch = bindings.find(b => matchesTeam(b.match, teamId));
    if (teamMatch) return choose(teamMatch.agentId, "binding.team");
  }

  // 5. Account 매칭
  const accountMatch = bindings.find(b =>
    b.match?.accountId?.trim() !== "*" &&
    !b.match?.peer && !b.match?.guildId && !b.match?.teamId
  );
  if (accountMatch) return choose(accountMatch.agentId, "binding.account");

  // 6. 채널 전체 매칭 (와일드카드)
  const anyAccountMatch = bindings.find(b =>
    b.match?.accountId?.trim() === "*"
  );
  if (anyAccountMatch) return choose(anyAccountMatch.agentId, "binding.channel");

  // 7. 기본 에이전트
  return choose(resolveDefaultAgentId(cfg), "default");
}
```

#### 세션 키 생성

**파일**: `src/routing/session-key.ts:85-120`

```typescript
export function buildAgentSessionKey(params: {
  agentId: string;
  channel: string;
  accountId?: string;
  peer?: RoutePeer;
  dmScope?: "main" | "per-peer" | "per-channel-peer" | "per-account-channel-peer";
}): string {
  // 예시: "agent-main:whatsapp:+821012345678:dm:+821087654321"
  // 또는: "agent-main:MAIN" (dmScope가 "main"인 경우)

  const peerKind = params.peer?.kind ?? "dm";
  const peerId = params.peer?.id ?? null;

  if (params.dmScope === "main" && peerKind === "dm") {
    return `${params.agentId}:MAIN`;
  }

  return buildAgentPeerSessionKey({
    agentId: params.agentId,
    channel: params.channel,
    accountId: params.accountId,
    peerKind,
    peerId,
    dmScope: params.dmScope,
  });
}
```

**세션 키의 역할**:
- 세션 파일 경로 결정 (`~/.openclaw/sessions/{sessionKey}.jsonl`)
- 동시성 제어 (lock)
- 에이전트 컨텍스트 격리
- 대화 히스토리 영속성

### 4.2 모델 폴백 및 Auth Profile 순환

**파일**: `src/agents/model-fallback.ts:20-150`

```typescript
export async function runWithModelFallback<T>(params: {
  cfg: OpenClawConfig;
  provider: string;
  model: string;
  run: (provider: string, model: string) => Promise<T>;
}): Promise<{ result: T; provider: string; model: string }> {

  const fallbacks = params.cfg?.agents?.defaults?.model?.fallbacks ?? [];
  const attempts = [
    { provider: params.provider, model: params.model },
    ...fallbacks.map(fb => ({ provider: fb.provider, model: fb.model }))
  ];

  for (let i = 0; i < attempts.length; i++) {
    const { provider, model } = attempts[i];

    try {
      const result = await params.run(provider, model);
      return { result, provider, model };
    } catch (err) {
      if (!(err instanceof FailoverError)) {
        throw err;  // 폴백 불가능한 에러는 즉시 throw
      }

      // Auth 실패인 경우 프로필 순환
      if (err.reason === "auth" || err.reason === "rate_limit") {
        // Auth profile cooldown 기록
        await markAuthProfileFailure({
          store: authStore,
          profileId: err.profileId,
          reason: err.reason,
        });

        // 다음 프로필로 재시도
        continue;
      }

      // 마지막 시도가 아니면 다음 모델로 폴백
      if (i < attempts.length - 1) {
        log.warn(`Model ${provider}/${model} failed, trying fallback...`);
        continue;
      }

      throw err;  // 모든 폴백 실패
    }
  }

  throw new Error("All model fallbacks exhausted");
}
```

#### Auth Profile 순환 메커니즘

**파일**: `src/agents/pi-embedded-runner/run.ts:152-274`

```typescript
// Auth profile 후보 결정
const profileOrder = resolveAuthProfileOrder({
  cfg: params.config,
  store: authStore,
  provider,
  preferredProfile: params.authProfileId,
});

const profileCandidates = lockedProfileId
  ? [lockedProfileId]  // 사용자 지정 프로필 고정
  : profileOrder.length > 0
    ? profileOrder
    : [undefined];  // 기본 API 키 사용

let profileIndex = 0;

// 프로필 순환 로직
const advanceAuthProfile = async (): Promise<boolean> => {
  let nextIndex = profileIndex + 1;

  while (nextIndex < profileCandidates.length) {
    const candidate = profileCandidates[nextIndex];

    // Cooldown 중인 프로필 건너뛰기
    if (candidate && isProfileInCooldown(authStore, candidate)) {
      nextIndex += 1;
      continue;
    }

    try {
      await applyApiKeyInfo(candidate);
      profileIndex = nextIndex;
      thinkLevel = initialThinkLevel;  // Thinking level 초기화
      attemptedThinking.clear();
      return true;
    } catch (err) {
      nextIndex += 1;
    }
  }

  return false;  // 사용 가능한 프로필 없음
};
```

**Cooldown 관리**:

```typescript
// src/agents/auth-profiles.ts:120-180

export function isProfileInCooldown(
  store: AuthProfileStore,
  profileId: string
): boolean {
  const profile = store.profiles[profileId];
  if (!profile) return false;

  const now = Date.now();
  const lastFailure = profile.lastFailure ?? 0;
  const cooldownMs = (profile.cooldownMinutes ?? 5) * 60 * 1000;

  return now - lastFailure < cooldownMs;
}

export async function markAuthProfileFailure(params: {
  store: AuthProfileStore;
  profileId: string;
  reason: "auth" | "rate_limit" | "timeout" | "unknown";
  cfg?: OpenClawConfig;
  agentDir?: string;
}): Promise<void> {
  const profile = params.store.profiles[params.profileId];
  if (!profile) return;

  profile.lastFailure = Date.now();
  profile.failureCount = (profile.failureCount ?? 0) + 1;

  // 실패 원인에 따라 cooldown 조정
  if (params.reason === "rate_limit") {
    profile.cooldownMinutes = 30;  // Rate limit는 30분
  } else if (params.reason === "auth") {
    profile.cooldownMinutes = 60;  // Auth 실패는 1시간
  }

  await saveAuthProfileStore(params.store, params.agentDir);
}
```

### 4.3 Context Window 관리

**파일**: `src/agents/context-window-guard.ts:40-85`

```typescript
export function evaluateContextWindowGuard(params: {
  info: ContextWindowInfo;
  warnBelowTokens: number;
  hardMinTokens: number;
}): {
  tokens: number;
  source: string;
  shouldWarn: boolean;
  shouldBlock: boolean;
} {
  const tokens = params.info.tokens;
  const source = params.info.source;

  return {
    tokens,
    source,
    shouldWarn: tokens < params.warnBelowTokens,
    shouldBlock: tokens < params.hardMinTokens,
  };
}

// 실행 시점에서 검사
const ctxGuard = evaluateContextWindowGuard({
  info: ctxInfo,
  warnBelowTokens: 8192,    // 경고 임계값
  hardMinTokens: 4096,      // 차단 임계값
});

if (ctxGuard.shouldBlock) {
  throw new FailoverError(
    `Model context window too small (${ctxGuard.tokens} tokens)`,
    { reason: "unknown", provider, model }
  );
}
```

**자동 Compaction** (Context Overflow 처리):

```typescript
// src/agents/pi-embedded-runner/run.ts:374-409

if (isContextOverflowError(errorText)) {
  // Context overflow 감지 시 자동 압축 시도
  if (!overflowCompactionAttempted) {
    log.warn(`Context overflow detected; attempting auto-compaction`);
    overflowCompactionAttempted = true;

    const compactResult = await compactEmbeddedPiSessionDirect({
      sessionId,
      sessionKey,
      sessionFile,
      workspaceDir,
      provider,
      model,
      // ...
    });

    if (compactResult.compacted) {
      log.info(`Auto-compaction succeeded; retrying prompt`);
      continue;  // 재시도
    }

    log.warn(`Auto-compaction failed: ${compactResult.reason}`);
  }

  // 압축 실패 시 사용자에게 안내
  return {
    payloads: [{
      text: "Context overflow: prompt too large. " +
            "Try with less input or a larger-context model.",
      isError: true,
    }],
    meta: { error: { kind: "context_overflow" } }
  };
}
```

---

## 5. 런타임 액션 실행

### 5.1 Embedded Agent Runner

**파일**: `src/agents/pi-embedded-runner/run.ts:71-692`

```typescript
export async function runEmbeddedPiAgent(
  params: RunEmbeddedPiAgentParams
): Promise<EmbeddedPiRunResult> {

  // 1. 큐 기반 동시성 제어
  const sessionLane = resolveSessionLane(params.sessionKey);
  const globalLane = resolveGlobalLane(params.lane);

  return enqueueSession(() =>
    enqueueGlobal(async () => {
      const started = Date.now();

      // 2. 워크스페이스 준비
      const resolvedWorkspace = resolveUserPath(params.workspaceDir);
      await fs.mkdir(resolvedWorkspace, { recursive: true });

      // 3. 모델 해결
      const { model, authStorage, modelRegistry } = resolveModel(
        provider,
        modelId,
        agentDir,
        params.config
      );

      // 4. Context window 검증
      const ctxGuard = evaluateContextWindowGuard({ /* ... */ });
      if (ctxGuard.shouldBlock) {
        throw new FailoverError(/* ... */);
      }

      // 5. Auth profile 순환 루프
      while (profileIndex < profileCandidates.length) {
        const candidate = profileCandidates[profileIndex];

        // Cooldown 체크
        if (candidate && isProfileInCooldown(authStore, candidate)) {
          profileIndex += 1;
          continue;
        }

        await applyApiKeyInfo(candidate);
        break;
      }

      // 6. Thinking level fallback 루프
      let thinkLevel = params.thinkLevel ?? "off";
      const attemptedThinking = new Set<ThinkLevel>();

      while (true) {
        attemptedThinking.add(thinkLevel);

        // 7. Attempt 실행 (핵심)
        const attempt = await runEmbeddedAttempt({
          sessionId,
          sessionKey,
          sessionFile,
          workspaceDir,
          provider,
          modelId,
          model,
          authStorage,
          modelRegistry,
          thinkLevel,
          prompt: params.prompt,
          images: params.images,
          // ...
        });

        const { aborted, promptError, timedOut, lastAssistant } = attempt;

        // 8. 에러 처리
        if (promptError && !aborted) {
          const errorText = describeUnknownError(promptError);

          // Context overflow → 자동 압축
          if (isContextOverflowError(errorText)) {
            if (!overflowCompactionAttempted) {
              overflowCompactionAttempted = true;
              await compactEmbeddedPiSessionDirect(/* ... */);
              continue;  // 재시도
            }
            return { /* context overflow error */ };
          }

          // Auth 실패 → Profile rotation
          if (isFailoverErrorMessage(errorText)) {
            await markAuthProfileFailure({ /* ... */ });
            if (await advanceAuthProfile()) {
              continue;  // 다음 프로필로 재시도
            }
          }

          // Thinking level 불일치 → Fallback
          const fallbackThinking = pickFallbackThinkingLevel({
            message: errorText,
            attempted: attemptedThinking,
          });
          if (fallbackThinking) {
            thinkLevel = fallbackThinking;
            continue;  // 다른 thinking level로 재시도
          }

          throw promptError;
        }

        // 9. 성공 시 결과 반환
        const usage = normalizeUsage(lastAssistant?.usage);
        const payloads = buildEmbeddedRunPayloads({ /* ... */ });

        // Auth profile 성공 기록
        if (lastProfileId) {
          await markAuthProfileGood({ store: authStore, profileId: lastProfileId });
        }

        return {
          payloads,
          meta: {
            durationMs: Date.now() - started,
            agentMeta: { sessionId, provider, model, usage },
            aborted,
          }
        };
      }
    })
  );
}
```

### 5.2 Attempt Executor

**파일**: `src/agents/pi-embedded-runner/run/attempt.ts:139-911`

```typescript
export async function runEmbeddedAttempt(
  params: EmbeddedRunAttemptParams
): Promise<EmbeddedRunAttemptResult> {

  const resolvedWorkspace = resolveUserPath(params.workspaceDir);
  const runAbortController = new AbortController();

  // 1. 워크스페이스 준비
  await fs.mkdir(resolvedWorkspace, { recursive: true });

  // 2. 샌드박스 해결
  const sandbox = await resolveSandboxContext({
    config: params.config,
    sessionKey: params.sessionKey,
    workspaceDir: resolvedWorkspace,
  });

  const effectiveWorkspace = sandbox?.enabled
    ? (sandbox.workspaceAccess === "rw" ? resolvedWorkspace : sandbox.workspaceDir)
    : resolvedWorkspace;

  // 3. Skills 로드
  const skillEntries = loadWorkspaceSkillEntries(effectiveWorkspace);
  const skillsPrompt = resolveSkillsPromptForRun({
    skillsSnapshot: params.skillsSnapshot,
    entries: skillEntries,
    config: params.config,
    workspaceDir: effectiveWorkspace,
  });

  // 4. Bootstrap 파일 해결
  const { bootstrapFiles, contextFiles } = await resolveBootstrapContextForRun({
    workspaceDir: effectiveWorkspace,
    config: params.config,
    sessionKey: params.sessionKey,
  });

  // 5. 도구 생성
  const toolsRaw = createOpenClawCodingTools({
    exec: { ...params.execOverrides, elevated: params.bashElevated },
    sandbox,
    messageProvider: params.messageChannel,
    agentAccountId: params.agentAccountId,
    sessionKey: params.sessionKey,
    agentDir,
    workspaceDir: effectiveWorkspace,
    config: params.config,
    abortSignal: runAbortController.signal,
    modelProvider: params.model.provider,
    modelId: params.modelId,
    modelHasVision,
  });

  // Google 호환성 처리
  const tools = sanitizeToolsForGoogle({
    tools: toolsRaw,
    provider: params.provider
  });

  // 6. 시스템 프롬프트 생성
  const appendPrompt = buildEmbeddedSystemPrompt({
    workspaceDir: effectiveWorkspace,
    defaultThinkLevel: params.thinkLevel,
    reasoningLevel: params.reasoningLevel,
    skillsPrompt,
    workspaceNotes,
    reactionGuidance,
    runtimeInfo,
    messageToolHints,
    sandboxInfo,
    tools,
    contextFiles,
    // ...
  });

  const systemPromptText = createSystemPromptOverride(appendPrompt)();

  // 7. 세션 락 획득
  const sessionLock = await acquireSessionWriteLock({
    sessionFile: params.sessionFile,
  });

  try {
    // 8. 세션 파일 복구 (필요 시)
    await repairSessionFileIfNeeded({ sessionFile: params.sessionFile });

    // 9. 세션 매니저 열기
    sessionManager = guardSessionManager(
      SessionManager.open(params.sessionFile),
      { agentId, sessionKey: params.sessionKey }
    );

    // 10. 세션 준비
    await prepareSessionManagerForRun({
      sessionManager,
      sessionFile: params.sessionFile,
      sessionId: params.sessionId,
      cwd: effectiveWorkspace,
    });

    // 11. 도구 분리 (Built-in vs Custom)
    const { builtInTools, customTools } = splitSdkTools({
      tools,
      sandboxEnabled: !!sandbox?.enabled,
    });

    // 12. 에이전트 세션 생성
    const { session } = await createAgentSession({
      cwd: resolvedWorkspace,
      agentDir,
      authStorage: params.authStorage,
      modelRegistry: params.modelRegistry,
      model: params.model,
      thinkingLevel: mapThinkingLevel(params.thinkLevel),
      tools: builtInTools,
      customTools,
      sessionManager,
      settingsManager,
    });

    // 13. 시스템 프롬프트 적용
    applySystemPromptOverrideToSession(session, systemPromptText);

    // 14. 히스토리 정리 및 검증
    const sanitized = await sanitizeSessionHistory({ messages });
    const validated = validateAnthropicTurns(sanitized);
    const limited = limitHistoryTurns(validated, dmHistoryLimit);

    if (limited.length > 0) {
      session.agent.replaceMessages(limited);
    }

    // 15. 이벤트 구독
    const subscription = subscribeEmbeddedPiSession({
      session,
      runId: params.runId,
      verboseLevel: params.verboseLevel,
      onToolResult: params.onToolResult,
      onBlockReply: params.onBlockReply,
      // ...
    });

    // 16. 타임아웃 설정
    const abortTimer = setTimeout(() => {
      abortRun(true);  // Timeout
    }, params.timeoutMs);

    // 17. Hook 실행 (before_agent_start)
    let effectivePrompt = params.prompt;
    if (hookRunner?.hasHooks("before_agent_start")) {
      const hookResult = await hookRunner.runBeforeAgentStart({
        prompt: params.prompt,
        messages: session.messages,
      });
      if (hookResult?.prependContext) {
        effectivePrompt = `${hookResult.prependContext}\n\n${params.prompt}`;
      }
    }

    // 18. 이미지 감지 및 로드
    const imageResult = await detectAndLoadPromptImages({
      prompt: effectivePrompt,
      workspaceDir: effectiveWorkspace,
      model: params.model,
      existingImages: params.images,
      historyMessages: session.messages,
      sandboxRoot: sandbox?.workspaceDir,
    });

    // 19. 히스토리 이미지 주입
    const didMutate = injectHistoryImagesIntoMessages(
      session.messages,
      imageResult.historyImagesByIndex
    );
    if (didMutate) {
      session.agent.replaceMessages(session.messages);
    }

    // 20. LLM 프롬프트 실행
    if (imageResult.images.length > 0) {
      await session.prompt(effectivePrompt, { images: imageResult.images });
    } else {
      await session.prompt(effectivePrompt);
    }

    // 21. Compaction 재시도 대기
    await waitForCompactionRetry();

    // 22. Hook 실행 (agent_end)
    if (hookRunner?.hasHooks("agent_end")) {
      hookRunner.runAgentEnd({
        messages: session.messages,
        success: !aborted && !promptError,
        error: promptError ? describeUnknownError(promptError) : undefined,
      }).catch(/* ... */);
    }

    // 23. 결과 구성
    const lastAssistant = messagesSnapshot
      .slice()
      .toReversed()
      .find(m => m.role === "assistant");

    const payloads = buildEmbeddedRunPayloads({
      assistantTexts: attempt.assistantTexts,
      toolMetas: attempt.toolMetas,
      lastAssistant,
      // ...
    });

    return {
      aborted,
      timedOut,
      promptError,
      sessionIdUsed: session.sessionId,
      systemPromptReport,
      messagesSnapshot: session.messages.slice(),
      assistantTexts,
      toolMetas,
      lastAssistant,
      // ...
    };

  } finally {
    // 24. 세션 정리
    sessionManager?.flushPendingToolResults?.();
    session?.dispose();
    await sessionLock.release();
  }
}
```

### 5.3 Tool Execution

#### 도구 생성

**파일**: `src/agents/pi-tools.ts:114-400`

```typescript
export function createOpenClawCodingTools(options?: {
  exec?: ExecToolDefaults;
  sandbox?: SandboxContext;
  messageProvider?: string;
  sessionKey?: string;
  config?: OpenClawConfig;
  modelProvider?: string;
  modelId?: string;
  // ...
}): AnyAgentTool[] {

  // 1. 도구 정책 해결
  const {
    globalPolicy,
    agentPolicy,
    groupPolicy,
    profilePolicy,
    // ...
  } = resolveEffectiveToolPolicy({
    config: options?.config,
    sessionKey: options?.sessionKey,
    modelProvider: options?.modelProvider,
  });

  // 2. 샌드박스 도구 생성
  const sandbox = options?.sandbox?.enabled ? options.sandbox : undefined;
  const readTool = sandbox
    ? createSandboxedReadTool(sandbox)
    : createOpenClawReadTool();

  const writeTool = sandbox
    ? createSandboxedWriteTool(sandbox)
    : createWriteTool();

  const editTool = sandbox
    ? createSandboxedEditTool(sandbox)
    : createEditTool();

  // 3. Bash/Exec 도구
  const execTool = createExecTool({
    ...options?.exec,
    workspaceDir: options?.workspaceDir,
    config: options?.config,
    sandbox,
  });

  const processTool = createProcessTool({
    ...options?.exec,
    workspaceDir: options?.workspaceDir,
    config: options?.config,
  });

  // 4. OpenClaw 도구
  const openclawTools = createOpenClawTools({
    agentDir: options?.agentDir,
    workspaceDir: options?.workspaceDir,
    config: options?.config,
    sessionKey: options?.sessionKey,
    messageProvider: options?.messageProvider,
    // ...
  });

  // 5. 채널 도구
  const channelTools = listChannelAgentTools({
    cfg: options?.config,
    channel: options?.messageProvider,
    agentAccountId: options?.agentAccountId,
    // ...
  });

  // 6. 모든 도구 결합
  let allTools = [
    readTool,
    writeTool,
    editTool,
    execTool,
    processTool,
    ...openclawTools,
    ...channelTools,
    ...codingTools,  // pi-coding-agent의 기본 도구들
  ];

  // 7. 도구 정책 필터링
  allTools = filterToolsByPolicy({
    tools: allTools,
    globalPolicy,
    agentPolicy,
    groupPolicy,
    profilePolicy,
    sandboxPolicy: sandbox?.policy,
  });

  // 8. Provider 호환성 처리
  if (options?.modelProvider === "anthropic") {
    // Anthropic은 특정 이름 패턴 필요
    allTools = allTools.map(tool =>
      patchToolSchemaForClaudeCompatibility(tool)
    );
  }

  // 9. Hook 및 Abort Signal 래핑
  allTools = allTools.map(tool => {
    let wrapped = tool;
    wrapped = wrapToolWithBeforeToolCallHook(wrapped, options?.config);
    wrapped = wrapToolWithAbortSignal(wrapped, options?.abortSignal);
    return wrapped;
  });

  return allTools;
}
```

#### Bash/Exec 도구

**파일**: `src/agents/bash-tools.exec.ts:180-550`

```typescript
export function createExecTool(defaults?: ExecToolDefaults): AnyAgentTool {
  return {
    name: "exec",
    description: "Execute a bash command with approval flow and PTY support",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Command to execute" },
        background: { type: "boolean", description: "Run in background" },
        elevated: { type: "boolean", description: "Run with elevated privileges" },
      },
      required: ["command"],
    },

    execute: async (params: { command: string; background?: boolean }) => {
      const { command, background } = params;

      // 1. Security policy check
      const security = defaults?.config?.tools?.exec?.security ?? "ask";
      const safeBins = defaults?.config?.tools?.exec?.safeBins ?? [];

      const isSafe = checkCommandSafety(command, safeBins);

      if (security === "deny" || (security === "ask" && !isSafe)) {
        // Approval flow
        const approved = await requestApproval({
          command,
          channel: defaults?.messageProvider,
          sessionKey: defaults?.sessionKey,
        });

        if (!approved) {
          return {
            status: "denied",
            output: "Command execution denied by user"
          };
        }
      }

      // 2. Sandbox check
      if (defaults?.sandbox) {
        // Docker 컨테이너 내 실행
        return executeInSandbox({
          command,
          sandbox: defaults.sandbox,
          background,
        });
      }

      // 3. PTY 실행
      const ptySupported = await checkPtySupport();

      if (ptySupported) {
        return executePtyCommand({
          command,
          cwd: defaults?.workspaceDir,
          env: process.env,
          timeoutMs: (defaults?.timeoutSec ?? 120) * 1000,
          background,
          onOutput: (chunk) => {
            // 실시간 출력 스트리밍
            emitToolOutput({
              runId: defaults?.runId,
              toolName: "exec",
              output: chunk,
            });
          },
        });
      }

      // 4. Fallback to spawn
      return executeSpawnCommand({
        command,
        cwd: defaults?.workspaceDir,
        timeoutMs: (defaults?.timeoutSec ?? 120) * 1000,
      });
    },
  };
}
```

#### Approval Flow

**파일**: `src/agents/bash-tools.exec.ts:80-150`

```typescript
async function requestApproval(params: {
  command: string;
  channel?: string;
  sessionKey?: string;
}): Promise<boolean> {

  const approvalId = generateApprovalId();

  // 1. 채널을 통한 승인 요청
  if (params.channel && params.sessionKey) {
    await sendApprovalRequest({
      channel: params.channel,
      sessionKey: params.sessionKey,
      approvalId,
      message: `Approve command execution?\n\`\`\`\n${params.command}\n\`\`\``,
      actions: [
        { label: "✅ Approve", value: "approve" },
        { label: "❌ Deny", value: "deny" },
      ],
    });

    // 2. 승인 대기 (타임아웃: 5분)
    const result = await waitForApprovalResponse({
      approvalId,
      timeoutMs: 5 * 60 * 1000,
    });

    return result === "approve";
  }

  // 3. CLI 모드: stdin을 통한 승인
  console.log(`\nCommand requires approval:\n${params.command}\n`);
  console.log("Approve? (y/n): ");

  const answer = await readStdin();
  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}
```

#### 채널 도구 (Messaging)

**파일**: `src/agents/channel-tools.ts:50-200`

```typescript
export function listChannelAgentTools(params: {
  cfg?: OpenClawConfig;
  channel?: string;
  agentAccountId?: string;
  messageTo?: string;
  // ...
}): AnyAgentTool[] {

  const channel = normalizeMessageChannel(params.channel);
  if (!channel) return [];

  const tools: AnyAgentTool[] = [];

  // 1. Send message tool
  tools.push({
    name: "send_message",
    description: `Send a message via ${channel}`,
    parameters: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient (E.164 for WhatsApp, user ID for Slack)"
        },
        text: { type: "string", description: "Message text" },
        threadId: { type: "string", description: "Thread ID (optional)" },
      },
      required: ["to", "text"],
    },
    execute: async (args: { to: string; text: string; threadId?: string }) => {
      const adapter = getChannelAdapter(channel);

      return adapter.sendMessage({
        accountId: params.agentAccountId,
        to: args.to,
        text: args.text,
        threadId: args.threadId,
      });
    },
  });

  // 2. React to message tool
  if (channel === "telegram" || channel === "signal") {
    tools.push({
      name: "react_to_message",
      description: "React to a message with an emoji",
      parameters: {
        type: "object",
        properties: {
          messageId: { type: "string" },
          emoji: { type: "string", description: "Emoji to react with" },
        },
        required: ["messageId", "emoji"],
      },
      execute: async (args) => {
        const adapter = getChannelAdapter(channel);
        return adapter.reactToMessage({
          accountId: params.agentAccountId,
          messageId: args.messageId,
          emoji: args.emoji,
        });
      },
    });
  }

  // 3. Upload file tool
  tools.push({
    name: "upload_file",
    description: `Upload a file via ${channel}`,
    parameters: {
      type: "object",
      properties: {
        to: { type: "string" },
        filePath: { type: "string", description: "Path to file" },
        caption: { type: "string", description: "Optional caption" },
      },
      required: ["to", "filePath"],
    },
    execute: async (args) => {
      const adapter = getChannelAdapter(channel);
      const fileData = await fs.readFile(args.filePath);

      return adapter.uploadFile({
        accountId: params.agentAccountId,
        to: args.to,
        filename: path.basename(args.filePath),
        data: fileData,
        caption: args.caption,
      });
    },
  });

  return tools;
}
```

---

## 6. 핵심 컴포넌트

### 6.1 Configuration Management

**파일**: `src/config/config.ts:50-200`

```yaml
# ~/.openclaw/config.yaml
agents:
  defaults:
    workspace: ~/Documents/openclaw-workspace
    model:
      primary: anthropic/claude-3-5-sonnet-20241022
      fallbacks:
        - provider: anthropic
          model: claude-3-opus-20240229
        - provider: openai
          model: gpt-4-turbo
    thinkingDefault: medium
    verboseDefault: on
    contextTokens: 200000
    heartbeat:
      enabled: true
      intervalSeconds: 300
  list:
    - id: main
      workspace: ~/Documents/main-agent
    - id: coding-expert
      workspace: ~/Documents/coding-workspace
      model:
        primary: openai/o1-preview
      skillsFilter:
        allow: ["python", "typescript", "rust"]

routing:
  bindings:
    # WhatsApp 라우팅
    - match:
        channel: whatsapp
        accountId: "+821012345678"
        peer:
          kind: dm
          id: "+821087654321"
      agentId: coding-expert

    # Slack 라우팅
    - match:
        channel: slack
        teamId: T01234567
        accountId: U98765432
      agentId: main

    # 기본 라우팅 (와일드카드)
    - match:
        channel: whatsapp
        accountId: "*"
      agentId: main

session:
  dmScope: per-channel-peer  # main | per-peer | per-channel-peer
  identityLinks:
    "+821012345678": ["+821087654321", "U98765432"]

tools:
  exec:
    security: ask  # allow | ask | deny
    safeBins:
      - git
      - npm
      - python
      - node
    timeoutSec: 300
    backgroundMs: 5000
    applyPatch:
      allowModels:
        - anthropic/claude-3-5-sonnet-20241022

  policy:
    global:
      deny: ["system_shutdown", "format_disk"]

    agents:
      coding-expert:
        allow: ["exec", "read", "write", "edit", "search"]
        deny: ["send_message", "upload_file"]

sandbox:
  enabled: true
  sessions:
    "agent-main:whatsapp:+821012345678:dm:unknown":
      enabled: true
      workspaceAccess: ro  # ro | rw
      image: openclaw-sandbox:latest
      policy:
        deny: ["write", "edit", "exec"]

memory:
  enabled: true
  provider: local  # local | pinecone | weaviate
  citations: always  # always | auto | off

gateway:
  endpoint: ws://localhost:3737
  enabled: true
```

### 6.2 Session Store

**파일**: `src/config/sessions.ts:40-150`

세션 정보는 `~/.openclaw/sessions.json`에 저장됩니다:

```json
{
  "agent-main:whatsapp:+821012345678:dm:+821087654321": {
    "sessionId": "sess_abc123",
    "updatedAt": 1706889600000,
    "thinkingLevel": "high",
    "verboseLevel": "on",
    "modelOverride": "claude-3-opus-20240229",
    "providerOverride": "anthropic",
    "authProfileOverride": "profile-personal",
    "authProfileOverrideSource": "user",
    "skillsSnapshot": {
      "version": "1.0.0",
      "resolvedSkills": [
        { "name": "git-helper", "path": "/skills/git-helper" }
      ]
    },
    "channel": "whatsapp",
    "chatType": "dm",
    "spawnedBy": null
  }
}
```

**세션 키 활용**:
- 세션 파일 경로: `~/.openclaw/sessions/{sessionKey}.jsonl`
- 락 파일: `~/.openclaw/sessions/{sessionKey}.lock`
- 동시성 제어를 통해 여러 요청 직렬화

### 6.3 Auth Profiles

**파일**: `src/agents/auth-profiles.ts:30-200`

Auth profile은 여러 API 키를 관리하고 순환합니다:

```json
{
  "profiles": {
    "profile-work": {
      "id": "profile-work",
      "provider": "anthropic",
      "apiKey": "sk-ant-api03-...",
      "priority": 1,
      "cooldownMinutes": 5,
      "lastUsed": 1706889600000,
      "lastFailure": null,
      "failureCount": 0
    },
    "profile-personal": {
      "id": "profile-personal",
      "provider": "anthropic",
      "apiKey": "sk-ant-api03-...",
      "priority": 2,
      "cooldownMinutes": 5,
      "lastUsed": 1706889500000,
      "lastFailure": 1706889400000,
      "failureCount": 2
    },
    "profile-openai": {
      "id": "profile-openai",
      "provider": "openai",
      "apiKey": "sk-...",
      "priority": 10,
      "cooldownMinutes": 10,
      "lastUsed": null,
      "lastFailure": null,
      "failureCount": 0
    }
  }
}
```

**순환 로직**:
1. Priority 순으로 정렬
2. Cooldown 중인 프로필 건너뛰기
3. Auth 실패 시 다음 프로필로 전환
4. 모든 프로필 실패 시 모델 폴백

### 6.4 Tool Policy Engine

**파일**: `src/agents/tool-policy.ts:50-300`

도구 정책은 여러 레벨에서 적용됩니다:

```typescript
// 1. Global policy (모든 에이전트)
const globalPolicy = {
  allow: ["*"],
  deny: ["system_shutdown", "rm_rf_root"],
};

// 2. Agent policy (특정 에이전트)
const agentPolicy = {
  allow: ["exec", "read", "write", "search"],
  deny: ["send_message"],
};

// 3. Provider policy (특정 모델 제공자)
const providerPolicy = {
  allow: ["*"],
  deny: ["browser"],  // Google은 browser 도구 불안정
};

// 4. Group policy (채널/그룹)
const groupPolicy = {
  allow: ["send_message", "react_to_message"],
  deny: ["exec"],  // 그룹 채팅에서 exec 금지
};

// 5. Sandbox policy (샌드박스 환경)
const sandboxPolicy = {
  allow: ["read"],
  deny: ["write", "exec"],  // 읽기 전용 샌드박스
};

// 6. Subagent policy (하위 에이전트)
const subagentPolicy = {
  allow: ["read", "search"],
  deny: ["spawn_agent"],  // 중첩 spawn 방지
};

// 정책 해결 순서 (AND 연산)
function isToolAllowed(toolName: string): boolean {
  return isAllowedByPolicy(toolName, globalPolicy) &&
         isAllowedByPolicy(toolName, agentPolicy) &&
         isAllowedByPolicy(toolName, providerPolicy) &&
         isAllowedByPolicy(toolName, groupPolicy) &&
         isAllowedByPolicy(toolName, sandboxPolicy) &&
         isAllowedByPolicy(toolName, subagentPolicy);
}
```

### 6.5 Sandbox Isolation

**파일**: `src/agents/sandbox.ts:40-200`

샌드박스는 Docker 컨테이너를 통해 격리됩니다:

```typescript
export interface SandboxContext {
  enabled: true;
  workspaceDir: string;        // 컨테이너 내부 경로
  workspaceAccess: "ro" | "rw"; // 읽기 전용 또는 읽기/쓰기
  image: string;                // Docker 이미지
  containerId?: string;         // 실행 중인 컨테이너 ID
  policy?: ToolPolicy;          // 샌드박스 내 도구 정책
}

export async function resolveSandboxContext(params: {
  config?: OpenClawConfig;
  sessionKey: string;
  workspaceDir: string;
}): Promise<SandboxContext | null> {

  const sandboxCfg = params.config?.sandbox;
  if (!sandboxCfg?.enabled) return null;

  // 세션별 샌드박스 설정
  const sessionCfg = sandboxCfg.sessions?.[params.sessionKey];
  if (!sessionCfg?.enabled) return null;

  // Docker 컨테이너 시작
  const containerId = await startSandboxContainer({
    image: sessionCfg.image ?? "openclaw-sandbox:latest",
    workspaceDir: params.workspaceDir,
    access: sessionCfg.workspaceAccess ?? "ro",
  });

  return {
    enabled: true,
    workspaceDir: "/workspace",  // 컨테이너 내부 경로
    workspaceAccess: sessionCfg.workspaceAccess ?? "ro",
    image: sessionCfg.image ?? "openclaw-sandbox:latest",
    containerId,
    policy: sessionCfg.policy,
  };
}
```

**샌드박스 내 명령 실행**:

```typescript
async function executeInSandbox(params: {
  command: string;
  sandbox: SandboxContext;
  background?: boolean;
}): Promise<ExecResult> {

  const { containerId } = params.sandbox;

  // docker exec 를 통한 실행
  const dockerCommand = [
    "docker", "exec",
    "-w", "/workspace",  // 작업 디렉토리
    containerId,
    "bash", "-c", params.command
  ];

  return executeCommand({
    command: dockerCommand.join(" "),
    timeoutMs: 120000,
    onOutput: (chunk) => {
      // 실시간 출력
      emitSandboxOutput(chunk);
    },
  });
}
```

---

## 7. 주요 설계 패턴

### 7.1 Command Queue Pattern

**파일**: `src/process/command-queue.ts:30-150`

세션별 및 전역 큐를 통해 동시성을 제어합니다:

```typescript
// Lane별 큐 관리
const lanes = new Map<string, Queue>();

export function enqueueCommandInLane<T>(
  laneId: string,
  task: () => Promise<T>,
  options?: { priority?: number }
): Promise<T> {

  let queue = lanes.get(laneId);
  if (!queue) {
    queue = new Queue({ concurrency: 1 });  // 직렬 실행
    lanes.set(laneId, queue);
  }

  return queue.add(task, options);
}

// 세션 레인: 같은 세션 요청은 순차 실행
const sessionLane = `session:${sessionKey}`;

// 전역 레인: 모든 요청 대상 제한
const globalLane = `global:${options?.lane ?? "default"}`;

// 중첩 큐
return enqueueCommandInLane(sessionLane, () =>
  enqueueCommandInLane(globalLane, async () => {
    // 실제 작업
  })
);
```

**효과**:
- 같은 세션의 요청은 순차 처리 (race condition 방지)
- 전역 레인으로 시스템 부하 제어
- Lane별 독립적 처리 (다른 세션은 병렬 실행)

### 7.2 Retry with Fallback Pattern

```typescript
// Auth profile fallback
while (profileIndex < profileCandidates.length) {
  try {
    await applyApiKeyInfo(profileCandidates[profileIndex]);
    break;
  } catch (err) {
    profileIndex += 1;
  }
}

// Model fallback
for (const { provider, model } of fallbackModels) {
  try {
    return await runAgent({ provider, model });
  } catch (err) {
    if (!(err instanceof FailoverError)) throw err;
    continue;  // 다음 모델로
  }
}

// Thinking level fallback
const attemptedLevels = new Set<ThinkLevel>();
while (true) {
  attemptedLevels.add(currentLevel);
  try {
    return await runWithThinkingLevel(currentLevel);
  } catch (err) {
    const fallback = pickFallbackLevel(err, attemptedLevels);
    if (!fallback) throw err;
    currentLevel = fallback;
  }
}
```

### 7.3 Hook System

**파일**: `src/plugins/hook-runner-global.ts:20-100`

```typescript
export interface HookRunner {
  hasHooks(event: "before_agent_start" | "agent_end"): boolean;

  runBeforeAgentStart(
    data: { prompt: string; messages: AgentMessage[] },
    context: HookContext
  ): Promise<{ prependContext?: string }>;

  runAgentEnd(
    data: { messages: AgentMessage[]; success: boolean; error?: string },
    context: HookContext
  ): Promise<void>;
}

// Hook 실행 예시
if (hookRunner?.hasHooks("before_agent_start")) {
  const result = await hookRunner.runBeforeAgentStart(
    { prompt, messages },
    { agentId, sessionKey, workspaceDir }
  );

  if (result?.prependContext) {
    // Hook이 컨텍스트 추가 (예: 메모리 검색 결과)
    prompt = `${result.prependContext}\n\n${prompt}`;
  }
}
```

**Hook 사용 예시**:
- `before_agent_start`: 메모리 검색, 컨텍스트 주입
- `agent_end`: 대화 로깅, 메모리 저장, 분석

### 7.4 Stream Processing

```typescript
// LLM 스트리밍
const subscription = subscribeEmbeddedPiSession({
  session,
  onBlockReply: (chunk: string) => {
    // 텍스트 청크 수신
    process.stdout.write(chunk);
  },
  onToolResult: (toolName: string, result: unknown) => {
    // 도구 실행 결과
    console.log(`[${toolName}] completed`);
  },
  onReasoningStream: (reasoning: string) => {
    // Reasoning 토큰 (thinking)
    // 사용자에게는 표시하지 않음
  },
});

// 이벤트 기반 처리
emitAgentEvent({
  runId,
  stream: "lifecycle",
  data: { phase: "start", startedAt: Date.now() }
});

emitAgentEvent({
  runId,
  stream: "tool",
  data: { toolName: "exec", status: "running" }
});

emitAgentEvent({
  runId,
  stream: "lifecycle",
  data: { phase: "end", endedAt: Date.now() }
});
```

---

## 8. 코드 레벨 분석

### 8.1 Entry to Agent Command

```
openclaw.mjs (CLI binary)
  ↓
src/entry.ts (normalize Node warnings)
  ↓
src/index.ts (load config, setup error handling)
  ↓
src/cli/run-main.ts (build Commander program)
  ↓
src/cli/program/build-program.ts (register commands)
  ↓
src/cli/program/register.agent.ts (agent command)
  ↓
src/commands/agent-via-gateway.ts (Gateway mode)
  OR
src/commands/agent.ts (Local mode)
  ↓ (Local mode)
src/commands/agent.ts::agentCommand()
  1. loadConfig()
  2. resolveSession()
  3. ensureAgentWorkspace()
  4. runWithModelFallback()
     ↓
     src/agents/model-fallback.ts::runWithModelFallback()
       • Auth profile rotation
       • Model fallback loop
       ↓
       run(provider, model)
         ↓
         src/agents/pi-embedded.ts::runEmbeddedPiAgent()
           (wrapper around pi-embedded-runner/run.ts)
```

### 8.2 Embedded Agent Runner

```
src/agents/pi-embedded-runner/run.ts::runEmbeddedPiAgent()
  1. enqueueSession() / enqueueGlobal()  → 큐 기반 동시성 제어
  2. resolveModel()                      → 모델 레지스트리에서 모델 해결
  3. evaluateContextWindowGuard()        → Context window 검증
  4. Auth profile 순환 루프
     while (profileIndex < candidates.length)
       • isProfileInCooldown() 체크
       • applyApiKeyInfo()
  5. Thinking level 폴백 루프
     while (true)
       • runEmbeddedAttempt()
         ↓
         src/agents/pi-embedded-runner/run/attempt.ts::runEmbeddedAttempt()
           1. Workspace 준비
           2. Sandbox 해결
           3. Skills 로드
           4. Bootstrap 파일 로드
           5. Tool 생성 (createOpenClawCodingTools)
           6. System prompt 생성
           7. Session lock 획득
           8. Session manager 열기
           9. Session 준비 (history 정리)
          10. Agent session 생성 (pi-coding-agent)
          11. Event 구독 (subscribeEmbeddedPiSession)
          12. Hook 실행 (before_agent_start)
          13. 이미지 감지 및 로드
          14. LLM prompt 실행 (session.prompt())
          15. Compaction 재시도 대기
          16. Hook 실행 (agent_end)
          17. 결과 구성 및 반환
       • Error handling
         - Context overflow → auto-compaction → retry
         - Auth failure → advanceAuthProfile() → retry
         - Thinking level mismatch → fallback → retry
       • Success → return payloads
```

### 8.3 Tool Execution Flow

```
src/agents/pi-tools.ts::createOpenClawCodingTools()
  1. resolveEffectiveToolPolicy()  → 도구 정책 해결
  2. Create tools
     • createSandboxedReadTool() or createOpenClawReadTool()
     • createSandboxedWriteTool() or createWriteTool()
     • createSandboxedEditTool() or createEditTool()
     • createExecTool()
     • createProcessTool()
     • createOpenClawTools() (subagent, memory, etc.)
     • listChannelAgentTools() (send_message, etc.)
  3. filterToolsByPolicy()         → 정책에 따라 필터링
  4. Provider compatibility
     • patchToolSchemaForClaudeCompatibility()
     • sanitizeToolsForGoogle()
  5. Wrap tools
     • wrapToolWithBeforeToolCallHook()
     • wrapToolWithAbortSignal()
  6. Return filtered tools
     ↓
     pi-coding-agent receives tools
     ↓
     LLM streams response with tool calls
     ↓
     pi-coding-agent executes tool
       ↓
       Tool execute() function
         • Exec tool: approval flow → PTY/spawn → return result
         • Send message tool: channel adapter → send → return status
         • Read tool: fs.readFile() → return content
     ↓
     Tool result injected into session
     ↓
     LLM continues with tool result
```

### 8.4 Session File Format

세션은 JSONL 형식으로 저장됩니다 (`~/.openclaw/sessions/{sessionKey}.jsonl`):

```jsonl
{"type":"session","sessionId":"sess_abc123","createdAt":1706889600000}
{"type":"message","id":"msg_001","role":"user","content":"안녕","timestamp":1706889601000}
{"type":"message","id":"msg_002","role":"assistant","content":"안녕하세요!","timestamp":1706889602000}
{"type":"message","id":"msg_003","role":"user","content":"날씨 알려줘","timestamp":1706889610000}
{"type":"tool","id":"tool_001","parentId":"msg_004","name":"exec","input":{"command":"curl wttr.in/Seoul?format=3"},"timestamp":1706889611000}
{"type":"tool_result","id":"tool_res_001","toolId":"tool_001","output":"Seoul: ⛅️  +5°C","timestamp":1706889612000}
{"type":"message","id":"msg_004","role":"assistant","content":"서울 날씨는 5도이고 구름이 조금 있습니다.","timestamp":1706889613000}
```

**Entry types**:
- `session`: 세션 메타데이터
- `message`: 사용자 또는 어시스턴트 메시지
- `tool`: 도구 호출
- `tool_result`: 도구 실행 결과
- `branch`: 대화 분기
- `compact`: Compaction 기록

---

## 마무리

OpenClaw는 **멀티 채널 지원**, **자동 라우팅**, **모델 폴백**, **샌드박스 격리**, **세밀한 도구 정책**을 갖춘 강력한 개인 비서 AI 에이전트 시스템입니다.

### 핵심 강점

1. **유연한 라우팅**: 채널/계정/피어 기반 자동 에이전트 선택
2. **강력한 폴백**: Auth profile 순환 + 모델 폴백으로 높은 가용성
3. **안전한 실행**: 샌드박스 격리 + Approval flow + 도구 정책
4. **확장성**: Gateway를 통한 분산 실행 + 채널 어댑터
5. **개발자 친화적**: 풍부한 Hook 시스템 + Plugin 지원

### 주요 파일 요약

| 파일 | 역할 |
|------|------|
| `src/commands/agent.ts` | Agent 명령 핸들러 (세션 해결, 모델 선택) |
| `src/routing/resolve-route.ts` | 세션 라우팅 및 세션 키 생성 |
| `src/agents/model-fallback.ts` | 모델 폴백 및 Auth profile 순환 |
| `src/agents/pi-embedded-runner/run.ts` | Embedded agent 실행 엔트리 |
| `src/agents/pi-embedded-runner/run/attempt.ts` | 단일 attempt 실행 (core logic) |
| `src/agents/pi-tools.ts` | 도구 생성 및 정책 필터링 |
| `src/agents/bash-tools.exec.ts` | Bash/Exec 도구 (PTY, approval) |
| `src/agents/channel-tools.ts` | 채널 도구 (send_message 등) |
| `src/config/config.ts` | 설정 로드 및 관리 |
| `src/config/sessions.ts` | 세션 저장소 관리 |

이 문서가 OpenClaw의 내부 동작을 이해하는 데 도움이 되기를 바랍니다!
