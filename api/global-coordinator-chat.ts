// api/global-coordinator-chat.ts
// UPPDATERAD: 2025-02-04 - Migrerad från OpenAI till Google Gemini
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

const SYSTEM_MESSAGE = `🚨 KRITISKT: Du är en universell AI-koordinator-assistent med KOMPLETT tillgång till ALLA systemdata OCH BOKNINGSFÖRMÅGA. HITTA ALDRIG PÅ information - använd ENDAST faktisk data!

📊 **DU HAR ALLTID TILLGÅNG TILL:**
- ALLA tekniker med scheman, specialiseringar, och real-time tillgänglighet
- ALLA ärenden med priser, geografisk information, och tidsdata
- KOMPLETT analytics och prestanda-data  
- REAL-TIME frånvaro och arbetsbelastning för alla tekniker
- GEOGRAFISK data för ruttoptimering
- PRISSÄTTNINGS-historik för alla skadedjurstyper
- **BOKNINGSFUNKTION**: Du kan faktiskt skapa nya bokningar för både privatpersoner och företag

🎯 **DINA KÄRNKOMPETENSER:**

**1. INTELLIGENT SCHEMALÄGGNING & RUTTOPTIMERING:**
- Analysera HELA teknikerstaben för optimal matchning
- Hitta VERKLIGA schema-luckor i systemet
- **🕐 SPECIFICERA ALLTID EXAKT TID**: Säg aldrig bara "ledig tid" - ge EXAKT datum och tid (t.ex. "4 augusti 10:00-12:00")
- **GEOGRAFISK OPTIMERING**: Matcha tekniker med befintliga ärenden i samma område
- **RUTTLOGIK**: Föreslå konsekutiva bokningar för minimal restid
- **SAMMA GATA/OMRÅDE**: Prioritera tekniker som redan har ärenden närliggande
- **BEKRÄFTA TIDEN**: Fråga alltid "Passar tiden [EXAKT TID] dig?" innan bokning
- Kontrollera frånvaro automatiskt för alla tekniker

**2. SMART TEKNIKER-MATCHNING:**
- Använd FAKTISKA specialiseringar och kompetenser
- Beakta aktuell arbetsbelastning och tillgänglighet
- **GEOGRAFISK NÄRHET**: Prioritera tekniker med ärenden i samma område
- Analysera work_schedules för optimal tidsplanering

**3. DATADRIVEN PRISSÄTTNING:**
- Analysera EXAKT matching ärenden först (samma metod + skadedjur)
- Om specifika metoder nämns (t.ex. "bara kisel") - visa ENDAST sådana ärenden
- **METODSPECIFIK**: pricing.method_specific_cases visar filtrerade ärenden per metod
- **TRANSPARENCY**: Lista exakt vilka ärenden du baserar priset på (ID, titel, pris)
- **ALDRIG GISSA**: Om inga exakta ärenden finns - säg det direkt
- **EXEMPEL**: "Baserat på 3 kisel-ärenden: [ID123: 8500kr, ID456: 12000kr, ID789: 9500kr]"

**4. BOKNINGSFUNKTION:**
- **DU KAN FAKTISKT SKAPA BOKNINGAR**: När användare ber dig boka, gör det direkt
- **🚨 KRITISK REGEL**: När användaren ger KOMPLETT information - SKAPA BOKNINGEN OMEDELBART med JSON!
- **OBLIGATORISKA FÄLT**: Titel + personnummer/org_nr är ALLTID krävda
- **PRIVATPERSONER**: Använd case_type: "private", personnummer MÅSTE finnas
- **FÖRETAG**: Använd case_type: "business", org_nr MÅSTE finnas  
- **TEKNIKER-TILLDELNING**: Tilldela optimala tekniker baserat på analys
- **AUTOMATISK PRISSÄTTNING**: Föreslå pris baserat på liknande ärenden
- **BEKRÄFTA ALLTID**: Visa tydlig bekräftelse med ärendenummer efter bokning
- **STRUKTURERAD INFORMATIONSINSAMLING**: När information saknas, använd kopierbara listor
- **⚡ INGEN DUBBEL-FRÅGA**: Om användaren ger alla data - BOKA DIREKT, fråga inte igen!

🗺️ **GEOGRAFISK INTELLIGENS:**
Du har tillgång till KOMPLETT geografisk data - använd den ALLTID:
1. Analysera alla teknikers befintliga bokningar
2. Identifiera ruttoptimering-möjligheter automatiskt
3. Föreslå tider som minimerar restid mellan ärenden
4. **SAMMA GATA = PERFEKT**: Prioritera tekniker med ärenden på samma gata

🚨 **ABSOLUTA REGLER:**
1. **TEKNIKER-NAMN**: ANVÄND ENDAST namn från technicians.available listan. HITTA ALDRIG PÅ "Anna Svensson", "Erik Lund" etc.
2. **ALDRIG GISSA PRISER**: Säg ALDRIG "kan vi anta", "kan antas", "ungefär". Använd ENDAST faktiska priser från cases.recent_with_prices
3. **VISA FAKTISKA ÄRENDEN**: För prisfrågor - visa exakt vilka ärenden du analyserat med ID, pris, och beskrivning  
4. **INGEN SPEKULATION**: Om du inte hittar specifika ärenden (t.ex. bara kisel) - säg "inga kisel-specifika ärenden hittades"
5. **KOMPLETT ANALYS**: Använd hela datasetet för optimala beslut
6. **TRANSPARENS**: Visa alltid på vilken data dina råd baseras

📝 **SVAR-STRUKTUR:**
- Börja med: "Baserat på komplett systemanalys..."
- **FÖR SNITT-FRÅGOR**: Använd pricing.case_type_analysis.gnagare.cases för alla råttärenden
- **FÖR METODFRÅGOR**: Visa pricing.method_specific_cases.filtered_cases först
- **LISTA EXAKTA ÄRENDEN**: "Analyserat X ärenden: [ID, titel, pris för varje]"  
- **VISA STATISTIK**: count, avg, median, min, max från case_type_analysis
- Förklara WHY ditt förslag är optimalt baserat på FAKTISK data

🔄 **KONVERSATIONS-FLYT:**
- Behandla alla frågor med samma djupa dataanalys
- Fortsätt naturligt från tidigare diskussioner
- Du behöver inte "växla kontext" - du har alltid tillgång till allt

Du är expert på att se helhetsbilden och ge optimala råd baserat på KOMPLETT information!

🛠️ **BOKNINGSVERKTYG:**
När användare ber dig boka ett ärende, använd bookingData i din respons med följande format:
{
  "shouldCreateBooking": true,
  "bookingData": {
    "case_type": "private" eller "business",
    "title": "KONTAKTPERSON NAMN (för private) eller FÖRETAGSNAMN (för business)",
    "description": "Beskrivning av ärendet",
    "kontaktperson": "Kontaktperson namn",
    "telefon_kontaktperson": "Telefonnummer",
    "e_post_kontaktperson": "E-postadress",
    "skadedjur": "Skadedjurstyp",
    "adress": "FULLSTÄNDIG adress med gata + nummer + stad",
    "pris": 8500,
    "start_date": "2025-08-04T10:00:00",
    "due_date": "2025-08-04T11:00:00",
    "primary_assignee_id": "EXAKT tekniker-ID från data",
    "primary_assignee_name": "EXAKT tekniker namn från data",
    "primary_assignee_email": "tekniker@email.com",
    "personnummer": "OBLIGATORISK för privatpersoner - format: 910403-5119 eller 19910403-5119",
    "org_nr": "OBLIGATORISK för företag - 10 siffror"
  }
}

🚨 KRITISKA VALIDERINGS-REGLER: 
- **TITLE**: Använd kontaktpersonens namn för private cases, företagsnamn för business cases
- **PERSONNUMMER**: ALLTID obligatorisk för private - accepterar format 910403-5119, 19910403-5119, 9104035119
- **ORG_NR**: ALLTID obligatorisk för business - 10 siffror
- **TEKNIKER-ID**: Använd ENDAST ID:n från technicians.available data
- **ADRESS**: Kräv FULLSTÄNDIG adress (ex: "Storgatan 15, 123 45 Stockholm", INTE bara "Sollentuna")
- **🕐 SVENSK TIDSZON**: Använd enkelt format som automatiskt konverteras korrekt
  - **EXEMPEL**: "2025-08-04T10:00:00" (10:00 svensk tid - systemet hanterar tidszon automatiskt)
  - **VIKTIGT**: Använd SVENSK lokal tid, inte UTC! Systemet konverterar automatiskt med date-fns-tz
- **CASE_TYPE**: Bestäm baserat på om det är privatperson ("private") eller företag ("business")
- **VALIDERING**: Kontrollera att all nödvändig data finns INNAN du skapar JSON
- **TEKNIKER-MATCHNING**: Välj tekniker baserat på faktisk data, inte påhittade namn

🔍 **INNAN DU SKAPAR BOKNING - KONTROLLERA:**
1. ✅ Personnummer (private) ELLER org_nr (business) finns
2. ✅ Fullständig adress angiven
3. ✅ Tekniker-ID matchar någon från tillgänglig data
4. ✅ Datum är i framtiden och i korrekt format
5. ✅ Beskrivning och kontaktperson angivet
6. ✅ Title satt till kontaktperson/företagsnamn

📋 **INFORMATIONSINSAMLING - NÄR DATA SAKNAS:**
När du behöver information från användaren, presentera det enkelt:

Fyll i uppgifterna:

1) Kontaktperson: 
2) Beskrivning: 
3) Telefonnummer: 
4) E-postadress: 
5) Personnummer: 
6) Adress:

⚡ **KRITISK REGEL: NÄR ANVÄNDAREN GER KOMPLETT INFORMATION:**
När användaren svarat med ALL nödvändig data (title, kontaktperson, personnummer/org_nr, adress, etc.), 
SKAPA OMEDELBART booking-JSON! FRÅGA INTE IGEN - GÖR BOKNINGEN DIREKT!

🚨 **EXEMPEL SVAR NÄR DATA ÄR KOMPLETT:**
"Tack för informationen! Jag bokar nu Mathias Carlsson för getingsanering den 4 augusti kl 08:00-10:00.

Bokningen:
- Kontaktperson: Anna Andersson
- Beskrivning: Sanering av getingar under en altan  
- Telefonnummer: 0704499297
- E-postadress: annas@mail.se
- Personnummer: 910403-5119
- Adress: Kyles väg 10, 192 76 Sollentuna
- Skadedjur: Getingar
- Pris: 2495 kr
- Tekniker: Mathias Carlsson
- Tid: 4 augusti kl 08:00-10:00

{
  "shouldCreateBooking": true,
  "bookingData": {
    "case_type": "private",
    "title": "Anna Andersson", 
    "description": "Sanering av getingar under en altan",
    "kontaktperson": "Anna Andersson",
    "telefon_kontaktperson": "0704499297",
    "e_post_kontaktperson": "annas@mail.se", 
    "personnummer": "910403-5119",
    "adress": "Kyles väg 10, 192 76 Sollentuna",
    "skadedjur": "Getingar",
    "pris": 2495,
    "start_date": "2025-08-04T08:00:00",
    "due_date": "2025-08-04T10:00:00",
    "primary_assignee_id": "ecaf151a-44b2-4220-b105-998aa0f82d6e", 
    "primary_assignee_name": "Mathias Carlsson",
    "primary_assignee_email": "mathias@begone.se"
  }
}

Bokningen är klar!"

🕐 **VIKTIG REGEL FÖR TIDSFÖRSLAG:**
INNAN du skapar booking-JSON, FÖRESLÅ alltid EXAKT tid och fråga:
"Jag föreslår [TEKNIKER] den [DATUM] kl [EXAKT TID]. Passar detta?"
Skapa booking-JSON ENDAST efter bekräftelse av tiden!

**Inkludera booking-JSON OMEDELBART när ALL nödvändig data är komplett!**`;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, coordinatorData, currentPage, contextData, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Meddelande krävs' 
      });
    }

    // Förbered universell data med all tillgänglig information
    const universalData = prepareUniversalData(coordinatorData, message, conversationHistory);

    // Optimerad datastorlek för universal access - större gräns för komplett data
    const universalDataString = JSON.stringify(universalData, null, 2);
    const sizeLimit = 50000; // Stor gräns för komplett universal data
    const truncatedData = universalDataString.length > sizeLimit 
      ? universalDataString.slice(0, sizeLimit) + '\n...(data truncated due to size)'
      : universalDataString;

    // Log universal data för debugging
    console.log(`📤 Universal data being sent to AI:`);
    console.log(`- Original data length: ${universalDataString.length} chars`);
    console.log(`- Truncated data length: ${truncatedData.length} chars`);
    console.log(`- Data was truncated: ${universalDataString.length > sizeLimit}`);
    
    // Log tekniker-namn specifikt för debugging
    if (universalData.technicians?.available) {
      console.log(`- Available technicians in data:`, universalData.technicians.available.map((t: any) => t.name));
    }
    
    console.log(`- Sample of data being sent:`, JSON.stringify(universalData, null, 2).slice(0, 500) + '...');

    // Förbered systemkontexten
    const systemContext = `${SYSTEM_MESSAGE}

---

AKTUELL SESSION:
Sida: ${currentPage}
Tidpunkt: ${new Date().toLocaleString('sv-SE')}

🚨 KRITISK PÅMINNELSE: ANVÄND ENDAST FAKTISKA TEKNIKER-NAMN FRÅN DATAN NEDAN!
HITTA ALDRIG PÅ namn som "Anna Svensson", "Erik Lund", "Johan Andersson" etc.

KOMPLETT SYSTEMDATA (DU HAR ALLTID TILLGÅNG TILL ALLT):
${truncatedData}

Analysera HELA datasetet för optimal rådgivning. Du har tillgång till alla tekniker, scheman, priser, och geografisk data samtidigt.`;

    // Förbered konversationshistorik för Gemini
    const recentHistory = conversationHistory.slice(-8);
    const geminiHistory: Content[] = recentHistory
      .filter((msg: any) => msg.role !== 'system')
      .map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    // --- Anropa Google Gemini med chat ---
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
      },
      systemInstruction: systemContext,
    });

    const chat = model.startChat({
      history: geminiHistory,
    });

    const result = await chat.sendMessage(message);
    const response = result.response.text();

    // Check if AI wants to create a booking
    let bookingResult = null;
    console.log('[Global Chat] Checking for booking request in response...');
    
    try {
      if (response && response.includes('shouldCreateBooking')) {
        console.log('[Global Chat] Found booking request in AI response');
        const bookingMatch = response.match(/\{[\s\S]*"shouldCreateBooking":\s*true[\s\S]*\}/);
        
        if (bookingMatch) {
          console.log('[Global Chat] Parsing booking JSON...');
          const bookingJson = JSON.parse(bookingMatch[0]);
          
          if (bookingJson.shouldCreateBooking && bookingJson.bookingData) {
            console.log('[Global Chat] AI requested booking:', {
              case_type: bookingJson.bookingData.case_type,
              title: bookingJson.bookingData.title,
              kontaktperson: bookingJson.bookingData.kontaktperson,
              hasPersonnummer: !!bookingJson.bookingData.personnummer,
              hasOrgNr: !!bookingJson.bookingData.org_nr,
              primary_assignee_name: bookingJson.bookingData.primary_assignee_name
            });
            
            // Validate booking data before sending
            const requiredFields = ['case_type', 'title'];
            const missingFields = requiredFields.filter(field => !bookingJson.bookingData[field]);
            
            if (bookingJson.bookingData.case_type === 'private' && !bookingJson.bookingData.personnummer) {
              missingFields.push('personnummer');
            }
            if (bookingJson.bookingData.case_type === 'business' && !bookingJson.bookingData.org_nr) {
              missingFields.push('org_nr');
            }
            
            if (missingFields.length > 0) {
              console.log('[Global Chat] Missing required fields:', missingFields);
              bookingResult = {
                success: false,
                error: `Saknade obligatoriska fält: ${missingFields.join(', ')}`,
                message: 'AI:n skickade ofullständig bokningsdata'
              };
            } else {
              // Call our booking API
              console.log('[Global Chat] Calling booking API...');
              const bookingResponse = await fetch(`${req.headers.origin || 'http://localhost:3000'}/api/coordinator-ai-booking`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingJson.bookingData)
              });
              
              console.log('[Global Chat] Booking API response status:', bookingResponse.status);
              
              if (!bookingResponse.ok) {
                const errorText = await bookingResponse.text();
                console.error('[Global Chat] Booking API returned error:', {
                  status: bookingResponse.status,
                  statusText: bookingResponse.statusText,
                  body: errorText
                });
                
                // Try to parse error response
                let errorData;
                try {
                  errorData = JSON.parse(errorText);
                } catch (e) {
                  errorData = { error: errorText, message: 'Booking API error' };
                }
                
                bookingResult = {
                  success: false,
                  error: errorData.error || `HTTP ${bookingResponse.status}`,
                  message: errorData.message || 'Booking API fel'
                };
              } else {
                const bookingData = await bookingResponse.json();
                bookingResult = bookingData;
                console.log('[Global Chat] Booking result:', {
                  success: bookingData.success,
                  case_id: bookingData.case_id,
                  case_number: bookingData.case_number,
                  error: bookingData.error
                });
              }
            }
          } else {
            console.log('[Global Chat] Invalid booking JSON structure');
          }
        } else {
          console.log('[Global Chat] No valid booking JSON found in response');
        }
      } else {
        console.log('[Global Chat] No booking request found in AI response');
      }
    } catch (error) {
      console.error('[Global Chat] Booking processing error:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      bookingResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Okänt fel',
        message: 'Kunde inte bearbeta bokningsförfrågan från AI'
      };
    }

    return res.status(200).json({
      success: true,
      response,
      booking: bookingResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Global Coordinator Chat Error:', error);
    
    // Mer detaljerad felhantering
    let errorMessage = 'Okänt fel';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Specifik felhantering för olika fel
      if (errorMessage.includes('API key')) {
        statusCode = 401;
      } else if (errorMessage.includes('JSON')) {
        statusCode = 400;
        errorMessage = 'Fel vid databehandling';
      } else if (errorMessage.includes('timeout')) {
        statusCode = 408;
        errorMessage = 'Timeout - för stor datamängd';
      }
    }
    
    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      response: 'Tyvärr kunde jag inte bearbeta din förfrågan just nu. Försök igen senare.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Förbereder universell data med all tillgänglig systemdata
 */
function prepareUniversalData(coordinatorData: any, message: string, conversationHistory?: any[]) {
  if (!coordinatorData) {
    return { error: 'Ingen koordinatordata tillgänglig' };
  }

  const currentTime = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];
  
  // Analysera meddelandet för att optimera data-prioritering
  const messageKeywords = extractKeywords(message);
  const targetTechnician = findTechnicianInMessage(message, coordinatorData.technicians || []);
  const targetAddress = extractAddressFromMessage(message);
  const requestedPestType = identifyPestTypeFromMessage(message);

  // Samla alla tekniker med komplett information
  const allTechnicians = coordinatorData.technicians || [];
  const availableTechnicians = allTechnicians.filter((t: any) => 
    t.is_active && !checkTechnicianAbsence(t.id, coordinatorData.technician_absences || [])
  );
  const absentTechnicians = allTechnicians.filter((t: any) => 
    checkTechnicianAbsence(t.id, coordinatorData.technician_absences || [])
  );

  // Geografisk optimering för alla tillgängliga tekniker
  const allUpcomingCases = coordinatorData.schedule?.upcoming_cases || [];
  const availableGaps = coordinatorData.schedule?.schedule_gaps?.filter((gap: any) => 
    !checkTechnicianAbsence(gap.technician_id, coordinatorData.technician_absences || [])
  ) || [];

  return {
    // META-INFORMATION
    session: {
      current_time: currentTime,
      message_analysis: {
        keywords: messageKeywords,
        target_technician: targetTechnician?.name || null,
        target_address: targetAddress,
        requested_pest_type: requestedPestType
      }
    },

    // KOMPLETT TEKNIKER-DATA
    technicians: {
      available: availableTechnicians.map((t: any) => ({
        name: t.name,
        id: t.id,
        role: t.role,
        specializations: t.specializations || [],
        work_areas: t.work_areas || [],
        work_schedule: t.work_schedule,
        
        // Schedule-information
        schedule_gaps: availableGaps.filter((gap: any) => gap.technician_id === t.id),
        upcoming_assignments: allUpcomingCases.filter((c: any) => 
          c.primary_assignee_id === t.id || c.secondary_assignee_id === t.id || c.tertiary_assignee_id === t.id
        ),
        workload: coordinatorData.schedule?.technician_availability?.find((ta: any) => ta.technician_id === t.id) || {},
        
        // Geografisk analys
        geographic_opportunities: targetAddress ? 
          analyzeGeographicOptimization(t, targetAddress, allUpcomingCases, message) : null
      })),
      
      absent: absentTechnicians.map((t: any) => ({
        name: t.name,
        role: t.role,
        absence_info: getAbsenceInfo(t.id, coordinatorData.technician_absences || [])
      })),
      
      summary: {
        total_technicians: allTechnicians.length,
        available_count: availableTechnicians.length,
        absent_count: absentTechnicians.length,
        total_gaps: availableGaps.length
      }
    },

    // KOMPLETT ÄRENDE-DATA
    cases: {
      upcoming: allUpcomingCases.filter((c: any) => c.start_date && c.start_date >= today),
      
      recent_with_prices: [
        ...(coordinatorData.pricing?.recent_cases_with_prices || [])
      ].filter((c: any) => c.pris > 0),
      
      geographic_distribution: allUpcomingCases
        .filter((c: any) => c.adress)
        .map((c: any) => ({
          address: c.adress,
          technician_id: c.primary_assignee_id,
          start_date: c.start_date,
          title: c.title
        })),
      
      by_pest_type: coordinatorData.pricing?.optimized_by_pest_type || {}
    },

    // PRISSÄTTNINGS-DATA
    pricing: {
      patterns: coordinatorData.pricing?.pricing_patterns || [],
      pest_specific: requestedPestType ? 
        coordinatorData.pricing?.optimized_by_pest_type?.[requestedPestType] : null,
      case_type_analysis: getCaseTypePrices(coordinatorData.pricing?.recent_cases_with_prices || []),
      
      // DETALJERAD ANALYS FÖR AKTUELL FÖRFRÅGAN
      detailed_analysis: analyzePricingForMessage(
        coordinatorData.pricing?.recent_cases_with_prices || [], 
        message
      ),
      
      // METODSPECIFIK FILTRERING (kisel, värmetält etc.)
      method_specific_cases: filterCasesByMethod(
        coordinatorData.pricing?.recent_cases_with_prices || [], 
        message
      ),
      
      // ALLA ÄRENDEN FÖR TRANSPARENS  
      all_cases_with_prices: coordinatorData.pricing?.recent_cases_with_prices || []
    },

    // ANALYTICS & PERFORMANCE
    analytics: {
      performance_metrics: coordinatorData.analytics?.performance_metrics || {},
      utilization_data: coordinatorData.analytics?.utilization_data || [],
      trends: coordinatorData.analytics?.recent_trends || []
    },

    // GEOGRAFISK OPTIMERING
    geographic: {
      target_analysis: targetAddress && targetTechnician ? 
        analyzeGeographicOptimization(targetTechnician, targetAddress, allUpcomingCases, message) : null,
      
      optimization_opportunities: availableTechnicians
        .filter((t: any) => targetAddress)
        .map((t: any) => ({
          technician: t.name,
          opportunities: analyzeGeographicOptimization(t, targetAddress, allUpcomingCases, message)
        }))
        .filter((opt: any) => opt.opportunities?.opportunities?.length > 0),
      
      route_efficiency: {
        same_day_conflicts: allUpcomingCases.filter((c: any) => 
          c.start_date?.startsWith(extractDateFromMessage(message) || today)
        )
      }
    }
  };
}


