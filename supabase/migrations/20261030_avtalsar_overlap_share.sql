-- Steg 7 i docs/planer/avtalsar-exakt-arsdag-teknik.md: en gemensam överlappsandel.
--
-- contract_period_overlap_share(a_start, a_end, b_start, b_end) = dagar i snittet
-- delat med dagarna i den KORTARE perioden, båda ändar med; 0 när perioderna
-- inte möts. Det är exakt uttrycket som överlappsvakten (steg 3) räknade inne i
-- loopen. Vakten anropar nu funktionen i stället för att räkna själv, och
-- portalens matchning för avtal med exakt avtalsdag (periodOverlapShare i
-- src/shared/contractInvoiceMatch.ts) räknar likadant. scripts/regression/
-- overlap-share-twin.mts jämför TS och SQL.
--
-- guard_contract_invoice_overlap: dagens definition ordagrant (samma som
-- 20261030_invoice_period_overlap_guard.sql), utom att v_overlap/v_share-raderna
-- ersatts av anropet. Backning: kör create or replace function ur
-- 20261030_invoice_period_overlap_guard.sql igen (ingen drop behövs; den nya
-- funktionen kan stå kvar).

create or replace function public.contract_period_overlap_share(
  p_a_start date, p_a_end date, p_b_start date, p_b_end date
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when least(p_a_end, p_b_end) < greatest(p_a_start, p_b_start) then 0::numeric
    else (least(p_a_end, p_b_end) - greatest(p_a_start, p_b_start) + 1)::numeric
         / greatest(least(p_a_end - p_a_start + 1, p_b_end - p_b_start + 1), 1)
  end
$$;

comment on function public.contract_period_overlap_share(date, date, date, date) is
  'Överlappsandel mot den kortare perioden, båda ändar med (steg 7, avtalsåret på avtalsdag). Samma regel som periodOverlapShare i TS.';

create or replace function public.guard_contract_invoice_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_new_end date := coalesce(new.billing_period_end, new.billing_period_start);
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
    -- Steg 7: samma andel som portalens matchning (periodOverlapShare i
    -- src/shared/contractInvoiceMatch.ts), räknad i en gemensam funktion.
    v_share := public.contract_period_overlap_share(r.s, r.e, new.billing_period_start, v_new_end);

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

