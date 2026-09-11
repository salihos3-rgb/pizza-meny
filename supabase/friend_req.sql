-- Run once in Supabase SQL
create table if not exists public.friend_req (
  id uuid primary key default gen_random_uuid(),
  from_tagg text not null,
  to_tagg text not null,
  status text not null default 'van',
  created_at timestamptz not null default now()
);
alter table public.friend_req enable row level security;
grant select, insert on public.friend_req to anon, authenticated;
drop policy if exists "read friend_req" on public.friend_req;
create policy "read friend_req" on public.friend_req for select to anon, authenticated using (true);
drop policy if exists "insert friend_req" on public.friend_req;
create policy "insert friend_req" on public.friend_req for insert to anon, authenticated with check (
  status in ('van','van_ok','van_no')
  and from_tagg ~ '^[a-z0-9_]{3,20}$'
  and to_tagg ~ '^[a-z0-9_]{3,20}$'
);
