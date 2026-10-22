// src/components/technician/ny/steg/KlartSteg.tsx
// Steget Klart i nya arbetsvyn (skissen StegKlart.dc.html).
//
// Två val: Hela ärendet (stängs, får status Avslutat) eller Bara besöket
// (ärendet fortsätter med ett återbesök i värdens befintliga återbesöksdialog,
// där delfakturering är en kryssruta som i dag). Värden kan byta det andra
// valet mot ett eget med baraBesoket (till exempel Lägg till delbesök i
// rondering). Utan onBaraBesoket och baraBesoket visas bara Hela ärendet.
//
// Steget har ingen egen sparlogik. Flödet för Hela ärendet:
//   1. onSparaUtanAttStanga() sparar formuläret som det är (värdens vanliga
//      spara, utan statusbyte). Hoppas över när harOsparat() säger att inget är ändrat.
//   2. kontroll() körs (kontrolleraAvslut i arendeAvslutService.ts). Hinder
//      visas med Gå till steget och rapporteras till stegraden via onHinderChange.
//   3. Inga hinder: onStangHelaArendet() sätter status Avslutat och kör värdens
//      vanliga spara, som själv kör modalens spärrar, besökspost, fakturering och provision.
//
// Användning:
//   <KlartSteg
//     aktiv={aktivt === 'klart'}
//     steg={steg}
//     kontroll={() => kontrolleraAvslut({ caseId, kalla: 'cases', serviceType })}
//     onGaTillSteg={(steg, hinder) => setAktivt(steg)}
//     onSparaUtanAttStanga={async () => { await handleSubmit(); return sparatOkRef.current }}
//     harOsparat={() => harOsparat()}
//     onStangHelaArendet={stangHelaArendet}
//     onBaraBesoket={() => setShowRevisitModal(true)}
//     status={formData.status}
//     arAvslutat={formData.status === 'Avslutat'}
//     vadHander={['Ärendet får status Avslutat och avslutsdatum.', ...]}
//     onHinderChange={setHinderSteg}
//   />

import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '../../../icons/Icon'
import { HjalpText } from '../hjalp/HjalpText'
import type { AvslutsHinder } from '../../../../services/arendeAvslutService'
import type { StegDef, StegId } from './stegKonfig'

export interface KlartStegProps {
  /** Steget visas. När det blir aktivt körs kontrollen mot det som är sparat. */
  aktiv: boolean
  /** Ärendets steg, för namnen i Gå till steget */
  steg: StegDef[]
  kontroll: () => Promise<AvslutsHinder[]>
  /** Hindret skickas med så att värden kan välja annan väg (till exempel Alla uppgifter) */
  onGaTillSteg: (steg: StegId, hinder?: AvslutsHinder) => void
  /** Egen text på hindrets knapp, till exempel när värden visar det i en annan vy. Utelämnad: Gå till steget X. */
  gaTillText?: (hinder: AvslutsHinder) => string | undefined
  /** Hela ärendet: status Avslutat och värdens vanliga spara. true = stängt. */
  onStangHelaArendet: () => Promise<boolean>
  /** Bara besöket: öppnar värdens återbesöksdialog. Utelämnad: valet visas inte. */
  onBaraBesoket?: () => void
  /**
   * Eget andra val i stället för Bara besöket (går före onBaraBesoket).
   * rubrik och text visas i valet, knappText och ikon på knappen, vadHander som punktlista.
   */
  baraBesoket?: {
    rubrik: string
    text: string
    knappText: string
    ikon?: IconName
    vadHander?: string[]
    onClick: () => void
  }
  /** Värdens vanliga spara utan statusbyte. true = sparat. */
  onSparaUtanAttStanga: () => Promise<boolean>
  /** Finns osparade ändringar? Utelämnad: formuläret sparas alltid före kontrollen. */
  harOsparat?: () => boolean
  status: string
  arAvslutat: boolean
  /** Avslutsdatum att visa när ärendet är avslutat */
  avslutsdatum?: string | null
  /** Vad som händer när ärendet stängs, en mening per punkt */
  vadHander: string[]
  /** Vad som händer när bara besöket klarmarkeras */
  vadHanderBesok?: string[]
  /** Ärendet stängs i ett annat steg (stationskontrollen klarmarkeras i Arbetet) */
  helaArendetViaSteg?: { steg: StegId; text: string }
  /** Stegen som har hinder, för orange ram i stegraden */
  onHinderChange?: (steg: StegId[]) => void
  /** Stängning inte tillåten (till exempel kundvyn) */
  lasHelaArendet?: boolean
}

