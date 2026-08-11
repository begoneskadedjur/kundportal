// src/pages/shared/intranet/interactive/PrissattningDemo.tsx
// Interaktiv miniversion av prissättningskalkylatorn (Tjänster &
// fakturarader + artikel-kalkylator + marginal + Prisguide) för
// handboksguiden om prissättning. Alla siffror är exempel.

import { useState } from 'react'
import {
  ShoppingCart,
  Package,
  Calculator,
  Plus,
  Minus,
  CheckCircle2,
  MousePointerClick,
  Sparkles,
} from 'lucide-react'

interface DemoArticle {
  name: string
  unit: number
  qty: number
}

const START_ARTICLES: DemoArticle[] = [
  { name: 'Betesstation', unit: 120, qty: 0 },
  { name: 'Råttgift (block)', unit: 35, qty: 0 },
  { name: 'Tätningsmaterial', unit: 250, qty: 0 },
]

function marginColor(pct: number): { text: string; bg: string; label: string } {
  if (pct >= 60) return { text: 'text-[#20c58f]', bg: 'bg-[#20c58f]/15 border-[#20c58f]/30', label: 'Bra marginal' }
  if (pct >= 30) return { text: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30', label: 'OK marginal' }
  return { text: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30', label: 'Låg marginal' }
}

export default function PrissattningDemo() {
  const [articles, setArticles] = useState<DemoArticle[]>(START_ARTICLES)
  const [servicePrice, setServicePrice] = useState<number>(0)
  const [showGuide, setShowGuide] = useState(false)
  const [markup, setMarkup] = useState(3.0)
  const [applied, setApplied] = useState(false)
  const [manualAfter, setManualAfter] = useState(false)

  const cost = articles.reduce((sum, a) => sum + a.unit * a.qty, 0)
  const suggested = Math.round((cost * markup) / 10) * 10
  const margin = servicePrice - cost
  const marginPct = servicePrice > 0 ? (margin / servicePrice) * 100 : 0
  const mc = marginColor(marginPct)

  const changeQty = (index: number, delta: number) => {
    setArticles(prev => prev.map((a, i) => (i === index ? { ...a, qty: Math.max(0, a.qty + delta) } : a)))
  }

  const applySuggestion = () => {
    setServicePrice(suggested)
    setApplied(true)
  }

  const handlePriceInput = (value: string) => {
    const parsed = parseInt(value.replace(/\D/g, ''), 10)
    setServicePrice(Number.isNaN(parsed) ? 0 : parsed)
    if (applied) setManualAfter(true)
  }

  const tasks = [
    { label: 'Lägg till artiklarna du förbrukat (plus-knapparna)', done: cost > 0 },
    { label: 'Öppna Prisguiden och applicera prisförslaget', done: applied },
    { label: 'Finjustera priset manuellt efteråt (skriv i prisfältet)', done: manualAfter },
  ]
  const allDone = tasks.every(t => t.done)

  return (
    <div className="my-6 rounded-xl border border-[#20c58f]/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-[#20c58f]/10 border-b border-[#20c58f]/20 flex items-center gap-2">
        <MousePointerClick className="w-4 h-4 text-[#20c58f]" />
        <p className="text-sm font-semibold text-white">Prova själv - så hänger det ihop</p>
      </div>

      <div className="p-4 space-y-4 bg-slate-900/40">
        <p className="text-xs text-slate-400">
          Detta är en miniversion av kalkylatorn i ärendet. Scenariot: du har sanerat råttor i en villa.
          Alla priser är exempel och exklusive moms - ingenting sparas.
        </p>

        {/* Uppdrag */}
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-1.5">
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {task.done ? (
                <CheckCircle2 className="w-4 h-4 text-[#20c58f] flex-shrink-0" />
              ) : (
                <span className="w-4 h-4 rounded-full border-2 border-slate-600 flex-shrink-0" />
              )}
              <span className={`text-sm ${task.done ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                {i + 1}. {task.label}
              </span>
            </div>
          ))}
        </div>

        {/* Sektion B: Artiklar (intern) - först i flödet pedagogiskt */}
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-1.5 mb-2">
            <Package className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-semibold text-white">Artiklar - intern kalkyl</h4>
            <span className="ml-auto text-[11px] text-slate-500">Visas aldrig på fakturan</span>
          </div>
          <div className="space-y-1.5">
            {articles.map((article, i) => (
              <div key={article.name} className="flex items-center gap-2 px-3 py-2 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                <span className="text-sm text-slate-300 flex-1">{article.name}</span>
                <span className="text-xs text-slate-500 w-16 text-right">{article.unit} kr/st</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => changeQty(i, -1)}
                    disabled={article.qty === 0}
                    className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-300 flex items-center justify-center transition-colors"
                    aria-label={`Färre ${article.name}`}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-sm text-white tabular-nums">{article.qty}</span>
                  <button
                    onClick={() => changeQty(i, 1)}
                    className="w-6 h-6 rounded bg-[#20c58f]/20 hover:bg-[#20c58f]/30 text-[#20c58f] flex items-center justify-center transition-colors"
                    aria-label={`Fler ${article.name}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2 px-1">
            <span className="text-xs text-slate-400">Inköpskostnad (vår kostnad)</span>
            <span className="text-sm font-semibold text-amber-400 tabular-nums">{cost.toLocaleString('sv-SE')} kr</span>
          </div>
        </div>

        {/* Sektion A: Tjänster & fakturarader */}
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-1.5 mb-2">
            <ShoppingCart className="w-4 h-4 text-[#20c58f]" />
            <h4 className="text-sm font-semibold text-white">Tjänster & fakturarader</h4>
            <span className="ml-auto text-[11px] text-slate-500">Det kunden ser och betalar</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/40 border border-slate-700/50 rounded-lg">
            <span className="text-sm text-slate-300 flex-1">Råttsanering inkl. uppföljning</span>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                value={servicePrice === 0 ? '' : servicePrice}
                onChange={e => handlePriceInput(e.target.value)}
                placeholder="Pris"
                className="w-24 px-3 py-1.5 bg-slate-900/60 border border-slate-600 rounded-lg text-white text-sm text-right placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent tabular-nums"
              />
              <span className="text-xs text-slate-500">kr</span>
            </div>
          </div>

          {/* Prisguide */}
          <div className="mt-2">
            <button
              onClick={() => setShowGuide(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
            >
              <Calculator className="w-4 h-4" />
              Prisguide
            </button>
            {showGuide && (
              <div className="mt-2 p-3 bg-slate-800/50 border border-slate-600 rounded-xl space-y-2">
                {cost === 0 ? (
                  <p className="text-xs text-amber-400">
                    Lägg först till artiklar ovan - Prisguidens förslag bygger på artikelkostnaden.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">Påslag på artikelkostnaden</span>
                      <span className="text-sm font-semibold text-white tabular-nums">{markup.toFixed(1)}×</span>
                    </div>
                    <input
                      type="range"
                      min={1.5}
                      max={5}
                      step={0.1}
                      value={markup}
                      onChange={e => setMarkup(parseFloat(e.target.value))}
                      className="w-full accent-[#20c58f]"
                      aria-label="Påslag"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-400">
                        {cost.toLocaleString('sv-SE')} kr × {markup.toFixed(1)} ={' '}
                        <span className="text-white font-semibold">{suggested.toLocaleString('sv-SE')} kr</span>
                      </p>
                      <button
                        onClick={applySuggestion}
                        className="px-3 py-1.5 bg-[#20c58f] hover:bg-[#1ab37e] text-[#fff] rounded-lg text-xs font-semibold transition-colors"
                      >
                        Använd förslaget
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Tips om manuell justering efter Prisguiden */}
          {applied && !manualAfter && (
            <p className="mt-2 text-xs text-cyan-400">
              Tips: Prisguidens förslag är en startpunkt. Klicka i prisfältet och knappa in ett eget
              pris - t.ex. avrunda {suggested.toLocaleString('sv-SE')} kr uppåt, eller justera i
              undantagsfall där förslaget inte passar.
            </p>
          )}
        </div>

        {/* Marginalindikator */}
        <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${mc.bg}`}>
          <div>
            <p className={`text-sm font-semibold ${mc.text}`}>
              {servicePrice > 0 ? `${marginPct.toFixed(1)}% marginal - ${mc.label}` : 'Marginal visas när priset är satt'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Pris {servicePrice.toLocaleString('sv-SE')} kr − kostnad {cost.toLocaleString('sv-SE')} kr ={' '}
              {margin.toLocaleString('sv-SE')} kr (exkl. moms)
            </p>
          </div>
        </div>

        {/* Klart! */}
        {allDone && (
          <div className="flex items-start gap-3 p-4 bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-xl">
            <Sparkles className="w-5 h-5 text-[#20c58f] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Snyggt - du har gjort hela flödet!</p>
              <p className="text-xs text-slate-300 mt-1">
                Artiklar in → Prisguiden föreslår → du finjusterar manuellt → marginalen visar att
                priset håller. Exakt så jobbar du i riktiga ärenden.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
