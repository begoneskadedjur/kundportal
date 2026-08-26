// src/components/admin/invoicing/InvoiceCaseChain.tsx
// Fakturakedjan för delfakturerade ärenden + varningen "rader utanför fakturan".
// Read-only: visar alla fakturor på ärendet, ofakturerade tjänsterader och den
// kommande slutfakturan som en vertikal kedja. Ingen låtsasdata — kedjan visar
// bara det som faktiskt hänt och det som bevisligen väntar.
// Datat kommer från useInvoiceCaseChain (src/hooks).

import type { ReactNode } from 'react'
import { AlertTriangle, Link2 } from 'lucide-react'
import { formatInvoiceAmount, formatInvoiceDate } from '../../../types/invoice'
import type { CaseChainData } from '../../../hooks/useInvoiceCaseChain'

/** Amber-varning under fakturarad-tabellen: pending-rader som inte kom med.
 *  Varnar BARA när raderna har belopp — tomma 0 kr-rader är normalfallet för
 *  ett bokat återbesök (teknikern fyller i tjänsten vid utförandet), inget läckage. */
export function UnbilledRowsNotice({ chain }: { chain: CaseChainData }) {
  if (chain.loading || chain.pendingCount === 0 || chain.pendingAmount <= 0) return null
  const plural = chain.pendingCount !== 1
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-400">
      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
      <span>
        {chain.pendingCount} ofakturerad{plural ? 'e' : ''} tjänsterad{plural ? 'er' : ''} (
        {formatInvoiceAmount(chain.pendingAmount)}) på ärendet ingår inte i denna faktura
      </span>
    </div>
  )
}

// Kedjeprick: fylld = skickad/betald, teal-ring = fakturan som är öppen,
// tunn ring = faktura före utskick, streckad ring = väntar
type OrbKind = 'filled' | 'current' | 'pre' | 'waiting' | 'cancelled'

const ORB_CLASS: Record<OrbKind, string> = {
  filled: 'bg-[#20c58f]',
  current: 'bg-slate-900 border-2 border-teal-400',
  pre: 'bg-slate-900 border border-slate-500',
  waiting: 'bg-slate-900 border border-dashed border-slate-500',
  cancelled: 'bg-slate-900 border border-red-500/50',
}

function ChainRow({ orb, isLast, children }: { orb: OrbKind; isLast: boolean; children: ReactNode }) {
  return (
    <div className="relative pl-6 pb-2 last:pb-0">
      {!isLast && <span className="absolute left-[5px] top-[16px] bottom-0 w-px bg-slate-700" aria-hidden="true" />}
      <span className={`absolute left-0 top-[4px] w-[11px] h-[11px] rounded-full ${ORB_CLASS[orb]}`} aria-hidden="true" />
      {children}
    </div>
  )
}

interface InvoiceCaseChainSectionProps {
  chain: CaseChainData
  currentInvoiceId: string
  /** Ärendet har ett bokat framtida besök (status Återbesök eller framtida starttid) */
  upcomingVisitBooked?: boolean
  /** Det bokade besökets datum (timestamp från ärendet) — null om okänt */
  upcomingVisitDate?: string | null
}

export default function InvoiceCaseChainSection({
  chain,
  currentInvoiceId,
  upcomingVisitBooked = false,
  upcomingVisitDate = null
}: InvoiceCaseChainSectionProps) {
  if (!chain.show) return null

  const rows: { orb: OrbKind; node: ReactNode; key: string }[] = chain.invoices.map(inv => {
    const isCurrent = inv.id === currentInvoiceId
    const orb: OrbKind = isCurrent
      ? 'current'
      : inv.status === 'cancelled'
        ? 'cancelled'
        : ['booked', 'sent', 'paid', 'overdue'].includes(inv.status)
          ? 'filled'
          : 'pre'
    const isPartial = inv.invoice_type === 'partial' || inv.invoice_type === 'adhoc'
    return {
      key: inv.id,
      orb,
      node: (
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap text-xs">
              <span className="font-mono font-semibold text-white">{inv.invoice_number || 'Faktura'}</span>
              <span className="text-slate-500 tabular-nums">{formatInvoiceDate(inv.created_at)}</span>
              {inv.case_id == null && <span className="text-slate-400 font-medium">samlingsfaktura</span>}
              {/* Status + "· denna" medvetet borttagna: ringen till vänster pekar
                  redan ut aktuell faktura och statusen visas i header och lista */}
              {isPartial && <span className="text-teal-400 font-medium">delfaktura</span>}
            </div>
          </div>
          <span className="text-xs font-semibold text-white tabular-nums whitespace-nowrap">
            {formatInvoiceAmount(Number(inv.total_amount || 0))}
          </span>
        </div>
      ),
    }
  })

  if (chain.pendingCount > 0) {
    const plural = chain.pendingCount !== 1
    // Tomma rader + bokat återbesök = nästa besöks tjänst som teknikern fyller i
    // vid utförandet. Ingen skuld att flagga — visa vad som väntar på utförande
    // istället för ett missvisande "0 kr".
    const emptyRevisitRows = chain.pendingAmount <= 0 && upcomingVisitBooked
    rows.push({
      key: 'pending',
      orb: 'waiting',
      node: emptyRevisitRows ? (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-slate-300">
            Återbesök{upcomingVisitDate ? ` ${formatInvoiceDate(upcomingVisitDate)}` : ' bokat'}
            {chain.pendingNames.length > 0 && <> · {chain.pendingNames.join(' + ')}</>}
            <span className="text-slate-500"> — inga rader att fakturera ännu</span>
          </span>
          <span className="text-slate-500 tabular-nums whitespace-nowrap">–</span>
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-slate-300">
            {chain.pendingCount} ofakturerad{plural ? 'e' : ''} tjänsterad{plural ? 'er' : ''} på ärendet
            <span className="text-slate-500"> · kvar att fakturera</span>
          </span>
          <span className="font-semibold text-slate-300 tabular-nums whitespace-nowrap">
            {formatInvoiceAmount(chain.pendingAmount)}
          </span>
        </div>
      ),
    })
  }

  if (!chain.caseClosed) {
    rows.push({
      key: 'final',
      orb: 'waiting',
      node: (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="text-slate-500">Slutfaktura – skapas vid avslut</span>
          <span className="text-slate-500 tabular-nums">–</span>
        </div>
      ),
    })
  }

  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white mb-2">
        <Link2 className="w-4 h-4 text-teal-400" />
        Ärendets fakturakedja
      </h3>
      <div>
        {rows.map((r, i) => (
          <ChainRow key={r.key} orb={r.orb} isLast={i === rows.length - 1}>
            {r.node}
          </ChainRow>
        ))}
      </div>
    </div>
  )
}
