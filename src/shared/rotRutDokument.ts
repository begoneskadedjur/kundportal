// src/shared/rotRutDokument.ts
// ROT/RUT i Skapa avtal eller offert (3.106.0). Delas av guiden
// (OneflowContractCreator, CaseServiceSelector) och servern (api/oneflow/create-contract.ts).
//
// Regler:
//   - Ett dokument har högst en avdragstyp (ROT eller RUT).
//   - Avdraget ligger bara på arbetstidstjänster (rot_eligible/rut_eligible i katalogen),
//     aldrig på en paketprisad tjänst där material ingår.
//   - Mallen bestämmer avdraget. Oneflow-mallarna har hårdkodad text: ROT-mallen söker
//     30 % och RUT-mallen 50 % av arbetskostnaden. ROT-mall = bara ROT, RUT-mall = bara RUT,
//     mall utan avdrag = inget avdrag. Byts mallen efter att avdrag satts ändras inga rader
//     automatiskt: felet visas och Nästa spärras tills raderna eller mallen rättas.

export type Avdrag = 'ROT' | 'RUT'
/** Mallens avdrag. 'none' = mallen har inget avdrag. */
export type MallAvdrag = Avdrag | 'none'

export interface RotRutRad {
  rot_rut_type?: Avdrag | null
  service_name?: string | null
  service?: { rot_eligible?: boolean | null; rut_eligible?: boolean | null } | null
}

export interface MallInfo {
  avdrag: MallAvdrag
  /** Mallens namn, för felmeddelandet */
  namn?: string | null
}

/** Mallens avdrag ur mallens deduction-fält. Okänd mall (undefined) = ingen spärr på mallen. */
export function mallensAvdrag(mall: { deduction?: Avdrag | null } | null | undefined): MallAvdrag | undefined {
  if (!mall) return undefined
  return mall.deduction === 'ROT' || mall.deduction === 'RUT' ? mall.deduction : 'none'
}

const namnLista = (rader: RotRutRad[]) =>
  Array.from(new Set(rader.map(r => `"${r.service_name || 'Tjänst'}"`))).join(', ')

const andra = (a: Avdrag): Avdrag => (a === 'ROT' ? 'RUT' : 'ROT')

/**
 * Felet i dokumentets ROT/RUT-val, eller '' när allt stämmer.
 * Ordning: avdrag på en tjänst som inte är arbetstid, båda typerna, mallen.
 */
export function rotRutFel(rader: RotRutRad[], mall?: MallInfo | null): string {
  const avdragsRader = rader.filter(r => r.rot_rut_type === 'ROT' || r.rot_rut_type === 'RUT')
  if (avdragsRader.length === 0) return ''

  // Tjänsten saknas på raden (okänd) räknas inte som fel här; servern slår upp katalogen
  const felPlacerade = avdragsRader.filter(r => r.service && !r.service.rot_eligible && !r.service.rut_eligible)
  if (felPlacerade.length > 0) {
    return `ROT/RUT ligger på ${namnLista(felPlacerade)}, som inte är arbetstid. Välj Inget avdrag på raden och tryck Dela upp för ROT/RUT, så hamnar avdraget på arbetskostnaden.`
  }

  const harRot = avdragsRader.some(r => r.rot_rut_type === 'ROT')
  const harRut = avdragsRader.some(r => r.rot_rut_type === 'RUT')
  const mallAvdrag = mall?.avdrag

  if (harRot && harRut) {
    if (mallAvdrag === 'ROT' || mallAvdrag === 'RUT') {
      const fel = avdragsRader.filter(r => r.rot_rut_type !== mallAvdrag)
      return `Dokumentet har både ROT och RUT, men kan bara ha ett avdrag. Mallen gäller ${mallAvdrag}: byt till ${mallAvdrag} på ${namnLista(fel)}.`
    }
    return 'Dokumentet har både ROT och RUT, men kan bara ha ett avdrag. Välj samma avdrag på alla rader, eller Inget avdrag.'
  }

  if (!mallAvdrag) return ''
  const typ: Avdrag = harRot ? 'ROT' : 'RUT'
  if (mallAvdrag === 'none') {
    const mallText = mall?.namn ? `Mallen ${mall.namn}` : 'Mallen'
    return `${mallText} har inget ROT- eller RUT-avdrag, men ${namnLista(avdragsRader)} har ${typ}. Välj Inget avdrag på raden, eller välj ${typ}-mallen i steget Mall.`
  }
  if (mallAvdrag !== typ) {
    return `Mallen gäller ${mallAvdrag}, men ${namnLista(avdragsRader)} har ${typ}. Byt till ${mallAvdrag} på raden, eller välj ${andra(mallAvdrag)}-mallen i steget Mall.`
  }
  return ''
}

/**
 * Vilka avdrag som går att välja med mallen. undefined (okänd mall) = båda,
 * som i ärendet där ingen mall finns.
 */
export function tillatnaAvdrag(mallAvdrag: MallAvdrag | undefined): { rot: boolean; rut: boolean } {
  if (mallAvdrag === undefined) return { rot: true, rut: true }
  return { rot: mallAvdrag === 'ROT', rut: mallAvdrag === 'RUT' }
}

/**
 * Delar dokumentets tjänsterader i tjänster och arbetsrader (ROT/RUT v2).
 * En arbetsrad pekar med labor_for_item_id på sin tjänsterads draft_id. Pekar
 * den på något som inte finns bland raderna, eller på sig själv, räknas den
 * som en vanlig tjänst (kopplingen kan inte sparas).
 */
export function delaArbetsrader<T extends { draft_id?: string | null; labor_for_item_id?: string | null }>(
  tjanster: T[]
): { foraldrar: T[]; arbetsrader: T[] } {
  const ids = new Set(tjanster.map(t => t.draft_id).filter((id): id is string => !!id))
  const arArbetsrad = (t: T) =>
    !!t.labor_for_item_id && t.labor_for_item_id !== t.draft_id && ids.has(t.labor_for_item_id)
  const foraldrar = tjanster.filter(t => !arArbetsrad(t))
  const arbetsrader = tjanster.filter(arArbetsrad)
  // En arbetsrad vars tjänst själv är en arbetsrad (ska inte finnas) kopplas inte
  const foralderIds = new Set(foraldrar.map(t => t.draft_id))
  return {
    foraldrar: [...foraldrar, ...arbetsrader.filter(a => !foralderIds.has(a.labor_for_item_id!))],
    arbetsrader: arbetsrader.filter(a => foralderIds.has(a.labor_for_item_id!)),
  }
}
