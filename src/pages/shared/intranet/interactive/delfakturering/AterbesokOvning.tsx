// src/pages/shared/intranet/interactive/delfakturering/AterbesokOvning.tsx
// Återbesöksguiden (och delfaktureringsguiden): klickbar efterbildning av hur ett
// återbesök bokas i ett privat- eller företagsärende. Fotspåren i ärendets
// sidhuvud, Vad vill du göra?, steg 1 (datum, längd, tekniker), steg 2 (förslag,
// anteckning, Skapa delfaktura) och vad som händer efteråt. Etiketterna är
// desamma som i EditCaseModal och RevisitModal. Ingenting sparas.

import { useState } from 'react'
import { Footprints } from 'lucide-react'
import { Icon } from '../../../../../components/icons/Icon'
import { Aterkoppling, ETIKETT, Knapp, Ram, SEKTION } from '../leads/leadsShared'

type Lage = 'arende' | 'val' | 'steg1' | 'steg2' | 'klart'

const RADER = [
  { namn: 'Råttbekämpning, första besöket', belopp: 1800 },
  { namn: 'Tätning av ventil', belopp: 950 },
]
const SUMMA = RADER.reduce((s, r) => s + r.belopp, 0)

const FORSLAG = [
  { id: 'f1', tid: 'tis 2026-10-20 kl. 08:00-09:00', info: 'Anna Exempel' },
  { id: 'f2', tid: 'tis 2026-10-20 kl. 13:30-14:30', info: 'Anna Exempel' },
  { id: 'f3', tid: 'ons 2026-10-21 kl. 10:00-11:00', info: 'Anna Exempel' },
]

const kr = (n: number) => `${n.toLocaleString('sv-SE')} kr`

