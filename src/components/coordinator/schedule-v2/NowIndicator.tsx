// NowIndicator.tsx — Vertikal röd linje som visar nuvarande tid
import { useState, useEffect } from 'react'
import { timeToX } from './scheduleUtils'
import { DAY_START_HOUR, DAY_END_HOUR } from './scheduleConstants'

export function NowIndicator() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const hour = now.getHours() + now.getMinutes() / 60
  if (hour < DAY_START_HOUR || hour > DAY_END_HOUR) return null

  const x = timeToX(now)

  return (
    <div
      className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none"
      style={{ left: x }}
    >
      <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-[5px] -mt-1" />
    </div>
  )
}
