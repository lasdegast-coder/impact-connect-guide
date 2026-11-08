-- Programmes and alumni: what the guide can recommend.
--
-- Google Sheets stay the source of truth. An Apps Script in Impact Connect's Google account sends
-- the rows to the sync server function, which checks every value and then calls
-- public.apply_sync() below. Nobody changes these tables by hand or from the website.

-- True when a text contains something that looks like an email address or a phone number
-- (at least 9 digits, optionally separated by spaces, dots, dashes or brackets).
-- The sync function uses the same two patterns (supabase/functions/sync/validate.ts).
create function public.has_contact_details(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(value, '') ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
      or coalesce(value, '') ~ '(\+|00)?[0-9]([\s().-]*[0-9]){8,}';
$$;


-- Programmes: the Programmes Database (details) joined with the Catalogue sheet (tags).
create table public.programmes (
  id text primary key check (id ~ '^[A-Z]+-[0-9]+$'),   -- the catalogue ID, for example IDP-01
  name text not null check (btrim(name) <> ''),
  source_tab text not null,                             -- tab in the Programmes Database
  type text not null,                                   -- for example "Summer school"

  -- Details from the Programmes Database
  description text,
  one_liner text,
  url text check (url ~ '^https?://\S+$'),
  sign_up text,                                         -- "Sign up date" as written in the sheet
  deadline_details text,                                -- "Sign-up deadline" as written in the sheet
  duration text,
  location_details text,                                -- for example "Texel, NL"
  costs_details text,                                   -- for example "EUR 650"
  host text,                                            -- host university of a summer school

  -- Tags from the Catalogue sheet
  main_field text not null,
  other_fields text[] not null default '{}',
  topics text[] not null default '{}',
  ways_of_contributing text[] not null default '{}',
  skills text[] not null default '{}',
  experience_level smallint not null check (experience_level between 1 and 3),
  hours_per_week text,
  costs text not null,                                  -- Free, Costs money, Paid or Free (prize money)
  languages text[] not null check (cardinality(languages) > 0),
  location text not null,                               -- Netherlands, Utrecht, Online, ...
  deadline_status text not null,                        -- Open, Rolling, Closed, Not announced or Unknown
  next_deadline date,
  good_fit_for text not null,

  synced_at timestamptz not null default now()
);

alter table public.programmes enable row level security;

-- Signed-in students and staff can read programmes; visitors who are not signed in cannot.
-- Nobody changes them through the website: only the sync (service role) writes.
revoke all on table public.programmes from anon, authenticated;
grant select on table public.programmes to authenticated;
grant select, insert, update, delete on table public.programmes to service_role;

create policy "Signed-in users can read programmes"
  on public.programmes
  for select
  to authenticated
  using (true);


-- Alumni: only alumni who gave permission to be contacted by a student.
-- There are deliberately no columns for phone numbers or email addresses, and a check refuses
-- any text that looks like one.
create table public.alumni (
  id uuid primary key default gen_random_uuid(),
  responded_at timestamptz not null unique,             -- when they filled in the form ("Tijdstempel")
  full_name text not null check (btrim(full_name) <> ''),
  bachelor text,
  master text,
  current_occupation text,
  previous_occupation text,
  fields_of_interest text,
  linkedin_url text check (linkedin_url ~ '^https://([a-z0-9-]+\.)*linkedin\.com/\S*$'),
  synced_at timestamptz not null default now(),

  constraint alumni_no_contact_details check (
    not public.has_contact_details(full_name)
    and not public.has_contact_details(bachelor)
    and not public.has_contact_details(master)
    and not public.has_contact_details(current_occupation)
    and not public.has_contact_details(previous_occupation)
    and not public.has_contact_details(fields_of_interest)
  )
);

alter table public.alumni enable row level security;

-- Only staff can read alumni directly. Students will only see the one or two alumni the guide
-- recommends to them (built in a later phase). Nobody changes alumni through the website.
revoke all on table public.alumni from anon, authenticated;
grant select on table public.alumni to authenticated;
grant select, insert, update, delete on table public.alumni to service_role;

create policy "Staff can read alumni"
  on public.alumni
  for select
  to authenticated
  using ((select public.is_staff()));


-- Makes the two tables match the rows the sync function checked, in one transaction: either
-- everything is saved or nothing is. Rows that are no longer sent are removed, so an alumnus
-- whose permission is withdrawn disappears at the next sync.
create function public.apply_sync(new_programmes jsonb, new_alumni jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  current_programmes integer;
  removed_programmes integer;
begin
  if jsonb_typeof(new_programmes) is distinct from 'array'
     or jsonb_typeof(new_alumni) is distinct from 'array' then
    raise exception 'apply_sync expects two JSON arrays';
  end if;

  -- One sync at a time. Reading stays possible while a sync runs.
  lock table public.programmes, public.alumni in exclusive mode;

  -- Every alumnus must have given permission. The sync function has checked this already;
  -- this is the second lock on the door.
  if exists (
    select 1 from jsonb_array_elements(new_alumni) as alumnus
    where alumnus -> 'consent' is distinct from 'true'::jsonb
  ) then
    raise exception 'Refused: an alumnus without permission was sent. Nothing was changed.';
  end if;

  -- Protect the app against a broken sheet: never remove more than half of the programmes in
  -- one go. (Alumni are not protected this way: removing them must always be possible.)
  select count(*) into current_programmes from public.programmes;
  select count(*) into removed_programmes
  from public.programmes as existing
  where not exists (
    select 1 from jsonb_array_elements(new_programmes) as incoming
    where incoming ->> 'id' = existing.id
  );
  if removed_programmes > current_programmes / 2.0 then
    raise exception 'Refused: this sync would remove % of the % programmes. Nothing was changed.',
      removed_programmes, current_programmes
      using hint = 'Check the Programmes Database and the Catalogue for a renamed column or tab.';
  end if;

  delete from public.programmes as existing
  where not exists (
    select 1 from jsonb_array_elements(new_programmes) as incoming
    where incoming ->> 'id' = existing.id
  );

  insert into public.programmes (
    id, name, source_tab, type,
    description, one_liner, url, sign_up, deadline_details, duration, location_details,
    costs_details, host,
    main_field, other_fields, topics, ways_of_contributing, skills, experience_level,
    hours_per_week, costs, languages, location, deadline_status, next_deadline, good_fit_for,
    synced_at
  )
  select
    id, name, source_tab, type,
    description, one_liner, url, sign_up, deadline_details, duration, location_details,
    costs_details, host,
    main_field, coalesce(other_fields, '{}'), coalesce(topics, '{}'),
    coalesce(ways_of_contributing, '{}'), coalesce(skills, '{}'), experience_level,
    hours_per_week, costs, languages, location, deadline_status, next_deadline, good_fit_for,
    now()
  from jsonb_to_recordset(new_programmes) as incoming (
    id text, name text, source_tab text, type text,
    description text, one_liner text, url text, sign_up text, deadline_details text,
    duration text, location_details text, costs_details text, host text,
    main_field text, other_fields text[], topics text[], ways_of_contributing text[],
    skills text[], experience_level smallint, hours_per_week text, costs text,
    languages text[], location text, deadline_status text, next_deadline date,
    good_fit_for text
  )
  on conflict (id) do update set
    name = excluded.name,
    source_tab = excluded.source_tab,
    type = excluded.type,
    description = excluded.description,
    one_liner = excluded.one_liner,
    url = excluded.url,
    sign_up = excluded.sign_up,
    deadline_details = excluded.deadline_details,
    duration = excluded.duration,
    location_details = excluded.location_details,
    costs_details = excluded.costs_details,
    host = excluded.host,
    main_field = excluded.main_field,
    other_fields = excluded.other_fields,
    topics = excluded.topics,
    ways_of_contributing = excluded.ways_of_contributing,
    skills = excluded.skills,
    experience_level = excluded.experience_level,
    hours_per_week = excluded.hours_per_week,
    costs = excluded.costs,
    languages = excluded.languages,
    location = excluded.location,
    deadline_status = excluded.deadline_status,
    next_deadline = excluded.next_deadline,
    good_fit_for = excluded.good_fit_for,
    synced_at = excluded.synced_at;

  delete from public.alumni as existing
  where not exists (
    select 1 from jsonb_array_elements(new_alumni) as incoming
    where (incoming ->> 'responded_at')::timestamptz = existing.responded_at
  );

  insert into public.alumni (
    responded_at, full_name, bachelor, master, current_occupation, previous_occupation,
    fields_of_interest, linkedin_url, synced_at
  )
  select
    responded_at, full_name, bachelor, master, current_occupation, previous_occupation,
    fields_of_interest, linkedin_url, now()
  from jsonb_to_recordset(new_alumni) as incoming (
    responded_at timestamptz, full_name text, bachelor text, master text,
    current_occupation text, previous_occupation text, fields_of_interest text,
    linkedin_url text
  )
  on conflict (responded_at) do update set
    full_name = excluded.full_name,
    bachelor = excluded.bachelor,
    master = excluded.master,
    current_occupation = excluded.current_occupation,
    previous_occupation = excluded.previous_occupation,
    fields_of_interest = excluded.fields_of_interest,
    linkedin_url = excluded.linkedin_url,
    synced_at = excluded.synced_at;

  return jsonb_build_object(
    'programmes', (select count(*) from public.programmes),
    'alumni', (select count(*) from public.alumni)
  );
end;
$$;

-- Only the sync server function (service role) may run the sync or use the helper.
revoke all on function public.apply_sync(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_sync(jsonb, jsonb) to service_role;

revoke all on function public.has_contact_details(text) from public, anon, authenticated;
grant execute on function public.has_contact_details(text) to service_role;
