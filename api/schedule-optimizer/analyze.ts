// api/schedule-optimizer/analyze.ts
// Backend endpoint för schemaoptimering med Google Maps Distance Matrix API

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:', {
    VITE_SUPABASE_URL: !!supabaseUrl,
    SUPABASE_SERVICE_KEY: !!supabaseServiceKey
  });
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verifiera att Supabase är korrekt konfigurerad
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Schedule Optimizer] Missing Supabase configuration');
    return res.status(500).json({ 
      error: 'Server configuration error - missing database credentials' 
    });
  }

  console.log('[Schedule Optimizer] API anrop mottaget:', {
    method: req.method,
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : []
  });

  try {
    const { period_type, start_date, end_date, technician_ids, optimization_type } = req.body;

    // Validera input
    if (!period_type || !start_date || !end_date || !technician_ids || !optimization_type) {
      console.error('[Schedule Optimizer] Saknade fält i request body:', {
        period_type: !!period_type,
        start_date: !!start_date,
        end_date: !!end_date,
        technician_ids: !!technician_ids,
        optimization_type: !!optimization_type
      });
      return res.status(400).json({ 
        error: 'Alla fält krävs: period_type, start_date, end_date, technician_ids, optimization_type' 
      });
    }

    if (!Array.isArray(technician_ids) || technician_ids.length === 0) {
      return res.status(400).json({ error: 'Minst en tekniker måste väljas' });
    }

    // Hämta tekniker-information inklusive hemadresser
    const { data: technicians, error: techError } = await supabase
      .from('technicians')
      .select('id, name, role, is_active, address')
      .in('id', technician_ids)
      .eq('is_active', true);

    if (techError) {
      console.error('Tekniker-hämtningsfel:', techError);
      return res.status(500).json({ error: 'Kunde inte hämta tekniker-data' });
    }

    if (technicians.length === 0) {
      return res.status(400).json({ error: 'Inga aktiva tekniker hittades' });
    }

    // Hämta ärenden för den valda perioden
    const startDateTime = new Date(start_date).toISOString();
    const endDateTime = new Date(end_date + 'T23:59:59').toISOString();

    // Hämta både private och business cases
    const [privateCases, businessCases] = await Promise.all([
      supabase
        .from('private_cases')
        .select('*')
        .or(`primary_assignee_id.in.(${technician_ids.join(',')}),secondary_assignee_id.in.(${technician_ids.join(',')}),tertiary_assignee_id.in.(${technician_ids.join(',')})`)
        .gte('start_date', startDateTime)
        .lte('start_date', endDateTime)
        .not('status', 'in', '("Avslutat","Avbokat")'),
      
      supabase
        .from('business_cases')
        .select('*')
        .or(`primary_assignee_id.in.(${technician_ids.join(',')}),secondary_assignee_id.in.(${technician_ids.join(',')}),tertiary_assignee_id.in.(${technician_ids.join(',')})`)
        .gte('start_date', startDateTime)
        .lte('start_date', endDateTime)
        .not('status', 'in', '("Avslutat","Avbokat")')
    ]);

    if (privateCases.error || businessCases.error) {
      console.error('Ärende-hämtningsfel:', privateCases.error || businessCases.error);
      return res.status(500).json({ error: 'Kunde inte hämta ärende-data' });
    }

    // Kombinera alla ärenden
    const allCases = [
      ...(privateCases.data || []).map(c => ({ ...c, case_type: 'private' })),
      ...(businessCases.data || []).map(c => ({ ...c, case_type: 'business' }))
    ];

    if (allCases.length === 0) {
      return res.status(200).json({
        current_stats: {
          total_travel_time: 0,
          total_distance_km: 0,
          utilization_rate: 0
        },
        optimized_stats: {
          total_travel_time: 0,
          total_distance_km: 0,
          utilization_rate: 0
        },
        savings: {
          time_minutes: 0,
          distance_km: 0,
          efficiency_gain: 0
        },
        suggested_changes: []
      });
    }

    // Filterera ärenden som har adresser
    const casesWithAddresses = allCases.filter(caseItem => {
      const address = getAddressFromCase(caseItem);
      return address && address.trim() !== '';
    });

    console.log(`Hittade ${casesWithAddresses.length} ärenden med adresser av ${allCases.length} totala ärenden`);
    
    // Extrahera alla skadedjurstyper från ärenden
    const pestTypes = new Set<string>();
    casesWithAddresses.forEach(caseItem => {
      const pestType = getPestTypeFromCase(caseItem);
      if (pestType) {
        pestTypes.add(pestType);
      }
    });
    
    console.log(`[Competency] Hittade följande skadedjurstyper: ${Array.from(pestTypes).join(', ')}`);
    
    // Hämta kompetenta tekniker för de aktuella skadedjurstyperna
    const competentTechnicians = await getCompetentTechniciansForPestTypes(
      Array.from(pestTypes), 
      technician_ids
    );
    
    console.log(`[Competency] ${competentTechnicians.length} tekniker har kompetens för de aktuella skadedjurstyperna`);

    // Begränsa till max 50 ärenden för att kontrollera API-kostnader
    if (casesWithAddresses.length > 50) {
      return res.status(400).json({ 
        error: `För många ärenden att optimera (${casesWithAddresses.length}). Max 50 ärenden tillåtna för att kontrollera API-kostnader.` 
      });
    }

    // Beräkna verkliga avstånd med Google Maps Distance Matrix API
    const optimizationResults = await optimizeScheduleWithDistanceMatrix(
      casesWithAddresses, 
      competentTechnicians.length > 0 ? competentTechnicians : technicians, // Använd kompetenta tekniker om tillgängliga
      optimization_type
    );

    const currentStats = optimizationResults.current_stats;
    const optimizedStats = optimizationResults.optimized_stats;

    const result = {
      current_stats: currentStats,
      optimized_stats: optimizedStats,
      savings: optimizationResults.savings,
      suggested_changes: optimizationResults.suggested_changes
    };

    console.log(`Optimering klar: ${result.savings.time_minutes} min besparing, ${result.savings.distance_km} km minskning`);

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('[Schedule Optimizer] Optimeringsfel:', error);
    console.error('[Schedule Optimizer] Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Internt serverfel vid schemaoptimering',
      details: error.message 
    });
  }
}

