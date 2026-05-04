-- ============================================================================
-- MANUELL SETUP — kör en gång via Supabase SQL Editor
-- ============================================================================
--
-- Detta är INTE en automatiskt körd migration. Den kräver manuell ingång
-- eftersom secrets ska genereras och bearas in.
--
-- Steg:
-- 1. Generera en slumpmässig HMAC-secret (64 hex-tecken):
--    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
--    Eller via openssl:
--    openssl rand -hex 32
--
-- 2. Sätt secreten i Edge Function:
--    Supabase Dashboard → Edge Functions → fortnox-sync → Secrets
--    Lägg till: FORTNOX_SYNC_CRON_SECRET = <din genererade secret>
--
-- 3. Sätt också Fortnox-credentials som secrets:
--    FORTNOX_CLIENT_ID, FORTNOX_CLIENT_SECRET (och FORTNOX_USE_TEST=true om test)
--
-- 4. Insert samma secret i cron_secrets-tabellen (klistra in nedan)
-- 5. Kör hela scriptet
--
-- Vad det gör:
--   - Sparar HMAC-secret i cron_secrets (RLS-låst, bara service_role kan läsa)
--   - Schemalägger fortnox-sync var 5:e minut
--   - Cron-jobbet räknar HMAC-signatur och skickar i header
--   - Edge Function verifierar signaturen, inget service role key i cron.job

-- ----------------------------------------------------------------------------
-- 1. Insert HMAC-secret i cron_secrets
-- ----------------------------------------------------------------------------
INSERT INTO cron_secrets (name, secret)
VALUES ('fortnox_sync_hmac', 'PASTE_YOUR_GENERATED_SECRET_HERE')
ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret, updated_at = now();

-- ----------------------------------------------------------------------------
-- 2. Schemalägg cron-jobb som signerar med HMAC-SHA256
-- ----------------------------------------------------------------------------
-- Kör pgcrypto-extension för hmac-funktionen
CREATE EXTENSION IF NOT EXISTS pgcrypto;

SELECT cron.schedule(
  'fortnox-sync-every-5-min',
  '*/5 * * * *',
  $$
  WITH
    secret AS (SELECT secret FROM cron_secrets WHERE name = 'fortnox_sync_hmac' LIMIT 1),
    payload AS (
      SELECT
        (extract(epoch from now()) * 1000)::bigint::text AS ts,
        '{}'::text AS body
    ),
    signed AS (
      SELECT
        p.ts,
        p.body,
        encode(
          hmac(p.ts || '.' || p.body, s.secret, 'sha256'),
          'hex'
        ) AS signature
      FROM payload p, secret s
    )
  SELECT net.http_post(
    url := 'https://rfyufytjwvqiqwueinoj.supabase.co/functions/v1/fortnox-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Timestamp', signed.ts,
      'X-Cron-Signature', signed.signature
    ),
    body := signed.body::jsonb
  ) AS request_id
  FROM signed;
  $$
);

-- ----------------------------------------------------------------------------
-- 3. Verifiera
-- ----------------------------------------------------------------------------
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'fortnox-sync-every-5-min';

-- ----------------------------------------------------------------------------
-- Felsökning
-- ----------------------------------------------------------------------------
-- Senaste körningar:
--   SELECT * FROM cron.job_run_details
--   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'fortnox-sync-every-5-min')
--   ORDER BY start_time DESC LIMIT 10;
--
-- HTTP-responses från net.http_post (pg_net lagrar dem i net.http_response_collect):
--   SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;
--
-- Pausa:
--   SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'fortnox-sync-every-5-min'), active := false);
--
-- Ta bort:
--   SELECT cron.unschedule('fortnox-sync-every-5-min');
--
-- Rotera secret (gör båda samtidigt):
--   1. Generera ny secret
--   2. UPDATE cron_secrets SET secret = '...', updated_at = now() WHERE name = 'fortnox_sync_hmac';
--   3. Uppdatera FORTNOX_SYNC_CRON_SECRET i Edge Function-secrets
