// api/ruttplanerare/booking-assistant/index.ts
// VERSION 5.0 - FÖRBÄTTRAD MED KORREKT FRÅNVAROHANTERING OCH OPTIMERAD RUTTPLANERING

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { 
  format, 
  addDays, 
  addMinutes, 
  subMinutes,
  setHours,
  setMinutes,
  isWeekend,
  startOfDay,
  endOfDay,
  isWithinInterval,
  max,
  min
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Konfiguration ---
const WORK_DAY_START_HOUR = 8;
const WORK_DAY_END_HOUR = 17;
const SEARCH_DAYS_LIMIT = 7; // Ändrat från 14 till 7 enligt din spec
const TIMEZONE = 'Europe/Stockholm';
const DEFAULT_TRAVEL_TIME = 30; // minuter

// --- Datatyper ---
interface StaffMember { 
  id: string; 
  name: string; 
  address: string; 
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
  isFullDay: boolean;
}

interface TechnicianDaySchedule {
  technician: StaffMember;
  date: Date;
  isAvailable: boolean;
  absences: AbsencePeriod[];
  existingCases: EventSlot[];
  workStart: Date;
  workEnd: Date;
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

// Konvertera UTC till Stockholm-tid
const toStockholmTime = (date: Date): Date => {
  return toZonedTime(date, TIMEZONE);
};

// Konvertera Stockholm-tid till UTC för lagring
const fromStockholmTime = (date: Date): Date => {
  return fromZonedTime(date, TIMEZONE);
};

// Skapa arbetstider för en specifik dag
const createWorkHours = (date: Date): { start: Date; end: Date } => {
  const dayStart = startOfDay(date);
  const workStart = setMinutes(setHours(dayStart, WORK_DAY_START_HOUR), 0);
  const workEnd = setMinutes(setHours(dayStart, WORK_DAY_END_HOUR), 0);
  
  return {
    start: fromStockholmTime(workStart),
    end: fromStockholmTime(workEnd)
  };
};

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
    const start = new Date(a.start_date);
    const end = new Date(a.end_date);
    const startTime = toStockholmTime(start);
    const endTime = toStockholmTime(end);
    
    // Kontrollera om det är heldagsfrånvaro
    const isFullDay = (
      startTime.getHours() <= WORK_DAY_START_HOUR && 
      endTime.getHours() >= WORK_DAY_END_HOUR
    );
    
    absences.get(a.technician_id)?.push({
      start,
      end,
      isFullDay
    });
  });
  
  return absences;
}

async function getCompetentStaff(pestType: string): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff_competencies')
    .select('technicians(id, name, address)')
    .eq('pest_type', pestType);
    
  if (error) throw error;
  
  return data
    .map((s: any) => s.technicians)
    .filter(Boolean)
    .filter(staff => staff.address && typeof staff.address === 'string' && staff.address.trim() !== '');
}

