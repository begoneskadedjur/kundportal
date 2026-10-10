// src/pages/shared/intranet/interactive/leads/SkapaLeadOvning.tsx
// Leadsguiderna: övning i rutan Skapa lead från ett engångsärende. Samma val och texter som
// SkapaLeadModal (GALLER_FORETAG och GALLER_PRIVAT i src/types/leads.ts) och samma regler som
// RPC lead_fran_arende: typ, kundgrupp, källa, ägare och nästa steg härleds av valet och rollen.
// Ingenting sparas. variant 'tekniker' visar att tipset hamnar under Nya tips utan ägare.

import { useState } from 'react'
import { Icon } from '../../../../../components/icons/Icon'
import { GALLER_FORETAG, GALLER_PRIVAT, KUNDGRUPP_ETIKETT, type LeadGaller, type LeadKundgrupp } from '../../../../../types/leads'
import { Aterkoppling, ETIKETT, FALT, Knapp, Ram, Rad, SEKTION } from './leadsShared'
import { lasVariant, segment } from './leadsVariant'

type Arendetyp = 'foretag' | 'privat'

const ARENDEN: Record<Arendetyp, { kund: string; ursprung: string; orgnr: string | null; foljer: string[] }> = {
  foretag: {
    kund: 'Solgläntans Bageri AB',
    ursprung: 'Bagargatan 3, Norrvik · företagsärende BE-0001234',
    orgnr: '559900-0002',
    foljer: ['org.nr', 'telefon', 'e-post', 'adress', 'skadedjur'],
  },
  privat: {
    kund: 'Lena Exempelsson',
    ursprung: 'Exempelvägen 12, Norrvik · privat engångsärende BE-0001235',
    orgnr: null,
    foljer: ['telefon', 'e-post', 'adress', 'skadedjur'],
  },
}

