// src/constants/oneflowTemplates.ts - Centraliserad konfiguration för OneFlow-mallar

export interface OneflowTemplate {
  id: string
  name: string
  type: 'contract' | 'offer'
  category?: 'company' | 'individual' // För offert-mallar
  popular?: boolean
}

// Offert-mallar som vi använder
export const OFFER_TEMPLATES: OneflowTemplate[] = [
  { 
    id: '8598798', 
    name: 'Offertförslag – Exkl Moms (Företag)',
    type: 'offer',
    category: 'company'
  },
  { 
    id: '8919037', 
    name: 'Offertförslag – Inkl moms (Privatperson)',
    type: 'offer',
    category: 'individual'
  },
  { 
    id: '8919012', 
    name: 'Offertförslag – ROT (Privatperson)',
    type: 'offer',
    category: 'individual'
  },
  { 
    id: '8919059', 
    name: 'Offertförslag – RUT (Privatperson)',
    type: 'offer',
    category: 'individual'
  }
]

// Avtals-mallar som vi använder
export const CONTRACT_TEMPLATES: OneflowTemplate[] = [
  { 
    id: '8486368', 
    name: 'Skadedjursavtal',
    type: 'contract',
    popular: true
  },
  { 
    id: '9324573', 
    name: 'Avtal Betesstationer',
    type: 'contract'
  },
  { 
    id: '8465556', 
    name: 'Avtal Betongstationer',
    type: 'contract'
  },
  { 
    id: '8462854', 
    name: 'Avtal Mekaniska fällor',
    type: 'contract'
  },
  { 
    id: '8732196', 
    name: 'Avtal Indikationsfällor',
    type: 'contract'
  }
]

// Alla mallar kombinerat
export const ALL_TEMPLATES: OneflowTemplate[] = [
  ...OFFER_TEMPLATES,
  ...CONTRACT_TEMPLATES
]

// Set med alla mall-ID:n för snabb uppslagning
export const ALLOWED_TEMPLATE_IDS = new Set(
  ALL_TEMPLATES.map(template => template.id)
)

// Hjälpfunktioner
export const getTemplateById = (id: string): OneflowTemplate | undefined => {
  return ALL_TEMPLATES.find(template => template.id === id)
}

export const getTemplatesByType = (type: 'contract' | 'offer'): OneflowTemplate[] => {
  return ALL_TEMPLATES.filter(template => template.type === type)
}

export const isAllowedTemplate = (templateId: string): boolean => {
  return ALLOWED_TEMPLATE_IDS.has(templateId)
}

// För att mappa OneFlow template till våra typer
export const getContractTypeFromTemplate = (templateId: string): 'contract' | 'offer' | null => {
  const template = getTemplateById(templateId)
  return template?.type || null
}

// Exportera för bakåtkompatibilitet (så befintlig kod inte bryts)
export const ONEFLOW_OFFER_TEMPLATES = OFFER_TEMPLATES
export const ONEFLOW_CONTRACT_TEMPLATES = CONTRACT_TEMPLATES