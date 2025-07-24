// api/ruttplanerare/booking-assistant/index.ts
// VERSION 2.1 - FULLSTÄNDIG OCH KORREKT VERSION

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Konfiguration ---
const WORK_DAY_START_HOUR = 8;
const WORK_DAY_END_HOUR = 17;

// --- Datatyper ---
interface StaffMember { id: string; name: string; address: string; } // Adress är nu obligatorisk
interface TimeSlot { start: Date; end: Date; }
interface Suggestion {
    technician_id: string; technician_name: string;
    start_time: string; end_time: string;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Endast POST är tillåtet' });

    try {
        const { newCaseAddress, pestType, timeSlotDuration = 120 } = req.body;
        if (!newCaseAddress || !pestType) return res.status(400).json({ error: 'Adress och skadedjurstyp måste anges.' });

        // 1. Hitta personal med rätt kompetens OCH GILTIG HEMADRESS
        const { data: competentStaffData, error: staffError } = await supabase
            .from('staff_competencies')
            .select('technicians(id, name, address)')
            .eq('pest_type', pestType);

        if (staffError) throw staffError;

        // ✅ FIX: Filtrera bort all personal som saknar en giltig hemadress.
        const competentStaff: StaffMember[] = competentStaffData
            .map((s: any) => s.technicians)
            .filter(Boolean) // Säkerställer att tekniker-objektet finns
            .filter(staff => staff.address && staff.address.trim() !== ''); // KRITISK FILTERING

        if (competentStaff.length === 0) {
            console.log(`Ingen personal med rätt kompetens OCH registrerad adress hittades.`);
            return res.status(200).json([]);
        }

        const competentStaffIds = competentStaff.map(s => s.id);

        // 2. Hämta ALLA bokningar för den kompetenta personalen
        const today = new Date();
        const fourteenDaysFromNow = new Date(today);
        fourteenDaysFromNow.setDate(today.getDate() + 14);

        const { data: cases, error: casesError } = await supabase
            .from('cases_with_technician_view')
            .select('start_date, due_date, technician_id, adress, title')
            .in('technician_id', competentStaffIds)
            .gte('start_date', today.toISOString())
            .lte('start_date', fourteenDaysFromNow.toISOString());

        if (casesError) throw casesError;

        const schedules = new Map<string, TimeSlot[]>();
        competentStaff.forEach(staff => schedules.set(staff.id, []));
        cases.forEach(aCase => {
            if (aCase.start_date && aCase.due_date) {
                schedules.get(aCase.technician_id)?.push({ start: new Date(aCase.start_date), end: new Date(aCase.due_date) });
            }
        });

        // 3. Generera förslag
        let allSuggestions: Suggestion[] = [];
        
        const origins = [
            ...competentStaff.map(s => s.address),
            ...cases.map(c => formatAddress(c.adress))
        ].filter(Boolean) as string[];

        if (origins.length === 0) {
            return res.status(200).json([]);
        }

        const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY!;
        const matrixApiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins.join('|')}&destinations=${newCaseAddress}&key=${googleMapsApiKey}`;
        const matrixResponse = await fetch(matrixApiUrl);
        const matrixData = await matrixResponse.json() as any;
        if (matrixData.status !== 'OK') throw new Error(`Google Maps API fel: ${matrixData.error_message || matrixData.status}`);
        
        const travelTimes = new Map<string, number>();
        matrixData.rows.forEach((row: any, index: number) => {
            if (row.elements[0].status === 'OK') {
                travelTimes.set(origins[index], Math.round(row.elements[0].duration.value / 60));
            }
        });

        for (let i = 0; i < 14; i++) {
            const currentDay = new Date(today);
            currentDay.setDate(today.getDate() + i);

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