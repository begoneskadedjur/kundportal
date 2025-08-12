import React from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  User, 
  FileText, 
  DollarSign,
  Settings,
  Database
} from 'lucide-react';

interface TimelineActivity {
  id: string;
  type: 'system' | 'user' | 'billing' | 'update' | 'success' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
  user?: string;
}

interface VisualTimelineProps {
  activities: TimelineActivity[];
  className?: string;
  maxItems?: number;
}

const VisualTimeline: React.FC<VisualTimelineProps> = ({
  activities,
  className = '',
  maxItems = 10
}) => {
  const displayActivities = activities.slice(0, maxItems);

  const getActivityConfig = (type: TimelineActivity['type']) => {
    switch (type) {
      case 'system':
        return {
          icon: Database,
          color: 'bg-blue-500',
          textColor: 'text-blue-400',
          bgColor: 'bg-blue-500/10'
        };
      case 'user':
        return {
          icon: User,
          color: 'bg-green-500',
          textColor: 'text-green-400',
          bgColor: 'bg-green-500/10'
        };
      case 'billing':
        return {
          icon: DollarSign,
          color: 'bg-yellow-500',
          textColor: 'text-yellow-400',
          bgColor: 'bg-yellow-500/10'
        };
      case 'update':
        return {
          icon: Settings,
          color: 'bg-purple-500',
          textColor: 'text-purple-400',
          bgColor: 'bg-purple-500/10'
        };
      case 'success':
        return {
          icon: CheckCircle,
          color: 'bg-green-500',
          textColor: 'text-green-400',
          bgColor: 'bg-green-500/10'
        };
      case 'warning':
        return {
          icon: AlertCircle,
          color: 'bg-orange-500',
          textColor: 'text-orange-400',
          bgColor: 'bg-orange-500/10'
        };
      case 'info':
      default:
        return {
          icon: Info,
          color: 'bg-slate-500',
          textColor: 'text-slate-400',
          bgColor: 'bg-slate-500/10'
        };
    }
  };

  const formatTime = (timestamp: string) => {
    // Simple time formatting - adjust based on your timestamp format
    return timestamp;
  };

  if (displayActivities.length === 0) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">Ingen aktivitet att visa</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {displayActivities.map((activity, index) => {
        const config = getActivityConfig(activity.type);
        const IconComponent = config.icon;
        const isFirst = index === 0;
        
        return (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.4,
              delay: index * 0.1,
              ease: "easeOut"
            }}
            className="relative"
          >
            {/* Timeline line */}
            {!isFirst && (
              <div className="absolute left-4 -top-4 w-px h-4 bg-slate-700" />
            )}
            
            <div className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-200 hover:${config.bgColor} group`}>
              {/* Icon */}
              <motion.div
                className={`flex-shrink-0 w-8 h-8 ${config.color} rounded-full flex items-center justify-center`}
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.2 }}
              >
                <IconComponent className="w-4 h-4 text-white" />
              </motion.div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-white font-medium group-hover:text-slate-100 transition-colors">
                      {activity.title}
                    </h4>
                    <p className="text-slate-400 text-sm mt-1 group-hover:text-slate-300 transition-colors">
                      {activity.description}
                    </p>
                    {activity.user && (
                      <p className="text-xs text-slate-500 mt-1">
                        av {activity.user}
                      </p>
                    )}
                  </div>
                  
                  <span className="text-xs text-slate-500 flex-shrink-0 ml-4">
                    {formatTime(activity.timestamp)}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Pulse animation for the first item */}
            {isFirst && (
              <motion.div
                className={`absolute left-4 top-3 w-8 h-8 ${config.color} rounded-full`}
                initial={{ opacity: 0.2, scale: 1 }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.2, 0, 0.2]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                style={{ opacity: 0.2 }}
              />
            )}
          </motion.div>
        );
      })}
      
      {activities.length > maxItems && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: displayActivities.length * 0.1 + 0.3 }}
          className="text-center pt-4"
        >
          <button className="text-sm text-slate-400 hover:text-slate-300 transition-colors">
            Visa {activities.length - maxItems} fler aktiviteter
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default VisualTimeline;