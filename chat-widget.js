/* =========================================================
   AMIJOB 챗봇 위젯
   - Supabase Edge Function('chat')을 통해 OpenAI 호출
   - data.json 을 읽어 공고 컨텍스트로 함께 전달 (공고 Q&A)
   - 의존성 없음: supabase-config.js + chat-widget.css 만 있으면 동작
   포함 방법(각 페이지 </body> 직전):
     <script src="supabase-config.js"></script>
     <link  rel="stylesheet" href="chat-widget.css" />  (head 권장)
     <script src="chat-widget.js"></script>
   ========================================================= */
(function () {
  "use strict";

  var GREETING =
    "안녕하세요! AMIJOB 채용 도우미예요. 🙌\n공고 검색이나 지원·면접 같은 채용 고민, 무엇이든 물어보세요.";
  var SUGGESTIONS = [
    "마감 임박한 공고 알려줘",
    "대전 지역 신입 공고 있어?",
    "자기소개서 어떻게 쓰지?",
  ];

  var state = {
    messages: [], // {role:'user'|'assistant', content}
    jobs: null, // 공고 컨텍스트 (data.json에서 1회 로드)
    lastUpdated: null,
    busy: false,
  };

  var el = {}; // DOM 캐시

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    injectDom();
    loadJobs(); // 비동기로 공고 컨텍스트 준비 (실패해도 일반 상담은 가능)
    renderGreeting();
  }

  // ---- 공고 컨텍스트 로드 ----
  function loadJobs() {
    fetch("./data.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        state.lastUpdated = data.lastUpdated || null;
        state.jobs = (data.jobs || []).map(function (j) {
          return {
            organization: j.organization,
            title: j.title,
            field: j.field,
            location: j.location,
            career: j.career,
            headcount: j.headcount,
            openDate: j.openDate,
            closeDate: j.closeDate,
            summary: j.summary,
          };
        });
      })
      .catch(function () { /* 공고 컨텍스트 없이도 동작 */ });
  }

  // ---- DOM 구성 ----
  function injectDom() {
    var root = document.createElement("div");
    root.className = "amijob-chat";
    root.innerHTML =
      '<button class="amijob-chat__toggle" type="button" aria-label="채용 도우미 열기" aria-expanded="false">' +
        '<svg class="icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
        '<svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      "</button>" +
      '<section class="amijob-chat__panel" role="dialog" aria-label="AMIJOB 채용 도우미" hidden>' +
        '<header class="amijob-chat__header"><span class="dot"></span>' +
          "<div><h3>AMIJOB 채용 도우미</h3><p>AMI 공고 안내 · 채용 상담</p></div>" +
        "</header>" +
        '<div class="amijob-chat__body" id="amijobChatBody" aria-live="polite"></div>' +
        '<form class="amijob-chat__form" id="amijobChatForm">' +
          '<textarea class="amijob-chat__input" id="amijobChatInput" rows="1" placeholder="메시지를 입력하세요…" aria-label="메시지 입력"></textarea>' +
          '<button class="amijob-chat__send" id="amijobChatSend" type="submit" aria-label="전송">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
          "</button>" +
        "</form>" +
        '<div class="amijob-chat__foot">AI 답변은 참고용이며, 실제 지원은 ALIO 공식 공고를 확인하세요.</div>' +
      "</section>";
    document.body.appendChild(root);

    el.root = root;
    el.toggle = root.querySelector(".amijob-chat__toggle");
    el.panel = root.querySelector(".amijob-chat__panel");
    el.body = root.querySelector("#amijobChatBody");
    el.form = root.querySelector("#amijobChatForm");
    el.input = root.querySelector("#amijobChatInput");
    el.send = root.querySelector("#amijobChatSend");

    el.toggle.addEventListener("click", togglePanel);
    el.form.addEventListener("submit", onSubmit);
    el.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(e); }
    });
    el.input.addEventListener("input", autoGrow);
  }

  function togglePanel() {
    var open = el.root.classList.toggle("is-open");
    el.panel.hidden = !open;
    el.toggle.setAttribute("aria-expanded", String(open));
    el.toggle.setAttribute("aria-label", open ? "채용 도우미 닫기" : "채용 도우미 열기");
    if (open) setTimeout(function () { el.input.focus(); }, 120);
  }

  function autoGrow() {
    el.input.style.height = "auto";
    el.input.style.height = Math.min(el.input.scrollHeight, 96) + "px";
  }

  // ---- 렌더링 ----
  function renderGreeting() {
    addBubble("bot", GREETING);
    var chips = document.createElement("div");
    chips.className = "amijob-chat__chips";
    SUGGESTIONS.forEach(function (q) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "amijob-chat__chip";
      b.textContent = q;
      b.addEventListener("click", function () {
        if (state.busy) return;
        el.input.value = q;
        onSubmit(new Event("submit"));
      });
      chips.appendChild(b);
    });
    el.body.appendChild(chips);
  }

  function addBubble(kind, text) {
    var div = document.createElement("div");
    div.className = "amijob-chat__msg amijob-chat__msg--" + kind;
    div.textContent = text;
    el.body.appendChild(div);
    scrollDown();
    return div;
  }

  function addTyping() {
    var div = document.createElement("div");
    div.className = "amijob-chat__msg amijob-chat__msg--bot";
    div.innerHTML = '<span class="amijob-chat__typing"><span></span><span></span><span></span></span>';
    el.body.appendChild(div);
    scrollDown();
    return div;
  }

  function scrollDown() { el.body.scrollTop = el.body.scrollHeight; }

  // ---- 전송 ----
  function onSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (state.busy) return;

    var text = el.input.value.trim();
    if (!text) return;

    el.input.value = "";
    autoGrow();
    addBubble("user", text);
    state.messages.push({ role: "user", content: text });

    sendToServer();
  }

  function setBusy(b) {
    state.busy = b;
    el.send.disabled = b;
    el.input.disabled = b;
  }

  function sendToServer() {
    var cfg = window.AMIJOB_SUPABASE;
    if (!cfg || !cfg.url || !cfg.anonKey || /YOUR_|<.*>/.test(cfg.url)) {
      addBubble("error", "챗봇이 아직 설정되지 않았어요. (Supabase 연결 정보 필요)");
      return;
    }

    setBusy(true);
    var typing = addTyping();

    fetch(cfg.url.replace(/\/$/, "") + "/functions/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg.anonKey,
        "apikey": cfg.anonKey,
      },
      body: JSON.stringify({
        messages: state.messages,
        jobs: state.jobs,
        lastUpdated: state.lastUpdated,
      }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        typing.remove();
        if (!res.ok || !res.d || res.d.error) {
          addBubble("error", (res.d && res.d.error) || "답변을 받지 못했어요. 잠시 후 다시 시도해 주세요.");
          return;
        }
        var reply = res.d.reply || "";
        addBubble("bot", reply);
        state.messages.push({ role: "assistant", content: reply });
      })
      .catch(function () {
        typing.remove();
        addBubble("error", "네트워크 오류로 답변을 받지 못했어요.");
      })
      .finally(function () {
        setBusy(false);
        el.input.focus();
      });
  }
})();
