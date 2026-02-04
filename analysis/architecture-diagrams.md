# OpenClaw Architecture Diagrams

이 문서는 OpenClaw 에이전트 시스템의 아키텍처를 Mermaid 다이어그램으로 시각화합니다.

---

## 1. 전체 시스템 아키텍처

```mermaid
graph TB
    subgraph "Entry Layer"
        CLI[CLI Entry<br/>openclaw.mjs]
        Entry[Entry Point<br/>src/entry.ts]
        Index[Bootstrap<br/>src/index.ts]
    end

    subgraph "Command Layer"
        Router[Command Router<br/>build-program.ts]
        AgentCmd[Agent Command<br/>register.agent.ts]
    end

    subgraph "Execution Mode"
        Gateway[Gateway Mode<br/>agent-via-gateway.ts]
        Local[Local Mode<br/>agent.ts]
    end

    subgraph "Orchestration Layer"
        Session[Session Resolution<br/>resolve-route.ts]
        Fallback[Model Fallback<br/>model-fallback.ts]
        AuthProfile[Auth Profile Manager<br/>auth-profiles.ts]
    end

    subgraph "Agent Runtime"
        Runner[Embedded Runner<br/>pi-embedded-runner/run.ts]
        Attempt[Attempt Executor<br/>run/attempt.ts]
    end

    subgraph "Execution Context"
        SessionMgr[Session Manager<br/>SessionManager.open]
        Tools[Tool Creation<br/>pi-tools.ts]
        Agent[Pi Agent<br/>createAgentSession]
    end

    subgraph "Tool Execution"
        Bash[Bash/Exec Tool<br/>bash-tools.exec.ts]
        File[File Tools<br/>Read/Write/Edit]
        Channel[Channel Tools<br/>channel-tools.ts]
        Web[Web Tools<br/>Fetch/Search]
        Memory[Memory Tools<br/>Store/Retrieve]
    end

    CLI --> Entry --> Index --> Router
    Router --> AgentCmd
    AgentCmd --> Gateway
    AgentCmd --> Local
    Gateway --> Local
    Local --> Session
    Session --> Fallback
    Fallback --> AuthProfile
    Fallback --> Runner
    Runner --> Attempt
    Attempt --> SessionMgr
    Attempt --> Tools
    Attempt --> Agent
    Agent --> Bash
    Agent --> File
    Agent --> Channel
    Agent --> Web
    Agent --> Memory

    style CLI fill:#e1f5ff
    style Runner fill:#ffe1e1
    style Agent fill:#e1ffe1
    style Tools fill:#fff3e1
```

---

## 2. 사용자 질의 처리 흐름

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant AgentCmd as Agent Command
    participant Route as Route Resolver
    participant Fallback as Model Fallback
    participant Runner as Embedded Runner
    participant Attempt as Attempt Executor
    participant LLM
    participant Tools

    User->>CLI: openclaw agent --message "안녕"
    CLI->>AgentCmd: agentCommand(opts)
    AgentCmd->>AgentCmd: loadConfig()
    AgentCmd->>Route: resolveSession()
    Route-->>AgentCmd: { sessionKey, sessionEntry }
    AgentCmd->>AgentCmd: ensureAgentWorkspace()
    AgentCmd->>Fallback: runWithModelFallback()

    loop Auth Profile & Model Fallback
        Fallback->>Runner: runEmbeddedPiAgent(provider, model)
        Runner->>Runner: Auth profile resolution
        Runner->>Runner: Context window guard

        loop Thinking Level Fallback
            Runner->>Attempt: runEmbeddedAttempt()
            Attempt->>Attempt: Load session history
            Attempt->>Attempt: Generate system prompt
            Attempt->>Attempt: Create tools
            Attempt->>LLM: session.prompt(message)
            LLM->>LLM: Generate response

            alt Tool Call
                LLM->>Tools: Execute tool
                Tools-->>LLM: Tool result
                LLM->>LLM: Continue generation
            end

            LLM-->>Attempt: Final response
            Attempt-->>Runner: { payloads, meta }

            alt Error (Auth/Rate Limit)
                Runner->>Runner: Mark profile failure
                Runner->>Runner: Advance to next profile
            else Error (Context Overflow)
                Runner->>Runner: Auto-compaction
                Runner->>Attempt: Retry
            else Error (Thinking Level)
                Runner->>Runner: Fallback thinking level
                Runner->>Attempt: Retry with new level
            else Success
                Runner-->>Fallback: Success result
            end
        end

        alt All profiles exhausted
            Fallback->>Fallback: Try next model
        else Success
            Fallback-->>AgentCmd: Final result
        end
    end

    AgentCmd-->>User: Display response
