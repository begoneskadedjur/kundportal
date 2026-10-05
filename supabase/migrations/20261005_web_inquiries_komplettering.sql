-- 20261005_web_inquiries_komplettering.sql
-- Leads (Webb): uppgifter som koordinatorn kompletterar under samtalet med kunden.
--   * id_nummer och id_nummer_typ: personnummer (ÅÅÅÅMMDD-XXXX) eller org.nr (XXXXXX-XXXX).
--   * rattad_adress, rattad_postnummer och rattad_ort: rättad adress.
--   * kompletterad_at och kompletterad_av sätts av triggern.
-- Kundens originalsvar (address, postal_code, city, organization_number) står kvar oförändrade.
--
-- Kolumnerna omfattas av tabellens RLS (bara personalen enligt is_web_inquiry_staff) och av
-- tabellrättigheterna i 20261005_web_inquiries_grants.sql: anon har inga rättigheter, tekniker
-- stoppas av RLS. Historikraden "Uppgifter kompletterade" skrivs av triggern och innehåller aldrig
-- själva personnumret eller org.nr, bara vilka uppgifter som ändrades.
--
-- Inga DROP-satser.

alter table public.web_inquiries
  add column if not exists id_nummer text,
  add column if not exists id_nummer_typ text,
  add column if not exists rattad_adress text,
  add column if not exists rattad_postnummer text,
  add column if not exists rattad_ort text,
  add column if not exists kompletterad_at timestamptz,
  add column if not exists kompletterad_av uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'web_inquiries_id_nummer_check') then
    alter table public.web_inquiries add constraint web_inquiries_id_nummer_check
      check (id_nummer is null or char_length(id_nummer) <= 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'web_inquiries_id_nummer_typ_check') then
    alter table public.web_inquiries add constraint web_inquiries_id_nummer_typ_check
      check (id_nummer_typ is null or id_nummer_typ in ('personnummer', 'orgnr'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'web_inquiries_rattad_adress_check') then
    alter table public.web_inquiries add constraint web_inquiries_rattad_adress_check
      check (rattad_adress is null or char_length(rattad_adress) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'web_inquiries_rattad_postnummer_check') then
    alter table public.web_inquiries add constraint web_inquiries_rattad_postnummer_check
      check (rattad_postnummer is null or rattad_postnummer ~ '^[0-9]{5}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'web_inquiries_rattad_ort_check') then
    alter table public.web_inquiries add constraint web_inquiries_rattad_ort_check
      check (rattad_ort is null or char_length(rattad_ort) <= 80);
  end if;
end $$;

-- Före uppdatering: stämpla vem och när, och låt ingen sätta stämpeln för hand
create or replace function public.web_inquiries_komplettering_before()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.id_nummer := nullif(btrim(coalesce(new.id_nummer, '')), '');
  if new.id_nummer is null then
    new.id_nummer_typ := null;
  end if;
  new.rattad_adress := nullif(btrim(coalesce(new.rattad_adress, '')), '');
  new.rattad_postnummer := nullif(btrim(coalesce(new.rattad_postnummer, '')), '');
  new.rattad_ort := nullif(btrim(coalesce(new.rattad_ort, '')), '');

  if new.id_nummer is distinct from old.id_nummer
     or new.id_nummer_typ is distinct from old.id_nummer_typ
     or new.rattad_adress is distinct from old.rattad_adress
     or new.rattad_postnummer is distinct from old.rattad_postnummer
     or new.rattad_ort is distinct from old.rattad_ort then
    new.kompletterad_at := now();
    new.kompletterad_av := (select p.id from public.profiles p where p.user_id = auth.uid() limit 1);
  else
    new.kompletterad_at := old.kompletterad_at;
    new.kompletterad_av := old.kompletterad_av;
  end if;
  return new;
end;
$$;

revoke execute on function public.web_inquiries_komplettering_before() from public, anon, authenticated;

-- Efter uppdatering: historikraden, utan värdena
create or replace function public.web_inquiries_komplettering_after()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_delar text[] := array[]::text[];
begin
  if new.id_nummer is distinct from old.id_nummer or new.id_nummer_typ is distinct from old.id_nummer_typ then
    if new.id_nummer is null then
      v_delar := v_delar || case when old.id_nummer_typ = 'orgnr' then 'org.nr borttaget' else 'personnummer borttaget' end;
    else
      v_delar := v_delar || case when new.id_nummer_typ = 'orgnr' then 'org.nr' else 'personnummer' end;
    end if;
  end if;
  if new.rattad_adress is distinct from old.rattad_adress
     or new.rattad_postnummer is distinct from old.rattad_postnummer
     or new.rattad_ort is distinct from old.rattad_ort then
    v_delar := v_delar || 'adress'::text;
  end if;

  if array_length(v_delar, 1) > 0 then
    insert into public.web_inquiry_events (inquiry_id, typ, text, fran_varde, till_varde, profile_id)
    values (
      new.id,
      'anteckning',
      'Uppgifter kompletterade (' || array_to_string(v_delar, ', ') || ')',
      null,
      'komplettering',
      new.kompletterad_av
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.web_inquiries_komplettering_after() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'web_inquiries_komplettering_before') then
    create trigger web_inquiries_komplettering_before
      before update on public.web_inquiries
      for each row execute function public.web_inquiries_komplettering_before();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'web_inquiries_komplettering_after') then
    create trigger web_inquiries_komplettering_after
      after update on public.web_inquiries
      for each row execute function public.web_inquiries_komplettering_after();
  end if;
end $$;
