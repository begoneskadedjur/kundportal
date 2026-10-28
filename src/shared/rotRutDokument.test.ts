import { describe, expect, it } from 'vitest'
import { delaArbetsrader, mallensAvdrag, rotRutFel, tillatnaAvdrag } from './rotRutDokument'

const ARBETE = { rot_eligible: true, rut_eligible: true }
const PAKET = { rot_eligible: false, rut_eligible: false }

describe('rotRutFel', () => {
  it('inget avdrag ger inget fel, oavsett mall', () => {
    expect(rotRutFel([{ service_name: 'Sanering Geting', service: PAKET }], { avdrag: 'ROT' })).toBe('')
    expect(rotRutFel([], { avdrag: 'none' })).toBe('')
  })

  it('ROT på arbetsrad med ROT-mall är rätt', () => {
    expect(rotRutFel([{ rot_rut_type: 'ROT', service_name: 'Skadedjurstekniker timpris', service: ARBETE }], { avdrag: 'ROT' })).toBe('')
  })

  it('både ROT och RUT spärrar, med mallens typ i rättelsen', () => {
    const rader = [
      { rot_rut_type: 'ROT' as const, service_name: 'Skadedjurstekniker timpris', service: ARBETE },
      { rot_rut_type: 'RUT' as const, service_name: 'Arbete städ', service: ARBETE },
    ]
    expect(rotRutFel(rader)).toMatch(/både ROT och RUT/)
    const medMall = rotRutFel(rader, { avdrag: 'ROT' })
    expect(medMall).toMatch(/Mallen gäller ROT: byt till ROT på "Arbete städ"/)
  })

  it('avdrag på en tjänst som inte är arbetstid spärrar', () => {
    const fel = rotRutFel([{ rot_rut_type: 'ROT', service_name: 'Sanering Fågel', service: PAKET }], { avdrag: 'ROT' })
    expect(fel).toMatch(/"Sanering Fågel", som inte är arbetstid/)
    expect(fel).toMatch(/Dela upp för ROT\/RUT/)
  })

  it('okänd tjänst räknas inte som felplacerad', () => {
    expect(rotRutFel([{ rot_rut_type: 'ROT', service_name: 'X', service: null }], { avdrag: 'ROT' })).toBe('')
  })

  it('RUT med ROT-mallen spärrar', () => {
    const fel = rotRutFel([{ rot_rut_type: 'RUT', service_name: 'Skadedjurstekniker timpris', service: ARBETE }], { avdrag: 'ROT' })
    expect(fel).toBe('Mallen gäller ROT, men "Skadedjurstekniker timpris" har RUT. Byt till ROT på raden, eller välj RUT-mallen i steget Mall.')
  })

  it('avdrag med mall utan avdrag spärrar (mallbyte efter satt avdrag)', () => {
    const fel = rotRutFel(
      [{ rot_rut_type: 'ROT', service_name: 'Skadedjurstekniker timpris', service: ARBETE }],
      { avdrag: 'none', namn: 'Offertförslag, Inkl moms (Privatperson)' }
    )
    expect(fel).toMatch(/^Mallen Offertförslag, Inkl moms \(Privatperson\) har inget ROT- eller RUT-avdrag/)
    expect(fel).toMatch(/välj ROT-mallen i steget Mall/)
  })

  it('utan mall kontrolleras bara arbetstid och en typ', () => {
    expect(rotRutFel([{ rot_rut_type: 'RUT', service_name: 'A', service: ARBETE }], null)).toBe('')
  })

  it('felmeddelandena har inga tankstreck', () => {
    const texter = [
      rotRutFel([{ rot_rut_type: 'ROT', service: PAKET }]),
      rotRutFel([{ rot_rut_type: 'ROT', service: ARBETE }, { rot_rut_type: 'RUT', service: ARBETE }]),
      rotRutFel([{ rot_rut_type: 'ROT', service: ARBETE }], { avdrag: 'none' }),
      rotRutFel([{ rot_rut_type: 'ROT', service: ARBETE }], { avdrag: 'RUT' }),
    ]
    for (const t of texter) expect(t).not.toMatch(/[–—]/)
  })
})

describe('mallensAvdrag och tillatnaAvdrag', () => {
  it('mallens deduction styr', () => {
    expect(mallensAvdrag({ deduction: 'ROT' })).toBe('ROT')
    expect(mallensAvdrag({ deduction: 'RUT' })).toBe('RUT')
    expect(mallensAvdrag({})).toBe('none')
    expect(mallensAvdrag(undefined)).toBeUndefined()
  })
  it('tillåtna avdrag', () => {
    expect(tillatnaAvdrag('ROT')).toEqual({ rot: true, rut: false })
    expect(tillatnaAvdrag('RUT')).toEqual({ rot: false, rut: true })
    expect(tillatnaAvdrag('none')).toEqual({ rot: false, rut: false })
    expect(tillatnaAvdrag(undefined)).toEqual({ rot: true, rut: true })
  })
})

describe('delaArbetsrader', () => {
  it('arbetsraden följer sin tjänst', () => {
    const t = { draft_id: 't1', labor_for_item_id: null }
    const a = { draft_id: 'a1', labor_for_item_id: 't1' }
    const fri = { draft_id: 'x', labor_for_item_id: null }
    const r = delaArbetsrader([a, t, fri])
    expect(r.foraldrar).toEqual([t, fri])
    expect(r.arbetsrader).toEqual([a])
  })
  it('koppling till okänd rad eller sig själv blir vanlig tjänst', () => {
    const okand = { draft_id: 'a1', labor_for_item_id: 'saknas' }
    const sjalv = { draft_id: 'a2', labor_for_item_id: 'a2' }
    const r = delaArbetsrader([okand, sjalv])
    expect(r.arbetsrader).toEqual([])
    expect(r.foraldrar).toEqual([okand, sjalv])
  })
  it('arbetsrad på en arbetsrad kopplas inte', () => {
    const t = { draft_id: 't', labor_for_item_id: null }
    const a = { draft_id: 'a', labor_for_item_id: 't' }
    const b = { draft_id: 'b', labor_for_item_id: 'a' }
    const r = delaArbetsrader([t, a, b])
    expect(r.arbetsrader).toEqual([a])
    expect(r.foraldrar).toEqual([t, b])
  })
})
