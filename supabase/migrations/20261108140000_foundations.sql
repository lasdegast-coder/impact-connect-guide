-- Foundations: who counts as staff.
-- Staff may later read transcripts and use the staff page; row level security policies in
-- later migrations call public.is_staff().

create table public.staff (
  email text primary key check (email = lower(email)),
  added_at timestamptz not null default now()
);

alter table public.staff enable row level security;

-- Nobody reads or changes the staff list from the website. Only server functions (which use
-- the service role) and the Supabase dashboard can.
revoke all on table public.staff from anon, authenticated;

-- True when the signed-in user's email address is on the staff list.
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;