```

---

## 3. 세션 라우팅 메커니즘

```mermaid
flowchart TD
    Start([User Request]) --> Input[Input:<br/>channel, accountId,<br/>peer, guildId, teamId]
    Input --> LoadBindings[Load Routing Bindings<br/>from config]
    LoadBindings --> FilterChannel{Match Channel?}

    FilterChannel -->|No| NoBinding[No Binding Found]
    FilterChannel -->|Yes| FilterAccount{Match AccountId?}

    FilterAccount -->|No| NoBinding
    FilterAccount -->|Yes| CheckPeer{Peer exists?}

    CheckPeer -->|Yes| MatchPeer{Match Peer?}
    MatchPeer -->|Yes| ReturnPeer[Return Agent<br/>matchedBy: binding.peer]
    MatchPeer -->|No| CheckParent{Parent Peer?}

    CheckParent -->|Yes| MatchParent{Match Parent?}
    MatchParent -->|Yes| ReturnParent[Return Agent<br/>matchedBy: binding.peer.parent]
    MatchParent -->|No| CheckGuild

    CheckPeer -->|No| CheckGuild{Guild exists?}
    CheckGuild -->|Yes| MatchGuild{Match Guild?}
    MatchGuild -->|Yes| ReturnGuild[Return Agent<br/>matchedBy: binding.guild]
    MatchGuild -->|No| CheckTeam

    CheckGuild -->|No| CheckTeam{Team exists?}
    CheckTeam -->|Yes| MatchTeam{Match Team?}
    MatchTeam -->|Yes| ReturnTeam[Return Agent<br/>matchedBy: binding.team]
    MatchTeam -->|No| CheckAccountBinding

    CheckTeam -->|No| CheckAccountBinding{Specific Account Binding?}
    CheckAccountBinding -->|Yes| ReturnAccount[Return Agent<br/>matchedBy: binding.account]
    CheckAccountBinding -->|No| CheckWildcard{Wildcard Binding<br/>accountId: "*"?}

    CheckWildcard -->|Yes| ReturnChannel[Return Agent<br/>matchedBy: binding.channel]
    CheckWildcard -->|No| NoBinding

    NoBinding --> ReturnDefault[Return Default Agent<br/>matchedBy: default]

    ReturnPeer --> BuildKey[Build Session Key]
    ReturnParent --> BuildKey
    ReturnGuild --> BuildKey
    ReturnTeam --> BuildKey
    ReturnAccount --> BuildKey
    ReturnChannel --> BuildKey
    ReturnDefault --> BuildKey

    BuildKey --> SessionKey[Session Key:<br/>agentId:channel:accountId:peerKind:peerId]
    SessionKey --> End([Return Route])

    style Start fill:#e1f5ff
    style End fill:#e1ffe1
    style ReturnPeer fill:#ffe1e1
    style ReturnDefault fill:#fff3e1
