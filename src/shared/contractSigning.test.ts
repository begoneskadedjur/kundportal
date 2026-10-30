import { describe, expect, it } from 'vitest'
import {
  compareIdentityNumbers,
  correctPremiumRows,
  deriveMapSetup,
  identityNumberVariants,
  isIndividualParty,
  isOurChainContract,
  newContractBillingRules,
  NEW_CONTRACT_RULES_FROM,
  SIGNING_ANCHOR_NOTE,
  pickContractService,
  premiumExclVatFromOneflow,
  selectSourceRowsCoveredByContract,
} from './contractSigning'

describe('vår kedja', () => {
  it('markören är created_by_email', () => {
    expect(isOurChainContract({ created_by_email: 'sofia.palshagen@begone.se' })).toBe(true)
    expect(isOurChainContract({ created_by_email: null })).toBe(false)
    expect(isOurChainContract({ created_by_email: '  ' })).toBe(false)
  })
})

describe('premien ur Oneflow', () => {
  it('privatperson: beloppet är premien', () => {
    expect(premiumExclVatFromOneflow(7500)).toBe(7500)
    expect(premiumExclVatFromOneflow('7500')).toBe(7500)
  })
  it('företag: beloppet är premien', () => {
    expect(premiumExclVatFromOneflow(37390)).toBe(37390)
  })
  it('tomt eller noll ger null', () => {
    expect(premiumExclVatFromOneflow(null)).toBeNull()
    expect(premiumExclVatFromOneflow(0)).toBeNull()
  })
  it('parttyp: Oneflow vinner, sedan ärendetyp, sist numrets form', () => {
    expect(isIndividualParty({ oneflowPartyType: 'individual', sourceType: 'business_case' })).toBe(true)
    expect(isIndividualParty({ oneflowPartyType: 'company', sourceType: 'private_case' })).toBe(false)
    expect(isIndividualParty({ sourceType: 'private_case' })).toBe(true)
    expect(isIndividualParty({ organizationNumber: '19551205-7158' })).toBe(true)
    expect(isIndividualParty({ organizationNumber: '559378-9208' })).toBe(false)
    expect(isIndividualParty({})).toBe(false)
  })
})

describe('rättning av premierader', () => {
  it('summan stämmer: inga prisändringar', () => {
    const r = correctPremiumRows([{ id: 'a', quantity: 1, unit_price: 6000, total_price: 6000, is_premium_carrier: true }], 6000)
    expect(r.deviated).toBe(false)
    expect(r.updates).toEqual([])
  })
  it('en rad som avviker får premien', () => {
    const r = correctPremiumRows([{ id: 'a', quantity: 1, unit_price: 6000, total_price: 6000, is_premium_carrier: true }], 7500)
    expect(r.deviated).toBe(true)
    expect(r.before).toBe(6000)
    expect(r.updates).toEqual([{ id: 'a', total_price: 7500, unit_price: 7500 }])
  })
  it('rabatterad rad: summan efter rabatt är premien, ingen rättning', () => {
    // Listpris 10 000 kr, 10 % rabatt: Oneflow-beloppet (netto) är 9 000 kr
    const r = correctPremiumRows([{ id: 'a', quantity: 1, unit_price: 10000, total_price: 9000, discount_percent: 10, is_premium_carrier: true }], 9000)
    expect(r.deviated).toBe(false)
    expect(r.updates).toEqual([])
  })
  it('rabatterad rad som avviker: à-priset blir listpris så att rabatten inte dras två gånger', () => {
    const r = correctPremiumRows([{ id: 'a', quantity: 1, unit_price: 10000, total_price: 9000, discount_percent: 10, is_premium_carrier: true }], 9900)
    expect(r.updates).toEqual([{ id: 'a', total_price: 9900, unit_price: 11000 }])
  })
  it('flera rader skalas proportionellt och övriga får andel', () => {
    const r = correctPremiumRows(
      [
        { id: 'bar', quantity: 1, unit_price: 4000, total_price: 4000, is_premium_carrier: true },
        { id: 'tät', quantity: 2, unit_price: 1000, total_price: 2000 },
      ],
      9000
    )
    expect(r.deviated).toBe(true)
    const bar = r.updates.find((u) => u.id === 'bar')!
    const tat = r.updates.find((u) => u.id === 'tät')!
    expect(bar.total_price).toBe(6000)
    expect(tat.total_price).toBe(3000)
    expect(tat.unit_price).toBe(1500)
    expect(tat.premium_share).toBe(0.3333)
    expect(bar.premium_share).toBeUndefined()
  })
  it('utan avvikelse får icke-bärande rad med pris ändå en andel', () => {
    const r = correctPremiumRows(
      [
        { id: 'bar', quantity: 1, unit_price: 6000, total_price: 6000, is_premium_carrier: true },
        { id: 'x', quantity: 1, unit_price: 2000, total_price: 2000 },
      ],
      8000
    )
    expect(r.deviated).toBe(false)
    expect(r.updates).toEqual([{ id: 'x', premium_share: 0.25 }])
  })
  it('rader utan summa: bärande raden får hela premien', () => {
    const r = correctPremiumRows(
      [
        { id: 'x', quantity: 1, unit_price: 0, total_price: 0 },
        { id: 'bar', quantity: 1, unit_price: 0, total_price: 0, is_premium_carrier: true },
      ],
      5000
    )
    expect(r.updates).toEqual([{ id: 'bar', total_price: 5000, unit_price: 5000 }])
  })
  it('öresavrundning landar på premien', () => {
    const r = correctPremiumRows(
      [
        { id: 'a', quantity: 1, unit_price: 1, total_price: 1, is_premium_carrier: true },
        { id: 'b', quantity: 1, unit_price: 1, total_price: 1 },
        { id: 'c', quantity: 1, unit_price: 1, total_price: 1 },
      ],
      100
    )
    const sum = r.updates.reduce((s, u) => s + (u.total_price ?? 0), 0)
    expect(Math.round(sum * 100) / 100).toBe(100)
  })
})

