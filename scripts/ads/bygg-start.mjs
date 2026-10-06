// Bygger förslagsfilerna för den gemensamma starten 2026-10-06/07 (fas 1 och fas 2 i ett svep).
//
// Kör från kundportalens rot:
//   node --env-file=.env.local scripts/ads/bygg-start.mjs
// Skriver i docs/begone-se/ads/andringar/:
//   2026-10-06_annonser-b-fas1.json      annons B i de elva annonsgrupperna i fas 1 (finns redan i kontot)
//   2026-10-06_fas2-komplett.json        fas 2-bygget (konto_3) + annons B + bilder fas 2, allt PAUSAT
//   2026-10-06_logotyp-namn.json         nya logotyper, företagsnamnet BeGone (godkänt) på konto, fas 1 och PMax Fåglar
//   2026-10-06_pmax-fagel-texter.json    nya texter och tillägg i Claude | PMax | Fåglar (övergång)
//   2026-10-06_pmax-fagel-bilder-bort.json  tar bort de tolv gamla bilderna i PMax Fåglar
//   2026-10-06_start-alla.json           startar alla Claude-kampanjer och pausar alla gamla aktiva
// Startfilen slår upp fas 2-kampanjernas id via GAQL. Finns de inte än (fas2-komplett ej genomförd)
// skrivs startfilen utan dem och med en varning. Efter fas2-komplett: kör med --bara-start (skriver bara
// startfilen, rör inte de andra filerna) och provkör startfilen igen.
import fs from 'node:fs'
import path from 'node:path'
import { annonserB } from '../../docs/begone-se/ads/annonser-b-data.mjs'
import * as pmax from '../../docs/begone-se/ads/pmax-fagel-data.mjs'

const C = 'customers/9407604856'
const DIR = 'docs/begone-se/ads/andringar'
const BILDER = 'docs/begone-se/ads/bilder'
const env = process.env

// ---------- GAQL ----------
async function q(query) {
  const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GOOGLE_ADS_CLIENT_ID, client_secret: env.GOOGLE_ADS_CLIENT_SECRET, refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN, grant_type: 'refresh_token' }) })).json()
  const h = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json', 'login-customer-id': (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '') }
  if (env.GOOGLE_ADS_DEVELOPER_TOKEN) h['developer-token'] = env.GOOGLE_ADS_DEVELOPER_TOKEN
  const s = await fetch(`https://googleads.googleapis.com/${env.GOOGLE_ADS_API_VERSION || 'v25'}/${C}/googleAds:searchStream`, { method: 'POST', headers: h, body: JSON.stringify({ query }) })
  const d = await s.json()
  if (!s.ok) throw new Error(JSON.stringify(d).slice(0, 800))
  return d.flatMap((x) => x.results || [])
}

const kampanjer = await q(`SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign_budget.amount_micros FROM campaign WHERE campaign.status != 'REMOVED'`)
const kampanjId = Object.fromEntries(kampanjer.map((r) => [r.campaign.name, r.campaign.id]))
const grupper = await q(`SELECT campaign.name, ad_group.id, ad_group.name FROM ad_group WHERE campaign.name LIKE 'Claude | Sök%' AND ad_group.status != 'REMOVED'`)
const gruppId = Object.fromEntries(grupper.map((r) => [`${r.campaign.name}|${r.adGroup.name}`, r.adGroup.id]))

const BARA_START = process.argv.includes('--bara-start')
const skriv = (fil, beskrivning, operationer, extra = {}) => {
  if (BARA_START && fil !== '2026-10-06_start-alla.json') return
  fs.writeFileSync(path.join(DIR, fil), JSON.stringify({ status: 'FÖRSLAG, ej godkänt. Provkörs med mutate.mjs utan --genomfor.', framtagen: '2026-10-07', beskrivning, godkand_av: '', ...extra, operationer }, null, 1))
  console.log(`${fil}: ${operationer.length} operationer`)
}

const rsa = (adGroup, a) => ({ adGroupAdOperation: { create: { adGroup, status: 'ENABLED', ad: {
  finalUrls: [a.url],
  responsiveSearchAd: { headlines: a.rubriker.map((text) => ({ text })), descriptions: a.beskrivningar.map((text) => ({ text })), path1: a.sokvag[0], path2: a.sokvag[1] },
} } } })

