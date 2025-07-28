// src/services/clickupFieldMapper.ts
// EXAKT FIELD MAPPING FÖR CLICKUP INTEGRATION BASERAT PÅ DIN DATA

import { geocodeAddress, isAddressGeocoded, type GeocodeResult } from './geocoding'
import { getStatusId } from '../types/database'

export interface ClickUpField {
  id: string
  name: string
  type: string
  required: boolean
  type_config?: any
}

// EXAKTA FIELD IDs FRÅN DIN MAPPING DATA
export const CLICKUP_FIELD_IDS = {
  // Gemensamma fält (finns i båda listorna)
  ADRESS: '0a889578-6c38-4fe2-bda4-6258f628bb68',
  AVVIKELSER_TILLBUD_OLYCKOR: '24136c03-06ef-413a-b84b-e8e69b95855d',
  RAPPORT: '2817b24d-7b06-4c6b-97b9-6fb39c5b44d6',
  STATUS_SANERINGSRAPPORT: '2dfa26ea-23d7-4f57-a499-3596b88497a5',
  KONTAKTPERSON: '5934579c-dcd2-4a1c-b80c-3d5cb81a16a0',
  SKADEDJUR: '748228e8-fc47-4f41-b0f6-fd98e6da98a2',
  SKICKA_BOKNINGSBEKRAFTELSE: '8c1e9d67-8bf4-4641-9772-843a141efac9',
  REKLAMATION: '92e49a7e-9fac-4b40-97bf-f0e3bef308b4',
  E_POST_KONTAKTPERSON: 'b15f404e-dbf9-40db-bd2c-2817e7b741cf',
  TELEFON_KONTAKTPERSON: 'b4c00245-4f1a-4a18-820f-57c501bf18fa',
  VAGGLOSS_ANGADE_RUM: 'c88963d3-0bfd-44e4-9edc-f389f619b2e7',
  PRIS: 'cdeffd72-314b-4f6a-9e4b-e8a7610edf73',
  FILER: 'd6b8929b-3e0a-49be-9525-5fc6b19174c0',
  ANNAT_SKADEDJUR: 'fc459b98-887f-4bb1-9917-dbd90ce1257e',

  // Endast Privatperson
  R_ARBETSKOSTNAD: '1cf9bb02-d2ef-4f61-bc3e-b5bbcaa6a928',
  R_ROT_RUT: '392f5c55-931b-4841-8275-c7bc748ce92f',
  R_FASTIGHETSBETECKNING: '3874f7c0-2c0e-4044-abca-3d35f3ee93ab',
  PERSONNUMMER: '41c3c841-ad00-b1ed5f41abdf',
  R_MATERIAL_UTRUSTNING: '4a275ed4-d795-4b14-b6f9-77f4507294c0',
  R_SERVICEBIL: 'e81100ce-3b5b-4c1f-839b-2ed8e4bf416e',

  // Endast Företag
  MARKNING_FAKTURA: '30042231-13c6-4372-8d11-4274381a98b2',
  E_POST_FAKTURA: '66b53666-120f-4742-89ba-3b01488de9b5',
  ORG_NR: '8d885f6e-1a51-4dd4-83ae-d6dd4eef91bb',
  SKICKA_ERBJUDANDE: 'c076e364-9ddd-4fce-be96-50f231e0524b',
  BESTALLARE: 'ca9363a6-1daa-4110-9a6c-22775ffa464c'
} as const

// LISTA IDs
export const CLICKUP_LISTS = {
  PRIVATPERSON: '901204857438',
  FORETAG: '901204857574'
} as const

// HJÄLPFUNKTION FÖR PRIORITY KONVERTERING
// Baserat på ClickUp API dokumentation: 1=Urgent, 2=High, 3=Normal, 4=Low
function convertPriorityToClickUp(priority: any): number {
  if (!priority) return 3 // Default to Normal
  
  if (typeof priority === 'number') {
    return priority === 1 ? 1 : priority === 2 ? 2 : 3
  }
  
  // Konvertera string-prioriteter till nummer enligt ClickUp API spec
  const priorityMap: { [key: string]: number } = {
    'urgent': 1,
    'high': 2, 
    'normal': 3,
    'low': 4
  }
  
  return priorityMap[priority.toLowerCase()] || 3
}

