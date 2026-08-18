// src/pages/shared/intranet/interactive/DokumentsigneringDemo.tsx
// Interaktiv demo för handboken: utforska dokumentsigneringens arbetskö,
// radanatomi och ring åter-cykeln i en säker miljö med låtsasdata.
import { useState } from 'react'
import { Eye, EyeOff, MailX, MessageSquare, Phone, MousePointerClick } from 'lucide-react'

// ─── Del 1: Kategoriutforskaren ────────────────────────────────

const CATEGORIES = [
  {
    key: 'ringlista', label: 'Ringlista idag', accent: 'text-[#20c58f]', count: 2,
    desc: 'Dokument där du planerat en uppföljning som är idag eller har passerat. De väcks hit automatiskt på rätt dag.',
    action: 'Ring kunden och logga samtalet. Väljer du "ring åter" snoozas dokumentet till det datumet.',
  },
  {
    key: 'boka', label: 'Signerade - boka in', accent: 'text-[#20c58f]', count: 3,
    desc: 'Kunden har signerat och väntar nu på att vi bokar in utförandet eller etableringen. Intäkten är säkrad, varje dags väntan är ett löftesbrott.',
    action: 'Klicka Boka in: ärendet skapas förifyllt från dokumentet och du kan öppna schemat direkt. Tekniker ser i stället "Koordinator bokar in".',
  },
  {
    key: 'svar', label: 'Kunden har svarat', accent: 'text-blue-400', count: 1,
    desc: 'Kunden har skrivit i dokumentchatten och meddelandet är oläst. En levande dialog betyder att signeringsfönstret är öppet just nu.',
    action: 'Öppna dokumentet, läs och svara. Välj kanalen "Svar i Oneflow" i skrivfältet så ser kunden svaret. Meddelandet markeras läst när du haft det i vy några sekunder.',
  },
  {
    key: 'loper_ut', label: 'Löper ut snart', accent: 'text-amber-400', count: 2,
    desc: 'Signeringsfristen går ut inom 3 dagar. Fristen hämtas från Oneflow varje natt.',
    action: 'Ring kunden, eller klicka Förläng frist för att ge mer tid. Förlängningen slår igenom både i Oneflow och här.',
  },
  {
    key: 'aldrig_fram', label: 'Nådde aldrig fram', accent: 'text-red-400', count: 1,
    desc: 'Utskicket studsade (fel e-postadress) eller kunden har inte öppnat dokumentet på flera dagar. Noll chans till signering, men billig att fixa.',
    action: 'Ring kunden och kontrollera e-postadressen. Rätta den i Oneflow och skicka om.',
  },
  {
    key: 'forfallna', label: 'Förfallna', accent: 'text-slate-400', count: 2,
    desc: 'Fristen har löpt ut i Oneflow. Ingen brådska längre: det här är en beslutsfråga.',
    action: 'Förläng fristen om affären lever, eller sätt koordinatorstatus Klar om den ska avskrivas.',
  },
  {
    key: 'bevakas', label: 'Bevakas', accent: 'text-slate-500', count: 12,
    desc: 'Skickade dokument som inväntar kunden, plus allt du snoozat med "ring åter". Hopfälld som standard: den kräver inget av dig.',
    action: 'Ingen åtgärd. Dokumenten flyttar sig själva till rätt kategori när något händer.',
  },
] as const

