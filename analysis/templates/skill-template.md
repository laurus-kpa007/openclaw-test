---
# Skill 메타데이터 (YAML Frontmatter)
# 모든 필드는 선택사항이지만, name과 description은 권장됩니다.

# 필수: Skill 고유 이름 (영숫자, 하이픈, 언더스코어만 사용)
name: my-skill

# 필수: Skill 설명 (한 줄 요약)
description: Brief description of what this skill does

# 선택: 아이콘 이모지
emoji: 🔧

# 선택: 공식 문서 URL
homepage: https://docs.example.com/my-skill

# 선택: 지원 OS (linux, darwin, win32)
os:
  - linux
  - darwin
  - win32

# 선택: 필수 조건
requires:
  # 필수 바이너리 (모두 필요)
  bins:
    - python3
    - pip

  # 선택적 바이너리 (하나 이상 필요)
  anyBins:
    - npm
    - yarn
    - pnpm

  # 필수 환경 변수
  env:
    - MY_API_KEY
    - MY_CONFIG_PATH

  # 필수 설정 값
  config:
    - tools.myTool.enabled

# 선택: 설치 방법 (여러 방법 지정 가능)
install:
  # Homebrew (macOS/Linux)
  - kind: brew
    formula: my-tool
    os: [darwin, linux]
    bins: [my-tool]

  # NPM/Yarn/PNPM (Node.js)
  - kind: node
    package: my-tool-cli
    bins: [my-tool]

  # uv (Python)
  - kind: uv
    package: my-python-tool
    bins: [my-tool]

  # Go install
  - kind: go
    module: github.com/user/my-tool@latest
    bins: [my-tool]

  # 다운로드 (바이너리)
  - kind: download
    url: https://releases.example.com/my-tool-${os}-${arch}.tar.gz
    archive: tar.gz
    extract: true
    stripComponents: 1
    targetDir: ~/.local/bin

# 선택: Command dispatch (CLI 명령으로 직접 호출 시 동작)
# "tool"로 설정하면 특정 도구를 직접 실행
command-dispatch: tool

# command-dispatch가 "tool"인 경우 실행할 도구 이름
command-tool: exec

# command-tool로 전달할 인자 모드
# - "raw": 사용자 입력을 그대로 전달
command-arg-mode: raw

# 선택: 사용자 직접 호출 가능 여부 (/skill-name)
# true: 사용자가 "/my-skill" 명령으로 호출 가능
# false: 모델만 자동으로 사용 가능
user-invocable: true

# 선택: 모델의 자동 호출 금지
# true: 모델이 자동으로 이 스킬을 참조하지 않음 (사용자 명령만)
# false: 모델이 필요 시 자동으로 참조
disable-model-invocation: false

# 선택: 항상 프롬프트에 포함
# true: 모든 대화에서 이 스킬을 프롬프트에 포함
# false: 필요 시에만 포함
always: false

# 선택: Primary 환경 변수
# 이 스킬의 주요 환경 변수 (설정 확인 시 사용)
primaryEnv: MY_API_KEY

# 선택: Skill 키 (고유 식별자, 기본값은 name)
skillKey: my-skill-v2

---

# My Skill

## 개요

이 스킬은 [작업 설명]을 수행합니다.

### 언제 사용하나요?

- 시나리오 1: [설명]
- 시나리오 2: [설명]
- 시나리오 3: [설명]

### 주요 기능

1. **기능 1**: [설명]
2. **기능 2**: [설명]
3. **기능 3**: [설명]

---

## 설치 방법

### 자동 설치

이 스킬은 필요한 도구를 자동으로 설치합니다:

```bash
# OpenClaw가 자동으로 설치 (첫 사용 시)
/my-skill
```

### 수동 설치

필요 시 수동으로 설치할 수 있습니다:

```bash
# macOS/Linux (Homebrew)
brew install my-tool

# npm
npm install -g my-tool-cli

# Python (uv)
uv tool install my-python-tool
```

---

## 사용 방법

### 기본 사용

```bash
# 기본 명령
my-tool --option value

# 예시 1
my-tool create --name "My Project"

# 예시 2
my-tool build --output dist/
```

### 고급 사용

```bash
# 설정 파일 사용
my-tool --config config.yaml

# 환경 변수 설정
export MY_API_KEY="your-api-key"
my-tool --api-mode production
```

