// 📁 api/ruttplanerare/assistant-utils.ts
// ⭐ VERSION 1.3 - ÅTERSTÄLLER KORREKT FRÅNVAROHANTERING ⭐

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { addDays, addMinutes, subMinutes, startOfDay, endOfDay, isWithinInterval, max, min, getDay, parse, areIntervalsOverlapping, format as formatDate } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Konfiguration ---
export const TIMEZONE = 'Europe/Stockholm';
export const DEFAULT_TRAVEL_TIME = 30;

// --- Datatyper ---
export type DaySchedule = { start: string; end: string; active: boolean; };
export type WorkSchedule = { monday: DaySchedule; tuesday: DaySchedule; wednesday: DaySchedule; thursday: DaySchedule; friday: DaySchedule; saturday: DaySchedule; sunday: DaySchedule; };
export interface StaffMember { id: string; name: string; address: string; work_schedule: WorkSchedule | null; }
export interface EventSlot { start: Date; end: Date; type: 'case' | 'absence'; title?: string; address?: string; }
export interface AbsencePeriod { start: Date; end: Date; }
export interface TechnicianDaySchedule { technician: StaffMember; date: Date; workStart: Date; workEnd: Date; absences: AbsencePeriod[]; existingCases: EventSlot[]; }
export interface Suggestion { 
  technician_id: string; technician_name: string; start_time: string; end_time: string; 
  travel_time_minutes: number; origin_description: string; efficiency_score: number; 
  is_first_job: boolean; travel_time_home_minutes?: number; 
}
export interface TeamSuggestion {
    technicians: { id: string; name: string; travel_time_minutes: number; origin_description: string; }[];
    start_time: string;
    end_time: string;
    efficiency_score: number;
}