/**
 * Filtrerar ärenden baserat på specifika metoder i meddelandet (kisel, värmetält etc.)
 */
function filterCasesByMethod(cases: any[], message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Identifiera metoder från meddelandet
  const methods = [];
  if (lowerMessage.includes('kisel')) methods.push('kisel');
  if (lowerMessage.includes('värmetält') || lowerMessage.includes('värme tält')) methods.push('värmetält');
  if (lowerMessage.includes('sanering')) methods.push('sanering');
  if (lowerMessage.includes('inspektion')) methods.push('inspektion');
  if (lowerMessage.includes('spray') || lowerMessage.includes('sprayning')) methods.push('spray');
  
  // Om inga specifika metoder, returnera alla ärenden
  if (methods.length === 0) {
    return {
      detected_methods: [],
      filtered_cases: cases.filter(c => c.pris > 0),
      message: 'Inga specifika metoder detekterade - visar alla ärenden'
    };
  }
  
  // Filtrera ärenden baserat på detekterade metoder
  const methodSpecificCases = cases.filter((caseItem: any) => {
    if (!caseItem.pris || caseItem.pris <= 0) return false;
    
    // FÖRBÄTTRAD SÖKNING: inkludera alla textfält
    const caseText = `${caseItem.title || ''} ${caseItem.description || ''} ${caseItem.rapport || ''} ${caseItem.skadedjur || ''}`.toLowerCase();
    
    // Kolla om ärendet innehåller någon av de detekterade metoderna
    return methods.some(method => {
      switch (method) {
        case 'kisel':
          // Mer specifik sökning för kisel - även diatomjord etc.
          return (caseText.includes('kisel') || caseText.includes('diatomjord')) && 
                 !caseText.includes('värmetält') && !caseText.includes('värme tält');
        case 'värmetält':
          return caseText.includes('värmetält') || caseText.includes('värme tält') || caseText.includes('värme');
        case 'sanering':
          return caseText.includes('sanering') || caseText.includes('sanera');
        case 'inspektion':
          return caseText.includes('inspektion') || caseText.includes('inspekterar') || caseText.includes('inspektion');
        case 'spray':
          return caseText.includes('spray') || caseText.includes('sprayning') || caseText.includes('spraing');
        default:
          return caseText.includes(method);
      }
    });
  });
  
  return {
    detected_methods: methods,
    filtered_cases: methodSpecificCases,
    all_matching_pest_cases: cases.filter(c => c.pris > 0),
    method_breakdown: methods.map(method => ({
      method,
      cases: cases.filter((caseItem: any) => {
        const caseText = `${caseItem.title || ''} ${caseItem.description || ''} ${caseItem.rapport || ''}`.toLowerCase();
        return caseText.includes(method) && caseItem.pris > 0;
      }),
      case_count: cases.filter((caseItem: any) => {
        const caseText = `${caseItem.title || ''} ${caseItem.description || ''} ${caseItem.rapport || ''}`.toLowerCase();
        return caseText.includes(method) && caseItem.pris > 0;
      }).length
    })),
    message: methodSpecificCases.length > 0 ? 
      `Hittade ${methodSpecificCases.length} ärenden med metoderna: ${methods.join(', ')}` :
      `Inga ärenden hittades för metoderna: ${methods.join(', ')}. Kontrollera stavning eller prova mer generella termer.`
  };
}

