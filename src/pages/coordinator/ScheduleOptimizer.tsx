// 📁 src/pages/coordinator/ScheduleOptimizer.tsx
// ⭐ Schemaoptimerare för att minska körsträckor och optimera tekniker-scheman ⭐

import React, { useState, useEffect } from 'react';
import { CalendarDays, Users, MapPin, Clock, TrendingDown, ArrowRight, Settings, Zap, ChevronDown, ChevronUp, UserCheck, UserX, Home, Target, Route, Gauge, Navigation, Calendar, TrendingUp, Map, Activity, Compass } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Technician } from '../../types/database';
import { supabase } from '../../lib/supabase';
import DatePicker from 'react-datepicker';
import { registerLocale } from 'react-datepicker';
import sv from 'date-fns/locale/sv';
import "react-datepicker/dist/react-datepicker.css";
import { PageHeader } from '../../components/shared';

registerLocale('sv', sv);

// Små UI-komponenter för grafisk presentation
const TechnicianBadge: React.FC<{ name: string; variant: 'from' | 'to' }> = ({ name, variant }) => (
  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
    variant === 'from' 
      ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
      : 'bg-green-500/20 text-green-300 border border-green-500/30'
  }`}>
    {variant === 'from' ? <UserX className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
    {name.split(' ')[0]}
  </div>
);

const SavingsMeter: React.FC<{ 
  type: 'time' | 'distance'; 
  value: number; 
  icon: React.ComponentType<{ className?: string }>;
}> = ({ type, value, icon: Icon }) => {
  if (value <= 0) return null;
  
  const maxValue = type === 'time' ? 120 : 50; // Max 120min eller 50km för progress bar
  const percentage = Math.min((value / maxValue) * 100, 100);
  
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-3 h-3 ${type === 'time' ? 'text-green-400' : 'text-blue-400'}`} />
      <div className="flex items-center gap-1">
        <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${type === 'time' ? 'bg-green-400' : 'bg-blue-400'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${type === 'time' ? 'text-green-400' : 'text-blue-400'}`}>
          -{type === 'time' ? `${Math.round(value)}min` : `${value.toFixed(1)}km`}
        </span>
      </div>
    </div>
  );
};

// Distansjämförelse-komponent
const DistanceComparison: React.FC<{ 
  details: any;
}> = ({ details }) => {
  const { from_distance_km, to_distance_km, improvement_type } = details.distance_comparison;
  const improvement = from_distance_km - to_distance_km;
  
  if (improvement <= 0) return null;
  
  return (
    <div className="flex items-center gap-3 p-2 bg-slate-800/30 rounded-lg">
      <Route className="w-4 h-4 text-blue-400 flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Från:</span>
            <span className="text-red-400 font-medium">{from_distance_km.toFixed(1)}km</span>
          </div>
          <ArrowRight className="w-3 h-3 text-slate-500" />
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Till:</span>
            <span className="text-green-400 font-medium">{to_distance_km.toFixed(1)}km</span>
          </div>
        </div>
        <div className="text-xs text-blue-400 font-medium mt-1">
          -{improvement.toFixed(1)}km kortare resa
        </div>
      </div>
    </div>
  );
};

// Adress-översikt komponent
const AddressOverview: React.FC<{ 
  details: any;
}> = ({ details }) => {
  const { case_address, from_technician, to_technician } = details;
  
  return (
    <div className="space-y-2">
      {/* Ärendeadress */}
      <div className="flex items-center gap-2 text-xs">
        <Target className="w-3 h-3 text-orange-400" />
        <span className="text-slate-400">Ärende:</span>
        <span className="text-white font-medium">{case_address.short}</span>
      </div>
      
      {/* Teknikeradresser */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <Home className="w-3 h-3 text-red-400" />
          <div>
            <div className="text-red-400 font-medium">{from_technician.name}</div>
            <div className="text-slate-500 truncate">{from_technician.home_address_short}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Home className="w-3 h-3 text-green-400" />
          <div>
            <div className="text-green-400 font-medium">{to_technician.name}</div>
            <div className="text-slate-500 truncate">{to_technician.home_address_short}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Effektivitetsmätare
const EfficiencyGauge: React.FC<{ 
  efficiency_gain: number;
  travel_reduction_percent: number;
}> = ({ efficiency_gain, travel_reduction_percent }) => {
  const maxGain = Math.max(efficiency_gain, travel_reduction_percent, 20);
  const efficiencyPercentage = Math.min((efficiency_gain / maxGain) * 100, 100);
  const travelPercentage = Math.min((travel_reduction_percent / maxGain) * 100, 100);
  
  return (
    <div className="flex items-center gap-3">
      <Gauge className="w-4 h-4 text-purple-400" />
      <div className="flex-1 space-y-1">
        {efficiency_gain > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-400 rounded-full"
                style={{ width: `${efficiencyPercentage}%` }}
              />
            </div>
            <span className="text-xs text-purple-400 font-medium">
              +{efficiency_gain}% effektivitet
            </span>
          </div>
        )}
        {travel_reduction_percent > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-cyan-400 rounded-full"
                style={{ width: `${travelPercentage}%` }}
              />
            </div>
            <span className="text-xs text-cyan-400 font-medium">
              -{travel_reduction_percent}% restid
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// RouteContext - visar vad tekniker gör före/efter
const RouteContext: React.FC<{ 
  context: any;
}> = ({ context }) => {
  const { previous_case, next_case } = context;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
        <Navigation className="w-3 h-3" />
        <span>Rutt-kontext</span>
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {/* Föregående ärende */} 
        {previous_case && (
          <div className="flex items-center gap-2 text-xs p-2 bg-slate-800/40 rounded">
            <Calendar className="w-3 h-3 text-blue-400" />
            <div className="flex-1">
              <div className="text-white font-medium">Från föregående ärende</div>
              <div className="text-slate-400">{previous_case.address} • {previous_case.end_time}</div>
              <div className="text-blue-400">{previous_case.distance_to_current.toFixed(1)}km • {Math.round(previous_case.travel_time)}min resa</div>
            </div>
          </div>
        )}
        
        {/* Nästa ärende */}
        {next_case && (
          <div className="flex items-center gap-2 text-xs p-2 bg-slate-800/40 rounded">
            <Calendar className="w-3 h-3 text-green-400" />
            <div className="flex-1">
              <div className="text-white font-medium">Till nästa ärende</div>
              <div className="text-slate-400">{next_case.address} • {next_case.start_time}</div>
              <div className="text-green-400">{next_case.distance_from_current.toFixed(1)}km • {Math.round(next_case.travel_time)}min resa</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// GeographicInsight - visar geografiska fördelar
const GeographicInsight: React.FC<{ 
  context: any;
  explanation: any;
}> = ({ context, explanation }) => {
  const { geographic_advantage, daily_route_impact } = context;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
        <Map className="w-3 h-3" />
        <span>Geografiska fördelar</span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        {geographic_advantage.area_familiarity && (
          <div className="flex items-center gap-1 text-purple-400">
            <Map className="w-3 h-3" />
            <span>Känner området</span>
          </div>
        )}
        
        {geographic_advantage.local_proximity_bonus && (
          <div className="flex items-center gap-1 text-cyan-400">
            <Target className="w-3 h-3" />
            <span>Närhet-bonus</span>
          </div>
        )}
        
        {geographic_advantage.cluster_optimization && (
          <div className="flex items-center gap-1 text-yellow-400">
            <Route className="w-3 h-3" />
            <span>Kluster-optimering</span>
          </div>
        )}
        
        <div className="col-span-2 flex items-center gap-1 text-green-400">
          <TrendingUp className="w-3 h-3" />
          <span>+{daily_route_impact.route_efficiency_improvement}% rutt-effektivitet</span>
        </div>
      </div>
    </div>
  );
};

// ImpactExplanation - detaljerade förklaringar med ikoner
const ImpactExplanation: React.FC<{ 
  explanation: any;
}> = ({ explanation }) => {
  const getIconComponent = (iconName: string) => {
    const icons: { [key: string]: React.ComponentType<{ className?: string }> } = {
      'route': Route,
      'clock': Clock,
      'target': Target,
      'trending-up': TrendingUp,
      'map': Map
    };
    return icons[iconName] || Target;
  };
  
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-white mb-2">
        {explanation.primary_reason}
      </div>
      
      <div className="space-y-1">
        {explanation.detailed_explanations.map((exp: any, index: number) => {
          const IconComponent = getIconComponent(exp.icon);
          return (
            <div key={index} className="flex items-start gap-2 text-xs p-2 bg-slate-800/30 rounded">
              <IconComponent className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-white font-medium">{exp.text}</div>
                <div className="text-slate-400 text-xs">{exp.benefit}</div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="text-xs text-center p-2 bg-green-500/10 border border-green-500/20 rounded text-green-400 font-medium">
        {explanation.impact_summary}
      </div>
    </div>
  );
};

// RouteTimeline - visar tekniker schema före/efter med grafisk timeline
const RouteTimeline: React.FC<{ 
  change: any;
}> = ({ change }) => {
  if (!change.reason_details?.route_context) return null;
  
  const context = change.reason_details.route_context;
  const caseTime = new Date(change.case_start_time || '2024-01-01T12:00:00').getHours();
  
  return (
    <div className="bg-slate-800/30 rounded-lg p-3">
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
        <Activity className="w-3 h-3" />
        <span>Daglig rutt för {change.to_technician}</span>
      </div>
      
      <div className="space-y-2">
        {/* Föregående ärende */}
        {context.previous_case && (
          <div className="flex items-center gap-3 text-xs">
            <div className="w-12 text-right text-slate-500">{context.previous_case.end_time}</div>
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <div className="flex-1">
              <div className="text-blue-300 font-medium">Avslutar: {context.previous_case.address}</div>
              <div className="text-slate-400">{context.previous_case.distance_to_current.toFixed(1)}km till nästa</div>
            </div>
          </div>
        )}
        
        {/* Pil ned */}
        <div className="flex items-center gap-3 text-xs">
          <div className="w-12"></div>
          <ArrowRight className="w-3 h-3 text-green-400 rotate-90" />
          <div className="text-green-400">{Math.round(context.previous_case?.travel_time || 20)}min resa</div>
        </div>
        
        {/* Aktuellt ärende */}
        <div className="flex items-center gap-3 text-xs">
          <div className="w-12 text-right text-green-500 font-bold">{(caseTime).toString().padStart(2, '0')}:00</div>
          <div className="w-2 h-2 bg-green-400 rounded-full ring-2 ring-green-400/30"></div>
          <div className="flex-1">
            <div className="text-green-300 font-medium">Detta ärende: {change.case_title}</div>
            <div className="text-slate-400">Optimerad placering i schemat</div>
          </div>
        </div>
        
        {/* Nästa ärende */}
        {context.next_case && (
          <>
            <div className="flex items-center gap-3 text-xs">
              <div className="w-12"></div>
              <ArrowRight className="w-3 h-3 text-purple-400 rotate-90" />
              <div className="text-purple-400">{Math.round(context.next_case.travel_time)}min till nästa</div>
            </div>
            
            <div className="flex items-center gap-3 text-xs">
              <div className="w-12 text-right text-slate-500">{context.next_case.start_time}</div>
              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
              <div className="flex-1">
                <div className="text-purple-300 font-medium">Nästa: {context.next_case.address}</div>
                <div className="text-slate-400">{context.next_case.distance_from_current.toFixed(1)}km från detta ärende</div>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Sammanfattning */}
      <div className="mt-3 pt-2 border-t border-slate-700 text-center">
        <div className="text-xs text-green-400 font-medium">
          Sparar {Math.round(change.time_savings_minutes || 0)}min genom smart rutt-planering
        </div>
      </div>
    </div>
  );
};

// CompactRouteInfo - superkompakt info med bara ikoner och siffror
const CompactRouteInfo: React.FC<{ 
  change: any;
}> = ({ change }) => {
  // Simulera kontext-data för demonstration
  const mockContext = {
    previous_distance: Math.random() * 10 + 3, // 3-13km
    next_distance: Math.random() * 8 + 2, // 2-10km
    area_bonus: Math.random() > 0.6
  };
  
  return (
    <div className="flex items-center gap-4 text-xs">
      {/* Föregående ärende */}
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
        <ArrowRight className="w-3 h-3 text-slate-500" />
        <span className="text-blue-400 font-mono">{mockContext.previous_distance.toFixed(1)}km</span>
      </div>
      
      {/* Aktuellt ärende */}
      <div className="flex items-center gap-1">
        <Target className="w-3 h-3 text-green-400" />
        <span className="text-green-400 font-medium">Nu</span>
      </div>
      
      {/* Nästa ärende */}
      <div className="flex items-center gap-1">
        <ArrowRight className="w-3 h-3 text-slate-500" />
        <span className="text-purple-400 font-mono">{mockContext.next_distance.toFixed(1)}km</span>
        <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
      </div>
      
      {/* Områdesbonus */}
      {mockContext.area_bonus && (
        <div className="flex items-center gap-1 text-yellow-400">
          <Compass className="w-3 h-3" />
          <span className="text-xs">Lokalkännedom</span>
        </div>
      )}
    </div>
  );
};

// RouteVisualization - geografisk karta-visualisering
const RouteVisualization: React.FC<{ 
  change: any;
}> = ({ change }) => {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
        <Map className="w-3 h-3" />
        <span>Rutt-optimering</span>
      </div>
      
      {/* Enkel "karta" med positioner */}
      <div className="relative h-16 bg-slate-800 rounded border border-slate-600">
        {/* Hem */}
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <Home className="w-3 h-3 text-blue-400" />
          <span className="text-xs text-blue-400">Hem</span>
        </div>
        
        {/* Föregående ärende */}
        <div className="absolute top-2 left-1/3 flex items-center gap-1">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <span className="text-xs text-green-400">08:00</span>
        </div>
        
        {/* Aktuellt ärende */}
        <div className="absolute top-2 left-1/2 flex items-center gap-1">
          <Target className="w-3 h-3 text-yellow-400" />
          <span className="text-xs text-yellow-400 font-bold">Nu</span>
        </div>
        
        {/* Nästa ärende */}
        <div className="absolute top-2 right-1/4 flex items-center gap-1">
          <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
          <span className="text-xs text-purple-400">14:00</span>
        </div>
        
        {/* Rutt-linjer */}
        <svg className="absolute inset-0 w-full h-full">
          <path 
            d="M 20 20 Q 80 10 120 20 Q 160 15 200 20 Q 240 25 280 20" 
            stroke="#10b981" 
            strokeWidth="2" 
            fill="none"
            strokeDasharray="2,2"
          />
        </svg>
        
        {/* Besparingar */}
        <div className="absolute bottom-1 right-2 text-xs">
          <span className="text-green-400 font-medium">-{Math.round(change.time_savings_minutes || 0)}min</span>
          <span className="text-slate-500 mx-1">•</span>
          <span className="text-blue-400 font-medium">-{(change.distance_savings_km || 0).toFixed(1)}km</span>
        </div>
      </div>
    </div>
  );
};

// HomeCommuteInfo - visar hemresa-information för ärenden nära slutet av dagen
const HomeCommuteInfo: React.FC<{ 
  change: any;
}> = ({ change }) => {
  // Använd riktig hemresa-data från backend om tillgänglig
  const homeCommuteData = change.home_commute_info;
  
  if (!homeCommuteData || !homeCommuteData.is_near_end_of_day) {
    return null;
  }
  
  const timeSavedGettingHome = homeCommuteData.time_saved_getting_home_minutes || 0;
  const distanceSavedGettingHome = homeCommuteData.distance_saved_getting_home_km || 0;
  
  return (
    <div className="mt-2 pt-2 border-t border-slate-600">
      <div className="flex items-center gap-2 text-slate-300 mb-1">
        <Home className="w-3 h-3 text-orange-400" />
        <span className="font-medium">Hemresa-fördel:</span>
        <span className="text-xs text-slate-500">({homeCommuteData.minutes_until_work_ends}min kvar av arbetsdagen)</span>
      </div>
      
      <div className="space-y-1 text-slate-400">
        <div>• {change.to_technician} hem: <span className="text-green-400">{Math.round(homeCommuteData.to_technician.home_travel_time_minutes)}min, {homeCommuteData.to_technician.home_distance_km.toFixed(1)}km</span> → hemma {homeCommuteData.to_technician.estimated_home_arrival}</div>
        <div>• {change.from_technician} hem: <span className="text-red-400">{Math.round(homeCommuteData.from_technician.home_travel_time_minutes)}min, {homeCommuteData.from_technician.home_distance_km.toFixed(1)}km</span> → hemma {homeCommuteData.from_technician.estimated_home_arrival}</div>
      </div>
      
      {(timeSavedGettingHome > 5 || distanceSavedGettingHome > 2) && (
        <div className="mt-1 text-center">
          <span className="text-orange-400 font-medium text-xs">
            {change.to_technician} kommer hem {Math.round(timeSavedGettingHome)}min tidigare, {distanceSavedGettingHome.toFixed(1)}km kortare hemresa
          </span>
        </div>
      )}
    </div>
  );
};

// Hjälpfunktion för att beräkna uppskattad ankomsttid hem
function calculateEstimatedArrivalTime(currentHour: number, travelTimeMinutes: number): string {
  const assumedCaseDuration = 60; // Anta 60min för ärendet
  const totalMinutesFromNow = assumedCaseDuration + travelTimeMinutes;
  
  const arrivalTotalMinutes = (currentHour * 60) + totalMinutesFromNow;
  const arrivalHour = Math.floor(arrivalTotalMinutes / 60);
  const arrivalMinute = Math.round(arrivalTotalMinutes % 60);
  
  return `${arrivalHour.toString().padStart(2, '0')}:${arrivalMinute.toString().padStart(2, '0')}`;
}

// Typer
interface OptimizationRequest {
  period_type: 'day' | 'week';
  start_date: string;
  end_date: string;
  technician_ids: string[];
  optimization_type: 'minimize_travel' | 'maximize_time';
}

interface OptimizationResult {
  current_stats: {
    total_travel_time: number;
    total_distance_km: number;
    utilization_rate: number;
  };
  optimized_stats: {
    total_travel_time: number;
    total_distance_km: number;
    utilization_rate: number;
  };
  savings: {
    time_minutes: number;
    distance_km: number;
    efficiency_gain: number;
  };
  suggested_changes: Array<{
    case_id: string;
    case_title: string;
    change_type: 'reassign_technician' | 'reschedule_time' | 'move_day';
    from_technician?: string;
    to_technician?: string;
    from_time?: string;
    to_time?: string;
    reason: string;
    reason_details?: {
      case_address: {
        full: string;
        short: string;
      };
      from_technician: {
        name: string;
        home_address: string;
        home_address_short: string;
      };
      to_technician: {
        name: string;
        home_address: string;
        home_address_short: string;
      };
      distance_comparison: {
        improvement_type: 'distance' | 'time';
        from_distance_km: number;
        to_distance_km: number;
        savings_km: number;
        savings_minutes: number;
      };
      schedule_impact: {
        efficiency_gain: number;
        travel_reduction_percent: number;
      };
      route_context: {
        previous_case?: {
          title: string;
          address: string;
          end_time: string;
          distance_to_current: number;
          travel_time: number;
        };
        next_case?: {
          title: string;
          address: string;
          start_time: string;
          distance_from_current: number;
          travel_time: number;
        };
        daily_route_impact: {
          total_cases_today: number;
          estimated_driving_time_reduction: number;
          route_efficiency_improvement: number;
        };
        geographic_advantage: {
          area_familiarity: boolean;
          local_proximity_bonus: boolean;
          cluster_optimization: boolean;
        };
      };
      explanation: {
        text: string;
        primary_reason: string;
        detailed_explanations: Array<{
          type: string;
          icon: string;
          text: string;
          benefit: string;
        }>;
        impact_summary: string;
      };
    };
    time_savings_minutes?: number;
    distance_savings_km?: number;
  }>;
  technician_details?: Array<{
    technician_id: string;
    technician_name: string;
    current_travel_time: number;
    optimized_travel_time: number;
    current_distance_km: number;
    optimized_distance_km: number;
    time_savings_minutes: number;
    distance_savings_km: number;
    case_count: number;
    home_address: string;
  }>;
}

export default function ScheduleOptimizer() {
  // State för formulär
  const [periodType, setPeriodType] = useState<'day' | 'week'>('day');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [optimizationType, setOptimizationType] = useState<'minimize_travel' | 'maximize_time'>('minimize_travel');
  
  // State för tekniker
  const [allTechnicians, setAllTechnicians] = useState<Technician[]>([]);
  const [selectedTechnicianIds, setSelectedTechnicianIds] = useState<Set<string>>(new Set());
  const [showTechnicianFilter, setShowTechnicianFilter] = useState(false);
  
  // State för optimering
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // State för selektiv godkännande
  const [selectedChanges, setSelectedChanges] = useState<Set<number>>(new Set());
  const [showTechnicianDetails, setShowTechnicianDetails] = useState(false);

  // Hämta tekniker vid laddning
  useEffect(() => {
    fetchTechnicians();
  }, []);

  // Uppdatera slutdatum när startdatum eller periodtyp ändras
  useEffect(() => {
    if (periodType === 'day') {
      setEndDate(startDate);
    } else {
      const weekEnd = new Date(startDate);
      weekEnd.setDate(weekEnd.getDate() + 6);
      setEndDate(weekEnd);
    }
  }, [startDate, periodType]);

  // Uppdatera valda tekniker när datum eller tekniker ändras
  useEffect(() => {
    console.log('[Tech Selection] Date or technicians changed, updating selection');
    console.log('[Tech Selection] Current state:', {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      technicianCount: allTechnicians.length
    });
    
    if (allTechnicians.length > 0) {
      updateSelectedTechnicians(allTechnicians);
    }
  }, [startDate, endDate, allTechnicians]);

  const fetchTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .eq('is_active', true)
        .in('role', ['Skadedjurstekniker', 'Admin', 'Koordinator'])
        .order('name');
      
      if (error) throw error;
      
      setAllTechnicians(data || []);
      updateSelectedTechnicians(data || []);
    } catch (err) {
      console.error('Fel vid hämtning av tekniker:', err);
    }
  };

  const updateSelectedTechnicians = async (technicians: Technician[]) => {
    console.log(`[Tech Selection] === Updating for period ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} ===`);
    console.log(`[Tech Selection] Processing ${technicians.length} technicians`);
    
    // Rensa gamla val först för att undvika konflikter
    setSelectedTechnicianIds(new Set());
    
    try {
      // Hämta frånvaro för den valda perioden
      const periodStartDate = startDate.toISOString().split('T')[0];
      const periodEndDate = endDate.toISOString().split('T')[0];
      
      console.log(`[Tech Selection] Fetching absences for period: ${periodStartDate} to ${periodEndDate}`);
      console.log(`[Tech Selection] Using correct interval overlap logic: end_date >= '${periodStartDate}' AND start_date <= '${periodEndDate}'`);
      
      const { data: absences, error: absenceError } = await supabase
        .from('technician_absences')
        .select('technician_id, start_date, end_date')
        .gte('end_date', periodStartDate)
        .lte('start_date', periodEndDate);
      
      if (absenceError) {
        console.error('[Tech Selection] Error fetching absences:', absenceError);
      }
      
      console.log(`[Tech Selection] Found ${absences?.length || 0} absence records`);
      
      // Skapa set med tekniker som är frånvarande under perioden
      const absentTechnicianIds = new Set(
        (absences || []).map(a => a.technician_id)
      );
      
      console.log('[Tech Selection] Absent technician IDs:', Array.from(absentTechnicianIds));
      
      // Analysera varje tekniker
      technicians.forEach(t => {
        if (t.role === 'Skadedjurstekniker') {
          const isAbsent = absentTechnicianIds.has(t.id);
          console.log(`[Tech Selection] ${t.name}: ${isAbsent ? 'ABSENT' : 'AVAILABLE'}`);
        }
      });
      
      // Välj bara "Skadedjurstekniker" som standard och som inte är frånvarande
      const technicianIds = new Set(
        technicians
          .filter(t => 
            t.role === 'Skadedjurstekniker' && 
            !absentTechnicianIds.has(t.id)
          )
          .map(t => t.id)
      );
      
      console.log(`[Tech Selection] Selected ${technicianIds.size} technicians out of ${technicians.filter(t => t.role === 'Skadedjurstekniker').length} Skadedjurstekniker`);
      console.log('[Tech Selection] Selected technician names:', 
        technicians.filter(t => technicianIds.has(t.id)).map(t => t.name)
      );
      
      setSelectedTechnicianIds(technicianIds);
      
    } catch (err) {
      console.error('[Tech Selection] Error in updateSelectedTechnicians:', err);
      
      // Fallback: välj bara Skadedjurstekniker utan frånvaro-kontroll
      const fallbackIds = new Set(
        technicians
          .filter(t => t.role === 'Skadedjurstekniker')
          .map(t => t.id)
      );
      
      console.log('[Tech Selection] Using fallback selection (no absence filtering)');
      console.log('[Tech Selection] Fallback selected technicians:', 
        technicians.filter(t => fallbackIds.has(t.id)).map(t => t.name)
      );
      setSelectedTechnicianIds(fallbackIds);
    }
    
    console.log('[Tech Selection] === End update ===');
  };

  const toggleTechnician = (technicianId: string) => {
    const newSelected = new Set(selectedTechnicianIds);
    if (newSelected.has(technicianId)) {
      newSelected.delete(technicianId);
    } else {
      newSelected.add(technicianId);
    }
    setSelectedTechnicianIds(newSelected);
  };

  const handleOptimize = async () => {
    if (selectedTechnicianIds.size === 0) {
      setError('Du måste välja minst en tekniker.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResults(null);

    try {
      const request: OptimizationRequest = {
        period_type: periodType,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        technician_ids: Array.from(selectedTechnicianIds),
        optimization_type: optimizationType
      };

      const response = await fetch('/api/schedule-optimizer/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Något gick fel vid optimering');
      }

      const data = await response.json();
      setResults(data);
      // Reset selektiva val när nya resultat kommer
      setSelectedChanges(new Set());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleChangeSelection = (index: number) => {
    const newSelected = new Set(selectedChanges);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedChanges(newSelected);
  };

  const selectAllChanges = () => {
    if (!results) return;
    const allIndices = new Set(results.suggested_changes.map((_, index) => index));
    setSelectedChanges(allIndices);
  };

  const clearAllChanges = () => {
    setSelectedChanges(new Set());
  };

  const handleApproveSelected = async () => {
    if (!results || selectedChanges.size === 0) return;
    
    const selectedChangesList = Array.from(selectedChanges).map(index => results.suggested_changes[index]);
    
    // Beräkna totala besparingar för valda ändringar
    const totalTimeSavings = selectedChangesList.reduce((sum, change) => 
      sum + (change.time_savings_minutes || 0), 0
    );
    const totalDistanceSavings = selectedChangesList.reduce((sum, change) => 
      sum + (change.distance_savings_km || 0), 0
    );
    
    console.log('Godkänner följande förändringar:', selectedChangesList);
    console.log(`Totala besparingar: ${formatTime(totalTimeSavings)}, ${totalDistanceSavings.toFixed(1)}km`);
    
    // TODO: Implementera faktisk uppdatering av ärendena
    alert(`${selectedChanges.size} förändringar kommer att verkställas\nBesparingar: ${formatTime(totalTimeSavings)}, ${totalDistanceSavings.toFixed(1)}km`);
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${Math.round(minutes)}min`;
  };

  const selectedTechnicians = allTechnicians.filter(t => selectedTechnicianIds.has(t.id));

  // Beräkna dynamiska besparingar baserat på valda ändringar
  const getDisplayedSavings = () => {
    if (!results) return { time_minutes: 0, distance_km: 0 };
    
    if (selectedChanges.size === 0) {
      // Visa totala möjliga besparingar om inga ändringar är valda
      return results.savings;
    }
    
    // Beräkna besparingar för valda ändringar
    const selectedChangesList = Array.from(selectedChanges).map(index => results.suggested_changes[index]);
    const totalTimeSavings = selectedChangesList.reduce((sum, change) => 
      sum + (change.time_savings_minutes || 0), 0
    );
    const totalDistanceSavings = selectedChangesList.reduce((sum, change) => 
      sum + (change.distance_savings_km || 0), 0
    );
    
    return {
      time_minutes: totalTimeSavings,
      distance_km: totalDistanceSavings
    };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 text-white">

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Inställningar */}
          <Card className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <Settings className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-bold text-white">Optimeringsinställningar</h2>
            </div>

            {/* Period-typ */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Optimeringsperiod
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPeriodType('day')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    periodType === 'day'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <CalendarDays className="w-5 h-5 mx-auto mb-2" />
                  <div className="text-sm font-medium">Dag</div>
                </button>
                <button
                  onClick={() => setPeriodType('week')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    periodType === 'week'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <Clock className="w-5 h-5 mx-auto mb-2" />
                  <div className="text-sm font-medium">Vecka</div>
                </button>
              </div>
            </div>

            {/* Datumväljare */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                {periodType === 'day' ? 'Välj dag' : 'Välj startdag för vecka'}
              </label>
              <DatePicker
                selected={startDate}
                onChange={(date) => date && setStartDate(date)}
                locale="sv"
                dateFormat="yyyy-MM-dd"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholderText="Välj datum..."
              />
              {periodType === 'week' && (
                <p className="text-xs text-slate-500 mt-2">
                  Vecka: {startDate.toLocaleDateString('sv-SE')} - {endDate.toLocaleDateString('sv-SE')}
                </p>
              )}
            </div>

            {/* Optimeringstyp */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Optimeringsmål
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="optimization_type"
                    value="minimize_travel"
                    checked={optimizationType === 'minimize_travel'}
                    onChange={(e) => setOptimizationType(e.target.value as 'minimize_travel')}
                    className="w-4 h-4 text-blue-500 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-white font-medium">Minimera körsträckor</div>
                    <div className="text-xs text-slate-500">Fokusera på att minska total restid</div>
                  </div>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="optimization_type"
                    value="maximize_time"
                    checked={optimizationType === 'maximize_time'}
                    onChange={(e) => setOptimizationType(e.target.value as 'maximize_time')}
                    className="w-4 h-4 text-blue-500 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-white font-medium">Maximera tillgänglig tid</div>
                    <div className="text-xs text-slate-500">Skapa mer ledig tid för teknikerna</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Tekniker-val */}
            <div>
              <button
                onClick={() => setShowTechnicianFilter(!showTechnicianFilter)}
                className="flex items-center justify-between w-full text-sm font-medium text-slate-300 mb-3"
              >
                <span>Tekniker att optimera ({selectedTechnicianIds.size} valda)</span>
                {showTechnicianFilter ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              
              {showTechnicianFilter && (
                <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-800/50 p-3 rounded-lg">
                  {allTechnicians.map(technician => (
                    <label key={technician.id} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTechnicianIds.has(technician.id)}
                        onChange={() => toggleTechnician(technician.id)}
                        className="w-4 h-4 text-blue-500 focus:ring-blue-500 rounded border-slate-600 bg-slate-700"
                      />
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4 text-slate-500" />
                          <span className="text-white">{technician.name}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            technician.role === 'Skadedjurstekniker' 
                              ? 'bg-green-500/20 text-green-300' 
                              : 'bg-slate-700 text-slate-400'
                          }`}>
                            {technician.role}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              
              {selectedTechnicians.length > 0 && !showTechnicianFilter && (
                <div className="flex flex-wrap gap-2">
                  {selectedTechnicians.slice(0, 3).map(tech => (
                    <span key={tech.id} className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                      {tech.name.split(' ')[0]}
                    </span>
                  ))}
                  {selectedTechnicians.length > 3 && (
                    <span className="px-2 py-1 bg-slate-700 text-slate-400 rounded text-xs">
                      +{selectedTechnicians.length - 3} till
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Optimera-knapp */}
            <Button
              onClick={handleOptimize}
              disabled={isAnalyzing || selectedTechnicianIds.size === 0}
              className="w-full flex items-center justify-center gap-2"
              loading={isAnalyzing}
            >
              {isAnalyzing ? (
                <>Analyserar schema...</>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Optimera schema
                </>
              )}
            </Button>
          </Card>

          {/* Resultat */}
          <Card className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingDown className="w-6 h-6 text-green-400" />
              <h2 className="text-xl font-bold text-white">Optimeringsresultat</h2>
            </div>

            {error && (
              <div className="p-4 bg-red-500/20 border border-red-500/40 rounded-lg">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {!results && !error && !isAnalyzing && (
              <div className="text-center py-12">
                <TrendingDown className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-300 mb-2">
                  Redo att optimera
                </h3>
                <p className="text-slate-500">
                  Välj inställningar och klicka på "Optimera schema" för att få förslag på förbättringar.
                </p>
              </div>
            )}

            {results && (
              <div className="space-y-6">
                {/* Översikt */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <div className="text-slate-400 text-sm">
                      Tidsbesparingar
                      {selectedChanges.size > 0 && (
                        <span className="text-xs ml-1">({selectedChanges.size} valda)</span>
                      )}
                    </div>
                    <div className="text-2xl font-bold text-green-400">
                      {formatTime(getDisplayedSavings().time_minutes)}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <div className="text-slate-400 text-sm">
                      Kilometrar
                      {selectedChanges.size > 0 && (
                        <span className="text-xs ml-1">({selectedChanges.size} valda)</span>
                      )}
                    </div>
                    <div className="text-2xl font-bold text-blue-400">
                      -{getDisplayedSavings().distance_km.toFixed(1)} km
                    </div>
                  </div>
                </div>

                {/* Tekniker-detaljer */}
                {results.technician_details && results.technician_details.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowTechnicianDetails(!showTechnicianDetails)}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <h3 className="font-semibold text-white">
                        Per tekniker-analys ({results.technician_details.length} tekniker)
                      </h3>
                      {showTechnicianDetails ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    
                    {showTechnicianDetails && (
                      <div className="mt-3 space-y-3 max-h-64 overflow-y-auto">
                        {results.technician_details.map((tech, index) => (
                          <div key={tech.technician_id} className="p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-white">{tech.technician_name}</h4>
                              <span className="text-xs text-slate-500">{tech.case_count} ärenden</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <div className="text-slate-400">Restid</div>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-300">{formatTime(tech.current_travel_time)}</span>
                                  <ArrowRight className="w-3 h-3 text-slate-500" />
                                  <span className="text-green-400">{formatTime(tech.optimized_travel_time)}</span>
                                </div>
                                {tech.time_savings_minutes > 0 && (
                                  <div className="text-green-400">-{formatTime(tech.time_savings_minutes)}</div>
                                )}
                              </div>
                              
                              <div>
                                <div className="text-slate-400">Körsträcka</div>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-300">{tech.current_distance_km.toFixed(1)}km</span>
                                  <ArrowRight className="w-3 h-3 text-slate-500" />
                                  <span className="text-blue-400">{tech.optimized_distance_km.toFixed(1)}km</span>
                                </div>
                                {tech.distance_savings_km > 0 && (
                                  <div className="text-blue-400">-{tech.distance_savings_km.toFixed(1)}km</div>
                                )}
                              </div>
                            </div>
                            
                            <div className="mt-2 text-xs text-slate-500">
                              <MapPin className="w-3 h-3 inline mr-1" />
                              Hemadress: {tech.home_address}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Förändringar med selektiv godkännande */}
                {results.suggested_changes.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-white">
                        Föreslagna förändringar ({results.suggested_changes.length})
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={selectAllChanges}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Välj alla
                        </button>
                        <button
                          onClick={clearAllChanges}
                          className="text-xs text-slate-400 hover:text-slate-300"
                        >
                          Rensa alla
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {results.suggested_changes.map((change, index) => (
                        <div key={index} className={`p-4 rounded-lg border transition-all hover:shadow-lg ${
                          selectedChanges.has(index)
                            ? 'bg-blue-500/20 border-blue-500/40 shadow-blue-500/20'
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                        }`}>
                          <label className="flex items-start gap-4 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedChanges.has(index)}
                              onChange={() => toggleChangeSelection(index)}
                              className="w-4 h-4 mt-1 text-blue-500 focus:ring-blue-500 rounded border-slate-600 bg-slate-700"
                            />
                            
                            <div className="flex-1 space-y-3">
                              {/* Huvudrubrik och ikon */}
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 p-2 bg-purple-500/20 rounded-lg">
                                  <Users className="w-5 h-5 text-purple-400" />
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium text-white text-sm">
                                    {change.case_title}
                                  </div>
                                  {/* Kort beskrivning med specifik information */}
                                  <div className="text-xs text-slate-400 mt-1">
                                    {change.change_type === 'reassign_technician' ? 
                                      `${change.to_technician} har kortare restid - sparar ${Math.round(change.time_savings_minutes || 0)}min och ${(change.distance_savings_km || 0).toFixed(1)}km` : 
                                      change.reason
                                    }
                                  </div>
                                </div>
                              </div>
                              
                              {/* Tekniker-byte visualisering */}
                              {change.change_type === 'reassign_technician' && (
                                <div className="flex items-center gap-2 pl-11">
                                  <TechnicianBadge name={change.from_technician || ''} variant="from" />
                                  <ArrowRight className="w-3 h-3 text-slate-500" />
                                  <TechnicianBadge name={change.to_technician || ''} variant="to" />
                                </div>
                              )}
                              
                              {/* En enkel, tydlig förklaring med hemresa-info */}
                              <div className="pl-11">
                                <div className="bg-slate-800/40 rounded-lg p-3 text-xs">
                                  <div className="flex items-center gap-2 text-slate-300 mb-2">
                                    <Route className="w-3 h-3 text-blue-400" />
                                    <span className="font-medium">Varför detta är smart:</span>
                                  </div>
                                  
                                  <div className="space-y-1 text-slate-400">
                                    {/* Visa verklig rutt-kontext från backend */}
                                    {change.reason_details?.route_context?.previous_case ? (
                                      <>
                                        <div>• {change.to_technician} avslutar föregående ärende på <span className="text-blue-300">{change.reason_details.route_context.previous_case.address}</span></div>
                                        <div>• Bara <span className="text-green-400 font-medium">{change.reason_details.route_context.previous_case.distance_to_current.toFixed(1)}km resa</span> till detta ärende</div>
                                      </>
                                    ) : (
                                      <>
                                        <div>• {change.to_technician} startar från <span className="text-blue-300">hemmet</span></div>
                                        <div>• <span className="text-green-400 font-medium">{change.reason_details?.distance_comparison?.to_distance_km?.toFixed(1) || '?'}km resa</span> från hemmet till detta ärende</div>
                                      </>
                                    )}
                                    
                                    {/* Visa jämförelse med nuvarande tekniker */}
                                    {change.reason_details?.distance_comparison && (
                                      <div>• {change.from_technician} skulle behöva köra <span className="text-red-400">{change.reason_details.distance_comparison.from_distance_km.toFixed(1)}km</span> från sin position</div>
                                    )}
                                  </div>
                                  
                                  {/* Hemresa-information för ärenden nära slutet av dagen */}
                                  <HomeCommuteInfo change={change} />
                                  
                                  <div className="mt-2 pt-2 border-t border-slate-700 text-center">
                                    <span className="text-green-400 font-medium">
                                      Sparar {Math.round(change.time_savings_minutes || 0)}min restid och {(change.distance_savings_km || 0).toFixed(1)}km körning
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Traditionella besparings-meters som backup */}
                              {!change.reason_details && (change.time_savings_minutes || change.distance_savings_km) && (
                                <div className="flex gap-4 pl-11">
                                  {change.time_savings_minutes && change.time_savings_minutes > 0 && (
                                    <SavingsMeter 
                                      type="time" 
                                      value={change.time_savings_minutes} 
                                      icon={Clock} 
                                    />
                                  )}
                                  {change.distance_savings_km && change.distance_savings_km > 0 && (
                                    <SavingsMeter 
                                      type="distance" 
                                      value={change.distance_savings_km} 
                                      icon={MapPin} 
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 text-xs text-slate-500">
                      {selectedChanges.size > 0 
                        ? `${selectedChanges.size} av ${results.suggested_changes.length} förändringar valda`
                        : 'Ingen förändring vald'
                      }
                    </div>
                  </div>
                )}

                {/* Verkställ-knappar */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleApproveSelected}
                    variant="success"
                    className="flex-1"
                    disabled={selectedChanges.size === 0}
                  >
                    Verkställ valda ({selectedChanges.size})
                  </Button>
                  <Button
                    onClick={() => {
                      selectAllChanges();
                      setTimeout(handleApproveSelected, 100);
                    }}
                    variant="default"
                    className="flex-1"
                    disabled={results.suggested_changes.length === 0}
                  >
                    Verkställ alla
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
    </div>
  );
}