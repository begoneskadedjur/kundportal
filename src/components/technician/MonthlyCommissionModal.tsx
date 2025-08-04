import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, DollarSign, FileText, Clock, TrendingUp } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import LoadingSpinner from '../shared/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getStatusColor } from '../../types/database';

interface Case {
  id: string;
  title: string;
  status: string;
  case_type: 'private' | 'business';
  commission_amount: number;
  completed_date: string;
  clickup_task_id: string;
}

interface MonthlyCommissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: {
    month: string;
    month_display: string;
    total_commission: number;
    case_count: number;
    avg_commission_per_case: number;
  } | null;
  technicianId: string;
  onCaseClick?: (caseItem: Case) => void;
}

const MonthlyCommissionModal: React.FC<MonthlyCommissionModalProps> = ({
  isOpen,
  onClose,
  month,
  technicianId,
  onCaseClick
}) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && month && technicianId) {
      fetchMonthlyCases();
    }
  }, [isOpen, month, technicianId]);

  const fetchMonthlyCases = async () => {
    if (!month || !technicianId) return;

    try {
      setLoading(true);
      setError(null);
      
      // Call API to get cases for specific month with commission
      const response = await fetch(`/api/technician/monthly-cases?technician_id=${technicianId}&month=${month.month}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch monthly cases: ${response.status}`);
      }
      
      const data = await response.json();
      setCases(data.cases || []);
    } catch (error) {
      console.error('Error fetching monthly cases:', error);
      setError(error instanceof Error ? error.message : 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          <Card className="p-0">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Calendar className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {month?.month_display} - Provision
                  </h2>
                  <p className="text-sm text-slate-400">
                    {month?.case_count} ärenden med provision
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Stäng
              </Button>
            </div>

            {/* Stats */}
            {month && (
              <div className="p-6 border-b border-slate-700 bg-slate-800/30">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <DollarSign className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Total Provision</p>
                      <p className="font-semibold text-white">
                        {formatCurrency(month.total_commission)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <FileText className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Antal Ärenden</p>
                      <p className="font-semibold text-white">{month.case_count}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Snitt per Ärende</p>
                      <p className="font-semibold text-white">
                        {formatCurrency(month.avg_commission_per_case)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="p-6 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <div className="text-red-400 mb-2">❌ {error}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchMonthlyCases}
                  >
                    Försök igen
                  </Button>
                </div>
              ) : cases.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-slate-400">Inga ärenden med provision hittades för denna månad</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cases.map((caseItem, index) => (
                    <motion.div
                      key={caseItem.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.01 }}
                      className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:bg-slate-800/70 hover:border-slate-600/50 transition-all cursor-pointer group"
                      onClick={() => onCaseClick?.(caseItem)}
                    >
                      {/* Timeline style dot */}
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
                          
                          <span className="flex items-center gap-1 text-green-400 font-medium">
                            <DollarSign className="w-3 h-3" />
                            {formatCurrency(caseItem.commission_amount)}
                          </span>
                          
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(caseItem.completed_date)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default MonthlyCommissionModal;