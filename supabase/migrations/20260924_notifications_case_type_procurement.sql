-- Notiser från upphandlingsportalen använder case_type 'procurement'.
-- Constrainten sattes senast i 20260908_tillagg_att_besluta.sql och saknade
-- värdet, vilket gav 500 från api/procurement/notify-manager.

alter table public.notifications drop constraint if exists notifications_case_type_check;
alter table public.notifications add constraint notifications_case_type_check
  check (case_type = any (array['private'::text, 'business'::text, 'contract'::text, 'customer'::text, 'procurement'::text]));
