-- Statusorden för kontroller (inspection_status_labels) fick ändras av vem som helst
-- som var inloggad, också en kund som anropade databasen direkt. Regeln hette
-- "Admins can update" men kontrollerade bara auth.role() = 'authenticated'.
-- Nu krävs admin (samma villkor som portalens adminsidor: role = 'admin' eller
-- is_admin, via intranet_is_admin()), både för vilka rader som får ändras och för
-- vad de får ändras till. Koordinatorer får inte ändra (Christian 2026-11-25).
-- Läsning är oförändrad: alla får läsa, kundportalen och rapporterna behöver orden.

alter policy "Admins can update inspection_status_labels"
  on public.inspection_status_labels
  using ((select public.intranet_is_admin()))
  with check ((select public.intranet_is_admin()));
