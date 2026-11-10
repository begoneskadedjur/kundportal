import { describe, expect, it } from 'vitest'
import {
  arAvdragsradNamn, arRotRutRadmodell, avdragKr, avdragsradNamn, jamforMedOneflow, KUNDBESKRIVNING, oneflowRader, exklFranInkl, fakturaAvdrag, fakturaBrister, fakturaRadIRadmodell,
  fastighetKlar, fastighetKravs, fastighetText, giltigFastighetsbeteckning, giltigtPersonnummer, inklMoms, kr, personnummer12,
  maskeratPersonnummer, namnerAndraTypen, prisText, rollForKategori, rollForKod, rotRutBrister,
  sammanstallRotRut, timmarTillFortnox, type RotRutKontrollIndata,
} from './rotRutOffert'

// Exemplet i skissen: arbete 12 000, material 2 000, servicebil 500 inkl. moms
const rader = [
  { id: 'avser', roll: null, service_name: 'Tätning gnagare', total_price: 0 },
  { id: 'arb', roll: 'arbete' as const, service_name: 'Skadedjurstekniker timpris', total_price: 9600, rot_rut_type: 'ROT' as const, house_work_hours: 10 },
  { id: 'mat', roll: 'material' as const, service_name: 'Material & Utrustning', total_price: 1600 },
  { id: 'bil', roll: 'servicebil' as const, service_name: 'Servicebil', total_price: 400 },
  { id: 'ovr', roll: 'ovrigt' as const, service_name: 'Övriga kostnader', total_price: 0 },
]

const komplett: RotRutKontrollIndata = {
  mall: 'ROT',
  partTyp: 'individual',
  personnummer: '19800523-1553',
  fastighet: { brf: false, fastighetsbeteckning: 'Exempelby 1:23' },
  tjanster: rader,
  artiklar: [
    { id: 'a1', namn: 'Arbetstid Privatperson', category: 'Arbetstid', mappadMot: 'arb', rot_rut_type: 'ROT', quantity: 10 },
    { id: 'a2', namn: 'Fälla', category: 'Bekämpning', mappadMot: 'mat', rot_rut_type: null, quantity: 3 },
  ],
  fritext: 'Tätning av genomföringar.',
}

const koder = (d: RotRutKontrollIndata) => rotRutBrister(d).map(b => b.kod)

describe('belopp och avrundning', () => {
  it('räknar inkl. moms i hela kronor och tillbaka', () => {
    expect(inklMoms(9600)).toBe(12000)
    expect(inklMoms(9876.4)).toBe(12346)
    expect(exklFranInkl(12345)).toBe(9876)
    expect(inklMoms(exklFranInkl(12345))).toBe(12345)
  })
  it('avrundar avdraget nedåt', () => {
    expect(avdragKr(12000, 'ROT')).toBe(3600)
    expect(avdragKr(12345, 'ROT')).toBe(3703)
    expect(avdragKr(8001, 'RUT')).toBe(4000)
  })
  it('formaterar kronor med vanliga mellanslag', () => {
    expect(kr(14500)).toBe('14 500 kr')
  })
})

describe('sammanstallRotRut', () => {
  it('ger skissens belopp för ROT', () => {
    const s = sammanstallRotRut(rader, 'ROT')
    expect(s.avser).toBe('Tätning gnagare')
    expect(s.rader.map(r => [r.namn, r.belopp])).toEqual([
      ['Arbetskostnad', 12000], ['Material och utrustning', 2000], ['Servicebil', 500],
    ])
    expect(s.totaltInkl).toBe(14500)
    expect(s.arbetskostnadInkl).toBe(12000)
    expect(s.avdrag).toBe(3600)
    expect(s.attBetala).toBe(10900)
    expect(s.timmar).toBe(10)
    expect(s.totaltExkl).toBe(11600)
    expect(s.momsKr).toBe(2900)
    expect(prisText(s)).toBe('ROT-avdrag 30 % på arbetskostnaden 12 000 kr: -3 600 kr. Att betala: 10 900 kr.')
  })
  it('RUT ger 50 %', () => {
    const s = sammanstallRotRut(rader.map(r => r.roll === 'arbete' ? { ...r, rot_rut_type: 'RUT' as const } : r), 'RUT')
    expect(s.avdrag).toBe(6000)
    expect(s.attBetala).toBe(8500)
  })
  it('utelämnar rader på 0 kr', () => {
    expect(sammanstallRotRut(rader, 'ROT').rader.some(r => r.roll === 'ovrigt')).toBe(false)
  })
})

