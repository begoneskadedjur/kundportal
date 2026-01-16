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
    changeStatus,
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
  // REDESIGN: Subtil tråd-indikator istället för tjock lila border
  const renderCommentWithReplies = (comment: CaseComment, depth: number = 0) => {
    const replies = repliesByParent.get(comment.id) || [];

    // Visa status på kommentarer som har @mentions (tickets)
    const hasMentions = comment.mentioned_user_ids && comment.mentioned_user_ids.length > 0;

    return (
      <div key={comment.id}>
        <CommentItem
          comment={comment}
          onEdit={editComment}
          onDelete={removeComment}
          onReply={handleReply}
          onStatusChange={changeStatus}
          isReply={depth > 0}
          depth={depth}
          showStatus={hasMentions}
        />

        {/* Rendera svar - REDESIGN: Subtil indentation utan tjock border */}
        {replies.length > 0 && (
          <div className="ml-6 mt-0.5 pl-3 relative">
            {/* Subtil tråd-linje */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-slate-700/60 via-slate-700/30 to-transparent" />
            <div className="space-y-0.5">
              {replies.map((reply) => renderCommentWithReplies(reply, depth + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-400 text-[13px]">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-[12px] text-slate-400 hover:text-white transition-colors"
        >
          Försök igen
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${compact ? 'gap-2.5' : 'gap-3'}`}>
      {/* Header - REDESIGN: Tightare */}
      {!compact && (
        <div className="flex items-center justify-between flex-shrink-0">
          <h3 className="font-medium text-slate-200 text-[14px] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            Aktivitet
            {comments.length > 0 && (
              <span className="text-[12px] text-slate-500 font-normal">
                {comments.length}
              </span>
            )}
          </h3>
        </div>
      )}

      {/* Input - fast hojd */}
      <div className="flex-shrink-0">
        <CommentInput
          onSubmit={addComment}
          isSubmitting={isSubmitting}
          placeholder={compact ? 'Skriv kommentar...' : undefined}
          replyingTo={replyingTo}
          onCancelReply={handleCancelReply}
        />
      </div>

      {/* Kommentarslista - REDESIGN: Tightare spacing */}
      <div className="space-y-1 flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-6">
            <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-1.5" />
            <p className="text-slate-500 text-[13px]">
              Inga kommentarer ännu
            </p>
            <p className="text-slate-600 text-[11px] mt-0.5">
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
