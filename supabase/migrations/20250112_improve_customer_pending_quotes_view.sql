-- Migration: Improve customer_pending_quotes view for better quote display
-- Purpose: Fix duplicate text issue and provide better information for customers

CREATE OR REPLACE VIEW customer_pending_quotes AS
SELECT 
    -- From cases table (legacy quotes)
    c.id as quote_id,
    c.customer_id,
    c.case_number,
    c.title,
    c.quote_sent_at,
    c.oneflow_contract_id,
    'case' as source_type,
    c.created_at,
    NULL::text as company_name,
    NULL::text as products
FROM cases c
WHERE c.customer_id IS NOT NULL
    AND c.quote_status = 'sent'
    AND c.oneflow_contract_id IS NOT NULL

UNION ALL

SELECT 
    -- From contracts table (new quotes)
    ct.id as quote_id,
    ct.customer_id,
    -- Use a proper quote number instead of agreement_text
    CASE 
        WHEN ct.agreement_text IS NOT NULL AND ct.agreement_text != '' 
             AND LENGTH(ct.agreement_text) < 50
        THEN ct.agreement_text
        ELSE 'Offert #' || RIGHT(ct.id::text, 6)
    END as case_number,
    -- Use company name instead of duplicating agreement_text
    COALESCE(ct.company_name, 'BeGone Skadedjursbekämpning') as title,
    ct.created_at as quote_sent_at,
    ct.oneflow_contract_id,
    'contract' as source_type,
    ct.created_at,
    ct.company_name,
    -- Extract product names from selected_products JSON
    CASE 
        WHEN ct.selected_products IS NOT NULL THEN
            (SELECT STRING_AGG(
                COALESCE(
                    product->>'name',
                    product->'product'->>'name'
                ), 
                ', '
            )
            FROM jsonb_array_elements(ct.selected_products) AS product)
        ELSE NULL
    END as products
FROM contracts ct
WHERE ct.type = 'offer'
    AND ct.status = 'pending'
    AND ct.customer_id IS NOT NULL
    AND ct.oneflow_contract_id IS NOT NULL;

-- Grant select permissions to authenticated users
GRANT SELECT ON customer_pending_quotes TO authenticated;
GRANT SELECT ON customer_pending_quotes TO anon;