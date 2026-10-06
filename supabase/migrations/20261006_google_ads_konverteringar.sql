-- 20261006_google_ads_konverteringar.sql
-- Offline-konverteringar från Leads (Webb) till Google Ads (godkänt av Christian 2026-10-06).
--
-- Nattjobbet api/cron/google-ads-konverteringar.ts laddar upp två konverteringar per förfrågan:
--   bokat      "Bokat uppdrag (kundportalen)": förfrågan har fått ett ärende (private_cases eller
--              business_cases) eller en signerad offert. Tidpunkt = det som kom först.
--   genomfort  "Genomfört uppdrag (kundportalen)": förfrågan har utfallet Vunnen, dvs. ärendet är
--              fakturerat (sätts av web_inquiries_berakna_utfall()). Tidpunkt = fakturerad_at.
--
-- Bara förfrågningar där besökaren samtyckt till marknadsföring (details.samtycke_marknadsforing) och
-- som har ett klick-id (gclid, gbraid, wbraid) eller e-post/telefon för förbättrade konverteringar.
-- Befintliga avtalskunder (arende_tabell = 'cases', status befintlig_kund) och skräp räknas aldrig.
--
-- Värden, alltid exklusive moms:
--   * ärendets fakturaunderlag i case_billing_items: anpassat pris (case_billing_overrides, lagras exkl.)
--     annars summan av tjänsteraderna, annars artiklar som inte hör till en tjänst (samma regel som
--     invoiceService). Utan underlag: ärendets pris, där business_cases.pris är exkl. moms och
--     private_cases.pris inkl. moms (delas med 1,25, samma tolkning som Dashboard och ekonomivyerna).
--   * offert: offertens rader i case_billing_items (exkl.), annars contracts.total_value / 1,25
--     (Oneflows produktpriser är inkl. moms, stämmer mot raderna på alla offerter med rader).
--   * genomfört: summan av invoices.subtotal (exkl. moms) för ärendets fakturor, annars ärendets värde.
-- Saknas värde för ett bokat uppdrag väntar jobbet upp till tre dygn på att priset sätts, sedan
-- skickas konverteringen utan värde (åtgärdens standardvärde gäller).
--
-- Idempotens: en rad per (inquiry_id, typ). Status uppladdad och hoppad hämtas aldrig igen; fel
-- försöks igen högst tre gånger. Ads får dessutom transactionId = '<inquiry_id>-<typ>' (kolumnen order_id).
-- Uppladdningen går via Data Manager API (events:ingest); Google Ads API:s uploadClickConversions
-- är stängt för nya integrationer.

create table if not exists public.google_ads_konverteringar (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.web_inquiries(id) on delete cascade,
  typ text not null check (typ in ('bokat', 'genomfort')),
  klick_id_typ text not null check (klick_id_typ in ('gclid', 'gbraid', 'wbraid', 'ingen')),
  varde numeric(12, 2),
  valuta text not null default 'SEK',
  conversion_date_time text not null, -- ISO 8601 i svensk tid med offset, som den skickades
  order_id text not null, -- transactionId i Data Manager API: '<inquiry_id>-<typ>'
  status text not null check (status in ('uppladdad', 'fel', 'hoppad')),
  forsok integer not null default 1,
  uppladdad_at timestamptz,
  request_id text, -- Data Manager API:s requestId för anropet
  request_status text, -- bearbetningens utfall (SUCCESS, PARTIAL_SUCCESS, FAILED, PROCESSING), hämtas nästa natt
  svar jsonb,
  fel text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (inquiry_id, typ)
);

comment on table public.google_ads_konverteringar is
  'Offline-konverteringar (Bokat/Genomfört uppdrag) uppladdade till Google Ads av nattjobbet google-ads-konverteringar. En rad per förfrågan och typ.';

create index if not exists google_ads_konverteringar_request_idx
  on public.google_ads_konverteringar (request_id) where request_id is not null;

alter table public.google_ads_konverteringar enable row level security;
-- Inga policyer: bara service role (nattjobbet) läser och skriver.
revoke all on table public.google_ads_konverteringar from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ärendets värde exkl. moms ur fakturaunderlaget, annars ärendets pris.