// ---------- 1. Annons B i fas 1 ----------
const fas1Kampanjer = ['Claude | Sök | Råttor', 'Claude | Sök | Fåglar', 'Claude | Sök | Varumärke']
const opsB1 = []
for (const a of annonserB.filter((x) => fas1Kampanjer.includes(x.kampanj))) {
  const id = gruppId[`${a.kampanj}|${a.grupp}`]
  if (!id) throw new Error(`Annonsgruppen saknas i kontot: ${a.kampanj} | ${a.grupp}`)
  opsB1.push(rsa(`${C}/adGroups/${id}`, a))
}
skriv('2026-10-06_annonser-b-fas1.json', 'Annons B (vinkel: erfarna tekniker, ISO 9001 och 14001, uppföljning) i de elva annonsgrupperna i Claude | Sök | Råttor, Fåglar och Varumärke. Texterna granskade och godkända av skadedjursexperten 2026-10-07.', opsB1)

// ---------- 2. Fas 2 komplett ----------
const bas = JSON.parse(fs.readFileSync(path.join(DIR, '2026-10-06_konto_3-fas2-bygg.json'), 'utf8'))
const ops2 = [...bas.operationer]
const tempKampanj = {}
const tempGrupp = {}
for (const o of bas.operationer) {
  const c = o.campaignOperation?.create
  if (c) tempKampanj[c.name] = c.resourceName
}
const kampanjNamnForTemp = Object.fromEntries(Object.entries(tempKampanj).map(([n, rn]) => [rn, n]))
for (const o of bas.operationer) {
  const g = o.adGroupOperation?.create
  if (g) tempGrupp[`${kampanjNamnForTemp[g.campaign]}|${g.name}`] = g.resourceName
}
let antalB2 = 0
for (const a of annonserB.filter((x) => !fas1Kampanjer.includes(x.kampanj))) {
  const rn = tempGrupp[`${a.kampanj}|${a.grupp}`]
  if (!rn) throw new Error(`Annonsgruppen saknas i fas 2-filen: ${a.kampanj} | ${a.grupp}`)
  ops2.push(rsa(rn, a)); antalB2++
}
// Bilder fas 2: annonsgruppsnivå där kampanjen har flera tjänster, annars kampanjnivå. Bara liggande och kvadrat (sök).
const manifest = JSON.parse(fs.readFileSync(path.join(BILDER, 'manifest.json'), 'utf8'))
const fas2Bilder = manifest.filter((b) => b.fas === 2 && b.status === 'godkand' && b.format !== '4:5')
const BILDKOPPLING = {
  'vagglus-varmetalt-l': { grupper: ['Värmebehandling', 'Vägglöss sanering'] },
  'vagglus-varmetalt-k': { grupper: ['Värmebehandling', 'Vägglöss sanering'] },
  'vagglus-madrass-k': { grupper: ['Vägglöss sanering', 'Vägglushund'] },
  'silverfisk-badrum-l': { grupper: ['Silverfisk'] },
  'silverfisk-badrum-k': { grupper: ['Silverfisk'] },
  'palsanger-matta-l': { grupper: ['Pälsänger'] },
  'palsanger-matta-k': { grupper: ['Pälsänger'] },
  'mjolbaggar-skafferi-k': { grupper: ['Mjölbaggar'] },
  'moss-kok-l': { kampanj: true },
  'moss-kok-k': { kampanj: true },
  'foretag-station-gard-l': { kampanj: true },
  'foretag-lager-k': { kampanj: true },
  'foretag-station-gard-k': { kampanj: true },
}
const bildKopplingar = []
fas2Bilder.forEach((b, i) => {
  const rn = `${C}/assets/-${5001 + i}`
  ops2.push({ assetOperation: { create: { resourceName: rn, name: `Claude ${b.id} 2026-10-07`, type: 'IMAGE', imageAsset: { data: fs.readFileSync(path.join(BILDER, 'klara', `${b.id}.jpg`)).toString('base64') } } } })
  const k = BILDKOPPLING[b.id]
  if (!k) throw new Error(`Ingen koppling för ${b.id}`)
  if (k.kampanj) {
    ops2.push({ campaignAssetOperation: { create: { campaign: tempKampanj[b.kampanj], asset: rn, fieldType: 'AD_IMAGE' } } })
    bildKopplingar.push([b.id, b.kampanj])
  } else {
    for (const g of k.grupper) {
      const ag = tempGrupp[`${b.kampanj}|${g}`]
      if (!ag) throw new Error(`Gruppen ${g} saknas för ${b.id}`)
      ops2.push({ adGroupAssetOperation: { create: { adGroup: ag, asset: rn, fieldType: 'AD_IMAGE' } } })
      bildKopplingar.push([b.id, `${b.kampanj} / ${g}`])
    }
  }
})
skriv('2026-10-06_fas2-komplett.json', `Fas 2 byggs PAUSAD: Claude | Sök | Vägglöss, Insekter i hemmet, Möss, Företag och avtal, Getingar (säsong) och Myror (säsong) med sökord, annons A, tillägg och delade negativa listor (konto_3), plus annons B i tio annonsgrupper (${antalB2}) och ${fas2Bilder.length} bilder fas 2 (granskade av skadedjursexperten) med ${bildKopplingar.length} kopplingar. Startas av 2026-10-06_start-alla.json.`, ops2, { bildkopplingar: bildKopplingar })