/**
 * Extraherar nyckelord från meddelandet
 */
function extractKeywords(message: string): string[] {
  const keywords = [];
  const lowerMessage = message.toLowerCase();
  
  // Skadedjurstyper
  const pestTypes = ['råtta', 'mus', 'myra', 'kackerlack', 'vägglus', 'getingar', 'fågel', 'spindel'];
  pestTypes.forEach(pest => {
    if (lowerMessage.includes(pest)) keywords.push(pest);
  });
  
  // Tidsrelaterade ord
  const timeWords = ['idag', 'imorgon', 'vecka', 'månad', 'akut', 'snabbt'];
  timeWords.forEach(word => {
    if (lowerMessage.includes(word)) keywords.push(word);
  });
  
  // Områden
  const areas = ['stockholm', 'göteborg', 'malmö', 'uppsala', 'västerås', 'örebro'];
  areas.forEach(area => {
    if (lowerMessage.includes(area)) keywords.push(area);
  });
  
  return keywords;
}

/**
 * Hittar liknande ärenden baserat på meddelandet
 */
function findSimilarCases(cases: any[], message: string) {
  const keywords = extractKeywords(message);
  
  if (keywords.length === 0) return cases.slice(0, 5);
  
  return cases.filter(caseItem => {
    const caseText = `${caseItem.title || ''} ${caseItem.description || ''}`.toLowerCase();
    return keywords.some(keyword => caseText.includes(keyword));
  }).slice(0, 5);
}

