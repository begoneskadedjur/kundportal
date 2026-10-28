-- Premie att bekräfta (beslut 2026-10-28)
-- Avtal som gjorts direkt i Oneflow får premien uträknad ur produkttabellen vid
-- signeringen. Den flaggas och ska bekräftas i avtalskartan innan avtalsfakturan
-- godkänns eller skickas till Fortnox. Bara nya kolumner, inget tas bort.

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS premium_needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_review_note text,
  ADD COLUMN IF NOT EXISTS premium_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS premium_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS premium_confirmed_by_name text;

COMMENT ON COLUMN public.contracts.premium_needs_review IS
  'Premien är uträknad ur Oneflows produkttabell och väntar på bekräftelse. Spärrar avtalsfakturan.';
COMMENT ON COLUMN public.contracts.premium_review_note IS 'Förklaring som visas vid premien i avtalskartan.';
COMMENT ON COLUMN public.contracts.premium_confirmed_at IS 'När premien bekräftades eller ändrades i avtalskartan.';
COMMENT ON COLUMN public.contracts.premium_confirmed_by IS 'profiles.id för den som bekräftade.';
COMMENT ON COLUMN public.contracts.premium_confirmed_by_name IS 'Namnet på den som bekräftade.';
