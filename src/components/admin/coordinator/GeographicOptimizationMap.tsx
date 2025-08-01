// 📁 src/components/admin/coordinator/GeographicOptimizationMap.tsx
// 🗺️ Geografisk optimering med rutt-analys och visualisering

import React, { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, 
  Route, 
  Navigation, 
  TrendingUp,
  TrendingDown,
  Clock,
  Fuel,
  RefreshCw,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Info,
  Eye,
  EyeOff,
  Calendar,
  Users
} from 'lucide-react';
import { CoordinatorKpiData } from '../../../services/coordinatorAnalyticsService';
import { supabase } from '../../../lib/supabase';
import { useGoogleMaps } from '../../../hooks/useGoogleMaps';
import toast from 'react-hot-toast';

interface GeographicOptimizationMapProps {
  data: CoordinatorKpiData | null;
  loading: boolean;
}

interface TechnicianLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cases: number;
  status: 'active' | 'inactive' | 'break';
  vehicle_id?: string;
  current_address?: string;
  last_updated?: string;
}

interface CaseLocation {
  id: string;
  address: string;
  lat: number;
  lng: number;
  technician_id: string;
  scheduled_time: string;
  status: string;
}

interface RouteOptimizationData {
  technician_id: string;
  technician_name: string;
  date: string;
  total_cases: number;
  total_distance_km: number;
  avg_distance_per_case: number;
  optimization_score: number;
  estimated_fuel_cost: number;
  estimated_time_saved: number;
  route_efficiency: 'excellent' | 'good' | 'average' | 'poor';
}

// Mock data för demonstration - i verkligheten skulle detta komma från coordinatorAnalyticsService
const mockRouteData: RouteOptimizationData[] = [
  {
    technician_id: '1',
    technician_name: 'Mathias Karlsson',
    date: '2024-01-15',
    total_cases: 6,
    total_distance_km: 45.2,
    avg_distance_per_case: 7.5,
    optimization_score: 85,
    estimated_fuel_cost: 68,
    estimated_time_saved: 25,
    route_efficiency: 'excellent',
  },
  {
    technician_id: '2',
    technician_name: 'Jakob Lindström',
    date: '2024-01-15',
    total_cases: 5,
    total_distance_km: 52.8,
    avg_distance_per_case: 10.6,
    optimization_score: 72,
    estimated_fuel_cost: 79,
    estimated_time_saved: 12,
    route_efficiency: 'good',
  },
  {
    technician_id: '3',
    technician_name: 'Anna Svensson',
    date: '2024-01-15',
    total_cases: 4,
    total_distance_km: 38.4,
    avg_distance_per_case: 9.6,
    optimization_score: 78,
    estimated_fuel_cost: 58,
    estimated_time_saved: 18,
    route_efficiency: 'good',
  },
  {
    technician_id: '4',
    technician_name: 'Erik Pettersson',
    date: '2024-01-15',
    total_cases: 7,
    total_distance_km: 73.1,
    avg_distance_per_case: 10.4,
    optimization_score: 65,
    estimated_fuel_cost: 110,
    estimated_time_saved: 8,
    route_efficiency: 'average',
  },
];

