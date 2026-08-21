// src/components/admin/customers/record/WorkChainSection.tsx
//
// Arbetsflödet som genererar fakturor: tjänsten kunden fått, artiklarna vi
// använt, vad de kostat oss, marginalen — och vilken tekniker som utfört det.
//
// Två nivåer:
//   1. Sammanställning över hela kunden — intäkt, kostnad, marginal, och
//      teknikernas respektive bidrag
//   2. Per ärende — vad som gjordes, av vem, med artiklarna under sin tjänst
//
// Manuellt upplagda och importerade avtal saknar raderna och har bara en
// årspremie. De markeras som "saknar artikeldetaljer" i stället för att döljas.
//
// Datamodell: item_type='service' är intäkt, 'article' är intern kostnad
// kopplad till sin tjänst via mapped_service_id (som pekar på TJÄNSTERADENS
// id, inte på services.id).

import { useId, useMemo, useState } from 'react'
import { ChevronDown, Layers } from 'lucide-react'
import { formatKr, type RecordWorkItem } from '../../../../hooks/useCustomerRecord'

interface Props {
  workItems: RecordWorkItem[]
  minMarginPercent?: number
  targetMarginPercent?: number
}

function marginTone(margin: number | null, min: number, target: number): string {
  if (margin === null) return '#94a3b8'
  if (margin >= target) return '#20c58f'
  if (margin >= min) return '#fbbf24'
  return '#f87171'
}

const pctSv = (v: number) => `${v.toFixed(1).replace('.', ',')} %`

/**
 * Marginalmätare: ringen är intäkten, det fyllda är täckningsbidraget.
 * Samma hantverk som ContractStamp — egen path, brusfilter, ingen ikon.
 */
