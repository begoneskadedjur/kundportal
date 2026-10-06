// Bygger förslagsfilen för annonsbilder fas 1 ur manifestet (bara bilder med status "godkand").
// Kör: node scripts/ads/bygg-bildforslag.mjs   (skriver docs/begone-se/ads/andringar/2026-10-06_bilder-fas1.json)
// Provkör sedan: node --env-file=.env.local scripts/ads/mutate.mjs docs/begone-se/ads/andringar/2026-10-06_bilder-fas1.json
import fs from 'node:fs';
import path from 'node:path';

const C = 'customers/9407604856';
const MAPP = 'docs/begone-se/ads/bilder';
const UT = 'docs/begone-se/ads/andringar/2026-10-06_bilder-fas1.json';
const manifest = JSON.parse(fs.readFileSync(path.join(MAPP, 'manifest.json'), 'utf8'));

// Sökkampanjer tar liggande och kvadrat som bildtillägg (AD_IMAGE). PMax tar alla tre formaten.
const SOK = { rattor: '24321036648', faglar: '24326353874', varumarke: '24321036645' };
const PMAX_FAGEL_GRUPP = '6516988320';
const FALTTYP = { '1.91:1': 'MARKETING_IMAGE', '1:1': 'SQUARE_MARKETING_IMAGE', '4:5': 'PORTRAIT_MARKETING_IMAGE' };

// Varumärket får de allmänna bilderna plus två neutrala råttbilder (station och tätning).
const VARUMARKE_EXTRA = ['ratt-station-husgrund-l', 'ratt-nat-grundventil-k'];
// Spillningsbilden är grövre än de andra (expertens kommentar) och används bara i fågelsöket, inte i PMax.
const INTE_PMAX = ['fagel-spillning-balkong-l'];

const godkanda = manifest.filter((b) => b.status === 'godkand');
const ops = [];
const temp = {};
godkanda.forEach((b, i) => {
  const rn = `${C}/assets/-${i + 1}`;
  temp[b.id] = rn;
  const data = fs.readFileSync(path.join(MAPP, 'klara', `${b.id}.jpg`)).toString('base64');
  ops.push({ assetOperation: { create: { resourceName: rn, name: `Claude ${b.id} 2026-10-06`, type: 'IMAGE', imageAsset: { data } } } });
});

const kampanj = (id, b) => ops.push({ campaignAssetOperation: { create: { campaign: `${C}/campaigns/${id}`, asset: temp[b.id], fieldType: 'AD_IMAGE' } } });
const kopplingar = [];
for (const b of godkanda) {
  const sok = b.format !== '4:5';
  if (sok && b.id.startsWith('ratt-')) { kampanj(SOK.rattor, b); kopplingar.push([b.id, 'Claude | Sök | Råttor']); }
  if (sok && b.id.startsWith('fagel-')) { kampanj(SOK.faglar, b); kopplingar.push([b.id, 'Claude | Sök | Fåglar']); }
  if (sok && (b.id.startsWith('allm-') || VARUMARKE_EXTRA.includes(b.id))) { kampanj(SOK.varumarke, b); kopplingar.push([b.id, 'Claude | Sök | Varumärke']); }
  if (b.id.startsWith('fagel-') && !INTE_PMAX.includes(b.id)) {
    ops.push({ assetGroupAssetOperation: { create: { assetGroup: `${C}/assetGroups/${PMAX_FAGEL_GRUPP}`, asset: temp[b.id], fieldType: FALTTYP[b.format] } } });
    kopplingar.push([b.id, 'BrightBid PMax - Fågelsäkring']);
  }
}

fs.writeFileSync(UT, JSON.stringify({
  beskrivning: `Annonsbilder fas 1: ${godkanda.length} nya bildtillgångar (Gemini, godkända av skadedjursexperten) kopplade till Claude | Sök | Råttor, Claude | Sök | Fåglar, Claude | Sök | Varumärke (bildtillägg) och BrightBid PMax - Fågelsäkring (tillgångsgrupp Fågelsäkring 1). Gamla bilder rörs inte här.`,
  godkand_av: '',
  kopplingar,
  operationer: ops,
}, null, 1));
console.log(`${UT}: ${ops.length} operationer (${godkanda.length} bilder, ${kopplingar.length} kopplingar)`);
