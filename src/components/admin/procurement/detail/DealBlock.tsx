// src/components/admin/procurement/detail/DealBlock.tsx
// Block 4: affären. Värde och avtalstid är importfält; volymer och prismodell
// redigeras här (volymerna styr anbudskalkylen). AI-sammanfattning och
// "Det här avgör affären" kommer från underlagsextraktionen.

import type { ReactNode } from 'react'
import toast from 'react-hot-toast'
import type { NoticeWithRelations } from '../../../../services/procurementService'
import type { ProcurementVolumes } from '../../../../types/procurement'
import { annualValueOf } from '../../../../shared/procurementRules'
import { fmtKr, fmtNum } from '../uiFormat'
import { BlurText, Block, KV, NumberField, SubHeading, type SaveNotice } from './fields'
import { errMsg } from './helpers'

const VOLUME_FIELDS: Array<{ key: keyof ProcurementVolumes; label: string; suffix?: string }> = [
  { key: 'objects', label: 'Objekt' },
  { key: 'apartments', label: 'Lägenheter' },
  { key: 'visits_per_year', label: 'Besök per år' },
  { key: 'stations', label: 'Stationer' },
  { key: 'callouts_per_year', label: 'Utryckningar per år' },
]

const REQ_LABEL: Record<string, string> = {
  penalties: 'Viten',
  references: 'Referenser',
  response_time: 'Inställelsetid',
  certifications: 'Certifieringar',
  contract: 'Avtalstid och optioner',
}

/** Visar ett okänt värde ur requirements_summary som läsbar text */
function renderValue(v: unknown): ReactNode {
  if (v == null || v === '') return null
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nej'
  if (Array.isArray(v)) {
    const items = v.map((x) => renderValue(x)).filter((x) => x != null && x !== '')
    if (items.length === 0) return null
    return (
      <ul className="list-disc ml-4 space-y-0.5">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    )
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    const page = o.page ? ` (s. ${String(o.page)})` : ''
    if (typeof o.text === 'string' && o.text) {
      const count = typeof o.count === 'number' ? `${o.count} st. ` : ''
      return `${count}${o.text}${page}`
    }
    if ('duration_months' in o || 'options' in o || 'start' in o) {
      const parts = [
        o.duration_months ? `${String(o.duration_months)} månader` : null,
        o.options ? `optioner: ${String(o.options)}` : null,
        o.start ? `start ${String(o.start)}` : null,
      ].filter(Boolean)
      return parts.length > 0 ? `${parts.join(', ')}${page}` : null
    }
    if (typeof o.count === 'number') return `${o.count} st.${page}`
    const entries = Object.entries(o).filter(([k, x]) => k !== 'page' && x != null && x !== '')
    return entries.length > 0 ? entries.map(([k, x]) => `${k}: ${typeof x === 'object' ? JSON.stringify(x) : String(x)}`).join(', ') : null
  }
  return null
}

export default function DealBlock({ notice, onSave }: { notice: NoticeWithRelations; onSave: SaveNotice }) {
  const volumes = notice.volumes ?? {}
  const annual = notice.annual_value ?? annualValueOf(notice.estimated_value, notice.duration_months)

  const saveVolume = async (key: keyof ProcurementVolumes, value: number | string | null) => {
    const next: ProcurementVolumes = { ...volumes, [key]: value }
    const label = VOLUME_FIELDS.find((f) => f.key === key)?.label ?? 'Anteckning'
    try {
      await onSave({ volumes: next }, `Volym ändrad: ${label} ${value == null ? 'borttagen' : typeof value === 'number' ? fmtNum(value, 1) : ''}`.trim())
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara volymen'))
    }
  }

  const savePriceModel = async (v: string | null) => {
    try {
      await onSave({ price_model: v }, 'Prismodell ändrad')
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara prismodellen'))
    }
  }

  const req = notice.requirements_summary ?? null
  const reqEntries = req ? Object.entries(req).map(([k, v]) => [k, renderValue(v)] as const).filter(([, v]) => v != null) : []

  return (
    <Block id="affaren" num="4" title="Affären">
      <div className="p-4 space-y-5">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
          <KV label="Uppskattat värde">
            {fmtKr(notice.estimated_value)}
            {notice.value_currency && notice.value_currency !== 'SEK' ? ` (${notice.value_currency})` : ''}
          </KV>
          <KV label="Årsvärde">
            <span className={notice.annual_value == null && annual != null ? 'text-slate-400' : ''}>{fmtKr(annual)}</span>
            {notice.annual_value == null && annual != null && <span className="block text-[10.5px] text-slate-600">beräknat ur värde och avtalstid</span>}
          </KV>
          <KV label="Avtalstid">{notice.duration_months ? `${fmtNum(notice.duration_months)} månader` : '–'}</KV>
          <KV label="Förlängningar">{notice.renewal_max != null ? `högst ${notice.renewal_max}` : '–'}</KV>
        </dl>

        <div>
          <SubHeading>Volymer</SubHeading>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {VOLUME_FIELDS.map((f) => (
              <NumberField
                key={f.key}
                label={f.label}
                value={(volumes[f.key] as number | null | undefined) ?? null}
                commitOnBlur
                onChange={(n) => void saveVolume(f.key, n)}
              />
            ))}
          </div>
          <div className="mt-2">
            <BlurText value={volumes.notes ?? null} onCommit={(v) => void saveVolume('notes', v)} placeholder="Anteckning om volymerna, t.ex. sidhänvisning" ariaLabel="Anteckning om volymer" />
          </div>
        </div>

        <div>
          <SubHeading>Prismodell</SubHeading>
          <BlurText value={notice.price_model} onCommit={(v) => void savePriceModel(v)} multiline placeholder="À-pris per besök, fast årspris, fiktiv kalkyl ..." ariaLabel="Prismodell" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <SubHeading>AI-sammanfattning</SubHeading>
            {notice.ai_summary ? (
              <p className="text-[12.5px] text-slate-300 whitespace-pre-line">{notice.ai_summary}</p>
            ) : (
              <p className="text-[12px] text-slate-600">Ladda upp förfrågningsunderlaget så sammanfattar AI det.</p>
            )}
          </div>
          <div>
            <SubHeading>Det här avgör affären</SubHeading>
            {notice.ai_deciders && notice.ai_deciders.length > 0 ? (
              <ul className="space-y-1">
                {notice.ai_deciders.map((d, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] text-slate-300">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#20c58f] shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-slate-600">Inga avgörande punkter utlästa ännu.</p>
            )}
          </div>
        </div>

        <div>
          <SubHeading>Krav i underlaget</SubHeading>
          {reqEntries.length === 0 ? (
            <p className="text-[12px] text-slate-600">Viten, referenser, inställelsetid och certifieringar fylls i när underlaget lästs.</p>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              {reqEntries.map(([k, v]) => (
                <KV key={k} label={REQ_LABEL[k] ?? k}>
                  {v}
                </KV>
              ))}
            </dl>
          )}
          <p className="text-[11px] text-slate-600 mt-2">AI-utläst. Kontrollera alltid mot underlaget.</p>
        </div>
      </div>
    </Block>
  )
}
