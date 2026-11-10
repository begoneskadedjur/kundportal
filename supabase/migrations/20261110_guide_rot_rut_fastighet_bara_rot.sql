-- Guiderna Skapa en ROT- eller RUT-offert (3.127.4): fastighetsbeteckning
-- behövs bara för ROT. RUT har ingen fastighet hos Skatteverket.
-- Byter bara de meningar som sa att fastigheten krävs för båda.
-- Idempotent: replace() gör inget när texten redan är bytt.

update public.intranet_documents
set
  summary = replace(summary,
    'Välj ROT- eller RUT-mallen, välj avdraget på arbetstiden och fyll i fastighet och personnummer.',
    'Välj ROT- eller RUT-mallen, välj avdraget på arbetstiden och fyll i personnummer, för ROT också fastighet.'),
  content = replace(replace(replace(replace(content::text,
    'Privatperson med personnummer och fastighetsbeteckning, arbetstiden planerad',
    'Privatperson med personnummer, för ROT också fastighetsbeteckning, arbetstiden planerad'),
    'Du väljer [[ROT]] eller [[RUT]] på arbetstiden och fyller i fastighetsbeteckning och personnummer.',
    'Du väljer [[ROT]] eller [[RUT]] på arbetstiden och fyller i personnummer. För ROT fyller du också i fastighetsbeteckning, RUT behöver ingen fastighet.'),
    'kryssar du Bostadsrätt och skriver föreningens org.nr och lägenhetsnummer."',
    'kryssar du Bostadsrätt och skriver föreningens org.nr och lägenhetsnummer. Med RUT-mallen finns inget fält för fastighet."'),
    '"ROT rapporteras alltid som byggarbete. Du behöver inte välja typ av arbete."',
    '"ROT rapporteras alltid som byggarbete. Du behöver inte välja typ av arbete.", "Fastighetsbeteckning behövs bara för ROT. RUT har ingen fastighet."')::jsonb,
  source_updated_at = now()
where slug = 'guide-rot-rut-offert-tekniker'
  and content::text not like '%RUT har ingen fastighet%';

update public.intranet_documents
set
  summary = replace(summary,
    'stoppar tills fastighet, personnummer och arbetstid är rätt.',
    'stoppar tills personnummer, arbetstid och för ROT fastighet är rätt.'),
  content = replace(replace(replace(replace(replace(content::text,
    'Privatperson med personnummer och fastighetsbeteckning, eller bostadsrätt med föreningens org.nr och lägenhetsnummer',
    'Privatperson med personnummer. För ROT också fastighetsbeteckning, eller bostadsrätt med föreningens org.nr och lägenhetsnummer'),
    'Bostadsrätt: kryssa Bostadsrätt och skriv föreningens org.nr och lägenhetsnummer."',
    'Bostadsrätt: kryssa Bostadsrätt och skriv föreningens org.nr och lägenhetsnummer. RUT-mallen har inget fält för fastighet."'),
    'arbetstid med avdrag, fastighet, personnummer,',
    'arbetstid med avdrag, fastighet (bara ROT), personnummer,'),
    'En ROT- eller RUT-faktura stoppas om personnummer, fastighet, plats eller datum för arbetet saknas.',
    'En ROT- eller RUT-faktura stoppas om personnummer, plats eller datum för arbetet saknas, en ROT-faktura också om fastigheten saknas.'),
    'och plats, datum och fastighet som textrader.',
    'och plats och datum som textrader, för ROT också fastigheten.')::jsonb,
  source_updated_at = now()
where slug = 'guide-rot-rut-offert-kontor'
  and content::text not like '%fastighet (bara ROT)%';
