---
프로젝트: AI News Hub
유형: 세션 인수인계
작성일: 2026-07-15
수정일: 2026-07-16
세션: A (Phase 0~2) → 연장 진행 (Phase 3~4 포함)
---

# HANDOFF — Phase 0~4

> 다음 세션은 이 문서와 `docs/PHASES.md`, `docs/API_ACTUAL.md`, `docs/기술설계_및_제작순서.md`(SSOT)를 먼저 읽고 시작한다.
> **시크릿 값은 이 문서 어디에도 없다. 앞으로도 기록 금지.**

> **경계 메모**: 원래 세션 A는 Phase 2에서 STOP이었으나, 사용자 지시로 같은 세션에서 Phase 3~4까지 진행. 이후 사용자가 `data.txt`(gitignore됨)로 실제 `DATABASE_URL`을 제공해 **Phase 1~4를 실제 Neon DB로 실행 검증 완료**함.

## 1. 완료한 Phase

| Phase | 상태 | 비고 |
| --- | --- | --- |
| 0 스캐폴드 | 완료 | 메인 세션 |
| 1 서버 기반 (config/db/errorHandler) | 완료·**실검증** (커밋 `1d008a3`) | SELECT 1 + 스키마 대조 OK |
| 2 RSS 수집 (요약 제외) | 완료·**실검증** (커밋 `848f74d`) | 적재/멱등/401/정규화 실측 |
| 3 Gemini 요약 | 완료·부분검증 (커밋 `b63dfdf`) | 실패격리 실측(더미키→NULL 유지). 실키 요약 성공은 미검증 |
| 4 조회 API | 완료·**실검증** (이번 커밋) | 4개 엔드포인트 실응답 = `docs/API_ACTUAL.md` |

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

## 3. 실제 검증 결과 (2026-07-16, 로컬 서버 + 실제 Neon DB)

`data.txt`의 실제 `DATABASE_URL`로 로컬 서버를 구동해 검증 완료. (CRON_SECRET/GEMINI는 로컬 더미값, env는 인라인 주입 — 파일 미기록.)

- **DB 연결/스키마**: `SELECT 1` OK. `articles`(9컬럼)/`collect_log`(6컬럼)/인덱스 3종이 `001_init.sql`과 정확히 일치.
- **수집/적재**: 최초 collect → openai 1035 / anthropic 243건 적재. `summarized:0`(더미키).
- **멱등성**: 재수집 → anthropic `new=0`, openai `new=2`(그 사이 실제 신규 글만 삽입). 중복 url 0건.
- **URL 정규화**: 저장 url 중 쿼리스트링/utm 포함 **0건**.
- **인증**: 헤더 없는 collect → **401** `{"error":{"message":"Unauthorized"}}`.
- **요약 실패 격리(Phase 3)**: 더미 Gemini 키로 전건 실패했으나 크래시 없이 `summary` NULL 유지(1280건 전부 NULL) → 다음 사이클 재시도 경로 확인.
- **조회 API(Phase 4)**: `GET /api/articles`(필터/페이지/limit clamp 50), `PATCH /:id/read`(200 / 없는·비정수 id 404), `GET /api/status` 실응답 전부 §6.3 일치 → `docs/API_ACTUAL.md`에 실물 기록.

### 아직 미검증(다음 액션)
- **실제 Gemini 키로 요약 성공** — 현재 GEMINI_API_KEY/GEMINI_MODEL 실값 미투입. `GEMINI_MODEL`(무료 티어 모델명) 확정 필요(설계서 §12).
- **배포(Render) 재확인** — 배포본은 구버전. Phase 3~4 코드 push + 재배포 후 `https://ai-news-03ub.onrender.com/api/articles` 재검증.

### 프로덕션 DB 현재 상태 (검증으로 생긴 실데이터)
- `articles` 약 1280건 적재됨(openai≈1037/anthropic 243), 전부 `summary IS NULL`, `id=1`은 읽음 테스트로 `is_read=true`. `collect_log`에 ok 로그 존재.
- 원치 않으면 `TRUNCATE articles, collect_log;`로 초기화 가능. 그대로 두면 실 Gemini 키 투입 후 사이클마다 20건씩 요약 백필.
- **성능 메모**: collect 1회가 약 4분(1279행 순차 INSERT 왕복 지배적). 시간당 cron엔 무해하나, 초기 백필/속도 개선이 필요하면 다건 INSERT(values 배치)로 최적화 여지.

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
