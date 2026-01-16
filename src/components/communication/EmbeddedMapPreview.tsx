// src/components/communication/EmbeddedMapPreview.tsx
// Inbäddad kartpreview med Google Maps iframe

import React, { useState } from 'react';
import { MapPin, ExternalLink, Loader2 } from 'lucide-react';

interface EmbeddedMapPreviewProps {
  lat: number | null;
  lng: number | null;
  address: string | null;
  height?: number;
  className?: string;
}

// Generera Google Maps URL för iframe embed
// Zoom-nivå 12 ger stadsvy så man ser var i staden ärendet ligger
const generateEmbedUrl = (lat: number | null, lng: number | null, address: string | null): string | null => {
  if (lat && lng) {
    return `https://maps.google.com/maps?q=${lat},${lng}&z=12&output=embed`;
  }
  if (address) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=12&output=embed`;
  }
  return null;
};

// Generera Google Maps URL för extern länk
const generateMapsLink = (lat: number | null, lng: number | null, address: string | null): string | null => {
  if (lat && lng) {
    return `https://maps.google.com/maps?q=${lat},${lng}`;
  }
  if (address) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(address)}`;
  }
  return null;
};

export default function EmbeddedMapPreview({
  lat,
  lng,
  address,
  height = 140,
  className = ''
}: EmbeddedMapPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const embedUrl = generateEmbedUrl(lat, lng, address);
  const mapsLink = generateMapsLink(lat, lng, address);

  // Om varken koordinater eller adress finns, visa ingenting
  if (!embedUrl) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Kartcontainer */}
      <div
        className="relative rounded-lg overflow-hidden border border-slate-700/50"
        style={{ height: `${height}px` }}
      >
        {/* Laddningsindikator */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 bg-slate-800 flex items-center justify-center z-10">
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
          </div>
        )}

        {/* Felmeddelande */}
        {hasError && (
          <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center z-10">
            <MapPin className="w-6 h-6 text-slate-500 mb-2" />
            <p className="text-xs text-slate-500">Kunde inte ladda kartan</p>
          </div>
        )}

        {/* Iframe med karta */}
        <iframe
          src={embedUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Karta som visar ärendets plats"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          className={`${isLoading || hasError ? 'invisible' : 'visible'}`}
        />

        {/* Dark theme overlay för att matcha designen */}
        <div
          className="absolute inset-0 pointer-events-none bg-slate-900/10"
          style={{ mixBlendMode: 'multiply' }}
        />

        {/* Klickbar overlay för att öppna i Maps */}
        {mapsLink && (
          <a
            href={mapsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 z-20 cursor-pointer"
            aria-label="Öppna i Google Maps"
          />
        )}
      </div>

      {/* Adress och länk */}
      {address && (
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-slate-200 flex-1">{address}</p>
          {mapsLink && (
            <a
              href={mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Maps
            </a>
          )}
        </div>
      )}
    </div>
  );
}
