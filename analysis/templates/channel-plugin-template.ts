/**
 * OpenClaw Channel Plugin Template
 *
 * 이 템플릿을 사용하여 새로운 메신저 채널을 추가하세요.
 *
 * 사용 방법:
 * 1. 이 파일을 복사: src/channels/plugins/<your-channel>.ts
 * 2. 모든 TODO 주석을 찾아서 구현
 * 3. build-program.ts에 플러그인 등록
 *
 * @author Your Name
 * @version 1.0.0
 */

import type {
  ChannelPlugin,
  ChannelOutboundAdapter,
  ChannelGatewayAdapter,
  ChannelOnboardingAdapter,
  ChannelStatusAdapter,
} from "./types.js";

// TODO: 채널 ID 정의 (예: "telegram", "whatsapp", "kakaotalk")
const CHANNEL_ID = "my-channel";

// TODO: API 엔드포인트 설정
const API_BASE_URL = "https://api.my-channel.com";
const API_VERSION = "v1";

// TODO: 메시지 길이 제한
const MAX_TEXT_LENGTH = 4000;
const MAX_MEDIA_SIZE_MB = 20;

/**
 * 계정 설정 타입 정의
 */
type MyChannelAccount = {
  accountId: string;
  apiKey: string;
  secretKey?: string;
  webhookUrl?: string;
  // TODO: 추가 필드 정의
};

/**
 * API 응답 타입
 */
type MyChannelApiResponse = {
  message_id: string;
  chat_id: string;
  status: "sent" | "delivered" | "read";
  timestamp: number;
};

/**
 * Webhook 이벤트 타입
 */
type MyChannelWebhookEvent = {
  event_type: "message" | "reaction" | "status";
  user_id: string;
  chat_id: string;
  message?: {
    text: string;
    media_url?: string;
    message_id: string;
  };
  timestamp: number;
};

/**
 * 메시지 발송 어댑터
 */
const outbound: ChannelOutboundAdapter = {
  deliveryMode: "direct", // "direct" | "queue"

  // TODO: 텍스트 청킹 함수 구현
  chunker: async (text: string) => {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += MAX_TEXT_LENGTH) {
      chunks.push(text.slice(i, i + MAX_TEXT_LENGTH));
    }
    return chunks;
  },

  chunkerMode: "markdown", // "markdown" | "plain"
  textChunkLimit: MAX_TEXT_LENGTH,

  /**
   * 텍스트 메시지 전송
   */
  sendText: async ({ to, text, accountId, deps, replyToId, threadId }) => {
    // TODO: 1. 계정 설정 가져오기
    const account = await myChannelPlugin.config.resolveAccount({
      cfg: deps?.config,
      accountId: accountId ?? "default",
    });

    if (!account) {
      throw new Error(`${CHANNEL_ID} account not configured`);
    }

    // TODO: 2. API 호출 파라미터 구성
    const params = {
      chat_id: to,
      text: text,
      reply_to_message_id: replyToId,
      thread_id: threadId,
      // TODO: 추가 파라미터
    };

    // TODO: 3. API 호출
    const response = await fetch(`${API_BASE_URL}/${API_VERSION}/messages/send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${account.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${CHANNEL_ID} API error: ${response.status} ${error}`);
    }

    const result: MyChannelApiResponse = await response.json();

    // TODO: 4. 결과 반환
    return {
      channel: CHANNEL_ID,
      messageId: result.message_id,
      chatId: result.chat_id,
    };
  },

  /**
   * 미디어 메시지 전송
   */
  sendMedia: async ({ to, text, mediaUrl, accountId, deps, replyToId, threadId }) => {
    // TODO: 미디어 전송 로직 구현
    const account = await myChannelPlugin.config.resolveAccount({
      cfg: deps?.config,
      accountId: accountId ?? "default",
    });

    if (!account) {
      throw new Error(`${CHANNEL_ID} account not configured`);
    }

    // TODO: 미디어 타입 감지 (image, video, audio, document)
    const mediaType = detectMediaType(mediaUrl);

    const params = {
      chat_id: to,
      [mediaType]: mediaUrl,
      caption: text,
      reply_to_message_id: replyToId,
      thread_id: threadId,
    };

    const response = await fetch(`${API_BASE_URL}/${API_VERSION}/messages/sendMedia`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${account.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`${CHANNEL_ID} media send failed: ${response.statusText}`);
    }

    const result: MyChannelApiResponse = await response.json();

    return {
      channel: CHANNEL_ID,
      messageId: result.message_id,
      chatId: result.chat_id,
    };
  },

  /**
   * Payload 전송 (복합 메시지)
   */
  sendPayload: async ({ to, payload, accountId, deps, replyToId, threadId }) => {
    // TODO: Payload 전송 로직 (버튼, 카드 등)
    const text = payload.text ?? "";
    const mediaUrls = payload.mediaUrls ?? (payload.mediaUrl ? [payload.mediaUrl] : []);

    // TODO: 채널 특화 데이터 처리
    const channelData = payload.channelData?.[CHANNEL_ID] as any;

    // TODO: 구현
    throw new Error("sendPayload not implemented");
  },
};

