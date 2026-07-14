// 공통 에러 응답 미들웨어 (설계서 §6.4)
// - 응답 포맷 통일: { error: { message } }
// - 스택트레이스는 클라이언트에 노출하지 않고 서버 로그에만 남긴다.

// 404 핸들러: 매칭되는 라우트가 없을 때
function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: 'Not Found' } });
}

// 에러 핸들러: 반드시 4개 인자 시그니처여야 Express가 에러 미들웨어로 인식
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[error]', err);
  const status = err.status || 500;
  const message = status >= 500 ? 'Internal Server Error' : err.message || 'Error';
  res.status(status).json({ error: { message } });
}

module.exports = { notFoundHandler, errorHandler };