```

---

## 4. 모델 폴백 및 Auth Profile 순환

```mermaid
stateDiagram-v2
    [*] --> LoadConfig: Start
    LoadConfig --> ResolveModels: Load fallback models
    ResolveModels --> LoadProfiles: Load auth profiles
    LoadProfiles --> ProfileLoop: Start profile loop

    state ProfileLoop {
        [*] --> CheckCooldown
        CheckCooldown --> InCooldown: Profile in cooldown
        CheckCooldown --> ApplyProfile: Profile available
        InCooldown --> NextProfile: Skip
        ApplyProfile --> RunAttempt

        RunAttempt --> CheckError
        CheckError --> AuthError: Auth failure
        CheckError --> RateLimit: Rate limit
        CheckError --> ContextOverflow: Context overflow
        CheckError --> ThinkingError: Thinking level error
        CheckError --> Success: No error

        AuthError --> MarkFailure: Mark profile failure (cooldown 60min)
        RateLimit --> MarkFailure: Mark profile failure (cooldown 30min)
        MarkFailure --> NextProfile

        ContextOverflow --> AutoCompact: Attempt compaction
        AutoCompact --> CompactSuccess: Compacted
        AutoCompact --> CompactFail: Failed
        CompactSuccess --> RunAttempt: Retry
        CompactFail --> ContextError: Return error

        ThinkingError --> FallbackThinking: Try lower thinking level
        FallbackThinking --> RunAttempt: Retry

        NextProfile --> HasNext: Check next profile
        HasNext --> CheckCooldown: More profiles
        HasNext --> AllExhausted: No more profiles

        AllExhausted --> [*]
        Success --> MarkGood: Mark profile success
        MarkGood --> [*]
    }

    ProfileLoop --> ModelFallback: All profiles exhausted
    ModelFallback --> NextModel: Try next model
    NextModel --> LoadProfiles: Reset profiles
    ModelFallback --> AllModelsFailed: No more models

    ProfileLoop --> ReturnSuccess: Success
    AllModelsFailed --> ReturnError
    ReturnSuccess --> [*]
    ReturnError --> [*]
```

---

## 5. Embedded Agent Runner 실행 흐름

```mermaid
flowchart TD
    Start([runEmbeddedPiAgent]) --> EnqueueSession[Enqueue in Session Lane]
    EnqueueSession --> EnqueueGlobal[Enqueue in Global Lane]
    EnqueueGlobal --> PrepareWorkspace[Prepare Workspace<br/>mkdir workspaceDir]

    PrepareWorkspace --> ResolveModel[Resolve Model<br/>from registry]
    ResolveModel --> ContextGuard{Context Window<br/>Guard}

    ContextGuard -->|Too Small| BlockError[Throw FailoverError]
    ContextGuard -->|OK| LoadAuthStore[Load Auth Profile Store]

    LoadAuthStore --> ResolveProfileOrder[Resolve Auth Profile Order<br/>by priority]
    ResolveProfileOrder --> ProfileLoop{Profile Loop}

    ProfileLoop -->|Next Profile| CheckCooldown{Profile in<br/>Cooldown?}
    CheckCooldown -->|Yes| ProfileLoop
    CheckCooldown -->|No| ApplyApiKey[Apply API Key<br/>to authStorage]

    ApplyApiKey --> InitThinking[Initialize Thinking Level]
    InitThinking --> ThinkingLoop{Thinking Level Loop}

    ThinkingLoop -->|Attempt| RunAttempt[runEmbeddedAttempt]

    RunAttempt --> CheckPromptError{Prompt Error?}

    CheckPromptError -->|Context Overflow| CheckCompaction{Compaction<br/>Attempted?}
    CheckCompaction -->|No| AutoCompact[Auto-Compaction]
    AutoCompact --> CompactResult{Compacted?}
    CompactResult -->|Yes| ThinkingLoop
    CompactResult -->|No| ReturnOverflowError[Return Context<br/>Overflow Error]
    CheckCompaction -->|Yes| ReturnOverflowError

    CheckPromptError -->|Auth/Rate Limit| MarkProfileFail[Mark Profile Failure<br/>+ Cooldown]
    MarkProfileFail --> AdvanceProfile{More Profiles?}
    AdvanceProfile -->|Yes| ProfileLoop
    AdvanceProfile -->|No| CheckFallback{Fallback<br/>Configured?}
    CheckFallback -->|Yes| ThrowFailover[Throw FailoverError]
    CheckFallback -->|No| ThrowError[Throw Original Error]

    CheckPromptError -->|Thinking Level| FallbackThink[Fallback Thinking Level]
    FallbackThink --> HasFallback{Fallback<br/>Available?}
    HasFallback -->|Yes| ThinkingLoop
    HasFallback -->|No| ThrowError

    CheckPromptError -->|No Error| CheckAssistantError{Assistant Error?}

    CheckAssistantError -->|Auth/Rate/Timeout| MarkProfileFail2[Mark Profile Failure]
    MarkProfileFail2 --> AdvanceProfile2{More Profiles?}
    AdvanceProfile2 -->|Yes| ProfileLoop
    AdvanceProfile2 -->|No| CheckFallback2{Fallback<br/>Configured?}
    CheckFallback2 -->|Yes| ThrowFailover
    CheckFallback2 -->|No| ReturnResult

    CheckAssistantError -->|No Error| MarkProfileGood[Mark Profile Success]
    MarkProfileGood --> MarkProfileUsed[Mark Profile Used]
    MarkProfileUsed --> BuildPayloads[Build Result Payloads]
    BuildPayloads --> ReturnResult[Return Success Result]

    ReturnResult --> End([End])
    ReturnOverflowError --> End
    ThrowFailover --> End
    ThrowError --> End
    BlockError --> End

    style Start fill:#e1f5ff
    style End fill:#e1ffe1
    style RunAttempt fill:#ffe1e1
    style ReturnResult fill:#c8e6c9
