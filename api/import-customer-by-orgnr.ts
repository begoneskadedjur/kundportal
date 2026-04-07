// api/import-customer-by-orgnr.ts
// Importerar en kund från Fortnox + Oneflow baserat på org.nummer
// action=preview: hämtar och returnerar data utan att spara
// action=confirm: sparar den (eventuellt redigerade) datan
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getValidAccessToken } from './fortnox/refresh'
import fetch from 'node-fetch'

// Stöder både SUPABASE_SERVICE_KEY och SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const FORTNOX_API = 'https://api.fortnox.se/3'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Normalisera org.nr: ta bort allt utom siffror, lägg sedan tillbaka bindestreck (XXXXXX-XXXX)
function normalizeOrgNr(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) {
    return `${digits.slice(0, 6)}-${digits.slice(6)}`
  }
  return digits
}

const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// ─── Fortnox ─────────────────────────────────────────────────────────────────

async function fetchFortnoxCustomerByOrgNr(orgNr: string) {
  const accessToken = await getValidAccessToken()
  const orgNrDigits = orgNr.replace(/\D/g, '')

  // Försök direkt filtrering på organisationsnummer
  const url = `${FORTNOX_API}/customers?organisationnumber=${encodeURIComponent(orgNr)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })

  if (res.ok) {
    const data = await res.json() as { Customers: any[] }
    const customers = data.Customers ?? []
    if (customers.length > 0) {
      return await fetchFortnoxCustomerFull(customers[0].CustomerNumber, accessToken)
    }
  }

  // Fallback: iterera sidvis och matcha manuellt
  console.log('⚠️ Direktfilter gav inget – söker manuellt i kundlista...')
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const pageRes = await fetch(`${FORTNOX_API}/customers?page=${page}&limit=100`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (!pageRes.ok) break

    const pageData = await pageRes.json() as {
      Customers: any[]
      MetaInformation: { '@TotalPages': number }
    }
    totalPages = pageData.MetaInformation?.['@TotalPages'] ?? 1
    const match = (pageData.Customers ?? []).find((c: any) => {
      return (c.OrganisationNumber || '').replace(/\D/g, '') === orgNrDigits
    })
    if (match) return await fetchFortnoxCustomerFull(match.CustomerNumber, accessToken)
    page++
  }

  return null
}

async function fetchFortnoxCustomerFull(customerNumber: string, accessToken: string) {
  const res = await fetch(`${FORTNOX_API}/customers/${customerNumber}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) return null
  const data = await res.json() as { Customer: any }
  return data.Customer ?? null
}

// ─── Oneflow ──────────────────────────────────────────────────────────────────

const oneflowHeaders = () => ({
  'x-oneflow-api-token': ONEFLOW_API_TOKEN,
  'x-oneflow-user-email': 'info@begone.se',
  Accept: 'application/json',
})

async function fetchOneflowContractFull(contractId: number) {
  const h = oneflowHeaders()
  const [contractRes, partiesRes] = await Promise.all([
    fetch(`https://api.oneflow.com/v1/contracts/${contractId}`, { headers: h }),
    fetch(`https://api.oneflow.com/v1/contracts/${contractId}/parties`, { headers: h }),
  ])
  if (!contractRes.ok) return null
  const contract = await contractRes.json() as any
  let parties: any[] = []
  if (partiesRes.ok) {
    const pd = await partiesRes.json() as any
    parties = Array.isArray(pd) ? pd : pd.data ?? []
  }
  return { contract, parties }
}

