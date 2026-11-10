// Förhandsvisningen i wizarden (Granska, sidokortet, ROT-panelen) mot det
// create-contract skickar till Oneflow i variant D (3.127.5). Båda sidor
// byggs från samma ärenderader: wizarden via wizardTjanstRader, servern via
// prefill-mappningen, draftItems och serverTjanstRader med katalogens koder.

import { describe, expect, it } from 'vitest'
import { mapBillingItemsToPrefillServices } from '../utils/billingPrefill'
import type { CaseBillingItemWithRelations } from '../types/caseBilling'
import {
  oneflowProduktgrupp, rotRutBrister, rotRutForhandsvisning, rotRutForslagText, sammanstallRotRut,
  serverTjanstRader, wizardTjanstRader, type Avdrag, type KontrollArtikel,
} from './rotRutOffert'

// Katalogen: service_id -> kod
const KATALOG: Record<string, string> = {
  'svc-tatning': '54',
  'svc-sanering': '61',
  'svc-arbete': '135',
  'svc-material': '120',
  'svc-bil': '143',
  'svc-ovrigt': '145',
}

const rad = (p: Partial<CaseBillingItemWithRelations> & { id: string; service_id: string; total_price: number }) => ({
  item_type: 'service',
  service_code: KATALOG[p.service_id],
  service_name: null,
  quantity: 1,
  unit_price: p.total_price,
  vat_rate: 25,
  rot_rut_type: null,
  ...p,
}) as unknown as CaseBillingItemWithRelations

/** Ärendet med ROT: tätning, 10 h arbete, material, servicebil och en udda summa */
const rotArende = [
  rad({ id: 'r0', service_id: 'svc-tatning', service_name: 'Tätning gnagare', total_price: 0 }),
  rad({ id: 'r1', service_id: 'svc-arbete', service_name: 'Skadedjurstekniker timpris', total_price: 9876.4, rot_rut_type: 'ROT' }),
  rad({ id: 'r2', service_id: 'svc-material', service_name: 'Material & Utrustning', total_price: 1600 }),
  rad({ id: 'r3', service_id: 'svc-bil', service_name: 'Servicebil', total_price: 400 }),
  rad({ id: 'r4', service_id: 'svc-ovrigt', service_name: 'Övriga kostnader', total_price: 0 }),
]

/** Ärendet med RUT: sanering, arbete och övrigt, ingen servicebil */
const rutArende = [
  rad({ id: 'u0', service_id: 'svc-sanering', service_name: 'Sanering vägglöss', total_price: 0 }),
  rad({ id: 'u1', service_id: 'svc-arbete', service_name: 'Skadedjurstekniker timpris', total_price: 6401, rot_rut_type: 'RUT' }),
  rad({ id: 'u2', service_id: 'svc-material', service_name: 'Material & Utrustning', total_price: 803.2 }),
  rad({ id: 'u3', service_id: 'svc-ovrigt', service_name: 'Övriga kostnader', total_price: 1200 }),
]

/** Wizarden: case_billing_items direkt */
function wizardSida(items: CaseBillingItemWithRelations[], typ: Avdrag) {
  const s = sammanstallRotRut(wizardTjanstRader(items), typ)
  return rotRutForhandsvisning(s)
}

/** Servern: prefillServices -> draftItems (som handleSubmit) -> serverTjanstRader */
function serverSida(items: CaseBillingItemWithRelations[], typ: Avdrag) {
  const draftItems = mapBillingItemsToPrefillServices(items).map(s => ({
    draft_id: s.id,
    service_id: s.service_id ?? null,
    service_name: s.service_name ?? null,
    total_price: s.total_price,
    vat_rate: s.vat_rate ?? 25,
    rot_rut_type: s.rot_rut_type ?? null,
  }))
  return oneflowProduktgrupp(sammanstallRotRut(serverTjanstRader(draftItems, id => KATALOG[id]), typ))
}

function jamfor(items: CaseBillingItemWithRelations[], typ: Avdrag) {
  const v = wizardSida(items, typ)
  const g = serverSida(items, typ)
  // Rubriken Avser
  expect(v.rubrik).toBe(g.configuration.name?.label ?? null)
  // Kolumnerna
  const kolumn = (key: string) => g.configuration.columns.find(c => c.key === key)
  expect(kolumn('price_1')?.label).toBe(v.kolumnPris)
  expect(kolumn('price_2')?.label).toBe(v.kolumnEfterAvdrag)
  expect(kolumn('description')?.enabled).toBe(true)
  // Raderna: namn, beskrivning, båda priserna, 1 st, ingen rabatt
  expect(v.rader.map(r => [r.namn, r.beskrivning, String(r.belopp), String(r.efterAvdrag)])).toEqual(
    g.products.map(p => [p.name, p.description, p.price_1.base_amount.amount, p.price_2.base_amount.amount])
  )
  for (const p of g.products) {
    expect(p.quantity.amount).toBe(1)
    expect(p.price_1.discount_amount.amount).toBe('0')
    expect(p.price_2.discount_amount.amount).toBe('0')
    expect(Number.isInteger(Number(p.price_1.base_amount.amount))).toBe(true)
    expect(Number.isInteger(Number(p.price_2.base_amount.amount))).toBe(true)
  }
  // Summorna som Oneflow räknar fram (kolumnens summa gånger antal)
  const summa = (k: 'price_1' | 'price_2') => g.products.reduce((s, p) => s + Number(p[k].base_amount.amount) * p.quantity.amount, 0)
  expect(v.summaPris).toBe(summa('price_1'))
  expect(v.summaEfterAvdrag).toBe(summa('price_2'))
  return { v, g }
}

