// api/ruttplanerare/booking-assistant/index.ts
// VERSION 2.3 - FULLSTÄNDIG OCH KORREKT VERSION

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const WORK_DAY_START_HOUR = 8;
const WORK_DAY_END_HOUR = 17;

// --- Datatyper och hjälpfunktioner ---
interface StaffMember { id: string; name: string; address: string; }
interface TimeSlot { start: Date; end: Date; }
interface Suggestion { technician_id: string; technician_name: string; start_time: string; end_time: string; travel_time_minutes: number; origin_description: string; }
const formatAddress = (address: any): string => { if (!address) return ''; if (typeof address === 'object' && address.formatted_address) return address.formatted_address; return String(address); };
const doTimeSlotsOverlap = (slot1: TimeSlot, slot2: TimeSlot): boolean => { return slot1.start < slot2.end && slot1.end > slot2.start; };

// --- Huvudfunktion ---
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
        
        const origins = getOrigins(competentStaff, Array.from(schedules.values()).flat());
        if (origins.length === 0) return res.status(200).json([]);

        const travelTimes = await getTravelTimes(origins, newCaseAddress);

        let allSuggestions: Suggestion[] = [];

        for (let i = 0; i < 14; i++) {
            const currentDay = new Date(startDate);
            currentDay.setDate(startDate.getDate() + i);

            for (const staff of competentStaff) {
                const techSchedule = schedules.get(staff.id)!.sort((a,b) => a.start.getTime() - b.start.getTime());
                const workDayStart = new Date(currentDay).setHours(WORK_DAY_START_HOUR, 0, 0, 0);
                const workDayEnd = new Date(currentDay).setHours(WORK_DAY_END_HOUR, 0, 0, 0);

                // Förslag 1: Start på dagen från hemadress
                const travelFromHome = travelTimes.get(staff.address);
                if (travelFromHome !== undefined) {
                    const potentialStart = new Date(workDayStart);
                    const potentialEnd = new Date(potentialStart.getTime() + timeSlotDuration * 60000);

                    if (potentialEnd.getTime() <= workDayEnd && !techSchedule.some(slot => doTimeSlotsOverlap({start: potentialStart, end: potentialEnd}, slot))) {
                        allSuggestions.push({
                            technician_id: staff.id, technician_name: staff.name,
                            start_time: potentialStart.toISOString(), end_time: potentialEnd.toISOString(),
                            travel_time_minutes: travelFromHome, origin_description: "Hemadress"
                        });
                    }
                }

                // Förslag 2: Efter befintliga jobb
                for (const existingCase of techSchedule) {
                    const travelFromCase = travelTimes.get(formatAddress(existingCase.adress));
                    if (travelFromCase !== undefined) {
                        const potentialStart = new Date(existingCase.end.getTime() + travelFromCase * 60 * 1000);
                        const potentialEnd = new Date(potentialStart.getTime() + timeSlotDuration * 60000);
                        if (potentialEnd.getTime() <= workDayEnd && !techSchedule.some(slot => doTimeSlotsOverlap({start: potentialStart, end: potentialEnd}, slot))) {
                            allSuggestions.push({
                                technician_id: staff.id, technician_name: staff.name,
                                start_time: potentialStart.toISOString(), end_time: potentialEnd.toISOString(),
                                travel_time_minutes: travelFromCase, origin_description: `Ärende: ${existingCase.title}`
                            });
                        }
                    }
                }
            }
        }
        
        const sortedSuggestions = allSuggestions
            .sort((a, b) => a.travel_time_minutes - b.travel_time_minutes)
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

        res.status(200).json(sortedSuggestions.slice(0, 5));

    } catch (error: any) {
        console.error("Fel i bokningsassistent:", error);
        res.status(500).json({ error: "Ett internt fel uppstod.", details: error.message });
    }
}

// --- HJÄLPFUNKTIONER FÖR LÄSBARHET ---
async function getCompetentStaff(pestType: string): Promise<StaffMember[]> {
    const { data, error } = await supabase.from('staff_competencies').select('technicians(id, name, address)').eq('pest_type', pestType);
    if (error) throw error;
    return data.map((s: any) => s.technicians).filter(Boolean).filter(staff => staff.address && staff.address.trim() !== '');
}

async function getSchedules(staff: StaffMember[], from: Date, to: Date): Promise<Map<string, TimeSlot[]>> {
    const staffIds = staff.map(s => s.id);
    const { data, error } = await supabase.from('cases_with_technician_view').select('start_date, due_date, technician_id, adress, title').in('technician_id', staffIds).gte('start_date', from.toISOString()).lte('start_date', to.toISOString());
    if (error) throw error;
    
    const schedules = new Map<string, TimeSlot[]>();
    staff.forEach(s => schedules.set(s.id, []));
    data.forEach(c => { if(c.start_date && c.due_date) schedules.get(c.technician_id)?.push({ start: new Date(c.start_date), end: new Date(c.due_date) }); });
    return schedules;
}

function getOrigins(staff: StaffMember[], cases: any[]): string[] {
    return [...staff.map(s => s.address), ...cases.map(c => formatAddress(c.adress))].filter(Boolean) as string[];
}

async function getTravelTimes(origins: string[], destination: string): Promise<Map<string, number>> {
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY!;
    const matrixApiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins.join('|')}&destinations=${destination}&key=${googleMapsApiKey}`;
    const matrixResponse = await fetch(matrixApiUrl);
    const matrixData = await matrixResponse.json() as any;
    if (matrixData.status !== 'OK') throw new Error(`Google Maps API fel: ${matrixData.error_message || matrixData.status}`);
    
    const travelTimes = new Map<string, number>();
    matrixData.rows.forEach((row: any, index: number) => {
        if (row.elements[0].status === 'OK') {
            travelTimes.set(origins[index], Math.round(row.elements[0].duration.value / 60));
        }
    });
    return travelTimes;
}