create or replace function public.google_ads_arendevarde(p_tabell text, p_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with typ as (
    select case p_tabell when 'private_cases' then 'private' when 'business_cases' then 'business' end as t
  ),
  rader as (
    select b.item_type, b.mapped_service_id, b.total_price
    from public.case_billing_items b, typ
    where b.case_id = p_id and b.case_type = typ.t and coalesce(b.status, '') <> 'cancelled'
  ),
  underlag as (
    select coalesce(
      (select o.custom_total_price from public.case_billing_overrides o, typ
        where o.case_id = p_id::text and o.case_type = typ.t and o.custom_total_price > 0
        order by o.updated_at desc nulls last limit 1),
      nullif((select sum(total_price) from rader where item_type = 'service'), 0),
      nullif((select sum(total_price) from rader where item_type = 'article' and mapped_service_id is null), 0)
    ) as v
  )
  select coalesce(
    (select v from underlag),
    case p_tabell
      when 'business_cases' then (select nullif(bc.pris, 0) from public.business_cases bc where bc.id = p_id)
      when 'private_cases' then (select round(nullif(pc.pris, 0) / 1.25, 2) from public.private_cases pc where pc.id = p_id)
    end
  );
$$;

-- Offertens värde exkl. moms.
create or replace function public.google_ads_offertvarde(p_contract uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    nullif((select sum(b.total_price) from public.case_billing_items b
            where b.case_type = 'contract' and b.case_id = p_contract
              and coalesce(b.status, '') <> 'cancelled'
              and (b.item_type = 'service' or b.mapped_service_id is null)), 0),
    (select round(nullif(c.total_value, 0) / 1.25, 2) from public.contracts c where c.id = p_contract)
  );
$$;

-- ---------------------------------------------------------------------------
-- Urvalet för nattjobbet: konverteringar som ska laddas upp (eller markeras som för gamla).

create or replace function public.google_ads_konverteringar_urval()
returns table (
  inquiry_id uuid,
  typ text,
  gclid text,
  gbraid text,
  wbraid text,
  email text,
  phone text,
  klick_tid timestamptz,
  tidpunkt timestamptz,
  varde numeric,
  for_gammal boolean,
  forsok integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with bas as (
    select w.*
    from public.web_inquiries w
    where w.details ->> 'samtycke_marknadsforing' = 'true'
      and w.status not in ('skrap', 'befintlig_kund')
      and (w.arende_tabell is null or w.arende_tabell in ('private_cases', 'business_cases'))
      and (
        coalesce(nullif(btrim(w.gclid), ''), nullif(btrim(w.gbraid), ''), nullif(btrim(w.wbraid), '')) is not null
        or nullif(btrim(w.email), '') is not null
        or nullif(btrim(w.phone), '') is not null
      )
  ),
  bokat as (
    select b.id, 'bokat'::text as typ,
      least(
        case when b.arende_id is not null then b.bokad_at end,
        case when c.status = 'signed' then coalesce(c.status_updated_at, c.updated_at) end
      ) as tid,
      coalesce(
        case when b.arende_id is not null then public.google_ads_arendevarde(b.arende_tabell, b.arende_id) end,
        case when c.status = 'signed' then public.google_ads_offertvarde(c.id) end
      ) as varde
    from bas b
    left join public.contracts c on c.id = b.offert_contract_id
    where (b.arende_id is not null and b.bokad_at is not null) or c.status = 'signed'
  ),
  genomfort as (
    select b.id, 'genomfort'::text as typ, b.fakturerad_at as tid,
      coalesce(
        nullif((select sum(i.subtotal) from public.invoices i
                where i.case_id = b.arende_id
                  and i.case_type = case b.arende_tabell when 'private_cases' then 'private' else 'business' end
                  and i.status in ('booked', 'sent', 'paid', 'overdue')), 0),
        public.google_ads_arendevarde(b.arende_tabell, b.arende_id)
      ) as varde
    from bas b
    where b.status = 'vunnen' and b.fakturerad_at is not null and b.arende_id is not null
  ),
  alla as (
    select * from bokat where tid is not null
    union all
    select * from genomfort
  )
  select
    b.id, a.typ, nullif(btrim(b.gclid), ''), nullif(btrim(b.gbraid), ''), nullif(btrim(b.wbraid), ''),
    nullif(btrim(b.email), ''), nullif(btrim(b.phone), ''),
    b.created_at,
    -- En konvertering får aldrig ligga före klicket; förfrågan kom in efter klicket.
    greatest(a.tid, b.created_at + interval '1 minute'),
    a.varde,
    greatest(a.tid, b.created_at) > b.created_at + interval '89 days',
    coalesce(k.forsok, 0)
  from alla a
  join bas b on b.id = a.id
  left join public.google_ads_konverteringar k on k.inquiry_id = a.id and k.typ = a.typ
  where (k.id is null or (k.status = 'fel' and k.forsok < 3))
    -- Bokat utan värde: vänta upp till tre dygn på att priset sätts.
    and not (a.typ = 'bokat' and a.varde is null and a.tid > now() - interval '3 days');
$$;

revoke execute on function public.google_ads_arendevarde(text, uuid) from public, anon, authenticated;
revoke execute on function public.google_ads_offertvarde(uuid) from public, anon, authenticated;
revoke execute on function public.google_ads_konverteringar_urval() from public, anon, authenticated;
grant execute on function public.google_ads_arendevarde(text, uuid) to service_role;
grant execute on function public.google_ads_offertvarde(uuid) to service_role;
grant execute on function public.google_ads_konverteringar_urval() to service_role;
