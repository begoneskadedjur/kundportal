-- Faktureringsansvarig: utsedda personer (flera möjliga) godkänner fakturor
-- innan de kan skickas som utkast till Fortnox.
-- profiles.can_approve_invoices styr vem som ser godkänn-åtgärderna.
-- invoices.approved_by/approved_by_name loggar vem som godkände (approved_at finns redan).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS can_approve_invoices boolean NOT NULL DEFAULT false;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_by_name text;
