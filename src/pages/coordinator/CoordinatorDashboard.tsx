// 📁 src/pages/coordinator/CoordinatorDashboard.tsx
// ⭐ VERSION 1.3 - STABILISERAD DATAHÄMTNING ⭐
// Denna version löser problemet med automatisk utloggning.
// 1. ANVÄND AUTHCONTEXT: Importerar och använder useAuth för att få
//    åtkomst till autentiseringsstatus.
// 2. KONTROLLERAD DATAHÄMTNING: useEffect-hooksen väntar nu på att
//    AuthContext INTE längre är i ett 'loading'-läge innan de försöker
//    hämta data från Supabase. Detta förhindrar race conditions.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Map, Zap, ChevronsRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext'; // ✅ STEG 1: Importera useAuth

// Definiera datatyper för tydlighet
interface Technician {
    id: string;
    name: string;
}

interface Case {
    id: string;
    title: string;
    adress: any;
}

// Liten laddningsspinner-komponent
const SmallSpinner = () => <div style={{ border: '2px solid #374151', borderTopColor: '#3b82f6', borderRadius: '50%', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />;

const formatAddress = (address: any): string => {
    if (!address) return '';
    if (typeof address === 'object' && address.formatted_address) return address.formatted_address;
    if (typeof address === 'string') { try { const p = JSON.parse(address); return p.formatted_address || address; } catch (e) { return address; } } return '';
};

export default function CoordinatorDashboard() {
    const { loading: authLoading } = useAuth(); // ✅ STEG 2: Hämta laddningsstatus från AuthContext

    // State-hantering
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    
    const [cases, setCases] = useState<Case[]>([]);
    const [isLoadingCases, setIsLoadingCases] = useState(false);
    
    const [optimizedRoute, setOptimizedRoute] = useState<{ order: number[], url: string } | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 1. Hämta listan över alla tekniker
    useEffect(() => {
        // ✅ STEG 2: Vänta tills auth är klar innan vi hämtar data
        if (authLoading) return;

        const fetchTechnicians = async () => {
            const { data, error } = await supabase
                .from('technicians')
                .select('id, name')
                .order('name');
            
            if (error) {
                console.error("Fel vid hämtning av tekniker:", error);
                setError("Kunde inte ladda tekniker.");
            } else {
                setTechnicians(data || []);
            }
        };
        fetchTechnicians();
    }, [authLoading]); // Kör om när authLoading ändras

    // 2. Hämta ärenden för en specifik tekniker och ett datum
    const fetchCasesForTechnician = useCallback(async (technicianId: string, date: string) => {
        if (!technicianId || !date) return;

        setIsLoadingCases(true);
        setError(null);
        setCases([]);
        setOptimizedRoute(null);

        const startDate = `${date}T00:00:00`;
        const endDate = `${date}T23:59:59`;

        try {
            const { data: privateCases, error: privateError } = await supabase
                .from('private_cases')
                .select('id, title, adress')
                .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId}`)
                .gte('start_date', startDate)
                .lte('start_date', endDate);

            if (privateError) throw privateError;

            const { data: businessCases, error: businessError } = await supabase
                .from('business_cases')
                .select('id, title, adress')
                .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId}`)
                .gte('start_date', startDate)
                .lte('start_date', endDate);
            
            if (businessError) throw businessError;

            const combinedCases = [...(privateCases || []), ...(businessCases || [])];
            setCases(combinedCases);

        } catch (err: any) {
            console.error("Fel vid hämtning av ärenden:", err);
            setError(err.message || "Kunde inte hämta ärenden.");
        } finally {
            setIsLoadingCases(false);
        }
    }, []);
    
    useEffect(() => {
        // ✅ STEG 2: Vänta tills auth är klar innan vi hämtar data
        if (authLoading) return;
        fetchCasesForTechnician(selectedTechnicianId, selectedDate);
    }, [selectedTechnicianId, selectedDate, fetchCasesForTechnician, authLoading]); // Kör om när authLoading ändras

    // 3. Optimera rutten
    const handleOptimizeRoute = async () => {
        if (cases.length < 2) {
            setError("Behöver minst två ärenden för att optimera.");
            return;
        }
        setIsOptimizing(true);
        setError(null);

        try {
            const addresses = cases.map(c => formatAddress(c.adress)).filter(Boolean);
            if(addresses.length < cases.length) {
                console.warn("Vissa ärenden saknar giltiga adresser och kommer ignoreras.");
            }
            
            // Notera: du hade redan korrigerat sökvägen här, den är rätt.
            const response = await fetch('/api/ruttplanerare/optimize-route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    addresses,
                    technicianId: selectedTechnicianId 
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Något gick fel på servern');
            
            setOptimizedRoute({ order: data.optimizedOrder, url: data.navigationUrl });

        } catch (err: any) {
            console.error("Optimeringsfel:", err);
            setError(err.message);
        } finally {
            setIsOptimizing(false);
        }
    };

    const displayCases = useMemo(() => {
        if (!optimizedRoute) return cases;
        return optimizedRoute.order.map(index => cases[index]);
    }, [cases, optimizedRoute]);

    return (
        <div style={{ padding: '2rem', background: '#111827', color: 'white', minHeight: '100vh', fontFamily: 'sans-serif' }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>Ruttplanerare för Koordinator</h1>
                
                <div style={{ display: 'flex', gap: '1rem', background: '#1f2937', padding: '1rem', borderRadius: '0.5rem', marginBottom: '2rem' }}>
                    <div style={{ flex: 1 }}>
                        <label htmlFor="technician-select" style={{ display: 'block', marginBottom: '0.5rem', color: '#9ca3af' }}>Välj Tekniker</label>
                        <select
                            id="technician-select"
                            value={selectedTechnicianId}
                            onChange={(e) => setSelectedTechnicianId(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', background: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '0.25rem' }}
                        >
                            <option value="">-- Välj en tekniker --</option>
                            {technicians.map(tech => (
                                <option key={tech.id} value={tech.id}>{tech.name}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ flex: 1 }}>
                        <label htmlFor="date-select" style={{ display: 'block', marginBottom: '0.5rem', color: '#9ca3af' }}>Välj Datum</label>
                        <input
                            type="date"
                            id="date-select"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={{ width: '100%', padding: '0.5rem', background: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '0.25rem' }}
                        />
                    </div>
                </div>

                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Ärenden</h2>
                        {cases.length > 1 && (
                            optimizedRoute ? (
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <a href={optimizedRoute.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', background: '#10b981', padding: '0.5rem 1rem', borderRadius: '0.5rem', color: 'white', textDecoration: 'none' }}>
                                        <Map size={16} style={{ marginRight: '0.5rem' }} /> Öppna i Google Maps
                                    </a>
                                    <button onClick={() => setOptimizedRoute(null)} style={{ background: '#4b5563', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', color: 'white', cursor: 'pointer' }}>Återställ</button>
                                </div>
                            ) : (
                                <button onClick={handleOptimizeRoute} disabled={isOptimizing || cases.length < 2} style={{ display: 'flex', alignItems: 'center', background: '#3b82f6', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', color: 'white', cursor: 'pointer', opacity: (isOptimizing || cases.length < 2) ? 0.5 : 1 }}>
                                    {isOptimizing ? <><SmallSpinner /> <span style={{ marginLeft: '0.5rem' }}>Optimerar...</span></> : <><Zap size={16} style={{ marginRight: '0.5rem' }} /> Optimera Rutt</>}
                                </button>
                            )
                        )}
                    </div>

                    {error && <p style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '0.5rem' }}>Fel: {error}</p>}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {isLoadingCases ? (
                            <p style={{ color: '#9ca3af' }}>Laddar ärenden...</p>
                        ) : displayCases.length > 0 ? (
                            displayCases.map((caseItem, index) => (
                                <div key={caseItem.id} style={{ background: '#1f2937', padding: '1rem', borderRadius: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    {optimizedRoute && <span style={{ background: '#3b82f6', borderRadius: '50%', width: '2.5rem', height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>{index + 1}</span>}
                                    <div>
                                        <h3>{caseItem.title}</h3>
                                        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>{formatAddress(caseItem.adress)}</p>
                                    </div>
                                    <ChevronsRight size={20} style={{ marginLeft: 'auto', color: '#6b7280' }} />
                                </div>
                            ))
                        ) : (
                            <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem', background: '#1f2937', borderRadius: '0.5rem' }}>
                                Inga ärenden hittades för den valda teknikern på detta datum.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}