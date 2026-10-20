-- supabase/migrations/20261020_upphandling_rfi_lage.sql
-- RFI-läge i upphandlingsportalen (3.71.0). Additiv, inget tas bort.
--
-- 1. procurement_notices.work_mode: manuellt arbetsläge när annonstypen är fel.
--    null = läget följer notice_kind (rfi ger RFI-läge, allt annat anbudsläge).
-- 2. procurement_rfi_questions: frågorna i köparens RFI-formulär, ordagrant och
--    i ordning, med svarstyp, ankare i köparens docx och vårt svar.
-- 3. procurement_company_facts: återanvändbara företagsuppgifter (omsättning,
--    moderbolag, certifieringar ...) som fylls i automatiskt nästa gång.

alter table public.procurement_notices
  add column if not exists work_mode text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'procurement_notices_work_mode_check') then
    alter table public.procurement_notices
      add constraint procurement_notices_work_mode_check check (work_mode is null or work_mode in ('rfi', 'tender'));
  end if;
end $$;

grant update (work_mode) on public.procurement_notices to authenticated;

create table if not exists public.procurement_rfi_questions (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.procurement_notices(id) on delete cascade,
  document_id uuid references public.procurement_documents(id) on delete set null,
  sort_order integer not null default 0,
  section text,
  question text not null,
  context text,
  answer_type text not null default 'fritext',
  answer_meta jsonb not null default '{}'::jsonb,
  anchor jsonb,
  answer text,
  answer_values jsonb not null default '{}'::jsonb,
  answer_status text not null default 'utkast',
  answer_source text,
  draft_sources jsonb not null default '[]'::jsonb,
  library_answer_id uuid references public.procurement_answers(id) on delete set null,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint procurement_rfi_questions_type_check check (answer_type in ('fritext', 'ja_nej', 'procent_per_ar', 'foretagsuppgift')),
  constraint procurement_rfi_questions_status_check check (answer_status in ('utkast', 'godkand')),
  constraint procurement_rfi_questions_source_check check (answer_source is null or answer_source in ('ai', 'manuell', 'foretagsuppgift', 'bibliotek'))
);

create index if not exists procurement_rfi_questions_notice_idx on public.procurement_rfi_questions (notice_id, sort_order);
create index if not exists procurement_rfi_questions_document_idx on public.procurement_rfi_questions (document_id);

alter table public.procurement_rfi_questions enable row level security;

create policy procurement_rfi_questions_select on public.procurement_rfi_questions
  for select using (public.has_procurement_access());
create policy procurement_rfi_questions_write on public.procurement_rfi_questions
  for all using (public.has_procurement_access()) with check (public.has_procurement_access());

grant select, insert, update, delete on public.procurement_rfi_questions to authenticated;

create trigger procurement_rfi_questions_touch before update on public.procurement_rfi_questions
  for each row execute function public.procurement_touch_updated_at();

create table if not exists public.procurement_company_facts (
  key text primary key,
  label text not null,
  value text not null default '',
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint procurement_company_facts_key_check check (key ~ '^[a-z0-9_]{1,80}$')
);

alter table public.procurement_company_facts enable row level security;

create policy procurement_company_facts_select on public.procurement_company_facts
  for select using (public.has_procurement_access());
create policy procurement_company_facts_write on public.procurement_company_facts
  for all using (public.has_procurement_access()) with check (public.has_procurement_access());

grant select, insert, update on public.procurement_company_facts to authenticated;

create trigger procurement_company_facts_touch before update on public.procurement_company_facts
  for each row execute function public.procurement_touch_updated_at();
