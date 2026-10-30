-- Steg 3 i docs/planer/avtalsar-exakt-arsdag-teknik.md: överlappsvakt för avtalsfakturor.
--
-- Stoppar en ny premie- eller tilläggsfaktura (invoice_type = 'contract') vars
-- period redan finns på en annan faktura av samma typ på samma avtal (eller
-- samma kunds samlingsfaktura), oavsett vilken kod som skapar den.
--
-- Regler:
--   1. Överlapp på minst halva den kortare perioden stoppas alltid (dubblett).
--   2. Vid INSERT stoppas även ett mindre överlapp mot ett utkast
--      (inte booked/sent/overdue/paid och inte F-). Mot en låst faktura eller
--      en Fortnox-import tillåts det (övergången mellan gammal och ny avtalsdag).
--
-- Undantag (passerar alltid): makulerade, historiska (is_historical), Fortnox-
-- importer (F-), adhoc-/ärendefakturor, justeringar, rader utan period.
--
-- Avvikelser från planens skiss, för att aldrig stoppa dagens flöden:
--   - UPDATE prövas bara när perioden, typen, avtalet eller samlingsflaggan
--     faktiskt ändras, eller när en makulerad faktura återställs. Ett rent
--     statusbyte (Fortnox-synken sent -> paid, godkännande pending_approval ->
--     ready) prövas inte: det ändrar inte vilka dagar som är fakturerade, och
--     synken uppdaterar flera rader i samma sats.
--   - Regel 2 (utkastregeln) gäller bara INSERT. Planera fakturor uppdaterar
--     flera utkast efter varandra, och ett tillfälligt litet överlapp mellan två
--     utkast mitt i den kedjan ska inte stoppa den.
--   - Återställning av en makulerad faktura som har ett Fortnox-nummer stoppas
--     aldrig (fakturan finns i Fortnox); den ger bara en varning i loggen.
--
-- Nödventil: i en egen transaktion i SQL-editorn
--   begin; set local app.allow_period_overlap = 'on'; ... ; commit;
--
-- Backning (Christian kör själv i SQL-editorn, MCP nekar drop):
--   drop trigger trg_invoices_period_overlap_guard on public.invoices;

create or replace function public.guard_contract_invoice_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_new_end date := coalesce(new.billing_period_end, new.billing_period_start);
  v_overlap int;
  v_share numeric;
  v_restore boolean := false;