describe('roller', () => {
  it('känner igen katalogens koder', () => {
    expect(rollForKod('135')).toBe('arbete')
    expect(rollForKod('120')).toBe('material')
    expect(rollForKod('143')).toBe('servicebil')
    expect(rollForKod('145')).toBe('ovrigt')
    expect(rollForKod('54')).toBeNull()
  })
  it('mappar interna kostnader efter kategori', () => {
    expect(rollForKategori('Arbetstid')).toBe('arbete')
    expect(rollForKategori('Bekämpning')).toBe('material')
    expect(rollForKategori('Tillbehör')).toBe('material')
    expect(rollForKategori('Inspektion')).toBe('material')
    expect(rollForKategori('Underentreprenör')).toBe('ovrigt')
    expect(rollForKategori('Övrigt')).toBe('ovrigt')
  })
})

describe('identitet och fastighet', () => {
  it('personnummer: 10 eller 12 siffror med kontrollsiffra, inte org.nr', () => {
    expect(giltigtPersonnummer('19800523-1553')).toBe(true)
    expect(giltigtPersonnummer('800523-1553')).toBe(true)
    expect(giltigtPersonnummer('19800523-1554')).toBe(false)
    expect(personnummer12('800523-1553', new Date('2026-11-10'))).toBe('19800523-1553')
    expect(personnummer12('121212+1212', new Date('2026-11-10'))).toBe('19121212-1212')
    expect(personnummer12('100101-0003', new Date('2026-11-10'))).toBe(null)
    expect(personnummer12('5593789208')).toBe(null)
    expect(giltigtPersonnummer('16559378-9208')).toBe(false)
    expect(giltigtPersonnummer('')).toBe(false)
  })
  it('maskerar personnumret', () => {
    expect(maskeratPersonnummer('19800523-1553')).toBe('800523-XXXX')
  })
  it('fastighetsbeteckning med kolon', () => {
    expect(giltigFastighetsbeteckning('Exempelby 1:23')).toBe(true)
    expect(giltigFastighetsbeteckning('HÖRNINGSNÄS 1:1')).toBe(true)
    expect(giltigFastighetsbeteckning('Stockholm Gamla Stan 2:14')).toBe(true)
    expect(giltigFastighetsbeteckning('Exempelby 123')).toBe(false)
    expect(giltigFastighetsbeteckning('1:23')).toBe(false)
  })
  it('bostadsrätt kräver föreningens org.nr och lägenhetsnummer', () => {
    expect(fastighetKlar({ brf: true, brfOrgNr: '769600-1234', lagenhetsnummer: '1102' })).toBe(true)
    expect(fastighetKlar({ brf: true, brfOrgNr: '769600-1234', lagenhetsnummer: '' })).toBe(false)
    expect(fastighetKlar({ brf: true, brfOrgNr: '19800523-1553', lagenhetsnummer: '1102' })).toBe(false)
    expect(fastighetText({ brf: true, brfOrgNr: '769600-1234', lagenhetsnummer: '1102' }))
      .toBe('Bostadsrätt, föreningens org.nr 769600-1234, lägenhet 1102')
  })
})