// --- Hjälpfunktioner ---
export const formatAddress = (address: any): string => { if (!address) return ''; if (typeof address === 'object' && address.formatted_address) return address.formatted_address; return String(address); };
export const getDayKey = (date: Date): keyof WorkSchedule => {
    const dayIndex = getDay(date);
    const dayMap: (keyof WorkSchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayMap[dayIndex];
};

// --- Data-hämtning ---
export async function getSchedules(staff: StaffMember[], from: Date, to: Date): Promise<Map<string, EventSlot[]>> {
  const staffIds = staff.map(s => s.id); if (staffIds.length === 0) return new Map();
  const { data, error } = await supabase.from('cases_with_technician_view').select('start_date, due_date, technician_id, adress, title').in('technician_id', staffIds).gte('start_date', from.toISOString()).lte('start_date', to.toISOString()).order('start_date');
  if (error) throw error;
  const schedules = new Map<string, EventSlot[]>(); staff.forEach(s => schedules.set(s.id, []));
  data?.forEach(c => { if(c.start_date && c.due_date && c.technician_id) schedules.get(c.technician_id)?.push({ start: new Date(c.start_date), end: new Date(c.due_date), title: c.title || 'Ärende', address: formatAddress(c.adress), type: 'case' }); });
  return schedules;
}
export async function getAbsences(staffIds: string[], from: Date, to: Date): Promise<Map<string, AbsencePeriod[]>> {
  if (staffIds.length === 0) return new Map();
  const { data, error } = await supabase.from('technician_absences').select('technician_id, start_date, end_date').in('technician_id', staffIds).or(`start_date.lte.${to.toISOString()},end_date.gte.${from.toISOString()}`);
  if (error) throw error;
  const absences = new Map<string, AbsencePeriod[]>(); staffIds.forEach(id => absences.set(id, []));
  data.forEach(a => { absences.get(a.technician_id)?.push({ start: new Date(a.start_date), end: new Date(a.end_date) }); });
  return absences;
}
export async function getCompetentStaff(pestType: string, requiredTechnicianIds?: string[]): Promise<StaffMember[]> {
  let query = supabase.from('staff_competencies').select('technicians(id, name, address, work_schedule)').eq('pest_type', pestType);
  
  if (requiredTechnicianIds && requiredTechnicianIds.length > 0) {
      query = query.in('technicians.id', requiredTechnicianIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  return data.map((s: any) => s.technicians).filter(Boolean).filter(staff => staff.address && typeof staff.address === 'string' && staff.address.trim() !== '');
}
export async function getTravelTimes(origins: string[], destination: string): Promise<Map<string, number>> {
    if (origins.length === 0) return new Map();
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY!;
    const uniqueOrigins = [...new Set(origins)]; const travelTimes = new Map<string, number>();
    for (let i = 0; i < uniqueOrigins.length; i += 25) {
      const batch = uniqueOrigins.slice(i, i + 25);
      const matrixApiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(batch.join('|'))}&destinations=${encodeURIComponent(destination)}&key=${googleMapsApiKey}&mode=driving&language=sv`;
      try {
        const matrixResponse = await fetch(matrixApiUrl); const matrixData = await matrixResponse.json() as any;
        if (matrixData.status !== 'OK') { batch.forEach(origin => travelTimes.set(origin, DEFAULT_TRAVEL_TIME)); continue; }
        matrixData.rows.forEach((row: any, index: number) => { 
          if (row.elements[0].status === 'OK') { travelTimes.set(batch[index], Math.ceil(row.elements[0].duration.value / 60)); } 
          else { travelTimes.set(batch[index], DEFAULT_TRAVEL_TIME); }
        });
      } catch (error) { batch.forEach(origin => travelTimes.set(origin, DEFAULT_TRAVEL_TIME)); }
    }
    return travelTimes;
}

// --- Kärnlogik ---
export function buildDailySchedules(technicians: StaffMember[], schedules: Map<string, EventSlot[]>, absences: Map<string, AbsencePeriod[]>, searchStart: Date, searchEnd: Date): TechnicianDaySchedule[] {
  const dailySchedules: TechnicianDaySchedule[] = [];
  for (const tech of technicians) {
    let currentDate = new Date(searchStart);
    while (currentDate <= searchEnd) {
      const dayKey = getDayKey(currentDate); const daySchedule = tech.work_schedule?.[dayKey];
      if (!daySchedule || !daySchedule.active) { currentDate = addDays(currentDate, 1); continue; }
      
      const dayStart = startOfDay(currentDate); 
      const dayEnd = endOfDay(currentDate);
      const year = currentDate.getUTCFullYear(); const month = currentDate.getUTCMonth(); const day = currentDate.getUTCDate();
      const workStart = fromZonedTime(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} ${daySchedule.start}`, TIMEZONE);
      const workEnd = fromZonedTime(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} ${daySchedule.end}`, TIMEZONE);
      
      const techAbsences = absences.get(tech.id) || [];
      const dayAbsences = techAbsences.filter(a => areIntervalsOverlapping({ start: a.start, end: a.end }, { start: dayStart, end: dayEnd }));
      
      // ✅ KORRIGERING: Den kritiska logiken från din fungerande v6.8 är nu återställd.
      const isFullyAbsent = dayAbsences.some(a => a.start <= workStart && a.end >= workEnd);
      if (isFullyAbsent) { 
          currentDate = addDays(currentDate, 1); 
          continue; // Hoppa över resten av loopen för denna dag.
      }

      const techCases = schedules.get(tech.id) || [];
      const dayCases = techCases.filter(c => isWithinInterval(c.start, { start: dayStart, end: dayEnd }));
      
      dailySchedules.push({ technician: tech, date: currentDate, workStart, workEnd, absences: dayAbsences, existingCases: dayCases });
      currentDate = addDays(currentDate, 1);
    }
  }
  return dailySchedules;
}
export function calculateEfficiencyScore(travelTime: number, isFirstJob: boolean, gapUtilization: number, travelTimeHome?: number): number {
  let score = 0;
  if (isFirstJob) { score = 120 - travelTime;
  } else {
    const travelScore = Math.max(0, 40 - (travelTime * 0.8));
    const utilizationScore = gapUtilization * 40;
    const efficiencyBonus = travelTime <= 15 ? 20 : travelTime <= 25 ? 10 : 0;
    score = travelScore + utilizationScore + efficiencyBonus;
  }
  if (travelTimeHome !== undefined) {
      const homeBonus = Math.max(0, 30 - travelTimeHome);
      score += homeBonus;
  }
  return Math.round(score);
}