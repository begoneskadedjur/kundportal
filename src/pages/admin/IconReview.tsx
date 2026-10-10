// src/pages/admin/IconReview.tsx
// Granskningssida för ikonstandarden (/admin/ikoner, bara admin). Visar varje
// ikon i registret i 16, 20, 24 och 32 i portalens aktuella tema, med sökning
// på namn. Klick på en ikon kopierar namnet.

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Icon, type IconName } from '../../components/icons/Icon'
import { ICON_NAMES } from '../../components/icons/set'
import { useTheme } from '../../contexts/ThemeContext'

const SIZES = [16, 20, 24, 32] as const

const DOMAN_RUBRIK: Record<string, string> = {
  allman: 'Allmänt',
  lead: 'Leads',
  arende: 'Ärenden',
  kontakt: 'Kontakt',
  dok: 'Dokument',
  tjanst: 'Tjänster (skadedjur)',
  kalla: 'Källor (webbförfrågningar)',
  sok: 'Söklådan',
}

export default function IconReview() {
  const [query, setQuery] = useState('')
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    document.title = 'Ikoner - BeGone Admin'
  }, [])

  const grupper = useMemo(() => {
    const q = query.trim().toLowerCase()
    const traffar = q ? ICON_NAMES.filter(n => n.toLowerCase().includes(q)) : ICON_NAMES
    const map = new Map<string, IconName[]>()
    for (const n of traffar) {
      const doman = n.split('.')[0]
      const lista = map.get(doman) ?? []
      lista.push(n)
      map.set(doman, lista)
    }
    return { traffar: traffar.length, domaner: [...map.entries()] }
  }, [query])

  const kopiera = async (name: IconName) => {
    try {
      await navigator.clipboard.writeText(name)
      toast.success(`Kopierade ${name}`)
    } catch {
      toast.error('Kunde inte kopiera')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Icon name="allman.lista" size={24} className="text-[#20c58f]" />
            Ikoner
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Portalens ikonstandard: 24 × 24, streck 1,6, en färg via currentColor. Storlekar 16 (text och rader),
            20 (knappar och flikar), 24 (rubriker) och 32 (tomma lägen). Används med{' '}
            <code className="font-mono text-slate-300">&lt;Icon name="…" size={'{16}'} /&gt;</code> från{' '}
            <code className="font-mono text-slate-300">src/components/icons</code>. Klicka på en ikon för att kopiera namnet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="text-sm text-slate-300 hover:text-white underline underline-offset-4 decoration-slate-600"
        >
          Visa i {resolvedTheme === 'dark' ? 'ljust' : 'mörkt'} tema
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Icon name="allman.sok" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Sök på namn, t.ex. lead. eller tips"
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50 focus:border-[#20c58f]"
          />
        </div>
        <span className="text-sm text-slate-400">
          {grupper.traffar} av {ICON_NAMES.length} ikoner
        </span>
      </div>

      {grupper.domaner.length === 0 && (
        <div className="py-12 text-center text-slate-400">
          <Icon name="allman.sok" size={32} className="mx-auto mb-2 text-slate-500" />
          Inga ikoner matchar sökningen.
        </div>
      )}

      {grupper.domaner.map(([doman, namn]) => (
        <section key={doman} className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">
            {DOMAN_RUBRIK[doman] ?? doman}
            <span className="ml-2 font-normal text-slate-500">
              {doman}.* · {namn.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {namn.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => kopiera(n)}
                title={`Kopiera ${n}`}
                className="text-left p-3 bg-slate-800/30 border border-slate-700 rounded-xl hover:border-[#20c58f]/60 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50 transition-colors"
              >
                <div className="flex items-end gap-4 text-slate-200 h-9">
                  {SIZES.map(s => (
                    <Icon key={s} name={n} size={s} className="flex-none" />
                  ))}
                </div>
                <div className="mt-2 font-mono text-xs text-slate-400 truncate">{n}</div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
