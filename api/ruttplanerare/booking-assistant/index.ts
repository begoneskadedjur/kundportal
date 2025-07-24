// api/ruttplanerare/booking-assistant/index.ts
// VERSION 3.3 – ÅTGÄRDAD FÖRSTA ÄRENDE (0 RESTID) OCH HELGDAGAR

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Konfiguration ---
const WORK_DAY_START_HOUR = 8;
const WORK_DAY_END_HOUR = 17;
const SEARCH_DAYS_LIMIT = 14;

// --- Datatyper och hjälpfunktioner ---
interface StaffMember { id: string; name: string; address: string; }
interface TimeSlot { start: Date; end: Date; }
interface CaseInfo extends TimeSlot { title: string; adress: any; }
interface Suggestion {
  technician_id: string;
  technician_name: string;
  start_time: string;
  end_time: string;
  travel_time_minutes: number;
  origin_description: string;
}
const formatAddress = (address: any): string => {
  if (!address) return '';
  if (typeof address === 'object' && address.formatted_address) return address.formatted_address;
  return String(address);
};
const doTimeSlotsOverlap = (a: TimeSlot, b: TimeSlot): boolean =>
  a.start < b.end && a.end > b.start;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Endast POST är tillåtet' });
  }

  try {
    const {
      newCaseAddress,
      pestType,
      timeSlotDuration = 120,
      searchStartDate
    } = req.body;
    if (!newCaseAddress || !pestType) {
      return res.status(400).json({ error: 'Adress och skadedjurstyp måste anges.' });
    }

    const competentStaff = await getCompetentStaff(pestType);
    if (competentStaff.length === 0) {
      return res.status(200).json([]);
    }

    const startDate = searchStartDate ? new Date(searchStartDate) : new Date();
    startDate.setHours(0, 0, 0, 0);

    const fourteenDaysFromStart = new Date(startDate);
    fourteenDaysFromStart.setDate(startDate.getDate() + SEARCH_DAYS_LIMIT);

    const schedules = await getSchedules(competentStaff, startDate, fourteenDaysFromStart);

    const allKnownAddresses = getOrigins(
      competentStaff,
      Array.from(schedules.values()).flat()
    );
    const travelTimes = await getTravelTimes(allKnownAddresses, newCaseAddress);

    let allSuggestions: Suggestion[] = [];

    for (let i = 0; i < SEARCH_DAYS_LIMIT; i++) {
      const currentDay = new Date(startDate);
      currentDay.setDate(startDate.getDate() + i);

      // --- FIX: IGNORERA HELGDAGAR ---
      const dayOfWeek = currentDay.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      for (const staff of competentStaff) {
        const techSchedule = (schedules.get(staff.id) || []).sort(
          (a, b) => a.start.getTime() - b.start.getTime()
        );

        const workDayStart = new Date(currentDay);
        workDayStart.setHours(WORK_DAY_START_HOUR, 0, 0, 0);
        const workDayEnd = new Date(currentDay);
        workDayEnd.setHours(WORK_DAY_END_HOUR, 0, 0, 0);

        // --- STARTA OCH SLUTA HÄNDELSER FÖR LUCKSÖKNING ---
        const events: TimeSlot[] = [
          { start: new Date(0), end: workDayStart },    // fiktivt "hemifrån"
          ...techSchedule,                              // verkliga ärenden
          { start: workDayEnd, end: new Date(workDayEnd.getTime() + 1) } // fiktivt slut
        ];

        // --- HITTA LEDIGA LUCKOR ---
        for (let j = 0; j < events.length - 1; j++) {
          const previousEvent = events[j];
          const nextEvent = events[j + 1];

          // Var är teknikern innan denna lucka?
          const originDescription =
            (previousEvent as CaseInfo).title || 'Hemadress';
          const originAddress =
            (previousEvent as CaseInfo).adress || staff.address;

          // --- FIX: 0 min restid för första luckan, annars normalt ---
          const isFirstSlot = j === 0;
          const travelTimeFromPrev = isFirstSlot
            ? 0
            : travelTimes.get(formatAddress(originAddress)) ?? 999;
          if (!isFirstSlot && travelTimeFromPrev === 999) continue;

          // När kan teknikern vara framme?
          const arrivalTime = new Date(
            previousEvent.end.getTime() + travelTimeFromPrev * 60000
          );
          // Börja tidigast kl. 08:00
          const potentialStartTime = new Date(
            Math.max(arrivalTime.getTime(), workDayStart.getTime())
          );
          const potentialEndTime = new Date(
            potentialStartTime.getTime() + timeSlotDuration * 60000
          );

          // Rymmer luckan helt?
          if (potentialEndTime.getTime() <= nextEvent.start.getTime()) {
            allSuggestions.push({
              technician_id: staff.id,
              technician_name: staff.name,
              start_time: potentialStartTime.toISOString(),
              end_time: potentialEndTime.toISOString(),
              travel_time_minutes: travelTimeFromPrev,
              origin_description: originDescription
            });
          }
        }
      }
    }

    // --- UNIKA OCH SORTERA ---
    const unique = new Map<string, Suggestion>();
    allSuggestions.forEach(s => {
      const key = `${s.technician_id}-${s.start_time}`;
      if (!unique.has(key)) unique.set(key, s);
    });
    const sorted = Array.from(unique.values())
      .sort((a, b) => a.travel_time_minutes - b.travel_time_minutes)
      .sort(
        (a, b) =>
          new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );

    res.status(200).json(sorted.slice(0, 5));
  } catch (err: any) {
    console.error('Fel i bokningsassistent:', err);
    res.status(500).json({ error: 'Ett internt fel uppstod.', details: err.message });
  }
}

