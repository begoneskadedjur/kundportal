// api/import-customer-by-orgnr.ts
// Importerar en kund från Fortnox + Oneflow baserat på org.nummer
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getValidAccessToken } from './fortnox/refresh'
import fetch from 'node-fetch'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const ONEFLOW_API_TOKEN = process.env.ONEFLOW_API_TOKEN!
const FORTNOX_API = 'https://api.fortnox.se/3'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Normalisera org.nr: ta bort allt utom siffror, lägg sedan tillbaka bindestreck (XXXXXX-XXXX)
function normalizeOrgNr(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) {
    return `${digits.slice(0, 6)}-${digits.slice(6)}`
  }
  return digits // returnera as-is om inte 10 siffror
}

const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// Hämta kund från Fortnox via org.nummer
async function fetchFortnoxCustomerByOrgNr(orgNr: string) {
  const accessToken = await getValidAccessToken()

  // Fortnox stöder sökning med organisationsnummer
  const url = `${FORTNOX_API}/customers?organisationnumber=${encodeURIComponent(orgNr)}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    console.error('❌ Fortnox sökning misslyckades:', res.status, res.statusText)
    return null
  }

  const data = await res.json() as { Customers: any[] }
  const customers = data.Customers ?? []

  if (customers.length === 0) {
    // Fortnox API med organisationnumber-filter kan vara opålitligt – prova med filter=active
    // Alternativt: hämta lista och matcha manuellt (sista utväg)
    console.log('⚠️ Ingen kund hittad med org.nr-sökning, provar lista-sökning...')
    return await fetchFortnoxCustomerByOrgNrFromList(orgNr, accessToken)
  }

  // Hämta full kunddata med kundnummer
  const customerNumber = customers[0].CustomerNumber
  return await fetchFortnoxCustomerFull(customerNumber, accessToken)
}

// Söker igenom Fortnox-kundlistan och matchar på org.nummer (fallback)
async function fetchFortnoxCustomerByOrgNrFromList(orgNr: string, accessToken: string) {
  const orgNrDigits = orgNr.replace(/\D/g, '')
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const url = `${FORTNOX_API}/customers?page=${page}&limit=100`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) break

    const data = await res.json() as {
      Customers: any[]
      MetaInformation: { '@TotalPages': number }
    }
    totalPages = data.MetaInformation?.['@TotalPages'] ?? 1
    const customers = data.Customers ?? []

    const match = customers.find((c: any) => {
      const cDigits = (c.OrganisationNumber || '').replace(/\D/g, '')
      return cDigits === orgNrDigits
    })

    if (match) {
      return await fetchFortnoxCustomerFull(match.CustomerNumber, accessToken)
    }

    page++
  }

  return null
}

async function fetchFortnoxCustomerFull(customerNumber: string, accessToken: string) {
  const url = `${FORTNOX_API}/customers/${customerNumber}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) return null
  const data = await res.json() as { Customer: any }
  return data.Customer ?? null
}

