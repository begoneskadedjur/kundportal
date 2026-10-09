import { describe, expect, it } from 'vitest'
import { AVTALSOBJEKT_MAX_TECKEN, harStopp, kontrolleraAvtal, type AvtalsKontrollIndata } from './avtalsKontroll'

const komplett: AvtalsKontrollIndata = {
  dokumentTyp: 'contract',
  partTyp: 'company',
  foretag: 'Kungsleden Storstad AB',
  orgNr: '556549-8986',
  kontaktperson: 'Magnus Björkquist',
  epost: 'magnus@exempel.se',
  telefon: '08-602 33 38',
  epostFaktura: 'faktura@exempel.se',
  avtalslangd: '2 år',
  startdatum: '2026-11-01',
  avtalsobjekt: '6 kontroller per år.',
  antalTjanster: 1,
}

const nivaFor = (d: AvtalsKontrollIndata, text: RegExp) =>
  kontrolleraAvtal(d).find(p => text.test(p.text))?.niva

describe('kontrolleraAvtal', () => {
  it('ett komplett avtal har bara gröna punkter', () => {
    const punkter = kontrolleraAvtal(komplett)
    expect(punkter.every(p => p.niva === 'gron')).toBe(true)
    expect(harStopp(punkter)).toBe(false)
    expect(punkter.map(p => p.text)).toContain('Avtalstid 2 år från 2026-11-01')
  })

  it('tomt avtalsobjekt stoppar', () => {
    const d = { ...komplett, avtalsobjekt: '   ' }
    expect(nivaFor(d, /Avtalsobjektet är tomt/)).toBe('rod')
    expect(harStopp(kontrolleraAvtal(d))).toBe(true)
  })

  it('avtalsobjekt över 2 048 tecken stoppar', () => {
    const d = { ...komplett, avtalsobjekt: 'x'.repeat(AVTALSOBJEKT_MAX_TECKEN + 1) }
    expect(nivaFor(d, /max 2/)).toBe('rod')
    expect(harStopp(kontrolleraAvtal({ ...komplett, avtalsobjekt: 'x'.repeat(AVTALSOBJEKT_MAX_TECKEN) }))).toBe(false)
  })

  it('saknad kontaktperson, saknad eller ogiltig e-post stoppar', () => {
    expect(nivaFor({ ...komplett, kontaktperson: '' }, /Kontaktperson saknas/)).toBe('rod')
    expect(nivaFor({ ...komplett, epost: '' }, /^E-post saknas/)).toBe('rod')
    expect(nivaFor({ ...komplett, epost: 'magnus@exempel' }, /ogiltig/)).toBe('rod')
  })

  it('företag utan företagsnamn stoppar, privatperson behöver inget', () => {
    expect(nivaFor({ ...komplett, foretag: '' }, /Företagsnamn saknas/)).toBe('rod')
    expect(harStopp(kontrolleraAvtal({ ...komplett, partTyp: 'individual', foretag: '', orgNr: '19850315-1236' }))).toBe(false)
  })

  it('avtal utan avtalslängd eller startdatum stoppar, offert kontrollerar inte avtalstid', () => {
    expect(nivaFor({ ...komplett, avtalslangd: '' }, /Avtalslängd saknas/)).toBe('rod')
    expect(nivaFor({ ...komplett, startdatum: '' }, /Startdatum saknas/)).toBe('rod')
    const offert = kontrolleraAvtal({ ...komplett, dokumentTyp: 'offer', avtalslangd: '', startdatum: '' })
    expect(offert.some(p => p.avsnitt === 'avtalstid')).toBe(false)
    expect(harStopp(offert)).toBe(false)
  })

  it('inga tjänster stoppar', () => {
    expect(nivaFor({ ...komplett, antalTjanster: 0 }, /Inga tjänster/)).toBe('rod')
  })

  it('saknad telefon, saknat org.nr och saknad faktura-e-post varnar', () => {
    expect(nivaFor({ ...komplett, telefon: '' }, /Telefonnummer saknas/)).toBe('gul')
    expect(nivaFor({ ...komplett, orgNr: '' }, /Org.nr saknas/)).toBe('gul')
    expect(nivaFor({ ...komplett, epostFaktura: '' }, /kunden fyller i vid signering/)).toBe('gul')
    expect(harStopp(kontrolleraAvtal({ ...komplett, telefon: '', orgNr: '', epostFaktura: '' }))).toBe(false)
  })

  it('org.nr som inte går att tolka eller har fel kontrollsiffra varnar', () => {
    expect(nivaFor({ ...komplett, orgNr: '12345' }, /går inte att tolka/)).toBe('gul')
    expect(nivaFor({ ...komplett, orgNr: '556549-8987' }, /kontrollsiffran/)).toBe('gul')
  })

  it('röda punkter står först, sedan gula, sist gröna', () => {
    const nivaer = kontrolleraAvtal({ ...komplett, telefon: '', avtalsobjekt: '' }).map(p => p.niva)
    expect(nivaer[0]).toBe('rod')
    expect(nivaer.indexOf('gul')).toBeLessThan(nivaer.indexOf('gron'))
  })
})
