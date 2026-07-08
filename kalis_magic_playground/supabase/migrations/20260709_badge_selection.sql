alter table public.profiles add column if not exists preferred_badge_code text references public.badges(code);
alter table public.posts add column if not exists author_badge_code text references public.badges(code);
