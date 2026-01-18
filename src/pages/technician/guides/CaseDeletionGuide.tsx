// src/pages/technician/guides/CaseDeletionGuide.tsx
// SUPER-PEDAGOGISK GUIDE: Hur och när raderar man ett ärende?
// Version 1.0 - Optimerad för tekniker med begränsad datorvana
// Fokus: SLASKA istället för radera!

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Trash2,
  AlertTriangle,
  Shield,
  FileX,
  CheckCircle,
  XCircle,
  Archive,
  FileText,
  Edit3,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  HelpCircle,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  AlertOctagon,
  Ban,
  CheckCircle2,
  Clock,
  MessageSquare,
  Image,
  History,
  ArrowDown,
  X,
  Info
} from 'lucide-react'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'

// ============================================================================
// MOCK-KOMPONENTER - Visar hur riktiga UI-element ser ut
// ============================================================================

// Mock: Status-dropdown med "Slaskad" alternativ
const MockStatusDropdown = ({
  selected,
  onSelect,
  isOpen,
  onToggle,
  animated = false
}: {
  selected: string
  onSelect: (status: string) => void
  isOpen: boolean
  onToggle: () => void
  animated?: boolean
}) => {
  const statusOptions = [
    { name: 'Bokad', color: 'bg-blue-500/20 text-blue-300' },
    { name: 'Pågående', color: 'bg-amber-500/20 text-amber-300' },
    { name: 'Avslutad', color: 'bg-green-500/20 text-green-300' },
    { name: 'Slaskad', color: 'bg-red-500/20 text-red-300', highlight: true },
  ]

  return (
    <div className="relative w-full">
      <motion.button
        onClick={onToggle}
        className="w-full px-4 py-3 bg-slate-800/70 border-2 border-slate-600 rounded-xl text-left flex items-center justify-between text-white text-lg transition-all duration-200 hover:border-amber-500/50 focus:border-amber-500"
        animate={animated ? {
          boxShadow: [
            '0 0 0 0 rgba(239, 68, 68, 0)',
            '0 0 0 12px rgba(239, 68, 68, 0.2)',
            '0 0 0 0 rgba(239, 68, 68, 0)'
          ]
        } : {}}
        transition={animated ? { duration: 2, repeat: Infinity } : {}}
      >
        <span className={selected ? 'text-white' : 'text-slate-400'}>
          {selected || 'Välj status...'}
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-slate-800 border-2 border-slate-600 rounded-xl shadow-2xl overflow-hidden"
          >
            {statusOptions.map((status) => (
              <button
                key={status.name}
                onClick={() => {
                  onSelect(status.name)
                  onToggle()
                }}
                className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-700/50 text-white text-lg transition-colors duration-150 border-b border-slate-700 last:border-b-0 ${
                  status.highlight ? 'bg-red-500/10' : ''
                }`}
              >
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
                  {status.name}
                </span>
                {status.highlight && (
                  <span className="text-sm text-red-400 ml-auto">Använd denna!</span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Mock: Tekniker dokumentation-fält
const MockDocumentationField = ({
  value,
  onChange,
  animated = false
}: {
  value: string
  onChange: (value: string) => void
  animated?: boolean
}) => (
  <motion.div
    className="w-full"
    animate={animated ? {
      boxShadow: [
        '0 0 0 0 rgba(245, 158, 11, 0)',
        '0 0 0 10px rgba(245, 158, 11, 0.2)',
        '0 0 0 0 rgba(245, 158, 11, 0)'
      ]
    } : {}}
    transition={animated ? { duration: 2, repeat: Infinity } : {}}
  >
    <label className="block text-sm font-medium text-amber-300 mb-2 flex items-center gap-2">
      <Edit3 className="w-4 h-4" />
      Tekniker dokumentation
      <span className="text-red-400 text-xs">(OBLIGATORISK vid slaskning!)</span>
    </label>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Skriv anledningen till varför ärendet slaskas..."
      className="w-full px-4 py-3 bg-slate-800/70 border-2 border-amber-500/50 rounded-xl text-white text-lg placeholder:text-slate-500 resize-none outline-none focus:border-amber-500 transition-colors min-h-[120px]"
      rows={4}
    />
  </motion.div>
)

// Mock: Danger Zone med radera-knapp
const MockDangerZone = ({
  onDelete,
  animated = false,
  showWarning = true
}: {
  onDelete?: () => void
  animated?: boolean
  showWarning?: boolean
}) => (
  <div className="mt-6 pt-6 border-t-2 border-red-500/30">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-red-500/20 rounded-lg">
        <AlertOctagon className="w-5 h-5 text-red-400" />
      </div>
      <div>
        <h4 className="text-lg font-semibold text-red-400">Danger Zone</h4>
        <p className="text-sm text-slate-400">Oåterkalleliga åtgärder</p>
      </div>
    </div>

    {showWarning && (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-300">
            <p className="font-semibold mb-1">VARNING: Detta kan INTE ångras!</p>
            <p className="text-slate-400">
              All data försvinner permanent - kommentarer, bilder, historik.
              Använd "Slaskad"-status istället om möjligt.
            </p>
          </div>
        </div>
      </div>
    )}

    <motion.button
      onClick={onDelete}
      className="flex items-center gap-3 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border-2 border-red-500/40 rounded-xl text-red-400 hover:text-red-300 transition-all duration-200 w-full justify-center font-medium"
      animate={animated ? {
        boxShadow: [
          '0 0 0 0 rgba(239, 68, 68, 0)',
          '0 0 15px 5px rgba(239, 68, 68, 0.3)',
          '0 0 0 0 rgba(239, 68, 68, 0)'
        ]
      } : {}}
      transition={animated ? { duration: 2, repeat: Infinity } : {}}
      whileTap={{ scale: 0.98 }}
    >
      <Trash2 className="w-5 h-5" />
      Radera ärende permanent
    </motion.button>
  </div>
)

// Mock: Jämförelse-kort
const MockComparisonCard = ({
  type,
  title,
  description,
  pros,
  cons,
  icon: Icon,
  color
}: {
  type: 'slaska' | 'radera'
  title: string
  description: string
  pros: string[]
  cons: string[]
  icon: React.ElementType
  color: 'amber' | 'red'
}) => {
  const colorClasses = {
    amber: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      iconBg: 'bg-amber-500/20',
      iconText: 'text-amber-400',
      title: 'text-amber-300'
    },
    red: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      iconBg: 'bg-red-500/20',
      iconText: 'text-red-400',
      title: 'text-red-300'
    }
  }

  const styles = colorClasses[color]

  return (
    <div className={`${styles.bg} ${styles.border} border-2 rounded-2xl p-6`}>
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-14 h-14 rounded-xl ${styles.iconBg} flex items-center justify-center`}>
          <Icon className={`w-7 h-7 ${styles.iconText}`} />
        </div>
        <div>
          <h4 className={`text-xl font-bold ${styles.title}`}>{title}</h4>
          <p className="text-slate-400 text-sm">{description}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Fördelar */}
        <div>
          <h5 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-2">
            <ThumbsUp className="w-4 h-4" />
            Fördelar
          </h5>
          <ul className="space-y-2">
            {pros.map((pro, index) => (
              <li key={index} className="flex items-start gap-2 text-slate-300 text-sm">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                {pro}
              </li>
            ))}
          </ul>
        </div>

        {/* Nackdelar */}
        <div>
          <h5 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
            <ThumbsDown className="w-4 h-4" />
            Nackdelar
          </h5>
          <ul className="space-y-2">
            {cons.map((con, index) => (
              <li key={index} className="flex items-start gap-2 text-slate-300 text-sm">
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                {con}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// Mock: Ärendekort
const MockCaseCard = ({
  status,
  hasData = true
}: {
  status: 'normal' | 'slaskad' | 'deleted'
  hasData?: boolean
}) => {
  if (status === 'deleted') {
    return (
      <div className="p-6 rounded-xl bg-slate-900/50 border-2 border-dashed border-slate-700 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-red-400 font-semibold mb-2">RADERAT</p>
        <p className="text-slate-500 text-sm">Ärendet existerar inte längre</p>
        <p className="text-slate-600 text-xs mt-2">All data är permanent borta</p>
      </div>
    )
  }

  return (
    <div className={`p-5 rounded-xl border-2 ${
      status === 'slaskad'
        ? 'bg-red-500/5 border-red-500/30'
        : 'bg-slate-800/50 border-slate-700'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-white font-semibold text-lg">Familjen Svensson</h4>
          <p className="text-slate-400 text-sm">Myror - Lillgatan 5</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          status === 'slaskad'
            ? 'bg-red-500/20 text-red-300'
            : 'bg-blue-500/20 text-blue-300'
        }`}>
          {status === 'slaskad' ? 'Slaskad' : 'Bokad'}
        </span>
      </div>

      {hasData && (
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-700/50">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <MessageSquare className="w-4 h-4" />
            <span>3 kommentarer</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Image className="w-4 h-4" />
            <span>5 bilder</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <History className="w-4 h-4" />
            <span>Historik</span>
          </div>
        </div>
      )}

      {status === 'slaskad' && (
        <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
          <p className="text-xs text-slate-500 mb-1">Anledning:</p>
          <p className="text-sm text-slate-300">"Kunden avbokade pga flytt"</p>
        </div>
      )}
    </div>
  )
}

// Animerad pil
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

// Glödande highlight
const GlowingHighlight = ({ children, color = 'amber' }: { children: React.ReactNode, color?: 'amber' | 'red' | 'green' }) => {
  const colors = {
    amber: 'rgba(245, 158, 11, 0.4)',
    red: 'rgba(239, 68, 68, 0.4)',
    green: 'rgba(34, 197, 94, 0.4)'
  }

  return (
    <motion.div
      className="relative inline-block"
      animate={{
        boxShadow: [
          `0 0 0 0 ${colors[color].replace('0.4', '0')}`,
          `0 0 20px 8px ${colors[color]}`,
          `0 0 0 0 ${colors[color].replace('0.4', '0')}`
        ]
      }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      {children}
    </motion.div>
  )
}

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
    title: 'Varför raderar vi inte ärenden?',
    subtitle: 'Den viktigaste regeln',
    icon: Shield,
    iconColor: 'text-blue-400',
    content: (
      <div className="space-y-8">
        {/* Hero-sektion */}
        <div className="text-center py-6">
          <motion.div
            className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-500/20 mb-6"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Ban className="w-12 h-12 text-red-400" />
          </motion.div>
          <h3 className="text-2xl font-bold text-white mb-4">
            Radera ALDRIG ett ärende!
          </h3>
          <p className="text-xl text-slate-300 max-w-md mx-auto leading-relaxed">
            I 99% av fallen ska du istället <strong className="text-amber-300">slaska</strong> ärendet - inte radera det.
          </p>
        </div>

        {/* Varning-banner */}
        <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-500/20 rounded-xl">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h4 className="text-xl font-semibold text-red-300 mb-2">
                Vad händer vid radering?
              </h4>
              <ul className="space-y-3 text-lg text-slate-300">
                <li className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <span>All data försvinner <strong className="text-white">PERMANENT</strong></span>
                </li>
                <li className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <span>Kommentarer och bilder raderas</span>
                </li>
                <li className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <span>Historik och tidsloggar försvinner</span>
                </li>
                <li className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <span>Det går <strong className="text-red-300">INTE</strong> att ångra</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Positiv box - Slaska */}
        <div className="bg-green-500/10 border-2 border-green-500/40 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-500/20 rounded-xl">
              <Archive className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h4 className="text-xl font-semibold text-green-300 mb-2">
                Därför "slaskar" vi istället:
              </h4>
              <ul className="space-y-3 text-lg text-slate-300">
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span>All data bevaras för framtida referens</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span>Historiken finns kvar om kunden ringer igen</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span>Kan återöppnas om det behövs</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span>Statistik och rapporter påverkas inte</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: 'Vad är "Slaska"?',
    subtitle: 'Rätt sätt att avsluta ärenden',
    icon: Archive,
    iconColor: 'text-amber-400',
    content: (
      <div className="space-y-8">
        {/* Förklaring */}
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-6">
          <h4 className="text-xl font-semibold text-amber-300 mb-4 flex items-center gap-3">
            <Archive className="w-6 h-6" />
            "Slaska" = Ändra status till "Slaskad"
          </h4>
          <p className="text-lg text-slate-300 leading-relaxed">
            Istället för att radera, ändrar du ärendets <strong className="text-white">status</strong> till
            "Slaskad". Det innebär att ärendet är avbrutet, men all data finns kvar.
          </p>
        </div>

        {/* När ska man slaska? */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-purple-400" />
            När ska du slaska ett ärende?
          </h4>

          <div className="grid grid-cols-1 gap-4">
            {[
              { icon: Ban, text: 'Kunden vill avboka eller avbryta', color: 'text-red-400' },
              { icon: XCircle, text: 'Kunden är inte kontaktbar (svarar inte)', color: 'text-orange-400' },
              { icon: Clock, text: 'Ärendet är inte längre aktuellt', color: 'text-amber-400' },
              { icon: AlertTriangle, text: 'Problem som gör att jobbet inte kan utföras', color: 'text-yellow-400' },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-4 p-4 bg-slate-800/50 border border-slate-700 rounded-xl"
              >
                <div className="p-2 bg-slate-700 rounded-lg">
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <span className="text-lg text-slate-200">{item.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Visuell jämförelse */}
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-white">Så här ser skillnaden ut:</h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-400 uppercase tracking-wider mb-3">Slaskat ärende:</p>
              <MockCaseCard status="slaskad" />
            </div>
            <div>
              <p className="text-sm text-slate-400 uppercase tracking-wider mb-3">Raderat ärende:</p>
              <MockCaseCard status="deleted" />
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 3,
    title: 'Hur slaskar man ett ärende?',
    subtitle: 'Steg-för-steg instruktion',
    icon: Edit3,
    iconColor: 'text-teal-400',
    content: (() => {
      const StatusDemo = () => {
        const [selectedStatus, setSelectedStatus] = useState('')
        const [dropdownOpen, setDropdownOpen] = useState(false)

        return (
          <div className="space-y-8">
            {/* Steg */}
            <div className="bg-teal-500/10 border-2 border-teal-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-teal-300 mb-4 flex items-center gap-3">
                <Edit3 className="w-6 h-6" />
                Steg 1: Öppna ärendet och hitta "Status"
              </h4>
              <ol className="text-lg text-slate-300 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm">1</span>
                  <span>Öppna det ärende du vill slaska</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm">2</span>
                  <span>Hitta "Status"-fältet (ofta längst upp)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm">3</span>
                  <span>Klicka på dropdown-menyn</span>
                </li>
              </ol>
            </div>

            {/* Interaktiv demo */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Prova själv - välj "Slaskad":</p>

              <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-6">
                <label className="block text-slate-300 text-lg mb-3 font-medium">
                  Status:
                </label>
                <MockStatusDropdown
                  selected={selectedStatus}
                  onSelect={setSelectedStatus}
                  isOpen={dropdownOpen}
                  onToggle={() => setDropdownOpen(!dropdownOpen)}
                  animated={!selectedStatus}
                />

                {selectedStatus === 'Slaskad' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3"
                  >
                    <CheckCircle className="w-6 h-6 text-green-400" />
                    <span className="text-green-300 text-lg">
                      Bra! Nu måste du dokumentera anledningen.
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
                    I de flesta vyer kan du snabbt ändra status direkt från ärendelistan
                    utan att öppna hela ärendet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      }

      return <StatusDemo />
    })()
  },
  {
    id: 4,
    title: 'Dokumentera anledningen',
    subtitle: 'KRITISKT STEG - får inte hoppas över!',
    icon: FileText,
    iconColor: 'text-amber-400',
    content: (() => {
      const DocumentationDemo = () => {
        const [documentation, setDocumentation] = useState('')

        const exampleReasons = [
          'Kunden avbokade pga flytt till annan stad',
          'Kunden svarar inte på telefon - försökt 3 gånger',
          'Adressen stämmer inte - fel i systemet',
          'Kunden löste problemet själv',
          'Dubblettärende - se ärende #12345',
        ]

        return (
          <div className="space-y-8">
            {/* Varning */}
            <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-500/20 rounded-xl">
                  <AlertOctagon className="w-8 h-8 text-red-400" />
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-red-300 mb-2">
                    VIKTIGT: Dokumentera ALLTID anledningen!
                  </h4>
                  <p className="text-lg text-slate-300">
                    Innan du sparar status "Slaskad" <strong className="text-white">MÅSTE</strong> du
                    skriva varför ärendet avbryts i "Tekniker dokumentation"-fältet.
                  </p>
                </div>
              </div>
            </div>

            {/* Interaktiv dokumentationsfält */}
            <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-6 space-y-4">
              <MockDocumentationField
                value={documentation}
                onChange={setDocumentation}
                animated={!documentation}
              />

              {documentation.length > 10 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3"
                >
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <span className="text-green-300">Bra dokumenterat! Nu kan du spara.</span>
                </motion.div>
              )}
            </div>

            {/* Exempel på bra anledningar */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white flex items-center gap-3">
                <Lightbulb className="w-5 h-5 text-amber-400" />
                Exempel på bra anledningar:
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {exampleReasons.map((reason, index) => (
                  <motion.button
                    key={index}
                    onClick={() => setDocumentation(reason)}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="text-left p-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                  >
                    "{reason}"
                  </motion.button>
                ))}
              </div>
              <p className="text-sm text-slate-500 italic">
                Klicka på ett exempel för att använda det i fältet ovan
              </p>
            </div>
          </div>
        )
      }

      return <DocumentationDemo />
    })()
  },
  {
    id: 5,
    title: 'När FÅR man radera?',
    subtitle: 'Endast i undantagsfall',
    icon: Trash2,
    iconColor: 'text-red-400',
    content: (
      <div className="space-y-8">
        {/* Intro */}
        <div className="text-center py-4">
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/20 mb-4"
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <AlertTriangle className="w-10 h-10 text-amber-400" />
          </motion.div>
          <h3 className="text-xl font-bold text-white mb-2">
            Radering är endast för undantagsfall
          </h3>
          <p className="text-slate-400">
            I de allra flesta fall ska du slaska istället
          </p>
        </div>

        {/* Godkända skäl */}
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-6">
          <h4 className="text-lg font-semibold text-amber-300 mb-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            Godkända skäl för radering:
          </h4>
          <div className="space-y-4">
            {[
              {
                icon: FileX,
                title: 'Dubblettärende',
                description: 'Om du av misstag skapat en kopia av ett befintligt ärende'
              },
              {
                icon: XCircle,
                title: 'Helt felaktigt ärende',
                description: 'Om ärendet skapats med helt fel kund, adress eller information'
              },
              {
                icon: AlertTriangle,
                title: 'Testärende',
                description: 'Ärenden som skapats för testning och inte ska finnas i systemet'
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700"
              >
                <div className="p-2 bg-amber-500/20 rounded-lg flex-shrink-0">
                  <item.icon className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h5 className="font-semibold text-white">{item.title}</h5>
                  <p className="text-slate-400 text-sm">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Inte godkända skäl */}
        <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-6">
          <h4 className="text-lg font-semibold text-red-300 mb-4 flex items-center gap-3">
            <Ban className="w-5 h-5" />
            INTE godkända skäl för radering:
          </h4>
          <div className="space-y-3">
            {[
              'Kunden avbokade - SLASKA istället',
              'Jobbet kunde inte utföras - SLASKA istället',
              'Kunden är missnöjd - SLASKA istället',
              '"För att rensa upp" - SLASKA istället',
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-3 text-slate-300">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <Info className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
            <div>
              <h5 className="font-semibold text-blue-300 mb-2">Osäker?</h5>
              <p className="text-slate-300">
                Om du är osäker - <strong className="text-white">slaska istället</strong>.
                Det är bättre att ha ett slaskat ärende kvar än att förlora all data permanent.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 6,
    title: 'Hur raderar man?',
    subtitle: 'Danger Zone - endast om absolut nödvändigt',
    icon: AlertOctagon,
    iconColor: 'text-red-400',
    content: (() => {
      const DangerZoneDemo = () => {
        const [showConfirm, setShowConfirm] = useState(false)
        const [deleted, setDeleted] = useState(false)

        const handleDelete = () => {
          if (!showConfirm) {
            setShowConfirm(true)
          } else {
            setDeleted(true)
          }
        }

        if (deleted) {
          return (
            <div className="space-y-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-500/20 border-2 border-red-500/40 rounded-2xl p-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                >
                  <Trash2 className="w-20 h-20 text-red-400 mx-auto mb-4" />
                </motion.div>
                <h4 className="text-2xl font-bold text-red-300 mb-2">Ärendet är raderat</h4>
                <p className="text-lg text-slate-300 mb-4">
                  All data är nu permanent borta.
                </p>
                <button
                  onClick={() => {
                    setDeleted(false)
                    setShowConfirm(false)
                  }}
                  className="text-slate-400 hover:text-white underline"
                >
                  Återställ demo
                </button>
              </motion.div>
            </div>
          )
        }

        return (
          <div className="space-y-8">
            {/* Varning */}
            <div className="bg-red-500/10 border-2 border-red-500/40 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-500/20 rounded-xl">
                  <AlertOctagon className="w-8 h-8 text-red-400" />
                </div>
                <div>
                  <h4 className="text-xl font-semibold text-red-300 mb-2">
                    Använd ENDAST om du är 100% säker
                  </h4>
                  <p className="text-lg text-slate-300">
                    Raderingsknappen finns i "Danger Zone" längst ner i ärendets redigeringsläge.
                  </p>
                </div>
              </div>
            </div>

            {/* Simulerad modal */}
            <div className="bg-slate-900 rounded-2xl border-2 border-slate-700 overflow-hidden">
              {/* Modal header */}
              <div className="bg-slate-800/50 border-b border-slate-700 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold">Redigera ärende: Test</h3>
                  <button className="p-1 text-slate-400">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Innehåll (suddig) */}
              <div className="p-4 opacity-30 blur-[2px]">
                <div className="h-16 bg-slate-800 rounded-lg mb-3"></div>
                <div className="h-24 bg-slate-800 rounded-lg"></div>
              </div>

              {/* Danger Zone */}
              <div className="p-6">
                <GlowingHighlight color="red">
                  <MockDangerZone
                    onDelete={handleDelete}
                    animated={!showConfirm}
                    showWarning={!showConfirm}
                  />
                </GlowingHighlight>

                {showConfirm && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-red-500/20 border-2 border-red-500/40 rounded-xl"
                  >
                    <p className="text-red-300 font-semibold mb-3">
                      Är du HELT säker? Klicka igen för att radera permanent.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowConfirm(false)}
                        className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                      >
                        Avbryt
                      </button>
                      <button
                        onClick={handleDelete}
                        className="flex-1 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg transition-colors"
                      >
                        Ja, radera
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        )
      }

      return <DangerZoneDemo />
    })()
  },
  {
    id: 7,
    title: 'Sammanfattning',
    subtitle: 'Checklista att komma ihåg',
    icon: CheckCircle,
    iconColor: 'text-green-400',
    content: (
      <div className="space-y-8">
        {/* Jämförelse-tabell */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MockComparisonCard
            type="slaska"
            title="SLASKA"
            description="Det rätta sättet"
            icon={Archive}
            color="amber"
            pros={[
              'All data bevaras',
              'Kan återöppnas om nödvändigt',
              'Historik finns kvar',
              'Påverkar inte statistik negativt',
            ]}
            cons={[
              'Ärendet syns fortfarande i systemet',
              'Kräver dokumentation',
            ]}
          />
          <MockComparisonCard
            type="radera"
            title="RADERA"
            description="Endast i undantagsfall"
            icon={Trash2}
            color="red"
            pros={[
              'Ärendet försvinner helt',
              'Rensar upp dubbletter',
            ]}
            cons={[
              'Permanent - kan INTE ångras',
              'All data försvinner',
              'Ingen historik kvar',
              'Svårare att förklara för kund',
            ]}
          />
        </div>

        {/* Checklista */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h4 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
            Checklista innan du gör något:
          </h4>

          <div className="space-y-4">
            {[
              { text: 'Är det verkligen nödvändigt att avsluta ärendet?', important: false },
              { text: 'Kan jag SLASKA istället för att radera?', important: true },
              { text: 'Har jag dokumenterat anledningen?', important: true },
              { text: 'Är det en dubblett/testärende? Bara då kan jag radera.', important: false },
              { text: 'Är jag 100% säker? Radering kan INTE ångras.', important: true },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center gap-4 p-4 rounded-xl border ${
                  item.important
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-slate-800/30 border-slate-700'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  item.important ? 'bg-amber-500/20' : 'bg-slate-700'
                }`}>
                  <CheckCircle2 className={`w-5 h-5 ${
                    item.important ? 'text-amber-400' : 'text-slate-400'
                  }`} />
                </div>
                <span className={`text-lg ${
                  item.important ? 'text-amber-200 font-medium' : 'text-slate-300'
                }`}>
                  {item.text}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Huvudregel */}
        <div className="bg-gradient-to-r from-green-500/20 to-teal-500/20 rounded-2xl p-8 border border-green-500/30 text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-block mb-4"
          >
            <Shield className="w-16 h-16 text-green-400" />
          </motion.div>
          <h4 className="text-2xl font-bold text-green-300 mb-3">
            Huvudregeln:
          </h4>
          <p className="text-xl text-white mb-2">
            Osäker? <span className="text-amber-300 font-bold">SLASKA!</span>
          </p>
          <p className="text-slate-400">
            Det är alltid bättre att slaska än att radera.
            All data bevaras och kan behövas senare.
          </p>
        </div>
      </div>
    )
  }
]

// ============================================================================
// HUVUDKOMPONENT
// ============================================================================

export default function CaseDeletionGuide() {
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
              <h1 className="text-lg font-semibold text-white">Guide: Radera vs Slaska</h1>
              <p className="text-sm text-slate-400">Steg {currentStep + 1} av {guideSteps.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
          </div>

          {/* Progress bar */}
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
            {/* Mobil steg-indikator */}
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
                  {/* Steghuvud */}
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

            {/* Navigeringsknappar */}
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

            {/* Snabbhjälp */}
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
