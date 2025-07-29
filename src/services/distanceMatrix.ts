// src/services/distanceMatrix.ts
// Google Maps Distance Matrix Service för schemaoptimering

import { geocodeAddress, type GeocodingResponse } from './geocoding';

export interface DistanceMatrixElement {
  distance: {
    text: string;
    value: number; // meters
  };
  duration: {
    text: string;
    value: number; // seconds
  };
  status: 'OK' | 'NOT_FOUND' | 'ZERO_RESULTS';
}

export interface DistanceMatrixResult {
  origin_addresses: string[];
  destination_addresses: string[];
  rows: {
    elements: DistanceMatrixElement[];
  }[];
  status: 'OK' | 'INVALID_REQUEST' | 'MAX_ELEMENTS_EXCEEDED' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'UNKNOWN_ERROR';
}

export interface DistanceData {
  from_address: string;
  to_address: string;
  distance_km: number;
  duration_minutes: number;
  status: 'success' | 'failed';
}

// Cache för distance matrix resultat
const distanceCache = new Map<string, DistanceData>();

/**
 * Beräkna avstånd och restid mellan två adresser
 */
export async function getDistance(fromAddress: string, toAddress: string): Promise<DistanceData> {
  const cacheKey = `${fromAddress.toLowerCase()}|${toAddress.toLowerCase()}`;
  
  // Kolla cache först
  if (distanceCache.has(cacheKey)) {
    return distanceCache.get(cacheKey)!;
  }

  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      throw new Error('Google Maps API-nyckel saknas');
    }

    const encodedOrigin = encodeURIComponent(fromAddress);
    const encodedDestination = encodeURIComponent(toAddress);
    
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
      `origins=${encodedOrigin}&` +
      `destinations=${encodedDestination}&` +
      `mode=driving&` +
      `language=sv&` +
      `region=se&` +
      `key=${apiKey}`;

    console.log(`[DistanceMatrix] Beräknar avstånd: ${fromAddress} -> ${toAddress}`);

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: DistanceMatrixResult = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Distance Matrix API fel: ${data.status}`);
    }

    const element = data.rows[0]?.elements[0];
    
    if (!element || element.status !== 'OK') {
      const result: DistanceData = {
        from_address: fromAddress,
        to_address: toAddress,
        distance_km: 0,
        duration_minutes: 0,
        status: 'failed'
      };
      
      distanceCache.set(cacheKey, result);
      return result;
    }

    const result: DistanceData = {
      from_address: fromAddress,
      to_address: toAddress,
      distance_km: Math.round(element.distance.value / 1000 * 10) / 10, // meters to km, 1 decimal
      duration_minutes: Math.round(element.duration.value / 60), // seconds to minutes
      status: 'success'
    };

    // Spara i cache
    distanceCache.set(cacheKey, result);
    
    console.log(`[DistanceMatrix] Resultat: ${result.distance_km}km, ${result.duration_minutes}min`);
    
    return result;

  } catch (error) {
    console.error('[DistanceMatrix] Fel:', error);
    
    const result: DistanceData = {
      from_address: fromAddress,
      to_address: toAddress,
      distance_km: 0,
      duration_minutes: 0,
      status: 'failed'
    };
    
    return result;
  }
}

/**
 * Beräkna avståndsmatrix för flera adresser (batch-optimerat)
 * Max 25 origins och 25 destinations per anrop enligt Google's begränsningar
 */
export async function getDistanceMatrix(origins: string[], destinations: string[]): Promise<DistanceData[]> {
  if (origins.length === 0 || destinations.length === 0) {
    return [];
  }

  const results: DistanceData[] = [];
  const batchSize = 25; // Google Maps begränsning

  // Dela upp i batches om det behövs
  for (let i = 0; i < origins.length; i += batchSize) {
    for (let j = 0; j < destinations.length; j += batchSize) {
      const originBatch = origins.slice(i, i + batchSize);
      const destinationBatch = destinations.slice(j, j + batchSize);
      
      const batchResults = await processBatch(originBatch, destinationBatch);
      results.push(...batchResults);
      
      // Liten delay mellan batches för att undvika rate limiting
      if (i + batchSize < origins.length || j + batchSize < destinations.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  return results;
}

/**
 * Processar en batch av origins och destinations
 */
async function processBatch(origins: string[], destinations: string[]): Promise<DistanceData[]> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      throw new Error('Google Maps API-nyckel saknas');
    }

    const encodedOrigins = origins.map(addr => encodeURIComponent(addr)).join('|');
    const encodedDestinations = destinations.map(addr => encodeURIComponent(addr)).join('|');
    
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
      `origins=${encodedOrigins}&` +
      `destinations=${encodedDestinations}&` +
      `mode=driving&` +
      `language=sv&` +
      `region=se&` +
      `key=${apiKey}`;

    console.log(`[DistanceMatrix] Batch: ${origins.length} origins x ${destinations.length} destinations`);

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: DistanceMatrixResult = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Distance Matrix API fel: ${data.status}`);
    }

    const results: DistanceData[] = [];

    // Parsa resultatet
    data.rows.forEach((row, originIndex) => {
      row.elements.forEach((element, destinationIndex) => {
        const result: DistanceData = {
          from_address: origins[originIndex],
          to_address: destinations[destinationIndex],
          distance_km: element.status === 'OK' ? Math.round(element.distance.value / 1000 * 10) / 10 : 0,
          duration_minutes: element.status === 'OK' ? Math.round(element.duration.value / 60) : 0,
          status: element.status === 'OK' ? 'success' : 'failed'
        };

        // Cache individuella resultat
        const cacheKey = `${origins[originIndex].toLowerCase()}|${destinations[destinationIndex].toLowerCase()}`;
        distanceCache.set(cacheKey, result);
        
        results.push(result);
      });
    });

    return results;

  } catch (error) {
    console.error('[DistanceMatrix] Batch-fel:', error);
    
    // Returnera fallback-resultat
    const results: DistanceData[] = [];
    origins.forEach(origin => {
      destinations.forEach(destination => {
        results.push({
          from_address: origin,
          to_address: destination,
          distance_km: 0,
          duration_minutes: 0,
          status: 'failed'
        });
      });
    });
    
    return results;
  }
}

