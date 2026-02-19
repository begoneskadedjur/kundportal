// src/pages/admin/ImageBank.tsx
// Bildbank — bildgalleri med kort, modal och lightbox

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Image as ImageIcon,
  RefreshCw,
  Package,
  X,
  Loader2
} from 'lucide-react'
import { PageHeader } from '../../components/shared'
import Button from '../../components/ui/Button'
import { CaseImageService } from '../../services/caseImageService'
import type { CaseImageWithUrl } from '../../services/caseImageService'
import type { CaseImageTag } from '../../types/database'
import { PEST_TYPES } from '../../utils/clickupFieldMapper'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

import GalleryCard, { GalleryCardSkeleton } from '../../components/admin/imagebank/GalleryCard'
import type { GalleryItem } from '../../components/admin/imagebank/GalleryCard'
import GalleryFilterBar from '../../components/admin/imagebank/GalleryFilterBar'
import type { GalleryFilters } from '../../components/admin/imagebank/GalleryFilterBar'
import GalleryPagination from '../../components/admin/imagebank/GalleryPagination'
import CaseDetailModal from '../../components/admin/imagebank/CaseDetailModal'
import ImageBankLightbox from '../../components/admin/imagebank/ImageBankLightbox'

// Display mappning
const PEST_TYPE_DISPLAY: Record<string, string> = Object.fromEntries(
  PEST_TYPES.map(pt => [pt.id, pt.name])
)

// Hjälpfunktion för att formatera adress
const formatAddress = (address: any): string => {
  if (!address) return ''
  if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address)
      return parsed.formatted_address || address
    } catch {
      return address
    }
  }
  if (address.formatted_address) return address.formatted_address
  if (address.gatuadress) {
    return [address.gatuadress, address.postnummer, address.postort].filter(Boolean).join(', ')
  }
  if (address.street && address.city) {
    return `${address.street}, ${address.postal_code || ''} ${address.city}`.trim()
  }
  return ''
}

// Paginering
const PAGE_SIZE = 20

