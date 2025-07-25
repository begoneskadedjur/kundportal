// api/ruttplanerare/booking-assistant/index.ts
// VERSION 6.2 - KORRIGERAR HANTERING AV LÅNGVARIG FRÅNVARO

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { 
  addDays, 
  addMinutes, 
  subMinutes,
  startOfDay,
  endOfDay,
  isWithinInterval,
  max,
  min,
  getDay,
  parse,
  areIntervalsOverlapping // ✅ NY IMPORT: Korrekt funktion för att kontrollera frånvaro
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Konfiguration ---
const SEARCH_DAYS_LIMIT = 7;
const TIMEZONE = 'Europe/Stockholm';
const DEFAULT_TRAVEL_TIME = 30;
const SUGGESTION_INCREMENT_MINUTES = 15;

// --- Datatyper (matchar er uppdaterade database.ts) ---

type DaySchedule = {
  start: string; "HH:MM";
  end: string;   "HH:MM";
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
  work_schedule: WorkSchedule | null;
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
      schedules.get(c.technician_id)?.push({
        start: new Date(c.start_date),
        end: new Date(c.due_date),
        title: c.title || 'Ärende',
        address: formatAddress(c.adress),
        type: 'case'
      });
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

async function getCompetentStaff(pestType: string): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff_competencies')
    .select('technicians(id, name, address, work_schedule)')
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
    
    for (let i = 0; i < uniqueOrigins.length; i += 25) {
      const batch = uniqueOrigins.slice(i, i + 25);
      const matrixApiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(batch.join('|'))}&destinations=${encodeURIComponent(destination)}&key=${googleMapsApiKey}&mode=driving&language=sv`;
      
      try {
        const matrixResponse = await fetch(matrixApiUrl);
        const matrixData = await matrixResponse.json() as any;
        
        if (matrixData.status !== 'OK') {
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
        batch.forEach(origin => travelTimes.set(origin, DEFAULT_TRAVEL_TIME));
      }
    }
    
    return travelTimes;
}

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

      if (!daySchedule || !daySchedule.active) {
        currentDate = addDays(currentDate, 1);
        continue;
      }
      
      const dayStart = startOfDay(currentDate);
      const dayEnd = endOfDay(currentDate);

      const workStart = toZonedTime(parse(daySchedule.start, 'HH:mm', dayStart), TIMEZONE);
      const workEnd = toZonedTime(parse(daySchedule.end, 'HH:mm', dayStart), TIMEZONE);
      
      const techAbsences = absences.get(tech.id) || [];
      
      // ✅ KORRIGERING: Använder nu areIntervalsOverlapping för att korrekt identifiera all frånvaro.
      const dayAbsences = techAbsences.filter(a => 
        areIntervalsOverlapping(
          { start: a.start, end: a.end },
          { start: dayStart, end: dayEnd }
        )
      );
      
      const isFullyAbsent = dayAbsences.some(a => a.start <= workStart && a.end >= workEnd);
      
      // Hoppa över hela dagen om teknikern är helt frånvarande.
      if (isFullyAbsent) {
          currentDate = addDays(currentDate, 1);
          continue;
      }

      const techCases = schedules.get(tech.id) || [];
      const dayCases = techCases.filter(c => isWithinInterval(c.start, { start: dayStart, end: dayEnd }));
      
      dailySchedules.push({
        technician: tech,
        date: currentDate,
        workStart,
        workEnd,
        absences: dayAbsences, // Skicka med frånvaro som bara är en del av dagen
        existingCases: dayCases,
      });
      
      currentDate = addDays(currentDate, 1);
    }
  }
  
  return dailySchedules;
}

function calculateEfficiencyScore(
  travelTime: number,
  isFirstJob: boolean,
  gapUtilization: number
): number {
  if (isFirstJob) {
    const score = 120 - travelTime;
    return Math.max(0, Math.round(score)); 
  }
  
  const travelScore = Math.max(0, 40 - (travelTime * 0.8));
  const utilizationScore = gapUtilization * 40;
  const efficiencyBonus = travelTime <= 15 ? 20 : travelTime <= 25 ? 10 : 0;
  return Math.round(travelScore + utilizationScore + efficiencyBonus);
}

function findAvailableSlots(
  daySchedule: TechnicianDaySchedule,
  timeSlotDuration: number,
  travelTimes: Map<string, number>
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lastPossibleStartForJob = subMinutes(daySchedule.workEnd, timeSlotDuration);
  
  const virtualStartEvent: EventSlot = {
    start: subMinutes(daySchedule.workStart, 1),
    end: daySchedule.workStart,
    type: 'case',
    title: 'Hemadress',
    address: daySchedule.technician.address
  };
  
  const allEvents = [
    virtualStartEvent,
    ...daySchedule.existingCases,
    ...daySchedule.absences.map(a => ({ start: a.start, end: a.end, type: 'absence' as const, title: 'Frånvaro' }))
  ].sort((a, b) => a.start.getTime() - b.start.getTime());
  
  for (let i = 0; i < allEvents.length; i++) {
    const currentEvent = allEvents[i];
    const nextEvent = allEvents[i + 1];

    const gapStart = currentEvent.end;
    const gapEnd = nextEvent ? nextEvent.start : daySchedule.workEnd;
    
    if (gapEnd <= gapStart) continue;

    const originAddress = currentEvent.address || daySchedule.technician.address;
    const travelTime = travelTimes.get(originAddress) || DEFAULT_TRAVEL_TIME;
    
    let earliestStartInGap = addMinutes(gapStart, travelTime);
    earliestStartInGap = max([earliestStartInGap, daySchedule.workStart]);
    
    let currentTry = earliestStartInGap;

    while (currentTry <= min([subMinutes(gapEnd, timeSlotDuration), lastPossibleStartForJob])) {
      const isFirstJob = (currentEvent.title === 'Hemadress');
      const slotEnd = addMinutes(currentTry, timeSlotDuration);
      
      const gapDuration = (gapEnd.getTime() - gapStart.getTime()) / 60000;
      const usedDuration = timeSlotDuration + (isFirstJob ? 0 : travelTime);
      const gapUtilization = gapDuration > 0 ? Math.min(1, usedDuration / gapDuration) : 1;

      suggestions.push({
        technician_id: daySchedule.technician.id,
        technician_name: daySchedule.technician.name,
        start_time: currentTry.toISOString(),
        end_time: slotEnd.toISOString(),
        travel_time_minutes: travelTime,
        origin_description: currentEvent.title || "Föregående ärende",
        efficiency_score: calculateEfficiencyScore(travelTime, isFirstJob, gapUtilization),
        is_first_job: isFirstJob
      });
      
      currentTry = addMinutes(currentTry, SUGGESTION_INCREMENT_MINUTES);
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
        const timeDiff = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.efficiency_score - a.efficiency_score;
      })
      .slice(0, 15);
    
    res.status(200).json(sortedSuggestions);

  } catch (error: any) {
    console.error("Fel i bokningsassistent (v6.2):", error);
    res.status(500).json({ 
      error: "Ett internt fel uppstod.", 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
}