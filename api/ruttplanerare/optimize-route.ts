// 📁 src/api/ruttplanerare/optimize-route.ts

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// Skapa en Supabase-klient för att prata med din databas
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    // ABAX API förväntar sig ID utan "abax-vehicle-" prefixet
    const numericVehicleId = vehicleId.replace('abax-vehicle-', '');
    const response = await fetch(`https://api.abax.cloud/v1/vehicles/${numericVehicleId}/locations`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        console.error("ABAX Location Error:", await response.text());
        throw new Error('Kunde inte hämta fordonsposition');
    }
    const data = await response.json() as { lat: number, lng: number }[];
    if (data.length === 0) throw new Error('Fordon hittades inte eller saknar positionsdata');
    return `${data[0].lat},${data[0].lng}`;
}


// --- HUVUDFUNKTION ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Endast POST är tillåtet' });
    }

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