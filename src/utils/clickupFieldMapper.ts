// utils/clickupFieldMapper.ts - UPPDATERAD MED FULLSTÄNDIG SKADEDJURSLISTA

export interface DropdownOption {
  id: string
  name: string
  color?: string | null // Tillåt null för color
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

// ✅ NY, FULLSTÄNDIG OCH KORREKT MAPPING
// Direkt från din JSON-mappning. Detta blir den enda källan.
export const PEST_TYPE_OPTIONS: Readonly<DropdownOption[]> = [
  { id: "6ba02f78-49e5-4298-aad9-c2051551152b", name: "Råttor", color: "#AF7E2E", orderindex: 0 },
  { id: "1c590bf2-60dd-4494-8805-06ba90f4630f", name: "Möss", color: "#800000", orderindex: 1 },
  { id: "5f9f1088-d2d7-4111-93ab-a2a3e9bda045", name: "Vägglöss", color: "#ff7800", orderindex: 2 },
  { id: "755f063f-ba3c-4d45-a520-935e5d9be210", name: "Pälsänger", color: "#2ecd6f", orderindex: 3 },
  { id: "11adf69f-347e-42c8-825a-c12f897e3428", name: "Silverfisk", color: "#FF7FAB", orderindex: 4 },
  { id: "0d77a899-2948-4e03-8085-14ebfce5693a", name: "Getingar", color: "#f9d900", orderindex: 5 },
  { id: "336cc6d5-f8a4-4fc3-8ec2-fe26b87d1292", name: "Fågelsäkring", color: "#667684", orderindex: 6 },
  { id: "370bf480-2a71-46e2-a7aa-ba3c8fb2ecb8", name: "Kackerlackor", color: "#1bbc9c", orderindex: 7 },
  { id: "45f4dcca-47fb-488e-9818-3783e8f0cb82", name: "Mjölbaggar", color: "#918479", orderindex: 8 },
  { id: "12717b47-6ab7-41f4-8441-a83702527ecf", name: "Klädesmal", color: "#FF4081", orderindex: 9 },
  { id: "a47201a6-a919-4fea-b147-e317cc9f838c", name: "Myror", color: "#9b59b6", orderindex: 10 },
  { id: "8c4d9362-be35-4ad3-b739-b572fd9f084d", name: "Flugor", color: "#EA80FC", orderindex: 11 },
  { id: "636693c7-2125-4974-811d-8e2ef03788a4", name: "Inspektion", color: "#81B1FF", orderindex: 12 },
  { id: "745ac0c4-c3a9-4e7d-80d0-94518ec51681", name: "Loppor", color: "#0231E8", orderindex: 13 },
  { id: "50ba931f-a729-42a4-b29a-b5b4e302c66b", name: "Flygande insekt", color: "#E65100", orderindex: 14 },
  { id: "da228f74-c9ca-495b-8ee4-9af68f7501be", name: "Krypande insekt", color: "#EA80FC", orderindex: 15 },
  { id: "12e16cbe-8cee-4de1-b9aa-9ab0621cec36", name: "Skadedjursavtal", color: "#1bbc9c", orderindex: 16 },
  { id: "f80693cd-25db-4cf4-9346-04b6381d63eb", name: "Hundsök - Vägglöss", color: null, orderindex: 17 },
  { id: "363d9058-a999-43c7-a44c-35a10aadc603", name: "Liksanering", color: "#b5bcc2", orderindex: 18 },
  { id: "6f7a0282-6483-487b-b754-19ba5ffc7073", name: "Övrigt", color: "#b5bcc2", orderindex: 19 }
];

// Skapa en enkel lista med bara namnen, som vi behöver för checklistan i kompetenskartan
export const PEST_TYPES = PEST_TYPE_OPTIONS.map(option => option.name) as readonly string[];
export type PestType = typeof PEST_TYPES[number];

// Ersätter din gamla, ofullständiga PEST_TYPE_MAPPING
export const PEST_TYPE_MAPPING: { [key: string]: string } = PEST_TYPE_OPTIONS.reduce((acc, option) => {
  acc[option.orderindex.toString()] = option.name;
  acc[option.id] = option.name; // Mappa även på ID för robusthet
  return acc;
}, {} as { [key: string]: string });


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