async function fetchOneflowContractByOrgNr(orgNr: string) {
  const orgNrDigits = orgNr.replace(/\D/g, '')

  // Hämta alla kontrakt i ett anrop
  const listRes = await fetch('https://api.oneflow.com/v1/contracts?limit=200&offset=0', {
    headers: oneflowHeaders(),
  })
  if (!listRes.ok) {
    console.error('❌ Oneflow list API-fel:', listRes.status)
    return null
  }

  const listData = await listRes.json() as { data: any[] }
  const allContracts: any[] = listData.data ?? []
  console.log(`📋 Oneflow: ${allContracts.length} kontrakt totalt`)

  // Steg 1: direktmatch på inline parties i list-svaret
  const quickMatch = allContracts.find((c: any) => {
    const parties: any[] = c.parties?.data ?? c.parties ?? []
    const counterParty = parties.find((p: any) => !p.my_party)
    if (!counterParty) return false
    return (counterParty.identification_number || '').replace(/\D/g, '') === orgNrDigits
  })

  if (quickMatch) {
    console.log(`✅ Direktmatch i list-svar: kontrakt ${quickMatch.id}`)
    return fetchOneflowContractFull(quickMatch.id)
  }

  // Steg 2: parallell batch-sökning (10 åt gången), skippa draft
  const candidates = allContracts.filter((c: any) => c.state !== 'draft')
  console.log(`🔍 Batch-söker bland ${candidates.length} kontrakt (10 parallellt)`)

  const BATCH_SIZE = 10
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map((c: any) => fetchOneflowContractFull(c.id).catch(() => null))
    )
    for (const result of results) {
      if (!result) continue
      const counterParty = result.parties.find((p: any) => !p.my_party)
      if (!counterParty) continue
      if ((counterParty.identification_number || '').replace(/\D/g, '') === orgNrDigits) {
        console.log(`✅ Match i batch: kontrakt ${result.contract.id}`)
        return result
      }
    }
  }

  return null
}

function extractOneflowData(contractData: { contract: any; parties: any[] }) {
  const { contract, parties } = contractData
  const customerParty = parties.find((p: any) => !p.my_party)

  const dataFields: Record<string, string> = {}
  const fields: any[] = Array.isArray(contract.data_fields) ? contract.data_fields : []
  for (const field of fields) {
    const customId = field.custom_id || field._private_ownerside?.custom_id
    if (customId && field.value) dataFields[customId] = field.value
  }

  const contact_person =
    dataFields['Kontaktperson'] || customerParty?.participants?.[0]?.name || null
  const contact_email =
    dataFields['e-post-kontaktperson'] || customerParty?.participants?.[0]?.email || null
  const contact_phone =
    dataFields['telefonnummer-kontaktperson'] || customerParty?.participants?.[0]?.phone || null
  const contact_address = dataFields['utforande-adress'] || null
  const contract_start_date = parseDate(dataFields['begynnelsedag']) || null
  const contract_length = dataFields['avtalslngd'] || null
  const company_name_oneflow = dataFields['foretag'] || customerParty?.name || null

  // Produktvärde
  let annual_value: number | null = null
  const products: any[] = contract.product_groups
    ? contract.product_groups.flatMap((g: any) => g.products || [])
    : contract.products ?? []

  if (products.length > 0) {
    annual_value = products.reduce((sum: number, p: any) => {
      const amount = parseFloat(p.total_amount?.amount ?? p.unit_price?.amount ?? '0')
      return sum + amount * (p.quantity ?? 1)
    }, 0)
  }

  const selectedProducts = products.map((p: any) => ({
    name: p.name,
    quantity: p.quantity,
    price: parseFloat(p.unit_price?.amount ?? '0'),
    description: p.description ?? '',
  }))

  return {
    contact_person,
    contact_email,
    contact_phone,
    contact_address,
    contract_start_date,
    contract_length,
    company_name_oneflow,
    annual_value: annual_value && annual_value > 0 ? annual_value : null,
    products: selectedProducts.length > 0 ? selectedProducts : null,
    oneflow_contract_id: String(contract.id),
  }
}

