// src/components/fragor/filer.ts
// Bilagor i Frågor och uppdrag: samma gränser som kommunikationspanelen
// (bilder och PDF, högst 5 MB, bucket comment-attachments).

import toast from 'react-hot-toast'

export const MAX_FILSTORLEK = 5 * 1024 * 1024
export const TILLATNA_TYPER = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

/** Filtrerar bort filer som inte är bild eller PDF eller är större än 5 MB, med meddelande */
export function giltigaFiler(lista: FileList | null): File[] {
  if (!lista) return []
  const ok: File[] = []
  for (const f of Array.from(lista)) {
    if (!TILLATNA_TYPER.includes(f.type)) {
      toast.error(`${f.name}: bara bilder och PDF`)
      continue
    }
    if (f.size > MAX_FILSTORLEK) {
      toast.error(`${f.name}: filen är större än 5 MB`)
      continue
    }
    ok.push(f)
  }
  return ok
}
