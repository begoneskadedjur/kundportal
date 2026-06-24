-- Dynamiska egenkontroller per kund/organisation.
-- Ersätter de hårdkodade 9 boolean-kolumnerna i egenkontroll_station_reviews
-- med ett byggbart frågesystem: mall per organisation, frågor med svarstyp
-- (ja/nej eller procent), och svar lagrade typat per fråga.
--
-- Koppling: organization_id (atomärt — alla regioner i en kommun delar mall).
-- customer_id finns för ev. framtida per-region-override (används ej i v1).
-- organization_id = NULL → global standardmall (fallback).

-- ─────────────────────────────────────────────────────────────
-- 1. MALL (en per organisation)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS egenkontroll_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NULL = global standardmall (används när organisationen saknar egen).
  -- customers.organization_id saknar FK (löst grupperings-UUID) → ingen FK här heller.
  organization_id uuid,
  -- Reserverad för framtida per-kund-override (används ej i v1)
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,

  name text NOT NULL DEFAULT 'Egenkontroll',
  -- Avvikelserapportering på/av (toggle i inställningarna)
  allow_deviations boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- En mall per organisation (kundspecifika overrides hanteras separat via customer_id)
CREATE UNIQUE INDEX IF NOT EXISTS egenkontroll_templates_org_idx
  ON egenkontroll_templates (organization_id)
  WHERE organization_id IS NOT NULL AND customer_id IS NULL;

-- Exakt en global standardmall
CREATE UNIQUE INDEX IF NOT EXISTS egenkontroll_templates_global_idx
  ON egenkontroll_templates ((1))
  WHERE organization_id IS NULL AND customer_id IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. FRÅGOR (i en mall)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS egenkontroll_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES egenkontroll_templates(id) ON DELETE CASCADE,

  question_text text NOT NULL,
  -- Svarstyp: 'yes_no' (ja/nej/ej kontrollerad) eller 'percent' (0-100%)
  answer_type text NOT NULL DEFAULT 'yes_no'
    CHECK (answer_type IN ('yes_no', 'percent')),

  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS egenkontroll_questions_template_idx
  ON egenkontroll_questions (template_id, sort_order);

-- ─────────────────────────────────────────────────────────────
-- 3. SVAR (typat key-value per station-review + fråga)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS egenkontroll_review_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES egenkontroll_station_reviews(id) ON DELETE CASCADE,
  -- Ej FK med ON DELETE CASCADE som tappar svar — vi behåller svaret även om frågan
  -- raderas (orphan hanteras i läsvägen via union mot mallens aktiva frågor).
  question_id uuid NOT NULL REFERENCES egenkontroll_questions(id) ON DELETE CASCADE,

  -- yes_no: null=ej kontrollerad, true=ja/godkänt, false=nej/ej godkänt
  value_bool boolean,
  -- percent: 0-100 (null=ej angivet)
  value_percent integer CHECK (value_percent IS NULL OR (value_percent >= 0 AND value_percent <= 100)),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (review_id, question_id)
);

CREATE INDEX IF NOT EXISTS egenkontroll_review_answers_review_idx
  ON egenkontroll_review_answers (review_id);

-- ─────────────────────────────────────────────────────────────
-- RLS — följer befintligt egenkontroll-mönster (authenticated).
-- OBS: skarp scoping mot multisite_user_roles hör till säkerhetsplan fas 3.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE egenkontroll_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE egenkontroll_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE egenkontroll_review_answers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['egenkontroll_templates','egenkontroll_questions','egenkontroll_review_answers']
  LOOP
    EXECUTE format('CREATE POLICY "auth read %1$s" ON %1$s FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format('CREATE POLICY "auth insert %1$s" ON %1$s FOR INSERT TO authenticated WITH CHECK (true);', t);
    EXECUTE format('CREATE POLICY "auth update %1$s" ON %1$s FOR UPDATE TO authenticated USING (true) WITH CHECK (true);', t);
    EXECUTE format('CREATE POLICY "auth delete %1$s" ON %1$s FOR DELETE TO authenticated USING (true);', t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- SEED: global standardmall med de nuvarande 9 frågorna (som ja/nej).
-- Tjänar som startpunkt; admin kan klona/redigera per organisation.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE v_template_id uuid;
BEGIN
  INSERT INTO egenkontroll_templates (organization_id, customer_id, name, allow_deviations)
  VALUES (NULL, NULL, 'Standardmall egenkontroll', true)
  RETURNING id INTO v_template_id;

  INSERT INTO egenkontroll_questions (template_id, question_text, answer_type, sort_order) VALUES
    (v_template_id, 'Varningsanslag — helt, tydligt och uppdaterat med senaste datum', 'yes_no', 0),
    (v_template_id, 'Märkning hel och tydlig, stationsnummer syns tydligt',            'yes_no', 1),
    (v_template_id, 'Rodenticid loggad (50%+ förbrukat → påfyllt)',                    'yes_no', 2),
    (v_template_id, 'Åtgärd loggad i ISY-ROAD under ronderingen',                      'yes_no', 3),
    (v_template_id, 'Bedömning loggad i fältet "Bete uppätet till"',                   'yes_no', 4),
    (v_template_id, 'Särskilda risker i närområdet loggade',                           'yes_no', 5),
    (v_template_id, 'Allt dokumenterat i ISY-ROAD inom 4 timmar',                      'yes_no', 6),
    (v_template_id, 'Stationsstatus kontrollerad (ej "Vilande" utan skäl)',            'yes_no', 7),
    (v_template_id, 'Antal stationer klarmarkerat och avvikelser registrerade',        'yes_no', 8);
END $$;