describe('förhandsvisningen mot create-contract', () => {
  it('ROT: samma rader, beskrivningar, kolumner, summor och rubrik', () => {
    const { v } = jamfor(rotArende, 'ROT')
    expect(v.rubrik).toBe('Avser: Tätning gnagare')
    // 9 876,40 x 1,25 = 12 345,50 -> 12 346, avdraget 30 % nedåt = 3 703
    expect(v.rader.map(r => [r.namn, r.belopp, r.efterAvdrag])).toEqual([
      ['Arbetskostnad', 12346, 8643],
      ['Material och utrustning', 2000, 2000],
      ['Servicebil', 500, 500],
    ])
    expect(v.rader[0].beskrivning.endsWith('ROT-avdrag 30 %: 3 703 kr.')).toBe(true)
    expect(v.summaPris).toBe(14846)
    expect(v.summaEfterAvdrag).toBe(11143)
    expect(v.kolumnEfterAvdrag).toBe('Att betala efter ROT')
    expect(v.prisText).toBe('ROT-avdrag 30 % på arbetskostnaden 12 346 kr: -3 703 kr. Att betala: 11 143 kr.')
  })

  it('RUT: samma rader, 50 % och ingen rad på 0 kr', () => {
    const { v } = jamfor(rutArende, 'RUT')
    expect(v.rubrik).toBe('Avser: Sanering vägglöss')
    // 6 401 x 1,25 = 8 001,25 -> 8 001, avdraget 50 % nedåt = 4 000
    expect(v.rader.map(r => [r.namn, r.belopp, r.efterAvdrag])).toEqual([
      ['Arbetskostnad', 8001, 4001],
      ['Material och utrustning', 1004, 1004],
      ['Övriga kostnader', 1500, 1500],
    ])
    expect(v.rader[0].beskrivning.endsWith('RUT-avdrag 50 %: 4 000 kr.')).toBe(true)
    expect(v.kolumnEfterAvdrag).toBe('Att betala efter RUT')
    expect(v.summaEfterAvdrag).toBe(10505 - 4000)
  })

  it('visar aldrig timmar, interna kostnader eller avdragsrad för kunden', () => {
    for (const [items, typ] of [[rotArende, 'ROT'], [rutArende, 'RUT']] as const) {
      const g = serverSida(items, typ)
      const v = wizardSida(items, typ)
      const text = JSON.stringify([g, v.rader, v.rubrik])
      expect(text).not.toMatch(/timm|\bh\b|Arbetstid|Skadedjurstekniker timpris/)
      expect(g.products.some(p => /^(ROT|RUT)-avdrag/.test(p.name))).toBe(false)
    }
  })

  it('offertinnehållet nämner samma kundrader och inget annat', () => {
    for (const [items, typ] of [[rotArende, 'ROT'], [rutArende, 'RUT']] as const) {
      const text = rotRutForslagText(wizardTjanstRader(items), typ)
      const namn = serverSida(items, typ).products.map(p => p.name)
      expect(text).toBe(`Offerten omfattar:\n\n${namn.map(n => `- ${n}`).join('\n')}`)
      expect(text).not.toMatch(/timm|Arbetstid|Avser|ROT|RUT/)
    }
  })

  it('kundraderna känns igen på katalogens kod även utan service_code på raden', () => {
    const utanKod = rotArende.map(r => ({ ...r, service_code: null, service: { code: KATALOG[r.service_id as string] } }) as unknown as CaseBillingItemWithRelations)
    expect(wizardSida(utanKod, 'ROT').rader.map(r => r.namn)).toEqual(['Arbetskostnad', 'Material och utrustning', 'Servicebil'])
    expect(rotRutForslagText(wizardTjanstRader(utanKod), 'ROT')).toContain('- Servicebil')
  })

  it('RUT kräver ingen fastighet, ROT gör det, och tio siffror i personnumret räcker', () => {
    const artiklar = (typ: Avdrag, arbetsId: string): KontrollArtikel[] => [
      { id: 'a1', namn: 'Arbetstid Privatperson', category: 'Arbetstid', mappadMot: arbetsId, rot_rut_type: typ, quantity: 8 },
    ]
    const bas = { partTyp: 'individual' as const, personnummer: '800523-1553', fastighet: { brf: false }, fritext: '' }
    const rut = rotRutBrister({ ...bas, mall: 'RUT', tjanster: wizardTjanstRader(rutArende), artiklar: artiklar('RUT', 'u1') })
    expect(rut).toEqual([])
    const rot = rotRutBrister({ ...bas, mall: 'ROT', tjanster: wizardTjanstRader(rotArende), artiklar: artiklar('ROT', 'r1') })
    expect(rot.map(b => b.kod)).toEqual(['fastighet'])
  })
})
