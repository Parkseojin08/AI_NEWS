---
프로젝트: AI News Hub
유형: 배포 절차서
상태: 확정
작성일: 2026-07-16
---

# AI News Hub 배포 절차 (DEPLOY.md)

> 콘솔에서 사람이 따라 하는 체크리스트. 명세 원본은 `docs/기술설계_및_제작순서.md` §9(배포 절차), §4(환경 변수), §8(GitHub Actions).
> **시크릿 실제 값은 이 문서에 절대 기록하지 않는다.** 등록 위치와 절차만 적는다.

## 0. 확정된 배포 정보 (이 프로젝트 실제 값)

| 대상 | 값 |
| --- | --- |
| GitHub 레포 | **`Parkseojin08/AI_NEWS`** (밑줄 있음) |
| 백엔드(Render) | `https://ai-news-03ub.onrender.com` |
| 프론트(Vercel) | `https://ainews-hub.vercel.app` |
| DB | Neon PostgreSQL (Free) |
| 요약 | Gemini API (모델 `gemini-flash-latest`) |

> ⚠️ **레포 혼동 주의**: 밑줄 없는 복제본 `ainews`가 별도로 존재한다.
> GitHub Secrets / Actions / Vercel import 는 **반드시 밑줄 있는 `AI_NEWS`** 레포를 기준으로 한다.
> `ainews`(복제본)에 Secrets를 등록하면 Actions가 빈 시크릿으로 동작해 수집이 실패한다.

---

## 1. Neon (DB) — 사용자 수행 필요

1. [ ] Neon 콘솔 로그인 → 프로젝트 생성 (region은 가까운 곳, 예: AWS ap-*)
2. [ ] 좌측 **SQL Editor** 열기 → `server/migrations/001_init.sql` 전문을 붙여넣고 실행
3. [ ] 실행 결과로 `articles`, `collect_log` 두 테이블 생성 확인 (Tables 목록)
4. [ ] **Connection string** 확보 (Dashboard → Connect → `psql`/URI). `?sslmode=require` 포함 여부 확인
   - 이 문자열이 `DATABASE_URL`. **문서에 붙여넣지 말 것.** 다음 단계 Render 환경 변수에 직접 입력한다.

> 참고: Neon Free는 auto-suspend 되어 첫 쿼리에 1초 내외 지연이 있다. 정상이다.

---

## 2. Render (백엔드) — 사용자 수행 필요

1. [ ] Render 콘솔 로그인 → **New → Web Service** → GitHub 레포 `AI_NEWS`(밑줄) 연결
2. [ ] 서비스 설정값 입력:

   | 항목 | 값 |
   | --- | --- |
   | Root Directory | `server` |
   | Build Command | `npm install` |
   | Start Command | `node src/index.js` |
   | Instance Type | Free |

3. [ ] **Environment** 탭에서 환경 변수 5종 등록 (설계서 §4). 값은 콘솔에만 입력:

   | 변수 | 값 출처 / 주의 |
   | --- | --- |
   | `DATABASE_URL` | 1단계 Neon connection string (`?sslmode=require` 포함) |
   | `CRON_SECRET` | 랜덤 32자 이상. **GitHub Secrets의 `CRON_SECRET`과 반드시 동일 값** |
   | `GEMINI_API_KEY` | Gemini API 키 (`AIza...`) |
   | `GEMINI_MODEL` | **`gemini-flash-latest`** (기존 `gemini-2.5-flash`는 신규 키에서 차단됨) |
   | `CORS_ORIGIN` | 우선 `https://ainews-hub.vercel.app` (4단계에서 최종 확정) |

   - `PORT`는 Render가 자동 주입하므로 등록하지 않는다 (서버가 `process.env.PORT` 우선 사용).
4. [ ] 배포 완료 후 헬스체크: 브라우저 또는 `curl https://ai-news-03ub.onrender.com/health` → **200** `{"status":"ok"}`
   - 첫 요청은 콜드 스타트로 30~60초 걸릴 수 있다. 200이 뜨면 정상.

---

## 3. Vercel (프론트) — 사용자 수행 필요

1. [ ] Vercel 콘솔 로그인 → **Add New → Project** → GitHub 레포 **`AI_NEWS`(밑줄)** import
   - ⚠️ import 목록에서 밑줄 없는 `ainews`(복제본)를 고르지 말 것.
2. [ ] 프로젝트 설정값:

   | 항목 | 값 |
   | --- | --- |
   | Root Directory | `client` |
   | Framework Preset | **Vite** (자동 인식) |
   | Build Command | 자동 (`vite build` / 기본값 유지) |
   | Output Directory | 자동 (`dist`) |

3. [ ] **환경 변수** 등록:

   | 변수 | 값 |
   | --- | --- |
   | `VITE_API_BASE_URL` | `https://ai-news-03ub.onrender.com` (끝 슬래시 없이) |

4. [ ] Deploy 실행 → 프로덕션 도메인 `https://ainews-hub.vercel.app` 접속 확인

> ⚠️ **루트 `vercel.json` 두지 말 것.** Root Directory=`client`와 충돌해 `client/client` 경로로 빌드되는 오류가 발생한다.
> (한 번 추가했다가 제거함.) Vite 자동 인식만으로 충분하다. 모노레포 루트에 `vercel.json`이 다시 생기면 삭제한다.

---

## 4. Render CORS 반영 — 사용자 수행 필요

