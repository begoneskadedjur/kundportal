-- ═══════════════════════════════════════════════════════════════
-- Varaktig utrustning och återbetalningsgräns
-- Plan: docs/varaktig-utrustning-marginal-plan.md
--
-- Dyra produkter (fällor, stationer) står kvar hos kunden i flera år och
-- betalas tillbaka av avtalet, inte av fakturan. Marginalen drog tidigare
-- hela inköpet från ETT års intäkt och visade minus på bra affärer.
-- Flaggan gör att motorn (src/shared/marginEngine.ts) kan skilja
-- engångskostnad från löpande. Ingen avskrivning: bokföringen rörs inte.
-- ═══════════════════════════════════════════════════════════════

alter table public.articles
  add column if not exists is_durable boolean not null default false;
comment on column public.articles.is_durable is
  'Varaktig utrustning som står kvar hos kunden i flera år (stationer, fällor). Engångskostnad i marginalen, inte löpande. Aldrig arbetstid, förbrukning eller egna verktyg.';

alter table public.pricing_settings
  add column if not exists max_payback_years numeric not null default 2.0;
comment on column public.pricing_settings.max_payback_years is
  'Varning på avtal när varaktig utrustning tar längre än så många år att återbetala via täckningsbidraget.';

-- Förval, granskas i artikelregistret. Fångstbur duvor är ett verktyg
-- (aldrig obevakad längre än ett dygn) och flaggas inte.
update public.articles set is_durable = true
where code in (
  '405220', '405221', '405231',
  '102102', '102230', '101204', '101202',
  '199508',
  'BEK-BET', '502005', '500501',
  '502001', '502002', '502010',
  'AVLOPPSFALLA',
  '799161', '799080', '799086', 'DAD001D',
  '407002',
  '301900'
);
