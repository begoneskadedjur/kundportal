// src/components/customer/PaymentBlockBanner.tsx
// Kundportalens banner och spärrkoll för betalningsspärren (3.128.0).
// Kunden ser aldrig den interna orsaken eller kommentaren, bara att det finns
// obetalda fakturor och hur Begone nås. Förfrågningsknapparna stängs för de
// kunder (enheter) som är spärrade, egen spärr eller huvudkontorets.

import { useEffect, useState } from 'react'
import { Icon } from '../icons/Icon'
import { PaymentBlockService } from '../../services/paymentBlockService'

export const PAYMENT_BLOCK_PORTAL_TEXT =
  'Vi har obetalda fakturor registrerade på ert konto. Kontakta oss så hjälper vi er.'

let cache: { ids: string[]; at: number } | null = null
let inflight: Promise<string[]> | null = null
const TTL_MS = 60_000

async function loadBlockedIds(): Promise<string[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.ids
  if (!inflight) {
    inflight = PaymentBlockService.getMyBlockedCustomerIds()
      .then((ids) => {
        cache = { ids, at: Date.now() }
        return ids
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Spärrade kund-id:n inom den inloggades behörighet (tom lista = ingen spärr) */
export function useMyPaymentBlocks(): { blockedIds: string[]; loading: boolean; isBlocked: (customerId?: string | null) => boolean } {
  const [blockedIds, setBlockedIds] = useState<string[]>(cache?.ids ?? [])
  const [loading, setLoading] = useState(!cache)
  useEffect(() => {
    let alive = true
    loadBlockedIds()
      .then((ids) => {
        if (alive) setBlockedIds(ids)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])
  return {
    blockedIds,
    loading,
    isBlocked: (customerId) => !!customerId && blockedIds.includes(customerId),
  }
}

interface BannerProps {
  /** Visa bara om någon av dessa kunder är spärrad; utan lista räcker vilken som helst */
  customerIds?: string[]
  className?: string
}

export function PaymentBlockContact({ className = '' }: { className?: string }) {
  return (
    <span className={className}>
      Ring <a href="tel:0102804410" className="underline hover:text-white">010 280 44 10</a> (vardagar 08 till 17) eller mejla{' '}
      <a href="mailto:info@begone.se" className="underline hover:text-white">info@begone.se</a>.
    </span>
  )
}

export default function PaymentBlockBanner({ customerIds, className = '' }: BannerProps) {
  const { blockedIds } = useMyPaymentBlocks()
  const show = customerIds && customerIds.length > 0
    ? customerIds.some((id) => blockedIds.includes(id))
    : blockedIds.length > 0
  if (!show) return null
  return (
    <div role="status" className={`p-3 rounded-xl border bg-amber-500/10 border-amber-500/40 ${className}`}>
      <div className="flex items-start gap-2">
        <Icon name="allman.info" size={16} className="text-amber-300 mt-0.5 shrink-0" />
        <div className="text-sm text-slate-200">
          <p>{PAYMENT_BLOCK_PORTAL_TEXT}</p>
          <p className="mt-1 text-xs text-slate-400">
            Nya förfrågningar kan inte skickas via portalen just nu. <PaymentBlockContact />
          </p>
        </div>
      </div>
    </div>
  )
}

/** Ersätter förfrågningsformuläret när kunden (eller huvudkontoret) är spärrad */
export function PaymentBlockedRequestNotice({ className = '' }: { className?: string }) {
  return (
    <div role="alert" className={`p-4 rounded-xl border bg-amber-500/10 border-amber-500/40 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
        <Icon name="allman.info" size={16} />
        Förfrågan kan inte skickas just nu
      </div>
      <p className="mt-2 text-sm text-slate-200">{PAYMENT_BLOCK_PORTAL_TEXT}</p>
      <p className="mt-1 text-xs text-slate-400">
        <PaymentBlockContact />
      </p>
    </div>
  )
}

/** Triggern i databasen stoppade en förfrågan (sista skyddet om sidan inte hunnit läsa spärren) */
export function isPaymentBlockDbError(err: unknown): boolean {
  const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err ?? '')
  return msg.includes('BETALNINGSSPÄRR')
}