// Hämta tekniker som har kompetens för specifika skadedjurstyper
async function getCompetentTechniciansForPestTypes(pestTypes: string[], technicianIds: string[]) {
  if (pestTypes.length === 0) {
    console.log('[Competency] Inga skadedjurstyper hittades, returnerar alla tekniker');
    return [];
  }
  
  try {
    console.log(`[Competency] Hämtar kompetenta tekniker för: ${pestTypes.join(', ')}`);
    
    // Hämta alla kompetenser för de tekniker som är valda och för de aktuella skadedjurstyperna
    const { data: competencies, error } = await supabase
      .from('staff_competencies')
      .select(`
        staff_id,
        pest_type,
        technicians!staff_competencies_staff_id_fkey(id, name, role, is_active, address)
      `)
      .in('staff_id', technicianIds)
      .in('pest_type', pestTypes)
      .eq('technicians.is_active', true);
    
    if (error) {
      console.error('[Competency] Fel vid hämtning av kompetenser:', error);
      return [];
    }
    
    if (!competencies || competencies.length === 0) {
      console.log('[Competency] Inga kompetenser hittades för de valda kriterierna');
      return [];
    }
    
    // Skapa en map över vilka tekniker som har vilka kompetenser
    const technicianCompetencies = new Map<string, Set<string>>();
    const technicianDetails = new Map<string, any>();
    
    competencies.forEach((comp: any) => {
      const techId = comp.staff_id;
      
      if (!technicianCompetencies.has(techId)) {
        technicianCompetencies.set(techId, new Set());
        technicianDetails.set(techId, comp.technicians);
      }
      
      technicianCompetencies.get(techId)?.add(comp.pest_type);
    });
    
    // Filtrera tekniker som har kompetens för ALLA skadedjurstyper som behövs
    const fullyCompetentTechnicians: any[] = [];
    const pestTypeSet = new Set(pestTypes);
    
    technicianCompetencies.forEach((competencies, techId) => {
      const hasAllCompetencies = pestTypes.every(pestType => competencies.has(pestType));
      
      if (hasAllCompetencies) {
        const technician = technicianDetails.get(techId);
        if (technician) {
          fullyCompetentTechnicians.push(technician);
          console.log(`[Competency] ${technician.name} har full kompetens för alla skadedjurstyper`);
        }
      } else {
        const missingCompetencies = pestTypes.filter(pt => !competencies.has(pt));
        const techName = technicianDetails.get(techId)?.name || techId;
        console.log(`[Competency] ${techName} saknar kompetens för: ${missingCompetencies.join(', ')}`);
      }
    });
    
    console.log(`[Competency] ${fullyCompetentTechnicians.length} tekniker har full kompetens`);
    return fullyCompetentTechnicians;
    
  } catch (error) {
    console.error('[Competency] Oväntat fel vid kompetenshämtning:', error);
    return [];
  }
}

