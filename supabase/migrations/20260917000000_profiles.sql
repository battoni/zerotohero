-- Profiles: one row per auth user, created by trigger. See docs/spec-mvp.md §3.
create extension if not exists citext;

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  handle        citext not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name  text check (char_length(display_name) <= 60),
  avatar_url    text,
  locale        text not null default 'en' check (locale in ('en', 'pt-BR')),
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by signed-in users"
  on public.profiles for select to authenticated using (true);

create policy "users update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- A provisional handle (user_<8 hex>) until onboarding picks the real one.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, handle, display_name, avatar_url)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 8),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
