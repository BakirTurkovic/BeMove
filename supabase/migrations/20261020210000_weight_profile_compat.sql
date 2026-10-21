-- Keep the requested weight/profile column names compatible with BeMove's
-- existing target_weight_kg, calorie_goal, weight_kg, and logged_at queries.

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

alter table public.profiles add column if not exists target_weight numeric(5, 1);
alter table public.profiles add column if not exists target_weight_kg numeric(5, 1) not null default 115;
alter table public.profiles add column if not exists calories_target integer;
alter table public.profiles add column if not exists calorie_goal integer not null default 2200;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

update public.profiles
set target_weight = coalesce(target_weight, target_weight_kg, 115),
    target_weight_kg = coalesce(target_weight_kg, target_weight, 115),
    calories_target = coalesce(calories_target, calorie_goal, 2200),
    calorie_goal = coalesce(calorie_goal, calories_target, 2200);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weight numeric(5, 1) not null,
  weight_kg numeric(5, 1) not null,
  date date not null default current_date,
  logged_at timestamptz not null default now()
);

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

alter table public.profiles enable row level security;
alter table public.weight_logs enable row level security;

drop policy if exists "Users manage their own profile" on public.profiles;
drop policy if exists "Korisnik upravlja svojim profilom" on public.profiles;
create policy "Users manage their own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users manage their own weight logs" on public.weight_logs;
drop policy if exists "Korisnik upravlja svojim zapisima težine" on public.weight_logs;
create policy "Users manage their own weight logs" on public.weight_logs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.profiles, public.weight_logs to authenticated;
notify pgrst, 'reload schema';
