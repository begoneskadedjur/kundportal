import { describe, expect, it } from 'vitest'
import {
  formatAdress,
  formatEpost,
  formatForetagsnamn,
  formatIdNummer,
  formatPersonnamn,
  formatTelefon,
} from './kontaktFormat'

describe('formatPersonnamn', () => {
  it('ger stor bokstav i varje namn', () => {
    expect(formatPersonnamn('magnus björkquist')).toBe('Magnus Björkquist')
    expect(formatPersonnamn('ANNA-KARIN  SVENSSON')).toBe('Anna-Karin Svensson')
    expect(formatPersonnamn('carl von linné')).toBe('Carl von Linné')
  })
  it('lämnar medveten skiftning', () => {
    expect(formatPersonnamn('Ronald McDonald')).toBe('Ronald McDonald')
  })
})

describe('formatForetagsnamn', () => {
  it('rättar bara namn med enbart gemener, bolagsformen alltid versal', () => {
    expect(formatForetagsnamn('kungsleden storstad ab')).toBe('Kungsleden Storstad AB')
    expect(formatForetagsnamn('begone skadedjur & sanering ab')).toBe('Begone Skadedjur & Sanering AB')
    expect(formatForetagsnamn('ICA MAXI ab')).toBe('ICA MAXI AB')
    expect(formatForetagsnamn('IKEA Kungens Kurva ab')).toBe('IKEA Kungens Kurva AB')
    expect(formatForetagsnamn('Castellum AB (publ)')).toBe('Castellum AB (publ)')
  })
})

describe('formatTelefon', () => {
  it('skriver svenska nummer med riktnummer och grupper', () => {
    expect(formatTelefon('086023338')).toBe('08-602 33 38')
    expect(formatTelefon('0701234567')).toBe('070-123 45 67')
    expect(formatTelefon('+46 70 123 45 67')).toBe('070-123 45 67')
    expect(formatTelefon('+46 (0)8 555 01 23')).toBe('08-555 01 23')
    expect(formatTelefon('0102804410')).toBe('010-280 44 10')
    expect(formatTelefon('031-123456')).toBe('031-12 34 56')
    expect(formatTelefon('048012345')).toBe('0480-123 45')
  })
  it('lämnar utländska och otolkbara nummer', () => {
    expect(formatTelefon('+47 22 33 44 55')).toBe('+47 22 33 44 55')
    expect(formatTelefon('123')).toBe('123')
    expect(formatTelefon('')).toBe('')
  })
})

describe('formatAdress', () => {
  it('gata, postnummer och ort', () => {
    expect(formatAdress('storgatan 15 11122 stockholm')).toBe('Storgatan 15, 111 22 Stockholm')
    expect(formatAdress('Kungsgatan 25, 111 56 Stockholm')).toBe('Kungsgatan 25, 111 56 Stockholm')
    expect(formatAdress('rankhusvägen 32, 196 31 upplands-bro')).toBe('Rankhusvägen 32, 196 31 Upplands-Bro')
  })
  it('ort före postnummer utan gata', () => {
    expect(formatAdress('Östersund 831 90')).toBe('831 90 Östersund')
  })
  it('utan postnummer bara stor bokstav först', () => {
    expect(formatAdress('garaget gävlegatan 18')).toBe('Garaget gävlegatan 18')
  })
})

describe('formatEpost och formatIdNummer', () => {
  it('e-post med gemener', () => {
    expect(formatEpost(' Magnus.Bjorkquist@Castellum.se ')).toBe('magnus.bjorkquist@castellum.se')
  })
  it('org.nr med bindestreck', () => {
    expect(formatIdNummer('5565498986')).toBe('556549-8986')
    expect(formatIdNummer('abc')).toBe('abc')
  })
})
