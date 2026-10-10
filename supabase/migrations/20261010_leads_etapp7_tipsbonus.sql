-- Leads etapp 7 (2026-10-10): tipsbonus i provisionerna. Sammanfattning: docs/leads/ETAPP-6-7.md.
-- Inget raderas. Funktioner och triggrar med create or replace; checken på commission_posts.case_type
-- byts i samma sats (samma mönster som etapp 5).
--
-- Beslut (Christian 2026-10-10): bonus bara när tipset blir vunnet. Procentsatsen och villkoren sätts
-- på /admin/provisioner. Bonusen bokförs som en provisionspost på tipsaren när leaden vinns och blir
-- klar för utbetalning när första fakturan för avtalet eller kunden är betald.
--
-- Applicerad via MCP i två steg: leads_etapp7_tipsbonus_kind (enumvärdet måste committas innan det
-- används) och leads_etapp7_tipsbonus (resten).

-- ---------------------------------------------------------------------------
-- 1. Aktivitetstypen tipsbonus (systemhändelse på leaden)
-- ---------------------------------------------------------------------------
alter type public.lead_activity_kind add value if not exists 'tipsbonus';

-- ---------------------------------------------------------------------------
-- 2. commission_posts: case_type 'lead' (case_id = leads.id) och en tipsbonus per lead
-- ---------------------------------------------------------------------------
alter table public.commission_posts drop constraint commission_posts_case_type_check,
  add constraint commission_posts_case_type_check check (case_type = any (array['private'::text, 'business'::text, 'contract'::text, 'lead'::text]));

create unique index if not exists idx_commission_posts_tipsbonus_lead
  on public.commission_posts (case_id) where commission_type = 'tipsbonus';

-- ---------------------------------------------------------------------------
-- 3. Inställningar i commission_settings (numeriska som övriga provisioner)
--    Ja/nej lagras som 1/0 och datum som ÅÅÅÅMMDD. Max 0 = inget tak.
--    Avstängd från början: Christian sätter procent och villkor och slår på.
-- ---------------------------------------------------------------------------
insert into public.commission_settings (setting_key, setting_value, description) values
  ('tipsbonus_aktiv', 0, 'Tipsbonus för leads: 1 = på, 0 = av'),
  ('tipsbonus_procent', 5, 'Tipsbonus: procent av första årets premie'),
  ('tipsbonus_min_belopp', 500, 'Tipsbonus: lägsta belopp i kr (höjs till detta)'),
  ('tipsbonus_max_belopp', 5000, 'Tipsbonus: högsta belopp i kr (tak), 0 = inget tak'),
  ('tipsbonus_min_premie', 0, 'Tipsbonus: lägsta årspremie i kr för att bonus ska utgå'),
  ('tipsbonus_utokning', 1, 'Tipsbonus: 1 = utökning hos befintlig kund räknas, 0 = bara nya avtal'),
  ('tipsbonus_bara_tekniker', 0, 'Tipsbonus: 1 = bara tekniker, 0 = alla som tipsar (utom ägaren)'),
  ('tipsbonus_galler_fran', 20261010, 'Tipsbonus: gäller leads vunna från och med detta datum (ÅÅÅÅMMDD)')
on conflict do nothing;

create or replace function public.tipsbonus_installning(p_nyckel text, p_standard numeric)
returns numeric
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((select s.setting_value from public.commission_settings s where s.setting_key = p_nyckel limit 1), p_standard);
$function$;

