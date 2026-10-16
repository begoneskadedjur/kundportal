// src/pages/shared/intranet/guider/guide-ticket-systemet-kontor.tsx
// Guidemodul: Skicka och svara på en ticket (admin och koordinator, dator).
// Etiketterna kommer från EditCaseModal (pratbubblan Öppna kommunikation),
// CommunicationSlidePanel (Kommunikation, panelen från höger), CommentInput (Skriv kommentar...,
// Skicka), MentionSuggestions, CommentItem (Svara, Öppen, Löst), coordinatorNavConfig
// (Planering › Tickets), InternAdministration (flikarna med långa namn) och TicketCard
// (pilen Visa innehåll, Öppna ärende, Markera löst). Påhittade namn, ingenting sparas.

import { useState, type ReactNode } from 'react'
import { ArendeHuvud, Dator, IkonKnapp, Kort, Notis, OvningRam, Rad, Status, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import {
  KommentarFalt, Kommentar, KontorSida, LokalIkon, LokalIkonKnapp, NamnLista, Nmn, SidRubrik, TicketFlikar, TicketKort, mk,
} from './_allmant'

type Vy = 'arende' | 'panel' | 'namn' | 'namnvalt' | 'skriven' | 'skickad' | 'vantar' | 'tickets' | 'modal' | 'svarar' | 'svarskriven' | 'svarat' | 'utfalld' | 'klart'

const FRAGA = 'Hur många fällor satte du ut?'
const ERIK_SVAR = 'Fyra fällor i källaren. Ska jag boka återbesök?'
const MITT_SVAR = 'Ja, boka om två veckor.'

/** Panelen Kommunikation som glider in från höger (CommunicationSlidePanel) */
function SidoPanel({ under, onStang, children }: { under: string; onStang: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex justify-end bg-black/60">
      <div className="grid h-full w-[290px] max-w-full content-start gap-2 border-l border-slate-800 bg-slate-900 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="rounded-md bg-purple-500/15 p-1 text-purple-400"><LokalIkon namn="prat" size={16} /></span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-slate-100">Kommunikation</span>
              <span className="block truncate text-[10.5px] text-slate-500">{under}</span>
            </span>
          </span>
          <button type="button" onClick={onStang} aria-label="Stäng panel" className="rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800">Stäng</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Skarm({ vy, tryck, markera, nr }: { vy: Vy; tryck: (id: string) => void; markera?: string; nr: number }) {
  const iArendet = ['arende', 'panel', 'namn', 'namnvalt', 'skriven', 'skickad', 'vantar'].includes(vy)
  const harSvar = !iArendet || vy === 'vantar'
  const svarat = vy === 'svarat' || vy === 'utfalld' || vy === 'klart'
  const text = vy === 'namn' ? '@' : vy === 'namnvalt' ? '@Erik Exempel ' : vy === 'skriven' ? `@Erik Exempel ${FRAGA}` : vy === 'svarskriven' ? MITT_SVAR : ''

  const trad = (
    <div className="grid gap-0.5">
      <Kommentar namn="Anna Exempel" roll="Koordinator" tid={harSvar ? '1 tim sedan' : 'Just nu'} status={vy === 'klart' ? 'Löst' : 'Öppen'}
        text={<><Nmn>@Erik Exempel</Nmn> {FRAGA}</>} />
      {harSvar && (
        <Kommentar indrag namn="Erik Exempel" roll="Tekniker" tid="5 min sedan" text={<><Nmn>@Anna Exempel</Nmn> {ERIK_SVAR}</>}
          onSvara={() => tryck('svara')} markorSvara={mk(markera, 'svara', nr)} />
      )}
      {svarat && <Kommentar indrag namn="Anna Exempel" roll="Koordinator" tid="Just nu" text={MITT_SVAR} />}
    </div>
  )

  const falt = (
    <KommentarFalt dator text={text}
      svararPa={vy === 'svarar' || vy === 'svarskriven' ? 'Erik Exempel' : undefined}
      onFalt={() => tryck('falt')} onSkicka={() => tryck('skicka')} onGem={() => tryck('gem')}
      markorFalt={mk(markera, 'falt', nr)} markorSkicka={mk(markera, 'skicka', nr)} />
  )

  const sida = iArendet ? 'Ärenden' : 'Tickets'
  return (
    <div className="w-[600px] max-w-full">
      <Dator adress={iArendet ? 'koordinator › arenden' : 'koordinator › tickets'}>
        <KontorSida sida={sida} aktivPost={sida} siffra={vy === 'vantar' ? 1 : undefined} tryck={tryck} markera={markera} nr={nr}>
          {iArendet ? (
            <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
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
              <Kort titel="Ärendeinformation" ikon="arende.arende"><Rad v="Råttor i källaren, spår vid tvättstugan." /></Kort>
              <Kort titel="Schemaläggning" ikon="allman.kalender"><Rad v="Tisdag 2026-10-13, 08:00 till 09:00" h="Erik Exempel" /></Kort>
            </div>
          ) : (
            <>
              <SidRubrik titel="Tickets" under="Intern kommunikation med @mentions" />
              <TicketFlikar dator aktiv={vy === 'klart' ? 'archived' : svarat ? 'all' : 'mentions'}
                antal={{ mentions: svarat ? 0 : 1, replies_to_me: 0, replies: 0, activity: svarat ? 0 : 1, all: vy === 'klart' ? 0 : 1, archived: vy === 'klart' ? 5 : 4 }}
                tryck={tryck} nr={nr} />
              <TicketKort fran="Anna Exempel" till="Erik Exempel" text={FRAGA}
                sammanfattning={svarat ? 'Svar mottaget' : '1 obesvarad fråga till dig • Svar mottaget'}
                kantfarg={vy === 'klart' ? 'border-l-green-500' : svarat ? 'border-l-green-500' : 'border-l-red-500'}
                utfalld={vy === 'utfalld' || vy === 'klart'} arkiv={vy === 'klart'} tryck={tryck} markera={markera} nr={nr} />
            </>
          )}
        </KontorSida>

        {['panel', 'namn', 'namnvalt', 'skriven', 'skickad'].includes(vy) && (
          <SidoPanel under="Råttor i källaren" onStang={() => tryck('stang')}>
            {falt}
            {vy === 'namn' && <NamnLista tryck={tryck} markera={markera} nr={nr} />}
            {vy === 'skickad' && trad}
            {vy !== 'namn' && vy !== 'skickad' && <p className="py-3 text-center text-[11.5px] text-slate-500">Inga kommentarer ännu</p>}
          </SidoPanel>
        )}

        {(vy === 'modal' || vy === 'svarar' || vy === 'svarskriven') && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
            <div className="grid w-full max-w-[520px] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
                <span>
                  <span className="block text-[13px] font-semibold text-slate-100">Kommunikation</span>
                  <span className="block text-[10.5px] text-slate-500">Råttor i källaren</span>
                </span>
                <button type="button" onClick={() => tryck('stang-modal')} aria-label="Stäng modal" className="rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800">Stäng</button>
              </div>
              <div className="grid grid-cols-[150px_1fr]">
                <div className="grid content-start gap-2 border-r border-slate-700 p-2.5 text-[11px]">
                  {[['Kontakt', 'Familjen Exempel'], ['Schemalagt', '2026-10-13 08:00'], ['Tekniker', 'Erik Exempel'], ['Beskrivning', 'Råttor i källaren']].map(([r, v]) => (
                    <div key={r}><p className="text-[9.5px] uppercase tracking-wide text-slate-500">{r}</p><p className="text-slate-300">{v}</p></div>
                  ))}
                </div>
                <div className="grid content-start gap-2 p-2.5">
                  {falt}
                  {trad}
                </div>
              </div>
            </div>
          </div>
        )}

        {vy === 'klart' && <Notis text="Ticketen ligger nu under Avslutade." />}
      </Dator>
    </div>
  )
}

// ─── Visning: en skärm per steg i guidens visning-block ───

const VISNING: { vy: Vy; markera: string }[] = [
  { vy: 'arende', markera: 'prat' },
  { vy: 'namn', markera: 'namn-erik' },
  { vy: 'skriven', markera: 'skicka' },
  { vy: 'vantar', markera: 'post-Tickets' },
  { vy: 'tickets', markera: 'ticket' },
  { vy: 'modal', markera: 'svara' },
  { vy: 'utfalld', markera: 'markera-lost' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm vy={v.vy} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: samma skärmar utan markörer ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Ärendet hos Familjen Exempel är öppet. Öppna den interna kommunikationen i ärendet.' }

const TIPS: Record<string, string> = {
  fotspar: 'Fotspåren bokar återbesök. Frågan till Erik skriver du i pratbubblan.',
  historik: 'Det är ärendehistoriken. Pratbubblan längst till höger är kommunikationen.',
  gem: 'Gemet bifogar en bild eller PDF. Det behövs inte nu.',
  gul: 'Den gula knappen är för tillbud och avvikelser, inte för frågor.',
  sok: 'Sök letar efter ärenden och kunder. Du står redan i rätt ärende.',
  'namn-@koordinator': '@koordinator går till alla koordinatorer. Frågan ska till Erik.',
  'namn-@tekniker': '@tekniker går till alla tekniker. Frågan ska bara till Erik.',
  'namn-@admin': '@admin går till alla admins. Frågan ska till Erik.',
  'namn-@alla': '@alla går till alla användare. Använd den sparsamt.',
  'namn-anna': 'Anna Exempel är du själv i övningen. Välj Erik.',
  'namn-sara': 'Sara är admin. Frågan ska till teknikern Erik.',
}

const FRAMSTEG: Record<Vy, number> = { arende: 0, panel: 1, namn: 1, namnvalt: 2, skriven: 3, skickad: 4, vantar: 5, tickets: 6, modal: 7, svarar: 7, svarskriven: 8, svarat: 9, utfalld: 10, klart: 11 }

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
        if (id === 'prat') ga('panel', 'Kommunikation öppnades till höger', 'Tryck i rutan och skriv @ för att välja vem frågan ska till.')
        else miss(TIPS[id] ?? 'Leta efter pratbubblan uppe till höger i ärendet.')
        break
      case 'panel':
        if (id === 'falt') ga('namn', 'Listan Nämn öppnades', 'Du skrev @. Välj Erik under Personer.')
        else if (id === 'skicka') miss('Rutan är tom. Skriv @ och välj Erik först.')
        else if (id === 'stang') miss('Stäng stänger panelen. Skriv frågan först.')
        else miss(TIPS[id] ?? 'Tryck i rutan där det står Skriv kommentar.')
        break
      case 'namn':
        if (id === 'namn-erik') ga('namnvalt', 'Erik är vald', '@Erik Exempel står i rutan. Tryck i rutan igen och skriv frågan.')
        else miss(TIPS[id] ?? 'Välj Erik Exempel under Personer.')
        break
      case 'namnvalt':
        if (id === 'falt') ga('skriven', 'Frågan är skriven', 'Tryck Skicka. Ctrl och Enter fungerar också.')
        else if (id === 'skicka') miss('Bara namnet står i rutan. Skriv frågan efter namnet först.')
        else miss(TIPS[id] ?? 'Tryck i rutan och skriv frågan.')
        break
      case 'skriven':
        if (id === 'skicka') ga('skickad', 'Skickat', 'Frågan har status Öppen och Erik fick en notis. Stäng panelen.')
        else if (id === 'falt') tips('Frågan står redan där', 'Tryck Skicka.')
        else miss(TIPS[id] ?? 'Tryck Skicka.')
        break
      case 'skickad':
        if (id === 'stang') ga('vantar', 'En stund senare', 'Erik har svarat och frågar dig något. Gå till dina tickets.')
        else miss('Frågan är skickad. Tryck Stäng uppe i panelen.')
        break
      case 'vantar':
        if (id === 'post-Tickets' || id === 'notis') ga('tickets', 'Sidan Tickets', 'Du står på Väntar på ditt svar. Öppna ticketen.')
        else if (id === 'prat') miss('Det går, men övningen gäller sidan Tickets. Där ser du allt som väntar på dig. Hitta Tickets i menyn.')
        else miss(TIPS[id] ?? 'Tickets ligger i menyn under Planering. Klockan uppe till höger går också dit.')
        break
      case 'tickets':
        if (id === 'ticket') ga('modal', 'Hela tråden', 'Ärendet syns till vänster och tråden till höger. Svara Erik i samma tråd.')
        else if (id === 'utfall') miss('Svara Erik först. Markera löst gör du när inget mer behövs.')
        else if (id.startsWith('flik-')) miss('Du står redan på rätt flik. Väntar på ditt svar är det som väntar på dig.')
        else miss('Tryck på ticketen i listan.')
        break
      case 'modal':
        if (id === 'svara') ga('svarar', 'Svarar Erik Exempel', 'Det står ovanför rutan. Tryck i rutan och skriv svaret.')
        else if (id === 'falt') miss('Skriver du direkt i rutan blir det en ny ticket. Tryck Svara under Eriks kommentar först.')
        else if (id === 'stang-modal') miss('Svara Erik innan du stänger.')
        else miss('Tryck Svara under Eriks kommentar.')
        break
      case 'svarar':
        if (id === 'falt') ga('svarskriven', 'Svaret är skrivet', 'Tryck Skicka.')
        else if (id === 'skicka') miss('Rutan är tom. Skriv ditt svar först.')
        else miss('Tryck i rutan och skriv svaret.')
        break
      case 'svarskriven':
        if (id === 'skicka') ga('svarat', 'Svaret är skickat', 'Du är tillbaka i listan. Ticketen flyttade från Väntar på ditt svar till Alla tickets. Inget mer behövs, så avsluta den.')
        else miss('Tryck Skicka.')
        break
      case 'svarat':
        if (id === 'utfall') ga('utfalld', 'Knapparna syns', 'Nu ser du Öppna ärende och Markera löst.')
        else if (id === 'markera-lost') miss('Fäll ut ticketen med pilen till höger först.')
        else miss('Fäll ut ticketen med pilen till höger.')
        break
      case 'utfalld':
        if (id === 'markera-lost') {
          setVy('klart')
          setSvar({
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
            text: `Du frågade Erik, svarade honom i samma tråd och markerade ticketen som löst. Den ligger nu under Avslutade och går att söka fram.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        } else if (id === 'oppna') miss('Öppna ärende visar tråden igen. Du har redan svarat, så avsluta ticketen.')
        else miss('Tryck Markera löst.')
        break
    }
  }

  return (
    <OvningRam bred framsteg={FRAMSTEG[vy]} totalt={11} svar={svar} onBorjaOm={() => { setVy('arende'); setSvar(BORJA); setFel(0) }}>
      <Skarm vy={vy} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
