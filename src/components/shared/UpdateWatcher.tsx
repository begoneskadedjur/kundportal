// src/components/shared/UpdateWatcher.tsx
// Visar "Ny version finns" längst ned när servern har en nyare version, och
// laddar om vid nästa sidbyte, ett ögonblick där inget formulär är halvfyllt.
// Aldrig en tvingad omladdning mitt på en sida. Monteras en gång i App.tsx,
// innanför routern.

import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { useVersionWatch } from '../../hooks/useVersionWatch'

export function UpdateWatcher() {
  const { updateAvailable, newVersion, canAutoReload, reload } = useVersionWatch()
  const location = useLocation()
  const detectedAtPathRef = useRef<string | null>(null)

  // Kom ihåg var användaren var när uppdateringen upptäcktes
  useEffect(() => {
    if (updateAvailable && detectedAtPathRef.current === null) {
      detectedAtPathRef.current = location.pathname
    }
  }, [updateAvailable, location.pathname])

  // Ladda om vid första sidbytet därefter
  useEffect(() => {
    if (!updateAvailable || !canAutoReload) return
    const detectedAt = detectedAtPathRef.current
    if (detectedAt !== null && location.pathname !== detectedAt) reload()
  }, [location.pathname, updateAvailable, canAutoReload, reload])

  if (!updateAvailable) return null

  return (
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 bottom-20 lg:bottom-4 z-[90] max-w-[calc(100vw-2rem)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl px-4 py-2.5 flex items-center gap-3 text-sm text-slate-300"
    >
      <span className="w-2 h-2 rounded-full bg-[#20c58f] flex-shrink-0" aria-hidden="true" />
      <span className="whitespace-nowrap">
        Ny version{newVersion ? ` ${newVersion}` : ''} finns
      </span>
      <button
        type="button"
        onClick={reload}
        className="ml-1 px-3 py-1.5 rounded-lg bg-[#20c58f] hover:bg-[#1ab07f] text-[#fff] font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Ladda om
      </button>
    </div>
  )
}

export default UpdateWatcher
