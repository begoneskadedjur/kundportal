-- 20260810_drop_incident_recipient_flag.sql
-- Gamla boolean-flaggan ersatt av incident_recipients (mottagare per typ).
-- All kodanvändning borttagen i samma leverans.

ALTER TABLE profiles DROP COLUMN IF EXISTS incident_recipient;
