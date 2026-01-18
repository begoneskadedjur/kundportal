// src/pages/technician/guides/TicketSystemGuide.tsx
// SUPER-PEDAGOGISK GUIDE: Ticketsystemet
// Version 1.1 - Optimerad för alla interna medarbetare (admin, koordinatorer, tekniker)
// Fokus: Hur man använder ticketsystemet för effektiv intern kommunikation

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Ticket,
  MessageSquareText,
  AtSign,
  Users,
  Bell,
  Inbox,
  CheckCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Lightbulb,
  ThumbsUp,
  AlertTriangle,
  Sparkles,
  X,
  Search,
  Archive,
  Circle,
  MessageCircle,
  User,
  ArrowDown,
  MousePointer2,
  FileText,
  Receipt,
  Zap,
  Target,
  Send,
  CornerDownRight,
  Filter
} from 'lucide-react'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'

// ============================================================================
// MOCK-KOMPONENTER - Visar hur riktiga UI-element ser ut
// ============================================================================

// Mock: Ticket-kort som visar en ticket i listan
const MockTicketCard = ({
  title,
  caseType,
  preview,
  author,
  time,
  status,
  isNew = false,
  mentions = [],
  animated = false,
  onClick
}: {
  title: string
  caseType: 'private' | 'business' | 'contract'
  preview: string
  author: string
  time: string
  status: 'waiting_for_you' | 'waiting_for_others' | 'new_activity' | 'resolved'
  isNew?: boolean
  mentions?: string[]
  animated?: boolean
  onClick?: () => void
}) => {
  const statusConfig = {
    waiting_for_you: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      badge: 'bg-red-500/20 text-red-400',
      label: 'Väntar på ditt svar'
    },
    waiting_for_others: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      badge: 'bg-amber-500/20 text-amber-400',
      label: 'Väntar på andras svar'
    },
    new_activity: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      badge: 'bg-blue-500/20 text-blue-400',
      label: 'Ny aktivitet'
    },
    resolved: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
      badge: 'bg-green-500/20 text-green-400',
      label: 'Löst'
    }
  }

  const caseTypeLabels = {
    private: { label: 'Privat', color: 'text-purple-400' },
    business: { label: 'Företag', color: 'text-blue-400' },
    contract: { label: 'Avtal', color: 'text-emerald-400' }
  }

  const config = statusConfig[status]
  const caseLabel = caseTypeLabels[caseType]

  return (
    <motion.button
      onClick={onClick}
      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${config.bg} ${config.border} hover:scale-[1.02]`}
      animate={animated ? {
        boxShadow: [
          '0 0 0 0 rgba(6, 182, 212, 0)',
          '0 0 15px 5px rgba(6, 182, 212, 0.3)',
          '0 0 0 0 rgba(6, 182, 212, 0)'
        ]
      } : {}}
      transition={animated ? { duration: 2, repeat: Infinity } : {}}
      whileTap={{ scale: 0.98 }}
    >
      {isNew && (
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-medium mb-2">
          <Sparkles className="w-3 h-3" />
          NY TICKET!
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-white font-semibold truncate">{title}</h4>
          <p className={`text-sm ${caseLabel.color}`}>{caseLabel.label}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ml-2 ${config.badge}`}>
          {config.label}
        </span>
      </div>

      <p className="text-sm text-slate-300 mb-2 line-clamp-2">{preview}</p>

      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {mentions.map((mention, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
              {mention}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Clock className="w-3 h-3" />
        <span>{author}, {time}</span>
      </div>
    </motion.button>
  )
}

// Mock: Filter-flikar för Tickets-sidan
const MockFilterTabs = ({
  activeTab,
  onSelect,
  counts = { mentions: 3, replies_to_me: 1, replies: 2, activity: 5, all: 15, archived: 8 }
}: {
  activeTab: string
  onSelect: (tab: string) => void
  counts?: { mentions: number; replies_to_me: number; replies: number; activity: number; all: number; archived: number }
}) => {
  const tabs = [
    { id: 'mentions', label: 'Väntar på ditt svar', shortLabel: 'Att göra', count: counts.mentions, color: 'red', icon: AtSign },
    { id: 'replies_to_me', label: 'Svar till dig', shortLabel: 'Svar', count: counts.replies_to_me, color: 'orange', icon: CornerDownRight },
    { id: 'replies', label: 'Väntar på andras svar', shortLabel: 'Bevaka', count: counts.replies, color: 'amber', icon: MessageCircle },
    { id: 'activity', label: 'Ny aktivitet', shortLabel: 'Nytt', count: counts.activity, color: 'blue', icon: Bell },
    { id: 'all', label: 'Alla tickets', shortLabel: 'Alla', count: counts.all, color: 'slate', icon: Inbox },
    { id: 'archived', label: 'Avslutade', shortLabel: 'Klart', count: counts.archived, color: 'green', icon: Archive }
  ]

  const getColorClasses = (color: string, isActive: boolean) => {
    if (isActive) {
      switch (color) {
        case 'red': return 'bg-red-600 text-white ring-2 ring-red-500/30'
        case 'orange': return 'bg-orange-600 text-white ring-2 ring-orange-500/30'
        case 'amber': return 'bg-amber-600 text-white ring-2 ring-amber-500/30'
        case 'blue': return 'bg-blue-600 text-white ring-2 ring-blue-500/30'
        case 'green': return 'bg-green-600 text-white ring-2 ring-green-500/30'
        default: return 'bg-slate-600 text-white ring-2 ring-slate-500/30'
      }
    }
    return 'bg-slate-800 text-slate-400 hover:bg-slate-700'
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${getColorClasses(tab.color, activeTab === tab.id)}`}
        >
          <tab.icon className="w-4 h-4" />
          <span className="hidden sm:inline">{tab.label}</span>
          <span className="sm:hidden">{tab.shortLabel}</span>
          {tab.count > 0 && (
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              activeTab === tab.id ? 'bg-white/20' : 'bg-slate-700'
            }`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// Mock: Kommentarsinput med @mention-stöd
const MockCommentInput = ({
  value = '',
  onChange,
  onSubmit,
  placeholder = 'Skriv ett meddelande...',
  disabled = false
}: {
  value?: string
  onChange?: (value: string) => void
  onSubmit?: () => void
  placeholder?: string
  disabled?: boolean
}) => (
  <div className="flex items-end gap-2 bg-slate-800/70 border-2 border-slate-600 rounded-xl p-3 focus-within:border-cyan-500 transition-colors">
    <textarea
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="flex-1 bg-transparent text-white placeholder:text-slate-500 resize-none outline-none min-h-[48px] text-lg"
      rows={2}
    />
    <motion.button
      onClick={onSubmit}
      disabled={disabled || !value.trim()}
      className={`p-3 rounded-lg transition-all ${
        value.trim()
          ? 'bg-cyan-500 hover:bg-cyan-400 text-white'
          : 'bg-slate-700 text-slate-500 cursor-not-allowed'
      }`}
      whileTap={value.trim() ? { scale: 0.95 } : {}}
    >
      <Send className="w-5 h-5" />
    </motion.button>
  </div>
)

// Mock: Markera löst-knapp
const MockResolveButton = ({
  onClick,
  animated = false,
  resolved = false
}: {
  onClick?: () => void
  animated?: boolean
  resolved?: boolean
}) => (
  <motion.button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      resolved
        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
        : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30'
    }`}
    animate={animated && !resolved ? {
      boxShadow: [
        '0 0 0 0 rgba(34, 197, 94, 0)',
        '0 0 10px 3px rgba(34, 197, 94, 0.3)',
        '0 0 0 0 rgba(34, 197, 94, 0)'
      ]
    } : {}}
    transition={animated ? { duration: 2, repeat: Infinity } : {}}
    whileTap={{ scale: 0.98 }}
  >
    <CheckCircle2 className="w-4 h-4" />
    {resolved ? 'Löst!' : 'Markera löst'}
  </motion.button>
)

// Glödande highlight-ring
const GlowingHighlight = ({ children, color = 'cyan' }: { children: React.ReactNode, color?: 'cyan' | 'green' | 'purple' | 'amber' | 'red' }) => {
  const colors = {
    cyan: 'rgba(6, 182, 212, 0.4)',
    green: 'rgba(34, 197, 94, 0.4)',
    purple: 'rgba(168, 85, 247, 0.4)',
    amber: 'rgba(245, 158, 11, 0.4)',
    red: 'rgba(239, 68, 68, 0.4)'
  }

  return (
    <motion.div
      className="relative inline-block w-full"
      animate={{
        boxShadow: [
          `0 0 0 0 transparent`,
          `0 0 20px 8px ${colors[color]}`,
          `0 0 0 0 transparent`
        ]
      }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      {children}
    </motion.div>
  )
}

// Animerad pil
const AnimatedArrow = ({ direction = 'down' }: { direction?: 'down' | 'right' | 'up' }) => (
  <motion.div
    className="flex justify-center py-2"
    animate={{
      y: direction === 'down' ? [0, 8, 0] : direction === 'up' ? [0, -8, 0] : 0,
      x: direction === 'right' ? [0, 8, 0] : 0
    }}
    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
  >
    {direction === 'down' ? (
      <ArrowDown className="w-6 h-6 text-cyan-400" />
    ) : direction === 'up' ? (
      <ArrowDown className="w-6 h-6 text-cyan-400 rotate-180" />
    ) : (
      <ChevronRight className="w-6 h-6 text-cyan-400" />
    )}
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
    title: 'Vad är en ticket?',
    subtitle: 'Grundläggande koncept',
    icon: Ticket,
    iconColor: 'text-cyan-400',
    content: (
      <div className="space-y-8">
        {/* Hero-sektion */}
        <div className="text-center py-6">
          <motion.div
            className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-cyan-500/20 mb-6"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Ticket className="w-12 h-12 text-cyan-400" />
          </motion.div>
          <h3 className="text-2xl font-bold text-white mb-4">
            En ticket = En sparbar fråga
          </h3>
          <p className="text-xl text-slate-300 max-w-md mx-auto leading-relaxed">
            När du skriver en kommentar med <strong className="text-purple-300">@namn</strong> i ett ärende skapas en <strong className="text-cyan-300">ticket</strong> - en sparbar tråd som följs upp tills den är löst.
          </p>
        </div>

        {/* Scenario-kort */}
        <div className="bg-gradient-to-r from-slate-800/80 to-slate-800/40 rounded-2xl p-6 border border-slate-700">
          <h4 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-3">
            <Lightbulb className="w-6 h-6" />
            Typiskt exempel:
          </h4>
          <div className="space-y-4 text-lg text-slate-300">
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">1</span>
              <p>Tekniker skriver: <strong className="text-purple-300">"@Admin Klar att fakturera"</strong></p>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">2</span>
              <p>En <strong className="text-cyan-300">ticket</strong> skapas och Admin får en notis</p>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-bold">3</span>
              <p>Admin svarar: <strong className="text-white">"Fakturerat! Faktura #12345"</strong></p>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-bold">4</span>
              <p>Admin klickar <strong className="text-green-300">"Markera löst"</strong> - klart!</p>
            </div>
          </div>
        </div>

        {/* Fördelar */}
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <ThumbsUp className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-green-300">Minska ledtider</h5>
              <p className="text-slate-400">Ingen väntar på mejl eller telefonsamtal - allt sker direkt</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <ThumbsUp className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-green-300">Full sparbarhet</h5>
              <p className="text-slate-400">Alla frågor och svar sparas - perfekt för revision och uppföljning</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <ThumbsUp className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-green-300">Sökbar historik</h5>
              <p className="text-slate-400">Sök på fakturanummer, nyckelord eller namn</p>
            </div>
          </div>
        </div>

        {/* Ersätter ClickUp */}
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <Zap className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h4 className="text-xl font-semibold text-amber-300 mb-2">
                Ersätter mejl och ClickUp-kommentarer
              </h4>
              <p className="text-lg text-slate-300">
                Istället för att skicka mejl eller skriva i ClickUp, använder ni nu <strong className="text-white">ticketsystemet</strong> för all intern kommunikation. Allt samlas på ett ställe!
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: 'De 6 flikarna',
    subtitle: 'Översikt i Tickets',
    icon: Filter,
    iconColor: 'text-purple-400',
    content: (() => {
      const TabsDemo = () => {
        const [activeTab, setActiveTab] = useState('mentions')

        const tabDescriptions: Record<string, { title: string; description: string; examples: string[] }> = {
          mentions: {
            title: 'Väntar på DITT svar',
            description: 'Någon har @nämnt dig och väntar på att du ska svara eller agera. Detta är din "att-göra-lista".',
            examples: [
              '"@Tekniker" - Kan du kolla när du är där?',
              '"@Admin" - Vi behöver godkännande för offerten',
              '"@Koordinator" - Kunden vill boka om'
            ]
          },
          replies_to_me: {
            title: 'Svar till dig',
            description: 'Någon har svarat på din kommentar, även om de inte @nämnde dig. Bra att kolla för att hålla koll på konversationer du deltar i.',
            examples: [
              'Du skrev en kommentar → Erik svarade på den',
              'Du ställde en fråga → Anna svarade med mer info',
              'Du la till en notering → Kollegan följde upp'
            ]
          },
          replies: {
            title: 'Väntar på ANDRAS svar',
            description: 'Du har ställt en fråga till någon annan och väntar på deras svar. Bevaka dessa!',
            examples: [
              'Du skrev: "@Admin" - Klar att fakturera',
              'Du skrev: "@Koordinator" - När ska jag åka dit?',
              'Du skrev: "@Tekniker" - Har du materialet?'
            ]
          },
          activity: {
            title: 'Ny aktivitet',
            description: 'Tickets där det kommit nya kommentarer som du inte läst ännu.',
            examples: [
              'Erik svarade på din fråga',
              'Anna la till en kommentar',
              'Ny uppdatering i ärendet'
            ]
          },
          all: {
            title: 'Alla tickets',
            description: 'Komplett översikt över alla öppna tickets där du är involverad på något sätt.',
            examples: [
              'Alla aktiva diskussioner',
              'Frågor du följer',
              'Ärenden du arbetat med'
            ]
          },
          archived: {
            title: 'Avslutade tickets',
            description: 'Lösta tickets. Bra jobbat! Dessa kan du söka i om du behöver hitta gammal information.',
            examples: [
              'Fakturerade ärenden',
              'Besvarade frågor',
              'Avklarade uppgifter'
            ]
          }
        }

        const current = tabDescriptions[activeTab]

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-purple-500/10 border-2 border-purple-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-purple-300 mb-3 flex items-center gap-3">
                <Filter className="w-6 h-6" />
                Sex flikar - sex syften:
              </h4>
              <p className="text-lg text-slate-300">
                I <strong className="text-white">Tickets</strong> finns sex flikar som hjälper dig att prioritera och organisera ditt arbete.
              </p>
            </div>

            {/* Interaktiva flikar */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Prova - klicka på en flik:</p>

              <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5 space-y-4">
                <MockFilterTabs activeTab={activeTab} onSelect={setActiveTab} />

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-5 bg-slate-800/50 rounded-xl border border-slate-700"
                  >
                    <h5 className="text-lg font-semibold text-white mb-2">{current.title}</h5>
                    <p className="text-slate-300 mb-4">{current.description}</p>

                    <div className="space-y-2">
                      <p className="text-sm text-slate-400">Exempel:</p>
                      {current.examples.map((example, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                          <ChevronRight className="w-4 h-4 text-cyan-400" />
                          <span>{example}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Färgkoder */}
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
              <h5 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Färgkodernas betydelse:
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-red-500" />
                  <span className="text-red-300 font-medium">Röd</span>
                  <span className="text-slate-400 text-sm">= Väntar på DIG</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-orange-500" />
                  <span className="text-orange-300 font-medium">Orange</span>
                  <span className="text-slate-400 text-sm">= Svar till dig</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-amber-500" />
                  <span className="text-amber-300 font-medium">Gul</span>
                  <span className="text-slate-400 text-sm">= Väntar på ANDRA</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-blue-500" />
                  <span className="text-blue-300 font-medium">Blå</span>
                  <span className="text-slate-400 text-sm">= Olästa nyheter</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-green-500" />
                  <span className="text-green-300 font-medium">Grön</span>
                  <span className="text-slate-400 text-sm">= Avklarade/lösta</span>
                </div>
              </div>
            </div>
          </div>
        )
      }

      return <TabsDemo />
    })()
  },
  {
    id: 3,
    title: 'Skapa en ticket',
    subtitle: 'Så här börjar du en konversation',
    icon: MessageSquareText,
    iconColor: 'text-cyan-400',
    content: (() => {
      const CreateTicketDemo = () => {
        const [text, setText] = useState('')
        const [ticketCreated, setTicketCreated] = useState(false)

        const handleSubmit = () => {
          if (text.includes('@')) {
            setTicketCreated(true)
          }
        }

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-cyan-500/10 border-2 border-cyan-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-cyan-300 mb-3 flex items-center gap-3">
                <MessageSquareText className="w-6 h-6" />
                Tre enkla steg:
              </h4>
              <ol className="text-lg text-slate-300 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">1</span>
                  <span>Öppna ett <strong className="text-white">ärende</strong> (privat, företag eller avtal)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">2</span>
                  <span>Klicka på <strong className="text-purple-300">pratbubblan</strong> i övre högra hörnet</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">3</span>
                  <span>Skriv din kommentar med <strong className="text-purple-300">@namn</strong></span>
                </li>
              </ol>
            </div>

            {/* Demo */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Prova - skriv ett meddelande med @:</p>

              <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5 space-y-4">
                {!ticketCreated ? (
                  <>
                    <GlowingHighlight color="cyan">
                      <MockCommentInput
                        value={text}
                        onChange={setText}
                        onSubmit={handleSubmit}
                        placeholder="Skriv t.ex. '@Admin Klar att fakturera'..."
                      />
                    </GlowingHighlight>

                    {!text.includes('@') && text.length > 0 && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <p className="text-amber-300 text-sm flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Glöm inte att tagga någon med @ för att skapa en ticket!
                        </p>
                      </div>
                    )}

                    {text.includes('@') && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg"
                      >
                        <p className="text-green-300 text-sm flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Bra! Du har taggat någon. Klicka på skicka-knappen!
                        </p>
                      </motion.div>
                    )}
                  </>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4"
                  >
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
                      <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                      <h5 className="text-lg font-semibold text-green-300 mb-2">Ticket skapad!</h5>
                      <p className="text-slate-300">
                        Den du taggade får nu en notis och ticketen visas i deras "Väntar på ditt svar"-flik.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setTicketCreated(false)
                        setText('')
                      }}
                      className="text-slate-400 hover:text-white text-sm underline"
                    >
                      Prova igen
                    </button>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Tips om mentions */}
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-5">
              <div className="flex items-start gap-4">
                <AtSign className="w-6 h-6 text-purple-400 flex-shrink-0 mt-1" />
                <div>
                  <h5 className="font-semibold text-purple-300 mb-2">Vem kan du tagga?</h5>
                  <div className="space-y-2 text-slate-300">
                    <p><strong className="text-purple-300">@Förnamn Efternamn</strong> - en specifik person</p>
                    <p><strong className="text-amber-300">@Admin / @Koordinator / @Tekniker</strong> - alla med den rollen</p>
                    <p><strong className="text-cyan-300">@alla</strong> - alla med tillgång till ärendet</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      return <CreateTicketDemo />
    })()
  },
  {
    id: 4,
    title: 'Svara på en ticket',
    subtitle: 'Hur du svarar och följer upp',
    icon: CornerDownRight,
    iconColor: 'text-amber-400',
    content: (() => {
      const ReplyDemo = () => {
        const [step, setStep] = useState(0)

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-amber-300 mb-3 flex items-center gap-3">
                <CornerDownRight className="w-6 h-6" />
                Steg för att svara:
              </h4>
              <ol className="text-lg text-slate-300 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">1</span>
                  <span>Hitta ticketen i <strong className="text-white">Tickets</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">2</span>
                  <span><strong className="text-cyan-300">Klicka på ticketen</strong> för att öppna ärendet</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">3</span>
                  <span>Skriv ditt svar i kommunikationspanelen</span>
                </li>
              </ol>
            </div>

            {/* Interaktiv demo */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Prova - klicka på ticketen:</p>

              <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5 space-y-4">
                {step === 0 && (
                  <GlowingHighlight color="cyan">
                    <MockTicketCard
                      title="Familjen Andersson - Råttor"
                      caseType="private"
                      preview="När kan du åka dit för uppföljning?"
                      author="Anna K."
                      time="1 timme sedan"
                      status="waiting_for_you"
                      mentions={['@Tekniker']}
                      animated
                      onClick={() => setStep(1)}
                    />
                  </GlowingHighlight>
                )}

                {step === 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {/* Simulerad kommunikationspanel */}
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-700">
                        <MessageSquareText className="w-5 h-5 text-purple-400" />
                        <span className="font-semibold text-white">Kommunikation</span>
                      </div>

                      {/* Original-meddelande */}
                      <div className="p-3 bg-slate-800 rounded-lg mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-amber-500/20" />
                          <span className="text-sm font-medium text-white">Anna K.</span>
                          <span className="text-xs text-slate-500">1 timme sedan</span>
                        </div>
                        <p className="text-slate-300">
                          <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-sm">@Tekniker</span>
                          {' '}När kan du åka dit för uppföljning?
                        </p>
                      </div>

                      <GlowingHighlight color="cyan">
                        <MockCommentInput
                          placeholder="Skriv ditt svar..."
                          value=""
                          onChange={() => setStep(2)}
                        />
                      </GlowingHighlight>
                    </div>

                    <p className="text-center text-slate-400">Klicka på textfältet för att fortsätta...</p>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-center"
                  >
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <h5 className="text-lg font-semibold text-green-300 mb-2">Perfekt!</h5>
                    <p className="text-slate-300 mb-4">
                      När du skickar ditt svar flyttas ticketen från "Väntar på ditt svar" till "Väntar på andras svar".
                    </p>
                    <button
                      onClick={() => setStep(0)}
                      className="text-slate-400 hover:text-white text-sm underline"
                    >
                      Börja om
                    </button>
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
                    Du kan också öppna ärendet direkt från <strong className="text-white">notifikationsikonen</strong> i menyn när någon taggar dig.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      }

      return <ReplyDemo />
    })()
  },
  {
    id: 5,
    title: 'Markera som löst',
    subtitle: 'Avsluta en ticket',
    icon: CheckCircle2,
    iconColor: 'text-green-400',
    content: (() => {
      const ResolveDemo = () => {
        const [resolved, setResolved] = useState(false)

        return (
          <div className="space-y-8">
            {/* Instruktion */}
            <div className="bg-green-500/10 border-2 border-green-500/30 rounded-2xl p-6">
              <h4 className="text-xl font-semibold text-green-300 mb-3 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6" />
                När är en ticket "löst"?
              </h4>
              <p className="text-lg text-slate-300">
                När frågan är besvarad och ingen mer åtgärd krävs, klickar du på <strong className="text-green-300">"Markera löst"</strong>. Ticketen flyttas då till Avslutade-fliken.
              </p>
            </div>

            {/* Demo */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Prova - markera ticketen som löst:</p>

              <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5 space-y-4">
                <div className={`p-4 rounded-xl border-2 transition-all ${
                  resolved
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-white font-semibold">Restaurang Smak AB</h4>
                      <p className="text-sm text-blue-400">Företag</p>
                    </div>
                    {resolved && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Löst
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-sm text-slate-300">
                        <span className="text-purple-300">@Admin</span> Klar att fakturera
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Erik T., igår</p>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-lg border-l-2 border-cyan-500/50 ml-4">
                      <p className="text-sm text-slate-300">
                        Fakturerat! Faktura #12345
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Du, 2 timmar sedan</p>
                    </div>
                  </div>

                  {!resolved && (
                    <GlowingHighlight color="green">
                      <MockResolveButton
                        onClick={() => setResolved(true)}
                        animated
                      />
                    </GlowingHighlight>
                  )}
                </div>

                {resolved && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl"
                  >
                    <div className="flex items-center gap-3 text-green-300">
                      <CheckCircle className="w-6 h-6" />
                      <div>
                        <span className="text-lg font-medium">Ticket löst!</span>
                        <p className="text-sm text-slate-400">
                          Ticketen är nu arkiverad och finns under "Avslutade". Du kan återöppna den om det behövs.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setResolved(false)}
                      className="mt-3 text-slate-400 hover:text-white text-sm underline"
                    >
                      Återställ demo
                    </button>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Vem kan lösa? */}
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
              <h5 className="font-semibold text-white mb-4">Vem kan markera en ticket som löst?</h5>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span>Den som <strong className="text-white">skapade</strong> ticketen</span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span>Den som blev <strong className="text-white">taggad</strong> i ticketen</span>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <span><strong className="text-white">Admin</strong> kan alltid markera som löst</span>
                </div>
              </div>
            </div>
          </div>
        )
      }

      return <ResolveDemo />
    })()
  },
  {
    id: 6,
    title: 'Vanliga arbetsflöden',
    subtitle: 'Exempel från vardagen',
    icon: Zap,
    iconColor: 'text-amber-400',
    content: (
      <div className="space-y-8">
        {/* Intro */}
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-6">
          <h4 className="text-xl font-semibold text-amber-300 mb-3 flex items-center gap-3">
            <Zap className="w-6 h-6" />
            Här är tre vanliga arbetsflöden:
          </h4>
          <p className="text-lg text-slate-300">
            Se hur ticketsystemet används i praktiken för att effektivisera kommunikationen.
          </p>
        </div>

        {/* Arbetsflöde 1: Fakturering */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Receipt className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white">Fakturering</h4>
              <p className="text-sm text-slate-400">Tekniker - Admin</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Tekniker:</p>
                <p className="text-slate-200">"<span className="text-purple-300">@Admin</span> Ärendet är klart. Klar att fakturera."</p>
              </div>
            </div>
            <AnimatedArrow />
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Admin:</p>
                <p className="text-slate-200">"Fakturerat! Faktura #12345"</p>
                <p className="text-green-400 text-sm mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Markerar som löst
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Arbetsflöde 2: Kundfråga */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <MessageCircle className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white">Kundfråga</h4>
              <p className="text-sm text-slate-400">Koordinator - Tekniker</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Koordinator:</p>
                <p className="text-slate-200">"<span className="text-purple-300">@Erik Tekniker</span> Kunden undrar vad du hittade vid senaste besöket?"</p>
              </div>
            </div>
            <AnimatedArrow />
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Tekniker:</p>
                <p className="text-slate-200">"Hittade spår av mörkråttan vid ingången. Satte ut extra fällor."</p>
              </div>
            </div>
            <AnimatedArrow />
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Koordinator:</p>
                <p className="text-slate-200">"Tack! Återrapporterar till kunden."</p>
                <p className="text-green-400 text-sm mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Markerar som löst
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Arbetsflöde 3: Betalningspåminnelse */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white">Betalningspåminnelse</h4>
              <p className="text-sm text-slate-400">Admin - Tekniker</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Admin:</p>
                <p className="text-slate-200">"<span className="text-purple-300">@Erik Tekniker</span> Kunden har inte betalat faktura #12345. Kan du höra av dig när du är där nästa gång?"</p>
              </div>
            </div>
            <AnimatedArrow />
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Tekniker:</p>
                <p className="text-slate-200">"Pratade med dom idag, de betalar i morgon."</p>
                <p className="text-green-400 text-sm mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Markerar som löst
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 7,
    title: 'Sök och hitta',
    subtitle: 'Hitta gamla tickets snabbt',
    icon: Search,
    iconColor: 'text-blue-400',
    content: (
      <div className="space-y-8">
        {/* Instruktion */}
        <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-2xl p-6">
          <h4 className="text-xl font-semibold text-blue-300 mb-3 flex items-center gap-3">
            <Search className="w-6 h-6" />
            Sök på vad som helst:
          </h4>
          <p className="text-lg text-slate-300">
            Använd sökfältet i <strong className="text-white">Tickets</strong> för att hitta tickets baserat på nyckelord, fakturanummer, kundnamn eller annat.
          </p>
        </div>

        {/* Simulerat sökfält */}
        <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl focus-within:border-cyan-500 transition-colors">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Sök nyckelord, fakturanr, kundnamn..."
                className="flex-1 bg-transparent text-white placeholder:text-slate-500 outline-none text-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-400 mb-1">Sök på fakturanummer:</p>
              <p className="text-cyan-400 font-mono">"12345"</p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-400 mb-1">Sök på kundnamn:</p>
              <p className="text-cyan-400 font-mono">"IKEA"</p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-400 mb-1">Sök på nyckelord:</p>
              <p className="text-cyan-400 font-mono">"fakturering"</p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-400 mb-1">Sök på personnamn:</p>
              <p className="text-cyan-400 font-mono">"Anna"</p>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <Lightbulb className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
            <div>
              <h5 className="font-semibold text-amber-300 mb-2">Tips för effektiv sökning:</h5>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-amber-400 mt-1 flex-shrink-0" />
                  <span>Sökningen letar i <strong className="text-white">alla flikar</strong> - både aktiva och arkiverade</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-amber-400 mt-1 flex-shrink-0" />
                  <span>Du kan söka på <strong className="text-white">delar av ord</strong> - "faktur" hittar "fakturering"</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-amber-400 mt-1 flex-shrink-0" />
                  <span>Använd <strong className="text-white">Avslutade-fliken</strong> för att begränsa sökningen till lösta ärenden</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 8,
    title: 'Vanliga frågor (FAQ)',
    subtitle: 'Svar på det du undrar',
    icon: HelpCircle,
    iconColor: 'text-pink-400',
    content: (
      <div className="space-y-6">
        {/* FAQ-kort */}
        {[
          {
            question: 'Vad är skillnaden på en ticket och en vanlig kommentar?',
            answer: 'En ticket skapas när du taggar någon med @. Den följs upp och har en status (öppen/löst). Kommentarer utan @ är bara anteckningar.',
            icon: Ticket
          },
          {
            question: 'Kan kunder se mina tickets?',
            answer: 'NEJ! Alla tickets och intern kommunikation är 100% internt. Kunder - oavsett typ - kan aldrig se detta.',
            icon: Users
          },
          {
            question: 'Hur vet jag när någon svarar?',
            answer: 'Du får en notifikation (klockan i menyn). Dessutom flyttas ticketen till "Ny aktivitet"-fliken.',
            icon: Bell
          },
          {
            question: 'Kan jag återöppna en löst ticket?',
            answer: 'Ja! Gå till Avslutade-fliken, öppna ticketen och klicka "Återöppna". Ticketen blir aktiv igen.',
            icon: Archive
          },
          {
            question: 'Vad händer om jag taggar @alla?',
            answer: 'Alla med tillgång till ärendet får en notis. Använd sparsamt - bara när det verkligen gäller alla.',
            icon: Users
          },
          {
            question: 'Hur hittar jag en gammal ticket?',
            answer: 'Använd sökfältet i Tickets. Du kan söka på fakturanummer, kundnamn, nyckelord mm.',
            icon: Search
          },
          {
            question: 'Kan jag se vem som läst min ticket?',
            answer: 'Nej, men du ser när någon svarar. Om ingen svarar ligger ticketen kvar i deras "Väntar på ditt svar"-flik.',
            icon: CheckCircle2
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
    id: 9,
    title: 'Sammanfattning',
    subtitle: 'Allt du behöver komma ihåg',
    icon: CheckCircle,
    iconColor: 'text-green-400',
    content: (
      <div className="space-y-8">
        {/* Huvudpunkter */}
        <div className="space-y-4">
          <h4 className="text-xl font-semibold text-white text-center mb-6">
            5 saker att komma ihåg:
          </h4>

          {[
            { step: 1, text: 'Skriv @namn i en kommentar = skapa ticket', color: 'cyan', icon: AtSign },
            { step: 2, text: 'Kolla "Väntar på ditt svar" dagligen', color: 'red', icon: Inbox },
            { step: 3, text: 'Svara snabbt - minska ledtider!', color: 'amber', icon: Zap },
            { step: 4, text: 'Markera som löst när klart', color: 'green', icon: CheckCircle2 },
            { step: 5, text: 'Sök för att hitta gammal info', color: 'blue', icon: Search },
          ].map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.15 }}
              className="flex items-center gap-4 p-5 rounded-xl"
              style={{
                background: `rgba(${
                  item.color === 'cyan' ? '6, 182, 212' :
                  item.color === 'red' ? '239, 68, 68' :
                  item.color === 'amber' ? '245, 158, 11' :
                  item.color === 'green' ? '34, 197, 94' :
                  '59, 130, 246'
                }, 0.1)`,
                border: `2px solid rgba(${
                  item.color === 'cyan' ? '6, 182, 212' :
                  item.color === 'red' ? '239, 68, 68' :
                  item.color === 'amber' ? '245, 158, 11' :
                  item.color === 'green' ? '34, 197, 94' :
                  '59, 130, 246'
                }, 0.3)`
              }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  background: item.color === 'cyan' ? '#06b6d4' :
                              item.color === 'red' ? '#ef4444' :
                              item.color === 'amber' ? '#f59e0b' :
                              item.color === 'green' ? '#22c55e' :
                              '#3b82f6'
                }}
              >
                <item.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-lg text-white font-medium">{item.text}</span>
            </motion.div>
          ))}
        </div>

        {/* Snabblänkar */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <h5 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-cyan-400" />
            Snabblänk:
          </h5>
          <p className="text-slate-300 mb-3">
            För att öppna Tickets, gå till:
          </p>
          <div className="p-3 bg-slate-900 rounded-lg font-mono text-cyan-400">
            Meny → Tickets
          </div>
        </div>

        {/* Uppmuntran */}
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-2xl p-6 border border-green-500/30 text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-block mb-4"
          >
            <ThumbsUp className="w-16 h-16 text-green-400" />
          </motion.div>
          <h4 className="text-2xl font-bold text-green-300 mb-2">Nu är du redo!</h4>
          <p className="text-lg text-slate-300">
            Börja använda ticketsystemet för att effektivisera kommunikationen. Slipp mejl och telefon - allt på ett ställe!
          </p>
        </div>
      </div>
    )
  }
]

// ============================================================================
// HUVUDKOMPONENT
// ============================================================================

export default function TicketSystemGuide() {
  const navigate = useNavigate()
  const location = useLocation()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  // Bestäm tickets-sökväg baserat på vilken roll som ser guiden
  const getTicketsPath = () => {
    const path = location.pathname
    if (path.includes('/admin')) return '/admin/tickets'
    if (path.includes('/koordinator')) return '/koordinator/tickets'
    return '/technician/tickets'
  }

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
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-white">Guide: Ticketsystemet</h1>
              <p className="text-sm text-slate-400">Steg {currentStep + 1} av {guideSteps.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Ticket className="w-6 h-6 text-cyan-400" />
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400"
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
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : isCompleted
                              ? 'text-slate-300 hover:bg-slate-800'
                              : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isActive
                            ? 'bg-cyan-500 text-white'
                            : isCompleted
                              ? 'bg-cyan-500/30 text-cyan-400'
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

          {/* Huvudinnehall */}
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
                          ? 'bg-cyan-500 text-white ring-4 ring-cyan-500/30'
                          : isCompleted
                            ? 'bg-cyan-500/30 text-cyan-400'
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
                  onClick={() => navigate(getTicketsPath())}
                  className="flex items-center gap-2 py-4 px-6 text-lg bg-cyan-500 hover:bg-cyan-400 text-white"
                >
                  <Inbox className="w-5 h-5" />
                  Öppna Tickets
                </Button>
              ) : (
                <Button
                  onClick={goToNextStep}
                  className="flex items-center gap-2 py-4 px-6 text-lg bg-cyan-500 hover:bg-cyan-400 text-white"
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
                  <a href="tel:010-2051600" className="text-cyan-400 hover:text-cyan-300">
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
