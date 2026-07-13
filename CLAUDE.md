# AI News Hub — CLAUDE.md (repo 루트용 초안)

> 이 파일은 프로젝트 레포 루트의 `CLAUDE.md`로 복사해서 사용.
> agents/ 폴더의 4개 파일은 레포의 `.claude/agents/`로 복사.
> 기획서와 기술설계서는 레포의 `docs/`로 복사 (파일명 공백은 `_`로 치환: `docs/기술설계_및_제작순서.md`).

---

# AI News Hub

Anthropic·OpenAI 공식 뉴스를 자동 수집하고 한국어 요약과 함께 보여주는 개인용 웹 서비스.

## 설계 문서 (작업 전 필독)
- `docs/기획서.md` — 기능 정의, 무료 티어 제약
- `docs/기술설계_및_제작순서.md` — **구현 명세의 단일 출처(SSOT)**. 모든 구현은 이 문서를 따른다

## 스택
- client: Vite + React (Vercel 정적 배포)
- server: Node.js + Express (Render Free)
- DB: Neon PostgreSQL
- 요약: Gemini API (REST 직접 호출, SDK 미사용)
- 수집 트리거: GitHub Actions (매시 + keepalive)

## Sub Agents
- backend-agent: Phase 1~4 (서버/DB/수집/요약/API)
- frontend-agent: Phase 5~6 (UI)
- devops-agent: Phase 7 (Actions/배포)
- review-agent: Phase 완료 검수 + Phase 8 전체 리뷰 (코드 수정 권한 없음)

## 진행 규칙
1. Phase는 기술설계서 §10 순서(0→8)를 따르며, **review-agent의 완료 기준 통과 전 다음 Phase 착수 금지**
2. API 명세(기술설계서 §6.3)는 backend/frontend 간 계약. 변경은 반드시 메인 세션 승인 후 양쪽 동시 반영
3. 시크릿은 코드/문서에 기록 금지. .env는 커밋 금지 (.env.example만 커밋)
4. 설계서와 다르게 구현해야 할 상황이면 임의 진행하지 말고 사유와 대안을 먼저 보고
5. 커밋은 Phase 단위, 메시지는 `feat(phase-N): 내용` 형식

## 명령어
- server 개발: `cd server && npm run dev`
- client 개발: `cd client && npm run dev`
- 수집 수동 실행(로컬): `curl -X POST localhost:3000/api/collect -H "X-Cron-Secret: $CRON_SECRET"`
