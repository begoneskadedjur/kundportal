import React from 'react';
import { motion } from 'framer-motion';

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'warning';
  responseTime?: string;
  description?: string;
}

interface LiveStatusIndicatorProps {
  services: ServiceStatus[];
  className?: string;
}

const LiveStatusIndicator: React.FC<LiveStatusIndicatorProps> = ({
  services,
  className = ''
}) => {
  const getStatusConfig = (status: ServiceStatus['status']) => {
    switch (status) {
      case 'online':
        return {
          color: '#10b981', // green-500
          bgColor: 'bg-green-500/10',
          textColor: 'text-green-400',
          label: 'Online'
        };
      case 'warning':
        return {
          color: '#f59e0b', // yellow-500
          bgColor: 'bg-yellow-500/10',
          textColor: 'text-yellow-400',
          label: 'Varning'
        };
      case 'offline':
        return {
          color: '#ef4444', // red-500
          bgColor: 'bg-red-500/10',
          textColor: 'text-red-400',
          label: 'Offline'
        };
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {services.map((service, index) => {
        const config = getStatusConfig(service.status);
        
        return (
          <motion.div
            key={service.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 hover:${config.bgColor} group`}
          >
            <div className="flex items-center gap-3">
              {/* Animated status dot */}
              <div className="relative">
                <motion.div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: config.color }}
                  animate={service.status === 'online' ? {
                    scale: [1, 1.2, 1],
                    opacity: [1, 0.8, 1]
                  } : {}}
                  transition={{
                    duration: 2,
                    repeat: service.status === 'online' ? Infinity : 0,
                    ease: "easeInOut"
                  }}
                />
                
                {/* Pulse ring for online status */}
                {service.status === 'online' && (
                  <motion.div
                    className="absolute inset-0 w-3 h-3 rounded-full"
                    style={{ backgroundColor: config.color }}
                    animate={{
                      scale: [1, 2, 1],
                      opacity: [0.5, 0, 0.5]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeOut"
                    }}
                  />
                )}
              </div>
              
              <div>
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                  {service.name}
                </span>
                {service.description && (
                  <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                    {service.description}
                  </p>
                )}
              </div>
            </div>
            
            <div className="text-right">
              <span className={`text-xs font-medium ${config.textColor}`}>
                {config.label}
              </span>
              {service.responseTime && (
                <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">
                  {service.responseTime}
                </p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default LiveStatusIndicator;