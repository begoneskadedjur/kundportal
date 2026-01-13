// src/pages/admin/ImageBank.tsx
// Bildbank för marknadsföringsändamål - tabellbaserad design med expanderbara rader

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Image as ImageIcon,
  Calendar,
  MapPin,
  User,
  Bug,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  Download,
  X,
  ChevronLeft,
  Loader2,
  FileText,
  Camera,
  CheckCircle,
  RefreshCw,
  ChevronsLeft,
  ChevronsRight,
  Package,
  ZoomIn,
  Megaphone,
  GraduationCap
} from 'lucide-react'
import { PageHeader } from '../../components/shared'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { CaseImageService, formatFileSize } from '../../services/caseImageService'
import type { CaseImageWithUrl } from '../../services/caseImageService'
import type { CaseImageTag } from '../../types/database'
import { CASE_IMAGE_TAG_DISPLAY } from '../../types/database'
import { PEST_TYPES } from '../../utils/clickupFieldMapper'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import DatePicker, { registerLocale } from 'react-datepicker'
import sv from 'date-fns/locale/sv'

registerLocale('sv', sv)

// Skapa display-mappning från PEST_TYPES
const PEST_TYPE_DISPLAY: Record<string, string> = Object.fromEntries(
  PEST_TYPES.map(pt => [pt.id, pt.name])
)

// Hjälpfunktion för att formatera adress från JSON till läsbar sträng (kopierad från ScheduleTimeline)
const formatAddress = (address: any): string => {
  if (!address) return ''

  // Om det redan är en sträng, försök parsa som JSON
  if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address)
      return parsed.formatted_address || address
    } catch {
      // Om det inte går att parsa, returnera ursprungssträngen
      return address
    }
  }

  // Om det är ett objekt med formatted_address
  if (address.formatted_address) {
    return address.formatted_address
  }

  // Om det är ett objekt med separata fält (gatuadress-format)
  if (address.gatuadress) {
    const parts = [address.gatuadress, address.postnummer, address.postort].filter(Boolean)
    return parts.join(', ')
  }

  // Om det är ett objekt med street/city format
  if (address.street && address.city) {
    return `${address.street}, ${address.postal_code || ''} ${address.city}`.trim()
  }

  return ''
}

interface CaseWithImages {
  id: string
  case_type: 'private' | 'business' | 'contract'
  title: string
  scheduled_date: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  pest_type: string | null
  status: string
  technician_name: string | null
  description: string | null
  work_description: string | null
  image_count: number
}

interface ExpandedCaseData extends CaseWithImages {
  images: CaseImageWithUrl[]
}

// Paginering
const PAGE_SIZE_OPTIONS = [25, 50, 100]
const DEFAULT_PAGE_SIZE = 50

