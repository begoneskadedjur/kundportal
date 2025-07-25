// api/ruttplanerare/booking-assistant/index.ts
// VERSION 4.2 - KORREKT HANTERING AV LUCKOR EFTER FRÅNVARO

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
const TARGET_TIMEZONE = 'Europe/Stockholm';

// --- Datatyper och hjälpfunktioner ---
interface StaffMember { id: string; name: string; address: string; }
interface TimeSlot { start: Date; end: Date; }
// ✅ Utökad typ för att skilja på ärenden och frånvaro
interface EventSlot extends TimeSlot {
    type: 'case' | 'absence';
    title?: string;
    adress?: any;
}
interface Suggestion { technician_id: string; technician_name: string; start_time: string; end_time: string; travel_time_minutes: number; origin_description: string; }
const formatAddress = (address: any): string => { if (!address) return ''; if (typeof address === 'object' && address.formatted_address) return address.formatted_address; return String(address); };

// Tidszonsfunktion (oförändrad)
const createDateInTimeZone = (date: Date, hour: number): Date => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hourStr = String(hour).padStart(2, '0');
    const isoStringForTime = `${year}-${month}-${day}T${hourStr}:00:00.000Z`;
    const timeInZone = new Date(isoStringForTime);
    const utcDate = new Date(timeInZone.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(timeInZone.toLocaleString('en-US', { timeZone: TARGET_TIMEZONE }));
    const offset = utcDate.getTime() - tzDate.getTime();
    timeInZone.setTime(timeInZone.getTime() + offset);
    return timeInZone;
};

