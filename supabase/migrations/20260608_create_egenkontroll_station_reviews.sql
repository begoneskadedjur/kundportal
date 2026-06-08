-- Egenkontroll: stationsgranskningar för egenkontroll-ärenden (Trafikkontoret)
-- Varje rad kopplar ett egenkontrollärende till en station och lagrar
-- checklista-svar (gula ISY-ROAD-punkterna) + fritextnotering.

CREATE TABLE IF NOT EXISTS egenkontroll_station_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  station_id uuid NOT NULL,

  -- Checklista (gula ISY-ROAD-punkterna)
  varningsanslag boolean NOT NULL DEFAULT false,
  markning_tydlig boolean NOT NULL DEFAULT false,
  rodenticid_loggad boolean NOT NULL DEFAULT false,
  atgard_loggad_isyroad boolean NOT NULL DEFAULT false,
  bedomning_loggad boolean NOT NULL DEFAULT false,
  sarskilda_risker boolean NOT NULL DEFAULT false,
  dokumenterat_isyroad boolean NOT NULL DEFAULT false,
  station_vilande boolean NOT NULL DEFAULT false,
  antal_avklarmarkat boolean NOT NULL DEFAULT false,

  -- Fritextnotering per station
  note text,

  -- Tidpunkt när granskningen senast sparades
  reviewed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(case_id, station_id)
);

CREATE INDEX IF NOT EXISTS egenkontroll_station_reviews_case_id_idx
  ON egenkontroll_station_reviews(case_id);

-- RLS: samma mönster som rondering_station_logs
ALTER TABLE egenkontroll_station_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read egenkontroll reviews"
  ON egenkontroll_station_reviews FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert egenkontroll reviews"
  ON egenkontroll_station_reviews FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update egenkontroll reviews"
  ON egenkontroll_station_reviews FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete egenkontroll reviews"
  ON egenkontroll_station_reviews FOR DELETE
  TO authenticated USING (true);
