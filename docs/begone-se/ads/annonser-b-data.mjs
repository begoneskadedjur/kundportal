// Annons B per annonsgrupp i Christian-kampanjerna (2026-10-06). Annons A finns i kontoplan-data.mjs.
// Granskad av skadedjursexperten 2026-10-07 (elva rättningar införda, därefter godkänd).
// Vinkel: annons A visar processen (symptom, inspektion, metod). Annons B visar kvaliteten:
// erfarna tekniker, ISO 9001 och 14001, uppföljning tills skadedjuren är borta, utrustning och dokumentation.
// Rubrik högst 30 tecken, beskrivning högst 90. Inga garantier, ingen jour, inga tidslöften utöver
// "Ofta ... redan samma dag", inga belopp, inga konkurrentnamn, inga tankstreck.
// Byggs till förslagsfiler av scripts/ads/bygg-annonser-b.mjs.

import { URL } from './kontoplan-data.mjs'

const B = 'Begone Skadedjur'
const ERF = 'Erfarna skadedjurstekniker'
const ISO = 'ISO 9001 och ISO 14001'
const UPP = 'Uppföljning tills de är borta'
const INSP = 'Kostnadsfri inspektion'
const KF = 'Kostnadsförslag efter besöket'
const OFFERT = 'Skriftlig offert efter besöket'
const PLATS = 'Ofta på plats redan samma dag'
const SAMMA = 'Ofta hjälp redan samma dag'
const FAST = 'Fast pris innan vi börjar'
const FASTTEL = 'Fast pris per telefon'
const BILDPRIS = 'Skicka en bild, få ett pris'
const HOJD = 'Montering på hög höjd'
const LIFT = 'Liftkort och fallskydd'

const D_PREMIUM = 'Erfarna skadedjurstekniker i en organisation certifierad enligt ISO 9001 och 14001.'
const D_KF = 'Efter en kostnadsfri inspektion får du ett kostnadsförslag att gå igenom i lugn och ro.'
const D_OFFERT = 'Du får teknikerns bedömning och en skriftlig offert efter en kostnadsfri inspektion.'
const D_OFFERT_NI = 'Ni får teknikerns bedömning och en skriftlig offert efter en kostnadsfri inspektion.'
const D_RING = 'Skicka en förfrågan när det passar. Vardagar 08 till 17 ringer vi upp samma dag.'
const D_RING_NI = 'Skicka en förfrågan när det passar. Vardagar 08 till 17 ringer vi upp er samma dag.'
const D_FASTBILD = 'Fast pris per telefon eller mejl. Skicka gärna en bild på det du har hittat.'

