// api/ruttplanerare/booking-assistant/index.ts
// UPPDATERAD MED KOMPETENSFILTER

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Datatyper (oförändrade)
interface ExistingCase { id: string; title: string; adress: any; start_date: string; due_date: string; technician_id: string; technician_name: string; }
interface Suggestion { technician_id: string; technician_name: string; date: string; suggested_time: string; travel_time_minutes: number; based_on_case: { id: string; title: string; }; }

const formatAddress = (address: any): string => { 
    if (!address) return ''; if (typeof address === 'object' && address.formatted_address) return address.formatted_address; return String(address);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Endast POST är tillåtet' });
    }

    try {
        const { newCaseAddress, pestType } = req.body; // ✅ Hämta pestType
        if (!newCaseAddress || !pestType) {
            return res.status(400).json({ error: 'Adress och skadedjurstyp måste anges.' });
        }

        // --- ✅ STEG 1: Hitta personal med rätt kompetens ---
        console.log(`Söker personal med kompetens för: ${pestType}`);
        const { data: competentStaff, error: competencyError } = await supabase
            .from('staff_competencies')
            .select('staff_id')
            .eq('pest_type', pestType);

        if (competencyError) throw competencyError;

        const competentStaffIds = competentStaff.map(s => s.staff_id);
        if (competentStaffIds.length === 0) {
            console.log(`Ingen personal hittades med kompetens för ${pestType}.`);
            return res.status(200).json([]); // Returnera tomt, inga förslag är möjliga
        }
        console.log(`${competentStaffIds.length} personer hittades med rätt kompetens.`);

        // --- STEG 2: Hämta relevanta ärenden för den kompetenta personalen ---
        const today = new Date();
        const fourteenDaysFromNow = new Date();
        fourteenDaysFromNow.setDate(today.getDate() + 14);

        const { data: cases, error: casesError } = await supabase
            .from('cases_with_technician_view') // Använder fortfarande din befintliga view
            .select('id, title, adress, start_date, due_date, technician_id, technician_name')
            .gte('start_date', today.toISOString())
            .lte('start_date', fourteenDaysFromNow.toISOString())
            .in('technician_id', competentStaffIds) // ✅ FILTRERA PÅ KOMPETENT PERSONAL
            .order('start_date', { ascending: true });
        
        if (casesError) throw casesError;
        if (!cases || cases.length === 0) {
            return res.status(200).json([]);
        }

        // --- STEG 3 & 4: Beräkna restider och skapa förslag (oförändrat) ---
        const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY!;
        const origins = cases.map(c => formatAddress(c.adress)).filter(Boolean);
        const destination = newCaseAddress;
        
        const matrixApiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins.join('|')}&destinations=${destination}&key=${googleMapsApiKey}`;
        const matrixResponse = await fetch(matrixApiUrl);
        const matrixData = await matrixResponse.json() as any;

        if (matrixData.status !== 'OK') {
            throw new Error(`Google Maps API fel: ${matrixData.error_message || matrixData.status}`);
        }

        const suggestions: Suggestion[] = [];
        matrixData.rows.forEach((row: any, index: number) => {
            if (row.elements[0].status === 'OK') {
                const existingCase = cases[index];
                suggestions.push({
                    technician_id: existingCase.technician_id,
                    technician_name: existingCase.technician_name,
                    date: new Date(existingCase.start_date).toISOString().split('T')[0],
                    suggested_time: `Efter kl. ${new Date(existingCase.due_date).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`,
                    travel_time_minutes: Math.round(row.elements[0].duration.value / 60),
                    based_on_case: { id: existingCase.id, title: existingCase.title },
                });
            }
        });

        const sortedSuggestions = suggestions.sort((a, b) => a.travel_time_minutes - b.travel_time_minutes);
        res.status(200).json(sortedSuggestions.slice(0, 5));

    } catch (error: any) {
        console.error("Fel i bokningsassistent:", error);
        res.status(500).json({ error: "Ett internt fel uppstod.", details: error.message });
    }
}