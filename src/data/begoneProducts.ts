// src/data/begoneProducts.ts - BeGone produktkatalog

import { ProductGroup, ProductItem, ProductConfig } from '../types/products'

// Konfiguration för prissystem
export const PRODUCT_CONFIG: ProductConfig = {
  defaultCurrency: 'SEK',
  vatRate: 0.25,
  rotMaxAmount: 50000,
  rutMaxAmount: 75000, 
  rotRate: 0.30,
  rutRate: 0.50,
  enableQuantityDiscounts: true,
  enableSeasonalPricing: true
}

// 🐭 SKADEDJURSBEKÄMPNING
const pestControlProducts: ProductItem[] = [
  {
    id: 'pc-rats-mice',
    name: 'Rått- och musbekämpning',
    description: 'Professionell bekämpning av råttor och möss med betesstationer och fällor',
    category: 'pest_control',
    pricing: {
      company: {
        basePrice: 2400,
        vatRate: 0.25
      },
      individual: {
        basePrice: 3000,
        taxDeduction: 'rot'
      }
    },
    quantityType: 'quantity',
    oneflowCompatible: true,
    defaultQuantity: 1,
    maxQuantity: 10,
    isPopular: true,
    rotEligible: true,
    rutEligible: false,
    contractDescription: 'Regelbunden kontroll och bekämpning av råttor och möss. Inkluderar utplacering av betesstationer, regelbundna inspektioner och påfyllning av bete vid behov.'
  },
  {
    id: 'pc-cockroaches',
    name: 'Kackerlaekbekämpning',
    description: 'Effektiv bekämpning av kackerlackor med gel och spray',
    category: 'pest_control', 
    pricing: {
      company: {
        basePrice: 3200,
        vatRate: 0.25
      },
      individual: {
        basePrice: 4000,
        taxDeduction: 'rot'
      }
    },
    quantityType: 'quantity',
    oneflowCompatible: true,
    defaultQuantity: 1,
    rotEligible: true,
    rutEligible: false,
    contractDescription: 'Professionell bekämpning av kackerlackor med insektsgel och spray. Inkluderar identifiering av smittkällor och uppföljande behandlingar.'
  },
  {
    id: 'pc-ants',
    name: 'Myrorbekämpning',
    description: 'Bekämpning av myrproblem inomhus och utomhus',
    category: 'pest_control',
    pricing: {
      company: {
        basePrice: 1800,
        vatRate: 0.25
      },
      individual: {
        basePrice: 2250,
        taxDeduction: 'rot' 
      }
    },
    quantityType: 'quantity',
    oneflowCompatible: true,
    defaultQuantity: 1,
    rotEligible: true,
    rutEligible: false,
    contractDescription: 'Bekämpning av myror med specialbehandling av bo och vandringsleder. Inkluderar både inomhus- och utomhusbehandling vid behov.'
  },
  {
    id: 'pc-wasps',
    name: 'Getingbekämpning', 
    description: 'Säker borttagning av getingbon',
    category: 'pest_control',
    pricing: {
      company: {
        basePrice: 2200,
        vatRate: 0.25
      },
      individual: {
        basePrice: 2750,
        taxDeduction: 'rot'
      }
    },
    quantityType: 'quantity',
    oneflowCompatible: true,
    defaultQuantity: 1,
    seasonalAvailable: true, // Främst sommarsäsong
    rotEligible: true,
    rutEligible: false,
    contractDescription: 'Professionell och säker borttagning av getingbon. Inkluderar lokalisering, säker borttagning och förebyggande åtgärder.'
  }
]

