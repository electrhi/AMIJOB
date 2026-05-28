// =========================================================
// AMIJOB 챗봇 — Supabase Edge Function (OpenAI 프록시)
// ---------------------------------------------------------
// 정적 프론트엔드에서 OpenAI 키를 노출하지 않기 위한 서버 측 프록시.
// OPENAI_API_KEY 는 Supabase secret 으로만 보관한다.
//
//   배포:   supabase functions deploy chat --project-ref blbmdnygvoqyrovvlrrh
//   시크릿: supabase secrets set OPENAI_API_KEY=sk-...
//           (선택) supabase secrets set OPENAI_MODEL=gpt-4o-mini
//
// 요청  본문: { messages: [{role, content}], jobs?: [...], lastUpdated?: string }
// 응답  본문: { reply: string }  |  { error: string }
// =========================================================

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// 프론트가 보낸 공고 목록을 토큰 절약형 요약으로 변환
function summarizeJobs(jobs: unknown): string {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return "(현재 전달된 채용 공고 데이터가 없습니다.)";
  }
  const lines = jobs.slice(0, 60).map((j: Record<string, unknown>, i: number) => {
    const parts = [
      `${i + 1}. [${j.organization ?? "?"}] ${j.title ?? "?"}`,
      j.field ? `분야:${j.field}` : "",
      j.location ? `지역:${j.location}` : "",
      j.career ? `경력:${j.career}` : "",
      j.headcount ? `인원:${j.headcount}` : "",
      j.openDate || j.closeDate ? `접수:${j.openDate ?? "?"}~${j.closeDate ?? "?"}` : "",
      j.summary ? `요약:${j.summary}` : "",
    ].filter(Boolean);
    return parts.join(" · ");
  });
  return lines.join("\n");
}

function buildSystemPrompt(jobs: unknown, lastUpdated?: string): string {
  return [
    "당신은 'AMIJOB'의 채용 안내 도우미입니다. AMIJOB은 ALIO(공공기관 경영정보 공개시스템)의 공개 정보를 바탕으로",
    "한전KDN·한국전력공사 등 공공기관의 AMI(스마트미터링) 분야 채용 공고를 큐레이션하는 사이트입니다.",
    "",
    "역할:",
    "1) 아래 '현재 공고 목록'을 근거로 채용 공고 관련 질문(분야/지역/마감/인원/자격 등)에 정확히 답합니다.",
    "2) 자기소개서·면접·AMI 분야 진로 등 일반적인 채용/커리어 상담도 도와줍니다.",
    "",
    "지침:",
    "- 한국어로, 간결하고 친근하게 답합니다. 핵심부터 말하고 필요하면 목록을 씁니다.",
    "- 공고 사실 질문에는 반드시 아래 목록 데이터에만 근거하세요. 목록에 없는 공고를 지어내지 마세요.",
    "- 실제 지원·접수는 각 기관 공식 공고(ALIO)에서 확인하라고 안내하세요. 본 사이트는 ALIO/기관과 공식 관련이 없습니다.",
    "- 마감일·접수기간을 답할 때는 오늘 날짜 기준 임박 여부를 함께 알려주면 좋습니다.",
    "- 모르거나 데이터에 없으면 솔직히 모른다고 하고, 상담게시판 이용을 권유하세요.",
    "",
    lastUpdated ? `데이터 기준일: ${lastUpdated}` : "",
    `오늘 날짜: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "현재 공고 목록:",
    summarizeJobs(jobs),
  ].filter(Boolean).join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST만 허용됩니다." }, 405);

  if (!OPENAI_API_KEY) {
    return json({ error: "서버에 OPENAI_API_KEY가 설정되지 않았습니다." }, 500);
  }

  let payload: { messages?: unknown; jobs?: unknown; lastUpdated?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "잘못된 요청(JSON 파싱 실패)." }, 400);
  }

  const history = Array.isArray(payload.messages) ? payload.messages : [];
  // 사용자/어시스턴트 메시지만 추려 최근 12개로 제한 (토큰 보호)
  const safeHistory = history
    .filter((m: Record<string, unknown>) =>
      (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    )
    .slice(-12);

  if (safeHistory.length === 0) {
    return json({ error: "메시지가 비어 있습니다." }, 400);
  }

  const messages = [
    { role: "system", content: buildSystemPrompt(payload.jobs, payload.lastUpdated) },
    ...safeHistory,
  ];

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 700,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      console.error("OpenAI error:", resp.status, detail);
      return json({ error: `OpenAI 호출 실패 (${resp.status})` }, 502);
    }

    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!reply) return json({ error: "빈 응답을 받았습니다." }, 502);

    return json({ reply });
  } catch (e) {
    console.error("Unhandled:", e);
    return json({ error: "요청 처리 중 오류가 발생했습니다." }, 500);
  }
});
