---
프로젝트: AI News Hub
유형: 세션 인수인계
작성일: 2026-07-15
세션: A (Phase 0~2)
---

# HANDOFF — 세션 A (Phase 0~2)

> 다음 세션(B, Phase 3~5)은 이 문서와 `docs/PHASES.md`, `docs/기술설계_및_제작순서.md`(SSOT)를 먼저 읽고 시작한다.
> **시크릿 값은 이 문서 어디에도 없다. 앞으로도 기록 금지.**

## 1. 완료한 Phase

| Phase | 상태 | 비고 |
| --- | --- | --- |
| 0 스캐폴드 | 완료 | 메인 세션 |
| 1 서버 기반 (config/db/errorHandler) | 완료 (커밋 `1d008a3`) | backend-agent |
| 2 RSS 수집 (요약 제외) | 코드 작성 완료 / 실행 검증 보류 | backend-agent |

## 2. 생성/수정한 파일 (Phase 2)

**생성**
- `server/src/services/rss.js` — 두 피드 fetch/파싱/정규화
- `server/src/services/collector.js` — 수집 오케스트레이션 (요약 제외)
- `server/src/middlewares/cronAuth.js` — X-Cron-Secret 검증
- `server/src/routes/collect.js` — POST /api/collect
- `docs/HANDOFF.md` — 본 문서

**수정**
- `server/src/index.js` — collect 라우터 등록 (`app.use('/api', collectRouter)`, 404 핸들러 앞)

**Phase 1 기존 재사용 모듈 (수정 없음)**
- `server/src/config.js`, `server/src/db.js`, `server/src/middlewares/errorHandler.js`, `server/migrations/001_init.sql`, `server/.env.example`

## 3. 실행 검증이 보류된 이유

- 로컬 `server/.env`에 시크릿(DATABASE_URL, CRON_SECRET 등)이 없어 서버 기동 및 `POST /api/collect` 실제 호출을 수행할 수 없다. `config.js`는 필수 env 누락 시 `process.exit(1)`로 즉시 종료된다.
- 메인 세션과 사용자 합의에 따라 **이번 세션은 코드 작성 + `node --check` 문법 점검까지만** 수행했다.
- `node --check` 결과: `rss.js`, `collector.js`, `cronAuth.js`, `collect.js`, `index.js` 전부 통과.

## 4. 사용자가 .env 준비 후 실행할 검증 명령 (Phase 2 완료 기준)

`server/.env`에 5종 env(DATABASE_URL, CRON_SECRET, GEMINI_API_KEY, GEMINI_MODEL, CORS_ORIGIN) 채운 뒤 `cd server`:

```bash
# 1) 서버 기동
npm run dev

# 2) 헬스체크 (다른 터미널)
curl localhost:3000/health
# 기대: 200 {"status":"ok"}

# 3) 인증 실패 (헤더 없음) → 401
curl -i -X POST localhost:3000/api/collect
# 기대: HTTP/1.1 401, 본문 {"error":{"message":"Unauthorized"}}

# 4) 정상 수집 (첫 호출)
curl -X POST localhost:3000/api/collect -H "X-Cron-Secret: $CRON_SECRET"
# 기대: {"results":[{"source":"openai","fetched":N,"new":M},{"source":"anthropic","fetched":N,"new":M}],"summarized":0}

# 5) 멱등성 (재호출) → new 전부 0
curl -X POST localhost:3000/api/collect -H "X-Cron-Secret: $CRON_SECRET"
# 기대: 각 source의 "new": 0

# 6) DB 적재/정규화 확인 (Neon SQL Editor 또는 psql)
#    SELECT source, count(*) FROM articles GROUP BY source;   -- 두 소스 존재
#    SELECT url FROM articles WHERE url LIKE '%utm%' OR url LIKE '%?%';  -- 0건이어야 함 (쿼리스트링 제거)
#    SELECT * FROM collect_log ORDER BY executed_at DESC LIMIT 4;       -- 소스별 ok 기록

# 7) 소스 격리 확인 (선택): rss.js FEEDS.openai 를 잘못된 URL로 바꿔 재호출
#    → openai는 collect_log status='error', anthropic는 정상 'ok' 여야 함. 확인 후 URL 원복.

# 8) DB 연결 sanity: SELECT 1 (Phase 1 기준)
```

