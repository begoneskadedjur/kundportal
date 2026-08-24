// src/components/shared/RoomNumberFields.tsx
// Rum nr för ärenden hos boendekunder: ett fält som standard, "+ Lägg till rum"
// klickar upp fält 2 och 3 (max 3). Värdet lagras som kommaseparerad sträng i
// formulärets room_number-fält; CaseRoomService.syncFromString skriver raderna
// till case_rooms vid sparande.

import { Plus, X } from 'lucide-react'
import { roomsFromString, roomsToString, MAX_ROOMS_PER_CASE } from '../../services/caseRoomService'

interface Props {
  /** Kommaseparerad sträng, t.ex. "105, 107" */
  value: string
  onChange: (value: string) => void
  /** Första fältet obligatoriskt (vid skapande när kunden har flaggan) */
  required?: boolean
  disabled?: boolean
}

export default function RoomNumberFields({ value, onChange, required, disabled }: Props) {
  const rooms = roomsFromString(value)
  // Visa alltid minst ett fält; behåll tomma mellansteg medan man skriver
  const fields = rooms.length > 0 ? [...rooms] : ['']
  const raw = value.split(',').map((r) => r.trim())
  while (fields.length < raw.length && fields.length < MAX_ROOMS_PER_CASE) fields.push('')

  const update = (i: number, v: string) => {
    const next = [...fields]
    next[i] = v
    onChange(next.map((r) => r.trim()).filter((r, idx) => r !== '' || idx < next.length).join(', '))
  }
  const add = () => onChange([...fields, ''].join(', '))
  const remove = (i: number) => {
    const next = fields.filter((_, idx) => idx !== i)
    onChange(roomsToString(next) ?? '')
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1">
        Rum nr{required ? ' *' : ''}
      </label>
      <div className="space-y-2">
        {fields.map((room, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={room}
              onChange={(e) => update(i, e.target.value)}
              required={required && i === 0}
              disabled={disabled}
              placeholder={i === 0 ? 't.ex. 105' : `Rum ${i + 1}`}
              className="w-full px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
            />
            {i > 0 && !disabled && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="p-1.5 text-slate-500 hover:text-slate-300"
                title="Ta bort rum"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {fields.length < MAX_ROOMS_PER_CASE && !disabled && (
        <button
          type="button"
          onClick={add}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[#20c58f] hover:underline"
        >
          <Plus className="w-3 h-3" />
          Lägg till rum
        </button>
      )}
    </div>
  )
}
