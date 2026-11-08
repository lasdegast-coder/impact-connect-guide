begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

select has_table('public', 'staff', 'the staff table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.staff'::regclass),
  'row level security is on for the staff table'
);

insert into public.staff (email) values ('staff@example.org');

-- A signed-in student
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "email": "student@example.org", "role": "authenticated"}';

select is(public.is_staff(), false, 'a student is not staff');
select throws_ok(
  'select * from public.staff',
  '42501',
  null,
  'a student cannot read the staff list'
);

-- A signed-in staff member, typing their address with capitals
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "email": "Staff@Example.org", "role": "authenticated"}';

select is(public.is_staff(), true, 'a staff member is recognised, regardless of capitals');

-- Someone who is not signed in
reset role;
set local role anon;
select throws_ok(
  'select public.is_staff()',
  '42501',
  null,
  'a visitor who is not signed in cannot call is_staff'
);

select * from finish();
rollback;
