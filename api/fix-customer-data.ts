// api/fix-customer-data.ts - Script för att fixa befintlig customer-data
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Miljövariabler
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!

// Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Generera produktsammanfattning från nested product_groups
const generateProductSummary = (productGroups: any[] | null): string | null => {
  if (!productGroups || !Array.isArray(productGroups)) return null
  
  const summaries: string[] = []
  
  for (const group of productGroups) {
    if (group.products && Array.isArray(group.products)) {
      for (const product of group.products) {
        const quantity = product.quantity?.amount || 1
        const name = product.name || 'Okänd produkt'
        summaries.push(`${quantity}st ${name}`)
      }
    } 
    else if (group.name) {
      const quantity = group.quantity?.amount || 1
      summaries.push(`${quantity}st ${group.name}`)
    }
  }
  
  return summaries.length > 0 ? summaries.join(', ') : null
}

// Extrahera service-detaljer från produkter
const extractServiceDetails = (productGroups: any[] | null): string | null => {
  if (!productGroups || !Array.isArray(productGroups)) return null
  
  const serviceDetails: string[] = []
  
  for (const group of productGroups) {
    if (group.products && Array.isArray(group.products)) {
      for (const product of group.products) {
        if (product.description) {
          serviceDetails.push(product.description)
        }
      }
    }
  }
  
  return serviceDetails.length > 0 ? serviceDetails.join('. ') : null
}

// Detektera service-frekvens
const detectServiceFrequency = (agreementText: string | null): string | null => {
  const textToAnalyze = agreementText?.toLowerCase() || ''
  
  if (textToAnalyze.includes('månadsvis') || textToAnalyze.includes('månatlig') || 
      textToAnalyze.includes('varje månad') || textToAnalyze.includes('per månad')) {
    return 'monthly'
  }
  
  if (textToAnalyze.includes('kvartalsvis') || textToAnalyze.includes('kvartal') || 
      textToAnalyze.includes('var tredje månad')) {
    return 'quarterly'
  }
  
  if (textToAnalyze.includes('halvårsvis') || textToAnalyze.includes('halvår') || 
      textToAnalyze.includes('var sjätte månad')) {
    return 'biannual'
  }
  
  if (textToAnalyze.includes('årsvis') || textToAnalyze.includes('årlig') || 
      textToAnalyze.includes('en gång per år')) {
    return 'annual'
  }
  
  if (textToAnalyze.includes('veckovis') || textToAnalyze.includes('varje vecka')) {
    return 'weekly'
  }
  
  if (textToAnalyze.includes('vid behov') || textToAnalyze.includes('efter behov')) {
    return 'on_demand'
  }
  
  if (textToAnalyze.includes('regelbunden') || textToAnalyze.includes('kontinuerlig')) {
    return 'monthly'
  }
  
  return null
}

// Parsa kontraktslängd
const parseContractLength = (lengthText: string | null): number => {
  if (!lengthText) return 12
  
  if (/^\d+$/.test(lengthText.trim())) {
    const years = parseInt(lengthText.trim())
    return years * 12
  }
  
  const yearMatch = lengthText.match(/(\d+)\s*år/i)
  if (yearMatch) {
    const years = parseInt(yearMatch[1])
    return years * 12
  }
  
  const monthMatch = lengthText.match(/(\d+)\s*månad/i)
  if (monthMatch) {
    const months = parseInt(monthMatch[1])
    return months
  }
  
  return 12
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    console.log('🔧 Startar uppdatering av customer-data...')
    
    // Hämta alla customers
    const { data: customers, error: fetchError } = await supabase
      .from('customers')
      .select('*')
    
    if (fetchError) {
      throw fetchError
    }
    
    if (!customers || customers.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Inga kunder att uppdatera'
      })
    }
    
    console.log(`📊 Hittade ${customers.length} kunder att uppdatera`)
    
    const updates = []
    
    for (const customer of customers) {
      const updateData: any = {}
      let needsUpdate = false
      
      // 1. Fixa product_summary
      const newProductSummary = generateProductSummary(customer.products)
      if (newProductSummary && newProductSummary !== customer.product_summary) {
        updateData.product_summary = newProductSummary
        needsUpdate = true
        console.log(`✅ Uppdaterar product_summary för ${customer.company_name}`)
        console.log(`   Från: ${customer.product_summary}`)
        console.log(`   Till: ${newProductSummary}`)
      }
      
      // 2. Fixa service_details
      if (!customer.service_details && customer.products) {
        const serviceDetails = extractServiceDetails(customer.products)
        if (serviceDetails) {
          updateData.service_details = serviceDetails
          needsUpdate = true
          console.log(`✅ Lägger till service_details för ${customer.company_name}`)
        }
      }
      
      // 3. Fixa service_frequency
      if (!customer.service_frequency && customer.agreement_text) {
        const serviceFrequency = detectServiceFrequency(customer.agreement_text)
        if (serviceFrequency) {
          updateData.service_frequency = serviceFrequency
          needsUpdate = true
          console.log(`✅ Lägger till service_frequency: ${serviceFrequency} för ${customer.company_name}`)
        }
      }
      
      // 4. Fixa total_contract_value om det verkar fel
      if (customer.annual_value && customer.contract_length) {
        const contractYears = parseContractLength(customer.contract_length) / 12
        const expectedTotalValue = customer.annual_value * contractYears
        
        // Om total_contract_value är samma som annual_value (fel) eller saknas
        if (!customer.total_contract_value || 
            Math.abs(customer.total_contract_value - customer.annual_value) < 1) {
          updateData.total_contract_value = expectedTotalValue
          needsUpdate = true
          console.log(`✅ Korrigerar total_contract_value för ${customer.company_name}`)
          console.log(`   Från: ${customer.total_contract_value}`)
          console.log(`   Till: ${expectedTotalValue} (${customer.annual_value} × ${contractYears} år)`)
        }
      }
      
      // 5. Fixa sales_person om den saknas
      if (!customer.sales_person && customer.assigned_account_manager) {
        updateData.sales_person = customer.assigned_account_manager
        updateData.sales_person_email = customer.account_manager_email
        needsUpdate = true
        console.log(`✅ Sätter sales_person till ${customer.assigned_account_manager} för ${customer.company_name}`)
      }
      
      // Uppdatera om något behöver fixas
      if (needsUpdate) {
        updateData.updated_at = new Date().toISOString()
        
        const { error: updateError } = await supabase
          .from('customers')
          .update(updateData)
          .eq('id', customer.id)
        
        if (updateError) {
          console.error(`❌ Fel vid uppdatering av ${customer.company_name}:`, updateError)
        } else {
          updates.push({
            company: customer.company_name,
            fields_updated: Object.keys(updateData).filter(k => k !== 'updated_at')
          })
        }
      }
    }
    
    console.log(`✅ Uppdatering klar! ${updates.length} kunder uppdaterade`)
    
    return res.status(200).json({
      success: true,
      message: `${updates.length} kunder uppdaterades`,
      updates: updates
    })
    
  } catch (error: any) {
    console.error('❌ Fel vid uppdatering av customer-data:', error)
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
}