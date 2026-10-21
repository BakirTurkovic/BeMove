create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  hours_slept numeric not null check (hours_slept >= 0 and hours_slept <= 24),
  quality text check (quality in ('poor', 'fair', 'good', 'excellent')),
  notes text,
  date date not null default current_date,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists sleep_logs_user_date_idx
  on public.sleep_logs (user_id, date desc);

alter table public.sleep_logs enable row level security;

drop policy if exists "Users manage their own sleep logs" on public.sleep_logs;
drop policy if exists "Korisnik upravlja svojim zapisima sna" on public.sleep_logs;
create policy "Users manage their own sleep logs" on public.sleep_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.sleep_logs to authenticated;
notify pgrst, 'reload schema';
