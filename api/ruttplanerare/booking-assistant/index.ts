// api/ruttplanerare/booking-assistant/index.ts
// VERSION 6.4 - IMPLEMENTERAR INTELLIGENT GRUPPERING OCH BALANSERADE FÖRSLAG

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
  areIntervalsOverlapping
} from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Konfiguration ---
const SEARCH_DAYS_LIMIT = 7;
const TIMEZONE = 'Europe/Stockholm';
const DEFAULT_TRAVEL_TIME = 30;
const SUGGESTION_STRIDE_MINUTES = 60; // ✅ Generera förslag på varje heltimme
const MAX_SUGGESTIONS_TOTAL = 20; // Totalt antal förslag att visa
const MAX_SUGGESTIONS_PER_TECH_DAY_HIGH_SCORE = 5; // Max förslag för en bra tekniker
const MAX_SUGGESTIONS_PER_TECH_DAY_LOW_SCORE = 2; // Max förslag för en sämre tekniker
const HIGH_SCORE_THRESHOLD = 80; // Gräns för vad som är ett "bra" betyg

// --- Datatyper ---
type DaySchedule = { start: string; end: string; active: boolean; };
type WorkSchedule = { monday: DaySchedule; tuesday: DaySchedule; wednesday: DaySchedule; thursday: DaySchedule; friday: DaySchedule; saturday: DaySchedule; sunday: DaySchedule; };
interface StaffMember { id: string; name: string; address: string; work_schedule: WorkSchedule | null; }
interface EventSlot { start: Date; end: Date; type: 'case' | 'absence'; title?: string; address?: string; }
interface AbsencePeriod { start: Date; end: Date; }
interface TechnicianDaySchedule { technician: StaffMember; date: Date; workStart: Date; workEnd: Date; absences: AbsencePeriod[]; existingCases: EventSlot[]; }
interface Suggestion { technician_id: string; technician_name: string; start_time: string; end_time: string; travel_time_minutes: number; origin_description: string; efficiency_score: number; is_first_job: boolean; }

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

// --- Data-hämtning (oförändrad) ---
async function getSchedules(staff: StaffMember[], from: Date, to: Date): Promise<Map<string, EventSlot[]>> {
  const staffIds = staff.map(s => s.id); if (staffIds.length === 0) return new Map();
  const { data, error } = await supabase.from('cases_with_technician_view').select('start_date, due_date, technician_id, adress, title').in('technician_id', staffIds).gte('start_date', from.toISOString()).lte('start_date', to.toISOString()).order('start_date');
  if (error) throw error;
  const schedules = new Map<string, EventSlot[]>(); staff.forEach(s => schedules.set(s.id, []));
  data?.forEach(c => { if(c.start_date && c.due_date && c.technician_id) schedules.get(c.technician_id)?.push({ start: new Date(c.start_date), end: new Date(c.due_date), title: c.title || 'Ärende', address: formatAddress(c.adress), type: 'case' }); });
  return schedules;
}
async function getAbsences(staffIds: string[], from: Date, to: Date): Promise<Map<string, AbsencePeriod[]>> {
  if (staffIds.length === 0) return new Map();
  const { data, error } = await supabase.from('technician_absences').select('technician_id, start_date, end_date').in('technician_id', staffIds).or(`start_date.lte.${to.toISOString()},end_date.gte.${from.toISOString()}`);
  if (error) throw error;
  const absences = new Map<string, AbsencePeriod[]>(); staffIds.forEach(id => absences.set(id, []));
  data.forEach(a => { absences.get(a.technician_id)?.push({ start: new Date(a.start_date), end: new Date(a.end_date) }); });
  return absences;
}
async function getCompetentStaff(pestType: string): Promise<StaffMember[]> {
  const { data, error } = await supabase.from('staff_competencies').select('technicians(id, name, address, work_schedule)').eq('pest_type', pestType);
  if (error) throw error;
  return data.map((s: any) => s.technicians).filter(Boolean).filter(staff => staff.address && typeof staff.address === 'string' && staff.address.trim() !== '');
}
async function getTravelTimes(origins: string[], destination: string): Promise<Map<string, number>> {
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

// --- Kärnlogik (uppdaterad) ---

function buildDailySchedules(technicians: StaffMember[], schedules: Map<string, EventSlot[]>, absences: Map<string, AbsencePeriod[]>, searchStart: Date, searchEnd: Date): TechnicianDaySchedule[] {
  const dailySchedules: TechnicianDaySchedule[] = [];
  for (const tech of technicians) {
    let currentDate = new Date(searchStart);
    while (currentDate <= searchEnd) {
      const dayKey = getDayKey(currentDate); const daySchedule = tech.work_schedule?.[dayKey];
      if (!daySchedule || !daySchedule.active) { currentDate = addDays(currentDate, 1); continue; }
      const dayStart = startOfDay(currentDate); const dayEnd = endOfDay(currentDate);
      const year = currentDate.getUTCFullYear(); const month = currentDate.getUTCMonth(); const day = currentDate.getUTCDate();
      const workStart = fromZonedTime(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} ${daySchedule.start}`, TIMEZONE);
      const workEnd = fromZonedTime(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} ${daySchedule.end}`, TIMEZONE);
      const techAbsences = absences.get(tech.id) || [];
      const dayAbsences = techAbsences.filter(a => areIntervalsOverlapping({ start: a.start, end: a.end }, { start: dayStart, end: dayEnd }));
      const isFullyAbsent = dayAbsences.some(a => a.start <= workStart && a.end >= workEnd);
      if (isFullyAbsent) { currentDate = addDays(currentDate, 1); continue; }
      const techCases = schedules.get(tech.id) || [];
      const dayCases = techCases.filter(c => isWithinInterval(c.start, { start: dayStart, end: dayEnd }));
      dailySchedules.push({ technician: tech, date: currentDate, workStart, workEnd, absences: dayAbsences, existingCases: dayCases });
      currentDate = addDays(currentDate, 1);
    }
  }
  return dailySchedules;
}

