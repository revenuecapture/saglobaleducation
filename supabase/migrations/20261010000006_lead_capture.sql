-- Enquiry capture: readable item names on each lead, and a private table of hashed request
-- sources used only for rate limiting (no raw IP addresses are stored anywhere).
alter table public.leads add column item_names text[];
alter table public.leads add column ip_hash text;

create table public.lead_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index on public.lead_attempts (ip_hash, created_at desc);
alter table public.lead_attempts enable row level security;
revoke all on public.lead_attempts from anon, authenticated;