function MarginDial({
  margin,
  tone,
  size = 52,
}: {
  margin: number | null
  tone: string
  size?: number
}) {
  const uid = useId().replace(/:/g, '')
  const R = 20
  const C = 2 * Math.PI * R
  const filled = margin === null ? 0 : Math.max(0, Math.min(100, margin)) / 100

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 52 52"
      fill="none"
      role="img"
      aria-label={margin === null ? 'Ingen marginal' : `Marginal ${pctSv(margin)}`}
      className="shrink-0"
    >
      <defs>
        <filter id={`${uid}-r`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="17" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="0.9" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${uid}-r)`}>
        {/* Hela intäkten */}
        <circle cx="26" cy="26" r={R} fill="none" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
        {/* Täckningsbidraget */}
        {filled > 0 && (
          <circle
            cx="26"
            cy="26"
            r={R}
            fill="none"
            stroke={tone}
            strokeWidth="4"
            strokeDasharray={`${filled * C} ${C - filled * C}`}
            strokeLinecap="round"
            transform="rotate(-90 26 26)"
          />
        )}
      </g>
      <text
        x="26"
        y="30"
        textAnchor="middle"
        fill={tone}
        fontSize="13"
        fontWeight="700"
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        {margin === null ? '–' : Math.round(margin)}
      </text>
    </svg>
  )
}

interface ServiceGroup {
  id: string
  name: string
  revenue: number
  cost: number
  articles: RecordWorkItem[]
  margin: number | null
}

interface CaseGroup {
  caseId: string
  label: string
  technician: string | null
  services: ServiceGroup[]
  revenue: number
  cost: number
  margin: number | null
  date: string
}

export default function WorkChainSection({
  workItems,
  minMarginPercent = 20,
  targetMarginPercent = 35,
}: Props) {
  const [openCase, setOpenCase] = useState<string | null>(null)

  const model = useMemo(() => {
    // Artiklarna hänger på tjänsteradens id
    const articlesByService = new Map<string, RecordWorkItem[]>()
    const unmapped: RecordWorkItem[] = []
    for (const a of workItems.filter((i) => i.item_type === 'article')) {
      if (a.mapped_service_id) {
        const list = articlesByService.get(a.mapped_service_id) ?? []
        list.push(a)
        articlesByService.set(a.mapped_service_id, list)
      } else {
        unmapped.push(a)
      }
    }

    // Gruppera per ärende
    const byCase = new Map<string, RecordWorkItem[]>()
    for (const s of workItems.filter((i) => i.item_type === 'service')) {
      const list = byCase.get(s.case_id) ?? []
      list.push(s)
      byCase.set(s.case_id, list)
    }

    const cases: CaseGroup[] = []
    for (const [caseId, services] of byCase) {
      const groups: ServiceGroup[] = services.map((s) => {
        const own = articlesByService.get(s.id) ?? []
        const revenue = Number(s.total_price ?? 0)
        const cost = own.reduce((sum, a) => sum + Number(a.total_price ?? 0), 0)
        return {
          id: s.id,
          name: s.service_name || s.article_name || 'Tjänst',
          revenue,
          cost,
          articles: own,
          margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
        }
      })
      const revenue = groups.reduce((s, g) => s + g.revenue, 0)
      const cost = groups.reduce((s, g) => s + g.cost, 0)
      const first = services[0]
      cases.push({
        caseId,
        label:
          first.case_number ??
          (first.case_type === 'contract' ? 'Avtalets innehåll' : first.case_title ?? 'Ärende'),
        technician: first.technician_name ?? null,
        services: groups,
        revenue,
        cost,
        margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
        date: first.created_at,
      })
    }
    cases.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

    // Teknikernas bidrag
    const techMap = new Map<string, { revenue: number; cost: number; cases: Set<string> }>()
    for (const c of cases) {
      const key = c.technician ?? '— ej registrerad'
      const t = techMap.get(key) ?? { revenue: 0, cost: 0, cases: new Set<string>() }
      t.revenue += c.revenue
      t.cost += c.cost
      t.cases.add(c.caseId)
      techMap.set(key, t)
    }
    const technicians = Array.from(techMap.entries())
      .map(([name, t]) => ({
        name,
        revenue: t.revenue,
        cost: t.cost,
        cases: t.cases.size,
        margin: t.revenue > 0 ? ((t.revenue - t.cost) / t.revenue) * 100 : null,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    const revenue = cases.reduce((s, c) => s + c.revenue, 0)
    const cost =
      cases.reduce((s, c) => s + c.cost, 0) +
      unmapped.reduce((s, a) => s + Number(a.total_price ?? 0), 0)

    return {
      cases,
      technicians,
      unmapped,
      revenue,
      cost,
      margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
    }
  }, [workItems])

  if (model.cases.length === 0 && model.unmapped.length === 0) {
    return (
      <section className="p-3 bg-slate-800/20 border border-slate-700/60 rounded-xl">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-600 shrink-0" />
          <span className="text-xs text-slate-500">Saknar artikeldetaljer</span>
        </div>
        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
          Avtalet är upplagt manuellt eller importerat och har bara en årspremie. Tjänster,
          artiklar och marginal registreras när arbetet går genom ärendeflödet.
        </p>
      </section>
    )
  }

  const tone = marginTone(model.margin, minMarginPercent, targetMarginPercent)

  return (
    <div className="space-y-3">
      {/* SAMMANSTÄLLNING över hela kunden */}
      <section className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
        <div className="flex items-baseline gap-2 mb-3">
          <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-purple-400" />
            Tjänster, artiklar och marginal
          </h3>
          <span className="ml-auto text-[10px] text-slate-500">Belopp ex moms</span>
        </div>

        <div className="flex items-center gap-4">
          <MarginDial margin={model.margin} tone={tone} />
          <div className="grid grid-cols-3 gap-2 flex-1 min-w-0">
            <div className="px-2.5 py-2 rounded-lg bg-[#20c58f]/10 border border-[#20c58f]/25">
              <p className="text-[10px] uppercase tracking-wider text-[#20c58f]/80 mb-0.5">
                Kunden betalar
              </p>
              <p className="font-mono text-base font-semibold text-[#20c58f] tabular-nums">
                {formatKr(model.revenue)}
              </p>
            </div>
            <div className="px-2.5 py-2 rounded-lg bg-slate-800/60 border border-slate-700">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
                Vår kostnad
              </p>
              <p className="font-mono text-base font-semibold text-slate-300 tabular-nums">
                {model.cost > 0 ? formatKr(model.cost) : '–'}
              </p>
            </div>
            <div className="px-2.5 py-2 rounded-lg bg-slate-800/60 border border-slate-700">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
                Täckningsbidrag
              </p>
              <p className="font-mono text-base font-semibold tabular-nums" style={{ color: tone }}>
                {formatKr(model.revenue - model.cost)}
              </p>
            </div>
          </div>
        </div>

        {/* Teknikernas bidrag */}
        {model.technicians.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700/60">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
              Utfört av
            </p>
            <ul className="space-y-1.5">
              {model.technicians.map((t) => (
                <li key={t.name}>
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-slate-700 grid place-items-center text-[9px] font-semibold text-slate-300 shrink-0">
                      {t.name.startsWith('—')
                        ? '?'
                        : t.name
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((p) => p[0]?.toUpperCase() ?? '')
                            .join('')}
                    </span>
                    <span className="text-slate-300 truncate">{t.name}</span>
                    <span className="text-xs text-slate-600 shrink-0">
                      {t.cases} ärende{t.cases === 1 ? '' : 'n'}
                    </span>
                    <span className="ml-auto flex items-baseline gap-3 tabular-nums shrink-0">
                      <span className="text-xs text-slate-500">−{formatKr(t.cost)}</span>
                      <span className="text-slate-100 w-24 text-right">{formatKr(t.revenue)}</span>
                      <span
                        className="text-xs w-14 text-right"
                        style={{ color: marginTone(t.margin, minMarginPercent, targetMarginPercent) }}
                      >
                        {t.margin === null ? '–' : pctSv(t.margin)}
                      </span>
                    </span>
                  </div>
                  <div className="h-1 mt-1 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-[#20c58f]/50"
                      style={{
                        width: `${model.revenue > 0 ? (t.revenue / model.revenue) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* PER ÄRENDE */}
      <section className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">
          Per ärende ({model.cases.length})
        </p>
        <ul className="divide-y divide-slate-800/60">
          {model.cases.map((c) => {
            const open = openCase === c.caseId
            const caseTone = marginTone(c.margin, minMarginPercent, targetMarginPercent)
            return (
              <li key={c.caseId}>
                <button
                  onClick={() => setOpenCase(open ? null : c.caseId)}
                  className="w-full flex items-center gap-3 px-2 py-2 -mx-2 rounded-lg text-left hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] transition-colors"
                >
                  <MarginDial margin={c.margin} tone={caseTone} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-200 truncate font-mono">{c.label}</span>
                    <span className="block text-xs text-slate-500 truncate">
                      {c.services.length} tjänst{c.services.length === 1 ? '' : 'er'}
                      {c.technician && ` · ${c.technician}`}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums shrink-0 hidden sm:block">
                    −{formatKr(c.cost)}
                  </span>
                  <span className="text-sm text-slate-100 tabular-nums shrink-0 w-24 text-right">
                    {formatKr(c.revenue)}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-600 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>

                {open && (
                  <div className="pl-2 pb-2 space-y-1">
                    {c.services.map((g) => (
                      <div key={g.id} className="py-1.5 border-b border-dashed border-slate-700/60 last:border-0">
                        <div className="flex items-center gap-2.5 text-sm">
                          <span className="text-slate-100 truncate">{g.name}</span>
                          <span className="flex-1 border-b border-dotted border-slate-700 translate-y-1 min-w-4" />
                          <span className="font-mono text-sm text-slate-100 tabular-nums shrink-0">
                            {formatKr(g.revenue)}
                          </span>
                        </div>
                        {g.articles.length > 0 && (
                          <div className="pl-4 pt-1 space-y-0.5 border-l border-slate-700/70 ml-1 mt-1">
                            {g.articles.map((a) => (
                              <div key={a.id} className="flex items-center gap-2 text-[11px] text-slate-500">
                                <span className="truncate">
                                  {a.article_name}
                                  {Number(a.quantity ?? 1) !== 1 && ` × ${Number(a.quantity)}`}
                                </span>
                                <span className="flex-1" />
                                <span className="font-mono tabular-nums shrink-0">
                                  −{formatKr(Number(a.total_price ?? 0))}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