1. [ ] Render → 서비스 → **Environment** → `CORS_ORIGIN` 값을 Vercel 프로덕션 도메인으로 확정
   - 값: `https://ainews-hub.vercel.app`
   - 로컬 개발도 병행하려면 콤마로 추가: `https://ainews-hub.vercel.app,http://localhost:5173`
2. [ ] 저장 → Render 자동 재배포 대기 → 프론트에서 API 호출 시 CORS 에러 없는지 확인
   (브라우저 DevTools → Network → `/api/articles` 응답 200, CORS 차단 없음)

---

## 5. GitHub Secrets — 사용자 수행 필요

레포 **`Parkseojin08/AI_NEWS`(밑줄)** → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret 이름 | 값 |
| --- | --- |
| `API_BASE_URL` | `https://ai-news-03ub.onrender.com` (끝 슬래시 없이) |
| `CRON_SECRET` | 2단계 Render `CRON_SECRET`과 **동일한 값** |

- [ ] 두 Secret 모두 `AI_NEWS`(밑줄) 레포에 등록되었는지 재확인 (복제본 `ainews` 아님)
- [ ] `CRON_SECRET`이 Render 환경 변수와 문자 단위로 일치하는지 확인 (불일치 시 collect가 401)

> 이 값들은 GitHub Secrets에만 존재하고, 워크플로에서는 `${{ secrets.API_BASE_URL }}` / `${{ secrets.CRON_SECRET }}`로만 참조된다. 코드·문서에 평문으로 남기지 않는다.

---

## 6. GitHub Actions 워크플로

파일: `.github/workflows/collect.yml` (이 레포에 이미 포함).

- **collect job**: 매시 정각(`0 * * * *`) cron + 수동 실행(`workflow_dispatch`). `curl --retry 3 --retry-delay 30 --retry-all-errors --max-time 120 --fail`로 Render 콜드 스타트에 대응.
- **keepalive job**: 매주 월요일(`17 4 * * 1`) cron에서만 동작. `.github/keepalive`에 날짜를 기록하고 변경이 있으면 `chore: keepalive [skip ci]` 커밋 후 push. `[skip ci]`로 재배포를 막는다.
  - 설계서 §8은 keepalive를 매시로 두었으나, 매시 커밋이 Render 재배포를 매번 유발하므로 **주 1회로 분리**했다. 60일 비활성화 방지에는 주 1회로 충분하다.
- keepalive job에만 `contents: write` 권한을 부여하고, 워크플로 기본 권한은 `contents: read`로 최소화했다.

별도 등록 작업은 없다. 파일이 default 브랜치(main)에 있으면 GitHub가 자동 인식한다.

---

## 7. 배포 검증 (순서대로) — 사용자 수행 필요

1. [ ] **헬스체크**: `curl https://ai-news-03ub.onrender.com/health` → **200** `{"status":"ok"}`
2. [ ] **Actions 수동 실행**: 레포 `AI_NEWS` → **Actions 탭 → collect-news → Run workflow**(workflow_dispatch)
   - collect job이 초록불(성공)로 끝나는지 확인. 콜드 스타트면 첫 curl이 재시도 후 성공할 수 있다.
3. [ ] **수집 반영 확인**: `curl https://ai-news-03ub.onrender.com/api/status`
   - 응답의 `lastCollect[].executedAt`이 방금 실행 시각(최신)으로 갱신되고 `status: "ok"`인지 확인.
4. [ ] **실데이터 렌더링**: `https://ainews-hub.vercel.app` 새로고침 → 기사 카드(제목/한국어 요약/날짜/소스 뱃지)가 실제로 표시되는지 확인.
   - 요약이 아직 NULL인 카드는 description으로 대체 표시되는 것이 정상 (요약은 다음 사이클에 채워짐).
5. [ ] (선택) 자동 수집 확인: 다음 정각(UTC 기준) 이후 `/api/status`의 `executedAt`이 자동 갱신되는지 확인.

---

## 사용자 수행 필요 항목 요약

콘솔 로그인·시크릿 입력·수동 실행은 자동화할 수 없다. 아래는 사람이 직접:

- Neon: 프로젝트 생성, `001_init.sql` 실행, connection string 확보
- Render: Web Service 생성, 환경 변수 5종 입력, `/health` 확인
- Vercel: `AI_NEWS`(밑줄) import, Root=`client`, `VITE_API_BASE_URL` 입력
- Render: `CORS_ORIGIN`에 Vercel 도메인 반영 후 재배포
- GitHub: `AI_NEWS`(밑줄) 레포에 Secrets `API_BASE_URL`, `CRON_SECRET` 등록
- GitHub Actions: workflow_dispatch 수동 실행 → 7단계 검증 수행

## 함정 체크리스트

- [ ] `AI_NEWS`(밑줄)와 `ainews`(복제본) 혼동 금지 — Secrets/Actions/Vercel 모두 밑줄 레포
- [ ] `GEMINI_MODEL`은 `gemini-flash-latest` (구버전 모델명 사용 시 요약 실패)
- [ ] 루트에 `vercel.json` 없어야 함 (있으면 client/client 빌드 오류)
- [ ] Render `CRON_SECRET` = GitHub `CRON_SECRET` (불일치 시 collect 401)
- [ ] URL 끝 슬래시 없이 (`API_BASE_URL`, `VITE_API_BASE_URL`)