const EfficiencyBadge: React.FC<{ efficiency: 'excellent' | 'good' | 'average' | 'poor' }> = ({ efficiency }) => {
  const config = {
    excellent: { color: 'bg-green-500/20 text-green-400 border-green-500/40', text: 'Utmärkt' },
    good: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/40', text: 'Bra' },
    average: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', text: 'Medel' },
    poor: { color: 'bg-red-500/20 text-red-400 border-red-500/40', text: 'Dålig' },
  };

  const { color, text } = config[efficiency];

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${color}`}>
      {text}
    </span>
  );
};

const OptimizationScore: React.FC<{ score: number; size?: 'sm' | 'md' | 'lg' }> = ({ score, size = 'md' }) => {
  const getColor = () => {
    if (score >= 80) return 'text-green-400';
    if (score >= 70) return 'text-blue-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  return (
    <span className={`font-bold ${getColor()} ${sizeClasses[size]}`}>
      {score}%
    </span>
  );
};

const RouteOptimizationTable: React.FC<{ 
  data: RouteOptimizationData[];
  onTechnicianSelect: (technicianId: string) => void;
  selectedTechnician?: string;
}> = ({ data, onTechnicianSelect, selectedTechnician }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 px-4 text-slate-400 font-medium">Tekniker</th>
            <th className="text-center py-3 px-4 text-slate-400 font-medium">Ärenden</th>
            <th className="text-center py-3 px-4 text-slate-400 font-medium">Total sträcka</th>
            <th className="text-center py-3 px-4 text-slate-400 font-medium">Snitt/ärende</th>
            <th className="text-center py-3 px-4 text-slate-400 font-medium">Optimering</th>
            <th className="text-center py-3 px-4 text-slate-400 font-medium">Effektivitet</th>
            <th className="text-center py-3 px-4 text-slate-400 font-medium">Bränsle</th>
          </tr>
        </thead>
        <tbody>
          {data.map((route) => (
            <tr 
              key={route.technician_id}
              className={`border-b border-slate-800 hover:bg-slate-800/30 transition-colors cursor-pointer ${
                selectedTechnician === route.technician_id ? 'bg-slate-800/50' : ''
              }`}
              onClick={() => onTechnicianSelect(route.technician_id)}
            >
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-white font-medium">{route.technician_name}</span>
                </div>
              </td>
              <td className="text-center py-3 px-4 text-slate-300">
                {route.total_cases}
              </td>
              <td className="text-center py-3 px-4 text-slate-300">
                {route.total_distance_km.toFixed(1)} km
              </td>
              <td className="text-center py-3 px-4 text-slate-300">
                {route.avg_distance_per_case.toFixed(1)} km
              </td>
              <td className="text-center py-3 px-4">
                <OptimizationScore score={route.optimization_score} size="sm" />
              </td>
              <td className="text-center py-3 px-4">
                <EfficiencyBadge efficiency={route.route_efficiency} />
              </td>
              <td className="text-center py-3 px-4 text-slate-300">
                {route.estimated_fuel_cost} kr
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const OptimizationInsights: React.FC<{ data: RouteOptimizationData[] }> = ({ data }) => {
  const stats = React.useMemo(() => {
    const totalDistance = data.reduce((sum, r) => sum + r.total_distance_km, 0);
    const totalCases = data.reduce((sum, r) => sum + r.total_cases, 0);
    const totalFuelCost = data.reduce((sum, r) => sum + r.estimated_fuel_cost, 0);
    const totalTimeSaved = data.reduce((sum, r) => sum + r.estimated_time_saved, 0);
    const avgOptimization = data.reduce((sum, r) => sum + r.optimization_score, 0) / data.length;

    const excellentRoutes = data.filter(r => r.route_efficiency === 'excellent').length;
    const poorRoutes = data.filter(r => r.route_efficiency === 'poor').length;

    return {
      totalDistance,
      totalCases,
      avgDistancePerCase: totalDistance / totalCases,
      totalFuelCost,
      totalTimeSaved,
      avgOptimization,
      excellentRoutes,
      poorRoutes,
    };
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center mb-2">
            <Route className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-lg font-bold text-white">{stats.totalDistance.toFixed(0)} km</p>
          <p className="text-xs text-slate-400">Total körsträcka</p>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center mb-2">
            <Navigation className="w-4 h-4 text-green-400" />
          </div>
          <p className="text-lg font-bold text-white">{stats.avgDistancePerCase.toFixed(1)} km</p>
          <p className="text-xs text-slate-400">Snitt per ärende</p>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center mb-2">
            <Fuel className="w-4 h-4 text-orange-400" />
          </div>
          <p className="text-lg font-bold text-white">{stats.totalFuelCost.toFixed(0)} kr</p>
          <p className="text-xs text-slate-400">Bränslekostnad</p>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center mb-2">
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-lg font-bold text-white">{stats.totalTimeSaved} min</p>
          <p className="text-xs text-slate-400">Tid sparad</p>
        </div>
      </div>

      {/* Insights */}
      <div className="space-y-3">
        {stats.avgOptimization >= 80 && (
          <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="text-sm font-medium text-green-300">Utmärkt rutt-optimering</h5>
              <p className="text-xs text-slate-400">
                Genomsnittlig optimering på {stats.avgOptimization.toFixed(0)}% visar effektiv schemaläggning
              </p>
            </div>
          </div>
        )}

        {stats.poorRoutes > 0 && (
          <div className="flex items-start gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="text-sm font-medium text-orange-300">Förbättringsmöjligheter</h5>
              <p className="text-xs text-slate-400">
                {stats.poorRoutes} tekniker har ineffektiva rutter som kan optimeras
              </p>
            </div>
          </div>
        )}

        {stats.avgDistancePerCase > 12 && (
          <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="text-sm font-medium text-blue-300">Geografisk spridning</h5>
              <p className="text-xs text-slate-400">
                Hög genomsnittlig sträcka ({stats.avgDistancePerCase.toFixed(1)} km) - överväg regional uppdelning
              </p>
            </div>
          </div>
        )}

        {stats.totalTimeSaved > 60 && (
          <div className="flex items-start gap-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <TrendingUp className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="text-sm font-medium text-purple-300">Betydande tidsbesparingar</h5>
              <p className="text-xs text-slate-400">
                {stats.totalTimeSaved} minuter sparad tid per dag genom smart schemaläggning
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const GeographicOptimizationMap: React.FC<GeographicOptimizationMapProps> = ({ data, loading }) => {
  const [selectedTechnician, setSelectedTechnician] = useState<string>();
  const [showInsights, setShowInsights] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');
  const [technicianLocations, setTechnicianLocations] = useState<TechnicianLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [selectedMapTechnician, setSelectedMapTechnician] = useState<TechnicianLocation | null>(null);

  // Google Maps hook
  const { isLoaded: mapsLoaded, isLoading: mapsLoading, error: mapsError } = useGoogleMaps({
    libraries: ['geometry', 'places']
  });

  // I verkligheten skulle detta komma från data prop
  const routeData = mockRouteData;

  // Hämta tekniker-positioner från Supabase
  const fetchTechnicianLocations = useCallback(async () => {
    setLoadingLocations(true);
    try {
      // Hämta aktiva tekniker med fordons-ID
      const { data: technicians, error: techError } = await supabase
        .from('technicians')
        .select('id, name, abax_vehicle_id, is_active')
        .eq('is_active', true)
        .eq('role', 'Skadedjurstekniker')
        .not('abax_vehicle_id', 'is', null);

      if (techError) {
        console.error('Fel vid hämtning av tekniker:', techError);
        toast.error('Kunde inte hämta tekniker-data');
        return;
      }

      if (!technicians || technicians.length === 0) {
        console.warn('Inga aktiva tekniker med fordons-ID hittades');
        setTechnicianLocations([]);
        return;
      }

      // Hämta dagens ärenden för varje tekniker
      const today = new Date().toISOString().split('T')[0];
      const locations: TechnicianLocation[] = [];

      for (const tech of technicians) {
        // Räkna dagens ärenden
        const { data: privateCases } = await supabase
          .from('private_cases')
          .select('id')
          .eq('primary_assignee_id', tech.id)
          .gte('start_date', today + ' 00:00:00')
          .lte('start_date', today + ' 23:59:59');
          
        const { data: businessCases } = await supabase
          .from('business_cases')
          .select('id')
          .eq('primary_assignee_id', tech.id)
          .gte('start_date', today + ' 00:00:00')
          .lte('start_date', today + ' 23:59:59');

        const totalCases = (privateCases?.length || 0) + (businessCases?.length || 0);

        // För demo: använd fasta koordinater för Stockholm-området
        // I verkligheten skulle vi hämta från ABAX API eller cached positioner
        const demoPositions = [
          { lat: 59.3293, lng: 18.0686 }, // Stockholm centrum
          { lat: 59.3345, lng: 18.0632 }, // Östermalm
          { lat: 59.3242, lng: 18.0511 }, // Södermalm
          { lat: 59.3406, lng: 18.0921 }, // Vasastan
          { lat: 59.3165, lng: 18.0765 }, // Gamla stan
        ];
        
        const randomPos = demoPositions[Math.floor(Math.random() * demoPositions.length)];
        
        locations.push({
          id: tech.id,
          name: tech.name,
          lat: randomPos.lat + (Math.random() - 0.5) * 0.02, // Lägg till lite variation
          lng: randomPos.lng + (Math.random() - 0.5) * 0.02,
          cases: totalCases,
          status: totalCases > 0 ? 'active' : 'inactive',
          vehicle_id: tech.abax_vehicle_id,
          current_address: 'Stockholm, Sverige',
          last_updated: new Date().toISOString(),
        });
      }

      setTechnicianLocations(locations);
      
    } catch (error) {
      console.error('Error fetching technician locations:', error);
      toast.error('Fel vid hämtning av tekniker-positioner');
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  // Hämta positioner när komponenten laddas
  useEffect(() => {
    if (viewMode === 'map') {
      fetchTechnicianLocations();
    }
  }, [viewMode, fetchTechnicianLocations]);

  if (loading) {
    return (
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <MapPin className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Geografisk optimering</h3>
            <p className="text-sm text-slate-400">Rutt-effektivitet och regionala insikter</p>
          </div>
        </div>
        
        <div className="h-96 bg-slate-900/50 rounded-lg animate-pulse flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-slate-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <MapPin className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Geografisk optimering</h3>
            <p className="text-sm text-slate-400">Rutt-effektivitet och optimeringsanalys</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInsights(!showInsights)}
            className="flex items-center gap-2 px-3 py-1 text-sm text-slate-400 hover:text-white transition-colors"
          >
            {showInsights ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showInsights ? 'Dölj insights' : 'Visa insights'}
          </button>

          <div className="flex bg-slate-700/50 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-sm font-medium rounded transition-all ${
                viewMode === 'table'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1 text-sm font-medium rounded transition-all ${
                viewMode === 'map'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <MapPin className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary från data prop */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="text-center p-4 bg-slate-900/50 rounded-lg">
            <p className="text-2xl font-bold text-white">
              {data.geographic_optimization.avg_distance_between_cases_km.toFixed(1)} km
            </p>
            <p className="text-sm text-slate-400">Genomsnitt mellan ärenden</p>
          </div>
          <div className="text-center p-4 bg-slate-900/50 rounded-lg">
            <p className="text-2xl font-bold text-white">
              {data.geographic_optimization.routing_efficiency_score}%
            </p>
            <p className="text-sm text-slate-400">Rutt-effektivitetsindex</p>
          </div>
          <div className="text-center p-4 bg-slate-900/50 rounded-lg">
            <p className="text-2xl font-bold text-white">
              {data.geographic_optimization.cases_with_optimal_routing}
            </p>
            <p className="text-sm text-slate-400">Optimalt rutterade ärenden</p>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="space-y-6">
        {viewMode === 'table' ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-white">Rutt-optimering per tekniker</h4>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Calendar className="w-3 h-3" />
                Idag ({new Date().toLocaleDateString('sv-SE')})
              </div>
            </div>
            
            <div className="bg-slate-900/30 rounded-lg p-4">
              <RouteOptimizationTable 
                data={routeData}
                onTechnicianSelect={setSelectedTechnician}
                selectedTechnician={selectedTechnician}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Map Container */}
            <div className="h-96 bg-slate-900/50 rounded-lg overflow-hidden border border-slate-700">
              {mapsError ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <h4 className="text-lg font-medium text-red-300 mb-2">Google Maps fel</h4>
                    <p className="text-sm text-slate-400">{mapsError}</p>
                  </div>
                </div>
              ) : mapsLoading || !mapsLoaded ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-400">Laddar Google Maps...</p>
                  </div>
                </div>
              ) : (
                <GoogleMapComponent 
                  technicians={technicianLocations}
                  loading={loadingLocations}
                  onTechnicianSelect={setSelectedMapTechnician}
                  selectedTechnician={selectedMapTechnician}
                />
              )}
            </div>

            {/* Map Legend */}
            <div className="flex items-center justify-between bg-slate-900/30 rounded-lg p-3">
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-slate-400">Aktiv tekniker</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                  <span className="text-slate-400">Inaktiv tekniker</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-slate-400">Paus</span>
                </div>
              </div>
              <button
                onClick={fetchTechnicianLocations}
                disabled={loadingLocations}
                className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${loadingLocations ? 'animate-spin' : ''}`} />
                Uppdatera positioner
              </button>
            </div>
          </div>
        )}

        {/* Insights Panel */}
        {showInsights && (
          <div>
            <h4 className="font-medium text-white mb-4">Optimerings-insikter</h4>
            <OptimizationInsights data={routeData} />
          </div>
        )}
      </div>

      {/* Selected Technician Details */}
      {selectedTechnician && (
        <div className="mt-6 p-4 bg-slate-900/30 rounded-lg border-l-4 border-blue-500">
          {(() => {
            const tech = routeData.find(r => r.technician_id === selectedTechnician);
            if (!tech) return null;
            
            return (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium text-white">{tech.technician_name} - Rutt-detaljer</h5>
                  <button
                    onClick={() => setSelectedTechnician(undefined)}
                    className="text-slate-400 hover:text-white"
                  >
                    ×
                  </button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">Optimering</p>
                    <p className="text-white font-medium">
                      <OptimizationScore score={tech.optimization_score} size="sm" />
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Bränslekostnad</p>
                    <p className="text-white font-medium">{tech.estimated_fuel_cost} kr</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Tid sparad</p>
                    <p className="text-white font-medium">{tech.estimated_time_saved} min</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Effektivitet</p>
                    <EfficiencyBadge efficiency={tech.route_efficiency} />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

// Google Maps komponent
const GoogleMapComponent: React.FC<{
  technicians: TechnicianLocation[];
  loading: boolean;
  onTechnicianSelect: (technician: TechnicianLocation | null) => void;
  selectedTechnician: TechnicianLocation | null;
}> = ({ technicians, loading, onTechnicianSelect, selectedTechnician }) => {
  const mapRef = useCallback((map: google.maps.Map | null) => {
    if (map && technicians.length > 0) {
      // Centrera kartan runt tekniker-positionerna
      const bounds = new google.maps.LatLngBounds();
      technicians.forEach(tech => {
        bounds.extend(new google.maps.LatLng(tech.lat, tech.lng));
      });
      map.fitBounds(bounds);
    }
  }, [technicians]);

  const mapOptions: google.maps.MapOptions = {
    center: { lat: 59.3293, lng: 18.0686 }, // Stockholm centrum
    zoom: 12,
    styles: [
      {
        "featureType": "all",
        "elementType": "geometry.fill",
        "stylers": [{ "color": "#1e293b" }]
      },
      {
        "featureType": "all",
        "elementType": "labels.text.fill",
        "stylers": [{ "color": "#94a3b8" }]
      },
      {
        "featureType": "water",
        "elementType": "geometry",
        "stylers": [{ "color": "#0f172a" }]
      },
      {
        "featureType": "road",
        "elementType": "geometry",
        "stylers": [{ "color": "#334155" }]
      }
    ],
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: true,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: true
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-800">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Hämtar tekniker-positioner...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      <div 
        id="google-map" 
        className="h-full w-full"
        ref={(divRef) => {
          if (divRef && window.google && window.google.maps) {
            const map = new google.maps.Map(divRef, mapOptions);
            
            // Lägg till markers för varje tekniker
            technicians.forEach(tech => {
              const marker = new google.maps.Marker({
                position: { lat: tech.lat, lng: tech.lng },
                map,
                title: tech.name,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: tech.cases > 0 ? 12 : 8,
                  fillColor: tech.status === 'active' ? '#22c55e' : 
                            tech.status === 'break' ? '#f97316' : '#6b7280',
                  fillOpacity: 0.8,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                },
                zIndex: tech.cases > 0 ? 1000 : 100
              });

              // Info window för varje tekniker
              const infoWindow = new google.maps.InfoWindow({
                content: `
                  <div style="color: #000; padding: 8px; min-width: 200px;">
                    <h3 style="margin: 0 0 8px 0; font-weight: bold;">${tech.name}</h3>
                    <div style="font-size: 12px; line-height: 1.4;">
                      <p style="margin: 4px 0;"><strong>Status:</strong> ${
                        tech.status === 'active' ? 'Aktiv' : 
                        tech.status === 'break' ? 'Paus' : 'Inaktiv'
                      }</p>
                      <p style="margin: 4px 0;"><strong>Ärenden idag:</strong> ${tech.cases}</p>
                      <p style="margin: 4px 0;"><strong>Plats:</strong> ${tech.current_address || 'Okänd'}</p>
                      <p style="margin: 4px 0;"><strong>Uppdaterad:</strong> ${
                        tech.last_updated ? new Date(tech.last_updated).toLocaleTimeString('sv-SE') : 'Okänd'
                      }</p>
                    </div>
                  </div>
                `
              });

              marker.addListener('click', () => {
                // Stäng andra info windows
                technicians.forEach(() => infoWindow.close());
                
                // Öppna denna info window
                infoWindow.open(map, marker);
                
                // Notifiera parent component
                onTechnicianSelect(tech);
              });
            });

            // Använd callback för att centrera kartan
            mapRef(map);
          }
        }}
      />
      
      {/* Tekniker-räknare overlay */}
      <div className="absolute top-4 left-4 bg-slate-800/90 rounded-lg px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          <span className="text-white font-medium">{technicians.length}</span>
          <span className="text-slate-400">tekniker</span>
        </div>
      </div>

      {/* Aktiva ärenden overlay */}
      <div className="absolute top-4 right-4 bg-slate-800/90 rounded-lg px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-green-400" />
          <span className="text-white font-medium">{technicians.reduce((sum, t) => sum + t.cases, 0)}</span>
          <span className="text-slate-400">ärenden idag</span>
        </div>
      </div>
    </div>
  );
};

export default GeographicOptimizationMap;