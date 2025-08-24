// src/components/organisation/TrendChart.tsx - Återanvändbar chart-komponent för trafikljustrender
import React from 'react'
import { LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts'

interface TrendDataPoint {
  date: string
  value: number
  displayDate: string
}

interface TrendChartProps {
  data: TrendDataPoint[]
  metric: 'pestLevel' | 'problemRating'
  title: string
  currentValue?: number
  height?: number
}

const TrendChart: React.FC<TrendChartProps> = ({ 
  data, 
  metric, 
  title, 
  currentValue,
  height = 350 
}) => {
  
  // Färgschema för olika mätningar
  const chartConfig = {
    pestLevel: {
      line: '#10B981', // Green-500
      area: '#10B981',
      gradientId: 'pestLevelGradient',
      maxValue: 3,
      criticalThreshold: 3
    },
    problemRating: {
      line: '#8B5CF6', // Purple-500
      area: '#8B5CF6', 
      gradientId: 'problemRatingGradient',
      maxValue: 5,
      criticalThreshold: 4
    }
  }

  const config = chartConfig[metric]

  // Färg för individuella punkter baserat på värde
  const getPointColor = (value: number) => {
    if (metric === 'pestLevel') {
      if (value >= 3) return '#EF4444' // Red-500 - Kritisk
      if (value === 2) return '#F59E0B' // Amber-500 - Varning  
      return '#10B981' // Green-500 - OK
    } else {
      if (value >= 4) return '#EF4444' // Red-500 - Kritisk
      if (value === 3) return '#F59E0B' // Amber-500 - Varning
      return '#10B981' // Green-500 - OK
    }
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value
      const pointColor = getPointColor(value)
      const description = metric === 'pestLevel' 
        ? getPestLevelDescription(value)
        : getProblemRatingDescription(value)

      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="text-slate-300 text-sm mb-1">{payload[0].payload.displayDate}</p>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: pointColor }}
            ></div>
            <span className="text-white font-semibold">{title}: {value}</span>
          </div>
          <p className="text-slate-400 text-xs mt-1">{description}</p>
        </div>
      )
    }
    return null
  }

  // Beskrivningar för tooltip
  const getPestLevelDescription = (level: number) => {
    switch(level) {
      case 0: return 'Inga tecken på aktivitet'
      case 1: return 'Minimal aktivitet, situation under kontroll'
      case 2: return 'Måttlig aktivitet, kräver uppmärksamhet'
      case 3: return 'Hög aktivitet, omedelbar åtgärd krävs'
      default: return 'Ej bedömt'
    }
  }

  const getProblemRatingDescription = (rating: number) => {
    switch(rating) {
      case 1: return 'Utmärkt - Situation väl hanterad'
      case 2: return 'Bra - Situation under kontroll'
      case 3: return 'OK - Kräver kontinuerlig övervakning'
      case 4: return 'Problematisk - Åtgärd rekommenderas'
      case 5: return 'Kritisk - Brådskande åtgärd krävs'
      default: return 'Ej bedömt'
    }
  }

  // Om ingen data finns
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">📈</span>
        </div>
        <p className="text-slate-400 text-sm">Ingen historisk data tillgänglig</p>
        <p className="text-slate-500 text-xs mt-1">Trendlinjer visas när bedömningar finns</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Header med aktuellt värde */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-white">{title}</h4>
        {currentValue !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Aktuell:</span>
            <div 
              className="px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2"
              style={{ 
                backgroundColor: `${getPointColor(currentValue)}20`,
                color: getPointColor(currentValue)
              }}
            >
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: getPointColor(currentValue) }}
              ></div>
              {currentValue}
            </div>
          </div>
        )}
      </div>

      {/* Chart container */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id={config.gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={config.area} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={config.area} stopOpacity={0}/>
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.3} />
          
          <XAxis 
            dataKey="displayDate" 
            stroke="#94A3B8"
            fontSize={12}
            tickMargin={10}
          />
          
          <YAxis 
            domain={[0, config.maxValue]}
            stroke="#94A3B8"
            fontSize={12}
            tickMargin={10}
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          {/* Bakgrundsområde */}
          <Area
            type="monotone"
            dataKey="value"
            stroke="none"
            fill={`url(#${config.gradientId})`}
          />
          
          {/* Huvudlinje */}
          <Line
            type="monotone"
            dataKey="value"
            stroke={config.line}
            strokeWidth={3}
            dot={{ fill: config.line, strokeWidth: 2, r: 6 }}
            activeDot={{ 
              r: 8, 
              stroke: config.line, 
              strokeWidth: 2,
              fill: '#FFFFFF'
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Trend-indikator */}
      {data.length >= 2 && (
        <div className="mt-3 flex items-center justify-center">
          <div className="text-xs text-slate-400">
            {data[data.length - 1].value > data[data.length - 2].value ? (
              <span className="flex items-center gap-1 text-red-400">
                ↗ Uppåtgående trend
              </span>
            ) : data[data.length - 1].value < data[data.length - 2].value ? (
              <span className="flex items-center gap-1 text-green-400">
                ↘ Nedåtgående trend
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-400">
                → Stabil trend
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TrendChart