// Kontoplan Google Ads 2026-10-06: kampanjer, annonsgrupper, sökord, annonser, tillägg och negativa listor.
// Källa för gen-ads-kontoplan.mjs (PDF) och för förslagsfilerna i docs/begone-se/ads/andringar/2026-10-06_konto_*.json.
// Texterna är granskade av skadedjursexperten (fakta) och säljchefen (budskap), se PDF:en avsnitt 5.

const BAS = 'https://begone.se';
export const URL = {
  ratt: `${BAS}/tjanster/rattbekampning/`,
  fagelsakring: `${BAS}/tjanster/fagelsakring/`,
  fagelspillning: `${BAS}/tjanster/fagelspillning/`,
  skyddsjakt: `${BAS}/tjanster/skyddsjakt/`,
  vaggloss: `${BAS}/tjanster/vaggloss-sanering/`,
  varme: `${BAS}/tjanster/vaggloss-varmebehandling/`,
  hund: `${BAS}/tjanster/vagglushund/`,
  silverfisk: `${BAS}/tjanster/silverfisk-sanering/`,
  palsanger: `${BAS}/tjanster/palsanger/`,
  mjolbaggar: `${BAS}/tjanster/mjolbaggar/`,
  moss: `${BAS}/tjanster/moss/`,
  getingar: `${BAS}/tjanster/getingar/`,
  myror: `${BAS}/tjanster/myror/`,
  avtal: `${BAS}/tjanster/skadedjursavtal/`,
  foretag: `${BAS}/skadedjursbekampning-foretag/`,
  start: `${BAS}/`,
  kontakt: `${BAS}/kontakt/`,
  om: `${BAS}/om-oss/`,
  pris: (slug) => `${BAS}/prisforslag/?tjanst=${slug}`,
};

// Gemensamma rader
const H_BEGONE = 'Begone Skadedjur';
const H_ERFARNA = 'Erfarna skadedjurstekniker';
const H_ISO = 'ISO 9001 och ISO 14001';
const H_BILDER = 'Skicka förfrågan med bilder';
const H_SAMMA = 'Ofta hjälp redan samma dag';
const H_PLATS = 'Ofta på plats redan samma dag';
const H_OFFERT = 'Skriftlig offert efter besöket';
const D_OFFERT = 'Du får teknikerns bedömning och en skriftlig offert efter en kostnadsfri inspektion.';
const D_OFFERT_NI = 'Ni får teknikerns bedömning och en skriftlig offert efter en kostnadsfri inspektion.';
const H_INSP = 'Kostnadsfri inspektion';
const H_KF = 'Kostnadsförslag efter besöket';
const H_FAST = 'Fast pris innan vi börjar';
const H_BILDPRIS = 'Skicka en bild, få ett pris';
const D_RING = 'Skicka förfrågan med bilder när det passar. Vardagar 08 till 17 ringer vi upp samma dag.';
const D_RING_NI = 'Skicka en förfrågan när det passar. Vardagar 08 till 17 ringer vi upp samma dag.';
const D_KF = 'Du får teknikerns bedömning och ett kostnadsförslag att gå igenom i lugn och ro.';
const D_PREMIUM = 'Erfarna skadedjurstekniker i en organisation certifierad enligt ISO 9001 och 14001.';

