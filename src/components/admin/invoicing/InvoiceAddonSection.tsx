// src/components/admin/invoicing/InvoiceAddonSection.tsx
// Tilläggsfakturan i fakturamodalen: samma pedagogik som ärendets
// Ekonomi-flik. "Tillägg utöver avtalet" (tidslinje per stationstyp och för
// arbetstiden), "Kostnader" (utrustning en gång, intern arbetstid, betalt
// tillbaka) och sidokortet med period och nästa tilläggsfaktura.
// Datat kommer från useInvoiceAddons, matten från src/shared/addonEconomics.
// Ingen marginal i procent för pro rata. Punkt och text, aldrig piller.

import { useState } from 'react'
import { ChevronDown, FileText, Layers, Wallet } from 'lucide-react'
import CaseModalSection from '../../shared/CaseModalSection'
import AddonBillingTimeline from '../../shared/AddonBillingTimeline'
import { formatHours, formatKr } from '../../../shared/addonEconomics'
import { addonInvoiceExplanation, addonTypeName, type InvoiceAddonLine } from '../../../shared/invoiceAddonLines'
import type { InvoiceAddons } from '../../../hooks/useInvoiceAddons'

/** "1 769,04" (öre när det finns) */
const kr2 = (n: number) =>
  n.toLocaleString('sv-SE', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })
const krInt = (n: number) => Math.round(n).toLocaleString('sv-SE')

/** "2 348 × 275 / 365 = 1 769,04 kr per station" */
function formula(line: InvoiceAddonLine): string {
  const t = line.timeline
  const unit = t.unit === 'timme' ? 'per timme' : 'per station'
  return `${krInt(t.perUnitAnnual)} × ${t.days} / 365 = ${kr2(t.perUnitNow)} kr ${unit}`
}

export function InvoiceAddonBlock({ addons, priceOk }: { addons: InvoiceAddons; priceOk: boolean }) {
  const stations = addons.lines.filter((l) => l.kind === 'station')
  const labour = addons.lines.find((l) => l.kind === 'labour') ?? null
  // Hopfällt som standard: en rad räcker för den som fakturerar, uträkningen
  // fälls ut vid behov
  const [open, setOpen] = useState(false)
  const summary = [
    ...stations.map((l) => `${addonTypeName(l.row.service_name || l.row.article_name)} ${formatHours(l.timeline.quantityNow)} st`),
    ...(labour ? [`arbetstid ${formatHours(Number(labour.row.addon_labour_hours ?? 0))} h per år`] : []),
  ].join(', ')
  const firstTimeline = (stations[0] ?? labour)?.timeline ?? null
  return (
    <CaseModalSection
      icon={Layers}
      iconClassName="text-[#20c58f]"
      title="Tillägg utöver avtalet"
      actions={priceOk ? (
        <span className="text-xs text-[#20c58f] whitespace-nowrap">
          <span className="mr-1">●</span>Stämmer mot avtalspriset
        </span>
      ) : undefined}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 text-left text-sm text-slate-300 hover:text-white transition-colors"
      >
        <span className="min-w-0">
          {summary}
          {firstTimeline && (
            <span className="text-slate-400"> · {firstTimeline.days} av 365 dagar, fram till {addons.period?.nextStart ? `nästa årspremie ${addons.period.nextStart}` : 'nästa årspremie'}</span>
          )}
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
          {open ? 'Dölj uträkning' : 'Visa uträkning'}
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
      <div className="space-y-3 mt-3 pt-3 border-t border-slate-700/50">
        {stations.map((line) => {
          const t = line.timeline
          const perMonth = t.model === 'per_month'
          return (
            <div key={line.invoiceItemId} className="pb-3 border-b border-slate-700/50 last:border-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                <span className="text-sm font-medium text-white">
                  {addonTypeName(line.row.service_name || line.row.article_name)} · {formatHours(t.quantityNow)} st
                </span>
                <span className="text-xs text-slate-400">
                  Avtalspris {formatKr(perMonth ? t.perUnitAnnual / 12 : t.perUnitAnnual)}{' '}
                  {perMonth ? 'per station och månad' : 'per station och år'}
                </span>
              </div>
              <AddonBillingTimeline timeline={t} nowTitle="Den här fakturan" showDays nowDetail={formula(line)} />
            </div>
          )
        })}

        {labour && (() => {
          const t = labour.timeline
          const hours = Number(labour.row.addon_labour_hours ?? 0)
          return (
            <div className="pb-3 border-b border-slate-700/50 last:border-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                <span className="text-sm font-medium text-white">
                  Arbetstid för att hantera tilläggen · {formatHours(hours)} h per år
                  {t.quantityNow !== hours && (
                    <span className="text-xs text-slate-400 font-normal"> ({formatHours(t.quantityNow)} h nya)</span>
                  )}
                </span>
                <span className="text-xs text-slate-400">Avtalat timpris {formatKr(t.perUnitAnnual)}</span>
              </div>
              <AddonBillingTimeline
                timeline={t}
                nowTitle="Den här fakturan"
                showDates={false}
                showDays
                nowDetail={formula(labour)}
              />
            </div>
          )
        })()}

        <div className="p-2.5 bg-slate-900/50 border border-slate-700/50 rounded-lg">
          <p className="text-xs text-slate-300 leading-relaxed">{addonInvoiceExplanation(addons.period?.nextStart ?? null)}</p>
        </div>
      </div>
      )}
    </CaseModalSection>
  )
}

