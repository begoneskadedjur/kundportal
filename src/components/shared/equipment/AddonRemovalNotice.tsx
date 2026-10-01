// src/components/shared/equipment/AddonRemovalNotice.tsx
// Förtydligandet som visas när en tilläggsstation ska tas bort. Läser
// useAddonRemovalGuard. Platt text med statuspunkt, inga piller.
// Inga krediteringar och ingen blockering: andra klicket tar bort.

import type { AddonRemovalGuard } from '../../../hooks/useAddonRemovalGuard'

interface Props {
  guard: AddonRemovalGuard
  className?: string
}

export default function AddonRemovalNotice({ guard, className = '' }: Props) {
  const { info, loading, armed } = guard

  if (loading) {
    return (
      <p className={`flex items-start gap-2 text-xs text-slate-400 ${className}`}>
        <span className="mt-1 w-2 h-2 rounded-full bg-slate-500 flex-shrink-0 animate-pulse" aria-hidden />
        <span>Kontrollerar om tilläggsstationen redan är fakturerad...</span>
      </p>
    )
  }

  if (!info?.applies) return null

  if (info.paid_through) {
    return (
      <div className={`flex items-start gap-2 ${className}`} role="note">
        <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" aria-hidden />
        <div className="min-w-0 text-sm leading-relaxed">
          <p className="font-medium text-amber-400">
            Betald till och med {info.paid_through}
          </p>
          <p className="text-slate-300 mt-0.5">
            Kunden får ingen återbetalning om den tas bort nu, och den faktureras inte längre från{' '}
            {info.next_billing_from}. Behåll den om kunden inte uttryckligen vill ta bort den.
          </p>
          {armed && (
            <p className="text-xs text-slate-400 mt-1">Klicka igen för att ta bort ändå.</p>
          )}
        </div>
      </div>
    )
  }

  if (info.not_billed_yet) {
    return (
      <p className={`flex items-start gap-2 text-sm text-slate-400 ${className}`} role="note">
        <span className="mt-1.5 w-2 h-2 rounded-full bg-slate-500 flex-shrink-0" aria-hidden />
        <span>Inte fakturerad än. Tas den bort räknas den inte med.</span>
      </p>
    )
  }

  return null
}

/**
 * Förklaringen när stationstyp och betalning är låsta på en betald
 * tilläggsstation (useAddonPaidLock). Samma platta stil som ovan.
 */
export function AddonPaidLockNotice({ paidThrough, className = '' }: { paidThrough: string | null; className?: string }) {
  if (!paidThrough) return null
  return (
    <div className={`flex items-start gap-2 ${className}`} role="note">
      <span className="mt-1.5 w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" aria-hidden />
      <div className="min-w-0 text-sm leading-relaxed">
        <p className="font-medium text-amber-400">Betald till och med {paidThrough}</p>
        <p className="text-slate-300 mt-0.5">
          Stationstyp och betalning kan inte ändras medan kunden har betalat för stationen. Ta bort den och placera en ny om något av det ska ändras.
        </p>
      </div>
    </div>
  )
}
