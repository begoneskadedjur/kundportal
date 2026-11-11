-- 3.128.5: Den som är kopplad till en tekniker ser sin egen frånvaro oavsett roll.
-- technician_absences_consolidated släpper bara igenom profiles.role = 'technician',
-- så en tekniker med rollen säljare (Jimmy Shamon) såg inte möten, admin och
-- kundbesök som koordinatorn lagt in. Bara läsrätt, skrivregeln är oförändrad.

CREATE POLICY technician_absences_las_egen
  ON public.technician_absences
  FOR SELECT
  TO authenticated
  USING (
    technician_id IN (
      SELECT p.technician_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.technician_id IS NOT NULL
    )
  );
