// src/components/admin/invoicing/ContractReviewMark.tsx
// Kontrollerat avtal (2026-10-28): märkningen under kundnamnet i fakturalistan
// och rutan överst i fakturan. Tre lägen, platt text med ikon, inga piller.
// Logiken bor i src/shared/contractReview.ts och contractReviewService.ts.

import { Icon } from '../../icons/Icon'
import TooltipWrapper from '../../ui/TooltipWrapper'
import { reviewDateKey, reviewShortDate } from '../../../shared/contractReview'
import {
  ContractReviewService,
  type ContractReviewInfo,
  type InvoiceReviewInfo,
} from '../../../services/contractReviewService'

const unique = (list: string[]) => [...new Set(list)]

/** Senaste kontrollen bland avtalen (för "Kontrollerat 28 okt"). */
function latestReview(contracts: ContractReviewInfo[]): ContractReviewInfo | null {
  const reviewed = contracts.filter((c) => c.reviewedAt)
  if (reviewed.length === 0) return null
  return reviewed.reduce((a, b) => ((a.reviewedAt ?? '') >= (b.reviewedAt ?? '') ? a : b))
}

/** "2026-10-28 · Christian K" per kontroll, utan dubbletter. */
function whoLines(contracts: ContractReviewInfo[]): string[] {
  return unique(
    contracts
      .filter((c) => c.reviewedAt)
      .map((c) => [reviewDateKey(c.reviewedAt), c.reviewedByName].filter(Boolean).join(' · '))
  )
}

/** Ändringarna för gult läge, och avtal som saknar kontroll på en samlad faktura. */
function changeLines(review: InvoiceReviewInfo): string[] {
  const lines = unique(review.contracts.flatMap((c) => c.changes))
  const notReviewed = review.contracts.filter((c) => c.state === 'ej').length
  if (notReviewed > 0) {
    lines.push(`${notReviewed} av fakturans ${review.contracts.length} avtal är inte kontrollerade`)
  }
  return lines
}

const PANEL_CLASS =
  'w-[300px] bg-slate-900 text-slate-200 text-[12.5px] rounded-xl px-3.5 py-3 shadow-xl border border-slate-700 text-left'

export function ContractReviewMark({ review }: { review: InvoiceReviewInfo | null | undefined }) {
  const state = review?.state ?? 'ej'

  if (!review || state === 'ej') {
    return (
      <span className="inline-flex items-center gap-1.5 mt-1 text-xs text-slate-500">
        <Icon name="dok.avtal" size={16} className="w-[15px] h-[15px] flex-shrink-0" />
        Ej kontrollerat
      </span>
    )
  }

  const latest = latestReview(review.contracts)
  const who = whoLines(review.contracts)

  if (state === 'ok') {
    const rows = unique(review.contracts.flatMap((c) => ContractReviewService.checklist(c, 'kort')))
    const many = review.contracts.length > 1
    return (
      <TooltipWrapper
        position="bottom"
        showOnFocus
        panelClassName={PANEL_CLASS}
        content={
          <div>
            <b className="block mb-1.5 text-white">{many ? `Alla ${review.contracts.length} avtal är kontrollerade` : 'Avtalet är kontrollerat'}</b>
            <ul className="grid gap-1">
              {rows.map((r) => (
                <li key={r} className="flex gap-2 items-start text-slate-400">
                  <Icon name="allman.bock" size={16} className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#20c58f]" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            {who.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-800 text-[11.5px] text-slate-500">
                {who.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
            )}
          </div>
        }
      >
        <span
          tabIndex={0}
          className="inline-flex items-center gap-1.5 mt-1 text-xs text-[#20c58f] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 cursor-default"
        >
          <Icon name="kund.avtal-kontrollerat" size={16} className="w-[15px] h-[15px] flex-shrink-0" />
          Kontrollerat{latest?.reviewedAt ? ` ${reviewShortDate(latest.reviewedAt)}` : ''}
        </span>
      </TooltipWrapper>
    )
  }

  // Ändrat efter kontroll
  const lines = changeLines(review)
  return (
    <TooltipWrapper
      position="bottom"
      showOnFocus
      panelClassName={PANEL_CLASS}
      content={
        <div>
          <b className="block mb-1.5 text-white">Ändrat efter kontrollen</b>
          <ul className="grid gap-1">
            {lines.map((r) => (
              <li key={r} className="flex gap-2 items-start text-slate-400">
                <Icon name="kund.avtal-andrat" size={16} className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-400" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          {who.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-800 text-[11.5px] text-slate-500">
              {who.map((w) => (
                <div key={w}>Senast kontrollerat {w}</div>
              ))}
            </div>
          )}
        </div>
      }
    >
      <span
        tabIndex={0}
        className="inline-flex items-center gap-1.5 mt-1 text-xs text-amber-400 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 cursor-default"
      >
        <Icon name="kund.avtal-andrat" size={16} className="w-[15px] h-[15px] flex-shrink-0" />
        Ändrat efter kontroll
      </span>
    </TooltipWrapper>
  )
}

/**
 * Rutan överst i fakturan. Grön när alla avtal är kontrollerade, gul när något
 * ändrats efter kontrollen. Ingenting visas för okontrollerade avtal.
 * Knappen Kontrollera igen ligger i fakturans fot (InvoiceDetailModal).
 */
export function ContractReviewBanner({ review }: { review: InvoiceReviewInfo | null | undefined }) {
  if (!review || review.state === 'ej') return null
  const who = review.contracts
    .filter((c) => c.reviewedAt)
    .map((c) => ({ date: reviewDateKey(c.reviewedAt), name: c.reviewedByName }))
  const whoText = unique(who.map((w) => `${w.date}${w.name ? ` av ${w.name}` : ''}`)).join(', ')

  if (review.state === 'ok') {
    const rows = unique(review.contracts.flatMap((c) => ContractReviewService.checklist(c, 'lang')))
    return (
      <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1 p-3 rounded-lg border border-[#20c58f]/30 bg-[#20c58f]/10">
        <Icon name="kund.avtal-kontrollerat" size={20} className="text-[#20c58f]" />
        <span className="text-sm font-semibold text-[#20c58f]">
          {review.contracts.length > 1 ? 'Avtalen är kontrollerade' : 'Avtalet är kontrollerat'}
        </span>
        <ul className="col-start-2 grid gap-0.5 text-xs text-slate-300">
          {rows.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {whoText && <span className="col-start-2 text-[11.5px] text-slate-500">Kontrollerat {whoText}</span>}
      </div>
    )
  }

  const lines = changeLines(review)
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
      <Icon name="kund.avtal-andrat" size={20} className="text-amber-400" />
      <span className="text-sm font-semibold text-amber-400">Ändrat efter kontrollen</span>
      <ul className="col-start-2 grid gap-0.5 text-xs text-slate-300">
        {lines.map((r) => (
          <li key={r}>{r}</li>
        ))}
        <li>Stäm av mot avtalet och kontrollera igen</li>
      </ul>
      {whoText && <span className="col-start-2 text-[11.5px] text-slate-500">Senast kontrollerat {whoText}</span>}
    </div>
  )
}
