// src/pages/admin/TeamChat.tsx
// Team AI Chat - Centraliserad AI-lösning för hela teamet

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  sendTeamChatMessage,
  generateImage,
  createConversation,
  getConversations,
  getConversationWithMessages,
  saveMessage,
  logUsage,
  getUserUsageStats,
  getTotalUsageStats,
  updateConversationTitle,
  deleteConversation,
  TeamChatMessage,
  TeamChatConversation,
  UsageStats
} from '../../services/teamChatService';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Paperclip,
  Sparkles,
  Plus,
  Trash2,
  Pencil,
  MessageSquare,
  BarChart3,
  X,
  Loader2,
  PanelLeftClose,
  PanelLeft,
  Database,
  FileText,
  Copy,
  Check,
  Image,
  Table2,
  Download
} from 'lucide-react';
// CaseLink-komponenten används inte längre - vi använder hyperlänkar istället
import CaseDetailsModal from '../../components/customer/CaseDetailsModal';
import { supabase } from '../../lib/supabase';

// Typbaserad styling för case-länkar (privat=blå, företag=lila, avtal=grön)
type CaseType = 'private' | 'business' | 'contract';

const caseTypeStyles: Record<CaseType, { text: string; hover: string; bg: string }> = {
  private: {
    text: 'text-blue-400',
    hover: 'hover:text-blue-300',
    bg: 'hover:bg-blue-500/10',
  },
  business: {
    text: 'text-purple-400',
    hover: 'hover:text-purple-300',
    bg: 'hover:bg-purple-500/10',
  },
  contract: {
    text: 'text-emerald-400',
    hover: 'hover:text-emerald-300',
    bg: 'hover:bg-emerald-500/10',
  },
};