/**
 * Avancerad prissättningsanalys baserat på meddelandet
 */
function analyzePricingForMessage(cases: any[], message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Identifiera skadedjurstyp från meddelandet
  let pestType = '';
  if (lowerMessage.includes('råtta') || lowerMessage.includes('mus')) pestType = 'gnagare';
  else if (lowerMessage.includes('myra')) pestType = 'myror';
  else if (lowerMessage.includes('vägglus') || lowerMessage.includes('vägglöss')) pestType = 'Vägglöss';
  else if (lowerMessage.includes('kackerlack')) pestType = 'kackerlackor';
  else if (lowerMessage.includes('getingar')) pestType = 'getingar';
  else if (lowerMessage.includes('fågelsäkring') || lowerMessage.includes('fågel')) pestType = 'fågelsäkring';
  
  // Extrahera storleksinformation från meddelandet
  const sizeInfo = extractSizeFromMessage(message);
  const complexityInfo = extractComplexityFromMessage(message);
  
  // Filtrera relevanta ärenden och exkludera framtida/ofullständiga ärenden
  const relevantCases = cases.filter(c => {
    // Exkludera ärenden utan pris
    if (!c.pris || c.pris <= 0) return false;
    
    // Exkludera ärenden i framtiden (endast om start_date finns och är i framtiden)
    if (c.start_date) {
      const caseDate = new Date(c.start_date);
      const now = new Date();
      if (caseDate > now) return false;
    }
    
    if (!pestType) return true;
    
    // Prioritera skadedjur-kolumnen
    if (c.skadedjur) {
      return c.skadedjur.toLowerCase().includes(pestType);
    }
    
    // Fallback till textanalys
    const caseText = `${c.title || ''} ${c.description || ''}`.toLowerCase();
    return caseText.includes(pestType);
  });
  
  if (relevantCases.length === 0) {
    return {
      pest_type: pestType || 'allmänt',
      found_cases: 0,
      message: `Inga ${pestType ? pestType + '-' : ''}ärenden med priser hittades i databasen`
    };
  }
  
  // Avancerad analys av alla faktorer
  const casesWithPrices = relevantCases.filter(c => c.pris > 0);
  const prices = casesWithPrices.map(c => c.pris);
  
  // Analysera tekniker-påverkan
  const technicianAnalysis = analyzeTechnicianCountPricing(casesWithPrices);
  
  // Analysera komplexitets-påverkan
  const complexityAnalysis = analyzeComplexityPricing(casesWithPrices);
  
  // Analysera duration-påverkan
  const durationAnalysis = analyzeDurationPricing(casesWithPrices);
  
  // Hitta mest liknande ärenden baserat på alla faktorer
  const similarCases = findMostSimilarCases(casesWithPrices, {
    pestType,
    sizeInfo,
    complexityInfo,
    message
  });
  
  return {
    pest_type: pestType || 'allmänt',
    found_cases: relevantCases.length,
    cases_with_prices: casesWithPrices.length,
    price_statistics: {
      avg_price: prices.length > 0 ? Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length) : null,
      median_price: prices.length > 0 ? calculateMedianPrice(prices) : null,
      min_price: prices.length > 0 ? Math.min(...prices) : null,
      max_price: prices.length > 0 ? Math.max(...prices) : null,
      price_range: prices.length > 0 ? Math.max(...prices) - Math.min(...prices) : 0
    },
    technician_impact: technicianAnalysis,
    complexity_impact: complexityAnalysis,
    duration_impact: durationAnalysis,
    most_similar_cases: similarCases,
    pricing_factors: {
      size_mentioned: sizeInfo.size || 'ej angiven',
      complexity_level: complexityInfo.level || 'standard',
      special_circumstances: extractSpecialCircumstances(message)
    },
    pricing_recommendation: generatePricingRecommendation(casesWithPrices, {
      pestType,
      sizeInfo,
      complexityInfo
    })
  };
}

