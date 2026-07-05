-- Unikt index: max en aktiv provisionspost per tekniker och ärende.
--
-- upsertPostsForCase (provisionService.ts) kör delete + insert i två steg.
-- Utan detta index kan två parallella sparningar av samma ärende ge
-- dubblettposter (båda läser befintliga rader, båda raderar, båda insertar).
-- Partiellt (exkluderar cancelled) så att ett framtida "makulera och gör om"-
-- flöde inte blockeras av historiska makulerade rader.
--
-- Verifierat 2026-07-05 innan applicering: inga befintliga dubbletter
-- (SELECT case_id, technician_id, count(*) ... HAVING count(*) > 1 gav 0 rader).

CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_posts_case_technician_active
  ON commission_posts (case_id, technician_id)
  WHERE status != 'cancelled';
