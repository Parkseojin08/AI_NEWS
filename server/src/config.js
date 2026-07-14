require('dotenv').config();

// 필수 환경 변수 (설계서 §4). 하나라도 누락되면 서버를 기동하지 않는다.
const REQUIRED_ENV = [
  'DATABASE_URL',
  'CRON_SECRET',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'CORS_ORIGIN',
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key] || !process.env[key].trim());
if (missing.length > 0) {
  // 누락 변수명을 명시하고 즉시 종료 — undefined로 조용히 굴러가는 것 방지
  console.error(`[config] 필수 환경 변수 누락: ${missing.join(', ')}`);
  process.exit(1);
}

// CORS_ORIGIN: 콤마 구분 다중 오리진 → 배열 (빈 항목 제거)
const corsOrigins = process.env.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  cronSecret: process.env.CRON_SECRET,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL,
  corsOrigins,
};

module.exports = config;
