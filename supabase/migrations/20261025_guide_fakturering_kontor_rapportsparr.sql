-- Kontorets faktureringsguide: rapporten krävs innan ärendet avslutas (3.96.0, 2026-10-24).
-- Lägger till en felsökningsfråga och en punkt under Bra att veta. Idempotent.
update public.intranet_documents d
set content = (
  select jsonb_agg(
    case
      when t.e->>'type' = 'felsok' then jsonb_set(t.e, '{items}', (t.e->'items') || jsonb_build_array(jsonb_build_object(
        'fraga', 'Det står Skriv rapporten innan ärendet avslutas. Beskriv vad du gjorde.',
        'svar', 'Ärendet kan inte få status Avslutat förrän rapporten är skriven: Saneringsrapport i privat- och företagsärenden och Arbetsrapport i avtalsbesök och ronderingar. Rapporten finns i fliken Utförande. Be teknikern skriva den, eller skriv den själv, och tryck [[Spara ändringar]] igen.'
      )))
      when t.e->>'type' = 'bra' then jsonb_set(t.e, '{items}', (t.e->'items') || to_jsonb(
        'Slutfakturan skapas först när ärendet avslutas, och det kräver en skriven rapport. Kontroller och etableringar dokumenteras i stationerna och behöver ingen skriven rapport.'::text
      ))
      else t.e
    end
    order by t.ord)
  from jsonb_array_elements(d.content) with ordinality as t(e, ord)
),
source_updated_at = now()
where d.slug = 'guide-fakturering-kontor'
  and d.content::text not like '%Skriv rapporten innan ärendet avslutas%';
