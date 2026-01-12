// src/pages/admin/ImageBank.tsx
// Bildbank för marknadsföringsändamål - visar ärenden med bilder

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  Image as ImageIcon,
  Calendar,
  MapPin,
  User,
  Bug,
  ChevronRight,
  Search,
  Filter,
  Download,
  X,
  ChevronLeft,
  Loader2,
  FileText,
  Clock,
  Camera,
  CheckCircle,
  RefreshCw
} from 'lucide-react'
import { PageHeader } from '../../components/shared'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { CaseImageService, formatFileSize } from '../../services/caseImageService'
import type { CaseImageWithUrl } from '../../services/caseImageService'
import type { CaseImageCategory } from '../../types/database'
import { CASE_IMAGE_CATEGORY_DISPLAY } from '../../types/database'
import { PEST_TYPES } from '../../utils/clickupFieldMapper'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'

// Skapa display-mappning från PEST_TYPES
const PEST_TYPE_DISPLAY: Record<string, string> = Object.fromEntries(
  PEST_TYPES.map(pt => [pt.id, pt.name])
)

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

interface SelectedCase extends CaseWithImages {
  images: CaseImageWithUrl[]
}

export default function ImageBank() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [cases, setCases] = useState<CaseWithImages[]>([])
  const [selectedCase, setSelectedCase] = useState<SelectedCase | null>(null)
  const [loadingImages, setLoadingImages] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPestType, setFilterPestType] = useState<string>('all')
  const [lightboxImage, setLightboxImage] = useState<CaseImageWithUrl | null>(null)
  const [lightboxImages, setLightboxImages] = useState<CaseImageWithUrl[]>([])

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
          .select('id, title, bokad_tid, gatuadress, postnummer, postort, skadedjur, status, tekniker_namn, beskrivning, arbetsbeskrivning')
          .in('id', privateCaseIds)
          .order('bokad_tid', { ascending: false })

        if (privateError) throw privateError

        privateCases?.forEach(c => {
          const key = `private:${c.id}`
          casesWithImages.push({
            id: c.id,
            case_type: 'private',
            title: c.title,
            scheduled_date: c.bokad_tid,
            address: c.gatuadress,
            city: c.postort,
            postal_code: c.postnummer,
            pest_type: c.skadedjur,
            status: c.status,
            technician_name: c.tekniker_namn,
            description: c.beskrivning,
            work_description: c.arbetsbeskrivning,
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
          .select('id, title, bokad_tid, gatuadress, postnummer, postort, skadedjur, status, tekniker_namn, beskrivning, arbetsbeskrivning')
          .in('id', businessCaseIds)
          .order('bokad_tid', { ascending: false })

        if (businessError) throw businessError

        businessCases?.forEach(c => {
          const key = `business:${c.id}`
          casesWithImages.push({
            id: c.id,
            case_type: 'business',
            title: c.title,
            scheduled_date: c.bokad_tid,
            address: c.gatuadress,
            city: c.postort,
            postal_code: c.postnummer,
            pest_type: c.skadedjur,
            status: c.status,
            technician_name: c.tekniker_namn,
            description: c.beskrivning,
            work_description: c.arbetsbeskrivning,
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
          .select('id, title, scheduled_start, address, city, postal_code, pest_type, status, primary_technician_name, description, work_description')
          .in('id', contractCaseIds)
          .order('scheduled_start', { ascending: false })

        if (contractError) throw contractError

        contractCases?.forEach(c => {
          const key = `contract:${c.id}`
          casesWithImages.push({
            id: c.id,
            case_type: 'contract',
            title: c.title,
            scheduled_date: c.scheduled_start,
            address: c.address,
            city: c.city,
            postal_code: c.postal_code,
            pest_type: c.pest_type,
            status: c.status,
            technician_name: c.primary_technician_name,
            description: c.description,
            work_description: c.work_description,
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

  // Välj ett ärende och hämta dess bilder
  const handleSelectCase = async (caseItem: CaseWithImages) => {
    setLoadingImages(true)
    try {
      const images = await CaseImageService.getCaseImages(caseItem.id, caseItem.case_type)
      setSelectedCase({ ...caseItem, images })
    } catch (error) {
      console.error('Fel vid hämtning av bilder:', error)
      toast.error('Kunde inte hämta bilder')
    } finally {
      setLoadingImages(false)
    }
  }

  // Ladda ner bild direkt
  const handleDownload = async (url: string, fileName: string) => {
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

  // Öppna lightbox
  const openLightbox = (image: CaseImageWithUrl, allImages: CaseImageWithUrl[]) => {
    setLightboxImage(image)
    setLightboxImages(allImages)
  }

  // Navigera i lightbox
  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (!lightboxImage) return
    const currentIndex = lightboxImages.findIndex(img => img.id === lightboxImage.id)
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1
    if (newIndex < 0) newIndex = lightboxImages.length - 1
    if (newIndex >= lightboxImages.length) newIndex = 0
    setLightboxImage(lightboxImages[newIndex])
  }

  // Filtrera ärenden
  const filteredCases = cases.filter(c => {
    const matchesSearch = searchQuery === '' ||
      c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.technician_name?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesPestType = filterPestType === 'all' || c.pest_type === filterPestType

    return matchesSearch && matchesPestType
  })

  // Unika skadedjurstyper för filter
  const uniquePestTypes = Array.from(new Set(cases.map(c => c.pest_type).filter(Boolean)))

  // Kategori-ikon
  const getCategoryIcon = (category: CaseImageCategory) => {
    switch (category) {
      case 'before':
        return <Camera className="w-3 h-3" />
      case 'after':
        return <CheckCircle className="w-3 h-3" />
      default:
        return <ImageIcon className="w-3 h-3" />
    }
  }

  // Formatera datum
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Status-färg
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Avslutat':
        return 'bg-green-500/20 text-green-400'
      case 'Pågående':
        return 'bg-blue-500/20 text-blue-400'
      case 'Öppen':
        return 'bg-yellow-500/20 text-yellow-400'
      default:
        return 'bg-slate-500/20 text-slate-400'
    }
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
            onClick={(e) => {
              e.stopPropagation()
              navigateLightbox('prev')
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
          >
            <ChevronLeft className="w-10 h-10" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              navigateLightbox('next')
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
          >
            <ChevronRight className="w-10 h-10" />
          </button>
        </>
      )}

      {/* Bild */}
      <div
        className="max-w-[90vw] max-h-[80vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
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
            <div className="flex items-center gap-2 mb-2">
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-${CASE_IMAGE_CATEGORY_DISPLAY[lightboxImage.category].color}/20`}>
                {getCategoryIcon(lightboxImage.category)}
                {CASE_IMAGE_CATEGORY_DISPLAY[lightboxImage.category].label}
              </span>
              <span className="text-white/70 text-sm">
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
              handleDownload(lightboxImage.url, lightboxImage.file_name)
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

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Bakgrund */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-slate-900/50 to-[#20c58f]/5" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Bildbank"
          subtitle="Ärenden med dokumentation för marknadsföringsändamål"
          showBackButton={true}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Vänster: Ärendelista */}
          <div className="lg:col-span-1 space-y-4">
            {/* Sök och filter */}
            <Card className="p-4 bg-slate-800/70 border-slate-700/50">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Sök ärenden..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select
                    value={filterPestType}
                    onChange={(e) => setFilterPestType(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  >
                    <option value="all">Alla skadedjur</option>
                    {uniquePestTypes.map(type => (
                      <option key={type} value={type!}>
                        {PEST_TYPE_DISPLAY[type!] || type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>

            {/* Ärendelista */}
            <Card className="p-0 bg-slate-800/70 border-slate-700/50 overflow-hidden">
              <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-teal-400" />
                  Ärenden med bilder
                </h3>
                <span className="text-sm text-slate-400">{filteredCases.length} st</span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                </div>
              ) : filteredCases.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Inga ärenden hittades</p>
                </div>
              ) : (
                <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
                  {filteredCases.map((caseItem) => (
                    <button
                      key={`${caseItem.case_type}-${caseItem.id}`}
                      onClick={() => handleSelectCase(caseItem)}
                      className={`w-full p-4 text-left border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors ${
                        selectedCase?.id === caseItem.id ? 'bg-slate-700/50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-medium text-white truncate flex-1">
                          {caseItem.title || 'Utan titel'}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(caseItem.status)}`}>
                          {caseItem.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm text-slate-400">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span className="truncate">{caseItem.technician_name || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(caseItem.scheduled_date)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Bug className="w-3 h-3" />
                          <span className="truncate">{PEST_TYPE_DISPLAY[caseItem.pest_type || ''] || caseItem.pest_type || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{caseItem.city || '-'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-teal-400 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          {caseItem.image_count} bilder
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Höger: Detaljer och bilder */}
          <div className="lg:col-span-2">
            {loadingImages ? (
              <Card className="p-8 bg-slate-800/70 border-slate-700/50 flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
              </Card>
            ) : selectedCase ? (
              <Card className="p-6 bg-slate-800/70 border-slate-700/50">
                {/* Ärendedetaljer */}
                <div className="mb-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-white mb-1">{selectedCase.title}</h2>
                      <div className="flex items-center gap-3 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {selectedCase.technician_name || '-'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(selectedCase.scheduled_date)}
                        </span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedCase.status)}`}>
                      {selectedCase.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <span className="text-slate-500 flex items-center gap-1 mb-1">
                        <Bug className="w-4 h-4" />
                        Skadedjur
                      </span>
                      <span className="text-white">{PEST_TYPE_DISPLAY[selectedCase.pest_type || ''] || selectedCase.pest_type || '-'}</span>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <span className="text-slate-500 flex items-center gap-1 mb-1">
                        <MapPin className="w-4 h-4" />
                        Adress
                      </span>
                      <span className="text-white">
                        {selectedCase.address ? `${selectedCase.address}, ${selectedCase.postal_code || ''} ${selectedCase.city || ''}` : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Saneringsrapport */}
                {(selectedCase.description || selectedCase.work_description) && (
                  <div className="mb-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-teal-400" />
                      Saneringsrapport - Rapport & Dokumentation
                    </h3>
                    {selectedCase.description && (
                      <div className="mb-3">
                        <span className="text-sm text-slate-500 block mb-1">Beskrivning</span>
                        <p className="text-slate-300 whitespace-pre-wrap">{selectedCase.description}</p>
                      </div>
                    )}
                    {selectedCase.work_description && (
                      <div>
                        <span className="text-sm text-slate-500 block mb-1">Utfört arbete</span>
                        <p className="text-slate-300 whitespace-pre-wrap">{selectedCase.work_description}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Bilder */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-teal-400" />
                    Bilder ({selectedCase.images.length})
                  </h3>

                  {selectedCase.images.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Inga bilder</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {selectedCase.images.map((image) => (
                        <div
                          key={image.id}
                          className="relative group bg-slate-900/50 rounded-lg overflow-hidden cursor-pointer"
                          onClick={() => openLightbox(image, selectedCase.images)}
                        >
                          <div className="aspect-square">
                            <img
                              src={image.url}
                              alt={image.file_name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                          </div>

                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>

                          {/* Kategori-badge */}
                          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-black/50 text-white">
                            {getCategoryIcon(image.category)}
                            <span>{CASE_IMAGE_CATEGORY_DISPLAY[image.category].label}</span>
                          </div>

                          {/* Download-knapp */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownload(image.url, image.file_name)
                            }}
                            className="absolute bottom-2 right-2 p-2 bg-slate-800/80 hover:bg-slate-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Ladda ner"
                          >
                            <Download className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-8 bg-slate-800/70 border-slate-700/50 flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg">Välj ett ärende för att se bilder</p>
                <p className="text-sm mt-1">Klicka på ett ärende i listan till vänster</p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox}
    </div>
  )
}
