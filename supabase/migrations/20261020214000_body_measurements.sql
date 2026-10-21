create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade not null,
  waist_cm numeric check (waist_cm > 0 and waist_cm <= 300),
  chest_cm numeric check (chest_cm > 0 and chest_cm <= 300),
  arm_cm numeric check (arm_cm > 0 and arm_cm <= 300),
  hips_cm numeric check (hips_cm > 0 and hips_cm <= 300),
  thigh_cm numeric check (thigh_cm > 0 and thigh_cm <= 300),
  date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.body_measurements
  add column if not exists waist_cm numeric,
  add column if not exists chest_cm numeric,
  add column if not exists arm_cm numeric,
  add column if not exists hips_cm numeric,
  add column if not exists thigh_cm numeric,
  add column if not exists date date not null default current_date,
  add column if not exists created_at timestamptz not null default now();

create index if not exists body_measurements_user_date_idx
  on public.body_measurements (user_id, date desc, created_at desc);

alter table public.body_measurements enable row level security;

drop policy if exists "Korisnik upravlja svojim mjerenjima obima" on public.body_measurements;
create policy "Korisnik upravlja svojim mjerenjima obima"
  on public.body_measurements
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.body_measurements to authenticated;
notify pgrst, 'reload schema';