```

---

## 6. Attempt Executor 상세 흐름

```mermaid
sequenceDiagram
    participant Runner as Embedded Runner
    participant Attempt as Attempt Executor
    participant Sandbox as Sandbox Context
    participant Skills as Skills Loader
    participant Tools as Tool Creator
    participant Session as Session Manager
    participant Agent as Pi Agent
    participant Hooks as Hook Runner
    participant LLM

    Runner->>Attempt: runEmbeddedAttempt(params)

    Attempt->>Attempt: Create workspace dir
    Attempt->>Sandbox: resolveSandboxContext()
    Sandbox-->>Attempt: sandbox context (or null)

    Attempt->>Skills: loadWorkspaceSkillEntries()
    Skills-->>Attempt: skill entries
    Attempt->>Attempt: resolveSkillsPromptForRun()

    Attempt->>Attempt: resolveBootstrapContextForRun()
    Note over Attempt: Load OPENCLAW.md, etc.

    Attempt->>Tools: createOpenClawCodingTools()
    Tools->>Tools: Resolve tool policies
    Tools->>Tools: Create tools (exec, read, write, etc.)
    Tools->>Tools: Filter by policy
    Tools->>Tools: Wrap with hooks & abort signal
    Tools-->>Attempt: filtered tools

    Attempt->>Attempt: buildEmbeddedSystemPrompt()
    Note over Attempt: Generate system prompt with<br/>workspace info, skills, tools, etc.

    Attempt->>Attempt: acquireSessionWriteLock()
    Note over Attempt: Prevent concurrent writes

    Attempt->>Session: SessionManager.open(sessionFile)
    Session-->>Attempt: sessionManager

    Attempt->>Session: prepareSessionManagerForRun()
    Session->>Session: Load history from JSONL
    Session-->>Attempt: session history

    Attempt->>Attempt: splitSdkTools()
    Note over Attempt: Separate built-in vs custom tools

    Attempt->>Agent: createAgentSession()
    Agent-->>Attempt: { session, agent }

    Attempt->>Agent: applySystemPromptOverride()
    Attempt->>Agent: replaceMessages(history)

    Attempt->>Attempt: subscribeEmbeddedPiSession()
    Note over Attempt: Subscribe to text, tool, reasoning events

    Attempt->>Attempt: Setup timeout timer

    Attempt->>Hooks: hookRunner.runBeforeAgentStart()
    Hooks-->>Attempt: { prependContext }
    Attempt->>Attempt: Prepend context to prompt

    Attempt->>Attempt: detectAndLoadPromptImages()
    Note over Attempt: Detect images in prompt & history
    Attempt->>Attempt: injectHistoryImagesIntoMessages()

    Attempt->>Agent: session.prompt(effectivePrompt, { images })
    Agent->>LLM: Stream API request

    loop LLM Streaming
        LLM-->>Agent: Text chunk
        Agent->>Attempt: onBlockReply(chunk)

        LLM-->>Agent: Tool call
        Agent->>Tools: Execute tool
        Tools-->>Agent: Tool result
        Agent->>LLM: Continue with result
    end

    LLM-->>Agent: Stop reason: end_turn
    Agent-->>Attempt: Streaming complete

    Attempt->>Attempt: waitForCompactionRetry()
    Note over Attempt: Wait if compaction triggered

    Attempt->>Hooks: hookRunner.runAgentEnd()
    Hooks-->>Attempt: (fire and forget)

    Attempt->>Attempt: Build result payloads
    Attempt->>Session: flushPendingToolResults()
    Attempt->>Agent: session.dispose()
    Attempt->>Attempt: Release session lock

    Attempt-->>Runner: { payloads, meta, messagesSnapshot }
