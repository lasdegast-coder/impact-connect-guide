begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

-- The tables and their security rules
select has_table('public', 'programmes', 'the programmes table exists');
select has_table('public', 'alumni', 'the alumni table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.programmes'::regclass),
  'row level security is on for programmes'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.alumni'::regclass),
  'row level security is on for alumni'
);
select is_empty(
  $$ select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'alumni'
       and column_name ~* '(phone|mail|tel|contact)' $$,
  'the alumni table has no column for phone numbers or email addresses'
);
select ok(
  not has_function_privilege('anon', 'public.apply_sync(jsonb, jsonb)', 'execute'),
  'a visitor cannot run the sync'
);
select ok(
  not has_function_privilege('authenticated', 'public.apply_sync(jsonb, jsonb)', 'execute'),
  'a signed-in student or staff member cannot run the sync'
);
select ok(
  has_function_privilege('service_role', 'public.apply_sync(jsonb, jsonb)', 'execute'),
  'the sync server function can run the sync'
);

insert into public.staff (email) values ('staff@example.org');

-- The sync server function (service role) saves two programmes and two alumni
set local role service_role;
select lives_ok(
  $$ select public.apply_sync(
    '[{"id": "TST-01", "name": "Test programme", "source_tab": "Volunteer work",
       "type": "Volunteering", "main_field": "Nature & Biodiversity", "experience_level": 1,
       "costs": "Free", "languages": ["English", "Dutch"], "location": "Utrecht",
       "deadline_status": "Rolling", "good_fit_for": "Students who like testing.",
       "topics": ["rewilding", "gis"], "next_deadline": "2026-11-16"},
      {"id": "TST-02", "name": "Second programme", "source_tab": "Summer School Programmes",
       "type": "Summer school", "main_field": "Water & Oceans", "experience_level": 3,
       "costs": "Costs money", "languages": ["English"], "location": "Netherlands",
       "deadline_status": "Not announced", "good_fit_for": "Master students."}]',
    '[{"responded_at": "2026-09-02T09:27:44Z", "consent": true, "full_name": "Test Alumna",
       "current_occupation": "Policy advisor", "linkedin_url": "https://www.linkedin.com/in/test"},
      {"responded_at": "2026-09-02T10:04:34Z", "consent": true, "full_name": "Test Alumnus"}]'
  ) $$,
  'the sync saves programmes and alumni'
);
select is(
  (select languages from public.programmes where id = 'TST-01'),
  array['English', 'Dutch'],
  'lists such as languages are saved as lists'
);

-- A visitor who is not signed in
reset role;
set local role anon;
select throws_ok('select * from public.programmes', '42501', null, 'a visitor cannot read programmes');
select throws_ok('select * from public.alumni', '42501', null, 'a visitor cannot read alumni');

-- A signed-in student
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "email": "student@example.org", "role": "authenticated"}';

select is((select count(*) from public.programmes), 2::bigint, 'a student can read programmes');
select is_empty('select * from public.alumni', 'a student cannot see alumni');
select throws_ok(
  $$ insert into public.programmes (id, name, source_tab, type, main_field, experience_level,
       costs, languages, location, deadline_status, good_fit_for)
     values ('TST-03', 'Made up', 'Volunteer work', 'Volunteering', 'Water & Oceans', 1,
       'Free', '{English}', 'Utrecht', 'Rolling', 'Nobody') $$,
  '42501', null, 'a student cannot add programmes'
);
select throws_ok(
  $$ update public.programmes set name = 'Changed' $$, '42501', null,
  'a student cannot change programmes'
);
select throws_ok(
  $$ delete from public.programmes $$, '42501', null, 'a student cannot delete programmes'
);
select throws_ok(
  $$ insert into public.alumni (responded_at, full_name) values (now(), 'Made Up') $$,
  '42501', null, 'a student cannot add alumni'
);

-- A signed-in staff member
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "email": "staff@example.org", "role": "authenticated"}';

select is((select count(*) from public.alumni), 2::bigint, 'staff can read alumni');
select throws_ok(
  $$ update public.alumni set full_name = 'Changed' $$, '42501', null,
  'staff cannot change alumni (the sheet is the source of truth)'
);
select throws_ok(
  $$ delete from public.alumni $$, '42501', null, 'staff cannot delete alumni directly'
);

-- What the sync does with changes
reset role;
set local role service_role;

select lives_ok(
  $$ select public.apply_sync(
    '[{"id": "TST-01", "name": "Renamed programme", "source_tab": "Volunteer work",
       "type": "Volunteering", "main_field": "Nature & Biodiversity", "experience_level": 1,
       "costs": "Free", "languages": ["English"], "location": "Utrecht",
       "deadline_status": "Rolling", "good_fit_for": "Students who like testing."},
      {"id": "TST-02", "name": "Second programme", "source_tab": "Summer School Programmes",
       "type": "Summer school", "main_field": "Water & Oceans", "experience_level": 3,
       "costs": "Costs money", "languages": ["English"], "location": "Netherlands",
       "deadline_status": "Not announced", "good_fit_for": "Master students."}]',
    '[{"responded_at": "2026-09-02T09:27:44Z", "consent": true, "full_name": "Test Alumna"}]'
  ) $$,
  'a second sync runs'
);
select is(
  (select name from public.programmes where id = 'TST-01'),
  'Renamed programme',
  'the sync updates a changed programme'
);
select is(
  (select count(*) from public.alumni),
  1::bigint,
  'an alumnus who is no longer sent (for example, permission withdrawn) is removed'
);
select throws_ok(
  $$ select public.apply_sync(
    '[{"id": "TST-01", "name": "Renamed programme", "source_tab": "Volunteer work",
       "type": "Volunteering", "main_field": "Nature & Biodiversity", "experience_level": 1,
       "costs": "Free", "languages": ["English"], "location": "Utrecht",
       "deadline_status": "Rolling", "good_fit_for": "Students who like testing."}]',
    '[{"responded_at": "2026-09-03T08:00:00Z", "consent": false, "full_name": "No Permission"}]'
  ) $$,
  'P0001', null,
  'the sync refuses an alumnus without permission'
);
select throws_ok(
  $$ select public.apply_sync('[]', '[]') $$,
  'P0001', null,
  'the sync refuses to remove more than half of the programmes at once'
);

-- The alumni table itself refuses contact details
select throws_ok(
  $$ insert into public.alumni (responded_at, full_name, current_occupation)
     values ('2026-09-04T08:00:00Z', 'Someone', 'Mail me at someone@example.org') $$,
  '23514', null,
  'an email address in an alumni field is refused'
);
select throws_ok(
  $$ insert into public.alumni (responded_at, full_name, fields_of_interest)
     values ('2026-09-04T09:00:00Z', 'Someone', 'Energy; call me on +31 6 1234 5678') $$,
  '23514', null,
  'a phone number in an alumni field is refused'
);
select throws_ok(
  $$ insert into public.alumni (responded_at, full_name, linkedin_url)
     values ('2026-09-04T10:00:00Z', 'Someone', 'mailto:someone@example.org') $$,
  '23514', null,
  'a LinkedIn link must point to linkedin.com'
);
select lives_ok(
  $$ insert into public.alumni (responded_at, full_name, previous_occupation, master)
     values ('2026-09-04T11:00:00Z', 'Someone Else', 'Policy advisor @ a ministry (2019-2023)',
       'MSc Sustainable Development 2017-2019') $$,
  'ordinary text with years and an @ sign is accepted'
);

select * from finish();
rollback;
