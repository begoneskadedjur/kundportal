// src/components/coordinator/follow-up/OfferItemsSection.tsx
// Visar tjänster (till kund) + interna artiklar (kalkyl) för en offert/avtal
import { Wrench, Package, TrendingUp, Loader2, Receipt } from 'lucide-react'
import type { CaseBillingItemWithRelations } from '../../../types/caseBilling'
import { calculateMarginPercent } from '../../../types/caseBilling'

interface OfferItemsSectionProps {
  services: CaseBillingItemWithRelations[]
  articles: CaseBillingItemWithRelations[]
  loading: boolean
  error: string | null
}

function formatKr(value: number): string {
  return `${Math.round(value).toLocaleString('sv-SE')} kr`
}

export default function OfferItemsSection({ services, articles, loading, error }: OfferItemsSectionProps) {
  if (loading) {
    return (
      <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-[#20c58f]" />
        <span className="text-xs text-slate-400">Laddar innehåll...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
        <p className="text-xs text-red-300">Kunde inte ladda innehåll: {error}</p>
      </div>
    )
  }

  if (services.length === 0 && articles.length === 0) {
    return (
      <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl text-center">
        <Receipt className="w-5 h-5 text-slate-600 mx-auto mb-1" />
        <p className="text-xs text-slate-500">Inget detaljerat innehåll sparat för denna offert.</p>
        <p className="text-[10px] text-slate-600 mt-0.5">Skapad innan innehåll började persisteras automatiskt.</p>
      </div>
    )
  }

  const servicesSubtotal = services.reduce((sum, i) => sum + i.total_price, 0)
  const articlesSubtotal = articles.reduce((sum, i) => sum + i.total_price, 0)
  const marginPercent = servicesSubtotal > 0
    ? calculateMarginPercent(servicesSubtotal, articlesSubtotal)
    : null

  return (
    <div className="space-y-3">
      {/* Tjänster till kund */}
      {services.length > 0 && (
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-1.5 mb-2">
            <Wrench className="w-4 h-4 text-[#20c58f]" />
            <span className="text-sm font-semibold text-white">Tjänster till kund</span>
            <span className="text-[10px] text-slate-500">({services.length} st)</span>
          </div>
          <div className="space-y-1">
            {services.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 bg-slate-800/20 border border-slate-700/50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-white truncate">{item.service_name || item.article_name}</span>
                    {item.rot_rut_type && (
                      <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-blue-500/15 text-blue-400">
                        {item.rot_rut_type}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {item.quantity} × {formatKr(item.unit_price)}
                    {item.discount_percent > 0 && ` • -${item.discount_percent}%`}
                  </div>
                </div>
                <span className="text-xs font-medium text-white whitespace-nowrap">
                  {formatKr(item.total_price)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/50">
            <span className="text-xs font-medium text-slate-400">Summa exkl. moms</span>
            <span className="text-sm font-semibold text-white">{formatKr(servicesSubtotal)}</span>
          </div>
        </div>
      )}

      {/* Interna artiklar (kalkyl) */}
      {articles.length > 0 && (
        <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
          <div className="flex items-center gap-1.5 mb-2">
            <Package className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">Interna artiklar (kalkyl)</span>
            <span className="text-[10px] text-slate-500">({articles.length} st)</span>
          </div>
          <div className="space-y-1">
            {articles.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 bg-slate-800/20 border border-slate-700/30 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-300 truncate block">{item.article_name}</span>
                  <div className="text-[10px] text-slate-500">
                    {item.quantity} × {formatKr(item.unit_price)}
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-300 whitespace-nowrap">
                  {formatKr(item.total_price)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/30">
            <span className="text-xs font-medium text-slate-400">Inköpskostnad</span>
            <span className="text-sm font-semibold text-slate-300">{formatKr(articlesSubtotal)}</span>
          </div>

          {/* Marginal */}
          {marginPercent !== null && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/30">
              <div className="flex items-center gap-1">
                <TrendingUp className={`w-3.5 h-3.5 ${marginPercent >= 40 ? 'text-green-400' : marginPercent >= 20 ? 'text-amber-400' : 'text-red-400'}`} />
                <span className="text-xs font-medium text-slate-400">Marginal</span>
              </div>
              <span className={`text-sm font-semibold ${marginPercent >= 40 ? 'text-green-400' : marginPercent >= 20 ? 'text-amber-400' : 'text-red-400'}`}>
                {marginPercent.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