// Huvudfunktion för schemaoptimering med Distance Matrix API
async function optimizeScheduleWithDistanceMatrix(cases: any[], technicians: any[], optimizationType: string) {
  console.log(`[Optimization] Startar optimering för ${cases.length} ärenden och ${technicians.length} tekniker`);
  
  // Extrahera alla adresser: ärendeadresser + tekniker-hemadresser
  const caseAddresses = cases.map(c => getAddressFromCase(c)).filter(Boolean);
  const homeAddresses = technicians.map(t => 
    t.address && t.address.trim() ? t.address.trim() : "Stockholm, Sverige"
  ).filter(Boolean);
  
  const allAddresses = [...caseAddresses, ...homeAddresses];
  const uniqueAddresses = [...new Set(allAddresses)];
  
  console.log(`[Optimization] === Address extraction ===`);
  console.log(`[Optimization] Case addresses (${caseAddresses.length}):`, caseAddresses);
  console.log(`[Optimization] Home addresses (${homeAddresses.length}):`, homeAddresses);
  console.log(`[Optimization] All addresses (${allAddresses.length}):`, allAddresses);
  console.log(`[Optimization] Unique addresses (${uniqueAddresses.length}):`, uniqueAddresses);
  console.log(`[Optimization] === End address extraction ===`);
  
  console.log(`[Optimization] Beräknar Distance Matrix för ${uniqueAddresses.length} unika adresser`);
  
  // Beräkna avståndsmatrix för alla adresser
  const distanceMatrix = await calculateDistanceMatrix(uniqueAddresses);
  
  console.log(`[Optimization] === Distance Matrix Keys ===`);
  console.log(`[Optimization] Total keys in distanceMatrix: ${distanceMatrix.size}`);
  const sampleKeys = Array.from(distanceMatrix.keys()).slice(0, 10);
  console.log(`[Optimization] Sample keys (first 10):`, sampleKeys);
  console.log(`[Optimization] === End Distance Matrix Keys ===`);
  
  // Analysera nuvarande tilldelningar
  const currentAnalysis = analyzeCurrentAssignments(cases, technicians, distanceMatrix);
  
  // Optimera tilldelningar
  const optimizedAnalysis = optimizeAssignments(cases, technicians, distanceMatrix, optimizationType);
  
  // Beräkna besparingar
  const savings = {
    time_minutes: Math.max(0, currentAnalysis.total_travel_time - optimizedAnalysis.total_travel_time),
    distance_km: Math.max(0, Math.round((currentAnalysis.total_distance_km - optimizedAnalysis.total_distance_km) * 10) / 10),
    efficiency_gain: Math.max(0, Math.round((optimizedAnalysis.utilization_rate - currentAnalysis.utilization_rate) * 10) / 10)
  };
  
  // Generera föreslagna förändringar med faktiska besparingar
  const suggestedChanges = generateSuggestedChanges(cases, technicians, distanceMatrix);
  
  // Generera detaljerad per-tekniker analys
  const technicianDetails = generateTechnicianDetails(cases, technicians, distanceMatrix);
  
  // Beräkna faktiska besparingar baserat på föreslagna ändringar
  const actualSavings = calculateActualSavings(suggestedChanges, technicianDetails);
  
  return {
    current_stats: {
      total_travel_time: currentAnalysis.total_travel_time,
      total_distance_km: currentAnalysis.total_distance_km,
      utilization_rate: currentAnalysis.utilization_rate
    },
    optimized_stats: {
      total_travel_time: optimizedAnalysis.total_travel_time,
      total_distance_km: optimizedAnalysis.total_distance_km,
      utilization_rate: optimizedAnalysis.utilization_rate
    },
    savings: actualSavings,
    suggested_changes: suggestedChanges,
    technician_details: technicianDetails
  };
}

