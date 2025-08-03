import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendData {
  value: number;
}

interface TrendIndicatorProps {
  data?: TrendData[];
  trend: 'up' | 'down' | 'neutral';
  percentage?: string;
  className?: string;
  showChart?: boolean;
  showIcon?: boolean;
}

const TrendIndicator: React.FC<TrendIndicatorProps> = ({
  data = [],
  trend,
  percentage,
  className = '',
  showChart = true,
  showIcon = true
}) => {
  const trendColors = {
    up: '#10b981', // green-500
    down: '#ef4444', // red-500
    neutral: '#64748b' // slate-500
  };

  const trendColor = trendColors[trend];

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
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
    </div>
  );
};

export default TrendIndicator;