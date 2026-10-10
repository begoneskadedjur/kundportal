-- Leads etapp 3: säkerhetsrådgivaren (function_search_path_mutable) på kontaktsynk-triggrarna.
alter function public.sync_primary_contact_to_lead() set search_path to 'public', 'pg_temp';
alter function public.sync_lead_primary_contact() set search_path to 'public', 'pg_temp';
