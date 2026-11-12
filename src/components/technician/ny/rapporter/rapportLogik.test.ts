import { describe, expect, it } from 'vitest'
import {
  arGiltigEpost, bestamdForm, dagFor, filtreraRapporter, grupperaPerManad, matcharTyp, periodFran, rapportSortFor,
  type RapportRad,
} from './rapportLogik'

function rad(del: Partial<Omit<RapportRad, 'avslutad'>> & { id: string; avslutad: string }): RapportRad {
  const avslutad = new Date(del.avslutad)
  return {
    nyckel: `cases:${del.id}`,
    kalla: 'cases',
    typ: 'contract_extra',
    sort: 'arende',
    arendenummer: null,
    kund: 'Exempel AB',
    tjanst: 'Extrabesök',
    kundEpost: null,
    kontaktperson: null,
    ...del,
    avslutad,
    dag: dagFor(avslutad),
  } as RapportRad
}

describe('rapportSortFor', () => {
  it('ger rätt rapport per ärendetyp, egenkontroll saknar rapport', () => {
    expect(rapportSortFor('private')).toBe('sanering')
    expect(rapportSortFor('business')).toBe('sanering')
    expect(rapportSortFor('inspection')).toBe('kontroll')
    expect(rapportSortFor('rondering')).toBe('arende')
    expect(rapportSortFor('establishment')).toBe('arende')
    expect(rapportSortFor('egenkontroll')).toBeNull()
  })
})

describe('matcharTyp', () => {
  it('avtal omfattar extrabesök, etablering, rutin och övriga avtalsärenden', () => {
    for (const typ of ['contract_extra', 'establishment', 'routine', 'contract'] as const) {
      expect(matcharTyp({ typ }, 'avtal')).toBe(true)
    }
    expect(matcharTyp({ typ: 'inspection' }, 'avtal')).toBe(false)
    expect(matcharTyp({ typ: 'rondering' }, 'rondering')).toBe(true)
    expect(matcharTyp({ typ: 'private' }, 'foretag')).toBe(false)
    expect(matcharTyp({ typ: 'private' }, 'alla')).toBe(true)
  })
})

describe('periodFran', () => {
  it('räknar kalenderdagar bakåt med idag inräknat', () => {
    expect(periodFran('30', '2026-11-12')).toBe('2026-10-14')
    expect(periodFran('90', '2026-11-12')).toBe('2026-08-15')
    expect(periodFran('365', '2026-03-01')).toBe('2025-03-02')
  })
})

describe('dagFor', () => {
  it('räknar dagen i svensk tid, inte UTC', () => {
    // 23:30 UTC den 31 oktober är 00:30 svensk tid den 1 november (vintertid, +01:00)
    expect(dagFor(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01')
    expect(dagFor(new Date('2026-06-30T22:30:00+00:00'))).toBe('2026-07-01')
  })
})

describe('filtreraRapporter och grupperaPerManad', () => {
  const rader = [
    rad({ id: '1', avslutad: '2026-10-20T10:00:00+02:00', arendenummer: 'AV-1', kund: 'Brf Exempelgården' }),
    rad({ id: '2', avslutad: '2026-11-03T09:00:00+01:00', arendenummer: 'BE-2', kund: 'Privatperson', typ: 'private', sort: 'sanering', kundEpost: 'kund@exempel.se' }),
    rad({ id: '3', avslutad: '2026-11-10T09:00:00+01:00', arendenummer: 'AV-3', kund: 'Exempel Livs AB', typ: 'inspection', sort: 'kontroll' }),
  ]

  it('sorterar senaste först och söker på kund, ärendenummer och e-post', () => {
    expect(filtreraRapporter(rader, '', 'alla').map(r => r.id)).toEqual(['3', '2', '1'])
    expect(filtreraRapporter(rader, 'livs', 'alla').map(r => r.id)).toEqual(['3'])
    expect(filtreraRapporter(rader, 'be-2', 'alla').map(r => r.id)).toEqual(['2'])
    expect(filtreraRapporter(rader, 'KUND@', 'alla').map(r => r.id)).toEqual(['2'])
    expect(filtreraRapporter(rader, '', 'kontroll').map(r => r.id)).toEqual(['3'])
  })

  it('grupperar per månad i listans ordning', () => {
    const g = grupperaPerManad(filtreraRapporter(rader, '', 'alla'))
    expect(g.map(m => m.manad)).toEqual(['2026-11', '2026-10'])
    expect(g[0].rader.map(r => r.id)).toEqual(['3', '2'])
  })
})

describe('texthjälp', () => {
  it('bestämd form och e-postkontroll', () => {
    expect(bestamdForm('Saneringsrapport')).toBe('saneringsrapporten')
    expect(bestamdForm('Ärenderapport')).toBe('ärenderapporten')
    expect(arGiltigEpost(' kund@exempel.se ')).toBe(true)
    expect(arGiltigEpost('kund@')).toBe(false)
    expect(arGiltigEpost(null)).toBe(false)
  })
})