-- ---------------------------------------------------------------------------
-- 4. Frigör: posten blir klar för utbetalning när första fakturan är betald
--    Faktura = betald faktura på leadens avtal (agreement_contract_id), annars betald avtals- eller
--    merförsäljningsfaktura (invoice_type contract/adhoc) på leadens kund skapad tidigast dagen före
--    won_at. Den tidigast betalda vinner. Utbetalningsmånaden räknas som för övriga poster.
-- ---------------------------------------------------------------------------
create or replace function public.tipsbonus_frigor(p_lead uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_lead record;
  v_faktura record;
  v_post record;
  v_antal integer := 0;
begin
  select l.id, l.agreement_contract_id, l.customer_id, l.won_at into v_lead from public.leads l where l.id = p_lead;
  if not found then return 0; end if;

  select cp.* into v_post from public.commission_posts cp
   where cp.case_type = 'lead' and cp.case_id = p_lead::text
     and cp.commission_type = 'tipsbonus' and cp.status = 'pending_invoice'
   limit 1;
  if not found then return 0; end if;

  select i.id, i.invoice_number, i.paid_at into v_faktura
    from public.invoices i
   where i.status = 'paid' and i.paid_at is not null
     and (
       (v_lead.agreement_contract_id is not null and i.contract_id = v_lead.agreement_contract_id)
       or (v_lead.customer_id is not null and i.customer_id = v_lead.customer_id
           and i.invoice_type in ('contract', 'adhoc')
           and v_lead.won_at is not null and i.created_at >= v_lead.won_at - interval '1 day')
     )
   order by i.paid_at asc
   limit 1;
  if not found then return 0; end if;

  update public.commission_posts cp
     set status = 'ready_for_payout',
         invoice_paid_date = v_faktura.paid_at::date,
         payout_month = public.compute_payout_month(v_faktura.paid_at::date),
         notes = concat_ws(' ', cp.notes, 'Frigjord av faktura ' || coalesce(v_faktura.invoice_number, v_faktura.id::text) || ' betald ' || to_char(v_faktura.paid_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD') || '.'),
         updated_at = now()
   where cp.id = v_post.id and cp.status = 'pending_invoice';
  get diagnostics v_antal = row_count;

  if v_antal > 0 then
    insert into public.lead_activities (lead_id, kind, text, till_varde, ref_table, ref_id)
    values (p_lead, 'tipsbonus',
            'Tipsbonusen till ' || v_post.technician_name || ' är klar för utbetalning: första fakturan är betald',
            'ready_for_payout', 'commission_posts', v_post.id);
  end if;
  return v_antal;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Skapa: en post för tipsaren när leaden vinns (idempotent per lead)
--    Underlag: avtalets annual_value (agreement_contract_id) om det finns och är större än 0,
--    annars leads.estimated_value. Belopp = procent × underlag, höjt till lägsta och sänkt till taket.
--    Returnerar postens id, eller null med orsaken i en notice.
-- ---------------------------------------------------------------------------
create or replace function public.tipsbonus_skapa(p_lead uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_lead record;
  v_tipsare record;
  v_premie numeric;
  v_procent numeric := public.tipsbonus_installning('tipsbonus_procent', 0);
  v_min numeric := public.tipsbonus_installning('tipsbonus_min_belopp', 0);
  v_max numeric := public.tipsbonus_installning('tipsbonus_max_belopp', 0);
  v_min_premie numeric := public.tipsbonus_installning('tipsbonus_min_premie', 0);
  v_fran numeric := public.tipsbonus_installning('tipsbonus_galler_fran', 0);
  v_belopp numeric;
  v_underlag text;
  v_id uuid;
begin
  if public.tipsbonus_installning('tipsbonus_aktiv', 0) <> 1 then
    raise notice 'tipsbonus: avstängd'; return null;
  end if;

  select l.*, c.annual_value as avtal_premie into v_lead
    from public.leads l left join public.contracts c on c.id = l.agreement_contract_id
   where l.id = p_lead;
  if not found then
    raise notice 'tipsbonus: leaden finns inte'; return null;
  end if;
  if v_lead.stage <> 'vunnen' then
    raise notice 'tipsbonus: leaden är inte vunnen'; return null;
  end if;
  if v_lead.tipped_by_profile_id is null then
    raise notice 'tipsbonus: ingen tipsare'; return null;
  end if;
  if v_lead.tipped_by_profile_id is not distinct from v_lead.owner_profile_id then
    raise notice 'tipsbonus: tipsaren är ägaren'; return null;
  end if;
  if v_lead.lead_type = 'utokning' and public.tipsbonus_installning('tipsbonus_utokning', 1) <> 1 then
    raise notice 'tipsbonus: utökning räknas inte'; return null;
  end if;
  if v_fran > 0 and to_char(coalesce(v_lead.won_at, now()) at time zone 'Europe/Stockholm', 'YYYYMMDD')::numeric < v_fran then
    raise notice 'tipsbonus: vunnen före gäller från-datumet'; return null;
  end if;

  if exists (select 1 from public.commission_posts cp
              where cp.case_id = p_lead::text and cp.commission_type = 'tipsbonus') then
    raise notice 'tipsbonus: finns redan'; return null;
  end if;

  select p.id, p.role::text as roll, p.technician_id, p.email,
         coalesce(nullif(trim(p.display_name), ''), p.email, 'Okänd') as namn
    into v_tipsare
    from public.profiles p where p.id = v_lead.tipped_by_profile_id;
  if not found then
    raise notice 'tipsbonus: tipsaren finns inte'; return null;
  end if;
  if public.tipsbonus_installning('tipsbonus_bara_tekniker', 0) = 1 and v_tipsare.roll <> 'technician' then
    raise notice 'tipsbonus: bara tekniker får bonus'; return null;
  end if;

  if coalesce(v_lead.avtal_premie, 0) > 0 then
    v_premie := v_lead.avtal_premie;
    v_underlag := 'avtalets årspremie';
  else
    v_premie := coalesce(v_lead.estimated_value, 0);
    v_underlag := 'leadens uppskattade årspremie';
  end if;
  if v_premie <= 0 then
    raise notice 'tipsbonus: ingen årspremie att räkna på'; return null;
  end if;
  if v_premie < v_min_premie then
    raise notice 'tipsbonus: årspremien under lägsta'; return null;
  end if;

  v_belopp := round(v_premie * v_procent / 100, 2);
  if v_min > 0 and v_belopp < v_min then v_belopp := v_min; end if;
  if v_max > 0 and v_belopp > v_max then v_belopp := v_max; end if;
  if v_belopp <= 0 then
    raise notice 'tipsbonus: beloppet blir 0'; return null;
  end if;

  insert into public.commission_posts (
    case_id, case_type, case_title, case_number,
    technician_id, technician_name, technician_email,
    commission_type, commission_percentage, share_percentage,
    base_amount, deductions, commission_amount, status, notes
  ) values (
    p_lead::text, 'lead', 'Tipsbonus: ' || coalesce(nullif(trim(v_lead.company_name), ''), 'lead'), null,
    coalesce(v_tipsare.technician_id, v_tipsare.id)::text, v_tipsare.namn, v_tipsare.email,
    'tipsbonus', v_procent, 100,
    v_premie, 0, v_belopp, 'pending_invoice',
    'Tipsbonus ' || replace(rtrim(to_char(v_procent, 'FM9990.99'), '.'), '.', ',') || ' % av ' || v_underlag
      || case when v_min > 0 then ', lägst ' || replace(to_char(v_min, 'FM999G999G990'), ',', ' ') || ' kr' else '' end
      || case when v_max > 0 then ', tak ' || replace(to_char(v_max, 'FM999G999G990'), ',', ' ') || ' kr' else '' end
      || case when v_lead.lead_type = 'utokning' then ' (utökning).' else '.' end
  )
  on conflict do nothing
  returning id into v_id;

  if v_id is null then return null; end if;

  insert into public.lead_activities (lead_id, kind, text, till_varde, ref_table, ref_id)
  values (p_lead, 'tipsbonus',
          'Tipsbonus bokförd till ' || v_tipsare.namn || '. Den betalas ut när första fakturan är betald.',
          'pending_invoice', 'commission_posts', v_id);

  perform public.tipsbonus_frigor(p_lead);
  return v_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. Trigger på leads: vinst skapar posten, ny kund- eller avtalskoppling provar att frigöra den.
--    Fel blir en varning och stoppar aldrig sparningen av leaden. Ingen kolumnlista: steget kan sättas
--    av leads_before_write (gammal status) och då syns det inte i UPDATE-satsens kolumner.
-- ---------------------------------------------------------------------------
create or replace function public.leads_tipsbonus()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if coalesce(current_setting('begone.leads_migrering', true), '') = 'on' then
    return null;
  end if;
  begin
    if new.stage = 'vunnen' and (tg_op = 'INSERT' or old.stage is distinct from 'vunnen') then
      perform public.tipsbonus_skapa(new.id);
    elsif tg_op = 'UPDATE' and new.stage = 'vunnen'
          and (new.customer_id is distinct from old.customer_id
               or new.agreement_contract_id is distinct from old.agreement_contract_id) then
      perform public.tipsbonus_frigor(new.id);
    end if;
  exception when others then
    raise warning 'leads_tipsbonus: lead % (%): %', new.id, sqlstate, sqlerrm;
  end;
  return null;
end;
$function$;

create or replace trigger leads_tipsbonus
  after insert or update on public.leads
  for each row execute function public.leads_tipsbonus();

-- ---------------------------------------------------------------------------
-- 7. Trigger på invoices: en betald faktura frigör väntande tipsbonusar på samma avtal eller kund.
--    Egen trigger bredvid trg_invoice_paid (handle_invoice_paid rörs inte).
-- ---------------------------------------------------------------------------
create or replace function public.handle_invoice_paid_tipsbonus()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_lead uuid;
begin
  if new.contract_id is null and new.customer_id is null then
    return null;
  end if;
  begin
    for v_lead in
      select l.id
        from public.commission_posts cp
        join public.leads l on l.id::text = cp.case_id
       where cp.case_type = 'lead' and cp.commission_type = 'tipsbonus' and cp.status = 'pending_invoice'
         and ((new.contract_id is not null and l.agreement_contract_id = new.contract_id)
              or (new.customer_id is not null and l.customer_id = new.customer_id))
    loop
      perform public.tipsbonus_frigor(v_lead);
    end loop;
  exception when others then
    raise warning 'handle_invoice_paid_tipsbonus: faktura % (%): %', coalesce(new.invoice_number, new.id::text), sqlstate, sqlerrm;
  end;
  return null;
end;
$function$;

create or replace trigger trg_invoice_paid_tipsbonus
  after update on public.invoices
  for each row when (old.status is distinct from new.status and new.status = 'paid')
  execute function public.handle_invoice_paid_tipsbonus();

create or replace trigger trg_invoice_paid_tipsbonus_insert
  after insert on public.invoices
  for each row when (new.status = 'paid')
  execute function public.handle_invoice_paid_tipsbonus();

-- Interna funktioner: bara triggrarna anropar dem
revoke all on function public.tipsbonus_skapa(uuid) from public, anon, authenticated;
revoke all on function public.tipsbonus_frigor(uuid) from public, anon, authenticated;
revoke all on function public.tipsbonus_installning(text, numeric) from public, anon, authenticated;
revoke all on function public.leads_tipsbonus() from public, anon, authenticated;
revoke all on function public.handle_invoice_paid_tipsbonus() from public, anon, authenticated;

comment on function public.tipsbonus_skapa(uuid) is
  'Tipsbonus (leads etapp 7): en commission_post (case_type lead, commission_type tipsbonus) för tipsaren när leaden vinns. Se docs/leads/ETAPP-6-7.md.';
comment on function public.tipsbonus_frigor(uuid) is
  'Tipsbonus (leads etapp 7): ready_for_payout när första fakturan för leadens avtal eller kund är betald.';