function CategoryExplorer() {
  const [selected, setSelected] = useState<typeof CATEGORIES[number]['key']>('boka')
  const cat = CATEGORIES.find(c => c.key === selected)!
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-900/60">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => setSelected(c.key)}
            className={`w-full flex items-center gap-1.5 px-3 py-2 border-b border-slate-800 last:border-b-0 text-left transition-colors ${
              selected === c.key ? 'bg-slate-800/70' : 'hover:bg-slate-800/40'
            }`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex-1">{c.label}</span>
            <span className={`text-[10px] font-bold font-mono ${c.accent}`}>{c.count}</span>
          </button>
        ))}
      </div>
      <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-lg">
        <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${cat.accent}`}>{cat.label}</p>
        <p className="text-sm text-slate-300 leading-relaxed">{cat.desc}</p>
        <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-700/60">
          <span className="font-semibold text-slate-300">Din åtgärd: </span>{cat.action}
        </p>
      </div>
    </div>
  )
}

// ─── Del 2: Radanatomin ────────────────────────────────

const ROW_PARTS = [
  { key: 'dot', label: 'Grön punkt + fetstil', desc: 'Oläst kundmeddelande. Försvinner när du läst meddelandet i panelen.' },
  { key: 'eye', label: 'Ögat', desc: 'Kunden har öppnat dokumentet. Gult överstruket öga betyder att kunden INTE öppnat, rött kuvert att utskicket studsade.' },
  { key: 'chat', label: 'Blå bubblan', desc: 'Antal olästa meddelanden från kunden i dokumentchatten.' },
  { key: 'pill', label: 'Deadline-pillen', desc: 'Dagar kvar av signeringsfristen. Grå (gott om tid), gul (3-7 dagar), orange (1-2 dagar), röd (idag/passerad). Efter samtal kan den ersättas av en telefon-pill med uppföljningsdagen.' },
  { key: 'meta', label: 'Raden under', desc: 'Offertnummer, dokumenttyp, vem som skickade och beloppet. Allt sökbart i sökfältet.' },
] as const

function RowAnatomy() {
  const [part, setPart] = useState<typeof ROW_PARTS[number]['key'] | null>('pill')
  const info = ROW_PARTS.find(p => p.key === part)
  const cls = (k: string) => `cursor-pointer rounded transition-shadow ${part === k ? 'ring-1 ring-[#20c58f]' : 'hover:ring-1 hover:ring-slate-600'}`
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <MousePointerClick className="w-3.5 h-3.5" /> Klicka på delarna i raden för att se vad de betyder
      </p>
      <div className="px-3 py-2 bg-slate-900/70 border border-slate-700 rounded-lg select-none">
        <div className="flex items-center gap-1.5">
          <span onClick={() => setPart('dot')} className={`w-2 h-2 rounded-full bg-[#20c58f] shrink-0 ${cls('dot')}`} />
          <span onClick={() => setPart('dot')} className={`text-sm font-semibold text-white ${cls('dot')}`}>Maserfrakt AB</span>
          <span onClick={() => setPart('eye')} className={cls('eye')}><Eye className="w-3 h-3 text-slate-500" /></span>
          <span onClick={() => setPart('chat')} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold ${cls('chat')}`}>
            <MessageSquare className="w-2.5 h-2.5" />2
          </span>
          <span onClick={() => setPart('pill')} className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400 ${cls('pill')}`}>⏳ 3d kvar</span>
        </div>
        <div onClick={() => setPart('meta')} className={`flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 ${cls('meta')}`}>
          <span className="font-mono">2026-041</span><span>Avtal</span><span>· Sofia</span>
          <span className="ml-auto font-mono text-slate-400">84 000 kr</span>
        </div>
      </div>
      {info && (
        <div className="px-3 py-2 bg-slate-800/30 border border-slate-700 rounded-lg">
          <p className="text-xs"><span className="font-semibold text-white">{info.label}: </span><span className="text-slate-300">{info.desc}</span></p>
        </div>
      )}
      <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
        <span className="flex items-center gap-1"><EyeOff className="w-3 h-3 text-amber-400" /> = ej öppnad</span>
        <span className="flex items-center gap-1"><MailX className="w-3 h-3 text-red-400" /> = e-posten studsade</span>
      </div>
    </div>
  )
}

// ─── Del 3: Ring åter-cykeln ────────────────────────────────

type FlowStep = 'idle' | 'logged' | 'snoozed' | 'awakened'

function CallCycleDemo() {
  const [step, setStep] = useState<FlowStep>('idle')
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500">Testa cykeln: logga ett samtal med uppföljning och se vad som händer med dokumentet.</p>

      {/* Mock-rad som flyttar sig */}
      <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-900/60">
        <div className="px-3 py-1.5 border-b border-slate-800">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {step === 'awakened' ? 'Ringlista idag' : step === 'snoozed' ? 'Bevakas' : 'Löper ut snart'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-2">
          <span className="text-sm font-medium text-slate-200">Demox AB</span>
          {step === 'idle' || step === 'logged' ? (
            <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400">⏳ 2d kvar</span>
          ) : step === 'snoozed' ? (
            <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-700/60 text-slate-300">
              <Phone className="w-2.5 h-2.5" /> tors
            </span>
          ) : (
            <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#20c58f]/15 text-[#20c58f]">
              <Phone className="w-2.5 h-2.5" /> idag
            </span>
          )}
        </div>
      </div>

      {/* Stegknappar */}
      <div className="flex items-center gap-2 flex-wrap">
        {step === 'idle' && (
          <button onClick={() => setStep('logged')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#20c58f] hover:bg-[#1aaa7a] text-[#fff] rounded-lg transition-colors">
            <Phone className="w-3 h-3" /> Ring upp och logga samtal
          </button>
        )}
        {step === 'logged' && (
          <button onClick={() => setStep('snoozed')} className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-lg transition-colors">
            Utfall: Röstbrevlåda · Ring åter: torsdag → Spara
          </button>
        )}
        {step === 'snoozed' && (
          <button onClick={() => setStep('awakened')} className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 rounded-lg transition-colors">
            ⏩ Spola fram till torsdag
          </button>
        )}
        {step === 'awakened' && (
          <button onClick={() => setStep('idle')} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors">
            Börja om
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        {step === 'idle' && 'Dokumentet ligger i Löper ut snart. Du ringer kunden via den gröna knappen i panelen.'}
        {step === 'logged' && 'Samtalspopovern öppnas: välj utfall, skriv en kort anteckning och när du vill ringa åter.'}
        {step === 'snoozed' && 'Dokumentet snoozades till Bevakas med en telefon-pill som visar dagen. Det stör dig inte förrän det är dags.'}
        {step === 'awakened' && 'På uppföljningsdagen väcks dokumentet automatiskt överst i Ringlista idag. Missar du dagen blir pillen röd med texten "försenad".'}
      </p>
    </div>
  )
}

// ─── Huvudkomponent ────────────────────────────────

export default function DokumentsigneringDemo() {
  const [tab, setTab] = useState<'queue' | 'row' | 'call'>('queue')
  return (
    <div className="my-5 p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {([
          { key: 'queue', label: 'Utforska kön' },
          { key: 'row', label: 'Läs en rad' },
          { key: 'call', label: 'Ring åter-cykeln' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              tab === t.key ? 'bg-[#20c58f] text-[#fff]' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'queue' && <CategoryExplorer />}
      {tab === 'row' && <RowAnatomy />}
      {tab === 'call' && <CallCycleDemo />}
    </div>
  )
}
