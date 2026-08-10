-- 20260810_incident_iso_fields.sql
-- ISO-fält för strukturerad avvikelsehantering (9001/14001/45001):
-- klassificering, grundorsaksanalys, beslutad åtgärd med ansvarig och deadline,
-- uppföljning samt signerat avslut. Ny status 'avslutad' efter uppföljning.

ALTER TABLE case_incidents
  ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('miljo','kvalitet','arbetsmiljo')),
  ADD COLUMN IF NOT EXISTS immediate_action text,
  ADD COLUMN IF NOT EXISTS authority_report text CHECK (authority_report IN ('ja','nej')),
  ADD COLUMN IF NOT EXISTS why_occurred text,
  ADD COLUMN IF NOT EXISTS root_cause text,
  ADD COLUMN IF NOT EXISTS responsible_name text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS follow_up text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by_name text;

ALTER TABLE case_incidents DROP CONSTRAINT case_incidents_status_check;
ALTER TABLE case_incidents ADD CONSTRAINT case_incidents_status_check
  CHECK (status IN ('ny','under_utredning','atgardad','avslutad'));