/**
 * Gateway 어댑터 (메시지 수신)
 */
const gateway: ChannelGatewayAdapter<MyChannelAccount> = {
  methods: ["handleWebhook", "getUpdates"],

  /**
   * Webhook 이벤트 처리
   */
  handleWebhook: async ({ req, cfg, accountId }) => {
    // TODO: 1. Webhook 데이터 파싱
    const body: MyChannelWebhookEvent = await req.json();

    // TODO: 2. Webhook 서명 검증
    const signature = req.headers.get("X-Signature");
    if (!verifyWebhookSignature(body, signature, cfg)) {
      throw new Error("Invalid webhook signature");
    }

    // TODO: 3. 이벤트 타입 확인
    if (body.event_type !== "message") {
      return null; // 무시
    }

    // TODO: 4. 메시지 추출
    const message = body.message;
    if (!message) {
      return null;
    }

    // TODO: 5. 반환
    return {
      channel: CHANNEL_ID,
      accountId: accountId ?? "default",
      peer: {
        kind: "dm", // "dm" | "group" | "channel"
        id: body.user_id,
      },
      message: {
        text: message.text,
        messageId: message.message_id,
        timestamp: body.timestamp,
        mediaUrl: message.media_url,
      },
    };
  },

  /**
   * 폴링 방식 업데이트 가져오기
   */
  getUpdates: async ({ cfg, accountId, offset }) => {
    // TODO: Long polling 구현
    const account = await myChannelPlugin.config.resolveAccount({
      cfg,
      accountId: accountId ?? "default",
    });

    if (!account) {
      return [];
    }

    const response = await fetch(
      `${API_BASE_URL}/${API_VERSION}/updates?offset=${offset ?? 0}`,
      {
        headers: {
          "Authorization": `Bearer ${account.apiKey}`,
        },
      }
    );

    const result = await response.json();
    return result.updates ?? [];
  },
};

/**
 * 온보딩 어댑터 (CLI 설정 마법사)
 */
const onboarding: ChannelOnboardingAdapter = {
  wizard: async ({ inquirer }) => {
    console.log(`\n🚀 ${CHANNEL_ID} Setup Wizard\n`);

    // TODO: 설정 질문 정의
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "apiKey",
        message: "API Key:",
        validate: (input: string) => {
          if (!input.trim()) {
            return "API Key is required";
          }
          return true;
        },
      },
      {
        type: "password",
        name: "secretKey",
        message: "Secret Key (optional):",
      },
      {
        type: "input",
        name: "webhookUrl",
        message: "Webhook URL:",
        default: `https://your-domain.com/webhook/${CHANNEL_ID}`,
      },
    ]);

    // TODO: 설정 반환
    return {
      config: {
        channels: {
          [CHANNEL_ID]: {
            default: {
              apiKey: answers.apiKey,
              secretKey: answers.secretKey || undefined,
              webhookUrl: answers.webhookUrl,
            },
          },
        },
      },
      nextSteps: [
        `1. Set webhook: ${answers.webhookUrl}`,
        `2. Test connection: openclaw status ${CHANNEL_ID}`,
        `3. Send test message: openclaw ${CHANNEL_ID} send --to <chat-id> --text "Hello"`,
      ],
    };
  },
};

/**
 * 상태 확인 어댑터
 */
const status: ChannelStatusAdapter<MyChannelAccount> = {
  check: async ({ accountId, cfg }) => {
    const account = await myChannelPlugin.config.resolveAccount({
      cfg,
      accountId: accountId ?? "default",
    });

    if (!account) {
      return {
        status: "error",
        message: "Account not configured",
      };
    }

    // TODO: API 연결 확인
    try {
      const response = await fetch(`${API_BASE_URL}/${API_VERSION}/me`, {
        headers: {
          "Authorization": `Bearer ${account.apiKey}`,
        },
      });

      if (response.ok) {
        const user = await response.json();
        return {
          status: "ok",
          message: `Connected as ${user.name ?? "User"}`,
          data: {
            userId: user.id,
            username: user.username,
          },
        };
      }

      return {
        status: "error",
        message: `API error: ${response.status} ${response.statusText}`,
      };
    } catch (error) {
      return {
        status: "error",
        message: `Connection failed: ${error}`,
      };
    }
  },
};