// ASYNC HJÄLPFUNKTIONER FÖR GEOCODING
async function handleAddressFieldAsync(caseData: any, customFields: any[]): Promise<void> {
  if (!caseData.adress) return

  let addressValue: any

  // Kontrollera om adressen redan är geocodad
  if (isAddressGeocoded(caseData.adress)) {
    // Adressen har redan koordinater, använd den direkt
    if (typeof caseData.adress === 'string') {
      try {
        const parsed = JSON.parse(caseData.adress)
        addressValue = {
          location: {
            lat: parsed.location.lat,
            lng: parsed.location.lng
          },
          formatted_address: parsed.formatted_address
        }
      } catch (e) {
        console.warn('[ClickUpMapper] Failed to parse existing geocoded address:', e)
        return // Skippa fältet om parsing misslyckas
      }
    } else {
      addressValue = {
        location: {
          lat: caseData.adress.location.lat,
          lng: caseData.adress.location.lng
        },
        formatted_address: caseData.adress.formatted_address
      }
    }
  } else {
    // Adressen är bara text, geocoda den
    const addressText = typeof caseData.adress === 'string' ? caseData.adress : String(caseData.adress)
    console.log(`[ClickUpMapper] Geocoding address: "${addressText}"`)

    const geocodeResult = await geocodeAddress(addressText)

    if (geocodeResult.success) {
      addressValue = {
        location: {
          lat: geocodeResult.result.location.lat,
          lng: geocodeResult.result.location.lng
        },
        formatted_address: geocodeResult.result.formatted_address
      }
      console.log(`[ClickUpMapper] Geocoding successful: ${addressText} -> ${geocodeResult.result.formatted_address}`)
    } else {
      console.warn(`[ClickUpMapper] Geocoding failed for "${addressText}": ${geocodeResult.error}`)
      // Skippa address field om geocoding misslyckas för att undvika ClickUp API fel
      return
    }
  }

  // Lägg till address field med korrekta koordinater
  customFields.push({
    id: CLICKUP_FIELD_IDS.ADRESS,
    value: addressValue
  })
}

