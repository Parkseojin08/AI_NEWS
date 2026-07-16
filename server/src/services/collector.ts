// 수집 오케스트레이션 (설계서 §6.2)
// RSS fetch/파싱/적재 + collect_log 기록 + summary IS NULL 행 Gemini 요약(best-effort).
//
// 핵심 규칙:
// - 소스 단위 에러 격리: 한 소스 실패가 다른 소스 수집을 막지 않는다 (try/catch per source).
// - 실패 소스는 collect_log에 status='error'로 기록하고 계속 진행.
// - INSERT는 파라미터 바인딩 + ON CONFLICT (url) DO NOTHING RETURNING id → 멱등성 보장.

import * as rss from './rss';
import * as summarizer from './summarizer';
import { query } from '../db';
import type { Source, NormalizedItem, CollectResult } from '../types';

// 수집 대상 소스 순서 (설계서 §6.2)
const SOURCES: Source[] = ['openai', 'anthropic'];

/**
 * 정규화된 item 배열을 articles에 적재한다.
 * ON CONFLICT (url) DO NOTHING 이므로 이미 존재하는 url은 삽입되지 않고,
 * RETURNING id 로 실제로 새로 삽입된 행 수를 센다 (멱등성).
 * @returns 신규 삽입 행 수
 */
async function insertArticles(items: NormalizedItem[]): Promise<number> {
  let newCount = 0;
  for (const item of items) {
    // 파라미터 바인딩 필수 ($1..$5). 문자열 결합 금지 (설계서 §6.4)
    const result = await query<{ id: number }>(
      `INSERT INTO articles (source, title, url, description, published_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (url) DO NOTHING
       RETURNING id`,
      [item.source, item.title, item.url, item.description || null, item.publishedAt]
    );
    if ((result.rowCount ?? 0) > 0) newCount += 1;
  }
  return newCount;
}

/**
 * collect_log에 수집 결과 1행을 기록한다 (파라미터 바인딩).
 */
async function writeLog(
  source: string,
  fetchedCount: number,
  newCount: number,
  status: 'ok' | 'error',
  errorMessage: string | null = null
): Promise<void> {
  await query(
    `INSERT INTO collect_log (source, fetched_count, new_count, status, error_message)
     VALUES ($1, $2, $3, $4, $5)`,
    [source, fetchedCount, newCount, status, errorMessage]
  );
}

/**
 * 요약 단계 (설계서 §6.2 하단).
 * summary IS NULL 행(이번 신규 + 과거 실패분)을 published_at DESC, LIMIT 20으로 뽑아 요약한다.
 * - LIMIT 20 고정: Gemini 무료 티어 분당 한도 보호 (설계서 §6.2). 파라미터 없이 고정 리터럴.
 * - 행 단위 독립 try/catch: 한 행 요약 실패(429 포함)는 skip하고 summary는 NULL 유지 →
 *   다음 collect 사이클에서 다시 대상으로 선정되어 재시도된다.
 * - 요약 단계 전체가 실패해도 크래시하지 않는다 (best-effort). 수집 결과는 이미 반환 준비됨.
 * @returns 실제로 요약에 성공해 UPDATE된 행 수
 */
async function summarizePending(): Promise<number> {
  let summarized = 0;

  let targets: Array<{ id: number; title: string; description: string | null }>;
  try {
    const res = await query<{ id: number; title: string; description: string | null }>(
      `SELECT id, title, description
         FROM articles
        WHERE summary IS NULL
        ORDER BY published_at DESC
        LIMIT 20`
    );
    targets = res.rows;
  } catch (e) {
    // 대상 조회 자체가 실패해도 수집 결과는 정상 반환되어야 하므로 크래시하지 않는다
    console.error('[collector] 요약 대상 조회 실패:', (e as Error).message);
    return 0;
  }

  for (const t of targets) {
    try {
      const summary = await summarizer.summarize(t.title, t.description);
      // 파라미터 바인딩 필수 ($1, $2). 문자열 결합 금지 (설계서 §6.4)
      await query(`UPDATE articles SET summary = $1 WHERE id = $2`, [summary, t.id]);
      summarized += 1;
    } catch (e) {
      // 행 독립 격리: 429/키 오류/네트워크 등 모든 실패는 skip. summary는 NULL 유지 → 다음 사이클 재시도
      console.warn(`[collector] 요약 실패 (id=${t.id}), skip:`, (e as Error).message);
    }
  }

  return summarized;
}

/**
 * 전체 수집 실행.
 */
async function runCollect(): Promise<CollectResult> {
  const results: CollectResult['results'] = [];

  for (const source of SOURCES) {
    try {
      const items = await rss.fetchAndParse(source); // 실패 시 이 소스만 catch로
      const newCount = await insertArticles(items);
      await writeLog(source, items.length, newCount, 'ok');
      results.push({ source, fetched: items.length, new: newCount });
    } catch (e) {
      // 소스 격리: 로그만 남기고 다음 소스 계속 (설계서 §6.2)
      console.error(`[collector] 소스 수집 실패 (source=${source}):`, (e as Error).message);
      // collect_log 기록 자체가 실패해도 전체 수집이 중단되지 않도록 보호
      try {
        await writeLog(source, 0, 0, 'error', (e as Error).message);
      } catch (logErr) {
        console.error(
          `[collector] collect_log 기록 실패 (source=${source}):`,
          (logErr as Error).message
        );
      }
      results.push({ source, fetched: 0, new: 0 });
    }
  }

  // 요약은 best-effort: 전체가 실패해도 수집 결과 응답은 정상 반환 (설계서 §6.2/§6.3)
  const summarized = await summarizePending();

  return { results, summarized };
}

export { runCollect };
