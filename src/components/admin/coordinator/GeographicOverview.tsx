// 📁 src/components/admin/coordinator/GeographicOverview.tsx
// ⭐ Geografisk översikt med Google Maps för koordinatordashboard ⭐

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Users, Clock, Route, Loader2 } from 'lucide-react';
import Card from '../../ui/Card';
import { BeGoneCaseRow, Technician } from '../../../types/database';
import { supabase } from '../../../lib/supabase';
import { geocodeAddress } from '../../../services/geocoding';
import { getDistanceMatrix } from '../../../services/distanceMatrix';
import { useGoogleMaps } from '../../../hooks/useGoogleMaps';

interface GeographicOverviewProps {
  className?: string;
}

interface CaseWithLocation extends BeGoneCaseRow {
  coordinates?: {
    lat: number;
    lng: number;
  };
  formatted_address?: string;
}

interface TechnicianWithLocation extends Technician {
  coordinates?: {
    lat: number;
    lng: number;
  };
  todaysCases?: CaseWithLocation[];
}

interface CaseCluster {
  id: string;
  cases: CaseWithLocation[];
  center: { lat: number; lng: number };
  area: string;
  totalTravelTime?: number;
}

const GeographicOverview: React.FC<GeographicOverviewProps> = ({ className = '' }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [todaysCases, setTodaysCases] = useState<CaseWithLocation[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianWithLocation[]>([]);
  const [clusters, setClusters] = useState<CaseCluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<CaseCluster | null>(null);

  // Ladda Google Maps API
  const { isLoaded: mapsLoaded, isLoading: mapsLoading, error: mapsError } = useGoogleMaps({
    libraries: ['geometry']
  });

  // Hämta dagens ärenden och tekniker
  useEffect(() => {
    fetchTodaysData();
  }, []);

  // Initialisera Google Maps när data är redo
  useEffect(() => {
    if (todaysCases.length > 0 && !googleMapRef.current && mapsLoaded) {
      initializeMap();
    }
  }, [todaysCases, mapsLoaded]);

  // Uppdatera kluster när ärenden ändras
  useEffect(() => {
    if (todaysCases.length > 0) {
      generateClusters();
    }
  }, [todaysCases]);

  const fetchTodaysData = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = new Date();
      const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      // Hämta dagens ärenden
      const [privateCases, businessCases, techniciansData] = await Promise.all([
        supabase
          .from('private_cases')
          .select('*')
          .gte('start_date', todayStart)
          .lte('start_date', todayEnd)
          .not('adress', 'is', null),
        
        supabase
          .from('business_cases')
          .select('*')
          .gte('start_date', todayStart)
          .lte('start_date', todayEnd)
          .not('adress', 'is', null),
        
        supabase
          .from('technicians')
          .select('*')
          .eq('is_active', true)
          .not('address', 'is', null)
      ]);

      if (privateCases.error) throw privateCases.error;
      if (businessCases.error) throw businessCases.error;
      if (techniciansData.error) throw techniciansData.error;

      // Kombinera ärenden
      const allCases = [
        ...(privateCases.data || []).map(c => ({ ...c, case_type: 'private' as const })),
        ...(businessCases.data || []).map(c => ({ ...c, case_type: 'business' as const }))
      ] as BeGoneCaseRow[];

      // Geocoda adresser
      const casesWithLocations = await geocodeCases(allCases);
      const techniciansWithLocations = await geocodeTechnicians(techniciansData.data || []);

      setTodaysCases(casesWithLocations);
      setTechnicians(techniciansWithLocations);

    } catch (err: any) {
      console.error('Fel vid hämtning av geografisk data:', err);
      setError('Kunde inte ladda geografisk data');
    } finally {
      setLoading(false);
    }
  };

  const geocodeCases = async (cases: BeGoneCaseRow[]): Promise<CaseWithLocation[]> => {
    const casesWithLocations: CaseWithLocation[] = [];

    for (const caseData of cases) {
      let address = '';
      
      // Extrahera adress från olika format
      if (typeof caseData.adress === 'string') {
        try {
          const parsed = JSON.parse(caseData.adress);
          address = parsed.formatted_address || caseData.adress;
        } catch {
          address = caseData.adress;
        }
      } else if (caseData.adress?.formatted_address) {
        address = caseData.adress.formatted_address;
      }

      if (!address) continue;

      // Geocoda om inte redan geocodad
      if (caseData.adress?.location?.lat && caseData.adress?.location?.lng) {
        casesWithLocations.push({
          ...caseData,
          coordinates: {
            lat: caseData.adress.location.lat,
            lng: caseData.adress.location.lng
          },
          formatted_address: address
        });
      } else {
        const geocodeResult = await geocodeAddress(address);
        if (geocodeResult.success) {
          casesWithLocations.push({
            ...caseData,
            coordinates: {
              lat: geocodeResult.result.location.lat,
              lng: geocodeResult.result.location.lng
            },
            formatted_address: geocodeResult.result.formatted_address
          });
        }
      }
    }

    return casesWithLocations;
  };

  const geocodeTechnicians = async (techs: Technician[]): Promise<TechnicianWithLocation[]> => {
    const techniciansWithLocations: TechnicianWithLocation[] = [];

    for (const tech of techs) {
      if (!tech.address) continue;

      const geocodeResult = await geocodeAddress(tech.address);
      if (geocodeResult.success) {
        // Hitta teknikerns dagens ärenden
        const techCases = todaysCases.filter(c => 
          c.primary_assignee_id === tech.id ||
          c.secondary_assignee_id === tech.id ||
          c.tertiary_assignee_id === tech.id
        );

        techniciansWithLocations.push({
          ...tech,
          coordinates: {
            lat: geocodeResult.result.location.lat,
            lng: geocodeResult.result.location.lng
          },
          todaysCases: techCases
        });
      }
    }

    return techniciansWithLocations;
  };

  const generateClusters = () => {
    const CLUSTER_RADIUS_KM = 5; // Kluster ärenden inom 5km
    const clusters: CaseCluster[] = [];
    const processed = new Set<string>();

    todaysCases.forEach(caseData => {
      if (!caseData.coordinates || processed.has(caseData.id)) return;

      const clusterCases = [caseData];
      processed.add(caseData.id);

      // Hitta närliggande ärenden
      todaysCases.forEach(otherCase => {
        if (otherCase.id === caseData.id || 
            !otherCase.coordinates || 
            processed.has(otherCase.id)) return;

        const distance = calculateDistance(
          caseData.coordinates!,
          otherCase.coordinates!
        );

        if (distance <= CLUSTER_RADIUS_KM) {
          clusterCases.push(otherCase);
          processed.add(otherCase.id);
        }
      });

      // Beräkna kluster-center
      const center = calculateClusterCenter(clusterCases);
      const area = getAreaName(center);

      clusters.push({
        id: `cluster-${clusters.length}`,
        cases: clusterCases,
        center,
        area
      });
    });

    setClusters(clusters);
  };

  const calculateDistance = (coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): number => {
    const R = 6371; // Jorden radie i km
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const calculateClusterCenter = (cases: CaseWithLocation[]): { lat: number; lng: number } => {
    const totalLat = cases.reduce((sum, c) => sum + (c.coordinates?.lat || 0), 0);
    const totalLng = cases.reduce((sum, c) => sum + (c.coordinates?.lng || 0), 0);
    return {
      lat: totalLat / cases.length,
      lng: totalLng / cases.length
    };
  };

  const getAreaName = (coordinates: { lat: number; lng: number }): string => {
    // Enkel approximation av svenska områden baserat på koordinater
    // Detta kan förbättras med reverse geocoding
    if (coordinates.lat > 59.4 && coordinates.lng > 17.8) return 'Stockholm';
    if (coordinates.lat > 57.6 && coordinates.lng > 11.8) return 'Göteborg';
    if (coordinates.lat > 55.5 && coordinates.lng > 12.9) return 'Malmö';
    return 'Övriga Sverige';
  };

  const initializeMap = () => {
    if (!mapRef.current || !window.google) return;

    const map = new google.maps.Map(mapRef.current, {
      zoom: 10,
      center: { lat: 59.3293, lng: 18.0686 }, // Stockholm centrum
      styles: [
        // Dark mode styling för karta
        { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] }
      ]
    });

    googleMapRef.current = map;

    // Lägg till markers för ärenden och tekniker
    addMarkersToMap(map);
  };

  const addMarkersToMap = (map: google.maps.Map) => {
    // Lägg till markers för kluster
    clusters.forEach(cluster => {
      const marker = new google.maps.Marker({
        position: cluster.center,
        map: map,
        title: `${cluster.area}: ${cluster.cases.length} ärenden`,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
              <circle cx="15" cy="15" r="12" fill="#3b82f6" stroke="#1e40af" stroke-width="2"/>
              <text x="15" y="19" text-anchor="middle" fill="white" font-size="12" font-weight="bold">
                ${cluster.cases.length}
              </text>
            </svg>
          `),
          scaledSize: new google.maps.Size(30, 30)
        }
      });

      marker.addListener('click', () => {
        setSelectedCluster(cluster);
      });
    });

    // Lägg till markers för tekniker
    technicians.forEach(tech => {
      if (!tech.coordinates) return;

      new google.maps.Marker({
        position: tech.coordinates,
        map: map,
        title: `${tech.name} (${tech.todaysCases?.length || 0} ärenden)`,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="25" height="25" viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12.5" cy="12.5" r="10" fill="#10b981" stroke="#047857" stroke-width="2"/>
              <path d="M8 12.5l3 3 6-6" stroke="white" stroke-width="2" fill="none"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(25, 25)
        }
      });
    });
  };

  if (loading) {
    return (
      <Card className={className}>
        <div className="p-6 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-400" />
          <p className="text-slate-400">Laddar geografisk översikt...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <div className="p-6 text-center text-red-400">
          <MapPin className="w-8 h-8 mx-auto mb-4" />
          <p>{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg">
              <MapPin className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Geografisk Översikt</h3>
              <p className="text-slate-400">Dagens ärenden och tekniker på karta</p>
            </div>
          </div>

          {/* Statistik */}
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{clusters.length}</div>
              <div className="text-slate-400">Områden</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{technicians.length}</div>
              <div className="text-slate-400">Tekniker</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">{todaysCases.length}</div>
              <div className="text-slate-400">Ärenden</div>
            </div>
          </div>
        </div>

        {/* Karta */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div 
              ref={mapRef}
              className="w-full h-96 bg-slate-800 rounded-lg border border-slate-700"
            >
              {(mapsLoading || !mapsLoaded) && (
                <div className="h-full flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <MapPin className="w-12 h-12 mx-auto mb-4" />
                    <p>
                      {mapsLoading ? 'Google Maps laddas...' : 
                       mapsError ? `Fel: ${mapsError}` : 
                       'Väntar på kartan...'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Kluster-lista */}
          <div className="space-y-3">
            <h4 className="font-medium text-slate-300">Områdeskluster</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {clusters.map(cluster => (
                <div
                  key={cluster.id}
                  onClick={() => setSelectedCluster(cluster)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedCluster?.id === cluster.id
                      ? 'bg-blue-500/20 border-blue-500/40'
                      : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{cluster.area}</div>
                      <div className="text-sm text-slate-400">
                        {cluster.cases.length} ärenden
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Users className="w-4 h-4" />
                      <span>
                        {new Set(
                          cluster.cases.flatMap(c => [
                            c.primary_assignee_name,
                            c.secondary_assignee_name,
                            c.tertiary_assignee_name
                          ].filter(Boolean))
                        ).size} tekniker
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Valt kluster detaljer */}
        {selectedCluster && (
          <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white">
                Område: {selectedCluster.area}
              </h4>
              <button
                onClick={() => setSelectedCluster(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {selectedCluster.cases.map(caseData => (
                <div key={caseData.id} className="p-3 bg-slate-800 rounded-lg">
                  <div className="font-medium text-white text-sm truncate">
                    {caseData.title}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    📍 {caseData.formatted_address}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    👤 {caseData.primary_assignee_name}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    🕐 {caseData.start_date ? new Date(caseData.start_date).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : 'Ingen tid'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </Card>
  );
};

export default GeographicOverview;