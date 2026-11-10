// Låser payloaden som sendInvoiceToFortnox skickar till Fortnox (3.125.0).
// Supabase och Fortnox är mockade: inga riktiga utkast skapas. Raderna,
// märkningen och leveransadressen byggs med de riktiga delade funktionerna.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// --- Supabase: tabell -> svar, och alla update-anrop sparas -----------------
const db = vi.hoisted(() => ({
  single: {} as Record<string, unknown>,
  list: {} as Record<string, unknown[]>,
  updates: [] as Array<{ table: string; payload: unknown; filters: Array<[string, unknown]> }>,
}))

vi.mock('../lib/supabase', () => {
  const from = (table: string) => {
    const state = { op: 'select', payload: null as unknown, filters: [] as Array<[string, unknown]> }
    const b: Record<string, unknown> = {}
    const chain = () => b
    Object.assign(b, {
      select: chain,
      in: chain,
      is: chain,
      neq: chain,
      order: chain,
      limit: chain,
      eq: (c: string, v: unknown) => { state.filters.push([c, v]); return b },
      update: (p: unknown) => { state.op = 'update'; state.payload = p; return b },
      maybeSingle: () => Promise.resolve({ data: db.single[table] ?? null, error: null }),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
        if (state.op === 'update') {
          db.updates.push({ table, payload: state.payload, filters: state.filters })
          return Promise.resolve({ data: null, error: null }).then(res, rej)
        }
        return Promise.resolve({ data: db.list[table] ?? [], error: null }).then(res, rej)
      },
    })
    return b
  }
  return { supabase: { from } }
})

const m = vi.hoisted(() => ({
  getInvoice: vi.fn(),
  updateInvoiceStatus: vi.fn(),
  premium: vi.fn(),
  findOrCreateCustomer: vi.fn(),
  ensureArticles: vi.fn(),
  createInvoice: vi.fn(),
  createTaxReduction: vi.fn(),
  refresh: vi.fn(),
  resolveNumber: vi.fn(),
  allocate: vi.fn(),
  getOrCreateCaseCustomer: vi.fn(),
  termsDays: vi.fn(),
  deliveryFor: vi.fn(),
  adopt: vi.fn(),
  comment: vi.fn(),
  fetchVisit: vi.fn(),
  fetchAddons: vi.fn(),
}))

vi.mock('./invoiceService', () => ({
  InvoiceService: { getInvoice: m.getInvoice, updateInvoiceStatus: m.updateInvoiceStatus },
}))
vi.mock('./premiumReviewService', () => ({
  PremiumReviewService: { getUnconfirmedContractIdsForInvoice: m.premium },
}))
vi.mock('./fortnoxService', async () => {
  const shared = await vi.importActual<typeof import('../shared/fortnoxCustomerNumbers')>('../shared/fortnoxCustomerNumbers')
  return {
    isPersonnummer: shared.isPersonnummer,
    FortnoxService: {
      findOrCreateCustomer: m.findOrCreateCustomer,
      ensureArticlesExistForInvoiceItems: m.ensureArticles,
      createInvoice: m.createInvoice,
      createTaxReduction: m.createTaxReduction,
    },
  }
})
vi.mock('./contractInvoiceGenerator', () => ({
  ContractInvoiceGenerator: { refreshContractInvoiceBeforeSend: m.refresh },
}))
vi.mock('../utils/fortnoxCustomerResolver', () => ({ resolveFortnoxCustomerNumber: m.resolveNumber }))
vi.mock('./fortnoxMirrorService', () => ({ FortnoxMirrorService: { allocateCustomer: m.allocate } }))
vi.mock('./caseCustomerService', () => ({ CaseCustomerService: { getOrCreateCaseCustomer: m.getOrCreateCaseCustomer } }))
vi.mock('./paymentTermsService', () => ({ PaymentTermsService: { getDays: m.termsDays } }))
vi.mock('./invoiceDeliveryService', () => ({
  InvoiceDeliveryService: { getForCustomer: m.deliveryFor, adoptFromFortnoxCard: m.adopt },
}))
vi.mock('./communicationService', () => ({ createSystemComment: m.comment }))
vi.mock('../hooks/useInvoiceVisit', () => ({ fetchInvoiceVisit: m.fetchVisit }))
vi.mock('../hooks/useInvoiceAddons', () => ({ fetchInvoiceAddonLines: m.fetchAddons }))

