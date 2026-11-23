-- Fakturanummer byggs bara på uppåt (3.132.20, Christian 2026-11-23).
--
-- Tidigare: klienten föreslog nästa INV-ÅÅÅÅMM-nnnn (InvoiceService räknade
-- antalet fakturor i månaden som den inloggade ser plus ett, de andra tre
-- förslagsfunktionerna tog högsta plus ett), och triggern
-- trg_invoices_assign_free_number bytte bara numret när förslaget var upptaget
-- eller ett reservnummer (6+ siffror). Ett ledigt förslag behölls. När fakturor
-- tagits bort fanns luckor, och en tekniker (som bara ser sina egna fakturor)
-- fick ett lågt förslag som hamnade i en lucka, t.ex. INV-202611-0006 när
-- högsta numret var 0171.
--
-- Nu: databasen äger numreringen. För varje ny rad med formen INV-ÅÅÅÅMM-siffror
-- tar triggern nästa nummer ur räknaren för prefixet, oavsett förslaget. Nästa
-- nummer är större än både räknarens värde och det högsta löpnummer (1-5
-- siffror) som finns i invoices, så att räknaren läker sig om en rad läggs in
-- förbi triggern. Räknarraden låses av insert ... on conflict do update, så två
-- samtidiga fakturor får aldrig samma nummer. Räknaren ligger i samma
-- transaktion som fakturan och backar om infogningen misslyckas. Luckor uppstår
-- bara när en faktura tas bort, och numret återanvänds aldrig.
--
-- Orörda: F-nummer (Fortnox-import), HIST-nummer och allt annat som inte har
-- INV-ÅÅÅÅMM-formen, liksom tomt eller null nummer (kolumnen tillåter null, och
-- så har det varit). Befintliga nummer och luckor ändras inte.
-- Förslagsfunktionerna i koden finns kvar (kolumnens värde måste ha rätt prefix)
-- men det slutliga numret sätts här och läses tillbaka efter infogningen.
--
-- Backa: kör om funktionen invoices_assign_free_number från
-- 20261023_rls_oneflow_logg_fakturor.sql (avsnitt 2c). Räknartabellen kan stå kvar.

create table if not exists public.invoice_number_counters (
  prefix text primary key,
  last_seq integer not null,
  updated_at timestamptz not null default now()
);

comment on table public.invoice_number_counters is
  'Senast utdelade löpnummer per INV-ÅÅÅÅMM-prefix. Ägs av triggerfunktionen invoices_assign_free_number, rörs aldrig av klienten.';

alter table public.invoice_number_counters enable row level security;
revoke all on table public.invoice_number_counters from anon, authenticated;

-- Startvärden: högsta löpnummer (1-5 siffror) per prefix. Reservnummer (6+) räknas inte.
insert into public.invoice_number_counters (prefix, last_seq)
select substring(i.invoice_number from '^(INV-[0-9]{6})-') as prefix,
       max(substring(i.invoice_number from '-([0-9]{1,5})$')::int) as last_seq
  from public.invoices i
 where i.invoice_number ~ '^INV-[0-9]{6}-[0-9]{1,5}$'
 group by 1
on conflict (prefix) do update
  set last_seq = greatest(public.invoice_number_counters.last_seq, excluded.last_seq),
      updated_at = now();

create or replace function public.invoices_assign_free_number()
returns trigger
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_prefix text;
  v_max integer;
  v_seq integer;
begin
  if new.invoice_number ~ '^INV-[0-9]{6}-[0-9]+$' then
    v_prefix := substring(new.invoice_number from '^(INV-[0-9]{6})-');
    -- Högsta löpnummer som faktiskt finns (1-5 siffror, reservnummer räknas inte)
    select coalesce(max(substring(i.invoice_number from '-([0-9]{1,5})$')::int), 0)
      into v_max
      from public.invoices i
     where i.invoice_number ~ ('^' || v_prefix || '-[0-9]{1,5}$');
    -- Atomärt: raden låses tills transaktionen är klar
    insert into public.invoice_number_counters as c (prefix, last_seq, updated_at)
    values (v_prefix, v_max + 1, now())
    on conflict (prefix) do update
      set last_seq = greatest(c.last_seq, v_max) + 1,
          updated_at = now()
    returning c.last_seq into v_seq;
    -- lpad kortar strängar längre än längden, därav greatest
    new.invoice_number := v_prefix || '-' || lpad(v_seq::text, greatest(4, length(v_seq::text)), '0');
  end if;
  return new;
end;
$fn$;

comment on function public.invoices_assign_free_number() is
  'Sätter nästa INV-ÅÅÅÅMM-löpnummer ur invoice_number_counters (alltid uppåt, aldrig återanvänt). Andra nummerformer lämnas orörda.';

create or replace trigger trg_invoices_assign_free_number
  before insert on public.invoices
  for each row execute function public.invoices_assign_free_number();
