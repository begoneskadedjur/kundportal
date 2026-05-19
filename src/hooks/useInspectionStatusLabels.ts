// src/hooks/useInspectionStatusLabels.ts
// Hämtar konfigurerba inspektionsstatusetiketter från databasen

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface InspectionStatusLabel {
  level: string
  label: string
  color: string
}

const DEFAULT_LABELS: Record<string, InspectionStatusLabel> = {
  none:   { level: 'none',   label: 'Ingen aktivitet',    color: '#22c55e' },
  low:    { level: 'low',    label: 'Lite aktivitet',     color: '#86efac' },
  medium: { level: 'medium', label: 'Medelhög aktivitet', color: '#f59e0b' },
  high:   { level: 'high',   label: 'Betydande aktivitet',color: '#ef4444' },
  // Legacy-mappningar
  ok:           { level: 'ok',           label: 'Ingen aktivitet',  color: '#22c55e' },
  activity:     { level: 'activity',     label: 'Aktivitet',        color: '#f59e0b' },
  needs_service:{ level: 'needs_service',label: 'Behöver service',  color: '#f97316' },
  replaced:     { level: 'replaced',     label: 'Utbytt',           color: '#3b82f6' },
}

export function useInspectionStatusLabels() {
  const [labels, setLabels] = useState<Record<string, InspectionStatusLabel>>(DEFAULT_LABELS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('inspection_status_labels')
      .select('level, label, color')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const map = { ...DEFAULT_LABELS }
          data.forEach(row => { map[row.level] = row })
          // Mappa legacy-statusar mot närmast motsvarande ny nivå för display
          map.ok = map.none
          map.activity = map.medium
          setLabels(map)
        }
        setLoading(false)
      })
  }, [])

  const getLabel = (status: string): string =>
    labels[status]?.label ?? status

  const getColor = (status: string): string =>
    labels[status]?.color ?? '#6b7280'

  return { labels, loading, getLabel, getColor }
}
