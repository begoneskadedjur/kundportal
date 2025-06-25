// utils/clickupFieldMapper.ts - Hanterar dropdown-mappning från ClickUp
export interface DropdownOption {
  id: string
  name: string
  color?: string
  orderindex: number
}

export interface CustomField {
  id: string
  name: string
  type: string
  value: any
  has_value: boolean
  type_config?: {
    options?: DropdownOption[]
  }
}

// Mapping för skadedjur baserat på dina ClickUp-alternativ
export const PEST_TYPE_MAPPING: { [key: string]: string } = {
  // Mappa baserat på orderindex eller id från ClickUp
  '0': 'Råttor',
  '1': 'Möss', 
  '2': 'Kackerlackor',
  '3': 'Myror',
  '4': 'Getingar',
  '5': 'Flugor',
  '6': 'Inspektion',
  '7': 'Loppor',
  '8': 'Flygande insekt',
  '9': 'Krypande insekt',
  '10': 'Skadedjursavtal',
  '11': 'Hundsök - Vägglöss',
  '12': 'Liksanering',
  '13': 'Övrigt'
}

// Mapping för ärendetyper
export const CASE_TYPE_MAPPING: { [key: string]: string } = {
  '0': 'Servicebesök',
  '1': 'Etablering'
}

// Funktion för att få dropdown-text från ClickUp custom field
export function getDropdownDisplayValue(field: CustomField): string {
  if (!field.has_value || field.value === null || field.value === undefined) {
    return 'Ej specificerat'
  }

  // Om vi har type_config med options, använd det
  if (field.type_config?.options && Array.isArray(field.type_config.options)) {
    const selectedOption = field.type_config.options.find(
      option => option.orderindex === field.value || option.id === field.value
    )
    if (selectedOption) {
      return selectedOption.name
    }
  }

  // Fallback till våra hårdkodade mappningar baserat på fältnamn
  if (field.name.toLowerCase().includes('skadedjur')) {
    return PEST_TYPE_MAPPING[field.value.toString()] || `Okänt skadedjur (${field.value})`
  }

  if (field.name.toLowerCase().includes('ärende') || field.name.toLowerCase().includes('typ')) {
    return CASE_TYPE_MAPPING[field.value.toString()] || `Okänd typ (${field.value})`
  }

  // Om inget matchar, returnera värdet som text
  return field.value.toString()
}

// Funktion för att formatera adressfält
export function formatAddressField(field: CustomField): string | null {
  if (!field.has_value || !field.value) return null
  
  if (field.type === 'location' && field.value.formatted_address) {
    return field.value.formatted_address
  }
  
  return field.value.toString()
}

// Funktion för att formatera prisfält
export function formatPriceField(field: CustomField): string | null {
  if (!field.has_value || field.value === null || field.value === undefined) return null
  
  if (field.type === 'currency') {
    // ClickUp currency kan vara i olika format
    if (typeof field.value === 'object' && field.value.amount) {
      return `${field.value.amount} ${field.value.currency || 'kr'}`
    }
    return `${field.value} kr`
  }
  
  return field.value.toString()
}

// Funktion för att formattera bilagor
export function formatAttachmentField(field: CustomField): any[] {
  if (!field.has_value || !Array.isArray(field.value)) return []
  
  return field.value.map(file => ({
    id: file.id,
    title: file.title,
    url: file.url,
    url_w_query: file.url_w_query,
    url_w_host: file.url_w_host,
    size: file.size,
    mimetype: file.mimetype,
    extension: file.extension,
    thumbnail_small: file.thumbnail_small,
    thumbnail_medium: file.thumbnail_medium,
    thumbnail_large: file.thumbnail_large
  }))
}

// Huvud-funktion för att hämta och formatera custom field värde
export function getFormattedFieldValue(
  customFields: CustomField[], 
  fieldName: string, 
  formatType?: 'dropdown' | 'address' | 'price' | 'attachment' | 'text'
): any {
  const field = customFields.find(f => 
    f.name.toLowerCase() === fieldName.toLowerCase() && f.has_value
  )
  
  if (!field) return null
  
  switch (formatType || field.type) {
    case 'dropdown':
    case 'drop_down':
      return getDropdownDisplayValue(field)
    
    case 'location':
    case 'address':
      return formatAddressField(field)
    
    case 'currency':
    case 'price':
      return formatPriceField(field)
    
    case 'attachment':
      return formatAttachmentField(field)
    
    case 'text':
    default:
      return field.value
  }
}