/**
 * 채널 플러그인 정의
 */
export const myChannelPlugin: ChannelPlugin<MyChannelAccount> = {
  // 기본 정보
  id: CHANNEL_ID,
  meta: {
    name: "My Channel",
    label: "My Channel",
    description: "My custom messaging channel",
    order: 10, // TODO: 표시 순서 조정
  },

  // 기능 명세
  capabilities: {
    text: true,
    media: true,
    reactions: false, // TODO: 지원 여부
    threads: false,   // TODO: 지원 여부
    inlineButtons: false, // TODO: 지원 여부
  },

  // 설정 어댑터
  config: {
    listAccounts: async ({ cfg }) => {
      const channelConfig = cfg.channels?.[CHANNEL_ID];
      if (!channelConfig || typeof channelConfig !== "object") {
        return [];
      }

      const accountIds = Object.keys(channelConfig);
      return accountIds.map(accountId => ({
        accountId,
        label: `${CHANNEL_ID} (${accountId})`,
      }));
    },

    resolveAccount: async ({ cfg, accountId }) => {
      const channelConfig = cfg.channels?.[CHANNEL_ID];
      if (!channelConfig || typeof channelConfig !== "object") {
        return null;
      }

      const accountConfig = channelConfig[accountId];
      if (!accountConfig || typeof accountConfig !== "object") {
        return null;
      }

      return {
        accountId,
        apiKey: accountConfig.apiKey as string,
        secretKey: accountConfig.secretKey as string | undefined,
        webhookUrl: accountConfig.webhookUrl as string | undefined,
      };
    },
  },

  // 설정 스키마 (UI 자동 생성)
  configSchema: {
    schema: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          description: "API Key",
        },
        secretKey: {
          type: "string",
          description: "Secret Key (optional)",
        },
        webhookUrl: {
          type: "string",
          description: "Webhook URL",
          format: "uri",
        },
      },
      required: ["apiKey"],
    },
    uiHints: {
      apiKey: {
        label: "API Key",
        sensitive: true,
      },
      secretKey: {
        label: "Secret Key",
        sensitive: true,
        advanced: true,
      },
      webhookUrl: {
        label: "Webhook URL",
        placeholder: `https://your-domain.com/webhook/${CHANNEL_ID}`,
      },
    },
  },

  // 어댑터 연결
  outbound,
  gateway,
  onboarding,
  status,

  // TODO: 추가 어댑터 구현
  // messaging?: ChannelMessagingAdapter;
  // threading?: ChannelThreadingAdapter;
  // streaming?: ChannelStreamingAdapter;
  // agentTools?: ChannelAgentTool[];
};

/**
 * 헬퍼 함수들
 */

function detectMediaType(url: string): "photo" | "video" | "audio" | "document" {
  const lower = url.toLowerCase();
  if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/)) return "photo";
  if (lower.match(/\.(mp4|mov|avi|mkv)$/)) return "video";
  if (lower.match(/\.(mp3|wav|ogg|m4a)$/)) return "audio";
  return "document";
}

function verifyWebhookSignature(
  body: any,
  signature: string | null,
  cfg: any
): boolean {
  // TODO: Webhook 서명 검증 구현
  // 예: HMAC-SHA256
  return true;
}

/**
 * TODO Checklist:
 *
 * [ ] CHANNEL_ID 정의
 * [ ] API_BASE_URL 설정
 * [ ] 계정 타입 (MyChannelAccount) 정의
 * [ ] sendText 구현
 * [ ] sendMedia 구현
 * [ ] sendPayload 구현 (선택)
 * [ ] handleWebhook 구현
 * [ ] getUpdates 구현 (폴링 방식인 경우)
 * [ ] onboarding wizard 구현
 * [ ] status check 구현
 * [ ] capabilities 설정
 * [ ] configSchema 작성
 * [ ] 헬퍼 함수 구현
 * [ ] 에러 핸들링 추가
 * [ ] 테스트 작성
 * [ ] build-program.ts에 등록
 * [ ] 문서 작성
 */