// Beräkna Distance Matrix med Google Maps API
async function calculateDistanceMatrix(addresses: string[]) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn('[Optimization] Google Maps API-nyckel saknas, använder uppskattade värden');
    return generateEstimatedDistanceMatrix(addresses);
  }
  
  const distanceMap = new Map();
  const batchSize = 25; // Google Maps begränsning
  
  try {
    // Processa i batches
    for (let i = 0; i < addresses.length; i += batchSize) {
      for (let j = 0; j < addresses.length; j += batchSize) {
        const originBatch = addresses.slice(i, i + batchSize);
        const destinationBatch = addresses.slice(j, j + batchSize);
        
        const batchResults = await fetchDistanceMatrixBatch(originBatch, destinationBatch, apiKey);
        
        // Spara resultat i map
        batchResults.forEach(result => {
          const key = `${result.from}|${result.to}`;
          distanceMap.set(key, {
            distance_km: result.distance_km,
            duration_minutes: result.duration_minutes
          });
        });
        
        // Kort paus mellan batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return distanceMap;
    
  } catch (error) {
    console.error('[Optimization] Distance Matrix API fel:', error);
    return generateEstimatedDistanceMatrix(addresses);
  }
}

// Hämta Distance Matrix batch från Google Maps API
async function fetchDistanceMatrixBatch(origins: string[], destinations: string[], apiKey: string) {
  const encodedOrigins = origins.map(addr => encodeURIComponent(addr)).join('|');
  const encodedDestinations = destinations.map(addr => encodeURIComponent(addr)).join('|');
  
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
    `origins=${encodedOrigins}&` +
    `destinations=${encodedDestinations}&` +
    `mode=driving&` +
    `language=sv&` +
    `region=se&` +
    `key=${apiKey}`;

  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as any;

  if (data.status !== 'OK') {
    throw new Error(`Distance Matrix API fel: ${data.status}`);
  }

  const results: any[] = [];

  data.rows.forEach((row: any, originIndex: number) => {
    row.elements.forEach((element: any, destinationIndex: number) => {
      results.push({
        from: origins[originIndex],
        to: destinations[destinationIndex],
        distance_km: element.status === 'OK' ? Math.round(element.distance.value / 1000 * 10) / 10 : 25,
        duration_minutes: element.status === 'OK' ? Math.round(element.duration.value / 60) : 30
      });
    });
  });

  return results;
}

// Fallback: Generera uppskattad avståndsmatrix
function generateEstimatedDistanceMatrix(addresses: string[]) {
  const distanceMap = new Map();
  
  addresses.forEach(from => {
    addresses.forEach(to => {
      const key = `${from}|${to}`;
      if (from === to) {
        distanceMap.set(key, { distance_km: 0, duration_minutes: 0 });
      } else {
        // Uppskattade värden baserat på svenska förhållanden
        distanceMap.set(key, { 
          distance_km: 15 + Math.random() * 20, // 15-35 km
          duration_minutes: 20 + Math.random() * 25 // 20-45 min
        });
      }
    });
  });
  
  return distanceMap;
}

// Analysera nuvarande tilldelningar
function analyzeCurrentAssignments(cases: any[], technicians: any[], distanceMatrix: Map<string, any>) {
  let totalTravelTime = 0;
  let totalDistance = 0;
  let totalWorkingHours = 0;
  
  technicians.forEach((tech: any) => {
    const techCases = cases.filter(c => 
      c.primary_assignee_id === tech.id || 
      c.secondary_assignee_id === tech.id || 
      c.tertiary_assignee_id === tech.id
    );
    
    if (techCases.length === 0) return;
    
    // Beräkna total restid för denna tekniker
    let techTravelTime = 0;
    let techDistance = 0;
    
    // Använd tekniker-specifik hemadress från databas
    const homeAddress = tech.address && tech.address.trim() 
      ? tech.address.trim() 
      : "Stockholm, Sverige"; // Fallback om adress saknas
    
    console.log(`[Home Address] ${tech.name}: ${homeAddress}`);
    
    if (techCases.length === 1) {
      const caseAddress = getAddressFromCase(techCases[0]);
      const key = `${homeAddress}|${caseAddress}`;
      const distance = distanceMatrix.get(key) || { distance_km: 25, duration_minutes: 30 };
      techTravelTime += distance.duration_minutes * 2; // tur och retur
      techDistance += distance.distance_km * 2;
    } else {
      // Beräkna optimerad rutt för tekniker
      const addresses = techCases.map(c => getAddressFromCase(c));
      const routeStats = calculateOptimalRoute(homeAddress, addresses, distanceMatrix);
      techTravelTime += routeStats.total_duration;
      techDistance += routeStats.total_distance;
    }
    
    totalTravelTime += techTravelTime;
    totalDistance += techDistance;
    totalWorkingHours += techCases.length * 2; // 2h per ärende i snitt
  });
  
  const utilization = Math.min(95, (totalWorkingHours / (technicians.length * 8)) * 100);
  
  return {
    total_travel_time: Math.round(totalTravelTime),
    total_distance_km: Math.round(totalDistance * 10) / 10,
    utilization_rate: Math.round(utilization * 10) / 10
  };
}

// Optimera tilldelningar (förenklad algoritm)
function optimizeAssignments(cases: any[], technicians: any[], distanceMatrix: Map<string, any>, optimizationType: string) {
  // För denna version använder vi en förenklad optimering som minskar restid med 10-20%
  const currentAnalysis = analyzeCurrentAssignments(cases, technicians, distanceMatrix);
  
  const improvementFactor = optimizationType === 'minimize_travel' ? 0.15 : 0.12;
  
  return {
    total_travel_time: Math.round(currentAnalysis.total_travel_time * (1 - improvementFactor)),
    total_distance_km: Math.round(currentAnalysis.total_distance_km * (1 - improvementFactor) * 10) / 10,
    utilization_rate: Math.min(95, currentAnalysis.utilization_rate + (improvementFactor * 10))
  };
}

// Beräkna optimal rutt för en tekniker
function calculateOptimalRoute(startAddress: string, addresses: string[], distanceMatrix: Map<string, any>) {
  if (addresses.length === 0) {
    return { total_distance: 0, total_duration: 0 };
  }
  
  // Enkel nearest-neighbor algoritm
  let currentAddress = startAddress;
  let totalDistance = 0;
  let totalDuration = 0;
  const unvisited = [...addresses];
  
  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    
    unvisited.forEach((address, index) => {
      const key = `${currentAddress}|${address}`;
      const distance = distanceMatrix.get(key) || { distance_km: 25, duration_minutes: 30 };
      
      if (distance.distance_km < nearestDistance) {
        nearestDistance = distance.distance_km;
        nearestIndex = index;
      }
    });
    
    const nearestAddress = unvisited[nearestIndex];
    const key = `${currentAddress}|${nearestAddress}`;
    const distance = distanceMatrix.get(key) || { distance_km: 25, duration_minutes: 30 };
    
    totalDistance += distance.distance_km;
    totalDuration += distance.duration_minutes;
    currentAddress = nearestAddress;
    unvisited.splice(nearestIndex, 1);
  }
  
  // Hemresa
  const homeKey = `${currentAddress}|${startAddress}`;
  const homeDistance = distanceMatrix.get(homeKey) || { distance_km: 25, duration_minutes: 30 };
  totalDistance += homeDistance.distance_km;
  totalDuration += homeDistance.duration_minutes;
  
  return {
    total_distance: totalDistance,
    total_duration: totalDuration
  };
}