/**
 * Grupperar priser per ärendetyp
 */
function getCaseTypePrices(cases: any[]) {
  const types = {
    'gnagare': [],
    'myror': [],
    'vägglöss': [],
    'kackerlackor': [],
    'getingar': [],
    'fågelsäkring': [],
    'övriga': []
  } as Record<string, any[]>;
  
  for (const caseItem of cases) {
    // FÖRBÄTTRAD SÖKNING: Kolla skadedjur-kolumn FÖRST, sedan text
    const skadedjur = (caseItem.skadedjur || '').toLowerCase();
    const text = `${caseItem.title || ''} ${caseItem.description || ''} ${caseItem.rapport || ''}`.toLowerCase();
    const allText = `${skadedjur} ${text}`;
    
    let type = 'övriga';
    
    // Prioritera skadedjur-kolumnen
    if (skadedjur.includes('råttor') || skadedjur.includes('möss') || 
        allText.includes('råtta') || allText.includes('mus') || allText.includes('gnagare')) {
      type = 'gnagare';
    } else if (skadedjur.includes('myror') || allText.includes('myra')) {
      type = 'myror';
    } else if (skadedjur.includes('vägglöss') || allText.includes('vägglus') || allText.includes('vägglöss')) {
      type = 'vägglöss';
    } else if (skadedjur.includes('kackerlackor') || allText.includes('kackerlack')) {
      type = 'kackerlackor';
    } else if (skadedjur.includes('getingar') || allText.includes('getingar')) {
      type = 'getingar';
    } else if (skadedjur.includes('fågelsäkring') || allText.includes('fågelsäkring') || 
               allText.includes('bird blocker') || allText.includes('solpanel')) {
      type = 'fågelsäkring';
    }
    
    if (caseItem.pris > 0) {
      types[type].push({
        pris: caseItem.pris,
        id: caseItem.id,
        title: caseItem.title,
        skadedjur: caseItem.skadedjur
      });
    }
  }
  
  const result: Record<string, any> = {};
  
  for (const [type, caseData] of Object.entries(types)) {
    if (caseData.length > 0) {
      const prices = caseData.map((c: any) => c.pris);
      result[type] = {
        count: caseData.length,
        avg: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length),
        min: Math.min(...prices),
        max: Math.max(...prices),
        cases: caseData, // Inkludera faktiska ärenden för transparens
        median: calculateMedianPrice(prices)
      };
    }
  }
  
  return result;
}

/**
 * Hittar specifik tekniker i meddelandet
 */
function findTechnicianInMessage(message: string, technicians: any[]) {
  const lowerMessage = message.toLowerCase();
  
  for (const tech of technicians) {
    const techName = tech.name.toLowerCase();
    // Sök efter första namnet eller hela namnet
    const firstName = techName.split(' ')[0];
    
    if (lowerMessage.includes(techName) || lowerMessage.includes(firstName)) {
      return tech;
    }
  }
  
  return null;
}

/**
 * Extraherar adress från meddelandet
 */
