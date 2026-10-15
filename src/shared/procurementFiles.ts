// src/shared/procurementFiles.ts
// Vilka filer ur en zip eller en släppyta som sparas och läses av AI i steget
// Underlag (beslut 3). Ren logik utan nätverk. Gränsen 50 MB per fil är
// densamma som i api/procurement/extract-document.ts, och filtyperna är de
// som api/_lib/procurementAi.ts fileToParts kan läsa.

export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024
/** En zip packas upp i webbläsaren och sparas inte själv; gränsen skyddar bara webbläsarens minne */
export const MAX_ZIP_BYTES = 500 * 1024 * 1024

/** Filändelser som AI-läsningen klarar */
export const READABLE_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'xlsm', 'docx', 'txt', 'csv', 'htm', 'html'] as const

export type SkipReason = 'too_large' | 'unreadable' | 'nested_zip' | 'empty'

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  too_large: 'för stor (gränsen är 50 MB per fil)',
  unreadable: 'filtypen kan inte läsas',
  nested_zip: 'zip i zip packas inte upp',
  empty: 'tom fil',
}

export interface FileCandidate {
  /** Sökväg i arkivet eller filnamnet */
  name: string
  size: number
  dir?: boolean
}

export interface SkippedFile {
  name: string
  size: number
  reason: SkipReason
}

export function extensionOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

/** Filnamnet utan katalogsökväg i arkivet */
export function baseName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

/** Systemfiler och mappar som aldrig ska listas (macOS, Windows, dolda filer) */
export function isJunkEntry(path: string): boolean {
  if (/(^|\/)__MACOSX(\/|$)/.test(path)) return true
  const base = baseName(path)
  if (!base || base.startsWith('.') || base.startsWith('~$')) return true
  return /^(thumbs\.db|desktop\.ini)$/i.test(base)
}

export function isZipName(name: string): boolean {
  return extensionOf(name) === 'zip'
}

/**
 * Delar upp filer i de som ska sparas och läsas och de som hoppas över.
 * insideZip: filen kom ur en uppackad zip (då hoppas inre zip över).
 * Mappar och systemfiler tas bort tyst.
 */
export function sortFiles<T extends FileCandidate>(files: T[], opts: { insideZip?: boolean } = {}): { accepted: T[]; skipped: SkippedFile[] } {
  const accepted: T[] = []
  const skipped: SkippedFile[] = []
  for (const f of files) {
    if (f.dir || isJunkEntry(f.name)) continue
    const name = baseName(f.name)
    const ext = extensionOf(name)
    if (f.size <= 0) skipped.push({ name, size: f.size, reason: 'empty' })
    else if (ext === 'zip' && !opts.insideZip) {
      if (f.size > MAX_ZIP_BYTES) skipped.push({ name, size: f.size, reason: 'too_large' })
      else accepted.push(f)
    } else if (f.size > MAX_DOCUMENT_BYTES) skipped.push({ name, size: f.size, reason: 'too_large' })
    else if (ext === 'zip') skipped.push({ name, size: f.size, reason: 'nested_zip' })
    else if (!(READABLE_EXTENSIONS as readonly string[]).includes(ext)) skipped.push({ name, size: f.size, reason: 'unreadable' })
    else accepted.push(f)
  }
  return { accepted, skipped }
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  csv: 'text/csv',
  htm: 'text/html',
  html: 'text/html',
}

/** MIME-typ ur filändelsen, för filer ur en zip som saknar typ */
export function mimeOf(name: string): string {
  return MIME[extensionOf(name)] ?? 'application/octet-stream'
}

/**
 * Dokumenttyp som förval för filer ur underlaget. Köparens tomma prisbilaga
 * blir Bilaga, inte Prisbilaga: doc_type price_appendix betyder en inkommen
 * handling med andras priser och läses då som en sådan (extract-document).
 */
export function guessDocType(name: string): 'appendix' | 'tender_documents' {
  const n = baseName(name).toLowerCase()
  if (/pris|bilaga|appendix|bil\s?\d/.test(n)) return 'appendix'
  return 'tender_documents'
}

/** Sant när filnamnet ser ut som köparens prisbilaga (för förval i Läs in köparens prisbilaga) */
export function looksLikePriceAppendix(name: string): boolean {
  return /pris|price|anbudsformul/i.test(baseName(name))
}
