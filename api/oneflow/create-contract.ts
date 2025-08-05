// api/oneflow/create-contract.ts - KOMPLETT UPPDATERAD VERSION MED DYNAMISK ANVÄNDARE
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

interface ContractRequestBody {
  templateId: string
  contractData: Record<string, string>
  recipient: {
    name: string
    email: string
    company_name?: string
    organization_number?: string
  }
  sendForSigning: boolean
  partyType: 'company' | 'individual'
  documentType: 'offer' | 'contract'
  // 🆕 NYTT: Dynamisk användare från frontend
  senderEmail?: string
  senderName?: string
  // 🆕 NYTT: Produkter
  selectedProducts?: Array<{
    product: {
      id: string
      name: string
      description: string
      pricing: {
        company?: { basePrice: number; vatRate?: number; discountPercent?: number }
        individual?: { basePrice: number; taxDeduction?: string; discountPercent?: number }
      }
      quantityType: string
      oneflowCompatible: boolean
    }
    quantity: number
    customPrice?: number
    notes?: string
  }>
}

// 🆕 FÄLTMAPPNING FÖR OLIKA DOKUMENTTYPER
const FIELD_MAPPING = {
  // Avtal → Offert mappning
  contract_to_offer: {
    'anstalld': 'vr-kontaktperson',
    'e-post-anstlld': 'vr-kontakt-mail',
    'Kontaktperson': 'kontaktperson',
    'e-post-kontaktperson': 'kontaktperson-e-post',
    'telefonnummer-kontaktperson': 'tel-nr',
    'utforande-adress': 'utfrande-adress',
    'org-nr': 'per--org-nr',
    'foretag': 'kund',
    'begynnelsedag': 'utfrande-datum',
    'dokument-skapat': 'offert-skapad',
    'stycke-1': 'arbetsbeskrivning',
    'stycke-2': '' // Inte använd i offerter
  }
}

// 🆕 BYGG DATAFÄLT BASERAT PÅ DOKUMENTTYP
function buildDataFieldsForDocument(
  contractData: Record<string, string>, 
  documentType: 'offer' | 'contract'
): Array<{ custom_id: string; value: string }> {
  if (documentType === 'contract') {
    // För avtal, använd befintlig struktur
    return Object.entries(contractData).map(([custom_id, value]) => ({ custom_id, value }))
  }
  
  // För offerter, mappa fält till offertspecifika namn
  const mappedFields: Array<{ custom_id: string; value: string }> = []
  const mapping = FIELD_MAPPING.contract_to_offer
  
  Object.entries(contractData).forEach(([contractField, value]) => {
    const offerField = mapping[contractField as keyof typeof mapping]
    
    if (offerField && offerField !== '' && value) {
      mappedFields.push({ custom_id: offerField, value })
    }
  })
  
  // Lägg till offertspecifika fält med standardvärden
  const currentDate = new Date().toISOString().split('T')[0]
  mappedFields.push(
    { custom_id: 'offert-skapad', value: currentDate },
    { custom_id: 'epost-faktura', value: contractData['e-post-kontaktperson'] || '' },
    { custom_id: 'faktura-referens', value: `Offert-${Date.now()}` },
    { custom_id: 'mrkning-av-faktura', value: 'BeGone Offert' }
  )
  
  return mappedFields
}


