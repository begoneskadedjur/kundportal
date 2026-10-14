-- 20261014_specialrapporter.sql
-- Specialrapporter (3.50.0): en fri rapport kopplad till ett ärende, uppbyggd
-- av sektioner med block (text, händelser, bilder, kartutsnitt). Skickade
-- versioner låses i special_report_versions med sin PDF.
-- Kontrakt: docs/specialrapporter/KONTRAKT.md, typer: src/types/specialReport.ts
--
-- Åtkomst: admin, koordinator (profiles.is_admin/is_koordinator, role eller
-- extra_roles) och tekniker som är primär, sekundär eller tertiär på ärendet.
-- Den som skapade rapporten behåller åtkomsten. All RLS går via
-- can_access_case_for_report och can_access_special_report.
--
-- Idempotent: inga DROP, bara create ... if not exists / create or replace.

-- ============================================================================
-- 1. Tabeller
-- ============================================================================

create table if not exists public.special_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  doc_type text not null default 'Saneringsrapport'
    check (doc_type in ('Saneringsrapport', 'Inspektionsrapport', 'Åtgärdsrapport')),
  case_id uuid not null,
  case_type text not null check (case_type in ('contract', 'private', 'business')),
  -- Ögonblicksbild från ärendet när rapporten skapades
  case_number text,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_number text,
  contact_name text,
  contact_email text,
  contact_phone text,
  address text,
  intro text,
  assessment text,
  recommendations text,
  -- { lat, lng, zoom }, null = ingen översiktskarta
  map_view jsonb,
  current_version integer not null default 1 check (current_version >= 1),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists special_reports_case_idx
  on public.special_reports (case_type, case_id);
create index if not exists special_reports_updated_idx
  on public.special_reports (updated_at desc);
create index if not exists special_reports_created_by_idx
  on public.special_reports (created_by);

