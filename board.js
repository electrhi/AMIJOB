/* =========================================================
   AMIJOB — 게시판 (상담게시판 / 채용이야기)
   Supabase 백엔드 · 익명(닉네임 + 비밀번호) 방식
   ========================================================= */

const BOARD_META = {
  consult: {
    eyebrow: "COMMUNITY",
    title: "상담게시판",
    desc: "AMI 채용·지원에 대한 궁금증을 묻고 답하는 공간입니다.",
  },
  story: {
    eyebrow: "COMMUNITY",
    title: "채용이야기",
    desc: "면접 후기, 합격 경험, 현장 이야기를 자유롭게 나눠 보세요.",
  },
};

const PAGE_SIZE = 15;

const state = {
  board: "consult",
  page: 0,
  total: 0,
  sb: null,
  configured: false,
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheEls();
  if (els.year) els.year.textContent = new Date().getFullYear();
  bindHeaderScroll();

  // 게시판 종류 결정
  const params = new URLSearchParams(location.search);
  const b = params.get("board");
  state.board = b === "story" ? "story" : "consult";
  applyBoardMeta();

  // Supabase 초기화
  setupSupabase();

  // 이벤트
  els.writeBtn.addEventListener("click", () => openForm("create"));
  els.modal.addEventListener("click", (e) => {
    if (e.target.dataset.close !== undefined) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.modal.hidden) closeModal();
  });

  if (state.configured) loadList();
}

function cacheEls() {
  els.eyebrow = document.getElementById("boardEyebrow");
  els.title = document.getElementById("boardTitle");
  els.desc = document.getElementById("boardDesc");
  els.tabs = document.getElementById("boardTabs");
  els.count = document.getElementById("postCount");
  els.writeBtn = document.getElementById("writeBtn");
  els.list = document.getElementById("postList");
  els.empty = document.getElementById("boardEmpty");
  els.notice = document.getElementById("boardNotice");
  els.pagination = document.getElementById("pagination");
  els.modal = document.getElementById("boardModal");
  els.modalContent = document.getElementById("boardModalContent");
  els.year = document.getElementById("year");
}

function bindHeaderScroll() {
  const header = document.getElementById("siteHeader");
  const onScroll = () => {
    if (window.scrollY > 12) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function applyBoardMeta() {
  const m = BOARD_META[state.board];
  document.title = `${m.title} · AMIJOB`;
  els.eyebrow.textContent = m.eyebrow;
  els.title.textContent = m.title;
  els.desc.textContent = m.desc;
  els.tabs.querySelectorAll("a").forEach((a) => {
    a.classList.toggle("active", a.dataset.board === state.board);
  });
}

function setupSupabase() {
  const cfg = window.AMIJOB_SUPABASE || {};
  const ok =
    cfg.url &&
    cfg.anonKey &&
    !cfg.url.includes("YOUR-PROJECT-REF") &&
    !cfg.anonKey.includes("YOUR-ANON") &&
    window.supabase;

  if (!ok) {
    state.configured = false;
    showNotice(
      `⚙️ 게시판이 아직 설정되지 않았습니다.<br />` +
        `<code>supabase-config.js</code>에 Supabase URL과 anon 키를 입력한 뒤 배포하면 게시판이 활성화됩니다.`
    );
    els.writeBtn.disabled = true;
    els.writeBtn.style.opacity = ".5";
    els.writeBtn.style.cursor = "not-allowed";
    return;
  }
  state.sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  state.configured = true;
}

function showNotice(html) {
  els.notice.hidden = false;
  els.notice.innerHTML = html;
}

/* ---------- 목록 ---------- */
async function loadList() {
  const from = state.page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await state.sb
    .from("posts")
    .select("id,board,title,nickname,views,created_at", { count: "exact" })
    .eq("board", state.board)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    showNotice(`목록을 불러오지 못했습니다: ${escape(error.message)}`);
    return;
  }
  state.total = count || 0;
  renderList(data || []);
  renderPagination();
}

function renderList(posts) {
  els.count.innerHTML = `총 <strong>${state.total}</strong>건`;
  els.list.innerHTML = "";
  els.empty.hidden = posts.length > 0;

  posts.forEach((p) => {
    const row = document.createElement("div");
    row.className = "post-row";
    row.setAttribute("role", "row");
    row.tabIndex = 0;
    row.innerHTML = `
      <span class="col-no">${p.id}</span>
      <span class="col-title">${escape(p.title)}</span>
      <span class="col-author">${escape(p.nickname)}</span>
      <span class="col-views">${p.views}</span>
      <span class="col-date">${formatDate(p.created_at)}</span>`;
    row.addEventListener("click", () => openView(p.id));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter") openView(p.id);
    });
    els.list.appendChild(row);
  });
}

