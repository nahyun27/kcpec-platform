# KCPEC Platform

한국범죄예방교육센터(KCPEC) 온라인 교육·심리상담 플랫폼. 강의 수강, 퀴즈, 수료증/서약서 발급,
전문가 심리상담 신청, 결제(토스페이먼츠), 커뮤니티, 관리자 대시보드를 제공한다.

- 운영 사이트: https://kcpec.co.kr

## 기술 스택

| | |
|---|---|
| Backend | FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL |
| Frontend | Next.js 16 (App Router) + TypeScript + Tailwind CSS |
| 결제 | 토스페이먼츠 (카드/간편결제/실시간계좌이체/가상계좌) |
| 인증 | httpOnly 쿠키 기반 JWT + 카카오/네이버/구글 소셜 로그인 |
| AI | Gemini API (심리상담 의견서 초안 자동 생성) |
| 인프라 | AWS EC2 + Nginx + systemd, Cloudflare DNS |

## 저장소 구조

```
backend/    FastAPI 앱, DB 모델, Alembic 마이그레이션, 인증서/문서 생성 스크립트
frontend/   Next.js 앱 (App Router)
```

## 로컬 개발 환경

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # 값 채우기 (아래 "환경변수" 참고)

alembic upgrade head    # DB 마이그레이션
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

cp .env.example .env.local   # 값 채우기

npm run dev   # http://localhost:3000
```

## 환경변수

`backend/.env.example`, `frontend/.env.example` 에 필요한 값과 설명이 전부 주석으로 정리돼
있다. 아래는 그 중 비워두면 자동으로 안전한 개발 모드로 동작하는 것들:

- `TOSS_SECRET_KEY` 미설정 → 결제 시뮬레이션 모드 (실제 결제창 없이 즉시 완료 처리)
- `GEMINI_API_KEY` 미설정 → 심리상담 의견서 초안이 더미 텍스트로 대체
- `SMTP_HOST` 미설정 → 이메일 발송 대신 콘솔에 출력
- 소셜 로그인(`KAKAO_*`/`NAVER_*`/`GOOGLE_*`) 미설정 → 해당 provider 버튼 비활성화

## 데이터베이스 마이그레이션

```bash
cd backend
alembic revision --autogenerate -m "설명"
alembic upgrade head
```

## 배포

프로덕션은 AWS EC2 인스턴스 한 대에서 systemd 서비스 두 개(`kcpec-backend`,
`kcpec-frontend`)로 직접 운영하며, Nginx가 `kcpec.co.kr` 도메인의 리버스 프록시 +
Let's Encrypt(certbot) SSL을 담당한다. DNS는 Cloudflare(DNS only, 프록시 비활성)를 사용한다.

배포 순서(둘 다 `main` 브랜치 기준):

```bash
# 서버에서
cd ~/kcpec-platform
git pull --ff-only

# 백엔드 변경 시
sudo systemctl restart kcpec-backend

# 프론트엔드 변경 시 (NEXT_PUBLIC_* 값은 빌드 시점에 고정되므로 재빌드 필요)
cd frontend && npm run build
sudo systemctl restart kcpec-frontend
```

## 주요 기능

- **강의**: 카테고리별 강의 목록, 차시별 진도 추적, 퀴즈, 수강기간 관리
- **결제**: 단건/묶음결제, 토스페이먼츠 연동 (카드/간편결제/계좌이체/가상계좌 자동 입금확인 웹훅)
- **발급 서류**: 수료증·서약서(PPTX 템플릿 → PDF, 과정별 구 사이트 발급 이력을 이어받는 채번),
  심리상담 의견서(AI 초안 → 직원 검토 → 최종본 업로드)
- **커뮤니티**: 공지사항, 전문가 칼럼, 수강후기, 1:1 문의(Q&A)
- **관리자**: 회원/주문/발급서류 관리, 매출·방문자 통계, 강의/퀴즈/공지 CRUD
