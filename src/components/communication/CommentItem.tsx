// src/components/communication/CommentItem.tsx
// Enskild kommentar med författarinfo, innehåll och bilagor

import React, { useState } from 'react';
import {
  CaseComment,
  CommentAttachment,
  ROLE_COLORS,
  ROLE_DISPLAY_NAMES,
  AuthorRole,
  formatCommentTime,
} from '../../types/communication';
import { useAuth } from '../../contexts/AuthContext';
import {
  User,
  Clock,
  Pencil,
  Trash2,
  FileText,
  Image as ImageIcon,
  Download,
  MoreHorizontal,
  Settings,
  X,
} from 'lucide-react';

interface CommentItemProps {
  comment: CaseComment;
  onEdit?: (commentId: string, content: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
}

export default function CommentItem({
  comment,
  onEdit,
  onDelete,
}: CommentItemProps) {
  const { user, profile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showMenu, setShowMenu] = useState(false);
  const [showImageModal, setShowImageModal] = useState<string | null>(null);

  const isOwnComment = user?.id === comment.author_id;
  const canEdit = isOwnComment && !comment.is_system_comment;
  const canDelete = isOwnComment || profile?.role === 'admin';

  const roleColors = ROLE_COLORS[comment.author_role as AuthorRole] || ROLE_COLORS.technician;

  // Rendera @mentions med highlightning
  const renderContent = (text: string) => {
    // Matcha @mentions och highlighta dem
    const mentionRegex = /@(\w+)/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Text före mention
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Mention
      parts.push(
        <span
          key={match.index}
          className="text-[#20c58f] font-medium hover:underline cursor-pointer"
        >
          {match[0]}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Text efter sista mention
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent === comment.content) {
      setIsEditing(false);
      return;
    }

    if (onEdit) {
      await onEdit(comment.id, editContent);
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (window.confirm('Är du säker på att du vill ta bort denna kommentar?')) {
      if (onDelete) {
        await onDelete(comment.id);
      }
    }
  };

  // Systemkommentar har egen styling
  if (comment.is_system_comment) {
    return (
      <div className="flex items-center gap-3 py-2 px-3 text-sm">
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
          <Settings className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex-1">
          <span className="text-slate-400">{comment.content}</span>
        </div>
        <span className="text-xs text-slate-500">
          {formatCommentTime(comment.created_at)}
        </span>
      </div>
    );
  }

  return (
    <div className="group relative">
      <div className="flex gap-3 p-4 rounded-lg bg-slate-800/50 hover:bg-slate-800/70 transition-colors">
        {/* Avatar/Initial */}
        <div className="flex-shrink-0">
          <div className={`
            w-10 h-10 rounded-full flex items-center justify-center
            ${roleColors.bg} ${roleColors.border} border
          `}>
            <User className={`w-5 h-5 ${roleColors.text}`} />
          </div>
        </div>

        {/* Innehåll */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-white">
              {comment.author_name}
            </span>
            <span className={`
              px-2 py-0.5 rounded text-xs font-medium
              ${roleColors.bg} ${roleColors.text}
            `}>
              {ROLE_DISPLAY_NAMES[comment.author_role as AuthorRole]}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatCommentTime(comment.created_at)}
            </span>
            {comment.is_edited && (
              <span className="text-xs text-slate-500 italic">(redigerad)</span>
            )}
          </div>

          {/* Text */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-[#20c58f]"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 bg-[#20c58f] text-white rounded-lg text-sm font-medium hover:bg-[#1ab07f]"
                >
                  Spara
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                  className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600"
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <p className="text-slate-200 whitespace-pre-wrap break-words">
              {renderContent(comment.content)}
            </p>
          )}

          {/* Bilagor */}
          {comment.attachments && comment.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {comment.attachments.map((attachment, index) => (
                <AttachmentPreview
                  key={index}
                  attachment={attachment}
                  onClick={() => {
                    if (attachment.mimetype.startsWith('image/')) {
                      setShowImageModal(attachment.url);
                    } else {
                      window.open(attachment.url, '_blank');
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Åtgärdsmeny */}
        {(canEdit || canDelete) && !isEditing && (
          <div className="flex-shrink-0">
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-10 overflow-hidden">
                  {canEdit && (
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Redigera
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => {
                        handleDelete();
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-2 flex items-center gap-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Ta bort
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bild-modal */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(null)}
        >
          <button
            onClick={() => setShowImageModal(null)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={showImageModal}
            alt="Förstoring"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// Förhandsvisning av bilaga
function AttachmentPreview({
  attachment,
  onClick,
}: {
  attachment: CommentAttachment;
  onClick: () => void;
}) {
  const isImage = attachment.mimetype.startsWith('image/');
  const isPdf = attachment.mimetype === 'application/pdf';

  return (
    <button
      onClick={onClick}
      className="group/attachment relative rounded-lg overflow-hidden border border-slate-600 hover:border-slate-500 transition-colors"
    >
      {isImage ? (
        <img
          src={attachment.url}
          alt={attachment.filename}
          className="w-24 h-24 object-cover"
        />
      ) : (
        <div className="w-24 h-24 bg-slate-700 flex flex-col items-center justify-center p-2">
          <FileText className="w-8 h-8 text-red-400 mb-1" />
          <span className="text-xs text-slate-400 truncate w-full text-center">
            {attachment.filename}
          </span>
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/attachment:opacity-100 transition-opacity flex items-center justify-center">
        <Download className="w-5 h-5 text-white" />
      </div>
    </button>
  );
}