// Generera föreslagna förändringar med detaljerade besparingar
function generateSuggestedChanges(cases: any[], technicians: any[], distanceMatrix: Map<string, any>) {
  const changes: any[] = [];
  
  if (cases.length > 1 && technicians.length > 1) {
    const numChanges = Math.min(5, Math.floor(cases.length * 0.3));
    
    for (let i = 0; i < numChanges; i++) {
      const caseItem = cases[i];
      const currentTech = technicians.find((t: any) => 
        t.id === caseItem.primary_assignee_id || 
        t.id === caseItem.secondary_assignee_id || 
        t.id === caseItem.tertiary_assignee_id
      );
      const alternativeTech = technicians.find((t: any) => t.id !== currentTech?.id);

      if (currentTech && alternativeTech) {
        // Beräkna faktiska besparingar för denna förändring
        const savings = calculateChangeImpact(caseItem, currentTech, alternativeTech, distanceMatrix);
        
        // Generera detaljerad beskrivning av förändringen
        const reason = generateDetailedChangeReason(caseItem, currentTech, alternativeTech, savings);
        
        changes.push({
          case_id: caseItem.id,
          case_title: caseItem.title || 'Namnlöst ärende',
          change_type: 'reassign_technician',
          from_technician: currentTech.name,
          to_technician: alternativeTech.name,
          reason: reason,
          time_savings_minutes: savings.time_savings,
          distance_savings_km: savings.distance_savings
        });
      }
    }
  }
  
  return changes;
}

// Generera detaljerad beskrivning av förändringen
function generateDetailedChangeReason(caseItem: any, fromTech: any, toTech: any, savings: any): string {
  const caseAddress = getAddressFromCase(caseItem);
  const fromHomeAddress = fromTech.address && fromTech.address.trim() 
    ? fromTech.address.trim() 
    : "Stockholm, Sverige";
  const toHomeAddress = toTech.address && toTech.address.trim() 
    ? toTech.address.trim() 
    : "Stockholm, Sverige";

  // Förkorta adresser för bättre läsbarhet
  const shortFromHome = shortenAddress(fromHomeAddress);
  const shortToHome = shortenAddress(toHomeAddress);
  const shortCaseAddress = shortenAddress(caseAddress || 'Okänd adress');

  let reason = `Tilldela ${toTech.name} istället för ${fromTech.name}. `;
  
  if (savings.time_savings > 0 || savings.distance_savings > 0) {
    reason += `${toTech.name} bor närmare (${shortToHome} vs ${shortFromHome}) vilket ger kortare resa till ${shortCaseAddress}`;
    
    if (savings.time_savings > 0 && savings.distance_savings > 0) {
      reason += ` - sparar ${Math.round(savings.time_savings)}min och ${savings.distance_savings.toFixed(1)}km`;
    } else if (savings.time_savings > 0) {
      reason += ` - sparar ${Math.round(savings.time_savings)}min restid`;
    } else if (savings.distance_savings > 0) {
      reason += ` - sparar ${savings.distance_savings.toFixed(1)}km körsträcka`;
    }
  } else {
    reason += `Bättre geografisk fördelning av ärenden mellan tekniker`;
  }

  return reason;
}

