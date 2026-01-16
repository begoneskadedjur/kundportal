// 📁 api/ruttplanerare/assistant-utils.ts
// ⭐ VERSION 1.5 - Strukturerad origin-data för förbättrad UX ⭐

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
  // Strukturerad origin-data
  origin_address?: string;        // Varifrån teknikern kommer
  origin_case_title?: string;     // Namn på föregående ärende
  origin_end_time?: string;       // ISO-tid när föregående ärende slutar
}
export interface TeamSuggestion {
    technicians: { id: string; name: string; travel_time_minutes: number; origin_description: string; }[];
    start_time: string;
    end_time: string;
    efficiency_score: number;
}


// --- Hjälpfunktioner ---
export const formatAddress = (address: any): string => {
  if (!address) return '';

  // Om det är en sträng som ser ut som JSON, försök parsa den
  if (typeof address === 'string') {
    // Kolla om det är JSON (börjar med { eller ")
    if (address.startsWith('{') || address.startsWith('"')) {
      try {
        const parsed = JSON.parse(address);
        if (parsed && typeof parsed === 'object') {
          // Kolla efter formatted_address i olika strukturer
          if (parsed.formatted_address) return parsed.formatted_address;
          if (parsed.location && parsed.formatted_address) return parsed.formatted_address;
        }
      } catch (e) {
        // Inte giltig JSON, använd som vanlig sträng
      }
    }
    return address;
  }

  // Om det redan är ett objekt
  if (typeof address === 'object') {
    if (address.formatted_address) return address.formatted_address;
    if (address.location && address.formatted_address) return address.formatted_address;
  }

  return String(address);
};
export const getDayKey = (date: Date): keyof WorkSchedule => {
    const dayIndex = getDay(date);
    const dayMap: (keyof WorkSchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayMap[dayIndex];
};

// --- Data-hämtning ---

// Statusar som ska exkluderas från schemaläggning (ärenden som inte blockerar tid)
const EXCLUDED_STATUSES = [
  'Privatperson - review',
  'Stängt - slasklogg',
  'Avslutat'
];

export async function getSchedules(staff: StaffMember[], from: Date, to: Date): Promise<Map<string, EventSlot[]>> {
  const staffIds = staff.map(s => s.id);
  if (staffIds.length === 0) return new Map();

  const schedules = new Map<string, EventSlot[]>();
  staff.forEach(s => schedules.set(s.id, []));

  // Hjälpfunktion för att lägga till ärenden i schemat
  const addToSchedule = (
    techId: string | null,
    eventSlot: EventSlot
  ) => {
    if (techId && staffIds.includes(techId)) {
      schedules.get(techId)?.push(eventSlot);
    }
  };

  // 1. Hämta från private_cases (ClickUp privatpersoner)
  // Exkludera stängda/avslutade statusar
  const { data: privateCases, error: privateError } = await supabase
    .from('private_cases')
    .select('start_date, due_date, primary_assignee_id, secondary_assignee_id, tertiary_assignee_id, adress, title, status')
    .or(`primary_assignee_id.in.(${staffIds.join(',')}),secondary_assignee_id.in.(${staffIds.join(',')}),tertiary_assignee_id.in.(${staffIds.join(',')})`)
    .gte('start_date', from.toISOString())
    .lte('start_date', to.toISOString())
    .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`);

  if (privateError) {
    console.error('Error fetching private_cases:', privateError);
  } else {
    console.log(`[getSchedules] Hämtade ${privateCases?.length || 0} private_cases`);
    privateCases?.forEach(c => {
      if (c.start_date && c.due_date) {
        const start = new Date(c.start_date);
        const end = new Date(c.due_date);
        // Ignorera ärenden utan riktig tid (00:00 till 00:00 = 0 min)
        const durationMinutes = (end.getTime() - start.getTime()) / 60000;
        if (durationMinutes <= 0) {
          console.log(`[getSchedules] Ignorerar "${c.title}" - ingen tid satt (${c.start_date} -> ${c.due_date})`);
          return;
        }
        const eventSlot: EventSlot = {
          start,
          end,
          title: c.title || 'Privat ärende',
          address: formatAddress(c.adress),
          type: 'case'
        };
        addToSchedule(c.primary_assignee_id, eventSlot);
        addToSchedule(c.secondary_assignee_id, eventSlot);
        addToSchedule(c.tertiary_assignee_id, eventSlot);
      }
    });
  }

  // 2. Hämta från business_cases (ClickUp företag)
  // Exkludera stängda/avslutade statusar
  const { data: businessCases, error: businessError } = await supabase
    .from('business_cases')
    .select('start_date, due_date, primary_assignee_id, secondary_assignee_id, tertiary_assignee_id, adress, title, status')
    .or(`primary_assignee_id.in.(${staffIds.join(',')}),secondary_assignee_id.in.(${staffIds.join(',')}),tertiary_assignee_id.in.(${staffIds.join(',')})`)
    .gte('start_date', from.toISOString())
    .lte('start_date', to.toISOString())
    .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`);

  if (businessError) {
    console.error('Error fetching business_cases:', businessError);
  } else {
    console.log(`[getSchedules] Hämtade ${businessCases?.length || 0} business_cases`);
    businessCases?.forEach(c => {
      if (c.start_date && c.due_date) {
        const start = new Date(c.start_date);
        const end = new Date(c.due_date);
        // Ignorera ärenden utan riktig tid (00:00 till 00:00 = 0 min)
        const durationMinutes = (end.getTime() - start.getTime()) / 60000;
        if (durationMinutes <= 0) {
          console.log(`[getSchedules] Ignorerar "${c.title}" - ingen tid satt (${c.start_date} -> ${c.due_date})`);
          return;
        }
        const eventSlot: EventSlot = {
          start,
          end,
          title: c.title || 'Företagsärende',
          address: formatAddress(c.adress),
          type: 'case'
        };
        addToSchedule(c.primary_assignee_id, eventSlot);
        addToSchedule(c.secondary_assignee_id, eventSlot);
        addToSchedule(c.tertiary_assignee_id, eventSlot);
      }
    });
  }

  // 3. Hämta från cases (Avtalskunder - direkt från tabell, inte vy)
  // Exkludera avslutade ärenden
  const { data: contractCases, error: contractError } = await supabase
    .from('cases')
    .select('scheduled_start, scheduled_end, primary_technician_id, secondary_technician_id, tertiary_technician_id, address, title, status')
    .or(`primary_technician_id.in.(${staffIds.join(',')}),secondary_technician_id.in.(${staffIds.join(',')}),tertiary_technician_id.in.(${staffIds.join(',')})`)
    .gte('scheduled_start', from.toISOString())
    .lte('scheduled_start', to.toISOString())
    .neq('status', 'Avslutat');

  if (contractError) {
    console.error('Error fetching cases:', contractError);
  } else {
    console.log(`[getSchedules] Hämtade ${contractCases?.length || 0} contract cases`);
    contractCases?.forEach(c => {
      if (c.scheduled_start && c.scheduled_end) {
        const start = new Date(c.scheduled_start);
        const end = new Date(c.scheduled_end);
        // Ignorera ärenden utan riktig tid
        const durationMinutes = (end.getTime() - start.getTime()) / 60000;
        if (durationMinutes <= 0) {
          console.log(`[getSchedules] Ignorerar "${c.title}" - ingen tid satt`);
          return;
        }
        const eventSlot: EventSlot = {
          start,
          end,
          title: c.title || 'Avtalsärende',
          address: formatAddress(c.address),
          type: 'case'
        };
        addToSchedule(c.primary_technician_id, eventSlot);
        addToSchedule(c.secondary_technician_id, eventSlot);
        addToSchedule(c.tertiary_technician_id, eventSlot);
      }
    });
  }

  // Logga för debugging
  let totalCases = 0;
  schedules.forEach((cases, techId) => {
    totalCases += cases.length;
  });
  console.log(`[getSchedules] Hämtade ${totalCases} ärenden för ${staffIds.length} tekniker (${from.toISOString().split('T')[0]} - ${to.toISOString().split('T')[0]})`);

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
  // Hämta kompetenser med tekniker-data, filtrera på aktiva tekniker
  let query = supabase
    .from('staff_competencies')
    .select('technicians!inner(id, name, address, work_schedule, is_active)')
    .eq('pest_type', pestType)
    .eq('technicians.is_active', true);  // ⭐ Endast aktiva tekniker

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
    const travelTimes = new Map<string, number>();

    // Normalisera destination för jämförelse
    const normalizedDestination = formatAddress(destination).toLowerCase().trim();

    // Filtrera bort origins som är samma som destination (restid = 1 min)
    const originsNeedingLookup: string[] = [];
    const uniqueOrigins = [...new Set(origins)];

    for (const origin of uniqueOrigins) {
        const normalizedOrigin = formatAddress(origin).toLowerCase().trim();
        if (normalizedOrigin === normalizedDestination) {
            // Samma adress = 1 minut (för parkering/gång mellan ingångar)
            travelTimes.set(origin, 1);
            console.log(`[getTravelTimes] Samma adress detekterad: "${origin}" -> 1 min`);
        } else {
            originsNeedingLookup.push(origin);
        }
    }

    // Om alla adresser var samma, returnera direkt
    if (originsNeedingLookup.length === 0) {
        return travelTimes;
    }

    // Hämta restider från Google Maps för resterande adresser
    for (let i = 0; i < originsNeedingLookup.length; i += 25) {
      const batch = originsNeedingLookup.slice(i, i + 25);
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