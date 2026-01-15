// src/components/communication/CommentInput.tsx
// Textfält med @mention-stöd och bilduppladdning

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Paperclip, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { useMentions } from '../../hooks/useMentions';
import MentionSuggestions from './MentionSuggestions';

interface CommentInputProps {
  onSubmit: (content: string, attachments?: File[]) => Promise<void>;
  isSubmitting: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

export default function CommentInput({
  onSubmit,
  isSubmitting,
  placeholder = 'Skriv en kommentar... (använd @ för att nämna någon)',
  autoFocus = false,
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
    handleInputChange,
    handleKeyDown,
    selectSuggestion,
    closeSuggestions,
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

    await onSubmit(content, attachments.length > 0 ? attachments : undefined);

    // Rensa
    setContent('');
    setAttachments([]);
    previewUrls.forEach(url => url && URL.revokeObjectURL(url));
    setPreviewUrls([]);

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
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 focus-within:border-[#20c58f]/50 transition-colors">
      {/* Bilagor-förhandsvisning */}
      {attachments.length > 0 && (
        <div className="p-3 border-b border-slate-700 flex flex-wrap gap-2">
          {attachments.map((file, index) => (
            <div
              key={index}
              className="relative group"
            >
              {file.type.startsWith('image/') && previewUrls[index] ? (
                <img
                  src={previewUrls[index]}
                  alt={file.name}
                  className="w-16 h-16 object-cover rounded-lg border border-slate-600"
                />
              ) : (
                <div className="w-16 h-16 bg-slate-700 rounded-lg border border-slate-600 flex items-center justify-center">
                  <span className="text-xs text-slate-400 uppercase">
                    {file.name.split('.').pop()}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Textfält */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKey}
          onBlur={() => {
            // Fördröj stängning för att tillåta klick på suggestions
            setTimeout(closeSuggestions, 200);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={1}
          className="w-full px-4 py-3 bg-transparent text-white placeholder-slate-500 resize-none focus:outline-none"
          style={{ minHeight: '44px' }}
        />

        {/* Mention suggestions */}
        {isOpen && (
          <div className="absolute bottom-full left-0 mb-2">
            <MentionSuggestions
              suggestions={suggestions}
              selectedIndex={selectedIndex}
              onSelect={handleSelectMention}
            />
          </div>
        )}
      </div>

      {/* Verktygsfält */}
      <div className="px-3 py-2 border-t border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
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
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
            title="Bifoga fil (bilder eller PDF)"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <span className="text-xs text-slate-500">
            @ för att nämna
          </span>
        </div>

        {/* Skicka-knapp */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || (!content.trim() && attachments.length === 0)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
            transition-all duration-200
            ${isSubmitting || (!content.trim() && attachments.length === 0)
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-[#20c58f] text-white hover:bg-[#1ab07f] shadow-lg shadow-[#20c58f]/20'
            }
          `}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Skickar...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Skicka
            </>
          )}
        </button>
      </div>
    </div>
  );
}