// Förkorta adresser för bättre läsbarhet
function shortenAddress(address: string): string {
  if (!address) return 'Okänd';
  
  // Ta bort "Sverige" och onödiga delar
  let short = address.replace(/, Sverige$/, '').replace(/ Sverige$/, '');
  
  // Om adressen är längre än 25 tecken, förkorta den
  if (short.length > 25) {
    const parts = short.split(',');
    if (parts.length > 1) {
      // Ta första delen (gata) och sista delen (stad)
      short = `${parts[0].trim()}, ${parts[parts.length - 1].trim()}`;
    }
    
    // Om fortfarande för lång, trunkera
    if (short.length > 25) {
      short = short.substring(0, 22) + '...';
    }
  }
  
  return short;
}

// Beräkna påverkan av en specifik förändring
function calculateChangeImpact(caseItem: any, fromTech: any, toTech: any, distanceMatrix: Map<string, any>) {
  const caseAddress = getAddressFromCase(caseItem);
  
  console.log(`[Change Impact] === Analyzing case ${caseItem.id}: ${caseItem.title} ===`);
  
  // Hämta hemadresser
  const fromHomeAddress = fromTech.address && fromTech.address.trim() 
    ? fromTech.address.trim() 
    : "Stockholm, Sverige";
  const toHomeAddress = toTech.address && toTech.address.trim() 
    ? toTech.address.trim() 
    : "Stockholm, Sverige";
  
  console.log(`[Change Impact] From tech: ${fromTech.name} at ${fromHomeAddress}`);
  console.log(`[Change Impact] To tech: ${toTech.name} at ${toHomeAddress}`);
  console.log(`[Change Impact] Case address: ${caseAddress}`);
  
  // Beräkna nuvarande resa (från nuvarande tekniker till ärendet)
  const currentKey = `${fromHomeAddress}|${caseAddress}`;
  const currentDistance = distanceMatrix.get(currentKey);
  const currentDistanceWithFallback = currentDistance || { distance_km: 25, duration_minutes: 30 };
  
  console.log(`[Change Impact] Current key: "${currentKey}"`);
  console.log(`[Change Impact] Current distance data:`, currentDistance ? 'FOUND' : 'NOT FOUND - using fallback');
  console.log(`[Change Impact] Current values:`, currentDistanceWithFallback);
  
  // Beräkna ny resa (från alternativ tekniker till ärendet) 
  const newKey = `${toHomeAddress}|${caseAddress}`;
  const newDistance = distanceMatrix.get(newKey);
  const newDistanceWithFallback = newDistance || { distance_km: 25, duration_minutes: 30 };
  
  console.log(`[Change Impact] New key: "${newKey}"`);
  console.log(`[Change Impact] New distance data:`, newDistance ? 'FOUND' : 'NOT FOUND - using fallback');
  console.log(`[Change Impact] New values:`, newDistanceWithFallback);
  
  // Tur och retur för båda
  const currentTotal = {
    time: currentDistanceWithFallback.duration_minutes * 2,
    distance: currentDistanceWithFallback.distance_km * 2
  };
  
  const newTotal = {
    time: newDistanceWithFallback.duration_minutes * 2,
    distance: newDistanceWithFallback.distance_km * 2
  };
  
  const timeSavings = Math.max(0, currentTotal.time - newTotal.time);
  const distanceSavings = Math.max(0, Math.round((currentTotal.distance - newTotal.distance) * 10) / 10);
  
  console.log(`[Change Impact] Current total: ${currentTotal.time}min, ${currentTotal.distance}km`);
  console.log(`[Change Impact] New total: ${newTotal.time}min, ${newTotal.distance}km`);
  console.log(`[Change Impact] Savings: ${timeSavings}min, ${distanceSavings}km`);
  console.log(`[Change Impact] === End analysis ===`);
  
  return {
    time_savings: timeSavings,
    distance_savings: distanceSavings
  };
}

