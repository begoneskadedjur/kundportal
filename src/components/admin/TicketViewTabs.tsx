// src/components/admin/TicketViewTabs.tsx
// Tabs för att filtrera tickets baserat på riktning (incoming/outgoing/all)

import { CircleDot, ArrowUpRight, Inbox } from 'lucide-react';

export type TicketDirection = 'incoming' | 'outgoing' | 'all';

interface TicketViewTabsProps {
  activeTab: TicketDirection;
  counts: {
    incoming: number;
    outgoing: number;
    all: number;
  };
  onTabChange: (tab: TicketDirection) => void;
}

const TABS = [
  {
    id: 'incoming' as const,
    label: 'Behöver åtgärd',
    shortLabel: 'Åtgärd',
    icon: CircleDot,
    activeColor: 'text-amber-400 border-amber-400',
    inactiveColor: 'text-slate-400 border-transparent hover:text-slate-300',
    bgActive: 'bg-amber-500/10',
    countBg: 'bg-amber-500/20 text-amber-400',
  },
  {
    id: 'outgoing' as const,
    label: 'Väntar på svar',
    shortLabel: 'Väntar',
    icon: ArrowUpRight,
    activeColor: 'text-slate-300 border-slate-400',
    inactiveColor: 'text-slate-500 border-transparent hover:text-slate-400',
    bgActive: 'bg-slate-700/30',
    countBg: 'bg-slate-600/30 text-slate-400',
  },
  {
    id: 'all' as const,
    label: 'Alla',
    shortLabel: 'Alla',
    icon: Inbox,
    activeColor: 'text-purple-400 border-purple-400',
    inactiveColor: 'text-slate-500 border-transparent hover:text-slate-400',
    bgActive: 'bg-purple-500/10',
    countBg: 'bg-purple-500/20 text-purple-400',
  },
];

export function TicketViewTabs({ activeTab, counts, onTabChange }: TicketViewTabsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 mb-6">
      {/* Desktop: Horizontal tabs */}
      <div className="hidden sm:flex border-b border-slate-700/50 w-full">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const count = tab.id === 'incoming' ? counts.incoming
                      : tab.id === 'outgoing' ? counts.outgoing
                      : counts.all;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 border-b-2 transition-all duration-200
                ${isActive
                  ? `${tab.activeColor} ${tab.bgActive} font-medium`
                  : tab.inactiveColor
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`
                px-2 py-0.5 rounded-full text-xs font-medium
                ${isActive ? tab.countBg : 'bg-slate-700/50 text-slate-500'}
              `}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mobile: Stacked buttons or horizontal scroll */}
      <div className="sm:hidden flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const count = tab.id === 'incoming' ? counts.incoming
                      : tab.id === 'outgoing' ? counts.outgoing
                      : counts.all;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200
                whitespace-nowrap flex-shrink-0
                ${isActive
                  ? `${tab.activeColor} ${tab.bgActive} font-medium border border-current/30`
                  : `${tab.inactiveColor} bg-slate-800/30 border border-slate-700/50`
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.shortLabel}</span>
              <span className={`
                px-1.5 py-0.5 rounded-full text-xs font-medium
                ${isActive ? tab.countBg : 'bg-slate-700/50 text-slate-500'}
              `}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