describe('rotRutBrister', () => {
  it('komplett offert har inga brister', () => {
    expect(rotRutBrister(komplett)).toEqual([])
  })
  it('kräver arbetstid med mallens typ', () => {
    expect(koder({ ...komplett, artiklar: komplett.artiklar.map(a => ({ ...a, rot_rut_type: null })) })).toContain('arbete')
  })
  it('kräver privatperson och personnummer', () => {
    expect(koder({ ...komplett, partTyp: 'company' })).toContain('privat')
    expect(koder({ ...komplett, personnummer: '559378-9208' })).toContain('personnummer')
  })
  it('kräver fastighet', () => {
    expect(koder({ ...komplett, fastighet: { brf: false, fastighetsbeteckning: '' } })).toContain('fastighet')
  })
  it('ROT utan fastighet stoppas, även bostadsrätt utan lägenhetsnummer', () => {
    expect(koder({ ...komplett, fastighet: { brf: false, fastighetsbeteckning: null } })).toEqual(['fastighet'])
    expect(koder({ ...komplett, fastighet: { brf: true, brfOrgNr: '769600-1234', lagenhetsnummer: '' } })).toEqual(['fastighet'])
  })
  it('RUT utan fastighet godkänns (3.127.4)', () => {
    const rut: RotRutKontrollIndata = {
      ...komplett,
      mall: 'RUT',
      fastighet: { brf: false, fastighetsbeteckning: '' },
      tjanster: rader.map(r => r.roll === 'arbete' ? { ...r, rot_rut_type: 'RUT' as const } : r),
      artiklar: komplett.artiklar.map(a => a.rot_rut_type ? { ...a, rot_rut_type: 'RUT' as const } : a),
      fritext: 'Sanering av vägglöss.',
    }
    expect(rotRutBrister(rut)).toEqual([])
    expect(fastighetKravs('RUT')).toBe(false)
    expect(fastighetKravs('ROT')).toBe(true)
  })
  it('stoppar blandning av ROT och RUT', () => {
    const d = { ...komplett, artiklar: [...komplett.artiklar, { id: 'a3', namn: 'Arbetstid', category: 'Arbetstid', mappadMot: 'arb', rot_rut_type: 'RUT' as const, quantity: 1 }] }
    expect(koder(d)).toContain('blandning')
  })
  it('stoppar omappade interna kostnader', () => {
    const d = { ...komplett, artiklar: [...komplett.artiklar, { id: 'a3', namn: 'Lim', category: 'Tillbehör', mappadMot: null, quantity: 1 }] }
    expect(koder(d)).toContain('mappning')
  })
  it('stoppar kostnad mappad mot ärendets tjänst', () => {
    const d = { ...komplett, artiklar: [...komplett.artiklar, { id: 'a3', namn: 'Lim', category: 'Tillbehör', mappadMot: 'avser', quantity: 1 }] }
    expect(koder(d)).toContain('mappning')
  })
  it('bara arbetstid med avdrag på arbetsraden', () => {
    const d = { ...komplett, artiklar: [...komplett.artiklar, { id: 'a3', namn: 'Fälla', category: 'Bekämpning', mappadMot: 'arb', quantity: 1 }] }
    expect(koder(d)).toContain('arbete_ej_avdrag')
  })
  it('ärendets tjänst ska ha 0 kr', () => {
    const d = { ...komplett, tjanster: komplett.tjanster.map(t => t.id === 'avser' ? { ...t, total_price: 100 } : t) }
    expect(koder(d)).toContain('avser')
  })
  it('fritexten får inte nämna den andra typen', () => {
    expect(koder({ ...komplett, fritext: 'Denna del är RUT avdragsgill' })).toContain('fritext')
    expect(koder({ ...komplett, fritext: 'Med rut-avdrag' })).toContain('fritext')
    expect(koder({ ...komplett, fritext: 'Enligt vår rutin' })).not.toContain('fritext')
    expect(namnerAndraTypen('ROT-avdrag', 'RUT')).toBe(true)
  })
})

describe('fakturan', () => {
  it('känner igen radmodellen men inte gamla uppdelningar', () => {
    expect(arRotRutRadmodell([{ item_type: 'service', service_code: '135', rot_rut_type: 'ROT', house_work_hours: 10 }])).toBe(true)
    expect(arRotRutRadmodell([{ item_type: 'service', service_code: '135', rot_rut_type: 'ROT', house_work_hours: 10, labor_for_item_id: 'x' }])).toBe(false)
    expect(arRotRutRadmodell([{ item_type: 'service', service_code: '135', rot_rut_type: 'ROT', house_work_hours: null }])).toBe(false)
  })
  it('namnger raderna och gör Avser till textrad', () => {
    expect(fakturaRadIRadmodell({ service_code: '135', total_price: 9600 })).toEqual({ namn: 'Arbetskostnad', textrad: false })
    expect(fakturaRadIRadmodell({ service_code: '54', service_name: 'Tätning gnagare', total_price: 0 })).toEqual({ namn: 'Avser: Tätning gnagare', textrad: true })
  })
  it('räknar avdraget som offerten', () => {
    expect(fakturaAvdrag([{ rot_rut_type: 'ROT', total_price: 9600, vat_rate: 25 }, { total_price: 1600 }], 'ROT')).toEqual({ arbetskostnadInkl: 12000, avdrag: 3600 })
  })
  it('timmar till Fortnox', () => {
    expect(timmarTillFortnox({ house_work_hours: 9.6, quantity: 1 })).toBe(10)
    expect(timmarTillFortnox({ house_work_hours: null, quantity: 3 })).toBe(3)
    expect(timmarTillFortnox({ house_work_hours: 0.2, quantity: 1 })).toBe(1)
  })
  it('stoppar en faktura som saknar uppgifter', () => {
    const ok = {
      typ: 'ROT' as const, privat: true, personnummer: '19800523-1553',
      fastighet: { brf: false, fastighetsbeteckning: 'Exempelby 1:23' },
      utforandeAdress: 'Dalstigen 5', utforandeDatum: '2026-11-09', harArbetsrad: true,
    }
    expect(fakturaBrister(ok)).toEqual([])
    expect(fakturaBrister({ ...ok, personnummer: '800523-1553' })).toHaveLength(0)
    expect(fakturaBrister({ ...ok, personnummer: '800523-1554' })).toHaveLength(1)
    expect(fakturaBrister({ ...ok, utforandeAdress: '', utforandeDatum: null })).toHaveLength(2)
  })
  it('fakturan: ROT utan fastighet stoppas, RUT utan fastighet godkänns', () => {
    const utan = {
      privat: true, personnummer: '19800523-1553',
      fastighet: { brf: false, fastighetsbeteckning: '' },
      utforandeAdress: 'Dalstigen 5', utforandeDatum: '2026-11-09', harArbetsrad: true,
    }
    expect(fakturaBrister({ ...utan, typ: 'ROT' })).toEqual(['Fastighetsbeteckning saknas eller ser fel ut'])
    expect(fakturaBrister({ ...utan, typ: 'RUT' })).toEqual([])
  })
})

