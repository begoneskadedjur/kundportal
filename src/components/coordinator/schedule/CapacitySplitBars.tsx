// CapacitySplitBars.tsx — Dubbla mini-barer: Engångskunder vs Avtalskunder
// Varje bar visar kategorins timmar i förhållande till teknikerns kapacitet.
// Används i dagvyns teknikerrader och vecko-/månadsvyernas tekniker-chips.

interface CapacitySplitBarsProps {
  engang: number
  avtal: number
  capacity: number
}

export function CapacitySplitBars({ engang, avtal, capacity }: CapacitySplitBarsProps) {
  const widthPct = (h: number) => (capacity > 0 ? Math.min((h / capacity) * 100, 100) : 0)

  return (
    <div className="w-full space-y-1">
      <div>
        <div className="flex items-center justify-between text-[9px] leading-none mb-0.5">
          <span className="text-[#20c58f] font-medium">Engångskunder</span>
          <span className="text-slate-300 tabular-nums">{engang}h</span>
        </div>
        <div className="h-1 w-full rounded-full bg-slate-700/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#20c58f] transition-all"
            style={{ width: `${widthPct(engang)}%` }}
          />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-[9px] leading-none mb-0.5">
          <span className="text-violet-400 font-medium">Avtalskunder</span>
          <span className="text-slate-300 tabular-nums">{avtal}h</span>
        </div>
        <div className="h-1 w-full rounded-full bg-slate-700/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-violet-500 transition-all"
            style={{ width: `${widthPct(avtal)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
