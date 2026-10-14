// src/components/shared/specialReports/sectionOps.ts
// Handlingarna som delvyn och dess block anropar. Redigeraren äger
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
  updateSection: (sectionId: string, patch: Partial<Pick<SpecialReportSection, 'title' | 'subtitle' | 'label' | 'area' | 'color'>>) => void
  deleteSection: (sectionId: string) => Promise<void>
  addBlock: (sectionId: string, type: SpecialReportBlockType) => Promise<void>
  updateBlockText: (sectionId: string, blockId: string, text: string) => void
  deleteBlock: (sectionId: string, blockId: string) => Promise<void>
  moveBlock: (sectionId: string, blockId: string, steg: -1 | 1) => void
  addEvent: (sectionId: string, type: SpecialReportEventType) => Promise<SpecialReportEvent | null>
  updateEvent: (sectionId: string, eventId: string, patch: EventPatch) => void
  deleteEvent: (sectionId: string, eventId: string) => Promise<void>
  /** 3.55.0: ny ordning på delens händelser (alla id:n i den nya ordningen) */
  reorderEvents: (sectionId: string, orderedIds: string[]) => void
  eventsImported: (sectionId: string, events: SpecialReportEvent[]) => void
  /** Laddar upp bilder till delen. Med eventId kopplas de till händelsen och bildblocket skapas om det saknas */
  uploadImages: (sectionId: string, files: File[], eventId?: string | null) => Promise<void>
  updateImageCaption: (sectionId: string, imageId: string, caption: string) => void
  /** Vilken händelse bilden hör till, null = ingen (3.53.0) */
  updateImageEvent: (sectionId: string, imageId: string, eventId: string | null) => void
  deleteImage: (sectionId: string, imageId: string) => Promise<void>
  /** Gå till översiktskartan och visa delens område */
  showArea: (sectionId: string) => void
  /** Gå till översiktskartan och rita (om) delens område */
  drawArea: (sectionId: string) => void
}

/** Vad Snygga till ska läsa igenom (3.52.0) */
export type PolishTarget =
  | { typ: 'hela' }
  | { typ: 'om' }
  | { typ: 'samm' }
  | { typ: 'block'; sectionId: string; blockId: string }
  | { typ: 'handelser'; sectionId: string }
  | { typ: 'bilder'; sectionId: string }
