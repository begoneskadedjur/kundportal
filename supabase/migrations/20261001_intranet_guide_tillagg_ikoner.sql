-- Guiden Tilläggsstationer, Admin: ikoner per stationstyp och per produkt
update intranet_documents
set content = replace(content::text,
  '"Kundpriserna för tillägg sätts i prislistorna, se Var priset kommer ifrån."',
  '"Ikonknappen på produktraden ger produkten en egen ikon. Stationer med produkten visar den i stället för stationstypens ikon.", "Stationstypens ikon väljer du under Ikon. Dagens fem knappar finns kvar och Alla ikoner fäller ned hela listan, ritad efter produkterna ni använder.", "Kundpriserna för tillägg sätts i prislistorna, se Var priset kommer ifrån."')::jsonb,
    updated_at = now()
where slug = 'guide-tillaggsstationer'
  and content::text like '%Kundpriserna för tillägg sätts i prislistorna%'
  and content::text not like '%Ikonknappen på produktraden%';