export default function AterbesokOvning() {
  const [lage, setLage] = useState<Lage>('arende')
  const [fel, setFel] = useState<string | null>(null)
  const [datum, setDatum] = useState(false)
  const [tid, setTid] = useState<string | null>(null)
  const [delfaktura, setDelfaktura] = useState(false)

  const borjaOm = () => {
    setLage('arende')
    setFel(null)
    setDatum(false)
    setTid(null)
    setDelfaktura(false)
  }

  return (
    <Ram where="Ärende · Råttor i källaren, Familjen Exempel" caption="Påhittade tider och priser.">
      <p className="mb-3 text-sm text-slate-300">
        <span className="font-semibold text-white">Uppdrag:</span> första besöket är gjort. Boka ett återbesök och delfakturera det som är gjort hittills.
      </p>

      {lage === 'arende' && (
        <div className={SEKTION}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-sm font-semibold text-white">BE-0001234</p>
              <p className="text-xs text-slate-400">Familjen Exempel · Råttor</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => { setFel(null); setLage('val') }}
                className="rounded-lg p-2 text-slate-300 ring-2 ring-[#20c58f]/60 hover:bg-slate-700 hover:text-white focus:outline-none focus-visible:ring-[#20c58f]"
                title="Boka återbesök eller skapa nytt ärende"
                aria-label="Boka återbesök eller skapa nytt ärende"
              >
                <Footprints className="h-5 w-5" />
              </button>
              <span className="rounded-lg p-2 text-slate-500" title="Ärendehistorik"><Icon name="allman.historik" size={20} /></span>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">Tryck på fotspåren uppe till höger i ärendet.</p>
        </div>
      )}

      {lage === 'val' && (
        <div className={SEKTION}>
          <p className="mb-2 text-sm font-semibold text-white">Vad vill du göra?</p>
          {[
            { id: 'aterbesok', titel: 'Boka återbesök', text: 'Flytta ärendet till ett framtida datum för uppföljning av skadedjursstatus' },
            { id: 'nytt', titel: 'Skapa nytt ärende', text: 'Nytt problem hos samma kund (annat skadedjur)' },
            { id: 'duplicera', titel: 'Duplicera ärende', text: 'Skapa en kopia och välj vad som följer med' },
          ].map(v => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                if (v.id === 'aterbesok') { setFel(null); setLage('steg1') }
                else setFel(v.id === 'nytt'
                  ? 'Skapa nytt ärende är för ett nytt problem, till exempel getingar hos en kund vi redan har för råttor. Ett återbesök i samma problem bokas i samma ärende.'
                  : 'Duplicera gör en kopia av ärendet. Det blir två ärenden och besöken hänger inte ihop.')
              }}
              className="mb-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/40 p-3 text-left hover:bg-slate-700/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
            >
              <p className="text-sm font-medium text-white">{v.titel}</p>
              <p className="text-xs text-slate-400">{v.text}</p>
            </button>
          ))}
          {fel && <div className="mt-2"><Aterkoppling ok={false} titel="Inte det här valet">{fel}</Aterkoppling></div>}
        </div>
      )}

      {lage === 'steg1' && (
        <div className={`${SEKTION} space-y-3`}>
          <p className="text-sm font-semibold text-white">Boka återbesök <span className="font-normal text-slate-400">· Välj datum och längd</span></p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className={ETIKETT}>Datum för återbesök *</span>
              <button
                type="button"
                onClick={() => setDatum(true)}
                className={`w-full rounded-lg border px-3 py-1.5 text-left text-sm ${datum ? 'border-slate-700 bg-slate-900/50 text-white' : 'border-[#20c58f]/60 bg-slate-900/50 text-slate-500'}`}
              >
                {datum ? '2026-10-20' : 'Välj datum'}
              </button>
            </div>
            <div>
              <span className={ETIKETT}>Besökslängd</span>
              <p className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-sm text-white">1 timme</p>
            </div>
          </div>
          <div>
            <span className={ETIKETT}>Tekniker för återbesök</span>
            <p className="flex items-center gap-2 text-sm text-slate-200">
              <Icon name="allman.bock" className="text-[#20c58f]" />
              Anna Exempel
            </p>
            <p className="mt-1 text-xs text-slate-500">Visar tider där alla valda tekniker är lediga samtidigt.</p>
          </div>
          <div className="flex justify-end">
            <Knapp primar disabled={!datum} onClick={() => setLage('steg2')}>Visa förslag →</Knapp>
          </div>
          {!datum && <p className="text-xs text-slate-500">Tryck på Välj datum först.</p>}
        </div>
      )}

      {lage === 'steg2' && (
        <div className={`${SEKTION} space-y-3`}>
          <p className="text-sm font-semibold text-white">Boka återbesök <span className="font-normal text-slate-400">· Förslag från 2026-10-20</span></p>
          <div className="space-y-1.5">
            {FORSLAG.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTid(f.id)}
                aria-pressed={tid === f.id}
                className={`w-full rounded-lg border px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${tid === f.id ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700 bg-slate-800/40 hover:bg-slate-700/40'}`}
              >
                <p className="text-sm text-white">{f.tid}</p>
                <p className="text-xs text-slate-400">{f.info}</p>
              </button>
            ))}
            <p className="text-xs text-slate-500">Passar ingen tid finns Ange tid manuellt.</p>
          </div>

          <div>
            <span className={ETIKETT}>Anteckning (valfritt)</span>
            <p className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-sm text-slate-500">T.ex. kontrollera betesintag</p>
          </div>

          <div className={`rounded-lg border p-3 ${delfaktura ? 'border-slate-700/50 bg-slate-800/50' : 'border-[#20c58f]/50 bg-slate-800/50'}`}>
            <label className="flex cursor-pointer select-none items-center gap-2.5">
              <input
                type="checkbox"
                checked={delfaktura}
                onChange={e => setDelfaktura(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f]"
              />
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                <Icon name="sok.faktura" className="text-[#20c58f]" />
                Skapa delfaktura för nuvarande tjänster
              </span>
            </label>
            {delfaktura && (
              <div className="ml-6 mt-2 space-y-1">
                {RADER.map(r => (
                  <div key={r.namn} className="flex items-center justify-between text-xs text-slate-400">
                    <span>{r.namn}</span>
                    <span className="font-medium text-white">{kr(r.belopp)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-slate-700/50 pt-1 text-xs">
                  <span className="text-slate-400">Totalt (exkl. moms)</span>
                  <span className="font-semibold text-[#20c58f]">{kr(SUMMA)}</span>
                </div>
                <p className="mt-1 text-xs text-amber-400/80">Tjänsterna markeras som fakturerade och tas bort från ärendet.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Knapp primar disabled={!tid} onClick={() => setLage('klart')}>
              <Icon name="allman.kalender" />
              Boka återbesök
            </Knapp>
          </div>
          {!tid && <p className="text-xs text-slate-500">Välj en av tiderna först.</p>}
        </div>
      )}

      {lage === 'klart' && (
        <div className="space-y-2">
          <div className={SEKTION}>
            <p className="mb-2 text-sm font-semibold text-white">Det här hände</p>
            <ul className="space-y-1.5 text-sm text-slate-300">
              <li className="flex gap-2"><Icon name="allman.bock" className="mt-0.5 flex-none text-[#20c58f]" />Det gjorda besöket sparades i ärendets besökshistorik.</li>
              <li className="flex gap-2"><Icon name="allman.bock" className="mt-0.5 flex-none text-[#20c58f]" />Ärendet fick den nya tiden och status Återbesök. Det är samma ärende som förut.</li>
              {delfaktura ? (
                <li className="flex gap-2"><Icon name="allman.bock" className="mt-0.5 flex-none text-[#20c58f]" />En delfaktura på {kr(SUMMA)} exkl. moms skapades och väntar under Fakturering › Privat &amp; Företag. Raderna försvann från ärendet, så nästa besök börjar från noll.</li>
              ) : (
                <li className="flex gap-2"><Icon name="allman.chevron" className="mt-0.5 flex-none text-slate-500" />Ingen delfaktura. Raderna på {kr(SUMMA)} ligger kvar på ärendet och följer med nästa delfaktura eller slutfakturan.</li>
              )}
            </ul>
          </div>
          {delfaktura ? (
            <Aterkoppling ok titel="Klart, återbesöket är bokat och delfakturan skapad">
              I portalen står det Återbesök bokat och delfaktura med fakturanumret. Delfakturan syns också i ärendehistoriken.
            </Aterkoppling>
          ) : (
            <Aterkoppling ok={false} titel="Återbesöket är bokat, men inget fakturerades">
              Det är helt rätt om kunden ska få en samlad faktura senare. I uppdraget skulle du delfakturera, så börja om och kryssa i Skapa delfaktura.
            </Aterkoppling>
          )}
          <Knapp onClick={borjaOm}>
            <Icon name="allman.aterstall" />
            Börja om
          </Knapp>
        </div>
      )}
    </Ram>
  )
}
