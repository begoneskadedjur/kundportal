// src/hooks/useMentions.ts
// Hook för @mention-funktionalitet med autocomplete
// FÖRENKLAD: Visar bara @Namn i textarea, sparar IDs separat

import { useState, useCallback, useRef, useEffect } from 'react';
import { MentionSuggestion, getMentionTriggerRegex } from '../types/communication';
import { getMentionSuggestions } from '../services/communicationService';
import { useAuth } from '../contexts/AuthContext';

// Typ för en spårad mention med ID
export interface TrackedMention {
  userId: string;
  displayName: string;
  type: 'user' | 'role' | 'all';
  role?: string;
}

interface UseMentionsReturn {
  suggestions: MentionSuggestion[];
  isOpen: boolean;
  selectedIndex: number;
  searchQuery: string;
  mentionedUsers: TrackedMention[];
  handleInputChange: (text: string, cursorPosition: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  selectSuggestion: (suggestion: MentionSuggestion) => string;
  closeSuggestions: () => void;
  clearMentions: () => void;
}

export function useMentions(
  currentText: string,
  onTextChange: (newText: string) => void
): UseMentionsReturn {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [mentionedUsers, setMentionedUsers] = useState<TrackedMention[]>([]);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Hantera textändring
  const handleInputChange = useCallback(
    async (text: string, cursorPosition: number) => {
      // Hitta text före cursor
      const textBeforeCursor = text.substring(0, cursorPosition);

      // Kolla om vi är mitt i en mention
      const mentionMatch = textBeforeCursor.match(getMentionTriggerRegex());

      if (mentionMatch) {
        const query = mentionMatch[1];
        const startIndex = cursorPosition - query.length - 1; // -1 för @

        setSearchQuery(query);
        setMentionStartIndex(startIndex);
        setSelectedIndex(0);

        // Debounce API-anrop
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(async () => {
          if (!user) return;

          try {
            const results = await getMentionSuggestions(query, user.id);
            setSuggestions(results);
            setIsOpen(results.length > 0);
          } catch (err) {
            console.error('Fel vid hämtning av mentions:', err);
            setSuggestions([]);
            setIsOpen(false);
          }
        }, 150);
      } else {
        closeSuggestions();
      }
    },
    [user]
  );

  // Hantera tangentbordshändelser
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!isOpen || suggestions.length === 0) return false;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          return true;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          return true;

        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            const newText = selectSuggestion(suggestions[selectedIndex]);
            onTextChange(newText);
          }
          return true;

        case 'Escape':
          e.preventDefault();
          closeSuggestions();
          return true;

        default:
          return false;
      }
    },
    [isOpen, suggestions, selectedIndex, onTextChange]
  );

  // Välj en suggestion - FÖRENKLAD: visar bara @Namn, sparar ID separat
  const selectSuggestion = useCallback(
    (suggestion: MentionSuggestion): string => {
      const textBeforeMention = currentText.substring(0, mentionStartIndex);
      const textAfterCursor = currentText.substring(
        mentionStartIndex + searchQuery.length + 1
      );

      // Visa ENDAST det snygga formatet: @Förnamn Efternamn
      // Ingen teknisk info i texten - allt sparas i mentionedUsers
      const cleanDisplayName = suggestion.displayName.replace(/^@/, '');
      const mentionText = `@${cleanDisplayName}`;

      // Spara mention-info separat för notifikationer
      if (suggestion.type === 'user' && suggestion.id) {
        // Lägg till användare om den inte redan finns
        setMentionedUsers(prev => {
          const exists = prev.some(m => m.userId === suggestion.id);
          if (exists) return prev;
          return [...prev, {
            userId: suggestion.id!,
            displayName: suggestion.displayName,
            type: 'user'
          }];
        });
      } else if (suggestion.type === 'role' && suggestion.role) {
        // Spåra roll-mention
        setMentionedUsers(prev => {
          const exists = prev.some(m => m.type === 'role' && m.role === suggestion.role);
          if (exists) return prev;
          return [...prev, {
            userId: `role:${suggestion.role}`,
            displayName: suggestion.displayName,
            type: 'role',
            role: suggestion.role
          }];
        });
      } else if (suggestion.type === 'all') {
        // Spåra @alla
        setMentionedUsers(prev => {
          const exists = prev.some(m => m.type === 'all');
          if (exists) return prev;
          return [...prev, {
            userId: 'all',
            displayName: '@alla',
            type: 'all'
          }];
        });
      }

      const newText = textBeforeMention + mentionText + ' ' + textAfterCursor;

      closeSuggestions();
      return newText;
    },
    [currentText, mentionStartIndex, searchQuery]
  );

  // Rensa alla spårade mentions (vid submit)
  const clearMentions = useCallback(() => {
    setMentionedUsers([]);
  }, []);

  // Stäng suggestions
  const closeSuggestions = useCallback(() => {
    setIsOpen(false);
    setSuggestions([]);
    setSearchQuery('');
    setMentionStartIndex(-1);
    setSelectedIndex(0);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    suggestions,
    isOpen,
    selectedIndex,
    searchQuery,
    mentionedUsers,
    handleInputChange,
    handleKeyDown,
    selectSuggestion,
    closeSuggestions,
    clearMentions,
  };
}
