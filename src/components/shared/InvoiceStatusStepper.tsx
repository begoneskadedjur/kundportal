// src/components/shared/InvoiceStatusStepper.tsx
// Läsvariant av statusstepper för fakturaflödet:
// Godkännande → Redo → Utkast i Fortnox → Bokförd → Skickad → Betald.
// Ren visning - statusövergångar sker via fakturamodalens befintliga
// knappar och Fortnox-synk, aldrig härifrån. Makulerad/förfallen visas
// som chip vid sidan, samma visuella språk som CaseStatusStepper.
import { Fragment } from 'react'
import { Check, XCircle, Clock } from 'lucide-react'

const STEPS: { key: string; label: string }[] = [
  { key: 'pending_approval', label: 'Godkännande' },
  { key: 'ready', label: 'Redo' },
  { key: 'draft', label: 'Utkast i Fortnox' },
  { key: 'booked', label: 'Bokförd' },
  { key: 'sent', label: 'Skickad' },
  { key: 'paid', label: 'Betald' },
]

interface InvoiceStatusStepperProps {
  status: string
  /** Datum per steg i samma ordning som stegen (null = visas ej) */
  stepDates?: (string | null | undefined)[]
  isOverdue?: boolean
  /** "Nästa steg"-text under steppern, t.ex. statusbeskrivningen */
  nextStepText?: string | null
}

function fmtDate(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

export default function InvoiceStatusStepper({
  status,
  stepDates,
  isOverdue = false,
  nextStepText
}: InvoiceStatusStepperProps) {
  const isCancelled = status === 'cancelled'
  const currentIdx = isCancelled ? -1 : STEPS.findIndex(s => s.key === status)

  return (
    <div className="px-4 py-2.5 border-b border-slate-700/50">
      <div className="flex items-center gap-3">
        <div className={`flex items-center flex-1 min-w-0 ${isCancelled ? 'opacity-40' : ''}`}>
          {STEPS.map((step, i) => {
            const done = currentIdx > i
            const active = currentIdx === i
            const date = fmtDate(stepDates?.[i])
            return (
              <Fragment key={step.key}>
                {i > 0 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded transition-colors duration-300 ${
                    !isCancelled && i <= currentIdx ? 'bg-[#20c58f]' : 'bg-slate-700'
                  }`} />
                )}
                <div className="flex flex-col items-center gap-0.5">
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${
                    done ? 'text-[#20c58f]' : active ? 'text-white' : 'text-slate-500'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                      done
                        ? 'bg-[#20c58f] border-[#20c58f]'
                        : active
                          ? 'border-[#20c58f] bg-[#20c58f]/20'
                          : 'border-slate-600'
                    }`}>
                      {done
                        ? <Check className="w-3 h-3 text-[#fff]" />
                        : <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-[#20c58f]' : 'bg-slate-600'}`} />}
                    </span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </span>
                  {date && <span className="text-[10px] text-slate-500 font-mono leading-none">{date}</span>}
                </div>
              </Fragment>
            )
          })}
        </div>

        {isCancelled && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-red-500/20 text-red-400 border-red-500/30 flex-shrink-0">
            <XCircle className="w-3.5 h-3.5" />
            Makulerad
          </span>
        )}
        {!isCancelled && isOverdue && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-red-500/20 text-red-400 border-red-500/30 flex-shrink-0">
            <Clock className="w-3.5 h-3.5" />
            Förfallen
          </span>
        )}
      </div>

      {nextStepText && !isCancelled && (
        <p className="text-[11px] text-slate-500 mt-1.5">{nextStepText}</p>
      )}
    </div>
  )
}
