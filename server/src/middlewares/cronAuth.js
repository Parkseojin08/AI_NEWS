// X-Cron-Secret 헤더 검증 미들웨어 (설계서 §6.3)
// - 헤더 값이 config.cronSecret 과 일치하면 next()
// - 불일치/누락 시 401 (본문은 공통 에러 포맷, 로그만 상세히)

const crypto = require('crypto');
const config = require('../config');

// 상수 시간 문자열 비교 (타이밍 사이드채널 방지). 길이 다르면 즉시 false.
function safeEqual(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function cronAuth(req, res, next) {
  const provided = req.get('X-Cron-Secret');

  if (!provided || !safeEqual(provided, config.cronSecret)) {
    // 인증 실패는 시크릿 값을 로그에 남기지 않는다.
    console.warn(`[cronAuth] 인증 실패: X-Cron-Secret ${provided ? '불일치' : '누락'}`);
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  return next();
}

module.exports = cronAuth;
