// 📁 api/technician-locations.ts
// 🗺️ Hämta tekniker-positioner från ABAX API

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ABAX API funktioner enligt officiell dokumentation
async function getAbaxToken() {
    console.log('[ABAX] Requesting access token...');
    
    const response = await fetch('https://identity.abax.cloud/connect/token', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'BeGone-Kundportal/1.0'
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: process.env.ABAX_CLIENT_ID!,
            client_secret: process.env.ABAX_CLIENT_SECRET!,
            scope: 'open_api open_api.vehicles', // Production scopes enligt dokumentation
        }),
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('[ABAX] Token Error:', response.status, errorText);
        throw new Error(`ABAX authentication failed: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json() as { access_token: string; expires_in: number; token_type: string };
    console.log('[ABAX] Token received, expires in:', data.expires_in, 'seconds');
    return data.access_token;
}

// Hämta alla fordonspositioner på en gång - mycket effektivare enligt ABAX dokumentation
async function getAllVehicleLocations(token: string, vehicleIds: string[]) {
    console.log(`[ABAX] Fetching locations for ${vehicleIds.length} vehicles...`);
    
    const response = await fetch('https://api.abax.cloud/v1/vehicles/locations', {
        headers: { 
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'BeGone-Kundportal/1.0'
        },
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ABAX] Locations API Error:`, response.status, errorText);
        return new Map(); // Returnera tom map vid fel
    }

    const locationsData = await response.json() as {
        data: Array<{
            vehicleId: string;
            latitude?: number;
            longitude?: number;
            address?: string;
            timestamp?: string;
            speed?: number;
        }>;
    };
    
    console.log(`[ABAX] Received ${locationsData.data?.length || 0} vehicle locations`);
    
    // Skapa en map för snabb lookup
    const locationMap = new Map();
    
    if (locationsData.data) {
        for (const location of locationsData.data) {
            // Filtrera bara våra tekniker-fordon
            if (vehicleIds.includes(location.vehicleId)) {
                if (location.latitude !== undefined && location.longitude !== undefined) {
                    locationMap.set(location.vehicleId, {
                        lat: location.latitude,
                        lng: location.longitude,
                        address: location.address || await reverseGeocode(location.latitude, location.longitude),
                        lastUpdate: location.timestamp,
                        speed: location.speed || 0
                    });
                }
            }
        }
    }
    
    console.log(`[ABAX] Mapped ${locationMap.size} valid locations`);
    return locationMap;
}

// Reverse geocoding för att få adresser från koordinater
async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}&language=sv&region=se`
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                return data.results[0].formatted_address;
            }
        }
    } catch (error) {
        console.warn('[Geocoding] Failed to reverse geocode:', error);
    }
    
    return 'Stockholm, Sverige'; // Fallback
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Endast GET är tillåtet' });
    }

    try {
        // 1. Hämta aktiva tekniker med fordons-ID
        const { data: technicians, error: techError } = await supabase
            .from('technicians')
            .select('id, name, abax_vehicle_id, is_active')
            .eq('is_active', true)
            .eq('role', 'Skadedjurstekniker')
            .not('abax_vehicle_id', 'is', null);

        if (techError) {
            console.error('Supabase error:', techError);
            return res.status(500).json({ error: 'Kunde inte hämta tekniker från databas' });
        }

        if (!technicians || technicians.length === 0) {
            return res.status(200).json({ technicians: [], message: 'Inga aktiva tekniker med fordons-ID hittades' });
        }

        // 2. Hämta ABAX token
        const abaxToken = await getAbaxToken();
        
        // 3. Hämta alla fordonspositioner på en gång (mycket effektivare)
        const vehicleIds = technicians.map(t => t.abax_vehicle_id);
        const locationMap = await getAllVehicleLocations(abaxToken, vehicleIds);

        // 4. Hämta dagens ärenden för alla tekniker i en batch
        const today = new Date().toISOString().split('T')[0];
        
        const { data: privateCases } = await supabase
            .from('private_cases')
            .select('primary_assignee_id')
            .gte('start_date', today + ' 00:00:00')
            .lte('start_date', today + ' 23:59:59')
            .in('primary_assignee_id', technicians.map(t => t.id));
            
        const { data: businessCases } = await supabase
            .from('business_cases')
            .select('primary_assignee_id')
            .gte('start_date', today + ' 00:00:00')
            .lte('start_date', today + ' 23:59:59')
            .in('primary_assignee_id', technicians.map(t => t.id));

        // Räkna ärenden per tekniker
        const caseCounts: Record<string, number> = {};
        [...(privateCases || []), ...(businessCases || [])].forEach(c => {
            if (c.primary_assignee_id) {
                caseCounts[c.primary_assignee_id] = (caseCounts[c.primary_assignee_id] || 0) + 1;
            }
        });

        // 5. Kombinera tekniker-data med ABAX-positioner
        const technicianLocations = technicians.map((tech) => {
            const caseCount = caseCounts[tech.id] || 0;
            const abaxLocation = locationMap.get(tech.abax_vehicle_id);
            
            if (abaxLocation) {
                return {
                    id: tech.id,
                    name: tech.name,
                    lat: abaxLocation.lat,
                    lng: abaxLocation.lng,
                    cases: caseCount,
                    status: caseCount > 0 ? 'active' : (abaxLocation.speed > 5 ? 'active' : 'inactive'),
                    vehicle_id: tech.abax_vehicle_id,
                    current_address: abaxLocation.address,
                    last_updated: abaxLocation.lastUpdate || new Date().toISOString(),
                    data_source: 'abax',
                    speed: abaxLocation.speed
                };
            } else {
                // Fallback till Stockholm-centrum om ABAX saknar data
                const fallbackPositions = [
                    { lat: 59.3293, lng: 18.0686 }, // Stockholm centrum
                    { lat: 59.3345, lng: 18.0632 }, // Östermalm
                    { lat: 59.3242, lng: 18.0511 }, // Södermalm
                    { lat: 59.3406, lng: 18.0921 }, // Vasastan
                ];
                const randomPos = fallbackPositions[Math.floor(Math.random() * fallbackPositions.length)];
                
                return {
                    id: tech.id,
                    name: tech.name,
                    lat: randomPos.lat + (Math.random() - 0.5) * 0.01,
                    lng: randomPos.lng + (Math.random() - 0.5) * 0.01,
                    cases: caseCount,
                    status: caseCount > 0 ? 'active' : 'inactive',
                    vehicle_id: tech.abax_vehicle_id,
                    current_address: 'Stockholm, Sverige (uppskattad position)',
                    last_updated: new Date().toISOString(),
                    data_source: 'fallback',
                    speed: 0
                };
            }
        });

        res.status(200).json({ 
            technicians: technicianLocations,
            total: technicianLocations.length,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error("Tekniker-locations fel:", error);
        res.status(500).json({ error: error.message || 'Internt serverfel' });
    }
}