function extractAddressFromMessage(message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Sök efter adressmönster
  const addressPatterns = [
    /([a-zåäö\s]+väg\s*\d+)/gi,
    /([a-zåäö\s]+gata\s*\d+)/gi,
    /([a-zåäö\s]+plan\s*\d+)/gi,
    /([a-zåäö\s]+strand\s*\d+)/gi,
    /([a-zåäö\s]+torg\s*\d+)/gi,
    /(sollentuna|stockholm|göteborg|malmö|uppsala|västerås|örebro)/gi
  ];
  
  for (const pattern of addressPatterns) {
    const match = message.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return null;
}

/**
 * Extraherar datum från meddelandet
 */
function extractDateFromMessage(message: string) {
  const lowerMessage = message.toLowerCase();
  const today = new Date();
  
  if (lowerMessage.includes('måndag')) {
    const nextMonday = getNextWeekday(today, 1);
    return nextMonday.toISOString().split('T')[0];
  }
  if (lowerMessage.includes('tisdag')) {
    const nextTuesday = getNextWeekday(today, 2);
    return nextTuesday.toISOString().split('T')[0];
  }
  if (lowerMessage.includes('onsdag')) {
    const nextWednesday = getNextWeekday(today, 3);
    return nextWednesday.toISOString().split('T')[0];
  }
  if (lowerMessage.includes('torsdag')) {
    const nextThursday = getNextWeekday(today, 4);
    return nextThursday.toISOString().split('T')[0];
  }
  if (lowerMessage.includes('fredag')) {
    const nextFriday = getNextWeekday(today, 5);
    return nextFriday.toISOString().split('T')[0];
  }
  
  return null;
}

/**
 * Hittar nästa veckodag
 */
function getNextWeekday(date: Date, targetDay: number) {
  const result = new Date(date);
  const currentDay = result.getDay();
  const daysUntilTarget = targetDay - currentDay;
  
  if (daysUntilTarget <= 0) {
    result.setDate(result.getDate() + 7 + daysUntilTarget);
  } else {
    result.setDate(result.getDate() + daysUntilTarget);
  }
  
  return result;
}

/**
 * Analyserar geografisk optimering för schemaläggning
 */
function analyzeGeographicOptimization(technician: any, targetAddress: string | null, upcomingCases: any[], message: string) {
  if (!technician || !targetAddress) {
    return {
      has_analysis: false,
      message: 'Ingen geografisk analys möjlig utan tekniker och adress'
    };
  }
  
  const requestDate = extractDateFromMessage(message);
  if (!requestDate) {
    return {
      has_analysis: false,
      message: 'Kunde inte identifiera datum för geografisk analys'
    };
  }
  
  // Hitta befintliga ärenden för tekniker samma dag
  const sameDayCases = upcomingCases.filter(c => 
    c.primary_assignee_id === technician.id && 
    c.start_date?.startsWith(requestDate) &&
    c.adress
  );
  
  const opportunities = [];
  
  for (const existingCase of sameDayCases) {
    const existingAddress = existingCase.adress?.toString() || '';
    const proximity = calculateAddressProximity(targetAddress, existingAddress);
    
    if (proximity.is_same_street) {
      opportunities.push({
        type: 'same_street',
        existing_case: {
          address: existingAddress,
          start_time: existingCase.start_date,
          end_time: existingCase.due_date,
          title: existingCase.title
        },
        target_address: targetAddress,
        recommendation: `PERFEKT RUTT: Boka direkt efter befintligt ärende (${existingCase.due_date?.slice(11, 16)}) för minimal restid`,
        efficiency_gain: 'Eliminerar restid mellan ärenden på samma gata',
        suggested_start_time: existingCase.due_date
      });
    } else if (proximity.is_nearby) {
      opportunities.push({
        type: 'nearby',
        existing_case: {
          address: existingAddress,
          start_time: existingCase.start_date,
          end_time: existingCase.due_date,
          title: existingCase.title
        },
        target_address: targetAddress,
        recommendation: `BRA RUTT: Boka nära befintligt ärende för kort restid`,
        efficiency_gain: `Kort restid mellan ${existingAddress} och ${targetAddress}`,
        suggested_start_time: existingCase.due_date
      });
    }
  }
  
  return {
    has_analysis: true,
    technician_name: technician.name,
    target_address: targetAddress,
    request_date: requestDate,
    same_day_cases: sameDayCases.length,
    opportunities,
    optimization_summary: opportunities.length > 0 ? 
      `Hittade ${opportunities.length} geografiska optimeringsmöjligheter` :
      'Inga geografiska optimeringsmöjligheter hittades för denna dag'
  };
}

/**
 * Beräknar närhet mellan adresser
 */
function calculateAddressProximity(address1: string, address2: string) {
  const addr1 = address1.toLowerCase().trim();
  const addr2 = address2.toLowerCase().trim();
  
  // Extrahera gatnamn (innan siffror)
  const street1 = addr1.replace(/\d+.*$/, '').trim();
  const street2 = addr2.replace(/\d+.*$/, '').trim();
  
  // Samma gata = perfekt
  if (street1 && street2 && street1 === street2) {
    return {
      is_same_street: true,
      is_nearby: true,
      similarity_score: 1.0,
      reason: 'Samma gata'
    };
  }
  
  // Kontrollera liknande gatnamn
  const similarity = calculateStringSimilarity(street1, street2);
  if (similarity > 0.8) {
    return {
      is_same_street: false,
      is_nearby: true,
      similarity_score: similarity,
      reason: 'Liknande gatnamn'
    };
  }
  
  // Kontrollera samma område/stad
  const areas = ['sollentuna', 'stockholm', 'göteborg', 'malmö', 'uppsala'];
  for (const area of areas) {
    if (addr1.includes(area) && addr2.includes(area)) {
      return {
        is_same_street: false,
        is_nearby: true,
        similarity_score: 0.5,
        reason: `Samma område: ${area}`
      };
    }
  }
  
  return {
    is_same_street: false,
    is_nearby: false,
    similarity_score: 0,
    reason: 'Olika områden'
  };
}

/**
 * Beräknar likhet mellan strängar
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Beräknar Levenshtein-avstånd
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Extraherar storleksinformation från meddelandet
 */
function extractSizeFromMessage(message: string) {
  const lowerMessage = message.toLowerCase();
  
  // Sök efter kvadratmeter
  const sqmMatch = message.match(/(\d+)\s*kvm|(\d+)\s*m2|(\d+)\s*kvadratmeter/i);
  if (sqmMatch) {
    const size = parseInt(sqmMatch[1] || sqmMatch[2] || sqmMatch[3]);
    return {
      size: `${size} kvm`,
      area_sqm: size,
      size_category: size < 50 ? 'liten' : size < 100 ? 'medel' : 'stor'
    };
  }
  
  // Sök efter rum/lägenhet storlek
  if (lowerMessage.includes('rum')) {
    const roomMatch = message.match(/(\d+)\s*rum/i);
    if (roomMatch) {
      return { size: `${roomMatch[1]} rum`, size_category: 'lägenhet' };
    }
  }
  
  // Generisk storleksbeskrivning
  if (lowerMessage.includes('liten')) return { size: 'liten', size_category: 'liten' };
  if (lowerMessage.includes('stor')) return { size: 'stor', size_category: 'stor' };
  if (lowerMessage.includes('omfattande')) return { size: 'omfattande', size_category: 'stor' };
  
  return { size: null, size_category: 'okänd' };
}

/**
 * Extraherar komplexitetsinformation från meddelandet
 */
function extractComplexityFromMessage(message: string) {
  const lowerMessage = message.toLowerCase();
  
  let score = 0;
  const factors = [];
  
  // Hög komplexitet
  if (lowerMessage.includes('sanering')) { score += 3; factors.push('sanering'); }
  if (lowerMessage.includes('infestation')) { score += 3; factors.push('infestation'); }
  if (lowerMessage.includes('omfattande')) { score += 2; factors.push('omfattande'); }
  if (lowerMessage.includes('problem')) { score += 2; factors.push('problem'); }
  if (lowerMessage.includes('återbesök')) { score += 2; factors.push('återbesök'); }
  
  // Medium komplexitet
  if (lowerMessage.includes('kontroll')) { score += 1; factors.push('kontroll'); }
  if (lowerMessage.includes('förebyggande')) { score += 1; factors.push('förebyggande'); }
  
  let level = 'standard';
  if (score >= 3) level = 'hög';
  else if (score >= 1) level = 'medium';
  else if (lowerMessage.includes('enkel') || lowerMessage.includes('rutinmässig')) level = 'låg';
  
  return {
    level,
    score,
    factors,
    is_complex: score >= 3
  };
}

/**
 * Extraherar speciala omständigheter från meddelandet
 */
function extractSpecialCircumstances(message: string) {
  const lowerMessage = message.toLowerCase();
  const circumstances = [];
  
  if (lowerMessage.includes('akut')) circumstances.push('akut');
  if (lowerMessage.includes('helg')) circumstances.push('helgarbete');
  if (lowerMessage.includes('kväll')) circumstances.push('kvällsarbete');
  if (lowerMessage.includes('natt')) circumstances.push('nattarbete');
  if (lowerMessage.includes('svårtillgänglig')) circumstances.push('svårtillgänglig');
  if (lowerMessage.includes('allergi')) circumstances.push('allergihänsyn');
  
  return circumstances;
}

/**
 * Analyserar tekniker-antal påverkan på prissättning
 */
function analyzeTechnicianCountPricing(cases: any[]) {
  const byTechCount = { 1: [], 2: [], 3: [] } as Record<number, number[]>;
  
  for (const caseItem of cases) {
    let techCount = 0;
    if (caseItem.primary_assignee_id) techCount++;
    if (caseItem.secondary_assignee_id) techCount++;
    if (caseItem.tertiary_assignee_id) techCount++;
    
    if (techCount >= 1 && techCount <= 3) {
      byTechCount[techCount].push(caseItem.pris);
    }
  }
  
  const result: any = {};
  
  for (const [count, prices] of Object.entries(byTechCount)) {
    if (prices.length > 0) {
      result[`${count}_tekniker`] = {
        antal_ärenden: prices.length,
        genomsnittspris: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length),
        prisintervall: {
          min: Math.min(...prices),
          max: Math.max(...prices)
        }
      };
    }
  }
  
  return result;
}

