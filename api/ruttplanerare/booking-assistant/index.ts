// api/ruttplanerare/booking-assistant/index.ts
// VERSION 3.4 - TIDSZONSKORRIGERING FÖR SVERIGE

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
const TARGET_TIMEZONE = 'Europe/Stockholm'; // ✅ VIKTIGT: Definiera måltidszonen

// --- Datatyper och hjälpfunktioner ---
interface StaffMember { id: string; name: string; address: string; }
interface TimeSlot { start: Date; end: Date; }
interface CaseInfo extends TimeSlot { title: string; adress: any; }
interface Suggestion { technician_id: string; technician_name: string; start_time: string; end_time: string; travel_time_minutes: number; origin_description: string; }
const formatAddress = (address: any): string => { if (!address) return ''; if (typeof address === 'object' && address.formatted_address) return address.formatted_address; return String(address); };

/**
 * ✅ NY HJÄLPFUNKTION
 * Skapar ett Date-objekt för en specifik tidpunkt i en given tidszon.
 * Detta kringgår problemet med att servern kör i UTC.
 * @param date - Datumdelen (t.ex. en Date-objekt för en specifik dag)
 * @param hour - Timmen som ska sättas (0-23)
 * @returns Ett korrekt Date-objekt som representerar den tidpunkten i måltidszonen.
 */
const createDateInTimeZone = (date: Date, hour: number): Date => {
    // Skapa en ISO-sträng för datumet (YYYY-MM-DD)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hourStr = String(hour).padStart(2, '0');
    
    // Skapa en fullständig datum-tid-sträng med korrekt tidszoninformation
    const isoStringInTimeZone = `${year}-${month}-${day}T${hourStr}:00:00`;

    // Skapa datumet genom att tolka strängen som att den tillhör måltidszonen
    // Detta är en robust metod för att säkerställa korrekt tidpunkt
    const timeInZone = new Date(isoStringInTimeZone + '.000Z');
    
    // Justera för tidszonsskillnaden mellan UTC och den lokala tiden för det datumet
    const utcDate = new Date(timeInZone.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(timeInZone.toLocaleString('en-US', { timeZone: TARGET_TIMEZONE }));
    const offset = utcDate.getTime() - tzDate.getTime();
    
    timeInZone.setTime(timeInZone.getTime() - offset);
    
    return timeInZone;
};


export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Endast POST är tillåtet' });

    try {
        const { newCaseAddress, pestType, timeSlotDuration = 120, searchStartDate } = req.body;
        if (!newCaseAddress || !pestType) return res.status(400).json({ error: 'Adress och skadedjurstyp måste anges.' });

        // `new Date("YYYY-MM-DD")` skapar ett datum vid midnatt UTC, vilket är säkert.
        const startDate = searchStartDate ? new Date(searchStartDate) : new Date();
        startDate.setUTCHours(0, 0, 0, 0);

        const competentStaff = await getCompetentStaff(pestType);
        if (competentStaff.length === 0) return res.status(200).json([]);
        
        const fourteenDaysFromStart = new Date(startDate);
        fourteenDaysFromStart.setDate(startDate.getDate() + SEARCH_DAYS_LIMIT);

        const schedules = await getSchedules(competentStaff, startDate, fourteenDaysFromStart);
        
        const allKnownAddresses = getOrigins(competentStaff, Array.from(schedules.values()).flat());
        const travelTimes = await getTravelTimes(allKnownAddresses, newCaseAddress);

        let allSuggestions: Suggestion[] = [];

        for (let i = 0; i < SEARCH_DAYS_LIMIT; i++) {
            const currentDay = new Date(startDate);
            currentDay.setDate(startDate.getDate() + i);

            // getUTCDay() är säkrare än getDay() på servrar
            const dayOfWeek = currentDay.getUTCDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) { // Ignorera Söndag (0) och Lördag (6)
                continue;
            }

            for (const staff of competentStaff) {
                const techSchedule = schedules.get(staff.id)?.sort((a,b) => a.start.getTime() - b.start.getTime()) || [];
                
                // ✅ ANVÄND DEN NYA TIDSZONS-MEDVETNA FUNKTIONEN
                const workDayStart = createDateInTimeZone(currentDay, WORK_DAY_START_HOUR);
                const workDayEnd = createDateInTimeZone(currentDay, WORK_DAY_END_HOUR);

                const events: TimeSlot[] = [
                    { start: new Date(0), end: workDayStart },
                    ...techSchedule,
                ];

                for (let j = 0; j < events.length; j++) {
                    const previousEvent = events[j];
                    const nextEventStart = (j + 1 < events.length) ? events[j+1].start : workDayEnd;

                    let potentialStartTime: Date;
                    let travelTimeMinutes: number;
                    let originDescription: string;
                    
                    if (j === 0) {
                        potentialStartTime = workDayStart; // Startar kl 08:00 svensk tid
                        originDescription = 'Hemadress';
                        travelTimeMinutes = travelTimes.get(formatAddress(staff.address)) ?? -1;
                    } else {
                        const originAddress = formatAddress((previousEvent as CaseInfo).adress);
                        travelTimeMinutes = travelTimes.get(originAddress) ?? -1;
                        if (travelTimeMinutes === -1) continue; 
                        
                        const arrivalTime = new Date(previousEvent.end.getTime() + travelTimeMinutes * 60000);
                        potentialStartTime = arrivalTime;
                        originDescription = (previousEvent as CaseInfo).title || 'Föregående kund';
                    }

                    if (travelTimeMinutes === -1) continue;

                    const potentialEndTime = new Date(potentialStartTime.getTime() + timeSlotDuration * 60000);
                    
                    if (potentialEndTime.getTime() <= nextEventStart.getTime() && potentialEndTime.getTime() <= workDayEnd.getTime()) {
                         allSuggestions.push({
                            technician_id: staff.id,
                            technician_name: staff.name,
                            start_time: potentialStartTime.toISOString(),
                            end_time: potentialEndTime.toISOString(),
                            travel_time_minutes: travelTimeMinutes,
                            origin_description: originDescription
                        });
                    }
                }
            }
        }
        
        const uniqueSuggestions = Array.from(new Map(allSuggestions.map(item => [`${item.technician_id}-${item.start_time}`, item])).values());
        const sortedSuggestions = uniqueSuggestions
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
            .sort((a, b) => a.travel_time_minutes - b.travel_time_minutes);

        res.status(200).json(sortedSuggestions.slice(0, 5));

    } catch (error: any) {
        console.error("Fel i bokningsassistent (v3.4):", error);
        res.status(500).json({ error: "Ett internt fel uppstod.", details: error.message });
    }
}