export default function ImageBank() {
  // Data
  const [loading, setLoading] = useState(true)
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])
  const [totalCount, setTotalCount] = useState(0)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<GalleryFilters>({
    pestType: 'all',
    technician: 'all',
    status: 'all',
    tag: 'all',
    dateFrom: null,
    dateTo: null,
  })

  // Filter options
  const [uniqueTechnicians, setUniqueTechnicians] = useState<string[]>([])
  const [uniqueStatuses, setUniqueStatuses] = useState<string[]>([])
  const [caseTags, setCaseTags] = useState<Map<string, CaseImageTag[]>>(new Map())

  // Selection
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set())
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState('')

  // Modal & lightbox
  const [selectedCase, setSelectedCase] = useState<GalleryItem | null>(null)
  const [lightboxImage, setLightboxImage] = useState<CaseImageWithUrl | null>(null)
  const [lightboxImages, setLightboxImages] = useState<CaseImageWithUrl[]>([])

  // Cover image URL cache
  const [coverUrls, setCoverUrls] = useState<Map<string, string>>(new Map())

  // Hämta data
  const fetchCasesWithImages = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Hämta alla case_images med info
      const { data: imageData, error: imageError } = await supabase
        .from('case_images')
        .select('id, case_id, case_type, tags, file_path, uploaded_at')
        .order('uploaded_at', { ascending: true })

      if (imageError) throw imageError

      // Gruppera per ärende
      const caseImageMap = new Map<string, { count: number; type: string; firstImagePath: string }>()
      const caseTagsMap = new Map<string, Set<CaseImageTag>>()
      const firstImageTags = new Map<string, CaseImageTag>()

      imageData?.forEach(img => {
        const key = `${img.case_type}:${img.case_id}`
        const existing = caseImageMap.get(key)
        if (existing) {
          existing.count++
        } else {
          caseImageMap.set(key, { count: 1, type: img.case_type, firstImagePath: img.file_path })
          // Save the primary tag from first image
          const tags = img.tags as CaseImageTag[] | null
          firstImageTags.set(key, tags?.[0] || 'general')
        }
        // Samla taggar
        if (!caseTagsMap.has(key)) caseTagsMap.set(key, new Set())
        const tags = img.tags as CaseImageTag[] | null
        if (tags && Array.isArray(tags)) {
          tags.forEach(tag => caseTagsMap.get(key)!.add(tag))
        }
      })

      // 2. Hämta omslagsbilder (signed URLs) — max 20 per batch
      const coverUrlMap = new Map<string, string>()
      const entries = Array.from(caseImageMap.entries())

      // Batch signed URLs in groups of 20 to avoid overloading
      for (let i = 0; i < entries.length; i += 20) {
        const batch = entries.slice(i, i + 20)
        const urls = await Promise.all(
          batch.map(async ([key, val]) => {
            const url = await CaseImageService.getImageUrl(val.firstImagePath)
            return [key, url || ''] as [string, string]
          })
        )
        urls.forEach(([key, url]) => coverUrlMap.set(key, url))
      }
      setCoverUrls(coverUrlMap)

      // 3. Hämta ärendedata
      const items: GalleryItem[] = []

      // Private cases
      const privateCaseIds = entries.filter(([_, v]) => v.type === 'private').map(([k]) => k.split(':')[1])
      if (privateCaseIds.length > 0) {
        const { data: privateCases, error } = await supabase
          .from('private_cases')
          .select('id, title, start_date, adress, skadedjur, status, primary_assignee_name, description, rapport')
          .in('id', privateCaseIds)
        if (error) throw error

        privateCases?.forEach(c => {
          const key = `private:${c.id}`
          items.push({
            case_id: c.id,
            case_type: 'private',
            title: c.title,
            scheduled_date: c.start_date,
            address: formatAddress(c.adress) || null,
            pest_type: c.skadedjur,
            status: c.status,
            technician_name: c.primary_assignee_name,
            description: c.description,
            work_description: c.rapport,
            image_count: caseImageMap.get(key)?.count || 0,
            primary_tag: firstImageTags.get(key) || 'general',
            thumbnail_url: coverUrlMap.get(key) || null,
          })
        })
      }

      // Business cases
      const businessCaseIds = entries.filter(([_, v]) => v.type === 'business').map(([k]) => k.split(':')[1])
      if (businessCaseIds.length > 0) {
        const { data: businessCases, error } = await supabase
          .from('business_cases')
          .select('id, title, start_date, adress, skadedjur, status, primary_assignee_name, description, rapport')
          .in('id', businessCaseIds)
        if (error) throw error

        businessCases?.forEach(c => {
          const key = `business:${c.id}`
          items.push({
            case_id: c.id,
            case_type: 'business',
            title: c.title,
            scheduled_date: c.start_date,
            address: formatAddress(c.adress) || null,
            pest_type: c.skadedjur,
            status: c.status,
            technician_name: c.primary_assignee_name,
            description: c.description,
            work_description: c.rapport,
            image_count: caseImageMap.get(key)?.count || 0,
            primary_tag: firstImageTags.get(key) || 'general',
            thumbnail_url: coverUrlMap.get(key) || null,
          })
        })
      }

      // Contract cases
      const contractCaseIds = entries.filter(([_, v]) => v.type === 'contract').map(([k]) => k.split(':')[1])
      if (contractCaseIds.length > 0) {
        const { data: contractCases, error } = await supabase
          .from('cases')
          .select('id, title, scheduled_start, address, pest_type, status, primary_technician_name, description, work_report')
          .in('id', contractCaseIds)
        if (error) throw error

        contractCases?.forEach(c => {
          const key = `contract:${c.id}`
          items.push({
            case_id: c.id,
            case_type: 'contract',
            title: c.title,
            scheduled_date: c.scheduled_start,
            address: formatAddress(c.address) || null,
            pest_type: c.pest_type,
            status: c.status,
            technician_name: c.primary_technician_name,
            description: c.description,
            work_description: c.work_report,
            image_count: caseImageMap.get(key)?.count || 0,
            primary_tag: firstImageTags.get(key) || 'general',
            thumbnail_url: coverUrlMap.get(key) || null,
          })
        })
      }

      // Sort by date descending
      items.sort((a, b) => {
        const dateA = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0
        const dateB = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0
        return dateB - dateA
      })

      setGalleryItems(items)
      setTotalCount(items.length)

      // Extract unique values for filters
      const technicians = [...new Set(items.map(c => c.technician_name).filter(Boolean))] as string[]
      const statuses = [...new Set(items.map(c => c.status).filter(Boolean))] as string[]
      setUniqueTechnicians(technicians.sort())
      setUniqueStatuses(statuses.sort())

      // Tags map
      const finalCaseTags = new Map<string, CaseImageTag[]>()
      caseTagsMap.forEach((tags, key) => finalCaseTags.set(key, Array.from(tags)))
      setCaseTags(finalCaseTags)

    } catch (error) {
      console.error('Fel vid hämtning av ärenden:', error)
      toast.error('Kunde inte hämta ärenden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCasesWithImages()
  }, [fetchCasesWithImages])

  // Filter
  const filteredItems = useMemo(() => {
    return galleryItems.filter(c => {
      const matchesSearch = searchQuery === '' ||
        c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.technician_name?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesPestType = filters.pestType === 'all' || c.pest_type === filters.pestType
      const matchesTechnician = filters.technician === 'all' || c.technician_name === filters.technician
      const matchesStatus = filters.status === 'all' || c.status === filters.status

      let matchesDate = true
      if (c.scheduled_date) {
        const caseDate = new Date(c.scheduled_date)
        if (filters.dateFrom && caseDate < filters.dateFrom) matchesDate = false
        if (filters.dateTo && caseDate > filters.dateTo) matchesDate = false
      } else if (filters.dateFrom || filters.dateTo) {
        matchesDate = false
      }

      let matchesTag = true
      if (filters.tag !== 'all') {
        const key = `${c.case_type}:${c.case_id}`
        const tags = caseTags.get(key)
        matchesTag = tags ? tags.includes(filters.tag) : false
      }

      return matchesSearch && matchesPestType && matchesTechnician && matchesStatus && matchesDate && matchesTag
    })
  }, [galleryItems, searchQuery, filters, caseTags])

  // Pagination
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredItems.slice(start, start + PAGE_SIZE)
  }, [filteredItems, currentPage])

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filters])

  // Total images count
  const totalImages = useMemo(() => {
    return galleryItems.reduce((sum, c) => sum + c.image_count, 0)
  }, [galleryItems])

  const filteredTotalImages = useMemo(() => {
    return filteredItems.reduce((sum, c) => sum + c.image_count, 0)
  }, [filteredItems])

  // Unique pest types (display names)
  const uniquePestTypes = useMemo(() => {
    const raw = [...new Set(galleryItems.map(c => c.pest_type).filter(Boolean))] as string[]
    return raw.map(pt => PEST_TYPE_DISPLAY[pt] || pt).sort()
  }, [galleryItems])

  // For filter bar we need the raw pest type IDs mapped to display names
  const pestTypeOptions = useMemo(() => {
    const raw = [...new Set(galleryItems.map(c => c.pest_type).filter(Boolean))] as string[]
    return raw.sort()
  }, [galleryItems])

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (searchQuery) count++
    if (filters.pestType !== 'all') count++
    if (filters.technician !== 'all') count++
    if (filters.status !== 'all') count++
    if (filters.tag !== 'all') count++
    if (filters.dateFrom || filters.dateTo) count++
    return count
  }, [searchQuery, filters])

  const hasActiveFilters = activeFilterCount > 0

  // Filter change handler
  const updateFilter = <K extends keyof GalleryFilters>(key: K, value: GalleryFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearAllFilters = () => {
    setSearchQuery('')
    setFilters({
      pestType: 'all',
      technician: 'all',
      status: 'all',
      tag: 'all',
      dateFrom: null,
      dateTo: null,
    })
  }

  // Selection
  const toggleSelection = (item: GalleryItem) => {
    const key = `${item.case_type}:${item.case_id}`
    const next = new Set(selectedCases)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelectedCases(next)
  }

  const totalSelectedImages = useMemo(() => {
    return Array.from(selectedCases).reduce((sum, key) => {
      const [caseType, caseId] = key.split(':')
      const item = galleryItems.find(c => c.case_id === caseId && c.case_type === caseType)
      return sum + (item?.image_count || 0)
    }, 0)
  }, [selectedCases, galleryItems])

  // Download ZIP for single case
  const downloadCaseZip = async (item: GalleryItem) => {
    setIsDownloading(true)
    setDownloadProgress('Hämtar bilder...')
    try {
      const images = await CaseImageService.getCaseImages(item.case_id, item.case_type)
      if (images.length === 0) {
        toast.error('Inga bilder att ladda ner')
        return
      }

      const zip = new JSZip()
      const folderName = item.title?.replace(/[^a-zA-Z0-9åäöÅÄÖ\s]/g, '_') || 'arende'
      const folder = zip.folder(folderName)

      for (let i = 0; i < images.length; i++) {
        setDownloadProgress(`Laddar bild ${i + 1} av ${images.length}...`)
        const response = await fetch(images[i].url)
        const blob = await response.blob()
        const tagsPrefix = images[i].tags?.join('_') || 'general'
        folder?.file(`${tagsPrefix}_${images[i].file_name}`, blob)
      }

      setDownloadProgress('Skapar ZIP-fil...')
      const content = await zip.generateAsync({ type: 'blob' })
      const dateStr = item.scheduled_date
        ? new Date(item.scheduled_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
      saveAs(content, `BeGone_${folderName}_${dateStr}.zip`)
      toast.success('ZIP-fil nedladdad!')
    } catch (error) {
      console.error('Fel vid nedladdning:', error)
      toast.error('Kunde inte skapa ZIP-fil')
    } finally {
      setIsDownloading(false)
      setDownloadProgress('')
    }
  }

  // Download ZIP for selected cases
  const downloadSelectedZip = async () => {
    if (selectedCases.size === 0) return
    setIsDownloading(true)
    setDownloadProgress('Förbereder nedladdning...')
    try {
      const zip = new JSZip()
      const selectedArray = Array.from(selectedCases)

      for (let i = 0; i < selectedArray.length; i++) {
        const [caseType, caseId] = selectedArray[i].split(':')
        const item = galleryItems.find(c => c.case_id === caseId && c.case_type === caseType)
        if (!item) continue

        setDownloadProgress(`Hämtar ärende ${i + 1} av ${selectedArray.length}: ${item.title}`)
        const images = await CaseImageService.getCaseImages(caseId, caseType as 'private' | 'business' | 'contract')

        const folderName = `${item.title?.replace(/[^a-zA-Z0-9åäöÅÄÖ\s]/g, '_') || 'arende'}_${caseId.slice(0, 8)}`
        const folder = zip.folder(folderName)

        for (const image of images) {
          const response = await fetch(image.url)
          const blob = await response.blob()
          const tagsPrefix = image.tags?.join('_') || 'general'
          folder?.file(`${tagsPrefix}_${image.file_name}`, blob)
        }
      }

      setDownloadProgress('Skapar ZIP-fil...')
      const content = await zip.generateAsync({ type: 'blob' })
      const dateStr = new Date().toISOString().split('T')[0]
      saveAs(content, `BeGone_Bildbank_${selectedCases.size}_arenden_${dateStr}.zip`)
      toast.success(`${selectedCases.size} ärenden nedladdade!`)
      setSelectedCases(new Set())
    } catch (error) {
      console.error('Fel vid nedladdning:', error)
      toast.error('Kunde inte skapa ZIP-fil')
    } finally {
      setIsDownloading(false)
      setDownloadProgress('')
    }
  }

  // Lightbox
  const openLightbox = (image: CaseImageWithUrl, allImages: CaseImageWithUrl[]) => {
    setLightboxImage(image)
    setLightboxImages(allImages)
  }

  const navigateLightbox = useCallback((direction: 'prev' | 'next') => {
    if (!lightboxImage) return
    const idx = lightboxImages.findIndex(img => img.id === lightboxImage.id)
    let next = direction === 'next' ? idx + 1 : idx - 1
    if (next < 0) next = lightboxImages.length - 1
    if (next >= lightboxImages.length) next = 0
    setLightboxImage(lightboxImages[next])
  }, [lightboxImage, lightboxImages])

  const handleDownloadImage = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
      toast.success('Nedladdning startad')
    } catch {
      toast.error('Kunde inte ladda ner bilden')
    }
  }

  // Selection bar portal
  const selectionBar = selectedCases.size > 0 && createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-4 px-6 py-3
                      bg-slate-800/95 backdrop-blur-md
                      border border-slate-700 rounded-2xl shadow-2xl">
        <span className="text-white font-medium">
          {selectedCases.size} ärenden valda
        </span>
        <div className="w-px h-6 bg-slate-600" />
        <span className="text-slate-400 text-sm">
          ~{totalSelectedImages} bilder
        </span>
        <div className="w-px h-6 bg-slate-600" />
        <Button
          variant="primary"
          size="sm"
          onClick={downloadSelectedZip}
          disabled={isDownloading}
          loading={isDownloading}
        >
          {isDownloading ? (
            downloadProgress
          ) : (
            <>
              <Package className="w-4 h-4 mr-2" />
              Ladda ner ZIP
            </>
          )}
        </Button>
        <button
          onClick={() => setSelectedCases(new Set())}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          title="Avmarkera alla"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>,
    document.body
  )

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-900/50 to-[#20c58f]/5" />

      <div className="relative z-10 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <PageHeader
            title="Gemensam bildbank"
            subtitle={`${totalCount} ärenden med ${totalImages} bilder`}
            showBackButton={true}
          />
          <Button
            onClick={fetchCasesWithImages}
            disabled={loading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Uppdatera
          </Button>
        </div>

        {/* Filter bar */}
        <GalleryFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFilterChange={updateFilter}
          filterOptions={{
            pestTypes: pestTypeOptions,
            technicians: uniqueTechnicians,
            statuses: uniqueStatuses,
          }}
          activeFilterCount={activeFilterCount}
          onClearAll={clearAllFilters}
        />

        {/* Result summary */}
        <div className="flex items-center justify-between mt-4 mb-4 text-sm text-slate-400">
          <span>
            Visar {paginatedItems.length > 0 ? ((currentPage - 1) * PAGE_SIZE + 1) : 0}–
            {Math.min(currentPage * PAGE_SIZE, filteredItems.length)} av {filteredItems.length} ärenden
            {filteredItems.length !== totalCount && ` (${totalCount} totalt)`}
          </span>
          <span>{filteredTotalImages} bilder i urvalet</span>
        </div>

        {/* Gallery grid */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <GalleryCardSkeleton key={i} />
            ))}
          </div>
        ) : paginatedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-800/80 border border-slate-700
                            flex items-center justify-center mb-6">
              <ImageIcon className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-300 mb-2">
              Inga ärenden hittades
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mb-4">
              {hasActiveFilters
                ? 'Inga ärenden matchar dina filter. Prova att ändra sökvillkoren.'
                : 'Det finns inga ärenden med bilder ännu.'}
            </p>
            {hasActiveFilters && (
              <Button onClick={clearAllFilters} variant="outline" size="sm">
                Rensa filter
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {paginatedItems.map(item => (
              <GalleryCard
                key={`${item.case_type}:${item.case_id}`}
                item={item}
                isSelected={selectedCases.has(`${item.case_type}:${item.case_id}`)}
                selectionMode={selectedCases.size > 0}
                onSelect={toggleSelection}
                onClick={setSelectedCase}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredItems.length > PAGE_SIZE && (
          <GalleryPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredItems.length}
            pageSize={PAGE_SIZE}
            totalImages={filteredTotalImages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      {/* Case detail modal */}
      {selectedCase && (
        <CaseDetailModal
          caseItem={selectedCase}
          onClose={() => setSelectedCase(null)}
          onDownloadZip={downloadCaseZip}
          onOpenLightbox={openLightbox}
          isDownloading={isDownloading}
        />
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <ImageBankLightbox
          image={lightboxImage}
          images={lightboxImages}
          onClose={() => setLightboxImage(null)}
          onNavigate={navigateLightbox}
          onDownload={handleDownloadImage}
        />
      )}

      {/* Selection bar */}
      {selectionBar}
    </div>
  )
}