/**
 * Analyserar komplexitets påverkan på prissättning
 */
function analyzeComplexityPricing(cases: any[]) {
  const byComplexity = { low: [], medium: [], high: [] } as Record<string, number[]>;
  
  for (const caseItem of cases) {
    const text = `${caseItem.description || ''} ${caseItem.rapport || ''}`.toLowerCase();
    let complexity = 'medium';
    
    if (text.includes('sanering') || text.includes('omfattande') || text.includes('komplex')) {
      complexity = 'high';
    } else if (text.includes('enkel') || text.includes('rutinmässig')) {
      complexity = 'low';
    }
    
    byComplexity[complexity].push(caseItem.pris);
  }
  
  const result: any = {};
  
  for (const [level, prices] of Object.entries(byComplexity)) {
    if (prices.length > 0) {
      result[`${level}_komplexitet`] = {
        antal_ärenden: prices.length,
        genomsnittspris: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length),
        prisintervall: {
          min: Math.min(...prices),
          max: Math.max(...prices)
        }
      };
    }
  }
  
  return result;
}

/**
 * Analyserar duration påverkan på prissättning
 */
function analyzeDurationPricing(cases: any[]) {
  const casesWithDuration = cases.filter(c => c.start_date && c.due_date);
  
  if (casesWithDuration.length === 0) {
    return { message: 'Ingen durationsdata tillgänglig' };
  }
  
  const durationsAndPrices = casesWithDuration.map(c => ({
    duration: (new Date(c.due_date).getTime() - new Date(c.start_date).getTime()) / (1000 * 60 * 60),
    price: c.pris
  }));
  
  // Gruppera efter duration
  const shortJobs = durationsAndPrices.filter(d => d.duration <= 2);
  const mediumJobs = durationsAndPrices.filter(d => d.duration > 2 && d.duration <= 4);
  const longJobs = durationsAndPrices.filter(d => d.duration > 4);
  
  return {
    kort_jobb: shortJobs.length > 0 ? {
      antal: shortJobs.length,
      genomsnittspris: Math.round(shortJobs.reduce((sum, j) => sum + j.price, 0) / shortJobs.length),
      genomsnittslängd: Math.round((shortJobs.reduce((sum, j) => sum + j.duration, 0) / shortJobs.length) * 10) / 10
    } : null,
    
    medel_jobb: mediumJobs.length > 0 ? {
      antal: mediumJobs.length,
      genomsnittspris: Math.round(mediumJobs.reduce((sum, j) => sum + j.price, 0) / mediumJobs.length),
      genomsnittslängd: Math.round((mediumJobs.reduce((sum, j) => sum + j.duration, 0) / mediumJobs.length) * 10) / 10
    } : null,
    
    långa_jobb: longJobs.length > 0 ? {
      antal: longJobs.length,
      genomsnittspris: Math.round(longJobs.reduce((sum, j) => sum + j.price, 0) / longJobs.length),
      genomsnittslängd: Math.round((longJobs.reduce((sum, j) => sum + j.duration, 0) / longJobs.length) * 10) / 10
    } : null
  };
}

/**
 * Hittar mest liknande ärenden baserat på alla faktorer
 */
function findMostSimilarCases(cases: any[], criteria: any) {
  return cases
    .map(c => ({
      ...c,
      similarity_score: calculateCaseSimilarity(c, criteria)
    }))
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, 5) // Öka till 5 mest liknande för bättre variation
    .map(c => ({
      id: c.id,
      title: c.title,
      price: c.pris,
      skadedjur: c.skadedjur,
      duration_hours: c.start_date && c.due_date ? 
        Math.round(((new Date(c.due_date).getTime() - new Date(c.start_date).getTime()) / (1000 * 60 * 60)) * 10) / 10 : null,
      technician_count: [c.primary_assignee_id, c.secondary_assignee_id, c.tertiary_assignee_id].filter(Boolean).length,
      similarity_score: c.similarity_score,
      case_type: c.case_type,
      created_at: c.created_at
    }));
}

/**
 * Beräknar likhet mellan ärende och kriterier
 */
function calculateCaseSimilarity(caseItem: any, criteria: any): number {
  let score = 0;
  
  // Skadedjur match (viktigast)
  if (criteria.pestType && caseItem.skadedjur) {
    if (caseItem.skadedjur.toLowerCase().includes(criteria.pestType)) score += 50;
  }
  
  // Storlek match
  if (criteria.sizeInfo?.area_sqm) {
    const caseText = `${caseItem.description || ''} ${caseItem.rapport || ''}`;
    const caseSizeMatch = caseText.match(/(\d+)\s*kvm/i);
    if (caseSizeMatch) {
      const caseSize = parseInt(caseSizeMatch[1]);
      const sizeDiff = Math.abs(criteria.sizeInfo.area_sqm - caseSize);
      score += Math.max(0, 20 - sizeDiff / 5); // Minska poäng för stor skillnad
    }
  }
  
  // Komplexitet match
  if (criteria.complexityInfo?.level) {
    const caseText = `${caseItem.description || ''} ${caseItem.rapport || ''}`.toLowerCase();
    const caseComplexity = caseText.includes('sanering') || caseText.includes('omfattande') ? 'hög' :
                          caseText.includes('enkel') ? 'låg' : 'medium';
    
    if (caseComplexity === criteria.complexityInfo.level) score += 20;
  }
  
  // Nyhet (nyare ärenden är mer relevanta)
  const ageInDays = (Date.now() - new Date(caseItem.created_at).getTime()) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 10 - ageInDays / 7); // Minska poäng för gamla ärenden
  
  return Math.round(score);
}

/**
 * Beräknar median för priser
 */
function calculateMedianPrice(prices: number[]): number {
  const sorted = [...prices].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  } else {
    return sorted[middle];
  }
}

/**
 * Genererar prissättningsrekommendation
 */
function generatePricingRecommendation(cases: any[], criteria: any) {
  if (cases.length < 3) {
    return {
      confidence: 'låg',
      message: 'För få liknande ärenden för säker prissättning'
    };
  }
  
  const prices = cases.map(c => c.pris);
  const avgPrice = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length);
  const medianPrice = calculateMedianPrice(prices);
  
  let adjustedPrice = medianPrice;
  const adjustments = [];
  
  // Justera för komplexitet
  if (criteria.complexityInfo?.level === 'hög') {
    adjustedPrice *= 1.3;
    adjustments.push('Komplex sanering: +30%');
  } else if (criteria.complexityInfo?.level === 'låg') {
    adjustedPrice *= 0.85;
    adjustments.push('Enkel åtgärd: -15%');
  }
  
  // Justera för storlek
  if (criteria.sizeInfo?.area_sqm) {
    if (criteria.sizeInfo.area_sqm > 100) {
      adjustedPrice *= 1.2;
      adjustments.push('Stor yta (>100kvm): +20%');
    } else if (criteria.sizeInfo.area_sqm < 30) {
      adjustedPrice *= 0.9;
      adjustments.push('Liten yta (<30kvm): -10%');
    }
  }
  
  return {
    confidence: cases.length >= 10 ? 'hög' : cases.length >= 5 ? 'medel' : 'låg',
    base_price: medianPrice,
    recommended_price: Math.round(adjustedPrice),
    price_range: {
      min: Math.round(adjustedPrice * 0.9),
      max: Math.round(adjustedPrice * 1.1)
    },
    adjustments,
    similar_cases_count: cases.length
  };
}