create table if not exists public.special_report_sections (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.special_reports(id) on delete cascade,
  position integer not null default 0,
  title text not null,
  subtitle text,
  label text not null default 'fritt' check (label in ('omrade', 'besok', 'underlev', 'fritt')),
  -- [{ lat, lng }, ...] yttre ring utan upprepad startpunkt, null = inget område
  area jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists special_report_sections_report_idx
  on public.special_report_sections (report_id, position);

create table if not exists public.special_report_blocks (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.special_report_sections(id) on delete cascade,
  position integer not null default 0,
  type text not null check (type in ('text', 'events', 'images', 'map')),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists special_report_blocks_section_idx
  on public.special_report_blocks (section_id, position);
-- Högst ett händelseblock per sektion
create unique index if not exists special_report_blocks_one_events_idx
  on public.special_report_blocks (section_id) where type = 'events';

create table if not exists public.special_report_events (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.special_report_sections(id) on delete cascade,
  event_date date not null,
  type text not null default 'notering'
    check (type in ('inspektion', 'besok', 'betning', 'atgard', 'underlev', 'notering')),
  title text not null,
  description text,
  source text check (source in ('visit', 'inspection_session')),
  source_id uuid,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists special_report_events_section_idx
  on public.special_report_events (section_id, event_date);
create index if not exists special_report_events_source_idx
  on public.special_report_events (source, source_id) where source_id is not null;

create table if not exists public.special_report_images (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.special_reports(id) on delete cascade,
  section_id uuid not null references public.special_report_sections(id) on delete cascade,
  event_id uuid references public.special_report_events(id) on delete set null,
  -- {report_id}/{uuid}.webp i bucketen special-reports
  storage_path text not null,
  caption text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists special_report_images_report_idx
  on public.special_report_images (report_id);
create index if not exists special_report_images_section_idx
  on public.special_report_images (section_id, position);
create index if not exists special_report_images_event_idx
  on public.special_report_images (event_id) where event_id is not null;

create table if not exists public.special_report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.special_reports(id) on delete cascade,
  version integer not null,
  -- {report_id}/versioner/v{n}.pdf i bucketen special-reports
  pdf_path text not null,
  page_count integer,
  sent_at timestamptz,
  sent_to text[] not null default '{}'::text[],
  sent_by uuid references auth.users(id) on delete set null,
  subject text,
  message text,
  created_at timestamptz not null default now(),
  unique (report_id, version)
);

create index if not exists special_report_versions_report_idx
  on public.special_report_versions (report_id, version desc);

-- ============================================================================
-- 2. Triggers: updated_at, låsta fält och "senast ändrad" på rapporten
-- ============================================================================

-- Rapportraden: updated_at/updated_by sätts alltid. Vid anrop från en
-- inloggad användare (inte service role, som saknar auth.uid()) låses ärende,
-- skapare och versionsräknare: de ändras bara av API:t.
create or replace function public.special_reports_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
    new.case_id := old.case_id;
    new.case_type := old.case_type;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.current_version := old.current_version;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'special_reports_before_update_trg'
      and tgrelid = 'public.special_reports'::regclass
  ) then
    create trigger special_reports_before_update_trg
      before update on public.special_reports
      for each row execute function public.special_reports_before_update();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'special_report_sections_updated_at_trg'
      and tgrelid = 'public.special_report_sections'::regclass
  ) then
    create trigger special_report_sections_updated_at_trg
      before update on public.special_report_sections
      for each row execute function public.update_updated_at_column();
  end if;
end;
$$;

-- Ändringar i sektioner, block, händelser och bilder räknas som ändring av
-- rapporten (listans "senast ändrad" och "framtagen av").
create or replace function public.touch_special_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report_id uuid;
  v_section_id uuid;
  v_row jsonb;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  if tg_table_name in ('special_report_sections', 'special_report_images') then
    v_report_id := (v_row ->> 'report_id')::uuid;
  else
    v_section_id := (v_row ->> 'section_id')::uuid;
    select s.report_id into v_report_id
    from public.special_report_sections s where s.id = v_section_id;
  end if;

  if v_report_id is not null then
    update public.special_reports
    set updated_at = now(),
        updated_by = coalesce(auth.uid(), updated_by)
    where id = v_report_id;
  end if;

  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'special_report_sections', 'special_report_blocks',
    'special_report_events', 'special_report_images'
  ] loop
    if not exists (
      select 1 from pg_trigger
      where tgname = t || '_touch_report_trg'
        and tgrelid = ('public.' || t)::regclass
    ) then
      execute format(
        'create trigger %I after insert or update or delete on public.%I
           for each row execute function public.touch_special_report()',
        t || '_touch_report_trg', t
      );
    end if;
  end loop;
end;
$$;

-- ============================================================================
-- 3. Åtkomstfunktioner
-- ============================================================================

-- Får den inloggade användaren skapa/se en specialrapport på ärendet?
-- Admin och koordinator alltid; tekniker när profilens technician_id är
-- primär, sekundär eller tertiär på ärendet.
create or replace function public.can_access_case_for_report(p_case_id uuid, p_case_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      p.technician_id,
      (coalesce(p.is_admin, false)
        or coalesce(p.is_koordinator, false)
        or p.role::text in ('admin', 'koordinator')
        or coalesce(p.extra_roles, array[]::text[]) && array['admin', 'koordinator']::text[]
      ) as is_staff
    from public.profiles p
    where p.user_id = auth.uid()
    limit 1
  )
  select coalesce((
    select
      me.is_staff
      or (
        me.technician_id is not null
        and case p_case_type
          when 'contract' then exists (
            select 1 from public.cases c
            where c.id = p_case_id
              and me.technician_id in (c.primary_technician_id, c.secondary_technician_id, c.tertiary_technician_id)
          )
          when 'private' then exists (
            select 1 from public.private_cases pc
            where pc.id = p_case_id
              and me.technician_id in (pc.primary_assignee_id, pc.secondary_assignee_id, pc.tertiary_assignee_id)
          )
          when 'business' then exists (
            select 1 from public.business_cases bc
            where bc.id = p_case_id
              and me.technician_id in (bc.primary_assignee_id, bc.secondary_assignee_id, bc.tertiary_assignee_id)
          )
          else false
        end
      )
    from me
  ), false);
