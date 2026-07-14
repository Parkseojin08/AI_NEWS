const express = require('express');
const cors = require('cors');

// config를 가장 먼저 로드 → env 검증 통과 못하면 여기서 process.exit(1)
const config = require('./config');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const collectRouter = require('./routes/collect');

const app = express();

app.use(express.json());

// CORS: 허용 오리진 목록만 (설계서 §6.4). 콤마 구분 다중 오리진은 config에서 배열로 파싱됨.
app.use(cors({ origin: config.corsOrigins }));

// Render 헬스체크 + 프론트 콜드 스타트 웜업용 (설계서 §6.4)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API 라우터 (반드시 404 핸들러보다 앞)
app.use('/api', collectRouter);
// TODO(Phase 4): /api/articles, /api/status 라우터 등록

// 404 → 공통 에러 핸들러 순으로 등록 (반드시 라우트 뒤)
app.use(notFoundHandler);
app.use(errorHandler);

// Render는 PORT를 주입함. 로컬은 .env 또는 기본값(3000).
app.listen(config.port, () => {
  console.log(`[server] listening on ${config.port}`);
});

module.exports = app;