function calculateEfficiencyScore(travelTime: number, isFirstJob: boolean, gapUtilization: number): number {
  if (isFirstJob) { return Math.max(0, Math.round(120 - travelTime)); }
  const travelScore = Math.max(0, 40 - (travelTime * 0.8));
  const utilizationScore = gapUtilization * 40;
  const efficiencyBonus = travelTime <= 15 ? 20 : travelTime <= 25 ? 10 : 0;
  return Math.round(travelScore + utilizationScore + efficiencyBonus);
}

/**
 * ✅ FÖRBÄTTRAD: Genererar nu förslag på varje heltimme för att fylla lediga dagar.
 */
function findAvailableSlots(daySchedule: TechnicianDaySchedule, timeSlotDuration: number, travelTimes: Map<string, number>): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const lastPossibleStartForJob = subMinutes(daySchedule.workEnd, timeSlotDuration);
  const virtualStartEvent: EventSlot = { start: subMinutes(daySchedule.workStart, 1), end: daySchedule.workStart, type: 'case', title: 'Hemadress', address: daySchedule.technician.address };
  const allEvents = [ virtualStartEvent, ...daySchedule.existingCases, ...daySchedule.absences.map(a => ({ start: a.start, end: a.end, type: 'absence' as const, title: 'Frånvaro' })) ].sort((a, b) => a.start.getTime() - b.start.getTime());
  
  for (let i = 0; i < allEvents.length; i++) {
    const currentEvent = allEvents[i]; const nextEvent = allEvents[i + 1];
    const gapStart = currentEvent.end; const gapEnd = nextEvent ? nextEvent.start : daySchedule.workEnd;
    if (gapEnd <= gapStart) continue;

    const travelTime = travelTimes.get(currentEvent.address || daySchedule.technician.address) || DEFAULT_TRAVEL_TIME;
    const isFirstJob = (currentEvent.title === 'Hemadress');
    let currentTry = isFirstJob ? daySchedule.workStart : max([addMinutes(gapStart, travelTime), daySchedule.workStart]);
    const absoluteLatestStart = min([subMinutes(gapEnd, timeSlotDuration), lastPossibleStartForJob]);

    while (currentTry <= absoluteLatestStart) {
      const slotEnd = addMinutes(currentTry, timeSlotDuration);
      const gapDuration = (gapEnd.getTime() - gapStart.getTime()) / 60000;
      const usedDuration = timeSlotDuration + (isFirstJob ? 0 : travelTime);
      const gapUtilization = gapDuration > 0 ? Math.min(1, usedDuration / gapDuration) : 1;
      suggestions.push({
        technician_id: daySchedule.technician.id, technician_name: daySchedule.technician.name,
        start_time: currentTry.toISOString(), end_time: slotEnd.toISOString(),
        travel_time_minutes: travelTime, origin_description: currentEvent.title || "Föregående ärende",
        efficiency_score: calculateEfficiencyScore(travelTime, isFirstJob, gapUtilization), is_first_job: isFirstJob
      });
      currentTry = addMinutes(currentTry, SUGGESTION_STRIDE_MINUTES); // Stega fram en timme
    }
  }
  return suggestions;
}

