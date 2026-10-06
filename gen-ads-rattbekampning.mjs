// Kampanjrapport Google Ads: BrightBid_High Priority_Råttbekämpning (sök).
// Kör: node gen-ads-rattbekampning.mjs  (skriver Ads_Rattbekampning_2026-10-06.pdf i repo-roten)
// Siffrorna är hämtade ur Google Ads API (v25) 2026-10-06 med scripts/ads/gaql.mjs.
// Förslagen ligger som provkörda JSON-filer i docs/begone-se/ads/andringar/2026-10-06_ratt_*.json.
import fs from 'fs';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const logoSrc = `data:image/jpeg;base64,${fs.readFileSync('Begone - Tyro group (1).jpeg').toString('base64')}`;
const BRAND = '#20c58f';
const DATUM = '2026-10-06';
const UTFIL = `Ads_Rattbekampning_${DATUM}.pdf`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tabell = (rubriker, rader, bredder = []) => `<table>
<tr>${rubriker.map((r, i) => `<th${bredder[i] ? ` style="width:${bredder[i]}"` : ''}>${r}</th>`).join('')}</tr>
${rader.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n')}
</table>`;
// Gamla annonstexter innehåller tankstreck. De återges med markering i stället för tecknet.
const gammal = (s) => esc(s.replace(/\s[\u2013\u2014]\s/g, ' [tankstreck] '));

// Nya texter, godkända av skadedjursexperten 2026-10-06 (två granskningsomgångar).
const rsaRatt = {
  rubriker: ['Råttbekämpning', 'Kostnadsfri inspektion', 'Råttor inomhus och utomhus', 'Teknikern hittar vägen in', 'Vi stänger vägarna in', 'Rätt metod för varje plats', 'Sanering efter råttor', 'Kostnadsförslag efter besöket', 'Skicka förfrågan med bilder', 'Vi ringer när vi ser förfrågan', 'Byggnadstekniska lösningar', 'Råttspärr i avloppet', 'Rapport för försäkringsbolaget', 'Begone Skadedjur', 'Spillning eller gnagspår?'],
  beskrivningar: ['Teknikern tar reda på hur råttorna tar sig in och vad som håller dem kvar.', 'Du får teknikerns bedömning och ett kostnadsförslag att gå igenom i lugn och ro.', 'Vi stänger vägarna in, bekämpar och sanerar. Privatpersoner får ROT på tätningsarbetet.', 'Skicka förfrågan med bilder när det passar. Vardagar 08 till 17 ringer vi upp samma dag.'],
  sokvag: 'begone.se/råttbekämpning/inspektion',
};
const rsaAvlopp = {
  rubriker: ['Råttor i avloppet?', 'Råttor upp genom toaletten?', 'Råttspärr i avloppet', 'Vi monterar råttspärr', 'Vi hittar var de tar sig in', 'Vi stänger vägen ur avloppet', 'Rapport för försäkringsbolaget', 'Råttbekämpning', 'Råttbekämpning i sex län', 'Sanering efter råttor', 'Kostnadsförslag efter besöket', 'Skicka förfrågan med bilder', 'Vi ringer när vi ser förfrågan', 'Begone Skadedjur'],
  beskrivningar: ['Råttor ur avloppet? Vi hittar var de tar sig in, åtgärdar det och monterar råttspärr.', 'Vi stänger vägen upp ur avloppet och sanerar efter råttorna, med rapport om du vill.', 'Du får teknikerns bedömning och ett kostnadsförslag att gå igenom i lugn och ro.', 'Skicka förfrågan med bilder när det passar. Vardagar 08 till 17 ringer vi upp samma dag.'],
  sokvag: 'begone.se/råttor/avlopp',
};
const textrader = (lista, max) => lista.map((t, i) => [String(i + 1), esc(t), `${t.length} / ${max}`]);