function parseDate(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return null
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Endast POST tillåtet' })

  try {
    const { action, org_nr, customer_data } = req.body

    // ── CONFIRM: spara redan hämtad+redigerad data ───────────────────────────
    if (action === 'confirm') {
      if (!customer_data) {
        return res.status(400).json({ success: false, error: 'customer_data krävs för confirm' })
      }

      const normalized = normalizeOrgNr(String(customer_data.organization_number || ''))

      // Dublettkoll igen (säkerhet)
      const { data: existing } = await supabase
        .from('customers')
        .select('id, company_name')
        .eq('organization_number', normalized)
        .maybeSingle()

      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Kund finns redan i systemet',
          existing_customer: existing,
        })
      }

      const { data: inserted, error: insertError } = await supabase
        .from('customers')
        .insert({ ...customer_data, organization_number: normalized, source_type: 'import' })
        .select()
        .single()

      if (insertError || !inserted) {
        console.error('❌ DB insert fel:', insertError)
        return res.status(500).json({
          success: false,
          error: 'Kunde inte spara kunden',
          details: insertError?.message,
        })
      }

      return res.status(200).json({ success: true, customer: inserted })
    }

    // ── PREVIEW: hämta data men spara inte ──────────────────────────────────
    if (!org_nr) {
      return res.status(400).json({ success: false, error: 'org_nr krävs' })
    }

    const normalized = normalizeOrgNr(String(org_nr))
    if (normalized.replace(/\D/g, '').length !== 10) {
      return res.status(400).json({ success: false, error: 'Ogiltigt org.nummer – måste vara 10 siffror' })
    }

    console.log('🔍 Preview för org.nr:', normalized)

    // Dublettkoll
    const { data: existing } = await supabase
      .from('customers')
      .select('id, company_name, customer_number')
      .eq('organization_number', normalized)
      .maybeSingle()

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Kund finns redan i systemet',
        existing_customer: existing,
      })
    }

    // Fortnox
    console.log('📊 Hämtar från Fortnox...')
    const fortnoxCustomer = await fetchFortnoxCustomerByOrgNr(normalized).catch(err => {
      console.error('⚠️ Fortnox-fel:', err.message)
      return null
    })

    if (!fortnoxCustomer) {
      return res.status(404).json({
        success: false,
        error: 'Kund hittades inte i Fortnox. Kontrollera att org.numret stämmer.',
      })
    }

    console.log('✅ Fortnox-kund:', fortnoxCustomer.Name)

    // Oneflow
    console.log('📋 Hämtar från Oneflow...')
    const oneflowData = await fetchOneflowContractByOrgNr(normalized).catch(err => {
      console.error('⚠️ Oneflow-fel:', err.message)
      return null
    })

    const oneflow = oneflowData ? extractOneflowData(oneflowData) : null
    console.log(oneflow ? `✅ Oneflow-kontrakt: ${oneflow.oneflow_contract_id}` : '⚠️ Inget Oneflow-kontrakt')

    // Bygg förslag på kunddata (ej sparat ännu)
    const billingParts = [
      fortnoxCustomer.Address1,
      fortnoxCustomer.Address2,
      [fortnoxCustomer.ZipCode, fortnoxCustomer.City].filter(Boolean).join(' '),
    ].filter(Boolean)

    const preview = {
      company_name: fortnoxCustomer.Name,
      organization_number: normalized,
      customer_number: parseInt(fortnoxCustomer.CustomerNumber) || null,
      billing_email: fortnoxCustomer.EmailInvoice || fortnoxCustomer.Email || null,
      billing_address: billingParts.length > 0 ? billingParts.join(', ') : null,
      currency: fortnoxCustomer.Currency || 'SEK',
      is_active: fortnoxCustomer.Active !== false,
      contact_person: oneflow?.contact_person ?? null,
      contact_email: oneflow?.contact_email ?? null,
      contact_phone: oneflow?.contact_phone ?? null,
      contact_address: oneflow?.contact_address ?? null,
      contract_start_date: oneflow?.contract_start_date ?? null,
      contract_length: oneflow?.contract_length ?? null,
      annual_value: oneflow?.annual_value ?? null,
      products: oneflow?.products ?? null,
      oneflow_contract_id: oneflow?.oneflow_contract_id ?? null,
    }

    return res.status(200).json({
      success: true,
      preview,
      sources: { fortnox: true, oneflow: !!oneflow },
    })
  } catch (err: any) {
    console.error('❌ Import-fel:', err)
    return res.status(500).json({
      success: false,
      error: 'Internt serverfel',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
}
