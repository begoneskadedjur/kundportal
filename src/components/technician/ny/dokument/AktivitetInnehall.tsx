// src/components/technician/ny/dokument/AktivitetInnehall.tsx
// Flikarna Aktivitet och Innehåll i dokumentdetaljen.
//
// Aktivitet: samtalsloggen, kontaktförsök och ring igen (om rollen får läsa
// åtgärdsraden) och systemhändelserna ur case_comments (förlängd, påmind,
// raderad), som gamla vyn filtrerade bort.
// Innehåll: rader ur case_billing_items (OfferItemsSection), annars produkter
// och avtalstext ur Oneflow-datat, samma som DocumentDetailPanel.

import { useEffect, useState } from 'react'
import { Icon, type IconName } from '../../../icons/Icon'
import { supabase } from '../../../../lib/supabase'
import { OfferFollowUpService, type FollowUpOffer } from '../../../../services/offerFollowUpService'
import OfferItemsSection from '../../../coordinator/follow-up/OfferItemsSection'
import type { CaseBillingItemWithRelations } from '../../../../types/caseBilling'
import { UTFALL_TEXT, svDatum, svTid } from './dokumentData'

export type Samtalsrad = Awaited<ReturnType<typeof OfferFollowUpService.getCallLogs>>[number]

export interface Systemhandelse {
  id: string
  text: string
  at: string
}

interface Handelse {
  key: string
  ikon: IconName
  rubrik: string
  text: string | null
  vem: string | null
  at: string
}

export function Aktivitet({ offer, samtal, system }: { offer: FollowUpOffer; samtal: Samtalsrad[]; system: Systemhandelse[] }) {
  const handelser: Handelse[] = [
    ...samtal.map(s => ({
      key: `s-${s.id}`,
      ikon: 'kontakt.telefon' as IconName,
      rubrik: `Samtal, ${UTFALL_TEXT[s.outcome] ?? s.outcome}`,
      text: s.note,
      vem: s.called_by_name,
      at: s.created_at,
    })),
    ...system.map(h => ({
      key: `h-${h.id}`,
      ikon: 'allman.historik' as IconName,
      rubrik: h.text,
      text: null,
      vem: null,
      at: h.at,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  const a = offer.action
  return (
    <div className="p-4 space-y-3">
      {a?.follow_up_at && (
        <p className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-[#20c58f]/10 border border-[#20c58f]/30 text-sm text-white">
          <Icon name="allman.kalender" size={20} className="flex-shrink-0 text-[#20c58f]" />
          <span>Du ringer igen <span className="font-mono">{a.follow_up_at}</span>{a.follow_up_note ? `: ${a.follow_up_note}` : ''}</span>
        </p>
      )}
      {handelser.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Inga samtal eller händelser än.</p>
      ) : (
        <ol aria-label="Aktivitet" className="divide-y divide-slate-700/60">
          {handelser.map(h => (
            <li key={h.key} className="flex items-start gap-3 py-3">
              <Icon name={h.ikon} size={20} className="mt-0.5 flex-shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-white">{h.rubrik}</p>
                {h.text && <p className="text-sm text-slate-300 whitespace-pre-wrap">{h.text}</p>}
                <p className="text-sm text-slate-400">
                  {h.vem ? `${h.vem}, ` : ''}<span className="font-mono">{svDatum(h.at)} {svTid(h.at)}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function Innehall({ offer }: { offer: FollowUpOffer }) {
  const [rader, setRader] = useState<{ services: CaseBillingItemWithRelations[]; articles: CaseBillingItemWithRelations[] } | null>(null)
  const [reserv, setReserv] = useState<{ produkter: Array<{ namn: string; pris: string | null }>; text: string | null } | null>(null)

  useEffect(() => {
    let avbruten = false
    setRader(null)
    setReserv(null)
    OfferFollowUpService.getContractItems(offer.id).then(async res => {
      if (avbruten) return
      setRader(res)
      if (res.services.length > 0 || res.articles.length > 0) return
      // Reserv: produktrader ur Oneflow-datat (finns för alla dokument)
      const { data } = await supabase.from('contracts').select('selected_products, agreement_text').eq('id', offer.id).single()
      if (avbruten || !data) return
      const produkter: Array<{ namn: string; pris: string | null }> = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Oneflow-jsonb utan typ
      for (const grupp of (data.selected_products as any[]) || []) {
        for (const p of grupp?.products || []) {
          produkter.push({ namn: p.name || 'Produkt', pris: p.price_2?.amount?.amount || p.price_1?.amount?.amount || null })
        }
      }
      setReserv({ produkter, text: data.agreement_text || null })
    }).catch(() => { if (!avbruten) setRader({ services: [], articles: [] }) })
    return () => { avbruten = true }
  }, [offer.id])

  if (rader === null) return <p className="p-6 text-center text-sm text-slate-400">Hämtar innehållet</p>
  if (rader.services.length > 0 || rader.articles.length > 0) {
    return <div className="p-4"><OfferItemsSection services={rader.services} articles={rader.articles} loading={false} error={null} /></div>
  }
  if (!reserv || (reserv.produkter.length === 0 && !reserv.text)) {
    return <p className="p-6 text-center text-sm text-slate-400">Inget innehåll att visa.</p>
  }
  return (
    <div className="p-4 space-y-3">
      {reserv.produkter.length > 0 && (
        <ul className="rounded-xl border border-slate-700/60 divide-y divide-slate-700/60">
          {reserv.produkter.map((p, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-3.5 min-h-[44px] text-[15px]">
              <span className="text-white">{p.namn}</span>
              {p.pris && <span className="font-mono text-sm text-slate-300">{Math.round(Number(p.pris)).toLocaleString('sv-SE')} kr</span>}
            </li>
          ))}
        </ul>
      )}
      {reserv.text && <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{reserv.text}</p>}
    </div>
  )
}
