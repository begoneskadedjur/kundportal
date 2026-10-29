// AbsenceBlock.tsx — Frånvaro-block med diagonala ränder i typens färg
// Överlappande frånvaro delar radens höjd (lane). Frånvaro inom en dag går att
// dra till ny tid i dagvyn (3.108.0).
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { eventX, eventWidth, clampToGrid, formatTime } from './scheduleUtils'
import { ROW_HEIGHT } from './scheduleConstants'
import type { ViewMode } from './ScheduleHeader'
import { Icon } from '../../icons/Icon'
import { franvaroTyp, franvaroRubrik, alfa } from '../../../utils/franvaroTyper'

export interface Absence {
  id: string
  technician_id: string
  start_date: string
  end_date: string
  reason: string
  notes?: string | null
  group_id?: string | null
  title?: string | null
}

interface AbsenceBlockProps {
  absence: Absence
  onClick?: (absence: Absence) => void
  viewMode: ViewMode
  weekStart: Date
  lane?: number
  totalLanes?: number
  /** Antal tekniker i gruppen, 0 eller 1 = enskild */
  gruppAntal?: number
  /** Dagvy: blocket kan dras till en ny tid */
  dragbar?: boolean
}

/** Samma kalenderdag i webbläsarens tid */
function inomEnDag(a: Absence): boolean {
  return new Date(a.start_date).toDateString() === new Date(a.end_date).toDateString()
}

export function AbsenceBlock({ absence, onClick, viewMode, weekStart, lane = 0, totalLanes = 1, gruppAntal = 0, dragbar = false }: AbsenceBlockProps) {
  const [hovered, setHovered] = useState(false)
  const blockRef = useRef<HTMLDivElement>(null)

  const start = new Date(absence.start_date || absence.end_date)
  const end = new Date(absence.end_date || absence.start_date)
  const rawX = eventX(start, viewMode, weekStart)
  const rawW = eventWidth(start, end, viewMode)
  const { x, width } = clampToGrid(rawX, rawW, viewMode)
  if (width <= 0) return null

  const typ = franvaroTyp(absence.reason)
  const rubrik = franvaroRubrik(absence)
  const iGrupp = gruppAntal > 1
  const kanDras = dragbar && viewMode === 'day' && inomEnDag(absence)

  const startStr = formatTime(start)
  const endStr = formatTime(end)
  const isWeek = viewMode === 'week'
  const totalHeight = ROW_HEIGHT - 10
  const height = totalHeight / totalLanes
  const kompakt = height < 40

  return (
    <div
      ref={blockRef}
      className={`absolute rounded-md border-l-4 transition-[filter] duration-150 hover:brightness-110 ${kanDras ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      style={{
        left: x,
        width,
        top: 4 + lane * height,
        height: height - 2,
        borderLeftColor: typ.farg,
        backgroundColor: `${typ.farg}${alfa(0.16)}`,
        backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 8px, ${typ.farg}${alfa(0.12)} 8px, ${typ.farg}${alfa(0.12)} 16px)`,
      }}
      draggable={kanDras}
      onDragStart={e => {
        e.dataTransfer.setData('absenceId', absence.id)
        e.dataTransfer.effectAllowed = 'move'
        setHovered(false)
      }}
      onClick={() => onClick?.(absence)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(absence) } }}
      aria-label={`${rubrik}, ${startStr} till ${endStr}${iGrupp ? `, ${gruppAntal} tekniker` : ''}`}
    >
      <div className={`px-1.5 h-full flex ${kompakt ? 'items-center gap-1.5' : 'flex-col justify-center'} overflow-hidden`}>
        <p className={`${isWeek ? 'text-[9px]' : 'text-xs'} font-semibold text-slate-100 truncate flex items-center gap-1`}>
          {!isWeek && (
            <span className="flex-none" style={{ color: typ.farg }}>
              <Icon name={iGrupp ? 'bokning.team' : typ.ikon} size={16} />
            </span>
          )}
          <span className="truncate">{rubrik}</span>
        </p>
        {!isWeek && <p className="text-[10px] text-slate-400 font-mono whitespace-nowrap truncate">{startStr} till {endStr}</p>}
      </div>

      {/* Hovertext via portal som ärendeblocken (EventBlock): inuti gridden
          klipps den av scrollytan och hamnar under tidslinjen på översta raden */}
      {hovered && blockRef.current && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={(() => {
            const rect = blockRef.current!.getBoundingClientRect()
            return rect.top < 200
              ? { left: rect.left, top: rect.bottom + 8 }
              : { left: rect.left, top: rect.top - 8, transform: 'translateY(-100%)' }
          })()}
        >
          <div className="w-60 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-3 text-xs">
            <p className="font-semibold text-white mb-1 flex items-center gap-1.5">
              <span style={{ color: typ.farg }}><Icon name={typ.ikon} size={16} /></span>
              {rubrik}
            </p>
            <p className="text-slate-400">{typ.kort} · {startStr} till {endStr}</p>
            {iGrupp && <p className="text-slate-400 mt-0.5">Gäller {gruppAntal} tekniker</p>}
            {absence.notes && <p className="text-slate-300 mt-1 whitespace-pre-wrap">{absence.notes}</p>}
            <p className="text-[10px] text-slate-500 mt-1.5 pt-1 border-t border-slate-700">
              Klicka för att ändra{kanDras ? ', dra för att flytta' : ''}
            </p>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
