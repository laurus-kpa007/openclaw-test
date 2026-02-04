# Brity Works 메신저 봇 개발 설계문서

> **문서 버전**: v2.0  
> **작성일**: 2026-02-04  
> **대상 솔루션**: Samsung SDS Brity Works REST API v2  
> **목적**: Brity Works API 기반 메신저 봇 인터페이스 설계 및 개발 가이드

---

## 목차

1. [개요](#1-개요)
2. [API 연계 시작하기](#2-api-연계-시작하기)
3. [API 스펙 상세](#3-api-스펙-상세)
   - 3.1 [인증 (OAuth 2.0)](#31-인증-oauth-20)
   - 3.2 [메신저 API](#32-메신저-api)
   - 3.3 [메일 API](#33-메일-api)
   - 3.4 [캘린더 API](#34-캘린더-api)
   - 3.5 [임직원/주소록 API](#35-임직원주소록-api)
   - 3.6 [결재 API](#36-결재-api)
   - 3.7 [게시판 API](#37-게시판-api)
4. [시스템 아키텍처 설계](#4-시스템-아키텍처-설계)
5. [시퀀스 다이어그램](#5-시퀀스-다이어그램)
6. [봇 명령어 처리 플로우](#6-봇-명령어-처리-플로우)
7. [토큰 라이프사이클 관리](#7-토큰-라이프사이클-관리)
8. [에러 핸들링](#8-에러-핸들링)
9. [배포 아키텍처](#9-배포-아키텍처)
10. [부록](#10-부록)

---

## 1. 개요

### 1.1 Brity Works란

Brity Works는 삼성SDS의 기업용 협업 솔루션으로, 메신저·메일·캘린더·결재·게시판 등 통합 업무 환경을 제공합니다. REST API v2를 통해 외부 시스템과 연계할 수 있으며, 본 문서는 이 API를 활용한 메신저 봇 개발을 위한 설계문서입니다.

### 1.2 봇 개발 목표

- Brity Messenger를 통한 사용자 인터페이스 제공
- 자연어 기반 명령 처리 (일정 조회, 메일 발송, 임직원 검색 등)
- 외부 시스템 이벤트 기반 알림 전송
- 다중 턴(Multi-Turn) 대화 지원

### 1.3 문서 범위

본 문서는 Brity Works Dev Center / Knox Center의 API 가이드 문서 스크린샷에서 추출한 정보를 기반으로 작성되었습니다. 이미지 해상도 제한으로 일부 파라미터 세부사항은 추정이 포함되어 있으므로, Dev Center의 원본 문서와 대조하여 보완이 필요합니다.

---

## 2. API 연계 시작하기

### 2.1 사전 준비

Brity Works REST API를 사용하려면 먼저 **연계 신청**을 통해 다음 정보를 발급받아야 합니다:

| 항목 | 설명 |
|------|------|
| **System-ID** | 인증된 시스템 인지 확인하는 수단 |
| **Client Credentials** | Access Token 획득에 필요한 인증 정보 |

- 연계 신청 프로세스가 완료되면 신청자의 이메일로 전달됩니다.
- System-ID와 Access Token 정보를 HTTP(S) 헤더에 포함해야 합니다.

> ⚠️ Access Token은 보안 강화를 위해 **주기적으로 만료**됩니다 (1일).  
> ⚠️ API 호출 시 악성 코드나 부적절한 데이터가 포함되지 않도록 주의하세요.

### 2.2 호스트 정보

| 환경 | 호스트 | 용도 |
|------|--------|------|
| **스테이지** | `openapi.stage.brityworks.com` | 개발/테스트 |
| **운영** | `openapi.brityworks.com` | 프로덕션 |

### 2.3 방화벽 정책

| 구분 | 정책 |
|------|------|
| 스테이지 / 운영 환경 | Inbound Any Open |
| 서버 (테스트용 PC 포함)의 Outbound 방화벽이 존재할 경우 | 해당 사업장 담당자를 통하여 방화벽 오픈 신청 필요 |

### 2.4 API 버전

- Brity Works REST API는 개선된 **v2 버전**으로 제공되고 있습니다.
- v1 버전은 더 이상 신규 신청이 불가능합니다.

---

## 3. API 스펙 상세

### 3.1 인증 (OAuth 2.0)

#### 3.1.1 Access Token 획득

전달받은 Client Credentials값을 통해 Access Token을 획득합니다.  
Access Token은 주기적으로 만료되는 값이므로, 자체적으로 DB와 같은 저장소에 저장하여 관리해야 합니다.

**Request**

```
POST {연계 대상 환경에 맞는 호스트}:443/oauth2/token
```

| 항목 | 값 |
|------|---|
| **URL** | `https://openapi.stage.brityworks.com:443/oauth2/token` (스테이지) |
|         | `https://openapi.brityworks.com:443/oauth2/token` (운영) |
| **Method** | POST |

**Request Header**

| Header | Value |
|--------|-------|
| Authorization | `Basic {Client Credentials 값}` |
| Content-Type | `application/x-www-form-urlencoded` |

**Request Body**

| Parameter | Value | 비고 |
|-----------|-------|------|
| grant_type | `client_credentials` | 고정값 |
| scope | `{unique value}` | timestamp 등 고유한 값으로 설정하여 호출 시마다 상이한 값으로 요청해야 합니다. 예: `2019070417210000` |

**Response 예시**

```json
{
    "access_token": "eyJ4NXQiOiNV...loHt21bx8z...",
    "scope": "default",
    "token_type": "Bearer",
    "expires_in": 864000
}
```

| 필드 | 설명 |
|------|------|
| access_token | API 호출 시 사용할 토큰 |
| scope | 범위 (default) |
| token_type | Bearer |
| expires_in | 만료시간 (초). 864000초 ≈ 10일 |

#### 3.1.2 실제 API 호출 방법

Access Token과 System ID를 활용한 실제 API 호출:

**공통 Request Header**

| Header | Value |
|--------|-------|
| Authorization | `Bearer {access_token}` |
| System-ID | `{발급받은 System-ID}` (예: `KCS20REST00001`) |
| Content-Type | `application/json` |
| Accept | `application/json` |

**cURL 예시 (임직원 조회)**

```bash
curl -k -X POST \
  "https://openapi.stage.brityworks.com/employee/api/v2.0/employees?companyCode=S20&epids=M24062008430S5207316%2CC2304030806305202222" \
  -H "accept: application/json" \
  -H "System-ID: KCS20REST00001" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {획득한 Access Token}" \
  -d '{"resultType":"basic"}'
```

#### 3.1.3 토큰 만료 시 갱신

발급된 Access Token은 주기적으로 만료됩니다. 만료될 경우 아래 메시지가 리턴됩니다.

**Access Token 만료 응답 (HTTP 401)**

```json
{
    "code": "900901",
    "message": "Invalid Credentials",
    "description": "Invalid Credentials. Make sure you have provided the correct security credentials"
}
```

만료 시 "1. Access Token 획득" 내용을 참고하여 신규 Access Token을 발급받아 갱신 후 호출합니다.

---

### 3.2 메신저 API

봇을 통한 메시지 전송 및 채팅방 관리 API입니다.

#### 3.2.1 메시지 전송

**Endpoint**

```
POST /messenger/api/v2.0/messages
```

**Request Parameters**

| Parameter Type | Parameter | Mandatory | Data Type | Constraint/Data Type | Sample Data | Note |
|---|---|---|---|---|---|---|
| header | Authorization | Y | String | Bearer {token} | | Access Token |
| header | System-ID | Y | String | | KCS20REST00001 | 시스템 ID |
| body | companyCode | Y | String | | S20 | 회사코드 |
| body | senderEpid | Y | String | | M2406200843... | 발신자 사번(epid) |
| body | receiverEpids | Y | Array[String] | | ["M240620..."] | 수신자 사번 목록 |
| body | messageType | N | String | text/image/file | text | 메시지 유형 |
| body | message | Y | String | | "안녕하세요" | 메시지 내용 |
| body | roomId | N | String | | room_123 | 채팅방 ID (기존 채팅방에 전송 시) |

**Response Parameters (Encrypted)**

| Property | Attribute | Data Type | Sample Value | Note |
|----------|-----------|-----------|-------------|------|
| code | | String | 200 | 응답 코드 |
| message | | String | SUCCESS | 결과 메시지 |
| data | messageId | String | msg_abc123 | 전송된 메시지 ID |

**Sample Request**

```json
{
    "companyCode": "S20",
    "senderEpid": "M2406200843",
    "receiverEpids": ["M2406300123", "M2406300456"],
    "messageType": "text",
    "message": "안녕하세요, 봇에서 보내는 메시지입니다."
}
```

**Sample Response**

```json
{
    "code": "200",
    "message": "SUCCESS",
    "data": {
        "messageId": "msg_abc123"
    }
}
```

#### 3.2.2 봇 메시지 전송

봇 전용 메시지 전송 API입니다.

**Endpoint**

```
POST /messenger/api/v2.0/bot/messages
```

**Request Parameters**

| Parameter | Mandatory | Data Type | Note |
|-----------|-----------|-----------|------|
| companyCode | Y | String | 회사코드 |
| botId | Y | String | 봇 ID |
| roomId | N | String | 대상 채팅방 ID |
| receiverEpids | N | Array[String] | 수신자 사번 목록 (roomId 미지정 시) |
| message | Y | String | 메시지 본문 |
| messageType | N | String | text/card/carousel 등 |
| attachments | N | Array[Object] | 첨부파일 정보 |

#### 3.2.3 채팅방 생성

**Endpoint**

```
POST /messenger/api/v2.0/rooms
```

**Request Parameters**

| Parameter | Mandatory | Data Type | Note |
|-----------|-----------|-----------|------|
| companyCode | Y | String | 회사코드 |
| roomName | N | String | 채팅방 이름 |
| memberEpids | Y | Array[String] | 참여 멤버 사번 목록 |
| roomType | N | String | personal/group |

**Response**

```json
{
    "code": "200",
    "message": "SUCCESS",
    "data": {
        "roomId": "room_new_456",
        "roomName": "프로젝트 논의방",
        "memberCount": 3
    }
}
```

#### 3.2.4 채팅방 목록 조회

**Endpoint**

```
GET /messenger/api/v2.0/rooms
```

**Request Parameters**

| Parameter | Mandatory | Data Type | Note |
|-----------|-----------|-----------|------|
| companyCode | Y | String | 회사코드 |
| epid | Y | String | 조회 대상 사번 |
| pageNo | N | Integer | 페이지 번호 (기본: 1) |
| pageSize | N | Integer | 페이지 크기 (기본: 20) |

---

### 3.3 메일 API

#### 3.3.1 메일 발송

**Endpoint**

```
POST /mail/api/v2.0/mails
```

**Request Parameters**

| Parameter Type | Parameter | Mandatory | Data Type | Sample Data | Note |
|---|---|---|---|---|---|
| header | Authorization | Y | String | Bearer {token} | |
| header | System-ID | Y | String | KCS20REST00001 | |
| body | companyCode | Y | String | S20 | 회사코드 |
| body | senderEpid | Y | String | M2406200843 | 발신자 사번 |
| body | receiverEpids | Y | Array[String] | ["M2406300123"] | 수신자(TO) 사번 목록 |
| body | ccEpids | N | Array[String] | ["M2406300456"] | 참조(CC) 사번 목록 |
| body | bccEpids | N | Array[String] | [] | 숨은참조(BCC) 사번 목록 |
| body | subject | Y | String | "회의 안건" | 메일 제목 |
| body | content | Y | String | "<p>내용</p>" | 메일 본문 (HTML 가능) |
| body | contentType | N | String | text/html | 본문 유형 |
| body | priority | N | String | normal/high/low | 중요도 |
| body | attachments | N | Array[Object] | | 첨부파일 |

**Sample Request**

```json
{
    "companyCode": "S20",
    "senderEpid": "M2406200843",
    "receiverEpids": ["M2406300123"],
    "ccEpids": ["M2406300456"],
    "subject": "주간 업무 보고",
    "content": "<h3>주간 보고</h3><p>금주 진행 사항입니다.</p>",
    "contentType": "text/html",
    "priority": "normal"
}
```

**Response**

```json
{
    "code": "200",
    "message": "SUCCESS",
    "data": {
        "mailId": "mail_789",
        "sendDate": "2026-02-04T10:30:00+09:00"
    }
}
```

#### 3.3.2 메일 목록 조회

**Endpoint**

```
GET /mail/api/v2.0/mails
```

**Request Parameters**

| Parameter | Mandatory | Data Type | Note |
|-----------|-----------|-----------|------|
| companyCode | Y | String | 회사코드 |
| epid | Y | String | 조회 대상 사번 |
| folderType | N | String | inbox/sent/draft/trash |
| pageNo | N | Integer | 페이지 번호 |
| pageSize | N | Integer | 페이지 크기 |
| startDate | N | String | 시작일 (YYYY-MM-DD) |
| endDate | N | String | 종료일 (YYYY-MM-DD) |
| searchKeyword | N | String | 검색 키워드 |

#### 3.3.3 메일 상세 조회

**Endpoint**

```
GET /mail/api/v2.0/mails/{mailId}
```

---

### 3.4 캘린더 API

#### 3.4.1 일정 조회

**Endpoint**

```
GET /calendar/api/v2.0/events
```

**Request Parameters**

| Parameter | Mandatory | Data Type | Sample Data | Note |
|-----------|-----------|-----------|-------------|------|
| companyCode | Y | String | S20 | 회사코드 |
| epid | Y | String | M2406200843 | 조회 대상 사번 |
| startDate | Y | String | 2026-02-04 | 시작일 |
| endDate | Y | String | 2026-02-04 | 종료일 |
| calendarId | N | String | | 캘린더 ID |

**Response**

```json
{
    "code": "200",
    "message": "SUCCESS",
    "data": {
        "events": [
            {
                "eventId": "evt_001",
                "title": "팀 스탠드업 미팅",
                "startDate": "2026-02-04T09:00:00+09:00",
                "endDate": "2026-02-04T09:30:00+09:00",
                "location": "회의실 A",
                "isAllDay": false,
                "attendees": ["M2406200843", "M2406300123"]
            },
            {
                "eventId": "evt_002",
                "title": "고객 미팅",
                "startDate": "2026-02-04T14:00:00+09:00",
                "endDate": "2026-02-04T15:30:00+09:00",
                "location": "6층 대회의실",
                "isAllDay": false,
                "attendees": ["M2406200843"]
            }
        ],
        "totalCount": 2
    }
}
```

#### 3.4.2 일정 생성

**Endpoint**

```
POST /calendar/api/v2.0/events
```

**Request Parameters**

| Parameter | Mandatory | Data Type | Note |
|-----------|-----------|-----------|------|
| companyCode | Y | String | 회사코드 |
| epid | Y | String | 등록자 사번 |
| title | Y | String | 일정 제목 |
| startDate | Y | String | 시작일시 (ISO 8601) |
| endDate | Y | String | 종료일시 (ISO 8601) |
| location | N | String | 장소 |
| description | N | String | 일정 설명 |
| isAllDay | N | Boolean | 종일 일정 여부 |
| attendeeEpids | N | Array[String] | 참석자 사번 목록 |
| reminder | N | Integer | 알림 (분 단위, 예: 15) |
| recurrence | N | Object | 반복 설정 |

#### 3.4.3 일정 수정

**Endpoint**

```
PUT /calendar/api/v2.0/events/{eventId}
```

#### 3.4.4 일정 삭제

**Endpoint**

```
DELETE /calendar/api/v2.0/events/{eventId}
```

---

### 3.5 임직원/주소록 API

#### 3.5.1 임직원 검색

**Endpoint**

```
POST /employee/api/v2.0/employees
```

**Request Parameters**

| Parameter Type | Parameter | Mandatory | Attribute | Data Type | Constraint/Data Type | Sample Data | Note |
|---|---|---|---|---|---|---|---|
| header | Authorization | Y | | String | | Bearer {token} | |
| header | System-ID | Y | | String | | KCS20REST00001 | |
| query | companyCode | Y | | String | | S20 | 회사코드 |
| query | epids | N | | String | | M240620084305520... | 사번 (쉼표 구분, URL 인코딩 필요) |
| body | resultType | N | | String | basic/detail | basic | 응답 상세 수준 |

**Response Parameters (Encrypted)**

| Property | Attribute | Data Type | Sample Value | Note |
|----------|-----------|-----------|-------------|------|
| code | | String | 200 | |
| employees | | Array[Object] | | 임직원 목록 |
| | epid | String | M2406200843 | 사번(epid) |
| | name | String | 홍길동 | 이름 |
| | nameEng | String | Hong Gildong | 영문 이름 |
| | email | String | gdhong@... | 이메일 |
| | deptCode | String | D001 | 부서코드 |
| | deptName | String | AI개발팀 | 부서명 |
| | position | String | 프로 | 직급 |
| | jobTitle | String | 팀장 | 직책 |
| | phone | String | 010-1234-5678 | 연락처 |
| | officePhone | String | 02-1234-5678 | 사무실 전화 |
| | companyCode | String | S20 | 회사코드 |
| | status | String | active | 재직 상태 |

**Sample Request**

```
POST /employee/api/v2.0/employees?companyCode=S20&epids=M24062008430S5207316%2CC2304030806305202222

Headers:
  Authorization: Bearer {token}
  System-ID: KCS20REST00001
  Content-Type: application/json

Body:
{
    "resultType": "basic"
}
```

**Sample Response**

```json
{
    "code": "200",
    "message": "SUCCESS",
    "data": {
        "employees": [
            {
                "epid": "M2406200843",
                "name": "홍길동",
                "email": "gdhong@company.com",
                "deptCode": "D001",
                "deptName": "AI개발팀",
                "position": "프로",
                "phone": "010-1234-5678"
            }
        ],
        "totalCount": 1
    }
}
```

#### 3.5.2 부서 조회

**Endpoint**

```
POST /employee/api/v2.0/departments
```

**Request Parameters**

| Parameter | Mandatory | Data Type | Note |
|-----------|-----------|-----------|------|
| companyCode | Y | String | 회사코드 |
| deptCode | N | String | 부서코드 |
| deptName | N | String | 부서명 (검색) |
| includeSubDept | N | Boolean | 하위 부서 포함 여부 |

---

### 3.6 결재 API

#### 3.6.1 결재 목록 조회

**Endpoint**

```
GET /approval/api/v2.0/drafts
```

**Request Parameters**

| Parameter | Mandatory | Data Type | Note |
|-----------|-----------|-----------|------|
| companyCode | Y | String | 회사코드 |
| epid | Y | String | 조회 대상 사번 |
| draftType | N | String | sent/received/pending |
| status | N | String | draft/progress/approved/rejected |
| pageNo | N | Integer | 페이지 번호 |
| pageSize | N | Integer | 페이지 크기 |
| startDate | N | String | 시작일 |
| endDate | N | String | 종료일 |

#### 3.6.2 결재 상신

**Endpoint**

```
POST /approval/api/v2.0/drafts
```

**Request Parameters**

| Parameter | Mandatory | Data Type | Note |
|-----------|-----------|-----------|------|
| companyCode | Y | String | 회사코드 |
| drafterEpid | Y | String | 기안자 사번 |
| formId | Y | String | 결재 양식 ID |
| title | Y | String | 결재 제목 |
| content | Y | String | 결재 내용 (HTML) |
| approverEpids | Y | Array[String] | 결재선 (순서대로) |
| ccEpids | N | Array[String] | 참조자 목록 |
| urgency | N | String | normal/urgent |

#### 3.6.3 결재 상세 조회

**Endpoint**

```
GET /approval/api/v2.0/drafts/{draftId}
```

---

### 3.7 게시판 API

#### 3.7.1 게시물 목록 조회

**Endpoint**

```
GET /board/api/v2.0/posts
```

**Request Parameters**

| Parameter | Mandatory | Data Type | Note |
|-----------|-----------|-----------|------|
| companyCode | Y | String | 회사코드 |
| boardId | Y | String | 게시판 ID |
| pageNo | N | Integer | 페이지 번호 |
| pageSize | N | Integer | 페이지 크기 |
| searchKeyword | N | String | 검색어 |

#### 3.7.2 게시물 작성

**Endpoint**

```
POST /board/api/v2.0/posts
```

**Request Parameters**

| Parameter | Mandatory | Data Type | Note |
|-----------|-----------|-----------|------|
| companyCode | Y | String | 회사코드 |
| boardId | Y | String | 게시판 ID |
| writerEpid | Y | String | 작성자 사번 |
| title | Y | String | 제목 |
| content | Y | String | 내용 (HTML) |
| category | N | String | 카테고리 |
| attachments | N | Array[Object] | 첨부파일 |
| isNotice | N | Boolean | 공지 여부 |

---

## 4. 시스템 아키텍처 설계

### 4.1 전체 시스템 구성도

```mermaid
graph TB
    subgraph "Client Layer"
        USER["👤 사용자"]
        MOBILE["📱 Brity Messenger<br/>Mobile App"]
        WEB["🖥️ Brity Messenger<br/>Web Client"]
    end

    subgraph "Brity Works Platform"
        direction TB
        MSGR_GW["메신저 게이트웨이"]
        AUTH["🔑 인증 서버<br/>OAuth 2.0<br/>:443/oauth2/token"]
        
        subgraph "REST API v2 Endpoints"
            MSGR_API["📨 메신저 API<br/>/messenger/api/v2.0/"]
            MAIL_API["📧 메일 API<br/>/mail/api/v2.0/"]
            CAL_API["📅 캘린더 API<br/>/calendar/api/v2.0/"]
            ADDR_API["👥 임직원 API<br/>/employee/api/v2.0/"]
            APPR_API["📋 결재 API<br/>/approval/api/v2.0/"]
            BOARD_API["📝 게시판 API<br/>/board/api/v2.0/"]
        end
    end

    subgraph "Bot Server"
        direction TB
        BOT_APP["🤖 봇 애플리케이션"]
        
        subgraph "Core Components"
            MSG_ROUTER["메시지 라우터"]
            TOKEN_MGR["🔐 토큰 관리자"]
            SESSION_MGR["세션 관리자"]
        end
        
        subgraph "Intelligence Layer"
            NLU["🧠 자연어 처리<br/>Intent / Entity"]
            DIALOG["대화 관리자"]
            RESP_GEN["응답 생성기"]
        end
        
        subgraph "API Client Layer"
            API_CLIENTS["Brity API<br/>Client Wrapper"]
        end
        
        subgraph "Infrastructure"
            CACHE["Redis Cache<br/>토큰/세션"]
            LOGGER["구조화 로깅"]
            QUEUE["메시지 큐"]
        end
    end

    subgraph "External Services"
        LLM["🤖 LLM Service<br/>GPT / Claude / etc."]
        EXT_SYS["외부 시스템<br/>ERP · SCM · HR"]
        MONITOR["📊 모니터링<br/>Prometheus + Grafana"]
    end

    USER --> MOBILE & WEB
    MOBILE & WEB --> MSGR_GW
    MSGR_GW <-->|메시지 수발신| BOT_APP
    
    BOT_APP --> MSG_ROUTER --> NLU --> DIALOG --> RESP_GEN
    BOT_APP --> TOKEN_MGR
    TOKEN_MGR -->|Client Credentials| AUTH
    AUTH -->|Access Token| TOKEN_MGR
    TOKEN_MGR --> CACHE
    
    RESP_GEN --> API_CLIENTS
    API_CLIENTS --> MSGR_API & MAIL_API & CAL_API & ADDR_API & APPR_API & BOARD_API
    
    NLU --> LLM
    API_CLIENTS --> EXT_SYS
    BOT_APP -.-> MONITOR
    
    style AUTH fill:#4A90D9,color:#fff
    style BOT_APP fill:#E8744F,color:#fff
    style TOKEN_MGR fill:#F5A623,color:#fff
    style NLU fill:#7B68EE,color:#fff
    style MSGR_API fill:#50C878,color:#fff
```

### 4.2 Brity Works API 맵

```mermaid
graph LR
    subgraph "Brity Works REST API v2 전체 구성"
        direction TB
        
        subgraph AUTH_GROUP["🔑 인증"]
            AUTH_TOKEN["Access Token 발급<br/>POST :443/oauth2/token"]
        end
        
        subgraph MSGR_GROUP["📨 메신저"]
            MSG_SEND["메시지 전송<br/>POST /messenger/.../messages"]
            MSG_BOT["봇 메시지 전송<br/>POST /messenger/.../bot/messages"]
            MSG_ROOM_C["채팅방 생성<br/>POST /messenger/.../rooms"]
            MSG_ROOM_L["채팅방 목록<br/>GET /messenger/.../rooms"]
        end

        subgraph MAIL_GROUP["📧 메일"]
            MAIL_SEND["메일 발송<br/>POST /mail/.../mails"]
            MAIL_LIST["메일 목록<br/>GET /mail/.../mails"]
            MAIL_DETAIL["메일 상세<br/>GET /mail/.../mails/{id}"]
        end
        
        subgraph CAL_GROUP["📅 캘린더"]
            CAL_LIST["일정 조회<br/>GET /calendar/.../events"]
            CAL_CREATE["일정 생성<br/>POST /calendar/.../events"]
            CAL_UPDATE["일정 수정<br/>PUT /calendar/.../events/{id}"]
            CAL_DELETE["일정 삭제<br/>DELETE /calendar/.../events/{id}"]
        end

        subgraph EMP_GROUP["👥 임직원"]
            EMP_SEARCH["임직원 검색<br/>POST /employee/.../employees"]
            EMP_DEPT["부서 조회<br/>POST /employee/.../departments"]
        end

        subgraph APPR_GROUP["📋 결재"]
            APPR_LIST["결재 목록<br/>GET /approval/.../drafts"]
            APPR_CREATE["결재 상신<br/>POST /approval/.../drafts"]
            APPR_DETAIL["결재 상세<br/>GET /approval/.../drafts/{id}"]
        end

        subgraph BOARD_GROUP["📝 게시판"]
            BOARD_LIST["게시물 목록<br/>GET /board/.../posts"]
            BOARD_CREATE["게시물 작성<br/>POST /board/.../posts"]
        end
    end

    style AUTH_GROUP fill:#E3F2FD
    style MSGR_GROUP fill:#FFF3E0
    style MAIL_GROUP fill:#E8F5E9
    style CAL_GROUP fill:#FFF8E1
    style EMP_GROUP fill:#F3E5F5
    style APPR_GROUP fill:#E8EAF6
    style BOARD_GROUP fill:#FCE4EC
    
    style AUTH_TOKEN fill:#4A90D9,color:#fff
    style MSG_BOT fill:#E8744F,color:#fff
    style MAIL_SEND fill:#50C878,color:#fff
    style CAL_CREATE fill:#F5A623,color:#fff
```

### 4.3 봇 서버 내부 컴포넌트 구성도

```mermaid
graph TB
    subgraph "Bot Server Internal Architecture"
        direction TB
        
        subgraph "Inbound"
            WEBHOOK["🌐 Webhook Endpoint<br/>POST /webhook/message"]
            POLL["Polling Worker<br/>(대안)"]
            HEALTH["Health Check<br/>GET /health"]
        end
        
        subgraph "Message Processing Pipeline"
            ROUTER["메시지 라우터<br/>- 중복 검사<br/>- 메시지 검증"]
            INTENT["의도 분류기<br/>(Intent Classifier)"]
            ENTITY["엔티티 추출기<br/>(Entity Extractor)"]
            SLOT_FILL["슬롯 채우기<br/>(Slot Filling)"]
            DIALOG_MGR["대화 관리자<br/>(Dialog State Machine)"]
            RESP_GEN["응답 생성기<br/>(Response Formatter)"]
        end
        
        subgraph "API Client Layer"
            direction LR
            MAIL_CL["MailClient"]
            MSGR_CL["MessengerClient"]
            CAL_CL["CalendarClient"]
            EMP_CL["EmployeeClient"]
            APPR_CL["ApprovalClient"]
            BOARD_CL["BoardClient"]
        end
        
        subgraph "Cross-Cutting Concerns"
            AUTH_MGR["🔐 Auth Manager<br/>- Token Cache<br/>- Auto Refresh<br/>- Retry on 401"]
            CIRCUIT["Circuit Breaker<br/>- 장애 감지<br/>- Fallback"]
            RATE_LIM["Rate Limiter<br/>- API 호출 제한"]
            LOG["Structured Logger<br/>- Request/Response<br/>- Error Tracking"]
        end
        
        subgraph "Storage"
            REDIS["Redis<br/>├ Token Cache<br/>├ Session State<br/>└ Rate Limit Counter"]
            DB["PostgreSQL<br/>├ 대화 로그<br/>├ 사용자 설정<br/>└ 봇 설정"]
        end
    end
    
    WEBHOOK & POLL --> ROUTER
    ROUTER --> INTENT --> ENTITY --> SLOT_FILL --> DIALOG_MGR --> RESP_GEN
    
    RESP_GEN --> MAIL_CL & MSGR_CL & CAL_CL & EMP_CL & APPR_CL & BOARD_CL
    
    MAIL_CL & MSGR_CL & CAL_CL & EMP_CL & APPR_CL & BOARD_CL --> AUTH_MGR
    MAIL_CL & MSGR_CL & CAL_CL & EMP_CL & APPR_CL & BOARD_CL --> CIRCUIT
    MAIL_CL & MSGR_CL & CAL_CL & EMP_CL & APPR_CL & BOARD_CL --> RATE_LIM
    
    AUTH_MGR --> REDIS
    DIALOG_MGR --> REDIS
    LOG --> DB
    
    style WEBHOOK fill:#4A90D9,color:#fff
    style ROUTER fill:#E8744F,color:#fff
    style AUTH_MGR fill:#F5A623,color:#fff
    style INTENT fill:#7B68EE,color:#fff
    style DIALOG_MGR fill:#7B68EE,color:#fff
    style REDIS fill:#DC382D,color:#fff
    style DB fill:#336791,color:#fff
```

---

## 5. 시퀀스 다이어그램

### 5.1 OAuth 2.0 인증 플로우

```mermaid
sequenceDiagram
    autonumber
    participant Bot as 🤖 봇 서버
    participant TM as 토큰 관리자
    participant Cache as Redis Cache
    participant Auth as Brity Auth Server<br/>openapi.brityworks.com<br/>:443/oauth2/token
    participant API as Brity Works API

    Note over Bot,API: 🔐 Access Token 획득 프로세스

    Bot->>TM: API 호출 전 토큰 요청
    TM->>Cache: GET brity:token

    alt ✅ 캐시 HIT (유효한 토큰 존재)
        Cache-->>TM: access_token (TTL 남음)
        TM-->>Bot: Bearer {token}
    else ❌ 캐시 MISS (토큰 없음 또는 만료)
        TM->>Auth: POST /oauth2/token
        Note right of TM: 📤 Request:<br/>─────────────────<br/>Header:<br/>  Authorization: Basic {Client Credentials}<br/>  Content-Type: application/x-www-form-urlencoded<br/>Body:<br/>  grant_type = client_credentials<br/>  scope = {timestamp 기반 고유값}
        Auth-->>TM: 200 OK
        Note left of Auth: 📥 Response:<br/>─────────────────<br/>{<br/>  "access_token": "eyJ...",<br/>  "scope": "default",<br/>  "token_type": "Bearer",<br/>  "expires_in": 864000<br/>}
        TM->>Cache: SET brity:token {token}<br/>EX {expires_in - 3600}
        Note right of TM: TTL을 만료 1시간 전으로<br/>설정하여 사전 갱신 유도
        TM-->>Bot: Bearer {token}
    end

    Bot->>API: API 호출
    Note right of Bot: 📤 Headers:<br/>  Authorization: Bearer {token}<br/>  System-ID: KCS20REST00001<br/>  Content-Type: application/json

    alt ✅ 200 OK
        API-->>Bot: 정상 응답 데이터
    else ❌ 401 Invalid Credentials
        API-->>Bot: 401 Unauthorized
        Note left of API: {"code":"900901",<br/>"message":"Invalid Credentials"}
        Bot->>TM: 토큰 무효화 → 재발급 요청
        TM->>Cache: DEL brity:token
        TM->>Auth: POST /oauth2/token (재발급)
        Auth-->>TM: 새 access_token
        TM->>Cache: SET brity:token {new_token}
        TM-->>Bot: Bearer {new_token}
        Bot->>API: API 재호출 (새 토큰)
        API-->>Bot: 200 OK
    end
```

### 5.2 메신저 봇 메시지 수발신 전체 플로우

```mermaid
sequenceDiagram
    autonumber
    participant User as 👤 사용자
    participant Msgr as 📱 Brity Messenger
    participant GW as Brity Gateway
    participant Bot as 🤖 봇 서버
    participant NLU as 🧠 NLU Engine
    participant BrAPI as Brity Works API
    participant Ext as 외부 시스템

    rect rgb(230, 245, 255)
    Note over User,Ext: 📨 시나리오 1: 사용자 → 봇 (명령 처리)
    User->>Msgr: "오늘 일정 알려줘"
    Msgr->>GW: 메시지 라우팅
    GW->>Bot: POST /webhook/message
    Note right of GW: {<br/>  "sender": "M2406200843",<br/>  "roomId": "room_123",<br/>  "message": "오늘 일정 알려줘",<br/>  "timestamp": "2026-02-04T09:00:00"<br/>}
    
    Bot->>NLU: 의도 분석 요청
    NLU-->>Bot: Intent: calendar.query<br/>Entities: {date: "today"}

    Bot->>BrAPI: GET /calendar/api/v2.0/events<br/>?companyCode=S20&epid=M2406200843<br/>&startDate=2026-02-04&endDate=2026-02-04
    BrAPI-->>Bot: 200 OK (일정 목록 2건)

    Bot->>Bot: 응답 포맷팅
    Bot->>BrAPI: POST /messenger/api/v2.0/bot/messages
    Note right of Bot: {<br/>  "companyCode": "S20",<br/>  "botId": "bot_schedule",<br/>  "roomId": "room_123",<br/>  "message": "📅 오늘 일정 (2건)\n\n• 09:00 팀 스탠드업\n  📍 회의실A\n\n• 14:00 고객 미팅\n  📍 6층 대회의실"<br/>}
    BrAPI-->>Bot: 200 OK
    BrAPI->>Msgr: 봇 응답 전달
    Msgr->>User: 📅 일정 표시
    end

    rect rgb(255, 245, 230)
    Note over User,Ext: 🔔 시나리오 2: 이벤트 드리븐 알림 (봇 → 사용자)
    Ext-->>Bot: 이벤트 수신<br/>(새 결재 요청 도착)
    Bot->>BrAPI: POST /messenger/api/v2.0/bot/messages
    Note right of Bot: {<br/>  "companyCode": "S20",<br/>  "botId": "bot_approval",<br/>  "receiverEpids": ["M2406200843"],<br/>  "message": "📋 새 결재 요청\n\n제목: 출장비 정산\n기안자: 김철수 프로\n금액: 350,000원\n\n[승인] [반려] [상세보기]"<br/>}
    BrAPI->>Msgr: 알림 전달
    Msgr->>User: 🔔 알림 표시
    end
```

### 5.3 API 호출 공통 패턴 (Circuit Breaker 포함)

```mermaid
sequenceDiagram
    autonumber
    participant Logic as 봇 비즈니스 로직
    participant Client as API Client
    participant TM as Token Manager
    participant CB as Circuit Breaker
    participant API as Brity Works API

    Logic->>Client: 요청 (method, path, params)
    Client->>TM: getValidToken()
    TM-->>Client: Bearer {token}
    
    Client->>CB: 요청 전달

    alt 🟢 Circuit CLOSED (정상)
        CB->>API: HTTP Request
        
        alt ✅ 2xx 성공
            API-->>CB: Response Body
            CB->>CB: 성공 카운트 리셋
            CB-->>Client: Response
            Client-->>Logic: 파싱된 결과
            
        else ❌ 401 인증 실패
            API-->>CB: 401 Unauthorized
            CB-->>Client: Auth Error
            Client->>TM: invalidateToken()
            Client->>TM: getValidToken() (재발급)
            TM-->>Client: 새 Bearer {token}
            Client->>CB: 재시도 (새 토큰)
            CB->>API: HTTP Request (재시도)
            API-->>CB: 200 OK
            CB-->>Client: Response
            Client-->>Logic: 결과

        else ⚠️ 429 Rate Limit
            API-->>CB: 429 Too Many Requests
            CB-->>Client: Rate Limit Error
            Client->>Client: Exponential Backoff 대기
            Client->>CB: 재시도
            CB->>API: HTTP Request
            API-->>CB: 200 OK
            CB-->>Client: Response
            Client-->>Logic: 결과

        else 🔴 5xx 서버 에러
            API-->>CB: 500/502/503
            CB->>CB: 실패 카운트 +1
            Note over CB: 실패 5회 연속 →<br/>Circuit OPEN 전환
            CB-->>Client: Server Error
            Client-->>Logic: 에러 (재시도 가능)
        end

    else 🔴 Circuit OPEN (차단 상태)
        CB-->>Client: ⚡ Fast Fail
        Client-->>Logic: Fallback 응답<br/>"일시적으로 서비스를<br/>이용할 수 없습니다"
    end
```

### 5.4 다중 턴 대화 (일정 등록 시나리오)

```mermaid
sequenceDiagram
    autonumber
    participant User as 👤 사용자
    participant Bot as 🤖 봇 서버
    participant Session as 세션 저장소<br/>(Redis)
    participant Cal as 📅 캘린더 API
    participant Msgr as 📨 메신저 API

    Note over User,Msgr: 다중 턴 일정 등록 시나리오

    User->>Bot: "일정 등록해줘"
    Bot->>Session: 세션 생성
    Note right of Bot: {state: "AWAIT_TITLE",<br/>createdAt: now(),<br/>ttl: 300s}
    Bot->>Msgr: POST /messenger/.../bot/messages
    Msgr->>User: "📝 일정 제목을 입력해주세요."

    User->>Bot: "팀 스프린트 리뷰"
    Bot->>Session: 업데이트
    Note right of Bot: {state: "AWAIT_DATE",<br/>title: "팀 스프린트 리뷰"}
    Bot->>Msgr: 응답 전송
    Msgr->>User: "📆 날짜를 입력해주세요.<br/>(예: 2026-02-05 또는 '내일')"

    User->>Bot: "모레"
    Bot->>Bot: 날짜 계산: 2026-02-06
    Bot->>Session: 업데이트
    Note right of Bot: {state: "AWAIT_TIME",<br/>date: "2026-02-06"}
    Bot->>Msgr: 응답 전송
    Msgr->>User: "⏰ 시간을 입력해주세요.<br/>(예: 14:00~15:00)"

    User->>Bot: "오후 2시부터 3시반"
    Bot->>Bot: 시간 파싱:<br/>14:00 ~ 15:30
    Bot->>Session: 업데이트
    Note right of Bot: {state: "CONFIRM",<br/>start: "14:00",<br/>end: "15:30"}
    Bot->>Msgr: 확인 요청
    Msgr->>User: "📅 다음 일정을 등록할까요?<br/>─────────────<br/>📝 팀 스프린트 리뷰<br/>📆 2026-02-06 (금)<br/>⏰ 14:00 ~ 15:30<br/>─────────────<br/>[✅ 확인]  [❌ 취소]"

    alt 사용자가 확인
        User->>Bot: "확인"
        Bot->>Cal: POST /calendar/api/v2.0/events
        Note right of Bot: {<br/>  "companyCode": "S20",<br/>  "epid": "M2406200843",<br/>  "title": "팀 스프린트 리뷰",<br/>  "startDate": "2026-02-06T14:00:00+09:00",<br/>  "endDate": "2026-02-06T15:30:00+09:00"<br/>}
        Cal-->>Bot: 201 Created {eventId: "evt_100"}
        Bot->>Session: 세션 삭제
        Bot->>Msgr: 완료 메시지
        Msgr->>User: "✅ 일정이 등록되었습니다!<br/>📝 팀 스프린트 리뷰<br/>📆 2026-02-06 (금) 14:00~15:30"
    else 사용자가 취소
        User->>Bot: "취소"
        Bot->>Session: 세션 삭제
        Bot->>Msgr: 취소 메시지
        Msgr->>User: "❌ 일정 등록이 취소되었습니다."
    end
```

### 5.5 임직원 검색 → 메일 발송 연계 시나리오

```mermaid
sequenceDiagram
    autonumber
    participant User as 👤 사용자
    participant Bot as 🤖 봇 서버
    participant EmpAPI as 👥 임직원 API
    participant MailAPI as 📧 메일 API
    participant Msgr as 📨 메신저 API

    User->>Bot: "김철수 프로한테 메일 보내줘"
    
    Bot->>Bot: NLU 분석
    Note over Bot: Intent: mail.send<br/>Entity: {name: "김철수", position: "프로"}

    Bot->>EmpAPI: POST /employee/api/v2.0/employees<br/>?companyCode=S20
    Note right of Bot: Body: {"searchName": "김철수",<br/>"resultType": "basic"}
    EmpAPI-->>Bot: 검색 결과 2건
    Note left of EmpAPI: [<br/>  {epid: "M240001", name: "김철수",<br/>   dept: "AI개발팀", position: "프로"},<br/>  {epid: "M240002", name: "김철수",<br/>   dept: "영업팀", position: "프로"}<br/>]

    Bot->>Msgr: 선택 요청
    Msgr->>User: "🔍 김철수 프로 2명 검색됨:<br/><br/>1️⃣ 김철수 프로 (AI개발팀)<br/>2️⃣ 김철수 프로 (영업팀)<br/><br/>누구에게 보낼까요?"

    User->>Bot: "1번"
    Bot->>Msgr: 제목 요청
    Msgr->>User: "📧 메일 제목을 입력해주세요."

    User->>Bot: "프로젝트 진행상황 공유"
    Bot->>Msgr: 내용 요청
    Msgr->>User: "📝 메일 내용을 입력해주세요."

    User->>Bot: "금주 스프린트 결과와 다음 주 계획을 공유드립니다."
    
    Bot->>MailAPI: POST /mail/api/v2.0/mails
    Note right of Bot: {<br/>  "companyCode": "S20",<br/>  "senderEpid": "M2406200843",<br/>  "receiverEpids": ["M240001"],<br/>  "subject": "프로젝트 진행상황 공유",<br/>  "content": "금주 스프린트 결과와...",<br/>  "contentType": "text/plain"<br/>}
    MailAPI-->>Bot: 200 OK {mailId: "mail_999"}

    Bot->>Msgr: 완료 메시지
    Msgr->>User: "✅ 메일이 발송되었습니다!<br/><br/>📧 받는 사람: 김철수 프로 (AI개발팀)<br/>📝 제목: 프로젝트 진행상황 공유"
```

---

## 6. 봇 명령어 처리 플로우

### 6.1 전체 명령어 라우팅

```mermaid
flowchart TD
    START([사용자 메시지 수신]) --> PARSE["메시지 파싱<br/>& 전처리"]
    PARSE --> SESSION{"진행 중인<br/>대화 세션?"}
    
    SESSION -->|있음| SLOT["슬롯 채우기<br/>(Multi-Turn 계속)"]
    SESSION -->|없음| INTENT{"의도 분류<br/>(Intent Classification)"}
    
    INTENT -->|"일정 관련"| CAL_FLOW
    INTENT -->|"메일 관련"| MAIL_FLOW
    INTENT -->|"인사 조회"| HR_FLOW
    INTENT -->|"결재 관련"| APPR_FLOW
    INTENT -->|"게시판"| BOARD_FLOW
    INTENT -->|"일반 대화"| CHAT_FLOW
    INTENT -->|"도움말"| HELP["도움말 메시지 생성"]
    INTENT -->|"분류 불가"| FALLBACK["Fallback 처리<br/>유사 명령 제안"]
    
    subgraph CAL_FLOW["📅 캘린더"]
        CAL_SUB{서브 명령}
        CAL_SUB -->|조회| CAL_Q["GET /calendar/.../events"]
        CAL_SUB -->|등록| CAL_C["Multi-Turn → POST"]
        CAL_SUB -->|수정| CAL_U["PUT /calendar/.../events/{id}"]
        CAL_SUB -->|삭제| CAL_D["DELETE /calendar/.../events/{id}"]
    end
    
    subgraph MAIL_FLOW["📧 메일"]
        MAIL_SUB{서브 명령}
        MAIL_SUB -->|조회| MAIL_Q["GET /mail/.../mails"]
        MAIL_SUB -->|발송| MAIL_S["Multi-Turn → POST"]
        MAIL_SUB -->|상세| MAIL_D2["GET /mail/.../mails/{id}"]
    end
    
    subgraph HR_FLOW["👥 인사 조회"]
        HR_SUB{서브 명령}
        HR_SUB -->|임직원 검색| EMP_S["POST /employee/.../employees"]
        HR_SUB -->|부서 조회| DEPT_S["POST /employee/.../departments"]
    end
    
    subgraph APPR_FLOW["📋 결재"]
        APPR_SUB{서브 명령}
        APPR_SUB -->|목록 조회| APPR_L["GET /approval/.../drafts"]
        APPR_SUB -->|상신| APPR_C["Multi-Turn → POST"]
        APPR_SUB -->|상세| APPR_D2["GET /approval/.../drafts/{id}"]
    end

    subgraph BOARD_FLOW["📝 게시판"]
        BOARD_SUB{서브 명령}
        BOARD_SUB -->|목록| BOARD_L["GET /board/.../posts"]
        BOARD_SUB -->|작성| BOARD_C["Multi-Turn → POST"]
    end
    
    subgraph CHAT_FLOW["💬 대화"]
        LLM_CALL["LLM API 호출<br/>(일반 대화/질의응답)"]
    end
    
    SLOT --> RESPONSE
    CAL_Q & CAL_C & CAL_U & CAL_D --> RESPONSE
    MAIL_Q & MAIL_S & MAIL_D2 --> RESPONSE
    EMP_S & DEPT_S --> RESPONSE
    APPR_L & APPR_C & APPR_D2 --> RESPONSE
    BOARD_L & BOARD_C --> RESPONSE
    LLM_CALL --> RESPONSE
    HELP --> RESPONSE
    FALLBACK --> RESPONSE
    
    RESPONSE["📝 응답 포맷팅"] --> SEND["POST /messenger/.../bot/messages"]
    SEND --> END_NODE([완료])
    
    style START fill:#4A90D9,color:#fff
    style INTENT fill:#7B68EE,color:#fff
    style RESPONSE fill:#50C878,color:#fff
    style SEND fill:#E8744F,color:#fff
```

### 6.2 봇 지원 명령어 표

| 카테고리 | 명령어 예시 | Intent | 호출 API |
|---------|-----------|--------|---------|
| **일정** | "오늘 일정 알려줘" | calendar.query | GET /calendar/.../events |
| | "내일 2시에 회의 등록" | calendar.create | POST /calendar/.../events |
| | "오후 3시 회의 취소" | calendar.delete | DELETE /calendar/.../events/{id} |
| **메일** | "읽지 않은 메일 확인" | mail.query | GET /mail/.../mails |
| | "김철수한테 메일 보내줘" | mail.send | POST /mail/.../mails |
| **인사** | "김철수 프로 연락처" | employee.search | POST /employee/.../employees |
| | "개발팀 조직도" | dept.query | POST /employee/.../departments |
| **결재** | "미결 결재 확인" | approval.pending | GET /approval/.../drafts |
| | "결재 상신해줘" | approval.create | POST /approval/.../drafts |
| **게시판** | "공지사항 확인" | board.query | GET /board/.../posts |
| **일반** | "안녕" / 기타 대화 | chat.general | LLM 호출 |

---

## 7. 토큰 라이프사이클 관리

### 7.1 토큰 상태 머신

```mermaid
stateDiagram-v2
    [*] --> NO_TOKEN: 봇 서버 시작

    NO_TOKEN --> REQUESTING: 토큰 발급 요청<br/>POST /oauth2/token
    
    REQUESTING --> VALID: ✅ 발급 성공<br/>(expires_in: 864000초 ≈ 10일)
    REQUESTING --> ERROR: ❌ 발급 실패<br/>(인증 정보 오류)
    
    VALID --> VALID: API 호출 성공 (200)
    VALID --> PRE_REFRESH: ⏰ TTL < 임계값<br/>(만료 1시간 전 선제 갱신)
    VALID --> EXPIRED: ❌ 401 응답 수신<br/>(code: 900901)
    
    PRE_REFRESH --> REQUESTING: 갱신 요청

    EXPIRED --> REQUESTING: 재발급 요청
    
    ERROR --> RETRY_WAIT: 대기<br/>(Exponential Backoff)
    RETRY_WAIT --> REQUESTING: 재시도<br/>(최대 5회)
    RETRY_WAIT --> FATAL: 최대 재시도 초과
    FATAL --> [*]: 관리자 알림 후 종료

    note right of VALID
        Redis 캐시에 저장
        ─────────────────
        KEY: brity:access_token
        VALUE: eyJ...
        TTL: expires_in - 3600
        ─────────────────
        * 매 API 호출 시 캐시에서 조회
        * System-ID는 환경변수에서 로드
    end note

    note left of PRE_REFRESH
        만료 전 선제적 갱신
        ─────────────────
        Background Job이
        주기적으로 TTL 확인
        → 서비스 무중단 보장
    end note
```

### 7.2 토큰 관리 핵심 로직 (의사코드)

```
class TokenManager:
    cache = Redis
    
    async getValidToken():
        token = cache.get("brity:access_token")
        if token and token.ttl > 0:
            return token
        
        return await refreshToken()
    
    async refreshToken():
        for attempt in range(MAX_RETRIES):
            try:
                response = POST /oauth2/token
                    Header: Basic {CLIENT_CREDENTIALS}
                    Body: grant_type=client_credentials
                          scope={timestamp}
                
                cache.set("brity:access_token", 
                          response.access_token,
                          ex=response.expires_in - 3600)
                
                return response.access_token
            except AuthError:
                await sleep(2 ** attempt)
        
        raise FatalTokenError("Token refresh failed")
    
    async invalidateToken():
        cache.delete("brity:access_token")
```

---

## 8. 에러 핸들링

### 8.1 에러 처리 플로우

```mermaid
flowchart TD
    REQ([API 요청 시작]) --> CALL["HTTP 요청 전송"]
    CALL --> STATUS{HTTP 상태 코드}
    
    STATUS -->|"✅ 200 OK"| SUCCESS["정상 처리<br/>→ 응답 파싱"]
    STATUS -->|"✅ 201 Created"| CREATED["리소스 생성 성공"]
    
    STATUS -->|"❌ 400"| BAD_REQ["Bad Request<br/>→ 파라미터 검증 오류 로깅<br/>→ 사용자에게 입력 수정 안내"]
    STATUS -->|"❌ 401"| AUTH_ERR
    STATUS -->|"❌ 403"| FORBIDDEN["Forbidden<br/>→ 권한 없음 안내<br/>→ 관리자 연락 안내"]
    STATUS -->|"❌ 404"| NOT_FOUND["Not Found<br/>→ 리소스 없음 안내<br/>→ 파라미터 재확인"]
    STATUS -->|"⚠️ 429"| RATE_LIM
    STATUS -->|"🔴 500"| SRV_ERR
    STATUS -->|"🔴 502/503"| GW_ERR
    STATUS -->|"⏱️ Timeout"| TIMEOUT

    subgraph AUTH_ERR["❌ 401 인증 오류"]
        direction TB
        A1["현재 토큰 무효화"]
        A1 --> A2["토큰 재발급<br/>POST /oauth2/token"]
        A2 --> A3{"성공?"}
        A3 -->|Yes| A4["원래 API 재호출<br/>(1회만 재시도)"]
        A3 -->|No| A5["🚨 치명적 오류<br/>관리자 알림 전송"]
    end
    
    subgraph RATE_LIM["⚠️ 429 속도 제한"]
        direction TB
        R1["Retry-After 헤더 확인"]
        R1 --> R2["Exponential Backoff 대기<br/>(1s → 2s → 4s → 8s)"]
        R2 --> R3{"재시도<br/>3회 이내?"}
        R3 -->|Yes| R4["재시도"]
        R3 -->|No| R5["메시지 큐에 적재<br/>→ 지연 처리"]
    end
    
    subgraph SRV_ERR["🔴 5xx 서버 에러"]
        direction TB
        S1["에러 로깅<br/>(request/response 전문)"]
        S1 --> S2{"Circuit Breaker<br/>실패 5회 초과?"}
        S2 -->|No| S3["Backoff 후 재시도<br/>(최대 3회)"]
        S2 -->|Yes| S4["🔴 Circuit OPEN<br/>→ 30초간 즉시 실패 반환"]
    end

    subgraph GW_ERR["🔴 게이트웨이 에러"]
        direction TB
        G1["1~5초 대기"]
        G1 --> G2["재시도 (최대 3회)"]
    end

    subgraph TIMEOUT["⏱️ 타임아웃"]
        direction TB
        T1["요청 취소"]
        T1 --> T2["재시도 (최대 2회)"]
        T2 --> T3["실패 시 사용자 안내"]
    end

    SUCCESS & CREATED --> RESPOND([사용자에게 응답 전송])
    BAD_REQ & FORBIDDEN & NOT_FOUND --> RESPOND
    A4 & A5 --> RESPOND
    R4 & R5 --> RESPOND
    S3 & S4 --> RESPOND
    G2 --> RESPOND
    T3 --> RESPOND
    
    style REQ fill:#4A90D9,color:#fff
    style SUCCESS fill:#50C878,color:#fff
    style CREATED fill:#50C878,color:#fff
    style A5 fill:#FF4444,color:#fff
    style S4 fill:#FF8C00,color:#fff
    style RESPOND fill:#888,color:#fff
```

### 8.2 에러 코드 요약

| HTTP Status | Brity Code | 의미 | 봇 처리 방식 |
|-------------|-----------|------|------------|
| 200 | - | 성공 | 정상 응답 |
| 201 | - | 생성 성공 | 정상 응답 |
| 400 | - | 잘못된 요청 | 입력값 검증 → 사용자 안내 |
| 401 | 900901 | Invalid Credentials | 토큰 재발급 후 재시도 |
| 403 | - | 권한 없음 | 관리자 문의 안내 |
| 404 | - | 리소스 없음 | 대상 확인 안내 |
| 429 | - | 속도 제한 | Backoff 후 재시도 |
| 500 | - | 서버 에러 | 3회 재시도 → Circuit Breaker |
| 502/503 | - | 게이트웨이 에러 | 대기 후 재시도 |

---

## 9. 배포 아키텍처

### 9.1 배포 구성도

```mermaid
graph TB
    subgraph "External"
        BRITY["☁️ Brity Works<br/>openapi.brityworks.com<br/>HTTPS :443"]
        LLM_SVC["☁️ LLM Service"]
    end
    
    subgraph "DMZ"
        FW["🔥 Firewall<br/>Outbound: 443 허용<br/>openapi.*.brityworks.com"]
        LB["⚖️ Load Balancer<br/>(Nginx / ALB)"]
    end
    
    subgraph "Internal Zone"
        subgraph "Kubernetes Cluster"
            subgraph "Bot Deployment (replicas: 3)"
                POD1["🤖 Bot Pod #1<br/>CPU: 500m / Mem: 512Mi"]
                POD2["🤖 Bot Pod #2"]
                POD3["🤖 Bot Pod #3"]
            end
            HPA["HPA<br/>Auto Scaling<br/>min:2 / max:10"]
        end
        
        subgraph "Stateful Services"
            REDIS["🔴 Redis Cluster<br/>(HA: Sentinel)<br/>├ Token Cache<br/>├ Session Store<br/>└ Rate Limit"]
            PG["🐘 PostgreSQL<br/>(Primary + Replica)<br/>├ 대화 로그<br/>├ 봇 설정<br/>└ 사용자 프로필"]
            MQ["📬 RabbitMQ<br/>├ Event Queue<br/>├ Retry Queue<br/>└ Dead Letter Queue"]
        end
        
        subgraph "Monitoring Stack"
            PROM["📊 Prometheus<br/>메트릭 수집"]
            GRAF["📈 Grafana<br/>대시보드"]
            ALERT["🔔 AlertManager<br/>장애 알림"]
            ELK["📋 ELK Stack<br/>로그 분석"]
        end
    end
    
    BRITY <-->|HTTPS| FW
    LLM_SVC <-->|HTTPS| FW
    FW <--> LB
    LB --> POD1 & POD2 & POD3
    HPA -.-> POD1 & POD2 & POD3
    
    POD1 & POD2 & POD3 --> REDIS
    POD1 & POD2 & POD3 --> PG
    POD1 & POD2 & POD3 --> MQ
    
    POD1 & POD2 & POD3 -.->|metrics| PROM
    POD1 & POD2 & POD3 -.->|logs| ELK
    PROM --> GRAF
    PROM --> ALERT
    
    style BRITY fill:#4A90D9,color:#fff
    style LB fill:#E8744F,color:#fff
    style REDIS fill:#DC382D,color:#fff
    style PG fill:#336791,color:#fff
    style POD1 fill:#50C878,color:#fff
    style POD2 fill:#50C878,color:#fff
    style POD3 fill:#50C878,color:#fff
```

### 9.2 네트워크 / 방화벽 정책

```mermaid
graph LR
    subgraph "Bot Server"
        BOT["🤖 Bot Server<br/>(Internal Network)"]
    end
    
    subgraph "Firewall Rules"
        direction TB
        RULE["🔥 방화벽 정책"]
        R1["✅ Outbound → openapi.stage.brityworks.com:443"]
        R2["✅ Outbound → openapi.brityworks.com:443"]
        R3["✅ Inbound ← Brity Webhook Callback"]
        R4["❌ 기타 Outbound → DENY ALL"]
    end
    
    subgraph "Brity Works"
        STAGE["🏗️ 스테이지<br/>openapi.stage.brityworks.com"]
        PROD["🏢 운영<br/>openapi.brityworks.com"]
    end
    
    BOT --> RULE
    R1 -->|HTTPS| STAGE
    R2 -->|HTTPS| PROD
    
    style BOT fill:#E8744F,color:#fff
    style STAGE fill:#F5A623,color:#fff
    style PROD fill:#4A90D9,color:#fff
    style RULE fill:#FF4444,color:#fff
```

---

## 10. 부록

### 10.1 API 엔드포인트 종합 Quick Reference

| # | 도메인 | 엔드포인트 | Method | 설명 |
|---|--------|-----------|--------|------|
| 1 | **인증** | `:443/oauth2/token` | POST | Access Token 발급/갱신 |
| 2 | **메신저** | `/messenger/api/v2.0/messages` | POST | 메시지 전송 |
| 3 | **메신저** | `/messenger/api/v2.0/bot/messages` | POST | 봇 메시지 전송 |
| 4 | **메신저** | `/messenger/api/v2.0/rooms` | POST | 채팅방 생성 |
| 5 | **메신저** | `/messenger/api/v2.0/rooms` | GET | 채팅방 목록 조회 |
| 6 | **메일** | `/mail/api/v2.0/mails` | POST | 메일 발송 |
| 7 | **메일** | `/mail/api/v2.0/mails` | GET | 메일 목록 조회 |
| 8 | **메일** | `/mail/api/v2.0/mails/{mailId}` | GET | 메일 상세 조회 |
| 9 | **캘린더** | `/calendar/api/v2.0/events` | GET | 일정 조회 |
| 10 | **캘린더** | `/calendar/api/v2.0/events` | POST | 일정 생성 |
| 11 | **캘린더** | `/calendar/api/v2.0/events/{eventId}` | PUT | 일정 수정 |
| 12 | **캘린더** | `/calendar/api/v2.0/events/{eventId}` | DELETE | 일정 삭제 |
| 13 | **임직원** | `/employee/api/v2.0/employees` | POST | 임직원 검색 |
| 14 | **임직원** | `/employee/api/v2.0/departments` | POST | 부서 조회 |
| 15 | **결재** | `/approval/api/v2.0/drafts` | GET | 결재 목록 조회 |
| 16 | **결재** | `/approval/api/v2.0/drafts` | POST | 결재 상신 |
| 17 | **결재** | `/approval/api/v2.0/drafts/{draftId}` | GET | 결재 상세 조회 |
| 18 | **게시판** | `/board/api/v2.0/posts` | GET | 게시물 목록 조회 |
| 19 | **게시판** | `/board/api/v2.0/posts` | POST | 게시물 작성 |

### 10.2 공통 Request Header

모든 API 호출 시 아래 헤더를 포함해야 합니다:

```
Authorization: Bearer {access_token}
System-ID: {발급받은 System-ID}
Content-Type: application/json
Accept: application/json
```

### 10.3 환경별 Base URL

| 환경 | Base URL | 용도 |
|------|----------|------|
| 스테이지 | `https://openapi.stage.brityworks.com` | 개발/테스트 |
| 운영 | `https://openapi.brityworks.com` | 프로덕션 |

### 10.4 봇 개발 체크리스트

- [ ] 연계 신청 완료 (System-ID, Client Credentials 발급)
- [ ] 방화벽 오픈 신청 (Outbound → openapi.*.brityworks.com:443)
- [ ] 스테이지 환경 Access Token 발급 테스트
- [ ] 임직원 조회 API 연동 확인
- [ ] 메신저 봇 메시지 전송 테스트
- [ ] 토큰 자동 갱신 로직 구현
- [ ] 에러 핸들링 / Circuit Breaker 구현
- [ ] 다중 턴 대화 세션 관리 구현
- [ ] 운영 환경 전환 및 최종 테스트
- [ ] 모니터링 / 알림 설정

### 10.5 참고 링크

- Brity Works Dev Center: API별 상세 파라미터는 Dev Center 내 Dev Guide 메뉴 참조
- v1 연계 신청 가이드: Support 페이지 참조
- API별 상세 파라미터는 Dev Center 내 Dev Guide 메뉴를 참고 바랍니다.

---

> **⚠️ 주의사항**: 본 문서의 API 스펙은 Dev Center 스크린샷 이미지에서 추출한 정보로, 이미지 해상도 제한으로 인해 일부 파라미터의 정확한 명칭이나 제약조건이 원본과 다를 수 있습니다. 반드시 Brity Works Dev Center의 최신 API 문서와 대조하여 사용하시기 바랍니다.
