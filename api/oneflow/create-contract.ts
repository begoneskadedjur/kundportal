// api/oneflow/create-contract.ts - KOMPLETT UPPDATERAD VERSION MED DYNAMISK ANVÄNDARE
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
// Node.js 18+ har inbyggd fetch

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
  // NYTT: Dynamisk användare från frontend
  senderEmail?: string
  senderName?: string
  // NYTT: Case ID för koppling
  caseId?: string
  // NYTT: Produkter
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
    selectedVariant?: {
      id: string
      name: string
      pricing: {
        company?: { basePrice: number; vatRate?: number; discountPercent?: number }
        individual?: { basePrice: number; taxDeduction?: string; discountPercent?: number }
      }
    }
    notes?: string
  }>
}

// FÄLTMAPPNING FÖR OLIKA DOKUMENTTYPER
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

// BYGG DATAFÄLT BASERAT PÅ DOKUMENTTYP
function buildDataFieldsForDocument(
  contractData: Record<string, string>, 
  documentType: 'offer' | 'contract',
  caseId?: string
): Array<{ custom_id: string; value: string }> {
  const fields: Array<{ custom_id: string; value: string }> = []
  
  if (documentType === 'contract') {
    // För avtal, använd befintlig struktur
    fields.push(...Object.entries(contractData).map(([custom_id, value]) => ({ custom_id, value })))
  } else {
    // För offerter, mappa fält till offertspecifika namn
    const mapping = FIELD_MAPPING.contract_to_offer
    
    Object.entries(contractData).forEach(([contractField, value]) => {
      const offerField = mapping[contractField as keyof typeof mapping]
      
      if (offerField && offerField !== '' && value) {
        fields.push({ custom_id: offerField, value })
      }
    })
    
    // Lägg till offertspecifika fält med standardvärden
    const currentDate = new Date().toISOString().split('T')[0]
    fields.push(
      { custom_id: 'offert-skapad', value: currentDate },
      { custom_id: 'epost-faktura', value: contractData['e-post-kontaktperson'] || '' }
      // Faktura-referens och märkning lämnas tomma så kunden kan fylla i
    )
  }
  
  // case_id fungerar inte i Oneflow-mallen för offerter
  // Vi sparar istället case_id i databasen efter att kontraktet skapats
  // if (caseId) {
  //   fields.push({ custom_id: 'case_id', value: caseId })
  // }
  
  return fields
}


// KONVERTERA PRODUKTER TILL ONEFLOW-FORMAT
function convertProductsToOneflow(
  selectedProducts: ContractRequestBody['selectedProducts'],
  partyType: 'company' | 'individual'
): Array<{
  name: string
  description: string
  price_1: {
    base_amount: { amount: string }
    discount_amount: { amount: string }
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
      const { product, quantity, customPrice, selectedVariant } = selectedProduct
      
      // Bestäm vilken prissättning som ska användas
      // 1. Anpassat pris (högsta prioritet)
      // 2. Vald variant 
      // 3. Fallback till baspris
      let pricing
      if (selectedVariant) {
        pricing = selectedVariant.pricing[partyType]
      } else {
        pricing = product.pricing[partyType]
      }
      
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
      
      const finalPriceString = Math.round(basePrice).toString()
      const discountAmountString = discountAmount > 0 ? Math.round(discountAmount).toString() : "0"

      return {
        name: product.name,
        description: product.description,
        price_1: {
          base_amount: { amount: finalPriceString },
          discount_amount: { amount: discountAmountString }
        },
        quantity: {
          type: oneflowQuantityType,
          amount: quantity
        },
        counterparty_lock: false
      }
    })
}

