// 임시: NULL 요약 전량 백필 (실 Gemini 키). 실행 후 삭제. 커밋 금지.
// dist(컴파일된 TS)의 summarizer/db 재사용. server/ 에서 실행.
const { query } = require('./dist/db');
const { summarize } = require('./dist/services/summarizer');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const res = await query(
    'SELECT id, title, description FROM articles WHERE summary IS NULL ORDER BY published_at DESC'
  );
  const rows = res.rows;
  console.log(`[backfill] 대상 ${rows.length}건 시작`);
  let ok = 0, fail = 0;
  for (const r of rows) {
    try {
      const s = await summarize(r.title, r.description);
      await query('UPDATE articles SET summary = $1 WHERE id = $2', [s, r.id]);
      ok += 1;
    } catch (e) {
      fail += 1;
      const msg = String(e && e.message);
      // rate limit/과부하는 잠깐 더 쉬고 계속 (실패 행은 NULL 유지 → 나중 cron 재시도)
      if (msg.includes('429') || msg.includes('503')) await sleep(20000);
    }
    if ((ok + fail) % 25 === 0) console.log(`[backfill] ${ok + fail}/${rows.length} (성공 ${ok} / 실패 ${fail})`);
    await sleep(4500); // ~13 req/min (free tier 보호)
  }
  console.log(`[backfill] 완료: 성공 ${ok}, 실패(skip) ${fail}`);
  process.exit(0);
})().catch((e) => { console.error('[backfill] FATAL', e.message); process.exit(1); });
