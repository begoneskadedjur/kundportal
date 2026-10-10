-- Leads etapp 5 (2026-10-10): contracts.source_type får värdet 'lead' (offert eller avtal skapat
-- från en lead i Oneflow-guiden, source_id = leads.id) och notiser får case_type 'lead'
-- (tipsaren får notis när tipset blir offert och vunnet). Checkarna byts i samma sats.
alter table public.contracts drop constraint contracts_source_type_check,
  add constraint contracts_source_type_check check (source_type = any (array['private_case'::text, 'business_case'::text, 'manual'::text, 'lead'::text]));
alter table public.notifications drop constraint notifications_case_type_check,
  add constraint notifications_case_type_check check (case_type = any (array['private'::text, 'business'::text, 'contract'::text, 'customer'::text, 'procurement'::text, 'web_inquiry'::text, 'lead'::text]));
