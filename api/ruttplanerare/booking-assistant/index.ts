// api/ruttplanerare/booking-assistant/index.ts
// VERSION 3.2 - KORRIGERAD VERSION MED RÄTT MORGONLOGIK

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Konfiguration ---
const WORK_DAY_START_HOUR = 8;
const WORK_DAY_END_HOUR = 17;

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

const doTimeSlotsOverlap = (slot1: TimeSlot, slot2: TimeSlot): boolean => { 
  return slot1.start < slot2.end && slot1.end > slot2.start; 
};

// Hjälpfunktion för att kontrollera om ett datum är helg
const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6; // Söndag = 0, Lördag = 6
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Endast POST är tillåtet' });

  try {
    const { newCaseAddress, pestType, timeSlotDuration = 120, searchStartDate } = req.body;
    if (!newCaseAddress || !pestType) return res.status(400).json({ error: 'Adress och skadedjurstyp måste anges.' });

    const competentStaff = await getCompetentStaff(pestType);
    if (competentStaff.length === 0) return res.status(200).json([]);
    
    const startDate = searchStartDate ? new Date(searchStartDate) : new Date();
    startDate.setHours(0, 0, 0, 0);
    
    const fourteenDaysFromStart = new Date(startDate);
    fourteenDaysFromStart.setDate(startDate.getDate() + 14);

    const schedules = await getSchedules(competentStaff, startDate, fourteenDaysFromStart);
    
    const allKnownAddresses = getOrigins(competentStaff, Array.from(schedules.values()).flat());
    const travelTimes = await getTravelTimes(allKnownAddresses, newCaseAddress);

    let allSuggestions: Suggestion[] = [];

    for (let i = 0; i < 14; i++) {
      const currentDay = new Date(startDate);
      currentDay.setDate(startDate.getDate() + i);

      // ✅ HOPPA ÖVER HELGER
      if (isWeekend(currentDay)) {
        continue;
      }

      for (const staff of competentStaff) {
        const techSchedule = schedules.get(staff.id)!.sort((a,b) => a.start.getTime() - b.start.getTime());
        const workDayStart = new Date(currentDay);
        workDayStart.setHours(WORK_DAY_START_HOUR, 0, 0, 0);
        const workDayEnd = new Date(currentDay);
        workDayEnd.setHours(WORK_DAY_END_HOUR, 0, 0, 0);

        // ✅ KONTROLLERA OM TEKNIKERN HAR NÅGOT INBOKAT PÅ MORGONEN
        const hasMorningBooking = techSchedule.some(booking => {
          const bookingStart = new Date(booking.start);
          return bookingStart <= workDayStart || 
                 (bookingStart.getHours() >= WORK_DAY_START_HOUR && bookingStart.getHours() < 10);
        });

        // ✅ OM INGEN MORGONBOKNING - TEKNIKER KAN VARA PÅ PLATS KL 08:00
        if (!hasMorningBooking) {
          const morningStartTime = new Date(workDayStart);
          const morningEndTime = new Date(morningStartTime.getTime() + timeSlotDuration * 60000);
          
          if (morningEndTime <= workDayEnd) {
            const travelTime = travelTimes.get(staff.address) ?? 999;
            
            allSuggestions.push({
              technician_id: staff.id,
              technician_name: staff.name,
              start_time: morningStartTime.toISOString(),
              end_time: morningEndTime.toISOString(),
              travel_time_minutes: travelTime,
              origin_description: 'Hemadress (morgonstart)'
            });
          }
        }

        // ✅ SÖK EFTER LEDIGA TIDER MELLAN BEFINTLIGA BOKNINGAR
        for (let j = 0; j < techSchedule.length; j++) {
          const currentBooking = techSchedule[j];
          const nextBooking = techSchedule[j + 1];
          
          // Beräkna restid från nuvarande boknings adress
          const currentAddress = formatAddress(currentBooking.adress);
          const travelTime = travelTimes.get(currentAddress) ?? 999;
          
          // Potentiell starttid är efter nuvarande bokning + restid
          const potentialStartTime = new Date(currentBooking.end.getTime() + travelTime * 60000);
          const potentialEndTime = new Date(potentialStartTime.getTime() + timeSlotDuration * 60000);
          
          // Kontrollera att vi inte går utanför arbetstid
          if (potentialEndTime > workDayEnd) continue;
          
          // Om det finns en nästa bokning, kontrollera att vi inte krockar
          if (nextBooking) {
            const nextBookingTravelTime = travelTimes.get(newCaseAddress) ?? 0;
            const nextBookingEarliestStart = new Date(nextBooking.start.getTime() - nextBookingTravelTime * 60000);
            
            if (potentialEndTime > nextBookingEarliestStart) continue;
          }
          
          allSuggestions.push({
            technician_id: staff.id,
            technician_name: staff.name,
            start_time: potentialStartTime.toISOString(),
            end_time: potentialEndTime.toISOString(),
            travel_time_minutes: travelTime,
            origin_description: currentBooking.title
          });
        }

        // ✅ KONTROLLERA EFTER SISTA BOKNINGEN PÅ DAGEN
        if (techSchedule.length > 0) {
          const lastBooking = techSchedule[techSchedule.length - 1];
          const lastAddress = formatAddress(lastBooking.adress);
          const travelTime = travelTimes.get(lastAddress) ?? 999;
          
          const potentialStartTime = new Date(lastBooking.end.getTime() + travelTime * 60000);
          const potentialEndTime = new Date(potentialStartTime.getTime() + timeSlotDuration * 60000);
          
          if (potentialEndTime <= workDayEnd) {
            allSuggestions.push({
              technician_id: staff.id,
              technician_name: staff.name,
              start_time: potentialStartTime.toISOString(),
              end_time: potentialEndTime.toISOString(),
              travel_time_minutes: travelTime,
              origin_description: lastBooking.title
            });
          }
        }
      }
    }
    
    // ✅ TA BORT DUBLETTER OCH SORTERA
    const uniqueSuggestions = Array.from(
      new Map(allSuggestions.map(item => [`${item.technician_id}-${item.start_time}`, item])).values()
    );
    
    const sortedSuggestions = uniqueSuggestions
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .sort((a, b) => a.travel_time_minutes - b.travel_time_minutes);

    res.status(200).json(sortedSuggestions.slice(0, 5));

  } catch (error: any) {
    console.error("Fel i bokningsassistent:", error);
    res.status(500).json({ error: "Ett internt fel uppstod.", details: error.message });
  }
}

