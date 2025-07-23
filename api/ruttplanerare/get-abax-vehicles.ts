// 📁 api/ruttplanerare/get-abax-vehicles.ts
// En funktion för att lista alla fordon och deras ID:n från ABAX.
// Används för att enkelt kunna koppla tekniker till fordon i databasen.

import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

// --- HJÄLPFUNKTION FÖR ABAX API ---
async function getAbaxToken() {
    // Samma beprövade funktion för att hämta en token
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
        throw new Error('Kunde inte hämta ABAX token. Kontrollera ABAX_CLIENT_ID och ABAX_CLIENT_SECRET i Vercel.');
    }
    const data = await response.json() as { access_token: string };
    return data.access_token;
}

// --- HUVUDFUNKTION ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Denna funktion är designad för att vara enkel och säker,
    // så vi tillåter bara GET-förfrågningar.
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Endast GET-förfrågningar är tillåtna för denna endpoint.' });
    }

    try {
        console.log("Försöker hämta ABAX token för att lista fordon...");
        const abaxToken = await getAbaxToken();
        console.log("Token mottagen, hämtar fordonslista...");

        // Anropar ABAX endpoint för att hämta en lista över alla fordon
        const vehiclesResponse = await fetch('https://api.abax.cloud/v1/vehicles', {
            headers: { Authorization: `Bearer ${abaxToken}` },
        });

        if (!vehiclesResponse.ok) {
            const errorText = await vehiclesResponse.text();
            console.error("Fel vid anrop till ABAX fordons-API:", errorText);
            throw new Error(`Kunde inte hämta fordonslistan från ABAX. Servern svarade med status: ${vehiclesResponse.status}`);
        }

        const vehiclesData = await vehiclesResponse.json() as { items: any[] };
        
        // Plockar ut bara den mest relevanta informationen för att göra listan ren och tydlig
        const simplifiedVehicles = vehiclesData.items.map(vehicle => ({
            id: vehicle.id,
            alias: vehicle.alias || 'Inget alias',
            license_plate: vehicle.license_plate?.number || 'Okänt regnr',
            driver: vehicle.driver?.name || 'Ingen förare kopplad'
        }));
        
        console.log(`Hittade ${simplifiedVehicles.length} fordon.`);

        // Skicka tillbaka den förenklade listan som ett JSON-svar
        res.status(200).json(simplifiedVehicles);

    } catch (error: any) {
        console.error("Ett allvarligt fel inträffade i get-abax-vehicles:", error);
        // Skicka ett mer informativt felmeddelande till klienten
        res.status(500).json({ 
            error: "Ett internt serverfel inträffade.",
            details: error.message 
        });
    }
}