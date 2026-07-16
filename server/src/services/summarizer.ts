// Gemini 요약 (설계서 §6.2)
//
// 핵심 규칙:
// - SDK 미사용. Node 내장 fetch로 Google Generative Language API v1beta REST 직접 호출.
// - 모델명은 config.geminiModel(GEMINI_MODEL env)로 주입받아 URL에 사용.
// - API 키는 x-goog-api-key 헤더로 전달 (URL/로그 노출 회피).
// - 실패(네트워크/4xx/5xx/429/파싱 실패)는 예외를 throw한다.
//   collector가 행 단위 try/catch로 잡아 skip하고 summary는 NULL로 남긴다 → 다음 사이클 재시도.

import config from '../config';

// 요약 프롬프트 고정 지시문 (설계서 §6.2)
const PROMPT_PREFIX =
  '다음 AI 기업 공식 뉴스의 제목과 설명을 보고 한국어 3문장으로 요약. 과장 금지, 사실만.';

// Gemini 무료 티어 분당 한도 및 콜드 스타트 보호용 타임아웃 (ms)
const REQUEST_TIMEOUT_MS = 20000;

// Gemini generateContent 응답의 관심 필드만 최소 정의 (외부 JSON → 좁혀서 사용)
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

/**
 * Generative Language API v1beta generateContent 엔드포인트 URL.
 * 모델명은 env 주입값(config.geminiModel)만 사용한다.
 */
function buildEndpoint(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`;
}

/**
 * 제목/설명으로 요청 본문(text)을 조합한다.
 * description이 비면 title만으로 요약을 시도한다.
 */
function buildPromptText(title: string, description: string | null | undefined): string {
  const parts = [PROMPT_PREFIX];
  if (title) parts.push(`제목: ${title}`);
  if (description && description.trim()) parts.push(`설명: ${description}`);
  return parts.join('\n');
}

/**
 * 한 건의 뉴스를 한국어 3문장으로 요약한다.
 * @returns 요약 텍스트 (트림됨)
 * @throws 네트워크/HTTP 비정상/응답 파싱 실패 시 (HTTP status 포함)
 */
async function summarize(title: string, description: string | null | undefined): Promise<string> {
  const text = buildPromptText(title, description);

  const body = {
    contents: [
      {
        parts: [{ text }],
      },
    ],
  };

  // 타임아웃: 콜드 스타트/응답 지연으로 사이클이 무한 대기하지 않도록 AbortController 사용
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(buildEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 키를 URL이 아닌 헤더로 전달 (로그/URL 노출 회피)
        'x-goog-api-key': config.geminiApiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    // 네트워크 오류/타임아웃(abort) — 의미 있는 Error로 재던짐
    throw new Error(`Gemini 요청 실패: ${(e as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  // HTTP 비정상(429 포함) — status를 포함한 Error throw
  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 500);
    } catch {
      // 본문 읽기 실패는 무시
    }
    throw new Error(`Gemini HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  let data: GeminiResponse;
  try {
    data = (await response.json()) as GeminiResponse;
  } catch (e) {
    throw new Error(`Gemini 응답 JSON 파싱 실패: ${(e as Error).message}`);
  }

  // candidates[0].content.parts[0].text 추출
  const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof summary !== 'string' || !summary.trim()) {
    // 안전 필터 차단(finishReason=SAFETY 등)이나 빈 응답도 여기로 떨어진다
    throw new Error('Gemini 응답에서 요약 텍스트를 찾지 못함');
  }

  return summary.trim();
}

export { summarize };
