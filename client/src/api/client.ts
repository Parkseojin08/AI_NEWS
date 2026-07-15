// API 래퍼 — VITE_API_BASE_URL 기반 fetch.
// 응답 계약은 docs/API_ACTUAL.md (실측 기준). 필드 임의 추가/변경 금지.

const BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export type Source = 'anthropic' | 'openai';

export interface Article {
  id: number;
  source: Source;
  title: string;
  url: string;
  summary: string | null;
  description: string;
  publishedAt: string; // ISO 8601
  isRead: boolean;
}

export interface ArticlesResponse {
  items: Article[];
  page: number;
  totalPages: number;
  unreadCount: number;
}

export interface MarkReadResponse {
  id: number;
  isRead: true;
}

export type CollectStatus = 'ok' | 'error';

export interface CollectLogEntry {
  source: Source;
  executedAt: string; // ISO 8601
  status: CollectStatus;
  newCount: number;
  errorMessage?: string; // status === 'error'일 때만
}

export interface StatusResponse {
  lastCollect: CollectLogEntry[];
}

export interface GetArticlesParams {
  source?: Source;
  unread?: boolean;
  page?: number;
  limit?: number;
}

// 공통 에러 형식: { error: { message } }
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      // JSON 파싱 실패 시 상태 코드 메시지 유지
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function getArticles(
  params: GetArticlesParams = {},
): Promise<ArticlesResponse> {
  const qs = new URLSearchParams();
  if (params.source) qs.set('source', params.source);
  if (params.unread) qs.set('unread', 'true');
  if (params.page != null) qs.set('page', String(params.page));
  if (params.limit != null) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return request<ArticlesResponse>(`/api/articles${query ? `?${query}` : ''}`);
}

export function markRead(id: number): Promise<MarkReadResponse> {
  return request<MarkReadResponse>(`/api/articles/${id}/read`, {
    method: 'PATCH',
  });
}

export function getStatus(): Promise<StatusResponse> {
  return request<StatusResponse>('/api/status');
}

// 콜드 스타트 웜업용. 응답 형태에 의존하지 않으므로 실패해도 무시 가능.
export function checkHealth(): Promise<Response> {
  return fetch(`${BASE_URL}/health`);
}
