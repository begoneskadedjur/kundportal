// src/services/contractFilesService.ts - Service för contract files hantering
import { supabase } from '../lib/supabase'
import { ContractFile, ContractFileInsert, ContractFileUpdate } from '../types/database'
import toast from 'react-hot-toast'

// Interface för OneFlow file från API
export interface OneFlowFile {
  id: number
  name: string
  type: 'contract' | 'verification' | 'attachment' | 'pdf'
  extension: string
}

// Interface för OneFlow files API response
export interface OneFlowFilesResponse {
  data: OneFlowFile[]
  count: number
  _links?: {
    next?: { href: string }
    previous?: { href: string }
    self?: { href: string }
  }
}

// Utökad ContractFile med download progress
export interface ContractFileWithProgress extends ContractFile {
  downloadProgress?: number
  isDownloading?: boolean
}

// Service för contract files hantering
export class ContractFilesService {
  
  // Hämta alla filer för ett kontrakt från vår databas
  static async getContractFiles(contractId: string): Promise<ContractFile[]> {
    try {
      console.log('🔍 Hämtar contract files från databas:', contractId)
      
      const { data, error } = await supabase
        .from('contract_files')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('❌ Fel vid hämtning av contract files:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      console.log('✅ Contract files hämtade:', data?.length || 0)
      return data || []

    } catch (error) {
      console.error('💥 ContractFilesService.getContractFiles fel:', error)
      throw error
    }
  }

  // Hämta enstaka fil
  static async getContractFile(fileId: string): Promise<ContractFile | null> {
    try {
      const { data, error } = await supabase
        .from('contract_files')
        .select('*')
        .eq('id', fileId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') { // Not found
          return null
        }
        console.error('❌ Fel vid hämtning av contract file:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data

    } catch (error) {
      console.error('💥 ContractFilesService.getContractFile fel:', error)
      throw error
    }
  }

  // Spara fil-metadata i databas
  static async createContractFile(fileData: ContractFileInsert): Promise<ContractFile> {
    try {
      console.log('💾 Skapar contract file:', fileData.file_name)

      const { data, error } = await supabase
        .from('contract_files')
        .insert([fileData])
        .select()
        .single()

      if (error) {
        console.error('❌ Fel vid skapande av contract file:', error)
        throw new Error(`Kunde inte skapa filen: ${error.message}`)
      }

      console.log('✅ Contract file skapad:', data.id)
      return data

    } catch (error) {
      console.error('💥 ContractFilesService.createContractFile fel:', error)
      throw error
    }
  }

  // Uppdatera fil-status
  static async updateContractFile(fileId: string, updates: ContractFileUpdate): Promise<ContractFile> {
    try {
      console.log('🔄 Uppdaterar contract file:', fileId, updates)

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('contract_files')
        .update(updateData)
        .eq('id', fileId)
        .select()
        .single()

      if (error) {
        console.error('❌ Fel vid uppdatering av contract file:', error)
        throw new Error(`Kunde inte uppdatera filen: ${error.message}`)
      }

      console.log('✅ Contract file uppdaterad:', data.id)
      return data

    } catch (error) {
      console.error('💥 ContractFilesService.updateContractFile fel:', error)
      throw error
    }
  }

  // Ta bort fil-metadata (soft delete genom att sätta status)
  static async deleteContractFile(fileId: string): Promise<void> {
    try {
      console.log('🗑️ Tar bort contract file:', fileId)

      const { error } = await supabase
        .from('contract_files')
        .update({ 
          download_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', fileId)

      if (error) {
        console.error('❌ Fel vid borttagning av contract file:', error)
        throw new Error(`Kunde inte ta bort filen: ${error.message}`)
      }

      console.log('✅ Contract file borttagen (soft delete)')

    } catch (error) {
      console.error('💥 ContractFilesService.deleteContractFile fel:', error)
      throw error
    }
  }

  // Kontrollera om fil redan finns i databasen
  static async fileExists(contractId: string, oneflowFileId: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('contract_files')
        .select('id')
        .eq('contract_id', contractId)
        .eq('oneflow_file_id', oneflowFileId)
        .single()

      if (error && error.code !== 'PGRST116') { // Ignore "not found" error
        console.error('❌ Fel vid kontroll av fil:', error)
        return false
      }

      return !!data

    } catch (error) {
      console.error('💥 ContractFilesService.fileExists fel:', error)
      return false
    }
  }

  // Hämta nedladdningslänk från Supabase Storage
  static async getFileDownloadUrl(filePath: string): Promise<string | null> {
    try {
      console.log('🔗 Hämtar nedladdningslänk för:', filePath)

      const { data, error } = await supabase.storage
        .from('contract-files')
        .createSignedUrl(filePath, 3600) // 1 hour expiry

      if (error) {
        console.error('❌ Fel vid skapande av nedladdningslänk:', error)
        return null
      }

      console.log('✅ Nedladdningslänk skapad')
      return data.signedUrl

    } catch (error) {
      console.error('💥 ContractFilesService.getFileDownloadUrl fel:', error)
      return null
    }
  }

  // Uploada fil till Supabase Storage
  static async uploadFileToStorage(
    file: Blob, 
    filePath: string, 
    onProgress?: (progress: number) => void
  ): Promise<string | null> {
    try {
      console.log('📤 Laddar upp fil till storage:', filePath)

      // Basic upload (Supabase client doesn't support progress callbacks directly)
      const { data, error } = await supabase.storage
        .from('contract-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) {
        console.error('❌ Fel vid uppladdning till storage:', error)
        throw new Error(`Storage error: ${error.message}`)
      }

      console.log('✅ Fil uppladdad till storage:', data.path)
      return data.path

    } catch (error) {
      console.error('💥 ContractFilesService.uploadFileToStorage fel:', error)
      throw error
    }
  }

  // Kontrollera om Supabase Storage bucket existerar
  static async ensureStorageBucket(): Promise<void> {
    try {
      // Lista buckets för att se om contract-files existerar
      const { data: buckets, error: listError } = await supabase.storage.listBuckets()

      if (listError) {
        console.error('❌ Kunde inte lista storage buckets:', listError)
        return
      }

      const contractFilesBucket = buckets?.find(bucket => bucket.name === 'contract-files')

      if (!contractFilesBucket) {
        console.log('📁 Skapar contract-files bucket...')
        
        const { error: createError } = await supabase.storage.createBucket('contract-files', {
          public: false, // Private bucket
          allowedMimeTypes: ['application/pdf'],
          fileSizeLimit: 52428800 // 50MB limit
        })

        if (createError) {
          console.error('❌ Kunde inte skapa bucket:', createError)
          return
        }

        console.log('✅ Contract-files bucket skapad')
      } else {
        console.log('✅ Contract-files bucket existerar redan')
      }

    } catch (error) {
      console.error('💥 ContractFilesService.ensureStorageBucket fel:', error)
    }
  }

  // Få fil-statistik för dashboards
  static async getContractFileStats(contractIds?: string[]): Promise<{
    totalFiles: number
    completedDownloads: number
    pendingDownloads: number
    failedDownloads: number
  }> {
    try {
      let query = supabase.from('contract_files').select('download_status')
      
      if (contractIds && contractIds.length > 0) {
        query = query.in('contract_id', contractIds)
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Fel vid hämtning av fil-statistik:', error)
        return { totalFiles: 0, completedDownloads: 0, pendingDownloads: 0, failedDownloads: 0 }
      }

      const stats = (data || []).reduce((acc, file) => {
        acc.totalFiles++
        switch (file.download_status) {
          case 'completed':
            acc.completedDownloads++
            break
          case 'pending':
          case 'downloading':
            acc.pendingDownloads++
            break
          case 'failed':
            acc.failedDownloads++
            break
        }
        return acc
      }, { totalFiles: 0, completedDownloads: 0, pendingDownloads: 0, failedDownloads: 0 })

      return stats

    } catch (error) {
      console.error('💥 ContractFilesService.getContractFileStats fel:', error)
      return { totalFiles: 0, completedDownloads: 0, pendingDownloads: 0, failedDownloads: 0 }
    }
  }
}

// Hjälpfunktioner för fil-hantering
export const getFileTypeIcon = (fileType: ContractFile['file_type']): string => {
  const icons = {
    'contract': '📄',
    'verification': '✅',
    'attachment': '📎',
    'pdf': '📋'
  }
  return icons[fileType] || '📄'
}

export const getFileTypeLabel = (fileType: ContractFile['file_type']): string => {
  const labels = {
    'contract': 'Kontrakt',
    'verification': 'Verifiering',
    'attachment': 'Bilaga',
    'pdf': 'PDF'
  }
  return labels[fileType] || fileType
}

export const getDownloadStatusColor = (status: ContractFile['download_status']): string => {
  const colors = {
    'pending': '#6b7280',      // gray-500
    'downloading': '#f59e0b',  // amber-500
    'completed': '#10b981',    // emerald-500
    'failed': '#ef4444'        // red-500
  }
  return colors[status] || colors.pending
}

export const getDownloadStatusLabel = (status: ContractFile['download_status']): string => {
  const labels = {
    'pending': 'Väntande',
    'downloading': 'Laddar ner',
    'completed': 'Klar',
    'failed': 'Misslyckad'
  }
  return labels[status] || status
}

export const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return '-'
  
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
}

export const generateStoragePath = (contractId: string, fileName: string): string => {
  // Skapa säker filnamn
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const timestamp = Date.now()
  return `contracts/${contractId}/${timestamp}_${safeFileName}`
}