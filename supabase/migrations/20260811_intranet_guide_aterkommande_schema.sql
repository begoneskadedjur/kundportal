-- ============================================================
-- Ny guide: Återkommande schema (Rondering & Schema).
-- Förlängningen av stationsguiden: efter etableringen sätter
-- teknikern upp det återkommande kontrollschemat hos kunden,
-- och koordinatorn hanterar alla scheman via Rondering & Schema.
-- Synlig för alla roller. Stationsguiden får en nästa steg-länk.
-- ============================================================

INSERT INTO intranet_documents (slug, title, summary, section, category, sort_order, requires_acknowledgement, content)
VALUES (
  'guide-aterkommande-schema',
  'Återkommande schema - kontroller på autopilot',
  'Efter etableringen: så sätter teknikern upp det återkommande kontrollschemat, och så hanterar kontoret alla scheman via Rondering & Schema.',
  'handbok',
  'utrustning',
  21,
  false,
  $json$[
    {"type":"p","text":"När stationerna är utplacerade hos en avtalskund ska de kontrolleras regelbundet under hela avtalstiden. Det sköts inte genom att boka varje besök för hand - i stället sätts ett återkommande schema upp EN gång, och sedan genereras alla stationskontrollärenden automatiskt fram till avtalets slut."},
    {"type":"chain","title":"Från etablering till löpande kontroller","steps":["Etablering","Återkommande schema","Ärenden genereras","Kontroller i fält","Rapporter"],"labels":["Stationer ut","Sätts upp en gång","Automatiskt","Teknikern","Till kunden"]},
    {"type":"h2","text":"För dig som tekniker: direkt efter etableringen"},
    {"type":"p","text":"När du placerat ut stationerna på Utrustning-sidan frågar systemet: Vill du schemalägga återkommande kontroller för kunden? Svara Ja, schemalägg och följ guiden - det tar en minut. Du kan också göra det senare via kundens schema-flik, men gör det helst direkt så glöms det inte bort."},
    {"type":"steps","items":[
      "Startdatum - när den första kontrollen ska ske.",
      "Tid per besök - hur lång tid en kontroll tar hos den här kunden.",
      "Frekvens och dag - t.ex. månadsvis och Första helgfria vardagen. Frekvensen ska matcha vad som avtalats med kunden.",
      "Klockslag - när på dagen besöken läggs.",
      "Förhandsvisning - kontrollera de genererade datumen och bekräfta. Klart!"
    ]},
    {"type":"p","text":"Schemat genererar nu stationskontrollärenden bokade på dig, hela vägen till avtalets slut. De dyker upp i ditt schema som vanliga ärenden, och koordinatorn ser dem i sitt schema och kan flytta enskilda besök vid behov."},
    {"type":"h2","text":"För kontoret: sidan Rondering & Schema"},
    {"type":"p","text":"Under Rondering & Schema finns alla återkommande scheman samlade: vilken kund, vilken tekniker, vilken frekvens och hur länge schemat räcker. Här skapar du också nya scheman - välj kund, tekniker och typ (Stationskontroll, Rondering Trafikkontoret eller Egenkontroll) och ställ in frekvensen."},
    {"type":"list","items":[
      "Frekvenser: varje vecka, varannan vecka, månadsvis, 2 gånger/månad, kvartalsvis, halvårsvis, årsvis eller anpassat intervall.",
      "Dagregler: t.ex. Första helgfria vardagen, Första måndagen eller en specifik dag i månaden - så hamnar besöken konsekvent rätt.",
      "Schemat genereras fram till kundens avtalsslut. För enheter i en kedja ärvs avtalsslutet från huvudkontoret automatiskt."
    ]},
    {"type":"callout","variant":"warning","title":"Skapa inte kontrollerna för hand","text":"Finns ett återkommande schema för kunden ska du inte skapa stationskontrollärenden manuellt i schemat - då blir det dubbla besök. Manuell Stationskontroll Avtalskund är bara för enstaka extra kontroller utanför schemat."},
    {"type":"callout","variant":"info","title":"Om avtalet förlängs eller frekvensen ändras","text":"Schemat är knutet till avtalets slutdatum och den avtalade frekvensen. Ändras avtalet - uppdatera schemat under Rondering & Schema så att genererade besök stämmer med verkligheten."},
    {"type":"link","slug":"guide-placera-stationer","label":"Placera stationer och fällor","description":"Steget före: etableringen - stationerna ut med GPS, foto och kommentar."},
    {"type":"link","slug":"guide-skapa-arenden","label":"Skapa ärenden - välj rätt ärendetyp","description":"När du skapar enstaka ärenden manuellt - och när du inte ska göra det."}
  ]$json$::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Stationsguiden får nästa steg-länken till schemat
UPDATE intranet_documents SET
  content = content || $json$[
    {"type":"link","slug":"guide-aterkommande-schema","label":"Nästa steg: sätt upp det återkommande schemat","description":"Efter etableringen schemaläggs kundens kontroller - guiden visar teknikerns snabbväg och kontorets Rondering & Schema."}
  ]$json$::jsonb
WHERE slug = 'guide-placera-stationer'
  AND NOT content::text LIKE '%guide-aterkommande-schema%';
