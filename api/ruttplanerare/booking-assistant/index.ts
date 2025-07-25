// api/ruttplanerare/booking-assistant/index.ts
// VERSION 6.0 - INTEGRERAR INDIVIDUELLA SCHEMAN, KORRIGERAR LUCK-LOGIK & FÖRBÄTTRAR POÄNGSÄTTNING

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { 
  addDays, 
  addMinutes, 
  subMinutes,
  setHours,
  setMinutes,
  startOfDay,
  endOfDay,
  isWithinInterval,
  max,
  min,
  getDay, // Används för att få veckodagen
  parse
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Konfiguration ---
const SEARCH_DAYS_LIMIT = 7;
const TIMEZONE = 'Europe/Stockholm';
const DEFAULT_TRAVEL_TIME = 30;

// --- Datatyper (matchar er uppdaterade database.ts) ---

type DaySchedule = {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  active: boolean;
};

type WorkSchedule = {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};

interface StaffMember { 
  id: string; 
  name: string; 
  address: string;
  work_schedule: WorkSchedule | null; // Individuellt arbetsschema
}

interface EventSlot {
  start: Date;
  end: Date;
  type: 'case' | 'absence';
  title?: string;
  address?: string;
}

interface AbsencePeriod {
  start: Date;
  end: Date;
}

interface TechnicianDaySchedule {
  technician: StaffMember;
  date: Date;
  workStart: Date;
  workEnd: Date;
  absences: AbsencePeriod[];
  existingCases: EventSlot[];
}

interface Suggestion { 
  technician_id: string; 
  technician_name: string; 
  start_time: string; 
  end_time: string; 
  travel_time_minutes: number; 
  origin_description: string;
  efficiency_score: number;
  is_first_job: boolean;
}

// --- Hjälpfunktioner ---

const formatAddress = (address: any): string => { 
  if (!address) return ''; 
  if (typeof address === 'object' && address.formatted_address) return address.formatted_address; 
  return String(address); 
};

// Konverterar veckodag-index (Sön=0, Mån=1...) till nyckel i vårt WorkSchedule-objekt
const getDayKey = (date: Date): keyof WorkSchedule => {
    const dayIndex = getDay(date);
    const dayMap: (keyof WorkSchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayMap[dayIndex];
}

// --- Data-hämtning ---

async function getSchedules(staff: StaffMember[], from: Date, to: Date): Promise<Map<string, EventSlot[]>> {
  const staffIds = staff.map(s => s.id);
  if (staffIds.length === 0) return new Map();
  
  const { data, error } = await supabase
    .from('cases_with_technician_view')
    .select('start_date, due_date, technician_id, adress, title')
    .in('technician_id', staffIds)
    .gte('start_date', from.toISOString())
    .lte('start_date', to.toISOString())
    .order('start_date');
    
  if (error) throw error;
  
  const schedules = new Map<string, EventSlot[]>();
  staff.forEach(s => schedules.set(s.id, []));
  
  data?.forEach(c => { 
    if(c.start_date && c.due_date && c.technician_id) {
      const caseSlot: EventSlot = {
        start: new Date(c.start_date),
        end: new Date(c.due_date),
        title: c.title || 'Ärende',
        address: formatAddress(c.adress),
        type: 'case'
      };
      schedules.get(c.technician_id)?.push(caseSlot);
    }
  });
  
  return schedules;
}

async function getAbsences(staffIds: string[], from: Date, to: Date): Promise<Map<string, AbsencePeriod[]>> {
  if (staffIds.length === 0) return new Map();
  
  const { data, error } = await supabase
    .from('technician_absences')
    .select('technician_id, start_date, end_date')
    .in('technician_id', staffIds)
    .or(`start_date.lte.${to.toISOString()},end_date.gte.${from.toISOString()}`);
    
  if (error) throw error;
  
  const absences = new Map<string, AbsencePeriod[]>();
  staffIds.forEach(id => absences.set(id, []));
  
  data.forEach(a => {
    absences.get(a.technician_id)?.push({
      start: new Date(a.start_date),
      end: new Date(a.end_date)
    });
  });
  
  return absences;
}

/**
 * ✅ FÖRBÄTTRAD: Hämtar kompetent personal och deras individuella arbetsscheman.
 */
async function getCompetentStaff(pestType: string): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff_competencies')
    .select('technicians(id, name, address, work_schedule)') // Hämtar work_schedule
    .eq('pest_type', pestType);
    
  if (error) throw error;
  
  return data
    .map((s: any) => s.technicians)
    .filter(Boolean)
    .filter(staff => staff.address && typeof staff.address === 'string' && staff.address.trim() !== '');
}

async function getTravelTimes(origins: string[], destination: string): Promise<Map<string, number>> {
    if (origins.length === 0) return new Map();
  
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY!;
    const uniqueOrigins = [...new Set(origins)];
    const travelTimes = new Map<string, number>();
    
    // Använd en cache i framtiden för att minska kostnader
    for (let i = 0; i < uniqueOrigins.length; i += 25) {
      const batch = uniqueOrigins.slice(i, i + 25);
      const matrixApiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(batch.join('|'))}&destinations=${encodeURIComponent(destination)}&key=${googleMapsApiKey}&mode=driving&language=sv`;
      
      try {
        const matrixResponse = await fetch(matrixApiUrl);
        const matrixData = await matrixResponse.json() as any;
        
        if (matrixData.status !== 'OK') {
          console.error('Google Maps API Error:', matrixData.error_message || matrixData.status);
          batch.forEach(origin => travelTimes.set(origin, DEFAULT_TRAVEL_TIME));
          continue;
        }
        
        matrixData.rows.forEach((row: any, index: number) => { 
          if (row.elements[0].status === 'OK') { 
            travelTimes.set(batch[index], Math.ceil(row.elements[0].duration.value / 60)); 
          } else {
            travelTimes.set(batch[index], DEFAULT_TRAVEL_TIME);
          }
        });
      } catch (error) {
        console.error('Error calling Google Maps API:', error);
        batch.forEach(origin => travelTimes.set(origin, DEFAULT_TRAVEL_TIME));
      }
    }
    
    return travelTimes;
}

/**
 * ✅ FÖRBÄTTRAD: Bygger dagsscheman baserat på varje teknikers individuella arbetstider.
 */
function buildDailySchedules(
  technicians: StaffMember[],
  schedules: Map<string, EventSlot[]>,
  absences: Map<string, AbsencePeriod[]>,
  searchStart: Date,
  searchEnd: Date
): TechnicianDaySchedule[] {
  const dailySchedules: TechnicianDaySchedule[] = [];
  
  for (const tech of technicians) {
    let currentDate = new Date(searchStart);
    
    while (currentDate <= searchEnd) {
      const dayKey = getDayKey(currentDate);
      const daySchedule = tech.work_schedule?.[dayKey];

      // Hoppa över dagen om teknikern inte har ett schema eller inte är aktiv den dagen
      if (!daySchedule || !daySchedule.active) {
        currentDate = addDays(currentDate, 1);
        continue;
      }
      
      const dayStart = startOfDay(currentDate);
      const dayEnd = endOfDay(currentDate);

      // Skapa korrekta start- och sluttider för dagen i Stockholm-tidszon
      const workStart = toZonedTime(parse(daySchedule.start, 'HH:mm', dayStart), TIMEZONE);
      const workEnd = toZonedTime(parse(daySchedule.end, 'HH:mm', dayStart), TIMEZONE);
      
      const techAbsences = absences.get(tech.id) || [];
      const dayAbsences = techAbsences.filter(a => 
        isWithinInterval(dayStart, { start: a.start, end: a.end }) ||
        isWithinInterval(dayEnd, { start: a.start, end: a.end })
      );
      
      const isFullyAbsent = dayAbsences.some(a => a.start <= workStart && a.end >= workEnd);
      
      if (!isFullyAbsent) {
        const techCases = schedules.get(tech.id) || [];
        const dayCases = techCases.filter(c => c.start >= dayStart && c.start < dayEnd);
        
        dailySchedules.push({
          technician: tech,
          date: currentDate,
          workStart,
          workEnd,
          absences: dayAbsences,
          existingCases: dayCases,
        });
      }
      
      currentDate = addDays(currentDate, 1);
    }
  }
  
  return dailySchedules;
}

/**
 * ✅ FÖRBÄTTRAD: Ny, smartare poängsättning.
 */
function calculateEfficiencyScore(
  travelTime: number,
  isFirstJob: boolean,
  gapUtilization: number // Andel av en lucka som fylls (0 för första jobbet)
): number {
  // POÄNGSÄTTNING FÖR FÖRSTA JOBBET: Prioriterar kort restid.
  // En hög baspoäng som straffas av restid. En restid på 20 min ger 100 poäng.
  if (isFirstJob) {
    const score = 120 - travelTime;
    return Math.max(0, Math.round(score)); 
  }
  
  // POÄNGSÄTTNING FÖR JOBB UNDER DAGEN: Mix av restid och effektivt luck-utnyttjande.
  const travelScore = Math.max(0, 40 - (travelTime * 0.8)); // Max 40p
  const utilizationScore = gapUtilization * 40; // Max 40p
  const efficiencyBonus = travelTime <= 15 ? 20 : travelTime <= 25 ? 10 : 0; // Bonus 20p
  return Math.round(travelScore + utilizationScore + efficiencyBonus); // Max ~100p
}

/**
 * ✅ HELT NY: Robust algoritm som hittar alla tillgängliga luckor korrekt.
 */
function findAvailableSlots(
  daySchedule: TechnicianDaySchedule,
  timeSlotDuration: number,
  travelTimes: Map<string, number>
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lastPossibleStart = subMinutes(daySchedule.workEnd, timeSlotDuration);
  
  // 1. Skapa "virtuella" events för arbetsdagens början och slut.
  // Detta gör att vi kan använda en enda loop för att hitta alla luckor.
  const virtualStartEvent: EventSlot = {
    start: subMinutes(daySchedule.workStart, 1),
    end: daySchedule.workStart,
    type: 'case',
    title: 'Hemadress',
    address: daySchedule.technician.address
  };
  
  const virtualEndEvent: EventSlot = {
    start: daySchedule.workEnd,
    end: addMinutes(daySchedule.workEnd, 1),
    type: 'case',
    title: 'Slut på dagen',
    address: daySchedule.technician.address // Adress för ev. beräkning av hemresa
  };

  // 2. Samla alla "blockerande" händelser under dagen
  const allEvents = [
    virtualStartEvent,
    ...daySchedule.existingCases,
    ...daySchedule.absences.map(a => ({
      start: a.start,
      end: a.end,
      type: 'absence' as const,
      title: 'Frånvaro'
    })),
    virtualEndEvent
  ].sort((a, b) => a.start.getTime() - b.start.getTime());
  
  // 3. Loopa igenom alla händelser och analysera luckorna MELLAN dem
  for (let i = 0; i < allEvents.length - 1; i++) {
    const currentEvent = allEvents[i];
    const nextEvent = allEvents[i + 1];

    const gapStart = currentEvent.end;
    const gapEnd = nextEvent.start;
    
    // Om det inte finns någon tid mellan events, fortsätt
    if (gapEnd <= gapStart) continue;

    const originAddress = currentEvent.address || daySchedule.technician.address;
    const travelTime = travelTimes.get(originAddress) || DEFAULT_TRAVEL_TIME;
    
    // Tidigaste möjliga start i luckan, med hänsyn till restid från föregående plats.
    const earliestStartInGap = addMinutes(gapStart, travelTime);
    
    // Starttiden kan inte vara före arbetsdagens början
    const earliestStart = max([earliestStartInGap, daySchedule.workStart]);
    
    // Senast möjliga start är så att jobbet hinner slutföras innan nästa event börjar.
    const latestStart = min([subMinutes(gapEnd, timeSlotDuration), lastPossibleStart]);
    
    if (earliestStart <= latestStart) {
      const isFirstJob = (currentEvent.title === 'Hemadress');
      const slotEnd = addMinutes(earliestStart, timeSlotDuration);
      
      // Beräkna hur väl luckan utnyttjas
      const gapDuration = (gapEnd.getTime() - gapStart.getTime()) / 60000;
      const usedDuration = timeSlotDuration + (isFirstJob ? 0 : travelTime);
      const gapUtilization = gapDuration > 0 ? Math.min(1, usedDuration / gapDuration) : 1;

      suggestions.push({
        technician_id: daySchedule.technician.id,
        technician_name: daySchedule.technician.name,
        start_time: earliestStart.toISOString(),
        end_time: slotEnd.toISOString(),
        travel_time_minutes: travelTime,
        origin_description: currentEvent.title || "Föregående ärende",
        efficiency_score: calculateEfficiencyScore(travelTime, isFirstJob, gapUtilization),
        is_first_job: isFirstJob
      });
    }
  }
  
  return suggestions;
}

// --- Huvudfunktion ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Endast POST är tillåtet' });
  }

  try {
    const { 
      newCaseAddress, 
      pestType, 
      timeSlotDuration = 60, 
      searchStartDate, 
      selectedTechnicianIds 
    } = req.body;
    
    if (!newCaseAddress || !pestType) {
      return res.status(400).json({ error: 'Adress och skadedjurstyp måste anges.' });
    }
    
    if (timeSlotDuration < 30 || timeSlotDuration > 480) {
      return res.status(400).json({ error: 'Arbetstid måste vara mellan 30 minuter och 8 timmar.' });
    }

    const searchStart = searchStartDate 
      ? startOfDay(new Date(searchStartDate))
      : startOfDay(new Date());
    const searchEnd = addDays(searchStart, SEARCH_DAYS_LIMIT);
    
    const allCompetentStaff = await getCompetentStaff(pestType);
    if (allCompetentStaff.length === 0) {
      return res.status(200).json([]);
    }

    const staffToSearch = selectedTechnicianIds && Array.isArray(selectedTechnicianIds) && selectedTechnicianIds.length > 0
      ? allCompetentStaff.filter(staff => selectedTechnicianIds.includes(staff.id))
      : allCompetentStaff;

    if (staffToSearch.length === 0) {
      return res.status(200).json([]);
    }
    
    const staffIds = staffToSearch.map(s => s.id);
    const [schedules, absences] = await Promise.all([
      getSchedules(staffToSearch, searchStart, searchEnd),
      getAbsences(staffIds, searchStart, searchEnd)
    ]);
    
    const allAddresses = new Set<string>();
    staffToSearch.forEach(staff => {
      if(staff.address) allAddresses.add(staff.address);
    });
    schedules.forEach(cases => {
      cases.forEach(c => {
        if (c.address) allAddresses.add(c.address);
      });
    });
    
    const travelTimes = await getTravelTimes(Array.from(allAddresses), newCaseAddress);
    
    const dailySchedules = buildDailySchedules(
      staffToSearch,
      schedules,
      absences,
      searchStart,
      searchEnd
    );
    
    const allSuggestions: Suggestion[] = [];
    
    for (const daySchedule of dailySchedules) {
      const slots = findAvailableSlots(
        daySchedule,
        timeSlotDuration,
        travelTimes
      );
      allSuggestions.push(...slots);
    }
    
    const sortedSuggestions = allSuggestions
      .sort((a, b) => {
        // Sortera först på starttid (tidigast först)
        const timeDiff = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
        if (timeDiff !== 0) return timeDiff;
        // Om starttid är samma, sortera på högst poäng
        return b.efficiency_score - a.efficiency_score;
      })
      .slice(0, 15); // Visa 15 bästa förslagen
    
    res.status(200).json(sortedSuggestions);

  } catch (error: any) {
    console.error("Fel i bokningsassistent (v6.0):", error);
    res.status(500).json({ 
      error: "Ett internt fel uppstod.", 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
}