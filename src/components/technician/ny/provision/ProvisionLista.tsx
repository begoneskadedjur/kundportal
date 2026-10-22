// src/components/technician/ny/provision/ProvisionLista.tsx
// Provisionsposterna för vald månad på provisionssidan i nya arbetsvyn.
// En rad per post: datum, kund, BE-nummer, typ med ikon, belopp och status som
// punkt och text. Raden öppnar ärendet när det finns ett ärende att öppna.

import { Icon } from '../../../icons/Icon'
import { StatusPunkt } from '../besokUi'
import type { CommissionPost } from '../../../../types/provision'
import {
  arendeFor, arendeNummer, dagFor, kr, postTyp, procent, statusInfo,
  type ArendeUppslag,
} from './provisionData'
import type { ArendeRef } from '../OppnaArende'

interface Props {
  poster: CommissionPost[]
  uppslag: Map<string, ArendeUppslag>
  cutoff: number
  nu: Date
  onOppna: (a: ArendeRef) => void
}

function andelText(andel: number): string | null {
  if (andel >= 100) return null
  if (Math.abs(andel - 50) < 0.01) return 'halva provisionen'
  return `${procent(andel)} av provisionen`
}

function Underlag({ post }: { post: CommissionPost }) {
  const delar: string[] = [
    `${procent(Number(post.commission_percentage))} av ${kr(Number(post.base_amount))}`,
  ]
  if (Number(post.deductions) > 0) delar.push(`avdrag ${kr(Number(post.deductions))}`)
  const andel = andelText(Number(post.share_percentage))
  if (andel) delar.push(andel)
  if (post.is_rot_rut) delar.push('före ROT/RUT-avdrag')
  if (post.visit_number != null) delar.push(`besök ${post.visit_number}`)
  return <span>{delar.join(', ')}</span>
}

function Rad({ post, uppslag, cutoff, nu, onOppna }: Omit<Props, 'poster' | 'uppslag'> & { post: CommissionPost; uppslag?: ArendeUppslag }) {
  const status = statusInfo(post, cutoff, nu)
  const typ = postTyp(post)
  const nummer = arendeNummer(post, uppslag)
  const kund = uppslag?.kund || (post.case_title && post.case_title !== nummer ? post.case_title : null)
  const arende = arendeFor(post)
  const utbetald = post.status === 'paid_out'

  const innehall = (
    <>
      <Icon name={typ.ikon} size={20} className="mt-0.5 text-slate-400 flex-shrink-0" title={typ.text} />
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline justify-between gap-3">
          <span className={`text-[15px] font-medium truncate ${utbetald ? 'text-slate-300' : 'text-white'}`}>
            {kund || typ.text}
          </span>
          <span className={`text-[15px] font-semibold tabular-nums flex-shrink-0 ${utbetald ? 'text-slate-300' : 'text-white'}`}>
            {kr(Number(post.commission_amount))}
          </span>
        </span>
        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[13px] text-slate-400">
          <span className="font-mono tabular-nums">{dagFor(post.created_at)}</span>
          {nummer && <span className="font-mono">{nummer}</span>}
          <span className="sr-only">{typ.text}</span>
        </span>
        <span className="mt-0.5 block text-[13px] text-slate-500">
          <Underlag post={post} />
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <StatusPunkt ton={status.ton}>{status.rubrik}</StatusPunkt>
          <span className={`text-[13px] ${status.gammal ? 'text-amber-500' : 'text-slate-400'}`}>
            {status.detalj}
          </span>
        </span>
      </span>
      {arende && <Icon name="allman.chevron" size={16} className="self-center text-slate-500 flex-shrink-0" />}
    </>
  )

  const klass = 'w-full flex items-start gap-3 px-3 py-3 min-h-[64px] text-left'
  if (!arende) return <div className={klass}>{innehall}</div>
  return (
    <button
      type="button"
      onClick={() => onOppna(arende)}
      aria-label={`Öppna ärendet ${nummer || kund || ''}`.trim()}
      className={`${klass} hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f]`}
    >
      {innehall}
    </button>
  )
}

export function ProvisionLista({ poster, uppslag, cutoff, nu, onOppna }: Props) {
  // Nyast först, samma ordning som hämtningen
  const sorterade = [...poster].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return (
    <ul className="rounded-2xl bg-slate-900 border border-slate-700/60 divide-y divide-slate-700/60 overflow-hidden">
      {sorterade.map(p => (
        <li key={p.id}>
          <Rad post={p} uppslag={uppslag.get(p.case_id)} cutoff={cutoff} nu={nu} onOppna={onOppna} />
        </li>
      ))}
    </ul>
  )
}

export default ProvisionLista
