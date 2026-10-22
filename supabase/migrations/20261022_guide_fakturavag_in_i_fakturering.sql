-- Fakturavägen sätts automatiskt sedan 3.79.0, så den är ingen egen uppgift
-- (Christian 2026-10-22: "Varför ska det här vara en separat guide när vi har
-- faktura guides redan?"). Den separata guiden guide-fakturavag avpubliceras
-- och fakturavägen beskrivs i Fakturera från ärende till betalning, där man
-- öppnar fakturan och ser vart den går. Felsökningen där har redan frågan om
-- fakturavägen som saknas.

update public.intranet_documents
set is_published = false, source_updated_at = current_date
where slug = 'guide-fakturavag';

-- Länken under Läs också (del 8, avslut) tas bort
update public.intranet_documents
set content = jsonb_set(
      content,
      '{7,lankar}',
      coalesce(
        (select jsonb_agg(l) from jsonb_array_elements(content -> 7 -> 'lankar') l where l ->> 'slug' <> 'guide-fakturavag'),
        '[]'::jsonb
      )
    ),
    source_updated_at = current_date
where slug = 'guide-fakturering-kontor'
  and content -> 7 ->> 'type' = 'avslut';

-- Steg 2 (fakturan öppnas): rutan Fakturaväg
update public.intranet_documents
set content = jsonb_set(
      content,
      '{2,steg,1,ser}',
      to_jsonb('Fakturan öppnas. Rutan Fakturaväg överst visar vart fakturan går: e-post, e-faktura eller brev. Vägen sätts automatiskt ur avtalet och ändras på kundsidan under fliken Fakturering. En delfaktura är märkt ◔ Delfaktura, och Ärendets fakturakedja visar ärendets alla fakturor.'::text)
    ),
    source_updated_at = current_date
where slug = 'guide-fakturering-kontor'
  and content -> 2 ->> 'type' = 'visning'
  and content -> 2 -> 'steg' -> 1 ->> 'ser' like 'Fakturan öppnas.%';