/**
 * Beräkna den mest effektiva rutten för en tekniker med flera ärenden
 * Använder en förenklad "nearest neighbor" algoritm
 */
export async function optimizeRoute(technicianLocation: string, caseAddresses: string[]): Promise<{
  optimized_order: string[];
  total_distance_km: number;
  total_duration_minutes: number;
  savings_compared_to_linear: {
    distance_km: number;
    duration_minutes: number;
  };
}> {
  if (caseAddresses.length === 0) {
    return {
      optimized_order: [],
      total_distance_km: 0,
      total_duration_minutes: 0,
      savings_compared_to_linear: { distance_km: 0, duration_minutes: 0 }
    };
  }

  if (caseAddresses.length === 1) {
    const distance = await getDistance(technicianLocation, caseAddresses[0]);
    return {
      optimized_order: [caseAddresses[0]],
      total_distance_km: distance.distance_km * 2, // tur och retur
      total_duration_minutes: distance.duration_minutes * 2,
      savings_compared_to_linear: { distance_km: 0, duration_minutes: 0 }
    };
  }

  // Beräkna avståndsmatrix för alla kombinationer
  const allAddresses = [technicianLocation, ...caseAddresses];
  const distanceMatrix = await getDistanceMatrix(allAddresses, allAddresses);

  // Skapa lookup-map för snabb åtkomst
  const distanceLookup = new Map<string, number>();
  const durationLookup = new Map<string, number>();
  
  distanceMatrix.forEach(data => {
    const key = `${data.from_address}|${data.to_address}`;
    distanceLookup.set(key, data.distance_km);
    durationLookup.set(key, data.duration_minutes);
  });

  // Nearest neighbor algoritm
  const optimizedOrder: string[] = [];
  const unvisited = new Set(caseAddresses);
  let currentLocation = technicianLocation;
  let totalDistance = 0;
  let totalDuration = 0;

  while (unvisited.size > 0) {
    let nearestAddress = '';
    let nearestDistance = Infinity;
    let nearestDuration = 0;

    // Hitta närmsta obesökta adress
    for (const address of unvisited) {
      const key = `${currentLocation}|${address}`;
      const distance = distanceLookup.get(key) || 999;
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestDuration = durationLookup.get(key) || 60;
        nearestAddress = address;
      }
    }

    if (nearestAddress) {
      optimizedOrder.push(nearestAddress);
      unvisited.delete(nearestAddress);
      totalDistance += nearestDistance;
      totalDuration += nearestDuration;
      currentLocation = nearestAddress;
    } else {
      break;
    }
  }

  // Lägg till hemresa
  const homeKey = `${currentLocation}|${technicianLocation}`;
  totalDistance += distanceLookup.get(homeKey) || 0;
  totalDuration += durationLookup.get(homeKey) || 0;

  // Beräkna linjär rutt för jämförelse
  let linearDistance = 0;
  let linearDuration = 0;
  let linearCurrent = technicianLocation;
  
  for (const address of caseAddresses) {
    const key = `${linearCurrent}|${address}`;
    linearDistance += distanceLookup.get(key) || 0;
    linearDuration += durationLookup.get(key) || 0;
    linearCurrent = address;
  }
  
  // Hemresa för linjär rutt
  const linearHomeKey = `${linearCurrent}|${technicianLocation}`;
  linearDistance += distanceLookup.get(linearHomeKey) || 0;
  linearDuration += durationLookup.get(linearHomeKey) || 0;

  return {
    optimized_order: optimizedOrder,
    total_distance_km: Math.round(totalDistance * 10) / 10,
    total_duration_minutes: totalDuration,
    savings_compared_to_linear: {
      distance_km: Math.round((linearDistance - totalDistance) * 10) / 10,
      duration_minutes: linearDuration - totalDuration
    }
  };
}

/**
 * Rensa distance cache
 */
export function clearDistanceCache(): void {
  distanceCache.clear();
  console.log('[DistanceMatrix] Cache rensad');
}

/**
 * Hämta cache-statistik
 */
export function getDistanceCacheStats(): { size: number; keys: string[] } {
  return {
    size: distanceCache.size,
    keys: Array.from(distanceCache.keys())
  };
}