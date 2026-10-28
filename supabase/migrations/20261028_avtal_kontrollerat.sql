-- Kontrollerat avtal (2026-10-28)
-- Ett avtal som har gåtts igenom mot det signerade avtalet och Fortnox får en
-- märkning. Vid kontrollen sparas en ögonblicksbild av fälten som avgör om
-- avtalsfakturan blir rätt (premie, premietrappa, frekvens, faktureringsmånad,
-- avtalsstart, avtalstid, kundnummer, org.nr, avtalstyp). Avviker avtalet senare
-- från bilden visas "Ändrat efter kontroll". Ingenting spärras.
-- Logiken bor i src/shared/contractReview.ts. Bara nya kolumner, inget tas bort.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_by_name text,
  ADD COLUMN IF NOT EXISTS review_snapshot jsonb;

COMMENT ON COLUMN public.contracts.reviewed_at IS 'När avtalet senast markerades som kontrollerat mot signerat avtal och Fortnox.';
COMMENT ON COLUMN public.contracts.reviewed_by IS 'profiles.id för den som kontrollerade.';
COMMENT ON COLUMN public.contracts.reviewed_by_name IS 'Namnet på den som kontrollerade.';
COMMENT ON COLUMN public.contracts.review_snapshot IS
  'Ögonblicksbild vid kontrollen (src/shared/contractReview.ts buildReviewSnapshot). Jämförs mot nuläget för läget Ändrat efter kontroll.';
