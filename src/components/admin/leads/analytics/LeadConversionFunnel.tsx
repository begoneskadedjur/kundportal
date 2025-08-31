// src/components/admin/leads/analytics/LeadConversionFunnel.tsx - Visual Lead Conversion Pipeline

import React from 'react'
import { 
  Users,
  Thermometer,
  Target,
  TrendingUp,
  XCircle,
  CheckCircle
} from 'lucide-react'
import { motion } from 'framer-motion'

import Card from '../../../ui/Card'
import { LEAD_STATUS_DISPLAY } from '../../../../types/database'

interface AnalyticsData {
  leads: any[]
  totalLeads: number
  conversionRate: number
  totalPipelineValue: number
  avgLeadScore: number
  leadsByStatus: Record<string, number>
  leadsBySource: Record<string, number>
  leadsByMonth: Record<string, number>
  teamPerformance: Record<string, any>
  geographicData: Record<string, number>
  revenueByMonth: Record<string, number>
}

interface LeadConversionFunnelProps {
  data: AnalyticsData
}

const LeadConversionFunnel: React.FC<LeadConversionFunnelProps> = ({ data }) => {
  const { leadsByStatus, totalLeads } = data

  // Define funnel stages with their data
  const funnelStages = [
    {
      id: 'blue_cold',
      label: 'Kalla Leads',
      count: leadsByStatus['blue_cold'] || 0,
      icon: Users,
      color: 'blue',
      bgColor: 'bg-blue-500',
      borderColor: 'border-blue-500',
      textColor: 'text-blue-400'
    },
    {
      id: 'yellow_warm',
      label: 'Ljumna Leads',
      count: leadsByStatus['yellow_warm'] || 0,
      icon: Thermometer,
      color: 'yellow',
      bgColor: 'bg-yellow-500',
      borderColor: 'border-yellow-500',
      textColor: 'text-yellow-400'
    },
    {
      id: 'orange_hot',
      label: 'Heta Leads',
      count: leadsByStatus['orange_hot'] || 0,
      icon: Target,
      color: 'orange',
      bgColor: 'bg-orange-500',
      borderColor: 'border-orange-500',
      textColor: 'text-orange-400'
    },
    {
      id: 'green_deal',
      label: 'Vunna Affärer',
      count: leadsByStatus['green_deal'] || 0,
      icon: CheckCircle,
      color: 'green',
      bgColor: 'bg-green-500',
      borderColor: 'border-green-500',
      textColor: 'text-green-400'
    }
  ]

  // Calculate conversion rates between stages
  const getConversionRate = (fromIndex: number, toIndex: number) => {
    const fromCount = funnelStages[fromIndex]?.count || 0
    const toCount = funnelStages[toIndex]?.count || 0
    if (fromCount === 0) return 0
    return ((toCount / fromCount) * 100)
  }

  // Calculate funnel width percentage based on stage counts
  const getStageWidth = (count: number) => {
    const maxCount = Math.max(...funnelStages.map(stage => stage.count))
    if (maxCount === 0) return 20
    return Math.max(20, (count / maxCount) * 100)
  }

  const lostLeads = leadsByStatus['red_lost'] || 0
  const lostPercentage = totalLeads > 0 ? ((lostLeads / totalLeads) * 100) : 0

  return (
    <Card className="backdrop-blur-sm bg-slate-800/70 border-slate-700/50 p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white flex items-center gap-3 mb-2">
          <TrendingUp className="w-6 h-6 text-purple-400" />
          Konverteringstratt
        </h3>
        <p className="text-slate-400">Lead-flöde genom försäljningsprocessen</p>
      </div>

      {/* Funnel Visualization */}
      <div className="space-y-4 mb-8">
        {funnelStages.map((stage, index) => (
          <motion.div
            key={stage.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative"
          >
            {/* Stage Bar */}
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className={`p-3 rounded-lg ${stage.bgColor}/20 border ${stage.borderColor} flex-shrink-0`}>
                <stage.icon className={`w-6 h-6 ${stage.textColor}`} />
              </div>

              {/* Progress Bar */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{stage.label}</span>
                  <div className="text-right">
                    <span className="text-white font-bold">{stage.count}</span>
                    <span className="text-slate-400 text-sm ml-2">
                      ({totalLeads > 0 ? ((stage.count / totalLeads) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                </div>
                
                <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${getStageWidth(stage.count)}%` }}
                    transition={{ delay: index * 0.1 + 0.3, duration: 1 }}
                    className={`h-full ${stage.bgColor} rounded-full`}
                  />
                </div>
              </div>
            </div>

            {/* Conversion Rate Arrow */}
            {index < funnelStages.length - 1 && (
              <div className="flex justify-end mt-2 mr-4">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span>↓</span>
                  <span>{getConversionRate(index, index + 1).toFixed(1)}% konvertering</span>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Lost Leads Section */}
      {lostLeads > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="border-t border-slate-700 pt-6"
        >
          <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium">Förlorade Leads</span>
                <div className="text-right">
                  <span className="text-white font-bold">{lostLeads}</span>
                  <span className="text-slate-400 text-sm ml-2">
                    ({lostPercentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
              <p className="text-red-400 text-sm">
                Leads som inte resulterade i affärer - analys krävs för förbättring
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center p-4 bg-slate-700/50 rounded-lg">
          <div className="text-2xl font-bold text-white">
            {data.conversionRate.toFixed(1)}%
          </div>
          <div className="text-sm text-slate-400">Total Konvertering</div>
        </div>
        
        <div className="text-center p-4 bg-slate-700/50 rounded-lg">
          <div className="text-2xl font-bold text-white">
            {totalLeads}
          </div>
          <div className="text-sm text-slate-400">Totala Leads</div>
        </div>
        
        <div className="text-center p-4 bg-slate-700/50 rounded-lg">
          <div className="text-2xl font-bold text-white">
            {((funnelStages[2].count + funnelStages[3].count) / Math.max(totalLeads, 1) * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-slate-400">Kvalificerade Leads</div>
        </div>
      </div>
    </Card>
  )
}

export default LeadConversionFunnel