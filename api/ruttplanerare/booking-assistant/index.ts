// api/ruttplanerare/booking-assistant/index.ts
// VERSION 5.2 - FÖRBÄTTRAD LUCKSÖKNING OCH RESTIDSPRIORITERING

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
const SEARCH_DAYS_LIMIT = 7;
const TIMEZONE = 'Europe/Stockholm';
const DEFAULT_TRAVEL_TIME = 30;
const TIME_SLOT_INTERVAL = 30; // Generera förslag var 30:e minut

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

interface TimeGap {
  start: Date;
  end: Date;
  previousEvent?: EventSlot;
  isFirstOfDay: boolean;
}

// --- Hjälpfunktioner ---
const formatAddress = (address: any): string => { 
  if (!address) return ''; 
  if (typeof address === 'object' && address.formatted_address) return address.formatted_address; 
  return String(address); 
};

const toStockholmTime = (date: Date): Date => {
  return toZonedTime(date, TIMEZONE);
};

const fromStockholmTime = (date: Date): Date => {
  return fromZonedTime(date, TIMEZONE);
};

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

async function getTravelTimes(origins: string[], destination: string): Promise<Map<string, number>> {
  if (origins.length === 0) return new Map();
  
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY!;
  const uniqueOrigins = [...new Set(origins)];
  const travelTimes = new Map<string, number>();
  
  for (let i = 0; i < uniqueOrigins.length; i += 25) {
    const batch = uniqueOrigins.slice(i, i + 25);
    const matrixApiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(batch.join('|'))}&destinations=${encodeURIComponent(destination)}&key=${googleMapsApiKey}&mode=driving&language=sv&units=metric`;
    
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
      if (isWeekend(currentDate)) {
        currentDate = addDays(currentDate, 1);
        continue;
      }
      
      const workHours = createWorkHours(currentDate);
      const dayStart = startOfDay(currentDate);
      const dayEnd = endOfDay(currentDate);
      
      const techAbsences = absences.get(tech.id) || [];
      const dayAbsences = techAbsences.filter(a => isWithinInterval(dayStart, { start: a.start, end: a.end }) );
      
      const isFullyAbsent = dayAbsences.some(a => a.isFullDay);
      
      if (!isFullyAbsent) {
        const techCases = schedules.get(tech.id) || [];
        const dayCases = techCases.filter(c => c.start >= dayStart && c.start < dayEnd);
        
        dailySchedules.push({
          technician: tech,
          date: currentDate,
          isAvailable: true,
          absences: dayAbsences.filter(a => !a.isFullDay),
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

// UPPDATERAD: Kraftigare viktning för kort restid
function calculateEfficiencyScore(
  travelTime: number,
  isFirstJob: boolean,
  timeOfDay: number // 8-17
): number {
  if (isFirstJob && timeOfDay === 8) return 100;
  
  // Kraftig viktning för kort restid (0-60 poäng)
  let travelScore = 0;
  if (travelTime <= 10) travelScore = 60;
  else if (travelTime <= 20) travelScore = 50;
  else if (travelTime <= 30) travelScore = 40;
  else if (travelTime <= 45) travelScore = 25;
  else if (travelTime <= 60) travelScore = 10;
  else travelScore = Math.max(0, 5 - (travelTime - 60) / 10);
  
  // Tidspoäng - prioritera tidigare tider (0-30 poäng)
  const timeScore = Math.max(0, 30 - (timeOfDay - 8) * 3);
  
  // Bonus för att packa ihop ärenden tidigt på dagen (0-10 poäng)
  const packingBonus = timeOfDay <= 12 ? 10 : 0;
  
  return Math.round(travelScore + timeScore + packingBonus);
}

// NY FUNKTION: Hitta alla luckor i ett schema
function findTimeGaps(daySchedule: TechnicianDaySchedule): TimeGap[] {
  const gaps: TimeGap[] = [];
  const allEvents = [
    ...daySchedule.existingCases,
    ...daySchedule.absences.map(a => ({
      start: a.start,
      end: a.end,
      type: 'absence' as const,
      title: 'Frånvaro',
      address: undefined
    }))
  ].sort((a, b) => a.start.getTime() - b.start.getTime());
  
  let currentTime = daySchedule.workStart;
  let previousEvent: EventSlot | undefined = undefined;
  
  // Kontrollera lucka i början av dagen
  if (allEvents.length === 0 || allEvents[0].start > daySchedule.workStart) {
    gaps.push({
      start: daySchedule.workStart,
      end: allEvents.length > 0 ? allEvents[0].start : daySchedule.workEnd,
      previousEvent: undefined,
      isFirstOfDay: true
    });
  }
  
  // Hitta luckor mellan event
  for (let i = 0; i < allEvents.length; i++) {
    const currentEvent = allEvents[i];
    
    // Lucka före detta event
    if (currentEvent.start > currentTime) {
      gaps.push({
        start: currentTime,
        end: currentEvent.start,
        previousEvent: previousEvent,
        isFirstOfDay: currentTime.getTime() === daySchedule.workStart.getTime()
      });
    }
    
    currentTime = currentEvent.end;
    previousEvent = currentEvent;
  }
  
  // Lucka efter sista event
  if (currentTime < daySchedule.workEnd) {
    gaps.push({
      start: currentTime,
      end: daySchedule.workEnd,
      previousEvent: previousEvent,
      isFirstOfDay: false
    });
  }
  
  return gaps;
}

// HELT NY findAvailableSlots funktion
function findAvailableSlots(
  daySchedule: TechnicianDaySchedule,
  timeSlotDuration: number,
  travelTimes: Map<string, number>
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const gaps = findTimeGaps(daySchedule);
  
  for (const gap of gaps) {
    const gapDurationMinutes = (gap.end.getTime() - gap.start.getTime()) / 60000;
    
    // Hoppa över för små luckor
    if (gapDurationMinutes < timeSlotDuration) continue;
    
    // Beräkna restid och tidigaste start
    let travelTime = 0;
    let earliestStart = gap.start;
    let originDescription = "";
    
    if (gap.isFirstOfDay) {
      // Första jobbet - ingen påverkan på starttid men visa restid
      travelTime = travelTimes.get(daySchedule.technician.address) || DEFAULT_TRAVEL_TIME;
      originDescription = "Hemadress";
    } else if (gap.previousEvent) {
      // Efter ett tidigare event
      const originAddress = gap.previousEvent.address || daySchedule.technician.address;
      travelTime = travelTimes.get(originAddress) || DEFAULT_TRAVEL_TIME;
      earliestStart = max([
        addMinutes(gap.start, travelTime),
        gap.start
      ]);
      originDescription = gap.previousEvent.title || "Föregående ärende";
    }
    
    // Generera alla möjliga starttider i denna lucka
    let possibleStart = earliestStart;
    const lastPossibleStart = subMinutes(gap.end, timeSlotDuration);
    
    while (possibleStart <= lastPossibleStart) {
      const endTime = addMinutes(possibleStart, timeSlotDuration);
      
      // Kontrollera att sluttiden inte går över luckans slut eller arbetsdagens slut
      if (endTime <= gap.end && endTime <= daySchedule.workEnd) {
        const hour = toStockholmTime(possibleStart).getHours();
        
        suggestions.push({
          technician_id: daySchedule.technician.id,
          technician_name: daySchedule.technician.name,
          start_time: possibleStart.toISOString(),
          end_time: endTime.toISOString(),
          travel_time_minutes: travelTime,
          origin_description: gap.isFirstOfDay && possibleStart.getTime() === daySchedule.workStart.getTime() 
            ? "Första jobbet kl 08:00" 
            : originDescription,
          efficiency_score: calculateEfficiencyScore(
            travelTime, 
            gap.isFirstOfDay && possibleStart.getTime() === daySchedule.workStart.getTime(),
            hour
          ),
          is_first_job: gap.isFirstOfDay && possibleStart.getTime() === daySchedule.workStart.getTime()
        });
      }
      
      // Flytta fram till nästa möjliga starttid
      possibleStart = addMinutes(possibleStart, TIME_SLOT_INTERVAL);
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
    
    // UPPDATERAD SORTERING: Prioritera kort restid mycket högre
    const sortedSuggestions = allSuggestions
      .sort((a, b) => {
        // Först sortera på dag
        const dayA = startOfDay(new Date(a.start_time)).getTime();
        const dayB = startOfDay(new Date(b.start_time)).getTime();
        if (dayA !== dayB) return dayA - dayB;
        
        // Inom samma dag, prioritera kraftigt baserat på restid
        const travelDiff = a.travel_time_minutes - b.travel_time_minutes;
        
        // Om restidsskillnaden är stor (>20 min), använd bara restid
        if (Math.abs(travelDiff) > 20) return travelDiff;
        
        // Annars använd effektivitetspoäng
        return b.efficiency_score - a.efficiency_score;
      })
      .slice(0, 20); // Visa fler förslag för bättre översikt
    
    res.status(200).json(sortedSuggestions);

  } catch (error: any) {
    console.error("Fel i bokningsassistent (v5.2):", error);
    res.status(500).json({ 
      error: "Ett internt fel uppstod.", 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
}