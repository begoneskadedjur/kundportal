// api/constants/oneflowTemplates.js - OneFlow mall-konfiguration för API

// Offert-mallar som vi använder
const OFFER_TEMPLATES = [
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
const CONTRACT_TEMPLATES = [
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
const ALL_TEMPLATES = [
  ...OFFER_TEMPLATES,
  ...CONTRACT_TEMPLATES
]

// Set med alla mall-ID:n för snabb uppslagning
const ALLOWED_TEMPLATE_IDS = new Set(
  ALL_TEMPLATES.map(template => template.id)
)

// Hjälpfunktioner
const getTemplateById = (id) => {
  return ALL_TEMPLATES.find(template => template.id === id)
}

const getTemplatesByType = (type) => {
  return ALL_TEMPLATES.filter(template => template.type === type)
}

const isAllowedTemplate = (templateId) => {
  return ALLOWED_TEMPLATE_IDS.has(templateId)
}

// För att mappa OneFlow template till våra typer
const getContractTypeFromTemplate = (templateId) => {
  const template = getTemplateById(templateId)
  return template?.type || null
}

module.exports = {
  OFFER_TEMPLATES,
  CONTRACT_TEMPLATES,
  ALL_TEMPLATES,
  ALLOWED_TEMPLATE_IDS,
  getTemplateById,
  getTemplatesByType,
  isAllowedTemplate,
  getContractTypeFromTemplate
}