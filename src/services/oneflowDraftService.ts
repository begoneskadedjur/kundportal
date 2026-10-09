// src/services/oneflowDraftService.ts - Utkast i Oneflow: visa PDF, skicka, ta bort
// Klient till api/oneflow/draft.ts. Används av avtalswizardens sista steg och
// av Dokumentsignering för utkast som sparats för att skickas senare.
import { apiFetch } from '../lib/api'

async function felmeddelande(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null) as { message?: string } | null
  return data?.message || fallback
}

const vanta = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class OneflowDraftService {
  /**
   * Hämtar Oneflows PDF för dokumentet som Blob. Oneflow bygger PDF:en strax
   * efter att utkastet skapats, så ett 409-svar ("inte klar ännu") ger nya
   * försök med kort paus innan vi ger upp.
   */
  static async fetchPdf(oneflowContractId: string | number, forsok = 5): Promise<Blob> {
    for (let i = 0; i < forsok; i++) {
      const res = await apiFetch(`/api/oneflow/draft?oneflowContractId=${encodeURIComponent(String(oneflowContractId))}`)
      if (res.ok) return res.blob()
      if (res.status !== 409 || i === forsok - 1) {
        throw new Error(await felmeddelande(res, 'Kunde inte hämta PDF:en från Oneflow'))
      }
      await vanta(1500 * (i + 1))
    }
    throw new Error('Kunde inte hämta PDF:en från Oneflow')
  }

  /** Skickar utkastet för signering (offert: för granskning). */
  static async publish(oneflowContractId: string | number): Promise<{ id: number; state: string }> {
    const res = await apiFetch('/api/oneflow/draft', {
      method: 'POST',
      body: JSON.stringify({ action: 'publish', oneflowContractId: String(oneflowContractId) }),
    })
    if (!res.ok) throw new Error(await felmeddelande(res, 'Kunde inte skicka dokumentet'))
    const data = await res.json() as { contract: { id: number; state: string } }
    return data.contract
  }

  /** Tar bort utkastet i Oneflow och dess rad i portalen. Bara utkast. */
  static async remove(oneflowContractId: string | number): Promise<void> {
    const res = await apiFetch('/api/oneflow/draft', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', oneflowContractId: String(oneflowContractId) }),
    })
    if (!res.ok) throw new Error(await felmeddelande(res, 'Kunde inte ta bort utkastet'))
  }
}
