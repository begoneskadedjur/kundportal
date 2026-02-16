import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { usePriceListAnalytics } from '../../../hooks/useEconomicsDashboard'

const PriceListUtilization: React.FC = () => {
  const { data, loading } = usePriceListAnalytics()

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5 animate-pulse h-96">
        <div className="h-4 bg-slate-700 rounded w-32 mb-4"></div>
        <div className="h-32 bg-slate-700/30 rounded-full mx-auto w-32"></div>
      </div>
    )
  }

  if (!data) return null

  const donutData = [
    { name: 'Med prislista', value: data.customersWithPriceList, color: '#20c58f' },
    { name: 'Utan prislista', value: data.customersWithoutPriceList, color: '#475569' },
  ]

  return (
    <div className="bg-slate-800/50 border border-slate-700/40 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-4">
        <FileSpreadsheet className="w-4 h-4 text-yellow-400" />
        Prislistor
      </h3>

      {/* Donut chart */}
      <div className="relative h-36 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donutData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {donutData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{data.coveragePercent.toFixed(0)}%</span>
          <span className="text-[10px] text-slate-400">täckning</span>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-400">
            <div className="w-2 h-2 rounded-full bg-[#20c58f]"></div>
            Med prislista
          </span>
          <span className="text-white font-medium">{data.customersWithPriceList} kunder</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-400">
            <div className="w-2 h-2 rounded-full bg-slate-600"></div>
            Utan prislista
          </span>
          <span className="text-white font-medium">{data.customersWithoutPriceList} kunder</span>
        </div>
      </div>

      {/* Active price lists */}
      {data.priceLists.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-slate-400 mb-2">Aktiva prislistor</h4>
          <div className="space-y-1.5">
            {data.priceLists.map(pl => (
              <div key={pl.id} className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-slate-800/20 rounded-lg">
                <span className="text-white flex items-center gap-1.5">
                  {pl.name}
                  {pl.is_default && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-[#20c58f]/20 text-[#20c58f] font-medium">Standard</span>
                  )}
                </span>
                <span className="text-slate-400">{pl.customer_count} kunder</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning if many customers lack price list */}
      {data.customersWithoutPriceList > 0 && (
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-amber-300 font-medium">
                {data.customersWithoutPriceList} kunder saknar prislista
              </p>
              <p className="text-[10px] text-amber-400/70 mt-0.5">
                Kan ej inkluderas i batch-fakturering
              </p>
            </div>
          </div>
        </div>
      )}

      {data.customersWithoutPriceList === 0 && (
        <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            <p className="text-xs text-green-300">Alla kunder har prislistor</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default PriceListUtilization
