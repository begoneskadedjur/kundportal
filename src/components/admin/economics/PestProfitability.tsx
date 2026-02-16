import React, { useState, useEffect } from 'react'
import { Bug } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useEconomicsPeriod } from '../../../contexts/EconomicsPeriodContext'

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('sv-SE', {
    style: 'currency', currency: 'SEK',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount)

interface PestData {
  type: string
  total_revenue: number
  case_count: number
  avg_price: number
}

const PestProfitability: React.FC = () => {
  const { dateRange } = useEconomicsPeriod()
  const [pests, setPests] = useState<PestData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPestData = async () => {
      try {
        setLoading(true)
        const { start, end } = dateRange

        // Hämta privata ärenden
        const { data: privateData } = await supabase
          .from('private_cases')
          .select('skadedjur, pris')
          .eq('status', 'Avslutat')
          .gte('completed_date', start)
          .lte('completed_date', end)
          .not('completed_date', 'is', null)

        // Hämta företagsärenden
        const { data: businessData } = await supabase
          .from('business_cases')
          .select('skadedjur, pris')
          .eq('status', 'Avslutat')
          .gte('completed_date', start)
          .lte('completed_date', end)
          .not('completed_date', 'is', null)

        // Kombinera och gruppera per skadedjur
        const stats: Record<string, PestData> = {}
        const allCases = [...(privateData || []), ...(businessData || [])]

        allCases.forEach(c => {
          const pest = c.skadedjur || 'Okänt'
          if (!stats[pest]) {
            stats[pest] = { type: pest, total_revenue: 0, case_count: 0, avg_price: 0 }
          }
          stats[pest].total_revenue += c.pris || 0
          stats[pest].case_count++
        })

        const sorted = Object.values(stats)
          .map(p => ({ ...p, avg_price: p.case_count > 0 ? p.total_revenue / p.case_count : 0 }))
          .sort((a, b) => b.total_revenue - a.total_revenue)
          .slice(0, 8)

        setPests(sorted)
      } catch (err) {
        console.error('Error fetching pest data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPestData()
  }, [dateRange.start, dateRange.end])

  const maxRevenue = pests.length > 0 ? pests[0].total_revenue : 0

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-slate-700 rounded w-48 mb-4"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 bg-slate-700/30 rounded mb-2"></div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-4">
        <Bug className="w-4 h-4 text-red-400" />
        Lönsammaste Skadedjur
      </h3>

      {pests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-500">
          <Bug className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">Inga skadedjursdata för perioden</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pests.map((pest, i) => (
            <div key={pest.type} className="group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-4 text-right font-mono">{i + 1}.</span>
                  <span className="text-xs text-white font-medium">{pest.type}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-500">{pest.case_count} ärenden</span>
                  <span className="text-xs text-[#20c58f] font-semibold">{formatCurrency(pest.total_revenue)}</span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-700/30 rounded-full overflow-hidden ml-6">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-500/60 to-red-400/40 transition-all duration-500"
                  style={{ width: maxRevenue > 0 ? `${(pest.total_revenue / maxRevenue) * 100}%` : '0%' }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PestProfitability
