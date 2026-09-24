// src/services/procurementAskService.ts
// "Fråga datan" i upphandlingsportalen (docs/upphandlingsportal-plan.md
// avsnitt 4 verktyg 14). Tunn klient mot api/procurement/ask.ts, som bygger
// kontexten på servern och låter Gemini svara med källhänvisningar.

import { apiFetch } from '../lib/api'

export interface ProcurementAskHistoryItem {
  role: 'user' | 'assistant'
  text: string
}

export interface ProcurementAskSource {
  /** Kontext-id som svaret hänvisar till, t.ex. U3 */
  ref: string
  kind: 'notice' | 'award'
  id: string
  noticeId: string | null
  buyerId: string | null
  title: string
  buyerName: string | null
  date: string | null
}

export interface ProcurementAskResult {
  answer: string
  sources: ProcurementAskSource[]
}

export class ProcurementAskService {
  static async ask(question: string, history: ProcurementAskHistoryItem[] = []): Promise<ProcurementAskResult> {
    let res: Response
    try {
      res = await apiFetch('/api/procurement/ask', {
        method: 'POST',
        body: JSON.stringify({ question, history }),
      })
    } catch {
      throw new Error('Kunde inte nå servern. Kontrollera anslutningen och försök igen.')
    }
    const body = (await res.json().catch(() => null)) as (Partial<ProcurementAskResult> & { error?: string }) | null
    if (!res.ok) {
      if (body?.error) throw new Error(body.error)
      if (res.status === 504) throw new Error('Svaret dröjde för länge. Försök igen eller ställ en smalare fråga.')
      throw new Error(`Frågan kunde inte besvaras (${res.status})`)
    }
    if (!body || typeof body.answer !== 'string') throw new Error('Oväntat svar från servern')
    return { answer: body.answer, sources: Array.isArray(body.sources) ? body.sources : [] }
  }
}