// VALIDERA ANVÄNDARRÄTTIGHETER
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
    selectedProducts,
    caseId
  } = req.body as ContractRequestBody

  // Validera användaren
  let validatedUser
  try {
    if (senderEmail) {
      validatedUser = await validateUserPermissions(senderEmail)
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
  
  // 🔄 CENTRALISERAD AVSÄNDARE - Alltid info@begone.se
  const userEmail = 'info@begone.se' // Alltid skicka från info@begone.se
  const creatorEmail = senderEmail || process.env.ONEFLOW_USER_EMAIL! // Spara vem som skapade
  const creatorName = validatedUser?.displayName || senderName || 'BeGone Medarbetare'
  const creatorRole = validatedUser?.profile?.role || 'admin'

  if (!token || !userEmail || !workspaceId) {
    console.error('Saknade miljövariabler för Oneflow-integrationen')
    return res.status(500).json({ message: 'Server configuration error.' })
  }

  const documentTypeText = documentType === 'offer' ? 'offert' : 'kontrakt'
  console.log(`Skapar ${documentTypeText} för ${recipient.name} (${recipient.email})`)

  const data_fields = buildDataFieldsForDocument(contractData, documentType, caseId)

  // Bygg participant-objekt
  const participantData = {
    name: recipient.name,
    email: recipient.email,
    _permissions: { 'contract:update': !!sendForSigning },
    signatory: !!sendForSigning,
    delivery_channel: 'email'
  }

  // Bygg parties-struktur baserat på kundtyp
  const parties = partyType === 'individual'
    ? [{
        type: 'individual',
        country_code: 'SE',
        participant: participantData
      }]
    : [{
        type: 'company',
        country_code: 'SE',
        name: recipient.company_name,
        identification_number: recipient.organization_number,
        participants: [participantData]
      }]

  // Förbered produktgrupper om produkter finns
  let productGroups: any[] = []
  if (selectedProducts && selectedProducts.length > 0) {
    const oneflowProducts = convertProductsToOneflow(selectedProducts, partyType)
    if (oneflowProducts.length > 0) {
      productGroups = [{
        products: oneflowProducts,
        configuration: { hide_price_summation: false }
      }]
    }
  }

  const createPayload: any = {
    workspace_id: Number(workspaceId),
    template_id: Number(templateId),
    data_fields,
    parties
  }

  if (productGroups.length > 0) {
    createPayload.product_groups = productGroups
  }

  try {
    const createResponse = await fetch(
      'https://api.oneflow.com/v1/contracts/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-oneflow-api-token': token,
          'x-oneflow-user-email': userEmail, // ANVÄND DYNAMISK EMAIL
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

    console.log(`${documentTypeText} skapat:`, createdContract.id)

    if (sendForSigning) {
      // Personaliserat meddelande baserat på dokumenttyp
      const isOffer = documentType === 'offer'
      const publishPayload = {
        subject: `${isOffer ? 'Offert' : 'Avtal'} från BeGone Skadedjur & Sanering AB`,
        message: `Hej ${recipient.name}!\n\nBifogat finner du vår${isOffer ? 't offertförslag' : 't avtal'} för ${isOffer ? 'granskning' : 'signering'}.\n\nMed vänliga hälsningar,\n${creatorName}\nBeGone Skadedjur & Sanering AB`
      }

      const publishResponse = await fetch(
        `https://api.oneflow.com/v1/contracts/${createdContract.id}/publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-oneflow-api-token': token,
            'x-oneflow-user-email': userEmail,
            Accept: 'application/json',
          },
          body: JSON.stringify(publishPayload),
        }
      )

      if (!publishResponse.ok) {
        const publishError = await publishResponse.json()
        console.error(`${documentTypeText} skapat men kunde inte publiceras:`, publishError)
        return res.status(200).json({
          contract: createdContract,
          warning: `${documentTypeText} skapat men kunde inte skickas automatiskt`,
          publishError
        })
      }

      console.log(`${documentTypeText} publicerat för ${isOffer ? 'granskning' : 'signering'}`)
    }

    // Spara creator info i databasen
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
    
    // Uppdatera kontraktet med creator info och case-koppling
    const updateData: any = {
      created_by_email: creatorEmail,
      created_by_name: creatorName,
      created_by_role: creatorRole
    }
    
    // Lägg till source_id och source_type om caseId finns
    if (caseId) {
      updateData.source_id = caseId
      updateData.source_type = 'legacy_case'
    }
    
    const { error: updateError } = await supabase
      .from('contracts')
      .update(updateData)
      .eq('oneflow_contract_id', createdContract.id)
    
    if (updateError) {
      console.error('Kunde inte uppdatera creator info:', updateError)
    }

    // Identifiera och koppla kund för offerten
    let customerId = null
    if (documentType === 'offer' || documentType === 'contract') {
      // Sök efter befintlig kund - prioritet: org.nr > email > företagsnamn
      if (recipient.organization_number) {
        const { data: customerByOrg } = await supabase
          .from('customers')
          .select('id')
          .eq('organization_number', recipient.organization_number)
          .single()
        if (customerByOrg) customerId = customerByOrg.id
      }

      if (!customerId && recipient.email) {
        const { data: customerByEmail } = await supabase
          .from('customers')
          .select('id')
          .eq('contact_email', recipient.email)
          .single()
        if (customerByEmail) customerId = customerByEmail.id
      }

      if (!customerId && recipient.company_name) {
        const { data: customerByName } = await supabase
          .from('customers')
          .select('id')
          .eq('company_name', recipient.company_name)
          .single()
        if (customerByName) customerId = customerByName.id
      }

      // Koppla kund till kontraktet om hittad
      if (customerId) {
        const { error: customerLinkError } = await supabase
          .from('contracts')
          .update({ customer_id: customerId, updated_at: new Date().toISOString() })
          .eq('oneflow_contract_id', createdContract.id)

        if (customerLinkError) {
          console.error('Kunde inte koppla kund:', customerLinkError)
        }
      }
    }
    
    return res.status(200).json({ 
      contract: createdContract,
      quote_id: createdContract.id, // Use contract ID as quote_id for multisite recipient handling
      sender: {
        name: 'info@begone.se',
        email: 'info@begone.se',
        validated: true
      },
      creator: {
        name: creatorName,
        email: creatorEmail,
        role: creatorRole
      }
    })
    
  } catch (error) {
    console.error('Internt serverfel vid anrop till Oneflow:', error)
    return res.status(500).json({ message: 'Internal server error' })
  }
}