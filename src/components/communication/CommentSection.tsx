// src/components/communication/CommentSection.tsx
// Huvudkomponent för kommentarer på ärenden

import React from 'react';
import { CaseType } from '../../types/communication';
import { useCaseComments } from '../../hooks/useCaseComments';
import CommentInput from './CommentInput';
import CommentItem from './CommentItem';
import { MessageSquare, Loader2 } from 'lucide-react';

interface CommentSectionProps {
  caseId: string;
  caseType: CaseType;
  caseTitle?: string;
  compact?: boolean;
}

export default function CommentSection({
  caseId,
  caseType,
  caseTitle,
  compact = false,
}: CommentSectionProps) {
  const {
    comments,
    isLoading,
    isSubmitting,
    error,
    addComment,
    editComment,
    removeComment,
  } = useCaseComments({ caseId, caseType, caseTitle });

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-slate-400 hover:text-white"
        >
          Försök igen
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${compact ? 'gap-3' : 'gap-4'}`}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            Aktivitet & Kommunikation
            {comments.length > 0 && (
              <span className="text-sm text-slate-400">
                ({comments.length})
              </span>
            )}
          </h3>
        </div>
      )}

      {/* Input - fast höjd */}
      <div className="flex-shrink-0">
        <CommentInput
          onSubmit={addComment}
          isSubmitting={isSubmitting}
          placeholder={compact ? 'Skriv kommentar...' : undefined}
        />
      </div>

      {/* Kommentarslista - fyller resterande utrymme */}
      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">
              Inga kommentarer ännu
            </p>
            <p className="text-slate-600 text-xs mt-1">
              Använd @namn för att nämna någon
            </p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onEdit={editComment}
              onDelete={removeComment}
            />
          ))
        )}
      </div>
    </div>
  );
}
