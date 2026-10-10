// src/components/admin/provisions/TipsbonusPanel.tsx
// Inställningar för tipsbonus för leads (leads etapp 7) på /admin/provisioner, under kugghjulet
// bredvid de övriga provisionsinställningarna. Skriver nycklarna tipsbonus_* i commission_settings.
// Bonusen bokförs av databasen när en lead med tipsare (som inte är ägaren) vinns, och blir klar för
// utbetalning när första fakturan för avtalet eller kunden är betald. Ändringar gäller nya bonusar.

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '../../icons/Icon'
import Button from '../../ui/Button'
import DateField from '../../ui/DateField'
import { ProvisionService } from '../../../services/provisionService'
import type { TipsbonusSettings } from '../../../types/provision'

const FALT =
  'px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent'
const ETIKETT = 'text-xs font-medium text-slate-400 mb-1 block'
const KR = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 })
const NB = String.fromCharCode(160)
const kr = (n: number) => `${KR.format(n)}${NB}kr`

/** Samma regel som databasen: procent av premien, höjt till lägsta och sänkt till taket. */
function beraknaTipsbonus(premie: number, s: Pick<TipsbonusSettings, 'procent' | 'minBelopp' | 'maxBelopp' | 'minPremie'>): number {
  if (premie <= 0 || premie < s.minPremie) return 0
  let b = Math.round(premie * s.procent) / 100
  if (s.minBelopp > 0 && b < s.minBelopp) b = s.minBelopp
  if (s.maxBelopp > 0 && b > s.maxBelopp) b = s.maxBelopp
  return b
}

const EXEMPEL = [10000, 30000, 100000]

