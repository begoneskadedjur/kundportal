import { describe, expect, it } from 'vitest'
import {
  compareIdentityNumbers,
  correctPremiumRows,
  deriveMapSetup,
  identityNumberVariants,
  isIndividualParty,
  isOurChainContract,
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
  it('privatperson: Oneflow visar inkl. moms, premien är exkl.', () => {
    expect(premiumExclVatFromOneflow(7500, true)).toBe(6000)
    expect(premiumExclVatFromOneflow('7500', true)).toBe(6000)
  })
  it('företag: beloppet är premien', () => {
    expect(premiumExclVatFromOneflow(37390, false)).toBe(37390)
  })
  it('tomt eller noll ger null', () => {
    expect(premiumExclVatFromOneflow(null, false)).toBeNull()
    expect(premiumExclVatFromOneflow(0, true)).toBeNull()
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
