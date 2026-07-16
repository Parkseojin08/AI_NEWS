---
프로젝트: AI News Hub
유형: 실행계획
상태: 진행중
작성일: 2026-07-14
수정일: 2026-07-14
tags:
  - project/ai-news
  - 실행계획
---

# AI News Hub Phase 실행 계획

> 레포 배치 경로: `docs/PHASES.md`
> 명세 원본: `docs/기술설계_및_제작순서.md` (이하 "설계서")
> 이 문서는 진행 순서와 완료 기준만 정의한다. 구현 세부는 반드시 설계서를 읽을 것.

## 세션 분할 (총 9단계 = 3세션 × 3단계)

| 세션 | Phase | 범위 | 세션 종료 시 산출물 |
| --- | --- | --- | --- |
| **A** | 0, 1, 2 | 스캐폴드(완료) + 서버 기반 + RSS 수집 | `docs/HANDOFF.md` |
| **B** | 3, 4, 5 | Gemini 요약 + 조회 API + 프론트 기능 | `docs/API_ACTUAL.md`, `docs/HANDOFF.md` 갱신 |
| **C** | 6, 7, 8 | 프론트 마감 + 자동 수집 + 전체 리뷰 | 최종 리뷰 리포트 |

**각 세션의 마지막 Phase를 마치면 반드시 멈춘다.** 다음 세션은 사용자가 새 세션에서 시작한다.

`docs/HANDOFF.md`는 세션 인수인계 문서다. 다음 세션은 이 파일과 `docs/PHASES.md`를 먼저 읽고 시작한다. 포함할 내용:
- 완료한 Phase와 생성/수정한 파일 목록
- 실제로 동작을 확인한 것 (검증 명령과 출력)
- 미해결 이슈, 다음 세션이 알아야 할 함정
- 설계서와 다르게 구현한 부분과 그 사유
- **시크릿 값은 절대 기록하지 않는다**

## 진행 규칙 (MUST)

1. Phase는 0 → 8 순서로만 진행한다. **완료 기준을 통과하기 전 다음 Phase에 착수하지 않는다.**
2. 각 Phase 종료 시 아래 형식으로 **사용자에게 보고하고 승인을 기다린다.** 승인 없이 다음 Phase로 넘어가지 않는다.
3. **세션 경계(Phase 2, 5, 8 완료 시점)에서는 승인 여부와 무관하게 멈춘다.**
4. Phase 완료 후 커밋한다. 메시지 형식: `feat(phase-N): 내용`
5. 설계서와 다르게 구현해야 할 상황이면 임의로 진행하지 말고 사유와 대안을 먼저 보고한다.
6. 완료 기준 검증은 **실제 실행 결과로 증명한다.** 코드를 읽고 "될 것 같다"는 판단은 완료가 아니다.

## Phase 완료 보고 형식

```
## Phase N 완료 보고

### 산출물
- 생성/수정한 파일 목록

### 완료 기준 검증
| 기준 | 검증 방법 | 결과 |
| --- | --- | --- |
| (설계서 기준) | (실행한 명령/요청) | (실제 출력) |

### 설계서와 다르게 구현한 부분
- 없음 / 있다면 사유

### 다음 Phase 착수 가능 여부
- 사용자 승인 요청 (세션 마지막 Phase면: 세션 종료 안내)
```

## 사전 완료 사항

- [x] Render 배포 (`https://ai-news-03ub.onrender.com`) — 서버 URL 확보
- [x] Vercel 프로젝트 (`https://ainews-hub.vercel.app`) — 프로덕션 도메인 확보
- [x] Neon DB 생성 + 스키마 적용 (`articles`, `collect_log`)
- [x] Render 환경 변수 5종 등록
- [x] GitHub Secrets (`CRON_SECRET`, `API_BASE_URL`) 등록
- [x] Vercel 환경 변수 (`VITE_API_BASE_URL`) 등록

---

