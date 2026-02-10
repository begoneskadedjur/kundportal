import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Command } from 'cmdk';
import { useHotkeys } from 'react-hotkeys-hook';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  FileText, 
  DollarSign, 
  Users, 
  Settings,
  BarChart3,
  Calendar,
  UserCheck,
  Wallet,
  Target
} from 'lucide-react';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href?: string;
  action?: () => void;
  keywords: string[];
  category: 'navigation' | 'create' | 'manage';
}

interface QuickActionBarProps {
  className?: string;
}

const QuickActionBar: React.FC<QuickActionBarProps> = ({ className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  // Keyboard shortcuts
  useHotkeys('cmd+k, ctrl+k', () => setIsOpen(true), { preventDefault: true });
  useHotkeys('escape', () => setIsOpen(false), { preventDefault: true });

  const quickActions: QuickAction[] = [
    {
      id: 'customers',
      title: 'Hantera Kunder',
      description: 'Visa och hantera avtalskunder',
      icon: Users,
      href: '/admin/customers',
      keywords: ['kunder', 'customers', 'avtal'],
      category: 'navigation'
    },
    {
      id: 'technicians',
      title: 'Tekniker Statistik',
      description: 'Prestanda och ranking',
      icon: BarChart3,
      href: '/admin/technicians',
      keywords: ['tekniker', 'statistik', 'prestanda'],
      category: 'navigation'
    },
    {
      id: 'economics',
      title: 'Ekonomisk Översikt',
      description: 'Intäktsanalys och KPI',
      icon: DollarSign,
      href: '/admin/economics',
      keywords: ['ekonomi', 'intäkt', 'kpi', 'finans'],
      category: 'navigation'
    },
    {
      id: 'invoicing',
      title: 'Fakturering',
      description: 'Komplett faktureringssystem',
      icon: FileText,
      href: '/admin/invoicing',
      keywords: ['faktura', 'billing', 'ärenden', 'invoicing'],
      category: 'navigation'
    },
    {
      id: 'billing-legacy',
      title: 'Fakturering (Legacy)',
      description: 'BeGone-ärenden fakturering',
      icon: FileText,
      href: '/admin/billing',
      keywords: ['faktura', 'billing', 'ärenden', 'legacy'],
      category: 'navigation'
    },
    {
      id: 'contracts',
      title: 'Skapa Kontrakt',
      description: 'Oneflow-avtal för signering',
      icon: FileText,
      href: '/admin/oneflow-contract-creator',
      keywords: ['kontrakt', 'oneflow', 'avtal', 'skapa'],
      category: 'create'
    },
    {
      id: 'technician-management',
      title: 'Hantera Tekniker',
      description: 'Lägg till och redigera personal',
      icon: UserCheck,
      href: '/admin/technician-management',
      keywords: ['tekniker', 'personal', 'hantera', 'redigera'],
      category: 'manage'
    },
    {
      id: 'commissions',
      title: 'Provisioner',
      description: 'Beräkna tekniker-provision',
      icon: Wallet,
      href: '/admin/commissions',
      keywords: ['provision', 'lön', 'tekniker'],
      category: 'navigation'
    },
    {
      id: 'sales-opportunities',
      title: 'Försäljningsmöjligheter',
      description: 'Potentiella avtalskunder',
      icon: Target,
      href: '/admin/sales-opportunities',
      keywords: ['försäljning', 'möjligheter', 'potentiella'],
      category: 'navigation'
    }
  ];

  const handleAction = (action: QuickAction) => {
    if (action.href) {
      navigate(action.href);
    } else if (action.action) {
      action.action();
    }
    setIsOpen(false);
  };

  const categoryIcons = {
    navigation: BarChart3,
    create: Plus,
    manage: Settings
  };

  const categoryColors = {
    navigation: 'text-blue-400',
    create: 'text-green-400',
    manage: 'text-yellow-400'
  };

  return (
    <>
      {/* Quick Action Bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className={`bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl p-4 mb-8 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/admin/oneflow-contract-creator')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Skapa Kontrakt
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/admin/economics')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
            >
              <DollarSign className="w-4 h-4" />
              Ekonomi
            </motion.button>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Sök...</span>
            <div className="text-xs text-slate-500 ml-2">⌘K</div>
          </motion.button>
        </div>
      </motion.div>

      {/* Command Palette Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <Command className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
                <div className="flex items-center px-4 py-3 border-b border-slate-800">
                  <Search className="w-5 h-5 text-slate-400 mr-3" />
                  <Command.Input
                    placeholder="Sök funktioner och sidor..."
                    className="flex-1 bg-transparent text-white placeholder-slate-400 outline-none"
                    autoFocus
                  />
                </div>
                
                <Command.List className="max-h-96 overflow-y-auto">
                  <Command.Empty className="py-8 text-center text-slate-400">
                    Inga resultat hittades.
                  </Command.Empty>
                  
                  {Object.entries(
                    quickActions.reduce((acc, action) => {
                      if (!acc[action.category]) acc[action.category] = [];
                      acc[action.category].push(action);
                      return acc;
                    }, {} as Record<string, QuickAction[]>)
                  ).map(([category, actions]) => {
                    const CategoryIcon = categoryIcons[category as keyof typeof categoryIcons];
                    const categoryColor = categoryColors[category as keyof typeof categoryColors];
                    
                    return (
                      <Command.Group key={category} heading={
                        <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          <CategoryIcon className={`w-3 h-3 ${categoryColor}`} />
                          {category === 'navigation' ? 'Navigering' : 
                           category === 'create' ? 'Skapa' : 'Hantera'}
                        </div>
                      }>
                        {actions.map((action) => {
                          const ActionIcon = action.icon;
                          return (
                            <Command.Item
                              key={action.id}
                              value={`${action.title} ${action.description} ${action.keywords.join(' ')}`}
                              onSelect={() => handleAction(action)}
                              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800 transition-colors"
                            >
                              <ActionIcon className="w-5 h-5 text-slate-400" />
                              <div className="flex-1">
                                <div className="text-white font-medium">{action.title}</div>
                                <div className="text-sm text-slate-400">{action.description}</div>
                              </div>
                            </Command.Item>
                          );
                        })}
                      </Command.Group>
                    );
                  })}
                </Command.List>
              </Command>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default QuickActionBar;