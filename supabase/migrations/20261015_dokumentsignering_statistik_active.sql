-- Dokumentsigneringens statistik: aktiva avtal med signeringsdatum är signerade.
--
-- Triggern contract_signed_becomes_active byter signed → active direkt när
-- avtalets startdag redan passerat, så ett avtal som signeras på eller efter
-- startdagen står aldrig som 'signed'. Här räknas sådana avtal som signerade
-- (samma regel som isSignedDocument i src/shared/documentStatus.ts).
-- Bara dokument från nya systemet (created_by_email satt), som förut.
create or replace function public.dokumentsignering_statistik(
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_tech_emails text[] default null::text[]
)
returns jsonb
language sql
stable
as $function$
WITH docs AS (
  SELECT id,
         CASE WHEN status = 'active' THEN 'signed' ELSE status END AS status,
         selected_products, begone_employee_email
  FROM contracts c
  WHERE (status IN ('pending','signed','overdue','declined')
         OR (status = 'active' AND signed_at IS NOT NULL))
    AND created_at >= p_from AND created_at < p_to
    AND c.created_by_email IS NOT NULL
    AND (
      p_tech_emails IS NULL
      OR lower(coalesce(begone_employee_email, '')) = ANY(p_tech_emails)
      OR lower(coalesce(created_by_email, '')) = ANY(p_tech_emails)
    )
),
produkter AS (
  SELECT
    p->>'name' AS name,
    count(*) AS antal,
    round(sum(coalesce(
      nullif(p#>>'{price_2,amount,amount}','')::numeric,
      nullif(p#>>'{price_1,amount,amount}','')::numeric,
      0
    ))) AS varde
  FROM docs c,
       jsonb_array_elements(coalesce(c.selected_products, '[]'::jsonb)) g,
       jsonb_array_elements(coalesce(g->'products', '[]'::jsonb)) p
  WHERE coalesce(p->>'name','') <> ''
  GROUP BY 1
  ORDER BY antal DESC, varde DESC
  LIMIT 15
),
tjanster AS (
  SELECT
    b.service_name AS name,
    count(DISTINCT b.case_id) AS dokument,
    round(sum(b.total_price)) AS varde,
    count(DISTINCT b.case_id) FILTER (WHERE d.status = 'signed') AS signerade
  FROM case_billing_items b
  JOIN docs d ON d.id = b.case_id
  WHERE b.case_type = 'contract' AND b.item_type = 'service'
    AND coalesce(b.service_name, '') <> ''
    AND b.status <> 'cancelled'
  GROUP BY 1
  ORDER BY dokument DESC, varde DESC
  LIMIT 15
),
marginal_per_dok AS (
  SELECT
    d.id,
    d.status,
    lower(d.begone_employee_email) AS tech_email,
    sum(b.total_price) FILTER (WHERE b.item_type = 'service') AS intakt,
    coalesce(sum(b.total_price) FILTER (WHERE b.item_type = 'article'), 0) AS kostnad
  FROM case_billing_items b
  JOIN docs d ON d.id = b.case_id
  WHERE b.case_type = 'contract' AND b.status <> 'cancelled'
  GROUP BY d.id, d.status, d.begone_employee_email
  HAVING sum(b.total_price) FILTER (WHERE b.item_type = 'service') > 0
     AND sum(b.total_price) FILTER (WHERE b.item_type = 'article') IS NOT NULL
)
SELECT jsonb_build_object(
  'produkter', (SELECT coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) FROM produkter p),
  'tjanster', (SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM tjanster t),
  'marginaler', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'tech_email', m.tech_email,
      'marginal_pct', round(((m.intakt - m.kostnad) / m.intakt * 100)::numeric, 1),
      'intakt', round(m.intakt)
    )), '[]'::jsonb)
    FROM marginal_per_dok m
  )
)
$function$;
