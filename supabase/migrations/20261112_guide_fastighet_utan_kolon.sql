-- Guiderna Skapa en ROT- eller RUT-offert (3.131.1): fastighetsbeteckningen
-- behöver inte ha kolon. Stockholms beteckningar har bara nummer, till
-- exempel STOCKHOLM FÄLTSKÄREN 8. Idempotent: replace() gör inget när texten
-- redan är bytt.

update public.intranet_documents
set content = replace(content::text,
      'Skriv fastighetsbeteckningen, med kolon',
      'Skriv fastighetsbeteckningen som på lagfarten')::jsonb,
    source_updated_at = now()
where slug = 'guide-rot-rut-offert-kontor'
  and content::text like '%Skriv fastighetsbeteckningen, med kolon%';

update public.intranet_documents
set content = replace(content::text,
      'Tryck på Fastighetsbeteckning och skriv den, med kolon',
      'Tryck på Fastighetsbeteckning och skriv den som på lagfarten')::jsonb,
    source_updated_at = now()
where slug = 'guide-rot-rut-offert-tekniker'
  and content::text like '%skriv den, med kolon%';