// Hjälpfunktion: hämta fullständig kontraktsdata (inkl. parties) i ett anrop
async function fetchOneflowContractFull(contractId: number, headers: Record<string, string>) {
  const [contractRes, partiesRes] = await Promise.all([
    fetch(`https://api.oneflow.com/v1/contracts/${contractId}`, { headers }),
    fetch(`https://api.oneflow.com/v1/contracts/${contractId}/parties`, { headers }),
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

// Hämta senast signerade Oneflow-kontrakt för ett org.nr
// Strategi: hämta alla kontrakt i ett bulk-anrop (limit 200),
// kolla inline om org.nr syns i kontraktets _private/_parties-data,
// annars batch-hämta fullständiga kontrakt parallellt (10 åt gången).
async function fetchOneflowContractByOrgNr(orgNr: string) {
  const orgNrDigits = orgNr.replace(/\D/g, '')
  const headers = {
    'x-oneflow-api-token': ONEFLOW_API_TOKEN,
    'x-oneflow-user-email': 'info@begone.se',
    Accept: 'application/json',
  }

  // Hämta alla kontrakt i ett anrop (Oneflow tillåter max 200 per sida)
  const listRes = await fetch('https://api.oneflow.com/v1/contracts?limit=200&offset=0', { headers })
  if (!listRes.ok) {
    console.error('❌ Oneflow list API-fel:', listRes.status)
    return null
  }

  const listData = await listRes.json() as { data: any[]; count: number }
  const allContracts: any[] = listData.data ?? []
  console.log(`📋 Oneflow: ${allContracts.length} kontrakt totalt`)

  // Steg 1: försök matcha direkt på data som redan finns i list-svaret
  // (Oneflow inkluderar ibland identification_number i _private-strukturen)
  const quickMatch = allContracts.find((c: any) => {
    const parties: any[] = c.parties?.data ?? c.parties ?? []
    const counterParty = parties.find((p: any) => !p.my_party)
    if (!counterParty) return false
    const digits = (counterParty.identification_number || '').replace(/\D/g, '')
    return digits === orgNrDigits
  })

  if (quickMatch) {
    console.log(`✅ Direkt match i list-svar: kontrakt ${quickMatch.id}`)
    const full = await fetchOneflowContractFull(quickMatch.id, headers)
    return full
  }

  // Steg 2: batch-hämta fullständiga kontrakt parallellt (10 åt gången)
  // Prioritera signed/active kontrakt, hoppa över draft
  const candidates = allContracts.filter((c: any) => c.state !== 'draft')
  console.log(`🔍 Batch-söker bland ${candidates.length} icke-draft kontrakt (10 parallellt)`)

  const BATCH_SIZE = 10
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map((c: any) => fetchOneflowContractFull(c.id, headers).catch(() => null))
    )

    for (const result of results) {
      if (!result) continue
      const counterParty = result.parties.find((p: any) => !p.my_party)
      if (!counterParty) continue
      const digits = (counterParty.identification_number || '').replace(/\D/g, '')
      if (digits === orgNrDigits) {
        console.log(`✅ Match hittad i batch: kontrakt ${result.contract.id}`)
        return result
      }
    }
  }

  return null
}

// Extrahera data från Oneflow-kontrakt
function extractOneflowData(contractData: { contract: any; parties: any[] }) {
  const { contract, parties } = contractData
  const customerParty = parties.find((p: any) => !p.my_party)

  // Extrahera data_fields
  const dataFields: Record<string, string> = {}
  const fields: any[] = Array.isArray(contract.data_fields) ? contract.data_fields : []
  for (const field of fields) {
    const customId = field.custom_id || field._private_ownerside?.custom_id
    if (customId && field.value) {
      dataFields[customId] = field.value
    }
  }

  // Fältmappning (matchar CONTRACT_FIELD_MAPPING i import-contracts.ts)
  const contact_person = dataFields['Kontaktperson']
    || customerParty?.participants?.[0]?.name
    || null

  const contact_email = dataFields['e-post-kontaktperson']
    || customerParty?.participants?.[0]?.email
    || null

  const contact_phone = dataFields['telefonnummer-kontaktperson']
    || customerParty?.participants?.[0]?.phone
    || null

  const contact_address = dataFields['utforande-adress'] || null

  const contract_start_date = parseDate(dataFields['begynnelsedag']) || null
  const contract_length = dataFields['avtalslngd'] || null
  const company_name_oneflow = dataFields['foretag'] || customerParty?.name || null

  // Extrahera totalt värde från products
  let annual_value: number | null = null
  const products: any[] = contract.product_groups
    ? contract.product_groups.flatMap((g: any) => g.products || [])
    : contract.products ?? []

  if (products.length > 0) {
    annual_value = products.reduce((sum: number, p: any) => {
      const amount = parseFloat(p.total_amount?.amount ?? p.unit_price?.amount ?? '0')
      const qty = p.quantity ?? 1
      return sum + amount * qty
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

// Huvudfunktion
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Endast POST tillåtet' })
  }

  try {
    const { org_nr } = req.body

    if (!org_nr) {
      return res.status(400).json({ success: false, error: 'org_nr krävs' })
    }

    const normalized = normalizeOrgNr(String(org_nr))
    if (normalized.replace(/\D/g, '').length !== 10) {
      return res.status(400).json({ success: false, error: 'Ogiltigt org.nummer – måste vara 10 siffror' })
    }

    console.log('🔍 Importerar kund med org.nr:', normalized)

    // Dublettkoll
    const { data: existing } = await supabase
      .from('customers')
      .select('id, company_name, customer_number')
      .eq('organization_number', normalized)
      .single()

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Kund finns redan i systemet`,
        existing_customer: {
          id: existing.id,
          company_name: existing.company_name,
          customer_number: existing.customer_number,
        },
      })
    }

    // Hämta från Fortnox
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

    console.log('✅ Fortnox-kund hittad:', fortnoxCustomer.Name)

    // Hämta från Oneflow
    console.log('📋 Hämtar från Oneflow...')
    const oneflowData = await fetchOneflowContractByOrgNr(normalized).catch(err => {
      console.error('⚠️ Oneflow-fel:', err.message)
      return null
    })

    const oneflow = oneflowData ? extractOneflowData(oneflowData) : null
    if (oneflow) {
      console.log('✅ Oneflow-kontrakt hittad:', oneflow.oneflow_contract_id)
    } else {
      console.log('⚠️ Inget Oneflow-kontrakt hittades – importerar med enbart Fortnox-data')
    }

    // Bygg billing_address från Fortnox
    const billingParts = [
      fortnoxCustomer.Address1,
      fortnoxCustomer.Address2,
      [fortnoxCustomer.ZipCode, fortnoxCustomer.City].filter(Boolean).join(' '),
    ].filter(Boolean)
    const billing_address = billingParts.length > 0 ? billingParts.join(', ') : null

    // Bygg kundpost
    const customerInsert: Record<string, any> = {
      company_name: fortnoxCustomer.Name,
      organization_number: normalized,
      customer_number: parseInt(fortnoxCustomer.CustomerNumber) || null,
      billing_email: fortnoxCustomer.EmailInvoice || fortnoxCustomer.Email || null,
      billing_address,
      currency: fortnoxCustomer.Currency || 'SEK',
      source_type: 'import',
      is_active: fortnoxCustomer.Active !== false,

      // Oneflow-data (om tillgänglig)
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

    const { data: inserted, error: insertError } = await supabase
      .from('customers')
      .insert(customerInsert)
      .select()
      .single()

    if (insertError || !inserted) {
      console.error('❌ Databasfel vid insert:', insertError)
      return res.status(500).json({
        success: false,
        error: 'Kunde inte spara kunden i databasen',
        details: insertError?.message,
      })
    }

    console.log('✅ Kund importerad:', inserted.id)

    return res.status(200).json({
      success: true,
      customer: inserted,
      sources: {
        fortnox: true,
        oneflow: !!oneflow,
      },
      message: oneflow
        ? `Kund importerad från Fortnox + Oneflow`
        : `Kund importerad från Fortnox (inget Oneflow-avtal hittades)`,
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
