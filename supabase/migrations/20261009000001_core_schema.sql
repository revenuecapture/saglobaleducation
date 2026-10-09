-- SA Global course and scholarship finders: core schema.
-- Based on the Course Finder Prompt Pack section 6, extended for scholarships,
-- likely-eligible matching and per-finder enquiries.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Controlled vocabularies ---------------------------------------------------

create table public.fields (
  slug text primary key,
  label text not null,
  sort_order int not null default 0
);

create table public.destinations (
  code text primary key,
  name text not null,
  tab_label text not null,
  currency text not null check (currency in ('GBP','USD','NZD','AUD','CAD','EUR')),
  post_study_work_summary text,
  post_study_work_source_url text,
  post_study_work_verified_on date,
  indicative_fees_note text,
  indicative_fees_source text,
  show_indicative_fees boolean not null default false,
  guide_url text,
  sort_order int not null default 0
);

-- Institutions ----------------------------------------------------------------

create table public.universities (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  destination_code text not null references public.destinations(code),
  city text,
  region text,
  website_url text,
  international_admissions_url text,
  scholarships_url text,
  logo_path text,
  summary text,
  tier int not null default 2 check (tier in (1, 2)),
  research_batch int,
  presentation_name text,
  presentation_group text,
  campus_note text,
  eligibility_note text,
  eligibility_source_url text,
  is_russell_group boolean,
  russell_group_source_url text,
  source_url text,
  verified_on date,
  review_notes text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Courses -----------------------------------------------------------------------

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  university_id uuid not null references public.universities(id) on delete cascade,
  title text not null,
  award text,
  level text not null check (level in ('foundation_pathway','undergraduate','postgraduate','pg_diploma','doctoral')),
  field_slug text not null references public.fields(slug),
  mode text not null default 'full_time' check (mode in ('full_time','part_time','online','blended')),
  duration_text text,
  duration_months int check (duration_months between 1 and 120),
  tuition_amount numeric(10,2) check (tuition_amount > 0),
  tuition_currency text check (tuition_currency in ('GBP','USD','NZD','AUD','CAD','EUR')),
  tuition_basis text check (tuition_basis in ('per_year','total')),
  tuition_academic_year text,
  fees_source_url text,
  overview text,
  highlights text[],
  academic_requirements text,
  english_requirements text,
  experience_requirements text,
  pakistan_entry_note text,
  pakistan_source_url text,
  career_notes text,
  -- Structured requirements used by likely-eligible matching (null = not published).
  min_ielts_overall numeric(2,1) check (min_ielts_overall between 0 and 9),
  min_ielts_band numeric(2,1) check (min_ielts_band between 0 and 9),
  min_pte int check (min_pte between 10 and 90),
  min_toefl int check (min_toefl between 0 and 120),
  min_duolingo int check (min_duolingo between 10 and 160),
  pk_route text check (pk_route in ('intermediate','intermediate_plus_foundation','bachelor_14','bachelor_16','master')),
  pk_min_percent numeric(5,2) check (pk_min_percent between 0 and 100),
  pk_min_cgpa numeric(3,2) check (pk_min_cgpa between 0 and 4),
  uk_min_alevels text,
  uk_min_degree_class text check (uk_min_degree_class in ('first','2:1','2:2','third','pass')),
  official_url text not null,
  intake_labels text[],
  application_deadline_note text,
  featured boolean not null default false,
  source_url text not null,
  verified_on date not null,
  confidence text check (confidence in ('high','medium','low')),
  review_notes text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Scholarships ------------------------------------------------------------------

create table public.scholarships (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  provider_type text not null check (provider_type in ('university','government','foundation')),
  provider_name text not null,
  university_id uuid references public.universities(id) on delete cascade,
  destination_codes text[] not null default '{}',
  levels text[] not null default '{}'
    check (levels <@ array['foundation_pathway','undergraduate','postgraduate','pg_diploma','doctoral']),
  field_slugs text[] not null default '{}',          -- empty = open to all fields
  eligible_countries text[] not null default '{}',   -- ISO codes such as PK, GB; INTL = any international applicant
  value_type text not null check (value_type in ('full_funding','full_tuition','partial_tuition','fee_reduction','fixed_amount','stipend')),
  value_amount numeric(12,2) check (value_amount > 0),
  value_percent numeric(5,2) check (value_percent between 0 and 100),
  value_currency text check (value_currency in ('GBP','USD','NZD','AUD','CAD','EUR')),
  value_basis text check (value_basis in ('per_year','total','one_off')),
  value_text text not null,
  summary text,
  criteria_text text,
  min_pk_percent numeric(5,2) check (min_pk_percent between 0 and 100),
  min_pk_cgpa numeric(3,2) check (min_pk_cgpa between 0 and 4),
  min_ielts_overall numeric(2,1) check (min_ielts_overall between 0 and 9),
  need_based boolean,
  application_route text check (application_route in ('automatic','separate_application','nomination')),
  requires_offer boolean,
  opens_on date,
  deadline_on date,
  deadline_note text,
  intake_label text,
  official_url text not null,
  source_url text not null,
  verified_on date not null,
  confidence text check (confidence in ('high','medium','low')),
  featured boolean not null default false,
  review_notes text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (provider_type <> 'university' or university_id is not null)
);

-- SA Global's own grade equivalence table (used only where a university
-- publishes no Pakistan guidance, and always shown as general guidance).
create table public.grade_equivalences (
  id uuid primary key default gen_random_uuid(),
  qualification text not null,
  uk_equivalent text not null,
  pk_min_percent numeric(5,2) check (pk_min_percent between 0 and 100),
  pk_min_cgpa numeric(3,2) check (pk_min_cgpa between 0 and 4),
  notes text,
  approved_by text,
  approved_on date,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enquiries -----------------------------------------------------------------------

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source_finder text not null default 'contact' check (source_finder in ('course','scholarship','contact')),
  full_name text not null,
  whatsapp text,
  email text,
  country_of_residence text,
  level_of_study text,
  budget_range text,
  intended_intake text,
  english_status text,
  message text,
  course_ids uuid[],
  scholarship_ids uuid[],
  eligibility_profile jsonb,
  source_page text,
  utm jsonb,
  consent_privacy boolean not null,
  consent_text_version text not null,
  consent_marketing boolean not null default false,
  check (whatsapp is not null or email is not null),
  check (consent_privacy)
);

create index on public.universities (destination_code);
create index on public.courses (university_id);
create index on public.courses (field_slug, level);
create index on public.courses (is_published);
create index on public.scholarships (university_id);
create index on public.scholarships (is_published, deadline_on);
create index on public.leads (created_at desc);

create trigger universities_updated_at before update on public.universities for each row execute function public.set_updated_at();
create trigger courses_updated_at before update on public.courses for each row execute function public.set_updated_at();
create trigger scholarships_updated_at before update on public.scholarships for each row execute function public.set_updated_at();
create trigger grade_equivalences_updated_at before update on public.grade_equivalences for each row execute function public.set_updated_at();