// 🛡️ PREVENTIVA LÖSNINGAR
const preventiveProducts: ProductItem[] = [
  {
    id: 'prev-bait-stations',
    name: 'Betesstationer - Underhåll',
    description: 'Regelbundet underhåll av befintliga betesstationer',
    category: 'preventive',
    pricing: {
      company: {
        basePrice: 800,
        vatRate: 0.25
      },
      individual: {
        basePrice: 1000,
        taxDeduction: 'rot'
      }
    },
    quantityType: 'quantity',
    oneflowCompatible: true,
    defaultQuantity: 4, // Per år
    maxQuantity: 12,
    isPopular: true,
    rotEligible: true,
    rutEligible: false,
    contractDescription: 'Regelbundet underhåll av betesstationer inkl. kontroll, påfyllning av bete och dokumentation av aktivitet.'
  },
  {
    id: 'prev-new-stations',
    name: 'Nya betesstationer - Installation',
    description: 'Installation av nya betesstationer',
    category: 'preventive',
    pricing: {
      company: {
        basePrice: 1600,
        vatRate: 0.25
      },
      individual: {
        basePrice: 2000,
        taxDeduction: 'rot'
      }
    },
    quantityType: 'quantity',
    oneflowCompatible: true,
    defaultQuantity: 1,
    rotEligible: true,
    rutEligible: false,
    contractDescription: 'Installation av nya betesstationer med strategisk placering och initial betning. Inkluderar kartläggning och dokumentation.'
  },
  {
    id: 'prev-mechanical-traps',
    name: 'Mekaniska fällor',
    description: 'Installation och underhåll av mekaniska fällor',
    category: 'preventive',
    pricing: {
      company: {
        basePrice: 1200,
        vatRate: 0.25
      },
      individual: {
        basePrice: 1500,
        taxDeduction: 'rot'
      }
    },
    quantityType: 'quantity',
    oneflowCompatible: true,
    defaultQuantity: 1,
    rotEligible: true,
    rutEligible: false,
    contractDescription: 'Installation och regelbundet underhåll av mekaniska fällor. Miljövänligt alternativ utan gift.'
  },
  {
    id: 'prev-monitoring-traps',
    name: 'Indikationsfällor',
    description: 'Övervakning med indikationsfällor för tidig upptäckt',
    category: 'preventive',
    pricing: {
      company: {
        basePrice: 600,
        vatRate: 0.25
      },
      individual: {
        basePrice: 750,
        taxDeduction: 'rot'
      }
    },
    quantityType: 'quantity',
    oneflowCompatible: true,
    defaultQuantity: 1,
    rotEligible: true,
    rutEligible: false,
    contractDescription: 'Övervakning med indikationsfällor för tidig upptäckt av skadedjur. Inkluderar regelbunden kontroll och rapportering.'
  }
]

// 🧹 SPECIALTJÄNSTER
const specialtyProducts: ProductItem[] = [
  {
    id: 'spec-disinfection',
    name: 'Desinfektion',
    description: 'Professionell desinfektion av utrymmen',
    category: 'specialty',
    pricing: {
      company: {
        basePrice: 2800,
        vatRate: 0.25
      },
      individual: {
        basePrice: 3500,
        taxDeduction: 'rut' // RUT för städning/desinfektion
      }
    },
    quantityType: 'quantity',
    oneflowCompatible: true,
    defaultQuantity: 1,
    rotEligible: false,
    rutEligible: true,
    requiresConsultation: true,
    contractDescription: 'Professionell desinfektion av utrymmen med godkända medel. Effektivt mot bakterier, virus och svamp.'
  },
  {
    id: 'spec-sanitation',
    name: 'Sanering efter skadedjur',
    description: 'Grundlig sanering och rengöring efter skadedjursangrepp',
    category: 'specialty',
    pricing: {
      company: {
        basePrice: 3600,
        vatRate: 0.25
      },
      individual: {
        basePrice: 4500,
        taxDeduction: 'rut'
      }
    },
    quantityType: 'quantity',
    oneflowCompatible: true,
    defaultQuantity: 1,
    rotEligible: false,
    rutEligible: true,
    requiresConsultation: true,
    contractDescription: 'Grundlig sanering efter skadedjursangrepp inkl. rengöring, desinfektion och borttagning av föroreningar.'
  },
  {
    id: 'spec-odor-removal',
    name: 'Luktborttagning',
    description: 'Behandling för borttagning av obehagliga lukter',
    category: 'specialty',
    pricing: {
      company: {
        basePrice: 2400,
        vatRate: 0.25
      },
      individual: {
        basePrice: 3000,
        taxDeduction: 'rut'
      }
    },
    quantityType: 'quantity',
    oneflowCompatible: true,
    defaultQuantity: 1,
    rotEligible: false,
    rutEligible: true,
    contractDescription: 'Professionell luktborttagning med ozonbehandling och specialprodukter för neutralisering av obehagliga lukter.'
  }
]

