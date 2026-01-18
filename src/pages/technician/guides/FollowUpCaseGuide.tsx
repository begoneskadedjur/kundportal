// src/pages/technician/guides/FollowUpCaseGuide.tsx
// SUPER-PEDAGOGISK GUIDE: Hur du skapar följeärenden i fält
// Version 1.0 - Optimerad för tekniker med begränsad datorvana

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Plus,
  Bug,
  Rat,
  MapPin,
  User,
  Clock,
  Phone,
  FileText,
  AlertTriangle,
  HelpCircle,
  Lightbulb,
  MousePointer2,
  ArrowDown,
  Sparkles,
  Eye,
  Calendar,
  Target,
  Zap,
  ThumbsUp,
  ThumbsDown,
  Home,
  Building,
  X
} from 'lucide-react'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'

// ============================================================================
// MOCK-KOMPONENTER - Visar hur riktiga UI-element ser ut
// ============================================================================

// Mock: Följeärende-knappen exakt som den ser ut i systemet
const MockFollowUpButton = ({
  animated = false,
  onClick,
  size = 'normal'
}: {
  animated?: boolean
  onClick?: () => void
  size?: 'normal' | 'large'
}) => {
  const sizeClasses = size === 'large'
    ? 'px-6 py-4 text-lg gap-3'
    : 'px-3 py-2 text-sm gap-2'

  return (
    <motion.button
      onClick={onClick}
      className={`flex items-center ${sizeClasses} bg-amber-500/20 hover:bg-amber-500/30 border-2 border-amber-500/40 rounded-lg text-amber-300 hover:text-amber-200 transition-all duration-200 font-medium`}
      animate={animated ? {
        boxShadow: [
          '0 0 0 0 rgba(245, 158, 11, 0)',
          '0 0 0 12px rgba(245, 158, 11, 0.3)',
          '0 0 0 0 rgba(245, 158, 11, 0)'
        ]
      } : {}}
      transition={animated ? {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut'
      } : {}}
    >
      <Plus className={size === 'large' ? 'w-6 h-6' : 'w-4 h-4'} />
      <span>Följeärende</span>
    </motion.button>
  )
}

