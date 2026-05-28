# AMIJOB

> AMI(스마트미터링) 분야 채용 정보를 한 곳에서 — ALIO 공개정보 기반 큐레이션 사이트.

알리오(공공기관 경영정보 공개시스템)에 흩어져 있는 한전KDN, 한국전력공사, 한국가스공사, 한국수자원공사, 한국지역난방공사, 한국에너지공단 등의 AMI 관련 채용 공고를 한 화면에서 분야별·지역별로 필터링하고, 공통 지원서 양식까지 받을 수 있습니다.

## 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 메인 페이지 (검색·필터·카드·모달) |
| `styles.css` | 디자인 시스템 (상용급 라이트 테마) |
| `app.js` | 데이터 로드·필터링·정렬·모달 |
| `data.json` | 채용 공고 데이터 (ALIO 스크래핑 결과, 매일 자동 갱신) |
| `application-form.html` | 인쇄 가능한 공통 지원서 양식 |
| `board.html` / `board.js` | 상담게시판 · 채용이야기 게시판 (Supabase) |
| `supabase-config.js` | 게시판·챗봇 공용 Supabase 연결 설정 (URL·anon 키) |
| `supabase/schema.sql` | 게시판 DB 스키마 (테이블·RLS·RPC) |
| `chat-widget.css` / `chat-widget.js` | 채용 도우미 챗봇 위젯 (모든 페이지에 삽입 가능) |
| `supabase/functions/chat/` | 챗봇 백엔드 — OpenAI 호출 Edge Function (API 키 은닉) |
| `scripts/update-data.mjs` | ALIO 채용공고 스크래퍼 |
| `.github/workflows/update-data.yml` | 매일 KST 06시 자동 갱신 워크플로우 |

## 기능

- **검색**: 직무, 기관, 지역, 분야 라벨 전반에 대한 즉시 검색
- **필터**: 분야 / 지역 / 경력 / 채용인원 / 마감일 (마감 임박 D-7, 이번 달 이내)
- **정렬**: 마감 임박순 / 최신 등록순 / 채용인원 많은·적은순
- **D-Day 뱃지**: 7일 이내 임박, 14일 이내 주의, 마감 표시 자동 처리
- **상세 모달**: 자격요건·우대사항·전형절차·접수기간 + 알리오 외부 이동
- **지원서 다운로드**: 각 공고 상세에서 알리오 첨부파일 중 파일명에 "지원서"가 든 파일(입사지원서)을 바로 내려받기
- **반응형**: 데스크탑 / 태블릿 / 모바일 대응

## 로컬에서 미리보기

