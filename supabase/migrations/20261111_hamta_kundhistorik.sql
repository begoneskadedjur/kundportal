-- 3.130.0: Kundhistorik för tekniker.
-- En tekniker får bara läsa ärenden hen själv står på (cases_select_scoped), så
-- tidigare besök hos en avtalskund som en kollega gjort syns inte. Att vidga
-- läsregeln på cases skulle påverka etableringsflödet, specialrapportsökningen
-- och djuplänkar, så historiken läses i stället via den här funktionen. Den
-- returnerar bara avslutade ärenden, bara läsning, och bara för kunder där
-- teknikern har minst ett eget ärende. Admin och koordinator ser alla kunder.
-- Teknikerkopplingen läses direkt ur profiles.technician_id oavsett roll (samma
-- skäl som technician_absences_las_egen: tekniker med rollen säljare).

CREATE OR REPLACE FUNCTION public.hamta_kundhistorik(
  p_customer_id uuid,
  p_utom_case_id uuid DEFAULT NULL,
  p_antal integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  case_number text,
  title text,
  service_type text,
  pest_type text,
  completed_date timestamptz,
  scheduled_start timestamptz,
  tekniker text,
  work_report text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_personal boolean;
  v_tekniker uuid;
BEGIN
  IF p_customer_id IS NULL THEN
    RETURN;
  END IF;

  SELECT s.is_staff INTO v_personal FROM public.my_case_scope() s;
  SELECT p.technician_id INTO v_tekniker
    FROM public.profiles p
   WHERE p.user_id = (SELECT auth.uid()) AND p.technician_id IS NOT NULL
   LIMIT 1;

  IF NOT COALESCE(v_personal, false) THEN
    IF v_tekniker IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.cases c
       WHERE c.customer_id = p_customer_id
         AND c.deleted_at IS NULL
         AND v_tekniker IN (c.primary_technician_id, c.secondary_technician_id, c.tertiary_technician_id)
    ) THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT c.id,
         c.case_number::text,
         c.title::text,
         c.service_type::text,
         c.pest_type::text,
         c.completed_date,
         c.scheduled_start,
         NULLIF(concat_ws(', ', c.primary_technician_name, c.secondary_technician_name, c.tertiary_technician_name), '')::text,
         c.work_report::text
    FROM public.cases c
   WHERE c.customer_id = p_customer_id
     AND c.deleted_at IS NULL
     AND c.completed_date IS NOT NULL
     AND c.status IS DISTINCT FROM 'Borttaget'
     AND (p_utom_case_id IS NULL OR c.id <> p_utom_case_id)
   ORDER BY c.completed_date DESC
   LIMIT LEAST(GREATEST(COALESCE(p_antal, 20), 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.hamta_kundhistorik(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hamta_kundhistorik(uuid, uuid, integer) TO authenticated;
