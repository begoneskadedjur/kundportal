// src/components/admin/ProductManagement.tsx - Admin produkthantering

import React, { useState, useMemo, useEffect } from 'react'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  ShieldCheck, 
  Leaf,
  ChevronUp,
  ChevronDown, 
  Star,
  Save,
  X,
  Package,
  DollarSign,
  Info,
  ArrowLeft,
  Copy,
  Minus,
  Files
} from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import { 
  ProductItem, 
  ProductGroup, 
  ProductCategory, 
  CustomerType,
  PriceVariant 
} from '../../types/products'
import { formatPrice } from '../../utils/pricingCalculator'
import { useProducts } from '../../services/productService'
import toast from 'react-hot-toast'

interface ProductManagementProps {
  className?: string
}

interface ProductFormData {
  id?: string
  name: string
  description: string
  category: ProductCategory
  pricing: {
    company: {
      basePrice: number
      vatRate: number
      discountPercent?: number
    }
    individual: {
      basePrice: number
      taxDeduction?: 'rot' | 'rut'
      discountPercent?: number
    }
  }
  priceVariants: PriceVariant[]  // Prisvarianter
  quantityType: 'quantity' | 'single_choice' | 'multiple_choice'
  oneflowCompatible: boolean
  defaultQuantity: number
  maxQuantity: number
  isPopular: boolean
  rotEligible: boolean
  rutEligible: boolean
  contractDescription: string
  seasonalAvailable?: boolean
  requiresConsultation?: boolean
}

// Utility-funktioner för variant-hantering
const normalizeVariantSortOrder = (variants: PriceVariant[]): PriceVariant[] => {
  // Bevara arrayens ordning och uppdatera bara sortOrder-värdena
  return variants.map((variant, index) => ({
    ...variant,
    sortOrder: index
  }))
}

const moveVariantUp = (variants: PriceVariant[], variantId: string): PriceVariant[] => {
  try {
    console.log('🔧 moveVariantUp called with variantId:', variantId)
    if (!variants.length || !variantId) {
      console.log('❌ Early return: empty variants or no variantId')
      return variants
    }
    
    const currentIndex = variants.findIndex(v => v.id === variantId)
    console.log('🔧 Found variant at currentIndex:', currentIndex)
    
    // Validering
    if (currentIndex <= 0) {
      console.log('❌ Cannot move up: currentIndex <= 0')
      return variants
    }
    
    console.log('✅ Moving variant from index', currentIndex, 'to index', currentIndex - 1)
    
    // Byt plats med föregående
    const newVariants = [...variants]
    const temp = newVariants[currentIndex]
    newVariants[currentIndex] = newVariants[currentIndex - 1]
    newVariants[currentIndex - 1] = temp
    
    console.log('🔧 After swapping:', newVariants.map((v, i) => `${i}: ${v.name}`))
    
    // Normalisera sortOrder baserat på ny position
    const finalVariants = normalizeVariantSortOrder(newVariants)
    console.log('🔧 Final normalized:', finalVariants.map((v, i) => `${i}: ${v.name} (sortOrder: ${v.sortOrder})`))
    return finalVariants
  } catch (error) {
    console.error('Error moving variant up:', error)
    return variants
  }
}

const moveVariantDown = (variants: PriceVariant[], variantId: string): PriceVariant[] => {
  try {
    if (!variants.length || !variantId) return variants
    
    const currentIndex = variants.findIndex(v => v.id === variantId)
    
    // Validering
    if (currentIndex < 0 || currentIndex >= variants.length - 1) return variants
    
    // Byt plats med nästa
    const newVariants = [...variants]
    const temp = newVariants[currentIndex]
    newVariants[currentIndex] = newVariants[currentIndex + 1]
    newVariants[currentIndex + 1] = temp
    
    // Normalisera sortOrder baserat på ny position
    return normalizeVariantSortOrder(newVariants)
  } catch (error) {
    console.error('Error moving variant down:', error)
    return variants
  }
}

// Kategori-ikon mapping
const getCategoryIcon = (category: ProductCategory): string => {
  switch (category) {
    case 'pest_control': return '🐭'
    case 'preventive': return '🛡️'
    case 'specialty': return '🧹'
    case 'additional': return '📋'
    default: return '•'
  }
}

// Kategori-namn mapping
const getCategoryName = (category: ProductCategory): string => {
  switch (category) {
    case 'pest_control': return 'Skadedjursbekämpning'
    case 'preventive': return 'Förebyggande'
    case 'specialty': return 'Specialtjänster'
    case 'additional': return 'Tilläggstjänster'
    default: return category
  }
}

// Sektionsbaserad layout-komponent
interface ProductSectionLayoutProps {
  products: ProductItem[]
  onEdit: (product: ProductItem) => void
  onDuplicate: (product: ProductItem) => void
  onDelete: (productId: string) => void
  isLoading: boolean
}

