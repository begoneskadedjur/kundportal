import React from 'react';
import { motion } from 'framer-motion';

interface StaggeredGridProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  initialDelay?: number;
}

const StaggeredGrid: React.FC<StaggeredGridProps> = ({
  children,
  className = '',
  staggerDelay = 0.1,
  initialDelay = 0
}) => {
  const childrenArray = React.Children.toArray(children);

  return (
    <div className={className}>
      {childrenArray.map((child, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: initialDelay + (index * staggerDelay),
            ease: "easeOut"
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
};

export default StaggeredGrid;