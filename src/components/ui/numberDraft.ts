// src/components/ui/numberDraft.ts
// Tolkningen bakom NumberField, ren funktion så att den kan testas.

export interface NumberDraftOptions {
  min?: number
  max?: number
  integer?: boolean
  decimals?: number
}

/**
 * Texten i ett sifferfält som tal, eller null när den är tom eller ogiltig
 * (då återställs föregående värde). Komma eller punkt som decimaltecken,
 * mellanslag (även hårda) ignoreras. Under min blir min, över max blir max.
 */
export function parseNumberDraft(raw: string, opts: NumberDraftOptions = {}): number | null {
  const s = String(raw ?? '').replace(/\s/g, '').replace(/−/g, '-').replace(',', '.')
  if (s === '' || s === '-' || s === '.' || s === '-.') return null
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null
  let n = Number(s)
  if (!Number.isFinite(n)) return null
  if (opts.integer) n = Math.round(n)
  else {
    const f = 10 ** (opts.decimals ?? 2)
    n = Math.round(n * f) / f
  }
  if (opts.min != null && n < opts.min) n = opts.min
  if (opts.max != null && n > opts.max) n = opts.max
  return n
}

/** "1234,5" med decimalkomma och utan tusentalsavgränsare, så att texten går att redigera */
export function formatNumberDraft(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return ''
  const f = 10 ** decimals
  return String(Math.round(value * f) / f).replace('.', ',')
}
