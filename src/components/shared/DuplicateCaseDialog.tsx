// src/components/shared/DuplicateCaseDialog.tsx
// Dialog för att duplicera ett ärende. Användaren väljer schema och vilka 1:N-relationer som följer med.

import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Copy,
  Calendar,
  FileText,
  ClipboardList,
  Clock,
  FlaskConical,
  ShoppingCart,
  Package,
  Image as ImageIcon,
  Loader2,
  CheckCircle,
} from 'lucide-react'
import DatePicker from 'react-datepicker'
import { registerLocale } from 'react-datepicker'
import sv from 'date-fns/locale/sv'
import Button from '../ui/Button'
import { CaseDuplicationService, type DuplicateCaseOptions, type DuplicateCaseType, type DuplicateCaseResult } from '../../services/caseDuplicationService'
import toast from 'react-hot-toast'
import 'react-datepicker/dist/react-datepicker.css'

registerLocale('sv', sv)

interface DuplicateCaseDialogProps {
  isOpen: boolean
  onClose: () => void
  caseData: {
    id: string
    case_type: DuplicateCaseType
    title?: string | null
    case_number?: string | null
    /** Privat/företag: start_date | Avtal: scheduled_start */
    startAt?: string | null
    /** Privat/företag: due_date | Avtal: scheduled_end */
    endAt?: string | null
  }
  /** Tekniker som skapar kopian (valfritt). */
  createdByTechnicianId?: string | null
  createdByTechnicianName?: string | null
  /** Anropas när duplicering lyckades. Får det nya ärendets id + typ. */
  onDuplicated: (result: DuplicateCaseResult) => void
}

interface OptionRow {
  key: keyof DuplicateCaseOptions
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const OPTION_ROWS: OptionRow[] = [
  { key: 'caseInfo', label: 'Ärendeinformation', description: 'Titel, beskrivning, anteckningar och prioritet', icon: FileText },
  { key: 'sanitationReport', label: 'Saneringsrapport', description: 'Rapporttext, rekommendationer och avvikelser', icon: ClipboardList },
  { key: 'loggedTime', label: 'Loggad tid', description: 'Påbörjad arbetstid och loggade minuter', icon: Clock },
  { key: 'preparations', label: 'Använda preparat', description: 'Registrerade preparat med dosering', icon: FlaskConical },
  { key: 'billingItems', label: 'Tjänster & fakturarader', description: 'Fakturerbara tjänsterader och pris', icon: ShoppingCart },
  { key: 'internalCosts', label: 'Interna kostnader', description: 'Artiklar för marginalkalkyl (interna)', icon: Package },
  { key: 'images', label: 'Bilder', description: 'Befintliga bilder kopplas till det nya ärendet', icon: ImageIcon },
]

const DEFAULT_OPTIONS: DuplicateCaseOptions = {
  caseInfo: false,
  sanitationReport: false,
  loggedTime: false,
  preparations: false,
  billingItems: false,
  internalCosts: false,
  images: false,
}

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export default function DuplicateCaseDialog({
  isOpen,
  onClose,
  caseData,
  createdByTechnicianId,
  createdByTechnicianName,
  onDuplicated,
}: DuplicateCaseDialogProps) {
  const [startDate, setStartDate] = useState<Date | null>(parseDate(caseData.startAt))
  const [endDate, setEndDate] = useState<Date | null>(parseDate(caseData.endAt))
  const [options, setOptions] = useState<DuplicateCaseOptions>(DEFAULT_OPTIONS)
  const [loading, setLoading] = useState(false)

  const selectedCount = useMemo(
    () => Object.values(options).filter(Boolean).length,
    [options]
  )

  if (!isOpen) return null

  const toggleOption = (key: keyof DuplicateCaseOptions) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSelectAll = () => {
    const allSelected = selectedCount === OPTION_ROWS.length
    if (allSelected) {
      setOptions(DEFAULT_OPTIONS)
    } else {
      setOptions({
        caseInfo: true,
        sanitationReport: true,
        loggedTime: true,
        preparations: true,
        billingItems: true,
        internalCosts: true,
        images: true,
      })
    }
  }

  const handleDuplicate = async () => {
    setLoading(true)
    try {
      const result = await CaseDuplicationService.duplicateCase({
        sourceCaseId: caseData.id,
        caseType: caseData.case_type,
        startDate: startDate ? startDate.toISOString() : null,
        dueDate: endDate ? endDate.toISOString() : null,
        options,
        createdByTechnicianId: createdByTechnicianId ?? null,
        createdByTechnicianName: createdByTechnicianName ?? null,
      })
      toast.success('Ärende duplicerat')
      onDuplicated(result)
    } catch (err: any) {
      console.error('Duplicate case error:', err)
      toast.error(err.message || 'Kunde inte duplicera ärende')
    } finally {
      setLoading(false)
    }
  }

  const allSelected = selectedCount === OPTION_ROWS.length

  const content = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4 text-[#20c58f]" />
            <div>
              <h2 className="text-base font-semibold text-white">Duplicera ärende</h2>
              <p className="text-xs text-slate-400">
                Skapa en kopia av ärendet och välj vad som ska följa med
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Schemaläggning */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar className="w-4 h-4 text-[#20c58f]" />
              <h3 className="text-sm font-semibold text-white">Schemaläggning</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Datum är förifyllda från ursprungsärendet — justera om kopian ska schemaläggas på annan tid.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Start</label>
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date)}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="d MMM yyyy HH:mm"
                  locale="sv"
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
                  placeholderText="Välj datum och tid"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Slut</label>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="d MMM yyyy HH:mm"
                  locale="sv"
                  minDate={startDate || undefined}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
                  placeholderText="Välj sluttid"
                />
              </div>
            </div>
          </div>

          {/* Vad ska följa med */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-[#20c58f]" />
                <h3 className="text-sm font-semibold text-white">Vad ska följa med?</h3>
              </div>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-slate-400 hover:text-[#20c58f] transition-colors"
              >
                {allSelected ? 'Avmarkera alla' : 'Markera alla'}
              </button>
            </div>
            <div className="space-y-2">
              {OPTION_ROWS.map(row => {
                const Icon = row.icon
                const checked = options[row.key]
                return (
                  <label
                    key={row.key}
                    className={`flex items-start gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-[#20c58f]/10 border-[#20c58f]/30'
                        : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOption(row.key)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-600 text-[#20c58f] focus:ring-[#20c58f]"
                    />
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${checked ? 'text-[#20c58f]' : 'text-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">{row.label}</div>
                      <div className="text-xs text-slate-500 leading-relaxed">{row.description}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Alltid med-info */}
          <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl text-xs text-slate-400">
            <span className="text-slate-300 font-medium">Kopieras alltid:</span>{' '}
            kontaktinformation, vald tjänst och tilldelade tekniker.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-700 shrink-0">
          <span className="text-xs text-slate-500">
            {selectedCount === 0
              ? 'Inget extra valt — bara grunddata kopieras'
              : `${selectedCount} ${selectedCount === 1 ? 'sektion' : 'sektioner'} följer med`}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleDuplicate}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  Skapar kopia...
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  Skapa kopia
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
