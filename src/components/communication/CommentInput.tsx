// src/components/communication/CommentInput.tsx
// Textfält med @mention-stöd och bilduppladdning
// FÖRENKLAD: Visar bara @Namn i textarea, skickar IDs separat

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Paperclip, Image as ImageIcon, X, Loader2, Reply, CornerDownRight } from 'lucide-react';
import { useMentions, TrackedMention } from '../../hooks/useMentions';
import MentionSuggestions from './MentionSuggestions';

interface ReplyingTo {
  id: string;
  authorName: string;
  preview: string;
}

interface CommentInputProps {
  onSubmit: (content: string, attachments?: File[], mentions?: TrackedMention[], parentCommentId?: string) => Promise<void>;
  isSubmitting: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  replyingTo?: ReplyingTo | null;
  onCancelReply?: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

export default function CommentInput({
  onSubmit,
  isSubmitting,
  placeholder = 'Skriv en kommentar... (använd @ för att nämna någon)',
  autoFocus = false,
  replyingTo,
  onCancelReply,
}: CommentInputProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    suggestions,
    isOpen,
    selectedIndex,
    mentionedUsers,
    handleInputChange,
    handleKeyDown,
    selectSuggestion,
    closeSuggestions,
    clearMentions,
  } = useMentions(content, setContent);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [content, adjustHeight]);

  // Hantera textändring
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    handleInputChange(newContent, e.target.selectionStart);
  };

  // Hantera tangentbordshändelser
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Låt mentions-hooken hantera först
    if (handleKeyDown(e)) return;

    // Skicka med Cmd/Ctrl + Enter
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Hantera mention-val
  const handleSelectMention = (suggestion: any) => {
    const newText = selectSuggestion(suggestion);
    setContent(newText);
    textareaRef.current?.focus();
  };

  // Hantera filuppladdning
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(files).forEach(file => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: Filtypen stöds inte`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: Filen är för stor (max 5MB)`);
        return;
      }
      validFiles.push(file);
    });

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }

    if (validFiles.length > 0) {
      setAttachments(prev => [...prev, ...validFiles]);

      // Skapa förhandsvisnings-URLer för bilder
      validFiles.forEach(file => {
        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          setPreviewUrls(prev => [...prev, url]);
        } else {
          setPreviewUrls(prev => [...prev, '']); // Placeholder för PDF
        }
      });
    }

    // Återställ input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Ta bort bilaga
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));

    // Cleanup preview URL
    if (previewUrls[index]) {
      URL.revokeObjectURL(previewUrls[index]);
    }
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Skicka kommentar
  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!content.trim() && attachments.length === 0) return;

    // Skicka med mentions-data och parent ID (om det är ett svar)
    await onSubmit(
      content,
      attachments.length > 0 ? attachments : undefined,
      mentionedUsers.length > 0 ? mentionedUsers : undefined,
      replyingTo?.id
    );

    // Rensa
    setContent('');
    setAttachments([]);
    clearMentions(); // Rensa spårade mentions
    previewUrls.forEach(url => url && URL.revokeObjectURL(url));
    setPreviewUrls([]);

    // Avbryt svar-läge
    if (onCancelReply) {
      onCancelReply();
    }

    // Återställ textarea-höjd
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Cleanup vid unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach(url => url && URL.revokeObjectURL(url));
    };
  }, []);

  return (
    <div className="bg-slate-800/40 rounded-md border border-slate-700/80 focus-within:border-[#20c58f]/50 focus-within:ring-1 focus-within:ring-[#20c58f]/20 transition-all duration-200">
      {/* Svarar på - REDESIGN: Tightare, mer subtil */}
      {replyingTo && (
        <div className="px-2.5 py-1.5 border-b border-slate-700/60 bg-slate-700/20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 text-[12px]">
            <CornerDownRight className="w-3 h-3 text-[#20c58f] flex-shrink-0" />
            <span className="text-slate-500">Svarar</span>
            <span className="font-medium text-slate-300 truncate">
              {replyingTo.authorName}
            </span>
            <span className="text-slate-600 truncate hidden sm:inline max-w-[150px]">
              {replyingTo.preview.length > 30 ? replyingTo.preview.slice(0, 30) + '...' : replyingTo.preview}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="p-0.5 text-slate-500 hover:text-slate-300 hover:bg-slate-600/50 rounded transition-colors flex-shrink-0"
            title="Avbryt svar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bilagor-forhandsvisning - REDESIGN: Mindre thumbnails */}
      {attachments.length > 0 && (
        <div className="px-2.5 py-2 border-b border-slate-700/60 flex flex-wrap gap-1.5">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="relative group"
            >
              {file.type.startsWith('image/') && previewUrls[index] ? (
                <img
                  src={previewUrls[index]}
                  alt={file.name}
                  className="w-12 h-12 object-cover rounded border border-slate-600"
                />
              ) : (
                <div className="w-12 h-12 bg-slate-700/50 rounded border border-slate-600 flex items-center justify-center">
                  <span className="text-[9px] text-slate-400 uppercase font-medium">
                    {file.name.split('.').pop()}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-2.5 h-2.5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Textfalt - REDESIGN: Kompaktare */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKey}
          onBlur={() => {
            // Fordröj stängning för att tillåta klick på suggestions
            setTimeout(closeSuggestions, 200);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={1}
          className="w-full px-3 py-2.5 bg-transparent text-[13px] text-slate-200 placeholder-slate-500 resize-none focus:outline-none"
          style={{ minHeight: '38px' }}
        />

        {/* Mention suggestions */}
        {isOpen && (
          <div className="absolute bottom-full left-0 mb-1.5 z-[200]">
            <MentionSuggestions
              suggestions={suggestions}
              selectedIndex={selectedIndex}
              onSelect={handleSelectMention}
            />
          </div>
        )}
      </div>

      {/* Verktygsfalt - REDESIGN: Tightare, mer diskret */}
      <div className="px-2 py-1.5 border-t border-slate-700/40 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {/* Fil-uppladdning */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 rounded transition-colors"
            title="Bifoga fil (bilder eller PDF)"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>

          <span className="text-[11px] text-slate-600">
            @ nämn
          </span>
        </div>

        {/* Skicka-knapp - REDESIGN: Kompaktare */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || (!content.trim() && attachments.length === 0)}
          className={`
            flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium text-[12px]
            transition-all duration-150
            ${isSubmitting || (!content.trim() && attachments.length === 0)
              ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
              : 'bg-[#20c58f] text-white hover:bg-[#1ab07f] shadow-sm'
            }
          `}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="hidden sm:inline">Skickar...</span>
            </>
          ) : (
            <>
              <Send className="w-3 h-3" />
              <span className="hidden sm:inline">Skicka</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
