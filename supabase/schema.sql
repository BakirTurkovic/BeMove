-- BeMove fitness schema.
-- Safe to run in the Supabase SQL Editor on a new or existing BeMove database.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  target_weight_kg numeric(5, 1) not null default 115 check (target_weight_kg between 25 and 400),
  calorie_goal integer not null default 2200 check (calorie_goal between 500 and 10000),
  starting_weight_kg numeric(5, 1) check (starting_weight_kg between 25 and 400),
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists target_weight_kg numeric(5, 1) not null default 115;
alter table public.profiles add column if not exists target_weight numeric(5, 1);
alter table public.profiles add column if not exists calorie_goal integer not null default 2200;
alter table public.profiles add column if not exists calories_target integer;
alter table public.profiles add column if not exists starting_weight_kg numeric(5, 1);
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

update public.profiles
set target_weight = coalesce(target_weight, target_weight_kg, 115),
    target_weight_kg = coalesce(target_weight_kg, target_weight, 115),
    calories_target = coalesce(calories_target, calorie_goal, 2200),
    calorie_goal = coalesce(calorie_goal, calories_target, 2200);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null default current_date,
  weight numeric(5, 1),
  calories_target integer not null default 2200 check (calories_target between 500 and 10000),
  water_intake numeric(5, 2) not null default 0 check (water_intake >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  meal_name text not null,
  calories integer not null check (calories between 0 and 10000),
  protein_g integer not null default 0 check (protein_g between 0 and 1000),
  protein numeric(7, 2) not null default 0 check (protein >= 0),
  carbs numeric(7, 2) not null default 0 check (carbs >= 0),
  fats numeric(7, 2) not null default 0 check (fats >= 0),
  weight_g numeric(7, 2) not null default 0 check (weight_g >= 0),
  meal_date date not null default current_date,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.meals add column if not exists meal_name text;
alter table public.meals add column if not exists protein numeric(7, 2) not null default 0;
alter table public.meals add column if not exists carbs numeric(7, 2) not null default 0;
alter table public.meals add column if not exists fats numeric(7, 2) not null default 0;
alter table public.meals add column if not exists weight_g numeric(7, 2) not null default 0;
alter table public.meals add column if not exists created_at timestamptz default now();
update public.meals set meal_name = coalesce(nullif(meal_name, ''), name);
update public.meals set created_at = now() where created_at is null;
alter table public.meals alter column created_at set default now();
alter table public.meals alter column created_at set not null;
alter table public.meals alter column meal_name set default 'Obrok';
alter table public.meals alter column meal_name set not null;

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  date date not null default current_date,
  duration_minutes integer not null check (duration_minutes between 1 and 600),
  notes text,
  category text not null default 'Hibridni'
    check (category in ('MMA', 'Hibridni', 'Snaga', 'Kardio')),
  calories_burned integer not null default 0 check (calories_burned between 0 and 10000),
  -- Retained for compatibility with workouts created before this schema update.
  name text,
  workout_date date,
  created_at timestamptz not null default now()
);

alter table public.workouts add column if not exists title text;
alter table public.workouts add column if not exists date date;
alter table public.workouts add column if not exists duration_minutes integer not null default 1;
alter table public.workouts add column if not exists notes text;
alter table public.workouts add column if not exists category text not null default 'Hibridni';
alter table public.workouts add column if not exists calories_burned integer not null default 0;
alter table public.workouts add column if not exists name text;
alter table public.workouts add column if not exists workout_date date;
alter table public.workouts add column if not exists created_at timestamptz not null default now();

update public.workouts
set title = coalesce(nullif(title, ''), nullif(name, ''), 'Trening'),
    date = coalesce(date, workout_date, current_date),
    name = coalesce(nullif(name, ''), nullif(title, ''), 'Trening'),
    workout_date = coalesce(workout_date, date, current_date);
update public.workouts set created_at = now() where created_at is null;
alter table public.workouts alter column created_at set default now();
alter table public.workouts alter column created_at set not null;

alter table public.workouts alter column title set default 'Trening';
alter table public.workouts alter column title set not null;
alter table public.workouts alter column date set default current_date;
alter table public.workouts alter column date set not null;

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (category in ('grudi', 'leđa', 'noge', 'ramena', 'ruke', 'abs')),
  created_at timestamptz not null default now()
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid references public.workouts (id) on delete cascade,
  exercise_id uuid references public.exercises (id) on delete restrict,
  workout_exercise_id uuid references public.workout_exercises (id) on delete cascade,
  set_number integer not null check (set_number > 0),
  weight numeric(7, 2) not null default 0 check (weight >= 0),
  weight_kg numeric(7, 2) not null default 0 check (weight_kg >= 0),
  reps integer not null check (reps > 0),
  constraint workout_sets_format_check check (
    (workout_exercise_id is not null and workout_id is null and exercise_id is null)
    or (workout_exercise_id is null and workout_id is not null)
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weight numeric(5, 1),
  date date,
  weight_kg numeric(5, 1) not null check (weight_kg between 25 and 400),
  logged_at timestamptz not null default now()
);