export default function ImageBank() {
  // State för data
  const [loading, setLoading] = useState(true)
  const [cases, setCases] = useState<CaseWithImages[]>([])
  const [totalCount, setTotalCount] = useState(0)

  // Paginering
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  // Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPestType, setFilterPestType] = useState<string>('all')
  const [filterTechnician, setFilterTechnician] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState<Date | null>(null)
  const [filterDateTo, setFilterDateTo] = useState<Date | null>(null)

  // Expanderade rader
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [expandedData, setExpandedData] = useState<Map<string, ExpandedCaseData>>(new Map())
  const [loadingRows, setLoadingRows] = useState<Set<string>>(new Set())

  // Selektion för bulk-nedladdning
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set())
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<string>('')

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState<CaseImageWithUrl | null>(null)
  const [lightboxImages, setLightboxImages] = useState<CaseImageWithUrl[]>([])

  // Unika tekniker och statusar för filter
  const [uniqueTechnicians, setUniqueTechnicians] = useState<string[]>([])
  const [uniqueStatuses, setUniqueStatuses] = useState<string[]>([])

  // Hämta alla ärenden som har bilder
  const fetchCasesWithImages = useCallback(async () => {
    setLoading(true)
    try {
      // Hämta bilder grupperade per ärende
      const { data: imageData, error: imageError } = await supabase
        .from('case_images')
        .select('case_id, case_type')

      if (imageError) throw imageError

      // Gruppera efter case_id och case_type
      const caseImageCounts = new Map<string, { count: number; type: string }>()
      imageData?.forEach(img => {
        const key = `${img.case_type}:${img.case_id}`
        const existing = caseImageCounts.get(key)
        if (existing) {
          existing.count++
        } else {
          caseImageCounts.set(key, { count: 1, type: img.case_type })
        }
      })

      // Hämta ärenden för varje typ
      const casesWithImages: CaseWithImages[] = []

      // Private cases
      const privateCaseIds = Array.from(caseImageCounts.entries())
        .filter(([_, v]) => v.type === 'private')
        .map(([k]) => k.split(':')[1])

      if (privateCaseIds.length > 0) {
        const { data: privateCases, error: privateError } = await supabase
          .from('private_cases')
          .select('id, title, start_date, adress, skadedjur, status, primary_assignee_name, description, rapport')
          .in('id', privateCaseIds)
          .order('start_date', { ascending: false })

        if (privateError) throw privateError

        privateCases?.forEach(c => {
          const key = `private:${c.id}`
          // Använd den robusta formatAddress-funktionen
          const formattedAddress = formatAddress(c.adress)

          casesWithImages.push({
            id: c.id,
            case_type: 'private',
            title: c.title,
            scheduled_date: c.start_date,
            address: formattedAddress || null,
            city: null, // formatAddress ger hela adressen, behöver inte separata fält
            postal_code: null,
            pest_type: c.skadedjur,
            status: c.status,
            technician_name: c.primary_assignee_name,
            description: c.description,
            work_description: c.rapport,
            image_count: caseImageCounts.get(key)?.count || 0
          })
        })
      }

      // Business cases
      const businessCaseIds = Array.from(caseImageCounts.entries())
        .filter(([_, v]) => v.type === 'business')
        .map(([k]) => k.split(':')[1])

      if (businessCaseIds.length > 0) {
        const { data: businessCases, error: businessError } = await supabase
          .from('business_cases')
          .select('id, title, start_date, adress, skadedjur, status, primary_assignee_name, description, rapport')
          .in('id', businessCaseIds)
          .order('start_date', { ascending: false })

        if (businessError) throw businessError

        businessCases?.forEach(c => {
          const key = `business:${c.id}`
          // Använd den robusta formatAddress-funktionen
          const formattedAddress = formatAddress(c.adress)

          casesWithImages.push({
            id: c.id,
            case_type: 'business',
            title: c.title,
            scheduled_date: c.start_date,
            address: formattedAddress || null,
            city: null,
            postal_code: null,
            pest_type: c.skadedjur,
            status: c.status,
            technician_name: c.primary_assignee_name,
            description: c.description,
            work_description: c.rapport,
            image_count: caseImageCounts.get(key)?.count || 0
          })
        })
      }

      // Contract cases
      const contractCaseIds = Array.from(caseImageCounts.entries())
        .filter(([_, v]) => v.type === 'contract')
        .map(([k]) => k.split(':')[1])

      if (contractCaseIds.length > 0) {
        const { data: contractCases, error: contractError } = await supabase
          .from('cases')
          .select('id, title, scheduled_start, address, pest_type, status, primary_technician_name, description, work_report')
          .in('id', contractCaseIds)
          .order('scheduled_start', { ascending: false })

        if (contractError) throw contractError

        contractCases?.forEach(c => {
          const key = `contract:${c.id}`
          // Använd den robusta formatAddress-funktionen
          const formattedAddress = formatAddress(c.address)

          casesWithImages.push({
            id: c.id,
            case_type: 'contract',
            title: c.title,
            scheduled_date: c.scheduled_start,
            address: formattedAddress || null,
            city: null,
            postal_code: null,
            pest_type: c.pest_type,
            status: c.status,
            technician_name: c.primary_technician_name,
            description: c.description,
            work_description: c.work_report,
            image_count: caseImageCounts.get(key)?.count || 0
          })
        })
      }

      // Sortera efter bokad tid
      casesWithImages.sort((a, b) => {
        const dateA = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0
        const dateB = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0
        return dateB - dateA
      })

      setCases(casesWithImages)
      setTotalCount(casesWithImages.length)

      // Extrahera unika tekniker och statusar
      const technicians = [...new Set(casesWithImages.map(c => c.technician_name).filter(Boolean))] as string[]
      const statuses = [...new Set(casesWithImages.map(c => c.status).filter(Boolean))] as string[]
      setUniqueTechnicians(technicians.sort())
      setUniqueStatuses(statuses.sort())

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

  // Filtrera ärenden
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      // Sökfilter
      const matchesSearch = searchQuery === '' ||
        c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.technician_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.postal_code?.toLowerCase().includes(searchQuery.toLowerCase())

      // Skadedjursfilter
      const matchesPestType = filterPestType === 'all' || c.pest_type === filterPestType

      // Teknikerfilter
      const matchesTechnician = filterTechnician === 'all' || c.technician_name === filterTechnician

      // Statusfilter
      const matchesStatus = filterStatus === 'all' || c.status === filterStatus

      // Datumfilter
      let matchesDate = true
      if (c.scheduled_date) {
        const caseDate = new Date(c.scheduled_date)
        if (filterDateFrom && caseDate < filterDateFrom) matchesDate = false
        if (filterDateTo && caseDate > filterDateTo) matchesDate = false
      } else if (filterDateFrom || filterDateTo) {
        matchesDate = false
      }

      return matchesSearch && matchesPestType && matchesTechnician && matchesStatus && matchesDate
    })
  }, [cases, searchQuery, filterPestType, filterTechnician, filterStatus, filterDateFrom, filterDateTo])

  // Paginerade ärenden
  const paginatedCases = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredCases.slice(startIndex, startIndex + pageSize)
  }, [filteredCases, currentPage, pageSize])

  const totalPages = Math.ceil(filteredCases.length / pageSize)

  // Återställ till sida 1 när filter ändras
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterPestType, filterTechnician, filterStatus, filterDateFrom, filterDateTo])

  // Toggle expanderad rad
  const toggleRow = async (caseItem: CaseWithImages) => {
    const key = `${caseItem.case_type}:${caseItem.id}`

    if (expandedRows.has(key)) {
      // Kollapsa
      const newExpanded = new Set(expandedRows)
      newExpanded.delete(key)
      setExpandedRows(newExpanded)
    } else {
      // Expandera - hämta bilder om inte redan laddade
      const newExpanded = new Set(expandedRows)
      newExpanded.add(key)
      setExpandedRows(newExpanded)

      if (!expandedData.has(key)) {
        setLoadingRows(prev => new Set(prev).add(key))
        try {
          const images = await CaseImageService.getCaseImages(caseItem.id, caseItem.case_type)
          setExpandedData(prev => new Map(prev).set(key, { ...caseItem, images }))
        } catch (error) {
          console.error('Fel vid hämtning av bilder:', error)
          toast.error('Kunde inte hämta bilder')
        } finally {
          setLoadingRows(prev => {
            const newSet = new Set(prev)
            newSet.delete(key)
            return newSet
          })
        }
      }
    }
  }

  // Toggle selektion
  const toggleSelection = (caseItem: CaseWithImages) => {
    const key = `${caseItem.case_type}:${caseItem.id}`
    const newSelected = new Set(selectedCases)
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    setSelectedCases(newSelected)
  }

  // Välj/avmarkera alla på sidan
  const toggleSelectAll = () => {
    const pageKeys = paginatedCases.map(c => `${c.case_type}:${c.id}`)
    const allSelected = pageKeys.every(k => selectedCases.has(k))

    const newSelected = new Set(selectedCases)
    if (allSelected) {
      pageKeys.forEach(k => newSelected.delete(k))
    } else {
      pageKeys.forEach(k => newSelected.add(k))
    }
    setSelectedCases(newSelected)
  }

  // Ladda ner ZIP för ett ärende
  const downloadCaseZip = async (caseItem: CaseWithImages) => {
    setIsDownloading(true)
    setDownloadProgress('Hämtar bilder...')

    try {
      const images = await CaseImageService.getCaseImages(caseItem.id, caseItem.case_type)

      if (images.length === 0) {
        toast.error('Inga bilder att ladda ner')
        return
      }

      const zip = new JSZip()
      const folderName = `${caseItem.title?.replace(/[^a-zA-Z0-9åäöÅÄÖ\s]/g, '_') || 'arende'}`
      const folder = zip.folder(folderName)

      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        setDownloadProgress(`Laddar bild ${i + 1} av ${images.length}...`)

        const response = await fetch(image.url)
        const blob = await response.blob()
        // Använd tags-array, join med underscore om flera
        const tagsPrefix = image.tags?.join('_') || 'general'
        const fileName = `${tagsPrefix}_${image.file_name}`
        folder?.file(fileName, blob)
      }

      setDownloadProgress('Skapar ZIP-fil...')
      const content = await zip.generateAsync({ type: 'blob' })

      const dateStr = caseItem.scheduled_date
        ? new Date(caseItem.scheduled_date).toISOString().split('T')[0]
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

  // Ladda ner ZIP för valda ärenden
  const downloadSelectedZip = async () => {
    if (selectedCases.size === 0) return

    setIsDownloading(true)
    setDownloadProgress('Förbereder nedladdning...')

    try {
      const zip = new JSZip()
      const selectedArray = Array.from(selectedCases)

      for (let i = 0; i < selectedArray.length; i++) {
        const key = selectedArray[i]
        const [caseType, caseId] = key.split(':')
        const caseItem = cases.find(c => c.id === caseId && c.case_type === caseType)

        if (!caseItem) continue

        setDownloadProgress(`Hämtar ärende ${i + 1} av ${selectedArray.length}: ${caseItem.title}`)

        const images = await CaseImageService.getCaseImages(caseId, caseType as 'private' | 'business' | 'contract')

        const folderName = `${caseItem.title?.replace(/[^a-zA-Z0-9åäöÅÄÖ\s]/g, '_') || 'arende'}_${caseId.slice(0, 8)}`
        const folder = zip.folder(folderName)

        for (const image of images) {
          const response = await fetch(image.url)
          const blob = await response.blob()
          // Använd tags-array, join med underscore om flera
          const tagsPrefix = image.tags?.join('_') || 'general'
          const fileName = `${tagsPrefix}_${image.file_name}`
          folder?.file(fileName, blob)
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

  // Ladda ner enskild bild
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
    } catch (error) {
      console.error('Nedladdning misslyckades:', error)
      toast.error('Kunde inte ladda ner bilden')
    }
  }

  // Lightbox navigation
  const openLightbox = (image: CaseImageWithUrl, allImages: CaseImageWithUrl[]) => {
    setLightboxImage(image)
    setLightboxImages(allImages)
  }

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (!lightboxImage) return
    const currentIndex = lightboxImages.findIndex(img => img.id === lightboxImage.id)
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1
    if (newIndex < 0) newIndex = lightboxImages.length - 1
    if (newIndex >= lightboxImages.length) newIndex = 0
    setLightboxImage(lightboxImages[newIndex])
  }

  // Keyboard navigation för lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxImage) return
      if (e.key === 'Escape') setLightboxImage(null)
      if (e.key === 'ArrowLeft') navigateLightbox('prev')
      if (e.key === 'ArrowRight') navigateLightbox('next')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxImage, lightboxImages])

  // Formatera datum
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Formatera fullständig adress
  const formatFullAddress = (caseItem: CaseWithImages) => {
    const parts = [caseItem.address, caseItem.postal_code, caseItem.city].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : '-'
  }

  // Status-färg
  const getStatusColor = (status: string) => {
    const lowerStatus = status?.toLowerCase() || ''
    if (lowerStatus.includes('avslut') || lowerStatus.includes('klar')) {
      return 'bg-green-500/20 text-green-400'
    }
    if (lowerStatus.includes('pågå') || lowerStatus.includes('bokad')) {
      return 'bg-blue-500/20 text-blue-400'
    }
    if (lowerStatus.includes('öppen') || lowerStatus.includes('ny')) {
      return 'bg-yellow-500/20 text-yellow-400'
    }
    return 'bg-slate-500/20 text-slate-400'
  }

  // Ärendetyp-färg
  const getCaseTypeLabel = (caseType: string) => {
    switch (caseType) {
      case 'private': return { label: 'Privat', color: 'bg-blue-500/20 text-blue-400' }
      case 'business': return { label: 'Företag', color: 'bg-green-500/20 text-green-400' }
      case 'contract': return { label: 'Avtal', color: 'bg-purple-500/20 text-purple-400' }
      default: return { label: caseType, color: 'bg-slate-500/20 text-slate-400' }
    }
  }

  // Tagg-ikon
  const getTagIcon = (tag: CaseImageTag, size: string = 'w-3 h-3') => {
    switch (tag) {
      case 'before': return <Camera className={size} />
      case 'after': return <CheckCircle className={size} />
      case 'pr': return <Megaphone className={size} />
      case 'education': return <GraduationCap className={size} />
      default: return <ImageIcon className={size} />
    }
  }

  // Unika skadedjurstyper för filter
  const uniquePestTypes = useMemo(() => {
    return Array.from(new Set(cases.map(c => c.pest_type).filter(Boolean))) as string[]
  }, [cases])

  // Räkna totalt antal bilder för valda ärenden
  const totalSelectedImages = useMemo(() => {
    return Array.from(selectedCases).reduce((sum, key) => {
      const [caseType, caseId] = key.split(':')
      const caseItem = cases.find(c => c.id === caseId && c.case_type === caseType)
      return sum + (caseItem?.image_count || 0)
    }, 0)
  }, [selectedCases, cases])

  // Har aktiva filter?
  const hasActiveFilters = searchQuery !== '' || filterPestType !== 'all' || filterTechnician !== 'all' || filterStatus !== 'all' || filterDateFrom !== null || filterDateTo !== null

  // Rensa alla filter
  const clearAllFilters = () => {
    setSearchQuery('')
    setFilterPestType('all')
    setFilterTechnician('all')
    setFilterStatus('all')
    setFilterDateFrom(null)
    setFilterDateTo(null)
  }

  // Lightbox portal
  const lightbox = lightboxImage && createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 2147483647,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        isolation: 'isolate'
      }}
      onClick={() => setLightboxImage(null)}
    >
      {/* Stäng-knapp */}
      <button
        onClick={() => setLightboxImage(null)}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
      >
        <X className="w-8 h-8" />
      </button>

      {/* Navigeringsknappar */}
      {lightboxImages.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); navigateLightbox('prev') }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
          >
            <ChevronLeft className="w-10 h-10" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); navigateLightbox('next') }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
          >
            <ChevronRight className="w-10 h-10" />
          </button>
        </>
      )}

      {/* Bild */}
      <div className="max-w-[90vw] max-h-[80vh] relative" onClick={(e) => e.stopPropagation()}>
        <img
          src={lightboxImage.url}
          alt={lightboxImage.file_name}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />
      </div>

      {/* Bildinfo */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-4xl mx-auto flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {/* Visa alla taggar */}
              {(lightboxImage.tags || ['general']).map(tag => (
                <span
                  key={tag}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-${CASE_IMAGE_TAG_DISPLAY[tag]?.color || 'slate-500'}/30 text-${CASE_IMAGE_TAG_DISPLAY[tag]?.color || 'slate-400'}`}
                >
                  {getTagIcon(tag)}
                  {CASE_IMAGE_TAG_DISPLAY[tag]?.label || tag}
                </span>
              ))}
              <span className="text-white/70 text-sm ml-2">
                {lightboxImages.findIndex(img => img.id === lightboxImage.id) + 1} / {lightboxImages.length}
              </span>
            </div>
            <p className="text-white font-medium truncate">{lightboxImage.file_name}</p>
            <p className="text-white/60 text-sm">
              {formatFileSize(lightboxImage.file_size)} | {new Date(lightboxImage.uploaded_at).toLocaleDateString('sv-SE')}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDownloadImage(lightboxImage.url, lightboxImage.file_name)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Ladda ner</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )

  // Bulk selection bar
  const selectionBar = selectedCases.size > 0 && createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-4 px-6 py-3 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl">
        <span className="text-white font-medium">
          {selectedCases.size} ärenden valda
        </span>
        <div className="w-px h-6 bg-slate-600" />
        <span className="text-slate-400 text-sm">
          ~{totalSelectedImages} bilder
        </span>
        <div className="w-px h-6 bg-slate-600" />
        <Button
          onClick={downloadSelectedZip}
          disabled={isDownloading}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline">{downloadProgress || 'Laddar...'}</span>
            </>
          ) : (
            <>
              <Package className="w-4 h-4" />
              <span>Ladda ner ZIP</span>
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
      {/* Bakgrund */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-900/50 to-[#20c58f]/5" />

      <div className="relative z-10 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <PageHeader
            title="Bildbank"
            subtitle="Dokumentation för marknadsföringsändamål"
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

        {/* Filter-sektion */}
        <Card className="p-4 mb-6 bg-slate-800/70 border-slate-700/50">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Sökfält */}
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Sök på titel, adress, tekniker, ort..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500/50 focus:border-transparent transition-all"
              />
            </div>

            {/* Skadedjurstyp */}
            <select
              value={filterPestType}
              onChange={(e) => setFilterPestType(e.target.value)}
              className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white min-w-[150px] focus:ring-2 focus:ring-teal-500/50"
            >
              <option value="all">Alla skadedjur</option>
              {uniquePestTypes.map(type => (
                <option key={type} value={type}>
                  {PEST_TYPE_DISPLAY[type] || type}
                </option>
              ))}
            </select>

            {/* Tekniker */}
            <select
              value={filterTechnician}
              onChange={(e) => setFilterTechnician(e.target.value)}
              className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white min-w-[150px] focus:ring-2 focus:ring-teal-500/50"
            >
              <option value="all">Alla tekniker</option>
              {uniqueTechnicians.map(tech => (
                <option key={tech} value={tech}>{tech}</option>
              ))}
            </select>

            {/* Datumintervall */}
            <div className="flex items-center gap-2">
              <DatePicker
                selected={filterDateFrom}
                onChange={(date) => setFilterDateFrom(date)}
                placeholderText="Från"
                dateFormat="yyyy-MM-dd"
                locale="sv"
                isClearable
                className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white w-[120px] focus:ring-2 focus:ring-teal-500/50"
              />
              <span className="text-slate-500">-</span>
              <DatePicker
                selected={filterDateTo}
                onChange={(date) => setFilterDateTo(date)}
                placeholderText="Till"
                dateFormat="yyyy-MM-dd"
                locale="sv"
                isClearable
                className="px-3 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white w-[120px] focus:ring-2 focus:ring-teal-500/50"
              />
            </div>

            {/* Status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white min-w-[130px] focus:ring-2 focus:ring-teal-500/50"
            >
              <option value="all">Alla status</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* Aktiva filter */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
              <span className="text-sm text-slate-400">Aktiva filter:</span>
              {searchQuery && (
                <span className="flex items-center gap-1 px-2 py-1 bg-teal-500/20 text-teal-400 rounded-full text-xs">
                  Sök: {searchQuery}
                  <button onClick={() => setSearchQuery('')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {filterPestType !== 'all' && (
                <span className="flex items-center gap-1 px-2 py-1 bg-teal-500/20 text-teal-400 rounded-full text-xs">
                  {PEST_TYPE_DISPLAY[filterPestType] || filterPestType}
                  <button onClick={() => setFilterPestType('all')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {filterTechnician !== 'all' && (
                <span className="flex items-center gap-1 px-2 py-1 bg-teal-500/20 text-teal-400 rounded-full text-xs">
                  {filterTechnician}
                  <button onClick={() => setFilterTechnician('all')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {filterStatus !== 'all' && (
                <span className="flex items-center gap-1 px-2 py-1 bg-teal-500/20 text-teal-400 rounded-full text-xs">
                  {filterStatus}
                  <button onClick={() => setFilterStatus('all')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {(filterDateFrom || filterDateTo) && (
                <span className="flex items-center gap-1 px-2 py-1 bg-teal-500/20 text-teal-400 rounded-full text-xs">
                  Datum: {filterDateFrom?.toLocaleDateString('sv-SE') || '...'} - {filterDateTo?.toLocaleDateString('sv-SE') || '...'}
                  <button onClick={() => { setFilterDateFrom(null); setFilterDateTo(null) }}><X className="w-3 h-3" /></button>
                </span>
              )}
              <button
                onClick={clearAllFilters}
                className="text-sm text-slate-400 hover:text-white transition-colors ml-2"
              >
                Rensa alla
              </button>
            </div>
          )}
        </Card>

        {/* Resultatinfo */}
        <div className="flex items-center justify-between mb-4 text-sm text-slate-400">
          <div>
            Visar {paginatedCases.length > 0 ? ((currentPage - 1) * pageSize + 1) : 0}-{Math.min(currentPage * pageSize, filteredCases.length)} av {filteredCases.length} ärenden
            {filteredCases.length !== totalCount && ` (totalt ${totalCount})`}
          </div>
          <div>
            {cases.reduce((sum, c) => sum + c.image_count, 0)} bilder totalt
          </div>
        </div>

        {/* Tabell */}
        <Card className="bg-slate-800/70 border-slate-700/50 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
            </div>
          ) : paginatedCases.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Inga ärenden hittades</p>
              {hasActiveFilters && (
                <button onClick={clearAllFilters} className="mt-2 text-teal-400 hover:text-teal-300">
                  Rensa filter
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="px-3 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={paginatedCases.length > 0 && paginatedCases.every(c => selectedCases.has(`${c.case_type}:${c.id}`))}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500/50"
                      />
                    </th>
                    <th className="px-2 py-3 w-10"></th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider min-w-[300px]">
                      <span className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Ärende & Adress
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Tekniker
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Datum
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-2">
                        <Bug className="w-4 h-4" />
                        Skadedjur
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center justify-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        Bilder
                      </span>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider w-20">
                      <Download className="w-4 h-4 mx-auto" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCases.map((caseItem) => {
                    const key = `${caseItem.case_type}:${caseItem.id}`
                    const isExpanded = expandedRows.has(key)
                    const isLoading = loadingRows.has(key)
                    const data = expandedData.get(key)
                    const caseTypeInfo = getCaseTypeLabel(caseItem.case_type)

                    return (
                      <>
                        <tr
                          key={key}
                          className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-700/20' : ''}`}
                          onClick={() => toggleRow(caseItem)}
                        >
                          <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedCases.has(key)}
                              onChange={() => toggleSelection(caseItem)}
                              className="rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500/50"
                            />
                          </td>
                          <td className="px-2 py-4">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-slate-400" />
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-start gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${caseTypeInfo.color}`}>
                                {caseTypeInfo.label}
                              </span>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-200 truncate">
                                  {caseItem.title || 'Utan titel'}
                                </div>
                                <div className="text-sm text-slate-400 flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{formatFullAddress(caseItem)}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-slate-300">{caseItem.technician_name || '-'}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-slate-300">{formatDate(caseItem.scheduled_date)}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                              {PEST_TYPE_DISPLAY[caseItem.pest_type || ''] || caseItem.pest_type || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(caseItem.status)}`}>
                              {caseItem.status || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="flex items-center justify-center gap-1 text-teal-400">
                              <ImageIcon className="w-4 h-4" />
                              <span className="font-mono">{caseItem.image_count}</span>
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => downloadCaseZip(caseItem)}
                              disabled={isDownloading}
                              className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-teal-400 transition-colors disabled:opacity-50"
                              title="Ladda ner alla bilder som ZIP"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>

                        {/* Expanderad rad */}
                        {isExpanded && (
                          <tr key={`${key}-expanded`}>
                            <td colSpan={9} className="bg-slate-800/50 border-b border-slate-700/50">
                              <div className="p-6 border-l-4 border-teal-500">
                                {isLoading ? (
                                  <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                                  </div>
                                ) : data ? (
                                  <div className="space-y-6">
                                    {/* Information grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                      {/* Ärendedetaljer */}
                                      <div className="bg-slate-900/50 rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                          <FileText className="w-4 h-4 text-blue-400" />
                                          Ärendedetaljer
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                          <div className="flex justify-between">
                                            <span className="text-slate-500">Ärende-ID:</span>
                                            <span className="text-slate-300 font-mono text-xs">{data.id.slice(0, 8)}...</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-slate-500">Typ:</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${caseTypeInfo.color}`}>
                                              {caseTypeInfo.label}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Beskrivning */}
                                      <div className="bg-slate-900/50 rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                          <FileText className="w-4 h-4 text-purple-400" />
                                          Ärendebeskrivning
                                        </h4>
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                          {data.description || 'Ingen beskrivning'}
                                        </p>
                                      </div>

                                      {/* Utfört arbete */}
                                      <div className="bg-slate-900/50 rounded-lg p-4">
                                        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                          <CheckCircle className="w-4 h-4 text-green-400" />
                                          Utfört arbete
                                        </h4>
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                          {data.work_description || 'Ingen rapport'}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Bilder */}
                                    <div>
                                      <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                          <ImageIcon className="w-4 h-4 text-teal-400" />
                                          Dokumentation ({data.images.length} bilder)
                                        </h4>
                                        <Button
                                          onClick={() => downloadCaseZip(caseItem)}
                                          disabled={isDownloading}
                                          size="sm"
                                          variant="outline"
                                          className="flex items-center gap-2"
                                        >
                                          <Package className="w-4 h-4" />
                                          Ladda ner ZIP
                                        </Button>
                                      </div>

                                      {data.images.length === 0 ? (
                                        <p className="text-slate-500 text-center py-8">Inga bilder</p>
                                      ) : (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                          {data.images.map((image) => (
                                            <div
                                              key={image.id}
                                              className="relative group aspect-square rounded-lg overflow-hidden bg-slate-900/50 cursor-pointer"
                                              onClick={() => openLightbox(image, data.images)}
                                            >
                                              <img
                                                src={image.url}
                                                alt={image.file_name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                                loading="lazy"
                                              />

                                              {/* Hover overlay */}
                                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1">
                                                <button className="p-1.5 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <ZoomIn className="w-4 h-4 text-white" />
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDownloadImage(image.url, image.file_name)
                                                  }}
                                                  className="p-1.5 bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                  <Download className="w-4 h-4 text-white" />
                                                </button>
                                              </div>

                                              {/* Tagg-badges */}
                                              <div className="absolute top-1 left-1 flex flex-wrap gap-0.5 max-w-[calc(100%-8px)]">
                                                {(image.tags || ['general']).map(tag => (
                                                  <span
                                                    key={tag}
                                                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-black/60 text-white`}
                                                  >
                                                    {getTagIcon(tag, 'w-2.5 h-2.5')}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginering */}
          {!loading && paginatedCases.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
              <div className="text-sm text-slate-400">
                Visar {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, filteredCases.length)} av {filteredCases.length} ärenden
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Sidnummer */}
                {(() => {
                  const pages: (number | string)[] = []
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i)
                  } else {
                    if (currentPage <= 3) {
                      pages.push(1, 2, 3, 4, '...', totalPages)
                    } else if (currentPage >= totalPages - 2) {
                      pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
                    } else {
                      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages)
                    }
                  }
                  return pages.map((page, i) => (
                    typeof page === 'number' ? (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded transition-colors ${
                          page === currentPage
                            ? 'bg-teal-600 text-white'
                            : 'hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {page}
                      </button>
                    ) : (
                      <span key={i} className="px-2 text-slate-500">...</span>
                    )
                  ))
                })()}

                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 hover:text-white transition-colors"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>

              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-3 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:ring-2 focus:ring-teal-500/50"
              >
                {PAGE_SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>{size} per sida</option>
                ))}
              </select>
            </div>
          )}
        </Card>
      </div>

      {/* Lightbox */}
      {lightbox}

      {/* Selection bar */}
      {selectionBar}
    </div>
  )
}
