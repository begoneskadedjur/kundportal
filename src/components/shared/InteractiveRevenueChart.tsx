import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion } from 'framer-motion';

interface RevenueData {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

interface InteractiveRevenueChartProps {
  data: {
    contracts: number;
    privateCases: number;
    businessCases: number;
    legacyCases: number;
  };
  size?: number;
  className?: string;
}

const InteractiveRevenueChart: React.FC<InteractiveRevenueChartProps> = ({
  data,
  size = 120,
  className = ''
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const total = data.contracts + data.privateCases + data.businessCases + data.legacyCases;
  
  const chartData: RevenueData[] = [
    {
      name: 'Avtal',
      value: data.contracts,
      color: '#20c58f',
      percentage: total > 0 ? Math.round((data.contracts / total) * 100) : 0
    },
    {
      name: 'Privat',
      value: data.privateCases,
      color: '#3b82f6',
      percentage: total > 0 ? Math.round((data.privateCases / total) * 100) : 0
    },
    {
      name: 'Företag',
      value: data.businessCases,
      color: '#f59e0b',
      percentage: total > 0 ? Math.round((data.businessCases / total) * 100) : 0
    },
    {
      name: 'Legacy',
      value: data.legacyCases,
      color: '#8b5cf6',
      percentage: total > 0 ? Math.round((data.legacyCases / total) * 100) : 0
    }
  ].filter(item => item.value > 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      maximumFractionDigits: 0
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-800 p-3 rounded-lg border border-slate-700 shadow-xl"
        >
          <div className="text-white font-semibold">{data.name}</div>
          <div className="text-[#20c58f]">{formatCurrency(data.value)}</div>
          <div className="text-slate-400 text-sm">{data.percentage}% av total</div>
        </motion.div>
      );
    }
    return null;
  };

  if (total === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <div className="text-slate-500 text-sm">Ingen data</div>
      </div>
    );
  }

  return (
    <motion.div
      className={`relative ${className}`}
      style={{ width: size, height: size, zIndex: 1 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={size * 0.3}
            outerRadius={size * 0.45}
            paddingAngle={2}
            dataKey="value"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            animationBegin={500}
            animationDuration={1000}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke={activeIndex === index ? '#ffffff' : 'transparent'}
                strokeWidth={activeIndex === index ? 2 : 0}
                style={{
                  filter: activeIndex === index ? 'brightness(1.1)' : 'brightness(1)',
                  transition: 'all 0.2s ease'
                }}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-white font-bold text-sm">Total</div>
          <div className="text-[#20c58f] font-semibold text-xs">
            {formatCurrency(total)}
          </div>
        </div>
      </div>

      {/* Legend */}
      {isHovered && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 translate-y-full z-50"
        >
          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-xl min-w-max">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {chartData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-300">{item.name}</span>
                  <span className="text-slate-400">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default InteractiveRevenueChart;