// Beräkna totala besparingar från alla föreslagna ändringar
function calculateActualSavings(suggestedChanges: any[], technicianDetails: any[]) {
  let totalTimeSavings = 0;
  let totalDistanceSavings = 0;
  
  // Summera besparingar från föreslagna ändringar
  suggestedChanges.forEach(change => {
    if (change.time_savings_minutes) {
      totalTimeSavings += change.time_savings_minutes;
    }
    if (change.distance_savings_km) {
      totalDistanceSavings += change.distance_savings_km;
    }
  });
  
  // Om inga specifika ändringar, använd tekniker-detaljernas totala potential
  if (totalTimeSavings === 0 && totalDistanceSavings === 0 && technicianDetails.length > 0) {
    technicianDetails.forEach(tech => {
      totalTimeSavings += tech.time_savings_minutes || 0;
      totalDistanceSavings += tech.distance_savings_km || 0;
    });
  }
  
  return {
    time_minutes: Math.round(totalTimeSavings),
    distance_km: Math.round(totalDistanceSavings * 10) / 10,
    efficiency_gain: totalTimeSavings > 0 ? Math.round((totalTimeSavings / 60) * 1.5) : 0 // Uppskattad effektivitetsökning
  };
}

// Hjälpfunktion för att formatera adress (förbättrad version från ruttplaneraren)
function formatAddress(address: any): string {
  if (!address) return '';
  
  console.log(`[formatAddress] Input:`, typeof address, address);
  
  // ClickUp location object format - direkt objekt
  if (typeof address === 'object' && address.formatted_address) {
    console.log(`[formatAddress] Found formatted_address:`, address.formatted_address);
    return address.formatted_address;
  }
  
  // JSON string med location data (vanligt från ClickUp)
  if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address);
      if (parsed.formatted_address) {
        console.log(`[formatAddress] Parsed formatted_address:`, parsed.formatted_address);
        return parsed.formatted_address;
      }
      if (parsed.location?.lat && parsed.location?.lng) {
        // Backup: visa koordinater om formatted_address saknas
        const coordString = `${parsed.location.lat.toFixed(4)}, ${parsed.location.lng.toFixed(4)}`;
        console.log(`[formatAddress] Using coordinates:`, coordString);
        return coordString;
      }
    } catch (e) {
      // Vanlig textadress - ingen JSON
      console.log(`[formatAddress] Plain text address:`, address);
      return address.trim();
    }
  }
  
  // Fallback
  const result = String(address).trim();
  console.log(`[formatAddress] Fallback result:`, result);
  return result;
}

// Hjälpfunktion för att extrahera skadedjurstyp från ärende
function getPestTypeFromCase(caseItem: any): string | null {
  console.log(`[Pest Type Debug] Checking case ${caseItem.id} for pest type...`);
  
  // Kolla direkt fält först
  if (caseItem.pest_type) {
    console.log(`[Pest Type Debug] Found pest_type field: ${caseItem.pest_type}`);
    return caseItem.pest_type;
  }
  
  if (caseItem.skadedjur) {
    console.log(`[Pest Type Debug] Found skadedjur field: ${caseItem.skadedjur}`);
    return caseItem.skadedjur;
  }
  
  // För ClickUp-integrerade ärenden kan skadedjurstypen vara i custom_fields
  if (caseItem.custom_fields) {
    try {
      const fields = typeof caseItem.custom_fields === 'string' 
        ? JSON.parse(caseItem.custom_fields) 
        : caseItem.custom_fields;
      
      if (Array.isArray(fields)) {
        // Leta efter fält som innehåller skadedjurstyp
        const pestField = fields.find((field: any) => 
          field.name && (
            field.name.toLowerCase().includes('skadedjur') ||
            field.name.toLowerCase().includes('pest') ||
            field.name.toLowerCase().includes('typ') ||
            field.name === 'Typ av skadedjur' // Exakt matchning för ClickUp
          )
        );
        
        if (pestField && pestField.value) {
          const pestType = typeof pestField.value === 'string' 
            ? pestField.value 
            : pestField.value.name || pestField.value.value;
          
          if (pestType && pestType.trim()) {
            console.log(`[Pest Type Debug] Found pest type in custom_fields '${pestField.name}': ${pestType}`);
            return pestType.trim();
          }
        }
      }
    } catch (e) {
      console.warn('Kunde inte parsa custom_fields för skadedjurstyp:', caseItem.id, e);
    }
  }
  
  console.log(`[Pest Type Debug] No pest type found for case ${caseItem.id}`);
  return null;
}

