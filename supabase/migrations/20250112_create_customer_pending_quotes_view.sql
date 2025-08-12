-- Migration: Create customer_pending_quotes view for tracking quotes across all sources
-- Purpose: Unify quote tracking from both cases and contracts tables for customer portal notifications

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
    c.created_at
FROM cases c
WHERE c.customer_id IS NOT NULL
    AND c.quote_status = 'sent'
    AND c.oneflow_contract_id IS NOT NULL

UNION ALL

SELECT 
    -- From contracts table (new quotes)
    ct.id as quote_id,
    ct.customer_id,
    COALESCE(ct.agreement_text, 'Offert #' || RIGHT(ct.id::text, 6)) as case_number,
    COALESCE(ct.agreement_text, ct.company_name || ' - Offert') as title,
    ct.created_at as quote_sent_at,
    ct.oneflow_contract_id,
    'contract' as source_type,
    ct.created_at
FROM contracts ct
WHERE ct.type = 'offer'
    AND ct.status = 'pending'
    AND ct.customer_id IS NOT NULL
    AND ct.oneflow_contract_id IS NOT NULL;

-- Grant select permissions to authenticated users
GRANT SELECT ON customer_pending_quotes TO authenticated;
GRANT SELECT ON customer_pending_quotes TO anon;