// Budstrategi per fas gäller alla sökkampanjer om inget annat står.
export const kampanjer = [
  {
    namn: 'Sök | Råttor', kort: 'ratt', prio: 1, budget: 1550, start: 'Fas 1',
    bud: 'Maximera konverteringar utan mål-CPA vecka 1 till 4, sedan mål-CPA (start cirka 650 kr)',
    sitelinks: 'ratt',
    grupper: [
      {
        namn: 'Råttbekämpning', avsikt: 'Vill anlita någon', url: URL.ratt, sokvag: ['råttbekämpning', 'inspektion'],
        sokord: { exakt: ['råttbekämpning', 'råttsanering', 'sanering råttor', 'råttbekämpning stockholm', 'råttsanering stockholm'], fras: ['råttbekämpning', 'råttsanering', 'sanering råttor', 'sanera råttor', 'bekämpa råttor', 'bli av med råttor', 'få bort råttor', 'utrota råttor', 'hjälp med råttor', 'skadedjur råttor'] },
        rubriker: ['Råttbekämpning', 'Råttsanering och bekämpning', H_INSP, 'Teknikern hittar vägen in', 'Vi stänger vägarna in', 'Rätt metod för varje plats', 'Sanering efter råttor', H_KF, 'Råttor inomhus och utomhus', 'Rapport för försäkringsbolaget', H_ERFARNA, H_ISO, H_PLATS, H_BILDER, H_BEGONE],
        rot: true, insp: true,
        beskrivningar: ['Teknikern tar reda på hur råttorna tar sig in och vad som håller dem kvar.', D_KF, 'Vi stänger vägarna in, bekämpar och sanerar. Privatpersoner får ROT på tätningsarbetet.', D_RING],
      },
      {
        namn: 'Råttor inomhus', avsikt: 'Symptom i huset', url: URL.ratt, sokvag: ['råttor', 'inomhus'],
        sokord: { exakt: ['råttor i huset', 'råttor i väggarna'], fras: ['råttor i huset', 'råtta i huset', 'råttor inomhus', 'bli av med råttor inomhus', 'råttor i väggen', 'råttor i väggarna', 'råttor på vinden', 'råttor i taket', 'råttor i källaren', 'råttor i krypgrunden', 'råtta i köket', 'täta mot råttor'] },
        rubriker: ['Råttor i huset?', 'Hör du råttor i väggen?', 'Spillning eller gnagspår?', 'Råttbekämpning inomhus', H_INSP, 'Teknikern hittar vägen in', 'Vi stänger vägarna in', 'Sanering efter råttor', H_KF, 'Rapport för försäkringsbolaget', H_ERFARNA, H_ISO, H_PLATS, H_BILDER, H_BEGONE],
        rot: true, insp: true,
        beskrivningar: ['Teknikern hittar var råttorna tar sig in i huset, stänger vägarna och bekämpar.', 'Vi sanerar efter råttorna, även isoleringen. Privatpersoner får ROT på tätningen.', D_KF, D_RING],
      },
      {
        namn: 'Råttor utomhus', avsikt: 'Symptom på tomten', url: URL.ratt, sokvag: ['råttor', 'utomhus'],
        sokord: { exakt: ['råttor i trädgården'], fras: ['råttor i trädgården', 'bli av med råttor i trädgården', 'råttor på tomten', 'råtta i trädgården', 'bekämpa råttor utomhus', 'råttbekämpning utomhus', 'råttor under altanen', 'råttor i komposten', 'råttor under huset'] },
        rubriker: ['Råttor på tomten?', 'Råttor i trädgården?', 'Råttor under altanen?', 'Råttbekämpning utomhus', H_INSP, 'Vi ser vad som lockar råttorna', 'Teknikern hittar vägen in', 'Rätt metod för varje plats', H_KF, H_ERFARNA, H_ISO, H_PLATS, H_BILDER, H_BEGONE],
        rot: true, insp: true,
        beskrivningar: ['Teknikern ser vad som lockar råttorna till tomten och var de kan ta sig in i huset.', 'Tätning, mekaniska fällor, betongstationer, betesstationer och råtthund, efter platsen.', D_KF, D_RING],
      },
      {
        namn: 'Råttor i avlopp', avsikt: 'Avlopp', url: URL.ratt, sokvag: ['råttor', 'avlopp'],
        sokord: { exakt: ['råttspärr', 'råttstopp'], fras: ['råttor i avloppet', 'råttor i avloppsrören', 'råtta i toaletten', 'råtta i toalettstolen', 'råttspärr', 'råttstopp', 'råttstopp avlopp', 'råttspärr avlopp'] },
        rubriker: ['Råttor i avloppet?', 'Råttor upp genom toaletten?', 'Råttspärr i avloppet', 'Vi monterar råttspärr', 'Vi hittar var de tar sig in', 'Vi stänger vägen ur avloppet', 'Rapport för försäkringsbolaget', 'Råttbekämpning', 'Råttbekämpning i sex län', 'Sanering efter råttor', H_KF, H_BILDER, 'Vi ringer när vi ser förfrågan', H_BEGONE],
        rot: true,
        beskrivningar: ['Råttor ur avloppet? Vi ser till att skadan hittas och lagas, och monterar råttspärr.', 'Vi stänger vägen upp ur avloppet och sanerar efter råttorna, med rapport om du vill.', D_KF, D_RING],
        anm: 'Bygger på texterna från råttrapporten 2026-10-06, beskrivning 1 rättad av experten. Ingen "kostnadsfri inspektion" här (kan läsas som gratis rörinspektion).',
      },
      {
        namn: 'Råttor i fastighet', avsikt: 'BRF, fastighetsägare och företag', url: URL.ratt + '?kundtyp=foretag', sokvag: ['råttbekämpning', 'fastighet'],
        sokord: { exakt: [], fras: ['råttor i soprummet', 'råttor brf', 'råttbekämpning brf', 'råttor bostadsrättsförening', 'råttor i fastigheten', 'råttbekämpning företag', 'råttor restaurang', 'råttor i lokalen'] },
        rubriker: ['Råttor i fastigheten?', 'Råttor i soprummet?', 'Råttbekämpning för BRF', 'Råttbekämpning för företag', H_INSP, 'Teknikern hittar vägen in', 'Vi stänger vägarna in', 'Rapport när ni behöver', 'Kundportal för avtalskunder', H_KF, H_ERFARNA, H_ISO, H_BEGONE],
        insp: true,
        beskrivningar: ['Teknikern hittar var råttorna kommer in i fastigheten och vad som håller dem kvar.', 'Med skadedjursavtal ser ni ärenden, besök och utrustning i kundportalen.', 'Ni får teknikerns bedömning och ett kostnadsförslag efter en kostnadsfri inspektion.', D_RING_NI],
      },
    ],
  },
  {
    namn: 'Sök | Fåglar', kort: 'fagel', prio: 1, budget: 800, start: 'Fas 1',
    bud: 'Maximera konverteringar utan mål-CPA vecka 1 till 4, sedan mål-CPA efter utfallet',
    sitelinks: 'fagel',
    grupper: [
      {
        namn: 'Fågelsäkring', avsikt: 'Vill ha skydd monterat', url: URL.fagelsakring, sokvag: ['fågelsäkring', 'inspektion'],
        sokord: { exakt: ['fågelsäkring', 'fågelskydd tak'], fras: ['fågelsäkring', 'fågelskydd tak', 'fågelskydd fasad', 'fågelskydd solceller', 'duvor solceller', 'fåglar under solceller', 'montera fågelnät', 'fågelnät montering', 'fågelsäkra taket', 'bli av med fåglar på taket'] },
        rubriker: ['Fågelsäkring', 'Fågelskydd för tak och fasad', 'Fågelskydd för solceller', 'Nät, piggar, vajer och band', H_INSP, 'Skydd valt efter platsen', 'Utan håltagning i tätskiktet', 'Vi monterar på hög höjd', 'Gamla bon tas bort', H_OFFERT, H_ERFARNA, H_ISO, H_BILDER, H_BEGONE],
        rot: 'fagel',
        beskrivningar: ['Vi väljer nät, piggar, vajer eller fågelband efter platsen och fåglarna.', 'Vi tar bort gamla bon och spillning när skyddet monteras. Privatpersoner får i regel ROT.', D_OFFERT, D_RING],
      },
      {
        namn: 'Duvor', avsikt: 'Problem med duvor', url: URL.fagelsakring, sokvag: ['fågelsäkring', 'duvor'],
        sokord: { exakt: ['problem med duvor'], fras: ['problem med duvor', 'duvor på balkongen', 'duvor på taket', 'få bort duvor', 'bli av med duvor', 'duvor på vinden', 'fågelskydd balkong', 'duvor häckar'] },
        rubriker: ['Problem med duvor?', 'Duvor på balkongen?', 'Duvor på taket?', 'Fågelskydd mot duvor', H_INSP, 'Skydd valt efter platsen', 'Nät, piggar, vajer och band', 'Sanering av duvträck', H_OFFERT, H_ERFARNA, H_ISO, H_BILDER, H_BEGONE],
        rot: 'fagel',
        beskrivningar: ['Teknikern ser var duvorna sitter och häckar och väljer skydd efter platsen.', 'Vi sanerar spillningen och monterar nät, piggar eller vajer, valt efter platsen.', D_OFFERT, D_RING],
      },
      {
        namn: 'Måsar och trutar', avsikt: 'Måsar på taket', url: URL.fagelsakring, sokvag: ['fågelsäkring', 'måsar'],
        sokord: { exakt: [], fras: ['måsar på taket', 'fiskmåsar på taket', 'få bort måsar', 'få bort fiskmåsar', 'trutar på taket', 'måsar häckar på taket', 'fiskmås bo tak', 'ta bort måsbo'] },
        rubriker: ['Måsar på taket?', 'Fiskmåsar på taket?', 'Måsar och trutar på taket', 'Fågelskydd mot måsar', 'Montera skydd före häckningen', H_INSP, 'Skydd valt efter taket', 'Vi monterar på hög höjd', H_OFFERT, H_ERFARNA, H_ISO, H_BILDER, H_BEGONE],
        rot: 'fagel',
        beskrivningar: ['Skyddet monteras helst innan häckningen börjar, utan håltagning i tätskiktet.', 'Vi monterar nät, vajer eller piggar på taket, valt efter platsen och fåglarna.', D_OFFERT, D_RING],
      },
      {
        namn: 'Fågelspillning', avsikt: 'Sanering', url: URL.fagelspillning, sokvag: ['fågelspillning', 'sanering'],
        sokord: { exakt: ['sanera fågelspillning', 'fågelsanering'], fras: ['sanera fågelspillning', 'sanering fågelspillning', 'fågelsanering', 'duvträck', 'sanering duvträck', 'duvspillning', 'fågelspillning vind', 'fågelspillning balkong'] },
        rubriker: ['Sanering av fågelspillning', 'Sanering av duvträck', 'Duvträck på vinden?', 'Fågelspillning på balkongen?', 'Arbetsområdet lämnas rent', H_INSP, 'Skydd mot nya fåglar', H_OFFERT, H_ERFARNA, H_ISO, H_BILDER, H_BEGONE],
        beskrivningar: ['Vi tar bort spillning, bon och fjädrar och lämnar arbetsområdet rent.', 'Teknikern ser också hur fåglarna tar sig in och föreslår skydd mot nya fåglar.', D_OFFERT, D_RING],
      },
      {
        namn: 'Skyddsjakt', avsikt: 'Företag och fastighet', url: URL.skyddsjakt, sokvag: ['skyddsjakt', 'fåglar'],
        sokord: { exakt: [], fras: ['skyddsjakt duvor', 'skyddsjakt fåglar', 'skyddsjakt måsar', 'skyddsjakt kråkor', 'skyddsjakt fiskmås', 'skjuta duvor'] },
        rubriker: ['Skyddsjakt på duvor', 'Skyddsjakt på måsar', 'Skyddsjakt på fåglar', 'Vi sköter tillstånden', 'Behörig personal', 'Skyddsjakt och fågelsäkring', H_INSP, H_OFFERT, H_ERFARNA, H_ISO, H_BEGONE],
        beskrivningar: ['Vi bedömer vad lagen tillåter på er plats och sköter ansökan och tillstånden.', 'Skyddsjakten utförs av behörig personal och kan kombineras med fågelsäkring.', D_OFFERT_NI, D_RING_NI],
      },
    ],
  },
  {
    namn: 'Sök | Vägglöss', kort: 'vaggloss', prio: 2, budget: 600, start: 'Fas 1',
    bud: 'Maximera konverteringar utan mål-CPA vecka 1 till 4, sedan mål-CPA',
    sitelinks: 'vaggloss',
    grupper: [
      {
        namn: 'Vägglöss sanering', avsikt: 'Vill anlita någon', url: URL.vaggloss, sokvag: ['vägglöss', 'sanering'],
        sokord: { exakt: ['sanering vägglöss', 'vägglöss sanering'], fras: ['sanering vägglöss', 'vägglöss sanering', 'sanera vägglöss', 'vägglöss bekämpning', 'bli av med vägglöss', 'vägglöss i sängen', 'vägglöss stockholm', 'vägglöss sanering kostnad'] },
        rubriker: ['Sanering av vägglöss', 'Vägglöss i sängen?', 'Ånga, kiselgur och värmetält', H_FAST, 'Fast pris per telefon', 'Beskriv angreppet, få ett pris', 'Du kan bo kvar hemma', 'Vägglushund när det behövs', H_ERFARNA, H_ISO, H_SAMMA, H_BILDER, H_BEGONE],
        beskrivningar: ['Beskriv angreppet, gärna med en bild, så får du ett fast pris innan vi börjar.', 'Överhettad ånga och kiselgur, och värmetält när det behövs en kraftigare åtgärd.', D_PREMIUM, D_RING],
      },
      {
        namn: 'Värmebehandling', avsikt: 'Vill ha värmetält', url: URL.varme, sokvag: ['vägglöss', 'värmetält'],
        sokord: { exakt: ['värmebehandling vägglöss'], fras: ['värmebehandling vägglöss', 'värmetält vägglöss', 'värmesanering vägglöss', 'värmebehandling mot vägglöss'] },
        rubriker: ['Värmebehandling av vägglöss', 'Värmetält mot vägglöss', H_FAST, 'Beskriv angreppet, få ett pris', 'Sanering av vägglöss', H_ERFARNA, H_ISO, 'Vi packar tältet åt dig', H_BILDER, H_BEGONE],
        beskrivningar: ['Värmetält när problemet kommer tillbaka eller du vill ha den kraftigaste åtgärden.', 'Beskriv angreppet, gärna med en bild, så får du ett fast pris innan vi börjar.', D_PREMIUM, D_RING],
      },
      {
        namn: 'Vägglushund', avsikt: 'Hundsök', url: URL.hund, sokvag: ['vägglushund'],
        sokord: { exakt: ['vägglushund'], fras: ['vägglushund', 'vägglushund pris', 'hund vägglöss', 'hundsök vägglöss', 'vägglöss hund'] },
        rubriker: ['Vägglushund', 'Hundsök efter vägglöss', 'Hunden söker på lukten', 'Behandling där hunden markerar', H_FAST, 'Många rum på kort tid', H_ERFARNA, H_ISO, H_BILDER, H_BEGONE],
        beskrivningar: ['Hunden är luktränad mot levande vägglöss och ägg och markerar där den känner lukten.', 'Hunden söker ihop med vår tekniker, som sedan behandlar där hunden har markerat.', 'Hunden hinner ungefär 25 lägenheter eller 30 hotellrum på en halv dag.', 'Beskriv vad som ska sökas igenom, så får du ett fast pris innan vi börjar.'],
      },
    ],
  },
  {
    namn: 'Sök | Insekter i hemmet', kort: 'insekter', prio: 2, budget: 450, start: 'Fas 1',
    bud: 'Maximera konverteringar utan mål-CPA vecka 1 till 4, sedan mål-CPA',
    sitelinks: 'insekter',
    grupper: [
      {
        namn: 'Silverfisk', avsikt: 'Vill anlita någon', url: URL.silverfisk, sokvag: ['silverfisk', 'sanering'],
        sokord: { exakt: ['sanera silverfisk'], fras: ['sanera silverfisk', 'sanering silverfisk', 'silverfisk sanering', 'bekämpa silverfisk', 'bli av med silverfiskar', 'få bort silverfiskar', 'långsprötad silverfisk', 'silverfisk bekämpning'] },
        rubriker: ['Sanering av silverfisk', 'Långsprötad silverfisk?', 'Silverfisk i badrummet?', H_FAST, 'Fast pris per telefon', H_BILDPRIS, 'Gelbete och sprutbehandling', H_ERFARNA, H_ISO, H_SAMMA, H_BEGONE],
        beskrivningar: ['Beskriv vad du ser, gärna med bild, så får du ett fast pris och vi kommer och behandlar.', 'Vi behandlar med gelbete och ett vattenlösligt preparat med tryckspruta.', D_PREMIUM, D_RING],
      },
      {
        namn: 'Pälsänger', avsikt: 'Vill anlita någon', url: URL.palsanger, sokvag: ['pälsänger', 'sanering'],
        sokord: { exakt: ['bli av med pälsänger'], fras: ['bli av med pälsänger', 'bli av med pälsängrar', 'pälsänger sanering', 'sanera pälsänger', 'få bort pälsängrar', 'pälsänger i sängen', 'pälsängerlarver'] },
        rubriker: ['Sanering av pälsänger', 'Pälsängerlarver hemma?', 'Hål i ull och päls?', H_FAST, 'Fast pris per telefon', H_BILDPRIS, 'Ånga och preparat', H_ERFARNA, H_ISO, H_SAMMA, H_BEGONE],
        beskrivningar: ['Larver eller hål i ull och päls? Beskriv angreppet, gärna med en bild, så får du ett pris.', 'Vi behandlar ytorna där larverna lever med överhettad ånga och preparat.', D_PREMIUM, D_RING],
      },
      {
        namn: 'Mjölbaggar', avsikt: 'Vill anlita någon', url: URL.mjolbaggar, sokvag: ['mjölbaggar', 'sanering'],
        sokord: { exakt: ['bli av med mjölbaggar'], fras: ['bli av med mjölbaggar', 'mjölbaggar sanering', 'sanera mjölbaggar', 'mjölbaggar i skafferiet', 'mjölbaggar försvinner inte', 'skalbaggar i skafferiet'] },
        rubriker: ['Sanering av mjölbaggar', 'Mjölbaggar i skafferiet?', 'Småkryp i skafferiet?', H_FAST, 'Fast pris per telefon', H_BILDPRIS, 'Besked om förberedelserna', H_ERFARNA, H_ISO, H_SAMMA, H_BEGONE],
        beskrivningar: ['Skicka en bild på det du ser, så får du ett fast pris och besked om förberedelserna.', 'Före besöket tömmer och städar du skafferiet och skåpen bredvid, sedan behandlar vi.', D_PREMIUM, D_RING],
      },
    ],
  },
  {
    namn: 'Sök | Möss', kort: 'moss', prio: 3, budget: 450, start: 'Fas 1',
    bud: 'Maximera konverteringar utan mål-CPA vecka 1 till 4, sedan mål-CPA',
    sitelinks: 'moss',
    grupper: [
      {
        namn: 'Musbekämpning', avsikt: 'Vill anlita någon', url: URL.moss, sokvag: ['musbekämpning'],
        sokord: { exakt: ['musbekämpning'], fras: ['musbekämpning', 'bekämpa möss', 'sanering möss', 'skadedjursbekämpning möss', 'bli av med möss', 'utrota möss', 'tätning möss', 'tätning mot möss'] },
        rubriker: ['Musbekämpning', 'Möss i huset?', 'Teknikern hittar vägarna in', 'Vi stänger vägarna in', 'Sanering efter möss', 'Inspektion och kostnadsförslag', H_KF, H_ERFARNA, H_ISO, H_PLATS, H_BILDER, H_BEGONE],
        rot: true, insp: true,
        beskrivningar: ['Teknikern hittar var mössen tar sig in, bekämpar och stänger vägarna in.', 'Vi sanerar där mössen har varit. Privatpersoner får ROT på tätningsarbetet.', D_KF, D_RING],
      },
      {
        namn: 'Möss i väggar och vind', avsikt: 'Symptom i huset', url: URL.moss, sokvag: ['möss', 'i-huset'],
        sokord: { exakt: ['möss i väggarna'], fras: ['möss i väggarna', 'möss i väggen', 'möss på vinden', 'möss i huset', 'mus i huset', 'möss i hus', 'möss i taket', 'möss i köket'] },
        rubriker: ['Möss i väggarna?', 'Hör du möss i väggarna?', 'Möss på vinden?', 'Möss i huset?', 'Teknikern hittar vägarna in', 'Vi stänger vägarna in', 'Sanering efter möss', H_KF, H_ERFARNA, H_ISO, H_PLATS, H_BILDER, H_BEGONE],
        rot: true, insp: true,
        beskrivningar: ['Teknikern hittar var mössen tar sig in, bekämpar och stänger vägarna in.', 'Vi sanerar där mössen har varit. Privatpersoner får ROT på tätningsarbetet.', D_KF, D_RING],
      },
    ],
  },
  {
    namn: 'Sök | Varumärke', kort: 'varumarke', prio: 1, budget: 180, start: 'Fas 1',
    bud: 'Maximera klick med tak 12 kr per klick (byte till Målvisningsandel 90 % om andelen är låg)',
    sitelinks: 'konto',
    grupper: [
      {
        namn: 'Begone', avsikt: 'Söker oss', url: URL.start, sokvag: ['skadedjur'],
        sokord: { exakt: ['begone', 'begone skadedjur', 'be gone', 'begone skadedjur & sanering ab', 'begone skadedjur och sanering', 'begone skadedjursbekämpning', 'begone se'], fras: ['begone skadedjur', 'begone sanering'] },
        rubriker: [H_BEGONE, 'Begone Skadedjur och Sanering', 'Kontakta Begone', 'Skicka en förfrågan', 'Skadedjursbekämpning', 'Vardagar 08 till 17', H_ERFARNA, H_ISO, 'Verksamma i sex län', 'Skadedjur inomhus och utomhus', 'Skadedjursavtal för företag', 'Kundportal för avtalskunder'],
        beskrivningar: ['Skicka en förfrågan när det passar. Vardagar 08 till 17 ringer vi upp samma dag.', D_PREMIUM, 'Avtalskunder ser ärenden, kommande besök och utrustning i kundportalen.', 'Du får teknikerns bedömning och ett pris innan vi börjar.'],
      },
    ],
  },
  {
    namn: 'Sök | Företag och avtal', kort: 'foretag', prio: 3, budget: 200, start: 'Fas 1',
    bud: 'Maximera konverteringar utan mål-CPA; bedöms på bokade möten och avtal, inte formulär',
    sitelinks: 'foretag',
    grupper: [
      {
        namn: 'Skadedjursavtal', avsikt: 'Företag som vill ha avtal', url: URL.avtal, sokvag: ['skadedjursavtal'],
        sokord: { exakt: ['skadedjursavtal'], fras: ['skadedjursavtal', 'skadedjursavtal företag', 'skadedjursavtal brf', 'skadedjursavtal restaurang', 'avtal skadedjur'] },
        rubriker: ['Skadedjursavtal', 'Skadedjursavtal för företag', 'Kostnadsfritt första besök', 'Avtal efter ert behov', 'Kundportal för avtalskunder', 'Rapporter som PDF eller Excel', 'Avtalsförslaget binder er inte', H_ERFARNA, H_ISO, H_BEGONE],
        beskrivningar: ['Frekvens, avtalstid och utryckningar styrs av vad er verksamhet behöver.', 'I kundportalen ser ni ärenden, kommande besök och utplacerad utrustning.', 'Rapporterna laddar ni ned som PDF eller Excel när ni behöver dem.', 'Första besöket är kostnadsfritt, och avtalsförslaget binder er inte.'],
      },
      {
        namn: 'Företag och livsmedel', avsikt: 'Företag som söker hjälp', url: URL.foretag, sokvag: ['företag'],
        sokord: { exakt: ['skadedjursbekämpning företag'], fras: ['skadedjursbekämpning företag', 'skadedjurskontroll restaurang', 'skadedjurskontroll livsmedel', 'skadedjur restaurang', 'skadedjur livsmedelslokal', 'skadedjursbekämpning fastighet'] },
        rubriker: ['Skadedjursbekämpning företag', 'Skadedjursavtal för företag', 'Kostnadsfritt första besök', 'Avtal efter ert behov', 'Kundportal för avtalskunder', 'Rapporter som PDF eller Excel', 'Avtalsförslaget binder er inte', H_ERFARNA, H_ISO, H_BEGONE],
        beskrivningar: ['Frekvens, avtalstid och utryckningar styrs av vad er verksamhet behöver.', 'I kundportalen ser ni ärenden, kommande besök och utplacerad utrustning.', 'Rapporterna laddar ni ned som PDF eller Excel när ni behöver dem.', 'Första besöket är kostnadsfritt, och avtalsförslaget binder er inte.'],
        anm: 'Samma texter som Skadedjursavtal, egen landning enligt säljchefen.',
      },
    ],
  },
  {
    namn: 'Sök | Getingar (säsong)', kort: 'getingar', prio: 4, budget: 0, start: 'Pausad till juni 2027',
    bud: 'Maximera konverteringar; budget sätts inför säsongen',
    sitelinks: 'konto',
    grupper: [
      {
        namn: 'Getingbo', avsikt: 'Vill få boet borttaget', url: URL.getingar, sokvag: ['getingar', 'getingbo'],
        sokord: { exakt: ['ta bort getingbo', 'getingbo ta bort'], fras: ['ta bort getingbo', 'få bort getingbo', 'getingbo under taket', 'getingbo i fasaden', 'sanera getingbo', 'getingsanering', 'getingbo borttagning', 'hjälp att ta bort getingbo', 'bålgetingbo'] },
        rubriker: ['Ta bort getingbo', 'Getingbo under taket?', 'Getingbo i fasaden?', 'Getingsanering', H_FAST, 'Fast pris per telefon', 'Även högt upp med fallskydd', 'Bålgetingbo?', H_ERFARNA, H_ISO, H_SAMMA, H_BEGONE],
        beskrivningar: ['Getingbon och bålgetingbon bekämpar vi där de sitter, också högt upp med fallskydd.', 'Beskriv var boet sitter, gärna med en bild, så får du ett fast pris innan vi kommer.', D_PREMIUM, D_RING],
      },
    ],
  },
  {
    namn: 'Sök | Myror (säsong)', kort: 'myror', prio: 4, budget: 0, start: 'Pausad till maj 2027',
    bud: 'Maximera konverteringar; budget sätts inför säsongen',
    sitelinks: 'konto',
    grupper: [
      {
        namn: 'Myror', avsikt: 'Vill anlita någon', url: URL.myror, sokvag: ['myror'],
        sokord: { exakt: ['myrbekämpning'], fras: ['myrbekämpning', 'myror inomhus', 'hästmyror i huset', 'bli av med myror', 'få bort myror', 'bekämpa myror', 'myror i huset', 'flytta myrstack'] },
        rubriker: ['Myrbekämpning', 'Myror inomhus?', 'Hästmyror i huset?', 'Myror i huset?', 'Vi flyttar även större stackar', 'Metod efter situationen', H_ERFARNA, H_ISO, H_SAMMA, H_BILDER, H_BEGONE],
        beskrivningar: ['Hästmyror eller myror inomhus? Teknikern väljer metod efter situationen.', 'Vi flyttar även större myrstackar när de behöver bort.', D_PREMIUM, D_RING],
      },
    ],
  },
];

