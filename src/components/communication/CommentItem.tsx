// src/components/communication/CommentItem.tsx
// Enskild kommentar med författarinfo, innehåll, bilagor, läsbekräftelser och status

import React, { useState, useEffect, useRef } from 'react';
import {
  CaseComment,
  CommentAttachment,
  ROLE_COLORS,
  ROLE_DISPLAY_NAMES,
  AuthorRole,
  formatCommentTime,
  CommentStatus,
  COMMENT_STATUS_CONFIG,
} from '../../types/communication';
import { useAuth } from '../../contexts/AuthContext';
import { markCommentAsRead, getReadReceipts, updateCommentStatus } from '../../services/communicationService';
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
  Reply,
  CornerDownRight,
  Eye,
  Circle,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';

interface ReadReceipt {
  userId: string;
  userName: string;
  readAt: string;
}

interface CommentItemProps {
  comment: CaseComment;
  onEdit?: (commentId: string, content: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onReply?: (comment: CaseComment) => void;
  onStatusChange?: (commentId: string, status: CommentStatus) => void;
  isReply?: boolean;
  depth?: number;
  showStatus?: boolean;
}

export default function CommentItem({
  comment,
  onEdit,
  onDelete,
  onReply,
  onStatusChange,
  isReply = false,
  depth = 0,
  showStatus = false,
}: CommentItemProps) {
  const { user, profile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showMenu, setShowMenu] = useState(false);
  const [showImageModal, setShowImageModal] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [readReceipts, setReadReceipts] = useState<ReadReceipt[]>([]);
  const [showReadReceipts, setShowReadReceipts] = useState(false);
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false);
  const commentRef = useRef<HTMLDivElement>(null);

  const isOwnComment = user?.id === comment.author_id;
  const canEdit = isOwnComment && !comment.is_system_comment;
  const canDelete = isOwnComment || profile?.role === 'admin';
  const canChangeStatus = profile?.role === 'admin' || profile?.role === 'koordinator';

  const roleColors = ROLE_COLORS[comment.author_role as AuthorRole] || ROLE_COLORS.technician;

