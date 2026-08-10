-- 20260810_profiles_theme_preference.sql
-- Temaval per användare: dark (default, dagens utseende), light eller system
-- (följer operativsystemets inställning). Läses av ThemeContext vid inloggning.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'dark'
    CHECK (theme_preference IN ('dark','light','system'));
