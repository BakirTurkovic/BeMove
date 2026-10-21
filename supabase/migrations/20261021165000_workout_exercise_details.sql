create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid references public.workouts (id) on delete cascade not null,
  exercise_name text not null,
  created_at timestamptz not null default now()
);

alter table public.workout_sets
  add column if not exists workout_exercise_id uuid references public.workout_exercises (id) on delete cascade,
  add column if not exists weight_kg numeric;

update public.workout_sets
set weight_kg = coalesce(weight_kg, weight, 0)
where weight_kg is null;

alter table public.workout_sets
  alter column workout_id drop not null,
  alter column exercise_id drop not null,
  alter column weight_kg set default 0,
  alter column weight_kg set not null,
  alter column set_number set default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.workout_sets'::regclass
      and conname = 'workout_sets_format_check'
  ) then
    alter table public.workout_sets
      add constraint workout_sets_format_check
      check (
        (workout_exercise_id is not null and workout_id is null and exercise_id is null)
        or (workout_exercise_id is null and workout_id is not null)
      );
  end if;
end $$;

create index if not exists workout_exercises_workout_idx
  on public.workout_exercises (workout_id, created_at);

create index if not exists workout_sets_workout_exercise_idx
  on public.workout_sets (workout_exercise_id, set_number);

alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;

drop policy if exists "Users manage own workout_exercises" on public.workout_exercises;
create policy "Users manage own workout_exercises"
  on public.workout_exercises
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
create policy "Users manage own workout sets"
  on public.workout_sets
  for all to authenticated
  using (
    (workout_exercise_id is not null
      and workout_id is null
      and exercise_id is null
      and exists (
      select 1
      from public.workout_exercises we
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
      select 1
      from public.workout_exercises we
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

grant select, insert, update, delete on public.workout_exercises, public.workout_sets to authenticated;
notify pgrst, 'reload schema';
