// src/pages/technician/guides/TicketSystemGuide.tsx
// SUPER-PEDAGOGISK GUIDE: Ticketsystemet
// Version 1.1 - Optimerad for alla interna medarbetare (admin, koordinatorer, tekniker)
// Fokus: Hur man anvander ticketsystemet for effektiv intern kommunikation

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
      label: 'Vantar pa ditt svar'
    },
    waiting_for_others: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      badge: 'bg-amber-500/20 text-amber-400',
      label: 'Vantar pa andras svar'
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
      label: 'Lost'
    }
  }

  const caseTypeLabels = {
    private: { label: 'Privat', color: 'text-purple-400' },
    business: { label: 'Foretag', color: 'text-blue-400' },
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

// Mock: Filter-flikar for Tickets-sidan
const MockFilterTabs = ({
  activeTab,
  onSelect,
  counts = { mentions: 3, replies: 2, activity: 5, all: 15, archived: 8 }
}: {
  activeTab: string
  onSelect: (tab: string) => void
  counts?: { mentions: number; replies: number; activity: number; all: number; archived: number }
}) => {
  const tabs = [
    { id: 'mentions', label: 'Vantar pa ditt svar', shortLabel: 'Att gora', count: counts.mentions, color: 'red', icon: AtSign },
    { id: 'replies', label: 'Vantar pa andras svar', shortLabel: 'Bevaka', count: counts.replies, color: 'amber', icon: MessageCircle },
    { id: 'activity', label: 'Ny aktivitet', shortLabel: 'Nytt', count: counts.activity, color: 'blue', icon: Bell },
    { id: 'all', label: 'Alla tickets', shortLabel: 'Alla', count: counts.all, color: 'slate', icon: Inbox },
    { id: 'archived', label: 'Avslutade', shortLabel: 'Klart', count: counts.archived, color: 'green', icon: Archive }
  ]

  const getColorClasses = (color: string, isActive: boolean) => {
    if (isActive) {
      switch (color) {
        case 'red': return 'bg-red-600 text-white ring-2 ring-red-500/30'
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

// Mock: Kommentarsinput med @mention-stod
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

// Mock: Markera lost-knapp
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
    {resolved ? 'Lost!' : 'Markera lost'}
  </motion.button>
)

// Glodande highlight-ring
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
    title: 'Vad ar en ticket?',
    subtitle: 'Grundlaggande koncept',
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
            En ticket = En sparbar fraga
          </h3>
          <p className="text-xl text-slate-300 max-w-md mx-auto leading-relaxed">
            Nar du skriver en kommentar med <strong className="text-purple-300">@namn</strong> i ett arende skapas en <strong className="text-cyan-300">ticket</strong> - en sparbar trad som foljs upp tills den ar lost.
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
              <p>En <strong className="text-cyan-300">ticket</strong> skapas och Admin far en notis</p>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-bold">3</span>
              <p>Admin svarar: <strong className="text-white">"Fakturerat! Faktura #12345"</strong></p>
            </div>
            <div className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center font-bold">4</span>
              <p>Admin klickar <strong className="text-green-300">"Markera lost"</strong> - klart!</p>
            </div>
          </div>
        </div>

        {/* Fordelar */}
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
              <p className="text-slate-400">Alla fragor och svar sparas - perfekt for revision och uppfoljning</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
            <ThumbsUp className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <h5 className="font-semibold text-green-300">Sokbar historik</h5>
              <p className="text-slate-400">Sok pa fakturanummer, nyckelord eller namn</p>
            </div>
          </div>
        </div>

        {/* Ersatter ClickUp */}
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <Zap className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h4 className="text-xl font-semibold text-amber-300 mb-2">
                Ersatter mejl och ClickUp-kommentarer
              </h4>
              <p className="text-lg text-slate-300">
                Istallet for att skicka mejl eller skriva i ClickUp, anvander ni nu <strong className="text-white">ticketsystemet</strong> for all intern kommunikation. Allt samlas pa ett stalle!
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: 'De 5 flikarna',
    subtitle: 'Oversikt i Tickets',
    icon: Filter,
    iconColor: 'text-purple-400',
    content: (() => {
      const TabsDemo = () => {
        const [activeTab, setActiveTab] = useState('mentions')

        const tabDescriptions: Record<string, { title: string; description: string; examples: string[] }> = {
          mentions: {
            title: 'Vantar pa DITT svar',
            description: 'Nagon har @namnt dig och vantar pa att du ska svara eller agera. Detta ar din "att-gora-lista".',
            examples: [
              '"@Tekniker" - Kan du kolla nar du ar dar?',
              '"@Admin" - Vi behover godkannande for offerten',
              '"@Koordinator" - Kunden vill boka om'
            ]
          },
          replies: {
            title: 'Vantar pa ANDRAS svar',
            description: 'Du har stallt en fraga till nagon annan och vantar pa deras svar. Bevaka dessa!',
            examples: [
              'Du skrev: "@Admin" - Klar att fakturera',
              'Du skrev: "@Koordinator" - Nar ska jag aka dit?',
              'Du skrev: "@Tekniker" - Har du materialet?'
            ]
          },
          activity: {
            title: 'Ny aktivitet',
            description: 'Tickets dar det kommit nya kommentarer som du inte last annu.',
            examples: [
              'Erik svarade pa din fraga',
              'Anna la till en kommentar',
              'Ny uppdatering i arendet'
            ]
          },
          all: {
            title: 'Alla tickets',
            description: 'Komplett oversikt over alla oppna tickets dar du ar involverad pa nagot satt.',
            examples: [
              'Alla aktiva diskussioner',
              'Fragor du foljer',
              'Arenden du arbetat med'
            ]
          },
          archived: {
            title: 'Avslutade tickets',
            description: 'Losta tickets. Bra jobbat! Dessa kan du soka i om du behover hitta gammal information.',
            examples: [
              'Fakturerade arenden',
              'Besvarade fragor',
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
                Fem flikar - fem syften:
              </h4>
              <p className="text-lg text-slate-300">
                I <strong className="text-white">Tickets</strong> finns fem flikar som hjalper dig att prioritera och organisera ditt arbete.
              </p>
            </div>

            {/* Interaktiva flikar */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Prova - klicka pa en flik:</p>

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

            {/* Fargkoder */}
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
              <h5 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Fargkodernas betydelse:
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-red-500" />
                  <span className="text-red-300 font-medium">Rod</span>
                  <span className="text-slate-400 text-sm">= Vantar pa DIG</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-amber-500" />
                  <span className="text-amber-300 font-medium">Gul</span>
                  <span className="text-slate-400 text-sm">= Vantar pa ANDRA</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-blue-500" />
                  <span className="text-blue-300 font-medium">Bla</span>
                  <span className="text-slate-400 text-sm">= Olasta nyheter</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="w-4 h-4 rounded-full bg-green-500" />
                  <span className="text-green-300 font-medium">Gron</span>
                  <span className="text-slate-400 text-sm">= Avklarade/losta</span>
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
    subtitle: 'Sa har borjar du en konversation',
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
                  <span>Oppna ett <strong className="text-white">arende</strong> (privat, foretag eller avtal)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">2</span>
                  <span>Klicka pa <strong className="text-purple-300">pratbubblan</strong> i ovre hogra hornet</span>
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
                          Glom inte att tagga nagon med @ for att skapa en ticket!
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
                          Bra! Du har taggat nagon. Klicka pa skicka-knappen!
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
                        Den du taggade far nu en notis och ticketen visas i deras "Vantar pa ditt svar"-flik.
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
                    <p><strong className="text-purple-300">@Fornamn Efternamn</strong> - en specifik person</p>
                    <p><strong className="text-amber-300">@Admin / @Koordinator / @Tekniker</strong> - alla med den rollen</p>
                    <p><strong className="text-cyan-300">@alla</strong> - alla med tillgang till arendet</p>
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
    title: 'Svara pa en ticket',
    subtitle: 'Hur du svarar och foljer upp',
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
                Steg for att svara:
              </h4>
              <ol className="text-lg text-slate-300 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">1</span>
                  <span>Hitta ticketen i <strong className="text-white">Tickets</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">2</span>
                  <span><strong className="text-cyan-300">Klicka pa ticketen</strong> for att oppna arendet</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">3</span>
                  <span>Skriv ditt svar i kommunikationspanelen</span>
                </li>
              </ol>
            </div>

            {/* Interaktiv demo */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Prova - klicka pa ticketen:</p>

              <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5 space-y-4">
                {step === 0 && (
                  <GlowingHighlight color="cyan">
                    <MockTicketCard
                      title="Familjen Andersson - Rattor"
                      caseType="private"
                      preview="Nar kan du aka dit for uppfoljning?"
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
                          {' '}Nar kan du aka dit for uppfoljning?
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

                    <p className="text-center text-slate-400">Klicka pa textfaltet for att fortsatta...</p>
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
                      Nar du skickar ditt svar flyttas ticketen fran "Vantar pa ditt svar" till "Vantar pa andras svar".
                    </p>
                    <button
                      onClick={() => setStep(0)}
                      className="text-slate-400 hover:text-white text-sm underline"
                    >
                      Borja om
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
                    Du kan ocksa oppna arendet direkt fran <strong className="text-white">notifikationsikonen</strong> i menyn nar nagon taggar dig.
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
    title: 'Markera som lost',
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
                Nar ar en ticket "lost"?
              </h4>
              <p className="text-lg text-slate-300">
                Nar fragan ar besvarad och ingen mer atgard kravs, klickar du pa <strong className="text-green-300">"Markera lost"</strong>. Ticketen flyttas da till Avslutade-fliken.
              </p>
            </div>

            {/* Demo */}
            <div className="space-y-3">
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Prova - markera ticketen som lost:</p>

              <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5 space-y-4">
                <div className={`p-4 rounded-xl border-2 transition-all ${
                  resolved
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-white font-semibold">Restaurang Smak AB</h4>
                      <p className="text-sm text-blue-400">Foretag</p>
                    </div>
                    {resolved && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Lost
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-sm text-slate-300">
                        <span className="text-purple-300">@Admin</span> Klar att fakturera
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Erik T., igar</p>
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
                        <span className="text-lg font-medium">Ticket lost!</span>
                        <p className="text-sm text-slate-400">
                          Ticketen ar nu arkiverad och finns under "Avslutade". Du kan ateropna den om det behovs.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setResolved(false)}
                      className="mt-3 text-slate-400 hover:text-white text-sm underline"
                    >
                      Aterstall demo
                    </button>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Vem kan losa? */}
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
              <h5 className="font-semibold text-white mb-4">Vem kan markera en ticket som lost?</h5>
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
                  <span><strong className="text-white">Admin</strong> kan alltid markera som lost</span>
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
    title: 'Vanliga arbetsfloden',
    subtitle: 'Exempel fran vardagen',
    icon: Zap,
    iconColor: 'text-amber-400',
    content: (
      <div className="space-y-8">
        {/* Intro */}
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-6">
          <h4 className="text-xl font-semibold text-amber-300 mb-3 flex items-center gap-3">
            <Zap className="w-6 h-6" />
            Har ar tre vanliga arbetsfloden:
          </h4>
          <p className="text-lg text-slate-300">
            Se hur ticketsystemet anvands i praktiken for att effektivisera kommunikationen.
          </p>
        </div>

        {/* Arbetsflode 1: Fakturering */}
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
                <p className="text-slate-200">"<span className="text-purple-300">@Admin</span> Arendet ar klart. Klar att fakturera."</p>
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
                  Markerar som lost
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Arbetsflode 2: Kundfraga */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <MessageCircle className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white">Kundfraga</h4>
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
                <p className="text-slate-200">"<span className="text-purple-300">@Erik Tekniker</span> Kunden undrar vad du hittade vid senaste besoket?"</p>
              </div>
            </div>
            <AnimatedArrow />
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Tekniker:</p>
                <p className="text-slate-200">"Hittade spar av morkratten vid ingangen. Satte ut extra fallor."</p>
              </div>
            </div>
            <AnimatedArrow />
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-sm text-slate-400 mb-1">Koordinator:</p>
                <p className="text-slate-200">"Tack! Aterrapporterar till kunden."</p>
                <p className="text-green-400 text-sm mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Markerar som lost
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Arbetsflode 3: Betalningspaminnelse */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-white">Betalningspaminnelse</h4>
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
                <p className="text-slate-200">"<span className="text-purple-300">@Erik Tekniker</span> Kunden har inte betalat faktura #12345. Kan du hora av dig nar du ar dar nasta gang?"</p>
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
                  Markerar som lost
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
    title: 'Sok och hitta',
    subtitle: 'Hitta gamla tickets snabbt',
    icon: Search,
    iconColor: 'text-blue-400',
    content: (
      <div className="space-y-8">
        {/* Instruktion */}
        <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-2xl p-6">
          <h4 className="text-xl font-semibold text-blue-300 mb-3 flex items-center gap-3">
            <Search className="w-6 h-6" />
            Sok pa vad som helst:
          </h4>
          <p className="text-lg text-slate-300">
            Anvand sokfaltet i <strong className="text-white">Tickets</strong> for att hitta tickets baserat pa nyckelord, fakturanummer, kundnamn eller annat.
          </p>
        </div>

        {/* Simulerat sokfalt */}
        <div className="bg-slate-900/70 rounded-2xl border border-slate-700 p-5 space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl focus-within:border-cyan-500 transition-colors">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Sok nyckelord, fakturanr, kundnamn..."
                className="flex-1 bg-transparent text-white placeholder:text-slate-500 outline-none text-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-400 mb-1">Sok pa fakturanummer:</p>
              <p className="text-cyan-400 font-mono">"12345"</p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-400 mb-1">Sok pa kundnamn:</p>
              <p className="text-cyan-400 font-mono">"IKEA"</p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-400 mb-1">Sok pa nyckelord:</p>
              <p className="text-cyan-400 font-mono">"fakturering"</p>
            </div>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
              <p className="text-sm text-slate-400 mb-1">Sok pa personnamn:</p>
              <p className="text-cyan-400 font-mono">"Anna"</p>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <Lightbulb className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
            <div>
              <h5 className="font-semibold text-amber-300 mb-2">Tips for effektiv sokning:</h5>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-amber-400 mt-1 flex-shrink-0" />
                  <span>Sokningen letar i <strong className="text-white">alla flikar</strong> - bade aktiva och arkiverade</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-amber-400 mt-1 flex-shrink-0" />
                  <span>Du kan soka pa <strong className="text-white">delar av ord</strong> - "faktur" hittar "fakturering"</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-amber-400 mt-1 flex-shrink-0" />
                  <span>Anvand <strong className="text-white">Avslutade-fliken</strong> for att begranasa sokningen till losta arenden</span>
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
    title: 'Vanliga fragor (FAQ)',
    subtitle: 'Svar pa det du undrar',
    icon: HelpCircle,
    iconColor: 'text-pink-400',
    content: (
      <div className="space-y-6">
        {/* FAQ-kort */}
        {[
          {
            question: 'Vad ar skillnaden pa en ticket och en vanlig kommentar?',
            answer: 'En ticket skapas nar du taggar nagon med @. Den foljs upp och har en status (oppen/lost). Kommentarer utan @ ar bara anteckningar.',
            icon: Ticket
          },
          {
            question: 'Kan kunder se mina tickets?',
            answer: 'NEJ! Alla tickets och intern kommunikation ar 100% internt. Kunder - oavsett typ - kan aldrig se detta.',
            icon: Users
          },
          {
            question: 'Hur vet jag nar nagon svarar?',
            answer: 'Du far en notifikation (klockan i menyn). Dessutom flyttas ticketen till "Ny aktivitet"-fliken.',
            icon: Bell
          },
          {
            question: 'Kan jag ateropna en lost ticket?',
            answer: 'Ja! Ga till Avslutade-fliken, oppna ticketen och klicka "Ateropna". Ticketen blir aktiv igen.',
            icon: Archive
          },
          {
            question: 'Vad hander om jag taggar @alla?',
            answer: 'Alla med tillgang till arendet far en notis. Anvand sparsamt - bara nar det verkligen galler alla.',
            icon: Users
          },
          {
            question: 'Hur hittar jag en gammal ticket?',
            answer: 'Anvand sokfaltet i Tickets. Du kan soka pa fakturanummer, kundnamn, nyckelord mm.',
            icon: Search
          },
          {
            question: 'Kan jag se vem som last min ticket?',
            answer: 'Nej, men du ser nar nagon svarar. Om ingen svarar ligger ticketen kvar i deras "Vantar pa ditt svar"-flik.',
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
    subtitle: 'Allt du behover komma ihag',
    icon: CheckCircle,
    iconColor: 'text-green-400',
    content: (
      <div className="space-y-8">
        {/* Huvudpunkter */}
        <div className="space-y-4">
          <h4 className="text-xl font-semibold text-white text-center mb-6">
            5 saker att komma ihag:
          </h4>

          {[
            { step: 1, text: 'Skriv @namn i en kommentar = skapa ticket', color: 'cyan', icon: AtSign },
            { step: 2, text: 'Kolla "Vantar pa ditt svar" dagligen', color: 'red', icon: Inbox },
            { step: 3, text: 'Svara snabbt - minska ledtider!', color: 'amber', icon: Zap },
            { step: 4, text: 'Markera som lost nar klart', color: 'green', icon: CheckCircle2 },
            { step: 5, text: 'Sok for att hitta gammal info', color: 'blue', icon: Search },
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

        {/* Snabblankar */}
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
          <h5 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-cyan-400" />
            Snabblank:
          </h5>
          <p className="text-slate-300 mb-3">
            For att oppna Tickets, ga till:
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
          <h4 className="text-2xl font-bold text-green-300 mb-2">Nu ar du redo!</h4>
          <p className="text-lg text-slate-300">
            Borja anvanda ticketsystemet for att effektivisera kommunikationen. Slipp mejl och telefon - allt pa ett stalle!
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

  // Bestam tickets-sökväg baserat på vilken roll som ser guiden
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
              <span>Mal</span>
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
                  Innehall
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

            {/* Steginnehall */}
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

                  {/* Steginnehall */}
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
                <span className="hidden sm:inline">Foregaende</span>
                <span className="sm:hidden">Bakat</span>
              </Button>

              {currentStep === guideSteps.length - 1 ? (
                <Button
                  onClick={() => navigate(getTicketsPath())}
                  className="flex items-center gap-2 py-4 px-6 text-lg bg-cyan-500 hover:bg-cyan-400 text-white"
                >
                  <Inbox className="w-5 h-5" />
                  Oppna Tickets
                </Button>
              ) : (
                <Button
                  onClick={goToNextStep}
                  className="flex items-center gap-2 py-4 px-6 text-lg bg-cyan-500 hover:bg-cyan-400 text-white"
                >
                  <span>Nasta steg</span>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              )}
            </div>

            {/* Snabbhjalp */}
            <div className="mt-8 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3 text-slate-400">
                <HelpCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">
                  Behover du mer hjalp? Kontakta kontoret pa{' '}
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
