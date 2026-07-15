---
프로젝트: AI News Hub
유형: API 실측 기록
상태: 실측 기입 완료 (로컬 서버 + 실제 Neon DB)
작성일: 2026-07-15
tags:
  - project/ai-news
  - api
---

# AI News Hub — API 실측 기록 (API_ACTUAL.md)

> 이 문서는 **실제 서버에서 받은 응답**을 그대로 기록한다. 설계서 명세를 옮겨 적은 것이 아니다.
> 명세 원본: `docs/기술설계_및_제작순서.md` §6.3.
> **시크릿 값 기록 금지.** curl 헤더는 `X-Cron-Secret: $CRON_SECRET`으로 표기.

## 검증 환경

- **로컬 Express 서버**(`node src/index.js`)를 **실제 Neon DB**에 연결해 캡처. `BASE=http://localhost:3100`.
- Gemini 키는 로컬 검증용 더미값 → **요약은 전부 실패(크래시 없이 skip) → `summary`는 전부 `null`**. summary NULL 케이스 실측에 오히려 적합.
- 캡처 시점 DB 상태: `articles` 약 1280건(openai ≈ 1037 / anthropic 243), 전부 `summary IS NULL`, `id=1`은 읽음 처리 테스트로 `is_read=true`. 세션이 여러 시간에 걸쳐 진행되며 OpenAI 피드에 신규 글이 추가돼 카운트가 소폭 증가함.
- **배포(Render) 검증은 미완료**: 배포본은 아직 구버전(`/api/articles` → 404). Phase 4 코드 push + Render 재배포 후 `https://ai-news-03ub.onrender.com/api/articles` 재확인 필요.

---

## 1. POST /api/collect

### 최초 수집 (빈 DB → 실데이터 적재)
```bash
curl -X POST "$BASE/api/collect" -H "X-Cron-Secret: $CRON_SECRET"
```
실제 응답 (HTTP 200):
```json
{"results":[{"source":"openai","fetched":1035,"new":1035},{"source":"anthropic","fetched":243,"new":243}],"summarized":0}
```
- OpenAI RSS는 2015년부터의 아카이브를 통째로 제공 → 최초 수집에 1000건 이상 유입되는 것이 정상.
- `summarized:0` — 더미 Gemini 키라 요약 전부 실패(행 단위 skip, `summary` NULL 유지).

### 재수집 (멱등성 — 진짜 신규만 삽입)
```bash
curl -X POST "$BASE/api/collect" -H "X-Cron-Secret: $CRON_SECRET"
```
실제 응답 (HTTP 200):
```json
{"results":[{"source":"openai","fetched":1036,"new":2},{"source":"anthropic","fetched":243,"new":0}],"summarized":0}
```
- `anthropic new=0` — 기존 243건 전부 `ON CONFLICT (url) DO NOTHING`으로 skip.
- `openai new=2` — 재실행 사이 OpenAI가 실제 신규 글 2건을 발행해 그것만 삽입(기존 1034건은 conflict skip). → **중복 삽입 없음 = 정확한 멱등 동작.**

### 인증 실패 (헤더 누락 → 401)
```bash
curl -i -X POST "$BASE/api/collect"
```
실제 응답:
```
HTTP/1.1 401 Unauthorized
X-Powered-By: Express
Vary: Origin
Content-Type: application/json; charset=utf-8

{"error":{"message":"Unauthorized"}}
```

---

## 2. GET /api/articles

### 기본 조회 (`?limit=2`)
```bash
curl "$BASE/api/articles?limit=2"
```
실제 응답 (HTTP 200):
```json
{"items":[{"id":1,"source":"openai","title":"How to manage AI investments in the agentic era","url":"https://openai.com/index/managing-ai-investments-in-agentic-era","summary":null,"description":"Learn how enterprises can manage AI investments in the agentic era by measuring useful work per dollar, improving efficiency, and scaling high-value workflows.","publishedAt":"2026-07-14T10:00:00.000Z","isRead":false},{"id":2,"source":"openai","title":"How data science teams use ChatGPT Work","url":"https://openai.com/academy/codex-for-work/how-data-science-teams-use-codex","summary":null,"description":"See how data science teams can use ChatGPT Work to build root-cause briefs, impact readouts, KPI memos, scoped analyses, and dashboard specs from real work inputs.","publishedAt":"2026-07-14T00:00:00.000Z","isRead":false}],"page":1,"totalPages":639,"unreadCount":1278}
```
- 필드: `id, source, title, url, summary, description, publishedAt(camelCase), isRead(camelCase)` + 최상위 `page, totalPages, unreadCount`. **§6.3과 필드 단위 일치.**
- `summary`는 `null`로 내려감 → 프론트가 `description`으로 대체.
- `totalPages=639` = ceil(1278 / 2).

### source 필터 — `?source=anthropic&limit=1`
```bash
curl "$BASE/api/articles?source=anthropic&limit=1"
```
실제 응답 (HTTP 200):
```json
{"items":[{"id":1036,"source":"anthropic","title":"Anthropic commits $10 million to Canadian AI research","url":"https://www.anthropic.com/news/canadian-ai-research","summary":null,"description":"Anthropic commits $10 million to Canadian AI research","publishedAt":"2026-07-14T00:00:00.000Z","isRead":false}],"page":1,"totalPages":243,"unreadCount":1278}
```
- `totalPages=243` = anthropic 전체 건수(limit=1). `unreadCount`는 전역 값(아래 구현 노트).

