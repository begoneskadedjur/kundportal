// src/components/admin/webLeads/WebLeadUppgifter.tsx
// Leads (Webb): uppgifter som koordinatorn fyller i eller rättar under samtalet med kunden,
// personnummer eller org.nr och adressen. Sparas i egna kolumner på förfrågan; kundens originalsvar
// står kvar. Personnumret visas maskerat (ÅÅMMDD-XXXX) tills man klickar på Visa och loggas aldrig.
// Modalstandard: inget Card, sektion p-3 bg-slate-800/30.

import { useEffect, useMemo, useState } from 'react'
import { IdCard, Eye, EyeOff, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '../../ui/Button'
import { WebInquiryService } from '../../../services/webInquiryService'
import type { WebInquiry, WebInquiryKomplettering } from '../../../types/webInquiry'
import {
  adressDelar,
  adressRad,
  effektivtIdNummer,
  maskeraIdNummer,
  tolkaIdNummer,
  type IdNummerTyp,
} from '../../../shared/webLeadUppgifter'
import { formatSvTid } from './format'

interface Props {
  inquiry: WebInquiry
  onSaved: (updated: WebInquiry) => void
  namnFor: (profileId: string | null) => string
}

const FALT = 'w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]'

const TYP_LABEL: Record<IdNummerTyp, string> = { personnummer: 'Personnummer', orgnr: 'Org.nr' }

function bara(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

export default function WebLeadUppgifter({ inquiry, onSaved, namnFor }: Props) {
  const [visa, setVisa] = useState(false)
  const [redigerar, setRedigerar] = useState(false)
  const [sparar, setSparar] = useState(false)
  const [idText, setIdText] = useState('')
  const [gata, setGata] = useState('')
  const [postnummer, setPostnummer] = useState('')
  const [ort, setOrt] = useState('')

  // Ny förfrågan: allt döljs och stängs igen
  useEffect(() => {
    setVisa(false)
    setRedigerar(false)
  }, [inquiry.id])

  const harleddAdress = useMemo(() => adressDelar(inquiry), [inquiry])
  const id = effektivtIdNummer(inquiry)
  const arForetag = inquiry.kundgrupp !== 'privat'
  const harRattadAdress = !!(inquiry.rattad_adress || inquiry.rattad_postnummer || inquiry.rattad_ort)

  const borjaRedigera = () => {
    setIdText(id?.varde ?? '')
    setGata(harleddAdress.gata)
    setPostnummer(harleddAdress.postnummer)
    setOrt(harleddAdress.ort)
    setRedigerar(true)
  }

  const tolkning = useMemo(() => (idText.trim() ? tolkaIdNummer(idText) : null), [idText])
  const postnummerSiffror = postnummer.replace(/\s/g, '')
  const postnummerFel = !!postnummerSiffror && !/^\d{5}$/.test(postnummerSiffror)

  const spara = async () => {
    if (tolkning && !tolkning.tolkat) {
      toast.error('Personnumret eller org.nr känns inte igen. Ange 10 eller 12 siffror.')
      return
    }
    if (postnummerFel) {
      toast.error('Postnumret ska ha fem siffror')
      return
    }

    // Id-numret: sparas bara när det skiljer sig från formulärets org.nr eller redan är kompletterat
    let idNummer: string | null = null
    let idTyp: IdNummerTyp | null = null
    if (tolkning?.tolkat) {
      const formularets = inquiry.organization_number ? tolkaIdNummer(inquiry.organization_number) : null
      const sammaSomFormularet = !inquiry.id_nummer && formularets?.tolkat && formularets.normaliserat === tolkning.normaliserat
      if (!sammaSomFormularet) {
        idNummer = tolkning.normaliserat
        idTyp = tolkning.typ
      }
    }

    // Adressen: sparas bara när den ändrats eller redan är rättad
    const ny = { gata: bara(gata), postnummer: postnummerSiffror, ort: bara(ort) }
    const adressAndrad =
      ny.gata !== harleddAdress.gata ||
      ny.postnummer !== harleddAdress.postnummer.replace(/\s/g, '') ||
      ny.ort !== harleddAdress.ort
    const sparaAdress = adressAndrad || harRattadAdress

    const k: WebInquiryKomplettering = {
      id_nummer: idNummer,
      id_nummer_typ: idTyp,
      rattad_adress: sparaAdress ? ny.gata || null : null,
      rattad_postnummer: sparaAdress ? ny.postnummer || null : null,
      rattad_ort: sparaAdress ? ny.ort || null : null,
    }

    setSparar(true)
    try {
      const uppdaterad = await WebInquiryService.saveKomplettering(inquiry.id, k)
      onSaved(uppdaterad)
      setRedigerar(false)
      setVisa(false)
      if (tolkning?.tolkat && !tolkning.kontrollsiffraOk) {
        toast('Sparat, men kontrollsiffran stämmer inte. Kontrollera numret med kunden.', { icon: '⚠️', duration: 6000 })
      } else {
        toast.success('Uppgifterna sparade')
      }
    } catch {
      toast.error('Uppgifterna kunde inte sparas')
    } finally {
      setSparar(false)
    }
  }

  const visatId = id ? (visa ? id.varde : maskeraIdNummer(id.varde, id.typ)) : null
  const idTolkning = id ? tolkaIdNummer(id.varde) : null

  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <IdCard className="w-4 h-4 text-[#20c58f]" /> Uppgifter efter samtalet
        </h3>
        {!redigerar && (
          <Button variant="secondary" size="sm" onClick={borjaRedigera}>
            <Pencil className="w-4 h-4 mr-1.5" />
            {id || harRattadAdress ? 'Ändra' : 'Fyll i'}
          </Button>
        )}
      </div>

      {!redigerar ? (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
          <div>
            <dt className="text-xs text-slate-400">{id ? TYP_LABEL[id.typ] : arForetag ? 'Org.nr' : 'Personnummer'}</dt>
            <dd className="text-white">
              {visatId ? (
                <span className="flex items-center gap-2">
                  <span className="font-mono">{visatId}</span>
                  {id?.typ === 'personnummer' && (
                    <button
                      type="button"
                      onClick={() => setVisa((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs text-[#20c58f] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
                    >
                      {visa ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {visa ? 'Dölj' : 'Visa'}
                    </button>
                  )}
                </span>
              ) : (
                <span className="text-slate-500">Saknas</span>
              )}
              {id && !inquiry.id_nummer && <span className="block text-xs text-slate-500">Från formuläret</span>}
              {idTolkning && !idTolkning.tolkat && <span className="block text-xs text-amber-400">Formatet känns inte igen</span>}
              {idTolkning?.tolkat && !idTolkning.kontrollsiffraOk && <span className="block text-xs text-amber-400">Kontrollsiffran stämmer inte</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Adress</dt>
            <dd className="text-white">
              {adressRad(harleddAdress) || <span className="text-slate-500">Saknas</span>}
              {harRattadAdress && <span className="block text-xs text-slate-500">Rättad efter samtalet</span>}
            </dd>
          </div>
          {inquiry.kompletterad_at && (
            <p className="sm:col-span-2 text-xs text-slate-500">
              Kompletterad {formatSvTid(inquiry.kompletterad_at)} av {namnFor(inquiry.kompletterad_av)}
            </p>
          )}
        </dl>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1" htmlFor="wi-idnummer">
              Personnummer eller org.nr
            </label>
            <input
              id="wi-idnummer"
              value={idText}
              onChange={(e) => setIdText(e.target.value)}
              maxLength={20}
              autoComplete="off"
              inputMode="numeric"
              placeholder={arForetag ? 'XXXXXX-XXXX' : 'ÅÅÅÅMMDD-XXXX'}
              className={`${FALT} font-mono`}
            />
            {tolkning && (
              <p className={`text-xs mt-1 ${!tolkning.tolkat ? 'text-red-400' : tolkning.kontrollsiffraOk ? 'text-slate-400' : 'text-amber-400'}`}>
                {!tolkning.tolkat
                  ? 'Känns inte igen. Ange 10 eller 12 siffror.'
                  : tolkning.kontrollsiffraOk
                    ? `${TYP_LABEL[tolkning.typ ?? 'personnummer']}, kontrollsiffran stämmer.`
                    : `${TYP_LABEL[tolkning.typ ?? 'personnummer']}, men kontrollsiffran stämmer inte. Kontrollera med kunden. Det går att spara ändå.`}
                {tolkning.tolkat && tolkning.typ === 'personnummer' && arForetag && ' Företag anger oftast org.nr.'}
                {tolkning.tolkat && tolkning.typ === 'orgnr' && !arForetag && ' Privatpersoner anger oftast personnummer.'}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1.5fr] gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1" htmlFor="wi-gata">Gatuadress</label>
              <input id="wi-gata" value={gata} onChange={(e) => setGata(e.target.value)} maxLength={200} className={FALT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1" htmlFor="wi-postnummer">Postnummer</label>
              <input id="wi-postnummer" value={postnummer} onChange={(e) => setPostnummer(e.target.value)} maxLength={6} inputMode="numeric" className={`${FALT} font-mono`} />
              {postnummerFel && <p className="text-xs mt-1 text-red-400">Fem siffror</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1" htmlFor="wi-ort">Ort</label>
              <input id="wi-ort" value={ort} onChange={(e) => setOrt(e.target.value)} maxLength={80} className={FALT} />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Kundens egna svar från formuläret ändras inte. Uppgifterna följer med till Skapa ärende och Skapa offert.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" disabled={sparar} onClick={() => setRedigerar(false)}>Avbryt</Button>
            <Button variant="primary" size="sm" disabled={sparar || (!!tolkning && !tolkning.tolkat) || postnummerFel} onClick={spara}>
              {sparar ? 'Sparar...' : 'Spara'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
