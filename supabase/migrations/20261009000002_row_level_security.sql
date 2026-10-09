-- Visitors (anon) and signed-in users may read published rows only.
-- Nobody but the service role (Edge Functions, imports) can write, and
-- leads have no policies at all, so they are unreadable from the browser.

alter table public.fields enable row level security;
alter table public.destinations enable row level security;
alter table public.universities enable row level security;
alter table public.courses enable row level security;
alter table public.scholarships enable row level security;
alter table public.grade_equivalences enable row level security;
alter table public.leads enable row level security;

create policy "fields are public" on public.fields
  for select to anon, authenticated using (true);

create policy "destinations are public" on public.destinations
  for select to anon, authenticated using (true);

create policy "published universities are public" on public.universities
  for select to anon, authenticated using (is_published);

create policy "published courses at published universities are public" on public.courses
  for select to anon, authenticated using (
    is_published and exists (
      select 1 from public.universities u where u.id = university_id and u.is_published
    )
  );

create policy "published scholarships are public" on public.scholarships
  for select to anon, authenticated using (
    is_published and (
      university_id is null or exists (
        select 1 from public.universities u where u.id = university_id and u.is_published
      )
    )
  );

create policy "published equivalences are public" on public.grade_equivalences
  for select to anon, authenticated using (is_published);

-- Belt and braces: browser roles get no table privileges on leads at all.
revoke all on public.leads from anon, authenticated;
-- Browser roles never write catalogue tables.
revoke insert, update, delete, truncate on public.fields, public.destinations, public.universities,
  public.courses, public.scholarships, public.grade_equivalences from anon, authenticated;
