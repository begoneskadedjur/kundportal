// src/components/communication/CommentSection.tsx
// Huvudkomponent för kommentarer på ärenden med tråd-stöd

import React, { useState, useMemo } from 'react';
import { CaseType, CaseComment } from '../../types/communication';
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

interface ReplyingTo {
  id: string;
  authorName: string;
  preview: string;
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

  // State för att svara på kommentar
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);

  // Organisera kommentarer i trådar
  const { rootComments, repliesByParent } = useMemo(() => {
    const roots: CaseComment[] = [];
    const replies: Map<string, CaseComment[]> = new Map();

    for (const comment of comments) {
      if (comment.parent_comment_id) {
        const existing = replies.get(comment.parent_comment_id) || [];
        existing.push(comment);
        replies.set(comment.parent_comment_id, existing);
      } else {
        roots.push(comment);
      }
    }

    // Sortera svar efter tid
    for (const [, replyList] of replies) {
      replyList.sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    return { rootComments: roots, repliesByParent: replies };
  }, [comments]);

  // Hantera svar-knappen
  const handleReply = (comment: CaseComment) => {
    setReplyingTo({
      id: comment.id,
      authorName: comment.author_name,
      preview: comment.content,
    });
  };

  // Avbryt svar
  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  // Rendera en kommentar med sina svar rekursivt
  const renderCommentWithReplies = (comment: CaseComment, depth: number = 0) => {
    const replies = repliesByParent.get(comment.id) || [];

    // Visa status på kommentarer som har @mentions (tickets)
    const hasMentions = comment.mentioned_user_ids && comment.mentioned_user_ids.length > 0;

    return (
      <div key={comment.id} className="space-y-2">
        <CommentItem
          comment={comment}
          onEdit={editComment}
          onDelete={removeComment}
          onReply={handleReply}
          isReply={depth > 0}
          depth={depth}
          showStatus={hasMentions}
        />

        {/* Rendera svar */}
        {replies.length > 0 && (
          <div className="ml-8 space-y-2 border-l-2 border-slate-700/50 pl-4">
            {replies.map((reply) => renderCommentWithReplies(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

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
          replyingTo={replyingTo}
          onCancelReply={handleCancelReply}
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
          rootComments.map((comment) => renderCommentWithReplies(comment, 0))
        )}
      </div>
    </div>
  );
}
