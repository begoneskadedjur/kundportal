// src/components/shared/KpiSectionHeader.tsx - Elegant sektionsrubrik för KPI-kort
import React from 'react'
import type { LucideProps } from 'lucide-react'

type LucideIcon = React.ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>>

interface KpiSectionHeaderProps {
  icon: LucideIcon
  title: string
  description?: string
  iconColor?: string
}

const KpiSectionHeader: React.FC<KpiSectionHeaderProps> = ({ 
  icon: Icon, 
  title, 
  description,
  iconColor = "text-blue-400"
}) => {
  return (
    <div className="mb-6">
      {/* Huvudrubrik */}
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 ${iconColor.replace('text-', 'bg-').replace('-400', '-500/20')} rounded-lg`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <h3 className="text-lg font-semibold text-white tracking-wide">
          {title}
        </h3>
      </div>
      
      {/* Beskrivning (valfri) */}
      {description && (
        <p className="text-sm text-slate-400 ml-11 mb-3">
          {description}
        </p>
      )}
      
      {/* Dekorativ linje */}
      <div className="ml-11 h-px bg-gradient-to-r from-slate-600 via-slate-700 to-transparent"></div>
    </div>
  )
}

export default KpiSectionHeader