```

---

## 7. Tool Execution 아키텍처

```mermaid
graph TB
    subgraph "Tool Creation"
        Creator[createOpenClawCodingTools]
        PolicyResolver[Resolve Tool Policies]
        ToolFactory[Tool Factories]
    end

    subgraph "Tool Policies"
        Global[Global Policy]
        Agent[Agent Policy]
        Provider[Provider Policy]
        Group[Group Policy]
        Sandbox[Sandbox Policy]
        Subagent[Subagent Policy]
    end

    subgraph "Tool Categories"
        File[File Tools<br/>Read/Write/Edit]
        Bash[Bash Tools<br/>Exec/Process]
        OpenClaw[OpenClaw Tools<br/>Memory/Subagent/Session]
        Channel[Channel Tools<br/>Send/React/Upload]
        Web[Web Tools<br/>Fetch/Search]
        Coding[Coding Tools<br/>from pi-coding-agent]
    end

    subgraph "Tool Wrappers"
        Hook[Hook Wrapper<br/>before_tool_call]
        Abort[Abort Signal Wrapper]
        Normalize[Param Normalization]
    end

    subgraph "Tool Execution"
        ExecFlow[Execution Flow]
        Approval[Approval Flow]
        PTY[PTY Execution]
        DockerExec[Docker Exec<br/>Sandbox]
    end

    Creator --> PolicyResolver
    PolicyResolver --> Global
    PolicyResolver --> Agent
    PolicyResolver --> Provider
    PolicyResolver --> Group
    PolicyResolver --> Sandbox
    PolicyResolver --> Subagent

    PolicyResolver --> ToolFactory
    ToolFactory --> File
    ToolFactory --> Bash
    ToolFactory --> OpenClaw
    ToolFactory --> Channel
    ToolFactory --> Web
    ToolFactory --> Coding

    File --> Hook
    Bash --> Hook
    OpenClaw --> Hook
    Channel --> Hook
    Web --> Hook
    Coding --> Hook

    Hook --> Abort
    Abort --> Normalize

    Normalize --> ExecFlow
    ExecFlow --> Approval
    Approval --> PTY
    Approval --> DockerExec

    style Creator fill:#e1f5ff
    style PolicyResolver fill:#ffe1e1
    style ExecFlow fill:#e1ffe1
    style Hook fill:#fff3e1
