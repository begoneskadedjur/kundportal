// 📁 api/ruttplanerare/optimize-route.ts
// ⭐ VERSION 2.3 - FIX FÖR "response is not defined" ⭐
// Denna version åtgärdar ett ReferenceError som orsakades av ett stavfel
// i variabelnamnet vid hantering av Google Maps-svaret.

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from '../_lib/auth';

// Använder de korrekta miljövariabel-namnen för ditt projekt
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- HJÄLPFUNKTIONER FÖR ABAX API ---
async function getAbaxToken() {
    const response = await fetch('https://identity.abax.cloud/connect/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: process.env.ABAX_CLIENT_ID!,
            client_secret: process.env.ABAX_CLIENT_SECRET!,
            scope: 'open_api open_api.vehicles',
        }),
    });
    if (!response.ok) {
        console.error("ABAX Token Error:", await response.text());
        throw new Error('Kunde inte hämta ABAX token');
    }
    const data = await response.json() as { access_token: string };
    return data.access_token;
}

async function getVehicleLocation(token: string, vehicleId: string) {
    const response = await fetch(`https://api.abax.cloud/v1/vehicles/${vehicleId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        console.error("ABAX Location Error:", await response.text());
        throw new Error('Kunde inte hämta fordonsposition');
    }

    const vehicleData = await response.json() as { location?: { latitude?: number, longitude?: number } };
    
    const lat = vehicleData?.location?.latitude;
    const lng = vehicleData?.location?.longitude;

    if (lat === undefined || lng === undefined) {
        throw new Error('Fordon hittades, men saknar giltig positionsdata (lat/lng)');
    }

    return `${lat},${lng}`;
}

// --- HUVUDFUNKTION ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Endast POST är tillåtet' });
    }

    // Död endpoint utan UI-anropare - låst till admin (säkerhetsaudit juni 2026)
    const auth = await requireAuth(req, res, ['admin']);
    if (!auth) return;

    try {
        const { addresses, technicianId } = req.body;
        if (!addresses || addresses.length === 0 || !technicianId) {
            return res.status(400).json({ error: 'Saknar adresser eller tekniker-ID' });
        }

        // 1. Hämta fordonets ID från DIN databas (Supabase)
        const { data: technician, error: techError } = await supabase
            .from('technicians')
            .select('abax_vehicle_id')
            .eq('id', technicianId)
            .single();

        if (techError || !technician || !technician.abax_vehicle_id) {
            throw new Error('Tekniker hittades inte eller saknar kopplat fordons-ID.');
        }
        
        const vehicleId = technician.abax_vehicle_id;

        // 2. Hämta bilens nuvarande position från ABAX
        const abaxToken = await getAbaxToken();
        const startLocation = await getVehicleLocation(abaxToken, vehicleId);

        // 3. Anropa Google Maps API för att optimera rutten
        const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY!;
        const waypoints = addresses.join('|');
        const googleApiUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${startLocation}&destination=${startLocation}&waypoints=optimize:true|${waypoints}&key=${googleMapsApiKey}`;
        
        const directionsResponse = await fetch(googleApiUrl);
        if (!directionsResponse.ok) throw new Error('Kunde inte hämta rutt från Google Maps');
        
        // ✅ KORRIGERAD RAD: Använder nu 'directionsResponse' istället för 'response'
        const directionsData = await directionsResponse.json() as any;
        if (directionsData.status !== 'OK') throw new Error(`Google Maps fel: ${directionsData.status}`);

        // 4. Skicka tillbaka den optimerade ordningen och en navigeringslänk
        const optimizedOrder = directionsData.routes[0].waypoint_order as number[];
        const reorderedWaypoints = optimizedOrder.map(index => addresses[index]);
        const navigationUrl = `https://www.google.com/maps/dir/?api=1&origin=${startLocation}&destination=${startLocation}&waypoints=${reorderedWaypoints.join('|')}`;

        res.status(200).json({
            optimizedOrder,
            navigationUrl,
        });

    } catch (error: any) {
        console.error("Ruttoptimeringsfel:", error);
        res.status(500).json({ error: error.message });
    }
}

// SLUT PÅ DEL 2 AV 2