const ProductSectionLayout: React.FC<ProductSectionLayoutProps> = ({
  products,
  onEdit,
  onDuplicate,
  onDelete,
  isLoading
}) => {
  const [collapsedSections, setCollapsedSections] = React.useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set())
  
  // Konstanter för performance
  const INITIAL_PRODUCTS_PER_CATEGORY = 6
  const POPULAR_PRODUCTS_LIMIT = 4

  // Gruppera produkter efter kategori och popularitet
  const organizedProducts = React.useMemo(() => {
    const popularProducts = products.filter(p => p.isPopular).slice(0, POPULAR_PRODUCTS_LIMIT)
    const categorizedProducts = products.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = []
      }
      // Lägg inte till populära produkter i kategorierna igen
      if (!product.isPopular) {
        acc[product.category].push(product)
      }
      return acc
    }, {} as Record<ProductCategory, ProductItem[]>)

    return {
      popular: popularProducts,
      categorized: categorizedProducts
    }
  }, [products])

  const toggleSection = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections)
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId)
    } else {
      newCollapsed.add(sectionId)
    }
    setCollapsedSections(newCollapsed)
  }

  const toggleExpandSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const getSectionTitle = (category: ProductCategory): string => {
    switch (category) {
      case 'pest_control': return 'Skadedjursbekämpning'
      case 'preventive': return 'Förebyggande lösningar'
      case 'specialty': return 'Specialtjänster'
      case 'additional': return 'Tilläggstjänster'
      default: return 'Övriga produkter'
    }
  }

  const getSectionDescription = (category: ProductCategory): string => {
    switch (category) {
      case 'pest_control': return 'Aktiv bekämpning av skadedjur och ohyra'
      case 'preventive': return 'Förebyggande åtgärder och kontinuerlig övervakning'
      case 'specialty': return 'Sanering, desinfektion och specialbehandlingar'
      case 'additional': return 'Tillvalstjänster och konsultationer'
      default: return 'Andra produkter och tjänster'
    }
  }

  return (
    <div className="space-y-8">
      {/* Populära produkter sektion */}
      {organizedProducts.popular.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-400 fill-current" />
              <h2 className="text-2xl font-bold text-white">Populära tjänster</h2>
              <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full text-sm font-medium">
                {organizedProducts.popular.length}
              </span>
            </div>
          </div>
          <p className="text-slate-400 mb-6">Mest använda produkter och tjänster</p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {organizedProducts.popular.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                size="large"
                onEdit={() => onEdit(product)}
                onDuplicate={() => onDuplicate(product)}
                onDelete={() => onDelete(product.id)}
                isLoading={isLoading}
              />
            ))}
          </div>
        </div>
      )}

      {/* Kategorisektioner */}
      {Object.entries(organizedProducts.categorized)
        .filter(([_, products]) => products.length > 0)
        .sort(([a], [b]) => {
          // Sortera kategorier enligt prioritet
          const priority = { pest_control: 1, preventive: 2, specialty: 3, additional: 4 }
          return (priority[a as ProductCategory] || 99) - (priority[b as ProductCategory] || 99)
        })
        .map(([category, categoryProducts]) => {
          const isCollapsed = collapsedSections.has(category)
          const productCategory = category as ProductCategory
          
          return (
            <div key={category}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getCategoryIcon(productCategory)}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-white">
                        {getSectionTitle(productCategory)}
                      </h2>
                      <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded-full text-sm font-medium">
                        {categoryProducts.length}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mt-1">
                      {getSectionDescription(productCategory)}
                    </p>
                  </div>
                </div>
                
                {/* Kollaps/expandera knapp */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSection(category)}
                  className="text-slate-400 hover:text-white"
                >
                  {isCollapsed ? (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Visa
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      Dölj
                    </>
                  )}
                </Button>
              </div>

              {/* Produkter i kategorin */}
              {!isCollapsed && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {categoryProducts
                      .slice(0, expandedSections.has(category) ? undefined : INITIAL_PRODUCTS_PER_CATEGORY)
                      .map((product, index) => {
                        // Första 3 produkterna är normala, resten kompakta för att spara plats
                        const size = index < 3 ? 'normal' : 'compact'
                        
                        return (
                          <ProductCard
                            key={product.id}
                            product={product}
                            size={size}
                            onEdit={() => onEdit(product)}
                            onDuplicate={() => onDuplicate(product)}
                            onDelete={() => onDelete(product.id)}
                            isLoading={isLoading}
                          />
                        )
                      })}
                  </div>
                  
                  {/* Visa fler knapp */}
                  {categoryProducts.length > INITIAL_PRODUCTS_PER_CATEGORY && (
                    <div className="text-center mt-6">
                      <Button
                        variant="outline"
                        onClick={() => toggleExpandSection(category)}
                        className="text-slate-400 hover:text-white border-slate-600 hover:border-slate-500"
                      >
                        {expandedSections.has(category) ? (
                          <>
                            Visa färre produkter
                            <ChevronUp className="w-4 h-4 ml-1" />
                          </>
                        ) : (
                          <>
                            Visa {categoryProducts.length - INITIAL_PRODUCTS_PER_CATEGORY} produkter till
                            <ChevronDown className="w-4 h-4 ml-1" />
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* Visa fler knapp för kollapsade sektioner */}
              {isCollapsed && (
                <div className="text-center">
                  <Button
                    variant="outline"
                    onClick={() => toggleSection(category)}
                    className="text-slate-400 hover:text-white border-slate-600"
                  >
                    Visa {categoryProducts.length} produkter
                  </Button>
                </div>
              )}
            </div>
          )
        })}
    </div>
  )
}

export default function ProductManagement({ className = '' }: ProductManagementProps) {
  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Använd produkthook för databas-integration
  const { 
    products, 
    loading: isLoading, 
    error,
    createProduct, 
    updateProduct, 
    deleteProduct 
  } = useProducts()

  // Förbättrade filtrerade produkter med memoization och smart sökning
  const filteredProducts = useMemo(() => {
    if (!products.length) return []
    
    return products.filter(product => {
      // Smart sökning med stöd för egenskaper
      const matchesSearch = !debouncedSearchTerm || 
        product.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        product.contractDescription?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        // Sök efter egenskaper
        (debouncedSearchTerm.toLowerCase().includes('rot') && product.rotEligible) ||
        (debouncedSearchTerm.toLowerCase().includes('rut') && product.rutEligible) ||
        (debouncedSearchTerm.toLowerCase().includes('populär') && product.isPopular) ||
        (debouncedSearchTerm.toLowerCase().includes('konsult') && product.requiresConsultation) ||
        (debouncedSearchTerm.toLowerCase().includes('oneflow') && !product.oneflowCompatible) ||
        // Sök i kategorier
        getCategoryName(product.category).toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
      
      return matchesSearch && matchesCategory
    })
  }, [products, debouncedSearchTerm, selectedCategory])

  // Kategori-räknare
  const categoryCounts = useMemo(() => {
    const counts = {
      all: products.length,
      pest_control: 0,
      preventive: 0,
      specialty: 0,
      additional: 0
    }
    
    products.forEach(product => {
      counts[product.category]++
    })
    
    return counts
  }, [products])

  // Hantera ny produkt
  const handleNewProduct = () => {
    setEditingProduct(null)
    setIsModalOpen(true)
  }

  // Hantera redigering
  const handleEditProduct = (product: ProductItem) => {
    setEditingProduct(product)
    setIsModalOpen(true)
  }

  // Hantera borttagning
  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna produkt?')) {
      return
    }

    try {
      await deleteProduct(productId)
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      // Felmeddelande hanteras redan i useProducts hook
    }
  }

  // Hantera duplicering
  const handleDuplicateProduct = (product: ProductItem) => {
    // Skapa duplicerade prisvarianter med nya ID:n
    const duplicatedVariants = product.priceVariants?.map(variant => ({
      ...variant,
      id: `variant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sortOrder: variant.sortOrder
    })) || []

    // Skapa duplicerad produkt UTAN ID så att den behandlas som ny
    const duplicatedProduct: ProductItem = {
      ...product,
      // Inget ID sätts så att handleSaveProduct skapar en ny produkt
      name: `${product.name} (Kopia)`,
      priceVariants: duplicatedVariants.length > 0 ? duplicatedVariants : undefined
    }

    // Ta bort ID från objektet för att säkerställa att det behandlas som ny
    delete (duplicatedProduct as any).id

    // Öppna modal för redigering av den duplicerade produkten
    setEditingProduct(duplicatedProduct)
    setIsModalOpen(true)
  }

  // Hantera spara produkt  
  const handleSaveProduct = async (productData: ProductFormData) => {
    try {
      const newProduct: ProductItem = {
        id: productData.id || `custom-${Date.now()}`,
        name: productData.name,
        description: productData.description,
        category: productData.category,
        pricing: productData.pricing,
        priceVariants: productData.priceVariants.length > 0 ? productData.priceVariants : undefined,
        quantityType: productData.quantityType,
        oneflowCompatible: productData.oneflowCompatible,
        defaultQuantity: productData.defaultQuantity,
        maxQuantity: productData.maxQuantity,
        isPopular: productData.isPopular,
        rotEligible: productData.rotEligible,
        rutEligible: productData.rutEligible,
        contractDescription: productData.contractDescription,
        seasonalAvailable: productData.seasonalAvailable,
        requiresConsultation: productData.requiresConsultation
      }

      if (productData.id) {
        // Uppdatera befintlig produkt
        await updateProduct(newProduct)
      } else {
        // Skapa ny produkt
        await createProduct(newProduct)
      }

      setIsModalOpen(false)
    } catch (error) {
      console.error('Fel vid sparande:', error)
      // Felmeddelande hanteras redan i useProducts hook
      throw error
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Tillbaka
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Package className="w-8 h-8 text-green-400" />
              Produkthantering
            </h1>
            <p className="text-slate-400 mt-1">
              Hantera produkter och tjänster för avtal och offerter
            </p>
          </div>
        </div>
        
        <Button
          variant="primary"
          onClick={handleNewProduct}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Ny produkt
        </Button>
      </div>

      {/* Felmeddelande */}
      {error && (
        <Card className="p-4 bg-red-500/10 border-red-500/20">
          <div className="text-red-400">
            <strong>Fel:</strong> {error}
          </div>
        </Card>
      )}

      {/* Förbättrad sök och filter */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* Smart sök med förslag */}
          <div className="relative">
            <Input
              placeholder="Sök produkter efter namn, beskrivning eller egenskaper..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="w-4 h-4" />}
              className="pr-20"
            />
            {(searchTerm !== debouncedSearchTerm) && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            {/* Sök-förslag */}
            {!searchTerm && (
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-xs text-slate-500">Försök med:</span>
                {['ROT', 'RUT', 'populär', 'bekämpning', 'konsult'].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => setSearchTerm(suggestion)}
                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Sökresultat info */}
          {debouncedSearchTerm && (
            <div className="flex items-center justify-between text-sm text-slate-400 bg-slate-800/30 rounded-lg px-3 py-2">
              <span>
                <Search className="w-4 h-4 inline mr-2" />
                Visar {filteredProducts.length} av {products.length} produkter
                {debouncedSearchTerm && (
                  <span> för "<span className="text-white font-medium">{debouncedSearchTerm}</span>"</span>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕ Rensa
              </Button>
            </div>
          )}
          
          {/* Quick filters */}
          {!debouncedSearchTerm && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span>Snabbfilter:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('populär')}
                  className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 border border-yellow-500/20"
                >
                  <Star className="w-3 h-3 mr-1" />
                  Populära
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('ROT')}
                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-blue-500/20"
                >
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  ROT-berättigade
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('RUT')}
                  className="text-green-400 hover:text-green-300 hover:bg-green-500/10 border border-green-500/20"
                >
                  <Leaf className="w-3 h-3 mr-1" />
                  RUT-berättigade
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('konsult')}
                  className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 border border-purple-500/20"
                >
                  <Info className="w-3 h-3 mr-1" />
                  Kräver konsultation
                </Button>
              </div>
            </div>
          )}
          
          {/* Kategorier */}
          <div className="border-t border-slate-700 pt-4">
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
              <span>Kategorier:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
                className="relative"
              >
                Alla kategorier 
                <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                  selectedCategory === 'all' 
                    ? 'bg-white/20 text-white' 
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {categoryCounts.all}
                </span>
              </Button>
              {['pest_control', 'preventive', 'specialty', 'additional'].map(category => {
                const count = categoryCounts[category as keyof typeof categoryCounts]
                return (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category as ProductCategory)}
                    className="flex items-center gap-2 relative"
                    disabled={count === 0}
                  >
                    <span>{getCategoryIcon(category as ProductCategory)}</span>
                    {getCategoryName(category as ProductCategory)}
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      selectedCategory === category 
                        ? 'bg-white/20 text-white' 
                        : count === 0 
                          ? 'bg-slate-800 text-slate-500'
                          : 'bg-slate-700 text-slate-300'
                    }`}>
                      {count}
                    </span>
                  </Button>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Produktlista med sektionsbaserad layout */}
      {isLoading ? (
        <div className="space-y-8">
          {/* Loading för populära produkter */}
          <div>
            <div className="h-6 bg-slate-700 rounded w-48 mb-4 animate-pulse"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(2)].map((_, i) => (
                <Card key={i} className="p-6 animate-pulse col-span-1">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-700 rounded"></div>
                      <div className="h-5 bg-slate-700 rounded w-32"></div>
                    </div>
                    <div className="h-4 bg-slate-700 rounded w-full"></div>
                    <div className="h-4 bg-slate-700 rounded w-3/4"></div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
          
          {/* Loading för andra kategorier */}
          {[...Array(3)].map((_, catIndex) => (
            <div key={catIndex}>
              <div className="h-6 bg-slate-700 rounded w-40 mb-4 animate-pulse"></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="p-4 animate-pulse">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-slate-700 rounded"></div>
                        <div className="h-4 bg-slate-700 rounded w-24"></div>
                      </div>
                      <div className="h-3 bg-slate-700 rounded w-full"></div>
                      <div className="h-4 bg-slate-700 rounded w-20"></div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ProductSectionLayout
          products={filteredProducts}
          onEdit={handleEditProduct}
          onDuplicate={handleDuplicateProduct}
          onDelete={handleDeleteProduct}
          isLoading={isLoading}
        />
      )}

      {/* Ingen träff */}
      {filteredProducts.length === 0 && (
        <Card className="p-12 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Inga produkter hittades
          </h3>
          <p className="text-slate-400">
            Försök med andra sökord eller skapa en ny produkt
          </p>
        </Card>
      )}

      {/* Modal för redigering */}
      {isModalOpen && (
        <ProductModal
          product={editingProduct}
          onSave={handleSaveProduct}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  )
}

// Produktkort komponent med kompakt/expanderad design
interface ProductCardProps {
  product: ProductItem
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  isLoading: boolean
  size?: 'compact' | 'normal' | 'large'
}

const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onEdit, 
  onDelete, 
  onDuplicate,
  isLoading,
  size = 'normal'
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false)
  
  // Bestäm kortstorlek och layout
  const getCardSize = () => {
    if (size === 'large') return 'col-span-2' // Dubbel bredd för populära
    if (size === 'compact') return 'h-32' // Kompakt höjd för mindre viktiga
    return '' // Normal storlek
  }

  // Enkel prisvisning för kompakt vy
  const getSimplePrice = () => {
    if (product.priceVariants && product.priceVariants.length > 0) {
      const minPrice = Math.min(...product.priceVariants.map(v => v.pricing.company.basePrice))
      return `Från ${formatPrice(minPrice)}`
    }
    return formatPrice(product.pricing.company.basePrice)
  }

  // Kompakt vy (standard)
  const renderCompactView = () => (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center flex-shrink-0">
              <span className="text-sm">{getCategoryIcon(product.category)}</span>
            </div>
            <h3 className="font-semibold text-white truncate group-hover:text-green-400 transition-colors">
              {product.name}
            </h3>
            {product.isPopular && (
              <Star className="w-4 h-4 text-yellow-400 fill-current flex-shrink-0" />
            )}
          </div>
          
          {size !== 'compact' && (
            <p className="text-sm text-slate-400 line-clamp-1 mb-2">
              {product.description}
            </p>
          )}
          
          {/* Kompakt prisinformation */}
          <div className="flex items-center justify-between">
            <span className="text-white font-medium">{getSimplePrice()}</span>
            <div className="flex items-center gap-1">
              {product.rotEligible && <span className="text-blue-400 text-xs">ROT</span>}
              {product.rotEligible && product.rutEligible && <span className="text-slate-600">•</span>}
              {product.rutEligible && <span className="text-green-400 text-xs">RUT</span>}
              {product.priceVariants && product.priceVariants.length > 0 && (
                <span className="text-blue-400 text-xs ml-2">{product.priceVariants.length}×</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Snabb-åtgärder för kompakt vy */}
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          disabled={isLoading}
          className="flex-1 text-xs py-1.5 hover:bg-green-500/10 hover:text-green-400"
        >
          <Edit2 className="w-3 h-3 mr-1" />
          Redigera
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDuplicate}
          disabled={isLoading}
          className="px-2 text-blue-400 hover:bg-blue-500/10"
          title="Duplicera"
        >
          <Files className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isLoading}
          className="px-2 text-red-400 hover:bg-red-500/10"
          title="Ta bort"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )

  // Expanderad detaljvy
  const renderExpandedView = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
              <span className="text-lg">{getCategoryIcon(product.category)}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white group-hover:text-green-400 transition-colors">
                  {product.name}
                </h3>
                {product.isPopular && (
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                )}
              </div>
              <p className="text-xs text-slate-500 capitalize">
                {getCategoryName(product.category)}
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            {product.description}
          </p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        {product.rotEligible && (
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            ROT-berättigad
          </span>
        )}
        {product.rutEligible && (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
            <Leaf className="w-3 h-3" />
            RUT-berättigad
          </span>
        )}
        {product.requiresConsultation && (
          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full flex items-center gap-1">
            <Info className="w-3 h-3" />
            Konsultation
          </span>
        )}
        {!product.oneflowCompatible && (
          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
            Ej Oneflow
          </span>
        )}
        {product.priceVariants && product.priceVariants.length > 0 && (
          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1">
            <Copy className="w-3 h-3" />
            {product.priceVariants.length} varianter
          </span>
        )}
      </div>

      {/* Detaljerad prisinformation */}
      <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
        {product.priceVariants && product.priceVariants.length > 0 ? (
          <>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Copy className="w-3 h-3" />
                Prisalternativ ({product.priceVariants.length} st)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Företag:</span>
              <div className="text-right">
                <span className="text-white font-semibold">
                  {formatPrice(Math.min(...product.priceVariants.map(v => v.pricing.company.basePrice)))} - {formatPrice(Math.max(...product.priceVariants.map(v => v.pricing.company.basePrice)))}
                </span>
                <span className="text-xs text-slate-400 block">+ moms</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Privatperson:</span>
              <div className="text-right">
                <span className="text-white font-semibold">
                  {formatPrice(Math.min(...product.priceVariants.map(v => v.pricing.individual.basePrice)))} - {formatPrice(Math.max(...product.priceVariants.map(v => v.pricing.individual.basePrice)))}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Företag:</span>
              <div className="text-right">
                <span className="text-white font-semibold">
                  {formatPrice(product.pricing.company.basePrice)}
                </span>
                <span className="text-xs text-slate-400 block">+ moms</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Privatperson:</span>
              <div className="text-right">
                <span className="text-white font-semibold">
                  {formatPrice(product.pricing.individual.basePrice)}
                </span>
                {product.pricing.individual.taxDeduction && (
                  <span className="text-xs text-green-400 block uppercase">
                    {product.pricing.individual.taxDeduction}-avdrag
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Åtgärder */}
      <div className="flex gap-3 pt-2 border-t border-slate-700/50">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 hover:border-green-500/50 hover:text-green-400 transition-all duration-200 group/edit"
        >
          <Edit2 className="w-4 h-4 group-hover/edit:scale-110 transition-transform duration-200" />
          Redigera
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDuplicate}
          disabled={isLoading}
          className="px-3 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-all duration-200 group/duplicate"
          title="Duplicera produkt"
        >
          <Files className="w-4 h-4 group-hover/duplicate:scale-110 transition-transform duration-200" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isLoading}
          className="px-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200 group/delete"
          title="Ta bort produkt"
        >
          <Trash2 className="w-4 h-4 group-hover/delete:scale-110 transition-transform duration-200" />
        </Button>
      </div>
    </div>
  )

  // Bestäm vilken vy som ska visas
  const shouldShowExpanded = isExpanded || size === 'large'

  return (
    <Card 
      className={`p-4 hover:border-slate-600 hover:shadow-lg hover:shadow-slate-900/20 transition-all duration-200 cursor-pointer group ${getCardSize()} ${
        size === 'large' ? 'bg-gradient-to-br from-green-500/5 to-blue-500/5 border-green-500/20' : ''
      } ${
        size === 'compact' ? 'p-3' : ''
      }`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {shouldShowExpanded ? renderExpandedView() : renderCompactView()}
      
      {/* Expandera/komprimera indikator */}
      {size === 'normal' && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-50 transition-opacity duration-200">
          <div className="text-slate-400 text-xs">
            {isExpanded ? '−' : '+'}
          </div>
        </div>
      )}
    </Card>
  )
}

// Modal för produktredigering
interface ProductModalProps {
  product: ProductItem | null
  onSave: (product: ProductFormData) => void
  onClose: () => void
}

const ProductModal: React.FC<ProductModalProps> = ({ product, onSave, onClose }) => {
  const [sortingVariantId, setSortingVariantId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ProductFormData>(() => {
    if (product) {
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        pricing: {
          company: {
            basePrice: product.pricing.company.basePrice,
            vatRate: product.pricing.company.vatRate || 0.25,
            discountPercent: product.pricing.company.discountPercent || 0
          },
          individual: {
            basePrice: product.pricing.individual.basePrice,
            taxDeduction: product.pricing.individual.taxDeduction,
            discountPercent: product.pricing.individual.discountPercent || 0
          }
        },
        priceVariants: normalizeVariantSortOrder((product.priceVariants || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))),
        quantityType: product.quantityType,
        oneflowCompatible: product.oneflowCompatible,
        defaultQuantity: product.defaultQuantity,
        maxQuantity: product.maxQuantity || 999,
        isPopular: product.isPopular,
        rotEligible: product.rotEligible,
        rutEligible: product.rutEligible,
        contractDescription: product.contractDescription,
        seasonalAvailable: product.seasonalAvailable || false,
        requiresConsultation: product.requiresConsultation || false
      }
    } else {
      return {
        name: '',
        description: '',
        category: 'additional',
        pricing: {
          company: {
            basePrice: 0,
            vatRate: 0.25,
            discountPercent: 0
          },
          individual: {
            basePrice: 0,
            discountPercent: 0
          }
        },
        priceVariants: [],
        quantityType: 'quantity',
        oneflowCompatible: true,
        defaultQuantity: 1,
        maxQuantity: 999,
        isPopular: false,
        rotEligible: false,
        rutEligible: false,
        contractDescription: '',
        seasonalAvailable: false,
        requiresConsultation: false
      }
    }
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.description || formData.pricing.company.basePrice <= 0) {
      toast.error('Fyll i alla obligatoriska fält')
      return
    }

    setIsSubmitting(true)
    try {
      await onSave(formData)
      toast.success(product ? 'Produkten uppdaterades' : 'Produkten skapades')
    } catch (error) {
      toast.error('Ett fel uppstod')
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateFormData = (path: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev }
      const keys = path.split('.')
      let current: any = newData
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]]
      }
      
      current[keys[keys.length - 1]] = value
      return newData
    })
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={product ? 'Redigera produkt' : 'Ny produkt'}
      className="max-w-6xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Grundinformation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-green-400" />
              Grundinformation
            </h3>
            
            <Input
              label="Produktnamn *"
              value={formData.name}
              onChange={(e) => updateFormData('name', e.target.value)}
              placeholder="T.ex. Rått- och musbekämpning"
              required
            />

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Beskrivning
              </label>
              <textarea
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                rows={3}
                value={formData.description}
                onChange={(e) => updateFormData('description', e.target.value)}
                placeholder="Detaljerad beskrivning av tjänsten (valfritt)..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Kategori *
              </label>
              <select
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                value={formData.category}
                onChange={(e) => updateFormData('category', e.target.value)}
                required
              >
                <option value="pest_control">🐭 Skadedjursbekämpning</option>
                <option value="preventive">🛡️ Förebyggande</option>
                <option value="specialty">🧹 Specialtjänster</option>
                <option value="additional">📋 Tilläggstjänster</option>
              </select>
            </div>

            <div className="border-t border-slate-700 pt-6">
              <h4 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-green-400" />
                Kontraktsbeskrivning
              </h4>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Beskrivning
              </label>
              <textarea
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                rows={4}
                value={formData.contractDescription}
                onChange={(e) => updateFormData('contractDescription', e.target.value)}
                placeholder="Beskrivning som visas i kontrakt (valfritt)..."
              />
            </div>
          </div>

          {/* Prissättning */}
          <div className="space-y-4 border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-400" />
              Prissättning
            </h3>

            {/* Företagspriser */}
            <div className="bg-slate-800/50 p-4 rounded-lg">
              <h4 className="font-medium text-white mb-3">Företagskunder</h4>
              <div className="space-y-3">
                <Input
                  label="Grundpris (exkl. moms) *"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.pricing.company.basePrice}
                  onChange={(e) => updateFormData('pricing.company.basePrice', Number(e.target.value))}
                  placeholder="2490"
                  helperText="Ange pris i hela kronor"
                  required
                />
                
                <Input
                  label="Rabatt (%)"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.pricing.company.discountPercent}
                  onChange={(e) => updateFormData('pricing.company.discountPercent', Number(e.target.value))}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Privatpriser */}
            <div className="bg-slate-800/50 p-4 rounded-lg">
              <h4 className="font-medium text-white mb-3">Privatpersoner</h4>
              <div className="space-y-3">
                <Input
                  label="Grundpris (inkl. moms) *"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.pricing.individual.basePrice}
                  onChange={(e) => updateFormData('pricing.individual.basePrice', Number(e.target.value))}
                  placeholder="3490"
                  helperText="Ange pris i hela kronor"
                  required
                />
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Skatteavdrag
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    value={formData.pricing.individual.taxDeduction || ''}
                    onChange={(e) => updateFormData('pricing.individual.taxDeduction', e.target.value || undefined)}
                  >
                    <option value="">Ingen</option>
                    <option value="rot">ROT-avdrag</option>
                    <option value="rut">RUT-avdrag</option>
                  </select>
                </div>

                <Input
                  label="Rabatt (%)"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.pricing.individual.discountPercent}
                  onChange={(e) => updateFormData('pricing.individual.discountPercent', Number(e.target.value))}
                  placeholder="0"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Prisvarianter - Full bredd för bättre användbarhet */}
        <div className="bg-slate-800/30 p-6 rounded-lg border border-slate-600/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <Copy className="w-5 h-5 text-green-400" />
              Prisvarianter
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const newVariant: PriceVariant = {
                  id: `variant-${Date.now()}`,
                  name: '',
                  description: '',
                  pricing: {
                    company: {
                      basePrice: 0,
                      vatRate: formData.pricing.company.vatRate,
                      discountPercent: 0
                    },
                    individual: {
                      basePrice: 0,
                      taxDeduction: formData.pricing.individual.taxDeduction,
                      discountPercent: 0
                    }
                  },
                  isDefault: formData.priceVariants.length === 0,
                  sortOrder: formData.priceVariants.length // Tillfällig sortOrder, kommer normaliseras
                }
                // Lägg till variant och normalisera sortOrder
                const newVariants = normalizeVariantSortOrder([...formData.priceVariants, newVariant])
                updateFormData('priceVariants', newVariants)
              }}
              className="flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Lägg till variant
            </Button>
          </div>
          
          <p className="text-sm text-slate-400 mb-6">
            Skapa olika prisalternativ för samma produkt (t.ex. olika storlekar, arbetstider, eller omfattning)
          </p>

          {formData.priceVariants.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Copy className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Inga prisvarianter ännu</p>
              <p className="text-sm">Klicka "Lägg till variant" för att skapa alternativ</p>
            </div>
          ) : (
            <div className="space-y-6">
              {formData.priceVariants.map((variant, sortedIndex) => {
                  // Varianter är redan sorterade från utility-funktionerna
                  const originalIndex = sortedIndex
                  return (
                <div key={`${variant.id}-${variant.sortOrder}`} className="bg-slate-700/30 p-6 rounded-xl border border-slate-600/40 hover:border-slate-500/60 transition-all duration-200">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-sm bg-slate-600/60 text-slate-200 px-3 py-1.5 rounded-lg font-medium">
                        Variant #{sortedIndex + 1}
                      </span>
                      {variant.isDefault && (
                        <span className="text-sm bg-green-500/20 text-green-400 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" />
                          Standard
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {/* Flytta upp/ned pilar */}
                      <div className="flex flex-col gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            console.log('🔼 Moving variant up:', variant.name, 'from index:', sortedIndex)
                            console.log('📊 Current variants before move:', formData.priceVariants.map((v, i) => `${i}: ${v.name} (sortOrder: ${v.sortOrder})`))
                            
                            setSortingVariantId(variant.id)
                            try {
                              const newVariants = moveVariantUp(formData.priceVariants, variant.id)
                              if (newVariants !== formData.priceVariants) {
                                console.log('✅ Variants after move:', newVariants.map((v, i) => `${i}: ${v.name} (sortOrder: ${v.sortOrder})`))
                                updateFormData('priceVariants', newVariants)
                              } else {
                                console.log('⚠️ No changes made to variants array')
                              }
                            } catch (error) {
                              console.error('Failed to move variant up:', error)
                              toast.error('Kunde inte flytta variant uppåt')
                            } finally {
                              // Ta bort loading efter kort tid för att visa visuell feedback
                              setTimeout(() => setSortingVariantId(null), 100)
                            }
                          }}
                          disabled={sortedIndex === 0 || sortingVariantId === variant.id}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2 py-1 rounded transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Flytta upp"
                        >
                          {sortingVariantId === variant.id ? (
                            <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <ChevronUp className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            console.log('🔽 Moving variant down:', variant.name, 'from index:', sortedIndex)
                            console.log('📊 Current variants before move:', formData.priceVariants.map((v, i) => `${i}: ${v.name} (sortOrder: ${v.sortOrder})`))
                            
                            setSortingVariantId(variant.id)
                            try {
                              const newVariants = moveVariantDown(formData.priceVariants, variant.id)
                              if (newVariants !== formData.priceVariants) {
                                console.log('✅ Variants after move:', newVariants.map((v, i) => `${i}: ${v.name} (sortOrder: ${v.sortOrder})`))
                                updateFormData('priceVariants', newVariants)
                              } else {
                                console.log('⚠️ No changes made to variants array')
                              }
                            } catch (error) {
                              console.error('Failed to move variant down:', error)
                              toast.error('Kunde inte flytta variant nedåt')
                            } finally {
                              // Ta bort loading efter kort tid för att visa visuell feedback
                              setTimeout(() => setSortingVariantId(null), 100)
                            }
                          }}
                          disabled={sortedIndex === formData.priceVariants.length - 1 || sortingVariantId === variant.id}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2 py-1 rounded transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Flytta ned"
                        >
                          {sortingVariantId === variant.id ? (
                            <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </Button>
                      </div>
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const variants = [...formData.priceVariants]
                          variants[originalIndex] = { ...variants[originalIndex], isDefault: !variants[originalIndex].isDefault }
                          // Ta bort default från andra
                          if (variants[originalIndex].isDefault) {
                            variants.forEach((v, i) => {
                              if (i !== originalIndex) v.isDefault = false
                            })
                          }
                          updateFormData('priceVariants', variants)
                        }}
                        className="text-green-400 hover:text-green-300 hover:bg-green-500/10 px-3 py-2 rounded-lg transition-all duration-200"
                        title={variant.isDefault ? "Ta bort som standard" : "Sätt som standard"}
                      >
                        <Star className={`w-4 h-4 ${variant.isDefault ? 'fill-current' : ''}`} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Ta bort variant och normalisera sortOrder
                          const filteredVariants = formData.priceVariants.filter((_, i) => i !== originalIndex)
                          const normalizedVariants = normalizeVariantSortOrder(filteredVariants)
                          updateFormData('priceVariants', normalizedVariants)
                        }}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 py-2 rounded-lg transition-all duration-200"
                        title="Ta bort variant"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Vänster kolumn: Variantinformation */}
                    <div className="space-y-6">
                      <div className="bg-slate-700/30 p-5 rounded-lg border border-slate-600/20">
                        <h5 className="text-base font-medium text-white mb-4 flex items-center gap-2">
                          <Info className="w-4 h-4 text-purple-400" />
                          Variantinformation
                        </h5>
                        <div className="space-y-4">
                          <Input
                            label="Variantnamn *"
                            value={variant.name}
                            onChange={(e) => {
                              const variants = [...formData.priceVariants]
                              variants[originalIndex] = { ...variants[originalIndex], name: e.target.value }
                              updateFormData('priceVariants', variants)
                            }}
                            placeholder="t.ex. 2 sovrum + vardagsrum"
                            helperText="Kort beskrivande namn för denna variant"
                            className="text-base"
                          />
                          <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                              Detaljerad beskrivning
                            </label>
                            <textarea
                              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-base leading-relaxed"
                              rows={3}
                              value={variant.description || ''}
                              onChange={(e) => {
                                const variants = [...formData.priceVariants]
                                variants[originalIndex] = { ...variants[originalIndex], description: e.target.value }
                                updateFormData('priceVariants', variants)
                              }}
                              placeholder="Detaljerad beskrivning av vad som ingår i denna variant..."
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              Beskriv vad som ingår och skiljer denna variant från andra
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Höger kolumn: Prissättning */}
                    <div className="space-y-6">
                      <div className="bg-slate-800/30 p-5 rounded-lg border border-slate-600/20">
                        <h5 className="text-base font-medium text-white mb-4 flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-blue-400" />
                          Prissättning för variant
                        </h5>
                        <div className="space-y-4">
                          <Input
                            label="Företagspris (exkl. moms) *"
                            type="number"
                            min="0"
                            step="1"
                            value={variant.pricing.company.basePrice}
                            onChange={(e) => {
                              const variants = [...formData.priceVariants]
                              variants[originalIndex] = {
                                ...variants[originalIndex],
                                pricing: {
                                  ...variants[originalIndex].pricing,
                                  company: {
                                    ...variants[originalIndex].pricing.company,
                                    basePrice: Number(e.target.value)
                                  }
                                }
                              }
                              updateFormData('priceVariants', variants)
                            }}
                            placeholder="2490"
                            helperText="Pris i hela kronor exklusive moms"
                            className="text-base"
                          />
                          <Input
                            label="Privatpris (inkl. moms) *"
                            type="number"
                            min="0"
                            step="1"
                            value={variant.pricing.individual.basePrice}
                            onChange={(e) => {
                              const variants = [...formData.priceVariants]
                              variants[originalIndex] = {
                                ...variants[originalIndex],
                                pricing: {
                                  ...variants[originalIndex].pricing,
                                  individual: {
                                    ...variants[originalIndex].pricing.individual,
                                    basePrice: Number(e.target.value)
                                  }
                                }
                              }
                              updateFormData('priceVariants', variants)
                            }}
                            placeholder="3490"
                            helperText="Pris i hela kronor inklusive moms"
                            className="text-base"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                  )
                })}
            </div>
          )}
        </div>

        {/* Konfiguration */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Kvantitet</h3>
            
            <div className="bg-slate-800/50 p-4 rounded-lg space-y-4">
              <h4 className="font-medium text-white">Kvantitetsinställningar</h4>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Kvantitetstyp
                </label>
                <select
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  value={formData.quantityType}
                  onChange={(e) => updateFormData('quantityType', e.target.value)}
                >
                  <option value="quantity">Kvantitet (kan ändras)</option>
                  <option value="single_choice">Ja/Nej val</option>
                  <option value="multiple_choice">Flera val</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Standardantal"
                  type="number"
                  min="1"
                  max="999"
                  value={formData.defaultQuantity}
                  onChange={(e) => updateFormData('defaultQuantity', Number(e.target.value))}
                />
                
                <Input
                  label="Max antal"
                  type="number"
                  min="1"
                  max="999"
                  value={formData.maxQuantity}
                  onChange={(e) => updateFormData('maxQuantity', Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
              Egenskaper
            </h3>
            
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.oneflowCompatible}
                  onChange={(e) => updateFormData('oneflowCompatible', e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                />
                <span className="text-white">Oneflow-kompatibel</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.isPopular}
                  onChange={(e) => updateFormData('isPopular', e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                />
                <span className="text-white">Populär produkt</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.rotEligible}
                  onChange={(e) => updateFormData('rotEligible', e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                />
                <span className="text-white">ROT-berättigad</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.rutEligible}
                  onChange={(e) => updateFormData('rutEligible', e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                />
                <span className="text-white">RUT-berättigad</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.seasonalAvailable}
                  onChange={(e) => updateFormData('seasonalAvailable', e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                />
                <span className="text-white">Säsongstillgänglig</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.requiresConsultation}
                  onChange={(e) => updateFormData('requiresConsultation', e.target.checked)}
                  className="w-4 h-4 text-green-600 bg-slate-800 border-slate-600 rounded focus:ring-green-500"
                />
                <span className="text-white">Kräver konsultation</span>
              </label>
            </div>
          </div>
        </div>

        {/* Åtgärdsknappar */}
        <div className="flex justify-end gap-3 pt-6 border-t border-slate-700">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sparar...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {product ? 'Uppdatera' : 'Skapa'} produkt
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}