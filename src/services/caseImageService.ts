// src/services/caseImageService.ts - Service för ärendebilder
import { supabase } from '../lib/supabase'
import { CaseImage, CaseImageInsert, CaseImageCategory } from '../types/database'
import {
  CASE_IMAGES_BUCKET,
  generateImagePath,
  isValidImageType,
  isValidImageSize,
  MAX_IMAGE_SIZE,
  MAX_IMAGE_DIMENSION
} from '../lib/setupCaseImagesStorage'

// Interface för uppladdningsresultat
export interface ImageUploadResult {
  success: boolean
  image?: CaseImage
  error?: string
}

// Interface för hämtning av bilder med signerade URLs
export interface CaseImageWithUrl extends CaseImage {
  url: string
}

/**
 * Service för hantering av ärendebilder
 * Hanterar uppladdning, hämtning och borttagning av bilder
 */
export class CaseImageService {

  /**
   * Hämta alla bilder för ett ärende
   */
  static async getCaseImages(
    caseId: string,
    caseType: 'private' | 'business' | 'contract'
  ): Promise<CaseImageWithUrl[]> {
    try {
      console.log('Hämtar bilder för ärende:', caseId, caseType)

      const { data, error } = await supabase
        .from('case_images')
        .select('*')
        .eq('case_id', caseId)
        .eq('case_type', caseType)
        .order('uploaded_at', { ascending: false })

      if (error) {
        console.error('Fel vid hämtning av ärendebilder:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      // Generera signerade URLs för alla bilder
      const imagesWithUrls = await Promise.all(
        (data || []).map(async (image) => {
          const url = await this.getImageUrl(image.file_path)
          return { ...image, url: url || '' }
        })
      )

      console.log('Bilder hämtade:', imagesWithUrls.length)
      return imagesWithUrls

    } catch (error) {
      console.error('CaseImageService.getCaseImages fel:', error)
      throw error
    }
  }

  /**
   * Hämta bilder grupperade efter kategori
   */
  static async getCaseImagesGrouped(
    caseId: string,
    caseType: 'private' | 'business' | 'contract'
  ): Promise<{
    before: CaseImageWithUrl[]
    after: CaseImageWithUrl[]
    general: CaseImageWithUrl[]
  }> {
    const images = await this.getCaseImages(caseId, caseType)

    return {
      before: images.filter(img => img.category === 'before'),
      after: images.filter(img => img.category === 'after'),
      general: images.filter(img => img.category === 'general')
    }
  }

  /**
   * Ladda upp en bild för ett ärende
   */
  static async uploadCaseImage(
    caseId: string,
    caseType: 'private' | 'business' | 'contract',
    file: File,
    category: CaseImageCategory = 'general',
    description?: string,
    userId?: string
  ): Promise<ImageUploadResult> {
    try {
      console.log('Laddar upp bild:', file.name, 'för ärende:', caseId)

      // Validera filtyp
      if (!isValidImageType(file.type)) {
        return {
          success: false,
          error: `Ogiltigt filformat. Tillåtna format: JPEG, PNG, WebP, HEIC`
        }
      }

      // Validera filstorlek
      if (!isValidImageSize(file.size)) {
        return {
          success: false,
          error: `Filen är för stor. Max storlek: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`
        }
      }

      // Komprimera bilden om nödvändigt
      const processedFile = await this.compressImage(file)

      // Generera unik filsökväg
      const filePath = generateImagePath(caseId, caseType, file.name)

      // Ladda upp till Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(CASE_IMAGES_BUCKET)
        .upload(filePath, processedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Fel vid uppladdning till storage:', uploadError)
        return {
          success: false,
          error: `Uppladdning misslyckades: ${uploadError.message}`
        }
      }

      // Spara metadata i databasen
      const imageData: CaseImageInsert = {
        case_id: caseId,
        case_type: caseType,
        file_path: uploadData.path,
        file_name: file.name,
        file_size: processedFile.size,
        mime_type: file.type,
        category: category,
        description: description,
        uploaded_by: userId
      }

      const { data: insertedImage, error: insertError } = await supabase
        .from('case_images')
        .insert([imageData])
        .select()
        .single()

      if (insertError) {
        // Rensa upp filen från storage om databasinsertion misslyckas
        await supabase.storage.from(CASE_IMAGES_BUCKET).remove([filePath])
        console.error('Fel vid skapande av bildmetadata:', insertError)
        return {
          success: false,
          error: `Kunde inte spara bilden: ${insertError.message}`
        }
      }

      console.log('Bild uppladdad:', insertedImage.id)
      return {
        success: true,
        image: insertedImage
      }

    } catch (error) {
      console.error('CaseImageService.uploadCaseImage fel:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ett oväntat fel uppstod'
      }
    }
  }

  /**
   * Ladda upp flera bilder samtidigt
   */
  static async uploadMultipleCaseImages(
    caseId: string,
    caseType: 'private' | 'business' | 'contract',
    files: File[],
    category: CaseImageCategory = 'general',
    userId?: string
  ): Promise<{
    successful: CaseImage[]
    failed: { fileName: string; error: string }[]
  }> {
    const successful: CaseImage[] = []
    const failed: { fileName: string; error: string }[] = []

    for (const file of files) {
      const result = await this.uploadCaseImage(
        caseId,
        caseType,
        file,
        category,
        undefined,
        userId
      )

      if (result.success && result.image) {
        successful.push(result.image)
      } else {
        failed.push({
          fileName: file.name,
          error: result.error || 'Okänt fel'
        })
      }
    }

    return { successful, failed }
  }

  /**
   * Ta bort en bild
   */
  static async deleteCaseImage(imageId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Tar bort bild:', imageId)

      // Hämta bildinfo först
      const { data: image, error: fetchError } = await supabase
        .from('case_images')
        .select('file_path')
        .eq('id', imageId)
        .single()

      if (fetchError) {
        console.error('Fel vid hämtning av bild:', fetchError)
        return { success: false, error: 'Bilden hittades inte' }
      }

      // Ta bort från storage
      const { error: storageError } = await supabase.storage
        .from(CASE_IMAGES_BUCKET)
        .remove([image.file_path])

      if (storageError) {
        console.error('Fel vid borttagning från storage:', storageError)
        // Fortsätt ändå med att ta bort från databasen
      }

      // Ta bort från databasen
      const { error: deleteError } = await supabase
        .from('case_images')
        .delete()
        .eq('id', imageId)

      if (deleteError) {
        console.error('Fel vid borttagning av bildmetadata:', deleteError)
        return { success: false, error: `Kunde inte ta bort bilden: ${deleteError.message}` }
      }

      console.log('Bild borttagen:', imageId)
      return { success: true }

    } catch (error) {
      console.error('CaseImageService.deleteCaseImage fel:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ett oväntat fel uppstod'
      }
    }
  }

  /**
   * Ta bort alla bilder för ett ärende
   */
  static async deleteAllCaseImages(
    caseId: string,
    caseType: 'private' | 'business' | 'contract'
  ): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    try {
      console.log('Tar bort alla bilder för ärende:', caseId)

      // Hämta alla bilder
      const { data: images, error: fetchError } = await supabase
        .from('case_images')
        .select('id, file_path')
        .eq('case_id', caseId)
        .eq('case_type', caseType)

      if (fetchError) {
        console.error('Fel vid hämtning av bilder:', fetchError)
        return { success: false, deletedCount: 0, error: fetchError.message }
      }

      if (!images || images.length === 0) {
        return { success: true, deletedCount: 0 }
      }

      // Ta bort från storage
      const filePaths = images.map(img => img.file_path)
      await supabase.storage.from(CASE_IMAGES_BUCKET).remove(filePaths)

      // Ta bort från databasen
      const { error: deleteError } = await supabase
        .from('case_images')
        .delete()
        .eq('case_id', caseId)
        .eq('case_type', caseType)

      if (deleteError) {
        console.error('Fel vid borttagning av bildmetadata:', deleteError)
        return { success: false, deletedCount: 0, error: deleteError.message }
      }

      console.log('Alla bilder borttagna:', images.length)
      return { success: true, deletedCount: images.length }

    } catch (error) {
      console.error('CaseImageService.deleteAllCaseImages fel:', error)
      return {
        success: false,
        deletedCount: 0,
        error: error instanceof Error ? error.message : 'Ett oväntat fel uppstod'
      }
    }
  }

