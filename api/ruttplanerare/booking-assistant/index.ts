// api/ruttplanerare/booking-assistant/index.ts
// VERSION 3.2 - KORRIGERAD FÖR FÖRSTA ÄRENDE OCH HELGDAGAR

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
interface Suggestion { technician_id: string; technician_name: string; start_time: string; end_time: string; travel_time_minutes: number; origin_description: string; }
const formatAddress = (address: any): string => { if (!address) return ''; if (typeof address === 'object' && address.formatted_address) return address.formatted_address; return String(address); };
const doTimeSlotsOverlap = (slot1: TimeSlot, slot2: TimeSlot): boolean => { return slot1.start < slot2.end && slot1.end > slot2.start; };

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
        fourteenDaysFromStart.setDate(startDate.getDate() + SEARCH_DAYS_LIMIT);

        const schedules = await getSchedules(competentStaff, startDate, fourteenDaysFromStart);
        
        const allKnownAddresses = getOrigins(competentStaff, Array.from(schedules.values()).flat());
        const travelTimes = await getTravelTimes(allKnownAddresses, newCaseAddress);

        let allSuggestions: Suggestion[] = [];

        for (let i = 0; i < SEARCH_DAYS_LIMIT; i++) {
            const currentDay = new Date(startDate);
            currentDay.setDate(startDate.getDate() + i);

            // ✅ FIX 1: Ignorera helger (Söndag = 0, Lördag = 6)
            const dayOfWeek = currentDay.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                continue;
            }

            for (const staff of competentStaff) {
                const techSchedule = schedules.get(staff.id)!.sort((a,b) => a.start.getTime() - b.start.getTime());
                const workDayStart = new Date(currentDay);
                workDayStart.setHours(WORK_DAY_START_HOUR, 0, 0, 0);
                const workDayEnd = new Date(currentDay);
                workDayEnd.setHours(WORK_DAY_END_HOUR, 0, 0, 0);

                // --- ✅ FIX 2: Ny, korrekt logik för att hitta luckor ---
                // Skapa en lista över alla "händelser" inklusive arbetspass-start och slut
                const events: TimeSlot[] = [
                    // Start på dagen (fiktiv händelse)
                    { start: new Date(0), end: workDayStart },
                    // Alla bokade ärenden
                    ...techSchedule,
                    // Slut på dagen (fiktiv händelse)
                    { start: workDayEnd, end: new Date(workDayEnd.getTime() + 1) } 
                ];

                // Hitta alla lediga luckor mellan händelserna
                for (let j = 0; j < events.length - 1; j++) {
                    const previousEvent = events[j];
                    const nextEvent = events[j+1];

                    // Beskrivning av var teknikern kommer ifrån
                    const originDescription = (previousEvent as CaseInfo).title || 'Hemadress';
                    const originAddress = (previousEvent as CaseInfo).adress || staff.address;
                    
                    const travelTimeFromPrev = travelTimes.get(formatAddress(originAddress)) ?? 999;
                    if (travelTimeFromPrev === 999) continue; // Hoppa över om vi inte har restid

                    // Tiden då teknikern tidigast kan vara framme hos nya kunden
                    const arrivalTime = new Date(previousEvent.end.getTime() + travelTimeFromPrev * 60000);
                    
                    const potentialStartTime = new Date(Math.max(arrivalTime.getTime(), workDayStart.getTime()));
                    const potentialEndTime = new Date(potentialStartTime.getTime() + timeSlotDuration * 60000);

                    // Kontrollera om hela det nya ärendet (inkl. restid) ryms i luckan
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
        
        const uniqueSuggestions = Array.from(new Map(allSuggestions.map(item => [`${item.technician_id}-${item.start_time}`, item])).values());
        const sortedSuggestions = uniqueSuggestions
            .sort((a, b) => a.travel_time_minutes - b.travel_time_minutes)
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        res.status(200).json(sortedSuggestions.slice(0, 5));

    } catch (error: any) {
        console.error("Fel i bokningsassistent:", error);
        res.status(500).json({ error: "Ett internt fel uppstod.", details: error.message });
    }
}

// --- HJÄLPFUNKTIONER (Oförändrade) ---
async function getCompetentStaff(pestType: string): Promise<StaffMember[]> {
    const { data, error } = await supabase.from('staff_competencies').select('technicians(id, name, address)').eq('pest_type', pestType);
    if (error) throw error;
    // Filtrera bort tekniker som saknar en giltig hemadress
    return data.map((s: any) => s.technicians).filter(Boolean).filter(staff => staff.address && typeof staff.address === 'string' && staff.address.trim() !== '');
}

async function getSchedules(staff: StaffMember[], from: Date, to: Date): Promise<Map<string, CaseInfo[]>> {
    const staffIds = staff.map(s => s.id);
    const { data, error } = await supabase.from('cases_with_technician_view').select('start_date, due_date, technician_id, adress, title').in('technician_id', staffIds).gte('start_date', from.toISOString()).lte('start_date', to.toISOString());
    if (error) throw error;
    const schedules = new Map<string, CaseInfo[]>();
    staff.forEach(s => schedules.set(s.id, []));
    data.forEach(c => { if(c.start_date && c.due_date) schedules.get(c.technician_id)?.push({ start: new Date(c.start_date), end: new Date(c.due_date), title: c.title, adress: c.adress }); });
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
    const uniqueOrigins = [...new Set(origins)]; // Säkerställ unika origo-adresser för API-anropet
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
            // Använd exakta sekunder och avrunda i front-end om det behövs, eller här om du föredrar det.
            // Math.round är rimligt.
            travelTimes.set(uniqueOrigins[index], Math.round(row.elements[0].duration.value / 60)); 
        }
    });
    return travelTimes;
}