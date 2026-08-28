-- 20260828_provision_per_faktura.sql
-- Provision frigörs i takt med att fakturorna betalas.
-- APPLICERAD I PRODUKTION 2026-08-28 via MCP i fyra steg:
--   provision_per_faktura_fas1, provision_per_faktura_fas2_triggers,
--   provision_efterkontroll_betald_faktura, catch_up_paid_at_guard
--
-- PROBLEM SOM LÖSTES (två fel i motsatt riktning, båda verkliga):
--   1. handle_invoice_paid matchade bara på case_id -> en betald delfaktura
--      frigjorde HELA ärendets provision, även besök ingen betalat.
--   2. Provisionsposter skapas vid avslut, delfakturor löpande. Betalades en
--      delfaktura före avslutet fanns inga poster att flytta -> provisionen
--      fastnade permanent i pending_invoice och krävde manuell räddning.
--
-- REGEL: en faktura får visit_id bara när ALLA dess rader hör till samma besök
-- (delfaktura). Täcker fakturan flera besök lämnas fältet null (slutfaktura),
-- och då frigörs hela ärendet - korrekt, eftersom allt då är betalt.
-- Ingen heuristik, ingen risk för underfrigöring.

-- ── 1. Bär besöket hela vägen till fakturan ──────────────────────────
-- Mellantabellen för merförsäljning saknade besöksfält helt, vilket bröt
-- kedjan ärende -> besök -> faktura för adhoc-fakturor (de enda som har
-- ärendekoppling idag).
alter table contract_billing_items
  add column if not exists visit_id uuid references visits(id) on delete set null,
  add column if not exists visit_number integer;

create index if not exists idx_cbi_contract_visit
  on contract_billing_items(visit_id) where visit_id is not null;

-- Backfyllnad: härled besöket från motsvarande case_billing_items-rad
-- (kopieringen bar inte id, så matchning sker på ärende + benämning).
update contract_billing_items cbi
set visit_id = src.visit_id, visit_number = src.visit_number
from (
  select distinct on (case_id, coalesce(service_name, article_name))
         case_id, coalesce(service_name, article_name) as benamning, visit_id, visit_number
  from case_billing_items
  where visit_id is not null
  order by case_id, coalesce(service_name, article_name), created_at
) src
where cbi.case_id = src.case_id
  and cbi.article_name = src.benamning
  and cbi.visit_id is null;

-- ── 2. Triggrarna frigör bara det besök fakturan täcker ──────────────
-- Predikatet (new.visit_id is null or cp.visit_id is null or de matchar):
--   * fakturan har besök -> bara det besökets provision frigörs
--   * fakturan saknar besök -> hela ärendet (slutfaktura, årspremie)
--   * posten saknar besök (rondering, historik) -> följer ärendets betalning,
--     annars vore den inlåst för evigt
--
-- Se produktionsdefinitionen för handle_invoice_paid och
-- handle_invoice_cancelled - båda bär exakt samma predikat, spegelvänt.
-- handle_invoice_cancelled skriver dessutom systemkommentar vid backflytt
-- och när approved/paid_out-poster kräver manuell hantering (backflytten
-- syntes tidigare bara i serverloggen där ingen letar).

-- ── 3. Efterkontroll vid postskapande ────────────────────────────────
-- Löser fel 2 ovan: om fakturan för postens besök redan är betald sätts
-- posten direkt till ready_for_payout med fakturans betaldatum, och
-- utbetalningsmånaden räknas från DET datumet.
-- Ligger i DB (BEFORE INSERT) så ingen kodväg kan kringgå den.
-- paid_at is not null-villkoret är en rättelse efter validering: utan det
-- kunde en faktura med status paid men utan datum väljas och catch-up
-- hoppas över tyst.
create or replace function public.commission_post_catch_up_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_paid_at timestamptz;
begin
  if new.status is distinct from 'pending_invoice' then
    return new;
  end if;

  select i.paid_at into v_paid_at
  from invoices i
  where i.case_id::text = new.case_id
    and i.status = 'paid'
    and i.paid_at is not null
    and (
      new.visit_id is null
      or i.visit_id is null
      or i.visit_id = new.visit_id
    )
  order by i.paid_at desc
  limit 1;

  if v_paid_at is not null then
    new.status := 'ready_for_payout';
    new.invoice_paid_date := v_paid_at::date;
    new.payout_month := public.compute_payout_month(v_paid_at::date);
  end if;

  return new;
end $$;

drop trigger if exists trg_commission_post_catch_up on commission_posts;
create trigger trg_commission_post_catch_up
  before insert on commission_posts
  for each row execute function public.commission_post_catch_up_paid();

comment on function public.commission_post_catch_up_paid is
  'Satter nyskapad provisionspost till ready_for_payout direkt om fakturan for dess besok redan ar betald. Loser att poster skapade efter betalning annars fastnade i pending_invoice.';

-- ── Verifierat i produktion (transaktioner som rullades tillbaka) ────
--   * Två besök, två delfakturor, betalning av faktura 1
--     -> bara besök 1:s provision blev ready_for_payout (besök 2 orörd)
--   * Faktura betald FÖRE postskapandet
--     -> posten blev ready_for_payout direkt med fakturans betaldatum
--
-- KVARSTÅENDE (medvetet, dokumenterat): en faktura vars rader saknar
-- besöksstämpel får visit_id null och frigör därmed hela ärendet. Det är
-- den bakåtkompatibla fallbacken - äldre data får aldrig låsas in.
