/* =========================================================
   AMIJOB — ALIO(잡알리오) 채용공고 스크래퍼
   ---------------------------------------------------------
   잡알리오(job.alio.go.kr) 모바일 채용목록을 "기관명"으로 조회한 뒤
   AMI 관련 키워드로 필터링하고, 상세 페이지에서 세부 항목을 보강하여
   data.json(프론트엔드가 읽는 데이터) 스키마로 변환·저장합니다.

   - 외부 의존성 없음 (Node 18+ 내장 fetch 사용)
   - 실행:  node scripts/update-data.mjs
   - GitHub Actions가 매일 KST 06시에 실행합니다.

   ⚠️ 알리오는 공식 검색(GET title=)이 동작하지 않아, 기관명(org_name)으로
      조회한 뒤 제목 키워드로 필터링하는 방식을 씁니다. 사이트 HTML 구조가
      바뀌면 아래 정규식/셀렉터를 조정해야 합니다.
   ========================================================= */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, "..", "data.json");

/* ----------------------- 설정 ----------------------- */
const CONFIG = {
  // 조회할 대상 기관(잡알리오 org_name 검색에 쓰이는 정확한 표기)
  orgs: [
    "한전KDN",
    "한국전력공사",
    "한국가스공사",
    "한국수자원공사",
    "한국지역난방공사",
    "한국에너지공단",
  ],
  // 제목에 아래 키워드 중 하나라도 포함되면 AMI 관련 공고로 수집
  keywords: [
    "AMI", "검침", "스마트미터", "스마트 미터", "원격검침", "계량",
    "전력량계", "미터링", "메터링", "통신", "네트워크",
    "시공", "설비", "작업원", "전력", "PLC", "단말기",
    "배전", "ICT", "정보통신", "상수도", "전기원",
  ],
  maxPagesPerOrg: 5, // 기관당 최대 페이지 수 (10건/페이지)
  requestDelayMs: 350, // 요청 간 간격(서버 부담 최소화)
  userAgent: "Mozilla/5.0 (compatible; AMIJOB-bot/1.0; +https://github.com/electrhi/AMIJOB)",
  timeoutMs: 20000,
  listBase: "https://job.alio.go.kr/mobile2021/recruit/recruit.do",
  detailBase: "https://job.alio.go.kr/recruitview.do",
};

/* 기관별 표시 정보(짧은 이름·브랜드 색상) */
const ORG_META = {
  "한전KDN":        { short: "KDN",     color: "#0d4a8b" },
  "한국전력공사":   { short: "KEPCO",   color: "#2563eb" },
  "한국가스공사":   { short: "KOGAS",   color: "#1e40af" },
  "한국수자원공사": { short: "K-water", color: "#0891b2" },
  "한국지역난방공사": { short: "KDHC",  color: "#dc2626" },
  "한국에너지공단": { short: "KEA",     color: "#059669" },
};

/* ----------------------- HTTP ----------------------- */
async function fetchText(url, { retries = 2, backoffMs = 800 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), CONFIG.timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": CONFIG.userAgent, "Accept-Language": "ko-KR,ko;q=0.9" },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----------------------- 파싱 유틸 ----------------------- */
function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&middot;/g, "·");
}

