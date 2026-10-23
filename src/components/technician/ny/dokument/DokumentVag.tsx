// src/components/technician/ny/dokument/DokumentVag.tsx
// Dokumentets väg: Skickad, Öppnad, Fråga, Signerad (eller Förföll/Avböjd),
// Kund upplagd, Bokad. Under varje steg datum och vem som gör steget
// (Du, Kunden, Kontoret), så att teknikern ser att inget väntar på hen efter signering.
// Dator: sex kolumner. Telefon: lodrät lista.

import { Icon } from '../../../icons/Icon'
import type { FollowUpOffer } from '../../../../services/offerFollowUpService'
import { svDatum, type Bokning } from './dokumentData'

type Lage = 'klar' | 'nu' | 'sen' | 'fel'

interface Steg {
  namn: string
  detalj: string
  vem: string
  lage: Lage
}

function steg(o: FollowUpOffer, bokning: Bokning | undefined, arMitt: boolean): Steg[] {
  const signerad = o.status === 'signed'
  const dod = o.status === 'overdue' || o.status === 'declined'
  const utkast = o.status === 'draft'
  const signDatum = (o as FollowUpOffer & { signed_at?: string | null }).signed_at || o.status_updated_at
  const lista: Steg[] = [
    {
      namn: utkast ? 'Utkast' : 'Skickad',
      detalj: utkast ? 'Inte skickat' : svDatum(o.created_at),
      vem: arMitt ? 'Du' : (o.created_by_name || o.begone_employee_name || 'Säljaren'),
      lage: utkast ? 'nu' : 'klar',
    },
    {
      namn: 'Öppnad',
      detalj: o.email_delivery_failed_at ? 'Mejlet kom inte fram' : o.customer_first_viewed_at ? svDatum(o.customer_first_viewed_at) : utkast ? 'Sen' : 'Inte än',
      vem: 'Kunden',
      lage: o.email_delivery_failed_at ? 'fel' : o.customer_first_viewed_at ? 'klar' : 'sen',
    },
    {
      namn: 'Fråga',
      detalj: o.latest_customer_comment ? svDatum(o.latest_customer_comment.at) : 'Ingen',
      vem: 'Kunden',
      lage: o.latest_customer_comment ? 'klar' : 'sen',
    },
  ]
  if (dod) {
    lista.push({
      namn: o.status === 'overdue' ? 'Förföll' : 'Avböjd',
      detalj: svDatum(o.status_updated_at || o.updated_at),
      vem: o.status === 'overdue' ? 'Fristen gick ut' : 'Kunden',
      lage: 'fel',
    })
  } else {
    lista.push({
      namn: 'Signerad',
      detalj: signerad ? svDatum(signDatum) : utkast ? 'Sen' : 'Väntar',
      vem: 'Kunden',
      lage: signerad ? 'klar' : utkast ? 'sen' : 'nu',
    })
  }
  lista.push({
    namn: 'Kund upplagd',
    detalj: o.customer_id ? 'Klar' : signerad ? 'Väntar' : 'Sen',
    vem: 'Kontoret',
    lage: o.customer_id ? 'klar' : signerad && o.type === 'contract' ? 'nu' : 'sen',
  })
  lista.push({
    namn: 'Bokad',
    detalj: o.booked_case_id ? (bokning?.start ? svDatum(bokning.start) : 'Klar') : signerad ? 'Väntar' : 'Sen',
    vem: 'Kontoret',
    lage: o.booked_case_id ? 'klar' : signerad ? 'nu' : 'sen',
  })
  return lista
}

const PRICK: Record<Lage, string> = {
  klar: 'bg-[#20c58f] border-[#20c58f]',
  nu: 'bg-slate-900 border-amber-500',
  sen: 'bg-slate-900 border-slate-600',
  fel: 'bg-red-500 border-red-500',
}

export function DokumentVag({ offer, bokning, arMitt }: { offer: FollowUpOffer; bokning?: Bokning; arMitt: boolean }) {
  const lista = steg(offer, bokning, arMitt)
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-white">
        <Icon name="allman.historik" size={20} className="text-violet-400" />
        Dokumentets väg
      </h3>
      <ol aria-label="Dokumentets väg" className="flex flex-col gap-3 sm:grid sm:grid-cols-6 sm:gap-0">
        {lista.map((s, i) => {
          const nasta = lista[i + 1]
          return (
            <li key={s.namn} className="relative flex sm:flex-col items-start gap-3 sm:gap-1 sm:pr-2">
              {nasta && (
                <span aria-hidden="true" className={`hidden sm:block absolute top-[7px] left-4 right-0 h-0.5 ${s.lage === 'klar' && nasta.lage === 'klar' ? 'bg-[#20c58f]' : 'bg-slate-700'}`} />
              )}
              <span aria-hidden="true" className={`relative mt-0.5 sm:mt-0 w-4 h-4 flex-shrink-0 rounded-full border-2 ${PRICK[s.lage]}`} />
              <span className="flex flex-wrap sm:flex-col items-baseline sm:items-start gap-x-2 gap-y-0.5 min-w-0">
                <span className={`text-sm font-semibold ${s.lage === 'sen' ? 'text-slate-400' : s.lage === 'fel' ? 'text-red-400' : 'text-white'}`}>{s.namn}</span>
                <span className={`text-sm text-slate-400 ${/^\d{4}-/.test(s.detalj) ? 'font-mono' : ''}`}>{s.detalj}</span>
                <span className="text-sm text-slate-400">{s.vem}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default DokumentVag
