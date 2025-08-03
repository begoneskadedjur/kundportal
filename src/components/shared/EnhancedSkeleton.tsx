import React from 'react';
import { motion } from 'framer-motion';

interface EnhancedSkeletonProps {
  variant?: 'kpi' | 'card' | 'timeline' | 'text' | 'circle' | 'rectangle';
  className?: string;
  width?: string;
  height?: string;
  count?: number;
  delay?: number;
}

const EnhancedSkeleton: React.FC<EnhancedSkeletonProps> = ({
  variant = 'rectangle',
  className = '',
  width,
  height,
  count = 1,
  delay = 0
}) => {
  const baseClasses = "animate-pulse bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%] rounded";
  
  const variants = {
    kpi: "h-[104px] p-5 border border-slate-800 rounded-xl bg-slate-900",
    card: "h-[180px] p-6 border border-slate-800 rounded-xl bg-slate-900",
    timeline: "h-16 p-3 border border-slate-800/50 rounded-lg bg-slate-800/50",
    text: "h-4 rounded",
    circle: "rounded-full",
    rectangle: "rounded-lg"
  };

  const SkeletonElement = ({ index = 0 }: { index?: number }) => {
    const elementDelay = delay + (index * 0.1);
    
    if (variant === 'kpi') {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: elementDelay }}
          className={`${variants.kpi} ${className}`}
          style={{ width, height }}
        >
          <div className="flex items-center gap-4 h-full">
            <div className="w-14 h-14 bg-slate-800 rounded-lg animate-pulse" />
            <div className="flex-1">
              <div className="h-8 w-20 bg-slate-800 rounded mb-2 animate-pulse" />
              <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
            </div>
          </div>
        </motion.div>
      );
    }

    if (variant === 'card') {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: elementDelay }}
          className={`${variants.card} ${className}`}
          style={{ width, height }}
        >
          <div className="h-full flex flex-col">
            <div className="w-14 h-14 bg-slate-800 rounded-lg mb-4 animate-pulse" />
            <div className="h-6 w-32 bg-slate-800 rounded mb-2 animate-pulse" />
            <div className="h-4 w-full bg-slate-800 rounded mb-2 animate-pulse" />
            <div className="h-3 w-24 bg-slate-800 rounded mt-auto animate-pulse" />
          </div>
        </motion.div>
      );
    }

    if (variant === 'timeline') {
      return (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: elementDelay }}
          className={`${variants.timeline} ${className}`}
          style={{ width, height }}
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-slate-700 rounded-full animate-pulse" />
            <div className="flex-1">
              <div className="h-4 w-3/4 bg-slate-700 rounded mb-1 animate-pulse" />
              <div className="h-3 w-1/2 bg-slate-700 rounded animate-pulse" />
            </div>
            <div className="h-3 w-16 bg-slate-700 rounded animate-pulse" />
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: elementDelay }}
        className={`${baseClasses} ${variants[variant]} ${className}`}
        style={{ width, height }}
      />
    );
  };

  if (count === 1) {
    return <SkeletonElement />;
  }

  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonElement key={index} index={index} />
      ))}
    </div>
  );
};

export default EnhancedSkeleton;