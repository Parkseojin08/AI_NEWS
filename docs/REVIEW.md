---
프로젝트: AI News Hub
유형: Phase 8 전체 리뷰 리포트
작성일: 2026-07-16
상태: 리뷰 완료 + 지적사항 수정 완료
---

# Phase 8 — 전체 리뷰 리포트

> 검증: 로컬 실행 없이 정적 리뷰 + `git rev-list --all` 이력 grep + `docs/API_ACTUAL.md` 실측 대조.
> 판정: **배포 가능(GO)** — critical 0건. major 1 / minor 2 발견, **모두 수정 완료**.

## 요약

| 심각도 | 건수 | 상태 |
| --- | --- | --- |
| critical | 0 | — |
| major | 1 | ✅ 수정됨 |
| minor | 2 | ✅ 수정됨 |

## 이상 없음 (확인된 항목)

**보안**
- 시크릿 노출: 전 커밋 이력·트리 grep(`AIza`, `AQ.Ab`, `npg_`, `postgresql://` 실값, `ep-hidden-mouse`) → 0건. 매칭은 문서 플레이스홀더뿐.
- `.env`/`data.txt` 미추적, `.env.example`만 추적. `.gitignore` 정상.
- 프론트 번들엔 `VITE_API_BASE_URL`(공개 URL)만. Gemini/DB/Cron 시크릿은 서버 전용.
- SQL 전부 파라미터 바인딩($n). 문자열 결합 쿼리 없음.
- `/api/collect` 무인증 → 401. CORS 허용목록 외 차단. 에러 500은 스택 마스킹.

**명세 대조 (§6.3)**
- 4개 엔드포인트 응답 스키마가 §6.3 및 `API_ACTUAL.md` 실측과 필드 단위 일치.
- 프론트(`client.ts` 타입/컴포넌트) 사용 필드가 전부 명세에 존재(추측 필드 없음).

**엣지 케이스**
- 소스 격리 + collect_log error 기록 / 재수집 멱등성 / pubDate 파싱 실패 대체 / summary NULL→description 대체 / 없는 id PATCH 404 / Gemini 에러 skip 후 재시도 — 전부 처리됨.

## 지적 사항 및 수정 내역

### [major] collect.yml `--max-time 120` 타임아웃 → 중복 collect 실행 위험 — ✅ 수정
- 위치: `.github/workflows/collect.yml`
- 문제: `/api/collect`는 RSS + 요약 20건을 동기로 끝낸 뒤 응답. 콜드스타트+요약 지연이 120초를 넘으면 curl 타임아웃 → `--retry-all-errors`가 **같은 POST를 겹쳐 재발사** → 서버에서 `runCollect` 중복 실행 → 요약 중복 → Gemini 분당 한도 자초. 전부 타임아웃 시 매시 Actions 실패 알림.
- 수정: `--max-time 300`으로 상향(콜드스타트+요약 흡수), **`--retry-all-errors` 제거**(타임아웃 시 겹친 재발사 방지), `--retry 2`(일시적 5xx만) 유지.
- 후속: 실제 Gemini 키로 첫 사이클 collect 응답 벽시계 시간을 1회 실측해 상한 재확정 권장.

### [minor] PATCH id가 int4(2147483647) 초과 시 500 — ✅ 수정
- 위치: `server/src/routes/articles.js`
- 문제: `^\d+$`는 통과하나 int4 초과 값은 Postgres `integer out of range` → 500. 존재 불가 리소스이므로 404가 맞음.
- 수정: `id > 2147483647`이면 DB 조회 없이 404.

### [minor] cronAuth 비상수 시간 비교 — ✅ 수정
- 위치: `server/src/middlewares/cronAuth.js`
- 문제: `!==` 조기반환은 이론상 타이밍 사이드채널(저위험).
- 수정: `crypto.timingSafeEqual` 기반 `safeEqual`(길이 다르면 즉시 false)로 교체.

## 배포 가능 여부

**GO.** 배포 차단 결함 없음. 위 3건 수정 반영 완료. 프로덕션(Render 백엔드 + Vercel 프론트)은 실데이터로 정상 동작 중.
