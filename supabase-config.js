/* =========================================================
   AMIJOB 게시판 — Supabase 연결 설정
   ---------------------------------------------------------
   Supabase 프로젝트 → 좌측 "Project Settings" → "API" 에서
   아래 두 값을 복사해 넣으세요.

     · Project URL      → url
     · anon public key  → anonKey   (이 키는 공개돼도 안전합니다)

   ⚠️ service_role 키는 절대 여기에 넣지 마세요. (서버 전용)
   값을 채운 뒤 commit/push 하면 배포 사이트의 게시판이 동작합니다.
   ========================================================= */
window.AMIJOB_SUPABASE = {
  url: "https://YOUR-PROJECT-REF.supabase.co",
  anonKey: "YOUR-ANON-PUBLIC-KEY",
};