async function buildRemainingCustomFields(caseData: any, caseType: 'private' | 'business'): Promise<any[]> {
  const customFields: any[] = []

  // Alla andra fält utom adress (som redan hanterats)
  if (caseData.avvikelser_tillbud_olyckor) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.AVVIKELSER_TILLBUD_OLYCKOR,
      value: String(caseData.avvikelser_tillbud_olyckor)
    })
  }

  if (caseData.rapport) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.RAPPORT,
      value: String(caseData.rapport)
    })
  }

  if (caseData.status_saneringsrapport) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.STATUS_SANERINGSRAPPORT,
      value: caseData.status_saneringsrapport
    })
  }

  if (caseData.kontaktperson) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.KONTAKTPERSON,
      value: caseData.kontaktperson
    })
  }

  if (caseData.skadedjur) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.SKADEDJUR,
      value: caseData.skadedjur
    })
  }

  if (caseData.skicka_bokningsbekraftelse !== undefined && caseData.skicka_bokningsbekraftelse !== null) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.SKICKA_BOKNINGSBEKRAFTELSE,
      value: Boolean(caseData.skicka_bokningsbekraftelse)
    })
  }

  if (caseData.reklamation) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.REKLAMATION,
      value: caseData.reklamation
    })
  }

  if (caseData.e_post_kontaktperson) {
    const emailValue = String(caseData.e_post_kontaktperson).trim()
    if (emailValue && emailValue.includes('@')) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.E_POST_KONTAKTPERSON,
        value: emailValue
      })
    }
  }

  if (caseData.telefon_kontaktperson) {
    const phoneValue = String(caseData.telefon_kontaktperson).trim()
    if (phoneValue) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.TELEFON_KONTAKTPERSON,
        value: phoneValue
      })
    }
  }

  if (caseData.vaggloss_angade_rum) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.VAGGLOSS_ANGADE_RUM,
      value: caseData.vaggloss_angade_rum
    })
  }

  if (caseData.pris) {
    const priceValue = parseFloat(caseData.pris)
    if (!isNaN(priceValue)) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.PRIS,
        value: priceValue
      })
    }
  }

  if (caseData.filer) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.FILER,
      value: typeof caseData.filer === 'string' ? JSON.parse(caseData.filer) : caseData.filer
    })
  }

  if (caseData.annat_skadedjur) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.ANNAT_SKADEDJUR,
      value: caseData.annat_skadedjur
    })
  }

  // Privatperson-specifika fält
  if (caseType === 'private') {
    if (caseData.r_arbetskostnad) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.R_ARBETSKOSTNAD,
        value: caseData.r_arbetskostnad
      })
    }

    if (caseData.r_rot_rut) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.R_ROT_RUT,
        value: caseData.r_rot_rut
      })
    }

    if (caseData.r_fastighetsbeteckning) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.R_FASTIGHETSBETECKNING,
        value: caseData.r_fastighetsbeteckning
      })
    }

    if (caseData.personnummer) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.PERSONNUMMER,
        value: caseData.personnummer
      })
    }

    if (caseData.r_material_utrustning) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.R_MATERIAL_UTRUSTNING,
        value: caseData.r_material_utrustning
      })
    }

    if (caseData.r_servicebil) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.R_SERVICEBIL,
        value: caseData.r_servicebil
      })
    }
  }

  // Företag-specifika fält
  if (caseType === 'business') {
    if (caseData.markning_faktura) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.MARKNING_FAKTURA,
        value: caseData.markning_faktura
      })
    }

    if (caseData.e_post_faktura) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.E_POST_FAKTURA,
        value: caseData.e_post_faktura
      })
    }

    if (caseData.org_nr) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.ORG_NR,
        value: caseData.org_nr
      })
    }

    if (caseData.skicka_erbjudande !== undefined && caseData.skicka_erbjudande !== null) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.SKICKA_ERBJUDANDE,
        value: Boolean(caseData.skicka_erbjudande)
      })
    }

    if (caseData.bestallare) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.BESTALLARE,
        value: caseData.bestallare
      })
    }
  }

  return customFields
}

// KONVERTERA FRÅN SUPABASE TILL CLICKUP FORMAT (ASYNC VERSION MED GEOCODING)
export async function convertSupabaseToClickUpAsync(caseData: any, caseType: 'private' | 'business') {
  const customFields: any[] = []

  // Geocoda adress om nödvändigt
  await handleAddressFieldAsync(caseData, customFields)

  // Resten av custom fields (utan adress som redan hanterats)
  const remainingFields = await buildRemainingCustomFields(caseData, caseType)
  customFields.push(...remainingFields)

  return {
    name: caseData.title,
    description: caseData.description || '',
    status: getStatusId('Bokat'), // Använd status ID från database.ts
    priority: convertPriorityToClickUp(caseData.priority),
    custom_fields: customFields,
    due_date: caseData.due_date ? new Date(caseData.due_date).getTime() : undefined,
    start_date: caseData.start_date ? new Date(caseData.start_date).getTime() : undefined
  }
}