// --- HJÄLPFUNKTIONER (Oförändrade) ---
async function getCompetentStaff(pestType: string): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff_competencies')
    .select('technicians(id, name, address)')
    .eq('pest_type', pestType);
  if (error) throw error;
  return data
    .map((s: any) => s.technicians)
    .filter(
      (staff: StaffMember) =>
        staff.address && typeof staff.address === 'string' && staff.address.trim() !== ''
    );
}

async function getSchedules(
  staff: StaffMember[],
  from: Date,
  to: Date
): Promise<Map<string, CaseInfo[]>> {
  const ids = staff.map(s => s.id);
  const { data, error } = await supabase
    .from('cases_with_technician_view')
    .select('start_date, due_date, technician_id, adress, title')
    .in('technician_id', ids)
    .gte('start_date', from.toISOString())
    .lte('start_date', to.toISOString());
  if (error) throw error;
  const map = new Map<string, CaseInfo[]>();
  staff.forEach(s => map.set(s.id, []));
  data.forEach((c: any) => {
    if (c.start_date && c.due_date) {
      map.get(c.technician_id)?.push({
        start: new Date(c.start_date),
        end: new Date(c.due_date),
        title: c.title,
        adress: c.adress
      });
    }
  });
  return map;
}

function getOrigins(staff: StaffMember[], cases: CaseInfo[]): string[] {
  const sa = staff.map(s => s.address);
  const ca = cases.map(c => formatAddress(c.adress));
  return Array.from(new Set([...sa, ...ca]));
}

async function getTravelTimes(
  origins: string[],
  destination: string
): Promise<Map<string, number>> {
  if (origins.length === 0) return new Map();
  const key = process.env.GOOGLE_MAPS_API_KEY!;
  const unique = Array.from(new Set(origins));
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${unique.join(
    '|'
  )}&destinations=${destination}&key=${key}`;

  const resp = await fetch(url);
  const data = (await resp.json()) as any;
  if (data.status !== 'OK') {
    console.error('Google Maps API Error:', data.error_message || data.status);
    throw new Error(`Google Maps API fel: ${data.error_message || data.status}`);
  }

  const result = new Map<string, number>();
  data.rows.forEach((row: any, i: number) => {
    if (row.elements[0].status === 'OK') {
      result.set(unique[i], Math.round(row.elements[0].duration.value / 60));
    }
  });
  return result;
}