$$;

-- Får den inloggade användaren läsa och ändra rapporten?
-- Skaparen eller den som når ärendet.
create or replace function public.can_access_special_report(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select (r.created_by is not null and r.created_by = auth.uid())
      or public.can_access_case_for_report(r.case_id, r.case_type)
    from public.special_reports r
    where r.id = p_report_id
  ), false);
$$;

-- Samma regel via sektionen (block och händelser saknar report_id)
create or replace function public.can_access_special_report_section(p_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select public.can_access_special_report(s.report_id)
    from public.special_report_sections s
    where s.id = p_section_id
  ), false);
$$;

-- Samma regel via första mappnivån i storage ({report_id}/...). Ogiltigt
-- uuid ger false i stället för fel.
create or replace function public.can_access_special_report_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.can_access_special_report(p_folder::uuid)
    else false
  end;
$$;

revoke all on function public.can_access_case_for_report(uuid, text) from public, anon;
revoke all on function public.can_access_special_report(uuid) from public, anon;
revoke all on function public.can_access_special_report_section(uuid) from public, anon;
revoke all on function public.can_access_special_report_folder(text) from public, anon;
grant execute on function public.can_access_case_for_report(uuid, text) to authenticated, service_role;
grant execute on function public.can_access_special_report(uuid) to authenticated, service_role;
grant execute on function public.can_access_special_report_section(uuid) to authenticated, service_role;
grant execute on function public.can_access_special_report_folder(text) to authenticated, service_role;

-- ============================================================================
-- 4. RLS
-- ============================================================================

alter table public.special_reports enable row level security;
alter table public.special_report_sections enable row level security;
alter table public.special_report_blocks enable row level security;
alter table public.special_report_events enable row level security;
alter table public.special_report_images enable row level security;
alter table public.special_report_versions enable row level security;