```

---

## 8. Bash/Exec Tool 실행 흐름

```mermaid
flowchart TD
    Start([Tool Call: exec]) --> ParseParams[Parse Parameters<br/>command, background, elevated]
    ParseParams --> SecurityCheck{Security Policy}

    SecurityCheck -->|deny| ReturnDenied[Return: Denied]
    SecurityCheck -->|allow| CheckSandbox
    SecurityCheck -->|ask| CheckSafeBin{Command in<br/>safeBins?}

    CheckSafeBin -->|Yes| CheckSandbox
    CheckSafeBin -->|No| RequestApproval[Request Approval]

    RequestApproval --> ApprovalChannel{Has Channel?}
    ApprovalChannel -->|Yes| SendApprovalMsg[Send Approval Message<br/>with inline buttons]
    ApprovalChannel -->|No| StdinApproval[Request via stdin]

    SendApprovalMsg --> WaitApproval{User Response}
    StdinApproval --> WaitApproval

    WaitApproval -->|Approved| CheckSandbox
    WaitApproval -->|Denied| ReturnDenied
    WaitApproval -->|Timeout| ReturnTimeout[Return: Timeout]

    CheckSandbox{Sandbox<br/>Enabled?}
    CheckSandbox -->|Yes| DockerExec[Execute in Docker<br/>docker exec container]
    CheckSandbox -->|No| CheckPTY{PTY<br/>Supported?}

    CheckPTY -->|Yes| PTYExec[PTY Execution<br/>node-pty]
    CheckPTY -->|No| SpawnExec[Spawn Execution<br/>child_process.spawn]

    DockerExec --> StreamOutput[Stream Output]
    PTYExec --> StreamOutput
    SpawnExec --> StreamOutput

    StreamOutput --> CheckBackground{Background<br/>Mode?}
    CheckBackground -->|Yes| ReturnPid[Return: Running<br/>with PID]
    CheckBackground -->|No| WaitComplete[Wait for Completion]

    WaitComplete --> CheckTimeout{Timeout?}
    CheckTimeout -->|Yes| KillProcess[Kill Process]
    KillProcess --> ReturnTimeout
    CheckTimeout -->|No| CheckExit{Exit Code}

    CheckExit -->|0| ReturnSuccess[Return: Success<br/>with output]
    CheckExit -->|Non-zero| ReturnError[Return: Error<br/>with output + exit code]

    ReturnSuccess --> End([End])
    ReturnError --> End
    ReturnDenied --> End
    ReturnTimeout --> End
    ReturnPid --> End

    style Start fill:#e1f5ff
    style End fill:#e1ffe1
    style RequestApproval fill:#ffe1e1
    style DockerExec fill:#fff3e1
    style PTYExec fill:#fff3e1
```

---

## 9. Session Lock 및 동시성 제어

```mermaid
sequenceDiagram
    participant Req1 as Request 1
    participant Req2 as Request 2
    participant SessionLane as Session Lane Queue
    participant GlobalLane as Global Lane Queue
    participant Lock as Session Lock
    participant SessionFile as Session File

    par Request 1
        Req1->>SessionLane: enqueue(task1)
        SessionLane->>GlobalLane: enqueue(task1)
        GlobalLane->>Lock: acquireSessionWriteLock()
        Lock->>Lock: Check lock file
        Lock-->>GlobalLane: Lock acquired
        GlobalLane->>SessionFile: Open & read
        SessionFile-->>GlobalLane: Session history
        GlobalLane->>GlobalLane: Execute agent
        Note over GlobalLane: LLM streaming,<br/>tool execution
        GlobalLane->>SessionFile: Write updates
        GlobalLane->>Lock: release()
        Lock->>Lock: Delete lock file
        GlobalLane-->>SessionLane: Result
        SessionLane-->>Req1: Response
    and Request 2 (same session)
        Req2->>SessionLane: enqueue(task2)
        Note over SessionLane: Queued, waiting<br/>for task1 to complete
        SessionLane->>GlobalLane: enqueue(task2)
        GlobalLane->>Lock: acquireSessionWriteLock()
        Lock->>Lock: Wait for lock release
        Note over Lock: Polling until<br/>lock file deleted
        Lock-->>GlobalLane: Lock acquired
        GlobalLane->>SessionFile: Open & read
        SessionFile-->>GlobalLane: Updated session history<br/>(includes task1 results)
        GlobalLane->>GlobalLane: Execute agent
        GlobalLane->>SessionFile: Write updates
        GlobalLane->>Lock: release()
        GlobalLane-->>SessionLane: Result
        SessionLane-->>Req2: Response
    end