// Batch-anrop till Google Distance Matrix API
async function getTravelTimes(origins: string[], destination: string): Promise<Map<string, number>> {
  if (origins.length === 0) return new Map();
  
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY!;
  const uniqueOrigins = [...new Set(origins)];
  const travelTimes = new Map<string, number>();
  
  // Google Distance Matrix tillåter max 25 origins per anrop
  for (let i = 0; i < uniqueOrigins.length; i += 25) {
    const batch = uniqueOrigins.slice(i, i + 25);
    const matrixApiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(batch.join('|'))}&destinations=${encodeURIComponent(destination)}&key=${googleMapsApiKey}&mode=driving&language=sv&units=metric`;
    
    try {
      const matrixResponse = await fetch(matrixApiUrl);
      const matrixData = await matrixResponse.json() as any;
      
      if (matrixData.status !== 'OK') {
        console.error('Google Maps API Error:', matrixData.error_message || matrixData.status);
        // Använd default-värde istället för att kasta fel
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

// Bygg dagliga scheman
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
      // Hoppa över helger
      if (isWeekend(currentDate)) {
        currentDate = addDays(currentDate, 1);
        continue;
      }
      
      const workHours = createWorkHours(currentDate);
      const dayStart = startOfDay(currentDate);
      const dayEnd = endOfDay(currentDate);
      
      // Hämta frånvaro för dagen
      const techAbsences = absences.get(tech.id) || [];
      const dayAbsences = techAbsences.filter(a => 
        isWithinInterval(dayStart, { start: a.start, end: a.end })
      );
      
      // Kontrollera om tekniker är helt frånvarande denna dag
      const isFullyAbsent = dayAbsences.some(a => a.isFullDay);
      
      if (!isFullyAbsent) {
        // Hämta ärenden för dagen
        const techCases = schedules.get(tech.id) || [];
        const dayCases = techCases.filter(c => 
          c.start >= dayStart && c.start < dayEnd
        );
        
        dailySchedules.push({
          technician: tech,
          date: currentDate,
          isAvailable: true,
          absences: dayAbsences.filter(a => !a.isFullDay), // Bara delvis frånvaro
          existingCases: dayCases,
          workStart: workHours.start,
          workEnd: workHours.end
        });
      }
      
      currentDate = addDays(currentDate, 1);
    }
  }
  
  return dailySchedules;
}

// Beräkna effektivitetspoäng
function calculateEfficiencyScore(
  travelTime: number,
  isFirstJob: boolean,
  gapUtilization: number // 0-1, hur väl luckan fylls
): number {
  // Baspoäng för första jobbet (ingen restid)
  if (isFirstJob) return 100;
  
  // Restidspoäng (0-40 poäng)
  const travelScore = Math.max(0, 40 - (travelTime * 0.8));
  
  // Luckanvändningspoäng (0-40 poäng)
  const utilizationScore = gapUtilization * 40;
  
  // Bonuspoäng för kort restid (0-20 poäng)
  const efficiencyBonus = travelTime <= 15 ? 20 : travelTime <= 25 ? 10 : 0;
  
  return Math.round(travelScore + utilizationScore + efficiencyBonus);
}

// Hitta tillgängliga tidsluckor
function findAvailableSlots(
  daySchedule: TechnicianDaySchedule,
  timeSlotDuration: number,
  travelTimes: Map<string, number>
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lastPossibleStart = subMinutes(daySchedule.workEnd, timeSlotDuration);
  
  // Kombinera ärenden och deltidsfrånvaro
  const allEvents = [
    ...daySchedule.existingCases,
    ...daySchedule.absences.map(a => ({
      start: a.start,
      end: a.end,
      type: 'absence' as const,
      title: 'Frånvaro'
    }))
  ].sort((a, b) => a.start.getTime() - b.start.getTime());
  
  // Fall 1: Första ärendet på dagen (ingen restid)
  if (allEvents.length === 0 || allEvents[0].start > daySchedule.workStart) {
    const firstEventStart = allEvents.length > 0 ? allEvents[0].start : daySchedule.workEnd;
    const slotEnd = addMinutes(daySchedule.workStart, timeSlotDuration);
    
    if (slotEnd <= firstEventStart && slotEnd <= daySchedule.workEnd) {
      suggestions.push({
        technician_id: daySchedule.technician.id,
        technician_name: daySchedule.technician.name,
        start_time: daySchedule.workStart.toISOString(),
        end_time: slotEnd.toISOString(),
        travel_time_minutes: 0,
        origin_description: "Första ärendet - startar från kontor/hem",
        efficiency_score: 100,
        is_first_job: true
      });
    }
  }
  
  // Fall 2: Luckor mellan ärenden
  for (let i = 0; i < allEvents.length; i++) {
    const currentEvent = allEvents[i];
    const nextEvent = allEvents[i + 1];
    const gapStart = currentEvent.end;
    const gapEnd = nextEvent ? nextEvent.start : daySchedule.workEnd;
    
    // Hoppa över om luckan är för liten
    if (gapEnd <= gapStart) continue;
    
    // Beräkna restid från föregående position
    const originAddress = currentEvent.address || daySchedule.technician.address;
    const travelTime = travelTimes.get(originAddress) || DEFAULT_TRAVEL_TIME;
    
    // Tidigaste möjliga start efter restid
    const earliestStart = max([
      addMinutes(gapStart, travelTime),
      daySchedule.workStart
    ]);
    
    const latestStart = min([
      subMinutes(gapEnd, timeSlotDuration),
      lastPossibleStart
    ]);
    
    if (earliestStart < latestStart) {
      const slotEnd = addMinutes(earliestStart, timeSlotDuration);
      
      if (slotEnd <= gapEnd && slotEnd <= daySchedule.workEnd) {
        // Beräkna hur väl luckan utnyttjas
        const gapDuration = (gapEnd.getTime() - gapStart.getTime()) / 60000;
        const usedDuration = timeSlotDuration + travelTime;
        const gapUtilization = Math.min(1, usedDuration / gapDuration);
        
        suggestions.push({
          technician_id: daySchedule.technician.id,
          technician_name: daySchedule.technician.name,
          start_time: earliestStart.toISOString(),
          end_time: slotEnd.toISOString(),
          travel_time_minutes: travelTime,
          origin_description: currentEvent.title || "Föregående ärende",
          efficiency_score: calculateEfficiencyScore(travelTime, false, gapUtilization),
          is_first_job: false
        });
      }
    }
  }
  
  return suggestions;
}

// Huvudfunktion
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
    
    // Validering
    if (!newCaseAddress || !pestType) {
      return res.status(400).json({ error: 'Adress och skadedjurstyp måste anges.' });
    }
    
    if (timeSlotDuration < 30 || timeSlotDuration > 480) {
      return res.status(400).json({ error: 'Arbetstid måste vara mellan 30 minuter och 8 timmar.' });
    }

    // Sätt upp sökperiod
    const searchStart = searchStartDate 
      ? startOfDay(new Date(searchStartDate))
      : startOfDay(new Date());
    const searchEnd = addDays(searchStart, SEARCH_DAYS_LIMIT);
    
    // Hämta kompetent personal
    const allCompetentStaff = await getCompetentStaff(pestType);
    if (allCompetentStaff.length === 0) {
      return res.status(200).json([]);
    }

    // Filtrera baserat på val
    const staffToSearch = selectedTechnicianIds && Array.isArray(selectedTechnicianIds) && selectedTechnicianIds.length > 0
      ? allCompetentStaff.filter(staff => selectedTechnicianIds.includes(staff.id))
      : allCompetentStaff;

    if (staffToSearch.length === 0) {
      return res.status(200).json([]);
    }
    
    // Hämta all nödvändig data
    const staffIds = staffToSearch.map(s => s.id);
    const [schedules, absences] = await Promise.all([
      getSchedules(staffToSearch, searchStart, searchEnd),
      getAbsences(staffIds, searchStart, searchEnd)
    ]);
    
    // Förbered adresser för restidsberäkning
    const allAddresses = new Set<string>();
    staffToSearch.forEach(staff => allAddresses.add(staff.address));
    schedules.forEach(cases => {
      cases.forEach(c => {
        if (c.address) allAddresses.add(c.address);
      });
    });
    
    // Beräkna restider
    const travelTimes = await getTravelTimes(Array.from(allAddresses), newCaseAddress);
    
    // Bygg dagliga scheman
    const dailySchedules = buildDailySchedules(
      staffToSearch,
      schedules,
      absences,
      searchStart,
      searchEnd
    );
    
    // Hitta alla möjliga tidsluckor
    const allSuggestions: Suggestion[] = [];
    
    for (const daySchedule of dailySchedules) {
      const slots = findAvailableSlots(
        daySchedule,
        timeSlotDuration,
        travelTimes
      );
      allSuggestions.push(...slots);
    }
    
    // Sortera och returnera topp 10
    const sortedSuggestions = allSuggestions
      .sort((a, b) => {
        // Primär: Datum/tid
        const timeDiff = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
        if (timeDiff !== 0) return timeDiff;
        
        // Sekundär: Effektivitetspoäng
        return b.efficiency_score - a.efficiency_score;
      })
      .slice(0, 10);
    
    res.status(200).json(sortedSuggestions);

  } catch (error: any) {
    console.error("Fel i bokningsassistent (v5.0):", error);
    res.status(500).json({ 
      error: "Ett internt fel uppstod.", 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
}