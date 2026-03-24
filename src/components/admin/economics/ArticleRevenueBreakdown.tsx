import React, { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Package, Filter } from 'lucide-react'
import { useArticleRevenue } from '../../../hooks/useEconomicsDashboard'
import { useEconomicsPeriod } from '../../../contexts/EconomicsPeriodContext'

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency', currency: 'SEK',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount)

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  Inspektion: { label: 'Inspektion', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  'Bekämpning': { label: 'Bekämpning', color: 'text-green-400', bg: 'bg-green-500/20' },
  'Tillbehör': { label: 'Tillbehör', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  'Arbetstid': { label: 'Arbetstid', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  'Underentreprenör': { label: 'Underentreprenör', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  'Övrigt': { label: 'Övrigt', color: 'text-slate-400', bg: 'bg-slate-500/20' },
}

const ArticleRevenueBreakdown: React.FC = () => {
  const { dateRange } = useEconomicsPeriod()
  const { data: articles, loading } = useArticleRevenue(dateRange)
  const [selectedCategory, setSelectedCategory] = useState<string>('Alla')

  const categories = useMemo(() => {
    const cats = new Set(articles.map(a => a.category))
    return ['Alla', ...Array.from(cats)]
  }, [articles])

  const filtered = useMemo(() => {
    if (selectedCategory === 'Alla') return articles
    return articles.filter(a => a.category === selectedCategory)
  }, [articles, selectedCategory])

  const top10 = filtered.slice(0, 10)
  const maxRevenue = top10.length > 0 ? top10[0].total_revenue : 0

  const chartData = top10.map(a => ({
    name: a.article_name.length > 20 ? a.article_name.slice(0, 20) + '...' : a.article_name,
    revenue: a.total_revenue,
    fullName: a.article_name
  }))

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5 animate-pulse h-96">
        <div className="h-4 bg-slate-700 rounded w-40 mb-4"></div>
        <div className="h-60 bg-slate-700/30 rounded"></div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <Package className="w-4 h-4 text-blue-400" />
          Artikelintäkter
        </h3>
        <span className="text-xs text-slate-500">
          {articles.length} artiklar
        </span>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
              selectedCategory === cat
                ? 'bg-[#20c58f] text-white'
                : 'bg-slate-700/40 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {top10.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <Package className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">Inga artikeldata för vald period</p>
          <p className="text-xs mt-1">Artikelintäkter visas när tekniker registrerar artiklar på ärenden</p>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="h-56 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} stroke="#64748b" fontSize={10} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} width={120} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Intäkt']}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                />
                <Bar dataKey="revenue" fill="#20c58f" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Ranked list */}
          <div className="space-y-1.5 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
            {top10.map((article, i) => {
              const catConfig = CATEGORY_CONFIG[article.category] || CATEGORY_CONFIG['Övrigt']
              return (
                <div key={article.article_id} className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-slate-700/20 transition-colors">
                  <span className="text-xs text-slate-500 w-5 text-right font-mono">{i + 1}.</span>
                  {article.article_code && (
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-700/40 px-1.5 py-0.5 rounded">{article.article_code}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-white truncate block">{article.article_name}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${catConfig.bg} ${catConfig.color}`}>
                    {catConfig.label}
                  </span>
                  <span className="text-xs text-slate-400 w-10 text-right">{article.total_quantity} st</span>
                  <span className="text-xs text-[#20c58f] font-semibold w-20 text-right">{formatCurrency(article.total_revenue)}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default ArticleRevenueBreakdown
