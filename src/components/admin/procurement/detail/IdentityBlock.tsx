// src/components/admin/procurement/detail/IdentityBlock.tsx
// Block 1: vem som köper vad. Allt här är importfält och visas skrivskyddat.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { NoticeWithRelations } from '../../../../services/procurementService'
import { NOTICE_KIND_LABEL } from '../../../../types/procurement'
import { SE_COUNTIES, formatOrgNumber } from '../../../../shared/procurementRules'
import { StatusDot, LinkButton } from '../ui'
import { Block, KV } from './fields'
import { procurementPath } from '../../../../lib/procurementPortal'

const RULE_LABEL: Record<string, string> = {
  cpv_hard: 'CPV-träff',
  cpv_soft: 'Närliggande CPV',
  keyword: 'Nyckelord',
  negative: 'Negativt ord',
  county: 'Län',
}

export default function IdentityBlock({ notice }: { notice: NoticeWithRelations }) {
  const [showDesc, setShowDesc] = useState(false)
  const buyerName = notice.buyer?.name ?? notice.buyer_name ?? 'Okänd köpare'
  const org = notice.buyer?.org_number ?? notice.buyer_org_number
  const counties = notice.county_names.length > 0 ? notice.county_names : notice.county_codes.map((c) => SE_COUNTIES[c] ?? c)
  const cancelled = (notice.source_status ?? '').toLowerCase().includes('cancel')
  const reasons = notice.match_reasons ?? []

  return (
    <Block id="identitet" num="1" title="Identitet">
      <div className="p-4 space-y-4">
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
          <KV label="Köpare">
            {notice.buyer_id ? (
              <Link to={procurementPath(`/kopare/${notice.buyer_id}`)} className="text-slate-100 hover:text-[#20c58f]">
                {buyerName}
              </Link>
            ) : (
              buyerName
            )}
          </KV>
          <KV label="Orgnr">{org ? formatOrgNumber(org) : '–'}</KV>
          <KV label="BGU-nummer">BGU-{notice.bgu_number}</KV>
          <KV label="CPV">{notice.cpv_codes.length > 0 ? notice.cpv_codes.join(', ') : '–'}</KV>
          <KV label="Län">{counties.length > 0 ? counties.join(', ') : '–'}</KV>
          <KV label="Posttyp">{NOTICE_KIND_LABEL[notice.notice_kind] ?? notice.notice_kind}</KV>
          <KV label="Förfarande">{notice.procedure_type ?? '–'}</KV>
          <KV label="Form">{notice.is_framework == null ? '–' : notice.is_framework ? 'Ramavtal' : 'Kontrakt'}</KV>
          <KV label="Källstatus">
            {notice.source_status ? <StatusDot tone={cancelled ? 'bad' : 'neutral'}>{cancelled ? `Avbruten (${notice.source_status})` : notice.source_status}</StatusDot> : '–'}
          </KV>
        </dl>

        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 mb-1">Matchpoäng</div>
          <div className="flex items-baseline gap-3">
            <span className={`text-[19px] font-semibold tabular-nums ${notice.match_score >= 100 ? 'text-[#20c58f]' : notice.match_score >= 60 ? 'text-slate-100' : 'text-slate-500'}`}>
              {notice.match_score}
            </span>
            <span className="text-[11px] text-slate-500">
              {notice.match_score >= 100 ? 'Direktträff' : notice.match_score >= 60 ? 'Träff' : 'Under tröskeln'}
            </span>
          </div>
          {reasons.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5">
              {reasons.map((r, i) => (
                <li key={i} className="flex items-baseline gap-2 text-[12px] text-slate-400">
                  <span className={`tabular-nums w-10 text-right ${r.points < 0 ? 'text-red-400' : 'text-slate-300'}`}>
                    {r.points > 0 ? '+' : ''}
                    {r.points}
                  </span>
                  <span>
                    {RULE_LABEL[r.rule] ?? r.rule}: {r.label}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-slate-600 mt-1">Ingen förklaring sparad.</p>
          )}
        </div>

        {notice.description && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500 mb-1">Beskrivning</div>
            <p className={`text-[12.5px] text-slate-300 whitespace-pre-line ${showDesc ? '' : 'line-clamp-4'}`}>{notice.description}</p>
            {notice.description.length > 300 && (
              <LinkButton tone="muted" onClick={() => setShowDesc((s) => !s)}>
                {showDesc ? 'Visa mindre' : 'Visa hela'}
              </LinkButton>
            )}
          </div>
        )}
      </div>
    </Block>
  )
}
