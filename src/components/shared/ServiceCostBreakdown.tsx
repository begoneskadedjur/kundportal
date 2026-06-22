// src/components/shared/ServiceCostBreakdown.tsx
// Delad "Kostnadsuppdelning per tjänst"-vy (Prisguidens marginal).
// Visar hur teknikern kalkylerade priset: interna artikelkostnader grupperade
// under den tjänst de mappats mot (case_billing_items.mapped_service_id), med
// marginal per tjänst och totalt. Artiklarna är INTERNA — de hamnar aldrig på
// fakturan, bara här som kalkylunderlag.
//
// Används av InvoiceDetailModal (privat/företag + ad-hoc) och ContractInvoiceModal.
// Datakällan är alltid case_billing_items — aldrig contract_billing_items, som
// saknar mapped_service_id.

import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { calculateMarginPercent } from '../../types/caseBilling'
import type { CaseBillingItem } from '../../types/caseBilling'

export interface CostBreakdownServiceRow {
  /** Unik nyckel för React + expand-state (t.ex. invoice_item.id eller case_billing_item.id) */
  id: string
  /** case_billing_items.id för tjänsteraden — matchas mot artiklarnas mapped_service_id */
  serviceItemId: string
  /** Tjänstens namn att visa */
  name: string
  /** Intäkt för tjänsten, EXKL. moms (samma bas som artikelkostnaderna) */
  revenue: number
}

interface ServiceCostBreakdownProps {
  /** Tjänsteraderna på fakturan */
  serviceRows: CostBreakdownServiceRow[]
  /** Interna artikelrader (item_type='article') från case_billing_items */
  articleItems: CaseBillingItem[]
  /** Total intäkt EXKL. moms (fakturans subtotal) — bas för totalmarginalen */
  totalRevenue: number
  /** Belopps­formaterare (åter­används från anropande modal) */
  formatAmount: (n: number) => string
}

const marginColor = (m: number) =>
  m >= 50 ? 'text-emerald-400' : m >= 30 ? 'text-amber-400' : 'text-red-400'

export default function ServiceCostBreakdown({
  serviceRows,
  articleItems,
  totalRevenue,
  formatAmount,
}: ServiceCostBreakdownProps) {
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set())

  if (articleItems.length === 0) return null
  if (serviceRows.length === 0) return null

  // Mappa artiklar per tjänst (via mapped_service_id → serviceRow.serviceItemId)
  const articlesByService = new Map<string, CaseBillingItem[]>()
  const unmapped: CaseBillingItem[] = []
  for (const art of articleItems) {
    if (art.mapped_service_id && serviceRows.some(s => s.serviceItemId === art.mapped_service_id)) {
      const list = articlesByService.get(art.mapped_service_id) || []
      list.push(art)
      articlesByService.set(art.mapped_service_id, list)
    } else {
      unmapped.push(art)
    }
  }

  // Total kostnad & marginal — alltid på exkl.-basen (momsen är aldrig bolagets intäkt).
  const totalCost = articleItems.reduce((sum, a) => sum + a.total_price, 0)
  const totalMargin = calculateMarginPercent(totalRevenue, totalCost)

  return (
    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-xs font-medium text-slate-400">
          Kostnadsuppdelning per tjänst
          <span className="ml-2 text-slate-500 font-normal">
            — så här kalkylerade teknikern priset
          </span>
        </h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">
            Inköpskostnad: <span className="text-white font-medium">{formatAmount(totalCost)}</span>
          </span>
          <span className={`font-semibold ${marginColor(totalMargin)}`}>
            {totalMargin.toFixed(1)}% marginal
          </span>
        </div>
      </div>
      <div className="divide-y divide-slate-700/50">
        {serviceRows.map(serviceRow => {
          const svcId = serviceRow.serviceItemId
          const mappedArticles = articlesByService.get(svcId) || []
          const svcCost = mappedArticles.reduce((sum, a) => sum + a.total_price, 0)
          const svcRevenue = serviceRow.revenue
          const svcMargin = calculateMarginPercent(svcRevenue, svcCost)
          const isExpanded = expandedServices.has(serviceRow.id)

          if (mappedArticles.length === 0) {
            return (
              <div key={serviceRow.id} className="px-3 py-2 flex items-center justify-between text-sm">
                <span className="text-slate-300">{serviceRow.name}</span>
                <span className="text-xs text-slate-500">Inga interna kostnader tilldelade</span>
              </div>
            )
          }

          return (
            <div key={serviceRow.id}>
              <button
                onClick={() => {
                  const next = new Set(expandedServices)
                  if (next.has(serviceRow.id)) next.delete(serviceRow.id)
                  else next.add(serviceRow.id)
                  setExpandedServices(next)
                }}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-slate-700/30 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  {isExpanded
                    ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                  <span className="text-sm text-white">{serviceRow.name}</span>
                  <span className="text-xs text-slate-500">
                    {mappedArticles.length} {mappedArticles.length === 1 ? 'kostnadspost' : 'kostnadsposter'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-slate-400">
                    Kostnad <span className="text-slate-200">{formatAmount(svcCost)}</span>
                  </span>
                  <span className="text-slate-400">
                    Intäkt <span className="text-slate-200">{formatAmount(svcRevenue)}</span>
                  </span>
                  <span className={`font-semibold min-w-[60px] text-right ${marginColor(svcMargin)}`}>
                    {svcMargin.toFixed(1)}%
                  </span>
                </div>
              </button>
              {isExpanded && (
                <div className="bg-slate-900/50 px-3 py-2">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[10px] text-slate-500 uppercase">
                        <th className="text-left py-1 font-medium">Artikel</th>
                        <th className="text-right py-1 font-medium">À-pris</th>
                        <th className="text-right py-1 font-medium">Antal</th>
                        <th className="text-right py-1 font-medium">Summa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappedArticles.map(art => (
                        <tr key={art.id} className="text-xs">
                          <td className="py-1 text-slate-300">
                            <span className="text-slate-500 mr-2">{art.article_code}</span>
                            {art.article_name}
                          </td>
                          <td className="py-1 text-right text-slate-400">
                            {formatAmount(art.unit_price)}
                          </td>
                          <td className="py-1 text-right text-slate-400">
                            {art.quantity} st
                          </td>
                          <td className="py-1 text-right text-slate-200 font-medium">
                            {formatAmount(art.total_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
        {unmapped.length > 0 && (
          <div className="px-3 py-2 bg-slate-900/30">
            <div className="text-xs text-slate-500 mb-1">
              Ej tilldelade interna kostnader ({formatAmount(unmapped.reduce((s, a) => s + a.total_price, 0))})
            </div>
            <div className="space-y-0.5">
              {unmapped.map(art => (
                <div key={art.id} className="flex justify-between text-xs text-slate-400">
                  <span>
                    <span className="text-slate-500 mr-2">{art.article_code}</span>
                    {art.article_name} × {art.quantity}
                  </span>
                  <span>{formatAmount(art.total_price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