// ---------- 3. Logotyper och företagsnamn ----------
const BEGONE_NAMN = `${C}/assets/112323469970` // "BeGone", granskat och GODKÄNT som företagsnamn
const PMAX = '21697769249'
const opsL = []
const logo1 = `${C}/assets/-6001`
const logo4 = `${C}/assets/-6002`
for (const [rn, fil, namn] of [[logo1, 'logo-1x1.png', 'Claude logotyp 1x1 2026-10-07'], [logo4, 'logo-4x1.png', 'Claude logotyp 4x1 2026-10-07']]) {
  opsL.push({ assetOperation: { create: { resourceName: rn, name: namn, type: 'IMAGE', imageAsset: { data: fs.readFileSync(path.join(BILDER, 'klara', fil)).toString('base64') } } } })
}
// Kontonivå: ärvs av alla sökkampanjer utan egen logotyp eller eget namn (även fas 2 när den byggs).
opsL.push({ customerAssetOperation: { remove: `${C}/customerAssets/43078627256~BUSINESS_LOGO` } })
opsL.push({ customerAssetOperation: { create: { asset: logo1, fieldType: 'BUSINESS_LOGO' } } })
opsL.push({ customerAssetOperation: { create: { asset: BEGONE_NAMN, fieldType: 'BUSINESS_NAME' } } })
// Fas 1 explicit på kampanjnivå.
for (const n of fas1Kampanjer) {
  opsL.push({ campaignAssetOperation: { create: { campaign: `${C}/campaigns/${kampanjId[n]}`, asset: logo1, fieldType: 'BUSINESS_LOGO' } } })
  opsL.push({ campaignAssetOperation: { create: { campaign: `${C}/campaigns/${kampanjId[n]}`, asset: BEGONE_NAMN, fieldType: 'BUSINESS_NAME' } } })
}
// PMax Fåglar: byt företagsnamn, ta bort de tre minsta logotyperna (32x32, 150x150 från Instagram, 192x192),
// lägg till de nya. Taket är fem logotyper per kampanj, så borttagen kommer först.
for (const id of ['105375253127', '43078627259', '43078627256']) opsL.push({ campaignAssetOperation: { remove: `${C}/campaignAssets/${PMAX}~${id}~LOGO` } })
opsL.push({ campaignAssetOperation: { remove: `${C}/campaignAssets/${PMAX}~69900569157~BUSINESS_NAME` } })
opsL.push({ campaignAssetOperation: { create: { campaign: `${C}/campaigns/${PMAX}`, asset: BEGONE_NAMN, fieldType: 'BUSINESS_NAME' } } })
opsL.push({ campaignAssetOperation: { create: { campaign: `${C}/campaigns/${PMAX}`, asset: logo1, fieldType: 'LOGO' } } })
opsL.push({ campaignAssetOperation: { create: { campaign: `${C}/campaigns/${PMAX}`, asset: logo4, fieldType: 'LANDSCAPE_LOGO' } } })
skriv('2026-10-06_logotyp-namn.json', 'Nya logotyper (kvadrat 1200x1200 och liggande 1200x300, ordbilden oförändrad på vit botten) och företagsnamnet BeGone (redan granskat och godkänt av Google) på kontonivå, i Claude | Sök | Råttor, Fåglar och Varumärke, och i Claude | PMax | Fåglar (övergång). Den gamla kontologotypen 192x192 och PMax-logotypen 32x32 tas bort, namnet Begone Skadedjur (underkänt i sök, begränsat i PMax) byts mot BeGone.', opsL)

