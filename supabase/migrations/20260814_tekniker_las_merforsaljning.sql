-- Tekniker kunde skapa merförsäljningsrader vid ärendeavslut men inte LÄSA
-- tillbaka dem. Fakturagenereringen läser raderna direkt efter insert, fick
-- noll rader av RLS och avslutade tyst som "inget att fakturera" - ärendet
-- såg avslutat ut, raderna blev liggande ofakturerade.
--
-- Tekniker får nu läsa och uppdatera ad hoc-rader för ärenden de är
-- tilldelade (primär, sekundär eller tertiär). Uppdateringsrätten behövs
-- för att stämpla raderna med invoice_id + status när fakturan skapas.
-- Insert-policyn är oförändrad; admin/koordinator har fortsatt full åtkomst.

CREATE OR REPLACE FUNCTION technician_owns_case(p_case_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM cases c
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE c.id = p_case_id
      AND p.technician_id IS NOT NULL
      AND p.technician_id IN (c.primary_technician_id, c.secondary_technician_id, c.tertiary_technician_id)
  );
$$;

COMMENT ON FUNCTION technician_owns_case IS
  'True om inloggad användare är tekniker tilldelad ärendet (primär/sekundär/tertiär). Används av RLS för merförsäljningsrader.';

DROP POLICY IF EXISTS "Tekniker laser ad-hoc billing items i egna arenden" ON contract_billing_items;
CREATE POLICY "Tekniker laser ad-hoc billing items i egna arenden"
  ON contract_billing_items FOR SELECT
  USING (item_type = 'ad_hoc' AND case_id IS NOT NULL AND technician_owns_case(case_id));

DROP POLICY IF EXISTS "Tekniker uppdaterar ad-hoc billing items i egna arenden" ON contract_billing_items;
CREATE POLICY "Tekniker uppdaterar ad-hoc billing items i egna arenden"
  ON contract_billing_items FOR UPDATE
  USING (item_type = 'ad_hoc' AND case_id IS NOT NULL AND technician_owns_case(case_id));