type Fas = 'vilar' | 'sparar' | 'kontrollerar' | 'stanger'

const FAS_TEXT: Record<Fas, string> = {
  vilar: '',
  sparar: 'Sparar ärendet...',
  kontrollerar: 'Kontrollerar ärendet...',
  stanger: 'Stänger ärendet...',
}

function formateraDatum(varde: string | null | undefined): string | null {
  if (!varde) return null
  const d = new Date(varde)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function KlartSteg({
  aktiv,
  steg,
  kontroll,
  onGaTillSteg,
  gaTillText,
  onStangHelaArendet,
  onBaraBesoket,
  baraBesoket,
  onSparaUtanAttStanga,
  harOsparat,
  status,
  arAvslutat,
  avslutsdatum,
  vadHander,
  vadHanderBesok,
  helaArendetViaSteg,
  onHinderChange,
  lasHelaArendet = false,
}: KlartStegProps) {
  const [fas, setFas] = useState<Fas>('vilar')
  const [hinder, setHinder] = useState<AvslutsHinder[] | null>(null)
  const [kontrollFel, setKontrollFel] = useState<string | null>(null)
  const [val, setVal] = useState<'hela' | 'besok'>('hela')

  // Det andra valet: värdens eget (baraBesoket) eller Bara besöket med återbesök
  const andraVal = baraBesoket
    ? {
        rubrik: baraBesoket.rubrik,
        text: baraBesoket.text,
        knappText: baraBesoket.knappText,
        ikon: baraBesoket.ikon ?? ('allman.plus' as IconName),
        vadHander: baraBesoket.vadHander,
        vadHanderRubrik: 'Det här händer',
        onClick: baraBesoket.onClick,
      }
    : onBaraBesoket
      ? {
          rubrik: 'Bara besöket',
          text: 'Ärendet fortsätter med ett återbesök. Det stängs inte.',
          knappText: 'Boka återbesök',
          ikon: 'arende.aterbesok' as IconName,
          vadHander: vadHanderBesok,
          vadHanderRubrik: 'Det här händer när du bokar återbesöket',
          onClick: onBaraBesoket,
        }
      : null
  const valHjalp = baraBesoket
    ? `Hela ärendet stänger ärendet. ${baraBesoket.rubrik} låter ärendet fortsätta utan att stängas.`
    : onBaraBesoket
      ? 'Hela ärendet stänger ärendet. Bara besöket låter ärendet fortsätta med ett återbesök.'
      : 'Hela ärendet stänger ärendet. Här finns inget återbesök, så ärendet står kvar öppet tills du stänger det.'

  // Refs så att inline-funktioner från värden inte startar om effekten varje rendering
  const kontrollRef = useRef(kontroll)
  kontrollRef.current = kontroll
  const onHinderRef = useRef(onHinderChange)
  onHinderRef.current = onHinderChange

  const korKontroll = useCallback(async (): Promise<AvslutsHinder[] | null> => {
    setKontrollFel(null)
    try {
      const resultat = await kontrollRef.current()
      setHinder(resultat)
      onHinderRef.current?.(Array.from(new Set(resultat.map(h => h.steg))))
      return resultat
    } catch (err) {
      console.error('Avslutskontrollen misslyckades:', err)
      setKontrollFel('Kontrollen kunde inte köras. Försök igen.')
      return null
    }
  }, [])

  // Förhandskontroll mot det som är sparat, varje gång steget öppnas
  useEffect(() => {
    if (!aktiv || arAvslutat) return
    ;(async () => {
      setFas('kontrollerar')
      try {
        await korKontroll()
      } finally {
        setFas('vilar')
      }
    })()
  }, [aktiv, arAvslutat, korKontroll])

  // Avslutat ärende har inga hinder kvar i stegraden
  useEffect(() => {
    if (arAvslutat) onHinderRef.current?.([])
  }, [arAvslutat])

  const upptagen = fas !== 'vilar'

  const stangHela = async () => {
    if (upptagen) return
    try {
      // 1. Spara formuläret först, så att kontrollen ser det som är ifyllt
      if (!harOsparat || harOsparat()) {
        setFas('sparar')
        const sparat = await onSparaUtanAttStanga()
        if (!sparat) return
      }
      // 2. Kontrollera
      setFas('kontrollerar')
      const resultat = await korKontroll()
      if (!resultat || resultat.length > 0) return
      // 3. Stäng med värdens vanliga spara
      setFas('stanger')
      const stangt = await onStangHelaArendet()
      if (stangt) onHinderRef.current?.([])
    } finally {
      setFas('vilar')
    }
  }

  const sparaBara = async () => {
    if (upptagen) return
    setFas('sparar')
    try {
      await onSparaUtanAttStanga()
    } finally {
      setFas('vilar')
    }
  }

  const stegNamn = (id: StegId) => steg.find(s => s.id === id)?.namn ?? null

  // ── Avslutat ärende ──
  if (arAvslutat) {
    const datum = formateraDatum(avslutsdatum)
    return (
      <div className="flex flex-col gap-3">
        <div className="p-4 rounded-2xl border border-[#20c58f]/40 bg-[#20c58f]/10 flex items-start gap-3">
          <Icon name="falt.klart" size={24} className="text-[#20c58f] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-white">Ärendet är avslutat</p>
            <p className="text-sm text-slate-300">
              Status {status}{datum ? `, avslutsdatum ${datum}` : ''}. Ändringar du gör nu sparar du med knappen nedan.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={sparaBara}
          disabled={upptagen}
          className="min-h-[48px] px-4 rounded-xl border border-slate-600 bg-slate-800/60 text-white text-[15px] font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {fas === 'sparar' ? FAS_TEXT.sparar : 'Spara ändringar'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Kontrollen */}
      <section className="flex flex-col gap-2">
        <HjalpText id="klart-kontroll" rubrik="Kontrollera innan du stänger">
          Samma kontroller som när ärendet sparas med status Avslutat. Listan bygger på det som är sparat; ändrar du något sparas det först när du stänger.
        </HjalpText>
        {fas === 'kontrollerar' && (
          <p className="text-sm text-slate-400 flex items-center gap-2">
            <Icon name="allman.laddar" size={16} className="animate-spin" />
            {FAS_TEXT.kontrollerar}
          </p>
        )}
        {kontrollFel && <p className="text-sm text-red-400">{kontrollFel}</p>}
        {hinder && hinder.length === 0 && fas !== 'kontrollerar' && !kontrollFel && (
          <p className="text-sm text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#20c58f] flex-shrink-0" aria-hidden="true" />
            Inget saknas enligt det som är sparat.
          </p>
        )}
        {hinder && hinder.length > 0 && (
          <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-3 flex flex-col gap-3">
            <p className="text-[15px] font-semibold text-amber-200">
              {hinder.length === 1 ? '1 sak saknas' : `${hinder.length} saker saknas`} innan ärendet kan stängas.
            </p>
            <ul className="list-none m-0 p-0 flex flex-col gap-3">
              {hinder.map(h => {
                const namn = stegNamn(h.steg)
                return (
                  <li key={h.id} className="flex flex-col gap-2">
                    <p className="text-sm text-slate-200 leading-relaxed">{h.text}</p>
                    <button
                      type="button"
                      onClick={() => onGaTillSteg(h.steg, h)}
                      className="self-start min-h-[44px] px-3.5 rounded-xl border border-amber-500 text-amber-200 text-sm font-semibold flex items-center gap-1.5 hover:bg-amber-500/10 transition-colors"
                    >
                      {gaTillText?.(h) ?? (namn ? `Gå till steget ${namn}` : 'Visa i Alla uppgifter')}
                      <Icon name="allman.chevron" size={16} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>

      {/* Vad är klart? */}
      <section className="flex flex-col gap-2">
        <HjalpText id="klart-val" rubrik="Vad är klart?">
          {valHjalp}
        </HjalpText>
        <div role="radiogroup" aria-label="Vad är klart?" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {([
            { id: 'hela' as const, rubrik: 'Hela ärendet', text: 'Ärendet avslutas, får avslutsdatum och stängs för fakturering.' },
            ...(andraVal ? [{ id: 'besok' as const, rubrik: andraVal.rubrik, text: andraVal.text }] : []),
          ]).map(alt => (
            <button
              key={alt.id}
              type="button"
              role="radio"
              aria-checked={val === alt.id}
              onClick={() => setVal(alt.id)}
              className={`min-h-[64px] p-3 rounded-2xl text-left transition-colors ${
                val === alt.id ? 'border-2 border-[#20c58f] bg-[#20c58f]/10' : 'border border-slate-600 bg-slate-800/40 hover:border-slate-400'
              }`}
            >
              <span className="block text-[15px] font-semibold text-white">{alt.rubrik}</span>
              <span className="block text-sm text-slate-400 mt-0.5">{alt.text}</span>
            </button>
          ))}
        </div>
      </section>

      {val === 'hela' || !andraVal ? (
        <section className="flex flex-col gap-3">
          {helaArendetViaSteg ? (
            <>
              <p className="text-sm text-slate-300 leading-relaxed">{helaArendetViaSteg.text}</p>
              <button
                type="button"
                onClick={() => onGaTillSteg(helaArendetViaSteg.steg)}
                className="min-h-[56px] rounded-2xl bg-[#20c58f] text-[#04281c] text-base font-bold flex items-center justify-center gap-2 hover:bg-[#1bb07f] transition-colors"
              >
                Gå till steget {stegNamn(helaArendetViaSteg.steg) ?? helaArendetViaSteg.steg}
                <Icon name="allman.chevron" size={20} />
              </button>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-3">
                <p className="text-sm font-semibold text-white mb-1.5">Det här händer när du stänger</p>
                <ul className="list-disc pl-5 m-0 flex flex-col gap-1 text-sm text-slate-300 leading-relaxed">
                  {vadHander.map(t => <li key={t}>{t}</li>)}
                </ul>
              </div>
              <button
                type="button"
                onClick={stangHela}
                disabled={upptagen || lasHelaArendet}
                className="min-h-[56px] rounded-2xl bg-[#20c58f] text-[#04281c] text-base font-bold flex items-center justify-center gap-2 hover:bg-[#1bb07f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {upptagen && <Icon name="allman.laddar" size={20} className="animate-spin" />}
                {upptagen ? FAS_TEXT[fas] : 'Stäng hela ärendet'}
              </button>
            </>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          {andraVal.vadHander && andraVal.vadHander.length > 0 && (
            <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-3">
              <p className="text-sm font-semibold text-white mb-1.5">{andraVal.vadHanderRubrik}</p>
              <ul className="list-disc pl-5 m-0 flex flex-col gap-1 text-sm text-slate-300 leading-relaxed">
                {andraVal.vadHander.map(t => <li key={t}>{t}</li>)}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={() => andraVal.onClick()}
            disabled={upptagen}
            className="min-h-[56px] rounded-2xl bg-[#20c58f] text-[#04281c] text-base font-bold flex items-center justify-center gap-2 hover:bg-[#1bb07f] disabled:opacity-50 transition-colors"
          >
            <Icon name={andraVal.ikon} size={20} />
            {andraVal.knappText}
          </button>
        </section>
      )}

      <button
        type="button"
        onClick={sparaBara}
        disabled={upptagen}
        className="min-h-[48px] px-4 rounded-xl border border-slate-600 bg-slate-800/60 text-white text-[15px] font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
      >
        Spara utan att stänga
      </button>
    </div>
  )
}

export default KlartSteg
