-- Migration: Uppdatera engelska statusar till svenska
-- Datum: 2025-01-14
-- Beskrivning: Uppdaterar gamla engelska statusar till svenska motsvarigheter

-- Uppdatera engelska statusar i cases-tabellen
UPDATE cases 
SET status = CASE 
  WHEN status = 'scheduled' THEN 'Bokad'
  WHEN status = 'in_progress' THEN 'Återbesök 1'
  WHEN status = 'completed' THEN 'Avslutat'
  WHEN status = 'open' THEN 'Öppen'
  WHEN status = 'pending' THEN 'Öppen'
  WHEN status = 'cancelled' THEN 'Stängt - slasklogg'
  ELSE status 
END
WHERE status IN ('scheduled', 'in_progress', 'completed', 'open', 'pending', 'cancelled');

-- Lägg till kommentar för spårbarhet
COMMENT ON TABLE cases IS 'Uppdaterad 2025-01-14: Konverterade engelska statusar till svenska';