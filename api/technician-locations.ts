// 📁 api/technician-locations.ts
// 🗺️ Hämta tekniker-positioner från ABAX API

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ABAX API funktioner  
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
        const errorText = await response.text();
        console.error("ABAX Token Error:", errorText);
        throw new Error(`Kunde inte hämta ABAX token: ${response.status}`);
    }
    
    const data = await response.json() as { access_token: string };
    return data.access_token;
}

async function getVehicleLocation(token: string, vehicleId: string) {
    const response = await fetch(`https://api.abax.cloud/v1/vehicles/${vehicleId}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!response.ok) {
        console.error(`ABAX Location Error for vehicle ${vehicleId}:`, response.status);
        return null; // Returnera null istället för att kasta fel
    }

    const vehicleData = await response.json() as { 
        location?: { 
            latitude?: number; 
            longitude?: number; 
            address?: string;
            lastUpdate?: string; 
        };
        status?: string;
    };
    
    const lat = vehicleData?.location?.latitude;
    const lng = vehicleData?.location?.longitude;

    if (lat === undefined || lng === undefined) {
        console.warn(`Vehicle ${vehicleId} saknar giltig positionsdata`);
        return null;
    }

    return {
        lat,
        lng,
        address: vehicleData.location?.address || 'Okänd adress',
        lastUpdate: vehicleData.location?.lastUpdate,
        status: vehicleData.status || 'unknown'
    };
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

        // 3. Hämta dagens ärenden för alla tekniker i en batch
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

        // 4. Hämta fordonpositioner från ABAX
        const technicianLocations = await Promise.all(
            technicians.map(async (tech) => {
                try {
                    const location = await getVehicleLocation(abaxToken, tech.abax_vehicle_id);
                    const caseCount = caseCounts[tech.id] || 0;
                    
                    if (!location) {
                        // Fallback till Stockholm-centrum om ABAX saknar data
                        return {
                            id: tech.id,
                            name: tech.name,
                            lat: 59.3293 + (Math.random() - 0.5) * 0.02,
                            lng: 18.0686 + (Math.random() - 0.5) * 0.02,
                            cases: caseCount,
                            status: caseCount > 0 ? 'active' : 'inactive',
                            vehicle_id: tech.abax_vehicle_id,
                            current_address: 'Stockholm, Sverige (uppskattad)',
                            last_updated: new Date().toISOString(),
                            data_source: 'fallback'
                        };
                    }

                    return {
                        id: tech.id,
                        name: tech.name,
                        lat: location.lat,
                        lng: location.lng,
                        cases: caseCount,
                        status: caseCount > 0 ? 'active' : 'inactive',
                        vehicle_id: tech.abax_vehicle_id,
                        current_address: location.address,
                        last_updated: location.lastUpdate || new Date().toISOString(),
                        data_source: 'abax'
                    };
                } catch (error) {
                    console.error(`Fel för tekniker ${tech.name}:`, error);
                    // Returnera fallback-data vid fel
                    return {
                        id: tech.id,
                        name: tech.name,
                        lat: 59.3293 + (Math.random() - 0.5) * 0.02,
                        lng: 18.0686 + (Math.random() - 0.5) * 0.02,
                        cases: caseCounts[tech.id] || 0,
                        status: 'inactive',
                        vehicle_id: tech.abax_vehicle_id,
                        current_address: 'Position okänd',
                        last_updated: new Date().toISOString(),
                        data_source: 'error'
                    };
                }
            })
        );

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