// ---------- 4. PMax Fåglar: texter och tillägg ----------
const AG = `${C}/assetGroups/6516988320`
const pmaxAssets = await q(`SELECT asset_group_asset.field_type, asset.id FROM asset_group_asset WHERE asset_group.id = 6516988320 AND asset_group_asset.status != 'REMOVED' AND asset_group_asset.field_type IN ('HEADLINE','LONG_HEADLINE','DESCRIPTION')`)
const opsP = []
let t = 7001
for (const [falt, lista] of [['HEADLINE', pmax.rubriker], ['LONG_HEADLINE', pmax.langaRubriker], ['DESCRIPTION', pmax.beskrivningar]]) {
  for (const text of lista) {
    const rn = `${C}/assets/-${t++}`
    opsP.push({ assetOperation: { create: { resourceName: rn, textAsset: { text } } } })
    opsP.push({ assetGroupAssetOperation: { create: { assetGroup: AG, asset: rn, fieldType: falt } } })
  }
}
for (const r of pmaxAssets) opsP.push({ assetGroupAssetOperation: { remove: `${AG.replace('assetGroups/', 'assetGroupAssets/')}~${r.asset.id}~${r.assetGroupAsset.fieldType}` } })
const gamlaTillagg = [['41144792313', 'SITELINK'], ['170438311754', 'SITELINK'], ['170467561506', 'SITELINK'], ['170476226401', 'SITELINK'], ['238716674121', 'CALLOUT'], ['259096188326', 'CALLOUT'], ['259096188329', 'CALLOUT'], ['259096188332', 'CALLOUT'], ['125436853183', 'CALL']]
for (const [id, f] of gamlaTillagg) opsP.push({ campaignAssetOperation: { remove: `${C}/campaignAssets/${PMAX}~${id}~${f}` } })
// Samma granskade tillägg som Claude | Sök | Fåglar (redan godkända av Google).
const nyaTillagg = [['428102614277', 'SITELINK'], ['428201437795', 'SITELINK'], ['428201441575', 'SITELINK'], ['428201442211', 'CALLOUT'], ['428201442418', 'CALLOUT'], ['428201442682', 'CALLOUT'], ['428201443147', 'CALLOUT'], ['428201444650', 'CALLOUT'], ['428290368369', 'STRUCTURED_SNIPPET'], ['428102625605', 'CALL']]
for (const [id, f] of nyaTillagg) opsP.push({ campaignAssetOperation: { create: { campaign: `${C}/campaigns/${PMAX}`, asset: `${C}/assets/${id}`, fieldType: f } } })
skriv('2026-10-06_pmax-fagel-texter.json', `Claude | PMax | Fåglar (övergång): ${pmaxAssets.length} gamla texter (BrightBid: "Hundratals nöjda kunder", "Snabb återkoppling", "Alltid ett steg före", "miljö fri från skadedjur", tankstreck m.m.) ersätts med 15 rubriker, 5 långa rubriker och 5 beskrivningar granskade av skadedjursexperten. Gamla tillägg bort (sitelänkar med "I hela Stockholms Län", "Få svar inom 48 timmar", två underkända; framhävningar "Få hjälp inom 48 timmar", "Miljövänligt", "Skräddarsydda lösningar", "Effektiva metoder"; samtalstillägg utan schema). In: fågelsökets granskade sitelänkar, framhävningar, utdrag och samtalstillägg vardagar 08 till 17.`, opsP)

