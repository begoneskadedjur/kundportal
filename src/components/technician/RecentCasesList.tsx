import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getStatusColor } from '../../types/database';

interface CaseItem {
  id: string;
  title: string;
  status: string;
  case_type: 'private' | 'business';
  commission_amount?: number;
  completed_date?: string;
}

interface RecentCasesListProps {
  cases: CaseItem[];
  onCaseClick: (caseItem: CaseItem) => void;
  maxItems?: number;
  className?: string;
}

const RecentCasesList: React.FC<RecentCasesListProps> = ({
  cases,
  onCaseClick,
  maxItems = 5,
  className = ''
}) => {
  const displayCases = cases.slice(0, maxItems);

  const getStatusStyle = (status: string) => {
    const statusColor = getStatusColor(status as any);
    return {
      backgroundColor: `${statusColor}20`,
      color: statusColor,
      borderColor: `${statusColor}40`
    };
  };

  const getCaseTypeIcon = (caseType: string) => {
    return caseType === 'private' ? '👤' : '🏢';
  };

  const getCaseTypeName = (caseType: string) => {
    return caseType === 'private' ? 'Privat' : 'Företag';
  };

  if (displayCases.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-slate-400">Inga ärenden att visa</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {displayCases.map((caseItem, index) => (
        <motion.div
          key={caseItem.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.01, x: 4 }}
          className="relative"
        >
          {/* Timeline connector line */}
          {index < displayCases.length - 1 && (
            <div className="absolute left-6 top-16 bottom-0 w-px bg-slate-700/50 -z-10" />
          )}
          
          {/* Case card */}
          <div
            className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:bg-slate-800/70 hover:border-slate-600/50 transition-all cursor-pointer group"
            onClick={() => onCaseClick(caseItem)}
          >
            {/* Timeline dot */}
            <div className="flex-shrink-0 w-3 h-3 rounded-full bg-[#20c58f] ring-4 ring-slate-800 border-2 border-slate-700" />
            
            {/* Case content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-medium text-white text-sm truncate group-hover:text-[#20c58f] transition-colors">
                  {caseItem.title}
                </h3>
                <span
                  className="px-2 py-1 rounded-full text-xs font-medium border"
                  style={getStatusStyle(caseItem.status)}
                >
                  {caseItem.status}
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-slate-400 text-xs">
                <span className="flex items-center gap-1">
                  {getCaseTypeIcon(caseItem.case_type)}
                  {getCaseTypeName(caseItem.case_type)}
                </span>
                
                {caseItem.commission_amount && caseItem.commission_amount > 0 && (
                  <span className="flex items-center gap-1 text-green-400 font-medium">
                    <DollarSign className="w-3 h-3" />
                    {formatCurrency(caseItem.commission_amount)}
                  </span>
                )}
                
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {caseItem.completed_date ? formatDate(caseItem.completed_date) : 'Pågående'}
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

export default RecentCasesList;