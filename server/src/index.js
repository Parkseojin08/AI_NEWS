require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 필수 환경 변수 검증 — 누락 시 조용히 undefined로 굴러가지 않도록 즉시 종료
const REQUIRED_ENV = ['DATABASE_URL', 'CRON_SECRET', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'CORS_ORIGIN'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[config] 필수 환경 변수 누락: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN.split(',').map((o) => o.trim()),
  })
);

// Render 헬스체크 + 프론트 웜업용
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Not Found' } });
});

// 공통 에러 핸들러 — 스택트레이스 미노출
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: { message: err.message || 'Internal Server Error' } });
});

// Render는 PORT를 주입함. 로컬은 .env 또는 기본값
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] listening on ${PORT}`);
});