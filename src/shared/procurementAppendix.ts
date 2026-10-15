// src/shared/procurementAppendix.ts
// Prisbilagan i fyra steg (beslut 4), steg a "Läs in köparens prisbilaga":
// tvätt av AI-svaret innan raderna sparas, och cellreferenser för att
// kunna skriva priserna i en kopia av köparens fil (steg d). Ren logik utan
// nätverk; används av api/procurement/read-price-appendix.ts och tester.
// Ren typfil utan import.meta, ingår i API-projektet.

export interface AppendixRow {
  label: string
  unit: string | null
  quantity: number
  sheet: string | null
  /** Cellen där vårt à-pris ska skrivas, t.ex. E12 */
  price_cell: string | null
  row: number | null
}

/** Celler i ett blad: adress till visat värde, för kontroll av AI:ns cellval */
export type SheetCells = Map<string, string | number | boolean | null>

export const MAX_APPENDIX_ROWS = 300

const CELL_RE = /^([A-Z]{1,3})([1-9]\d{0,5})$/

export function parseCell(ref: string | null | undefined): { col: string; row: number } | null {
  const m = String(ref ?? '').trim().toUpperCase().match(CELL_RE)
  return m ? { col: m[1], row: Number(m[2]) } : null
}

/** Kolumnbokstav till nummer: A=1, Z=26, AA=27 */
export function colNumber(col: string): number {
  let n = 0
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

/** Nummer till kolumnbokstav: 1=A, 27=AA */
export function colLetter(n: number): string {
  let s = ''
  let x = n
  while (x > 0) {
    const r = (x - 1) % 26
    s = String.fromCharCode(65 + r) + s
    x = Math.floor((x - 1) / 26)
  }
  return s
}

function text(v: unknown, max: number): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, max) : null
}

function quantity(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v
  if (typeof v === 'string') {
    const n = Number(v.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.]/g, ''))
    if (v.trim() && Number.isFinite(n) && n >= 0) return n
  }
  return 1
}

/**
 * Tvättar AI:ns rader. Med sheets (xlsx) kontrolleras att bladet finns, att
 * priscellen ligger på radens rad och att den är tom eller ett tal; annars
 * stryks cellen (raden sparas ändå, men exporten fyller inte i den).
 */
export function cleanAppendixRows(raw: unknown, sheets?: Map<string, SheetCells> | null): AppendixRow[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows) ? (raw as { rows: unknown[] }).rows : []
  const out: AppendixRow[] = []
  const seenCells = new Set<string>()
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const label = text(o.label, 500)
    if (!label) continue
    let sheet = text(o.sheet, 120)
    let cell = parseCell(text(o.price_cell, 12))
    let row = typeof o.row === 'number' && Number.isInteger(o.row) && o.row > 0 ? o.row : null
    if (sheets) {
      const cells = sheet ? sheets.get(sheet) : undefined
      if (!cells) {
        sheet = null
        cell = null
      } else if (cell) {
        const ref = `${cell.col}${cell.row}`
        const current = cells.get(ref)
        const okValue = current == null || current === '' || typeof current === 'number'
        const okRow = row == null || row === cell.row
        if (!okValue || !okRow || seenCells.has(`${sheet}!${ref}`)) cell = null
        else {
          seenCells.add(`${sheet}!${ref}`)
          row = cell.row
        }
      }
    } else {
      sheet = null
      cell = null
    }
    out.push({
      label,
      unit: text(o.unit, 40),
      quantity: quantity(o.quantity),
      sheet,
      price_cell: cell ? `${cell.col}${cell.row}` : null,
      row,
    })
    if (out.length >= MAX_APPENDIX_ROWS) break
  }
  return out
}

/**
 * Bladet som text för AI:n, en rad per kalkylbladsrad med celladresser:
 * "R12: A12=Förebyggande kontroll | C12=240 | E12=(tom)". Tomma celler i
 * kolumner som har värden på andra rader visas som (tom) så att AI:n kan
 * peka ut priscellen.
 */
export function sheetToGridText(name: string, cells: SheetCells, opts: { maxRows?: number; maxCols?: number } = {}): string {
  const maxRows = opts.maxRows ?? 400
  const maxCols = opts.maxCols ?? 20
  const byRow = new Map<number, Map<number, string | number | boolean | null>>()
  const usedCols = new Set<number>()
  for (const [ref, v] of cells) {
    const c = parseCell(ref)
    if (!c) continue
    const cn = colNumber(c.col)
    if (cn > maxCols || c.row > maxRows) continue
    if (v != null && v !== '') usedCols.add(cn)
    const r = byRow.get(c.row) ?? new Map()
    r.set(cn, v)
    byRow.set(c.row, r)
  }
  const cols = [...usedCols].sort((a, b) => a - b)
  const lines: string[] = [`## Blad: ${name}`]
  for (const rowNo of [...byRow.keys()].sort((a, b) => a - b)) {
    const r = byRow.get(rowNo)!
    if (![...r.values()].some((v) => v != null && v !== '')) continue
    const parts = cols.map((cn) => {
      const v = r.get(cn)
      const shown = v == null || v === '' ? '(tom)' : String(v).replace(/\s+/g, ' ').slice(0, 160)
      return `${colLetter(cn)}${rowNo}=${shown}`
    })
    lines.push(`R${rowNo}: ${parts.join(' | ')}`)
  }
  return lines.join('\n')
}