```

---

## 10. Tool Policy 해결 흐름

```mermaid
flowchart TD
    Start([Tool Execution Request]) --> LoadPolicies[Load All Policies]

    LoadPolicies --> GlobalPolicy[Global Policy<br/>config.tools.policy.global]
    LoadPolicies --> AgentPolicy[Agent Policy<br/>config.agents.list[id].tools]
    LoadPolicies --> ProviderPolicy[Provider Policy<br/>config.agents.defaults.models[provider].tools]
    LoadPolicies --> GroupPolicy[Group Policy<br/>config.tools.policy.groups]
    LoadPolicies --> SandboxPolicy[Sandbox Policy<br/>config.sandbox.sessions[key].policy]
    LoadPolicies --> SubagentPolicy[Subagent Policy<br/>derived from parent]

    GlobalPolicy --> CheckGlobal{Global<br/>Allows?}
    CheckGlobal -->|No| Denied[Tool Denied]
    CheckGlobal -->|Yes| CheckAgent

    AgentPolicy --> CheckAgent{Agent<br/>Allows?}
    CheckAgent -->|No| Denied
    CheckAgent -->|Yes| CheckProvider

    ProviderPolicy --> CheckProvider{Provider<br/>Allows?}
    CheckProvider -->|No| Denied
    CheckProvider -->|Yes| CheckGroup

    GroupPolicy --> CheckGroup{Group<br/>Allows?}
    CheckGroup -->|No| Denied
    CheckGroup -->|Yes| CheckSandbox

    SandboxPolicy --> CheckSandbox{Sandbox<br/>Allows?}
    CheckSandbox -->|No| Denied
    CheckSandbox -->|Yes| CheckSubagent

    SubagentPolicy --> CheckSubagent{Subagent<br/>Allows?}
    CheckSubagent -->|No| Denied
    CheckSubagent -->|Yes| Allowed[Tool Allowed]

    Allowed --> ExecuteTool[Execute Tool]
    Denied --> ReturnError[Return: Permission Denied]

    ExecuteTool --> End([End])
    ReturnError --> End

    style Start fill:#e1f5ff
    style End fill:#e1ffe1
    style Allowed fill:#c8e6c9
    style Denied fill:#ffcdd2
```

**Policy Resolution Logic**:

```typescript
function isToolAllowedByPolicy(
  toolName: string,
  policy: { allow?: string[]; deny?: string[] }
): boolean {
  // 1. Check deny list (높은 우선순위)
  if (policy.deny?.includes(toolName)) return false;
  if (policy.deny?.includes("*")) return false;

  // 2. Check allow list
  if (policy.allow?.includes("*")) return true;
  if (policy.allow?.includes(toolName)) return true;

  // 3. Default: deny if allow list exists
  if (policy.allow && policy.allow.length > 0) return false;

  // 4. Default: allow if no policy
  return true;
}

// 최종 판단: AND 연산 (모든 정책 통과해야 허용)
const allowed =
  isToolAllowedByPolicy(tool, globalPolicy) &&
  isToolAllowedByPolicy(tool, agentPolicy) &&
  isToolAllowedByPolicy(tool, providerPolicy) &&
  isToolAllowedByPolicy(tool, groupPolicy) &&
  isToolAllowedByPolicy(tool, sandboxPolicy) &&
  isToolAllowedByPolicy(tool, subagentPolicy);
```

---

## 11. 데이터 흐름 다이어그램

```mermaid
graph LR
    subgraph "Input"
        User[User Message]
        Images[Images]
        Config[Config]
    end

    subgraph "Session State"
        SessionStore[Session Store<br/>sessions.json]
        SessionFile[Session File<br/>{sessionKey}.jsonl]
        Skills[Skills Snapshot]
    end

    subgraph "Runtime Context"
        Workspace[Workspace Dir]
        Bootstrap[Bootstrap Files<br/>OPENCLAW.md]
        AgentDir[Agent Dir<br/>~/.openclaw]
        Models[Model Registry]
        AuthStore[Auth Profile Store]
    end

    subgraph "Execution"
        SystemPrompt[System Prompt<br/>Generation]
        History[History<br/>Management]
        Tools[Tool Registry]
        LLM[LLM API]
    end

    subgraph "Output"
        Response[Assistant Response]
        ToolResults[Tool Results]
        SessionUpdate[Updated Session<br/>State]
    end

    User --> SessionStore
    Config --> SessionStore
    SessionStore --> SessionFile

    SessionFile --> History
    Skills --> SystemPrompt
    Config --> SystemPrompt
    Bootstrap --> SystemPrompt
    Workspace --> SystemPrompt
    Models --> SystemPrompt

    SystemPrompt --> LLM
    History --> LLM
    Tools --> LLM
    Images --> LLM
    AuthStore --> LLM

    LLM --> Response
    LLM --> Tools
    Tools --> ToolResults

    Response --> SessionUpdate
    ToolResults --> SessionUpdate
    SessionUpdate --> SessionFile
    SessionUpdate --> SessionStore

    Response --> User

    style User fill:#e1f5ff
    style LLM fill:#ffe1e1
    style Response fill:#e1ffe1