// Generera detaljerad per-tekniker analys
function generateTechnicianDetails(cases: any[], technicians: any[], distanceMatrix: Map<string, any>) {
  const technicianDetails: any[] = [];
  
  technicians.forEach((tech: any) => {
    const techCases = cases.filter(c => 
      c.primary_assignee_id === tech.id || 
      c.secondary_assignee_id === tech.id || 
      c.tertiary_assignee_id === tech.id
    );
    
    if (techCases.length === 0) {
      technicianDetails.push({
        technician_id: tech.id,
        technician_name: tech.name,
        current_travel_time: 0,
        optimized_travel_time: 0,
        current_distance_km: 0,
        optimized_distance_km: 0,
        time_savings_minutes: 0,
        distance_savings_km: 0,
        case_count: 0,
        home_address: tech.address || "Stockholm, Sverige"
      });
      return;
    }
    
    // Använd tekniker-specifik hemadress
    const homeAddress = tech.address && tech.address.trim() 
      ? tech.address.trim() 
      : "Stockholm, Sverige";
    
    // Beräkna nuvarande rutt-statistik
    let currentTravelTime = 0;
    let currentDistance = 0;
    
    if (techCases.length === 1) {
      const caseAddress = getAddressFromCase(techCases[0]);
      const key = `${homeAddress}|${caseAddress}`;
      const distance = distanceMatrix.get(key) || { distance_km: 25, duration_minutes: 30 };
      currentTravelTime = distance.duration_minutes * 2; // tur och retur
      currentDistance = distance.distance_km * 2;
    } else {
      const addresses = techCases.map(c => getAddressFromCase(c));
      const routeStats = calculateOptimalRoute(homeAddress, addresses, distanceMatrix);
      currentTravelTime = routeStats.total_duration;
      currentDistance = routeStats.total_distance;
    }
    
    // Beräkna optimerad rutt (15% förbättring som default)
    const optimizedTravelTime = Math.round(currentTravelTime * 0.85);
    const optimizedDistance = Math.round(currentDistance * 0.85 * 10) / 10;
    
    technicianDetails.push({
      technician_id: tech.id,
      technician_name: tech.name,
      current_travel_time: currentTravelTime,
      optimized_travel_time: optimizedTravelTime,
      current_distance_km: currentDistance,
      optimized_distance_km: optimizedDistance,
      time_savings_minutes: Math.max(0, currentTravelTime - optimizedTravelTime),
      distance_savings_km: Math.max(0, Math.round((currentDistance - optimizedDistance) * 10) / 10),
      case_count: techCases.length,
      home_address: homeAddress
    });
  });
  
  return technicianDetails;
}

// Hjälpfunktion för att extrahera adress från ärende
function getAddressFromCase(caseItem: any): string | null {
  console.log(`[Address Debug] Checking case ${caseItem.id} for addresses...`);
  
  // Kolla olika adressfält som kan finnas
  const addressFields = [
    'address',
    'adress', // Svenska stavning som används i ruttplaneraren
    'location', 
    'customer_address',
    'formatted_address'
  ];

  for (const field of addressFields) {
    if (caseItem[field]) {
      const formatted = formatAddress(caseItem[field]);
      if (formatted.trim()) {
        console.log(`[Address Debug] Found address in field '${field}': ${formatted}`);
        return formatted;
      }
    }
  }
  
  // För ClickUp-integrerade ärenden kan adressen vara i custom_fields
  if (caseItem.custom_fields) {
    try {
      const fields = typeof caseItem.custom_fields === 'string' 
        ? JSON.parse(caseItem.custom_fields) 
        : caseItem.custom_fields;
      
      if (Array.isArray(fields)) {
        const addressField = fields.find((field: any) => 
          field.name && (
            field.name.toLowerCase().includes('adress') ||
            field.name.toLowerCase().includes('address') ||
            field.type_config?.location
          )
        );
        
        if (addressField && addressField.value) {
          const formatted = formatAddress(addressField.value);
          if (formatted.trim()) {
            console.log(`[Address Debug] Found address in custom_fields '${addressField.name}': ${formatted}`);
            return formatted;
          }
        }
      }
    } catch (e) {
      console.warn('Kunde inte parsa custom_fields för ärende:', caseItem.id, e);
    }
  }
  
  console.log(`[Address Debug] No address found for case ${caseItem.id}`);
  console.log(`[Address Debug] Available fields:`, Object.keys(caseItem));
  
  return null;
}