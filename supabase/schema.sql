-- =========================================================
-- AMIJOB 게시판 — Supabase 스키마
-- ---------------------------------------------------------
-- 적용 방법:
--   1) Supabase 프로젝트 → 좌측 메뉴 "SQL Editor"
--   2) "New query"에 이 파일 내용을 통째로 붙여넣고 "Run"
--
-- 설계 요약(익명 + 닉네임/비밀번호):
--   · 글/댓글은 누구나 읽을 수 있음 (RLS SELECT 정책 = true)
--   · 비밀번호는 평문 저장하지 않고 bcrypt 해시(pgcrypto crypt)로 저장
--   · 글쓰기/수정/삭제는 테이블에 직접 못 하고, 비밀번호를 검증하는
--     RPC 함수(SECURITY DEFINER)로만 가능 → anon 키가 노출돼도 안전
--   · password_hash 컬럼은 클라이언트가 조회할 수 없도록 GRANT에서 제외
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------- 테이블 ----------------------
create table if not exists public.posts (
  id            bigint generated always as identity primary key,
  board         text   not null check (board in ('consult', 'story')),
  title         text   not null check (char_length(title) between 1 and 200),
  content       text   not null check (char_length(content) between 1 and 20000),
  nickname      text   not null check (char_length(nickname) between 1 and 30),
  password_hash text   not null,
  views         int    not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.comments (
  id            bigint generated always as identity primary key,
  post_id       bigint not null references public.posts(id) on delete cascade,
  nickname      text   not null check (char_length(nickname) between 1 and 30),
  content       text   not null check (char_length(content) between 1 and 2000),
  password_hash text   not null,
  created_at    timestamptz not null default now()
);

create index if not exists posts_board_created_idx on public.posts (board, created_at desc);
create index if not exists comments_post_idx on public.comments (post_id, created_at);

-- ---------------------- RLS ----------------------
alter table public.posts    enable row level security;
alter table public.comments enable row level security;

-- 읽기는 모두 허용 (쓰기 정책은 없음 → 직접 INSERT/UPDATE/DELETE 차단)
drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all" on public.posts for select using (true);

drop policy if exists "comments_select_all" on public.comments;
create policy "comments_select_all" on public.comments for select using (true);

-- ---------------------- 컬럼 권한 ----------------------
-- password_hash는 클라이언트가 읽지 못하도록 SELECT 권한에서 제외
revoke all on public.posts    from anon, authenticated;
revoke all on public.comments from anon, authenticated;

grant select (id, board, title, content, nickname, views, created_at, updated_at)
  on public.posts to anon, authenticated;
grant select (id, post_id, nickname, content, created_at)
  on public.comments to anon, authenticated;

-- ---------------------- RPC 함수 ----------------------
-- 글 작성
create or replace function public.create_post(
  p_board text, p_nickname text, p_password text, p_title text, p_content text
) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare new_id bigint;
begin
  if p_board not in ('consult', 'story') then
    raise exception '잘못된 게시판입니다.';
  end if;
  if char_length(coalesce(p_password, '')) < 4 then
    raise exception '비밀번호는 4자 이상이어야 합니다.';
  end if;
  insert into public.posts (board, nickname, password_hash, title, content)
  values (p_board, p_nickname, crypt(p_password, gen_salt('bf')), p_title, p_content)
  returning id into new_id;
  return new_id;
end; $$;

-- 글 수정 (비밀번호 일치 시)
create or replace function public.update_post(
  p_id bigint, p_password text, p_title text, p_content text
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare ok boolean;
begin
  select (password_hash = crypt(p_password, password_hash)) into ok
    from public.posts where id = p_id;
  if ok is not true then return false; end if;
  update public.posts
    set title = p_title, content = p_content, updated_at = now()
    where id = p_id;
  return true;
end; $$;

-- 글 삭제 (비밀번호 일치 시)
create or replace function public.delete_post(
  p_id bigint, p_password text
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare ok boolean;
begin
  select (password_hash = crypt(p_password, password_hash)) into ok
    from public.posts where id = p_id;
  if ok is not true then return false; end if;
  delete from public.posts where id = p_id;
  return true;
end; $$;

-- 댓글 작성
create or replace function public.create_comment(
  p_post_id bigint, p_nickname text, p_password text, p_content text
) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare new_id bigint;
begin
  if char_length(coalesce(p_password, '')) < 4 then
    raise exception '비밀번호는 4자 이상이어야 합니다.';
  end if;
  insert into public.comments (post_id, nickname, password_hash, content)
  values (p_post_id, p_nickname, crypt(p_password, gen_salt('bf')), p_content)
  returning id into new_id;
  return new_id;
end; $$;

-- 댓글 삭제 (비밀번호 일치 시)
create or replace function public.delete_comment(
  p_id bigint, p_password text
) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare ok boolean;
begin
  select (password_hash = crypt(p_password, password_hash)) into ok
    from public.comments where id = p_id;
  if ok is not true then return false; end if;
  delete from public.comments where id = p_id;
  return true;
end; $$;

-- 조회수 증가
create or replace function public.increment_views(p_id bigint)
returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.posts set views = views + 1 where id = p_id;
$$;

-- ---------------------- 함수 실행 권한 ----------------------
grant execute on function public.create_post(text, text, text, text, text)   to anon, authenticated;
grant execute on function public.update_post(bigint, text, text, text)        to anon, authenticated;
grant execute on function public.delete_post(bigint, text)                    to anon, authenticated;
grant execute on function public.create_comment(bigint, text, text, text)     to anon, authenticated;
grant execute on function public.delete_comment(bigint, text)                 to anon, authenticated;
grant execute on function public.increment_views(bigint)                      to anon, authenticated;
