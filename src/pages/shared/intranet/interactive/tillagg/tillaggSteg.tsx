// src/pages/shared/intranet/interactive/tillagg/tillaggSteg.tsx
// De åtta stegen i guiden Tilläggsstationer: text, roller och skärmbilder.
// Används av TillaggKedja (tidslinjen) och TillaggRoller (vem gör vad).

import type { ReactNode } from 'react'
import type { TillaggRole } from './tillaggRoles'
import { B, Obs, Punkter } from './tillaggShared'
import {
  SkarmArbetstidBefintlig,
  SkarmArbetstidNy,
  SkarmBeslutaTillagg,
  SkarmBokaEtablering,
  SkarmBorttagVarning,
  SkarmEkonomiFlik,
  SkarmMarkeraTillagg,
  SkarmMerforsaljning,
  SkarmNotisOchLista,
  SkarmPlaneradeFakturor,
  SkarmUppgiftsremsa,
} from './TillaggSkarmbilder'

export interface Steg {
  title: string
  roles: TillaggRole[]
  /** Kort svar på "när?" */
  when: string
  body: ReactNode
  screens?: ReactNode
}

export const STEG: Steg[] = [
  {
    title: 'Koordinatorn bokar etableringen',
    roles: ['koordinator'],
    when: 'Innan teknikern åker ut',
    body: (
      <>
        <p className="text-sm leading-relaxed text-slate-300">
          Stationer hos en avtalskund sätts ut i ett ärende av typen <B>Etablering Avtalskund</B>. Boka det på den enhet där stationerna ska stå, alltså rätt enhet om kunden har flera.
        </p>
        <Punkter
          items={[
            'Samma ärende används när teknikern sätter ut stationer som ingår i avtalet och stationer som är tillägg.',
            'Tillägg kan också sättas ut under en vanlig kontrollrunda. Då är det kontrollärendet som bär tillägget i stället.',
          ]}
        />
      </>
    ),
    screens: <SkarmBokaEtablering />,
  },
  {
    title: 'Teknikern sätter ut stationen och markerar den som tillägg',
    roles: ['tekniker', 'systemet'],
    when: 'På plats hos kunden',
    body: (
      <>
        <p className="text-sm leading-relaxed text-slate-300">
          Placera stationen som vanligt. Kryssa sedan i <B>Tillägg utöver avtal</B> och välj hur den ska betalas: <B>per år</B>, <B>per månad</B> eller <B>per kontroll</B>. Välj också vilken produkt du satte ut (den är en intern kostnad, kunden ser bara stationstypen).
        </p>
        <Punkter
          items={[
            <>Priset hämtas ur kundens prislista: tjänst <B>144 Tilläggsstation per år</B>, <B>79 Ljusfälla generell</B> för ljusfällor och <B>43</B> för per kontroll.</>,
            <>Har kunden inget eget pris används listan <B>Standardtjänster</B>. Där kostar 144 och 79 i dag 3 600 kr per år. Tjänst 43 har inget standardpris, så per kontroll kräver att kunden har priset i sin egen lista.</>,
            'Per år och per månad går bara att välja när kunden har ett avtal.',
          ]}
        />
        <p className="text-sm leading-relaxed text-slate-300 mt-3">Direkt när stationen är sparad händer det här, utan att någon behöver göra något:</p>
        <Punkter
          items={[
            <>Stationen blir en <B>bricka att besluta</B> i kundens avtalskarta.</>,
            'Alla med behörigheten att godkänna fakturor får en notis: Tillägg att besluta.',
            <>Kunden hamnar under <B>Kräver åtgärd</B> i listan Befintliga kunder, och menyraden Befintliga kunder får en markering.</>,
          ]}
        />
      </>
    ),
    screens: (
      <>
        <SkarmMarkeraTillagg />
        <SkarmNotisOchLista />
      </>
    ),
  },
  {
    title: 'Ekonomi-fliken visar vad kunden betalar nu och sedan',
    roles: ['systemet'],
    when: 'Så fort stationen är sparad',
    body: (
      <>
        <p className="text-sm leading-relaxed text-slate-300">
          På ärendets <B>Ekonomi</B>-flik finns sektionen <B>Tillägg utöver avtalet</B>. Där står en tidslinje per stationstyp, och en för arbetstiden när den är angiven.
        </p>
        <Punkter
          items={[
            <><B>Betalas nu</B> (grönt): tiden som är kvar fram till avtalets nästa periodstart. Systemet räknar på dagar och visar det som månader, till exempel 9 av 12 månader.</>,
            <><B>Från</B> och datumet för avtalets nästa periodstart (randigt, i bilden Från 1 jul 2027): från den dagen kostar tillägget fasta årspriset och följer avtalets år.</>,
            'Priset per station och per timme står på båda sidorna, så att du kan stämma av mot kundens fasta pris.',
          ]}
        />
      </>
    ),
    screens: <SkarmEkonomiFlik />,
  },
  {
    title: 'Teknikern avslutar och svarar på frågan om arbetstid',
    roles: ['tekniker'],
    when: 'När du trycker Färdig med etablering (eller klarmarkerar kontrollrundan)',
    body: (
      <>
        <p className="text-sm leading-relaxed text-slate-300">
          Har du satt ut nya tillägg per år eller per månad får du frågan <B>Hur mycket arbetstid ska vi debitera för att hantera dessa tillägg?</B> Svara i <B>timmar per år</B>: tiden det tar att kontrollera, byta och rapportera tilläggsstationerna under ett helt år. Hela eller halva timmar.
        </p>
        <Punkter
          items={[
            <><B>Enhet utan tillägg sedan tidigare:</B> skriv antalet timmar. Fältet måste fyllas i. Behövs ingen extra tid skriver du 0.</>,
            <><B>Enhet som redan har tillägg:</B> du ser en tabell med stationerna innan, de nya och efter, och hur många timmar som debiteras idag. Frågan blir då om det behövs mer tid nu. <B>Nej är förvalt.</B> Väljer du Ja skriver du det nya totala antalet timmar, och det måste vara fler än idag.</>,
            'Bara ökningen faktureras nu, och bara för tiden som är kvar till avtalets nästa periodstart.',
            'Dina timmar är ett förslag. Faktureringsansvarig ser förslaget när tilläggen beslutas och kan ändra det.',
          ]}
        />
      </>
    ),
    screens: (
      <>
        <SkarmArbetstidNy />
        <SkarmArbetstidBefintlig />
      </>
    ),
  },
  {
    title: 'Ärendet stängs och fakturan för Betalas nu skapas',
    roles: ['systemet', 'fakturering'],
    when: 'Samtidigt som ärendet stängs',
    body: (
      <>
        <p className="text-sm leading-relaxed text-slate-300">
          När ärendet stängs blir Betalas nu-delen fakturarader under <B>Fakturering › Merförsäljning Avtal</B>: stationerna och arbetstiden. En merförsäljningsfaktura skapas direkt, eller läggs på månadens samlingsfaktura om kunden är inställd så.
        </p>
        <Punkter
          items={[
            'Interna kostnader (produkterna och den interna arbetstiden) blir aldrig fakturarader.',
            'Rader på 0 kr blir ingen faktura, till exempel när arbetstiden inte ökade.',
            'Faktureringsansvarig granskar, godkänner och skickar fakturan precis som annan merförsäljning.',
          ]}
        />
      </>
    ),
    screens: <SkarmMerforsaljning />,
  },
  {
    title: 'Faktureringsansvarig beslutar tilläggen i avtalskartan',
    roles: ['fakturering'],
    when: 'Så snart som möjligt efter notisen',
    body: (
      <>
        <p className="text-sm leading-relaxed text-slate-300">
          Klicka på notisen eller på kunden under Kräver åtgärd. Du hamnar i kundens <B>Avtalskarta</B> med en gul remsa överst. Tryck <B>Öppna § 5</B> och välj en av de två knapparna vid brickan. Då öppnas <B>Besluta tillägg</B>, som visar:
        </p>
        <Punkter
          items={[
            'Vad teknikern satte ut, med kundens årspris per station (går att ändra, och måste fyllas i om priset saknas).',
            'Arbetstid för att hantera tilläggen, förifylld med teknikerns förslag. Du kan ändra timmarna.',
            <>Tilläggets kalkyl: utrustningen, intäkten och den interna arbetstiden per år, och <B>Betalt tillbaka cirka</B> när utrustningen är betald.</>,
          ]}
        />
        <p className="text-sm leading-relaxed text-slate-300 mt-3">Sedan väljer du hur tillägget ska faktureras:</p>
        <Punkter
          items={[
            <><B>Tillägg utöver avtalet</B> (förvalt): egen faktura i samband med avtalets årsfaktura. Premien och avtalets innehåll rörs inte. Tillägget slutar när avtalet slutar.</>,
            <><B>Lägg till i avtalet</B>: årspremien höjs från det datum du väljer och tillägget faktureras med avtalet. Stationerna och arbetstiden blir en del av avtalets innehåll och kostnaden läggs i § 4.</>,
          ]}
        />
        <Obs>Utan beslut blir det aldrig någon årsdebitering. Kunden betalar då bara Betalas nu-delen, och tillägget följer inte med till nästa avtalsår.</Obs>
      </>
    ),
    screens: (
      <>
        <SkarmUppgiftsremsa />
        <SkarmBeslutaTillagg />
      </>
    ),
  },
  {
    title: 'Systemet planerar tilläggsfakturan',
    roles: ['systemet'],
    when: 'Den 1:a varje månad',
    body: (
      <>
        <p className="text-sm leading-relaxed text-slate-300">
          Den 1:a varje månad planerar systemet avtalens fakturor tolv månader framåt. Först räknar det om tilläggen efter stationerna som står ute. Tilläggsfakturan dyker upp som en <B>egen planerad faktura bredvid årsfakturan</B>, för samma period.
        </p>
        <Punkter
          items={[
            'Du behöver inte planera om något för hand.',
            'Precis innan fakturan skickas räknas antalet stationer om igen. En station som tagits bort faktureras inte.',
          ]}
        />
      </>
    ),
    screens: <SkarmPlaneradeFakturor />,
  },
  {
    title: 'Varje avtalsår tills avtalet slutar',
    roles: ['systemet', 'fakturering', 'tekniker'],
    when: 'Löpande',
    body: (
      <>
        <Punkter
          items={[
            'Tillägget faktureras varje avtalsår i samband med årsfakturan, på sin egen faktura, så länge avtalet löper.',
            'Tas stationer bort blir raden mindre vid nästa fakturering. Tas den sista tilläggsstationen på enheten bort går arbetstiden till 0.',
            'Det blir inga krediteringar. Det som redan är fakturerat står kvar.',
            'När avtalet har slutat avslutas tilläggets rader och inga fler tilläggsfakturor planeras. Tillägget slutar samtidigt som avtalet.',
          ]}
        />
        <p className="text-sm leading-relaxed text-slate-300 mt-3">
          <B>Tekniker kan ta bort tilläggsstationer ute hos kunden</B>, till exempel med status Borttagen, med Kontrollera + hämta upp i kontrollrundan eller med Ta bort-knappen. Är stationen redan betald framåt kommer ett förtydligande först:
        </p>
        <Punkter
          items={[
            <>Du ser att stationen är <B>betald till och med</B> ett datum, oftast dagen före avtalets nästa periodstart.</>,
            'Kunden får ingen återbetalning om den tas bort nu, och den faktureras inte längre från nästa period.',
            'Låt den stå kvar om kunden inte uttryckligen vill ta bort den. Kunden har redan betalat för den.',
            <>Vill kunden ändå ta bort den trycker du en gång till. Knappen heter då <B>Klicka igen för att ta bort</B>.</>,
            'Är stationen inte fakturerad än står det Inte fakturerad än. Tas den bort räknas den inte med.',
          ]}
        />
      </>
    ),
    screens: <SkarmBorttagVarning />,
  },
]