function stripTags(s) {
  return decodeEntities(String(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/* "2026.05.27", "26.06.10" → "2026-05-27" */
function normalizeDate(raw) {
  const m = String(raw).match(/(\d{2,4})\.(\d{1,2})\.(\d{1,2})/);
  if (!m) return null;
  let [, y, mo, d] = m;
  if (y.length === 2) y = "20" + y;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/* 접수기간 문자열에서 시작/마감일 추출 */
function parseDateRange(text) {
  const dates = [...String(text).matchAll(/(\d{2,4})\.(\d{1,2})\.(\d{1,2})/g)].map((m) => {
    let y = m[1];
    if (y.length === 2) y = "20" + y;
    return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  });
  return { openDate: dates[0] || null, closeDate: dates[dates.length - 1] || null };
}

/* 목록 페이지에서 공고 항목 추출 */
function parseListItems(html, org) {
  const re =
    /<a href="[^"]*recruitView\.do\?idx=(\d+)"[^>]*>[\s\S]*?<div class="workPlace">([\s\S]*?)<\/div>[\s\S]*?<div class="tit">([\s\S]*?)<\/div>[\s\S]*?<div class="date">([\s\S]*?)<\/div>/g;
  const items = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    items.push({
      idx: m[1],
      organization: stripTags(m[2]) || org,
      title: stripTags(m[3]),
      dateBlock: stripTags(m[4]),
    });
  }
  return items;
}

/* 상세 페이지의 첨부파일 목록 추출 → [{ name, url }] */
function parseAttachments(html) {
  const re =
    /<a\s+href="(https:\/\/www\.alio\.go\.kr\/download\/download\.json\?fileNo=\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  const files = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = stripTags(m[2]).replace(/^\s*\d+\.\s*/, "").trim(); // "3. 입사지원서.hwp" → "입사지원서.hwp"
    if (name) files.push({ name, url: m[1] });
  }
  return files;
}

/* 첨부파일 중 파일명에 '지원서'가 포함된 것을 반환(입사지원서 우선) */
function pickApplicationFile(files) {
  const cands = files.filter((f) => f.name.includes("지원서"));
  if (cands.length === 0) return null;
  const preferred = cands.find((f) => f.name.includes("입사지원서"));
  return preferred || cands[0];
}

/* 상세 페이지의 표(th/td) → 맵 */
function parseDetailTable(html) {
  const re = /<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/g;
  const map = {};
  let m;
  while ((m = re.exec(html)) !== null) {
    const key = stripTags(m[1]);
    const val = stripTags(m[2]);
    if (key && !(key in map)) map[key] = val;
  }
  return map;
}

/* ----------------------- 분류 매핑 ----------------------- */
function classifyField(title, ncs = "") {
  const t = `${title} ${ncs}`;
  const rules = [
    ["metering", ["검침", "계량", "전력량계", "미터"]],
    ["analytics", ["데이터", "분석", "빅데이터", "통계"]],
    ["development", ["개발", "소프트웨어", "SW", "프로그램", "전산", "시스템 개발"]],
    ["network", ["통신", "네트워크", "정보통신", "전송", "광케이블", "회선"]],
    ["installation", ["시공", "설치", "공사", "구축", "작업원", "설비", "현장"]],
    ["operations", ["운영", "운용", "유지보수", "관제", "정비"]],
    ["sales", ["영업", "사업관리", "행정", "관리", "지원"]],
  ];
  for (const [id, kws] of rules) {
    if (kws.some((k) => t.includes(k))) return id;
  }
  return "operations";
}

function mapCareerLevel(careerText = "") {
  const t = careerText.replace(/\s/g, "");
  if (t.includes("무관")) return "any";
  if (t.includes("신입") && t.includes("경력")) return "any";
  if (t.includes("신입")) return "entry";
  if (t.includes("경력")) return "junior";
  return "any";
}

function parseHeadcount(text = "") {
  const m = String(text).match(/(\d+)\s*명/);
  return m ? Number(m[1]) : 1;
}

/* 근무지 문자열 → 표준 지역명(앞 2글자 기준) */
const REGION_ALIASES = {
  강원특별자치도: "강원", 전북특별자치도: "전북", 제주특별자치도: "제주",
  충청북도: "충북", 충청남도: "충남", 전라북도: "전북", 전라남도: "전남",
  경상북도: "경북", 경상남도: "경남", 경기도: "경기", 강원도: "강원",
};
function normalizeRegion(raw, validRegions) {
  if (!raw) return "전국";
  const first = raw.split(/[\s,/·]/)[0].trim();
  if (REGION_ALIASES[first]) return REGION_ALIASES[first];
  const hit = validRegions.find((r) => first.startsWith(r) || r.startsWith(first));
  return hit || first || "전국";
}

/* ----------------------- 메인 수집 ----------------------- */
async function collectOrg(org) {
  const collected = [];
  for (let page = 1; page <= CONFIG.maxPagesPerOrg; page++) {
    const url = `${CONFIG.listBase}?pageNo=${page}&search_yn=Y&org_name=${encodeURIComponent(
      org
    )}&order=REG_DATE`;
    let html;
    try {
      html = await fetchText(url);
    } catch (e) {
      console.warn(`  [경고] ${org} p${page} 목록 요청 실패: ${e.message}`);
      break;
    }
    const items = parseListItems(html, org);
    if (items.length === 0) break;
    collected.push(...items);
    if (items.length < 10) break; // 마지막 페이지
    await sleep(CONFIG.requestDelayMs);
  }
  return collected;
}

function matchesKeyword(title) {
  return CONFIG.keywords.some((k) => title.toUpperCase().includes(k.toUpperCase()));
}

async function enrich(item, validRegions) {
  const meta = ORG_META[item.organization] || {};
  const detailUrl = `${CONFIG.detailBase}?idx=${item.idx}`;

  let table = {};
  let applicationFile = null;
  try {
    const html = await fetchText(detailUrl);
    table = parseDetailTable(html);
    applicationFile = pickApplicationFile(parseAttachments(html));
  } catch (e) {
    console.warn(`  [경고] idx=${item.idx} 상세 요청 실패: ${e.message}`);
  }

  const careerText = table["채용구분"] || "";
  const dateRange = parseDateRange(table["채용기간"] || item.dateBlock);
  const openFromReg = normalizeDate(table["등록일"] || "");
  const headcount = parseHeadcount(table["채용인원"] || "");
  const ncs = table["표준직무(NCS)"] || "";
  const field = classifyField(item.title, ncs);
  const location = normalizeRegion(table["근무지"] || item.dateBlock, validRegions);

  const preferred = (table["우대조건"] && table["우대조건"] !== "-")
    ? table["우대조건"].split(/[,\n·]/).map((s) => s.trim()).filter(Boolean)
    : [];

  const qualifications = [
    table["학력정보"] ? `학력: ${table["학력정보"]}` : null,
    ncs ? `직무분야(NCS): ${ncs}` : null,
    careerText ? `채용구분: ${careerText}` : null,
  ].filter(Boolean);

  return {
    id: `alio-${item.idx}`,
    organization: item.organization,
    organizationShort: meta.short || item.organization.slice(0, 3),
    color: meta.color || "#475569",
    title: item.title,
    field,
    headcount,
    location,
    employmentType: table["고용형태"] || "미정",
    education: table["학력정보"] || "학력무관",
    career: careerText || "미정",
    careerLevel: mapCareerLevel(careerText),
    openDate: dateRange.openDate || openFromReg || null,
    closeDate: dateRange.closeDate || null,
    salary: table["급여정보"] || "기관 내규에 따름",
    summary: `${item.organization}에서 진행하는 「${item.title}」 채용 공고입니다.`,
    description:
      `${item.organization} ${location} 근무, ${careerText || "채용구분 미정"}, ` +
      `채용인원 ${headcount}명. 자세한 자격요건·전형절차는 알리오 공식 공고를 확인하세요.`,
    qualifications: qualifications.length ? qualifications : ["자격요건은 알리오 공고를 확인하세요."],
    preferred,
    process: ["서류전형", "면접", "최종합격"],
    alioUrl: detailUrl,
    applicationFile, // { name, url } | null — 알리오 '지원서' 첨부파일
  };
}

async function main() {
  console.log("[AMIJOB] 알리오 채용공고 수집 시작…");

  // 기존 data.json의 메타데이터(분류 체계)는 유지하고 jobs만 교체
  const base = JSON.parse(await readFile(DATA_PATH, "utf8"));
  const validRegions = base.regions || [];

  // 1) 기관별 목록 수집
  const seen = new Set();
  const rawItems = [];
  for (const org of CONFIG.orgs) {
    const items = await collectOrg(org);
    console.log(`  · ${org}: ${items.length}건 조회`);
    for (const it of items) {
      if (seen.has(it.idx)) continue;
      seen.add(it.idx);
      rawItems.push(it);
    }
    await sleep(CONFIG.requestDelayMs);
  }

  // 2) 키워드 필터
  const matched = rawItems.filter((it) => matchesKeyword(it.title));
  console.log(`  → 전체 ${rawItems.length}건 중 AMI 관련 ${matched.length}건 매칭`);

  // 3) 상세 보강
  const jobs = [];
  for (const it of matched) {
    jobs.push(await enrich(it, validRegions));
    await sleep(CONFIG.requestDelayMs);
  }

  // 마감일 누락 항목 제거 + 마감 7일 이상 지난 공고 제외(데이터 신선도)
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const cutoff = new Date(kstNow.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const cleaned = jobs.filter((j) => j.closeDate && j.closeDate >= cutoff);

  // 4) 안전장치: 수집 결과가 0건이면 기존 데이터를 덮어쓰지 않음
  if (cleaned.length === 0) {
    console.warn("[AMIJOB] 수집 결과 0건 — 기존 data.json을 유지하고 종료합니다.");
    return;
  }

  // 마감 임박순 정렬
  cleaned.sort((a, b) => String(a.closeDate).localeCompare(String(b.closeDate)));

  const kstToday = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const out = { ...base, lastUpdated: kstToday, jobs: cleaned };

  await writeFile(DATA_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`[AMIJOB] 완료 — ${cleaned.length}건 저장, lastUpdated=${kstToday}`);
}

main().catch((e) => {
  console.error("[AMIJOB] 치명적 오류:", e);
  process.exit(1);
});
