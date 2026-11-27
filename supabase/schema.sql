-- VisionID / Face Attendance: Supabase schema
-- Run this whole file in Supabase Dashboard -> SQL Editor.
-- The browser app uses the publishable key; RLS below protects all app data.

create extension if not exists pgcrypto;

create type public.staff_role as enum ('admin', 'teacher');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Staff member',
  role public.staff_role not null default 'teacher',
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  student_code text not null unique,
  department text,
  class_name text,
  image_paths text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  date_key date not null default current_date,
  attended_at timestamptz not null default now(),
  confidence numeric(5,2) not null default 0,
  distance numeric(7,5) not null default 0,
  threshold numeric(7,5) not null default 0.45,
  faces_detected integer not null default 1,
  snapshot_path text,
  marked_by uuid references public.profiles(id) on delete set null,
  unique (student_id, date_key)
);

create index if not exists attendance_date_key_idx on public.attendance(date_key desc);
create index if not exists attendance_student_id_idx on public.attendance(student_id);

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.attendance enable row level security;

-- Avoid an RLS recursion when checking a user's staff role.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on public.profiles, public.students, public.attendance from anon;
grant select on public.profiles, public.students, public.attendance to authenticated;
grant insert, update, delete on public.students, public.attendance to authenticated;
grant update on public.profiles to authenticated;

create policy "Staff can read profiles" on public.profiles for select to authenticated using (true);
create policy "Staff can update their profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Staff can read students" on public.students for select to authenticated using (true);
create policy "Admins manage students" on public.students for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Staff can read attendance" on public.attendance for select to authenticated using (true);
create policy "Staff mark attendance" on public.attendance for insert to authenticated with check (marked_by = auth.uid());
create policy "Admins manage attendance" on public.attendance for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete attendance" on public.attendance for delete to authenticated using (public.is_admin());

-- A new Auth account automatically gets a teacher profile. Promote the first
-- administrator once, from SQL Editor, after they have signed up (see README).
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'Staff member'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

-- Storage for training photos and recognition snapshots.
insert into storage.buckets (id, name, public)
values ('attendance-media', 'attendance-media', false)
on conflict (id) do nothing;

create policy "Staff read attendance media" on storage.objects for select to authenticated using (bucket_id = 'attendance-media');
create policy "Admins upload attendance media" on storage.objects for insert to authenticated with check (bucket_id = 'attendance-media' and public.is_admin());
create policy "Admins modify attendance media" on storage.objects for update to authenticated using (bucket_id = 'attendance-media' and public.is_admin());
create policy "Admins delete attendance media" on storage.objects for delete to authenticated using (bucket_id = 'attendance-media' and public.is_admin());
