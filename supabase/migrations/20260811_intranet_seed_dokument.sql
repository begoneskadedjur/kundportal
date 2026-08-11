-- ============================================================
-- Intranät: seed av de fyra obligatoriska dokumenten.
-- Innehållet är återskapat ordagrant från originaldokumenten
-- (Word), endast omstrukturerat till block för rendering.
-- Pappersblankettens datum/signatur ersätts av digital kvittens.
-- ============================================================

INSERT INTO intranet_documents (slug, title, summary, section, category, sort_order, source_updated_at, content)
VALUES
(
  'introduktion-km-arbete',
  'Introduktion till Begones KM-arbete',
  'Vad vårt kvalitets- och miljöledningssystem enligt ISO 9001 och ISO 14001 innebär för dig i det dagliga arbetet.',
  'obligatoriskt',
  'introduktion',
  1,
  NULL,
  $json$[
    {"type":"p","text":"BeGone Skadedjur & Sanering har ett ledningssystem som uppfyller kraven i ISO 9001 (kvalitet) och ISO 14001 (miljö). I detta dokument får du en introduktion i vad det arbetet innebär för din del."},
    {"type":"p","text":"Vi på BeGone brinner för att både kunder och miljön ska vara nöjda med vårt utförda arbete och vi hoppas att du vill vara delaktig i vårt kvalitets- och miljöarbete som beskrivs i detta dokument."},
    {"type":"h2","text":"Vad är viktigt för oss på BeGone?"},
    {"type":"p","text":"För oss är nedanstående punkter viktiga, så viktiga att de ska genomsyra ditt och vårt dagliga arbete:"},
    {"type":"list","items":[
      "Kundtillfredsställelse: Att alltid sätta kundens behov i första rummet.",
      "Effektivitet i skadedjursbekämpning: Använda pålitliga och beprövade metoder för att erbjuda snabba lösningar.",
      "Miljöhänsyn: Välja miljöanpassade och hållbara produkter och metoder i möjligaste mån.",
      "Säkerhet först: Se till att alla behandlingar är säkra för människor, husdjur och omgivningen.",
      "Uppdaterad kunskap: Kontinuerlig utbildning och kompetensutveckling för all personal.",
      "Kvalitet i service: Leverera högkvalitativa tjänster med professionellt bemötande.",
      "Innovativ utveckling: Ständigt utforska nya teknologier och metoder för att förbättra effektiviteten.",
      "Samarbeta och stödja: Bygga starka relationer med samarbetspartners och lokalsamhället.",
      "Transparens: Var tydliga och ärliga i kommunikationen med kunder och anställda."
    ]},
    {"type":"h2","text":"Hur vi påverkar miljön"},
    {"type":"p","text":"Alla verksamheter har någon typ av miljöpåverkan, även vi. För att hitta de områden där vi har störst påverkan har vi kartlagt vår miljöpåverkan ur ett livscykelperspektiv. Det innebär att vi har tittat på miljöpåverkan från tillverkningen av de produkter som vi köper in till miljöpåverkan från våra tjänster."},
    {"type":"chain","title":"Livscykelperspektiv","steps":["Råvaror","Tillverkning","Transport","Bekämpning","Transport","Avfall"],"labels":["Uppströms","Uppströms","Uppströms","Direkt","Nedströms","Nedströms"]},
    {"type":"p","text":"Vi har valt att prioritera följande områden i vårt miljöarbete:"},
    {"type":"list","items":["Transporter i egna fordon","Bekämpningsmedel","Gnagarfällor"]},
    {"type":"h2","text":"Vår målsättning"},
    {"type":"motto","text":"Vi ska minska kundernas skadedjursproblem med så liten miljöpåverkan som möjligt!"},
    {"type":"h3","text":"Vad innebär målet?"},
    {"type":"p","text":"Genom att lösa kundernas skadedjursproblem med så få besök som möjligt, får vi både en nöjd kund och en nöjd natur."},
    {"type":"p","text":"Målet är med andra ord ett integrerat miljö- och kvalitetsmål. Miljövinsten blir både en minskad spridning av bekämpningsmedel och inga onödiga transporter. Kvalitetsvinsten blir en nöjd kund som snabbt blir av med sitt skadedjursproblem."},
    {"type":"h3","text":"Vad kan du göra för att målet ska nås?"},
    {"type":"list","items":[
      "Kartlägga grundorsaken till skadedjursangreppet och anpassa behandlingen av problemet med utgångspunkt från detta.",
      "Bevaka nya bekämpningsmetoder och vara delaktig i utprovningen av nya arbetssätt i samråd med VD och Marknadschef."
    ]},
    {"type":"h2","text":"Avvikelser, dvs sådant som inte fungerar, ska rapporteras"},
    {"type":"p","text":"Sådant som inte fungerar ska rapporteras till VD. Exempel på sådant som inte fungerar kan vara:"},
    {"type":"list","items":[
      "Rutiner som inte fungerar, följs eller där rutin saknas.",
      "Tillbud, olyckor, brand eller spill/läckage av bekämpningsmedel.",
      "Lagöverträdelser eller när överenskommelser med kunder/beställare inte uppfylls.",
      "Kundklagomål."
    ]},
    {"type":"p","text":"Syftet med avvikelserapporten är att hitta återkommande eller allvarliga problem som vi behöver åtgärda för att förhindra att de inträffar igen."},
    {"type":"callout","variant":"success","title":"Rapportera direkt i portalen","text":"Det är bättre att du rapporterar en gång för mycket än en gång för lite. Använd knappen Rapportera tillbud, avvikelse eller olycka i sidomenyn, så når rapporten rätt person direkt."},
    {"type":"h2","text":"Nödlägesberedskap"},
    {"type":"p","text":"Vi har specifika rutiner som beskriver hur du ska agera vid nödlägen som olyckor, tillbud, brand och kemikaliespill. Nedan följer en kortfattad beskrivning av vad som gäller. Mer detaljerad beskrivning finns i BeGones KM-handbok."},
    {"type":"p","text":"Alla inträffade nödlägen ska rapporteras till VD och hanteras som en avvikelse enligt föregående avsnitt."},
    {"type":"h3","text":"Olyckor och tillbud"},
    {"type":"p","text":"Skillnaden mellan en olycka och ett tillbud är att vid en olycka uppstår en skada. Vid ett tillbud kunde någon ha skadats om hen inte hade haft turen på sin sida."},
    {"type":"p","text":"Både tillbud och olyckor är viktiga att rapportera för att vi ska kunna förebygga att någon skadas eller drabbas av ohälsa på jobbet."},
    {"type":"h3","text":"Spill av bekämpningsmedel"},
    {"type":"p","text":"Om ett spill eller läckage av bekämpningsmedel skulle uppstå ska vi begränsa spridningen i naturen. Följ instruktionerna som du har fått i ISO-utbildningen."},
    {"type":"h3","text":"Brand"},
    {"type":"callout","variant":"warning","title":"Vid brand gäller","text":"RÄDDA - VARNA - UTRYM - LARMA - SLÄCK OM MÖJLIGT."},
    {"type":"h2","text":"Vårt KM-arbete finns beskrivet i KM-handboken"},
    {"type":"p","text":"Hur vi arbetar med KM-arbetet i våra uppdrag finns beskrivet i KM-handboken. Den finns tillgänglig via Marknadschef."},
    {"type":"callout","variant":"info","title":"Vad din kvittens omfattar","text":"När du kvitterar detta dokument intygar du även att du har tagit del av och förstått innehållet i Kvalitetspolicyn och Miljöpolicyn samt följande rutiner i KM-handboken: 3. Skadedjursbekämpning och sanering, 4. Utrustning, 5. Hantering av bekämpningsmedel och avfall, 7. Nödlägesberedskap."}
  ]$json$::jsonb
),
(
  'arbetsmiljopolicy',
  'Arbetsmiljöpolicy',
  'Hur vi tillsammans skapar en säker, hälsosam och trivsam arbetsmiljö, i fält, på kontoret och i hemmet.',
  'obligatoriskt',
  'policy',
  2,
  '2025-02-14',
  $json$[
    {"type":"h2","text":"1. Inledning"},
    {"type":"p","text":"Begone Skadedjur & Sanering AB är engagerade i att skapa en säker, hälsosam och trivsam arbetsmiljö för alla medarbetare. Eftersom majoriteten av våra anställda arbetar ute på fältet hos kunder, samt att vissa arbetsuppgifter utförs hemifrån, anpassas arbetsmiljöarbetet efter dessa förutsättningar."},
    {"type":"p","text":"Arbetsmiljöarbetet är en kontinuerlig process där vi tillsammans identifierar och förebygger risker, följer gällande arbetsmiljölagstiftning och säkerställer att våra medarbetare får de resurser och den kunskap som krävs för att arbeta tryggt och effektivt."},
    {"type":"h2","text":"2. Arbetsmiljöansvar och roller"},
    {"type":"list","items":[
      "Kristian Agnevik, VD och skyddsombud, ansvarar för det systematiska arbetsmiljöarbetet och att arbetsmiljöregler efterlevs.",
      "Christian Karlsson, marknadschef och ansvarig för reklamationer, hanterar kundrelaterade arbetsmiljöfrågor.",
      "Sofia Pålshagen, koordinator och mottagare av visselblåsningar, ansvarar för att hantera rapportering av missförhållanden i arbetsmiljön."
    ]},
    {"type":"p","text":"Alla anställda har ett ansvar att följa säkerhetsföreskrifter, använda personlig skyddsutrustning och rapportera arbetsmiljörisker."},
    {"type":"h2","text":"3. Förebyggande arbetsmiljöarbete"},
    {"type":"h3","text":"3.1 Första hjälpen och krisstöd"},
    {"type":"list","items":[
      "Rutiner för första hjälpen och krisstöd finns på varje arbetsställe.",
      "Alla anställda ska veta var och hur de får tillgång till första hjälpen vid behov.",
      "Utsedda personer med ansvar för första hjälpen ska få kontinuerlig utbildning."
    ]},
    {"type":"h3","text":"3.2 Ensamarbete"},
    {"type":"list","items":[
      "Ensamarbete är vanligt i vår verksamhet och kräver särskild hänsyn.",
      "Medarbetare ska ha fungerande kommunikationsutrustning och tydliga rutiner för att kunna larma vid behov.",
      "Vid uppdrag med hög säkerhetsrisk ska en riskbedömning göras innan arbetet utförs."
    ]},
    {"type":"h3","text":"3.3 Fallskydd och ergonomi"},
    {"type":"list","items":[
      "Vid arbete på höga höjder ska lämpliga skyddsåtgärder vidtas för att förhindra fall.",
      "Användning av fallskydd är obligatoriskt där fallrisk förekommer.",
      "Ergonomiska arbetsmetoder främjas för att undvika belastningsskador."
    ]},
    {"type":"h3","text":"3.4 Personlig skyddsutrustning"},
    {"type":"list","items":[
      "Arbetsgivaren tillhandahåller godkänd personlig skyddsutrustning utan kostnad.",
      "Medarbetare ansvarar för att använda skyddsutrustningen enligt anvisningar.",
      "Regelbundna kontroller görs för att säkerställa att utrustningen är i gott skick."
    ]},
    {"type":"h2","text":"4. Arbetstider och övertid"},
    {"type":"list","items":[
      "Övertid och jourtid registreras enligt gällande lagkrav.",
      "Arbetsgivaren säkerställer att arbetstider är hållbara för att förebygga arbetsrelaterad stress och ohälsa.",
      "Medarbetare ska ha tydliga scheman och rimliga viloperioder mellan arbetspassen."
    ]},
    {"type":"h2","text":"5. Psykosocial arbetsmiljö och visselblåsning"},
    {"type":"list","items":[
      "Vi strävar efter en trygg och inkluderande arbetsplats där alla medarbetare behandlas med respekt.",
      "Arbetsbelastningen ska vara rimlig och anpassad efter varje medarbetares förutsättningar.",
      "Visselblåsarfunktionen hanteras av Sofia Pålshagen, och rapportering kan ske anonymt."
    ]},
    {"type":"h2","text":"6. Brandskydd och utrymning"},
    {"type":"list","items":[
      "Brandskydd och brandsläckare finns i företagets fordon samt i hemmakontoren för de som arbetar på distans.",
      "När våra tekniker arbetar ute hos kund ansvarar kunden för brandskyddet i sina lokaler.",
      "Vid arbete i riskfyllda miljöer ska tekniker säkerställa att de känner till kundens utrymningsvägar och rutiner vid brand."
    ]},
    {"type":"h2","text":"7. Arbetsmiljö i hemmaarbetet"},
    {"type":"list","items":[
      "För de medarbetare som arbetar hemifrån säkerställs att de har en ergonomiskt anpassad arbetsplats.",
      "Synundersökning erbjuds till medarbetare som arbetar vid bildskärm mer än en timme per dag.",
      "Arbetsmiljöregler gäller även vid arbete i hemmet."
    ]},
    {"type":"h2","text":"8. Uppföljning och förbättring"},
    {"type":"list","items":[
      "Arbetsmiljöarbetet utvärderas regelbundet genom skyddsronder och medarbetarsamtal.",
      "Arbetsmiljöincidenter analyseras och åtgärder vidtas för att förhindra upprepning.",
      "Arbetsmiljöpolicyn uppdateras årligen och kommuniceras till alla medarbetare."
    ]},
    {"type":"p","text":"Denna policy är ett styrdokument för hur vi på Begone Skadedjur & Sanering AB arbetar för en säker och hälsosam arbetsmiljö. Vid frågor eller synpunkter, kontakta skyddsombud eller ledning."}
  ]$json$::jsonb
),
(
  'kvalitetspolicy',
  'Kvalitetspolicy',
  'Vad hög kvalitet betyder för oss och hur vi lever upp till det i varje uppdrag.',
  'obligatoriskt',
  'policy',
  3,
  NULL,
  $json$[
    {"type":"p","text":"Skadedjur i hem eller på en arbetsplats kan orsaka stora problem och vi på BeGone Skadedjur & Sanering erbjuder ett brett utbud av tjänster, inklusive identifiering av skadedjurets art, säkra bekämpningsmetoder och förebyggande åtgärder."},
    {"type":"p","text":"Vad hög kvalitet på en produkt eller tjänst är varierar både mellan olika företag och olika kunder, men för oss innebär en hög kvalitet på våra tjänster att vi:"},
    {"type":"list","items":[
      "Har en snabb handläggning av våra kunders problem. En kund ska med andra ord inte behöva vänta på återkoppling från oss.",
      "Inte bara åtgärdar symptomen på skadedjursproblemet, utan strävar efter att även ta bort grundorsaken till varför problemet uppstod. Dvs vi ska inte bara ta bort själva skadedjuren utan även ta bort orsaken till att de är i kundernas hus och fastigheter till att börja med.",
      "Har ett team av professionella skadedjursexperter med de behörigheter, kunskap och erfarenhet som behövs, för att lösa den skadedjursproblematik som kan uppstå ute hos kunden.",
      "Utgår från kundens problem vid val av bekämpningsmetod. Självklart använder vi enbart godkända bekämpningsmedel och prioriterar miljöanpassade alternativ när det är möjligt.",
      "Uppfyller de krav som kunder, myndigheter och övriga relevanta intressenter ställer på oss.",
      "Aldrig är nöjda med våra metoder och arbetssätt, utan ständigt förbättrar oss för att bli ännu bättre och effektivare i vårt kvalitetsarbete."
    ]},
    {"type":"motto","text":"Vi skapar en säker miljö, fri från skadedjur!"}
  ]$json$::jsonb
),
(
  'miljopolicy',
  'Miljöpolicy',
  'Hur vi löser kundernas skadedjursproblem med minsta möjliga miljöpåverkan.',
  'obligatoriskt',
  'policy',
  4,
  NULL,
  $json$[
    {"type":"p","text":"Skadedjur i hem eller på en arbetsplats kan orsaka stora problem och vi på BeGone Skadedjur & Sanering erbjuder ett brett utbud av tjänster, inklusive identifiering av skadedjurets art, säkra bekämpningsmetoder och förebyggande åtgärder."},
    {"type":"p","text":"I vår bransch blir miljöarbetet utmanande, då vi både ska lösa kundernas skadedjursproblem och samtidigt ta hänsyn till miljön. En utmaning som vi är villiga att anta."},
    {"type":"motto","text":"Vi ska lösa kundernas skadedjursproblem med minsta möjliga miljöpåverkan!"},
    {"type":"p","text":"Rent konkret innebär det att vi, i vårt arbete för att skydda miljön och förebygga föroreningar:"},
    {"type":"list","items":[
      "Utgår från kundens problem vid val av bekämpningsmetod. Självklart använder vi enbart godkända bekämpningsmedel och prioriterar miljöanpassade alternativ när det är möjligt.",
      "Har hög service, ju snabbare åtgärd, desto mindre medel behöver användas för att lösa kundens problem. En win win för både kund och miljö.",
      "Samordnar våra uppdrag för att minska miljöpåverkan från transporterna. Vi har även som målsättning att undvika onödiga transporter.",
      "Väljer servicebilar med utgångspunkt från EURO-klass och koldioxidutsläpp.",
      "Följer gällande miljöförfattningar och övriga relevanta intressentkrav.",
      "Arbetar för att ständigt förbättra vårt miljöarbete och minska vår miljöpåverkan."
    ]}
  ]$json$::jsonb
)
ON CONFLICT (slug) DO NOTHING;
