import { describe, expect, it } from 'vitest'
import { maskeraIdNummer, sattIhopAdress, tolkaIdNummer, adressDelar } from './webLeadUppgifter'

describe('sattIhopAdress', () => {
  it('tar bort postnummer och ort som redan står i gatufältet och använder kundens ort', () => {
    expect(sattIhopAdress({ address: 'rankhusvägen 32, 196 31 kungsängen', postal_code: '19631', city: 'Kungsängen och Bro' }))
      .toBe('Rankhusvägen 32, 196 31 Kungsängen')
  })

  it('känner igen postnummer utan mellanslag', () => {
    expect(sattIhopAdress({ address: 'Storgatan 5 19631 Kungsängen', postal_code: '19631', city: 'Kungsängen och Bro' }))
      .toBe('Storgatan 5, 196 31 Kungsängen')
  })

  it('känner igen ort utan postnummer efter kommatecken', () => {
    expect(sattIhopAdress({ address: 'storgatan 5, bro', postal_code: '19731', city: 'Kungsängen och Bro' }))
      .toBe('Storgatan 5, 197 31 Bro')
  })

  it('faller tillbaka på områdets namn när kunden inte skrev någon ort', () => {
    expect(sattIhopAdress({ address: 'General schybergsväg 23', postal_code: '61192', city: 'Norrköping' }))
      .toBe('General schybergsväg 23, 611 92 Norrköping')
  })

  it('rättad adress går före kundens svar', () => {
    const k = { address: 'fel 1', postal_code: '19631', city: 'Kungsängen och Bro', rattad_adress: 'rätt väg 2', rattad_postnummer: '19632', rattad_ort: 'kungsängen' }
    expect(sattIhopAdress(k)).toBe('Rätt väg 2, 196 32 Kungsängen')
    expect(adressDelar(k)).toEqual({ gata: 'Rätt väg 2', postnummer: '196 32', ort: 'Kungsängen' })
  })

  it('tomt utan adress', () => {
    expect(sattIhopAdress({ address: null, postal_code: null, city: null })).toBe('')
  })
})

describe('tolkaIdNummer', () => {
  const idag = new Date('2026-10-05T12:00:00')

  it('personnummer med tio siffror får sekel och kontrolleras', () => {
    const t = tolkaIdNummer('811228-9874', idag)
    expect(t).toMatchObject({ typ: 'personnummer', normaliserat: '19811228-9874', tolkat: true, kontrollsiffraOk: true })
  })

  it('personnummer med tolv siffror', () => {
    expect(tolkaIdNummer('198112289874', idag)).toMatchObject({ typ: 'personnummer', normaliserat: '19811228-9874', kontrollsiffraOk: true })
  })

  it('fel kontrollsiffra tolkas men flaggas', () => {
    expect(tolkaIdNummer('811228-9875', idag)).toMatchObject({ typ: 'personnummer', tolkat: true, kontrollsiffraOk: false })
  })

  it('org.nr känns igen på månadspositionen', () => {
    expect(tolkaIdNummer('5593789208', idag)).toMatchObject({ typ: 'orgnr', normaliserat: '559378-9208', kontrollsiffraOk: true })
    expect(tolkaIdNummer('16559378-9208', idag)).toMatchObject({ typ: 'orgnr', normaliserat: '559378-9208' })
  })

  it('fel antal siffror tolkas inte', () => {
    expect(tolkaIdNummer('12345', idag).tolkat).toBe(false)
    expect(tolkaIdNummer('abc', idag).tolkat).toBe(false)
  })

  it('maskerar personnummer men inte org.nr', () => {
    expect(maskeraIdNummer('19811228-9874', 'personnummer')).toBe('811228-XXXX')
    expect(maskeraIdNummer('559378-9208', 'orgnr')).toBe('559378-9208')
  })
})