## 5. 코드로 완료 기준을 보장한 근거

- **멱등성**: `collector.js insertArticles()`가 `INSERT ... ON CONFLICT (url) DO NOTHING RETURNING id`. `result.rowCount > 0` 일 때만 newCount 증가 → 기존 url 재삽입 시 new=0.
- **401 인증**: `cronAuth.js`가 `X-Cron-Secret` 헤더를 `config.cronSecret`과 비교, 불일치/누락 시 401 + `{error:{message:'Unauthorized'}}`. 시크릿 값은 로그에 남기지 않음.
- **소스 격리**: `collector.js runCollect()`가 소스별 try/catch. 실패 소스는 `collect_log`에 `status='error', error_message` 기록 후 다음 소스 계속. collect_log 기록 자체 실패도 이중 try/catch로 보호.
- **URL 정규화**: `rss.js normalizeUrl()`이 `URL` 객체로 `search`(쿼리스트링)·`hash` 제거 후 저장 → utm 등 파라미터 제거, UNIQUE 중복 방지.
- **SQL 파라미터 바인딩**: 모든 쿼리 `$1..$n`. 문자열 결합/템플릿 리터럴 쿼리 없음.

## 6. 미해결 이슈 · 함정

1. **로컬 .env 부재** — 실행 검증 보류의 근본 원인. Neon/CRON 시크릿을 `server/.env`에 준비해야 검증 가능. `.env`는 커밋 금지.
2. **client 폴더 중복 — 해결됨(2026-07-15)**. 중첩 `client/client/`(JSX)를 제거하고 최상위 `client/`(TypeScript) 하나로 통일. 스택은 TS로 확정(사용자 승인). 설계서 §0 구현 편차·§2 트리·PHASES Phase 5·frontend-agent 명세를 `.tsx`/`.ts` 기준으로 갱신 완료. 최상위 `client/`는 아직 Vite 기본 예제 스캐폴드 상태이며 Phase 5에서 실제 UI로 교체한다.
3. **Olshansk Anthropic 피드 의존** — anthropic 소스는 서드파티 미러 피드(`raw.githubusercontent.com/Olshansk/rss-feeds`)에 의존. 중단 시 설계서 §12 Plan B(직접 스크래핑)로 rss.js 교체 필요.
4. **요약 미구현** — `collector.js`의 반환은 `summarized: 0` 고정. Phase 3에서 `summary IS NULL` 대상 요약 단계를 runCollect()에 통합해야 한다 (설계서 §6.2 하단 플로우).

## 7. 설계서와 다르게 구현한 부분

- 없음. §6.1/§6.2/§6.3 명세를 그대로 따랐다.
- 참고(설계서 명세 내 재량 결정): description 원본으로 rss-parser의 `contentSnippet`을 우선 사용(없으면 `content`/`description`)하고 HTML 스트립+2000자 절단 적용. 정규화 결과는 명세와 동일.

## 8. 다음 세션(B, Phase 3~5)이 먼저 읽어야 할 것

1. `docs/기술설계_및_제작순서.md` §6.2 요약 플로우 + §4 `GEMINI_MODEL` (Phase 3)
2. `docs/기술설계_및_제작순서.md` §6.3 조회 API 명세 + §6.4 공통 규칙 (Phase 4)
3. Phase 4에서 `docs/API_ACTUAL.md` 작성 필요 — **배포 서버 실제 응답**을 붙여넣어야 함 (설계서 명세 복붙 아님).
4. Phase 5 착수 전 위 6-2 client 폴더 중복 정리.
5. Gemini는 **SDK 설치 금지**, 내장 fetch로 REST 호출. 모델명은 `config.geminiModel`(GEMINI_MODEL env).

## 9. 세션 A 종료 (STOP)

Phase 2 완료 = 세션 A 종료. 커밋은 메인 세션이 수행한다. Phase 3은 새 세션에서 시작.
