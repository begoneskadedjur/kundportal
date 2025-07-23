// 📁 src\pages\coordinator\BookingAssistant.tsx
// Uppdaterad med korrekt API-sökväg.

import React, { useState } from 'react';
import { Clock, MapPin, User, Zap, ArrowRight, Check } from 'lucide-react';

// Datatyper
interface Suggestion {
    technician_name: string;
    date: string;
    suggested_time: string;
    travel_time_minutes: number;
    based_on_case: {
        title: string;
    };
}

const SmallSpinner = () => <div style={{ border: '2px solid #374151', borderTopColor: '#3b82f6', borderRadius: '50%', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />;

export default function BookingAssistant() {
    // State för formulär, förslag och laddning
    const [address, setAddress] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const findSuggestions = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!address) {
            setError("Du måste ange en adress.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setSuggestions([]);

        try {
            // ✅ KORRIGERAD SÖKVÄG HÄR
            const response = await fetch('/api/ruttplanerare/booking-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newCaseAddress: address })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Något gick fel');

            setSuggestions(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ padding: '2rem', background: '#111827', color: 'white', minHeight: '100vh', fontFamily: 'sans-serif' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Intelligent Bokningsassistent</h1>
                <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>Få förslag på den mest effektiva tiden att boka ett nytt ärende.</p>

                <form onSubmit={findSuggestions} style={{ background: '#1f2937', padding: '1.5rem', borderRadius: '0.5rem' }}>
                    <label htmlFor="address" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Ny adress</label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <input
                            type="text"
                            id="address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="T.ex. Storgatan 5, 123 45 Stockholm"
                            style={{ flexGrow: 1, padding: '0.75rem', background: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '0.25rem' }}
                        />
                        <button type="submit" disabled={isLoading} style={{ display: 'flex', alignItems: 'center', background: '#3b82f6', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>
                            {isLoading ? <><SmallSpinner /> <span style={{ marginLeft: '0.5rem' }}>Söker...</span></> : <><Zap size={16} style={{ marginRight: '0.5rem' }} /> Hitta bästa tid</>}
                        </button>
                    </div>
                </form>

                {error && <p style={{ color: '#ef4444', marginTop: '1rem' }}>Fel: {error}</p>}

                <div style={{ marginTop: '2rem' }}>
                    {suggestions.length > 0 && <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Bokningsförslag</h2>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {suggestions.map((sugg, index) => (
                            <div key={index} style={{ background: index === 0 ? 'rgba(59, 130, 246, 0.1)' : '#1f2937', border: `1px solid ${index === 0 ? 'rgba(59, 130, 246, 0.5)' : '#374151'}`, padding: '1.5rem', borderRadius: '0.5rem' }}>
                                {index === 0 && <p style={{ color: '#60a5fa', fontWeight: 'bold', marginBottom: '0.5rem' }}>Bästa förslag</p>}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '1.125rem' }}><User size={16} /> {sugg.technician_name}</p>
                                        <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9ca3af', marginTop: '0.25rem' }}><Clock size={16} /> {new Date(sugg.date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}, {sugg.suggested_time}</p>
                                    </div>
                                    <button style={{ background: '#10b981', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Check size={16}/> Boka
                                    </button>
                                </div>
                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #374151', color: '#9ca3af', fontSize: '0.875rem' }}>
                                    <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <ArrowRight size={14} /> Beräknad restid: <strong style={{ color: 'white' }}>{sugg.travel_time_minutes} min</strong>
                                    </p>
                                    <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                        <MapPin size={14} /> Föreslås efter ärendet: <strong style={{ color: 'white' }}>{sugg.based_on_case.title}</strong>
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}