function renderPagination() {
  const pages = Math.ceil(state.total / PAGE_SIZE);
  els.pagination.innerHTML = "";
  if (pages <= 1) return;

  const mk = (label, page, opts = {}) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.className = "page-btn" + (opts.active ? " active" : "");
    b.disabled = !!opts.disabled;
    if (!opts.disabled && !opts.active) b.addEventListener("click", () => { state.page = page; loadList(); window.scrollTo({ top: 0, behavior: "smooth" }); });
    if (opts.active) b.classList.add("active");
    return b;
  };

  els.pagination.appendChild(mk("‹", state.page - 1, { disabled: state.page === 0 }));
  for (let i = 0; i < pages; i++) {
    els.pagination.appendChild(mk(String(i + 1), i, { active: i === state.page }));
  }
  els.pagination.appendChild(mk("›", state.page + 1, { disabled: state.page >= pages - 1 }));
}

/* ---------- 글 보기 ---------- */
async function openView(id) {
  const { data: post, error } = await state.sb
    .from("posts")
    .select("id,board,title,content,nickname,views,created_at,updated_at")
    .eq("id", id)
    .single();
  if (error || !post) {
    alert("게시글을 불러오지 못했습니다.");
    return;
  }
  state.sb.rpc("increment_views", { p_id: id }); // fire & forget

  renderView(post);
  showModal();
  loadComments(id);
}

function renderView(post) {
  els.modalContent.innerHTML = `
    <article class="post-view">
      <span class="post-badge">${state.board === "consult" ? "상담게시판" : "채용이야기"}</span>
      <h3 class="post-view-title">${escape(post.title)}</h3>
      <div class="post-view-meta">
        <span>✍️ ${escape(post.nickname)}</span>
        <span>🕒 ${formatDate(post.created_at, true)}</span>
        <span>👁️ ${post.views + 1}</span>
      </div>
      <div class="post-view-body">${escape(post.content).replace(/\n/g, "<br />")}</div>
      <div class="post-view-actions">
        <button class="link-btn" data-act="edit">수정</button>
        <button class="link-btn danger" data-act="delete">삭제</button>
      </div>

      <section class="comments" id="comments">
        <h4 class="comments-title">댓글 <span id="commentCount">0</span></h4>
        <div id="commentList" class="comment-list"></div>
        <form id="commentForm" class="comment-form">
          <div class="cf-row">
            <input type="text" id="cNickname" placeholder="닉네임" maxlength="30" required />
            <input type="password" id="cPassword" placeholder="비밀번호(4자+)" minlength="4" required />
          </div>
          <div class="cf-row">
            <textarea id="cContent" placeholder="댓글을 입력하세요" maxlength="2000" required rows="2"></textarea>
            <button class="btn btn-primary" type="submit">등록</button>
          </div>
        </form>
      </section>
    </article>`;

  els.modalContent.querySelector('[data-act="edit"]').addEventListener("click", () => openForm("edit", post));
  els.modalContent.querySelector('[data-act="delete"]').addEventListener("click", () => handleDeletePost(post.id));
  els.modalContent.querySelector("#commentForm").addEventListener("submit", (e) => {
    e.preventDefault();
    handleCreateComment(post.id);
  });
}

/* ---------- 글 작성 / 수정 ---------- */
function openForm(mode, post = null) {
  const isEdit = mode === "edit";
  els.modalContent.innerHTML = `
    <form class="post-form" id="postForm">
      <h3 class="form-title">${isEdit ? "글 수정" : "글쓰기"}</h3>
      <label class="field">
        <span>제목</span>
        <input type="text" id="fTitle" maxlength="200" required value="${isEdit ? escape(post.title) : ""}" />
      </label>
      <div class="field-grid">
        <label class="field">
          <span>닉네임</span>
          <input type="text" id="fNickname" maxlength="30" ${isEdit ? "disabled" : "required"} value="${isEdit ? escape(post.nickname) : ""}" />
        </label>
        <label class="field">
          <span>비밀번호 ${isEdit ? "(작성 시 입력한 비밀번호)" : "(4자 이상)"}</span>
          <input type="password" id="fPassword" minlength="4" required />
        </label>
      </div>
      <label class="field">
        <span>내용</span>
        <textarea id="fContent" rows="10" maxlength="20000" required>${isEdit ? escape(post.content) : ""}</textarea>
      </label>
      <div class="form-actions">
        <button type="button" class="btn btn-ghost" data-close>취소</button>
        <button type="submit" class="btn btn-primary">${isEdit ? "수정 완료" : "등록"}</button>
      </div>
      <p class="form-err" id="formErr" hidden></p>
    </form>`;

  showModal();
  els.modalContent.querySelector("[data-close]").addEventListener("click", closeModal);
  els.modalContent.querySelector("#postForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (isEdit) handleUpdatePost(post.id);
    else handleCreatePost();
  });
}