export default function TipsbonusPanel({ userEmail }: { userEmail: string }) {
  const [sparat, setSparat] = useState<TipsbonusSettings | null>(null)
  const [form, setForm] = useState<TipsbonusSettings | null>(null)
  const [sparar, setSparar] = useState(false)

  useEffect(() => {
    ProvisionService.getTipsbonusSettings()
      .then((s) => {
        setSparat(s)
        setForm(s)
      })
      .catch(() => toast.error('Tipsbonusens inställningar kunde inte hämtas'))
  }, [])

  const andrad = useMemo(
    () => !!form && !!sparat && (Object.keys(form) as Array<keyof TipsbonusSettings>).some((k) => form[k] !== sparat[k]),
    [form, sparat],
  )

  if (!form || !sparat) {
    return <div className="h-40 bg-slate-800/50 border border-slate-700 rounded-xl animate-pulse" aria-busy="true" />
  }

  const satt = <K extends keyof TipsbonusSettings>(k: K, v: TipsbonusSettings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const tal = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0)
  const fel =
    form.procent <= 0 || form.procent > 100
      ? 'Procentsatsen ska vara mellan 0 och 100.'
      : form.maxBelopp > 0 && form.minBelopp > form.maxBelopp
        ? 'Lägsta belopp kan inte vara högre än taket.'
        : null

  const spara = async () => {
    if (fel) {
      toast.error(fel)
      return
    }
    setSparar(true)
    try {
      await ProvisionService.saveTipsbonusSettings(form, sparat, userEmail)
      setSparat(form)
      toast.success('Tipsbonusen är sparad')
    } catch (e) {
      toast.error(`Kunde inte spara: ${e instanceof Error ? e.message : 'okänt fel'}`)
    } finally {
      setSparar(false)
    }
  }

  return (
    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
            <Icon name="lead.tips" size={16} className="text-slate-400" />
            Tipsbonus för leads
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
            Den som tipsade om en lead får en bonus när leaden blir vunnen. Bonusen bokförs då som en provisionspost och blir klar
            för utbetalning när kundens första faktura är betald. Ägaren av leaden får ingen tipsbonus. Ändringar gäller bonusar som
            bokförs efter att du sparat.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.aktiv}
            onChange={(e) => satt('aktiv', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
          />
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${form.aktiv ? 'bg-[#20c58f]' : 'bg-slate-500'}`} aria-hidden="true" />
            {form.aktiv ? 'På' : 'Av'}
          </span>
        </label>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${form.aktiv ? '' : 'opacity-70'}`}>
        <div>
          <label className={ETIKETT} htmlFor="tb-procent">Procent av första årets premie</label>
          <div className="flex items-center gap-2">
            <input id="tb-procent" type="number" min={0} max={100} step={0.5} value={form.procent} onChange={(e) => satt('procent', tal(e.target.value))} className={`${FALT} w-24`} />
            <span className="text-sm text-slate-400">%</span>
          </div>
        </div>
        <div>
          <label className={ETIKETT} htmlFor="tb-min">Lägsta belopp</label>
          <div className="flex items-center gap-2">
            <input id="tb-min" type="number" min={0} step={100} value={form.minBelopp} onChange={(e) => satt('minBelopp', tal(e.target.value))} className={`${FALT} w-28`} />
            <span className="text-sm text-slate-400">kr</span>
          </div>
        </div>
        <div>
          <label className={ETIKETT} htmlFor="tb-max">Högsta belopp (tak)</label>
          <div className="flex items-center gap-2">
            <input id="tb-max" type="number" min={0} step={500} value={form.maxBelopp} onChange={(e) => satt('maxBelopp', tal(e.target.value))} className={`${FALT} w-28`} />
            <span className="text-sm text-slate-400">kr, 0 = inget tak</span>
          </div>
        </div>
        <div>
          <label className={ETIKETT} htmlFor="tb-minpremie">Lägsta årspremie för bonus</label>
          <div className="flex items-center gap-2">
            <input id="tb-minpremie" type="number" min={0} step={1000} value={form.minPremie} onChange={(e) => satt('minPremie', tal(e.target.value))} className={`${FALT} w-28`} />
            <span className="text-sm text-slate-400">kr</span>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 ${form.aktiv ? '' : 'opacity-70'}`}>
        <fieldset>
          <legend className={ETIKETT}>Vem får bonus</legend>
          <div className="space-y-1.5">
            {[
              { v: false, text: 'Alla som tipsar, utom ägaren' },
              { v: true, text: 'Bara tekniker' },
            ].map((o) => (
              <label key={String(o.v)} className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="tb-vem"
                  checked={form.baraTekniker === o.v}
                  onChange={() => satt('baraTekniker', o.v)}
                  className="w-4 h-4 border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
                />
                {o.text}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <span className={ETIKETT}>Utökning hos befintlig kund</span>
          <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={form.utokning}
              onChange={(e) => satt('utokning', e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
            />
            Ger bonus (annars bara nya avtal)
          </label>
        </div>
        <div>
          <label className={ETIKETT}>Gäller leads vunna från och med</label>
          <DateField value={form.gallerFran} onChange={(v) => satt('gallerFran', v)} className={`${FALT} pl-9 w-40`} aria-label="Gäller från" />
        </div>
      </div>

      <div className="text-xs text-slate-400 space-y-1">
        <p>
          Exempel med inställningarna ovan:{' '}
          {EXEMPEL.map((p, i) => (
            <span key={p}>
              {i > 0 && ', '}
              årspremie {kr(p)} ger <span className="text-slate-200 tabular-nums">{kr(beraknaTipsbonus(p, form))}</span>
            </span>
          ))}
          .
        </p>
        <p>
          Underlaget är avtalets årspremie när leaden är kopplad till ett signerat avtal med årsvärde, annars leadens uppskattade
          årspremie. Bonusen syns på tipsarens provisioner som Tipsbonus: företaget.
        </p>
        {fel && <p className="text-amber-400">{fel}</p>}
      </div>

      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={() => void spara()} disabled={!andrad || sparar || !!fel}>
          {sparar ? 'Sparar...' : 'Spara tipsbonus'}
        </Button>
      </div>
    </div>
  )
}