export function InvoiceAddonCosts({ addons }: { addons: InvoiceAddons }) {
  const calc = addons.calc
  const payback = !calc
    ? null
    : calc.paybackNever
      ? { cls: 'text-red-400', text: 'Tillägget betalas inte tillbaka med dagens arbetstid' }
      : calc.paybackLabel === 'direkt'
        ? { cls: 'text-[#20c58f]', text: 'Ingen utrustning att betala tillbaka' }
        : { cls: 'text-[#20c58f]', text: `Tillägget betalt tillbaka cirka ${calc.paybackLabel}` }
  return (
    <CaseModalSection
      icon={Wallet}
      iconClassName="text-slate-400"
      title="Kostnader"
      actions={payback ? (
        <span className={`text-xs whitespace-nowrap ${payback.cls}`}>
          <span className="mr-1">●</span>{payback.text}
        </span>
      ) : undefined}
    >
      <div className="space-y-1.5 text-sm">
        {addons.equipment.length > 0 ? (
          addons.equipment.map((a) => (
            <div key={a.name} className="flex items-baseline justify-between gap-3 text-slate-300">
              <span className="min-w-0 truncate">Utrustning, en gång · {formatHours(a.quantity)} {a.name}</span>
              <span className="tabular-nums whitespace-nowrap">{formatKr(a.cost)}</span>
            </div>
          ))
        ) : (
          <div className="flex items-baseline justify-between gap-3 text-slate-300">
            <span>Utrustning, en gång</span>
            <span className="tabular-nums whitespace-nowrap">{formatKr(addons.equipmentCost)}</span>
          </div>
        )}
        {addons.labourHours > 0 && addons.hourlyCost != null && (
          <div className="flex items-baseline justify-between gap-3 text-slate-300">
            <span className="min-w-0 truncate">
              Arbetstid internt · {formatHours(addons.labourHours)} h × {formatKr(addons.hourlyCost)} per år
            </span>
            <span className="tabular-nums whitespace-nowrap">{formatKr(addons.labourHours * addons.hourlyCost)} per år</span>
          </div>
        )}
        <p className="text-xs text-slate-400 pt-1">
          Utrustningen betalas tillbaka av tillägget över avtalsåren, inte av den här fakturan. Ingen marginal i procent för pro rata.
        </p>
      </div>
    </CaseModalSection>
  )
}

export function InvoiceAddonSideCard({ addons }: { addons: InvoiceAddons }) {
  const p = addons.period
  return (
    <CaseModalSection icon={FileText} iconClassName="text-[#20c58f]" title="Tillägg utöver avtalet">
      <div className="space-y-1 text-xs">
        {p && (
          <div className="flex justify-between gap-3">
            <span className="text-slate-400">Period</span>
            <span className="text-slate-200 tabular-nums">{p.start} till {p.end}</span>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <span className="text-slate-400">Därefter</span>
          <span className="text-slate-200">Årsvis med avtalet</span>
        </div>
        {p && (
          <div className="flex justify-between gap-3">
            <span className="text-slate-400">Nästa tilläggsfaktura</span>
            <span className="text-slate-200 tabular-nums">{p.nextStart}</span>
          </div>
        )}
        {addons.contractName && (
          <div className="flex justify-between gap-3">
            <span className="text-slate-400 flex-shrink-0">Avtal</span>
            <span className="text-slate-200 truncate" title={addons.contractName}>{addons.contractName}</span>
          </div>
        )}
        {addons.pendingStations > 0 && (
          <p className="text-amber-400 pt-1">
            <span className="mr-1">●</span>
            {addons.pendingStations} {addons.pendingStations === 1 ? 'station väntar' : 'stationer väntar'} på beslut i avtalskartan
          </p>
        )}
      </div>
    </CaseModalSection>
  )
}