begin
  if new.invoice_type is distinct from 'contract'
     or new.status = 'cancelled'
     or coalesce(new.is_historical, false)
     or coalesce(new.invoice_number, '') like 'F-%'
     or new.billing_period_start is null
     or coalesce(new.contract_invoice_kind, 'premium') not in ('premium', 'equipment', 'equipment_monthly') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_restore := old.status is not distinct from 'cancelled';
    if not v_restore
       and old.billing_period_start is not distinct from new.billing_period_start
       and old.billing_period_end is not distinct from new.billing_period_end
       and old.contract_invoice_kind is not distinct from new.contract_invoice_kind
       and old.contract_id is not distinct from new.contract_id
       and old.is_consolidated is not distinct from new.is_consolidated
       and old.invoice_type is not distinct from new.invoice_type
       and coalesce(old.is_historical, false) = coalesce(new.is_historical, false)
       and (coalesce(old.invoice_number, '') like 'F-%') = (coalesce(new.invoice_number, '') like 'F-%') then
      -- Bara statusbyte eller andra fält: perioden är redan prövad
      return new;
    end if;
  end if;

  if coalesce(current_setting('app.allow_period_overlap', true), '') = 'on' then
    return new;
  end if;

  for r in
    select i.id, i.invoice_number, i.status, i.billing_period_start as s,
           coalesce(i.billing_period_end, i.billing_period_start) as e
    from invoices i
    where i.id <> new.id
      and i.invoice_type = 'contract'
      and i.status <> 'cancelled'
      and coalesce(i.contract_invoice_kind, 'premium') = coalesce(new.contract_invoice_kind, 'premium')
      and (
        (new.contract_id is not null and i.contract_id = new.contract_id and not coalesce(i.is_consolidated, false))
        or (coalesce(new.is_consolidated, false) and coalesce(i.is_consolidated, false) and i.customer_id = new.customer_id)
      )
      and i.billing_period_start <= v_new_end
      and coalesce(i.billing_period_end, i.billing_period_start) >= new.billing_period_start
  loop
    v_overlap := least(r.e, v_new_end) - greatest(r.s, new.billing_period_start) + 1;
    v_share := v_overlap::numeric / greatest(least(r.e - r.s + 1, v_new_end - new.billing_period_start + 1), 1);

    if v_restore and new.fortnox_document_number is not null then
      if v_share >= 0.5 then
        raise warning 'Återställd faktura % (% t.o.m. %) överlappar faktura % (% t.o.m. %)',
          coalesce(new.invoice_number, new.id::text), new.billing_period_start, v_new_end,
          coalesce(r.invoice_number, r.id::text), r.s, r.e;
      end if;
      continue;
    end if;

    if v_share >= 0.5 then
      raise exception using errcode = '23P01',
        message = format('Perioden %s t.o.m. %s finns redan på faktura %s (%s t.o.m. %s)',
                         new.billing_period_start, v_new_end, coalesce(r.invoice_number, r.id::text), r.s, r.e);
    end if;

    if tg_op = 'INSERT'
       and r.status not in ('booked', 'sent', 'overdue', 'paid')
       and coalesce(r.invoice_number, '') not like 'F-%' then
      raise exception using errcode = '23P01',
        message = format('Perioden %s t.o.m. %s överlappar utkastet %s (%s t.o.m. %s). Ändra utkastet i stället.',
                         new.billing_period_start, v_new_end, coalesce(r.invoice_number, r.id::text), r.s, r.e);
    end if;
  end loop;

  return new;
end $$;

comment on function public.guard_contract_invoice_overlap() is
  'Överlappsvakt för avtalsfakturor (steg 3, avtalsåret på avtalsdag). Nödventil: set local app.allow_period_overlap = ''on''.';

create or replace trigger trg_invoices_period_overlap_guard
  before insert or update of billing_period_start, billing_period_end, contract_invoice_kind, contract_id, is_consolidated, status
  on public.invoices
  for each row execute function public.guard_contract_invoice_overlap();

create or replace view public.contract_invoice_overlaps
with (security_invoker = true) as
  select a.id as invoice_a, a.invoice_number as number_a, a.status as status_a,
         b.id as invoice_b, b.invoice_number as number_b, b.status as status_b,
         a.customer_id, a.contract_id, coalesce(a.contract_invoice_kind, 'premium') as kind,
         greatest(a.billing_period_start, b.billing_period_start) as overlap_from,
         least(coalesce(a.billing_period_end, a.billing_period_start), coalesce(b.billing_period_end, b.billing_period_start)) as overlap_to
  from invoices a join invoices b on a.id < b.id
   and a.invoice_type = 'contract' and b.invoice_type = 'contract'
   and a.status <> 'cancelled' and b.status <> 'cancelled'
   and coalesce(a.contract_invoice_kind, 'premium') = coalesce(b.contract_invoice_kind, 'premium')
   and coalesce(a.contract_invoice_kind, 'premium') <> 'adjustment'
   and a.customer_id = b.customer_id
   and a.contract_id is not distinct from b.contract_id
   and coalesce(a.is_consolidated, false) = coalesce(b.is_consolidated, false)
   and a.billing_period_start <= coalesce(b.billing_period_end, b.billing_period_start)
   and b.billing_period_start <= coalesce(a.billing_period_end, a.billing_period_start);

revoke all on public.contract_invoice_overlaps from anon, authenticated;

comment on view public.contract_invoice_overlaps is
  'Överlappande avtalsfakturor av samma typ på samma avtal (steg 3). Läses med service role.';