  // Markera som läst när kommentaren blir synlig (om det inte är egen kommentar)
  useEffect(() => {
    if (!user || isOwnComment || hasMarkedAsRead || comment.is_system_comment) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          markCommentAsRead(comment.id, user.id);
          setHasMarkedAsRead(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    if (commentRef.current) {
      observer.observe(commentRef.current);
    }

    return () => observer.disconnect();
  }, [comment.id, user, isOwnComment, hasMarkedAsRead, comment.is_system_comment]);

  // Hämta läsbekräftelser när man hovrar (endast för egna kommentarer)
  const handleShowReadReceipts = async () => {
    if (!isOwnComment) return;
    setShowReadReceipts(true);
    if (readReceipts.length === 0) {
      const receipts = await getReadReceipts(comment.id);
      setReadReceipts(receipts);
    }
  };

  // Hantera statusändring
  const handleStatusChange = async (newStatus: CommentStatus) => {
    setShowStatusMenu(false);
    if (onStatusChange) {
      onStatusChange(comment.id, newStatus);
    } else {
      try {
        await updateCommentStatus(comment.id, newStatus, user?.id);
      } catch (err) {
        console.error('Fel vid statusändring:', err);
      }
    }
  };

  // Status-ikon
  const StatusIcon = ({ status }: { status: CommentStatus }) => {
    const config = COMMENT_STATUS_CONFIG[status];
    switch (config.icon) {
      case 'check':
        return <CheckCircle2 className={`w-3.5 h-3.5 ${config.color}`} />;
      case 'alert-circle':
        return <AlertCircle className={`w-3.5 h-3.5 ${config.color}`} />;
      case 'clock':
        return <Clock className={`w-3.5 h-3.5 ${config.color}`} />;
      default:
        return <Circle className={`w-3.5 h-3.5 ${config.color}`} />;
    }
  };

  // Rendera @mentions med highlightning
  // Använder mentioned_user_names för exakt matchning (inga regex-gissningar!)
  const renderContent = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;

    const matches: { index: number; length: number; displayName: string; isRole: boolean }[] = [];

    // 1. Matcha gamla formatet @[Namn](user:ID) för bakåtkompatibilitet
    const oldFormatRegex = /@\[([^\]]+)\]\(user:[^)]+\)/g;
    let oldMatch;
    while ((oldMatch = oldFormatRegex.exec(text)) !== null) {
      matches.push({
        index: oldMatch.index,
        length: oldMatch[0].length,
        displayName: oldMatch[1],
        isRole: false
      });
    }

    // 2. Matcha roll-mentions (@tekniker, @koordinator, @admin, @alla)
    const roleRegex = /@(tekniker|koordinator|admin|alla)\b/gi;
    let roleMatch;
    while ((roleMatch = roleRegex.exec(text)) !== null) {
      const isOverlapping = matches.some(m =>
        roleMatch!.index >= m.index && roleMatch!.index < m.index + m.length
      );
      if (!isOverlapping) {
        matches.push({
          index: roleMatch.index,
          length: roleMatch[0].length,
          displayName: roleMatch[1],
          isRole: true
        });
      }
    }

    // 3. FÖRBÄTTRAD: Använd mentioned_user_names för exakt matchning
    // Detta garanterar att highlighting fungerar direkt efter submit
    const mentionedNames = comment.mentioned_user_names || [];
    for (const name of mentionedNames) {
      // Sök efter @Namn i texten (case-insensitive)
      const searchPattern = `@${name}`;
      let searchIndex = 0;

      while (searchIndex < text.length) {
        const foundIndex = text.toLowerCase().indexOf(searchPattern.toLowerCase(), searchIndex);
        if (foundIndex === -1) break;

        const actualLength = searchPattern.length;

        // Kontrollera om detta redan är matchat
        const isOverlapping = matches.some(m =>
          (foundIndex >= m.index && foundIndex < m.index + m.length) ||
          (m.index >= foundIndex && m.index < foundIndex + actualLength)
        );

        if (!isOverlapping) {
          // Extrahera det faktiska namnet från texten (för att bevara case)
          const actualName = text.substring(foundIndex + 1, foundIndex + actualLength);
          matches.push({
            index: foundIndex,
            length: actualLength,
            displayName: actualName,
            isRole: false
          });
        }

        searchIndex = foundIndex + 1;
      }
    }

    // 4. Fallback: Regex för att fånga @Namn som inte finns i mentioned_user_names
    // (t.ex. för gamla kommentarer utan mentioned_user_names)
    if (mentionedNames.length === 0 && comment.mentioned_user_ids && comment.mentioned_user_ids.length > 0) {
      const nameRegex = /@([A-ZÅÄÖ][a-zåäöé'-]*(?:\s+[A-ZÅÄÖ][a-zåäöé'-]*){0,3})(?=\s*[.,!?:;\n]|$|\s+@|\s{2,}|\s+[a-z])/g;
      let nameMatch;
      while ((nameMatch = nameRegex.exec(text)) !== null) {
        const displayName = nameMatch[1].trim();
        const actualLength = displayName.length + 1;

        const isOverlapping = matches.some(m =>
          (nameMatch!.index >= m.index && nameMatch!.index < m.index + m.length) ||
          (m.index >= nameMatch!.index && m.index < nameMatch!.index + actualLength)
        );
        const isRoleMention = ['tekniker', 'koordinator', 'admin', 'alla'].includes(displayName.toLowerCase());

        if (!isOverlapping && !isRoleMention && displayName.length >= 2) {
          matches.push({
            index: nameMatch.index,
            length: actualLength,
            displayName: displayName,
            isRole: false
          });
        }
      }
    }

    // Sortera efter position
    matches.sort((a, b) => a.index - b.index);

    // Bygg upp parts-arrayen
    for (const match of matches) {
      // Text före mention
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Mention med highlight - användare är gröna, roller är lila
      parts.push(
        <span
          key={match.index}
          className={`
            px-1.5 py-0.5 rounded font-medium
            ${match.isRole
              ? 'bg-purple-500/20 text-purple-400'
              : 'bg-[#20c58f]/20 text-[#20c58f]'
            }
          `}
        >
          @{match.displayName}
        </span>
      );

      lastIndex = match.index + match.length;
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

  // Beräkna indent baserat på djup (max 2 nivåer för att undvika för djupa trådar)
  const indentLevel = Math.min(depth, 2);
  const indentClass = indentLevel > 0 ? `ml-${indentLevel * 8}` : '';

  return (
    <div ref={commentRef} className={`group relative ${indentClass}`}>
      {/* Tråd-indikator för svar */}
      {isReply && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-purple-500/30 -ml-4" />
      )}

      <div className={`flex gap-3 p-4 rounded-lg transition-colors ${
        isReply
          ? 'bg-slate-800/30 hover:bg-slate-800/50 border-l-2 border-purple-500/30'
          : 'bg-slate-800/50 hover:bg-slate-800/70'
      }`}>
        {/* Avatar/Initial */}
        <div className="flex-shrink-0">
          <div className={`
            ${isReply ? 'w-8 h-8' : 'w-10 h-10'} rounded-full flex items-center justify-center
            ${roleColors.bg} ${roleColors.border} border
          `}>
            <User className={`${isReply ? 'w-4 h-4' : 'w-5 h-5'} ${roleColors.text}`} />
          </div>
        </div>

        {/* Innehåll */}
        <div className="flex-1 min-w-0">
          {/* Header - Namn framträdande, roll diskret */}
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-white text-[15px]">
                {comment.author_name}
              </span>
              <span className={`
                px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide
                ${roleColors.bg} ${roleColors.text} opacity-80
              `}>
                {ROLE_DISPLAY_NAMES[comment.author_role as AuthorRole]}
              </span>
            </div>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatCommentTime(comment.created_at)}
            </span>
            {comment.is_edited && (
              <span className="text-xs text-slate-500 italic">(redigerad)</span>
            )}

            {/* Ticket-status badge */}
            {showStatus && comment.status && (
              <div className="relative">
                <button
                  onClick={() => canChangeStatus && setShowStatusMenu(!showStatusMenu)}
                  className={`
                    flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium
                    ${COMMENT_STATUS_CONFIG[comment.status].bgColor}
                    ${COMMENT_STATUS_CONFIG[comment.status].color}
                    ${canChangeStatus ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                  `}
                >
                  <StatusIcon status={comment.status} />
                  {COMMENT_STATUS_CONFIG[comment.status].label}
                  {canChangeStatus && <ChevronDown className="w-3 h-3" />}
                </button>

                {/* Status dropdown */}
                {showStatusMenu && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-20 overflow-hidden">
                    {(Object.keys(COMMENT_STATUS_CONFIG) as CommentStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        className={`
                          w-full px-3 py-2 flex items-center gap-2 text-sm transition-colors
                          ${comment.status === status ? 'bg-slate-700' : 'hover:bg-slate-700'}
                        `}
                      >
                        <StatusIcon status={status} />
                        <span className={COMMENT_STATUS_CONFIG[status].color}>
                          {COMMENT_STATUS_CONFIG[status].label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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

          {/* Åtgärdsrad - Svara, antal svar och läsbekräftelser */}
          {!isEditing && (
            <div className="mt-2 flex items-center gap-4">
              {/* Svara-knapp (visas inte för systemkommentarer eller för djupa trådar) */}
              {onReply && depth < 2 && (
                <button
                  onClick={() => onReply(comment)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-400 transition-colors"
                >
                  <Reply className="w-3.5 h-3.5" />
                  Svara
                </button>
              )}

              {/* Antal svar (om det finns) */}
              {comment.reply_count > 0 && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <CornerDownRight className="w-3 h-3" />
                  {comment.reply_count} {comment.reply_count === 1 ? 'svar' : 'svar'}
                </span>
              )}

              {/* Läsbekräftelser (visas endast på egna kommentarer) */}
              {isOwnComment && (
                <div
                  className="relative"
                  onMouseEnter={handleShowReadReceipts}
                  onMouseLeave={() => setShowReadReceipts(false)}
                >
                  <span className="flex items-center gap-1 text-xs text-slate-500 cursor-default">
                    <Eye className="w-3 h-3" />
                    {comment.read_count !== undefined ? (
                      <span>Läst av {comment.read_count}</span>
                    ) : (
                      <span>Läsbekräftelser</span>
                    )}
                  </span>

                  {/* Läsbekräftelse-popup */}
                  {showReadReceipts && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-20 p-2">
                      <div className="text-xs font-medium text-slate-400 mb-2 px-1">
                        Läst av
                      </div>
                      {readReceipts.length === 0 ? (
                        <div className="text-xs text-slate-500 px-1">
                          Ingen har läst ännu
                        </div>
                      ) : (
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {readReceipts.map((receipt) => (
                            <div
                              key={receipt.userId}
                              className="flex items-center justify-between px-1 py-1 text-xs"
                            >
                              <span className="text-white truncate">
                                {receipt.userName}
                              </span>
                              <span className="text-slate-500 ml-2 flex-shrink-0">
                                {formatCommentTime(receipt.readAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
