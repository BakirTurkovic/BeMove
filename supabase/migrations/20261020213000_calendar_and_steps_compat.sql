-- Ensure the calendar and dashboard have every column their queries use,
-- while preserving older BeMove profile, meal, workout, and weight schemas.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  target_weight numeric(5, 1),
  target_weight_kg numeric(5, 1) not null default 115,
  calories_target integer,
  calorie_goal integer not null default 2200,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  starting_weight_kg numeric(5, 1)
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists target_weight numeric(5, 1);
alter table public.profiles add column if not exists target_weight_kg numeric(5, 1) not null default 115;
alter table public.profiles add column if not exists calories_target integer;
alter table public.profiles add column if not exists calorie_goal integer not null default 2200;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists starting_weight_kg numeric(5, 1);
update public.profiles
set target_weight = coalesce(target_weight, target_weight_kg, 115),
    target_weight_kg = coalesce(target_weight_kg, target_weight, 115),
    calories_target = coalesce(calories_target, calorie_goal, 2200),
    calorie_goal = coalesce(calorie_goal, calories_target, 2200);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Obrok',
  meal_name text not null default 'Obrok',
  calories integer not null default 0,
  protein_g integer not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fats numeric not null default 0,
  weight_g numeric,
  image_url text,
  meal_date date not null default current_date,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.meals add column if not exists name text default 'Obrok';
alter table public.meals add column if not exists meal_name text default 'Obrok';
alter table public.meals add column if not exists calories integer not null default 0;
alter table public.meals add column if not exists protein_g integer not null default 0;
alter table public.meals add column if not exists protein numeric not null default 0;
alter table public.meals add column if not exists carbs numeric not null default 0;
alter table public.meals add column if not exists fats numeric not null default 0;
alter table public.meals add column if not exists weight_g numeric;
alter table public.meals add column if not exists image_url text;
alter table public.meals add column if not exists meal_date date not null default current_date;
alter table public.meals add column if not exists is_favorite boolean not null default false;
alter table public.meals add column if not exists created_at timestamptz not null default now();
update public.meals
set name = coalesce(nullif(name, ''), nullif(meal_name, ''), 'Obrok'),
    meal_name = coalesce(nullif(meal_name, ''), nullif(name, ''), 'Obrok'),
    protein = coalesce(protein, protein_g, 0),
    protein_g = coalesce(protein_g, round(protein)::integer, 0);
alter table public.meals alter column name set not null;
alter table public.meals alter column meal_name set not null;

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Trening',
  name text,
  date date not null default current_date,
  workout_date date,
  duration_minutes integer not null default 1,
  category text not null default 'Hibridni',
  calories_burned integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.workouts add column if not exists title text default 'Trening';
alter table public.workouts add column if not exists name text;
alter table public.workouts add column if not exists date date not null default current_date;
alter table public.workouts add column if not exists workout_date date;
alter table public.workouts add column if not exists duration_minutes integer not null default 1;
alter table public.workouts add column if not exists category text not null default 'Hibridni';
alter table public.workouts add column if not exists calories_burned integer not null default 0;
alter table public.workouts add column if not exists notes text;
alter table public.workouts add column if not exists created_at timestamptz not null default now();
update public.workouts
set title = coalesce(nullif(title, ''), nullif(name, ''), 'Trening'),
    name = coalesce(nullif(name, ''), nullif(title, ''), 'Trening'),
    date = coalesce(date, workout_date, current_date),
    workout_date = coalesce(workout_date, date, current_date);
alter table public.workouts alter column title set not null;

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weight numeric(5, 1) not null,
  weight_kg numeric(5, 1) not null,
  date date not null default current_date,
  logged_at timestamptz not null default now()
);

alter table public.weight_logs add column if not exists weight numeric(5, 1);
alter table public.weight_logs add column if not exists weight_kg numeric(5, 1);
alter table public.weight_logs add column if not exists date date;
alter table public.weight_logs add column if not exists logged_at timestamptz not null default now();
update public.weight_logs
set weight = coalesce(weight, weight_kg),
    weight_kg = coalesce(weight_kg, weight),
    date = coalesce(date, logged_at::date, current_date);
alter table public.weight_logs alter column weight set not null;
alter table public.weight_logs alter column weight_kg set not null;
alter table public.weight_logs alter column date set default current_date;
alter table public.weight_logs alter column date set not null;

create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  hours_slept numeric not null check (hours_slept >= 0 and hours_slept <= 24),
  quality text check (quality in ('poor', 'fair', 'good', 'excellent')),
  notes text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.step_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  step_count integer not null default 0 check (step_count >= 0),
  date date not null default current_date,
  created_at timestamptz not null default now(),
  constraint unique_user_date_steps unique (user_id, date)
);

create unique index if not exists step_logs_user_date_unique_idx
  on public.step_logs (user_id, date);

create index if not exists meals_user_date_idx on public.meals (user_id, meal_date);
create index if not exists workouts_user_date_idx on public.workouts (user_id, date);
create index if not exists weight_logs_user_date_idx on public.weight_logs (user_id, date desc);
create index if not exists sleep_logs_user_date_idx on public.sleep_logs (user_id, date desc);

alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.workouts enable row level security;
alter table public.weight_logs enable row level security;
alter table public.sleep_logs enable row level security;
alter table public.step_logs enable row level security;

drop policy if exists "Users manage own profile" on public.profiles;
drop policy if exists "Users manage their own profile" on public.profiles;
create policy "Users manage own profile" on public.profiles
  for all to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users manage own meals" on public.meals;
drop policy if exists "Users manage their own meals" on public.meals;
create policy "Users manage own meals" on public.meals
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own workouts" on public.workouts;
drop policy if exists "Users manage their own workouts" on public.workouts;
create policy "Users manage own workouts" on public.workouts
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own weight" on public.weight_logs;
drop policy if exists "Users manage their own weight logs" on public.weight_logs;
create policy "Users manage own weight" on public.weight_logs
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own sleep" on public.sleep_logs;
drop policy if exists "Users manage their own sleep logs" on public.sleep_logs;
create policy "Users manage own sleep" on public.sleep_logs
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own steps" on public.step_logs;
drop policy if exists "Korisnik upravlja svojim zapisima koraka" on public.step_logs;
create policy "Users manage own steps" on public.step_logs
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.profiles, public.meals, public.workouts,
  public.weight_logs, public.sleep_logs, public.step_logs to authenticated;
notify pgrst, 'reload schema';
