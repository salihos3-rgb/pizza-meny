-- Kor i Supabase SQL Editor EFTER att live app.js anvander authTok.
-- Stanger varlden fran att lasa friend_req. Inloggade far lasa/skriva.

revoke all on table public.friend_req from anon;
revoke all on table public.friend_req from public;

grant select, insert on table public.friend_req to authenticated;

alter table public.friend_req enable row level security;

drop policy if exists friend_req_anon_all on public.friend_req;
drop policy if exists friend_req_select_auth on public.friend_req;
drop policy if exists friend_req_insert_auth on public.friend_req;

create policy friend_req_select_auth on public.friend_req
for select to authenticated
using (true);

create policy friend_req_insert_auth on public.friend_req
for insert to authenticated
with check (true);