describe('org- och personnummer vid signering', () => {
  it('Pär-Eric: kunden ändrade till ett ogiltigt nummer, vårt behålls', () => {
    const r = compareIdentityNumbers('19551205-7158', '19551205-758')
    expect(r.status).toBe('changed_invalid')
    expect(r.keep).toBe('19551205-7158')
    expect(r.message).toContain('personnumret')
    expect(r.message).toContain('behålls')
  })
  it('samma nummer i annat skrivsätt är oförändrat', () => {
    expect(compareIdentityNumbers('551205-7158', '19551205-7158').status).toBe('same')
    expect(compareIdentityNumbers('5593789208', '559378-9208').status).toBe('same')
  })
  it('giltigt nytt nummer används men nämns', () => {
    const r = compareIdentityNumbers('559378-9208', '556036-0793')
    expect(r.status).toBe('changed_valid')
    expect(r.keep).toBe('556036-0793')
    expect(r.message).toContain('organisationsnumret')
  })
  it('saknas ett av numren används det andra', () => {
    expect(compareIdentityNumbers(null, '559378-9208')).toEqual({ status: 'only_signed', keep: '559378-9208', message: null })
    expect(compareIdentityNumbers('559378-9208', '')).toEqual({ status: 'only_sent', keep: '559378-9208', message: null })
    expect(compareIdentityNumbers(null, null).status).toBe('none')
  })
  it('skrivsätt för uppslag i kundregistret', () => {
    const v = identityNumberVariants('19551205-7158')
    expect(v).toEqual(expect.arrayContaining(['19551205-7158', '5512057158', '551205-7158', '195512057158']))
    expect(identityNumberVariants('559378-9208')).toEqual(expect.arrayContaining(['559378-9208', '5593789208']))
    expect(identityNumberVariants('')).toEqual([])
  })
})

