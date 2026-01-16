// src/components/communication/CommentItem.tsx
// Enskild kommentar med författarinfo, innehåll, bilagor, läsbekräftelser och status
// REDESIGN: Apple/Linear-inspirerad - kompakt, sofistikerad, hög polish

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
  // Admin, koordinator och tekniker kan ändra ticket-status
  const canChangeStatus = profile?.role === 'admin' || profile?.role === 'koordinator' || profile?.role === 'technician';

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

  // Systemkommentar har egen styling - REDESIGN: Mer subtil och inline
  if (comment.is_system_comment) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2">
        <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
          <Settings className="w-3 h-3 text-slate-500" />
        </div>
        <span className="text-[13px] text-slate-500 flex-1">{comment.content}</span>
        <span className="text-[11px] text-slate-600">
          {formatCommentTime(comment.created_at)}
        </span>
      </div>
    );
  }

  return (
    <div ref={commentRef} className="group relative">
      <div className={`
        flex gap-2.5 py-2.5 px-3 rounded-lg transition-all duration-200
        ${isReply
          ? 'bg-transparent hover:bg-slate-800/30'
          : 'bg-slate-800/40 hover:bg-slate-800/60'
        }
      `}>
        {/* Avatar/Initial - REDESIGN: Mindre, med initial istället för ikon */}
        <div className="flex-shrink-0 pt-0.5">
          <div className={`
            ${isReply ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-[11px]'}
            rounded-full flex items-center justify-center font-semibold
            ${roleColors.bg} ${roleColors.text}
            ring-1 ring-inset ${roleColors.border}
          `}>
            {comment.author_name.charAt(0).toUpperCase()}
          </div>
        </div>

        {/* Innehåll */}
        <div className="flex-1 min-w-0">
          {/* Header - REDESIGN: Tightare, mer kompakt */}
          <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5 mb-0.5">
            <span className="font-medium text-slate-100 text-[13px] leading-tight">
              {comment.author_name}
            </span>
            <span className={`
              text-[10px] font-medium uppercase tracking-wider opacity-70
              ${roleColors.text}
            `}>
              {ROLE_DISPLAY_NAMES[comment.author_role as AuthorRole]}
            </span>
            <span className="text-[11px] text-slate-500">
              {formatCommentTime(comment.created_at)}
            </span>
            {comment.is_edited && (
              <span className="text-[10px] text-slate-600">(redigerad)</span>
            )}

            {/* Ticket-status badge - REDESIGN: Mer diskret */}
            {showStatus && comment.status && (
              <div className="relative ml-auto">
                <button
                  onClick={() => canChangeStatus && setShowStatusMenu(!showStatusMenu)}
                  className={`
                    inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium
                    transition-opacity duration-150
                    ${COMMENT_STATUS_CONFIG[comment.status].bgColor}
                    ${COMMENT_STATUS_CONFIG[comment.status].color}
                    ${canChangeStatus ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                  `}
                >
                  <StatusIcon status={comment.status} />
                  {COMMENT_STATUS_CONFIG[comment.status].label}
                  {canChangeStatus && <ChevronDown className="w-2.5 h-2.5" />}
                </button>

                {/* Status dropdown - REDESIGN: Tightare */}
                {showStatusMenu && (
                  <div className="absolute top-full right-0 mt-1 w-36 bg-slate-800 border border-slate-700 rounded-md shadow-xl z-20 overflow-hidden py-1">
                    {(Object.keys(COMMENT_STATUS_CONFIG) as CommentStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        className={`
                          w-full px-2.5 py-1.5 flex items-center gap-2 text-[12px] transition-colors
                          ${comment.status === status ? 'bg-slate-700/50' : 'hover:bg-slate-700/50'}
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

          {/* Text - REDESIGN: Kompaktare typografi */}
          {isEditing ? (
            <div className="space-y-2 mt-1">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-900/80 border border-slate-600 rounded-md text-[13px] text-slate-200 focus:outline-none focus:border-[#20c58f] focus:ring-1 focus:ring-[#20c58f]/30 transition-all"
                rows={2}
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleSaveEdit}
                  className="px-2.5 py-1 bg-[#20c58f] text-white rounded-md text-[12px] font-medium hover:bg-[#1ab07f] transition-colors"
                >
                  Spara
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                  className="px-2.5 py-1 bg-slate-700/50 text-slate-400 rounded-md text-[12px] font-medium hover:bg-slate-700 hover:text-slate-300 transition-colors"
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
              {renderContent(comment.content)}
            </p>
          )}

          {/* Bilagor - REDESIGN: Mindre thumbnails */}
          {comment.attachments && comment.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
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

          {/* Åtgärdsrad - REDESIGN: Mer diskret, visas vid hover */}
          {!isEditing && (
            <div className="mt-1.5 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              {/* Svara-knapp */}
              {onReply && depth < 2 && (
                <button
                  onClick={() => onReply(comment)}
                  className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-[#20c58f] transition-colors"
                >
                  <Reply className="w-3 h-3" />
                  Svara
                </button>
              )}

              {/* Antal svar */}
              {comment.reply_count > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <CornerDownRight className="w-2.5 h-2.5" />
                  {comment.reply_count} svar
                </span>
              )}

              {/* Läsbekräftelser */}
              {isOwnComment && (
                <div
                  className="relative"
                  onMouseEnter={handleShowReadReceipts}
                  onMouseLeave={() => setShowReadReceipts(false)}
                >
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 cursor-default">
                    <Eye className="w-2.5 h-2.5" />
                    {comment.read_count !== undefined ? (
                      <span>{comment.read_count} läst</span>
                    ) : (
                      <span>Läsbekräftelser</span>
                    )}
                  </span>

                  {/* Läsbekräftelse-popup - REDESIGN: Tightare */}
                  {showReadReceipts && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-44 bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-md shadow-xl z-20 py-1.5 px-2">
                      <div className="text-[10px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                        Läst av
                      </div>
                      {readReceipts.length === 0 ? (
                        <div className="text-[11px] text-slate-500">
                          Ingen har läst ännu
                        </div>
                      ) : (
                        <div className="max-h-28 overflow-y-auto space-y-0.5">
                          {readReceipts.map((receipt) => (
                            <div
                              key={receipt.userId}
                              className="flex items-center justify-between py-0.5 text-[11px]"
                            >
                              <span className="text-slate-200 truncate">
                                {receipt.userName}
                              </span>
                              <span className="text-slate-500 ml-2 flex-shrink-0 text-[10px]">
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

        {/* Åtgärdsmeny - REDESIGN: Mindre, tightare */}
        {(canEdit || canDelete) && !isEditing && (
          <div className="flex-shrink-0 self-start">
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 text-slate-600 hover:text-slate-400 hover:bg-slate-700/50 rounded opacity-0 group-hover:opacity-100 transition-all duration-150"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-0.5 w-28 bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-md shadow-xl z-10 overflow-hidden py-0.5">
                  {canEdit && (
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setShowMenu(false);
                      }}
                      className="w-full px-2.5 py-1.5 flex items-center gap-2 text-[12px] text-slate-300 hover:bg-slate-700/50 transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      Redigera
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => {
                        handleDelete();
                        setShowMenu(false);
                      }}
                      className="w-full px-2.5 py-1.5 flex items-center gap-2 text-[12px] text-red-400 hover:bg-slate-700/50 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Ta bort
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bild-modal - REDESIGN: Mer sofistikerad */}
      {showImageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowImageModal(null)}
        >
          <button
            onClick={() => setShowImageModal(null)}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={showImageModal}
            alt="Förstoring"
            className="max-w-full max-h-[90vh] object-contain rounded-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// Förhandsvisning av bilaga - REDESIGN: Mindre, mer polerad
function AttachmentPreview({
  attachment,
  onClick,
}: {
  attachment: CommentAttachment;
  onClick: () => void;
}) {
  const isImage = attachment.mimetype.startsWith('image/');

  return (
    <button
      onClick={onClick}
      className="group/attachment relative rounded-md overflow-hidden border border-slate-700 hover:border-slate-600 transition-all duration-150 hover:shadow-lg"
    >
      {isImage ? (
        <img
          src={attachment.url}
          alt={attachment.filename}
          className="w-16 h-16 object-cover"
        />
      ) : (
        <div className="w-16 h-16 bg-slate-800 flex flex-col items-center justify-center p-1.5">
          <FileText className="w-5 h-5 text-red-400 mb-0.5" />
          <span className="text-[9px] text-slate-500 truncate w-full text-center leading-tight">
            {attachment.filename}
          </span>
        </div>
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/attachment:opacity-100 transition-opacity duration-150 flex items-center justify-center">
        <Download className="w-4 h-4 text-white" />
      </div>
    </button>
  );
}