# 세션 A — Phase 0~2

## Phase 0 — 스캐폴드 (완료)

**담당**: 메인 세션 / **상태**: 완료

레포 생성, 모노레포 구조, `.gitignore`, 임시 `server/src/index.js`, 문서/agent 배치.

---

## Phase 1 — 서버 기반 (config, db)

**담당**: backend-agent
**참조**: 설계서 §2, §4, §5, §6.4

### 산출물
- `server/src/config.js` — 필수 env 5종 로드/검증. 누락 시 `process.exit(1)`
- `server/src/db.js` — pg Pool 싱글턴
- `server/src/middlewares/errorHandler.js` — `{ error: { message } }` 포맷, 스택트레이스 미노출
- `server/src/index.js` — 기존 임시 코드를 위 모듈로 분리·정리
- `server/migrations/001_init.sql` — 설계서 §5 스키마 (기록용, Neon 적용은 완료 상태)

### 완료 기준
| 기준 | 검증 방법 |
| --- | --- |
| 로컬 서버 기동 | `npm run dev` 성공 |
| 헬스체크 | `curl localhost:3000/health` → 200 `{"status":"ok"}` |
| env 검증 동작 | env 하나 제거 후 기동 → 누락 변수명이 찍히고 종료 |
| DB 연결 | `db.js`로 `SELECT 1` 성공 |

---

## Phase 2 — RSS 수집 (요약 제외)

**담당**: backend-agent
**참조**: 설계서 §6.1, §6.2, §6.3(POST /api/collect)

### 산출물
- `server/src/services/rss.js` — 두 피드 fetch/파싱/정규화
- `server/src/services/collector.js` — 수집 오케스트레이션 (요약 단계 제외)
- `server/src/routes/collect.js` — `POST /api/collect`
- `server/src/middlewares/cronAuth.js` — `X-Cron-Secret` 검증
- **`docs/HANDOFF.md`** — 세션 A 인수인계 (위 "세션 분할" 참조)

### 완료 기준
| 기준 | 검증 방법 |
| --- | --- |
| 실데이터 적재 | `curl -X POST localhost:3000/api/collect -H "X-Cron-Secret: $CRON_SECRET"` → `articles`에 두 소스 데이터 존재 |
| 멱등성 | 동일 호출 재실행 → `new: 0` |
| 인증 | 헤더 없이 호출 → 401 |
| 소스 격리 | 한 소스 URL을 잘못된 값으로 바꿔도 다른 소스는 정상 수집, `collect_log`에 error 기록 |
| URL 정규화 | 저장된 url에 쿼리스트링(utm 등) 없음 |
| 인수인계 | `docs/HANDOFF.md` 작성 완료 |

### 세션 A 종료 (STOP)

**Phase 2 완료 = 세션 A 종료.** Phase 3으로 넘어가지 말고 대기할 것.

---

# 세션 B — Phase 3~5

> 시작 전 `docs/HANDOFF.md`와 `docs/기술설계_및_제작순서.md`를 읽을 것.

## Phase 3 — Gemini 요약

**담당**: backend-agent
**참조**: 설계서 §6.2(요약 플로우), §4(GEMINI_MODEL)

### 산출물
- `server/src/services/summarizer.js` — Gemini REST 직접 호출 (**SDK 설치 금지**)
- `collector.js`에 요약 단계 통합

### 완료 기준
| 기준 | 검증 방법 |
| --- | --- |
| 요약 생성 | collect 호출 후 `articles.summary`에 한국어 3문장 채워짐 |
| 대상 선정 | `summary IS NULL` 행만 대상, `LIMIT 20` 적용 |
| 실패 격리 | Gemini 키를 잘못된 값으로 바꿔도 서버 크래시 없음, 해당 행 summary는 NULL 유지 |
| 재시도 | 다음 collect 호출 시 NULL 행 재요약 시도 |

---

## Phase 4 — 조회 API

