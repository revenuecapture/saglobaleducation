-- Awards with conditions the finder cannot check (alumni, family, sport, need, nomination,
-- progression from a pathway) never get a "likely eligible" badge. Null means "decide from the
-- award text"; a reviewer can set it explicitly.
alter table public.scholarships add column has_extra_conditions boolean;
