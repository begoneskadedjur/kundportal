// src/components/shared/specialReports/sectionOps.ts
// Handlingarna som sektionsvyn och dess block anropar. Redigeraren äger
// rapportens tillstånd och sparar via SpecialReportService.

import type {
  SpecialReportBlockType,
  SpecialReportEvent,
  SpecialReportEventType,
  SpecialReportFull,
  SpecialReportSection,
} from '../../../types/specialReport'

export type FullSection = SpecialReportFull['sections'][number]

export type EventPatch = Partial<Pick<SpecialReportEvent, 'event_date' | 'type' | 'title' | 'description'>>

export interface SectionOps {
  updateSection: (sectionId: string, patch: Partial<Pick<SpecialReportSection, 'title' | 'subtitle' | 'label' | 'area'>>) => void
  deleteSection: (sectionId: string) => Promise<void>
  addBlock: (sectionId: string, type: SpecialReportBlockType) => Promise<void>
  updateBlockText: (sectionId: string, blockId: string, text: string) => void
  deleteBlock: (sectionId: string, blockId: string) => Promise<void>
  moveBlock: (sectionId: string, blockId: string, steg: -1 | 1) => void
  addEvent: (sectionId: string, type: SpecialReportEventType) => Promise<SpecialReportEvent | null>
  updateEvent: (sectionId: string, eventId: string, patch: EventPatch) => void
  deleteEvent: (sectionId: string, eventId: string) => Promise<void>
  eventsImported: (sectionId: string, events: SpecialReportEvent[]) => void
  uploadImages: (sectionId: string, files: File[]) => Promise<void>
  updateImageCaption: (sectionId: string, imageId: string, caption: string) => void
  deleteImage: (sectionId: string, imageId: string) => Promise<void>
  /** Gå till översiktskartan och visa sektionens område */
  showArea: (sectionId: string) => void
  /** Gå till översiktskartan och rita (om) sektionens område */
  drawArea: (sectionId: string) => void
}
