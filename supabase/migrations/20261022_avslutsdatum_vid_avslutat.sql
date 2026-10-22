-- Avslutsdatum sätts när ärendet får status Avslutat, i alla tre ärendetabellerna.
--
-- Bakgrund: privat- och företagsärenden fick completed_date av ClickUp-webhooken.
-- När ClickUp togs bort (slutet av augusti 2026) slutade fältet fyllas, eftersom
-- EditCaseModal bara satte det för cases. Rondering- och egenkontrollmodalen
-- satte det aldrig. Triggern gör regeln gemensam för alla vägar till Avslutat
-- (modaler, utrustningssidan, stationskontrollen, API, kommande teknikervy).
--
-- Regeln:
--   * status ändras till Avslutat och inget nytt datum skickas med -> nu.
--     Det gäller även ett ärende som avslutas igen efter återbesök: det gamla
--     datumet ersätts av det nya avslutet.
--   * ett nytt datum som skickas med i samma uppdatering behålls
--     (EditContractCaseModal, stationskontrollen, utrustningssidan)
--   * triggern nollar aldrig datumet. Den som lämnar Avslutat sköter det som
--     i dag, så att fakturakedjan (useInvoiceCaseChain) beter sig som förut.

create or replace function public.satt_avslutsdatum()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'Avslutat' and new.completed_date is null then
      new.completed_date := now();
    end if;
    return new;
  end if;

  if new.status = 'Avslutat'
     and old.status is distinct from 'Avslutat'
     and (new.completed_date is null
          or new.completed_date is not distinct from old.completed_date) then
    new.completed_date := now();
  end if;

  return new;
end;
$$;

create trigger satt_avslutsdatum
  before insert or update of status on public.cases
  for each row execute function public.satt_avslutsdatum();

create trigger satt_avslutsdatum
  before insert or update of status on public.private_cases
  for each row execute function public.satt_avslutsdatum();

create trigger satt_avslutsdatum
  before insert or update of status on public.business_cases
  for each row execute function public.satt_avslutsdatum();
