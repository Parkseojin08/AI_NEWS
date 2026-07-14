// 수집 오케스트레이션 (설계서 §6.2)
// Phase 2 범위: RSS fetch/파싱/적재 + collect_log 기록. 요약 단계는 Phase 3에서 추가.
//
// 핵심 규칙:
// - 소스 단위 에러 격리: 한 소스 실패가 다른 소스 수집을 막지 않는다 (try/catch per source).
// - 실패 소스는 collect_log에 status='error'로 기록하고 계속 진행.
// - INSERT는 파라미터 바인딩 + ON CONFLICT (url) DO NOTHING RETURNING id → 멱등성 보장.

const rss = require('./rss');
const { query } = require('../db');

// 수집 대상 소스 순서 (설계서 §6.2)
const SOURCES = ['openai', 'anthropic'];

/**
 * 정규화된 item 배열을 articles에 적재한다.
 * ON CONFLICT (url) DO NOTHING 이므로 이미 존재하는 url은 삽입되지 않고,
 * RETURNING id 로 실제로 새로 삽입된 행 수를 센다 (멱등성).
 * @param {Array<{source,title,url,description,publishedAt}>} items
 * @returns {Promise<number>} 신규 삽입 행 수
 */
async function insertArticles(items) {
  let newCount = 0;
  for (const item of items) {
    // 파라미터 바인딩 필수 ($1..$5). 문자열 결합 금지 (설계서 §6.4)
    const result = await query(
      `INSERT INTO articles (source, title, url, description, published_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (url) DO NOTHING
       RETURNING id`,
      [item.source, item.title, item.url, item.description || null, item.publishedAt]
    );
    if (result.rowCount > 0) newCount += 1;
  }
  return newCount;
}

/**
 * collect_log에 수집 결과 1행을 기록한다 (파라미터 바인딩).
 * @param {string} source
 * @param {number} fetchedCount
 * @param {number} newCount
 * @param {'ok'|'error'} status
 * @param {string|null} [errorMessage]
 */
async function writeLog(source, fetchedCount, newCount, status, errorMessage = null) {
  await query(
    `INSERT INTO collect_log (source, fetched_count, new_count, status, error_message)
     VALUES ($1, $2, $3, $4, $5)`,
    [source, fetchedCount, newCount, status, errorMessage]
  );
}

/**
 * 전체 수집 실행.
 * @returns {Promise<{results: Array<{source,fetched,new}>, summarized: number}>}
 */
async function runCollect() {
  const results = [];

  for (const source of SOURCES) {
    try {
      const items = await rss.fetchAndParse(source); // 실패 시 이 소스만 catch로
      const newCount = await insertArticles(items);
      await writeLog(source, items.length, newCount, 'ok');
      results.push({ source, fetched: items.length, new: newCount });
    } catch (e) {
      // 소스 격리: 로그만 남기고 다음 소스 계속 (설계서 §6.2)
      console.error(`[collector] 소스 수집 실패 (source=${source}):`, e.message);
      // collect_log 기록 자체가 실패해도 전체 수집이 중단되지 않도록 보호
      try {
        await writeLog(source, 0, 0, 'error', e.message);
      } catch (logErr) {
        console.error(`[collector] collect_log 기록 실패 (source=${source}):`, logErr.message);
      }
      results.push({ source, fetched: 0, new: 0 });
    }
  }

  // 요약 단계는 Phase 3에서 통합. 현재는 0 고정 (설계서 §6.3 구조 유지).
  return { results, summarized: 0 };
}

module.exports = { runCollect };