const html = `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 20mm 16mm 18mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1f2937; font-size: 10pt; line-height: 1.5; }
  .cover { height: 255mm; display: flex; flex-direction: column; page-break-after: always; position: relative; }
  .cover-top { display:flex; align-items:flex-start; justify-content:space-between; }
  .cover img { width: 150px; height: auto; }
  .cover-doctype { text-align:right; font-size: 9pt; letter-spacing: 1.5px; text-transform: uppercase; color:#6b7280; padding-top: 6px; }
  .cover-center { margin-top: auto; margin-bottom: auto; }
  .cover-kicker { color: ${BRAND}; font-weight: 700; font-size: 11pt; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; }
  .cover h1 { font-size: 30pt; line-height:1.15; margin: 0 0 14px; color:#0f172a; font-weight: 700; }
  .cover .subtitle { font-size: 13pt; color:#475569; max-width: 85%; }
  .cover-rule { height: 4px; width: 70px; background: ${BRAND}; margin: 22px 0; border-radius:2px; }
  .cover-meta { font-size: 10pt; color:#475569; }
  .cover-meta div { margin-bottom: 3px; }
  .cover-meta b { color:#0f172a; font-weight:600; }
  .cover-footer { position:absolute; bottom:0; left:0; right:0; border-top:1px solid #e5e7eb; padding-top:8px; font-size: 8.5pt; color:#9ca3af; display:flex; justify-content:space-between; }
  h2 { font-size: 13.5pt; color:#0f172a; margin: 22px 0 8px; padding-bottom: 5px; border-bottom: 2px solid #e5e7eb; page-break-after: avoid; }
  h2 .num { color: ${BRAND}; font-weight:700; margin-right: 8px; }
  h3 { font-size: 11pt; color:#111827; margin: 14px 0 4px; page-break-after: avoid; }
  p { margin: 0 0 8px; }
  ul, ol { margin: 4px 0 10px; padding-left: 18px; }
  li { margin-bottom: 3px; }
  table { width:100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 8.8pt; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { border:1px solid #e5e7eb; padding: 4px 7px; text-align:left; vertical-align: top; }
  th { background:#f0fdf9; color:#0f172a; font-weight:600; }
  tr:nth-child(even) td { background:#fafafa; }
  .callout { background:#f0fdf9; border-left:4px solid ${BRAND}; padding:10px 14px; border-radius:4px; margin: 10px 0 14px; page-break-inside: avoid; }
  .callout .ct { font-weight:700; color:#0f172a; margin-bottom:2px; }
  .varning { background:#fff7ed; border-left:4px solid #f59e0b; padding:10px 14px; border-radius:4px; margin: 10px 0 14px; page-break-inside: avoid; }
  .varning .ct { font-weight:700; color:#0f172a; margin-bottom:2px; }
  .muted { color:#6b7280; font-size:8.8pt; }
  .nyckel { display:flex; gap:10px; margin: 8px 0 14px; }
  .nyckel div { flex:1; border:1px solid #e5e7eb; border-radius:4px; padding:8px 10px; }
  .nyckel b { display:block; font-size:14pt; color:#0f172a; }
  .nyckel span { font-size:8.5pt; color:#6b7280; }
  .r { text-align:right; white-space:nowrap; }
  .brytsida { page-break-before: always; }
</style>
</head>
<body>

<section class="cover">
  <div class="cover-top">
    <img src="${logoSrc}" alt="Begone Skadedjur">
    <div class="cover-doctype">Internt underlag<br>Google Ads</div>
  </div>
  <div class="cover-center">
    <div class="cover-kicker">Kampanjrapport</div>
    <h1>Råttbekämpning<br>i Google Sök</h1>
    <div class="subtitle">Genomgång av sökkampanjen BrightBid_High Priority_Råttbekämpning med förslag i prioritetsordning. Inget är ändrat i kontot.</div>
    <div class="cover-rule"></div>
    <div class="cover-meta">
      <div><b>Organisation:</b> Begone Skadedjur</div>
      <div><b>Annonskonto:</b> BeGone.se - Ny (940-760-4856)</div>
      <div><b>Kampanj:</b> BrightBid_High Priority_Råttbekämpning (19729967497)</div>
      <div><b>Datum:</b> ${DATUM}</div>
      <div><b>Version:</b> 1.0</div>
      <div><b>Status:</b> Förslag, väntar på Christians beslut</div>
      <div><b>Framtagen av:</b> Google Ads-specialisten</div>
      <div><b>Granskad av:</b> Skadedjursexperten (fakta, bilder) och säljchefen (budskap)</div>
    </div>
  </div>
  <div class="cover-footer">
    <span>Begone Skadedjur · Internt dokument</span>
    <span>Kampanjrapport råttbekämpning · v1.0 · ${DATUM}</span>
  </div>
</section>

<h2><span class="num">1.</span>Sammanfattning</h2>
<p>Kampanjen är kontots sökkampanj för råttor. Den visar annonser på Google Sök i våra sex län när någon söker på till exempel råttbekämpning, råttor i huset eller råttstopp i avloppet, och skickar besökaren till tjänstesidan /tjanster/rattbekampning/. Den bjuder bara på formulär (Maximera konverteringar med mål-CPA 800 kr). Samtal räknas inte.</p>

<div class="nyckel">
  <div><b>21 374 kr</b><span>kostnad 90 dagar</span></div>
  <div><b>705</b><span>klick, CTR 7,4 %</span></div>
  <div><b>24</b><span>formulär</span></div>
  <div><b>891 kr</b><span>per formulär</span></div>
  <div><b>40 %</b><span>visningsandel, 30 dagar</span></div>
</div>

<p>Kampanjen fungerade i sak under augusti och september: 489 kr per dag, 22 formulär på 43 dagar och ett klickpris runt 32 kr. Det som är fel är vad annonserna säger. De lovar att vi är på plats inom 24 timmar, en "100% nöjd-kund-garanti", "#1 Råttbekämpning i Sverige" och "över 10 års erfarenhet". Ett webbplatslänktillägg som visas i dag säger "Ring oss dygnet runt. Vi har jour och kommer direkt." Inget av det får stå. Tre webbplatslänkar är underkända för att adresserna inte fungerade, och bildtilläggen består av ett porträtt, fyra stockbilder som inte går att granska och nio underkända bilder.</p>
<p>Budgeten är inte det som begränsar. Kampanjen tappar 60 % av de möjliga visningarna på annonsrankning och 0 % på budget. Budgeten höjdes 2026-10-05 från 600 till 2 000 kr per dag, men med mål-CPA 800 kr har kampanjen aldrig gjort av med mer än cirka 500 kr per dag i snitt. Höjningen ger därför ingen skillnad i sig.</p>
<p>Kampanjen stod still 2026-09-22 till 2026-10-04 (hela kontot visade i stort sett inga annonser 2026-09-24 till 2026-10-04, och orsaken syns inte i ändringshistoriken). Den är i gång igen sedan 2026-10-05.</p>

<div class="callout">
  <div class="ct">Rekommendation</div>
  Vi gör det i två steg. <b>Fas 1, nu:</b> nya annonstexter och tillägg utan förbjudna löften, negativa sökord, städning av gamla pausade annonsgrupper och bort med alla bilder tills nya är godkända. Det ligger i sex förslagsfiler som Google har godtagit i provkörning. Budget, budstrategi och mål-CPA rörs inte. <b>Fas 2, efter två till fyra veckor med ren mätning (2026-11-03):</b> dela upp annonsgruppen efter avsikt, se över matchningstyper och mål-CPA, starta en liten varumärkeskampanj och rätta samspelet med Performance Max. Innan kampanjen trappas upp bör råttsidan få formuläret först, som säljchefen föreslår.
</div>

<h2><span class="num">2.</span>Nuläge</h2>

<div class="varning">
  <div class="ct">Förbehåll om mätningen</div>
  Mellan 2026-09-23 och 2026-10-06 fanns ingen konverteringsmätning på begone.se, eftersom nya sajten saknade taggen. Kampanjen visade inga annonser 2026-09-22 till 2026-10-04 heller, så 30-dagarsperioden består i praktiken av 2026-09-06 till 2026-09-21 och en dag i oktober. Alla konverteringar nedan är formulär på gamla WordPress-sajten. Det nya formuläret mäts från 2026-10-06 och är inte direkt jämförbart. "Alla konv." innehåller klick på telefonnummer (click_phone och click_akut), inte samtal.
</div>

<h3>2.1 Inställningar</h3>
${tabell(['Inställning', 'I dag', 'Kommentar'], [
  ['Budget', '2 000 kr per dag', 'Höjd från 600 kr 2026-10-05. Spenderar i snitt cirka 400 till 500 kr när kampanjen går.'],
  ['Budstrategi', 'Maximera konverteringar, mål-CPA 800 kr', 'Rörs inte förrän mätningen har gett ren data i två till fyra veckor.'],
  ['Konverteringsmål', 'Bara Skicka formulär (Formulär ifyllt och GA4 generate_lead)', 'Samtal från annonsen räknas inte alls i den här kampanjen. Se avsnitt 6.'],
  ['Nätverk', 'Bara Google Sök', 'Inga sökpartner, ingen display. Bra.'],
  ['Geografi', 'Stockholms, Uppsala, Södermanlands, Östergötlands, Dalarnas och Gävleborgs län, närvaro', '+10 % på Östergötland, Dalarna och Gävleborg. Smart Bidding bortser från det.'],
  ['Schema', 'Alla dagar, dygnet runt', 'Fredag har -90 %, som Smart Bidding också bortser från. Hälften av formulären kom utanför vardagar 08 till 17, så annonserna ska fortsätta dygnet runt.'],
  ['Målgrupper', 'Nio målgrupper i observation', 'Påverkar inte vem som ser annonsen. Får vara kvar.'],
  ['Startad', '2023-02-23 (BrightBid)', 'BrightBid har inte styrt kontot sedan minst 2026-09-07.'],
], ['18%', '34%', '48%'])}

<h3>2.2 Resultat</h3>
${tabell(['Period', 'Kostnad', 'Klick', 'Visningar', 'CTR', 'CPC', 'Formulär', 'Kr per formulär', 'Alla konv.'], [
  ['90 dagar (2026-07-08 till 2026-10-05)', '<span class="r">21 374 kr</span>', '705', '9 563', '7,4 %', '30 kr', '24', '891 kr', '47,6'],
  ['30 dagar (2026-09-06 till 2026-10-05)', '<span class="r">5 703 kr</span>', '213', '2 915', '7,3 %', '27 kr', '7', '815 kr', '11,6'],
  ['Aktiv period (2026-08-10 till 2026-09-21)', '<span class="r">21 015 kr</span>', '658', '8 954', '7,3 %', '32 kr', '22', '955 kr', ''],
  ['Juli (2026-07-08 till 2026-08-09)', '<span class="r">344 kr</span>', '45', '592', '7,6 %', '8 kr', '2', '172 kr', ''],
], [])}
<p>I juli var budgeten så låg att kampanjen förlorade 50 till 90 % av visningarna på budget. Från 2026-08-10 gick den på riktigt. Visningsandelen de senaste 30 dagarna är 40 %, varav 28 % högst upp och 11 % allra högst upp. 60 % tappas på annonsrankning, alltså bud och kvalitet, och 0 % på budget. 81 % av klicken kom från mobil (571 klick, 17 formulär), 18 % från dator (125 klick, 6 formulär).</p>

<h3>2.3 Annonsgrupper</h3>
${tabell(['Annonsgrupp', 'Status', 'Kostnad 90 d', 'Klick', 'Formulär', 'Anmärkning'], [
  ['Home & Business Rat Control', 'Aktiv', '20 433 kr', '671', '23', 'Bär nästan allt. 45 sökord blandat brett och fras.'],
  ['Råttor i avlopp', 'Aktiv', '941 kr', '34', '1', '19 sökord, flera visas sällan.'],
  ['Search - Råttor', 'Pausad', '0 kr', '0', '0', 'Annons med "Just nu 20% rabatt", "10/10 Kundnöjdhet", "100% Nöjd-Kund Garanti" och "9/10 kunder är helt fria". Slogs på 2026-10-05 kl 17.31 och pausades igen 2026-10-06 kl 10.09.'],
  ['Elektriska råttfällor', 'Pausad', '0 kr', '0', '0', 'Annons med "Råttbekämpning från 495:-/mån".'],
  ['Emergency Rat Control', 'Pausad', '0 kr', '0', '0', 'Annons med "Akut hjälp 24/7" och "garanterat resultat".'],
  ['Musbekämpning', 'Borttagen', '0 kr', '0', '0', 'Borttagen före 2026-09-07. Se avsnitt 3.4.'],
], ['22%', '9%', '11%', '7%', '9%', '42%'])}

<h3>2.4 Sökord och matchningstyper</h3>
<p>47 aktiva sökord i de två aktiva grupperna: 24 breda, 21 fras och 2 exakta. Kvalitetsresultatet ligger på 2 till 5 för de flesta och 7 till 8 för råttsanering och råttbekämpning stockholm. Låga kvalitetsresultat förklarar en del av den tappade rankningen. Dit hör också att de gamla annonserna och WordPress-sidan inte stämde med varandra.</p>
${tabell(['Sökord', 'Matchning', 'KR', 'Kostnad 90 d', 'Klick', 'Formulär'], [
  ['sanering råttor', 'bred', '7', '3 756 kr', '86', '3,5'],
  ['få bort råttor', 'bred', '3', '1 804 kr', '86', '1,7'],
  ['råttor i huset', 'bred', '5', '1 694 kr', '44', '1,5'],
  ['råttbekämpning', 'bred', '5', '1 472 kr', '45', '5'],
  ['bli av med råttor', 'bred', '3', '1 351 kr', '47', '0'],
  ['bekämpa råttor', 'bred', '5', '1 241 kr', '44', '2'],
  ['utrota råttor', 'bred', '5', '1 131 kr', '30', '0,3'],
  ['få bort råttor i trädgården', 'bred', '5', '901 kr', '45', '3'],
  ['råttbekämpning stockholm', 'bred', '8', '800 kr', '8', '0'],
  ['bli av med råttor inomhus', 'bred', '3', '517 kr', '15', '0'],
  ['råttor i förrådet', 'bred', '3', '505 kr', '8', '0'],
  ['råttor i huset', 'fras', '5', '491 kr', '27', '0,5'],
  ['ta död på råttor', 'bred', '5', '422 kr', '16', '0,5'],
  ['råttstopp', 'fras', '', '404 kr', '13', '1'],
], ['32%', '12%', '8%', '18%', '12%', '18%'])}
<p class="muted">KR = kvalitetsresultat (1 till 10). Formulär med decimaler beror på att Google delar en konvertering mellan flera sökord.</p>

<h3>2.5 Söktermer</h3>
<p>Google visar söktermer för 8 000 kr av 21 374 kr (37 %). Resten döljs av integritetsskäl. Av det synliga gick 5 982 kr till termer utan formulär.</p>
${tabell(['Bra söktermer', 'Kostnad', 'Klick', 'Formulär'], [
  ['begone (varumärket)', '1 834 kr', '48', '3'],
  ['bekämpa råttor i trädgården', '104 kr', '3', '2'],
  ['råttbekämpning', '444 kr', '9', '0'],
  ['råttor i huset', '288 kr', '11', '0'],
  ['råttbekämpning utomhus', '281 kr', '7', '0'],
  ['sanering råttor', '197 kr', '4', '0'],
  ['råttor på tomten', '164 kr', '10', '0'],
  ['råttstopp avlopp pris', '116 kr', '6', '0'],
], ['55%', '15%', '15%', '15%'])}
${tabell(['Slöseri', 'Kostnad', 'Klick', 'Åtgärd'], [
  ['Konkurrenter: ocab skadedjur, rentokill, rent o kill pest control, lf skadedjur och sanering', '313 kr', '4', 'Negativa i listan Konkurrenter'],
  ['Engelska: getting rid of rats under house, how to get rid of rats in the house, rat in my house help, pest control companies near me, buy rat poison, electric rat trap m.fl.', 'cirka 600 kr', '13', 'Negativa fras: rat, rats, pest control, how to, get rid, trap, poison'],
  ['Produkter och gör det själv: repello utomhus, gnagarstopp, powersnap safe, klisterfälla, pepparmynta mot råttor', 'cirka 130 kr', '5', 'Negativa fras'],
  ['skadedjur jour', '108 kr', '4', 'Negativ fras: jour (vi har ingen jour)'],
  ['saneringsbolag, skadedjurssanerare, a spolbil ab, avloppsservice', 'cirka 280 kr', '5', 'saneringsbolag och avloppsservice exakt, spolbil fras'],
  ['be gone (varumärket, felstavat)', '295 kr', '8', 'Fas 2: varumärkeskampanj'],
], ['50%', '14%', '8%', '28%'])}

<h3>2.6 Annonser</h3>
${tabell(['Annons', 'Status', 'Styrka', 'Policy', 'Det som inte får stå'], [
  ['Råttbekämpning (Home & Business), 681944856479', 'Aktiv, 671 klick', 'Medel', 'Godkänd', gammal('"{Keyword:Råttbekämpning} – Inom 24h", "Vi är på plats inom 24h", "100% nöjd-garanti", "Över 10 års erfarenhet", "Inga huskurer – Proffshjälp", "Vi säljer inga varor – Vi utför hela saneringen". Tre tankstreck.')],
  ['Råttor i avlopp, 687195236383', 'Aktiv, 24 klick', 'Medel', 'Godkänd', '"#1 Råttbekämpning i Sverige", "För permanenta resultat", "Vi är på plats inom 24 timmar", "100% Nöjd-Kund Garanti", "10+ års erfarenhet"'],
  ['Råttor i avlopp, 687195236386', 'Aktiv, 10 klick', 'Bra', 'Godkänd', '"#1", "inom 24 timmar", "100% Nöjd-Kund Garanti", "Specialist", "bekämpat råttor i över 10 år"'],
  ['Pausade annonser i Home & Business, Search - Råttor, Elektriska råttfällor, Emergency Rat Control', 'Pausade', '', 'Godkända', 'Rabatt, pris per månad, 10/10, 9/10, 24/7, akut, garanti. Tas bort med sina annonsgrupper.'],
], ['24%', '12%', '8%', '9%', '47%'])}
<p>Att Google har godkänt annonserna betyder bara att de följer Googles regler. De följer inte Begones.</p>

<h3>2.7 Tillägg</h3>
${tabell(['Tillägg', 'Text', 'Status', 'Problem'], [
  ['Webbplatslänk', 'Akut Råttsanering? / Ring oss dygnet runt. / Vi har jour och kommer direkt.', 'Visas', 'Jour och dygnet runt. Högsta prioritet.'],
  ['Webbplatslänk', 'För privat &amp; företag / 30% ROT-avdrag för tätningsarbeten / Diskreta bilar och snabb service.', 'Visas', 'Procentsats och "diskreta bilar" är inte belagt.'],
  ['Webbplatslänk', gammal('Så går saneringen till / Lokalisering, bekämpning & sanering / Vi säljer ej varor – vi gör jobbet'), 'Visas', 'Tankstreck, försvarande ton.'],
  ['Webbplatslänk', 'Kostnadsfri Inspektion / Inga dolda avgifter. Boka idag. / Vi är på plats inom 24 timmar.', 'Underkänd', 'Adressen fungerade inte, inom 24 timmar.'],
  ['Webbplatslänk', '100% Nöjd-Kund-Garanti / Vi ger oss inte förrän det är bra.', 'Underkänd', 'Garanti.'],
  ['Webbplatslänk', 'Våra verksamhetsområden / Stockholm, Uppsala, Gävle.', 'Underkänd', 'Adressen fungerade inte vid Googles kontroll 2026-10-04. Fungerar i dag.'],
  ['Framhävning', '100% Nöjd-Kund Garanti, Skadedjursbekämpning Jour, Öppet alla dagar, Vi är plats inom 24h, 10 års Erfarenhet', 'Visas', 'Alla fem ska bort.'],
  ['Strukturerat utdrag', 'Tjänster: Råttbekämpning, Sanering, Betesstationer, Bekämpning inomhus, Bekämpning utomhus', 'Visas', 'Sant men utan Christians metodnamn.'],
  ['Samtal', '010 280 44 10', 'Visas', 'Visas dygnet runt fast växeln har öppet vardagar 08 till 17.'],
  ['Företagsnamn', 'BeGone Skadedjur', 'Underkänd', 'Behöver kontrolleras i gränssnittet (annonsörsverifiering).'],
], ['14%', '42%', '11%', '33%'])}

<h3>2.8 Bilder</h3>
<p>Kampanjen har 19 bildtillägg. Fem kan visas: ett porträtt av en person med spruta (bryter mot bildnormen, samma typ av bild som underkänts i generella PMax) och fyra bilder ur Googles stockbibliotek som i dag inte går att hämta, så vi vet inte vad de visar. Nio är underkända av Google, de flesta för text i bilden, bland dem en råtta med texten EFFEKTIV RÅTTBEKÄMPNING. Skadedjursexperten underkänner den bilden också i sak: det är en tamråtta i en uppställd miljö, inte en vild brunråtta. Fem är pausade. De två logotyperna är rätt.</p>

<h3>2.9 Geografi</h3>
${tabell(['Län', 'Kostnad 90 d', 'Klick', 'Formulär'], [
  ['Stockholms län', '15 850 kr', '525', '20'],
  ['Södermanlands län', '1 883 kr', '35', '3'],
  ['Östergötlands län', '1 284 kr', '54', '0'],
  ['Dalarnas län', '1 027 kr', '35', '1'],
  ['Uppsala län', '1 018 kr', '37', '0'],
  ['Gävleborgs län', '313 kr', '19', '0'],
], ['40%', '20%', '20%', '20%'])}
<p>Utanför Stockholm är underlaget för litet för att dra slutsatser. Vi ändrar inget på länsnivå.</p>

<h3>2.10 Slutadresser</h3>
<p>Kontrollerade 2026-10-06, en i taget, med en mobil webbläsare.</p>
${tabell(['Adress', 'Används i', 'Svar'], [
  ['begone.se/tjanster/rattbekampning/', 'Alla aktiva annonser', '200, tjänstesidan. Rätt landning.'],
  ['begone.se/tjanster/rattor', 'Underkänd webbplatslänk', '301 till /tjanster/rattbekampning/'],
  ['begone.se/tjanster/boka-en-inspektion', 'Underkänd webbplatslänk', '301 till /prisforslag/ (formuläret, noindex)'],
  ['begone.se/kontakt/', 'Underkänd webbplatslänk', '200. Fungerar i dag.'],
  ['begone.se/skadedjur-jour/', 'Webbplatslänk Akut Råttsanering', '200, sidan Akuta skadedjur. Länken tas bort.'],
  ['begone.se/rattbekampning-i-stockholm/', 'Pausad grupp Search - Råttor', '301 till tjänstesidan'],
  ['begone.se/giftfri-rattbekampning/', 'Pausad grupp Elektriska råttfällor', '301 till tjänstesidan'],
  ['begone.se/moss-i-huset-och-vaggarna/', 'Borttagen grupp Musbekämpning', '200, artikel (inte tjänstesidan /tjanster/moss/)'],
  ['begone.se/prisforslag/?tjanst=rattbekampning', 'Ny webbplatslänk', '200. Förval råttor i formuläret.'],
  ['begone.se/skadedjursbekampning-foretag/, /tjanster/skadedjursavtal/', 'Nya webbplatslänkar', '200'],
], ['38%', '30%', '32%'])}
<p>Inga aktiva annonser går via en omdirigering. De nya webbplatslänkarna pekar direkt på sidorna.</p>

<h2><span class="num">3.</span>Struktur</h2>

<h3>3.1 Samspelet med Råttbekämpning_PMax</h3>
<p>Performance Max-kampanjen för råttor kostade 3 314 kr på 90 dagar och gav 13 formulär, cirka 255 kr per formulär. Den har mål-CPA 300 kr medan sökkampanjen har 800 kr. Två olika mål för samma tjänst gör det svårt att veta vad ett formulär för råttor får kosta.</p>
<p>Av PMax-kampanjens synliga söktermer (2 003 kr) gick 813 kr till konkurrentnamn (rentokil 574 kr, rentokil ab 239 kr) och 187 kr till vårt eget varumärke. Ungefär hälften av de synliga pengarna gick alltså inte till råttsökningar. 84 söktermer som sökkampanjen har betalat för syns också i någon av PMax-kampanjerna. De står för 6 186 kr av sökkampanjens synliga 8 000 kr.</p>
<p>Google låter inte två kampanjer i samma konto bjuda mot varandra i samma auktion, så överlappet driver inte upp klickpriset. Det som händer är att sökkampanjen vinner när sökningen är identisk med ett sökord, och PMax tar resten, särskilt där sökkampanjen förlorar på rankning. Kampanjerna delar då lärdomen om vad en råttsökning är värd. Vi föreslår ingen sammanslagning nu. PMax för råttor får en egen rapport, med negativa sökord för konkurrenter, varumärkesuteslutning och samma mål-CPA som sökkampanjen.</p>

<h3>3.2 Samspelet med den generella PMax-kampanjen</h3>
<p>Den generella PMax-kampanjen (Websites + Own Data + Generic Terms) kostade 9 947 kr på 90 dagar, varav 9 315 kr de senaste 30 dagarna sedan budgeten höjdes till 1 500 kr 2026-09-17. Den köper nästan inga råttsökningar (12 kr synligt) och tar därför inte trafik från råttkampanjen i någon större grad. Den köper däremot konkurrentnamn (rentokil i olika former, cirka 1 940 kr av 3 707 kr synligt) och vårt varumärke (323 kr). Den bjuder också på telefonklick som primär konvertering. Den tas i en egen rapport.</p>

<h3>3.3 Varumärket</h3>
<p>Kontot har ingen varumärkeskampanj. Sökningar på begone och be gone kostade 2 129 kr i råttkampanjen på 90 dagar, med cirka 38 kr per klick, och dessutom 510 kr i de två PMax-kampanjerna. De ger formulär, men till ett pris som en egen liten varumärkeskampanj kan ta betydligt billigare. När den finns läggs begone och be gone som negativa i råttkampanjen. Det hör till fas 2, eftersom varumärket annars hamnar i PMax.</p>

<h3>3.4 Musbekämpning och kampanjen Möss</h3>
<p>Annonsgruppen Musbekämpning i råttkampanjen är borttagen (före 2026-09-07) och har inte haft en enda visning på 90 dagar. Samma sökord finns i dag som annonsgruppen Musbekämpning i kampanjen Möss. Inne i råttkampanjen är krocken alltså redan löst, med två rester:</p>
<ul>
  <li>Den pausade gruppen Search - Råttor har sökordet "bli av med möss och råttor" (brett och fras). Den slogs på i går kväll och pausades i morse. Vi tar bort gruppen i steg 4.</li>
  <li>Råttkampanjen utesluter i dag "möss" bara som exakt sökning. Vi lägger till "möss" som fras, så att alla sökningar med möss går till kampanjen Möss.</li>
</ul>
<p>I kampanjen Möss finns ett eget problem: två aktiva annonsgrupper (Bli av med - A och Musbekämpning) har i stort sett samma sökord, och Musbekämpning pekar på artikeln /moss-i-huset-och-vaggarna/ i stället för tjänstesidan /tjanster/moss/. Kampanjen har också budstrategin Maximera konverteringsvärde utan en enda konvertering på 90 dagar. Det tas i rapporten för Möss.</p>

<h3>3.5 Uppdelning efter avsikt</h3>
<p>All volym ligger i en annonsgrupp där samma annons ska svara både på "råttor på tomten", "sanering råttor" och "råttor i huset". Vi föreslår att den delas i tre i fas 2:</p>
${tabell(['Annonsgrupp', 'Avsikt', 'Exempel på sökord', 'Landning'], [
  ['Råttbekämpning', 'Vill anlita någon', 'råttbekämpning, råttsanering, sanering råttor, bekämpa råttor, råttbekämpning stockholm', '/tjanster/rattbekampning/'],
  ['Råttor inomhus', 'Symptom i huset', 'råttor i huset, råtta i väggen, råttor på vinden, råttor i krypgrunden, råtta inomhus', '/tjanster/rattbekampning/'],
  ['Råttor utomhus', 'Symptom på tomten', 'råttor på tomten, råttor i trädgården, bekämpa råttor utomhus, råttor under altanen', '/tjanster/rattbekampning/'],
  ['Råttor i avlopp', 'Avlopp (finns)', 'råttstopp, råttspärr, råttor i avlopp, råtta i toaletten', '/tjanster/rattbekampning/'],
], ['18%', '17%', '43%', '22%'])}
<p>Vi delar inte nu. Mätningen startade i dag, kampanjen har haft 24 formulär på 90 dagar och de nya annonserna behöver lära sig först. Budgivningen sker på kampanjnivå, så uppdelningen påverkar främst hur väl annonsen passar sökningen. En egen grupp för företag och BRF väntar tills det finns volym ("råttbekämpning företag" gav ett klick på 90 dagar). Säljchefen bedömer att utomhus och avlopp inte behöver egna landningssidor än: avloppsgruppen prövas mot en egen landning först när den har minst 30 klick och sämre konvertering än huvudgruppen.</p>

<h2 class="brytsida"><span class="num">4.</span>Ändringar i prioritetsordning</h2>
<p>Alla ändringar i fas 1 ligger som förslagsfiler i docs/begone-se/ads/andringar/ och har provkörts mot Google (validateOnly). Google godtog alla 98 operationer. Inget är genomfört. Varje steg genomförs bara efter Christians ja för just det steget.</p>
${tabell(['Steg', 'Före', 'Efter', 'Skäl', 'Förväntad effekt', 'Risk'], [
  ['<b>1A</b> Nya annonser (3 op.)', 'Tre aktiva annonser med inom 24h, garanti, #1, 10 års erfarenhet', 'Två nya annonser (texter nedan). Gruppen döps om till Råttbekämpning.', 'Förbjudna löften. Annonsen ska säga samma sak som sidan.', 'Annonser vi kan stå för. CTR kan sjunka något när "inom 24h" försvinner.', 'Låg. Gamla annonser går tills de nya är godkända.'],
  ['<b>1B</b> Pausa gamla annonser (3 op.)', 'Gamla annonser aktiva', 'Pausade', 'Som ovan', 'Bara nya texter visas', 'Körs först när 1A är godkänd, annars blir det ett glapp.'],
  ['<b>2</b> Tillägg (37 op.)', 'Jour, dygnet runt, garanti, inom 24h, öppet alla dagar, tre underkända länkar, samtal dygnet runt', 'Fyra nya webbplatslänkar, sex framhävningar, nytt utdrag med metodnamnen, samtalstillägg vardagar 08 till 17. De gamla kopplingarna tas bort.', 'Jourlänken visas i dag. Samtal ska bara erbjudas när någon svarar.', 'Inga förbjudna löften kvar. Färre missade samtal.', 'Låg. Tilläggen granskas av Google i ett till två dygn.'],
  ['<b>3</b> Negativa sökord (26 op.)', 'Engelska, konkurrenter, produkter, jour och möss läcker in', '20 negativa på kampanjen, 6 konkurrentnamn i listan Konkurrenter', 'Cirka 1 300 kr synligt slöseri på 90 dagar', 'Mer av pengarna till riktiga råttsökningar', 'Låg. "möss" som fras stänger också "råttor eller möss", som Möss tar.'],
  ['<b>4</b> Städning (10 op.)', 'Tre pausade grupper med rabatt, pris, 24/7 och garanti. Budjusteringar som inte används. Tre breda sökord utan formulär.', 'Grupperna borttagna. Budjusteringar 0. Sökorden bli av med råttor, råttor i förrådet och ta död på råttor pausade.', 'Search - Råttor slogs på av misstag i går. De tre sökorden kostade 2 278 kr utan formulär och har gör det själv-avsikt.', 'Ingen risk att gamla texter visas igen. Mindre gör det själv-trafik.', 'Låg. Pausade sökord kan slås på igen.'],
  ['<b>5</b> Bilder bort (19 op.)', '19 bilder, varav ett porträtt, fyra okända och nio underkända', 'Inga bildtillägg tills nya är godkända', 'Bildnormen, och experten underkänner råttbilden', 'Inga bilder alls en tid', 'Låg. Bildtillägg ger lite på sök. Nya bilder enligt avsnitt 5.'],
], ['12%', '17%', '20%', '17%', '17%', '17%'])}

<h3>Inte föreslaget nu</h3>
<ul>
  <li><b>Budget.</b> 2 000 kr per dag får stå kvar under omstarten. Den begränsar inte, och mål-CPA styr vad som spenderas. Vid utvärderingen 2026-11-03 tar vi ställning till om cirka 1 500 kr av den budgeten ska flyttas till fågel eller insekter, så att totalen på cirka 4 430 kr faktiskt används.</li>
  <li><b>Mål-CPA och budstrategi.</b> Ändras inte förrän det nya formuläret har gett ren data i två till fyra veckor.</li>
  <li><b>Matchningstyper och nya sökord.</b> Tas i fas 2 tillsammans med uppdelningen.</li>
</ul>

<h3>4.1 Ny annons, annonsgrupp Råttbekämpning</h3>
<p>Slutadress: https://begone.se/tjanster/rattbekampning/ · Visad sökväg: ${esc(rsaRatt.sokvag)} · Inga fästa rubriker.</p>
${tabell(['#', 'Rubrik', 'Tecken'], textrader(rsaRatt.rubriker, 30), ['6%', '74%', '20%'])}
${tabell(['#', 'Beskrivning', 'Tecken'], textrader(rsaRatt.beskrivningar, 90), ['6%', '74%', '20%'])}

<h3>4.2 Ny annons, annonsgrupp Råttor i avlopp</h3>
<p>Slutadress: https://begone.se/tjanster/rattbekampning/ · Visad sökväg: ${esc(rsaAvlopp.sokvag)} · Inga fästa rubriker. "Kostnadsfri inspektion" är medvetet borttagen här, eftersom den kan läsas som gratis rörinspektion. Den kostnadsfria inspektionen syns i stället i webbplatslänken.</p>
${tabell(['#', 'Rubrik', 'Tecken'], textrader(rsaAvlopp.rubriker, 30), ['6%', '74%', '20%'])}
${tabell(['#', 'Beskrivning', 'Tecken'], textrader(rsaAvlopp.beskrivningar, 90), ['6%', '74%', '20%'])}

<h3>4.3 Nya tillägg</h3>
${tabell(['Webbplatslänk', 'Rad 1', 'Rad 2', 'Adress'], [
  ['Kostnadsfri inspektion (22)', 'Skicka en förfrågan med bilder (30)', 'Före 17 en vardag ringer vi i dag (34)', '/prisforslag/?tjanst=rattbekampning'],
  ['Företag och fastigheter (23)', 'Hela organisationen i ett avtal (31)', 'Varje station syns i portalen (29)', '/skadedjursbekampning-foretag/'],
  ['Skadedjursavtal (15)', 'Första besöket är kostnadsfritt (31)', 'Avtalsförslaget binder er inte (30)', '/tjanster/skadedjursavtal/'],
  ['Kontakta oss (12)', 'Ring 010 280 44 10 (18)', 'Vardagar 08 till 17 (19)', '/kontakt/'],
], ['24%', '27%', '27%', '22%'])}
<p class="muted">Gränser: länktext 25, raderna 35 tecken.</p>
${tabell(['Framhävning (högst 25)', 'Tecken'], [
  ['Kostnadsfri inspektion', '22'], ['Verksamma i sex län', '19'], ['Sanering efter råttor', '21'], ['Rapport när du behöver', '22'], ['Alla tekniker har 1SO', '21'], ['ISO 9001 och ISO 14001', '22'],
], ['80%', '20%'])}
<p><b>Strukturerat utdrag, rubrik Tjänster:</b> Tätning, Mekaniska fällor, Betongstationer, Betesstationer, Råtthund, Råttspärr, Råttsanering.</p>
<p><b>Samtal:</b> 010 280 44 10, visas måndag till fredag 08 till 17.</p>

<div class="callout">
  <div class="ct">Faktagranskning gjord</div>
  Skadedjursexperten har granskat alla nya texter i två omgångar 2026-10-06 mot faktabladet för råttor, TJANSTEINNEHALL (bara Belagt) och SKRIVGUIDE 13.1. Första omgången ändrade bland annat "Vi ringer upp samma vardag" (tidslöfte utan villkor), "Rörinspektion och råttspärr" (säljer filmning som egen tjänst), "Du får filmen och protokollet" (struken, gäller bara när filmning görs), "Vi hittar skadan i ledningen" och ROT-meningen. Andra omgången godkände alla rader. Säljchefen har prövat budskapen mot landningssidan och fått in "Spillning eller gnagspår?", den nya fjärde beskrivningen och webbplatslänken med förval i formuläret. Expertens godkännande gäller under ett villkor: Christian bekräftar att bolaget är certifierat enligt ISO 9001 och ISO 14001 av ett ackrediterat organ. Annars stryks den framhävningen.
</div>

<h3>4.4 Utanför kampanjen</h3>
<ul>
  <li><b>Formuläret först på råttsidan (säljchefen).</b> Råttsidan saknar formular_forst, så heron visar Ring först och raden "Vi ringer upp med ett pris eller bokar en kostnadsfri inspektion". Pris per telefon gäller inte råttor. Säljchefen äger ändringen och rekommenderar att den görs innan kampanjen trappas upp.</li>
  <li><b>Företagsnamnet BeGone Skadedjur är underkänt.</b> Kontrolleras i Google Ads under annonsörsverifiering.</li>
  <li><b>Konverteringsåtgärderna i kontot.</b> click_phone och click_akut räknas som primära i andra kampanjer. Det rättas för hela kontot i ett eget förslag.</li>
</ul>

<h2><span class="num">5.</span>Bilder</h2>
<p>Alla 19 bildtillägg kopplas bort i steg 5. Logotyperna (Begones gröna symbol) behålls. Nya bilder tas fram, till exempel med Gemini, och skadedjursexperten godkänner varje bild innan den föreslås.</p>
${tabell(['Format', 'Storlek', 'Motiv som experten godkänner'], [
  ['Liggande 1,91:1', '1200 × 628', 'Låst grå betesstation längs en husgrund eller vid ett soprum, med stängda sopkärl i bakgrunden. Samma motiv som på tjänstesidan.'],
  ['Kvadrat 1:1', '1200 × 1200', 'Betongstation i offentlig miljö, till exempel på en innergård eller vid en gångväg med gatsten.'],
  ['Stående 4:5', '960 × 1200', 'Tekniker bakifrån eller bara händerna, i Begones kläder, som tätar en ventil eller rörgenomföring vid husgrunden.'],
  ['Kvadrat eller stående', '1200 × 1200', 'Öppen rensbrunn i en källare med monterad råttspärr.'],
  ['Liggande 1,91:1', '1200 × 628', 'En vild brunråtta utomhus vid en grund eller ett sopkärl, i skymningsljus. Tydligt vild, inte en tamråtta.'],
  ['Logotyp 1:1', 'minst 128 × 128', 'Finns. Behålls.'],
], ['18%', '15%', '67%'])}
<p>Får aldrig synas: personer i ansiktsbild, text i bilden, preparatförpackningar eller etiketter, fällor där fälltypen går att se, döda råttor, varumärken och ordet gift.</p>

<h2><span class="num">6.</span>Mätning och uppföljning</h2>
<ul>
  <li><b>Formulär.</b> Konverteringen Formulär ifyllt på nya sajten, med förbättrade konverteringar. Mäts från 2026-10-06. Den bär budgivningen i den här kampanjen.</li>
  <li><b>Riktiga förfrågningar.</b> Tabellen web_inquiries i kundportalen sparar gclid, gbraid, wbraid och utm. Sedan 2026-10-05 har 9 förfrågningar kommit in, varav 1 med klick-id från annons. Vi kopplar varje annonsförfrågan till ärende och utfall, så att vi ser vad ett formulär för råttor blir värt.</li>
  <li><b>Samtal.</b> Samtal från annonsen räknas inte i kampanjen i dag. När samtalstillägget är schemalagt föreslår vi i fas 2 att samtal på minst 60 sekunder blir ett mål även här.</li>
  <li><b>Policy och annonsstyrka.</b> Kontroll ett till två dygn efter steg 1A och 2. Steg 1B körs först när de nya annonserna är godkända.</li>
  <li><b>Söktermer.</b> Genomgång varje vecka, nya negativa sökord efter behov.</li>
  <li><b>Visningsandel och klickpris.</b> Följs per vecka. Vi väntar oss högre kvalitetsresultat när annons och sida säger samma sak.</li>
</ul>
${tabell(['Datum', 'Vad'], [
  ['2026-10-08', 'Policystatus för nya annonser och tillägg. Steg 1B om allt är godkänt.'],
  ['2026-10-20', 'Första avstämningen: formulär, kostnad per formulär, söktermer, CTR för nya annonser.'],
  ['2026-11-03', 'Utvärdering efter fyra veckor ren mätning. Beslut om fas 2: uppdelning, matchningstyper, mål-CPA, budget, varumärkeskampanj och PMax för råttor.'],
], ['20%', '80%'])}

<h3>Frågor till Christian</h3>
<ol>
  <li>Är bolaget certifierat enligt ISO 9001 och ISO 14001 av ett ackrediterat organ? Annars stryks framhävningen.</li>
  <li>Får "ofta redan samma dag" stå i annonsen? Det står på tjänstesidan men används inte i förslaget.</li>
  <li>Vet du varför kontot slutade visa annonser 2026-09-24 till 2026-10-04 (betalning eller annat)?</li>
  <li>Vilka steg (1A, 1B, 2, 3, 4, 5) får genomföras?</li>
</ol>

<p class="muted" style="margin-top:18px">Datum: ${DATUM} · Version 1.0 · Underlag: Google Ads API v25, hämtat 2026-10-06. Förslagsfiler: docs/begone-se/ads/andringar/2026-10-06_ratt_1a_nya-annonser.json, _1b-pausa-gamla-annonser.json, _2-tillagg.json, _3-negativa-sokord.json, _4-stadning.json, _5-bilder-bort.json.</p>

</body>
</html>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });
await page.pdf({ path: UTFIL, format: 'A4', printBackground: true, displayHeaderFooter: false, preferCSSPageSize: true });
await browser.close();
console.log('Skapade ' + UTFIL);
