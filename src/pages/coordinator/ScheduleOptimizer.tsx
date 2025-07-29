// 📁 src/pages/coordinator/ScheduleOptimizer.tsx
// ⭐ Schemaoptimerare för att minska körsträckor och optimera tekniker-scheman ⭐

import React, { useState, useEffect } from 'react';
import { CalendarDays, Users, MapPin, Clock, TrendingDown, ArrowRight, Settings, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Technician } from '../../types/database';
import { supabase } from '../../lib/supabase';
import DatePicker from 'react-datepicker';
import { registerLocale } from 'react-datepicker';
import sv from 'date-fns/locale/sv';
import "react-datepicker/dist/react-datepicker.css";

registerLocale('sv', sv);

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

  // Uppdatera valda tekniker när datum ändras
  useEffect(() => {
    if (allTechnicians.length > 0) {
      updateSelectedTechnicians(allTechnicians);
    }
  }, [startDate, endDate]);

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
    try {
      // Hämta frånvaro för den valda perioden
      const periodStartDate = startDate.toISOString().split('T')[0];
      const periodEndDate = endDate.toISOString().split('T')[0];
      
      const { data: absences, error: absenceError } = await supabase
        .from('technician_absences')
        .select('technician_id, start_date, end_date')
        .or(`start_date.lte.${periodEndDate},end_date.gte.${periodStartDate}`);
      
      if (absenceError) {
        console.error('Fel vid hämtning av frånvaro:', absenceError);
      }
      
      // Skapa set med tekniker som är frånvarande under perioden
      const absentTechnicianIds = new Set(
        (absences || []).map(a => a.technician_id)
      );
      
      // Välj bara "Skadedjurstekniker" som standard och som inte är frånvarande
      const technicianIds = new Set(
        technicians
          .filter(t => 
            t.role === 'Skadedjurstekniker' && 
            !absentTechnicianIds.has(t.id)
          )
          .map(t => t.id)
      );
      
      setSelectedTechnicianIds(technicianIds);
    } catch (err) {
      console.error('Fel vid uppdatering av valda tekniker:', err);
      
      // Fallback: välj bara Skadedjurstekniker utan frånvaro-kontroll
      const technicianIds = new Set(
        technicians
          .filter(t => t.role === 'Skadedjurstekniker')
          .map(t => t.id)
      );
      setSelectedTechnicianIds(technicianIds);
    }
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  const selectedTechnicians = allTechnicians.filter(t => selectedTechnicianIds.has(t.id));

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg">
              <TrendingDown className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Schemaoptimerare</h1>
              <p className="text-slate-400">
                Optimera schema för att minska körsträckor och maximera effektivitet
              </p>
            </div>
          </div>
        </header>

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
                    <div className="text-slate-400 text-sm">Tidsbesparingar</div>
                    <div className="text-2xl font-bold text-green-400">
                      {formatTime(results.savings.time_minutes)}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-800/50 rounded-lg">
                    <div className="text-slate-400 text-sm">Kilometrar</div>
                    <div className="text-2xl font-bold text-blue-400">
                      -{results.savings.distance_km.toFixed(1)} km
                    </div>
                  </div>
                </div>

                {/* Förändringar */}
                {results.suggested_changes.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-white mb-3">
                      Föreslagna förändringar ({results.suggested_changes.length})
                    </h3>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {results.suggested_changes.map((change, index) => (
                        <div key={index} className="p-3 bg-slate-800/50 rounded-lg">
                          <div className="font-medium text-white text-sm">
                            {change.case_title}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {change.reason}
                          </div>
                          {change.change_type === 'reassign_technician' && (
                            <div className="flex items-center gap-2 text-xs text-blue-300 mt-2">
                              <ArrowRight className="w-3 h-3" />
                              {change.from_technician} → {change.to_technician}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Verkställ-knapp */}
                <Button
                  variant="success"
                  className="w-full"
                  disabled={results.suggested_changes.length === 0}
                >
                  Verkställ optimering
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}