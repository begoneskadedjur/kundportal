-- Guiden Lägg upp ett återkommande schema (3.72.1): hela avtalsperioden läggs
-- ut direkt, därefter ett år i taget (beslut Christian 2026-10-21).

update intranet_documents set
  summary = 'Boka kundens stationskontroller under Rondering & Schema. Portalen bokar hela avtalsperioden och därefter ett år i taget.',
  content = replace(replace(replace(replace(content::text,
    'Portalen bokar kontrollerna fram till avtalets periodskifte. När sista uppsägningsdag har passerat utan uppsägning läggs hela nästa avtalsår ut automatiskt.',
    'Portalen bokar kontrollerna för hela avtalsperioden. När den har passerats utan uppsägning läggs ett år i taget ut automatiskt, dagen efter sista uppsägningsdag.'),
    'Förhandsvisningen visar alla datum fram till periodskiftet.',
    'Förhandsvisningen visar alla datum fram till avtalsperiodens slut.'),
    'Kontrollerna följer avtalsåret, precis som fakturorna. Dagen efter sista uppsägningsdag läggs hela nästa avtalsår ut, om avtalet inte är uppsagt.',
    'Kontrollerna följer avtalet, precis som fakturorna. Hela avtalsperioden läggs ut direkt, även när den är flera år. När den har passerats utan uppsägning läggs ett år i taget ut, dagen efter sista uppsägningsdag.'),
    'Startdatumet ligger efter periodskiftet. Schemat skapas ändå',
    'Startdatumet ligger efter avtalsperiodens slut. Schemat skapas ändå')::jsonb,
  source_updated_at = now()
where slug = 'guide-aterkommande-schema';
