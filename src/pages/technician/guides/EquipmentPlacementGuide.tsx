// src/pages/technician/guides/EquipmentPlacementGuide.tsx
// Steg-för-steg guide för utrustningsplacering

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  MapPin,
  CheckCircle,
  Circle,
  ChevronRight,
  ChevronLeft,
  Users,
  Navigation,
  Building,
  ListPlus,
  Crosshair,
  Camera,
  Eye,
  AlertTriangle,
  ExternalLink,
  Map,
  FileDown,
  Smartphone,
  Monitor,
  HelpCircle
} from 'lucide-react'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'

// Guide-steg
interface GuideStep {
  id: number
  title: string
  icon: React.ElementType
  iconColor: string
  content: React.ReactNode
}

const guideSteps: GuideStep[] = [
  {
    id: 1,
    title: 'Introduktion',
    icon: HelpCircle,
    iconColor: 'text-blue-400',
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          Att registrera utrustningsplaceringar korrekt är viktigt för flera anledningar:
        </p>
        <ul className="space-y-3">
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <span className="text-slate-300">
              <strong className="text-white">Spårbarhet:</strong> Vi kan alltid veta var utrustning finns placerad
            </span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <span className="text-slate-300">
              <strong className="text-white">Kundtransparens:</strong> Kunden kan se sin egen utrustning i portalen
            </span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <span className="text-slate-300">
              <strong className="text-white">Dokumentation:</strong> PDF-export med kartor för kundmöten
            </span>
          </li>
          <li className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <span className="text-slate-300">
              <strong className="text-white">Effektivitet:</strong> Nästa tekniker hittar enkelt tillbaka
            </span>
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 2,
    title: 'Det stora flödet',
    icon: Users,
    iconColor: 'text-purple-400',
    content: (
      <div className="space-y-6">
        <p className="text-slate-300 leading-relaxed">
          Förstå hur informationen flödar genom systemet:
        </p>

        {/* Flödesdiagram */}
        <div className="space-y-4">
          {/* Steg 1: Tekniker */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-white">1. Tekniker i fält</h4>
              <p className="text-sm text-slate-400">
                Registrerar utrustning med GPS, foto och kommentarer via mobilen
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <ChevronRight className="w-6 h-6 text-slate-600 rotate-90" />
          </div>

          {/* Steg 2: Admin */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Monitor className="w-7 h-7 text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-white">2. Admin ser kartan</h4>
              <p className="text-sm text-slate-400">
                I kunddetaljer visas en interaktiv karta med alla placeringar
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <ChevronRight className="w-6 h-6 text-slate-600 rotate-90" />
          </div>

          {/* Steg 3: Kund */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Eye className="w-7 h-7 text-amber-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-white">3. Kunden ser sin utrustning</h4>
              <p className="text-sm text-slate-400">
                Inloggade kunder kan se bilder, kommentarer och exportera PDF
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 3,
    title: 'Navigera till Utrustning',
    icon: Navigation,
    iconColor: 'text-cyan-400',
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          Du når utrustningssidan på flera sätt:
        </p>

        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <h4 className="font-medium text-white mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm flex items-center justify-center">1</span>
              Från Snabbåtgärder
            </h4>
            <p className="text-sm text-slate-400">
              På din dashboard finns knappen "Utrustning" under Snabbåtgärder
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <h4 className="font-medium text-white mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-sm flex items-center justify-center">2</span>
              Direktlänk
            </h4>
            <p className="text-sm text-slate-400 font-mono">
              /technician/equipment
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <p className="text-sm text-emerald-300">
            <strong>Tips:</strong> Bokmärk sidan i din mobils webbläsare för snabb åtkomst!
          </p>
        </div>
      </div>
    )
  },
  {
    id: 4,
    title: 'Välj kund',
    icon: Building,
    iconColor: 'text-orange-400',
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          När du öppnar utrustningssidan ser du alla dina placeringar på en karta.
          För att lägga till ny utrustning måste du först välja en kund.
        </p>

        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <h4 className="font-medium text-white mb-2">Chip-filter</h4>
            <p className="text-sm text-slate-400">
              Längst upp finns horisontella "chips" med dina kunder. Tryck på en kund
              för att filtrera kartan till bara den kundens utrustning.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <h4 className="font-medium text-white mb-2">Plus-knappen</h4>
            <p className="text-sm text-slate-400">
              Tryck på den gröna plus-knappen nere till höger. Om ingen kund är vald
              visas en sökbar lista där du kan välja kund.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 5,
    title: 'Registrera utrustning',
    icon: ListPlus,
    iconColor: 'text-green-400',
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          När du har valt kund öppnas formuläret för ny placering:
        </p>

        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <h4 className="font-medium text-white mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-sm flex items-center justify-center font-bold">1</span>
              Välj utrustningstyp
            </h4>
            <ul className="text-sm text-slate-400 space-y-1 ml-8">
              <li>Mekanisk fälla (kräver serienummer)</li>
              <li>Betongstation</li>
              <li>Plaststation</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <h4 className="font-medium text-white mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-sm flex items-center justify-center font-bold">2</span>
              Ange serienummer (om relevant)
            </h4>
            <p className="text-sm text-slate-400">
              Mekaniska fällor kräver serienummer för spårbarhet
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <h4 className="font-medium text-white mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-sm flex items-center justify-center font-bold">3</span>
              Kommentar (valfritt)
            </h4>
            <p className="text-sm text-slate-400">
              Beskriv platsen, t.ex. "Bakom sopcontainern" eller "Vid lastbryggan"
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 6,
    title: 'GPS-position',
    icon: Crosshair,
    iconColor: 'text-red-400',
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          GPS-positionen är kritisk för att andra ska kunna hitta tillbaka till utrustningen.
        </p>

        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <h4 className="font-medium text-emerald-400 mb-2 flex items-center gap-2">
            <Crosshair className="w-5 h-5" />
            Automatisk GPS
          </h4>
          <p className="text-sm text-emerald-300">
            Tryck på "Hämta GPS-position" för att använda telefonens GPS.
            Stå så nära utrustningen som möjligt för bäst precision.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <h4 className="font-medium text-amber-400 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Om GPS inte fungerar
          </h4>
          <p className="text-sm text-amber-300">
            Se till att du har gett webbläsaren tillgång till platsinformation.
            På iPhone: Inställningar &gt; Safari &gt; Plats.
            På Android: Inställningar &gt; Platser.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <h4 className="font-medium text-white mb-2">Manuellt via karta</h4>
          <p className="text-sm text-slate-400">
            Du kan också trycka direkt på kartan för att markera positionen.
            Använd detta om GPS ger fel position.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 7,
    title: 'Foto och kommentarer',
    icon: Camera,
    iconColor: 'text-pink-400',
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          Ett foto gör det mycket lättare att hitta tillbaka till utrustningen.
        </p>

        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <h4 className="font-medium text-white mb-2">Ta ett bra foto</h4>
          <ul className="text-sm text-slate-400 space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>Visa utrustningen och omgivningen</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>Inkludera landmärken som dörrar, hörn, skyltar</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>Undvik för nära bilder - visa sammanhanget</span>
            </li>
          </ul>
        </div>

        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <h4 className="font-medium text-white mb-2">Bra kommentarer</h4>
          <div className="space-y-2">
            <p className="text-sm text-slate-400">Exempel på bra kommentarer:</p>
            <ul className="text-sm text-slate-300 space-y-1 font-mono bg-slate-900/50 p-3 rounded-lg">
              <li>"Bakom sopcontainern, vänster sida"</li>
              <li>"Vid lastbrygga 2, under trappan"</li>
              <li>"Innanför grinden, 3m till höger"</li>
            </ul>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 8,
    title: 'Vad kunden ser',
    icon: Eye,
    iconColor: 'text-amber-400',
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          Din registrerade utrustning blir synlig på flera ställen:
        </p>

        <div className="space-y-3">
          {/* Admin-vy */}
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Monitor className="w-5 h-5 text-blue-400" />
              <h4 className="font-medium text-blue-400">Admin-vy (Kunddetaljer)</h4>
            </div>
            <p className="text-sm text-blue-300">
              I admin-panelen visas kundens utrustning med en interaktiv karta
              bredvid en lista. Kartan visar alla placeringar med färgkodade markörer.
            </p>
          </div>

          {/* Kundportal */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Smartphone className="w-5 h-5 text-amber-400" />
              <h4 className="font-medium text-amber-400">Kundportalen</h4>
            </div>
            <p className="text-sm text-amber-300">
              Inloggade kunder ser sin utrustning med bilder och kommentarer.
              De kan klicka på varje placering för att se detaljer.
            </p>
          </div>

          {/* PDF-export */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-center gap-3 mb-2">
              <FileDown className="w-5 h-5 text-emerald-400" />
              <h4 className="font-medium text-emerald-400">PDF-export</h4>
            </div>
            <p className="text-sm text-emerald-300">
              Kunden kan exportera en PDF med all utrustning.
              Varje placering har klickbara GPS-koordinater som öppnar Google Maps.
            </p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 9,
    title: 'Felsökning',
    icon: AlertTriangle,
    iconColor: 'text-red-400',
    content: (
      <div className="space-y-4">
        <p className="text-slate-300 leading-relaxed">
          Vanliga problem och lösningar:
        </p>

        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <h4 className="font-medium text-white mb-2">GPS visar fel position</h4>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>- Vänta några sekunder och tryck igen</li>
              <li>- Gå utomhus om du är inomhus</li>
              <li>- Använd kartklick som alternativ</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <h4 className="font-medium text-white mb-2">Foto laddas inte upp</h4>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>- Kontrollera internetuppkoppling</li>
              <li>- Prova med en mindre bild</li>
              <li>- Spara först utan foto, lägg till senare</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <h4 className="font-medium text-white mb-2">Kan inte hitta kunden</h4>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>- Sök på företagsnamn, inte kontaktperson</li>
              <li>- Kontrollera stavning</li>
              <li>- Kontakta kontoret om kunden saknas</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <h4 className="font-medium text-white mb-2">Placeringen försvann</h4>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>- Kontrollera kundfiltret (välj "Alla")</li>
              <li>- Uppdatera sidan</li>
              <li>- Kontakta admin om problemet kvarstår</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }
]

export default function EquipmentPlacementGuide() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const handleStepComplete = (stepIndex: number) => {
    setCompletedSteps(prev => new Set([...prev, stepIndex]))
  }

  const goToStep = (stepIndex: number) => {
    // Markera nuvarande steg som klart om vi går vidare
    if (stepIndex > currentStep) {
      handleStepComplete(currentStep)
    }
    setCurrentStep(stepIndex)
  }

  const goToNextStep = () => {
    if (currentStep < guideSteps.length - 1) {
      handleStepComplete(currentStep)
      setCurrentStep(currentStep + 1)
    }
  }

  const goToPrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const currentStepData = guideSteps[currentStep]
  const progress = ((currentStep + 1) / guideSteps.length) * 100

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/technician/dashboard')}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-white">Utrustningsplacering</h1>
              <p className="text-sm text-slate-400">Steg {currentStep + 1} av {guideSteps.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-emerald-400" />
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar med steg-navigering (desktop) */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="sticky top-32">
              <Card className="p-4">
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
                  Innehåll
                </h3>
                <nav className="space-y-1">
                  {guideSteps.map((step, index) => {
                    const isActive = index === currentStep
                    const isCompleted = completedSteps.has(index)

                    return (
                      <button
                        key={step.id}
                        onClick={() => goToStep(index)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isCompleted
                              ? 'text-slate-300 hover:bg-slate-800'
                              : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isActive
                            ? 'bg-emerald-500 text-white'
                            : isCompleted
                              ? 'bg-emerald-500/30 text-emerald-400'
                              : 'bg-slate-700 text-slate-400'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <span className="text-xs font-medium">{index + 1}</span>
                          )}
                        </div>
                        <span className="text-sm font-medium truncate">{step.title}</span>
                      </button>
                    )
                  })}
                </nav>
              </Card>
            </div>
          </div>

          {/* Huvudinnehåll */}
          <div className="lg:col-span-8">
            {/* Mobil steg-indikator */}
            <div className="lg:hidden mb-4 overflow-x-auto">
              <div className="flex gap-2 min-w-max pb-2">
                {guideSteps.map((step, index) => {
                  const isActive = index === currentStep
                  const isCompleted = completedSteps.has(index)

                  return (
                    <button
                      key={step.id}
                      onClick={() => goToStep(index)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-emerald-500 text-white'
                          : isCompleted
                            ? 'bg-emerald-500/30 text-emerald-400'
                            : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <span className="text-xs font-medium">{index + 1}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Steginnehåll */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-6">
                  {/* Steghuvud */}
                  <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-700">
                    <div className={`w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center`}>
                      <currentStepData.icon className={`w-7 h-7 ${currentStepData.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400 mb-1">Steg {currentStep + 1}</p>
                      <h2 className="text-xl font-semibold text-white">{currentStepData.title}</h2>
                    </div>
                  </div>

                  {/* Steginnehåll */}
                  <div className="min-h-[300px]">
                    {currentStepData.content}
                  </div>
                </Card>
              </motion.div>
            </AnimatePresence>

            {/* Navigeringsknappar */}
            <div className="flex items-center justify-between mt-6 gap-4">
              <Button
                variant="outline"
                onClick={goToPrevStep}
                disabled={currentStep === 0}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Föregående
              </Button>

              {currentStep === guideSteps.length - 1 ? (
                <Button
                  onClick={() => navigate('/technician/equipment')}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600"
                >
                  <MapPin className="w-4 h-4" />
                  Öppna Utrustning
                </Button>
              ) : (
                <Button
                  onClick={goToNextStep}
                  className="flex items-center gap-2"
                >
                  Nästa
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
