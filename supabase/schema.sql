-- ═══════════════════════════════════════════════════════════════════════════
-- JOKER Barbershop — Supabase-ის სქემა
--
-- გაშვება: Supabase → SQL Editor → ჩასვით მთელი ფაილი → Run.
-- ფაილი უსაფრთხოა ხელახლა გასაშვებად (არაფერს შლის).
--
-- რას ქმნის:
--   1. ცხრილი `content`  — საიტის შიგთავსი (თითო ელემენტი = ერთი სტრიქონი)
--   2. ცხრილი `admins`   — ვის აქვს რედაქტირების უფლება
--   3. Row Level Security — კითხვა ყველას, ცვლილება მხოლოდ ადმინებს
--   4. Storage bucket `media` — ფოტოები
--
-- ⚠ რატომ `admins` ცხრილი: Supabase-ში რეგისტრაცია ნაგულისხმევად ღიაა, ანუ
--   „ავტორიზებული მომხმარებელი" ნებისმიერი შეიძლება გახდეს. ამიტომ ჩაწერის
--   უფლება აქვს მხოლოდ მას, ვინც ამ ცხრილშია. დამატებით გამორთეთ რეგისტრაცია:
--   Authentication → Sign In / Providers → „Allow new users to sign up" = OFF.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. შიგთავსი ────────────────────────────────────────────────────────────────
create table if not exists public.content (
  collection text        not null,            -- slides | categories | barbers | branches | gallery | reviews | faq | settings | texts | meta
  id         text        not null,
  position   integer     not null default 0,  -- რიგი სიაში
  data       jsonb       not null,            -- ელემენტი (სტრუქტურა: src/content/types.ts)
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (collection, id)
);

comment on table public.content is 'JOKER საიტის შიგთავსი. რედაქტირდება /admin-იდან.';

-- 2. ადმინები ────────────────────────────────────────────────────────────────
create table if not exists public.admins (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

comment on table public.admins is 'ვის შეუძლია შიგთავსის შეცვლა. სტრიქონები ემატება მხოლოდ SQL Editor-იდან.';

-- არის თუ არა მიმდინარე მომხმარებელი ადმინი
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ვინ და როდის შეცვალა
create or replace function public.touch_content()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists content_touch on public.content;
create trigger content_touch
  before insert or update on public.content
  for each row execute function public.touch_content();

-- 3. Row Level Security ──────────────────────────────────────────────────────
alter table public.content enable row level security;
alter table public.admins  enable row level security;

drop policy if exists "content: ყველა კითხულობს" on public.content;
create policy "content: ყველა კითხულობს"
  on public.content for select
  using (true);

drop policy if exists "content: ადმინი ამატებს" on public.content;
create policy "content: ადმინი ამატებს"
  on public.content for insert to authenticated
  with check (public.is_admin());

drop policy if exists "content: ადმინი ცვლის" on public.content;
create policy "content: ადმინი ცვლის"
  on public.content for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "content: ადმინი შლის" on public.content;
create policy "content: ადმინი შლის"
  on public.content for delete to authenticated
  using (public.is_admin());

-- მომხმარებელი ხედავს მხოლოდ საკუთარ სტრიქონს (ადმინ პანელი ამით ამოწმებს უფლებას).
-- ჩაწერის წესი არ არსებობს → ამ ცხრილს API-დან ვერავინ შეცვლის.
drop policy if exists "admins: საკუთარი სტრიქონი" on public.admins;
create policy "admins: საკუთარი სტრიქონი"
  on public.admins for select to authenticated
  using (user_id = auth.uid());

-- 4. ფოტოების საცავი ─────────────────────────────────────────────────────────
-- საჯარო bucket: ფოტო იხსნება ბმულით; ატვირთვა/შეცვლა/წაშლა — მხოლოდ ადმინს.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "media: ადმინი ტვირთავს" on storage.objects;
create policy "media: ადმინი ტვირთავს"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "media: ადმინი ცვლის" on storage.objects;
create policy "media: ადმინი ცვლის"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "media: ადმინი შლის" on storage.objects;
create policy "media: ადმინი შლის"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());

-- 5. ადმინის დამატება ────────────────────────────────────────────────────────
-- ჯერ შექმენით მომხმარებელი: Authentication → Users → Add user (ელფოსტა + პაროლი,
-- „Auto Confirm User" ჩართული). შემდეგ გაუშვით ეს ხაზი თქვენი ელფოსტით:
--
--   insert into public.admins (user_id, note)
--   select id, 'მთავარი ადმინი' from auth.users where email = 'admin@example.com'
--   on conflict do nothing;
--
-- ადმინის მოხსნა:
--   delete from public.admins where user_id = (select id from auth.users where email = 'admin@example.com');