// Webbplatslänkar: text högst 25, rader högst 35.
export const webbplatslankar = {
  ratt: [
    ['Kostnadsfri inspektion', 'Skicka en förfrågan med bilder', 'Vardagar 08 till 17 ringer vi upp', URL.pris('rattbekampning')],
    ['Företag och fastigheter', 'Hela organisationen i ett avtal', 'Stationskarta i kundportalen', URL.foretag],
    ['Skadedjursavtal', 'Första besöket är kostnadsfritt', 'Avtalsförslaget binder er inte', URL.avtal],
    ['Kontakta oss', 'Skicka en förfrågan', 'Vardagar 08 till 17', URL.kontakt],
  ],
  fagel: [
    ['Kostnadsfri inspektion', 'Skicka en förfrågan med bilder', 'Vardagar 08 till 17 ringer vi upp', URL.pris('fagelsakring')],
    ['Fågelspillning', 'Arbetsområdet lämnas rent', 'Skydd mot nya fåglar', URL.fagelspillning],
    ['Skyddsjakt', 'Vi sköter tillstånden', 'Utförs av behörig personal', URL.skyddsjakt],
    ['Kontakta oss', 'Skicka en förfrågan', 'Vardagar 08 till 17', URL.kontakt],
  ],
  vaggloss: [
    ['Få ett fast pris', 'Beskriv angreppet med en bild', 'Fast pris innan vi börjar', URL.pris('vaggloss-sanering')],
    ['Värmebehandling', 'Behandling i värmetält', 'Fast pris innan vi börjar', URL.varme],
    ['Vägglushund', 'Hunden söker på lukten', 'Många rum på kort tid', URL.hund],
    ['Kontakta oss', 'Skicka en förfrågan', 'Vardagar 08 till 17', URL.kontakt],
  ],
  insekter: [
    ['Silverfisk', 'Gelbete och sprutbehandling', 'Fast pris innan vi börjar', URL.silverfisk],
    ['Pälsänger', 'Ånga och preparat', 'Fast pris innan vi börjar', URL.palsanger],
    ['Mjölbaggar', 'Skicka en bild, få ett pris', 'Besked om förberedelserna', URL.mjolbaggar],
    ['Kontakta oss', 'Skicka en förfrågan', 'Vardagar 08 till 17', URL.kontakt],
  ],
  moss: [
    ['Skicka en förfrågan', 'Beskriv vad du hör och ser', 'Vardagar 08 till 17 ringer vi upp', URL.pris('moss')],
    ['Råttor eller möss?', 'Teknikern ser skillnaden', 'Råttbekämpning', URL.ratt],
    ['Skadedjursavtal', 'Första besöket är kostnadsfritt', 'Avtalsförslaget binder er inte', URL.avtal],
    ['Kontakta oss', 'Skicka en förfrågan', 'Vardagar 08 till 17', URL.kontakt],
  ],
  foretag: [
    ['Företag och fastigheter', 'Hela organisationen i ett avtal', 'Stationskarta i kundportalen', URL.foretag],
    ['Skicka en förfrågan', 'Vi ringer upp er', 'Vardagar 08 till 17', URL.pris('skadedjursavtal')],
    ['Kontakta oss', 'Skicka en förfrågan', 'Vardagar 08 till 17', URL.kontakt],
    ['Om Begone', 'ISO 9001 och ISO 14001', 'Erfarna skadedjurstekniker', URL.om],
  ],
  konto: [
    ['Skicka en förfrågan', 'Beskriv vad du ser, gärna med bild', 'Vardagar 08 till 17 ringer vi upp', `${BAS}/prisforslag/`],
    ['Skadedjursavtal', 'Första besöket är kostnadsfritt', 'Avtalsförslaget binder er inte', URL.avtal],
    ['Om Begone', 'ISO 9001 och ISO 14001', 'Erfarna skadedjurstekniker', URL.om],
    ['Kontakta oss', 'Skicka en förfrågan', 'Vardagar 08 till 17', URL.kontakt],
  ],
};

