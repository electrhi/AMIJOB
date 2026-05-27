/* =========================================================
   AMIJOB — frontend logic
   ========================================================= */

const state = {
  data: null,
  filters: {
    fields: new Set(),
    regions: new Set(),
    careerLevels: new Set(),
    headcountMin: 0,
    deadline: "all",
    query: "",
  },
  sort: "deadline",
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheEls();
  bindStaticEvents();

  try {
    const res = await fetch("./data.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();
  } catch (err) {
    showLoadError(err);
    return;
  }

  renderHeaderMeta();
  renderFilterOptions();
  bindFilterEvents();
  refresh();
}

function cacheEls() {
  els.cards = document.getElementById("cards");
  els.empty = document.getElementById("empty");
  els.jobCount = document.getElementById("jobCount");
  els.activeChips = document.getElementById("activeChips");
  els.searchInput = document.getElementById("searchInput");
  els.searchForm = document.getElementById("searchForm");
  els.sort = document.getElementById("sortSelect");
  els.filterFields = document.getElementById("filterFields");
  els.filterRegions = document.getElementById("filterRegions");
  els.filterCareers = document.getElementById("filterCareers");
  els.filterDeadline = document.getElementById("filterDeadline");
  els.filterHeadcount = document.getElementById("filterHeadcount");
  els.filterHeadcountValue = document.getElementById("filterHeadcountValue");
  els.resetBtn = document.getElementById("resetFilters");
  els.emptyReset = document.getElementById("emptyReset");
  els.modal = document.getElementById("jobModal");
  els.modalContent = document.getElementById("modalContent");
  els.statTotalJobs = document.getElementById("statTotalJobs");
  els.statTotalHeadcount = document.getElementById("statTotalHeadcount");
  els.statOrgs = document.getElementById("statOrgs");
  els.statUrgent = document.getElementById("statUrgent");
  els.cardTpl = document.getElementById("cardTpl");
  els.header = document.getElementById("siteHeader");
  els.lastUpdatedNav = document.querySelector("#lastUpdatedNav time");
  els.aboutUpdated = document.getElementById("aboutUpdated");
  els.year = document.getElementById("year");
}

function bindStaticEvents() {
  // year
  if (els.year) els.year.textContent = new Date().getFullYear();

  // sticky header
  const onScroll = () => {
    if (window.scrollY > 12) els.header.classList.add("scrolled");
    else els.header.classList.remove("scrolled");
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // search
  els.searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    state.filters.query = els.searchInput.value.trim();
    refresh();
  });
  els.searchInput.addEventListener("input", debounce(() => {
    state.filters.query = els.searchInput.value.trim();
    refresh();
  }, 180));

  // quick keywords
  document.querySelectorAll(".quick").forEach((btn) => {
    btn.addEventListener("click", () => {
      els.searchInput.value = btn.dataset.quick;
      state.filters.query = btn.dataset.quick;
      refresh();
      document.getElementById("jobs").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // sort
  els.sort.addEventListener("change", () => {
    state.sort = els.sort.value;
    refresh({ skipFilterUI: true });
  });

  // reset filters
  const reset = () => {
    state.filters.fields.clear();
    state.filters.regions.clear();
    state.filters.careerLevels.clear();
    state.filters.headcountMin = 0;
    state.filters.deadline = "all";
    state.filters.query = "";
    els.searchInput.value = "";
    document.querySelectorAll(".filter-group input[type='checkbox']").forEach((c) => (c.checked = false));
    const dRadio = document.querySelector('input[name="deadline"][value="all"]');
    if (dRadio) dRadio.checked = true;
    els.filterHeadcount.value = 0;
    els.filterHeadcountValue.textContent = "0";
    refresh();
  };
  els.resetBtn.addEventListener("click", reset);
  els.emptyReset.addEventListener("click", reset);

  // modal close
  els.modal.addEventListener("click", (e) => {
    if (e.target.dataset.close !== undefined) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.modal.hidden) closeModal();
  });
}

function bindFilterEvents() {
  // field checkboxes
  els.filterFields.querySelectorAll("input").forEach((c) => {
    c.addEventListener("change", () => {
      toggle(state.filters.fields, c.value, c.checked);
      refresh();
    });
  });

  // region checkboxes
  els.filterRegions.querySelectorAll("input").forEach((c) => {
    c.addEventListener("change", () => {
      toggle(state.filters.regions, c.value, c.checked);
      refresh();
    });
  });

  // career checkboxes
  els.filterCareers.querySelectorAll("input").forEach((c) => {
    c.addEventListener("change", () => {
      toggle(state.filters.careerLevels, c.value, c.checked);
      refresh();
    });
  });

  // deadline radio
  els.filterDeadline.querySelectorAll("input").forEach((r) => {
    r.addEventListener("change", () => {
      if (r.checked) {
        state.filters.deadline = r.value;
        refresh();
      }
    });
  });

  // headcount range
  els.filterHeadcount.addEventListener("input", () => {
    state.filters.headcountMin = Number(els.filterHeadcount.value);
    els.filterHeadcountValue.textContent = state.filters.headcountMin;
  });
  els.filterHeadcount.addEventListener("change", () => {
    refresh();
  });
}

function toggle(set, val, on) {
  if (on) set.add(val);
  else set.delete(val);
}

/* ---------- Render ---------- */

function renderHeaderMeta() {
  if (els.lastUpdatedNav) els.lastUpdatedNav.textContent = state.data.lastUpdated;
  if (els.aboutUpdated) {
    els.aboutUpdated.textContent = `데이터 기준일: ${state.data.lastUpdated}`;
  }
}

function renderFilterOptions() {
  // Fields
  els.filterFields.innerHTML = state.data.fields
    .map(
      (f) => `
      <label>
        <input type="checkbox" value="${f.id}" />
        <span class="field-tag">
          <span class="field-dot" style="background:${f.color}"></span>
          ${escape(f.label)}
        </span>
      </label>`
    )
    .join("");

  // Regions
  els.filterRegions.innerHTML = state.data.regions
    .map((r) => `
      <label>
        <input type="checkbox" value="${escape(r)}" />
        <span>${escape(r)}</span>
      </label>`)
    .join("");

  // Career levels
  els.filterCareers.innerHTML = state.data.careerLevels
    .map((c) => `
      <label>
        <input type="checkbox" value="${c.id}" />
        <span>${escape(c.label)}</span>
      </label>`)
    .join("");
}

function refresh() {
  const list = applyFilters(state.data.jobs);
  const sorted = applySort(list);

  renderStats(state.data.jobs); // stats use full dataset
  renderCount(sorted.length);
  renderActiveChips();
  renderCards(sorted);
}

function applyFilters(jobs) {
  const f = state.filters;
  const q = f.query.toLowerCase();
  const today = todayDate();

  return jobs.filter((job) => {
    // text search
    if (q) {
      const hay = [
        job.title,
        job.organization,
        job.organizationShort,
        job.summary,
        job.description,
        job.location,
        getFieldLabel(job.field),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.fields.size && !f.fields.has(job.field)) return false;
    if (f.regions.size && !f.regions.has(job.location)) return false;
    if (f.careerLevels.size && !f.careerLevels.has(job.careerLevel)) return false;
    if (f.headcountMin && job.headcount < f.headcountMin) return false;

    if (f.deadline !== "all") {
      const close = parseDate(job.closeDate);
      const diff = daysBetween(today, close);
      if (f.deadline === "urgent" && (diff < 0 || diff > 7)) return false;
      if (f.deadline === "month" && (diff < 0 || close.getMonth() !== today.getMonth() || close.getFullYear() !== today.getFullYear())) return false;
    }
    return true;
  });
}

function applySort(jobs) {
  const arr = jobs.slice();
  switch (state.sort) {
    case "latest":
      arr.sort((a, b) => parseDate(b.openDate) - parseDate(a.openDate));
      break;
    case "headcountDesc":
      arr.sort((a, b) => b.headcount - a.headcount);
      break;
    case "headcountAsc":
      arr.sort((a, b) => a.headcount - b.headcount);
      break;
    case "deadline":
    default: {
      const today = todayDate();
      arr.sort((a, b) => {
        const da = daysBetween(today, parseDate(a.closeDate));
        const db = daysBetween(today, parseDate(b.closeDate));
        const ka = da < 0 ? Number.POSITIVE_INFINITY : da;
        const kb = db < 0 ? Number.POSITIVE_INFINITY : db;
        return ka - kb;
      });
    }
  }
  return arr;
}

function renderStats(jobs) {
  const today = todayDate();
  const open = jobs.filter((j) => daysBetween(today, parseDate(j.closeDate)) >= 0);
  els.statTotalJobs.textContent = open.length;
  els.statTotalHeadcount.textContent = open.reduce((a, j) => a + j.headcount, 0).toLocaleString("ko-KR");
  els.statOrgs.textContent = new Set(open.map((j) => j.organization)).size;
  els.statUrgent.textContent = open.filter((j) => {
    const d = daysBetween(today, parseDate(j.closeDate));
    return d >= 0 && d <= 7;
  }).length;
}

function renderCount(n) {
  els.jobCount.innerHTML = `총 <strong>${n}</strong>건`;
}

function renderActiveChips() {
  const f = state.filters;
  const chips = [];

  if (f.query) chips.push({ label: `"${f.query}"`, clear: () => { f.query = ""; els.searchInput.value = ""; } });
  f.fields.forEach((id) => chips.push({ label: getFieldLabel(id), clear: () => removeFromSet("fields", id, `input[value="${id}"]`, els.filterFields) }));
  f.regions.forEach((r) => chips.push({ label: r, clear: () => removeFromSet("regions", r, `input[value="${r}"]`, els.filterRegions) }));
  f.careerLevels.forEach((id) => chips.push({ label: getCareerLabel(id), clear: () => removeFromSet("careerLevels", id, `input[value="${id}"]`, els.filterCareers) }));
  if (f.headcountMin > 0) chips.push({ label: `${f.headcountMin}명 이상`, clear: () => { f.headcountMin = 0; els.filterHeadcount.value = 0; els.filterHeadcountValue.textContent = "0"; } });
  if (f.deadline === "urgent") chips.push({ label: "마감 임박", clear: () => { f.deadline = "all"; document.querySelector('input[name="deadline"][value="all"]').checked = true; } });
  if (f.deadline === "month") chips.push({ label: "이번 달", clear: () => { f.deadline = "all"; document.querySelector('input[name="deadline"][value="all"]').checked = true; } });

  els.activeChips.innerHTML = "";
  chips.forEach((c) => {
    const span = document.createElement("span");
    span.className = "chip-active";
    span.innerHTML = `${escape(c.label)} <button aria-label="제거">×</button>`;
    span.querySelector("button").addEventListener("click", () => {
      c.clear();
      refresh();
    });
    els.activeChips.appendChild(span);
  });
}

function removeFromSet(key, val, selector, container) {
  state.filters[key].delete(val);
  const input = container.querySelector(selector);
  if (input) input.checked = false;
}

function renderCards(jobs) {
  els.cards.innerHTML = "";
  if (!jobs.length) {
    els.empty.hidden = false;
    return;
  }
  els.empty.hidden = true;

  const today = todayDate();
  const frag = document.createDocumentFragment();
  jobs.forEach((job) => {
    const node = els.cardTpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = job.id;

    const logo = node.querySelector(".org-logo");
    logo.style.background = job.color;
    logo.textContent = job.organizationShort;

    node.querySelector(".org-name").textContent = job.organization;
    node.querySelector(".job-id").textContent = job.id.toUpperCase();

    const dday = node.querySelector(".dday");
    const close = parseDate(job.closeDate);
    const diff = daysBetween(today, close);
    if (diff < 0) {
      dday.textContent = "마감";
      dday.classList.add("closed");
    } else if (diff === 0) {
      dday.textContent = "D-Day";
      dday.classList.add("urgent");
    } else if (diff <= 7) {
      dday.textContent = `D-${diff}`;
      dday.classList.add("urgent");
    } else if (diff <= 14) {
      dday.textContent = `D-${diff}`;
      dday.classList.add("soon");
    } else {
      dday.textContent = `D-${diff}`;
    }

    node.querySelector(".card-title").textContent = job.title;
    node.querySelector(".card-summary").textContent = job.summary;

    const field = state.data.fields.find((f) => f.id === job.field);
    const fieldEl = node.querySelector(".meta-field");
    fieldEl.querySelector(".dot").style.background = field?.color || "#64748b";
    fieldEl.querySelector("b").textContent = field?.label || "기타";

    node.querySelector(".meta-location b").textContent = job.location;
    node.querySelector(".meta-headcount b").textContent = job.headcount;
    node.querySelector(".meta-career b").textContent = job.career;

    node.querySelector(".close-date").textContent = `접수: ${formatRange(job.openDate, job.closeDate)}`;

    node.addEventListener("click", () => openModal(job));
    node.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModal(job);
      }
    });
    frag.appendChild(node);
  });
  els.cards.appendChild(frag);
}

/* ---------- Modal ---------- */

function openModal(job) {
  const today = todayDate();
  const close = parseDate(job.closeDate);
  const diff = daysBetween(today, close);
  const field = state.data.fields.find((f) => f.id === job.field) || {};

  let ddayBadge = "";
  if (diff < 0) ddayBadge = `<span class="modal-badge urgent">마감</span>`;
  else if (diff <= 7) ddayBadge = `<span class="modal-badge urgent">D-${diff} · 임박</span>`;

  els.modalContent.innerHTML = `
    <header class="modal-header">
      <div class="org-logo" style="background:${job.color}">${escape(job.organizationShort)}</div>
      <div class="header-text">
        <div class="modal-org">${escape(job.organization)}</div>
        <h3>${escape(job.title)}</h3>
        <div class="modal-badges">
          <span class="modal-badge field" style="background:${field.color || "#64748b"}">${escape(field.label || "기타")}</span>
          <span class="modal-badge">${escape(job.employmentType)}</span>
          <span class="modal-badge">${escape(job.career)}</span>
          ${ddayBadge}
        </div>
      </div>
    </header>

    <dl class="modal-meta-grid">
      <div><dt>채용 인원</dt><dd>${job.headcount}명</dd></div>
      <div><dt>근무 지역</dt><dd>${escape(job.location)}</dd></div>
      <div><dt>학력</dt><dd>${escape(job.education)}</dd></div>
      <div><dt>처우</dt><dd>${escape(job.salary)}</dd></div>
      <div><dt>접수기간</dt><dd>${escape(formatRange(job.openDate, job.closeDate))}</dd></div>
      <div><dt>공고번호</dt><dd style="font-family:ui-monospace,SFMono-Regular,monospace;font-size:.88rem">${escape(job.id.toUpperCase())}</dd></div>
    </dl>

    <section class="modal-section">
      <h4>직무 소개</h4>
      <p>${escape(job.description)}</p>
    </section>

    <section class="modal-section">
      <h4>자격 요건</h4>
      <ul>${job.qualifications.map((q) => `<li>${escape(q)}</li>`).join("")}</ul>
    </section>

    <section class="modal-section">
      <h4>우대 사항</h4>
      <ul>${job.preferred.map((q) => `<li>${escape(q)}</li>`).join("")}</ul>
    </section>

    <section class="modal-section">
      <h4>전형 절차</h4>
      <div class="process-steps">
        ${job.process.map((s) => `<span class="process-step">${escape(s)}</span>`).join("")}
      </div>
    </section>
  `;

  // Action bar (sticky bottom)
  const applyFileBtn = job.applicationFile
    ? `<a class="btn btn-ghost" href="${escape(job.applicationFile.url)}" target="_blank" rel="noopener">
         📄 입사지원서 내려받기 <span class="muted small">(${escape(job.applicationFile.name)})</span>
       </a>`
    : `<a class="btn btn-ghost" href="${escape(job.alioUrl)}" target="_blank" rel="noopener">
         📎 알리오 첨부파일 보기
       </a>`;

  const actions = document.createElement("div");
  actions.className = "modal-actions";
  actions.innerHTML = `
    ${applyFileBtn}
    <a class="btn btn-primary" href="${escape(job.alioUrl)}" target="_blank" rel="noopener">
      알리오에서 지원하기 →
    </a>
  `;
  els.modalContent.parentElement.appendChild(actions);

  els.modal.hidden = false;
  els.modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  els.modal.hidden = true;
  els.modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  const old = els.modal.querySelector(".modal-actions");
  if (old) old.remove();
}

/* ---------- Utils ---------- */

function showLoadError(err) {
  els.cards.innerHTML = `
    <div class="empty" style="display:block">
      <div class="empty-icon">⚠️</div>
      <h3>데이터를 불러오지 못했습니다</h3>
      <p>${escape(err.message)}</p>
      <p class="muted small">로컬에서 직접 열고 계신 경우, 보안 정책으로 fetch가 차단될 수 있습니다.<br/>간단한 정적 서버로 열어 주세요 (예: <code>python -m http.server</code>).</p>
    </div>`;
}

function getFieldLabel(id) {
  return state.data.fields.find((f) => f.id === id)?.label || id;
}
function getCareerLabel(id) {
  return state.data.careerLevels.find((c) => c.id === id)?.label || id;
}

function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function todayDate() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}
function formatRange(open, close) {
  return `${open} ~ ${close}`;
}

function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

function escape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
