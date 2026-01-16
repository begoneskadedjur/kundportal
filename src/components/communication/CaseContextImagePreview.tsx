// src/components/communication/CaseContextImagePreview.tsx
// Bildpreview med thumbnails för ärendekontext

import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Camera, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { CaseImageService, CaseImageWithUrl, getTagDisplay } from '../../services/caseImageService';
import { CaseType } from '../../types/communication';

interface CaseContextImagePreviewProps {
  caseId: string;
  caseType: CaseType;
  maxThumbnails?: number;
  compact?: boolean; // För mobil
}

interface GroupedImages {
  before: CaseImageWithUrl[];
  after: CaseImageWithUrl[];
  general: CaseImageWithUrl[];
}

// Lightbox-komponent
const ImageLightbox: React.FC<{
  images: CaseImageWithUrl[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}> = ({ images, currentIndex, onClose, onPrev, onNext }) => {
  const currentImage = images[currentIndex];

  // Stäng med Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, onPrev, onNext]);

  if (!currentImage) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Stäng-knapp */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-10"
        aria-label="Stäng"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Bildräknare */}
      <div className="absolute top-4 left-4 text-white/70 text-sm">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Föregående-knapp */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 p-3 text-white/70 hover:text-white bg-black/30 hover:bg-black/50
                     rounded-full transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
          aria-label="Föregående bild"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Bild */}
      <img
        src={currentImage.url}
        alt={currentImage.description || currentImage.file_name || 'Ärende-bild'}
        className="max-w-[90vw] max-h-[85vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Nästa-knapp */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 p-3 text-white/70 hover:text-white bg-black/30 hover:bg-black/50
                     rounded-full transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
          aria-label="Nästa bild"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Tagg och filnamn */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-black/50 rounded-lg">
          {currentImage.tags && currentImage.tags[0] && (
            <span
              className={`text-xs font-medium ${
                currentImage.tags[0] === 'before'
                  ? 'text-orange-400'
                  : currentImage.tags[0] === 'after'
                  ? 'text-green-400'
                  : 'text-blue-400'
              }`}
            >
              {getTagDisplay(currentImage.tags[0]).label}
            </span>
          )}
          <span className="text-white/70 text-xs truncate max-w-[200px]">
            {currentImage.file_name}
          </span>
        </div>
      </div>
    </div>
  );
};

// Thumbnail-komponent
const ImageThumbnail: React.FC<{
  image: CaseImageWithUrl;
  onClick: () => void;
  size?: number;
}> = ({ image, onClick, size = 64 }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const tag = image.tags?.[0];
  const tagConfig = tag ? getTagDisplay(tag) : null;

  return (
    <button
      onClick={onClick}
      className="relative rounded-lg overflow-hidden border border-slate-700/50
                 hover:border-slate-600 transition-colors group flex-shrink-0"
      style={{ width: size, height: size }}
      aria-label={`Visa bild: ${image.file_name}`}
    >
      {/* Laddningsindikator */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
        </div>
      )}

      {/* Felindikator */}
      {hasError && (
        <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
          <ImageIcon className="w-4 h-4 text-slate-600" />
        </div>
      )}

      {/* Bild */}
      <img
        src={image.url}
        alt={image.description || image.file_name || 'Thumbnail'}
        className={`w-full h-full object-cover ${isLoading || hasError ? 'invisible' : 'visible'}`}
        loading="lazy"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />

      {/* Kategori-badge */}
      {tagConfig && (
        <div
          className={`absolute bottom-0 left-0 right-0 py-0.5 text-[9px] font-medium text-center
                      ${
                        tag === 'before'
                          ? 'bg-orange-500/80 text-white'
                          : tag === 'after'
                          ? 'bg-green-500/80 text-white'
                          : 'bg-blue-500/80 text-white'
                      }`}
        >
          {tagConfig.label}
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
};

export default function CaseContextImagePreview({
  caseId,
  caseType,
  maxThumbnails = 6,
  compact = false
}: CaseContextImagePreviewProps) {
  const [images, setImages] = useState<GroupedImages | null>(null);
  const [allImages, setAllImages] = useState<CaseImageWithUrl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Hämta bilder
  useEffect(() => {
    const fetchImages = async () => {
      if (!caseId || !caseType) return;

      setIsLoading(true);
      setError(null);

      try {
        const grouped = await CaseImageService.getCaseImagesGrouped(caseId, caseType);
        setImages(grouped);

        // Skapa en flat lista för lightbox-navigation
        const all = [
          ...grouped.before,
          ...grouped.after,
          ...grouped.general
        ];
        setAllImages(all);
      } catch (err) {
        console.error('Error fetching case images:', err);
        setError('Kunde inte hämta bilder');
      } finally {
        setIsLoading(false);
      }
    };

    fetchImages();
  }, [caseId, caseType]);

  // Lightbox-navigation
  const openLightbox = (imageIndex: number) => setLightboxIndex(imageIndex);
  const closeLightbox = () => setLightboxIndex(null);
  const goToPrev = () => {
    if (lightboxIndex !== null && allImages.length > 0) {
      setLightboxIndex((lightboxIndex - 1 + allImages.length) % allImages.length);
    }
  };
  const goToNext = () => {
    if (lightboxIndex !== null && allImages.length > 0) {
      setLightboxIndex((lightboxIndex + 1) % allImages.length);
    }
  };

  // Laddning
  if (isLoading) {
    return (
      <div className="space-y-1.5">
        <h4 className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
          <Camera className="w-3.5 h-3.5 text-blue-400" />
          Dokumentation
        </h4>
        <div className="flex items-center gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
          <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
          <span className="text-xs text-slate-500">Laddar bilder...</span>
        </div>
      </div>
    );
  }

  // Fel eller inga bilder
  if (error || !images || allImages.length === 0) {
    return null; // Dölj sektionen om inga bilder finns
  }

  const totalImages = allImages.length;
  const thumbnailSize = compact ? 56 : 64;
  const displayedImages = allImages.slice(0, maxThumbnails);
  const remainingCount = totalImages - maxThumbnails;

  return (
    <div className="space-y-1.5">
      <h4 className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
        <Camera className="w-3.5 h-3.5 text-blue-400" />
        Bilder ({totalImages})
      </h4>

      <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
        {/* Thumbnail-grid */}
        <div className="flex flex-wrap gap-2">
          {displayedImages.map((image, index) => (
            <ImageThumbnail
              key={image.id}
              image={image}
              onClick={() => openLightbox(index)}
              size={thumbnailSize}
            />
          ))}

          {/* "Visa fler"-knapp */}
          {remainingCount > 0 && (
            <button
              onClick={() => openLightbox(maxThumbnails)}
              className="flex items-center justify-center rounded-lg border border-slate-700/50
                         bg-slate-800/50 hover:bg-slate-700/50 transition-colors text-slate-400
                         hover:text-slate-200"
              style={{ width: thumbnailSize, height: thumbnailSize }}
              aria-label={`Visa ${remainingCount} fler bilder`}
            >
              <span className="text-xs font-medium">+{remainingCount}</span>
            </button>
          )}
        </div>

        {/* Visa alla-länk */}
        {totalImages > 3 && (
          <button
            onClick={() => openLightbox(0)}
            className="mt-2 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ImageIcon className="w-3 h-3" />
            Visa alla {totalImages} bilder
          </button>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={allImages}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onPrev={goToPrev}
          onNext={goToNext}
        />
      )}
    </div>
  );
}
