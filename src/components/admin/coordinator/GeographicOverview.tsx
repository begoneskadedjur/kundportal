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

// Kopiera formatAddress från assistant-utils.ts
const formatAddress = (address: any): string => { 
  if (!address) return ''; 
  if (typeof address === 'object' && address.formatted_address) return address.formatted_address; 
  return String(address); 
};

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

interface TechnicianCluster {
  id: string;
  cases: CaseWithLocation[];
  center: { lat: number; lng: number };
  technicianName: string;
  technicianAddress: string;
  technicianId: string;
  averageDistance?: number;
}

const GeographicOverview: React.FC<GeographicOverviewProps> = ({ className = '' }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [todaysCases, setTodaysCases] = useState<CaseWithLocation[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianWithLocation[]>([]);
  const [clusters, setClusters] = useState<TechnicianCluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<TechnicianCluster | null>(null);

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

  // Uppdatera kluster när ärenden och tekniker finns
  useEffect(() => {
    if (todaysCases.length > 0 && technicians.length > 0) {
      generateTechnicianClusters();
    }
  }, [todaysCases, technicians]);

  const fetchTodaysData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[GeographicOverview] Hämtar dagens data...');

      const today = new Date();
      const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();
      
      // Lägg till backup-intervall (senaste 7 dagarna) om inga ärenden idag
      const weekAgo = new Date();
      weekAgo.setDate(today.getDate() - 7);
      const weekAgoStart = weekAgo.toISOString();

      console.log('[GeographicOverview] Datumintervall:', { todayStart, todayEnd, weekAgoStart });

      // Hämta dagens ärenden först, sedan senaste veckan som backup
      const [privateCasesToday, businessCasesToday, techniciansData] = await Promise.all([
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

      let privateCases = privateCasesToday;
      let businessCases = businessCasesToday;

      // Om inga ärenden idag, hämta från senaste veckan
      if ((privateCasesToday.data?.length || 0) + (businessCasesToday.data?.length || 0) === 0) {
        console.log('[GeographicOverview] Inga ärenden idag, hämtar från senaste veckan...');
        
        const [privateWeekCases, businessWeekCases] = await Promise.all([
          supabase
            .from('private_cases')
            .select('*')
            .gte('start_date', weekAgoStart)
            .not('adress', 'is', null)
            .limit(20),
          
          supabase
            .from('business_cases')
            .select('*')
            .gte('start_date', weekAgoStart)
            .not('adress', 'is', null)
            .limit(20)
        ]);

        privateCases = privateWeekCases;
        businessCases = businessWeekCases;
      }

      if (privateCases.error) throw privateCases.error;
      if (businessCases.error) throw businessCases.error;
      if (techniciansData.error) throw techniciansData.error;

      console.log('[GeographicOverview] Raw data:', {
        privateCases: privateCases.data?.length,
        businessCases: businessCases.data?.length,
        technicians: techniciansData.data?.length
      });

      // Kombinera ärenden
      const allCases = [
        ...(privateCases.data || []).map(c => ({ ...c, case_type: 'private' as const })),
        ...(businessCases.data || []).map(c => ({ ...c, case_type: 'business' as const }))
      ] as BeGoneCaseRow[];

      console.log('[GeographicOverview] Kombinerade ärenden:', allCases.length);
      console.log('[GeographicOverview] Exempel på ärendeadresser:', 
        allCases.slice(0, 3).map(c => ({ id: c.id, address: c.adress }))
      );

      // Geocoda adresser
      const casesWithLocations = await geocodeCases(allCases);
      const techniciansWithLocations = await geocodeTechnicians(techniciansData.data || []);

      // Lägg till ärendekopp

      techniciansWithLocations.forEach(tech => {
        tech.todaysCases = casesWithLocations.filter(c => 
          c.primary_assignee_id === tech.id ||
          c.secondary_assignee_id === tech.id ||
          c.tertiary_assignee_id === tech.id
        );
      });

      console.log('[GeographicOverview] Geocodade resultat:', {
        cases: casesWithLocations.length,
        technicians: techniciansWithLocations.length,
        technicianCases: techniciansWithLocations.map(t => ({ 
          name: t.name, 
          cases: t.todaysCases?.length || 0 
        }))
      });

      setTodaysCases(casesWithLocations);
      setTechnicians(techniciansWithLocations);

    } catch (err: any) {
      console.error('[GeographicOverview] Fel vid hämtning av geografisk data:', err);
      setError(`Kunde inte ladda geografisk data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const geocodeCases = async (cases: BeGoneCaseRow[]): Promise<CaseWithLocation[]> => {
    const casesWithLocations: CaseWithLocation[] = [];

    console.log('[GeographicOverview] Geocodar ärenden:', cases.length);

    for (const caseData of cases) {
      let address = '';
      let coordinates = null;
      
      console.log('[GeographicOverview] Behandlar ärende:', { 
        id: caseData.id, 
        title: caseData.title,
        adress: caseData.adress 
      });

      // Extrahera adress från olika format
      if (typeof caseData.adress === 'string') {
        try {
          // Försök parsa som JSON först
          const parsed = JSON.parse(caseData.adress);
          address = parsed.formatted_address || caseData.adress;
          if (parsed.location?.lat && parsed.location?.lng) {
            coordinates = { lat: parsed.location.lat, lng: parsed.location.lng };
          }
        } catch {
          // Om inte JSON, använd som vanlig sträng
          address = caseData.adress;
        }
      } else if (caseData.adress && typeof caseData.adress === 'object') {
        address = caseData.adress.formatted_address || '';
        if (caseData.adress.location?.lat && caseData.adress.location?.lng) {
          coordinates = { lat: caseData.adress.location.lat, lng: caseData.adress.location.lng };
        }
      }

      if (!address) {
        console.log('[GeographicOverview] Hoppar över ärende utan adress:', caseData.id);
        continue;
      }

      // Använd befintliga koordinater eller geocoda
      if (coordinates) {
        console.log('[GeographicOverview] Använder befintliga koordinater för:', address);
        casesWithLocations.push({
          ...caseData,
          coordinates,
          formatted_address: address
        });
      } else {
        console.log('[GeographicOverview] Geocodar adress:', address);
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
          console.log('[GeographicOverview] Geocoding lyckades:', geocodeResult.result.formatted_address);
        } else {
          console.log('[GeographicOverview] Geocoding misslyckades:', geocodeResult.error);
        }
      }
    }

    console.log('[GeographicOverview] Slutligt antal geocodade ärenden:', casesWithLocations.length);
    return casesWithLocations;
  };

  const geocodeTechnicians = async (techs: Technician[]): Promise<TechnicianWithLocation[]> => {
    const techniciansWithLocations: TechnicianWithLocation[] = [];

    console.log('[GeographicOverview] Geocodar tekniker:', techs.length);

    for (const tech of techs) {
      if (!tech.address) {
        console.log('[GeographicOverview] Hoppar över tekniker utan adress:', tech.name);
        continue;
      }

      console.log('[GeographicOverview] Geocodar tekniker:', tech.name, tech.address);

      const geocodeResult = await geocodeAddress(tech.address);
      if (geocodeResult.success) {
        console.log('[GeographicOverview] Tekniker geocodad:', tech.name);

        techniciansWithLocations.push({
          ...tech,
          coordinates: {
            lat: geocodeResult.result.location.lat,
            lng: geocodeResult.result.location.lng
          },
          todaysCases: [] // Vi kommer att fylla detta senare
        });
      } else {
        console.log('[GeographicOverview] Tekniker geocoding misslyckades:', tech.name, geocodeResult.error);
      }
    }

    console.log('[GeographicOverview] Slutligt antal geocodade tekniker:', techniciansWithLocations.length);
    return techniciansWithLocations;
  };

  const generateTechnicianClusters = () => {
    console.log('[GeographicOverview] Genererar tekniker-centrerade kluster för', todaysCases.length, 'ärenden och', technicians.length, 'tekniker');
    
    const MAX_DISTANCE_KM = 25; // Max avstånd från tekniker till ärende
    const clusters: TechnicianCluster[] = [];
    const assignedCases = new Set<string>();

    // För varje tekniker, hitta närliggande ärenden
    technicians.forEach(technician => {
      if (!technician.coordinates) {
        console.log('[GeographicOverview] Hoppar över tekniker utan koordinater:', technician.name);
        return;
      }

      const nearbyCases: CaseWithLocation[] = [];

      // Hitta ärenden nära denna tekniker
      todaysCases.forEach(caseData => {
        if (!caseData.coordinates || assignedCases.has(caseData.id)) return;

        const distance = calculateDistance(
          technician.coordinates!,
          caseData.coordinates!
        );

        if (distance <= MAX_DISTANCE_KM) {
          nearbyCases.push(caseData);
        }
      });

      // Om tekniker har närliggande ärenden, skapa kluster
      if (nearbyCases.length > 0) {
        // Markera ärenden som tilldelade till denna tekniker
        nearbyCases.forEach(c => assignedCases.add(c.id));

        // Beräkna genomsnittligt avstånd
        const totalDistance = nearbyCases.reduce((sum, c) => {
          return sum + calculateDistance(technician.coordinates!, c.coordinates!);
        }, 0);
        const averageDistance = totalDistance / nearbyCases.length;

        // Beräkna kluster-center (tekniker + ärenden)
        const allCoordinates = [technician.coordinates, ...nearbyCases.map(c => c.coordinates!)];
        const center = {
          lat: allCoordinates.reduce((sum, coord) => sum + coord.lat, 0) / allCoordinates.length,
          lng: allCoordinates.reduce((sum, coord) => sum + coord.lng, 0) / allCoordinates.length
        };

        clusters.push({
          id: `tech-cluster-${technician.id}`,
          cases: nearbyCases,
          center,
          technicianName: technician.name,
          technicianAddress: formatAddress(technician.address),
          technicianId: technician.id,
          averageDistance: Math.round(averageDistance * 10) / 10
        });

        console.log('[GeographicOverview] Skapade tekniker-kluster:', {
          technician: technician.name,
          cases: nearbyCases.length,
          averageDistance: averageDistance.toFixed(1) + ' km'
        });
      }
    });

    // Hantera ärenden som inte tilldelats någon tekniker (för långt bort)
    const unassignedCases = todaysCases.filter(c => !assignedCases.has(c.id));
    if (unassignedCases.length > 0) {
      console.log('[GeographicOverview] Hittade', unassignedCases.length, 'otilldelade ärenden');
      
      // Skapa "Övriga ärenden" kluster
      const center = calculateClusterCenter(unassignedCases);
      clusters.push({
        id: 'unassigned-cluster',
        cases: unassignedCases,
        center,
        technicianName: 'Ej tilldelat',
        technicianAddress: 'Långt från alla tekniker',
        technicianId: '',
        averageDistance: undefined
      });
    }

    console.log('[GeographicOverview] Totalt antal tekniker-kluster:', clusters.length);
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


  const initializeMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps) {
      console.error('[GeographicOverview] Google Maps inte tillgängligt');
      return;
    }

    console.log('[GeographicOverview] Initialiserar Google Maps...');

    try {
      // Beräkna center baserat på tekniker-positioner eller fallback
      let mapCenter = { lat: 59.3293, lng: 18.0686 }; // Fallback till Stockholm
      if (technicians.length > 0) {
        const validCoords = technicians.filter(t => t.coordinates);
        if (validCoords.length > 0) {
          mapCenter = {
            lat: validCoords.reduce((sum, t) => sum + t.coordinates!.lat, 0) / validCoords.length,
            lng: validCoords.reduce((sum, t) => sum + t.coordinates!.lng, 0) / validCoords.length
          };
        }
      }

      const map = new google.maps.Map(mapRef.current, {
        zoom: 8,
        center: mapCenter,
        styles: [
          // Dark mode styling för karta
          { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#3a3b3c" }] },
          { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#2c3e50" }] }
        ]
      });

      googleMapRef.current = map;
      console.log('[GeographicOverview] Google Maps initialiserad');

      // Lägg till markers för ärenden och tekniker
      addMarkersToMap(map);
    } catch (error) {
      console.error('[GeographicOverview] Fel vid initialisering av karta:', error);
      setError('Kunde inte initialisera kartan');
    }
  };

  const addMarkersToMap = (map: google.maps.Map) => {
    console.log('[GeographicOverview] Lägger till markers:', {
      clusters: clusters.length,
      technicians: technicians.length
    });

    // Lägg till markers för tekniker-kluster
    clusters.forEach((cluster, index) => {
      console.log('[GeographicOverview] Skapar marker för tekniker-kluster:', cluster.technicianName, cluster.center);
      
      const marker = new google.maps.Marker({
        position: cluster.center,
        map: map,
        title: `${cluster.technicianName}: ${cluster.cases.length} ärenden${cluster.averageDistance ? ` (⌀ ${cluster.averageDistance} km)` : ''}`,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="18" fill="#3b82f6" stroke="#1e40af" stroke-width="2"/>
              <text x="20" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">
                ${cluster.technicianName.split(' ')[0]}
              </text>
              <text x="20" y="28" text-anchor="middle" fill="white" font-size="12" font-weight="bold">
                ${cluster.cases.length}
              </text>
            </svg>
          `),
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 20)
        }
      });

      marker.addListener('click', () => {
        console.log('[GeographicOverview] Tekniker-kluster klickad:', cluster.technicianName);
        setSelectedCluster(cluster);
      });
    });

    // Lägg till markers för tekniker
    technicians.forEach(tech => {
      if (!tech.coordinates) return;

      console.log('[GeographicOverview] Skapar marker för tekniker:', tech.name, tech.coordinates);

      new google.maps.Marker({
        position: tech.coordinates,
        map: map,
        title: `${tech.name} (${tech.todaysCases?.length || 0} ärenden)`,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
              <circle cx="15" cy="15" r="12" fill="#10b981" stroke="#047857" stroke-width="2"/>
              <path d="M10 15l4 4 8-8" stroke="white" stroke-width="2" fill="none"/>
            </svg>
          `),
          scaledSize: new google.maps.Size(30, 30),
          anchor: new google.maps.Point(15, 15)
        }
      });
    });

    // Anpassa zoom för att visa alla markers
    if (clusters.length > 0 || technicians.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      
      clusters.forEach(cluster => {
        bounds.extend(cluster.center);
      });
      
      technicians.forEach(tech => {
        if (tech.coordinates) {
          bounds.extend(tech.coordinates);
        }
      });

      map.fitBounds(bounds);
    }
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

  if (error || mapsError) {
    return (
      <Card className={className}>
        <div className="p-6 text-center text-red-400">
          <MapPin className="w-8 h-8 mx-auto mb-4" />
          <p className="mb-4">{error || mapsError}</p>
          {mapsError?.includes('ApiNotActivatedMapError') && (
            <div className="text-left bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <h4 className="font-bold text-white mb-2">Google Maps API inte aktiverat</h4>
              <p className="text-sm text-slate-300 mb-2">
                För att visa kartan behöver du aktivera "Maps JavaScript API" i Google Cloud Console:
              </p>
              <ol className="text-sm text-slate-400 list-decimal list-inside space-y-1">
                <li>Gå till Google Cloud Console</li>
                <li>Välj ditt projekt</li>
                <li>Gå till "APIs & Services" → "Library"</li>
                <li>Sök efter "Maps JavaScript API"</li>
                <li>Klicka "Enable"</li>
              </ol>
            </div>
          )}
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
              <div className="text-slate-400">Kluster</div>
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

          {/* Tekniker-kluster lista */}
          <div className="space-y-3">
            <h4 className="font-medium text-slate-300">Tekniker-kluster</h4>
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-white">{cluster.technicianName}</div>
                      <div className="text-sm text-blue-400">
                        {cluster.cases.length} ärenden
                      </div>
                    </div>
                    
                    <div className="text-xs text-slate-400">
                      📍 {cluster.technicianAddress}
                    </div>
                    
                    {cluster.averageDistance && (
                      <div className="text-xs text-slate-500">
                        ⌀ {cluster.averageDistance} km avstånd
                      </div>
                    )}
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
              <div>
                <h4 className="font-medium text-white">
                  {selectedCluster.technicianName}
                </h4>
                <p className="text-sm text-slate-400">
                  📍 {selectedCluster.technicianAddress}
                  {selectedCluster.averageDistance && (
                    <span className="ml-2">• ⌀ {selectedCluster.averageDistance} km</span>
                  )}
                </p>
              </div>
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