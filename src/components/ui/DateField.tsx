// src/components/ui/DateField.tsx
//
// Datumfält med garanterat svenskt format (ÅÅÅÅ-MM-DD).
//
// VARFÖR INTE <input type="date">: Chrome struntar i både `lang="sv-SE"` på
// dokumentet och på elementet — den läser WEBBLÄSARENS språkinställning. En
// användare med engelsk Chrome får därför mm/dd/yyyy hur mycket svenska vi än
// deklarerar i koden. Firefox och Safari respekterar lang; Chrome gör det inte,
// och det finns ingen väg runt det med native-fältet.
//
// Komponenten är en direkt ersättare: den tar och returnerar samma
// ÅÅÅÅ-MM-DD-sträng som native-fältet, så anropande kod behöver inte ändras
// mer än elementnamnet.

import { forwardRef } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import { sv } from 'date-fns/locale'
import { Calendar } from 'lucide-react'
// Importerar react-datepickers egen CSS och lägger portalens mörka tema ovanpå
import '../../styles/DatePickerDarkTheme.css'

registerLocale('sv', sv)

/** 'ÅÅÅÅ-MM-DD' eller 'ÅÅÅÅ-MM' → Date (lokal tid, aldrig UTC-tolkad) */
function parseDateKey(value: string | null | undefined): Date | null {
  if (!value) return null
  // Fångar både 'ÅÅÅÅ-MM-DD' och 'ÅÅÅÅ-MM-DDTHH:mm' — tiden måste med, annars
  // nollställs klockslaget varje gång ett datetime-värde läses in.
  const full = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value)
  if (full) {
    const d = new Date(
      Number(full[1]),
      Number(full[2]) - 1,
      Number(full[3]),
      full[4] ? Number(full[4]) : 0,
      full[5] ? Number(full[5]) : 0
    )
    return Number.isNaN(d.getTime()) ? null : d
  }
  // Månadsläge: 'ÅÅÅÅ-MM' → första dagen i månaden
  const month = /^(\d{4})-(\d{2})$/.exec(value)
  if (month) {
    const d = new Date(Number(month[1]), Number(month[2]) - 1, 1)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/** Date → 'ÅÅÅÅ-MM-DD' i lokal tid. Aldrig toISOString() — den skiftar dygn. */
function toDateKey(date: Date | null): string {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Date → 'ÅÅÅÅ-MM' i lokal tid. */
function toMonthKey(date: Date | null): string {
  if (!date) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Date → 'ÅÅÅÅ-MM-DDTHH:mm' i lokal tid — samma form som datetime-local. */
function toDateTimeKey(date: Date | null): string {
  if (!date) return ''
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${toDateKey(date)}T${h}:${min}`
}

export interface DateFieldProps {
  /** ÅÅÅÅ-MM-DD, tom sträng = inget valt */
  value: string
  /** Anropas med ÅÅÅÅ-MM-DD, eller tom sträng när fältet rensas */
  onChange: (value: string) => void
  min?: string
  max?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  id?: string
  autoFocus?: boolean
  /** Visa kryss för att rensa fältet */
  clearable?: boolean
  /**
   * Månadsläge: värdet är 'ÅÅÅÅ-MM' i stället för 'ÅÅÅÅ-MM-DD' och väljaren
   * visar månader. Ersätter <input type="month">, som i engelsk Chrome visar
   * "August 2026" i stället för det svenska formatet.
   */
  monthOnly?: boolean
  /**
   * Datum + tid: värdet är 'ÅÅÅÅ-MM-DDTHH:mm' och väljaren visar en tidskolumn.
   * Ersätter <input type="datetime-local">, som har samma formatproblem.
   */
  withTime?: boolean
  'aria-label'?: string
}

const BASE_CLASS =
  'w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white ' +
  'placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] ' +
  'focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed'

/**
 * Bär vänsterpaddingen som ger kalenderikonen plats. Måste sättas i CSS och
 * inte som Tailwind-klass: DatePickerDarkTheme.css sätter padding med
 * !important på alla datepicker-fält, vilket annars slår ut pl-9 och lägger
 * ikonen ovanpå texten.
 */
const ICON_SPACE_CLASS = 'datefield-input'

/**
 * Svenskt datumfält. Veckan börjar på måndag, månadsnamnen är svenska och
 * inmatningen sker som ÅÅÅÅ-MM-DD oavsett webbläsarspråk.
 */
const DateField = forwardRef<DatePicker, DateFieldProps>(function DateField(
  {
    value,
    onChange,
    min,
    max,
    placeholder,
    disabled,
    required,
    className,
    id,
    autoFocus,
    clearable,
    monthOnly,
    withTime,
    'aria-label': ariaLabel,
  },
  ref
) {
  return (
    <div className="relative">
      <Calendar
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none z-10"
        aria-hidden
      />
      <DatePicker
        ref={ref}
        id={id}
        selected={parseDateKey(value)}
        onChange={(date) =>
          onChange(
            monthOnly ? toMonthKey(date) : withTime ? toDateTimeKey(date) : toDateKey(date)
          )
        }
        locale="sv"
        dateFormat={monthOnly ? 'yyyy-MM' : withTime ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd'}
        showMonthYearPicker={monthOnly}
        showTimeSelect={withTime}
        timeFormat="HH:mm"
        timeIntervals={15}
        timeCaption="Tid"
        placeholderText={
          placeholder ??
          (monthOnly ? 'ÅÅÅÅ-MM' : withTime ? 'ÅÅÅÅ-MM-DD HH:mm' : 'ÅÅÅÅ-MM-DD')
        }
        minDate={parseDateKey(min) ?? undefined}
        maxDate={parseDateKey(max) ?? undefined}
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        isClearable={clearable}
        showPopperArrow={false}
        // Kalendern renderas i body så den aldrig klipps av modalens overflow
        portalId="datefield-portal"
        className={`${className ?? BASE_CLASS} ${ICON_SPACE_CLASS}`}
        wrapperClassName="w-full"
        aria-label={ariaLabel}
      />
    </div>
  )
})

export default DateField
