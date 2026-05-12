-- submissions: add reporting_period (e.g. "2026-07")
alter table public.submissions
  add column if not exists reporting_period text;