// URSPRUNGLIG SYNC VERSION (BEHÅLLS FÖR BAKÅTKOMPATIBILITET)
export function convertSupabaseToClickUp(caseData: any, caseType: 'private' | 'business') {
  const customFields: any[] = []

  // Gemensamma fält för båda typerna
  if (caseData.adress) {
    let addressValue;
    let hasValidLocation = false;
    
    if (typeof caseData.adress === 'string') {
      try {
        // Försök parsa som JSON först
        const parsedAddress = JSON.parse(caseData.adress);
        
        // Kontrollera om det har giltiga koordinater enligt ClickUp API spec
        if (parsedAddress.location && 
            typeof parsedAddress.location.lat === 'number' && 
            typeof parsedAddress.location.lng === 'number' &&
            parsedAddress.formatted_address) {
          addressValue = {
            location: {
              lat: parsedAddress.location.lat,
              lng: parsedAddress.location.lng
            },
            formatted_address: parsedAddress.formatted_address
          };
          hasValidLocation = true;
        }
      } catch (e) {
        // JSON parse misslyckades, ingen giltig location data
      }
    } else if (caseData.adress && typeof caseData.adress === 'object') {
      // Kontrollera om objektet har giltiga koordinater
      if (caseData.adress.location &&
          typeof caseData.adress.location.lat === 'number' &&
          typeof caseData.adress.location.lng === 'number' &&
          caseData.adress.formatted_address) {
        addressValue = {
          location: {
            lat: caseData.adress.location.lat,
            lng: caseData.adress.location.lng
          },
          formatted_address: caseData.adress.formatted_address
        };
        hasValidLocation = true;
      }
    }
    
    // Lägg bara till location field om vi har giltiga koordinater
    // Enligt ClickUp API spec måste location fields ha lat/lng koordinater
    if (hasValidLocation && addressValue) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.ADRESS,
        value: addressValue
      });
    }
    // Annars kan vi spara adressen som ett text field eller skippa det helt
    // för att undvika API-fel
  }

  if (caseData.avvikelser_tillbud_olyckor) {
    // Text field - måste vara sträng enligt ClickUp API
    customFields.push({
      id: CLICKUP_FIELD_IDS.AVVIKELSER_TILLBUD_OLYCKOR,
      value: String(caseData.avvikelser_tillbud_olyckor)
    })
  }

  if (caseData.rapport) {
    // Text field - måste vara sträng enligt ClickUp API
    customFields.push({
      id: CLICKUP_FIELD_IDS.RAPPORT,
      value: String(caseData.rapport)
    })
  }

  if (caseData.status_saneringsrapport) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.STATUS_SANERINGSRAPPORT,
      value: caseData.status_saneringsrapport
    })
  }

  if (caseData.kontaktperson) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.KONTAKTPERSON,
      value: caseData.kontaktperson
    })
  }

  if (caseData.skadedjur) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.SKADEDJUR,
      value: caseData.skadedjur
    })
  }

  if (caseData.skicka_bokningsbekraftelse !== undefined && caseData.skicka_bokningsbekraftelse !== null) {
    // Checkbox field - måste vara boolean enligt ClickUp API
    customFields.push({
      id: CLICKUP_FIELD_IDS.SKICKA_BOKNINGSBEKRAFTELSE,
      value: Boolean(caseData.skicka_bokningsbekraftelse)
    })
  }

  if (caseData.reklamation) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.REKLAMATION,
      value: caseData.reklamation
    })
  }

  if (caseData.e_post_kontaktperson) {
    // Email field - måste vara en giltig email-sträng enligt ClickUp API
    const emailValue = String(caseData.e_post_kontaktperson).trim();
    if (emailValue && emailValue.includes('@')) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.E_POST_KONTAKTPERSON,
        value: emailValue
      })
    }
  }

  if (caseData.telefon_kontaktperson) {
    // Phone field - måste vara en giltig telefon-sträng enligt ClickUp API
    const phoneValue = String(caseData.telefon_kontaktperson).trim();
    if (phoneValue) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.TELEFON_KONTAKTPERSON,
        value: phoneValue
      })
    }
  }

  if (caseData.vaggloss_angade_rum) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.VAGGLOSS_ANGADE_RUM,
      value: caseData.vaggloss_angade_rum
    })
  }

  if (caseData.pris) {
    // Currency/Number field - måste vara ett numeriskt värde enligt ClickUp API
    const priceValue = parseFloat(caseData.pris);
    if (!isNaN(priceValue)) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.PRIS,
        value: priceValue
      })
    }
  }

  if (caseData.filer) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.FILER,
      value: typeof caseData.filer === 'string' ? JSON.parse(caseData.filer) : caseData.filer
    })
  }

  if (caseData.annat_skadedjur) {
    customFields.push({
      id: CLICKUP_FIELD_IDS.ANNAT_SKADEDJUR,
      value: caseData.annat_skadedjur
    })
  }

  // Privatperson-specifika fält
  if (caseType === 'private') {
    if (caseData.r_arbetskostnad) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.R_ARBETSKOSTNAD,
        value: caseData.r_arbetskostnad
      })
    }

    if (caseData.r_rot_rut) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.R_ROT_RUT,
        value: caseData.r_rot_rut
      })
    }

    if (caseData.r_fastighetsbeteckning) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.R_FASTIGHETSBETECKNING,
        value: caseData.r_fastighetsbeteckning
      })
    }

    if (caseData.personnummer) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.PERSONNUMMER,
        value: caseData.personnummer
      })
    }

    if (caseData.r_material_utrustning) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.R_MATERIAL_UTRUSTNING,
        value: caseData.r_material_utrustning
      })
    }

    if (caseData.r_servicebil) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.R_SERVICEBIL,
        value: caseData.r_servicebil
      })
    }
  }

  // Företag-specifika fält
  if (caseType === 'business') {
    if (caseData.markning_faktura) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.MARKNING_FAKTURA,
        value: caseData.markning_faktura
      })
    }

    if (caseData.e_post_faktura) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.E_POST_FAKTURA,
        value: caseData.e_post_faktura
      })
    }

    if (caseData.org_nr) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.ORG_NR,
        value: caseData.org_nr
      })
    }

    if (caseData.skicka_erbjudande !== undefined && caseData.skicka_erbjudande !== null) {
      // Checkbox field - måste vara boolean enligt ClickUp API
      customFields.push({
        id: CLICKUP_FIELD_IDS.SKICKA_ERBJUDANDE,
        value: Boolean(caseData.skicka_erbjudande)
      })
    }

    if (caseData.bestallare) {
      customFields.push({
        id: CLICKUP_FIELD_IDS.BESTALLARE,
        value: caseData.bestallare
      })
    }
  }

  return {
    name: caseData.title,
    description: caseData.description || '',
    status: getStatusId('Bokat'), // Använd status ID från database.ts
    priority: convertPriorityToClickUp(caseData.priority),
    custom_fields: customFields,
    due_date: caseData.due_date ? new Date(caseData.due_date).getTime() : undefined,
    start_date: caseData.start_date ? new Date(caseData.start_date).getTime() : undefined
  }
}

