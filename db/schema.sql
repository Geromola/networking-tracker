-- Networking Tracker — schema, constraints, and Row Level Security.
-- Paste this whole file into the Neon SQL Editor and run it once.
--
-- Three independent layers protect this table, so a bug in any one of them is
-- not enough to leak or corrupt data:
--   1. CHECK constraints  — reject malformed rows no matter who writes them
--   2. RLS policies       — decide which rows a signed-in user may touch
--   3. GRANTs             — decide which roles may reach the table at all

create extension if not exists pgcrypto;

drop table if exists contacts cascade;

create table contacts (
  id         uuid primary key default gen_random_uuid(),

  -- Ownership is assigned by the database, never by the client. auth.user_id()
  -- reads the `sub` claim out of the JWT on the current Data API request, so a
  -- row cannot be created on behalf of somebody else even if the API layer is
  -- compromised or bypassed entirely.
  user_id    text not null default (auth.user_id()),

  -- btrim before the length check: "   " is an empty name, not a 3-char one.
  name       text not null check (length(btrim(name)) > 0 and length(name) <= 200),
  company    text check (length(company) <= 200),
  role       text check (length(role) <= 200),
  where_met  text check (length(where_met) <= 300),
  notes      text check (length(notes) <= 5000),

  priority   text not null default 'medium'
               check (priority in ('high', 'medium', 'low')),

  -- Sorting by the priority text would order high, low, medium (alphabetical).
  -- This stored column gives the Data API a column that sorts by real urgency.
  priority_rank int generated always as (
    case priority when 'high' then 1 when 'medium' then 2 else 3 end
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every list query is "my contacts, in some order", so lead the index with user_id.
create index contacts_user_priority_idx
  on contacts (user_id, priority_rank, created_at desc);
create index contacts_user_name_idx on contacts (user_id, name);

-- Keep updated_at honest even if a client tries to set it itself.
create or replace function set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger contacts_set_updated_at
  before update on contacts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table contacts enable row level security;

-- Four separate policies, one per operation, each scoped to the `authenticated`
-- role. USING filters the rows you are allowed to see or act on; WITH CHECK
-- validates the row you are trying to leave behind.

create policy contacts_select on contacts
  for select to authenticated
  using (auth.user_id() = user_id);

-- WITH CHECK only: there is no existing row to filter on an insert.
create policy contacts_insert on contacts
  for insert to authenticated
  with check (auth.user_id() = user_id);

-- Both clauses are required, and they do different jobs. USING stops you from
-- editing someone else's row. WITH CHECK stops you from taking a row you own
-- and rewriting user_id to hand it to somebody else.
create policy contacts_update on contacts
  for update to authenticated
  using (auth.user_id() = user_id)
  with check (auth.user_id() = user_id);

create policy contacts_delete on contacts
  for delete to authenticated
  using (auth.user_id() = user_id);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete on contacts to authenticated;

-- The anonymous role backs any request that arrives without a valid JWT.
-- It must not be able to reach this table at all.
revoke all on contacts from anonymous;