// --- Huvudfunktion ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Endast POST är tillåtet' }); }

  try {
    const { newCaseAddress, pestType, timeSlotDuration = 60, searchStartDate, selectedTechnicianIds } = req.body;
    if (!newCaseAddress || !pestType) { return res.status(400).json({ error: 'Adress och skadedjurstyp måste anges.' }); }
    if (timeSlotDuration < 30 || timeSlotDuration > 480) { return res.status(400).json({ error: 'Arbetstid måste vara mellan 30 minuter och 8 timmar.' }); }

    const searchStart = searchStartDate ? startOfDay(new Date(searchStartDate)) : startOfDay(new Date());
    const searchEnd = addDays(searchStart, SEARCH_DAYS_LIMIT);
    const allCompetentStaff = await getCompetentStaff(pestType);
    if (allCompetentStaff.length === 0) { return res.status(200).json([]); }

    const staffToSearch = selectedTechnicianIds?.length > 0 ? allCompetentStaff.filter(staff => selectedTechnicianIds.includes(staff.id)) : allCompetentStaff;
    if (staffToSearch.length === 0) { return res.status(200).json([]); }
    
    const staffIds = staffToSearch.map(s => s.id);
    const [schedules, absences] = await Promise.all([ getSchedules(staffToSearch, searchStart, searchEnd), getAbsences(staffIds, searchStart, searchEnd) ]);
    const allAddresses = new Set<string>(staffToSearch.map(s => s.address).filter(Boolean));
    schedules.forEach(cases => cases.forEach(c => { if (c.address) allAddresses.add(c.address); }));
    
    const travelTimes = await getTravelTimes(Array.from(allAddresses), newCaseAddress);
    const dailySchedules = buildDailySchedules(staffToSearch, schedules, absences, searchStart, searchEnd);
    
    let allSuggestions: Suggestion[] = [];
    for (const daySchedule of dailySchedules) {
      allSuggestions.push(...findAvailableSlots(daySchedule, timeSlotDuration, travelTimes));
    }
    
    // ✅ NYTT: Intelligent gruppering och filtrering för en balanserad lista.
    const groupedByDayAndTech = allSuggestions.reduce((acc, sugg) => {
        const day = sugg.start_time.split('T')[0];
        const key = `${day}-${sugg.technician_id}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(sugg);
        return acc;
    }, {} as Record<string, Suggestion[]>);

    let balancedSuggestions: Suggestion[] = [];
    for (const key in groupedByDayAndTech) {
        const group = groupedByDayAndTech[key].sort((a,b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        const score = group[0].efficiency_score;
        const limit = score >= HIGH_SCORE_THRESHOLD ? MAX_SUGGESTIONS_PER_TECH_DAY_HIGH_SCORE : MAX_SUGGESTIONS_PER_TECH_DAY_LOW_SCORE;
        balancedSuggestions.push(...group.slice(0, limit));
    }
    
    const sortedSuggestions = balancedSuggestions
      .sort((a, b) => {
        const dateA = new Date(a.start_time).setHours(0,0,0,0);
        const dateB = new Date(b.start_time).setHours(0,0,0,0);
        if (dateA !== dateB) return dateA - dateB; // Sortera på dag först
        if (a.efficiency_score !== b.efficiency_score) return b.efficiency_score - a.efficiency_score; // Sen på betyg
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime(); // Slutligen på tid
      })
      .slice(0, MAX_SUGGESTIONS_TOTAL);
    
    res.status(200).json(sortedSuggestions);

  } catch (error: any) {
    console.error("Fel i bokningsassistent (v6.4):", error);
    res.status(500).json({ error: "Ett internt fel uppstod.", details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}