async function handleCreatePost() {
  const title = val("#fTitle");
  const nickname = val("#fNickname");
  const password = val("#fPassword");
  const content = val("#fContent");
  if (!title || !nickname || !content) return;

  const { error } = await state.sb.rpc("create_post", {
    p_board: state.board,
    p_nickname: nickname,
    p_password: password,
    p_title: title,
    p_content: content,
  });
  if (error) return formErr(error.message);
  closeModal();
  state.page = 0;
  loadList();
}

async function handleUpdatePost(id) {
  const title = val("#fTitle");
  const content = val("#fContent");
  const password = val("#fPassword");
  const { data, error } = await state.sb.rpc("update_post", {
    p_id: id,
    p_password: password,
    p_title: title,
    p_content: content,
  });
  if (error) return formErr(error.message);
  if (data !== true) return formErr("비밀번호가 일치하지 않습니다.");
  closeModal();
  loadList();
}

async function handleDeletePost(id) {
  const password = prompt("글을 삭제하려면 비밀번호를 입력하세요.");
  if (password === null) return;
  const { data, error } = await state.sb.rpc("delete_post", { p_id: id, p_password: password });
  if (error) return alert("삭제 실패: " + error.message);
  if (data !== true) return alert("비밀번호가 일치하지 않습니다.");
  closeModal();
  loadList();
}

/* ---------- 댓글 ---------- */
async function loadComments(postId) {
  const { data, error } = await state.sb
    .from("comments")
    .select("id,post_id,nickname,content,created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) return;

  const listEl = document.getElementById("commentList");
  const countEl = document.getElementById("commentCount");
  if (!listEl) return;
  countEl.textContent = (data || []).length;
  listEl.innerHTML = "";
  (data || []).forEach((c) => {
    const div = document.createElement("div");
    div.className = "comment-item";
    div.innerHTML = `
      <div class="comment-head">
        <span class="comment-author">${escape(c.nickname)}</span>
        <span class="comment-date muted small">${formatDate(c.created_at, true)}</span>
        <button class="comment-del" title="삭제" aria-label="댓글 삭제">×</button>
      </div>
      <div class="comment-body">${escape(c.content).replace(/\n/g, "<br />")}</div>`;
    div.querySelector(".comment-del").addEventListener("click", () => handleDeleteComment(c.id, postId));
    listEl.appendChild(div);
  });
}

async function handleCreateComment(postId) {
  const nickname = val("#cNickname");
  const password = val("#cPassword");
  const content = val("#cContent");
  if (!nickname || !password || !content) return;
  const { error } = await state.sb.rpc("create_comment", {
    p_post_id: postId,
    p_nickname: nickname,
    p_password: password,
    p_content: content,
  });
  if (error) return alert("댓글 등록 실패: " + error.message);
  val("#cContent", "");
  loadComments(postId);
}

async function handleDeleteComment(id, postId) {
  const password = prompt("댓글을 삭제하려면 비밀번호를 입력하세요.");
  if (password === null) return;
  const { data, error } = await state.sb.rpc("delete_comment", { p_id: id, p_password: password });
  if (error) return alert("삭제 실패: " + error.message);
  if (data !== true) return alert("비밀번호가 일치하지 않습니다.");
  loadComments(postId);
}

/* ---------- Modal ---------- */
function showModal() {
  els.modal.hidden = false;
  els.modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  els.modal.hidden = true;
  els.modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

/* ---------- Utils ---------- */
function val(sel, set) {
  const el = els.modalContent.querySelector(sel);
  if (!el) return "";
  if (set !== undefined) { el.value = set; return set; }
  return el.value.trim();
}
function formErr(msg) {
  const e = document.getElementById("formErr");
  if (e) { e.hidden = false; e.textContent = "⚠️ " + msg; }
}
function formatDate(iso, withTime = false) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const pad = (n) => String(n).padStart(2, "0");
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (sameDay && !withTime) return hm;
  const ymd = `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  return withTime ? `${ymd} ${hm}` : ymd;
}
function escape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