// 🆕 KONVERTERA PRODUKTER TILL ONEFLOW-FORMAT
function convertProductsToOneflow(
  selectedProducts: ContractRequestBody['selectedProducts'],
  partyType: 'company' | 'individual'
): Array<{
  name: string
  description: string
  price_1: {
    base_amount: { amount: string }
    discount_amount: { amount: string }
    amount: { amount: string }
    discount_percent: string
  }
  price_2: {
    base_amount: { amount: string }
    discount_amount: { amount: string }
    amount: { amount: string }
    discount_percent: string
  }
  quantity: {
    type: string
    amount: number
  }
  counterparty_lock: boolean
}> {
  if (!selectedProducts || selectedProducts.length === 0) {
    return []
  }

  return selectedProducts
    .filter(sp => sp.product.oneflowCompatible)
    .map(selectedProduct => {
      const { product, quantity, customPrice } = selectedProduct
      const pricing = product.pricing[partyType]
      
      let basePrice = customPrice || pricing?.basePrice || 0
      let discountAmount = 0
      
      let originalPrice = basePrice
      
      // Beräkna rabatt om tillgänglig
      if (pricing?.discountPercent && !customPrice) {
        discountAmount = basePrice * (pricing.discountPercent / 100)
        basePrice = basePrice - discountAmount
      }
      
      // Konvertera kvantitetstyp
      let oneflowQuantityType = 'quantity'
      if (product.quantityType === 'single_choice') {
        oneflowQuantityType = 'single_choice'
      } else if (product.quantityType === 'multiple_choice') {
        oneflowQuantityType = 'multiple_choice'
      }
      
      // Sätt korrekt prisstruktur för Oneflow - ENKEL VERSION SOM FUNGERAR
      const finalPriceString = Math.round(basePrice * 100).toString() // Slutpris efter rabatt
      const discountAmountString = discountAmount > 0 ? Math.round(discountAmount * 100).toString() : "0"
      
      return {
        name: product.name,
        description: product.description,
        price_1: {
          base_amount: { amount: finalPriceString },
          discount_amount: { amount: discountAmountString }
        },
        price_2: {
          base_amount: { amount: finalPriceString },
          discount_amount: { amount: discountAmountString }
        },
        quantity: {
          type: oneflowQuantityType,
          amount: quantity
        },
        counterparty_lock: false // Kunderna kan inte redigera produkter
      }
    })
}