// ---------- 5. PMax Fåglar: gamla bilder bort ----------
const bilderPmax = await q(`SELECT asset_group_asset.field_type, asset.id, asset.name FROM asset_group_asset WHERE asset_group.id = 6516988320 AND asset_group_asset.status != 'REMOVED' AND asset_group_asset.field_type IN ('MARKETING_IMAGE','SQUARE_MARKETING_IMAGE','PORTRAIT_MARKETING_IMAGE')`)
const gamla = bilderPmax.filter((r) => !(r.asset.name || '').startsWith('Claude '))
skriv('2026-10-06_pmax-fagel-bilder-bort.json', `Claude | PMax | Fåglar (övergång): kopplar bort de ${gamla.length} gamla bilderna (BrightBid-bilder från 2024 och stockbilder från 2025) så att bara de sex granskade bilderna från fas 1 visas. Körs när de nya bilderna är godkända av Google (de är det 2026-10-07).`,
  gamla.map((r) => ({ assetGroupAssetOperation: { remove: `${AG.replace('assetGroups/', 'assetGroupAssets/')}~${r.asset.id}~${r.assetGroupAsset.fieldType}` } })),
  { bilder: gamla.map((r) => `${r.asset.id} ${r.assetGroupAsset.fieldType} ${r.asset.name || ''}`) })

// ---------- 6. Start alla ----------
const BUDGET = {
  'Claude | Sök | Råttor': 1550, 'Claude | Sök | Fåglar': 800, 'Claude | PMax | Fåglar (övergång)': 200, 'Claude | Sök | Varumärke': 180,
  'Claude | Sök | Vägglöss': 600, 'Claude | Sök | Insekter i hemmet': 450, 'Claude | Sök | Möss': 450, 'Claude | Sök | Företag och avtal': 200,
}
const starta = ['Claude | Sök | Råttor', 'Claude | Sök | Fåglar', 'Claude | Sök | Varumärke', 'Claude | Sök | Vägglöss', 'Claude | Sök | Insekter i hemmet', 'Claude | Sök | Möss', 'Claude | Sök | Företag och avtal']
const pausa = {
  '19729967497': 'Claude | Råttbekämpning (gammal, rensad)', '20818570318': 'BrightBid_High Priority_Råttbekämpning_PMax',
  '17655089896': 'Brightbid - [Pmax] - Websites + Own Data + Generic Terms', '17434641058': 'BrightBid_High Priority_Fågelsäkring_Fågelbekämpning',
  '17434641064': 'Brightbid - Standard - Silverfisk | Pälsänger | Mjölbaggar | Vägglöss', '17434641052': 'Brightbid - Standard - Möss',
  '17434641049': 'Brightbid - Search - Getingar', '17434641046': 'Brightbid - Standard - Myror',
}
const opsS = []
for (const [id] of Object.entries(pausa)) opsS.push({ campaignOperation: { update: { resourceName: `${C}/campaigns/${id}`, status: 'PAUSED' }, updateMask: 'status' } })
opsS.push({ campaignOperation: { update: { resourceName: `${C}/campaigns/${PMAX}`, name: 'Claude | PMax | Fåglar (övergång)' }, updateMask: 'name' } })
opsS.push({ campaignBudgetOperation: { update: { resourceName: `${C}/campaignBudgets/13914659886`, amountMicros: '200000000' }, updateMask: 'amountMicros' } })
const saknas = []
for (const n of starta) {
  if (!kampanjId[n]) { saknas.push(n); continue }
  opsS.push({ campaignOperation: { update: { resourceName: `${C}/campaigns/${kampanjId[n]}`, status: 'ENABLED' }, updateMask: 'status' } })
}
// Kontroll: budget i kontot mot planen för de kampanjer som finns.
const budgetKontot = Object.fromEntries(kampanjer.map((r) => [r.campaign.name, Number(r.campaignBudget.amountMicros) / 1e6]))
const kontroll = Object.entries(BUDGET).map(([n, b]) => ({ kampanj: n, plan: b, kontot: n.startsWith('Claude | PMax') ? 200 : budgetKontot[n] ?? null }))
const summa = Object.values(BUDGET).reduce((a, b) => a + b, 0)
skriv('2026-10-06_start-alla.json', `Gemensam start: startar ${starta.join(', ')}; PMax Fåglar döps om till Claude | PMax | Fåglar (övergång) och får 200 kr; pausar ${Object.values(pausa).join(', ')}. Dagsbudget efter start ${summa} kr (oförändrad total).`, opsS,
  { budget_efter_start: kontroll, summa_kr_per_dag: summa, saknas_i_kontot: saknas })
if (saknas.length) console.log(`VARNING: ${saknas.join(', ')} finns inte i kontot än. Genomför fas2-komplett, kör sedan skriptet med --bara-start och provkör startfilen igen.`)