`index.html`은 `fetch('./data.json')`을 사용하므로 **파일 직접 열기(file://)로는 동작하지 않을 수 있습니다.** 간단한 정적 서버로 띄우세요:

```powershell
# Python 3
cd C:\dreamit-web\AMIJOB
python -m http.server 8000
# → http://localhost:8000
```

또는 VS Code의 Live Server 확장 사용 가능. GitHub Pages에 배포하면 그대로 동작합니다.

## 데이터 업데이트

채용 공고는 `data.json`만 수정하면 됩니다. 스키마:

```json
{
  "lastUpdated": "YYYY-MM-DD",
  "fields":  [{ "id", "label", "color", "icon" }, ...],
  "regions": ["서울", ...],
  "careerLevels": [{ "id", "label" }, ...],
  "jobs": [
    {
      "id": "kdn-2026-001",
      "organization": "한전KDN",
      "organizationShort": "KDN",
      "color": "#0d4a8b",
      "title": "...",
      "field": "operations",
      "headcount": 12,
      "location": "대전",
      "employmentType": "정규직",
      "education": "학사 이상",
      "career": "신입",
      "careerLevel": "entry",
      "openDate": "2026-05-15",
      "closeDate": "2026-06-15",
      "salary": "...",
      "summary": "...",
      "description": "...",
      "qualifications": ["...", "..."],
      "preferred":      ["...", "..."],
      "process":        ["서류전형", "면접", ...],
      "alioUrl": "https://www.alio.go.kr/..."
    }
  ]
}
```

새 공고를 수동으로 추가하려면 `jobs` 배열에 한 항목을 더하고 commit/push 하시면 됩니다.

## 자동 데이터 갱신 (매일 KST 06시)

`scripts/update-data.mjs`가 잡알리오(`job.alio.go.kr`)에서 대상 공공기관(한전KDN, 한국전력공사 등)의 채용공고를 가져와 AMI 관련 키워드로 필터링하고 `data.json`을 다시 생성합니다.

`.github/workflows/update-data.yml`이 **매일 한국시간 오전 6시(UTC 21시)**에 이 스크립트를 실행하고, `data.json`이 바뀌었으면 자동으로 커밋·푸시합니다.

- 수동 실행: 로컬에서 `node scripts/update-data.mjs` (Node 18+) 또는 GitHub **Actions 탭 → Update ALIO data → Run workflow**
- 대상 기관·키워드 조정: `scripts/update-data.mjs` 상단의 `CONFIG` 수정
- ⚠️ 잡알리오는 공식 키워드 검색(GET)이 동작하지 않아 **기관명으로 조회 후 제목 키워드로 필터링**합니다. 사이트 HTML 구조가 바뀌면 스크립트의 파싱 정규식을 조정해야 합니다.
- 마감 7일 이상 지난 공고는 자동 제외됩니다. 수집 결과가 0건이면 기존 `data.json`을 덮어쓰지 않습니다(안전장치).
- 자격요건·전형절차 등 상세 정보는 각 카드의 "알리오에서 지원하기" 링크에서 원문을 확인하도록 안내합니다.

> **GitHub Actions 사용 조건**: 저장소 **Settings → Actions → General → Workflow permissions**에서 *"Read and write permissions"*가 켜져 있어야 자동 커밋이 가능합니다.

## 게시판 (상담게시판 / 채용이야기)

`board.html`은 [Supabase](https://supabase.com) 무료 플랜을 백엔드로 사용하는 익명 게시판입니다. 로그인 없이 **닉네임 + 비밀번호**로 글·댓글을 작성하고, 같은 비밀번호로만 수정·삭제할 수 있습니다.

**설정 방법**

1. [supabase.com](https://supabase.com)에서 무료 프로젝트 생성 (리전은 **Seoul** 권장)
2. 좌측 **SQL Editor**에 `supabase/schema.sql` 전체를 붙여넣고 **Run** — 테이블·보안정책·함수가 생성됩니다.
3. **Project Settings → API**에서 `Project URL`과 `anon public` 키를 복사
4. `supabase-config.js`의 `url`, `anonKey` 값을 채우고 commit/push

설정 전까지는 게시판이 "설정 필요" 안내만 표시하며, 메인 페이지와 채용정보는 정상 동작합니다.

**보안 설계**
- 비밀번호는 평문이 아닌 **bcrypt 해시(pgcrypto)**로 저장
- 글쓰기/수정/삭제는 비밀번호를 검증하는 **RPC 함수(SECURITY DEFINER)**로만 가능 — 공개되는 anon 키로 데이터를 임의 변경할 수 없습니다.
- `password_hash` 컬럼은 클라이언트 조회 권한에서 제외

## 채용 도우미 챗봇

OpenAI(GPT) 기반 챗봇으로, **현재 공고 데이터(`data.json`) 기반 Q&A**와 **자기소개서·면접 등 일반 채용 상담**을 함께 제공합니다. 모든 페이지 우하단의 플로팅 버튼으로 열립니다.

**아키텍처** — 정적 사이트라서 OpenAI 키를 프론트엔드에 둘 수 없습니다. 그래서 키는 **Supabase Edge Function**(`supabase/functions/chat`)에만 보관하고, 프론트(`chat-widget.js`)는 이 함수를 호출합니다. 함수는 프론트가 보낸 공고 요약과 대화를 받아 OpenAI에 질의하고 답변만 돌려줍니다.

**설정 방법**

1. **Supabase CLI 설치 & 로그인**
   ```powershell
   npm install -g supabase
   supabase login
   ```
2. **Edge Function 배포** (프로젝트 ref는 `supabase-config.js`의 URL 서브도메인)
   ```powershell
   cd C:\Users\User\AMIJOB
   supabase functions deploy chat --project-ref blbmdnygvoqyrovvlrrh
   ```
3. **OpenAI 키를 시크릿으로 등록** (프론트에 절대 넣지 말 것)
   ```powershell
   supabase secrets set OPENAI_API_KEY=sk-...
   # (선택) 모델 변경 — 기본 gpt-4o-mini
   supabase secrets set OPENAI_MODEL=gpt-4o-mini
   ```
4. 끝. `chat-widget.js`는 `supabase-config.js`의 URL/anon 키로 `…/functions/v1/chat`을 호출하므로 추가 프론트 설정이 없습니다.

> 대시보드로도 가능합니다: Supabase → **Edge Functions**에서 `chat` 생성 후 `index.ts` 붙여넣기, **Edge Functions → Secrets**에 `OPENAI_API_KEY` 추가.

**다른 페이지에 챗봇 추가** — `<head>`에 `<link rel="stylesheet" href="chat-widget.css" />`, `</body>` 직전에 아래 두 줄을 넣으면 됩니다. (`index.html`에는 적용 완료)
```html
<script src="supabase-config.js"></script>
<script src="chat-widget.js"></script>
```

**비용/주의** — OpenAI 사용량만큼 과금됩니다. 기본 모델 `gpt-4o-mini`는 저렴하며, 함수는 대화 최근 12개·공고 60건으로 토큰을 제한합니다. anon 키는 공개되므로, 남용이 우려되면 Edge Function에 호출 한도/검증을 추가하세요.

## 데이터 출처 및 면책

본 사이트의 채용 정보는 **ALIO(https://www.alio.go.kr)** 공개 데이터를 가공한 **샘플**입니다. 실제 지원·접수는 반드시 각 기관의 공식 채용 공고를 확인해 주세요. 본 사이트는 ALIO 또는 게재된 어느 기관과도 공식적인 관련이 없습니다.

## License

MIT — `data.json`의 채용 내용은 공공기관 공개 정보를 가공한 것입니다.