// Mock: Dropdown för skadedjursval
const MockPestDropdown = ({
  selected,
  onSelect,
  isOpen,
  onToggle
}: {
  selected: string
  onSelect: (pest: string) => void
  isOpen: boolean
  onToggle: () => void
}) => {
  const pestOptions = [
    { name: 'Silverfisk', icon: Bug },
    { name: 'Kackerlackor', icon: Bug },
    { name: 'Vägglöss', icon: Bug },
    { name: 'Myror', icon: Bug },
    { name: 'Getingar', icon: Bug },
    { name: 'Flugor', icon: Bug },
  ]

  return (
    <div className="relative w-full">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 bg-slate-800/70 border-2 border-slate-600 rounded-xl text-left flex items-center justify-between text-white text-lg transition-all duration-200 hover:border-amber-500/50 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
      >
        <span className={selected ? 'text-white' : 'text-slate-400'}>
          {selected || 'Välj skadedjurstyp...'}
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-slate-800 border-2 border-slate-600 rounded-xl shadow-2xl overflow-hidden"
          >
            {pestOptions.map((pest, index) => (
              <button
                key={pest.name}
                onClick={() => {
                  onSelect(pest.name)
                  onToggle()
                }}
                className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-amber-500/20 text-white text-lg transition-colors duration-150 border-b border-slate-700 last:border-b-0"
              >
                <pest.icon className="w-5 h-5 text-amber-400" />
                {pest.name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Mock: "Skapa följeärende"-knappen
const MockCreateButton = ({
  disabled = false,
  loading = false,
  onClick
}: {
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
}) => (
  <motion.button
    onClick={onClick}
    disabled={disabled}
    className={`w-full py-4 px-6 rounded-xl text-lg font-semibold flex items-center justify-center gap-3 transition-all duration-200 ${
      disabled
        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
        : 'bg-amber-500 hover:bg-amber-400 text-slate-900 cursor-pointer'
    }`}
    whileTap={disabled ? {} : { scale: 0.98 }}
  >
    {loading ? (
      <>
        <motion.div
          className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        Skapar...
      </>
    ) : (
      <>
        <Plus className="w-5 h-5" />
        Skapa följeärende
      </>
    )}
  </motion.button>
)

// Mock: Ärendekort som visar "innan" och "efter"
const MockCaseCard = ({
  title,
  pest,
  status,
  isNew = false,
  highlighted = false
}: {
  title: string
  pest: string
  status: string
  isNew?: boolean
  highlighted?: boolean
}) => (
  <motion.div
    className={`p-5 rounded-xl border-2 ${
      highlighted
        ? 'bg-amber-500/10 border-amber-500/50'
        : 'bg-slate-800/50 border-slate-700'
    } ${isNew ? 'ring-2 ring-green-500/50' : ''}`}
    initial={isNew ? { scale: 0.9, opacity: 0 } : {}}
    animate={isNew ? { scale: 1, opacity: 1 } : {}}
    transition={{ duration: 0.3 }}
  >
    {isNew && (
      <div className="flex items-center gap-2 text-green-400 text-sm font-medium mb-3">
        <Sparkles className="w-4 h-4" />
        NYTT ÄRENDE SKAPAT!
      </div>
    )}
    <div className="flex items-start justify-between">
      <div>
        <h4 className="text-white font-semibold text-lg">{title}</h4>
        <div className="flex items-center gap-2 mt-2 text-slate-400">
          <Bug className="w-4 h-4" />
          <span>{pest}</span>
        </div>
      </div>
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
        status === 'Bokad' ? 'bg-blue-500/20 text-blue-300' :
        status === 'Pågående' ? 'bg-amber-500/20 text-amber-300' :
        'bg-slate-700 text-slate-300'
      }`}>
        {status}
      </span>
    </div>
  </motion.div>
)

// Animerad pil som pekar nedåt
const AnimatedArrow = ({ direction = 'down' }: { direction?: 'down' | 'right' }) => (
  <motion.div
    className="flex justify-center py-3"
    animate={{
      y: direction === 'down' ? [0, 8, 0] : 0,
      x: direction === 'right' ? [0, 8, 0] : 0
    }}
    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
  >
    {direction === 'down' ? (
      <ArrowDown className="w-8 h-8 text-amber-400" />
    ) : (
      <ChevronRight className="w-8 h-8 text-amber-400" />
    )}
  </motion.div>
)

// Glödande highlight-ring
const GlowingHighlight = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    className="relative inline-block"
    animate={{
      boxShadow: [
        '0 0 0 0 rgba(245, 158, 11, 0)',
        '0 0 20px 8px rgba(245, 158, 11, 0.4)',
        '0 0 0 0 rgba(245, 158, 11, 0)'
      ]
    }}
    transition={{ duration: 2, repeat: Infinity }}
  >
    {children}
  </motion.div>
)

// ============================================================================
// GUIDE-STEG - Varje steg i guiden
// ============================================================================

interface GuideStep {
  id: number
  title: string
  subtitle?: string
  icon: React.ElementType
  iconColor: string
  content: React.ReactNode
}

const guideSteps: GuideStep[] = [
  {
    id: 1,
    title: 'Vad är ett följeärende?',
    subtitle: 'En snabb introduktion',
    icon: HelpCircle,
    iconColor: 'text-blue-400',
    content: (
      <div className="space-y-8">
        {/* Hero-sektion med stor ikon */}
        <div className="text-center py-6">
          <motion.div
            className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-amber-500/20 mb-6"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Plus className="w-12 h-12 text-amber-400" />
          </motion.div>
          <h3 className="text-2xl font-bold text-white mb-4">
            Skapa nya ärenden direkt i fält!
          </h3>
          <p className="text-xl text-slate-300 max-w-md mx-auto leading-relaxed">
            Slipp ringa kontoret - du kan nu skapa extra ärenden själv när du upptäcker nya problem hos kunden.
          </p>
        </div>

        {/* Scenario-kort */}
        <div className="bg-gradient-to-r from-slate-800/80 to-slate-800/40 rounded-2xl p-6 border border-slate-700">
          <h4 className="text-lg font-semibold text-amber-400 mb-4 flex items-center gap-3">
            <Lightbulb className="w-6 h-6" />
            Typiskt scenario:
          </h4>
          <div className="space-y-4 text-lg text-slate-300">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">1</span>
              <p>Du är hos en kund för att sanera <strong className="text-white">råttor</strong></p>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">2</span>
              <p>Under besöket upptäcker du också <strong className="text-white">silverfisk</strong> i badrummet</p>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">3</span>
              <p>Istället för att ringa kontoret skapar du ett <strong className="text-amber-300">följeärende</strong> direkt!</p>
            </div>
          </div>
        </div>

        {/* Fördelar */}
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <ThumbsUp className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-green-300">Sparar tid</h5>
              <p className="text-slate-400">Ingen väntan på att kontoret ska svara</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <ThumbsUp className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-green-300">Automatisk kopiering</h5>
              <p className="text-slate-400">Kundens info fylls i automatiskt</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <ThumbsUp className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-green-300">Eget pris & tid</h5>
              <p className="text-slate-400">Det nya ärendet får sin egen provisionsberäkning</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: 'Steg 1: Öppna ärendet',
    subtitle: 'Börja från det ärende du jobbar med',
    icon: FileText,
    iconColor: 'text-teal-400',
    content: (
      <div className="space-y-8">
        {/* Instruktion */}
        <div className="bg-teal-500/10 border-2 border-teal-500/30 rounded-2xl p-6">
          <h4 className="text-xl font-semibold text-teal-300 mb-3 flex items-center gap-3">
            <Target className="w-6 h-6" />
            Vad du ska göra:
          </h4>
          <p className="text-lg text-slate-300">
            Öppna det ärende du redan jobbar med genom att <strong className="text-white">klicka på det</strong> i din ärendelista.
          </p>
        </div>

        {/* Simulerad ärendelista */}
        <div className="space-y-3">
          <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Exempel på din ärendelista:</p>

          {/* Ärende 1 - det som ska väljas */}
          <motion.div
            className="p-5 rounded-xl bg-slate-800/70 border-2 border-teal-500/50 cursor-pointer"
            animate={{
              boxShadow: [
                '0 0 0 0 rgba(20, 184, 166, 0)',
                '0 0 15px 5px rgba(20, 184, 166, 0.3)',
                '0 0 0 0 rgba(20, 184, 166, 0)'
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center">
                  <Rat className="w-6 h-6 text-teal-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold text-lg">Familjen Andersson</h4>
                  <p className="text-slate-400">Råttor - Storgatan 15</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-sm">Pågående</span>
                <MousePointer2 className="w-5 h-5 text-teal-400 animate-bounce" />
              </div>
            </div>
          </motion.div>

          {/* Andra ärenden (ej valda) */}
          <div className="p-5 rounded-xl bg-slate-800/30 border border-slate-700 opacity-60">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center">
                <Bug className="w-6 h-6 text-slate-500" />
              </div>
              <div>
                <h4 className="text-slate-400 font-semibold">Företag AB</h4>
                <p className="text-slate-500">Kackerlackor - Industrigatan 8</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pil ner */}
        <AnimatedArrow />

        {/* Resultat-indikator */}
        <div className="flex items-center justify-center gap-3 text-lg text-teal-300">
          <CheckCircle className="w-6 h-6" />
          <span>Ärendet öppnas i en popup-ruta</span>
        </div>
      </div>
    )
  },
  {
    id: 3,
    title: 'Steg 2: Hitta knappen',
    subtitle: 'Leta efter den ORANGEA knappen',
    icon: Eye,
    iconColor: 'text-amber-400',
    content: (
      <div className="space-y-8">
        {/* Stor varning om var knappen finns */}
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h4 className="text-xl font-semibold text-amber-300 mb-2">
                VIKTIGT: Titta LÄNGST UPP
              </h4>
              <p className="text-lg text-slate-300">
                Knappen "Följeärende" finns i <strong className="text-white">övre delen</strong> av popup-rutan,
                bredvid knapparna för "Avtal" och "Offert".
              </p>
            </div>
          </div>
        </div>

        {/* Simulerad modal-header */}
        <div className="space-y-3">
          <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Så här ser det ut:</p>

          <div className="bg-slate-900 rounded-2xl border-2 border-slate-700 overflow-hidden shadow-2xl">
            {/* Modal header */}
            <div className="bg-slate-800/50 border-b border-slate-700 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold">Redigera ärende: Familjen Andersson</h3>
                <button className="p-1 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Knapprad - fokusera här */}
            <div className="bg-slate-800/30 border-b border-slate-700 p-4">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Avtal-knapp */}
                <button className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 border border-purple-500/40 rounded-lg text-purple-300 text-sm">
                  <FileText className="w-4 h-4" />
                  Avtal
                </button>

                {/* Offert-knapp */}
                <button className="flex items-center gap-2 px-3 py-2 bg-green-500/20 border border-green-500/40 rounded-lg text-green-300 text-sm">
                  <FileText className="w-4 h-4" />
                  Offert
                </button>

                {/* FÖLJEÄRENDE-KNAPPEN - HIGHLIGHTAD */}
                <GlowingHighlight>
                  <MockFollowUpButton animated={true} />
                </GlowingHighlight>
              </div>

              {/* Pil som pekar på knappen */}
              <motion.div
                className="flex items-center gap-2 mt-4 text-amber-400"
                animate={{ x: [0, 10, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <ChevronRight className="w-6 h-6" />
                <ChevronRight className="w-6 h-6 -ml-3" />
                <span className="text-lg font-semibold">KLICKA HÄR!</span>
              </motion.div>
            </div>

            {/* Resten av modal (suddig) */}
            <div className="p-4 opacity-30 blur-[2px]">
              <div className="h-16 bg-slate-800 rounded-lg mb-3"></div>
              <div className="h-24 bg-slate-800 rounded-lg"></div>
            </div>
          </div>
        </div>

        {/* Knappen visas stort */}
        <div className="text-center py-4">
          <p className="text-slate-400 mb-4">Knappen ser ut så här:</p>
          <div className="flex justify-center">
            <MockFollowUpButton size="large" animated={true} />
          </div>
        </div>
      </div>
    )
  },
  {
    id: 4,
    title: 'Steg 3: Välj skadedjur',
    subtitle: 'En enkel dropdown-meny öppnas',
    icon: Bug,
    iconColor: 'text-purple-400',
    content: (() => {
      // Interaktiv demo - använd useState inuti komponenten
      const InteractiveDemo = () => {
        const [selectedPest, setSelectedPest] = useState('')
        const [dropdownOpen, setDropdownOpen] = useState(false)

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-purple-300 mb-3 flex items-center gap-3">
                <Bug className="w-6 h-6" />
                Vad du ska göra:
              </h4>
              <ol className="text-lg text-slate-300 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">1</span>
                  <span>Klicka på dropdown-menyn</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">2</span>
                  <span>Välj det <strong className="text-white">NYA</strong> skadedjuret du hittade</span>
                </li>
              </ol>
            </div>

            {/* Interaktiv demo */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Prova själv (klicka!):</p>

              <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-6">
                <label className="block text-slate-300 text-lg mb-3 font-medium">
                  Skadedjurstyp för det nya ärendet:
                </label>
                <MockPestDropdown
                  selected={selectedPest}
                  onSelect={setSelectedPest}
                  isOpen={dropdownOpen}
                  onToggle={() => setDropdownOpen(!dropdownOpen)}
                />

                {selectedPest && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3"
                  >
                    <CheckCircle className="w-6 h-6 text-green-400" />
                    <span className="text-green-300 text-lg">
                      Bra val! Du valde: <strong>{selectedPest}</strong>
                    </span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Tips */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <Lightbulb className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                <div>
                  <h5 className="font-semibold text-blue-300 mb-2">Tips!</h5>
                  <p className="text-slate-300">
                    Välj det skadedjur du <strong className="text-white">NYSS</strong> upptäckte -
                    inte det du redan behandlar. Det ursprungliga ärendet har redan sitt skadedjur.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      }

      return <InteractiveDemo />
    })()
  },
  {
    id: 5,
    title: 'Steg 4: Klicka "Skapa"',
    subtitle: 'Den sista knappen för att slutföra',
    icon: Zap,
    iconColor: 'text-green-400',
    content: (() => {
      const CreateButtonDemo = () => {
        const [clicked, setClicked] = useState(false)
        const [loading, setLoading] = useState(false)

        const handleClick = () => {
          setClicked(true)
          setLoading(true)
          setTimeout(() => {
            setLoading(false)
          }, 2000)
        }

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-green-500/10 border-2 border-green-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-green-300 mb-3 flex items-center gap-3">
                <Zap className="w-6 h-6" />
                Sista steget!
              </h4>
              <p className="text-lg text-slate-300">
                När du har valt skadedjurstyp, klicka på den <strong className="text-amber-300">gula knappen</strong> "Skapa följeärende".
              </p>
            </div>

            {/* Simulerad dialog */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Plus className="w-6 h-6 text-amber-400" />
                  <span className="text-xl font-semibold text-amber-300">Skapa följeärende</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-2">Valt skadedjur:</label>
                <div className="px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white text-lg">
                  Silverfisk
                </div>
              </div>

              {/* Stora knappar */}
              <div className="grid grid-cols-2 gap-4">
                <button className="py-4 px-6 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-lg font-medium transition-colors">
                  Avbryt
                </button>

                <GlowingHighlight>
                  <MockCreateButton
                    onClick={handleClick}
                    loading={loading}
                    disabled={clicked && !loading && true}
                  />
                </GlowingHighlight>
              </div>
            </div>

            {/* Resultat */}
            <AnimatePresence>
              {clicked && !loading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-500/20 border-2 border-green-500/40 rounded-2xl p-6 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                  >
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  </motion.div>
                  <h4 className="text-2xl font-bold text-green-300 mb-2">Klart!</h4>
                  <p className="text-lg text-slate-300">
                    Följeärendet har skapats och öppnas automatiskt.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {!clicked && (
              <p className="text-center text-slate-400 text-lg">
                Prova att klicka på knappen ovan!
              </p>
            )}
          </div>
        )
      }

      return <CreateButtonDemo />
    })()
  },
  {
    id: 6,
    title: 'Före och efter',
    subtitle: 'Se skillnaden i systemet',
    icon: Sparkles,
    iconColor: 'text-cyan-400',
    content: (
      <div className="space-y-8">
        {/* Förklaring */}
        <div className="text-center text-lg text-slate-300">
          <p>Så här ser det ut i dina ärenden <strong className="text-white">innan</strong> och <strong className="text-white">efter</strong> du skapat ett följeärende:</p>
        </div>

        {/* Före/Efter jämförelse */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FÖRE */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-slate-400">
              <div className="px-4 py-2 bg-slate-700 rounded-lg font-semibold uppercase text-sm">
                Före
              </div>
              <span>1 ärende</span>
            </div>
            <MockCaseCard
              title="Familjen Andersson"
              pest="Råttor"
              status="Pågående"
              highlighted={true}
            />
          </div>

          {/* Pil */}
          <div className="hidden lg:flex items-center justify-center">
            <motion.div
              animate={{ x: [0, 10, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ChevronRight className="w-12 h-12 text-amber-400" />
            </motion.div>
          </div>
          <div className="lg:hidden">
            <AnimatedArrow />
          </div>

          {/* EFTER */}
          <div className="space-y-4 lg:col-start-1">
            <div className="flex items-center gap-3 text-green-400">
              <div className="px-4 py-2 bg-green-500/20 rounded-lg font-semibold uppercase text-sm">
                Efter
              </div>
              <span>2 ärenden!</span>
            </div>
            <MockCaseCard
              title="Familjen Andersson"
              pest="Råttor"
              status="Pågående"
            />
            <MockCaseCard
              title="Familjen Andersson"
              pest="Silverfisk"
              status="Bokad"
              isNew={true}
            />
          </div>
        </div>

        {/* Vad kopieras automatiskt */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            Automatiskt kopierat till nya ärendet:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-slate-300">
              <User className="w-5 h-5 text-blue-400" />
              <span>Kundens namn & kontaktinfo</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <MapPin className="w-5 h-5 text-red-400" />
              <span>Adress</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <Phone className="w-5 h-5 text-green-400" />
              <span>Telefonnummer</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <Calendar className="w-5 h-5 text-purple-400" />
              <span>Samma schemalagda tid</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <User className="w-5 h-5 text-amber-400" />
              <span>Du som tilldelad tekniker</span>
            </div>
          </div>
        </div>

        {/* Vad som är nytt */}
        <div className="bg-amber-500/10 rounded-2xl p-6 border border-amber-500/30">
          <h4 className="text-lg font-semibold text-amber-300 mb-4 flex items-center gap-3">
            <Sparkles className="w-6 h-6" />
            Nytt för följeärendet:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-slate-300">
              <Bug className="w-5 h-5 text-purple-400" />
              <span>Ny skadedjurstyp</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <Clock className="w-5 h-5 text-cyan-400" />
              <span>Egen tidloggning (0 min)</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <FileText className="w-5 h-5 text-teal-400" />
              <span>Eget pris</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <Target className="w-5 h-5 text-blue-400" />
              <span>Status: Bokad</span>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 7,
    title: 'Vanliga frågor (FAQ)',
    subtitle: 'Svar på det du undrar',
    icon: HelpCircle,
    iconColor: 'text-pink-400',
    content: (
      <div className="space-y-6">
        {/* FAQ-kort */}
        {[
          {
            question: 'Kan jag skapa följeärende från vilket ärende som helst?',
            answer: 'Ja, men bara för privatperson- och företagsärenden. Kontraktsärenden (återkommande besök) stöder inte följeärenden.',
            icon: Home
          },
          {
            question: 'Kan jag skapa följeärende från ett följeärende?',
            answer: 'Nej, du kan bara skapa följeärenden från "original"-ärenden. Om ärendet redan är ett följeärende visas inte knappen.',
            icon: ThumbsDown
          },
          {
            question: 'Vad händer om jag väljer fel skadedjur?',
            answer: 'Ingen fara! Du kan ändra skadedjurstypen i det nya ärendet efteråt, precis som vanligt.',
            icon: AlertTriangle
          },
          {
            question: 'Får jag provision för följeärendet?',
            answer: 'Ja! Följeärendet räknas som ett helt eget ärende med eget pris och egen tidloggning. Din provision beräknas som vanligt.',
            icon: ThumbsUp
          },
          {
            question: 'Ser kontoret att jag skapade ärendet?',
            answer: 'Ja, det loggas vem som skapade följeärendet. De kan också se vilket ärende det kom ifrån.',
            icon: Eye
          },
          {
            question: 'Vad om knappen inte syns?',
            answer: 'Kontrollera att: 1) Du jobbar med ett privatperson- eller företagsärende, 2) Det inte redan är ett följeärende, 3) Ärendet är öppnat i redigeringsläge.',
            icon: AlertTriangle
          }
        ].map((faq, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden"
          >
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-pink-500/20 rounded-lg flex-shrink-0">
                  <faq.icon className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">{faq.question}</h4>
                  <p className="text-slate-300 leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    )
  },
  {
    id: 8,
    title: 'Sammanfattning',
    subtitle: 'Allt du behöver komma ihåg',
    icon: CheckCircle,
    iconColor: 'text-green-400',
    content: (
      <div className="space-y-8">
        {/* Stora steg */}
        <div className="space-y-4">
          <h4 className="text-xl font-semibold text-white text-center mb-6">
            4 enkla steg - det är allt!
          </h4>

          {[
            { step: 1, text: 'Öppna ärendet du jobbar med', color: 'teal' },
            { step: 2, text: 'Klicka på ORANGEA "Följeärende"-knappen', color: 'amber' },
            { step: 3, text: 'Välj det NYA skadedjuret i dropdown-menyn', color: 'purple' },
            { step: 4, text: 'Klicka "Skapa följeärende"', color: 'green' },
          ].map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.15 }}
              className={`flex items-center gap-4 p-5 rounded-xl bg-${item.color}-500/10 border-2 border-${item.color}-500/30`}
              style={{
                background: `rgba(${
                  item.color === 'teal' ? '20, 184, 166' :
                  item.color === 'amber' ? '245, 158, 11' :
                  item.color === 'purple' ? '168, 85, 247' :
                  '34, 197, 94'
                }, 0.1)`,
                borderColor: `rgba(${
                  item.color === 'teal' ? '20, 184, 166' :
                  item.color === 'amber' ? '245, 158, 11' :
                  item.color === 'purple' ? '168, 85, 247' :
                  '34, 197, 94'
                }, 0.3)`
              }}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white`}
                style={{
                  background: item.color === 'teal' ? '#14b8a6' :
                              item.color === 'amber' ? '#f59e0b' :
                              item.color === 'purple' ? '#a855f7' :
                              '#22c55e'
                }}
              >
                {item.step}
              </div>
              <span className="text-lg text-white font-medium">{item.text}</span>
            </motion.div>
          ))}
        </div>

        {/* Knappen en sista gång */}
        <div className="text-center py-6">
          <p className="text-slate-400 mb-4">Kom ihåg att leta efter denna knapp:</p>
          <div className="flex justify-center">
            <MockFollowUpButton size="large" animated={true} />
          </div>
        </div>

        {/* Uppmuntran */}
        <div className="bg-gradient-to-r from-green-500/20 to-teal-500/20 rounded-2xl p-6 border border-green-500/30 text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-block mb-4"
          >
            <ThumbsUp className="w-16 h-16 text-green-400" />
          </motion.div>
          <h4 className="text-2xl font-bold text-green-300 mb-2">Du klarar detta!</h4>
          <p className="text-lg text-slate-300">
            Nästa gång du hittar ett extra skadedjursproblem, testa att skapa ett följeärende själv.
          </p>
        </div>
      </div>
    )
  }
]

