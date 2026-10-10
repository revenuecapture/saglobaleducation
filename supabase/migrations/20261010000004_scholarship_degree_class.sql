-- Some awards set their bar as a UK degree class (for example "equivalent to a UK first").
alter table public.scholarships
  add column min_uk_degree_class text check (min_uk_degree_class in ('first','2:1','2:2','third','pass'));