describe('avtalets tjänst', () => {
  const services = [
    { id: 's-mek', name: 'Avtal mekaniska fällor', code: '39' },
    { id: 's-bet', name: 'Skadedjursavtal Betongstation', code: '32' },
  ]
  it('matchar på namn när service_id saknas (wizarden före rättningen)', () => {
    const p = pickContractService([{ id: 'r1', service_id: null, service_name: 'Avtal mekaniska fällor', total_price: 6000 }], services)
    expect(p?.service.id).toBe('s-mek')
  })
  it('service_id vinner och dyraste träffen väljs', () => {
    const p = pickContractService(
      [
        { id: 'r1', service_id: 's-mek', service_name: 'Annat namn', total_price: 1000 },
        { id: 'r2', service_id: 's-bet', service_name: null, total_price: 9000 },
        { id: 'r3', service_id: null, service_name: 'Tätning', total_price: 50000 },
      ],
      services
    )
    expect(p?.row.id).toBe('r2')
  })
  it('ingen träff ger null', () => {
    expect(pickContractService([{ id: 'r1', service_id: null, service_name: 'Tätning' }], services)).toBeNull()
  })
})

describe('källärendets rader', () => {
  it('Pär-Eric: avtalsraden tas, den fakturerade inspektionen lämnas', () => {
    const r = selectSourceRowsCoveredByContract(
      [
        { id: 'insp', item_type: 'service', status: 'billed', service_id: 'g', service_name: 'Inspektion Gnagare' },
        { id: 'avtal', item_type: 'service', status: 'pending', service_id: 's-mek', service_name: 'Avtal mekaniska fällor' },
      ],
      [{ service_id: null, service_name: 'Avtal mekaniska fällor' }]
    )
    expect(r.ids).toEqual(['avtal'])
    expect(r.looseArticles).toBe(0)
  })
  it('arbetsrader och mappade artiklar följer med, andra tjänster lämnas', () => {
    const r = selectSourceRowsCoveredByContract(
      [
        { id: 't', item_type: 'service', status: 'pending', service_id: 's-mek', service_name: 'x' },
        { id: 'arb', item_type: 'service', status: 'pending', service_id: 'arb', service_name: 'Arbetstid', labor_for_item_id: 't' },
        { id: 'art', item_type: 'article', status: 'pending', service_id: null, service_name: null, mapped_service_id: 't' },
        { id: 'annan', item_type: 'service', status: 'pending', service_id: 'y', service_name: 'Sanering' },
        { id: 'lös', item_type: 'article', status: 'pending', service_id: null, service_name: null },
      ],
      [{ service_id: 's-mek', service_name: 'Avtal mekaniska fällor' }]
    )
    expect(r.ids.sort()).toEqual(['arb', 'art', 't'])
    expect(r.looseArticles).toBe(0)
  })
  it('lösa artiklar tas med när ingen annan tjänst finns kvar', () => {
    const r = selectSourceRowsCoveredByContract(
      [
        { id: 't', item_type: 'service', status: 'pending', service_id: 's-mek', service_name: 'x' },
        { id: 'lös', item_type: 'article', status: 'pending', service_id: null, service_name: null },
      ],
      [{ service_id: 's-mek', service_name: null }]
    )
    expect(r.ids.sort()).toEqual(['lös', 't'])
    expect(r.looseArticles).toBe(1)
  })
  it('inget matchar: inget tas', () => {
    const r = selectSourceRowsCoveredByContract(
      [{ id: 'lös', item_type: 'article', status: 'pending', service_id: null, service_name: null }],
      [{ service_id: 's-mek', service_name: 'Avtal mekaniska fällor' }]
    )
    expect(r.ids).toEqual([])
  })
})

describe('avtalskartans uppsättning', () => {
  it('fakturamånad = startmånaden, besöksfrekvens lämnas', () => {
    const r = deriveMapSetup({
      contract_start_date: '2026-10-14',
      billing_frequency: 'annual',
      billing_anchor_month: null,
      notice_period_months: 3,
    })
    expect(r.updates).toEqual({ billing_anchor_month: 10 })
    expect(r.missing).toEqual(['besöksfrekvens och schema (§ 3)'])
  })
  it('gissar aldrig: saknade villkor listas', () => {
    const r = deriveMapSetup({
      contract_start_date: null,
      start_date: null,
      billing_frequency: null,
      billing_anchor_month: null,
      notice_period_months: null,
      visits_per_year: 4,
    })
    expect(r.updates).toEqual({})
    expect(r.missing).toEqual(['startdatum', 'faktureringsintervall', 'uppsägningstid'])
  })
  it('befintlig fakturamånad rörs inte', () => {
    expect(
      deriveMapSetup({ contract_start_date: '2026-10-14', billing_frequency: 'quarterly', billing_anchor_month: 1, notice_period_months: 3, visit_frequency: 'quarterly' })
    ).toEqual({ updates: {}, missing: [] })
  })
})