// ============================================================================
// HUVUDKOMPONENT
// ============================================================================

export default function FollowUpCaseGuide() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const handleStepComplete = (stepIndex: number) => {
    setCompletedSteps(prev => new Set([...prev, stepIndex]))
  }

  const goToStep = (stepIndex: number) => {
    if (stepIndex > currentStep) {
      handleStepComplete(currentStep)
    }
    setCurrentStep(stepIndex)
    // Scrolla till toppen
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goToNextStep = () => {
    if (currentStep < guideSteps.length - 1) {
      handleStepComplete(currentStep)
      setCurrentStep(currentStep + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goToPrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const currentStepData = guideSteps[currentStep]
  const progress = ((currentStep + 1) / guideSteps.length) * 100

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header - Sticky */}
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
              <h1 className="text-lg font-semibold text-white">Guide: Följeärenden</h1>
              <p className="text-sm text-slate-400">Steg {currentStep + 1} av {guideSteps.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Plus className="w-6 h-6 text-amber-400" />
            </div>
          </div>

          {/* Progress bar - STOR och tydlig */}
          <div className="mt-4">
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>Start</span>
              <span>{Math.round(progress)}% klart</span>
              <span>Mål</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar med steg-navigering (desktop) */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="sticky top-40">
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
                            ? 'bg-amber-500/20 text-amber-400'
                            : isCompleted
                              ? 'text-slate-300 hover:bg-slate-800'
                              : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isActive
                            ? 'bg-amber-500 text-white'
                            : isCompleted
                              ? 'bg-amber-500/30 text-amber-400'
                              : 'bg-slate-700 text-slate-400'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <span className="text-xs font-bold">{index + 1}</span>
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
            {/* Mobil steg-indikator - STOR */}
            <div className="lg:hidden mb-6 overflow-x-auto">
              <div className="flex gap-2 min-w-max pb-2">
                {guideSteps.map((step, index) => {
                  const isActive = index === currentStep
                  const isCompleted = completedSteps.has(index)

                  return (
                    <button
                      key={step.id}
                      onClick={() => goToStep(index)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-amber-500 text-white ring-4 ring-amber-500/30'
                          : isCompleted
                            ? 'bg-amber-500/30 text-amber-400'
                            : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-bold">{index + 1}</span>
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
                <Card className="p-6 lg:p-8">
                  {/* Steghuvud - STOR */}
                  <div className="flex items-center gap-4 lg:gap-6 mb-8 pb-6 border-b border-slate-700">
                    <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-slate-800 flex items-center justify-center`}>
                      <currentStepData.icon className={`w-8 h-8 lg:w-10 lg:h-10 ${currentStepData.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-sm lg:text-base text-slate-400 mb-1">Steg {currentStep + 1} av {guideSteps.length}</p>
                      <h2 className="text-xl lg:text-2xl font-bold text-white">{currentStepData.title}</h2>
                      {currentStepData.subtitle && (
                        <p className="text-slate-400 mt-1">{currentStepData.subtitle}</p>
                      )}
                    </div>
                  </div>

                  {/* Steginnehåll */}
                  <div className="min-h-[400px]">
                    {currentStepData.content}
                  </div>
                </Card>
              </motion.div>
            </AnimatePresence>

            {/* Navigeringsknappar - STORA och tydliga */}
            <div className="flex items-center justify-between mt-8 gap-4">
              <Button
                variant="outline"
                onClick={goToPrevStep}
                disabled={currentStep === 0}
                className="flex items-center gap-2 py-4 px-6 text-lg"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Föregående</span>
                <span className="sm:hidden">Bakåt</span>
              </Button>

              {currentStep === guideSteps.length - 1 ? (
                <Button
                  onClick={() => navigate('/technician/cases')}
                  className="flex items-center gap-2 py-4 px-6 text-lg bg-amber-500 hover:bg-amber-400 text-slate-900"
                >
                  <FileText className="w-5 h-5" />
                  Gå till mina ärenden
                </Button>
              ) : (
                <Button
                  onClick={goToNextStep}
                  className="flex items-center gap-2 py-4 px-6 text-lg bg-amber-500 hover:bg-amber-400 text-slate-900"
                >
                  <span>Nästa steg</span>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              )}
            </div>

            {/* Snabbhjälp längst ner */}
            <div className="mt-8 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3 text-slate-400">
                <HelpCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">
                  Behöver du mer hjälp? Kontakta kontoret på{' '}
                  <a href="tel:010-2051600" className="text-amber-400 hover:text-amber-300">
                    010-205 16 00
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
