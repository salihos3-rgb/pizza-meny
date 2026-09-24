-- Pizza Meny – kör i Supabase SQL editor en gång
-- Krävs för riktig mejl-länk (Auth).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tagg text not null unique,
  email text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles
  for select using (true);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