export default function SkapaLeadOvning({ variant }: { variant?: string }) {
  const v = lasVariant(variant)
  const [typ, setTyp] = useState<Arendetyp>('foretag')
  const [dubblett, setDubblett] = useState(false)
  const [galler, setGaller] = useState<LeadGaller | null>(null)
  const [foretag, setForetag] = useState('')
  const [text, setText] = useState('')
  const [forsokt, setForsokt] = useState(false)
  const [resultat, setResultat] = useState<'skapad' | 'anteckning' | null>(null)

  const a = ARENDEN[typ]
  const val = typ === 'foretag' ? GALLER_FORETAG : GALLER_PRIVAT
  const kraverNamn = galler === 'forening' || galler === 'foretag'
  const fel = { galler: !galler, foretag: kraverNamn && !foretag.trim(), text: !text.trim() }

  const nollstall = (t: Arendetyp, d = dubblett) => {
    setTyp(t)
    setDubblett(d)
    setGaller(null)
    setForetag('')
    setText('')
    setForsokt(false)
    setResultat(null)
  }

  const skicka = () => {
    setForsokt(true)
    if (fel.galler || fel.foretag || fel.text) return
    setResultat('skapad')
  }

  const anteckning = () => {
    setForsokt(true)
    if (fel.text) return
    setResultat('anteckning')
  }

  // Samma härledning som lead_fran_arende
  const leadTyp = galler === 'fler_adresser' || galler === 'annan_tjanst' ? 'Utökning' : 'Nytt avtal'
  const kundgrupp: LeadKundgrupp = typ === 'foretag' ? 'foretag' : galler === 'forening' ? 'forening' : galler === 'foretag' ? 'foretag' : 'privat'
  const leadNamn = typ === 'foretag' ? a.kund : kraverNamn ? foretag.trim() : a.kund
  const foljer = [kraverNamn ? 'kontaktperson' : typ === 'foretag' ? 'företag' : 'namn', ...a.foljer].join(', ')

  return (
    <Ram where="Ärende › Skapa lead" caption="Prova båda ärendetyperna och läget med en lead som redan finns.">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex border-b border-slate-700/50" role="tablist" aria-label="Exempelärende">
            <button type="button" role="tab" aria-selected={typ === 'foretag'} className={segment(typ === 'foretag')} onClick={() => nollstall('foretag')}>
              Företagsärende
            </button>
            <button type="button" role="tab" aria-selected={typ === 'privat'} className={segment(typ === 'privat')} onClick={() => nollstall('privat')}>
              Privat engångsärende
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dubblett}
              onChange={(e) => nollstall(typ, e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f] focus:ring-offset-0"
            />
            Det finns redan en lead
          </label>
        </div>

        <div className="max-w-lg mx-auto rounded-xl border border-slate-700 bg-slate-900/60">
          <div className="px-4 py-3 border-b border-slate-700/60">
            <p className="text-sm font-semibold text-white">Skapa lead</p>
            <p className="text-xs text-slate-400">{a.kund}</p>
          </div>

          {resultat ? (
            <div className="p-4 space-y-3">
              {resultat === 'anteckning' ? (
                <Aterkoppling ok titel="Tipset ligger som anteckning på den befintliga leaden">
                  Ingen ny lead skapas. Ägaren ser din text i leadens tidslinje, med ärendet som referens. Du behöver inte själv kunna se leaden.
                </Aterkoppling>
              ) : (
                <>
                  <Aterkoppling ok titel={v === 'tekniker' ? 'Bra. Tipset är skickat.' : 'Bra. Leaden är skapad.'}>
                    I portalen kommer en ruta med en länk till leaden, och ärendet visar därefter Lead skapad · {leadNamn}.
                  </Aterkoppling>
                  <dl className={SEKTION}>
                    <Rad etikett="Företag eller namn">{leadNamn}</Rad>
                    <Rad etikett="Typ">{leadTyp}</Rad>
                    <Rad etikett="Kundgrupp">{KUNDGRUPP_ETIKETT[kundgrupp]}</Rad>
                    <Rad etikett="Källa">{v === 'tekniker' ? 'Teknikertips' : 'Engångsärende'}</Rad>
                    <Rad etikett="Tipsare">Du</Rad>
                    <Rad etikett="Ägare">
                      {v === 'tekniker' ? (
                        <span className="text-amber-300">Ingen än. Tipset hamnar under Nya tips och koordinatorn fördelar det.</span>
                      ) : (
                        'Du'
                      )}
                    </Rad>
                    <Rad etikett="Steg">Ny</Rad>
                    <Rad etikett="Nästa steg">Kontakta kunden om tipset, om två dygn</Rad>
                    <Rad etikett="Följer med">{foljer}, ärendenumret och din text</Rad>
                  </dl>
                  {text.trim().length < 25 && (
                    <Aterkoppling ok={false} titel="Tips: skriv lite mer nästa gång">
                      Den som ringer kunden har bara din text att gå på. Skriv vad du såg, var och vem som frågade.
                    </Aterkoppling>
                  )}
                </>
              )}
              <Knapp onClick={() => nollstall(typ)}>
                <Icon name="allman.aterstall" size={16} /> Prova igen
              </Knapp>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div className={SEKTION}>
                <p className="text-sm text-white font-medium flex items-center gap-1.5">
                  <Icon name={typ === 'foretag' ? 'allman.foretag' : 'arende.privat'} size={16} className="text-[#20c58f]" />
                  {a.kund}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{a.ursprung}</p>
                {dubblett ? (
                  <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-2">
                    <p className="text-xs text-amber-300 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden />
                      Det finns en öppen lead med samma uppgifter. Lägg tipset som anteckning där i stället?
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-slate-200">
                        {typ === 'foretag' ? a.kund : 'Brf Exempelgården'}
                        <span className="text-slate-400"> · Kontaktad · samma {typ === 'foretag' ? 'org.nr' : 'telefon'} · Oskar Exempelsson</span>
                      </span>
                      <Knapp onClick={anteckning}>Lägg anteckning där</Knapp>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-300 mt-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f]" aria-hidden />
                    Ingen öppen lead {a.orgnr ? `på ${a.orgnr}` : 'med samma telefon eller e-post'}
                  </p>
                )}
              </div>

              <fieldset className={`${SEKTION} ${forsokt && fel.galler && !dubblett ? 'border-red-500/50' : ''}`}>
                <legend className="sr-only">Vad gäller det?</legend>
                <p className={ETIKETT}>Vad gäller det? *</p>
                <div className="divide-y divide-slate-700/50">
                  {val.map((o) => (
                    <label key={o.varde} className="flex items-start gap-3 py-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`ovning-galler-${v}`}
                        checked={galler === o.varde}
                        onChange={() => setGaller(o.varde)}
                        className="mt-0.5 h-4 w-4 text-[#20c58f] focus:ring-[#20c58f] bg-slate-900 border-slate-600"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-white">{o.etikett}</span>
                        <span className="block text-xs text-slate-400">{o.hjalp}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {forsokt && fel.galler && !dubblett && <p className="text-xs text-red-400 mt-1">Välj vad det gäller.</p>}
              </fieldset>

              <div className={`${SEKTION} space-y-3`}>
                {kraverNamn && (
                  <div>
                    <label className={ETIKETT} htmlFor={`ovning-foretag-${v}`}>{galler === 'forening' ? 'Förening' : 'Företag'} *</label>
                    <input
                      id={`ovning-foretag-${v}`}
                      className={`${FALT} ${forsokt && fel.foretag ? 'border-red-500/60' : ''}`}
                      value={foretag}
                      onChange={(e) => setForetag(e.target.value)}
                      placeholder={galler === 'forening' ? 'Till exempel Brf Tallbacken' : 'Till exempel Lindqvists Bygg AB'}
                    />
                    {forsokt && fel.foretag && <p className="text-xs text-red-400 mt-1">Skriv namnet, annars vet ingen vem som ska ringas.</p>}
                  </div>
                )}
                <div>
                  <label className={ETIKETT} htmlFor={`ovning-text-${v}`}>Vad såg du? *</label>
                  <textarea
                    id={`ovning-text-${v}`}
                    rows={3}
                    className={`${FALT} ${forsokt && fel.text ? 'border-red-500/60' : ''}`}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={typ === 'foretag' ? 'Till exempel råttor även i lagret, vill ha stationer där också' : 'Till exempel fler lägenheter i huset har möss'}
                  />
                  {forsokt && fel.text && <p className="text-xs text-red-400 mt-1">Skriv en rad om vad du såg.</p>}
                </div>
              </div>

              <div className="text-xs text-slate-400 space-y-0.5 px-1">
                <p className="flex items-center gap-1.5">
                  <Icon name="allman.blixt" size={16} className="text-slate-500" /> Från ärendet följer med: {foljer}.
                </p>
                <p className="flex items-center gap-1.5">
                  <Icon name="lead.tipsare" size={16} className="text-slate-500" /> Du står som tipsare.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
                <Knapp onClick={() => nollstall(typ)}>Avbryt</Knapp>
                <Knapp primar onClick={skicka}>{dubblett ? 'Skapa ny lead ändå' : 'Skicka lead'}</Knapp>
              </div>
            </div>
          )}
        </div>
      </div>
    </Ram>
  )
}
