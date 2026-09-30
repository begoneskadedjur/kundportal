-- Guiden Tilläggsstationer: kontrollrundans knappar heter Spara och ta bort / Ta bort ändå
update intranet_documents
set content = replace(content::text,
  'trycker teknikern en gång till, på Klicka igen för att ta bort.',
  'trycker teknikern en gång till. I kontrollrundan heter knappen då Ta bort ändå, i stationsformuläret Klicka igen för att ta bort.')::jsonb,
    updated_at = now()
where slug = 'guide-tillaggsstationer'
  and content::text like '%trycker teknikern en gång till, på Klicka igen för att ta bort.%';
