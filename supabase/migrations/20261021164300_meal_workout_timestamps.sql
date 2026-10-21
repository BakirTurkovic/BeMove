alter table public.meals
  add column if not exists created_at timestamptz default now();

update public.meals
set created_at = now()
where created_at is null;

alter table public.meals
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.workouts
  add column if not exists created_at timestamptz default now();

update public.workouts
set created_at = now()
where created_at is null;

alter table public.workouts
  alter column created_at set default now(),
  alter column created_at set not null;

create index if not exists meals_user_created_at_idx
  on public.meals (user_id, created_at desc);

create index if not exists workouts_user_created_at_idx
  on public.workouts (user_id, created_at desc);

notify pgrst, 'reload schema';
