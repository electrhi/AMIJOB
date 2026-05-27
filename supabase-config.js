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
  url: "https://blbmdnygvoqyrovvlrrh.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsYm1kbnlndm9xeXJvdnZscnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MTU4NTUsImV4cCI6MjA5NTM5MTg1NX0.s4bns7R6vzjNJggya-g4qD5uxNNtCvX4oJUVpL2aMmg",
};
