// 조회/읽음 처리 라우트 (설계서 §6.3)
// - GET  /api/articles          목록 조회 (source/unread 필터, 페이지네이션)
// - PATCH /api/articles/:id/read 읽음 처리
//
// 핵심 규칙 (설계서 §6.4):
// - 모든 쿼리는 파라미터 바인딩($1..$n). 사용자 입력을 문자열로 쿼리에 결합하지 않는다.
//   (아래에서 $${idx} 형태로 조립되는 것은 "플레이스홀더 번호(정수)"일 뿐 값이 아니며,
//    실제 값은 전부 params 배열로 바인딩된다. 컬럼명/연산자/정렬은 전부 고정 리터럴.)
// - LIMIT은 최대 50으로 clamp, page/limit은 1 미만 방지.
// - camelCase 매핑: published_at→publishedAt, is_read→isRead. summary NULL은 그대로 null.

const express = require('express');
const { query } = require('../db');

const router = express.Router();

// source 화이트리스트 (설계서 §5 CHECK 제약과 동일)
const ALLOWED_SOURCES = ['anthropic', 'openai'];

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/**
 * DB 행을 API 응답 스키마(camelCase)로 매핑한다 (설계서 §6.3).
 * publishedAt은 pg가 반환한 Date 객체 → JSON 직렬화 시 ISO 8601(Z)로 나간다.
 * summary가 NULL이면 null 그대로 내려간다 (프론트가 description으로 대체).
 */
function mapArticle(r) {
  return {
    id: r.id,
    source: r.source,
    title: r.title,
    url: r.url,
    summary: r.summary,
    description: r.description,
    publishedAt: r.published_at,
    isRead: r.is_read,
  };
}

// GET /api/articles
router.get('/articles', async (req, res, next) => {
  try {
    // --- 쿼리 파라미터 검증 ---
    // source: 화이트리스트에 없으면 무시(전체 조회) — 안전하게 필터 미적용
    const rawSource = typeof req.query.source === 'string' ? req.query.source : '';
    const source = ALLOWED_SOURCES.includes(rawSource) ? rawSource : null;

    // unread: 정확히 'true'일 때만 is_read=false 필터
    const unread = req.query.unread === 'true';

    // page: 기본 1, 1 미만 방지
    let page = parseInt(req.query.page, 10);
    if (!Number.isFinite(page) || page < 1) page = 1;

    // limit: 기본 20, 1 미만 방지, 최대 50 clamp
    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
    if (limit > MAX_LIMIT) limit = MAX_LIMIT;

    const offset = (page - 1) * limit;

    // --- WHERE 절 조립 (값은 전부 params로 바인딩) ---
    const conditions = [];
    const params = [];
    if (source) {
      params.push(source);
      conditions.push(`source = $${params.length}`);
    }
    if (unread) {
      // 고정 리터럴 조건 (사용자 입력 없음)
      conditions.push('is_read = FALSE');
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // --- 목록 조회 (LIMIT/OFFSET도 바인딩) ---
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const listSql =
      `SELECT id, source, title, url, summary, description, published_at, is_read
         FROM articles
         ${whereClause}
        ORDER BY published_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
    const listRes = await query(listSql, [...params, limit, offset]);

    // --- 현재 필터 기준 전체 건수 → totalPages ---
    const countSql = `SELECT COUNT(*)::int AS total FROM articles ${whereClause}`;
    const countRes = await query(countSql, params);
    const total = countRes.rows[0].total;
    const totalPages = Math.ceil(total / limit); // 결과 0건이면 0

    // --- 안읽음 수: 목록 필터와 무관하게 전체 안읽음 수 (설계서 §6.3, 아래 구현 노트 참조) ---
    const unreadRes = await query(
      'SELECT COUNT(*)::int AS c FROM articles WHERE is_read = FALSE'
    );
    const unreadCount = unreadRes.rows[0].c;

    res.status(200).json({
      items: listRes.rows.map(mapArticle),
      page,
      totalPages,
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/articles/:id/read
router.patch('/articles/:id/read', async (req, res, next) => {
  try {
    // id는 양의 정수만 허용. 그 외(문자/음수/소수)는 존재할 수 없는 리소스로 보고 404.
    const raw = req.params.id;
    if (!/^\d+$/.test(raw)) {
      return res.status(404).json({ error: { message: 'Article not found' } });
    }
    const id = parseInt(raw, 10);

    const result = await query(
      'UPDATE articles SET is_read = TRUE WHERE id = $1 RETURNING id, is_read',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: { message: 'Article not found' } });
    }

    const row = result.rows[0];
    return res.status(200).json({ id: row.id, isRead: row.is_read });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