---

## 예시

### 예시 1: [작업 이름]

**목적**: [목적 설명]

**명령어**:

```bash
my-tool command --param1 value1 --param2 value2
```

**출력**:

```
[예상 출력]
```

**설명**: [상세 설명]

---

### 예시 2: [작업 이름]

**목적**: [목적 설명]

**명령어**:

```bash
my-tool another-command --flag
```

**출력**:

```
[예상 출력]
```

**설명**: [상세 설명]

---

## 코드 예시

### Python

```python
# Python에서 사용하는 방법
import my_tool

# 초기화
client = my_tool.Client(api_key=os.getenv("MY_API_KEY"))

# 작업 수행
result = client.do_something(param="value")
print(result)
```

### TypeScript

```typescript
// TypeScript에서 사용하는 방법
import { MyTool } from 'my-tool';

const client = new MyTool({
  apiKey: process.env.MY_API_KEY,
});

const result = await client.doSomething({ param: 'value' });
console.log(result);
```

### Shell Script

```bash
#!/bin/bash

# 환경 변수 확인
if [ -z "$MY_API_KEY" ]; then
  echo "Error: MY_API_KEY not set"
  exit 1
fi

# 도구 실행
my-tool command --api-key "$MY_API_KEY" --param "value"
```

---

## 설정

### 환경 변수

| 변수명 | 설명 | 필수 | 기본값 |
|--------|------|------|--------|
| `MY_API_KEY` | API 인증 키 | ✅ | - |
| `MY_CONFIG_PATH` | 설정 파일 경로 | ❌ | `~/.config/my-tool/config.yaml` |
| `MY_LOG_LEVEL` | 로그 레벨 | ❌ | `info` |

### 설정 파일

`~/.config/my-tool/config.yaml`:

```yaml
# 기본 설정
default:
  api_key: ${MY_API_KEY}
  timeout: 30
  retry: 3

# 환경별 설정
environments:
  development:
    api_url: https://dev-api.example.com
  production:
    api_url: https://api.example.com
```

---

## 문제 해결

### 일반적인 오류

#### 오류 1: "API key not found"

**원인**: `MY_API_KEY` 환경 변수가 설정되지 않음

**해결**:

```bash
export MY_API_KEY="your-api-key"
```

#### 오류 2: "Connection timeout"

**원인**: 네트워크 연결 문제 또는 API 서버 다운

**해결**:

1. 인터넷 연결 확인
2. API 서버 상태 확인
3. 타임아웃 시간 증가:

```bash
my-tool --timeout 60 command
```

#### 오류 3: "Permission denied"

**원인**: 파일/디렉토리 권한 부족

**해결**:

```bash
# 권한 부여
chmod +x ~/.local/bin/my-tool

# 또는 sudo 사용
sudo my-tool command
```

---

## 모범 사례

### 1. API 키 보안

```bash
# ❌ 잘못된 방법: 하드코딩
my-tool --api-key "sk-1234567890"

# ✅ 올바른 방법: 환경 변수
export MY_API_KEY="sk-1234567890"
my-tool command
```

### 2. 에러 핸들링

```bash
# ✅ 에러 처리
if my-tool command; then
  echo "Success"
else
  echo "Failed"
  exit 1
fi
```

### 3. 로그 활성화

```bash
# 디버깅 시 로그 활성화
MY_LOG_LEVEL=debug my-tool command
```

---

## 참고 자료

- [공식 문서](https://docs.example.com/my-tool)
- [GitHub 저장소](https://github.com/user/my-tool)
- [API 레퍼런스](https://api.example.com/docs)
- [커뮤니티 포럼](https://forum.example.com)

---

## 관련 스킬

- `related-skill-1`: [설명]
- `related-skill-2`: [설명]
- `related-skill-3`: [설명]

---

## 라이선스

[License Name] - [License URL]

---

## 변경 이력

### v1.0.0 (2026-02-04)

- 초기 릴리즈
- 기본 기능 구현

---

## 기여

기여를 환영합니다! [CONTRIBUTING.md](CONTRIBUTING.md)를 참조하세요.

---

**작성자**: Your Name
**최종 업데이트**: 2026-02-04
**버전**: 1.0.0