import { sendInvoiceToFortnox } from './invoiceFortnoxSendService'

const item = (over: Record<string, unknown> = {}) => ({
  id: 'item-1',
  invoice_id: 'inv',
  article_code: 'AVT-PREMIE',
  article_name: 'Årspremie skadedjursavtal',
  quantity: 1,
  unit_price: 12000,
  total_price: 12000,
  vat_rate: 25,
  discount_percent: 0,
  rot_rut_type: null,
  line_kind: null,
  case_billing_item_id: null,
  ...over,
})

const contractInvoice = {
  id: 'inv-contract',
  invoice_number: 'INV-202611-0001',
  invoice_type: 'contract',
  case_type: null,
  case_id: null,
  contract_id: 'contract-1',
  customer_id: 'cust-1',
  customer_name: 'Testbolaget AB',
  organization_number: '556677-8899',
  customer_email: 'faktura@test.se',
  customer_phone: null,
  customer_address: 'Storgatan 1, 111 22 Stockholm',
  invoice_marking: 'Märkning ABC',
  notes: 'Årspremie 2027 · 2027-01-01 till 2027-12-31',
  fastighetsbeteckning: null,
  rot_rut_type: null,
  status: 'ready',
  fortnox_document_number: null,
  items: [item()],
}

const adhocInvoice = {
  id: 'inv-adhoc',
  invoice_number: 'INV-202611-0002',
  invoice_type: 'adhoc',
  case_type: null,
  case_id: 'case-1',
  contract_id: null,
  customer_id: 'cust-2',
  customer_name: 'Fastighets AB Exempel',
  organization_number: '556000-1111',
  customer_email: 'ekonomi@exempel.se',
  customer_phone: null,
  customer_address: 'Fakturavägen 5, 123 45 Solna',
  invoice_marking: null,
  notes: null,
  fastighetsbeteckning: null,
  rot_rut_type: null,
  status: 'ready',
  fortnox_document_number: null,
  items: [item({ id: 'item-2', article_code: 'RATT-SAN', article_name: 'Råttsanering', unit_price: 3500, total_price: 3500 })],
}

const notify = () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() })

