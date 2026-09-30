-- ============================================================
-- Guiden Tilläggsstationer: justeringar 2026-09-30.
--  a) Rutan "Det finns ingen roll som heter kundansvarig" tas bort.
--  c) Frågan om borttag beskriver varningen "betald till och med" och
--     andra klicket (Klicka igen för att ta bort).
--  d) Ny fråga: fakturan skapas innan tilläggen är beslutade.
-- Blocken matchas på innehåll, inte index (index kan ha flyttats).
-- Handboksguider versionsbumpas inte vid innehållsändringar.
-- Tabellen "Vem gör vad" och steg 8 ligger i komponenterna under
-- src/pages/shared/intranet/interactive/tillagg/.
-- ============================================================

UPDATE intranet_documents d
SET content = (
  SELECT jsonb_agg(x.block ORDER BY x.ord, x.sub)
  FROM (
    -- Alla block utom rutan om kundansvarig, med ny text i borttagsfrågan
    SELECT e.ord, 0 AS sub,
      CASE
        WHEN e.block->>'type' = 'p' AND e.block->>'text' LIKE 'Nej, det blir inga krediteringar.%'
        THEN jsonb_build_object('type', 'p', 'text',
          'Nej, det blir inga krediteringar. När en tekniker tar bort en tilläggsstation som redan är betald framåt visas datumet den är betald till och med, och att den inte faktureras från nästa period. Låt stationen stå kvar om kunden inte uttryckligen vill ta bort den. Vill kunden det ändå trycker teknikern en gång till, på Klicka igen för att ta bort. Nästa tilläggsfaktura räknas på de stationer som står ute då. Tas den sista tilläggsstationen på enheten bort går arbetstiden till 0.')
        ELSE e.block
      END AS block
    FROM jsonb_array_elements(d.content) WITH ORDINALITY AS e(block, ord)
    WHERE NOT (e.block->>'type' = 'callout' AND e.block->>'title' = 'Det finns ingen roll som heter kundansvarig')

    UNION ALL

    -- Ny fråga direkt efter svaret på "Vad händer om ingen beslutar tilläggen?"
    SELECT e.ord, n.sub, n.block
    FROM jsonb_array_elements(d.content) WITH ORDINALITY AS e(block, ord)
    CROSS JOIN (VALUES
      (1, $json${"type":"h3","text":"Fakturan skapas innan tilläggen är beslutade. Hur hänger det ihop?"}$json$::jsonb),
      (2, $json${"type":"p","text":"När ärendet stängs skapas merförsäljningsfakturan för Betalas nu direkt, oberoende av beslutet i avtalskartan. Den kan godkännas och skickas även om tilläggen inte är beslutade, eftersom beloppet är detsamma oavsett om man sedan väljer Tillägg utöver avtalet eller Lägg till i avtalet. Beslutet styr bara vad som händer från nästa periodstart. Görs inget beslut har kunden betalat fram till periodstart, stationerna står kvar som brickor att besluta, notisen och Kräver åtgärd ligger kvar, och ingen årsdebitering skapas."}$json$::jsonb)
    ) AS n(sub, block)
    WHERE e.block->>'type' = 'p' AND e.block->>'text' LIKE 'Kunden betalar delen för nu när ärendet stängs%'
  ) x
),
updated_at = now()
WHERE d.slug = 'guide-tillaggsstationer'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(d.content) e
    WHERE e->>'text' = 'Fakturan skapas innan tilläggen är beslutade. Hur hänger det ihop?'
  );