create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  hours_slept numeric not null check (hours_slept >= 0 and hours_slept <= 24),
  quality text check (quality in ('poor', 'fair', 'good', 'excellent')),
  notes text,
  date date not null default current_date,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.step_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  step_count integer not null default 0 check (step_count >= 0),
  date date not null default current_date,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint unique_user_date_steps unique (user_id, date)
);

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  waist_cm numeric check (waist_cm > 0 and waist_cm <= 300),
  chest_cm numeric check (chest_cm > 0 and chest_cm <= 300),
  arm_cm numeric check (arm_cm > 0 and arm_cm <= 300),
  hips_cm numeric check (hips_cm > 0 and hips_cm <= 300),
  thigh_cm numeric check (thigh_cm > 0 and thigh_cm <= 300),
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create unique index if not exists step_logs_user_date_unique_idx
  on public.step_logs (user_id, date);

alter table public.weight_logs add column if not exists weight numeric(5, 1);
alter table public.weight_logs add column if not exists date date;
alter table public.weight_logs add column if not exists weight_kg numeric(5, 1);
alter table public.weight_logs add column if not exists logged_at timestamptz not null default now();

update public.weight_logs
set weight = coalesce(weight, weight_kg),
    weight_kg = coalesce(weight_kg, weight),
    date = coalesce(date, logged_at::date, current_date);

alter table public.weight_logs alter column weight set not null;
alter table public.weight_logs alter column weight_kg set not null;
alter table public.weight_logs alter column date set default current_date;
alter table public.weight_logs alter column date set not null;

create or replace function public.sync_profile_weight_aliases()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.target_weight := coalesce(new.target_weight, new.target_weight_kg, 115);
    new.target_weight_kg := coalesce(new.target_weight_kg, new.target_weight, 115);
    new.calories_target := coalesce(new.calories_target, new.calorie_goal, 2200);
    new.calorie_goal := coalesce(new.calorie_goal, new.calories_target, 2200);
  elsif new.target_weight is distinct from old.target_weight then
    new.target_weight_kg := new.target_weight;
  elsif new.target_weight_kg is distinct from old.target_weight_kg then
    new.target_weight := new.target_weight_kg;
  end if;

  if tg_op = 'UPDATE' then
    if new.calories_target is distinct from old.calories_target then
      new.calorie_goal := new.calories_target;
    elsif new.calorie_goal is distinct from old.calorie_goal then
      new.calories_target := new.calorie_goal;
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists sync_profile_weight_aliases on public.profiles;
create trigger sync_profile_weight_aliases
  before insert or update on public.profiles
  for each row execute function public.sync_profile_weight_aliases();

create or replace function public.sync_weight_log_aliases()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.weight := coalesce(new.weight, new.weight_kg);
    new.weight_kg := coalesce(new.weight_kg, new.weight);
    new.date := coalesce(new.date, new.logged_at::date, current_date);
  else
    if new.weight is distinct from old.weight then
      new.weight_kg := new.weight;
    elsif new.weight_kg is distinct from old.weight_kg then
      new.weight := new.weight_kg;
    end if;

    if new.date is distinct from old.date then
      new.logged_at := new.date::timestamp at time zone 'UTC';
    elsif new.logged_at is distinct from old.logged_at then
      new.date := new.logged_at::date;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_weight_log_aliases on public.weight_logs;
create trigger sync_weight_log_aliases
  before insert or update on public.weight_logs
  for each row execute function public.sync_weight_log_aliases();

create index if not exists daily_logs_user_date_idx on public.daily_logs (user_id, date desc);
create index if not exists meals_user_date_idx on public.meals (user_id, meal_date);
create index if not exists workouts_user_date_idx on public.workouts (user_id, date);
create index if not exists exercises_user_category_idx on public.exercises (user_id, category);
create index if not exists workout_sets_workout_idx on public.workout_sets (workout_id, set_number);
create index if not exists workout_exercises_workout_idx on public.workout_exercises (workout_id, created_at);
create index if not exists workout_sets_workout_exercise_idx on public.workout_sets (workout_exercise_id, set_number);
create index if not exists weight_logs_user_logged_idx on public.weight_logs (user_id, logged_at desc);
create index if not exists sleep_logs_user_date_idx on public.sleep_logs (user_id, date desc);
create index if not exists step_logs_user_date_idx on public.step_logs (user_id, date desc);
create index if not exists body_measurements_user_date_idx
  on public.body_measurements (user_id, date desc, created_at desc);

