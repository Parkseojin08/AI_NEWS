-- AI News Hub 초기 스키마 (설계서 §5)
-- 적용: Neon 콘솔 SQL Editor에서 1회 실행 (마이그레이션 도구 미사용)
-- 이 파일은 기록용이며, Neon에는 이미 적용된 상태.

CREATE TABLE IF NOT EXISTS articles (
  id            SERIAL PRIMARY KEY,
  source        VARCHAR(20) NOT NULL CHECK (source IN ('anthropic', 'openai')),
  title         TEXT NOT NULL,
  url           TEXT NOT NULL UNIQUE,
  description   TEXT,
  summary       TEXT,
  published_at  TIMESTAMPTZ NOT NULL,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_published ON articles (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_source ON articles (source, published_at DESC);

CREATE TABLE IF NOT EXISTS collect_log (
  id            SERIAL PRIMARY KEY,
  source        VARCHAR(20) NOT NULL,
  fetched_count INT NOT NULL DEFAULT 0,
  new_count     INT NOT NULL DEFAULT 0,
  status        VARCHAR(10) NOT NULL CHECK (status IN ('ok', 'error')),
  error_message TEXT,
  executed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
