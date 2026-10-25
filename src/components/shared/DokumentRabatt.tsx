// src/components/shared/DokumentRabatt.tsx
// Rabatt på en offert eller ett avtal (utkast i Oneflow). Ett dokument med
// rabatt får inte skickas till kunden förrän rabatten är godkänd av en
// rabattansvarig (profiles.can_approve_discounts). Servern spärrar i
// api/oneflow/draft.ts (409 "Rabatten väntar på godkännande"); här visas
// spärren där Skicka finns: wizardens sista steg, KontorDetalj,
// DocumentDetailPanel och teknikerns DokumentDetalj.
//
// useDokumentRabatt (src/hooks/useDokumentRabatt.ts) läser dokumentets
// rabattrader. DokumentRabattRuta visar raderna platt (listpris, procent, pris
// efter rabatt, motivering, status) och låter en rabattansvarig godkänna eller
// avslå direkt.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '../icons/Icon'
import { useAuth } from '../../contexts/AuthContext'
import { DiscountApprovalService } from '../../services/discountApprovalService'
import { discountApprovalText } from '../../types/caseBilling'
import type { DokumentRabattLage } from '../../hooks/useDokumentRabatt'

const kr = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} kr`
const procent = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 2 })

interface DokumentRabattRutaProps {
  contractId: string
  /** 'offer' eller 'contract': styr texten */
  documentType: string | null | undefined
  lage: DokumentRabattLage
  /** Kompakt: bara statusraden och knapparna (t.ex. i en modalfot) */
  compact?: boolean
  onChanged?: () => void
}

export function DokumentRabattRuta({ contractId, documentType, lage, compact = false, onChanged }: DokumentRabattRutaProps) {
  const { profile, user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  if (lage.lines.length === 0) return null
  const canApprove = !!profile?.can_approve_discounts
  const vad = documentType === 'offer' ? 'Offerten' : 'Avtalet'
  const pending = lage.lines.some(l => l.state.kind === 'pending')
  const rejected = lage.lines.find(l => l.state.kind === 'rejected')
  const name = profile?.display_name || user?.email || 'Rabattansvarig'

  const godkann = async () => {
    if (busy) return
    setBusy(true)
    try {
      await DiscountApprovalService.approveDocument(contractId, name)
      toast.success(`Rabatten är godkänd. ${vad} kan skickas.`)
      await lage.reload()
      onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte godkänna rabatten')
    } finally {
      setBusy(false)
    }
  }

  const avsla = async () => {
    if (busy || !reason.trim()) return
    setBusy(true)
    try {
      await DiscountApprovalService.rejectDocument(contractId, name, reason.trim())
      toast.success('Rabatten är avslagen')
      setRejecting(false)
      setReason('')
      await lage.reload()
      onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte avslå rabatten')
    } finally {
      setBusy(false)
    }
  }

  const statusText = pending
    ? `${vad} kan inte skickas förrän rabatten är godkänd av rabattansvarig.`
    : rejected
      ? `Rabatten är avslagen. Ändra rabatten innan ${vad.toLowerCase()} skickas.`
      : 'Rabatten är godkänd.'
  const dot = pending ? 'bg-amber-400' : rejected ? 'bg-red-400' : 'bg-[#20c58f]'

  return (
    <div className={compact ? 'space-y-2' : 'p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2'}>
      {!compact && (
        <div className="flex items-center gap-1.5">
          <Icon name="allman.kalkyl" size={16} className="text-slate-400" />
          <span className="text-sm font-semibold text-white">Rabatt</span>
        </div>
      )}
      {!compact && lage.lines.map(l => {
        const listTotal = l.unitPrice * l.quantity
        return (
          <div key={l.id} className="text-xs text-slate-400 space-y-0.5">
            <p className="text-slate-200">{l.name}{l.quantity > 1 ? `, ${procent(l.quantity)} st` : ''}</p>
            <p>
              Listpris {kr(listTotal)} · Rabatt {procent(l.discountPercent)} % · Pris efter rabatt{' '}
              <span className="text-white font-medium">{kr(l.totalPrice)}</span> exkl. moms
            </p>
            {l.motivation && <p className="italic">"{l.motivation}"</p>}
            <p className="flex items-center gap-1.5 text-slate-300">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${l.state.kind === 'approved' ? 'bg-[#20c58f]' : l.state.kind === 'rejected' ? 'bg-red-400' : 'bg-amber-400'}`} />
              {discountApprovalText(l.state)}
            </p>
          </div>
        )
      })}
      <p className="flex items-start gap-1.5 text-xs text-slate-200">
        <span className={`w-1.5 h-1.5 mt-1.5 rounded-full shrink-0 ${dot}`} />
        {statusText}
      </p>
      {canApprove && (pending || rejected) && (
        rejecting ? (
          <div className="space-y-2">
            <label htmlFor={`dokument-rabatt-avslag-${contractId}`} className="block text-xs font-medium text-slate-400">
              Anledning till avslaget (krävs)
            </label>
            <textarea
              id={`dokument-rabatt-avslag-${contractId}`}
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] resize-none"
              placeholder="Till exempel: rabatten är för hög för den här kunden."
            />
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => { setRejecting(false); setReason('') }} className="min-h-[36px] px-3 text-xs text-slate-300 hover:text-white">
                Avbryt
              </button>
              <button
                type="button"
                onClick={avsla}
                disabled={busy || !reason.trim()}
                className="min-h-[36px] px-3 text-xs font-medium bg-red-500/90 hover:bg-red-500 text-[#fff] rounded-lg disabled:opacity-50"
              >
                Avslå rabatten
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejecting(true)}
              disabled={busy}
              className="min-h-[36px] px-3 text-xs font-medium text-red-300 border border-red-500/40 hover:bg-red-500/10 rounded-lg disabled:opacity-50"
            >
              Avslå
            </button>
            <button
              type="button"
              onClick={godkann}
              disabled={busy}
              className="min-h-[36px] inline-flex items-center gap-1.5 px-3 text-xs font-medium bg-[#20c58f] hover:bg-[#1aaa7a] text-[#fff] rounded-lg disabled:opacity-50"
            >
              {busy ? <Icon name="allman.laddar" size={16} className="animate-spin" /> : <Icon name="allman.bock" size={16} />}
              Godkänn rabatten
            </button>
          </div>
        )
      )}
    </div>
  )
}