// --- HJÄLPFUNKTIONER (Oförändrade) ---
async function getCompetentStaff(pestType: string): Promise<StaffMember[]> {
    const { data, error } = await supabase.from('staff_competencies').select('technicians(id, name, address)').eq('pest_type', pestType);
    if (error) throw error;
    return data.map((s: any) => s.technicians).filter(Boolean).filter(staff => staff.address && typeof staff.address === 'string' && staff.address.trim() !== '');
}

async function getSchedules(staff: StaffMember[], from: Date, to: Date): Promise<Map<string, CaseInfo[]>> {
    const staffIds = staff.map(s => s.id);
    const { data, error } = await supabase.from('cases_with_technician_view').select('start_date, due_date, technician_id, adress, title').in('technician_id', staffIds).gte('start_date', from.toISOString()).lte('start_date', to.toISOString());
    if (error) throw error;
    const schedules = new Map<string, CaseInfo[]>();
    staff.forEach(s => schedules.set(s.id, []));
    data?.forEach(c => { if(c.start_date && c.due_date) schedules.get(c.technician_id)?.push({ start: new Date(c.start_date), end: new Date(c.due_date), title: c.title, adress: c.adress }); });
    return schedules;
}

function getOrigins(staff: StaffMember[], cases: CaseInfo[]): string[] {
    const staffAddresses = staff.map(s => s.address).filter(Boolean) as string[];
    const caseAddresses = cases.map(c => formatAddress(c.adress)).filter(Boolean);
    return [...new Set([...staffAddresses, ...caseAddresses])];
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