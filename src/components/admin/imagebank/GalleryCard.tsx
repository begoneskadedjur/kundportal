import {
  Image as ImageIcon,
  MapPin,
  Calendar,
  ZoomIn,
  Check,
  Camera,
  CheckCircle,
  Megaphone,
  GraduationCap
} from 'lucide-react'
import type { CaseImageTag } from '../../../types/database'
import { CASE_IMAGE_TAG_DISPLAY } from '../../../types/database'
import { PEST_TYPES } from '../../../utils/clickupFieldMapper'

const PEST_TYPE_DISPLAY: Record<string, string> = Object.fromEntries(
  PEST_TYPES.map(pt => [pt.id, pt.name])
)

const TAG_BADGE_STYLES: Record<CaseImageTag, string> = {
  before: 'bg-orange-500/30 text-orange-300',
  after: 'bg-green-500/30 text-green-300',
  general: 'bg-blue-500/30 text-blue-300',
  pr: 'bg-purple-500/30 text-purple-300',
  education: 'bg-teal-500/30 text-teal-300',
}

const CASE_TYPE_BADGE: Record<string, { label: string; color: string }> = {
  private: { label: 'Privat', color: 'text-blue-300' },
  business: { label: 'Företag', color: 'text-green-300' },
  contract: { label: 'Avtal', color: 'text-purple-300' },
}

function getTagIcon(tag: CaseImageTag, size = 'w-3 h-3') {
  switch (tag) {
    case 'before': return <Camera className={size} />
    case 'after': return <CheckCircle className={size} />
    case 'pr': return <Megaphone className={size} />
    case 'education': return <GraduationCap className={size} />
    default: return <ImageIcon className={size} />
  }
}

export interface GalleryItem {
  case_id: string
  case_type: 'private' | 'business' | 'contract'
  title: string
  address: string | null
  technician_name: string | null
  scheduled_date: string | null
  pest_type: string | null
  status: string
  image_count: number
  primary_tag: CaseImageTag
  thumbnail_url: string | null
  description: string | null
  work_description: string | null
}

interface GalleryCardProps {
  item: GalleryItem
  isSelected: boolean
  selectionMode: boolean
  onSelect: (item: GalleryItem) => void
  onClick: (item: GalleryItem) => void
}

export default function GalleryCard({ item, isSelected, selectionMode, onSelect, onClick }: GalleryCardProps) {
  const caseType = CASE_TYPE_BADGE[item.case_type] || { label: item.case_type, color: 'text-slate-300' }
  const tagStyle = TAG_BADGE_STYLES[item.primary_tag] || TAG_BADGE_STYLES.general
  const tagLabel = CASE_IMAGE_TAG_DISPLAY[item.primary_tag]?.label || item.primary_tag
  const pestLabel = item.pest_type ? (PEST_TYPE_DISPLAY[item.pest_type] || item.pest_type) : null

  const shortDate = item.scheduled_date
    ? new Date(item.scheduled_date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
    : null

  const shortAddress = item.address
    ? item.address.length > 30 ? item.address.slice(0, 30) + '...' : item.address
    : null

  return (
    <div
      className="group relative aspect-[4/3] rounded-xl overflow-hidden
                 bg-slate-800 border border-slate-700/50
                 cursor-pointer transition-all duration-300
                 hover:border-[#20c58f]/40 hover:shadow-lg hover:shadow-[#20c58f]/5
                 hover:-translate-y-0.5"
      onClick={() => onClick(item)}
      role="button"
      aria-label={`Visa ärende: ${item.title}`}
    >
      {/* Image */}
      {item.thumbnail_url ? (
        <img
          src={item.thumbnail_url}
          alt={item.title || 'Ärendebild'}
          className="w-full h-full object-cover transition-transform duration-500
                     group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-800">
          <ImageIcon className="w-12 h-12 text-slate-600" />
        </div>
      )}

      {/* Permanent bottom gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

      {/* Selection checkbox */}
      <div
        className={`absolute top-2.5 left-2.5 z-10 transition-opacity duration-200
                     ${selectionMode || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        onClick={(e) => { e.stopPropagation(); onSelect(item) }}
      >
        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center
                         transition-colors duration-200 ${
          isSelected
            ? 'bg-[#20c58f] border-[#20c58f]'
            : 'bg-black/40 border-white/50 hover:border-white'
        }`}>
          {isSelected && <Check className="w-4 h-4 text-white" />}
        </div>
      </div>

      {/* Top-left: Tag badge + image count */}
      <div className={`absolute top-2.5 flex items-center gap-1.5 ${selectionMode || isSelected ? 'left-11' : 'left-2.5'} transition-all duration-200`}>
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-sm ${tagStyle}`}>
          {getTagIcon(item.primary_tag, 'w-2.5 h-2.5')}
          {tagLabel}
        </span>
        {item.image_count > 1 && (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded-full text-xs font-medium text-white/90">
            <ImageIcon className="w-3 h-3" />
            {item.image_count}
          </span>
        )}
      </div>

      {/* Top-right: Case type badge */}
      <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full
                        text-[10px] font-semibold uppercase tracking-wider
                        bg-black/60 backdrop-blur-sm ${caseType.color}`}>
        {caseType.label}
      </span>

      {/* Bottom text overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="text-sm font-semibold text-white truncate leading-tight">
          {item.title || 'Utan titel'}
        </h3>
        <div className="flex items-center gap-3 mt-1 text-xs text-white/70">
          {shortAddress && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{shortAddress}</span>
            </span>
          )}
          {shortDate && (
            <span className="flex items-center gap-1 flex-shrink-0">
              <Calendar className="w-3 h-3" />
              {shortDate}
            </span>
          )}
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/40 opacity-0
                      group-hover:opacity-100 transition-opacity duration-300
                      flex flex-col items-center justify-center gap-2 pointer-events-none">
        <ZoomIn className="w-8 h-8 text-white/80" />
        {(item.technician_name || pestLabel) && (
          <p className="text-xs text-white/70 text-center px-3">
            {[item.technician_name, pestLabel].filter(Boolean).join(' \u00b7 ')}
          </p>
        )}
      </div>
    </div>
  )
}

export function GalleryCardSkeleton() {
  return (
    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-800 border border-slate-700/50 animate-pulse">
      <div className="w-full h-full bg-gradient-to-br from-slate-700/50 to-slate-800/50" />
      <div className="absolute bottom-0 left-0 right-0 p-3 space-y-2">
        <div className="h-4 bg-slate-700/50 rounded w-3/4" />
        <div className="h-3 bg-slate-700/50 rounded w-1/2" />
      </div>
    </div>
  )
}
