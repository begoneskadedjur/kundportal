// src/pages/procurement/ProcurementBrand.tsx
// Logotyp och namn för den fristående upphandlingsportalen: BeGones märke
// (samma som PWA-ikonen) och rubriken Upphandlingsbevakning.

interface Props {
  size?: 'sm' | 'lg'
}

export function ProcurementBrand({ size = 'sm' }: Props) {
  const lg = size === 'lg'
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <img src="/pwa-icon.svg" alt="BeGone" className={`${lg ? 'w-10 h-10' : 'w-7 h-7'} rounded-lg flex-shrink-0`} />
      <div className="min-w-0 leading-tight">
        <div className={`${lg ? 'text-[11px]' : 'text-[10px]'} uppercase tracking-[0.18em] text-slate-500`}>BeGone</div>
        <div className={`${lg ? 'text-xl' : 'text-[14px]'} font-semibold text-slate-100 truncate`}>Upphandlingsbevakning</div>
      </div>
    </div>
  )
}