describe('jamforMedOneflow', () => {
  const forv = { rader: [{ namn: 'Arbetskostnad', belopp: 12000 }, { namn: 'Material och utrustning', belopp: 2000 }] }
  it('stämmer', async () => {
    const { jamforMedOneflow } = await import('./rotRutOffert')
    expect(jamforMedOneflow(forv, [{ name: 'Arbetskostnad', total: 12000 }, { name: 'Material och utrustning', total: 2000 }])).toBeNull()
  })
  it('flaggar ändrat belopp och extra rad', async () => {
    const { jamforMedOneflow } = await import('./rotRutOffert')
    const t = jamforMedOneflow(forv, [{ name: 'Arbetskostnad', total: 10000 }, { name: 'Material och utrustning', total: 2000 }, { name: 'Extra', total: 500 }])
    expect(t).toContain('Arbetskostnad är 10 000 kr i Oneflow')
    expect(t).toContain('Extra finns bara i Oneflow')
  })
})

describe('raderna i Oneflow (variant B)', () => {
  it('kundraderna med beskrivning och sist avdraget som minusbelopp', () => {
    const r = oneflowRader(sammanstallRotRut(rader, 'ROT'))
    expect(r.map(x => [x.namn, x.belopp, x.avdragsrad])).toEqual([
      ['Arbetskostnad', 12000, false], ['Material och utrustning', 2000, false], ['Servicebil', 500, false],
      ['ROT-avdrag 30 %', -3600, true],
    ])
    expect(r[0].beskrivning).toBe(KUNDBESKRIVNING.arbete)
    expect(r[3].beskrivning).toBe('30 % av arbetskostnaden inkl. moms')
    // Summan i Oneflow blir att betala
    expect(r.reduce((s, x) => s + x.belopp, 0)).toBe(10900)
  })
  it('RUT: 50 % och eget namn', () => {
    const s = sammanstallRotRut(rader.map(r => r.roll === 'arbete' ? { ...r, rot_rut_type: 'RUT' as const } : r), 'RUT')
    const alla = oneflowRader(s)
    const sista = alla[alla.length - 1]
    expect(sista).toMatchObject({ namn: 'RUT-avdrag 50 %', belopp: -6000, beskrivning: '50 % av arbetskostnaden inkl. moms' })
  })
  it('ingen avdragsrad utan avdrag', () => {
    const s = sammanstallRotRut(rader.filter(r => r.roll !== 'arbete'), 'ROT')
    expect(oneflowRader(s).some(r => r.avdragsrad)).toBe(false)
  })
  it('känner igen avdragsradens namn', () => {
    expect(avdragsradNamn('ROT')).toBe('ROT-avdrag 30 %')
    expect(arAvdragsradNamn('RUT-avdrag 50 %')).toBe(true)
    expect(arAvdragsradNamn('Arbetskostnad')).toBe(false)
    expect(arAvdragsradNamn('ROT-avdrag')).toBe(false)
  })
  it('jämförelsen larmar om avdraget ändras eller tas bort, men inte när det stämmer', () => {
    const forv = { rader: oneflowRader(sammanstallRotRut(rader, 'ROT')).map(r => ({ namn: r.namn, belopp: r.belopp })) }
    const oneflow = [
      { name: 'Arbetskostnad', total: 12000 }, { name: 'Material och utrustning', total: 2000 },
      { name: 'Servicebil', total: 500 }, { name: 'ROT-avdrag 30 %', total: -3600 },
    ]
    expect(jamforMedOneflow(forv, oneflow)).toBeNull()
    expect(jamforMedOneflow(forv, oneflow.slice(0, 3))).toContain('ROT-avdrag 30 % är borttaget i Oneflow')
    const andrat = jamforMedOneflow(forv, [...oneflow.slice(0, 3), { name: 'ROT-avdrag 30 %', total: -5000 }])
    expect(andrat).toContain('ROT-avdrag 30 % är ändrat i Oneflow: -5 000 kr, portalen -3 600 kr')
  })
})
