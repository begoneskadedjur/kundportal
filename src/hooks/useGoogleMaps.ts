// src/hooks/useGoogleMaps.ts
// Hook för att ladda Google Maps API

import { useState, useEffect } from 'react';

interface GoogleMapsConfig {
  apiKey?: string;
  libraries?: string[];
}

export function useGoogleMaps(config: GoogleMapsConfig = {}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Om redan laddat
    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }

    // Om redan laddning pågår
    if (isLoading) return;

    // Försök hitta API-nyckel från olika källor
    const apiKey = config.apiKey || 
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 
      import.meta.env.GOOGLE_MAPS_API_KEY;

    console.log('[useGoogleMaps] API key tillgänglig:', !!apiKey);

    if (!apiKey) {
      console.error('[useGoogleMaps] Ingen Google Maps API key hittad');
      setError('Google Maps API key saknas. Kontrollera miljövariabler.');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Skapa script element
    const script = document.createElement('script');
    const libraries = config.libraries?.join(',') || 'geometry';
    
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries}`;
    script.async = true;
    script.defer = true;

    // Hantera success
    script.onload = () => {
      console.log('[useGoogleMaps] Google Maps API laddad framgångsrikt');
      setIsLoaded(true);
      setIsLoading(false);
    };

    // Hantera fel
    script.onerror = (event) => {
      console.error('[useGoogleMaps] Fel vid laddning av Google Maps API:', event);
      setError('Kunde inte ladda Google Maps API. Kontrollera API-nyckel och internet.');
      setIsLoading(false);
    };

    // Lägg till script i head
    document.head.appendChild(script);

    // Cleanup function
    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [config.apiKey, isLoading]);

  return {
    isLoaded,
    isLoading,
    error
  };
}