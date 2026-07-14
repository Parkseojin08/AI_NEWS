// X-Cron-Secret 헤더 검증 미들웨어 (설계서 §6.3)
// - 헤더 값이 config.cronSecret 과 일치하면 next()
// - 불일치/누락 시 401 (본문은 공통 에러 포맷, 로그만 상세히)

const config = require('../config');

function cronAuth(req, res, next) {
  const provided = req.get('X-Cron-Secret');

  if (!provided || provided !== config.cronSecret) {
    // 인증 실패는 시크릿 값을 로그에 남기지 않는다.
    console.warn(`[cronAuth] 인증 실패: X-Cron-Secret ${provided ? '불일치' : '누락'}`);
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  return next();
}

module.exports = cronAuth;