// Hjälpfunktioner för att hämta data (oförändrade men inklistrade för fullständighet)
async function getSchedules(staff: StaffMember[], from: Date, to: Date): Promise<Map<string, EventSlot[]>> {
    const staffIds = staff.map(s => s.id);
    const { data, error } = await supabase.from('cases_with_technician_view').select('start_date, due_date, technician_id, adress, title').in('technician_id', staffIds).gte('start_date', from.toISOString()).lte('start_date', to.toISOString());
    if (error) throw error;
    const schedules = new Map<string, EventSlot[]>();
    staff.forEach(s => schedules.set(s.id, []));
    data?.forEach(c => { if(c.start_date && c.due_date) schedules.get(c.technician_id)?.push({ start: new Date(c.start_date), end: new Date(c.due_date), title: c.title, adress: c.adress, type: 'case' }); });
    return schedules;
}
async function getAbsences(staffIds: string[], from: Date, to: Date): Promise<Map<string, EventSlot[]>> {
    const { data, error } = await supabase.from('technician_absences').select('technician_id, start_date, end_date').in('technician_id', staffIds).lt('start_date', to.toISOString()).gt('end_date', from.toISOString());
    if (error) throw error;
    const absences = new Map<string, EventSlot[]>();
    staffIds.forEach(id => absences.set(id, []));
    data.forEach(a => { absences.get(a.technician_id)?.push({ start: new Date(a.start_date), end: new Date(a.end_date), type: 'absence' }); });
    return absences;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Endast POST är tillåtet' });

    try {
        const { newCaseAddress, pestType, timeSlotDuration = 120, searchStartDate } = req.body;
        if (!newCaseAddress || !pestType) return res.status(400).json({ error: 'Adress och skadedjurstyp måste anges.' });

        const startDate = searchStartDate ? new Date(searchStartDate) : new Date();
        startDate.setUTCHours(0, 0, 0, 0);
        
        const competentStaff = await getCompetentStaff(pestType);
        if (competentStaff.length === 0) return res.status(200).json([]);
        const staffIds = competentStaff.map(s => s.id);

        const fourteenDaysFromStart = new Date(startDate);
        fourteenDaysFromStart.setDate(startDate.getDate() + SEARCH_DAYS_LIMIT);

        const [schedules, absences] = await Promise.all([
            getSchedules(competentStaff, startDate, fourteenDaysFromStart),
            getAbsences(staffIds, startDate, fourteenDaysFromStart)
        ]);
        
        const allCaseAddresses = Array.from(schedules.values()).flat().map(c => formatAddress(c.adress));
        const allHomeAddresses = competentStaff.map(s => s.address);
        const allKnownAddresses = [...new Set([...allCaseAddresses, ...allHomeAddresses])].filter(Boolean);

        const travelTimes = await getTravelTimes(allKnownAddresses, newCaseAddress);

        let allSuggestions: Suggestion[] = [];

        for (let i = 0; i < SEARCH_DAYS_LIMIT; i++) {
            const currentDay = new Date(startDate);
            currentDay.setDate(startDate.getDate() + i);

            const dayOfWeek = currentDay.getUTCDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;

            for (const staff of competentStaff) {
                const workDayStart = createDateInTimeZone(currentDay, WORK_DAY_START_HOUR);
                const workDayEnd = createDateInTimeZone(currentDay, WORK_DAY_END_HOUR);

                const techSchedule = schedules.get(staff.id) || [];
                const techAbsences = absences.get(staff.id) || [];
                const allBookedSlots = [...techSchedule, ...techAbsences].sort((a,b) => a.start.getTime() - b.start.getTime());

                const events: EventSlot[] = [
                    { start: new Date(0), end: workDayStart, type: 'absence' }, // Fiktiv start, behandlas som frånvaro
                    ...allBookedSlots,
                ];

                for (let j = 0; j < events.length; j++) {
                    const previousEvent = events[j];
                    const nextEventStart = (j + 1 < events.length) ? events[j+1].start : workDayEnd;
                    
                    // ✅ KÄRNLOGIKEN FÖR ATT HITTA STARTPUNKT
                    let originAddress: string;
                    let originDescription: string;
                    
                    if (previousEvent.type === 'case' && previousEvent.adress) {
                        // FALL 1: Föregående händelse var ett ärende. Använd dess adress.
                        originAddress = formatAddress(previousEvent.adress);
                        originDescription = previousEvent.title || 'Föregående kund';
                    } else {
                        // FALL 2: Föregående händelse var frånvaro (eller dagens start). Använd hemadressen.
                        originAddress = formatAddress(staff.address);
                        originDescription = 'Hemadress';
                    }

                    const travelTimeMinutes = travelTimes.get(originAddress) ?? -1;
                    if (travelTimeMinutes === -1) continue;

                    // Beräkna tidigaste ankomsttid.
                    const potentialStartTime = new Date(previousEvent.end.getTime() + travelTimeMinutes * 60000);
                    
                    // Dagens första lucka måste alltid börja tidigast kl 08:00
                    const actualStartTime = new Date(Math.max(potentialStartTime.getTime(), workDayStart.getTime()));

                    const potentialEndTime = new Date(actualStartTime.getTime() + timeSlotDuration * 60000);
                    
                    if (actualStartTime >= workDayStart && potentialEndTime.getTime() <= nextEventStart.getTime() && potentialEndTime.getTime() <= workDayEnd.getTime()) {
                         allSuggestions.push({
                            technician_id: staff.id,
                            technician_name: staff.name,
                            start_time: actualStartTime.toISOString(),
                            end_time: potentialEndTime.toISOString(),
                            travel_time_minutes: travelTimeMinutes,
                            origin_description: originDescription
                        });
                    }
                }
            }
        }
        
        const sortedSuggestions = allSuggestions.sort((a, b) => {
            const dateA = new Date(a.start_time).setHours(0,0,0,0);
            const dateB = new Date(b.start_time).setHours(0,0,0,0);
            if (dateA !== dateB) return dateA - dateB;
            return a.travel_time_minutes - b.travel_time_minutes;
        });
        
        res.status(200).json(sortedSuggestions.slice(0, 5));

    } catch (error: any) {
        console.error("Fel i bokningsassistent (v4.2):", error);
        res.status(500).json({ error: "Ett internt fel uppstod.", details: error.message });
    }
}

// --- Övriga hjälpfunktioner (oförändrade) ---
async function getCompetentStaff(pestType: string): Promise<StaffMember[]> {
    const { data, error } = await supabase.from('staff_competencies').select('technicians(id, name, address)').eq('pest_type', pestType);
    if (error) throw error;
    return data.map((s: any) => s.technicians).filter(Boolean).filter(staff => staff.address && typeof staff.address === 'string' && staff.address.trim() !== '');
}

async function getTravelTimes(origins: string[], destination: string): Promise<Map<string, number>> {
    if (origins.length === 0) return new Map();
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY!;
    const uniqueOrigins = [...new Set(origins)]; 
    const matrixApiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${uniqueOrigins.join('|')}&destinations=${destination}&key=${googleMapsApiKey}`;
    
    const matrixResponse = await fetch(matrixApiUrl);
    const matrixData = await matrixResponse.json() as any;
    
    if (matrixData.status !== 'OK') {
        console.error('Google Maps API Error:', matrixData.error_message || matrixData.status);
        throw new Error(`Google Maps API fel: ${matrixData.error_message || matrixData.status}`);
    }
    
    const travelTimes = new Map<string, number>();
    matrixData.rows.forEach((row: any, index: number) => { 
        if (row.elements[0].status === 'OK') { 
            travelTimes.set(uniqueOrigins[index], Math.round(row.elements[0].duration.value / 60)); 
        } else {
             travelTimes.set(uniqueOrigins[index], -1);
        }
    });
    return travelTimes;
}