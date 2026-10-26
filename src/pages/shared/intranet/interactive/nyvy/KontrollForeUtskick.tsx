// src/pages/shared/intranet/interactive/nyvy/KontrollForeUtskick.tsx
// Interaktiv del i guiden Skapa och skicka en offert eller ett avtal (tekniker): prova
// rutan Kontroll före utskick i wizarden. Punkterna räknas med samma funktion som portalen,
// kontrolleraAvtal och harStopp i src/shared/avtalsKontroll.ts: röd punkt stoppar knappen
// Skapa och visa Oneflows PDF, gul punkt är en varning, grön punkt är klar.
// Avsnittsnamnen i länkarna (Rätta under / Fyll i under) är samma som i OneflowContractCreator.

import { useMemo, useState } from 'react'
import { harStopp, kontrolleraAvtal, type KontrollAvsnitt } from '../../../../../shared/avtalsKontroll'

const FARG = { rod: 'bg-red-500', gul: 'bg-amber-500', gron: 'bg-[#20c58f]' }

function Text({ etikett, varde, onChange, placeholder }: { etikett: string; varde: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-slate-300">{etikett}</span>
      <input value={varde} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="min-h-[44px] rounded-lg border border-slate-600 bg-slate-800 px-3 text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]" />
    </label>
  )
}

function Val<T extends string>({ etikett, val, valt, onVal }: { etikett: string; val: [T, string][]; valt: T; onVal: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={etikett} className="flex flex-wrap gap-2">
      {val.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={valt === v} onClick={() => onVal(v)}
          className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${valt === v ? 'bg-[#20c58f] text-[#fff]' : 'border border-slate-600 text-slate-300 hover:bg-slate-800'}`}>
          {text}
        </button>
      ))}
    </div>
  )
}

export default function KontrollForeUtskick() {
  const [typ, setTyp] = useState<'offer' | 'contract'>('offer')
  const [part, setPart] = useState<'individual' | 'company'>('individual')
  const [foretag, setForetag] = useState('Exempel AB')
  const [namn, setNamn] = useState('Familjen Exempel')
  const [epost, setEpost] = useState('familjen@exempel')
  const [telefon, setTelefon] = useState('')
  const [id, setId] = useState('')
  const [faktura, setFaktura] = useState('')
  const [langd, setLangd] = useState('1 år')
  const [start, setStart] = useState('2026-11-01')
  const [tjanster, setTjanster] = useState<'0' | '1' | '2'>('1')
  const [text, setText] = useState('')

  const avtal = typ === 'contract'
  const foretagPart = part === 'company'
  const punkter = useMemo(() => kontrolleraAvtal({
    dokumentTyp: typ, partTyp: part, foretag, orgNr: id, kontaktperson: namn, epost, telefon,
    epostFaktura: faktura, avtalslangd: langd, startdatum: start, avtalsobjekt: text, antalTjanster: Number(tjanster),
  }), [typ, part, foretag, id, namn, epost, telefon, faktura, langd, start, text, tjanster])
  const stopp = harStopp(punkter)
  const avsnitt: Record<KontrollAvsnitt, string> = { motpart: 'Motpart', avtalstid: 'BeGone', avtalsobjekt: avtal ? 'Avtalsobjekt' : 'Offertinnehåll', tjanster: 'Tjänster' }

  return (
    <div className="my-5 grid gap-4 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <div>
        <p className="text-sm font-semibold text-white">Prova Kontroll före utskick</p>
        <p className="text-sm text-slate-400">Ändra uppgifterna och se punkterna ändras, precis som i granskningen. E-postadressen saknar något från början. Rätta den.</p>
      </div>
      <div className="grid gap-3">
        <Val etikett="Dokument" valt={typ} onVal={setTyp} val={[['offer', 'Offert'], ['contract', 'Avtalsförslag']]} />
        <Val etikett="Avtalspart" valt={part} onVal={setPart} val={[['individual', 'Privatperson'], ['company', 'Företag']]} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {foretagPart && <Text etikett="Företagsnamn" varde={foretag} onChange={setForetag} placeholder="Företaget AB" />}
        <Text etikett={foretagPart ? 'Kontaktperson' : 'Namn'} varde={namn} onChange={setNamn} placeholder="Förnamn Efternamn" />
        <Text etikett="E-post" varde={epost} onChange={setEpost} placeholder="namn@exempel.se" />
        <Text etikett="Telefon" varde={telefon} onChange={setTelefon} placeholder="070-123 45 67" />
        <Text etikett={foretagPart ? 'Org.nr' : 'Personnummer'} varde={id} onChange={setId} placeholder={foretagPart ? '556123-4567' : 'ÅÅÅÅMMDD-XXXX'} />
        <Text etikett="E-post för faktura" varde={faktura} onChange={setFaktura} placeholder="namn@exempel.se" />
        {avtal && <Text etikett="Avtalslängd" varde={langd} onChange={setLangd} placeholder="1 år" />}
        {avtal && <Text etikett="Startdatum" varde={start} onChange={setStart} placeholder="ÅÅÅÅ-MM-DD" />}
      </div>
      <div className="grid gap-1">
        <span className="text-sm text-slate-300">Antal tjänster</span>
        <Val etikett="Antal tjänster" valt={tjanster} onVal={setTjanster} val={[['0', 'Inga'], ['1', '1'], ['2', '2']]} />
      </div>
      <label className="grid gap-1">
        <span className="text-sm text-slate-300">{avtal ? 'Avtalsobjekt' : 'Offertinnehåll'}</span>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Tjänster som ingår: ..."
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]" />
      </label>

      <div className="grid gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3" aria-live="polite">
        <p className="text-base font-bold text-white">Kontroll före utskick</p>
        <ul className="grid gap-2 text-sm">
          {punkter.map((p, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className={`mt-[6px] h-2 w-2 flex-none rounded-full ${FARG[p.niva]}`} />
              <span className="min-w-0">
                <span className="block break-words text-white">{p.text}</span>
                {p.niva !== 'gron' && <span className="text-sm font-semibold text-emerald-400">{p.niva === 'rod' ? 'Rätta' : 'Fyll i'} under {avsnitt[p.avsnitt]}</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t border-slate-700/60 pt-2 text-sm text-slate-400">Röd punkt stoppar. Rätta först, sedan går det vidare.</p>
        <button type="button" aria-disabled={stopp}
          className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold ${stopp ? 'cursor-not-allowed bg-slate-700 text-slate-400' : 'bg-[#20c58f] text-[#fff]'}`}>
          Skapa och visa Oneflows PDF
        </button>
        <p className="text-sm text-slate-400">{stopp ? 'Knappen går inte att trycka på så länge en punkt är röd.' : `Klart att skapa. ${avtal ? 'Avtalet' : 'Offerten'} skapas som utkast i Oneflow. Inget skickas till kunden förrän du godkänt PDF:en.`}</p>
      </div>
      <p className="text-xs text-slate-500">Exempel, inget skickas. I Skapa avtal eller offert tar länkarna under punkterna dig till rätt steg och tillbaka till granskningen.</p>
    </div>
  )
}
