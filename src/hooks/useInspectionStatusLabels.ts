// src/hooks/useInspectionStatusLabels.ts
// Hämtar konfigurerba inspektionsstatusetiketter från databasen
// (inspection_status_labels, ändras på /admin/inspektionsstatus).
// Tabellen läses en gång och hålls i en modulcache, så att även hjälpfunktioner
// utanför komponenter kan få det dynamiska ordet via inspectionStatusLabel().
// Komponenter som anropar hooken ritas om när cachen fyllts.

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DEFAULT_INSPECTION_LEVEL_LABELS } from '../shared/inspectionStatusLevels'

export interface InspectionStatusLabel {
  level: string
  label: string
  color: string
}

const DEFAULT_LABELS: Record<string, InspectionStatusLabel> = {
  none:   { level: 'none',   label: DEFAULT_INSPECTION_LEVEL_LABELS.none,   color: '#22c55e' },
  low:    { level: 'low',    label: DEFAULT_INSPECTION_LEVEL_LABELS.low,    color: '#eab308' },
  medium: { level: 'medium', label: DEFAULT_INSPECTION_LEVEL_LABELS.medium, color: '#f97316' },
  high:   { level: 'high',   label: DEFAULT_INSPECTION_LEVEL_LABELS.high,   color: '#ef4444' },
  // Legacy-mappningar
  ok:           { level: 'ok',           label: DEFAULT_INSPECTION_LEVEL_LABELS.none,   color: '#22c55e' },
  activity:     { level: 'activity',     label: DEFAULT_INSPECTION_LEVEL_LABELS.medium, color: '#f59e0b' },
  needs_service:{ level: 'needs_service',label: 'Behöver service',  color: '#f97316' },
  replaced:     { level: 'replaced',     label: 'Utbytt',           color: '#3b82f6' },
}

let cachedLabels: Record<string, InspectionStatusLabel> | null = null
let loadPromise: Promise<Record<string, InspectionStatusLabel>> | null = null

export function loadInspectionStatusLabels(): Promise<Record<string, InspectionStatusLabel>> {
  if (cachedLabels) return Promise.resolve(cachedLabels)
  if (!loadPromise) {
    loadPromise = Promise.resolve(
      supabase
        .from('inspection_status_labels')
        .select('level, label, color')
    ).then(({ data, error }) => {
      if (error || !data || data.length === 0) {
        // Försök igen nästa gång en vy monteras
        loadPromise = null
        return DEFAULT_LABELS
      }
      const map = { ...DEFAULT_LABELS }
      data.forEach(row => { map[row.level] = row })
      // Mappa legacy-statusar mot närmast motsvarande ny nivå för display
      map.ok = map.none
      map.activity = map.medium
      cachedLabels = map
      return map
    }, () => {
      loadPromise = null
      return DEFAULT_LABELS
    })
  }
  return loadPromise
}

/** Töm cachen så att nästa vy läser tabellen på nytt (efter att admin sparat). */
export function resetInspectionStatusLabelsCache(): void {
  cachedLabels = null
  loadPromise = null
}

/**
 * Ordet för en kontrollstatus, synkront. Använder tabellens ord om de lästs in,
 * annars reservorden. Anropa useInspectionStatusLabels() i komponenten för att
 * få omritning när tabellen lästs.
 */
export function inspectionStatusLabel(status: string | null | undefined): string {
  if (!status) return ''
  const map = cachedLabels ?? DEFAULT_LABELS
  return map[status]?.label ?? status
}

export function useInspectionStatusLabels() {
  const [labels, setLabels] = useState<Record<string, InspectionStatusLabel>>(cachedLabels ?? DEFAULT_LABELS)
  const [loading, setLoading] = useState(!cachedLabels)

  useEffect(() => {
    let active = true
    loadInspectionStatusLabels().then(map => {
      if (!active) return
      setLabels(map)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const getLabel = (status: string): string =>
    labels[status]?.label ?? status

  const getColor = (status: string): string =>
    labels[status]?.color ?? '#6b7280'

  return { labels, loading, getLabel, getColor }
}