// Framhävningar högst 25 tecken.
export const framhavningar = {
  konto: ['ISO 9001 och ISO 14001', 'Erfarna tekniker', 'Verksamma i sex län', 'Rapport när du behöver'],
  ratt: ['Sanering efter råttor'],
  fagel: ['Kostnadsfri inspektion', 'Arbete på hög höjd'],
  vaggloss: ['Fast pris innan vi börjar', 'Du kan bo kvar hemma'],
  insekter: ['Fast pris innan vi börjar', 'Fast pris efter en bild'],
  moss: ['Sanering efter möss'],
  foretag: ['Kundportal med avtalet', 'Rapporter i PDF och Excel', 'Avtal efter ert behov'],
};

// ROT-framhävningen läggs på annonsgruppsnivå (grupper med rot: true eller rot: 'fagel'), aldrig på BRF, företag, sanering eller jakt.
export const rotFramhavning = { true: 'ROT på tätningsarbetet', fagel: 'ROT på montering av skydd' };

export const utdrag = {
  ratt: ['Tjänster', ['Tätning', 'Mekaniska fällor', 'Betongstationer', 'Betesstationer', 'Råtthund', 'Råttspärr', 'Råttsanering']],
  fagel: ['Tjänster', ['Fågelnät', 'Piggar', 'Vajer', 'Fågelband', 'Sanering av spillning', 'Fågelplock', 'Skyddsjakt']],
  vaggloss: ['Tjänster', ['Överhettad ånga', 'Kiselgur', 'Värmetält', 'Vägglushund']],
  insekter: ['Tjänster', ['Silverfisk', 'Pälsänger', 'Mjölbaggar', 'Vägglöss']],
  moss: ['Tjänster', ['Tätning', 'Mekaniska fällor', 'Betesstationer', 'Sanering efter möss']],
  foretag: ['Tjänster', ['Skadedjursavtal', 'Kontrollbesök', 'Kundportal', 'Rapporter', 'Fågelsäkring', 'Skyddsjakt']],
  konto: ['Tjänster', ['Råttbekämpning', 'Fågelsäkring', 'Musbekämpning', 'Vägglöss', 'Silverfisk', 'Pälsänger', 'Mjölbaggar']],
};

