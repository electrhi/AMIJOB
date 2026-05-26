# AMIJOB

> AMI(스마트미터링) 분야 채용 정보를 한 곳에서 — ALIO 공개정보 기반 큐레이션 사이트.

알리오(공공기관 경영정보 공개시스템)에 흩어져 있는 한전KDN, 한국전력공사, 한국가스공사, 한국수자원공사, 한국지역난방공사, 한국에너지공단 등의 AMI 관련 채용 공고를 한 화면에서 분야별·지역별로 필터링하고, 공통 지원서 양식까지 받을 수 있습니다.

## 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 메인 페이지 (검색·필터·카드·모달) |
| `styles.css` | 디자인 시스템 (상용급 라이트 테마) |
| `app.js` | 데이터 로드·필터링·정렬·모달 |
| `data.json` | 채용 공고 데이터 (ALIO 기반 샘플) |
| `application-form.html` | 인쇄 가능한 공통 지원서 양식 |

## 기능

- **검색**: 직무, 기관, 지역, 분야 라벨 전반에 대한 즉시 검색
- **필터**: 분야 / 지역 / 경력 / 채용인원 / 마감일 (마감 임박 D-7, 이번 달 이내)
- **정렬**: 마감 임박순 / 최신 등록순 / 채용인원 많은·적은순
- **D-Day 뱃지**: 7일 이내 임박, 14일 이내 주의, 마감 표시 자동 처리
- **상세 모달**: 자격요건·우대사항·전형절차·접수기간 + 알리오 외부 이동
- **지원서 다운로드**: 표준 지원서 HTML — 브라우저에서 작성 → 인쇄/PDF 저장
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

새 공고를 추가하려면 `jobs` 배열에 한 항목을 더하고 commit/push 하시면 됩니다.

## 데이터 출처 및 면책

본 사이트의 채용 정보는 **ALIO(https://www.alio.go.kr)** 공개 데이터를 가공한 **샘플**입니다. 실제 지원·접수는 반드시 각 기관의 공식 채용 공고를 확인해 주세요. 본 사이트는 ALIO 또는 게재된 어느 기관과도 공식적인 관련이 없습니다.

## License

MIT — `data.json`의 채용 내용은 공공기관 공개 정보를 가공한 것입니다.