// KONVERTERA FRÅN CLICKUP TILL SUPABASE FORMAT  
export function convertClickUpToSupabase(clickupTask: any, caseType: 'private' | 'business') {
  const supabaseData: any = {
    clickup_task_id: clickupTask.id,
    title: clickupTask.name,
    description: clickupTask.description || null,
    status: clickupTask.status?.status || 'open',
    priority: clickupTask.priority?.priority || 'normal',
    created_date: clickupTask.date_created ? new Date(parseInt(clickupTask.date_created)) : new Date(),
    due_date: clickupTask.due_date ? new Date(parseInt(clickupTask.due_date)) : null,
    start_date: clickupTask.start_date ? new Date(parseInt(clickupTask.start_date)) : null
  }

  // Hantera custom fields
  if (clickupTask.custom_fields && Array.isArray(clickupTask.custom_fields)) {
    for (const field of clickupTask.custom_fields) {
      switch (field.id) {
        case CLICKUP_FIELD_IDS.ADRESS:
          // Spara ClickUp adress-objekt som JSON-sträng för Supabase
          supabaseData.adress = typeof field.value === 'object' ? JSON.stringify(field.value) : field.value
          break
        case CLICKUP_FIELD_IDS.AVVIKELSER_TILLBUD_OLYCKOR:
          supabaseData.avvikelser_tillbud_olyckor = field.value
          break
        case CLICKUP_FIELD_IDS.RAPPORT:
          supabaseData.rapport = field.value
          break
        case CLICKUP_FIELD_IDS.STATUS_SANERINGSRAPPORT:
          supabaseData.status_saneringsrapport = field.value
          break
        case CLICKUP_FIELD_IDS.KONTAKTPERSON:
          supabaseData.kontaktperson = field.value
          break
        case CLICKUP_FIELD_IDS.SKADEDJUR:
          supabaseData.skadedjur = field.value
          break
        case CLICKUP_FIELD_IDS.SKICKA_BOKNINGSBEKRAFTELSE:
          supabaseData.skicka_bokningsbekraftelse = field.value
          break
        case CLICKUP_FIELD_IDS.REKLAMATION:
          supabaseData.reklamation = field.value
          break
        case CLICKUP_FIELD_IDS.E_POST_KONTAKTPERSON:
          supabaseData.e_post_kontaktperson = field.value
          break
        case CLICKUP_FIELD_IDS.TELEFON_KONTAKTPERSON:
          supabaseData.telefon_kontaktperson = field.value
          break
        case CLICKUP_FIELD_IDS.VAGGLOSS_ANGADE_RUM:
          supabaseData.vaggloss_angade_rum = field.value
          break
        case CLICKUP_FIELD_IDS.PRIS:
          supabaseData.pris = field.value
          break
        case CLICKUP_FIELD_IDS.FILER:
          supabaseData.filer = field.value
          break
        case CLICKUP_FIELD_IDS.ANNAT_SKADEDJUR:
          supabaseData.annat_skadedjur = field.value
          break

        // Privatperson-specifika fält
        case CLICKUP_FIELD_IDS.R_ARBETSKOSTNAD:
          if (caseType === 'private') supabaseData.r_arbetskostnad = field.value
          break
        case CLICKUP_FIELD_IDS.R_ROT_RUT:
          if (caseType === 'private') supabaseData.r_rot_rut = field.value
          break
        case CLICKUP_FIELD_IDS.R_FASTIGHETSBETECKNING:
          if (caseType === 'private') supabaseData.r_fastighetsbeteckning = field.value
          break
        case CLICKUP_FIELD_IDS.PERSONNUMMER:
          if (caseType === 'private') supabaseData.personnummer = field.value
          break
        case CLICKUP_FIELD_IDS.R_MATERIAL_UTRUSTNING:
          if (caseType === 'private') supabaseData.r_material_utrustning = field.value
          break
        case CLICKUP_FIELD_IDS.R_SERVICEBIL:
          if (caseType === 'private') supabaseData.r_servicebil = field.value
          break

        // Företag-specifika fält
        case CLICKUP_FIELD_IDS.MARKNING_FAKTURA:
          if (caseType === 'business') supabaseData.markning_faktura = field.value
          break
        case CLICKUP_FIELD_IDS.E_POST_FAKTURA:
          if (caseType === 'business') supabaseData.e_post_faktura = field.value
          break
        case CLICKUP_FIELD_IDS.ORG_NR:
          if (caseType === 'business') supabaseData.org_nr = field.value
          break
        case CLICKUP_FIELD_IDS.SKICKA_ERBJUDANDE:
          if (caseType === 'business') supabaseData.skicka_erbjudande = field.value
          break
        case CLICKUP_FIELD_IDS.BESTALLARE:
          if (caseType === 'business') supabaseData.bestallare = field.value
          break
      }
    }
  }

  return supabaseData
}

// HJÄLPFUNKTION FÖR ATT AVGÖRA CASE TYPE FRÅN LISTA
export function getCaseTypeFromListId(listId: string): 'private' | 'business' | null {
  if (listId === CLICKUP_LISTS.PRIVATPERSON) return 'private'
  if (listId === CLICKUP_LISTS.FORETAG) return 'business'
  return null
}

// HJÄLPFUNKTION FÖR ATT FÅ LISTA FRÅN CASE TYPE
export function getListIdFromCaseType(caseType: 'private' | 'business'): string {
  return caseType === 'private' ? CLICKUP_LISTS.PRIVATPERSON : CLICKUP_LISTS.FORETAG
}