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

    const apiKey = config.apiKey || 
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 
      import.meta.env.VITE_GOOGLE_GEOCODING;

    if (!apiKey) {
      setError('Google Maps API key saknas');
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
      setIsLoaded(true);
      setIsLoading(false);
    };

    // Hantera fel
    script.onerror = () => {
      setError('Kunde inte ladda Google Maps API');
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