// 📋 TILLVALSTJÄNSTER
const additionalProducts: ProductItem[] = [
  {
    id: 'add-detailed-report',
    name: 'Detaljerad rapport',
    description: 'Omfattande rapport med foton och rekommendationer',
    category: 'additional',
    pricing: {
      company: {
        basePrice: 400,
        vatRate: 0.25
      },
      individual: {
        basePrice: 500
      }
    },
    quantityType: 'single_choice',
    oneflowCompatible: true,
    defaultQuantity: 1,
    rotEligible: false,
    rutEligible: false,
    contractDescription: 'Detaljerad rapport med fotografisk dokumentation, analys och rekommendationer för fortsatta åtgärder.'
  },
  {
    id: 'add-emergency-service',
    name: 'Jour-/akuttjänst',
    description: 'Tillgång till jourservice utanför ordinarie arbetstid',
    category: 'additional',
    pricing: {
      company: {
        basePrice: 800,
        vatRate: 0.25,
        discountPercent: 10 // Rabatt för företag
      },
      individual: {
        basePrice: 1200
      }
    },
    quantityType: 'single_choice',
    oneflowCompatible: true,
    defaultQuantity: 1,
    rotEligible: false,
    rutEligible: false,
    contractDescription: 'Tillgång till jourservice för akuta situationer utanför ordinarie arbetstid. Garanterad responstid inom 4 timmar.'
  },
  {
    id: 'add-follow-up',
    name: 'Uppföljningsbesök',
    description: 'Extra uppföljningsbesök för kvalitetskontroll',
    category: 'additional',
    pricing: {
      company: {
        basePrice: 600,
        vatRate: 0.25
      },
      individual: {
        basePrice: 750,
        taxDeduction: 'rot'
      }
    },
    quantityType: 'quantity',
    oneflowCompatible: true,
    defaultQuantity: 1,
    maxQuantity: 5,
    rotEligible: true,
    rutEligible: false,
    contractDescription: 'Extra uppföljningsbesök för att säkerställa att behandlingen varit effektiv och att inga nya problem uppstått.'
  },
  {
    id: 'add-consultation',
    name: 'Konsulttjänst',
    description: 'Expertbedömning och råd för komplexa fall',
    category: 'additional',
    pricing: {
      company: {
        basePrice: 1200,
        vatRate: 0.25
      },
      individual: {
        basePrice: 1500
      }
    },
    quantityType: 'quantity', 
    oneflowCompatible: true,
    defaultQuantity: 1,
    rotEligible: false,
    rutEligible: false,
    requiresConsultation: true,
    contractDescription: 'Expertbedömning och specialistrådgivning för komplexa skadedjursproblem. Inkluderar analys och anpassad åtgärdsplan.'
  }
]

// Organisera produkter i grupper
export const BEGONE_PRODUCT_GROUPS: ProductGroup[] = [
  {
    id: 'pest-control-group',
    name: 'Skadedjursbekämpning',
    description: 'Aktiv bekämpning av skadedjur',
    category: 'pest_control',
    icon: '🐭',
    products: pestControlProducts,
    displayOrder: 1
  },
  {
    id: 'preventive-group', 
    name: 'Preventiva lösningar',
    description: 'Förebyggande åtgärder och kontinuerlig övervakning',
    category: 'preventive',
    icon: '🛡️',
    products: preventiveProducts,
    displayOrder: 2
  },
  {
    id: 'specialty-group',
    name: 'Specialtjänster',
    description: 'Sanering, desinfektion och specialbehandlingar',
    category: 'specialty', 
    icon: '🧹',
    products: specialtyProducts,
    displayOrder: 3
  },
  {
    id: 'additional-group',
    name: 'Tillvalstjänster',
    description: 'Extra tjänster och support',
    category: 'additional',
    icon: '📋',
    products: additionalProducts,
    displayOrder: 4
  }
]

// Hjälpfunktioner för produktsökning
export const getAllProducts = (): ProductItem[] => {
  return BEGONE_PRODUCT_GROUPS.flatMap(group => group.products)
}

export const getProductById = (id: string): ProductItem | undefined => {
  return getAllProducts().find(product => product.id === id)
}

export const getProductsByCategory = (category: ProductCategory): ProductItem[] => {
  return getAllProducts().filter(product => product.category === category)
}

export const getPopularProducts = (): ProductItem[] => {
  return getAllProducts().filter(product => product.isPopular)
}

export const getROTEligibleProducts = (): ProductItem[] => {
  return getAllProducts().filter(product => product.rotEligible)
}

export const getRUTEligibleProducts = (): ProductItem[] => {
  return getAllProducts().filter(product => product.rutEligible)
}