export default function TeamChat() {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<TeamChatConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<TeamChatConversation | null>(null);
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [userStats, setUserStats] = useState<UsageStats | null>(null);
  const [totalStats, setTotalStats] = useState<UsageStats | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // State för ärende-modal
  const [selectedCase, setSelectedCase] = useState<{
    caseId: string;
    caseType: 'private' | 'business' | 'contract';
    clickupTaskId?: string;
    fallbackData?: any;
  } | null>(null);

  // Konvertera markdown till ren text för kopiering
  const markdownToPlainText = (markdown: string): string => {
    let text = markdown;

    // Ta bort rubriker (## -> tom)
    text = text.replace(/^#{1,6}\s+/gm, '');

    // Konvertera fetstil **text** -> text
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');

    // Konvertera kursiv *text* -> text
    text = text.replace(/\*([^*]+)\*/g, '$1');

    // Behåll listpunkter men med bullet
    text = text.replace(/^[\-\*]\s+/gm, '• ');

    // Konvertera numrerade listor
    text = text.replace(/^\d+\.\s+/gm, '• ');

    // Hantera tabeller - ta bort separatorrader först
    text = text.replace(/^\|[\s\-:]+\|$/gm, '');
    // Konvertera tabellrader till text
    text = text.replace(/^\|(.+)\|$/gm, (_, content) => {
      return content.split('|').map((cell: string) => cell.trim()).filter(Boolean).join(' | ');
    });

    // Ta bort blockquote-markör
    text = text.replace(/^>\s*/gm, '');

    // Ta bort horisontella linjer
    text = text.replace(/^---+$/gm, '');

    // Ta bort code blocks markers
    text = text.replace(/```[\w]*\n?/g, '');

    // Ta bort inline code backticks
    text = text.replace(/`([^`]+)`/g, '$1');

    // Ta bort överflödiga tomrader
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  };

  // Hjälpfunktion för filtyp-label med ikon
  const getFileTypeLabel = (mimeType: string) => {
    if (mimeType === 'application/pdf') return { icon: FileText, label: 'Dokument bifogat', color: 'text-red-400' };
    if (mimeType.startsWith('image/')) return { icon: Image, label: 'Bild bifogad', color: 'text-blue-400' };
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return { icon: Table2, label: 'Kalkylblad bifogat', color: 'text-green-400' };
    if (mimeType.includes('word') || mimeType.includes('document')) return { icon: FileText, label: 'Dokument bifogat', color: 'text-blue-400' };
    return { icon: Paperclip, label: 'Fil bifogad', color: 'text-slate-400' };
  };

  // Kopiera AI-svar till urklipp (konverterar markdown till ren text)
  const handleCopy = async (text: string, index: number) => {
    try {
      const plainText = markdownToPlainText(text);
      await navigator.clipboard.writeText(plainText);
      setCopiedIndex(index);
      toast.success('Kopierat till urklipp!');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      toast.error('Kunde inte kopiera');
    }
  };

  // Kopiera genererad bild till urklipp
  const copyImageToClipboard = async (image: { data: string; mimeType: string }) => {
    try {
      const blob = await fetch(`data:${image.mimeType};base64,${image.data}`).then(r => r.blob());
      await navigator.clipboard.write([new ClipboardItem({ [image.mimeType]: blob })]);
      toast.success('Bild kopierad till urklipp!');
    } catch (err) {
      // Fallback: kopiera base64 som text
      try {
        await navigator.clipboard.writeText(`data:${image.mimeType};base64,${image.data}`);
        toast.success('Bild-URL kopierad!');
      } catch {
        toast.error('Kunde inte kopiera bild');
      }
    }
  };

  // Ladda ner genererad bild
  const downloadImage = (image: { data: string; mimeType: string }, filename = 'begone-genererad-bild.png') => {
    const link = document.createElement('a');
    link.href = `data:${image.mimeType};base64,${image.data}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Bild laddas ner...');
  };

  // Hantera klick på ärende-länk - hämta data från databasen
  const handleOpenCase = async (caseId: string, caseType: 'private' | 'business' | 'contract') => {
    try {
      const tableName = caseType === 'private' ? 'private_cases' :
                        caseType === 'business' ? 'business_cases' : 'cases';

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', caseId)
        .single();

      if (error) {
        console.error('Error fetching case:', error);
        toast.error('Kunde inte hämta ärendedetaljer');
        return;
      }

      // Mappa databasfält till vad modalen förväntar sig
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbData = data as any;
      const mappedData = {
        // Grundinfo
        case_number: dbData?.case_number,
        title: dbData?.title || dbData?.kontaktperson || 'Ärende',
        status: dbData?.status,
        priority: dbData?.priority,
        description: dbData?.description || dbData?.rapport,

        // Skadedjur
        pest_type: dbData?.skadedjur,

        // Adress - extrahera formatted_address korrekt från JSONB
        address: (() => {
          const addr = dbData?.adress || dbData?.address;
          if (!addr) return undefined;
          if (typeof addr === 'string') return { formatted_address: addr };
          if (addr.formatted_address) return { formatted_address: addr.formatted_address };
          return undefined;
        })(),

        // Location för "Visa på karta"
        location: (() => {
          const addr = dbData?.adress || dbData?.address;
          if (addr?.location) return addr.location;
          return undefined;
        })(),

        // Tekniker - med e-post
        primary_technician_name: dbData?.primary_assignee_name || dbData?.primary_tech?.name,
        primary_technician_email: dbData?.primary_assignee_email,

        // Kontaktperson
        contact_person: dbData?.kontaktperson,
        contact_email: dbData?.e_post_kontaktperson,
        contact_phone: dbData?.telefon_kontaktperson,

        // Priser
        price: dbData?.pris || dbData?.price,

        // Datum
        completed_date: dbData?.completed_date,
        created_at: dbData?.created_at,
        updated_at: dbData?.updated_at,

        // Rapport/beskrivning
        work_report: dbData?.rapport,
        recommendations: dbData?.recommendations,

        // Filer
        files: dbData?.filer || dbData?.files,

        // Ärendetyp
        case_type: caseType,
      };

      setSelectedCase({
        caseId,
        caseType,
        clickupTaskId: undefined,  // Använd alltid databasen
        fallbackData: mappedData
      });
    } catch (err) {
      console.error('Error in handleOpenCase:', err);
      toast.error('Något gick fel');
    }
  };

  // Konvertera CASE-syntax till markdown-länkar: [CASE|type|id|title] -> [title](#case-type-id)
  // Utan emoji - styling hanteras i renderMarkdownWithCaseLinks
  const processCaseLinks = (content: string): string => {
    return content.replace(
      /\[CASE\|([^|]+)\|([^|]+)\|([^\]]+)\]/g,
      (_, type, id, title) => `[${title}](#case-${type}-${id})`
    );
  };

  // Rendera markdown med klickbara CASE-länkar som hyperlänkar
  // Färgkodade efter typ: privat=blå, företag=lila, avtal=grön
  const renderMarkdownWithCaseLinks = (content: string) => {
    // Konvertera CASE-syntax till markdown-länkar
    const processedContent = processCaseLinks(content);

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            // Kolla om det är en case-länk
            if (href?.startsWith('#case-')) {
              const match = href.match(/#case-(\w+)-(.+)/);
              if (match) {
                const [, type, id] = match;
                const styles = caseTypeStyles[type as CaseType] || caseTypeStyles.private;

                return (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleOpenCase(id, type as CaseType);
                    }}
                    className={`
                      inline
                      ${styles.text} ${styles.hover} ${styles.bg}
                      underline decoration-current/40 decoration-1 underline-offset-2
                      hover:decoration-current/80
                      rounded px-0.5 -mx-0.5
                      transition-all duration-200
                      focus:outline-none focus:ring-1 focus:ring-current/30
                      font-medium
                    `}
                  >
                    {children}
                  </button>
                );
              }
            }
            // Vanlig länk
            return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline" {...props}>{children}</a>;
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    );
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ladda konversationer när användaren är inloggad
  useEffect(() => {
    if (user?.id) {
      loadConversations();
    }
  }, [user?.id]);

  // Scrolla till botten när meddelanden ändras
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    if (!user?.id) return;
    const convs = await getConversations(user.id);
    setConversations(convs);
  };

  const loadConversation = async (conversationId: string) => {
    const conv = await getConversationWithMessages(conversationId);
    if (conv) {
      setCurrentConversation(conv);
      setMessages(conv.messages || []);
    }
  };

  const loadStats = async () => {
    if (!user?.id) return;

    const userStatsData = await getUserUsageStats(user.id, getMonthStart());
    setUserStats(userStatsData);

    if (profile?.role === 'admin') {
      const totalStatsData = await getTotalUsageStats(getMonthStart());
      setTotalStats(totalStatsData);
    }
  };

  const getMonthStart = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const handleNewConversation = async () => {
    if (!user?.id) return;

    const title = `Ny konversation ${new Date().toLocaleDateString('sv-SE')}`;
    const conversationId = await createConversation(title, user.id);

    if (conversationId) {
      await loadConversations();
      await loadConversation(conversationId);
    }
  };

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && !selectedImage) || isLoading) return;

    // Skapa konversation om det inte finns en
    let convId = currentConversation?.id;
    if (!convId && user?.id) {
      const title = inputMessage.slice(0, 50) || 'Bildanalys';
      convId = await createConversation(title, user.id);
      if (convId) {
        await loadConversations();
        setCurrentConversation({
          id: convId,
          title,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    if (!convId) {
      toast.error('Kunde inte skapa konversation');
      return;
    }

    // Spara fil-referens innan vi rensar preview
    const sentFile = selectedImage;

    // Lägg till användarens meddelande med filtyp
    const userMessage: TeamChatMessage = {
      role: 'user',
      content: inputMessage || 'Analysera filen',
      image_urls: sentFile ? ['uploaded_file'] : undefined,
      file_type: sentFile?.mimeType
    };

    // Rensa fil-preview direkt när meddelandet skickas
    setSelectedImage(null);
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    // Återställ textarea-höjd
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      // Spara användarens meddelande
      await saveMessage(convId, 'user', userMessage.content, user?.id);

      // Skicka till AI med sparad fil-referens
      const response = await sendTeamChatMessage(
        inputMessage,
        messages,
        sentFile?.base64,
        sentFile?.mimeType
      );

      if (response.success && response.response) {
        // Lägg till AI:s svar
        const aiMessage: TeamChatMessage = {
          role: 'assistant',
          content: response.response
        };
        setMessages(prev => [...prev, aiMessage]);

        // Spara AI:s svar
        await saveMessage(convId, 'assistant', response.response);

        // Logga användning
        if (user?.id && response.usage) {
          await logUsage(
            user.id,
            convId,
            response.usage.model,
            response.usage.input_tokens,
            response.usage.output_tokens,
            response.usage.images_analyzed || 0,
            response.usage.images_generated || 0,
            response.usage.estimated_cost_usd
          );
        }
      } else {
        toast.error(response.error || 'Kunde inte få svar från AI');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Ett fel uppstod');
    } finally {
      setIsLoading(false);
    }
  };

  // Generera bild med Imagen/Nano Banana
  const handleGenerateImage = async () => {
    if (!inputMessage.trim() || isGeneratingImage) return;

    // Skapa konversation om det inte finns en
    let convId = currentConversation?.id;
    if (!convId && user?.id) {
      const title = `Bildgenerering: ${inputMessage.slice(0, 40)}`;
      convId = await createConversation(title, user.id);
      if (convId) {
        await loadConversations();
        setCurrentConversation({
          id: convId,
          title,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    if (!convId) {
      toast.error('Kunde inte skapa konversation');
      return;
    }

    const prompt = inputMessage;

    // Lägg till användarens meddelande
    const userMessage: TeamChatMessage = {
      role: 'user',
      content: `🎨 Generera bild: ${prompt}`
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsGeneratingImage(true);

    try {
      // Spara användarens meddelande
      await saveMessage(convId, 'user', userMessage.content, user?.id);

      // Anropa bildgenerering
      const response = await generateImage(prompt);

      if (response.success) {
        if (response.image) {
          // Bild genererades - spara den separat för korrekt rendering
          const aiMessage: TeamChatMessage = {
            role: 'assistant',
            content: `Bild genererad baserat på: "${prompt}"`,
            generated_image: {
              data: response.image.data,
              mimeType: response.image.mimeType
            }
          };
          setMessages(prev => [...prev, aiMessage]);
          await saveMessage(convId, 'assistant', `[Genererad bild] ${prompt}`);
          toast.success('Bild genererad!');
        } else if (response.response) {
          // Bara text (t.ex. om bildgenerering misslyckades)
          const aiMessage: TeamChatMessage = {
            role: 'assistant',
            content: response.response
          };
          setMessages(prev => [...prev, aiMessage]);
          await saveMessage(convId, 'assistant', response.response);
        }

        // Logga användning
        if (user?.id && response.usage) {
          await logUsage(
            user.id,
            convId,
            response.usage.model,
            response.usage.input_tokens || 0,
            response.usage.output_tokens || 0,
            response.usage.images_analyzed || 0,
            response.usage.images_generated || 0,
            response.usage.estimated_cost_usd
          );
        }
      } else {
        toast.error(response.error || 'Kunde inte generera bild');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Ett fel uppstod vid bildgenerering');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Filen får max vara 20 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string)?.split(',')[1];
      if (base64) {
        setSelectedImage({
          base64,
          mimeType: file.type
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteConversation = async (convId: string) => {
    if (!confirm('Vill du ta bort denna konversation?')) return;

    const success = await deleteConversation(convId);
    if (success) {
      await loadConversations();
      if (currentConversation?.id === convId) {
        setCurrentConversation(null);
        setMessages([]);
      }
      toast.success('Konversation borttagen');
    } else {
      toast.error('Kunde inte ta bort konversationen');
    }
  };

  const handleUpdateTitle = async (convId: string) => {
    if (!newTitle.trim()) return;

    const success = await updateConversationTitle(convId, newTitle);
    if (success) {
      await loadConversations();
      if (currentConversation?.id === convId) {
        setCurrentConversation(prev => prev ? { ...prev, title: newTitle } : null);
      }
      setEditingTitle(null);
      setNewTitle('');
    }
  };

  const formatCost = (costUsd: number) => {
    const costSek = costUsd * 10; // Ungefärlig växelkurs
    return `${costSek.toFixed(2)} kr`;
  };

  return (
    <div className="fixed top-14 left-0 right-0 bottom-0 flex bg-slate-900 overflow-hidden">
      {/* Sidebar - kompaktare */}
      <div className={`${isSidebarOpen ? 'w-56' : 'w-0'} h-full min-h-0 transition-all duration-200 bg-slate-800 border-r border-slate-700 flex flex-col overflow-hidden`}>
        <div className="p-2 border-b border-slate-700">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ny chatt
          </button>
        </div>

        {/* Konversationslista - kompaktare */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-4">Inga konversationer än</p>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                className={`group p-2 rounded cursor-pointer transition-colors ${
                  currentConversation?.id === conv.id
                    ? 'bg-slate-700'
                    : 'hover:bg-slate-700/50'
                }`}
                onClick={() => loadConversation(conv.id)}
              >
                {editingTitle === conv.id ? (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      className="flex-1 px-2 py-1 bg-slate-600 rounded text-xs"
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleUpdateTitle(conv.id)}
                    />
                    <button
                      onClick={() => handleUpdateTitle(conv.id)}
                      className="text-emerald-500 hover:text-emerald-400 text-xs px-1"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-white text-xs font-medium truncate flex-1">
                      {conv.title}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 flex">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingTitle(conv.id);
                          setNewTitle(conv.title);
                        }}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteConversation(conv.id);
                        }}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Statistik-knapp - kompaktare */}
        <div className="p-2 border-t border-slate-700">
          <button
            onClick={() => {
              setShowStats(true);
              loadStats();
            }}
            className="w-full flex items-center justify-center gap-2 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Statistik
          </button>
        </div>
      </div>

      {/* Huvudinnehåll */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Header - kompaktare */}
        <div className="h-10 px-2 flex items-center justify-between bg-slate-800 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700"
              title={isSidebarOpen ? 'Dölj sidopanel' : 'Visa sidopanel'}
            >
              {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </button>
            <h1 className="text-white text-sm font-medium truncate">
              {currentConversation?.title || 'Team AI Chat'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
              <Database className="w-3 h-3" />
              Systemdata
            </span>
            <span className="text-[10px] text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">
              Gemini 3 + RAG
            </span>
          </div>
        </div>

        {/* Meddelandeområde */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Sparkles className="w-12 h-12 mb-3 text-emerald-500" />
              <h2 className="text-lg font-medium text-white mb-1">Team AI Chat</h2>
              <p className="text-center text-sm max-w-md mb-4">
                AI-assistent med tillgång till kunddata, ärenden och tekniker.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-2">
                  <span className="text-emerald-400">💡</span> "Vilka är våra största kunder?"
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-2">
                  <span className="text-emerald-400">📊</span> "Sammanfatta senaste ärenden"
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-2">
                  <span className="text-emerald-400">📷</span> "Analysera denna bild"
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-2">
                  <span className="text-emerald-400">✍️</span> "Skriv en offert för..."
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-2.5 py-1.5 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 border border-slate-700 text-slate-100'
                  }`}
                >
                  {msg.image_urls && msg.image_urls.length > 0 && (
                    <div className="mb-2 flex items-center gap-2 text-xs opacity-90">
                      {(() => {
                        const fileInfo = getFileTypeLabel(msg.file_type || 'image/png');
                        const Icon = fileInfo.icon;
                        return (
                          <>
                            <Icon className={`w-4 h-4 ${fileInfo.color}`} />
                            <span>{fileInfo.label}</span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {msg.role === 'assistant' ? (
                    <div className="relative group">
                      <button
                        onClick={() => handleCopy(msg.content, index)}
                        className="absolute top-1 right-1 p-1.5 bg-slate-700/80 hover:bg-slate-600 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title="Kopiera"
                      >
                        {copiedIndex === index ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                      <div className="prose prose-invert prose-base max-w-none">
                        {renderMarkdownWithCaseLinks(msg.content)}
                      </div>
                      {/* Visa genererad bild om den finns */}
                      {msg.generated_image && (
                        <div className="mt-3">
                          <img
                            src={`data:${msg.generated_image.mimeType};base64,${msg.generated_image.data}`}
                            alt="Genererad bild"
                            className="max-w-full max-h-96 rounded-lg border border-slate-600 shadow-lg"
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => copyImageToClipboard(msg.generated_image!)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-200 transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                              Kopiera
                            </button>
                            <button
                              onClick={() => downloadImage(msg.generated_image!)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-200 transition-colors"
                            >
                              <Download className="w-4 h-4" />
                              Ladda ner
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </div>
            ))
          )}

          {(isLoading || isGeneratingImage) && (
            <div className="flex justify-start">
              <div className="bg-slate-800 border border-slate-700 px-2.5 py-1.5 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className={`w-4 h-4 animate-spin ${isGeneratingImage ? 'text-purple-500' : 'text-emerald-500'}`} />
                  <span className="text-slate-400">
                    {isGeneratingImage ? 'Genererar bild...' : 'Analyserar...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Vald fil-preview */}
        {selectedImage && (
          <div className="px-2 py-1.5 bg-slate-800 border-t border-slate-700">
            <div className="flex items-center gap-2">
              <div className="relative">
                {selectedImage.mimeType === 'application/pdf' ? (
                  <div className="h-12 w-12 flex items-center justify-center bg-red-500/20 rounded border border-red-500/30">
                    <FileText className="w-6 h-6 text-red-400" />
                  </div>
                ) : (
                  <img
                    src={`data:${selectedImage.mimeType};base64,${selectedImage.base64}`}
                    alt="Vald fil"
                    className="h-12 w-12 object-cover rounded border border-slate-600"
                  />
                )}
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute -top-1 -right-1 p-0.5 bg-red-500 rounded-full text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <span className="text-xs text-slate-400">
                {selectedImage.mimeType === 'application/pdf' ? 'PDF-dokument kommer att analyseras av AI' : 'Fil kommer att analyseras av AI'}
              </span>
            </div>
          </div>
        )}

        {/* Inputfält - expanderande */}
        <div className="p-2 bg-slate-800 border-t border-slate-700">
          <div className="flex items-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,.pdf,.xlsx,.xls,.csv,.doc,.docx"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Bifoga fil (bild, PDF, Excel)"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={e => {
                setInputMessage(e.target.value);
                // Auto-resize
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Fråga om kunder, ärenden, tekniker..."
              rows={1}
              className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none min-h-[40px] max-h-[200px] overflow-y-auto"
            />
            <button
              onClick={handleGenerateImage}
              disabled={isGeneratingImage || isLoading || !inputMessage.trim()}
              className="p-2 text-purple-400 hover:text-purple-300 hover:bg-slate-700 disabled:text-slate-600 disabled:cursor-not-allowed rounded transition-colors"
              title="Generera bild från beskrivning"
            >
              {isGeneratingImage ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={handleSendMessage}
              disabled={isLoading || (!inputMessage.trim() && !selectedImage)}
              className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded transition-colors"
              title="Skicka meddelande"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Statistik-modal */}
      {showStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Användningsstatistik</h2>
              <button
                onClick={() => setShowStats(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Din användning */}
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-3">Din användning denna månad</h3>
                {userStats ? (
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Meddelanden" value={userStats.total_messages} />
                    <StatCard label="Kostnad" value={formatCost(userStats.total_cost_usd)} />
                    <StatCard label="Bilder analyserade" value={userStats.total_images_analyzed} />
                    <StatCard label="Bilder genererade" value={userStats.total_images_generated} />
                  </div>
                ) : (
                  <p className="text-slate-400">Laddar...</p>
                )}
              </div>

              {/* Total användning (endast admin) */}
              {profile?.role === 'admin' && totalStats && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Total användning (hela teamet)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Meddelanden" value={totalStats.total_messages} />
                    <StatCard label="Total kostnad" value={formatCost(totalStats.total_cost_usd)} highlight />
                    <StatCard label="Bilder analyserade" value={totalStats.total_images_analyzed} />
                    <StatCard label="Bilder genererade" value={totalStats.total_images_generated} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ärende-modal */}
      {selectedCase && (
        <CaseDetailsModal
          caseId={selectedCase.caseId}
          clickupTaskId={selectedCase.clickupTaskId || ''}
          isOpen={!!selectedCase}
          onClose={() => setSelectedCase(null)}
          fallbackData={selectedCase.fallbackData}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-emerald-600/20 border border-emerald-500/30' : 'bg-slate-700'}`}>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-lg font-semibold ${highlight ? 'text-emerald-400' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}