### source 필터 — `?source=openai&limit=1`
```bash
curl "$BASE/api/articles?source=openai&limit=1"
```
실제 응답 (HTTP 200, 캡처 시점 openai=1037):
```json
{"items":[{"id":1421,"source":"openai","title":"The US is advancing AI safety through state and federal action","url":"https://openai.com/index/advancing-ai-safety-through-state-and-federal-action","summary":null,"description":"OpenAI outlines a “reverse federalism” approach to AI governance, where state laws help build a national framework for safe, democratic AI.","publishedAt":"2026-07-15T12:00:00.000Z","isRead":false}],"page":1,"totalPages":1037,"unreadCount":1279}
```

### 잘못된 source (화이트리스트 밖) — `?source=google&limit=1`
> 구현: 화이트리스트 밖 값은 **무시하고 전체 조회**(400 아님).
```bash
curl "$BASE/api/articles?source=google&limit=1"
```
실제 응답 (HTTP 200): `totalPages=1280`(전체 openai+anthropic), 항목은 필터 없이 최신 = openai `id:1421`. → **필터 미적용(전체) 확인.**

### 안읽음만 — `?unread=true&limit=1`
```bash
curl "$BASE/api/articles?unread=true&limit=1"
```
실제 응답 (HTTP 200):
```json
{"items":[{"id":1,"source":"openai","title":"How to manage AI investments in the agentic era","url":"https://openai.com/index/managing-ai-investments-in-agentic-era","summary":null,"description":"Learn how enterprises can manage AI investments in the agentic era by measuring useful work per dollar, improving efficiency, and scaling high-value workflows.","publishedAt":"2026-07-14T10:00:00.000Z","isRead":false}],"page":1,"totalPages":1278,"unreadCount":1278}
```

### 페이지네이션 — `?page=2&limit=1`
```bash
curl "$BASE/api/articles?page=2&limit=1"
```
실제 응답 (HTTP 200): `page:2`, 두 번째 항목 `id:2` 반환 (OFFSET 동작 확인).

### limit clamp — `?limit=1000` (최대 50으로 clamp)
```bash
curl "$BASE/api/articles?limit=1000"
```
실제 결과: **`items` 길이 = 50** (1000 요청이 50으로 clamp됨). ✓

### summary NULL 케이스
위 모든 응답의 `"summary": null`이 실측 근거. 요약 대기/실패 행은 `null`로 내려가며 프론트가 `description`으로 대체 표시한다.

---

## 3. PATCH /api/articles/:id/read

### 정상 (존재하는 id)
```bash
curl -X PATCH "$BASE/api/articles/1/read"
```
실제 응답 (HTTP 200):
```json
{"id":1,"isRead":true}
```
- DB 반영 확인: 이후 `unreadCount`가 1278 → 1279가 아니라, 전체 1280건 중 1건 읽음으로 전역 unread가 감소함(캡처 시점 1279).

### 없는 id → 404
```bash
curl -i -X PATCH "$BASE/api/articles/999999999/read"
```
실제 응답 (HTTP 404):
```json
{"error":{"message":"Article not found"}}
```

### 정수 아닌 id → 404 (안전 처리)
```bash
curl -i -X PATCH "$BASE/api/articles/abc/read"
```
실제 응답 (HTTP 404):
```json
{"error":{"message":"Article not found"}}
```

---

## 4. GET /api/status

```bash
curl "$BASE/api/status"
```
실제 응답 (HTTP 200):
```json
{"lastCollect":[{"source":"anthropic","executedAt":"2026-07-15T04:39:23.737Z","status":"ok","newCount":243},{"source":"openai","executedAt":"2026-07-15T04:38:33.546Z","status":"ok","newCount":1035}]}
```
- 소스별 최신 `collect_log` 1건씩. camelCase `executedAt`, `newCount`. 둘 다 `status:"ok"`라 `errorMessage` 미포함.

## 참고: 존재하지 않는 경로 → 404
```bash
curl "$BASE/api/nope"
```
실제 응답 (HTTP 404): `{"error":{"message":"Not Found"}}` (공통 404 핸들러).

---

## 구현 노트 (설계서 §6.3과의 차이/결정)

- **unreadCount 범위**: 목록 필터(source/unread)와 **무관하게 전체 안읽음 수**(`COUNT(*) WHERE is_read=FALSE`). `?source=anthropic`이어도 `unreadCount`는 전역 값(1278/1279). 프론트 상단 안읽음 뱃지 용도로 전역 값이 자연스러움.
- **잘못된 source**: 400이 아니라 **필터 미적용 전체 조회**(실측: `?source=google` → totalPages 1280 전체).
- **잘못된/없는 id(PATCH)**: 정수 아님(`^\d+$` 불일치) 또는 없는 정수 → 모두 **404** `{"error":{"message":"Article not found"}}`.
- **totalPages**: 현재 필터 기준 `Math.ceil(total/limit)`. 결과 0건이면 0.
- **publishedAt/executedAt 포맷**: `TIMESTAMPTZ` → ISO 8601 UTC, **밀리초 포함**(예 `2026-07-14T10:00:00.000Z`, `...23.737Z`).
- **status.errorMessage**: `status='error'`인 항목에만 포함. `ok` 항목엔 `newCount`만(둘 다 `newCount` 항상 포함).
- **limit clamp**: 최대 50 (실측: `?limit=1000` → items 50).

## 미완 / 다음 액션
- **배포 검증**: Phase 4 코드를 push → Render 재배포 후 `https://ai-news-03ub.onrender.com/api/articles` 실응답으로 위 로컬 결과 재확인 필요(현재 배포본은 구버전).
- **요약 백필 규모**: 최초 수집분 약 1280건이 전부 `summary NULL`. 실제 Gemini 키 투입 후 사이클당 20건 → 전량 요약에 약 64사이클 소요(설계서 §6.2의 "2~3사이클" 가정보다 큼). Plan: 초기 백필 시 LIMIT 상향 검토 또는 시간 경과로 자연 백필.
