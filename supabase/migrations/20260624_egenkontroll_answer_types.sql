-- Utökar egenkontroll med fler svarstyper:
--   text   = fritextsvar
--   number = siffra/mätvärde (valfri enhet)
--   choice = flerval (fördefinierade alternativ)
--   rating = betyg/skala (1..scale_max)
-- (yes_no och percent fanns sedan tidigare)

-- 1. Ny answer_type-CHECK
ALTER TABLE egenkontroll_questions DROP CONSTRAINT IF EXISTS egenkontroll_questions_answer_type_check;
ALTER TABLE egenkontroll_questions
  ADD CONSTRAINT egenkontroll_questions_answer_type_check
  CHECK (answer_type IN ('yes_no', 'percent', 'text', 'number', 'choice', 'rating'));

-- 2. Frågekonfiguration per svarstyp
ALTER TABLE egenkontroll_questions
  ADD COLUMN IF NOT EXISTS options jsonb,        -- choice: ["OK","Åtgärd krävs","Ej tillämpligt"]
  ADD COLUMN IF NOT EXISTS unit text,            -- number: "st", "°C", "kg" ...
  ADD COLUMN IF NOT EXISTS scale_max integer;    -- rating: 5 eller 10

-- 3. Svars-kolumner för de nya typerna (value_bool/value_percent fanns redan)
ALTER TABLE egenkontroll_review_answers
  ADD COLUMN IF NOT EXISTS value_text text,       -- text + choice (vald option)
  ADD COLUMN IF NOT EXISTS value_number numeric;  -- number + rating
