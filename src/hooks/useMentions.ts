// src/hooks/useMentions.ts
// Hook för @mention-funktionalitet med autocomplete

import { useState, useCallback, useRef, useEffect } from 'react';
import { MentionSuggestion, getMentionTriggerRegex } from '../types/communication';
import { getMentionSuggestions } from '../services/communicationService';
import { useAuth } from '../contexts/AuthContext';

interface UseMentionsReturn {
  suggestions: MentionSuggestion[];
  isOpen: boolean;
  selectedIndex: number;
  searchQuery: string;
  handleInputChange: (text: string, cursorPosition: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
  selectSuggestion: (suggestion: MentionSuggestion) => string;
  closeSuggestions: () => void;
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

  // Välj en suggestion
  const selectSuggestion = useCallback(
    (suggestion: MentionSuggestion): string => {
      const textBeforeMention = currentText.substring(0, mentionStartIndex);
      const textAfterCursor = currentText.substring(
        mentionStartIndex + searchQuery.length + 1
      );

      let mentionText: string;
      if (suggestion.type === 'user' && suggestion.id) {
        // För användare, inkludera ID i ett speciellt format: @[Namn](user:ID)
        mentionText = `@[${suggestion.displayName}](user:${suggestion.id})`;
      } else if (suggestion.type === 'role' && suggestion.role) {
        // För roller, behåll vanligt format
        mentionText = suggestion.displayName;
      } else {
        // För @alla
        mentionText = suggestion.displayName;
      }

      const newText = textBeforeMention + mentionText + ' ' + textAfterCursor;

      closeSuggestions();
      return newText;
    },
    [currentText, mentionStartIndex, searchQuery]
  );

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
    handleInputChange,
    handleKeyDown,
    selectSuggestion,
    closeSuggestions,
  };
}
