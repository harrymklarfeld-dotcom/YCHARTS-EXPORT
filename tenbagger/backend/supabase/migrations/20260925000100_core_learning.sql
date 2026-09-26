-- Tenbagger Phase 3 — core learning tables (profiles, lesson_progress, daily_activity).
--
-- Conventions
--   * Every table in `public` has Row Level Security ENABLED. A user can only see
--     rows whose user_id = auth.uid().
--   * We explicitly REVOKE the broad grants Supabase gives anon/authenticated on
--     new tables and then GRANT only what each role needs (defense in depth:
--     table privileges AND RLS must both allow an operation).
--   * Gamification counters (xp, streak, hearts) are NOT writable by clients
--     directly; they change only through SECURITY DEFINER RPCs that validate input.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text check (display_name is null or char_length(display_name) between 1 and 60),
  timezone       text not null default 'UTC' check (char_length(timezone) <= 64),
  daily_xp_goal  integer not null default 20 check (daily_xp_goal between 1 and 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- lesson_progress: one aggregate row per user
-- ---------------------------------------------------------------------------
create table public.lesson_progress (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  xp                 integer not null default 0 check (xp >= 0),
  streak_current     integer not null default 0 check (streak_current >= 0),
  streak_longest     integer not null default 0 check (streak_longest >= 0),
  last_active_date   date,
  hearts             integer not null default 5 check (hearts between 0 and 5),
  hearts_refilled_on date,
  completed_lessons  text[] not null default '{}',
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- daily_activity: one row per user per day (drives streak calendar)
-- ---------------------------------------------------------------------------
create table public.daily_activity (
  user_id            uuid not null references auth.users (id) on delete cascade,
  activity_date      date not null,
  xp_earned          integer not null default 0 check (xp_earned >= 0),
  lessons_completed  integer not null default 0 check (lessons_completed >= 0),
  primary key (user_id, activity_date)
);

-- ---------------------------------------------------------------------------
-- Privileges + RLS
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.daily_activity  enable row level security;

revoke all on public.profiles, public.lesson_progress, public.daily_activity from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, timezone, daily_xp_goal) on public.profiles to authenticated;
grant select on public.lesson_progress to authenticated;
grant select on public.daily_activity  to authenticated;
grant all on public.profiles, public.lesson_progress, public.daily_activity to service_role;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy lesson_progress_select_own on public.lesson_progress
  for select to authenticated using (user_id = auth.uid());

create policy daily_activity_select_own on public.daily_activity
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- New auth user -> profile + progress rows
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.lesson_progress (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPC: record_lesson_completion — the only way XP / streak change
-- ---------------------------------------------------------------------------
create or replace function public.record_lesson_completion(
  p_lesson_id     text,
  p_xp            integer,
  p_activity_date date default null
)
returns public.lesson_progress
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_day  date := coalesce(p_activity_date, current_date);
  v_row  public.lesson_progress;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_lesson_id is null or p_lesson_id !~ '^[a-z0-9][a-z0-9-]{0,63}$' then
    raise exception 'invalid lesson id' using errcode = '22023';
  end if;
  if p_xp is null or p_xp < 0 or p_xp > 100 then
    raise exception 'xp out of range' using errcode = '22023';
  end if;
  -- Client supplies its local calendar day; allow +/- 1 day around server UTC date
  -- so users in any timezone get correct streaks, but no back-filling.
  if v_day < current_date - 1 or v_day > current_date + 1 then
    raise exception 'activity date out of range' using errcode = '22023';
  end if;

  insert into public.lesson_progress (user_id) values (v_uid) on conflict do nothing;

  select * into v_row from public.lesson_progress where user_id = v_uid for update;

  if v_row.last_active_date is null or v_row.last_active_date < v_day - 1 then
    v_row.streak_current := 1;
  elsif v_row.last_active_date = v_day - 1 then
    v_row.streak_current := v_row.streak_current + 1;
  end if; -- same day (or a late-arriving earlier day): streak unchanged

  update public.lesson_progress set
    xp                = xp + p_xp,
    streak_current    = v_row.streak_current,
    streak_longest    = greatest(streak_longest, v_row.streak_current),
    last_active_date  = greatest(coalesce(last_active_date, v_day), v_day),
    completed_lessons = case when p_lesson_id = any(completed_lessons)
                             then completed_lessons
                             else array_append(completed_lessons, p_lesson_id) end,
    updated_at        = now()
  where user_id = v_uid
  returning * into v_row;

  insert into public.daily_activity (user_id, activity_date, xp_earned, lessons_completed)
  values (v_uid, v_day, p_xp, 1)
  on conflict (user_id, activity_date) do update
    set xp_earned = daily_activity.xp_earned + excluded.xp_earned,
        lessons_completed = daily_activity.lessons_completed + 1;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: spend_heart — lose a heart on a wrong answer; refills to 5 once per day
-- ---------------------------------------------------------------------------
create or replace function public.spend_heart()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hearts integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.lesson_progress (user_id) values (v_uid) on conflict do nothing;
  update public.lesson_progress set
    hearts = greatest(
      (case when hearts_refilled_on is distinct from current_date then 5 else hearts end) - 1, 0),
    hearts_refilled_on = current_date,
    updated_at = now()
  where user_id = v_uid
  returning hearts into v_hearts;
  return v_hearts;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.record_lesson_completion(text, integer, date) from public, anon;
revoke all on function public.spend_heart() from public, anon;
grant execute on function public.record_lesson_completion(text, integer, date) to authenticated;
grant execute on function public.spend_heart() to authenticated;
