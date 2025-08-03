import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';
import TrendIndicator from './TrendIndicator';
import InteractiveRevenueChart from './InteractiveRevenueChart';

interface TrendData {
  value: number;
}

interface EnhancedKpiCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  onClick?: () => void;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  trendData?: TrendData[];
  prefix?: string;
  suffix?: string;
  decimals?: number;
  isNumeric?: boolean;
  delay?: number;
  className?: string;
  customContent?: React.ReactNode;
  revenueBreakdown?: {
    contracts: number;
    privateCases: number;
    businessCases: number;
    legacyCases: number;
  };
}

const EnhancedKpiCard: React.FC<EnhancedKpiCardProps> = ({
  title,
  value,
  icon: Icon,
  onClick,
  trend,
  trendValue,
  trendData = [],
  prefix = '',
  suffix = '',
  decimals = 0,
  isNumeric = true,
  delay = 0,
  className = '',
  customContent,
  revenueBreakdown
}) => {
  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) || 0 : value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5,
        delay: delay,
        ease: "easeOut"
      }}
      className={`group ${className}`}
    >
      <div 
        className={`bg-slate-900 p-5 rounded-xl border border-slate-800 transition-all duration-300 ${
          revenueBreakdown ? 'flex flex-col gap-3' : 'flex items-center gap-4'
        } ${
          onClick ? 'cursor-pointer hover:border-slate-600 hover:bg-slate-800/50 hover:shadow-lg hover:shadow-slate-900/20' : ''
        }`}
        onClick={onClick}
      >
        <div className={revenueBreakdown ? 'flex items-start gap-4' : 'contents'}>
          <motion.div 
            className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 flex-shrink-0"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            <Icon className="w-6 h-6 text-[#20c58f]" />
          </motion.div>
        
        <div className="flex-1 min-w-0">
          {revenueBreakdown ? (
            /* Special layout for revenue cards */
            <div className="space-y-3">
              <div>
                <div className="text-2xl font-bold text-white whitespace-nowrap overflow-hidden">
                  {isNumeric && typeof value === 'number' ? (
                    <AnimatedNumber
                      value={numericValue}
                      duration={2}
                      prefix={prefix}
                      suffix={suffix}
                      decimals={decimals}
                    />
                  ) : (
                    <span className="whitespace-nowrap">{value}</span>
                  )}
                </div>
                
                <div className="text-sm text-slate-500 mb-1 truncate">{title}</div>
                
                {trend && trendValue && (
                  <TrendIndicator
                    data={trendData}
                    trend={trend}
                    percentage={trendValue}
                    showChart={trendData.length > 0}
                    className="mt-1"
                  />
                )}
              </div>
              
              <div className="flex justify-center pt-2">
                <InteractiveRevenueChart
                  data={revenueBreakdown}
                  size={80}
                  compact={true}
                />
              </div>
            </div>
          ) : (
            /* Standard layout for other cards */
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 mr-3">
                <div className="text-2xl font-bold text-white whitespace-nowrap overflow-hidden">
                  {isNumeric && typeof value === 'number' ? (
                    <AnimatedNumber
                      value={numericValue}
                      duration={2}
                      prefix={prefix}
                      suffix={suffix}
                      decimals={decimals}
                    />
                  ) : (
                    <span className="whitespace-nowrap">{value}</span>
                  )}
                </div>
                
                <div className="text-sm text-slate-500 mb-1 truncate">{title}</div>
                
                {trend && trendValue && (
                  <TrendIndicator
                    data={trendData}
                    trend={trend}
                    percentage={trendValue}
                    showChart={trendData.length > 0}
                    className="mt-1"
                  />
                )}
              </div>
            </div>
          )}
          
          {customContent && (
            <div className="mt-3">
              {customContent}
            </div>
          )}
        </div>
        
        {onClick && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.3 }}
            className={revenueBreakdown ? 'self-start' : ''}
          >
            <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-slate-400 transition-colors duration-200" />
          </motion.div>
        )}
        </div>
      </div>
    </motion.div>
  );
};

export default EnhancedKpiCard;