alter table public.profiles enable row level security;
alter table public.daily_logs enable row level security;
alter table public.meals enable row level security;
alter table public.workouts enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.weight_logs enable row level security;
alter table public.sleep_logs enable row level security;
alter table public.step_logs enable row level security;
alter table public.body_measurements enable row level security;

drop policy if exists "Users manage their own profile" on public.profiles;
drop policy if exists "Korisnik upravlja svojim profilom" on public.profiles;
create policy "Users manage their own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users manage their own daily logs" on public.daily_logs;
create policy "Users manage their own daily logs" on public.daily_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own meals" on public.meals;
create policy "Users manage their own meals" on public.meals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own workouts" on public.workouts;
create policy "Users manage their own workouts" on public.workouts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users read public and own exercises" on public.exercises;
create policy "Users read public and own exercises" on public.exercises
  for select to authenticated
  using (user_id is null or (select auth.uid()) = user_id);
drop policy if exists "Anyone reads public exercises" on public.exercises;
create policy "Anyone reads public exercises" on public.exercises
  for select to anon
  using (user_id is null);
drop policy if exists "Users create their own exercises" on public.exercises;
create policy "Users create their own exercises" on public.exercises
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users update their own exercises" on public.exercises;
create policy "Users update their own exercises" on public.exercises
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users delete their own exercises" on public.exercises;
create policy "Users delete their own exercises" on public.exercises
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users manage own workout_exercises" on public.workout_exercises;
create policy "Users manage own workout_exercises" on public.workout_exercises
  for all to authenticated
  using (exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.user_id = (select auth.uid())
  ));

drop policy if exists "Users read their own workout sets" on public.workout_sets;
drop policy if exists "Users create their own workout sets" on public.workout_sets;
drop policy if exists "Users update their own workout sets" on public.workout_sets;
drop policy if exists "Users delete their own workout sets" on public.workout_sets;
drop policy if exists "Users manage own workout sets" on public.workout_sets;
create policy "Users manage own workout sets" on public.workout_sets
  for all to authenticated
  using (
    (workout_exercise_id is not null
      and workout_id is null
      and exercise_id is null
      and exists (
      select 1 from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id and w.user_id = (select auth.uid())
    ))
    or (workout_exercise_id is null
      and workout_id is not null
      and exists (
        select 1 from public.workouts w
        where w.id = workout_id and w.user_id = (select auth.uid())
      )
      and (
        exercise_id is null
        or exists (
          select 1 from public.exercises e
          where e.id = exercise_id and (e.user_id is null or e.user_id = (select auth.uid()))
        )
      ))
  )
  with check (
    (workout_exercise_id is not null
      and workout_id is null
      and exercise_id is null
      and exists (
      select 1 from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id and w.user_id = (select auth.uid())
    ))
    or (workout_exercise_id is null
      and workout_id is not null
      and exists (
        select 1 from public.workouts w
        where w.id = workout_id and w.user_id = (select auth.uid())
      )
      and (
        exercise_id is null
        or exists (
          select 1 from public.exercises e
          where e.id = exercise_id and (e.user_id is null or e.user_id = (select auth.uid()))
        )
      ))
  );

drop policy if exists "Users manage their own weight logs" on public.weight_logs;
drop policy if exists "Korisnik upravlja svojim zapisima težine" on public.weight_logs;
create policy "Users manage their own weight logs" on public.weight_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own sleep logs" on public.sleep_logs;
drop policy if exists "Korisnik upravlja svojim zapisima sna" on public.sleep_logs;
create policy "Users manage their own sleep logs" on public.sleep_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage own steps" on public.step_logs;
drop policy if exists "Korisnik upravlja svojim zapisima koraka" on public.step_logs;
create policy "Users manage own steps" on public.step_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Korisnik upravlja svojim mjerenjima obima" on public.body_measurements;
create policy "Korisnik upravlja svojim mjerenjima obima" on public.body_measurements
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.profiles, public.daily_logs, public.meals,
  public.workouts, public.exercises, public.workout_exercises, public.workout_sets, public.weight_logs, public.sleep_logs,
  public.step_logs, public.body_measurements to authenticated;
grant select on public.exercises to anon;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

notify pgrst, 'reload schema';
