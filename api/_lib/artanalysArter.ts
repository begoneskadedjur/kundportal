// api/_lib/artanalysArter.ts
// Referenssamlingen för artanalysen på begone.se, i den korta form som frågan till AI:n behöver.
// Källa: docs/begone-se/kluster/artanalys.md avsnitt D.2 (24 arter, version 2026-10-04), plus fem arter
// 2026-10-06 (stadsduva, trut eller fiskmås, kaja, skogsmus, brokig pälsänger; 29 arter). Sajtens
// fullständiga kopia med råd och länkar ligger i begone-se/src/data/artanalys.json. Ändras en art
// där ska samma rad ändras här, så att id:n och kännetecken stämmer mellan sajten och API:t.
//
// Underscore-prefix: exponeras inte som endpoint.

export interface ArtanalysArt {
  id: string
  namn: string
  vetenskapligt: string
  storlek: string
  kannetecken: string[]
}

export const ARTANALYS_VERSION = '2026-10-06'

export const ARTANALYS_ARTER: ArtanalysArt[] = [
  { id: 'vagglus', namn: 'Vägglus', vetenskapligt: 'Cimex lectularius', storlek: '4 till 5 mm', kannetecken: ['Oval, platt och rödbrun', 'Kryper, hoppar inte', 'Svarta prickar och ljusa skal i madrassens sömmar'] },
  { id: 'loppa', namn: 'Loppa', vetenskapligt: 'Ceratophyllus gallinae, Ctenocephalides felis', storlek: '2 till 4 mm', kannetecken: ['Smal och platt från sidorna, mörkbrun', 'Hoppar långt', 'Kommer från fågelbon och husdjur'] },
  { id: 'skinnbagge', namn: 'Skinnbagge från fågel eller fladdermus', vetenskapligt: 'Cimex pipistrelli, Cimex hirundinis', storlek: '3 till 5 mm', kannetecken: ['Nästan som en vägglus men hårigare', 'Fynden vid fönster, tak och ytterväggar', 'Sällan djupt i madrassen'] },
  { id: 'boklus', namn: 'Boklus', vetenskapligt: 'Liposcelis spp.', storlek: '1 till 2 mm', kannetecken: ['Ljus, mjuk och snabb', 'Rör sig i ryck', 'Biter inte'] },
  { id: 'silverfisk', namn: 'Vanlig silverfisk', vetenskapligt: 'Lepisma saccharina', storlek: '10 till 12 mm', kannetecken: ['Silverglänsande och spolformad', 'Antenner och tre bakspröt kortare än kroppen', 'Håller sig där det är fuktigt'] },
  { id: 'langsprotad_silverfisk', namn: 'Långsprötad silverfisk', vetenskapligt: 'Ctenolepisma longicaudata', storlek: '10 till 18 mm', kannetecken: ['Grå och mattare', 'Antenner och tre bakspröt längre än kroppen', 'Finns också i torra rum'] },
  { id: 'palsanger', namn: 'Vanlig pälsänger', vetenskapligt: 'Attagenus pellio', storlek: '3,6 till 5,7 mm', kannetecken: ['Svart bagge med en vit prick på varje täckvinge', 'Flyger mot ljuset och hamnar i fönstret', 'Främst april till juni'] },
  { id: 'palsangerlarv', namn: 'Pälsängerlarv', vetenskapligt: 'Attagenus spp.', storlek: 'Upp till cirka 10 mm', kannetecken: ['Brun och hårig', 'Lång hårtofs i bakänden', 'Ingen glans, lämnar tomma larvskinn'] },
  { id: 'brokig_palsanger', namn: 'Brokig pälsänger', vetenskapligt: 'Anthrenus verbasci', storlek: '2 till 3,5 mm', kannetecken: ['Liten och rund, brokig av vita, gula och bruna fjäll', 'Vuxna i fönstret och på blommor på våren och försommaren', 'Larven kort, randig och hårig med hårtofsar i bakänden'] },
  { id: 'tysk_kackerlacka', namn: 'Tysk kackerlacka', vetenskapligt: 'Blattella germanica', storlek: '10 till 15 mm', kannetecken: ['Platt och ljusbrun', 'Två mörka ränder på halsskölden bakom huvudet', 'Långa antenner, springer snabbt på natten'] },
  { id: 'skogskackerlacka', namn: 'Skogskackerlacka', vetenskapligt: 'Ectobius lapponicus', storlek: '7 till 12 mm', kannetecken: ['Mindre än den tyska kackerlackan', 'Hittas enstaka', 'Ofta en sommarkväll'] },
  { id: 'mjolbagge', namn: 'Rismjölbagge och kastanjebrun mjölbagge', vetenskapligt: 'Tribolium confusum, Tribolium castaneum', storlek: '3 till 3,5 mm', kannetecken: ['Rödbrun, långsträckt och platt', 'Ser mörk ut på håll', 'Lever i mjöl, gryn och flingor'] },
  { id: 'brodbagge', namn: 'Brödbagge', vetenskapligt: 'Stegobium paniceum', storlek: '2 till 3,5 mm', kannetecken: ['Rund, rödbrun och fint hårig', 'Huvudet syns inte ovanifrån', 'Gnager hål i förpackningar'] },
  { id: 'stor_mjolbagge', namn: 'Stor mjölbagge', vetenskapligt: 'Tenebrio molitor', storlek: '12 till 18 mm', kannetecken: ['Mörkbrun till svartbrun och långsträckt', 'Fina längsfåror på täckvingarna', 'Larven gulbrun, upp till 30 mm'] },
  { id: 'kladesmal', namn: 'Klädesmal', vetenskapligt: 'Tineola bisselliella', storlek: 'Vingspann 9 till 15 mm', kannetecken: ['Liten fjäril', 'Enfärgat blekt brungul med svag glans', 'Fladdrar undan i mörka garderober'] },
  { id: 'koksmott', namn: 'Köksmott (indisk mjölmott)', vetenskapligt: 'Plodia interpunctella', storlek: 'Vingbredd 14 till 22 mm', kannetecken: ['Framvingarna ljusa inåt och rödbruna ytterst', 'Flyger i köket', 'Larverna spinner trådar i torrvaror'] },
  { id: 'bananfluga', namn: 'Bananfluga', vetenskapligt: 'Drosophila melanogaster', storlek: '2 till 3 mm', kannetecken: ['Gulbrun', 'Tegelröda ögon', 'Samlas kring frukt, spill och sopor'] },
  { id: 'sorgmygga', namn: 'Sorgmygga', vetenskapligt: 'Sciaridae', storlek: '2 till 4 mm', kannetecken: ['Svart och smal', 'Långa ben och antenner', 'Lyfter från blomjorden när du vattnar'] },
  { id: 'svartmyra', namn: 'Svartmyra', vetenskapligt: 'Lasius niger', storlek: '2 till 5 mm', kannetecken: ['Svart till svartbrun och matt', 'Går i rader in efter mat', 'Boet ute'] },
  { id: 'faraomyra', namn: 'Faraomyra', vetenskapligt: 'Monomorium pharaonis', storlek: 'Omkring 2 mm', kannetecken: ['Gulbrun med något mörkare bakkroppsspets', 'Bara inomhus i uppvärmda hus', 'Syns året runt, även mitt i vintern'] },
  { id: 'hastmyra', namn: 'Hästmyra', vetenskapligt: 'Camponotus herculeanus', storlek: 'Arbetare 5 till 12 mm', kannetecken: ['Stor och svartbrun', 'Rödbrun mellankropp', 'Fint träspån vid lister'] },
  { id: 'geting', namn: 'Vanlig geting', vetenskapligt: 'Vespula vulgaris', storlek: 'Arbetare 11 till 14 mm', kannetecken: ['Slät och blank, klargul och svart', 'Tydlig midja', 'Vingarna hopvikta längs kroppen'] },
  { id: 'balgeting', namn: 'Bålgeting', vetenskapligt: 'Vespa crabro', storlek: 'Arbetare 18 till 24 mm', kannetecken: ['Större än en geting', 'Rödbrun och gul', 'Lugn borta från boet'] },
  { id: 'husmus', namn: 'Husmus', vetenskapligt: 'Mus musculus', storlek: '7 till 10 cm utan svans', kannetecken: ['Ljusbrun med vit undersida, utan skarp gräns', 'Mörk svans, något kortare än kroppen', 'Spillning 3 till 6 mm, mörk och spetsig'] },
  { id: 'skogsmus', namn: 'Skogsmus', vetenskapligt: 'Apodemus flavicollis, Apodemus sylvaticus', storlek: '8 till 13 cm utan svans', kannetecken: ['Gråbrun till gulbrun rygg och vit buk med skarp gräns', 'Stora ögon och öron, långa bakben', 'Tvåfärgad svans, mörk ovanpå och ljus under'] },
  { id: 'brunratta', namn: 'Brunråtta', vetenskapligt: 'Rattus norvegicus', storlek: '20 till 27 cm utan svans', kannetecken: ['Gråbrun med trubbig nos', 'Svansen kortare än kroppen', 'Spillning 1 till 2 cm'] },
  { id: 'stadsduva', namn: 'Stadsduva', vetenskapligt: 'Columba livia domestica', storlek: '31 till 34 cm', kannetecken: ['Oftast blågrå med två mörka band över vingen', 'Grönlila glans på halsen, färgen varierar mycket', 'Sitter på avsatser, balkonger och tak, häckar nästan året runt'] },
  { id: 'trut_mas', namn: 'Trut eller fiskmås', vetenskapligt: 'Larus argentatus, Larus canus', storlek: '40 till 67 cm', kannetecken: ['Vit med grå rygg och grå vingar med svarta spetsar', 'Gul näbb, gråtruten med en röd fläck', 'Häckar på platta tak och skriker högt vid boet'] },
  { id: 'kaja', namn: 'Kaja', vetenskapligt: 'Coloeus monedula', storlek: '33 till 34 cm', kannetecken: ['Svart med grå nacke', 'Ljust, nästan vitt öga', 'Bygger bo i skorstenar, ventiler och hål i takfoten'] },
]

export const ARTANALYS_IDS = ARTANALYS_ARTER.map((a) => a.id)