  /**
   * Hämta signerad URL för en bild
   */
  static async getImageUrl(filePath: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(CASE_IMAGES_BUCKET)
        .createSignedUrl(filePath, 3600) // 1 timme giltighetstid

      if (error) {
        console.error('Fel vid skapande av signerad URL:', error)
        return null
      }

      return data.signedUrl
    } catch (error) {
      console.error('CaseImageService.getImageUrl fel:', error)
      return null
    }
  }

  /**
   * Hämta antal bilder för ett ärende
   */
  static async getCaseImageCount(
    caseId: string,
    caseType: 'private' | 'business' | 'contract'
  ): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('case_images')
        .select('*', { count: 'exact', head: true })
        .eq('case_id', caseId)
        .eq('case_type', caseType)

      if (error) {
        console.error('Fel vid räkning av bilder:', error)
        return 0
      }

      return count || 0
    } catch (error) {
      console.error('CaseImageService.getCaseImageCount fel:', error)
      return 0
    }
  }

  /**
   * Uppdatera bildbeskrivning
   */
  static async updateImageDescription(
    imageId: string,
    description: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('case_images')
        .update({ description })
        .eq('id', imageId)

      if (error) {
        console.error('Fel vid uppdatering av beskrivning:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('CaseImageService.updateImageDescription fel:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ett oväntat fel uppstod'
      }
    }
  }

  /**
   * Uppdatera bildkategori
   */
  static async updateImageCategory(
    imageId: string,
    category: CaseImageCategory
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('case_images')
        .update({ category })
        .eq('id', imageId)

      if (error) {
        console.error('Fel vid uppdatering av kategori:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('CaseImageService.updateImageCategory fel:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ett oväntat fel uppstod'
      }
    }
  }

  /**
   * Komprimera bild på klientsidan
   * Returnerar original om komprimering inte behövs
   */
  private static async compressImage(file: File): Promise<Blob> {
    return new Promise((resolve) => {
      // Om filen redan är tillräckligt liten, returnera original
      if (file.size < 500000) { // 500KB
        resolve(file)
        return
      }

      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      img.onload = () => {
        let { width, height } = img

        // Beräkna nya dimensioner
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width > height) {
            height = (height / width) * MAX_IMAGE_DIMENSION
            width = MAX_IMAGE_DIMENSION
          } else {
            width = (width / height) * MAX_IMAGE_DIMENSION
            height = MAX_IMAGE_DIMENSION
          }
        }

        canvas.width = width
        canvas.height = height

        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                resolve(file)
              }
            },
            'image/jpeg',
            0.85 // 85% kvalitet
          )
        } else {
          resolve(file)
        }
      }

      img.onerror = () => {
        resolve(file)
      }

      img.src = URL.createObjectURL(file)
    })
  }
}

// Hjälpfunktioner för att formatera filstorlek
export const formatFileSize = (bytes: number | undefined): string => {
  if (!bytes) return '-'

  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
}

// Hjälpfunktion för att få kategori-display
export const getCategoryDisplay = (category: CaseImageCategory): {
  label: string
  color: string
  icon: string
} => {
  const displays = {
    before: { label: 'Före', color: 'orange-500', icon: 'Camera' },
    after: { label: 'Efter', color: 'green-500', icon: 'CheckCircle' },
    general: { label: 'Övrigt', color: 'blue-500', icon: 'Image' }
  }
  return displays[category] || displays.general
}
