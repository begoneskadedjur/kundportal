// src/pages/shared/intranet/guider/guide-ticket-systemet.tsx
// Guidemodul: Skicka och svara på en ticket (tekniker, telefon).
// Etiketterna kommer från EditCaseModal (pratbubblan Öppna kommunikation),
// CommunicationSlidePanel (Kommunikation), CommentInput (Skriv kommentar..., @ nämn,
// pappersplanet som bara visar ikonen i telefonen), MentionSuggestions (Nämn, Grupper,
// Personer), CommentItem (Svara, Öppen), TechnicianMobileNav (klockan Notifieringar) och
// InternAdministration (Tickets, korta fliknamn i telefonen). Påhittade namn, ingenting sparas.

import { useState, type ReactNode } from 'react'
import { Ark, ArendeHuvud, Flikar, IkonKnapp, Kort, Rad, Status, Telefon, OvningRam, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import {
  KommentarFalt, Kommentar, LokalIkonKnapp, NamnLista, Nmn, SidRubrik, TeknikerBotten, TeknikerHuvud, TicketFlikar, TicketKort, mk,
} from './_allmant'

type Vy = 'arende' | 'panel' | 'namn' | 'namnvalt' | 'skriven' | 'skickad' | 'vantar' | 'tickets' | 'svarvy' | 'svarar' | 'svarskriven' | 'klart'

const FRAGA = 'Vill kunden ha kvittot på mejl?'
const ANNA_SVAR = 'Ja, till kund@exempel.se. Kan du skicka det i dag?'
const MITT_SVAR = 'Ja, jag skickar det i kväll.'

function Skarm({ vy, tryck, markera, nr }: { vy: Vy; tryck: (id: string) => void; markera?: string; nr: number }) {
  const harSvar = ['vantar', 'tickets', 'svarvy', 'svarar', 'svarskriven', 'klart'].includes(vy)
  const iArendet = ['arende', 'panel', 'namn', 'namnvalt', 'skriven', 'skickad', 'vantar'].includes(vy)
  const text = vy === 'namn' ? '@' : vy === 'namnvalt' ? '@Anna Exempel ' : vy === 'skriven' ? `@Anna Exempel ${FRAGA}` : vy === 'svarskriven' ? MITT_SVAR : ''

  let innehall: ReactNode
  if (iArendet) {
    innehall = <>
      <ArendeHuvud
        nr="BE-0001234"
        status={<Status text="Bokad" />}
        kund="Familjen Exempel · Exempelvägen 4, Södertälje"
        ikoner={<>
          <IkonKnapp ikon="arende.aterbesok" etikett="Boka återbesök eller skapa nytt ärende" onClick={() => tryck('fotspar')} />
          <IkonKnapp ikon="allman.historik" etikett="Ärendehistorik" onClick={() => tryck('historik')} />
          <LokalIkonKnapp ikon="prat" etikett="Öppna kommunikation" onClick={() => tryck('prat')} markor={mk(markera, 'prat', nr)} />
        </>}
      />
      <Flikar flikar={['Ärende', 'Utförande', 'Ekonomi']} aktiv={0} onClick={() => tryck('flik')} />
      <Kort titel="Ärendeinformation" ikon="arende.arende"><Rad v="Råttor i källaren, spår vid tvättstugan." /></Kort>
      <Kort titel="Schemaläggning" ikon="allman.kalender"><Rad v="Tisdag 2026-10-20, 08:00 till 09:00" /></Kort>
    </>
  } else {
    innehall = (
      <div className="p-3">
        <SidRubrik titel="Tickets" under="Intern kommunikation med @mentions" />
        <TicketFlikar aktiv="mentions" antal={{ mentions: 1, replies_to_me: 0, replies: 0, activity: 1, all: 1, archived: 4 }} tryck={tryck} nr={nr} />
        <TicketKort fran="Erik Exempel" till="Anna Exempel" text={FRAGA} sammanfattning="1 obesvarad fråga till dig • Svar mottaget" tryck={tryck} markera={markera} nr={nr} />
      </div>
    )
  }

  const panel = vy !== 'arende' && vy !== 'vantar' && vy !== 'tickets'
  const svarslage = vy === 'svarar' || vy === 'svarskriven' || vy === 'klart'

  return (
    <Telefon>
      <TeknikerHuvud tryck={tryck} markera={markera} nr={nr} siffra={vy === 'vantar' ? 1 : undefined} />
      {innehall}
      <TeknikerBotten tryck={tryck} nr={nr} />

      {panel && (
        <Ark titel="Kommunikation" under="Råttor i källaren">
          <button type="button" onClick={() => tryck('stang')} className="-mt-9 justify-self-end rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800" aria-label="Stäng panel">Stäng</button>
          <div className="relative">
            <KommentarFalt
              text={text}
              svararPa={svarslage && vy !== 'klart' ? 'Anna Exempel' : undefined}
              onFalt={() => tryck('falt')} onSkicka={() => tryck('skicka')} onGem={() => tryck('gem')}
              markorFalt={mk(markera, 'falt', nr)} markorSkicka={mk(markera, 'skicka', nr)}
            />
            {vy === 'namn' && <div className="mt-1"><NamnLista tryck={tryck} markera={markera} nr={nr} /></div>}
          </div>
          {vy !== 'namn' && (
            <div className="grid gap-0.5">
              {(vy === 'skickad' || harSvar) && (
                <Kommentar namn="Erik Exempel" roll="Tekniker" tid={harSvar ? '1 tim sedan' : 'Just nu'} status="Öppen"
                  text={<><Nmn>@Anna Exempel</Nmn> {FRAGA}</>} />
              )}
              {harSvar && (
                <Kommentar indrag namn="Anna Exempel" roll="Koordinator" tid="5 min sedan"
                  text={<><Nmn>@Erik Exempel</Nmn> {ANNA_SVAR}</>}
                  onSvara={() => tryck('svara')} markorSvara={mk(markera, 'svara', nr)} />
              )}
              {vy === 'klart' && <Kommentar indrag namn="Erik Exempel" roll="Tekniker" tid="Just nu" text={MITT_SVAR} />}
              {!harSvar && vy !== 'skickad' && <p className="py-3 text-center text-[11.5px] text-slate-500">Inga kommentarer ännu<br /><span className="text-[10.5px] text-slate-600">Använd @namn för att nämna någon</span></p>}
            </div>
          )}
        </Ark>
      )}
    </Telefon>
  )
}

// ─── Visning: en skärm per steg i guidens visning-block ───

const VISNING: { vy: Vy; markera: string }[] = [
  { vy: 'arende', markera: 'prat' },
  { vy: 'namn', markera: 'namn-anna' },
  { vy: 'skriven', markera: 'skicka' },
  { vy: 'vantar', markera: 'notis' },
  { vy: 'tickets', markera: 'ticket' },
  { vy: 'svarvy', markera: 'svara' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm vy={v.vy} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: samma skärmar utan markörer ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står i ärendet hos Familjen Exempel. Leta upp knappen för intern kommunikation och tryck på den.' }

const TIPS: Record<string, string> = {
  fotspar: 'Fotspåren bokar återbesök. Frågan till kontoret skriver du i pratbubblan.',
  historik: 'Klockan med pilen är ärendehistoriken. Pratbubblan längst till höger är kommunikationen.',
  flik: 'Flikarna byter vy i ärendet. Kommunikationen öppnar du med pratbubblan uppe till höger.',
  sok: 'Sök letar efter ärenden och kunder. Här ska du skriva i ärendet du redan står i.',
  meny: 'Menyn behövs inte nu. Allt du behöver finns i ärendet.',
  gem: 'Gemet bifogar en bild eller PDF. Det behövs inte för den här frågan.',
  'namn-@koordinator': '@koordinator går till alla koordinatorer. Uppdraget var att fråga Anna.',
  'namn-@tekniker': '@tekniker går till alla tekniker. Frågan ska till Anna.',
  'namn-@admin': '@admin går till alla admins. Frågan ska till Anna.',
  'namn-@alla': '@alla går till alla användare. Använd den sparsamt. Frågan ska till Anna.',
  'namn-erik': 'Erik Exempel är du själv i övningen. Välj Anna.',
  'namn-sara': 'Sara är admin. Frågan ska till koordinatorn Anna.',
}

const FRAMSTEG: Record<Vy, number> = { arende: 0, panel: 1, namn: 1, namnvalt: 2, skriven: 3, skickad: 4, vantar: 5, tickets: 6, svarvy: 6, svarar: 7, svarskriven: 8, klart: 9 }

function Ovning() {
  const [vy, setVy] = useState<Vy>('arende')
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })
  const ga = (ny: Vy, titel: string, text: string) => { setVy(ny); tips(titel, text) }

  const tryck = (id: string) => {
    if (vy === 'klart') return
    switch (vy) {
      case 'arende':
        if (id === 'prat') ga('panel', 'Kommunikation är öppen', 'Tryck i rutan och skriv @ för att välja vem frågan ska till.')
        else miss(TIPS[id] ?? 'Leta efter pratbubblan uppe till höger i ärendet.')
        break
      case 'panel':
        if (id === 'falt') ga('namn', 'Listan Nämn öppnades', 'Du skrev @. Välj vem som ska få frågan.')
        else if (id === 'skicka') miss('Rutan är tom. Tryck i rutan och skriv @ först.')
        else if (id === 'stang') miss('Stäng stänger panelen. Skriv frågan först.')
        else miss(TIPS[id] ?? 'Tryck i rutan där det står Skriv kommentar.')
        break
      case 'namn':
        if (id === 'namn-anna') ga('namnvalt', 'Anna är vald', '@Anna Exempel står i rutan. Tryck i rutan igen och skriv frågan.')
        else miss(TIPS[id] ?? 'Välj Anna Exempel under Personer.')
        break
      case 'namnvalt':
        if (id === 'falt') ga('skriven', 'Frågan är skriven', 'Nu kan du skicka. Knappen med pappersplanet blev grön.')
        else if (id === 'skicka') miss('Bara namnet står i rutan. Tryck i rutan och skriv frågan, annars vet Anna inte vad du undrar.')
        else miss(TIPS[id] ?? 'Tryck i rutan och skriv frågan.')
        break
      case 'skriven':
        if (id === 'skicka') ga('skickad', 'Skickat', 'Kommentaren syns med status Öppen och Anna fick en notis. Stäng panelen och fortsätt jobba.')
        else if (id === 'falt') tips('Frågan står redan där', 'Tryck på pappersplanet för att skicka.')
        else miss(TIPS[id] ?? 'Skicka frågan med pappersplanet.')
        break
      case 'skickad':
        if (id === 'stang') ga('vantar', 'En stund senare', 'Anna har svarat och frågar dig något. Ser du siffran på klockan uppe till höger? Hitta svaret.')
        else miss('Frågan är skickad. Tryck Stäng uppe i panelen.')
        break
      case 'vantar':
        if (id === 'notis') ga('tickets', 'Sidan Tickets', 'Du står på fliken Att göra. Där ligger allt som väntar på ditt svar. Öppna ticketen.')
        else if (id === 'prat') ga('svarvy', 'Det går också', 'Annas svar syns i ärendet. Svara henne i tråden.')
        else miss(TIPS[id] ?? 'Siffran på klockan visar att någon skrivit till dig. Tryck på klockan.')
        break
      case 'tickets':
        if (id === 'ticket') ga('svarvy', 'Hela tråden', 'Annas svar ligger under din fråga. Svara henne i samma tråd.')
        else if (id === 'utfall') miss('Pilen visar knapparna Öppna ärende och Markera löst. Tryck på själva ticketen för att läsa och svara.')
        else if (id.startsWith('flik-')) miss('Du står redan på rätt flik. Att göra är det som väntar på ditt svar.')
        else miss('Tryck på ticketen i listan.')
        break
      case 'svarvy':
        if (id === 'svara') ga('svarar', 'Svarar Anna Exempel', 'Det står ovanför rutan. Tryck i rutan och skriv ditt svar.')
        else if (id === 'falt') miss('Skriver du direkt i rutan blir det en ny ticket. Tryck Svara under Annas kommentar först, så hamnar svaret i samma tråd.')
        else miss('Tryck Svara under Annas kommentar.')
        break
      case 'svarar':
        if (id === 'falt') ga('svarskriven', 'Svaret är skrivet', 'Tryck på pappersplanet för att skicka.')
        else if (id === 'skicka') miss('Rutan är tom. Skriv ditt svar först.')
        else miss('Tryck i rutan och skriv ditt svar.')
        break
      case 'svarskriven':
        if (id === 'skicka') {
          setVy('klart')
          setSvar({
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
            text: `Du frågade Anna, hittade hennes svar och svarade i samma tråd. Ticketen försvann från Att göra, och Anna ser ditt svar.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        } else miss('Skicka svaret med pappersplanet.')
        break
    }
  }

  return (
    <OvningRam framsteg={FRAMSTEG[vy]} totalt={9} svar={svar} onBorjaOm={() => { setVy('arende'); setSvar(BORJA); setFel(0) }}>
      <Skarm vy={vy} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