do $$
begin
  -- special_reports
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_reports' and policyname = 'special_reports_select') then
    create policy special_reports_select on public.special_reports
      for select to authenticated
      using ((created_by is not null and created_by = auth.uid()) or public.can_access_case_for_report(case_id, case_type));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_reports' and policyname = 'special_reports_insert') then
    create policy special_reports_insert on public.special_reports
      for insert to authenticated
      with check (created_by = auth.uid() and current_version = 1 and public.can_access_case_for_report(case_id, case_type));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_reports' and policyname = 'special_reports_update') then
    create policy special_reports_update on public.special_reports
      for update to authenticated
      using (public.can_access_special_report(id))
      with check (public.can_access_special_report(id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_reports' and policyname = 'special_reports_delete') then
    create policy special_reports_delete on public.special_reports
      for delete to authenticated
      using (public.can_access_special_report(id));
  end if;

  -- special_report_sections
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_sections' and policyname = 'special_report_sections_select') then
    create policy special_report_sections_select on public.special_report_sections
      for select to authenticated using (public.can_access_special_report(report_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_sections' and policyname = 'special_report_sections_insert') then
    create policy special_report_sections_insert on public.special_report_sections
      for insert to authenticated with check (public.can_access_special_report(report_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_sections' and policyname = 'special_report_sections_update') then
    create policy special_report_sections_update on public.special_report_sections
      for update to authenticated
      using (public.can_access_special_report(report_id))
      with check (public.can_access_special_report(report_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_sections' and policyname = 'special_report_sections_delete') then
    create policy special_report_sections_delete on public.special_report_sections
      for delete to authenticated using (public.can_access_special_report(report_id));
  end if;

  -- special_report_blocks
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_blocks' and policyname = 'special_report_blocks_select') then
    create policy special_report_blocks_select on public.special_report_blocks
      for select to authenticated using (public.can_access_special_report_section(section_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_blocks' and policyname = 'special_report_blocks_insert') then
    create policy special_report_blocks_insert on public.special_report_blocks
      for insert to authenticated with check (public.can_access_special_report_section(section_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_blocks' and policyname = 'special_report_blocks_update') then
    create policy special_report_blocks_update on public.special_report_blocks
      for update to authenticated
      using (public.can_access_special_report_section(section_id))
      with check (public.can_access_special_report_section(section_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_blocks' and policyname = 'special_report_blocks_delete') then
    create policy special_report_blocks_delete on public.special_report_blocks
      for delete to authenticated using (public.can_access_special_report_section(section_id));
  end if;

  -- special_report_events
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_events' and policyname = 'special_report_events_select') then
    create policy special_report_events_select on public.special_report_events
      for select to authenticated using (public.can_access_special_report_section(section_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_events' and policyname = 'special_report_events_insert') then
    create policy special_report_events_insert on public.special_report_events
      for insert to authenticated with check (public.can_access_special_report_section(section_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_events' and policyname = 'special_report_events_update') then
    create policy special_report_events_update on public.special_report_events
      for update to authenticated
      using (public.can_access_special_report_section(section_id))
      with check (public.can_access_special_report_section(section_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_events' and policyname = 'special_report_events_delete') then
    create policy special_report_events_delete on public.special_report_events
      for delete to authenticated using (public.can_access_special_report_section(section_id));
  end if;

  -- special_report_images (sektionen måste höra till samma rapport)
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_images' and policyname = 'special_report_images_select') then
    create policy special_report_images_select on public.special_report_images
      for select to authenticated using (public.can_access_special_report(report_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_images' and policyname = 'special_report_images_insert') then
    create policy special_report_images_insert on public.special_report_images
      for insert to authenticated
      with check (
        public.can_access_special_report(report_id)
        and exists (select 1 from public.special_report_sections s where s.id = section_id and s.report_id = special_report_images.report_id)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_images' and policyname = 'special_report_images_update') then
    create policy special_report_images_update on public.special_report_images
      for update to authenticated
      using (public.can_access_special_report(report_id))
      with check (
        public.can_access_special_report(report_id)
        and exists (select 1 from public.special_report_sections s where s.id = section_id and s.report_id = special_report_images.report_id)
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_images' and policyname = 'special_report_images_delete') then
    create policy special_report_images_delete on public.special_report_images
      for delete to authenticated using (public.can_access_special_report(report_id));
  end if;

  -- special_report_versions: bara läsning, raderna skrivs av API:t (service role)
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'special_report_versions' and policyname = 'special_report_versions_select') then
    create policy special_report_versions_select on public.special_report_versions
      for select to authenticated using (public.can_access_special_report(report_id));
  end if;
end;
$$;

-- ============================================================================
-- 5. Storage: privat bucket special-reports
-- ============================================================================
-- Bilder: {report_id}/{uuid}.webp (laddas upp av användaren)
-- PDF:er: {report_id}/versioner/... (skrivs bara av API:t med service role)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'special-reports', 'special-reports', false, 52428800,
  array['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'special_reports_storage_select') then
    create policy special_reports_storage_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'special-reports'
        and public.can_access_special_report_folder((storage.foldername(name))[1])
      );
  end if;
  -- Skrivning bara direkt i rapportens mapp, aldrig i versioner/
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'special_reports_storage_insert') then
    create policy special_reports_storage_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'special-reports'
        and coalesce(array_length(storage.foldername(name), 1), 0) = 1
        and public.can_access_special_report_folder((storage.foldername(name))[1])
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'special_reports_storage_update') then
    create policy special_reports_storage_update on storage.objects
      for update to authenticated
      using (
        bucket_id = 'special-reports'
        and coalesce(array_length(storage.foldername(name), 1), 0) = 1
        and public.can_access_special_report_folder((storage.foldername(name))[1])
      )
      with check (
        bucket_id = 'special-reports'
        and coalesce(array_length(storage.foldername(name), 1), 0) = 1
        and public.can_access_special_report_folder((storage.foldername(name))[1])
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'special_reports_storage_delete') then
    create policy special_reports_storage_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'special-reports'
        and coalesce(array_length(storage.foldername(name), 1), 0) = 1
        and public.can_access_special_report_folder((storage.foldername(name))[1])
      );
  end if;
end;
$$;