describe('steg 15: nya avtal får avtalsdag och nya tilläggsregler', () => {
  const base = {
    signed_at: '2026-11-03',
    start_date: '2026-11-17',
    billing_anchor_mode: null,
    billing_anchor_verified_at: null,
    addon_rules: null,
    has_locked_invoices: false,
    has_manual_choice: false,
    default_addon_rules: 'v2',
  }

  it('nytt avtal med startdatum ur Oneflow: avtalsdag, kontrollerad, v2', () => {
    const r = newContractBillingRules(base)
    expect(r.updates).toEqual({ billing_anchor_mode: 'start_day', billing_anchor_verified_note: SIGNING_ANCHOR_NOTE, addon_rules: 'v2' })
    expect(r.verify).toBe(true)
    expect(r.notes).toEqual([])
  })
  it('signerat samma dag som go live räknas som nytt', () => {
    expect(newContractBillingRules({ ...base, signed_at: NEW_CONTRACT_RULES_FROM }).updates.billing_anchor_mode).toBe('start_day')
  })
  it('signerat före go live rörs aldrig, inte heller vid omkörning', () => {
    const r = newContractBillingRules({ ...base, signed_at: '2026-10-29' })
    expect(r).toEqual({ updates: {}, verify: false, notes: [] })
    expect(newContractBillingRules({ ...base, signed_at: null }).updates).toEqual({})
  })
  it('avtal som redan har något av fälten, låsta fakturor eller ett val i kartan rörs inte', () => {
    expect(newContractBillingRules({ ...base, billing_anchor_mode: 'start_day' }).updates).toEqual({})
    expect(newContractBillingRules({ ...base, billing_anchor_verified_at: '2026-11-01T10:00:00+01:00' }).updates).toEqual({})
    expect(newContractBillingRules({ ...base, addon_rules: 'v2' }).updates).toEqual({})
    expect(newContractBillingRules({ ...base, has_locked_invoices: true }).updates).toEqual({})
    expect(newContractBillingRules({ ...base, has_manual_choice: true }).updates).toEqual({})
  })
  it('startdatum saknas: ingen avtalsdag men v2, med förklaring', () => {
    const r = newContractBillingRules({ ...base, start_date: null })
    expect(r.updates).toEqual({ addon_rules: 'v2' })
    expect(r.verify).toBe(false)
    expect(r.notes[0]).toContain('startdatum saknas')
  })
  it('kunden har ett annat levande avtal med gamla regler: avtalsdag men inte v2', () => {
    const r = newContractBillingRules({ ...base, default_addon_rules: null })
    expect(r.updates).toEqual({ billing_anchor_mode: 'start_day', billing_anchor_verified_note: SIGNING_ANCHOR_NOTE })
    expect(r.notes[0]).toContain('gamla tilläggsreglerna')
  })
  it('deriveMapSetup: avtalsdag sätter ingen fakturamånad och saknar inte fakturamånad', () => {
    const r = deriveMapSetup({
      contract_start_date: '2026-11-17',
      billing_frequency: 'annual',
      billing_anchor_month: null,
      notice_period_months: 2,
      visit_frequency: 'quarterly',
      billing_anchor_mode: 'start_day',
    })
    expect(r).toEqual({ updates: {}, missing: [] })
  })
  it('deriveMapSetup: avtalsdag utan startdatum faller tillbaka och saknar startdatum', () => {
    const r = deriveMapSetup({
      contract_start_date: null,
      billing_frequency: 'annual',
      billing_anchor_month: null,
      notice_period_months: 2,
      visit_frequency: 'quarterly',
      billing_anchor_mode: 'start_day',
    })
    expect(r).toEqual({ updates: {}, missing: ['startdatum'] })
  })
})