// --- HJÄLPFUNKTIONER (oförändrade) ---
async function getCompetentStaff(pestType: string): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff_competencies')
    .select('technicians(id, name, address)')
    .eq('pest_type', pestType);
  
  if (error) throw error;
  
  return data
    .map((s: any) => s.technicians)
    .filter(Boolean)
    .filter(staff => staff.address && staff.address.trim() !== '');
}

async function getSchedules(staff: StaffMember[], from: Date, to: Date): Promise<Map<string, CaseInfo[]>> {
  const staffIds = staff.map(s => s.id);
  
  const { data, error } = await supabase
    .from('cases_with_technician_view')
    .select('start_date, due_date, technician_id, adress, title')
    .in('technician_id', staffIds)
    .gte('start_date', from.toISOString())
    .lte('start_date', to.toISOString());
  
  if (error) throw error;
  
  const schedules = new Map<string, CaseInfo[]>();
  staff.forEach(s => schedules.set(s.id, []));
  
  data.forEach(c => {
    if(c.start_date && c.due_date) {
      schedules.get(c.technician_id)?.push({
        start: new Date(c.start_date),
        end: new Date(c.due_date),
        title: c.title,
        adress: c.adress
      });
    }
  });
  
  return schedules;
}

function getOrigins(staff: StaffMember[], cases: CaseInfo[]): string[] {
  return [...new Set([
    ...staff.map(s => s.address),
    ...cases.map(c => formatAddress(c.adress))
  ])].filter(Boolean) as string[];
}

async function getTravelTimes(origins: string[], destination: string): Promise<Map<string, number>> {
  if (origins.length === 0) return new Map();
  
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY!;
  const matrixApiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins.join('|')}&destinations=${destination}&key=${googleMapsApiKey}`;
  
  const matrixResponse = await fetch(matrixApiUrl);
  const matrixData = await matrixResponse.json() as any;
  
  if (matrixData.status !== 'OK') {
    throw new Error(`Google Maps API fel: ${matrixData.error_message || matrixData.status}`);
  }
  
  const travelTimes = new Map<string, number>();
  matrixData.rows.forEach((row: any, index: number) => {
    if (row.elements[0].status === 'OK') {
      travelTimes.set(origins[index], Math.round(row.elements[0].duration.value / 60));
    }
  });
  
  return travelTimes;
}