export const annonserB = [
  // Christian | Sök | Råttor
  { kampanj: 'Christian | Sök | Råttor', grupp: 'Råttbekämpning', url: URL.ratt, sokvag: ['råttbekämpning', 'tekniker'],
    rubriker: ['Råttbekämpning', 'Råttbekämpning med uppföljning', UPP, ERF, ISO, 'Certifierad enligt ISO 9001', 'Råttsanering', 'Tätning, fällor och stationer', 'Vi åtgärdar grundorsaken', INSP, KF, 'Rapport för försäkringsbolaget', 'Råttor inomhus och utomhus', PLATS, B],
    beskrivningar: [D_PREMIUM, 'Teknikern hittar grundorsaken, stänger vägarna in och följer upp tills råttorna är borta.', D_KF, 'Rapport till försäkringsbolaget när du behöver. Privatpersoner får ROT på tätningen.'] },
  { kampanj: 'Christian | Sök | Råttor', grupp: 'Råttor inomhus', url: URL.ratt, sokvag: ['råttor', 'i-huset'],
    rubriker: ['Råttor i huset?', 'Råttor i väggarna?', 'Råttor på vinden?', 'Råttor i källaren?', 'Råttbekämpning inomhus', ERF, ISO, UPP, 'Vi åtgärdar grundorsaken', INSP, 'Vi sanerar även isoleringen', 'Rapport för försäkringsbolaget', 'ROT på tätningsarbetet', PLATS, B],
    beskrivningar: ['Ljud i väggen eller spillning på vinden? Teknikern hittar vägen in och stänger den.', D_PREMIUM, 'Vi sanerar allt som behövs efter råttorna och följer upp tills de är borta.', D_KF] },
  { kampanj: 'Christian | Sök | Råttor', grupp: 'Råttor utomhus', url: URL.ratt, sokvag: ['råttor', 'tomten'],
    rubriker: ['Råttor på tomten?', 'Råttor i trädgården?', 'Råttor i komposten?', 'Råttor under huset?', 'Råttbekämpning utomhus', 'Vi ser vad som lockar råttorna', 'Fällor med digital övervakning', ERF, ISO, UPP, INSP, KF, PLATS, B],
    beskrivningar: ['Teknikern ser vad som lockar råttorna och hur de kan ta sig in i huset.', 'Mekaniska fällor som följs digitalt, betesstationer eller tätning, efter platsen.', D_PREMIUM, D_KF] },
  { kampanj: 'Christian | Sök | Råttor', grupp: 'Råttor i avlopp', url: URL.ratt, sokvag: ['råttor', 'avlopp'],
    rubriker: ['Råttor i avloppet?', 'Råtta i toaletten?', 'Råttspärr i avloppet', 'Vi monterar råttspärr', 'Råttsäkra golvbrunnar', ERF, ISO, UPP, 'Rapport för försäkringsbolaget', 'Sanering efter råttor', KF, 'Skicka förfrågan med bilder', 'Råttbekämpning', B],
    beskrivningar: ['Vi ser till att skadan på ledningen hittas och monterar råttspärr där den behövs.', 'Vi monterar även råttsäkra vattenlås och galler i golvbrunnar.', D_PREMIUM, 'Rapport till försäkringsbolaget när du behöver, och uppföljning tills råttorna är borta.'],
    anm: 'Ingen kostnadsfri inspektion i avloppsgruppen (kan läsas som gratis rörinspektion).' },
  { kampanj: 'Christian | Sök | Råttor', grupp: 'Råttor i fastighet', url: URL.ratt + '?kundtyp=foretag', sokvag: ['råttbekämpning', 'avtal'],
    rubriker: ['Råttbekämpning för fastigheter', 'Råttor i soprummet?', 'Råttbekämpning för BRF', 'Råttbekämpning för företag', 'Skadedjursavtal efter behov', 'Kundportal för avtalskunder', 'Rapporter som PDF eller Excel', ERF, ISO, 'Certifierad enligt ISO 14001', UPP, INSP, KF, B],
    beskrivningar: ['Ni ser ärenden, kommande besök och utplacerad utrustning i kundportalen.', D_PREMIUM, 'Teknikern hittar var råttorna kommer in och följer upp tills de är borta.', 'Ni får ett kostnadsförslag efter en kostnadsfri inspektion. Rapporter när ni behöver.'] },

  // Christian | Sök | Fåglar
  { kampanj: 'Christian | Sök | Fåglar', grupp: 'Fågelsäkring', url: URL.fagelsakring, sokvag: ['fågelsäkring', 'montering'],
    rubriker: ['Fågelsäkring', 'Fågelsäkring av tak och fasad', 'Fågelskydd för solceller', 'Solcellsskydd utan åverkan', HOJD, LIFT, 'Nät, piggar, vajer och band', 'Gamla bon tas bort', 'ROT i regel på monteringen', ERF, ISO, INSP, OFFERT, B],
    beskrivningar: ['Teknikerna har liftkort och fallskydd och monterar nät, piggar, vajer eller fågelband.', 'Skydd för solceller monteras med clips, utan åverkan på panelerna.', D_PREMIUM, D_OFFERT] },
  { kampanj: 'Christian | Sök | Fåglar', grupp: 'Duvor', url: URL.fagelsakring, sokvag: ['fågelsäkring', 'duvor'],
    rubriker: ['Problem med duvor?', 'Duvor på balkongen?', 'Duvor under solcellerna?', 'Duvor häckar på huset?', 'Fågelskydd mot duvor', 'Sanering av duvträck', 'Skydd valt efter platsen', 'Gamla bon tas bort', HOJD, ERF, ISO, INSP, OFFERT, B],
    beskrivningar: ['Vi tar bort gamla bon och spillning och monterar skydd valt efter platsen och fåglarna.', 'Teknikerna har liftkort och fallskydd när skyddet ska monteras högt upp.', D_PREMIUM, D_OFFERT] },
  { kampanj: 'Christian | Sök | Fåglar', grupp: 'Måsar och trutar', url: URL.fagelsakring, sokvag: ['fågelsäkring', 'måsar'],
    rubriker: ['Måsar på taket?', 'Fiskmåsar på taket?', 'Trutar på taket?', 'Fågelskydd mot måsar', 'Skydd före häckningen', 'Utan håltagning i tätskiktet', HOJD, LIFT, ERF, ISO, INSP, OFFERT, B],
    beskrivningar: ['Teknikerna har liftkort och fallskydd och monterar skyddet utan håltagning i tätskiktet.', 'Boka gärna före våren, så att skyddet sitter på plats innan måsarna börjar häcka.', D_PREMIUM, D_OFFERT] },
  { kampanj: 'Christian | Sök | Fåglar', grupp: 'Fågelspillning', url: URL.fagelspillning, sokvag: ['fågelspillning', 'sanering'],
    rubriker: ['Sanering av fågelspillning', 'Fågelspillning på vinden?', 'Duvträck på balkongen?', 'Sanering av duvträck', 'Gamla bon och fjädrar tas bort', 'Arbetsområdet lämnas rent', 'Skydd mot nya fåglar', 'Skicka en bild på spillningen', 'Rapport när du behöver', ERF, ISO, B],
    beskrivningar: ['Skicka en bild. En mindre sanering kan få pris per telefon, en större kräver inspektion.', 'Spillningen tas bort och arbetsområdet lämnas rent, med rapport om du behöver.', D_PREMIUM, D_RING] },
  { kampanj: 'Christian | Sök | Fåglar', grupp: 'Skyddsjakt', url: URL.skyddsjakt, sokvag: ['skyddsjakt', 'tillstånd'],
    rubriker: ['Skyddsjakt på fåglar', 'Skyddsjakt på duvor', 'Skyddsjakt på måsar', 'Skyddsjakt på kråkor', 'Vi sköter tillstånden', 'Behörig personal', 'Skyddsjakt och fågelsäkring', ERF, ISO, 'Certifierad enligt ISO 14001', OFFERT, INSP, B],
    beskrivningar: ['Vi sköter ansökan och tillstånden och utför jakten med behörig personal.', 'Skyddsjakten kan kombineras med fågelsäkring av tak, fasad och solceller.', D_PREMIUM, D_OFFERT_NI] },

  // Christian | Sök | Vägglöss
  { kampanj: 'Christian | Sök | Vägglöss', grupp: 'Vägglöss sanering', url: URL.vaggloss, sokvag: ['vägglöss', 'tekniker'],
    rubriker: ['Sanering av vägglöss', 'Vägglöss i sängen?', 'Vägglöss hemma?', 'Bli av med vägglöss', ERF, ISO, UPP, 'Överhettad ånga och kiselgur', 'Värmetält när det behövs', FAST, FASTTEL, 'Du kan bo kvar hemma', SAMMA, B],
    beskrivningar: [D_PREMIUM, 'Vi behandlar med överhettad ånga och kiselgur och följer upp tills vägglössen är borta.', 'Du kan bo kvar hemma. Efter kiselgur håller du dig ute ur rummet 2 till 3 timmar.', D_FASTBILD] },
  { kampanj: 'Christian | Sök | Vägglöss', grupp: 'Värmebehandling', url: URL.varme, sokvag: ['vägglöss', 'värmetält'],
    rubriker: ['Värmebehandling av vägglöss', 'Värmetält mot vägglöss', 'Tältet håller 56 grader', 'Fyra givare mäter värmen', 'Kompletteras med ånga', FAST, FASTTEL, ERF, ISO, UPP, 'Sanering av vägglöss', B],
    beskrivningar: ['Tältet håller 56 grader, och fyra givare mäter där värmen har svårast att tränga in.', 'Behandlingen tar 1 till 3 dygn och kompletteras med ånga och kiselgur.', D_PREMIUM, 'Fast pris per telefon eller mejl. Beskriv angreppet, gärna med en bild.'] },
  { kampanj: 'Christian | Sök | Vägglöss', grupp: 'Vägglushund', url: URL.hund, sokvag: ['vägglushund', 'hundsök'],
    rubriker: ['Vägglushund', 'Hundsök efter vägglöss', 'Hund och tekniker söker ihop', 'Behandling där hunden markerar', 'Många rum på kort tid', ERF, ISO, FAST, FASTTEL, B],
    beskrivningar: ['Vår tekniker söker tillsammans med hunden och behandlar där den har markerat.', D_PREMIUM, 'Ungefär 25 lägenheter eller 30 hotellrum hinns med på en halv dag.', 'Fast pris per telefon eller mejl. Beskriv vad som ska sökas igenom.'] },

  // Christian | Sök | Insekter i hemmet
  { kampanj: 'Christian | Sök | Insekter i hemmet', grupp: 'Silverfisk', url: URL.silverfisk, sokvag: ['silverfisk', 'tekniker'],
    rubriker: ['Sanering av silverfisk', 'Silverfisk i badrummet?', 'Långsprötad silverfisk?', 'Bli av med silverfisk', FASTTEL, FAST, ERF, ISO, UPP, 'Gelbete och sprutbehandling', SAMMA, BILDPRIS, B],
    beskrivningar: [D_PREMIUM, D_FASTBILD, 'Vi behandlar med gelbete och sprutbehandling och följer upp tills silverfisken är borta.', D_RING],
    anm: 'Ingen kostnadsfri inspektion för silverfisk.' },
  { kampanj: 'Christian | Sök | Insekter i hemmet', grupp: 'Pälsänger', url: URL.palsanger, sokvag: ['pälsänger', 'tekniker'],
    rubriker: ['Sanering av pälsänger', 'Pälsänger i garderoben?', 'Larver i mattan?', 'Bli av med pälsänger', 'Ånga och preparat', FASTTEL, FAST, ERF, ISO, 'Behandling där larverna lever', SAMMA, BILDPRIS, B],
    beskrivningar: [D_PREMIUM, 'Fast pris per telefon eller mejl. Skicka gärna en bild på larverna eller skadorna.', 'Teknikern behandlar ytorna där larverna lever, med överhettad ånga och preparat.', D_RING] },
  { kampanj: 'Christian | Sök | Insekter i hemmet', grupp: 'Mjölbaggar', url: URL.mjolbaggar, sokvag: ['mjölbaggar', 'tekniker'],
    rubriker: ['Sanering av mjölbaggar', 'Mjölbaggar i köket?', 'Baggar i skafferiet?', 'Bli av med mjölbaggar', FASTTEL, FAST, 'Besked om förberedelserna', ERF, ISO, UPP, SAMMA, BILDPRIS, B],
    beskrivningar: [D_PREMIUM, D_FASTBILD, 'Du tömmer och städar skafferiet före besöket, sedan behandlar vi och följer upp.', D_RING] },

  // Christian | Sök | Möss
  { kampanj: 'Christian | Sök | Möss', grupp: 'Musbekämpning', url: URL.moss, sokvag: ['musbekämpning', 'inspektion'],
    rubriker: ['Musbekämpning', 'Musbekämpning med uppföljning', 'Slagfällor och tätning', 'Vi stänger vägarna in', 'Finmaskigt nät i passagerna', INSP, KF, ERF, ISO, UPP, PLATS, 'ROT på tätningsarbetet', 'Sanering efter möss', B],
    beskrivningar: ['Inomhus använder vi helst slagfällor och tätar sedan passagerna med finmaskigt nät.', D_PREMIUM, 'Vi tar bort bon och spillning och följer upp tills mössen är borta.', D_KF] },
  { kampanj: 'Christian | Sök | Möss', grupp: 'Möss i väggar och vind', url: URL.moss, sokvag: ['möss', 'väggar'],
    rubriker: ['Möss i väggarna?', 'Möss på vinden?', 'Möss i köket?', 'Prassel i väggen?', 'Musbekämpning', 'Slagfällor och tätning', 'Vi stänger vägarna in', 'Vi byter förstörd isolering', INSP, ERF, ISO, UPP, PLATS, 'ROT på tätningsarbetet', B],
    beskrivningar: ['Vi tar bort bon, spillning och förstörd isolering, desinficerar och lägger in ny.', D_PREMIUM, 'Teknikern hittar passagerna, tätar med finmaskigt nät och följer upp tills de är borta.', D_KF] },

  // Christian | Sök | Varumärke
  { kampanj: 'Christian | Sök | Varumärke', grupp: 'Begone', url: URL.start, sokvag: ['skadedjur', 'förfrågan'],
    rubriker: [B, 'Skadedjur och sanering', 'Skicka en förfrågan till oss', 'Kontakta Begone', 'Råttbekämpning', 'Fågelsäkring', 'Sanering av vägglöss', 'Musbekämpning', 'Skadedjursavtal för företag', ERF, ISO, 'Skadedjur inomhus och utomhus', 'Kundportal för avtalskunder', 'Vardagar 08 till 17', 'Skadedjursbekämpning'],
    beskrivningar: ['Råttor, möss, fåglar, vägglöss och andra skadedjur, inomhus och utomhus.', D_PREMIUM, D_RING, 'Vi följer upp tills skadedjuren är borta, och rapport får du när du behöver.'] },

  // Christian | Sök | Företag och avtal
  { kampanj: 'Christian | Sök | Företag och avtal', grupp: 'Skadedjursavtal', url: URL.avtal, sokvag: ['skadedjursavtal', 'företag'],
    rubriker: ['Skadedjursavtal', 'Skadedjursavtal för företag', 'Skadedjursavtal för BRF', 'Avtal efter ert behov', 'Kostnadsfritt första besök', 'Avtalsförslaget binder er inte', 'Stationskarta i kundportalen', 'Kundportal för avtalskunder', 'Rapporter som PDF eller Excel', ERF, ISO, 'Certifierad enligt ISO 14001', 'Tydligt vad avtalet omfattar', B],
    beskrivningar: [D_PREMIUM, 'Det framgår alltid tydligt vad som ingår i avtalet, och det byggs efter ert behov.', 'I kundportalen ser ni stationerna på kartan, besöken och rapporterna.', 'Första besöket är kostnadsfritt, och avtalsförslaget binder er inte.'] },
  { kampanj: 'Christian | Sök | Företag och avtal', grupp: 'Företag och livsmedel', url: URL.foretag, sokvag: ['företag', 'avtal'],
    rubriker: ['Skadedjursbekämpning företag', 'Skadedjur i lokalen?', 'Skadedjur i restaurangen?', 'Skadedjurskontroll livsmedel', 'Skadedjursavtal för företag', 'Avtal efter ert behov', 'Kostnadsfritt första besök', 'Kundportal för avtalskunder', 'Rapporter som PDF eller Excel', ERF, ISO, 'Certifierad enligt ISO 14001', 'Tydligt vad avtalet omfattar', B],
    beskrivningar: [D_PREMIUM, 'Det framgår alltid tydligt vad som ingår i avtalet, och det byggs efter ert behov.', 'Ärenden, kommande besök och utplacerad utrustning ser ni i kundportalen.', D_RING_NI] },
]