beforeEach(() => {
  vi.useFakeTimers()
  // 2026-11-05 kl 10.00 lokal tid
  vi.setSystemTime(new Date(2026, 10, 5, 10, 0, 0))
  db.single = {}
  db.list = {}
  db.updates = []
  for (const fn of Object.values(m)) fn.mockReset()
  m.premium.mockResolvedValue([])
  m.refresh.mockResolvedValue({ changed: false, splitAddonRows: false, items: [] })
  m.deliveryFor.mockResolvedValue({ evaluation: { ok: true }, owner: { id: 'owner', invoice_delivery_method: 'email', billing_reference: null } })
  m.findOrCreateCustomer.mockImplementation(async (c: { customer_number: number }) => String(c.customer_number))
  m.ensureArticles.mockResolvedValue(undefined)
  m.createInvoice.mockResolvedValue({ DocumentNumber: '1234' })
  m.updateInvoiceStatus.mockResolvedValue({})
  m.comment.mockResolvedValue({})
  m.termsDays.mockResolvedValue(30)
  m.fetchVisit.mockResolvedValue(null)
  m.fetchAddons.mockResolvedValue({ lines: [], caseIds: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('sendInvoiceToFortnox, avtalsfaktura', () => {
  it('skickar exakt den payload modalen skickade', async () => {
    m.getInvoice.mockResolvedValue(structuredClone(contractInvoice))
    m.resolveNumber.mockResolvedValue(5004)
    db.list.contracts = [{ id: 'contract-1', diary_number: 'GNU 2026/60', account_manager_name: null, begone_employee_name: 'Pär-Eric Säljare' }]
    db.single.customers = { assigned_account_manager: 'Kundansvarig Person' }
    const n = notify()

    const result = await sendInvoiceToFortnox('inv-contract', { notify: n, actor: { userId: 'u1', name: 'Ekonomi' } })

    expect(result).toEqual({ status: 'created', documentNumber: '1234', invoiceNumber: 'INV-202611-0001' })
    expect(m.termsDays).toHaveBeenCalledWith('contract')
    expect(m.createInvoice).toHaveBeenCalledTimes(1)
    expect(m.createInvoice.mock.calls[0][0]).toEqual({
      CustomerNumber: '5004',
      InvoiceDate: '2026-11-05',
      DueDate: '2026-12-05',
      VATIncluded: false,
      InvoiceRows: [
        { ArticleNumber: 'AVT-PREMIE', Description: 'Årspremie skadedjursavtal', DeliveredQuantity: 1, Price: 12000, VAT: 25 },
      ],
      ExternalInvoiceReference1: 'GNU 2026/60',
      ExternalInvoiceReference2: 'INV-202611-0001',
      YourReference: 'Märkning ABC',
      Remarks: 'Årspremie 2027, 2027-01-01 till 2027-12-31',
      OurReference: 'Pär-Eric Säljare',
    })
    // Företagskund: COMPANY, inga privatvillkor
    expect(m.findOrCreateCustomer.mock.calls[0][0]).toMatchObject({
      customer_number: 5004,
      customer_type: 'COMPANY',
      terms_of_payment: null,
      invoice_delivery_type: 'EMAIL',
    })
    // Fortnox-numret, förfallodagen och statusen sparas
    expect(db.updates).toContainEqual({
      table: 'invoices',
      payload: { fortnox_document_number: '1234', due_date: '2026-12-05', delivery_address: null },
      filters: [['id', 'inv-contract']],
    })
    expect(m.updateInvoiceStatus).toHaveBeenCalledWith('inv-contract', 'draft')
    // Inget ärende: ingen systemkommentar
    expect(m.comment).not.toHaveBeenCalled()
    expect(n.success).toHaveBeenCalledWith('Utkast skapat i Fortnox (nr 1234)')
    expect(n.error).not.toHaveBeenCalled()
  })

  it('kundkortets kundansvarige blir Vår referens när avtalet saknar säljare', async () => {
    m.getInvoice.mockResolvedValue(structuredClone(contractInvoice))
    m.resolveNumber.mockResolvedValue(5004)
    db.list.contracts = [{ id: 'contract-1', diary_number: null, account_manager_name: null, begone_employee_name: null }]
    db.single.customers = { assigned_account_manager: ' Kundansvarig Person ' }

    await sendInvoiceToFortnox('inv-contract')

    const payload = m.createInvoice.mock.calls[0][0]
    expect(payload.OurReference).toBe('Kundansvarig Person')
    expect(payload.ExternalInvoiceReference1).toBeUndefined()
  })

  it('stoppar en obekräftad premie innan något skickas', async () => {
    m.getInvoice.mockResolvedValue(structuredClone(contractInvoice))
    m.premium.mockResolvedValue(['contract-1'])
    const n = notify()

    const result = await sendInvoiceToFortnox('inv-contract', { notify: n })

    expect(result.status).toBe('blocked')
    expect(n.error).toHaveBeenCalledWith(expect.any(String), { duration: 10000 })
    expect(m.createInvoice).not.toHaveBeenCalled()
    expect(m.findOrCreateCustomer).not.toHaveBeenCalled()
  })

  it('skickar aldrig en faktura som redan finns i Fortnox', async () => {
    m.getInvoice.mockResolvedValue({ ...structuredClone(contractInvoice), fortnox_document_number: '999' })

    const result = await sendInvoiceToFortnox('inv-contract')

    expect(result).toEqual({ status: 'blocked', message: 'Fakturan finns redan i Fortnox (nr 999). Använd Synka för att hämta dess status.' })
    expect(m.premium).not.toHaveBeenCalled()
    expect(m.createInvoice).not.toHaveBeenCalled()
  })

  it('obekräftad fakturaväg stoppar före Fortnox-kortet', async () => {
    m.getInvoice.mockResolvedValue(structuredClone(contractInvoice))
    m.resolveNumber.mockResolvedValue(5004)
    m.deliveryFor.mockResolvedValue({ evaluation: { ok: false, message: 'Välj fakturaväg' }, owner: { id: 'cust-1' } })
    const onDeliveryBlocked = vi.fn()

    const result = await sendInvoiceToFortnox('inv-contract', { onDeliveryBlocked })

    expect(result).toEqual({ status: 'blocked', message: 'Välj fakturaväg' })
    expect(onDeliveryBlocked).toHaveBeenCalledWith('cust-1')
    expect(m.findOrCreateCustomer).not.toHaveBeenCalled()
  })

  it('flera Fortnox-kunder på samma org.nr skickas inte, de väljs i modalen', async () => {
    m.getInvoice.mockResolvedValue(structuredClone(contractInvoice))
    m.resolveNumber.mockResolvedValue(null)
    m.allocate.mockResolvedValue({ status: 'candidates', kind: 'multiple', candidates: [{ customer_number: '1', active: true }] })

    const result = await sendInvoiceToFortnox('inv-contract')

    expect(result.status).toBe('candidates')
    expect(m.createInvoice).not.toHaveBeenCalled()
  })

  it('ett fel från Fortnox blir status failed med svenskt meddelande', async () => {
    m.getInvoice.mockResolvedValue(structuredClone(contractInvoice))
    m.resolveNumber.mockResolvedValue(5004)
    m.createInvoice.mockRejectedValue(new Error('Ogiltigt kundnummer'))
    const n = notify()

    const result = await sendInvoiceToFortnox('inv-contract', { notify: n })

    expect(result).toEqual({ status: 'failed', message: 'Kunde inte skicka till Fortnox: Ogiltigt kundnummer' })
    expect(n.error).toHaveBeenCalledWith('Kunde inte skicka till Fortnox: Ogiltigt kundnummer')
    expect(m.updateInvoiceStatus).not.toHaveBeenCalled()
  })
})

describe('sendInvoiceToFortnox, ärendefaktura (merförsäljning)', () => {
  const caseRow = {
    case_number: 'BE-2026-0815',
    completed_date: '2026-10-21T15:00:00+02:00',
    scheduled_start: '2026-10-21T08:00:00+02:00',
    primary_technician_name: 'Bokad Tekniker',
    invoice_marking: '  Ref 4711  ',
    work_order_number: 'AO-123',
    work_object: '7',
    room_number: null,
    address: { formatted_address: 'Lagergatan 3, 171 50 Solna, Sverige' },
  }

  it('skickar exakt den payload modalen skickade', async () => {
    m.getInvoice.mockResolvedValue(structuredClone(adhocInvoice))
    m.resolveNumber.mockResolvedValue(7001)
    db.single.cases = caseRow
    db.single.customers = { assigned_account_manager: null }
    m.fetchVisit.mockResolvedValue({ visit_date: '2026-10-20T12:00:00+02:00', technician_name: 'Utförande Tekniker' })
    const n = notify()

    const result = await sendInvoiceToFortnox('inv-adhoc', { notify: n, actor: { userId: 'u1', name: 'Ekonomi' } })

    expect(result).toEqual({ status: 'created', documentNumber: '1234', invoiceNumber: 'INV-202611-0002' })
    expect(m.termsDays).toHaveBeenCalledWith('contract')
    expect(m.refresh).not.toHaveBeenCalled()
    expect(m.createInvoice.mock.calls[0][0]).toEqual({
      CustomerNumber: '7001',
      InvoiceDate: '2026-11-05',
      DueDate: '2026-12-05',
      VATIncluded: false,
      InvoiceRows: [
        { Description: 'Arbetsorder AO-123, objekt 7' },
        { ArticleNumber: 'RATT-SAN', Description: 'Råttsanering', DeliveredQuantity: 1, Price: 3500, VAT: 25 },
      ],
      DeliveryDate: '2026-10-20',
      OurReference: 'Utförande Tekniker',
      ExternalInvoiceReference1: 'BE-2026-0815',
      ExternalInvoiceReference2: 'INV-202611-0002',
      YourReference: 'Ref 4711',
      YourOrderNumber: 'AO-123 objekt 7',
      DeliveryCountry: 'Sverige',
      DeliveryName: 'Fastighets AB Exempel',
      DeliveryAddress1: 'Lagergatan 3',
      DeliveryZipCode: '171 50',
      DeliveryCity: 'Solna',
    })
    // Märkningen från ärendet skrivs till fakturan före sändningen
    expect(db.updates).toContainEqual({ table: 'invoices', payload: { invoice_marking: 'Ref 4711' }, filters: [['id', 'inv-adhoc']] })
    expect(db.updates).toContainEqual({
      table: 'invoices',
      payload: { fortnox_document_number: '1234', due_date: '2026-12-05', delivery_address: 'Lagergatan 3, 171 50 Solna, Sverige' },
      filters: [['id', 'inv-adhoc']],
    })
    expect(m.comment).toHaveBeenCalledWith(
      'case-1',
      'contract',
      'status_change',
      'Utkast skapat i Fortnox (nr 1234) — INV-202611-0002',
      'u1',
      'Ekonomi'
    )
  })

  it('modalens förladdade besök och tilläggsrader används i stället för nya uppslag', async () => {
    m.resolveNumber.mockResolvedValue(7001)
    db.single.cases = caseRow

    await sendInvoiceToFortnox('inv-adhoc', {
      preloaded: {
        invoice: structuredClone(adhocInvoice) as never,
        visit: null,
        addonLines: [],
        accountManager: null,
      },
    })

    expect(m.getInvoice).not.toHaveBeenCalled()
    expect(m.fetchVisit).not.toHaveBeenCalled()
    expect(m.fetchAddons).not.toHaveBeenCalled()
    const payload = m.createInvoice.mock.calls[0][0]
    // Utan besökssnapshot: ärendets avslutsdag och bokade tekniker, som i modalen
    expect(payload.DeliveryDate).toBe('2026-10-21')
    expect(payload.OurReference).toBe('Bokad Tekniker')
  })

  it('privatperson får VATIncluded och pris inklusive moms', async () => {
    m.getInvoice.mockResolvedValue({
      ...structuredClone(adhocInvoice),
      invoice_type: 'private',
      case_type: 'private',
      organization_number: '19800101-1234',
      customer_address: 'Lagergatan 3, 171 50 Solna',
    })
    m.resolveNumber.mockResolvedValue(10500)
    db.single.private_cases = { case_number: 'P-1', completed_date: '2026-10-21T15:00:00+02:00', start_date: null, primary_assignee_name: 'Tekniker P', adress: 'Lagergatan 3, 171 50 Solna' }

    await sendInvoiceToFortnox('inv-adhoc')

    expect(m.termsDays).toHaveBeenCalledWith('private')
    const payload = m.createInvoice.mock.calls[0][0]
    expect(payload.VATIncluded).toBe(true)
    expect(payload.InvoiceRows).toEqual([
      { ArticleNumber: 'RATT-SAN', Description: 'Råttsanering', DeliveredQuantity: 1, Price: 4375, VAT: 25 },
    ])
    // Samma adress som fakturaadressen: ingen leveransadress
    expect(payload.DeliveryAddress1).toBeUndefined()
    expect(m.findOrCreateCustomer.mock.calls[0][0]).toMatchObject({ customer_type: 'PRIVATE', terms_of_payment: '10', show_price_vat_included: true })
  })
})

describe('sendInvoiceToFortnox, ROT och RUT (3.127.4)', () => {
  const rotRutInvoice = (typ: 'ROT' | 'RUT', fastighet: string | null) => ({
    ...structuredClone(adhocInvoice),
    invoice_type: 'private',
    case_type: 'private',
    organization_number: '19800523-1553',
    customer_name: 'Test Testsson',
    customer_address: 'Lagergatan 3, 171 50 Solna',
    rot_rut_type: typ,
    fastighetsbeteckning: fastighet,
    brf_org_number: null,
    apartment_number: null,
    items: [item({ id: 'arb', article_code: '135', article_name: 'Arbetskostnad', unit_price: 6400, total_price: 6400, rot_rut_type: typ, house_work_hours: 8 })],
  })
  const privatArende = { case_number: 'P-2', completed_date: '2026-10-21T15:00:00+02:00', start_date: null, primary_assignee_name: 'Tekniker P', adress: 'Lagergatan 3, 171 50 Solna' }

  it('RUT utan fastighet: husarbete, ingen fastighetsrad, taxreduction utan fastighet', async () => {
    m.getInvoice.mockResolvedValue(rotRutInvoice('RUT', null))
    m.resolveNumber.mockResolvedValue(10501)
    db.single.private_cases = privatArende
    m.createTaxReduction.mockResolvedValue(undefined)

    const result = await sendInvoiceToFortnox('inv-adhoc')

    expect(result.status).toBe('created')
    const payload = m.createInvoice.mock.calls[0][0]
    expect(payload.TaxReductionType).toBe('rut')
    expect(payload.InvoiceRows[0]).toMatchObject({ HouseWork: true, HouseWorkType: 'CLEANING', HouseWorkHoursToReport: 8 })
    expect(JSON.stringify(payload.InvoiceRows)).not.toContain('Fastighetsbeteckning')
    expect(m.createTaxReduction).toHaveBeenCalledTimes(1)
    expect(m.createTaxReduction.mock.calls[0][0]).toMatchObject({
      property_designation: null,
      residence_association_org_nr: null,
      social_security_number: '19800523-1553',
    })
  })

  it('ROT utan fastighet stoppas före Fortnox', async () => {
    m.getInvoice.mockResolvedValue(rotRutInvoice('ROT', null))
    m.resolveNumber.mockResolvedValue(10501)
    db.single.private_cases = privatArende

    const result = await sendInvoiceToFortnox('inv-adhoc')

    expect(result.status).not.toBe('created')
    expect(m.createInvoice).not.toHaveBeenCalled()
    expect(m.createTaxReduction).not.toHaveBeenCalled()
  })

  it('ROT med fastighet: fastighetsrad och PropertyDesignation', async () => {
    m.getInvoice.mockResolvedValue(rotRutInvoice('ROT', 'Exempelby 1:23'))
    m.resolveNumber.mockResolvedValue(10501)
    db.single.private_cases = privatArende
    m.createTaxReduction.mockResolvedValue(undefined)

    await sendInvoiceToFortnox('inv-adhoc')

    const payload = m.createInvoice.mock.calls[0][0]
    expect(payload.TaxReductionType).toBe('rot')
    expect(payload.InvoiceRows[0]).toMatchObject({ HouseWork: true, HouseWorkType: 'CONSTRUCTION' })
    expect(payload.InvoiceRows).toContainEqual({ Description: 'Fastighetsbeteckning: Exempelby 1:23' })
    expect(m.createTaxReduction.mock.calls[0][0]).toMatchObject({ property_designation: 'Exempelby 1:23' })
  })
})