```

---

## 12. Error Handling 및 Retry 전략

```mermaid
stateDiagram-v2
    [*] --> Execute: Start execution

    state Execute {
        [*] --> Attempt
        Attempt --> CheckError: Execution complete

        state CheckError <<choice>>
        CheckError --> Success: No error
        CheckError --> ContextOverflow: Context overflow
        CheckError --> AuthError: Auth failure
        CheckError --> RateLimitError: Rate limit
        CheckError --> ThinkingError: Thinking mismatch
        CheckError --> TimeoutError: Timeout
        CheckError --> UnknownError: Other errors

        state ContextOverflow {
            [*] --> CheckCompacted
            CheckCompacted --> AlreadyCompacted: Compaction attempted
            CheckCompacted --> TryCompact: Not yet attempted
            TryCompact --> CompactSuccess: Success
            TryCompact --> CompactFail: Failed
            CompactSuccess --> [*]: Retry
            CompactFail --> [*]: Report error
            AlreadyCompacted --> [*]: Report error
        }

        state AuthError {
            [*] --> Auth_MarkFailure: Set cooldown
            Auth_MarkFailure --> Auth_CheckProfiles: More profiles?
            Auth_CheckProfiles --> Auth_NextProfile: Yes
            Auth_CheckProfiles --> Auth_ModelFallback: No
            Auth_NextProfile --> [*]: Retry with profile
            Auth_ModelFallback --> [*]: Try next model
        }

        state RateLimitError {
            [*] --> Rate_MarkCooldown: Set long cooldown
            Rate_MarkCooldown --> Rate_CheckProfiles: More profiles?
            Rate_CheckProfiles --> Rate_NextProfile: Yes
            Rate_CheckProfiles --> Rate_ModelFallback: No
            Rate_NextProfile --> [*]: Retry with profile
            Rate_ModelFallback --> [*]: Try next model
        }

        state ThinkingError {
            [*] --> Think_CheckAttempted: Check attempted levels
            Think_CheckAttempted --> Think_HasFallback: Lower level available
            Think_CheckAttempted --> Think_NoFallback: All attempted
            Think_HasFallback --> [*]: Retry with fallback
            Think_NoFallback --> [*]: Report error
        }

        state TimeoutError {
            [*] --> Timeout_MarkTimeout: Mark profile timeout
            Timeout_MarkTimeout --> Timeout_CheckProfiles: More profiles?
            Timeout_CheckProfiles --> Timeout_NextProfile: Yes
            Timeout_CheckProfiles --> Timeout_Report: No
            Timeout_NextProfile --> [*]: Retry with profile
            Timeout_Report --> [*]: Report timeout
        }

        ContextOverflow --> [*]: Decision
        AuthError --> [*]: Decision
        RateLimitError --> [*]: Decision
        ThinkingError --> [*]: Decision
        TimeoutError --> [*]: Decision
        UnknownError --> [*]: Report error
        Success --> [*]: Return result
    }

    Execute --> RetryDecision: Error decision
    RetryDecision --> RetryAttempt: Retry
    RetryDecision --> RetryModel: Try next model
    RetryDecision --> FinalError: All failed

    RetryAttempt --> Execute: Retry execution
    RetryModel --> Execute: Try fallback model
    FinalError --> [*]: Return error
    Execute --> [*]: Success
```

---

이 다이어그램들은 OpenClaw 에이전트 시스템의 핵심 아키텍처와 동작 방식을 시각화한 것입니다. 각 다이어그램은 서로 다른 관점에서 시스템을 설명하며, 전체적인 이해를 돕기 위해 작성되었습니다.
