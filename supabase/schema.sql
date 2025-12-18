-- BetSoccer Database Schema for Supabase

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (extends Supabase auth.users)
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text not null,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Matches table
create table public.matches (
  id uuid default uuid_generate_v4() primary key,
  external_id integer unique not null,
  competition text not null,
  competition_logo text,
  season text not null,
  home_team text not null,
  home_team_logo text,
  away_team text not null,
  away_team_logo text,
  kickoff_utc timestamp with time zone not null,
  venue text,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED')),
  home_score integer,
  away_score integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Predictions table
create table public.predictions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  match_id uuid references public.matches(id) on delete cascade not null,
  home_score integer not null check (home_score >= 0),
  away_score integer not null check (away_score >= 0),
  points integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, match_id)
);

-- Indexes for performance
create index idx_matches_kickoff on public.matches(kickoff_utc);
create index idx_matches_status on public.matches(status);
create index idx_matches_external_id on public.matches(external_id);
create index idx_predictions_user_id on public.predictions(user_id);
create index idx_predictions_match_id on public.predictions(match_id);

-- Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

-- Users policies
create policy "Users can view all users"
  on public.users for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.users for update
  to authenticated
  using (auth.uid() = id);

-- Matches policies (everyone can read)
create policy "Anyone can view matches"
  on public.matches for select
  to authenticated
  using (true);

-- Service role can manage matches (for sync)
create policy "Service role can manage matches"
  on public.matches for all
  to service_role
  using (true);

-- Predictions policies
create policy "Users can view all predictions"
  on public.predictions for select
  to authenticated
  using (true);

create policy "Users can create own predictions"
  on public.predictions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own predictions before kickoff"
  on public.predictions for update
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches
      where matches.id = predictions.match_id
      and matches.kickoff_utc > now()
    )
  );

create policy "Users can delete own predictions before kickoff"
  on public.predictions for delete
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches
      where matches.id = predictions.match_id
      and matches.kickoff_utc > now()
    )
  );

-- Functions

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Update timestamp function
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger update_users_updated_at
  before update on public.users
  for each row execute procedure public.update_updated_at();

create trigger update_matches_updated_at
  before update on public.matches
  for each row execute procedure public.update_updated_at();

create trigger update_predictions_updated_at
  before update on public.predictions
  for each row execute procedure public.update_updated_at();

-- Calculate points when match finishes
create or replace function public.calculate_prediction_points()
returns trigger as $$
begin
  if new.status = 'FINISHED' and new.home_score is not null and new.away_score is not null then
    update public.predictions
    set points = case
      when home_score = new.home_score and away_score = new.away_score then 1
      else 0
    end
    where match_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_match_finished
  after update on public.matches
  for each row
  when (old.status != 'FINISHED' and new.status = 'FINISHED')
  execute procedure public.calculate_prediction_points();

-- View for standings
create or replace view public.standings as
select
  u.id as user_id,
  u.display_name,
  u.avatar_url,
  coalesce(sum(p.points), 0)::integer as total_points,
  count(p.id)::integer as total_predictions,
  coalesce(sum(case when p.points = 1 then 1 else 0 end), 0)::integer as correct_predictions,
  case
    when count(p.id) > 0 then
      round((sum(case when p.points = 1 then 1 else 0 end)::numeric / count(p.id)::numeric) * 100, 1)
    else 0
  end as accuracy
from public.users u
left join public.predictions p on u.id = p.user_id and p.points is not null
group by u.id, u.display_name, u.avatar_url
order by total_points desc, correct_predictions desc, total_predictions asc;
