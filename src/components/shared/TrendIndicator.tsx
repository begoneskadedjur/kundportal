import React, { useState } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TrendData {
  value: number;
}

interface TrendExplanation {
  currentMonth: string;
  currentValue: number;
  previousMonth: string;
  previousValue: number;
  suffix?: string;
}

interface TrendIndicatorProps {
  data?: TrendData[];
  trend: 'up' | 'down' | 'neutral';
  percentage?: string;
  className?: string;
  showChart?: boolean;
  showIcon?: boolean;
  explanation?: TrendExplanation;
  explanationMode?: 'hover' | 'expandable' | 'popover';
}

const TrendIndicator: React.FC<TrendIndicatorProps> = ({
  data = [],
  trend,
  percentage,
  className = '',
  showChart = true,
  showIcon = true,
  explanation,
  explanationMode = 'hover'
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPopover, setShowPopover] = useState(false);

  const trendColors = {
    up: '#10b981', // green-500
    down: '#ef4444', // red-500
    neutral: '#64748b' // slate-500
  };

  const trendColor = trendColors[trend];
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  const formatValue = (value: number, suffix?: string) => {
    return `${Math.round(value)}${suffix || ''}`;
  };

  const renderTooltipContent = () => {
    if (!explanation) return null;
    
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg text-xs whitespace-nowrap">
        <div className="font-medium text-white mb-1">Trendberäkning:</div>
        <div className="text-slate-300">
          <div>{explanation.currentMonth}: {formatValue(explanation.currentValue, explanation.suffix)}</div>
          <div>{explanation.previousMonth}: {formatValue(explanation.previousValue, explanation.suffix)}</div>
          <div className="text-slate-400 mt-1">
            Förändring: {percentage}
          </div>
        </div>
      </div>
    );
  };

  const renderExpandableContent = () => {
    if (!explanation || !isExpanded) return null;
    
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="mt-2 p-2 bg-slate-800/50 rounded border border-slate-700"
      >
        <div className="text-xs text-slate-300">
          <div className="font-medium text-slate-200 mb-1">Trendberäkning:</div>
          <div className="flex justify-between">
            <span>{explanation.currentMonth}:</span>
            <span className="font-medium">{formatValue(explanation.currentValue, explanation.suffix)}</span>
          </div>
          <div className="flex justify-between">
            <span>{explanation.previousMonth}:</span>
            <span className="font-medium">{formatValue(explanation.previousValue, explanation.suffix)}</span>
          </div>
          <div className="flex justify-between mt-1 pt-1 border-t border-slate-600">
            <span>Förändring:</span>
            <span className="font-medium" style={{ color: trendColor }}>{percentage}</span>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderPopoverContent = () => {
    if (!explanation || !showPopover) return null;
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        className="absolute top-full left-0 mt-2 z-50 bg-slate-800 border border-slate-600 rounded-lg p-4 shadow-xl min-w-64"
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-white">Trendberäkning</h4>
          <button
            onClick={() => setShowPopover(false)}
            className="text-slate-400 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
            <span className="text-slate-300">{explanation.currentMonth}</span>
            <span className="font-medium text-white">{formatValue(explanation.currentValue, explanation.suffix)}</span>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
            <span className="text-slate-300">{explanation.previousMonth}</span>
            <span className="font-medium text-white">{formatValue(explanation.previousValue, explanation.suffix)}</span>
          </div>
          
          <div className="flex items-center justify-between p-2 bg-slate-700/30 rounded border border-slate-600">
            <span className="text-slate-300">Förändring</span>
            <span className="font-bold text-lg" style={{ color: trendColor }}>
              {percentage}
            </span>
          </div>
          
          <div className="text-xs text-slate-400 mt-2">
            Trenden visar förändringen mellan de två senaste månaderna.
          </div>
        </div>
      </motion.div>
    );
  };

  const TrendContent = () => (
    <div className={`flex items-center gap-2 ${explanationMode === 'popover' ? 'relative' : ''}`}>
      {showIcon && (
        <TrendIcon 
          className="w-4 h-4" 
          style={{ color: trendColor }}
        />
      )}
      
      {percentage && (
        <span 
          className="text-sm font-medium"
          style={{ color: trendColor }}
        >
          {percentage}
        </span>
      )}

      {explanation && explanationMode === 'expandable' && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-slate-300 transition-colors"
        >
          <Info className="w-3 h-3" />
        </button>
      )}

      {explanation && explanationMode === 'popover' && (
        <button
          onClick={() => setShowPopover(!showPopover)}
          className="text-slate-400 hover:text-slate-300 transition-colors"
        >
          <Info className="w-3 h-3" />
        </button>
      )}
      
      {showChart && data.length > 0 && (
        <div className="w-16 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={trendColor}
                strokeWidth={2}
                dot={false}
                animationDuration={1000}
                animationBegin={300}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <AnimatePresence>
        {renderPopoverContent()}
      </AnimatePresence>
    </div>
  );

  if (!explanation || explanationMode !== 'hover') {
    return (
      <div className={className}>
        <TrendContent />
        <AnimatePresence>
          {renderExpandableContent()}
        </AnimatePresence>
      </div>
    );
  }

  // Hover tooltip approach
  return (
    <div className={`relative group ${className}`}>
      <TrendContent />
      
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
        {renderTooltipContent()}
      </div>
    </div>
  );
};

export default TrendIndicator;