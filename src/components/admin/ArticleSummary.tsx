// src/components/admin/ArticleSummary.tsx
// Prissammanfattning för artikelbaserad wizard (ersätter ProductSummary)

import { Trash2, ShieldCheck, Leaf, Calculator, Info } from 'lucide-react'
import Card from '../ui/Card'
import type { SelectedArticleItem } from '../../types/products'
import type { CustomerType } from '../../types/products'
import {
  calculateArticlePriceSummary,
  formatArticlePrice
} from '../../utils/articlePricingCalculator'
import { ARTICLE_CATEGORY_CONFIG } from '../../types/articles'

interface ArticleSummaryProps {
  selectedArticles: SelectedArticleItem[]
  customerType: CustomerType
  priceListName?: string
  onRemoveArticle?: (articleId: string) => void
  className?: string
}

export default function ArticleSummary({
  selectedArticles,
  customerType,
  priceListName,
  onRemoveArticle,
  className = ''
}: ArticleSummaryProps) {
  if (selectedArticles.length === 0) {
    return (
      <Card className={`p-6 text-center ${className}`}>
        <div className="text-4xl mb-3">📋</div>
        <h3 className="text-sm font-semibold text-white mb-1">Inga artiklar valda</h3>
        <p className="text-xs text-slate-400">Välj artiklar från prislistan för att se sammanfattning</p>
      </Card>
    )
  }

  const summary = calculateArticlePriceSummary(selectedArticles, customerType)

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Prisliste-info */}
      {priceListName && (
        <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <span className="text-xs text-blue-400">Prislista: </span>
          <span className="text-xs text-white font-medium">{priceListName}</span>
        </div>
      )}

      {/* Valda artiklar */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-white">
            Valda artiklar ({summary.itemCount})
          </h3>
        </div>

        <div className="space-y-2">
          {selectedArticles.map(item => {
            const catConfig = ARTICLE_CATEGORY_CONFIG[item.article.category]
            const lineTotal = item.effectivePrice * item.quantity

            return (
              <div
                key={item.article.id}
                className="flex items-start justify-between p-2.5 border border-slate-700 rounded-lg bg-slate-800/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{catConfig?.icon || '•'}</span>
                    <span className="text-sm text-white font-medium truncate">
                      {item.article.name}
                    </span>
                    <span className="text-xs text-slate-400">× {item.quantity}</span>
                  </div>

                  {/* ROT/RUT badges */}
                  <div className="flex gap-1 mt-1">
                    {item.article.rot_eligible && (
                      <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] rounded flex items-center gap-0.5">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        ROT
                      </span>
                    )}
                    {item.article.rut_eligible && (
                      <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded flex items-center gap-0.5">
                        <Leaf className="w-2.5 h-2.5" />
                        RUT
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-sm text-white font-medium">
                      {formatArticlePrice(lineTotal)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {formatArticlePrice(item.effectivePrice)} / {item.article.unit}
                    </div>
                  </div>

                  {onRemoveArticle && (
                    <button
                      onClick={() => onRemoveArticle(item.article.id)}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      title="Ta bort"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Prissammanfattning */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Prissammanfattning</h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-300">
            <span>Summa exkl. moms</span>
            <span>{formatArticlePrice(summary.subtotal)}</span>
          </div>

          <div className="flex justify-between text-slate-300">
            <span>Moms</span>
            <span>{formatArticlePrice(summary.vatAmount)}</span>
          </div>

          <div className="border-t border-slate-700 pt-2">
            <div className="flex justify-between font-semibold text-white">
              <span>Totalt inkl. moms</span>
              <span>{formatArticlePrice(summary.totalBeforeDeduction)}</span>
            </div>
          </div>

          {/* ROT/RUT-avdrag (bara privatkunder) */}
          {customerType === 'individual' && (summary.rotDeduction > 0 || summary.rutDeduction > 0) && (
            <>
              {summary.rotDeduction > 0 && (
                <div className="flex justify-between text-blue-400">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    ROT-avdrag (30%)
                  </span>
                  <span>-{formatArticlePrice(summary.rotDeduction)}</span>
                </div>
              )}

              {summary.rutDeduction > 0 && (
                <div className="flex justify-between text-green-400">
                  <span className="flex items-center gap-1">
                    <Leaf className="w-3.5 h-3.5" />
                    RUT-avdrag (50%)
                  </span>
                  <span>-{formatArticlePrice(summary.rutDeduction)}</span>
                </div>
              )}

              <div className="border-t border-slate-700 pt-2">
                <div className="flex justify-between font-bold text-lg text-green-400">
                  <span>Att betala</span>
                  <span>{formatArticlePrice(summary.totalAfterDeduction)}</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 bg-slate-900/50 p-2 rounded">
                <Info className="w-3 h-3 inline mr-1" />
                {summary.rotDeduction > 0 && 'ROT-avdrag 30% av arbetskostnaden, max 50 000 kr/år. '}
                {summary.rutDeduction > 0 && 'RUT-avdrag 50% av arbetskostnaden, max 75 000 kr/år.'}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