// Delade negativa listor (alla sökkampanjer utom Varumärke där inget annat står). F = fras, E = exakt, B = bred.
export const negativaListor = [
  { namn: 'Neg | Konkurrenter', typ: 'F', ord: ['anticimex', 'antisimex', 'anricimex', 'anticimx', 'rentokil', 'rent o kill', 'rent to kill', 'rentokill', 'nomor', 'no more', 'nomore', 'lf skadedjur', 'svensk skadedjurskontroll', 'insecta', 'skadedjursbutiken', 'nomus', 'mitt skadedjur', 'skadedjursexperten'] },
  { namn: 'Neg | Försäkringsbolag', typ: 'F', ord: ['trygg hansa', 'trygghansa', 'länsförsäkringar', 'folksam', 'if skadeförsäkring', 'dina försäkringar', 'moderna försäkringar', 'gjensidige', 'ica försäkring'] },
  { namn: 'Neg | Gör det själv och produkter', typ: 'F', ord: ['själv', 'själva', 'gör det själv', 'råttgift', 'musgift', 'gift mot', 'köpa', 'köp', 'pris på fälla', 'råttfälla', 'musfälla', 'fällor', 'klisterfälla', 'limfälla', 'ultraljud', 'skrämma', 'skrämmer', 'avskräckare', 'pepparmynta', 'tjära', 'huskur', 'huskurer', 'hemmagjord', 'recept', 'spray', 'bauhaus', 'biltema', 'clas ohlson', 'jula', 'hornbach', 'plantagen', 'byggmax', 'amazon', 'blocket', 'repello', 'powersnap', 'fågelpiggar köpa', 'fågelnät köpa', 'duvskrämma', 'fågelskrämma', 'myrgift', 'getingfälla', 'vägglusfälla'] },
  { namn: 'Neg | Jobb och utbildning', typ: 'F', ord: ['jobb', 'lediga jobb', 'lön', 'utbildning', 'kurs', 'behörighet', 'bli skadedjurstekniker', 'anställning', 'praktik', 'yrke', 'arbetsförmedlingen', 'skadedjurstekniker lön'] },
  { namn: 'Neg | Information', typ: 'F', ord: ['wikipedia', 'fakta om', 'bilder på', 'bild på', 'latin', 'livslängd', 'vad äter', 'hur länge lever', 'hur många', 'film', 'youtube', 'tecknad', 'tamråtta', 'råtta som husdjur', 'köpa råtta', 'hamster', 'farliga för hund', 'drömmer', 'drömtydning', 'symbol', 'kan råttor klättra'] },
  { namn: 'Neg | Jour och akut (tas bort när jouren startar)', typ: 'F', ord: ['jour', 'journummer', 'dygnet runt', '24/7', '24 7'] },
  { namn: 'Neg | Engelska', typ: 'F', ord: ['rat', 'rats', 'mouse', 'mice', 'pest control', 'exterminator', 'how to', 'get rid', 'bed bugs', 'bedbugs', 'pigeon', 'pigeons', 'near me', 'silverfish', 'wasp'] },
  { namn: 'Neg | Utanför våra län', typ: 'F', ord: ['göteborg', 'malmö', 'helsingborg', 'lund', 'västerås', 'örebro', 'umeå', 'luleå', 'sundsvall', 'jönköping', 'karlstad', 'växjö', 'kalmar', 'halmstad', 'borås', 'skellefteå', 'östersund', 'gotland', 'visby', 'skåne', 'norrland', 'finland', 'norge', 'åland'] },
  { namn: 'Neg | Myndighet och ansvar', typ: 'F', ord: ['kommunen', 'miljöförvaltningen', 'anmäla', 'anmälan', 'vem ansvarar', 'skyldig', 'hyresgästföreningen', 'lag om', 'socialstyrelsen', 'folkhälsomyndigheten'] },
];

// Korsnegativ: varje tjänst utesluter de andra så att rätt annons visas.
export const korsnegativ = [
  ['Sök | Råttor', 'möss, mus, mössen (fras)'],
  ['Sök | Möss', 'råtta, råttor (fras)'],
  ['Sök | Fåglar', 'getingar, råttor (fras)'],
  ['Sök | Vägglöss', 'pälsänger, silverfisk (fras)'],
  ['Sök | Insekter i hemmet', 'vägglöss, vägglus (fras)'],
  ['Alla utom Varumärke', 'begone, be gone (exakt och fras, när varumärkeskampanjen går)'],
];

export const lan = ['Stockholms län', 'Uppsala län', 'Södermanlands län', 'Östergötlands län', 'Dalarnas län', 'Gävleborgs län'];
