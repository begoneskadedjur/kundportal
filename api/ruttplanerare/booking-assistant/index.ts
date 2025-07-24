// api/ruttplanerare/booking-assistant/index.ts
// VERSION 2.0 - UPPGRADERAD MED SCHEMAKONTROLL, ARBETSTIDER OCH STARTADRESSER

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Konfiguration ---
const WORK_DAY_START_HOUR = 8;  // Arbetstiden börjar kl 08:00
const WORK_DAY_END_HOUR = 17;   // Arbetstiden slutar kl 17:00
const JOB_DURATION_MINUTES = 120; // Standardlängd på ett ärende

// --- Datatyper ---
interface StaffMember { id: string; name: string; address: string | null; }
interface TimeSlot { start: Date; end: Date; }
interface Suggestion {
    technician_id: string; technician_name: string;
    start_time: string; // ISO format
    end_time: string;   // ISO format
    travel_time_minutes: number;
    origin_description: string; // "Hemadress" eller "Ärende: X"
}

const formatAddress = (address: any): string => { 
    if (!address) return ''; if (typeof address === 'object' && address.formatted_address) return address.formatted_address; return String(address);
};

// Hjälpfunktion för att kolla om två tidsluckor överlappar
const doTimeSlotsOverlap = (slot1: TimeSlot, slot2: TimeSlot): boolean => {
    return slot1.start < slot2.end && slot1.end > slot2.start;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Endast POST är tillåtet' });

    try {
        const { newCaseAddress, pestType } = req.body;
        if (!newCaseAddress || !pestType) return res.status(400).json({ error: 'Adress och skadedjurstyp måste anges.' });

        // 1. Hitta personal med rätt kompetens OCH deras hemadresser
        const { data: competentStaffData, error: staffError } = await supabase
            .from('staff_competencies')
            .select('technicians(id, name, address)') // Hämta data från den kopplade 'technicians'-tabellen
            .eq('pest_type', pestType);

        if (staffError) throw staffError;
        const competentStaff: StaffMember[] = competentStaffData.map((s: any) => s.technicians).filter(Boolean);
        if (competentStaff.length === 0) return res.status(200).json([]);

        const competentStaffIds = competentStaff.map(s => s.id);

        // 2. Hämta ALLA bokningar för den kompetenta personalen de kommande 14 dagarna
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

        // Skapa en schemakarta: { technician_id: [ {start: Date, end: Date}, ... ] }
        const schedules = new Map<string, TimeSlot[]>();
        for (const staff of competentStaff) { schedules.set(staff.id, []); }
        for (const aCase of cases) {
            schedules.get(aCase.technician_id)?.push({ start: new Date(aCase.start_date), end: new Date(aCase.due_date) });
        }

        // 3. Generera alla potentiella förslag
        let allSuggestions: Suggestion[] = [];
        
        const origins = [
            ...competentStaff.map(s => s.address), // Hemadresser
            ...cases.map(c => formatAddress(c.adress)) // Ärendeadresser
        ].filter(Boolean) as string[];

        const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY!;
        const matrixApiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins.join('|')}&destinations=${newCaseAddress}&key=${googleMapsApiKey}`;
        const matrixResponse = await fetch(matrixApiUrl);
        const matrixData = await matrixResponse.json() as any;
        if (matrixData.status !== 'OK') throw new Error(`Google Maps API fel: ${matrixData.error_message || matrixData.status}`);
        
        const travelTimes = new Map<string, number>(); // Adress -> restid i minuter
        matrixData.rows.forEach((row: any, index: number) => {
            if(row.elements[0].status === 'OK') {
                travelTimes.set(origins[index], Math.round(row.elements[0].duration.value / 60));
            }
        });

        // Loopa igenom varje dag och varje tekniker för att hitta luckor
        for (let i = 0; i < 14; i++) {
            const currentDay = new Date(today);
            currentDay.setDate(today.getDate() + i);

            for (const staff of competentStaff) {
                const techSchedule = schedules.get(staff.id)!.sort((a,b) => a.start.getTime() - b.start.getTime());
                const workDayStart = new Date(currentDay).setHours(WORK_DAY_START_HOUR, 0, 0, 0);
                const workDayEnd = new Date(currentDay).setHours(WORK_DAY_END_HOUR, 0, 0, 0);

                // Förslag 1: Start på dagen från hemadress
                if (staff.address) {
                    const travelFromHome = travelTimes.get(staff.address) || 0;
                    const earliestArrival = new Date(workDayStart).getTime() + travelFromHome * 60 * 1000;
                    const potentialStart = new Date(Math.max(earliestArrival, workDayStart));
                    const potentialEnd = new Date(potentialStart.getTime() + JOB_DURATION_MINUTES * 60 * 1000);

                    if (potentialEnd.getTime() <= workDayEnd && !techSchedule.some(slot => doTimeSlotsOverlap({start: potentialStart, end: potentialEnd}, slot))) {
                        allSuggestions.push({
                            technician_id: staff.id, technician_name: staff.name,
                            start_time: potentialStart.toISOString(), end_time: potentialEnd.toISOString(),
                            travel_time_minutes: travelFromHome, origin_description: "Hemadress"
                        });
                    }
                }

                // Förslag 2: Mellan befintliga jobb
                for (const existingCase of techSchedule) {
                    const travelFromCase = travelTimes.get(formatAddress(existingCase.adress)) || 0;
                    const potentialStart = new Date(existingCase.end.getTime() + travelFromCase * 60 * 1000);
                    const potentialEnd = new Date(potentialStart.getTime() + JOB_DURATION_MINUTES * 60 * 1000);

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
        
        // 4. Filtrera och sortera förslag
        const sortedSuggestions = allSuggestions
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()) // Sortera på starttid
            .sort((a, b) => a.travel_time_minutes - b.travel_time_minutes); // Sortera sedan på restid

        res.status(200).json(sortedSuggestions.slice(0, 5));

    } catch (error: any) {
        console.error("Fel i bokningsassistent:", error);
        res.status(500).json({ error: "Ett internt fel uppstod.", details: error.message });
    }
}