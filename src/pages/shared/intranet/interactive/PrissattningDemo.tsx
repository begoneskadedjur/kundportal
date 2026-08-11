// src/pages/shared/intranet/interactive/PrissattningDemo.tsx
// Interaktiv miniversion av prissättningskalkylatorn för handboks-
// guiden om prissättning: artiklar (intern kostnad), koppling
// artikel -> tjänst i Prisguiden, prisförslag via påslag och
// manuell finjustering. Alla siffror är exempel.

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
  Link2,
} from 'lucide-react'

interface DemoService {
  id: string
  name: string
  price: number
}

interface DemoArticle {
  name: string
  unit: number
  qty: number
  assignedTo: string | null
}

const START_SERVICES: DemoService[] = [
  { id: 'sanering', name: 'Råttsanering inkl. uppföljning', price: 0 },
  { id: 'tatning', name: 'Tätning mot gnagare', price: 0 },
]

const START_ARTICLES: DemoArticle[] = [
  { name: 'Betesstation', unit: 120, qty: 0, assignedTo: null },
  { name: 'Råttgift (block)', unit: 35, qty: 0, assignedTo: null },
  { name: 'Tätningsmaterial', unit: 250, qty: 0, assignedTo: null },
]

function marginColor(pct: number): { text: string; bg: string; label: string } {
  if (pct >= 60) return { text: 'text-[#20c58f]', bg: 'bg-[#20c58f]/15 border-[#20c58f]/30', label: 'Bra marginal' }
  if (pct >= 30) return { text: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30', label: 'OK marginal' }
  return { text: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30', label: 'Låg marginal' }
}

export default function PrissattningDemo() {
  const [services, setServices] = useState<DemoService[]>(START_SERVICES)
  const [articles, setArticles] = useState<DemoArticle[]>(START_ARTICLES)
  const [showGuide, setShowGuide] = useState(false)
  const [markup, setMarkup] = useState(3.0)
  const [appliedAny, setAppliedAny] = useState(false)
  const [manualAfter, setManualAfter] = useState(false)

  const usedArticles = articles.filter(a => a.qty > 0)
  const totalCost = articles.reduce((sum, a) => sum + a.unit * a.qty, 0)
  const totalPrice = services.reduce((sum, s) => sum + s.price, 0)
  const margin = totalPrice - totalCost
  const marginPct = totalPrice > 0 ? (margin / totalPrice) * 100 : 0
  const mc = marginColor(marginPct)

  const costFor = (serviceId: string) =>
    articles.filter(a => a.assignedTo === serviceId).reduce((sum, a) => sum + a.unit * a.qty, 0)
  const suggestedFor = (serviceId: string) => Math.round((costFor(serviceId) * markup) / 10) * 10
  const unassignedCount = usedArticles.filter(a => !a.assignedTo).length
  const allAssigned = usedArticles.length > 0 && unassignedCount === 0

  const changeQty = (index: number, delta: number) => {
    setArticles(prev => prev.map((a, i) => (i === index ? { ...a, qty: Math.max(0, a.qty + delta) } : a)))
  }

  const assignArticle = (index: number, serviceId: string) => {
    setArticles(prev => prev.map((a, i) => (i === index ? { ...a, assignedTo: serviceId } : a)))
  }

  const applySuggestion = (serviceId: string) => {
    const suggestion = suggestedFor(serviceId)
    setServices(prev => prev.map(s => (s.id === serviceId ? { ...s, price: suggestion } : s)))
    setAppliedAny(true)
  }

  const handlePriceInput = (serviceId: string, value: string) => {
    const parsed = parseInt(value.replace(/\D/g, ''), 10)
    setServices(prev => prev.map(s => (s.id === serviceId ? { ...s, price: Number.isNaN(parsed) ? 0 : parsed } : s)))
    if (appliedAny) setManualAfter(true)
  }

  const tasks = [
    { label: 'Lägg till artiklarna du förbrukat (plus-knapparna)', done: totalCost > 0 },
    { label: 'Koppla varje artikel till rätt tjänst i Prisguiden', done: allAssigned },
    { label: 'Applicera Prisguidens prisförslag på tjänsterna', done: appliedAny },
    { label: 'Finjustera ett pris manuellt efteråt (skriv i prisfältet)', done: manualAfter },
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
          Miniversion av kalkylatorn i ärendet. Scenariot: du har sanerat råttor i en villa och även
          tätat fasaden - två tjänster på samma faktura. Alla priser är exempel, exklusive moms - ingenting sparas.
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

        {/* Artiklar (intern kalkyl) */}
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
            <span className="text-sm font-semibold text-amber-400 tabular-nums">{totalCost.toLocaleString('sv-SE')} kr</span>
          </div>
        </div>

        {/* Tjänster & fakturarader */}
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <div className="flex items-center gap-1.5 mb-2">
            <ShoppingCart className="w-4 h-4 text-[#20c58f]" />
            <h4 className="text-sm font-semibold text-white">Tjänster & fakturarader</h4>
            <span className="ml-auto text-[11px] text-slate-500">Det kunden ser och betalar</span>
          </div>
          <div className="space-y-1.5">
            {services.map(service => (
              <div key={service.id} className="flex items-center gap-2 px-3 py-2 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                <span className="text-sm text-slate-300 flex-1">{service.name}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={service.price === 0 ? '' : service.price}
                    onChange={e => handlePriceInput(service.id, e.target.value)}
                    placeholder="Pris"
                    className="w-24 px-3 py-1.5 bg-slate-900/60 border border-slate-600 rounded-lg text-white text-sm text-right placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent tabular-nums"
                  />
                  <span className="text-xs text-slate-500">kr</span>
                </div>
              </div>
            ))}
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
              <div className="mt-2 p-3 bg-slate-800/50 border border-slate-600 rounded-xl space-y-3">
                {usedArticles.length === 0 ? (
                  <p className="text-xs text-amber-400">
                    Lägg först till artiklar ovan - Prisguiden bygger på artikelkostnaden.
                  </p>
                ) : (
                  <>
                    {/* Steg 1: koppla artiklar till tjänst */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                        <p className="text-xs font-semibold text-white">1. Koppla artiklarna till rätt tjänst</p>
                      </div>
                      <p className="text-[11px] text-slate-500 mb-2">
                        Kopplingen styr både prisförslaget och marginalen per tjänst - och följer med i ärenderapporten.
                      </p>
                      <div className="space-y-1.5">
                        {articles.map((article, i) => article.qty > 0 && (
                          <div key={article.name} className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-slate-300 w-32 truncate">
                              {article.qty} × {article.name}
                            </span>
                            <div className="flex gap-1">
                              {services.map(service => (
                                <button
                                  key={service.id}
                                  onClick={() => assignArticle(i, service.id)}
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                                    article.assignedTo === service.id
                                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {service.id === 'sanering' ? 'Sanering' : 'Tätning'}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      {unassignedCount > 0 && (
                        <p className="text-[11px] text-amber-400 mt-1.5">
                          {unassignedCount} {unassignedCount === 1 ? 'artikel är inte kopplad' : 'artiklar är inte kopplade'} -
                          okopplade artiklar räknas inte in i något prisförslag.
                        </p>
                      )}
                    </div>

                    {/* Steg 2: påslag + förslag per tjänst */}
                    <div className="pt-2 border-t border-slate-700/50">
                      <p className="text-xs font-semibold text-white mb-1.5">2. Prisförslag via påslag</p>
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
                      <div className="space-y-1.5 mt-1">
                        {services.map(service => {
                          const serviceCost = costFor(service.id)
                          return (
                            <div key={service.id} className="flex items-center justify-between gap-3">
                              <p className="text-xs text-slate-400 flex-1 truncate">
                                {service.name}: {serviceCost.toLocaleString('sv-SE')} kr × {markup.toFixed(1)} ={' '}
                                <span className="text-white font-semibold">{suggestedFor(service.id).toLocaleString('sv-SE')} kr</span>
                              </p>
                              <button
                                onClick={() => applySuggestion(service.id)}
                                disabled={serviceCost === 0}
                                className="px-3 py-1.5 bg-[#20c58f] hover:bg-[#1ab37e] disabled:opacity-40 text-[#fff] rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                              >
                                Använd
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Tips om manuell justering efter Prisguiden */}
          {appliedAny && !manualAfter && (
            <p className="mt-2 text-xs text-cyan-400">
              Tips: Prisguidens förslag är en startpunkt. Klicka i ett prisfält och knappa in ett eget
              pris - t.ex. avrunda uppåt, eller justera i undantagsfall där förslaget inte passar.
            </p>
          )}
        </div>

        {/* Marginalindikator */}
        <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${mc.bg}`}>
          <div>
            <p className={`text-sm font-semibold ${mc.text}`}>
              {totalPrice > 0 ? `${marginPct.toFixed(1)}% marginal - ${mc.label}` : 'Marginal visas när priserna är satta'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Pris {totalPrice.toLocaleString('sv-SE')} kr − kostnad {totalCost.toLocaleString('sv-SE')} kr ={' '}
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
                Artiklar in → koppla till rätt tjänst → Prisguiden föreslår → du finjusterar manuellt →
                marginalen visar att priset håller. Exakt så jobbar du i riktiga ärenden.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
