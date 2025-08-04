import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, FileText } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface MonthData {
  month: string;
  month_display: string;
  total_commission: number;
  case_count: number;
  avg_commission_per_case: number;
}

interface MonthlyOverviewListProps {
  months: MonthData[];
  onMonthClick: (month: MonthData) => void;
  maxItems?: number;
  className?: string;
}

const MonthlyOverviewList: React.FC<MonthlyOverviewListProps> = ({
  months,
  onMonthClick,
  maxItems = 3,
  className = ''
}) => {
  const displayMonths = months.slice(0, maxItems);

  if (displayMonths.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-slate-400">Ingen månadsdata tillgänglig ännu</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {displayMonths.map((month, index) => (
        <motion.div
          key={month.month}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.01, x: 4 }}
          className="relative"
        >
          {/* Timeline connector line */}
          {index < displayMonths.length - 1 && (
            <div className="absolute left-6 top-16 bottom-0 w-px bg-slate-700/50 -z-10" />
          )}
          
          {/* Month card */}
          <div
            className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:bg-slate-800/70 hover:border-slate-600/50 transition-all cursor-pointer group"
            onClick={() => onMonthClick(month)}
          >
            {/* Timeline dot */}
            <div className="flex-shrink-0 w-3 h-3 rounded-full bg-[#20c58f] ring-4 ring-slate-800 border-2 border-slate-700" />
            
            {/* Month content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-medium text-white text-sm group-hover:text-[#20c58f] transition-colors">
                  {month.month_display}
                </h3>
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                  {month.case_count} ärenden
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-slate-400 text-xs">
                <span className="flex items-center gap-1 text-green-400 font-medium">
                  {formatCurrency(month.total_commission)}
                </span>
                
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {formatCurrency(month.avg_commission_per_case)}/ärende
                </span>
                
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {month.month}
                </span>
              </div>
            </div>
            
            {/* Arrow indicator */}
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#20c58f] group-hover:translate-x-1 transition-all flex-shrink-0" />
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default MonthlyOverviewList;