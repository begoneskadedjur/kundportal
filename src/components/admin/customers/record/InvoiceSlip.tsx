// src/components/admin/customers/record/InvoiceSlip.tsx
//
// Fakturakvittot. Där ContractStamp är bläck på papper är detta en pappers-
// remsa med perforerad rivkant — samma hantverk, annat objekt.
//
// Betald får en stämpelbåge, förfallen en markering i hörnet, historik en
// blekt ton utan interaktionsaffordans.

import { useId } from 'react'

export type SlipVariant = 'paid' | 'sent' | 'pending' | 'overdue' | 'cancelled' | 'historical'

const SLIP: Record<SlipVariant, { ink: string; paper: string; opacity: number }> = {
  paid: { ink: '#20c58f', paper: '#1e293b', opacity: 1 },
  sent: { ink: '#60a5fa', paper: '#1e293b', opacity: 1 },
  pending: { ink: '#64748b', paper: '#1e293b', opacity: 1 },
  overdue: { ink: '#f87171', paper: '#1e293b', opacity: 1 },
  cancelled: { ink: '#475569', paper: '#1e293b', opacity: 0.55 },
  historical: { ink: '#64748b', paper: '#172033', opacity: 0.7 },
}

export default function InvoiceSlip({
  variant,
  size = 32,
  aged = false,
}: {
  variant: SlipVariant
  size?: number
  /** Historik: mjukare kant — pappret är arkiverat, inte färskt */
  aged?: boolean
}) {
  const spec = SLIP[variant]
  const uid = useId().replace(/:/g, '')

  // Rivkant: sågtand längs nederkanten med oregelbunden amplitud
  const tearPath = [0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => {
      const x = 7 + i * 6.25
      const dip = 60 + (i % 3 === 0 ? 3.4 : i % 2 === 0 ? 1.8 : 2.9)
      return `L ${x + 3.1} ${dip} L ${x + 6.25} 60`
    })
    .join(' ')

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 70"
      className="overflow-visible shrink-0"
      role="img"
      aria-label="Faktura"
      opacity={spec.opacity}
    >
      <defs>
        {/* Pappersfiber: mycket lågt brus som bryter upp ytan */}
        <filter id={`${uid}-fiber`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="11" result="g" />
          <feColorMatrix
            in="g"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.55 0.38"
            result="m"
          />
          <feComposite in="SourceGraphic" in2="m" operator="in" />
        </filter>
        {aged && (
          <filter id={`${uid}-soft`}>
            <feGaussianBlur stdDeviation="0.35" />
          </filter>
        )}
      </defs>

      <g filter={aged ? `url(#${uid}-soft)` : undefined}>
        {/* Pappret: rak topp, hörnveck uppe till höger, rivkant nedtill */}
        <path
          d={`M 7 5 L 48 5 L 57 14 L 57 60 ${tearPath} L 7 60 Z`}
          fill={spec.paper}
          stroke={spec.ink}
          strokeWidth="1.6"
          strokeLinejoin="round"
          opacity={variant === 'historical' ? 0.5 : 0.85}
        />
        <path
          d="M 48 5 L 48 14 L 57 14"
          fill="none"
          stroke={spec.ink}
          strokeWidth="1.4"
          strokeLinejoin="round"
          opacity="0.7"
        />

        {/* Fakturarader — den sista kortare (summan) */}
        <g stroke={spec.ink} strokeWidth="1.8" strokeLinecap="round" opacity="0.42">
          <line x1="14" y1="26" x2="46" y2="26" />
          <line x1="14" y1="34" x2="46" y2="34" />
          <line x1="14" y1="42" x2="34" y2="42" />
        </g>
        <line x1="36" y1="50" x2="50" y2="50" stroke={spec.ink} strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
      </g>

      {/* Betald: stämpelbåge tvärs över, samma bläckspråk som ContractStamp */}
      {variant === 'paid' && (
        <g transform="rotate(-11 32 40)" opacity="0.9">
          <path d="M 11 44 Q 32 38 53 44" fill="none" stroke="#20c58f" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M 13 48 Q 32 43 51 48" fill="none" stroke="#20c58f" strokeWidth="1.1" strokeLinecap="round" opacity="0.6" />
        </g>
      )}

      {/* Förfallen: markering i övre högra hörnet */}
      {variant === 'overdue' && (
        <g opacity="0.95">
          <circle cx="53" cy="9" r="6.5" fill="#f87171" />
          <line x1="53" y1="5.5" x2="53" y2="10" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="53" cy="12.6" r="1" fill="#0f172a" />
        </g>
      )}

      {/* Makulerad: struket över hela remsan */}
      {variant === 'cancelled' && (
        <line x1="9" y1="55" x2="55" y2="12" stroke="#64748b" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      )}

      <g filter={`url(#${uid}-fiber)`} opacity="0.14" aria-hidden>
        <rect x="7" y="5" width="50" height="55" fill={spec.ink} />
      </g>
    </svg>
  )
}
