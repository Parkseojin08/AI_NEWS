// 공용 도메인 타입 (설계서 §5 스키마 / §6.3 응답 계약 기준)

// articles.source / collect_log.source 값 (설계서 §5 CHECK 제약)
export type Source = 'anthropic' | 'openai';

// articles 테이블 행 (설계서 §5)
export interface ArticleRow {
  id: number;
  source: Source;
  title: string;
  url: string;
  description: string | null;
  summary: string | null;
  published_at: Date;
  is_read: boolean;
  created_at: Date;
}

// collect_log 테이블 행 (설계서 §5)
export interface CollectLogRow {
  id: number;
  source: string;
  fetched_count: number;
  new_count: number;
  status: 'ok' | 'error';
  error_message: string | null;
  executed_at: Date;
}

// RSS 정규화 item (설계서 §6.1)
export interface NormalizedItem {
  source: Source;
  title: string;
  url: string;
  description: string;
  publishedAt: Date;
}

// POST /api/collect 응답 (설계서 §6.3)
export interface CollectResult {
  results: Array<{ source: Source; fetched: number; new: number }>;
  summarized: number;
}
