import { describe, expect, it } from 'vitest'
import {
  countInspectionLevels,
  inspectionLevelLabel,
  normalizeInspectionLevel,
} from './inspectionStatusLevels'

describe('normalizeInspectionLevel', () => {
  it('räknar ok som none och activity som medium', () => {
    expect(normalizeInspectionLevel('ok')).toBe('none')
    expect(normalizeInspectionLevel('activity')).toBe('medium')
    expect(normalizeInspectionLevel('high')).toBe('high')
  })

  it('ger null för statusar utanför nivåerna', () => {
    expect(normalizeInspectionLevel('needs_service')).toBeNull()
    expect(normalizeInspectionLevel('replaced')).toBeNull()
    expect(normalizeInspectionLevel(null)).toBeNull()
  })
})

describe('countInspectionLevels', () => {
  it('summerar till antalet kontroller när bara nivåer och äldre ok/activity finns', () => {
    const statuses = ['ok', 'ok', 'none', 'low', 'activity', 'medium', 'high']
    const counts = countInspectionLevels(statuses)
    expect(counts).toEqual({ none: 3, low: 1, medium: 2, high: 1 })
    expect(counts.none + counts.low + counts.medium + counts.high).toBe(statuses.length)
  })

  it('hoppar över statusar som inte är nivåer', () => {
    expect(countInspectionLevels(['replaced', null, 'low'])).toEqual({ none: 0, low: 1, medium: 0, high: 0 })
  })
})

describe('inspectionLevelLabel', () => {
  it('visar none-nivåns ord för ok, aldrig OK', () => {
    expect(inspectionLevelLabel('ok')).toBe('Ingen aktivitet')
    expect(inspectionLevelLabel('ok', { none: 'Inga spår' })).toBe('Inga spår')
  })

  it('använder reservorden när tabellen saknar nivån', () => {
    expect(inspectionLevelLabel('low', {})).toBe('Låg aktivitet')
    expect(inspectionLevelLabel('activity', null)).toBe('Måttlig aktivitet')
    expect(inspectionLevelLabel('high')).toBe('Hög aktivitet')
  })

  it('ger null för statusar utanför nivåerna', () => {
    expect(inspectionLevelLabel('replaced')).toBeNull()
  })
})
