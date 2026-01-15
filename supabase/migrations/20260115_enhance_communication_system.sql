-- Migration: Förbättra kommunikationssystemet
-- Datum: 2026-01-15
-- Beskrivning: Lägger till stöd för mentioned_user_names, trådar, läsbekräftelser och ticket-status

-- ============================================
-- 1. LÄGG TILL MENTIONED_USER_NAMES KOLUMN
-- ============================================
-- Sparar display names för att garantera korrekt @mention highlighting

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_comments' AND column_name = 'mentioned_user_names'
    ) THEN
        ALTER TABLE case_comments ADD COLUMN mentioned_user_names text[] DEFAULT '{}';
    END IF;
END $$;

-- ============================================
-- 2. TRÅD-STÖD - Svara på kommentarer
-- ============================================

-- Parent comment ID för att skapa trådar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_comments' AND column_name = 'parent_comment_id'
    ) THEN
        ALTER TABLE case_comments ADD COLUMN parent_comment_id uuid REFERENCES case_comments(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Djup i tråden (0 = root, 1 = svar, 2 = svar på svar, etc.)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_comments' AND column_name = 'depth'
    ) THEN
        ALTER TABLE case_comments ADD COLUMN depth integer DEFAULT 0;
    END IF;
END $$;

-- Antal svar (för att visa "X svar" utan att räkna varje gång)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_comments' AND column_name = 'reply_count'
    ) THEN
        ALTER TABLE case_comments ADD COLUMN reply_count integer DEFAULT 0;
    END IF;
END $$;

-- Index för snabbare sökning på parent_comment_id
CREATE INDEX IF NOT EXISTS idx_case_comments_parent ON case_comments(parent_comment_id);

-- ============================================
-- 3. TICKET-STATUS
-- ============================================

-- Status för kommentar/ticket (open, in_progress, resolved, needs_action)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_comments' AND column_name = 'status'
    ) THEN
        ALTER TABLE case_comments ADD COLUMN status text DEFAULT 'open';
    END IF;
END $$;

-- När kommentaren markerades som löst
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_comments' AND column_name = 'resolved_at'
    ) THEN
        ALTER TABLE case_comments ADD COLUMN resolved_at timestamptz;
    END IF;
END $$;

-- Vem som löste kommentaren
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_comments' AND column_name = 'resolved_by'
    ) THEN
        ALTER TABLE case_comments ADD COLUMN resolved_by uuid REFERENCES auth.users(id);
    END IF;
END $$;

-- Index för status-filtrering
CREATE INDEX IF NOT EXISTS idx_case_comments_status ON case_comments(status);

-- ============================================
-- 4. LÄSBEKRÄFTELSER
-- ============================================

-- Skapa tabell för läsbekräftelser om den inte finns
CREATE TABLE IF NOT EXISTS comment_read_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id uuid NOT NULL REFERENCES case_comments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at timestamptz DEFAULT now(),
    UNIQUE(comment_id, user_id)
);

-- Index för snabb lookup
CREATE INDEX IF NOT EXISTS idx_comment_read_receipts_comment ON comment_read_receipts(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_read_receipts_user ON comment_read_receipts(user_id);

-- RLS-policies för läsbekräftelser
ALTER TABLE comment_read_receipts ENABLE ROW LEVEL SECURITY;

-- Alla kan se läsbekräftelser
DROP POLICY IF EXISTS "Alla kan se läsbekräftelser" ON comment_read_receipts;
CREATE POLICY "Alla kan se läsbekräftelser" ON comment_read_receipts
    FOR SELECT USING (true);

-- Användare kan skapa sina egna läsbekräftelser
DROP POLICY IF EXISTS "Användare kan skapa egna läsbekräftelser" ON comment_read_receipts;
CREATE POLICY "Användare kan skapa egna läsbekräftelser" ON comment_read_receipts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Användare kan ta bort sina egna läsbekräftelser
DROP POLICY IF EXISTS "Användare kan ta bort egna läsbekräftelser" ON comment_read_receipts;
CREATE POLICY "Användare kan ta bort egna läsbekräftelser" ON comment_read_receipts
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 5. TRIGGER FÖR ATT UPPDATERA REPLY_COUNT
-- ============================================

-- Funktion för att uppdatera reply_count när ett svar skapas/tas bort
CREATE OR REPLACE FUNCTION update_parent_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
        UPDATE case_comments
        SET reply_count = reply_count + 1
        WHERE id = NEW.parent_comment_id;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_comment_id IS NOT NULL THEN
        UPDATE case_comments
        SET reply_count = GREATEST(0, reply_count - 1)
        WHERE id = OLD.parent_comment_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Skapa trigger om den inte finns
DROP TRIGGER IF EXISTS trigger_update_reply_count ON case_comments;
CREATE TRIGGER trigger_update_reply_count
    AFTER INSERT OR DELETE ON case_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_parent_reply_count();

-- ============================================
-- 6. REALTIME FÖR LÄSBEKRÄFTELSER
-- ============================================

-- Aktivera realtime för comment_read_receipts
ALTER PUBLICATION supabase_realtime ADD TABLE comment_read_receipts;

-- ============================================
-- KOMMENTAR: MIGRATION KLAR
-- ============================================
-- Nya funktioner:
-- 1. mentioned_user_names - Sparar display names för @mentions
-- 2. Tråd-stöd - parent_comment_id, depth, reply_count
-- 3. Ticket-status - status, resolved_at, resolved_by
-- 4. Läsbekräftelser - comment_read_receipts tabell
