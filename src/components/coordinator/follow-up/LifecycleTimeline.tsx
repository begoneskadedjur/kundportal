// src/components/coordinator/follow-up/LifecycleTimeline.tsx
// Horisontell livscykel-stepper för ett dokument:
// Skickad → Öppnad → Kommenterad → Signerad → Kund → Bokad
import type { FollowUpOffer } from '../../../services/offerFollowUpService'

interface TimelineNode {
  label: string
  /** Tidsstämpel eller kort text under noden */
  detail: string | null
  state: 'done' | 'current' | 'pending' | 'failed'
}

function fmtShort(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
}

function buildNodes(offer: FollowUpOffer): TimelineNode[] {
  const isSigned = offer.status === 'signed'
  const isDead = offer.status === 'overdue' || offer.status === 'declined'
  const sentBy = offer.created_by_name || offer.begone_employee_name

  const nodes: TimelineNode[] = []

  nodes.push({
    label: 'Skickad',
    detail: [fmtShort(offer.created_at), sentBy ? `av ${sentBy.split(' ')[0]}` : null].filter(Boolean).join(' '),
    state: 'done',
  })

  nodes.push({
    label: 'Öppnad',
    detail: fmtShort(offer.customer_first_viewed_at) || (offer.email_delivery_failed_at ? 'e-post studsade' : null),
    state: offer.email_delivery_failed_at ? 'failed' : offer.customer_first_viewed_at ? 'done' : 'pending',
  })

  nodes.push({
    label: 'Kommenterad',
    detail: fmtShort(offer.latest_customer_comment?.at),
    state: offer.latest_customer_comment ? 'done' : 'pending',
  })

  if (isDead) {
    nodes.push({
      label: offer.status === 'overdue' ? 'Förfallen' : 'Avfärdad',
      detail: fmtShort(offer.status_updated_at),
      state: 'failed',
    })
  } else {
    nodes.push({
      label: 'Signerad',
      detail: isSigned ? fmtShort(offer.status_updated_at) : null,
      state: isSigned ? 'done' : 'current',
    })
  }

  nodes.push({
    label: 'Kund',
    detail: offer.customer_id ? 'registrerad' : null,
    state: offer.customer_id ? 'done' : isSigned ? 'current' : 'pending',
  })

  nodes.push({
    label: 'Bokad',
    detail: offer.booked_case_id ? 'ärende finns' : null,
    state: offer.booked_case_id
      ? 'done'
      : isSigned && offer.customer_id ? 'current' : 'pending',
  })

  return nodes
}

const NODE_STYLE: Record<TimelineNode['state'], { dot: string; line: string; label: string }> = {
  done:    { dot: 'bg-[#20c58f] border-[#20c58f]', line: 'bg-[#20c58f]/50', label: 'text-slate-300' },
  current: { dot: 'bg-transparent border-amber-400', line: 'bg-slate-700', label: 'text-amber-300' },
  failed:  { dot: 'bg-red-500 border-red-500', line: 'bg-slate-700', label: 'text-red-400' },
  pending: { dot: 'bg-transparent border-slate-600', line: 'bg-slate-700', label: 'text-slate-500' },
}

export default function LifecycleTimeline({ offer }: { offer: FollowUpOffer }) {
  const nodes = buildNodes(offer)
  return (
    <div className="flex items-start">
      {nodes.map((node, i) => {
        const style = NODE_STYLE[node.state]
        return (
          <div key={node.label} className="flex-1 min-w-0 flex flex-col items-center relative">
            {/* Linje till nästa nod */}
            {i < nodes.length - 1 && (
              <div className={`absolute top-[5px] left-1/2 w-full h-px ${NODE_STYLE[nodes[i + 1].state === 'done' ? 'done' : 'pending'].line}`} />
            )}
            <span className={`relative z-10 w-[11px] h-[11px] rounded-full border-2 ${style.dot}`} />
            <span className={`mt-1 text-[10px] font-medium ${style.label}`}>{node.label}</span>
            {node.detail && (
              <span className="text-[9px] text-slate-500 truncate max-w-full px-0.5">{node.detail}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