**담당**: backend-agent
**참조**: 설계서 §6.3, §6.4

### 산출물
- `server/src/routes/articles.js` — `GET /api/articles`, `PATCH /api/articles/:id/read`
- `server/src/routes/status.js` — `GET /api/status`
- CORS 다중 오리진 처리 확인
- **`docs/API_ACTUAL.md`** — 실제 API 응답 기록 (Phase 5 프론트 구현의 기준)

### API_ACTUAL.md
설계서 명세를 옮겨 적는 것이 아니라, **배포된 서버에서 실제로 받은 응답**을 그대로 붙여넣는다.
- 4개 엔드포인트 각각의 실제 curl 명령과 실제 응답 JSON 전문
- 쿼리 파라미터 조합별 응답 예시 (`?source=`, `?unread=true`, `?page=`)
- 에러 응답 실물 (401, 404)
- `summary`가 NULL인 행이 실제로 어떻게 내려오는지
- 설계서 §6.3과 다른 부분이 있으면 명시
- **시크릿 값 기록 금지.** curl 헤더는 `X-Cron-Secret: $CRON_SECRET`으로 표기

### 완료 기준
| 기준 | 검증 방법 |
| --- | --- |
| 목록 조회 | `GET /api/articles` 응답이 설계서 §6.3 스키마와 필드 단위 일치 |
| 필터 | `?source=`, `?unread=true`, `?page=` 각각 동작 |
| 읽음 처리 | `PATCH /api/articles/:id/read` → 200, DB 반영 |
| 404 | 없는 id에 PATCH → 404 |
| 상태 | `GET /api/status` → 소스별 최신 collect_log 1건씩 |
| 배포 검증 | Render 재배포 후 `https://ai-news-03ub.onrender.com/api/articles` 정상 응답 |
| 인수인계 | `docs/API_ACTUAL.md` 작성 완료 |

---

## Phase 5 — 프론트 기능

**담당**: frontend-agent
**참조**: `docs/API_ACTUAL.md`(우선), 설계서 §2(client), §6.3, §7

### 산출물
- `client/` Vite + React 스캐폴드
- `src/api/client.ts` — `VITE_API_BASE_URL` 기반 fetch 래퍼
- `src/components/ArticleCard.tsx`, `FilterBar.tsx`, `StatusBar.tsx`
- `src/hooks/useArticles.ts` — 목록 fetch + 페이지네이션 + 읽음 처리
- **`docs/HANDOFF.md` 갱신** — 세션 B 인수인계

### 완료 기준
| 기준 | 검증 방법 |
| --- | --- |
| 목록 렌더링 | 로컬 백엔드 연동, 카드에 소스/제목/요약/날짜 표시 |
| 필터 | 전체/Anthropic/OpenAI 토글, 안읽음만 보기 동작 |
| 읽음 처리 | 카드 클릭 → 낙관적 업데이트 + 원문 새 탭 |
| 페이지네이션 | 더 보기 동작 |
| summary NULL | description으로 대체 표시 확인 |
| 인수인계 | `docs/HANDOFF.md` 갱신 완료 |

**주의**: API 명세를 임의 변경 금지. 필요 시 보고 후 승인받고 backend와 동시 반영.

### 세션 B 종료 (STOP)

**Phase 5 완료 = 세션 B 종료.** Phase 6으로 넘어가지 말고 대기할 것.

---

# 세션 C — Phase 6~8

> 시작 전 `docs/HANDOFF.md`, `docs/API_ACTUAL.md`, 설계서를 읽을 것.

## Phase 6 — 프론트 마감

**담당**: frontend-agent
**참조**: 설계서 §7.2

### 산출물
- 콜드 스타트 UX (페이지 로드 시 `/health` 선발사, 15초 초과 시 안내)
- 다크 테마 스타일
- 반응형 (모바일 1열 / 데스크톱 2열)

