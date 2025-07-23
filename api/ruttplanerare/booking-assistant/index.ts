// 📁 api/ruttplanerare/booking-assistant/index.ts
// Hjärnan i den intelligenta bokningsassistenten.

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// Använder samma beprövade anslutningsmetod som dina andra funktioner
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Datatyper
interface ExistingCase {
    id: string;
    title: string;
    adress: any;
    start_date: string;
    due_date: string;
    technician_id: string;
    technician_name: string;
}

interface Suggestion {
    technician_id: string;
    technician_name: string;
    date: string; // YYYY-MM-DD
    suggested_time: string; // t.ex. "Efter kl. 14:00"
    travel_time_minutes: number;
    based_on_case: {
        id: string;
        title: string;
    };
}

// Hjälpfunktion för att formatera adresser
const formatAddress = (address: any): string => {
    if (!address) return '';
    if (typeof address === 'object' && address.formatted_address) return address.formatted_address;
    if (typeof address === 'string') { try { const p = JSON.parse(address); return p.formatted_address || address; } catch (e) { return address; } } return '';
};


export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Endast POST är tillåtet' });
    }

    try {
        const { newCaseAddress } = req.body;
        if (!newCaseAddress) {
            return res.status(400).json({ error: 'Adress för det nya ärendet saknas' });
        }

        // 1. Hämta alla relevanta ärenden för de kommande 14 dagarna
        const today = new Date();
        const fourteenDaysFromNow = new Date();
        fourteenDaysFromNow.setDate(today.getDate() + 14);

        const { data: cases, error: casesError } = await supabase
            .from('cases_with_technician_view') // Antagande: du har en view som joinar cases och technicians
            .select('id, title, adress, start_date, due_date, technician_id, technician_name')
            .gte('start_date', today.toISOString())
            .lte('start_date', fourteenDaysFromNow.toISOString())
            .order('start_date', { ascending: true });
        
        if (casesError) throw casesError;
        if (!cases || cases.length === 0) {
            return res.status(200).json([]); // Returnera tom lista om inga ärenden finns
        }

        // 2. Använd Google Maps för att beräkna restider
        const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY!;
        const origins = cases.map(c => formatAddress(c.adress)).filter(Boolean);
        const destination = newCaseAddress;

        const matrixApiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins.join('|')}&destinations=${destination}&key=${googleMapsApiKey}`;
        const matrixResponse = await fetch(matrixApiUrl);
        const matrixData = await matrixResponse.json() as any;

        if (matrixData.status !== 'OK') {
            throw new Error(`Google Maps Distance Matrix fel: ${matrixData.status}`);
        }

        // 3. Skapa och rangordna förslag
        const suggestions: Suggestion[] = [];
        matrixData.rows.forEach((row: any, index: number) => {
            const element = row.elements[0];
            if (element.status === 'OK') {
                const existingCase = cases[index];
                const travelTimeSeconds = element.duration.value;
                
                // Beräkna föreslagen starttid (sluttid på föregående + restid)
                const previousEndTime = new Date(existingCase.due_date);
                
                suggestions.push({
                    technician_id: existingCase.technician_id,
                    technician_name: existingCase.technician_name,
                    date: new Date(existingCase.start_date).toISOString().split('T')[0],
                    suggested_time: `Efter kl. ${previousEndTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`,
                    travel_time_minutes: Math.round(travelTimeSeconds / 60),
                    based_on_case: {
                        id: existingCase.id,
                        title: existingCase.title,
                    },
                });
            }
        });

        // Sortera förslagen med kortast restid först
        const sortedSuggestions = suggestions.sort((a, b) => a.travel_time_minutes - b.travel_time_minutes);
        
        // Returnera de 5 bästa förslagen
        res.status(200).json(sortedSuggestions.slice(0, 5));

    } catch (error: any) {
        console.error("Fel i bokningsassistent:", error);
        res.status(500).json({ error: error.message });
    }
}