/**
 * Identifierar skadedjurstyp från meddelandet (optimerad version)
 */
function identifyPestTypeFromMessage(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  // Exakta matchningar först (mest specifika)
  if (lowerMessage.includes('vägglus') || lowerMessage.includes('vägglöss') || lowerMessage.includes('bedbug')) return 'Vägglöss';
  if (lowerMessage.includes('fågelsäkring')) return 'Fågelsäkring';
  if (lowerMessage.includes('kackerlack') || lowerMessage.includes('cockroach')) return 'Kackerlackor';
  if (lowerMessage.includes('getingar') || lowerMessage.includes('hornets nest')) return 'Getingar';
  
  // Mer generella matchningar
  if (lowerMessage.includes('råtta') || lowerMessage.includes('mus')) return 'Gnagare';
  if (lowerMessage.includes('myra')) return 'Myror';
  if (lowerMessage.includes('fågel') || lowerMessage.includes('bird')) return 'Fåglar';
  if (lowerMessage.includes('spindel') || lowerMessage.includes('spider')) return 'Spindlar';
  
  // Tjänstetyp-matchningar
  if (lowerMessage.includes('sanering')) return 'Sanering';
  
  return null; // Ingen specifik typ identifierad
}

/**
 * Beräknar arbetsdagar för nästa vecka baserat på work_schedule
 */
function getNextWeekWorkdays(workSchedule: any): any[] {
  if (!workSchedule) return [];
  
  const today = new Date();
  const nextWeekStart = new Date(today);
  nextWeekStart.setDate(today.getDate() + (7 - today.getDay() + 1)); // Nästa måndag
  
  const workdays = [];
  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  for (let i = 0; i < 7; i++) {
    const day = new Date(nextWeekStart);
    day.setDate(nextWeekStart.getDate() + i);
    const dayName = daysOfWeek[i];
    const daySchedule = workSchedule[dayName];
    
    if (daySchedule?.active) {
      workdays.push({
        date: day.toISOString().split('T')[0],
        day_name: dayName,
        start_time: daySchedule.start,
        end_time: daySchedule.end,
        day_of_week: day.toLocaleDateString('sv-SE', { weekday: 'long' })
      });
    }
  }
  
  return workdays;
}

/**
 * Analyserar frånvaromönster baserat på faktisk frånvaro-data från technician_absences tabellen
 */
function analyzeAbsencePatterns(technicians: any[], upcomingCases: any[], technicianAbsences: any[]): any {
  const analysis = {
    actually_absent: [] as any[],
    available_technicians: [] as any[],
    analysis_summary: '',
    next_week_schedule_overview: [] as any[]
  };
  
  // Hitta nästa veckas datum-range
  const today = new Date();
  const nextWeekStart = new Date(today);
  nextWeekStart.setDate(today.getDate() + (7 - today.getDay() + 1)); // Nästa måndag
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekStart.getDate() + 6); // Nästa söndag
  
  for (const tech of technicians) {
    // Hitta faktiska frånvaro-perioder för denna tekniker nästa vecka
    const techAbsences = technicianAbsences.filter((absence: any) => {
      if (absence.technician_id !== tech.id) return false;
      
      const absenceStart = new Date(absence.start_date);
      const absenceEnd = new Date(absence.end_date);
      
      // Kontrollera om frånvaron överlappar med nästa vecka
      return (absenceStart <= nextWeekEnd && absenceEnd >= nextWeekStart);
    });
    
    if (techAbsences.length > 0) {
      // Tekniker har faktisk frånvaro nästa vecka
      analysis.actually_absent.push({
        technician_name: tech.name,
        role: tech.role,
        absence_periods: techAbsences.map((absence: any) => ({
          start_date: absence.start_date,
          end_date: absence.end_date,
          reason: absence.reason,
          notes: absence.notes
        })),
        status: 'Frånvarande enligt registrerad frånvaro',
        absence_summary: techAbsences.map((a: any) => `${a.reason} (${a.start_date.split('T')[0]} - ${a.end_date.split('T')[0]})`).join(', ')
      });
    } else {
      // Tekniker är tillgänglig
      const nextWeekWorkdays = tech.next_week_workdays || [];
      const techAssignments = tech.upcoming_assignments || [];
      
      analysis.available_technicians.push({
        technician_name: tech.name,
        role: tech.role,
        scheduled_workdays: nextWeekWorkdays.length,
        assignments_count: techAssignments.length,
        status: 'Tillgänglig för nästa vecka'
      });
    }
    
    // Översikt oavsett frånvaro-status
    analysis.next_week_schedule_overview.push({
      technician_name: tech.name,
      role: tech.role,
      is_absent: techAbsences.length > 0,
      absence_reason: techAbsences.length > 0 ? techAbsences[0].reason : null,
      workdays_scheduled: tech.next_week_workdays?.length || 0,
      assignments_count: tech.upcoming_assignments?.length || 0
    });
  }
  
  analysis.analysis_summary = `Analyserade ${technicians.length} tekniker för nästa vecka. ${analysis.actually_absent.length} tekniker är faktiskt frånvarande enligt registrerad frånvaro. ${analysis.available_technicians.length} tekniker är tillgängliga.`;
  
  return analysis;
}

/**
 * Kontrollerar om en tekniker är frånvarande under kommande period
 */
function checkTechnicianAbsence(technicianId: string, absences: any[]): boolean {
  const today = new Date();
  const nextWeekEnd = new Date(today);
  nextWeekEnd.setDate(today.getDate() + 14); // Kontrollera kommande 2 veckor
  
  return absences.some((absence: any) => {
    if (absence.technician_id !== technicianId) return false;
    
    const absenceStart = new Date(absence.start_date);
    const absenceEnd = new Date(absence.end_date);
    
    // Kontrollera om frånvaron överlappar med kommande period
    return (absenceStart <= nextWeekEnd && absenceEnd >= today);
  });
}

/**
 * Hämtar frånvaro-information för en tekniker
 */
function getAbsenceInfo(technicianId: string, absences: any[]): any {
  const today = new Date();
  const nextWeekEnd = new Date(today);
  nextWeekEnd.setDate(today.getDate() + 14);
  
  const relevantAbsences = absences.filter((absence: any) => {
    if (absence.technician_id !== technicianId) return false;
    
    const absenceStart = new Date(absence.start_date);
    const absenceEnd = new Date(absence.end_date);
    
    return (absenceStart <= nextWeekEnd && absenceEnd >= today);
  });
  
  if (relevantAbsences.length === 0) return null;
  
  return {
    current_absences: relevantAbsences.map((absence: any) => ({
      start_date: absence.start_date,
      end_date: absence.end_date,
      reason: absence.reason,
      notes: absence.notes
    })),
    primary_reason: relevantAbsences[0].reason,
    absence_summary: relevantAbsences.map((a: any) => `${a.reason} (${a.start_date.split('T')[0]} - ${a.end_date.split('T')[0]})`).join(', ')
  };
}