// 🆕 VALIDERA ANVÄNDARRÄTTIGHETER
async function validateUserPermissions(senderEmail: string) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  try {
    // Kontrollera om användaren finns och har rätt behörigheter
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*, technicians(*)')
      .eq('email', senderEmail)
      .single()

    if (error || !profile) {
      throw new Error(`Användaren ${senderEmail} har inte behörighet att skapa kontrakt`)
    }

    // Kontrollera att användaren är admin, tekniker eller har OneFlow-behörighet
    const canCreateContracts = profile.is_admin || 
                             profile.technician_id || 
                             profile.role === 'technician'

    if (!canCreateContracts) {
      throw new Error(`Användaren ${senderEmail} har inte behörighet att skapa Oneflow-kontrakt`)
    }

    return {
      profile,
      displayName: profile.display_name || 
                  profile.technicians?.name || 
                  profile.email.split('@')[0],
      isValidated: true
    }
  } catch (validationError: any) {
    console.error('❌ Användarvalidering fel:', validationError)
    throw new Error(`Användarvalidering misslyckades: ${validationError.message}`)
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const {
    templateId,
    contractData,
    recipient,
    sendForSigning,
    partyType,
    documentType,
    senderEmail,
    senderName,
    selectedProducts
  } = req.body as ContractRequestBody

  // 🆕 VALIDERA ANVÄNDAREN FÖRST
  let validatedUser
  try {
    if (senderEmail) {
      validatedUser = await validateUserPermissions(senderEmail)
      console.log(`✅ Användare validerad: ${validatedUser.displayName} (${senderEmail})`)
    }
  } catch (validationError: any) {
    console.error('❌ Användarvalidering misslyckades:', validationError.message)
    return res.status(403).json({ 
      error: 'Obehörig', 
      message: validationError.message 
    })
  }

  const token = process.env.ONEFLOW_API_TOKEN!
  const workspaceId = process.env.ONEFLOW_WORKSPACE_ID!
  
  // 🆕 ANVÄND DYNAMISK ANVÄNDARE ELLER FALLBACK
  const userEmail = senderEmail || process.env.ONEFLOW_USER_EMAIL!
  const userName = validatedUser?.displayName || senderName || 'BeGone Medarbetare'

  if (!token || !userEmail || !workspaceId) {
    console.error('Saknade miljövariabler för Oneflow-integrationen')
    return res.status(500).json({ message: 'Server configuration error.' })
  }

  const documentTypeText = documentType === 'offer' ? 'offert' : 'kontrakt'
  console.log(`🔧 Skapar ${documentTypeText} med avsändare: ${userName} (${userEmail})`)

  // 🆕 ANVÄND NY FÄLTMAPPNING BASERAD PÅ DOKUMENTTYP
  const data_fields = buildDataFieldsForDocument(contractData, documentType)

  const parties = []

  if (partyType === 'individual') {
    // KORRIGERAD STRUKTUR FÖR PRIVATPERSON ENLIGT DOKUMENTATION
    // Använder ett 'participant'-objekt (singular).
    parties.push({
      type: 'individual',
      participant: {
        name: recipient.name,
        email: recipient.email,
        _permissions: {
          'contract:update': sendForSigning
        },
        signatory: sendForSigning,
        delivery_channel: 'email'
      }
    })
  } else {
    // KORREKT STRUKTUR FÖR FÖRETAG (BEVARAD)
    // Använder en 'participants'-array (plural).
    parties.push({
      type: 'company',
      name: recipient.company_name,
      identification_number: recipient.organization_number,
      participants: [
        {
          name: recipient.name,
          email: recipient.email,
          _permissions: {
            'contract:update': sendForSigning
          },
          signatory: sendForSigning,
          delivery_channel: 'email'
        }
      ]
    })
  }

  // Förbered produktgrupper om produkter finns
  let productGroups: any[] = []
  if (selectedProducts && selectedProducts.length > 0) {
    console.log(`🛒 Förbereder ${selectedProducts.length} produkter för kontraktet...`)
    
    const oneflowProducts = convertProductsToOneflow(selectedProducts, partyType)
    
    if (oneflowProducts.length > 0) {
      productGroups = [{
        products: oneflowProducts,
        configuration: {
          hide_price_summation: false
        }
      }]
      console.log(`✅ ${oneflowProducts.length} produkter förberedda för skapande`)
    }
  }

  const createPayload: any = {
    workspace_id: Number(workspaceId),
    template_id: Number(templateId),
    data_fields,
    parties
  }

  // Lägg till produktgrupper om vi har några
  if (productGroups.length > 0) {
    createPayload.product_groups = productGroups
  }

  console.log('Skickar följande create payload till Oneflow:', JSON.stringify(createPayload, null, 2))

  try {
    const createResponse = await fetch(
      'https://api.oneflow.com/v1/contracts/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-oneflow-api-token': token,
          'x-oneflow-user-email': userEmail, // 🆕 ANVÄND DYNAMISK EMAIL
          Accept: 'application/json',
        },
        body: JSON.stringify(createPayload),
      }
    )

    const createdContract = await createResponse.json()
    
    if (!createResponse.ok) {
      console.error('Fel vid skapande av kontrakt:', JSON.stringify(createdContract, null, 2))
      return res.status(createResponse.status).json(createdContract)
    }

    console.log(`✅ ${documentTypeText.charAt(0).toUpperCase() + documentTypeText.slice(1)} skapat framgångsrikt:`, createdContract.id)

    if (sendForSigning) {
      console.log('🚀 Publicerar kontrakt för signering...')
      
      // 🆕 PERSONALISERAT MEDDELANDE BASERAT PÅ DOKUMENTTYP
      const isOffer = documentType === 'offer'
      const publishPayload = {
        subject: `${isOffer ? 'Offert' : 'Avtal'} från BeGone Skadedjur & Sanering AB`,
        message: `Hej ${recipient.name}!\n\nBifogat finner du vår${isOffer ? 't offertförslag' : 't avtal'} för ${isOffer ? 'granskning' : 'signering'}.\n\nMed vänliga hälsningar,\n${userName}\nBeGone Skadedjur & Sanering AB`
      }

      const publishResponse = await fetch(
        `https://api.oneflow.com/v1/contracts/${createdContract.id}/publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-oneflow-api-token': token,
            'x-oneflow-user-email': userEmail, // 🆕 ANVÄND DYNAMISK EMAIL
            Accept: 'application/json',
          },
          body: JSON.stringify(publishPayload),
        }
      )

      if (!publishResponse.ok) {
        const publishError = await publishResponse.json()
        console.error(`⚠️ ${documentTypeText.charAt(0).toUpperCase() + documentTypeText.slice(1)} skapat men kunde inte publiceras:`, JSON.stringify(publishError, null, 2))
        
        return res.status(200).json({ 
          contract: createdContract,
          warning: `${documentTypeText.charAt(0).toUpperCase() + documentTypeText.slice(1)} skapat men kunde inte skickas ${isOffer ? 'för granskning' : 'för signering'} automatiskt`,
          publishError: publishError
        })
      }

      console.log(`✅ ${documentTypeText.charAt(0).toUpperCase() + documentTypeText.slice(1)} publicerat och skickat för ${isOffer ? 'granskning' : 'signering'}`)
    }

    return res.status(200).json({ 
      contract: createdContract,
      sender: {
        name: userName,
        email: userEmail,
        validated: !!validatedUser
      }
    })
    
  } catch (error) {
    console.error('Internt serverfel vid anrop till Oneflow:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}