### 완료 기준
| 기준 | 검증 방법 |
| --- | --- |
| 웜업 | 페이지 로드 시 `/health` 요청 발생 확인 (네트워크 탭) |
| 지연 안내 | 응답 15초 지연 시뮬레이션 → "서버 깨우는 중" 노출 |
| 반응형 | 뷰포트 축소 시 1열 전환 |
| 배포 검증 | Vercel 프로덕션(`https://ainews-hub.vercel.app`)에서 실데이터 렌더링 |

---

## Phase 7 — 자동 수집

**담당**: devops-agent
**참조**: 설계서 §8, §9

### 산출물
- `.github/workflows/collect.yml` — collect job(매시 cron + workflow_dispatch, `curl --retry`) + keepalive job(60일 비활성화 방지)

### 완료 기준
| 기준 | 검증 방법 |
| --- | --- |
| 수동 실행 | Actions 탭에서 workflow_dispatch 실행 → 성공 |
| 수집 확인 | 실행 후 `GET /api/status`에 최신 수집 시각 반영 |
| 콜드 스타트 대응 | Render 스핀다운 상태에서도 `--retry`로 성공 |
| keepalive | keepalive 커밋에 `[skip ci]` 포함 |

**주의**: 시크릿 실제 값을 어떤 파일에도 기록 금지. GitHub Secrets 등록은 이미 완료 상태.

---

## Phase 8 — 전체 리뷰

**담당**: review-agent (**코드 수정 권한 없음** — 지적만, 수정은 담당 agent가)
**참조**: 설계서 전체

### 체크리스트
**보안**
- [ ] 시크릿이 코드/커밋 이력/프론트 번들에 노출되지 않음 (`AIza`, `postgresql://`, `npg_` 패턴 grep)
- [ ] 모든 SQL이 파라미터 바인딩 사용 (문자열 결합/템플릿 리터럴 쿼리 검색)
- [ ] `/api/collect` 무인증 호출 시 401
- [ ] CORS가 허용 목록 외 오리진 차단
- [ ] 에러 응답에 스택트레이스 미노출

**명세 대조**
- [ ] 4개 엔드포인트 응답이 설계서 §6.3과 필드 단위 일치 (실제 curl 응답으로 대조)
- [ ] 프론트가 사용하는 필드가 전부 명세에 존재

**엣지 케이스**
- [ ] RSS 한 소스 다운 시 다른 소스 계속 + collect_log error 기록
- [ ] 재수집 멱등성
- [ ] pubDate 파싱 실패 항목 처리
- [ ] summary NULL 항목 프론트 대체 표시
- [ ] 없는 id PATCH → 404
- [ ] Gemini 429 시 크래시 없이 skip

### 리포트 형식
심각도 3단계 분류: `critical`(배포 차단) / `major`(수정 필수) / `minor`(권고). 각 항목에 파일 경로와 근거 명시. 사소한 스타일 차이는 지적하지 않는다.

### 세션 C 종료 (STOP)

**Phase 8 완료 = 프로젝트 완료.** 리뷰 리포트를 보고하고 종료.

---

## 진행 현황

**세션 A**
- [x] Phase 0
- [x] Phase 1 (실검증 완료)
- [x] Phase 2 (실검증 완료)

**세션 B**
- [x] Phase 3 (부분검증 — 실패격리 실측, 실키 요약 미검증)
- [x] Phase 4 (실검증 완료, API_ACTUAL.md)
- [x] Phase 5 (실검증 완료 — 브라우저 종단: 렌더/필터/읽음/더보기)

**세션 C**
- [x] Phase 6 (실검증 완료 — 다크/2열↔1열 반응형/15초 콜드스타트 안내)
- [x] Phase 7 (Render·Vercel 프로덕션 라이브 / collect.yml·DEPLOY.md / workflow_dispatch 성공·/api/status 갱신 확인)
- [x] Phase 8 (전체 리뷰 완료 — critical 0, major 1·minor 2 수정 완료. `docs/REVIEW.md`)
