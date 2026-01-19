-- Migration: Create station inspection sessions system
-- Date: 2026-01-19
-- Description: Tables for station inspection cases and outdoor station inspections (Fas 5)

-- ============================================
-- 1. STATION INSPECTION SESSIONS TABLE
-- ============================================
-- Denna tabell lagrar bokade stationskontroll-ärenden
-- Kopplas till ett ärende och spårar teknikerns progress

CREATE TABLE IF NOT EXISTS station_inspection_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ärendekoppling (kan vara NULL om sessionen skapas direkt)
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,

    -- Kundkoppling
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,

    -- Tekniker som utför kontrollen
    technician_id UUID REFERENCES technicians(id) ON DELETE SET NULL,

    -- Tidsstämplar
    scheduled_at TIMESTAMPTZ,              -- Inbokat datum/tid
    started_at TIMESTAMPTZ,                -- När teknikern startade
    completed_at TIMESTAMPTZ,              -- När kontrollen avslutades

    -- Progress
    total_outdoor_stations INTEGER DEFAULT 0,
    total_indoor_stations INTEGER DEFAULT 0,
    inspected_outdoor_stations INTEGER DEFAULT 0,
    inspected_indoor_stations INTEGER DEFAULT 0,

    -- Status
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),

    -- Övergripande anteckningar för hela sessionen
    notes TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- Index för snabba uppslag
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_customer_id ON station_inspection_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_technician_id ON station_inspection_sessions(technician_id);
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_scheduled_at ON station_inspection_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_status ON station_inspection_sessions(status);
CREATE INDEX IF NOT EXISTS idx_inspection_sessions_case_id ON station_inspection_sessions(case_id);

-- ============================================
-- 2. OUTDOOR STATION INSPECTIONS TABLE
-- ============================================
-- Inspektioner för utomhusstationer (equipment_placements)
-- Parallell struktur till indoor_station_inspections

CREATE TABLE IF NOT EXISTS outdoor_station_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Koppling till utomhusstation
    station_id UUID REFERENCES equipment_placements(id) ON DELETE CASCADE NOT NULL,

    -- Koppling till inspektionssession (valfritt - för sessionbaserade kontroller)
    session_id UUID REFERENCES station_inspection_sessions(id) ON DELETE SET NULL,

    -- Kontrollinfo
    inspected_at TIMESTAMPTZ DEFAULT NOW(),
    inspected_by UUID REFERENCES technicians(id),

    -- Resultat (samma status som indoor)
    status TEXT NOT NULL CHECK (status IN ('ok', 'activity', 'needs_service', 'replaced')),
    findings TEXT,                         -- Beskrivning av fynd
    photo_path TEXT,                       -- Foto från kontrollen

    -- Mätning (om applicerbart baserat på stationstyp)
    measurement_value DECIMAL(10,2),       -- T.ex. förbrukning i gram
    measurement_unit TEXT,                 -- 'gram', 'st', etc.

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index för snabb historik per station
CREATE INDEX IF NOT EXISTS idx_outdoor_inspections_station_id ON outdoor_station_inspections(station_id);
CREATE INDEX IF NOT EXISTS idx_outdoor_inspections_session_id ON outdoor_station_inspections(session_id);
CREATE INDEX IF NOT EXISTS idx_outdoor_inspections_inspected_at ON outdoor_station_inspections(inspected_at DESC);

-- ============================================
-- 3. UTÖKA INDOOR_STATION_INSPECTIONS
-- ============================================
-- Lägg till session_id för att koppla till inspektionssessioner
-- Lägg till mätningsfält

ALTER TABLE indoor_station_inspections
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES station_inspection_sessions(id) ON DELETE SET NULL;

ALTER TABLE indoor_station_inspections
ADD COLUMN IF NOT EXISTS measurement_value DECIMAL(10,2);

ALTER TABLE indoor_station_inspections
ADD COLUMN IF NOT EXISTS measurement_unit TEXT;

-- Index för session-koppling
CREATE INDEX IF NOT EXISTS idx_indoor_inspections_session_id ON indoor_station_inspections(session_id);

-- ============================================
-- 4. UTÖKA INDOOR_STATIONS
-- ============================================
-- Lägg till station_type_id (FK till station_types) och calculated_status

ALTER TABLE indoor_stations
ADD COLUMN IF NOT EXISTS station_type_id UUID REFERENCES station_types(id);

ALTER TABLE indoor_stations
ADD COLUMN IF NOT EXISTS calculated_status TEXT DEFAULT 'ok' CHECK (calculated_status IN ('ok', 'warning', 'critical'));

-- ============================================
-- 5. UTÖKA EQUIPMENT_PLACEMENTS (utomhusstationer)
-- ============================================
-- Lägg till station_type_id och calculated_status för konsistens

ALTER TABLE equipment_placements
ADD COLUMN IF NOT EXISTS station_type_id UUID REFERENCES station_types(id);

ALTER TABLE equipment_placements
ADD COLUMN IF NOT EXISTS calculated_status TEXT DEFAULT 'ok' CHECK (calculated_status IN ('ok', 'warning', 'critical'));

-- ============================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE station_inspection_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outdoor_station_inspections ENABLE ROW LEVEL SECURITY;

-- Station inspection sessions policies
CREATE POLICY "Authenticated users can read inspection sessions"
ON station_inspection_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create inspection sessions"
ON station_inspection_sessions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update inspection sessions"
ON station_inspection_sessions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete inspection sessions"
ON station_inspection_sessions FOR DELETE TO authenticated USING (true);

-- Outdoor inspections policies
CREATE POLICY "Authenticated users can read outdoor inspections"
ON outdoor_station_inspections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create outdoor inspections"
ON outdoor_station_inspections FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- 7. STORAGE BUCKET FÖR INSPEKTIONSFOTON
-- ============================================

-- Bucket för inspektionsfoton (utomhus)
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos', 'inspection-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload inspection photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inspection-photos');

CREATE POLICY "Authenticated users can view inspection photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'inspection-photos');

CREATE POLICY "Authenticated users can delete inspection photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'inspection-photos');

-- ============================================
-- 8. AUTO-UPDATE TIMESTAMPS TRIGGER
-- ============================================

-- Apply trigger to station_inspection_sessions
DROP TRIGGER IF EXISTS station_inspection_sessions_updated_at ON station_inspection_sessions;
CREATE TRIGGER station_inspection_sessions_updated_at
    BEFORE UPDATE ON station_inspection_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_indoor_updated_at();

-- ============================================
-- 9. HJÄLPFUNKTION FÖR ATT BERÄKNA PROGRESS
-- ============================================

-- Funktion för att uppdatera session-progress automatiskt
CREATE OR REPLACE FUNCTION update_inspection_session_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_session_id UUID;
    v_indoor_count INTEGER;
    v_outdoor_count INTEGER;
BEGIN
    -- Hämta session_id från den nya raden
    v_session_id := COALESCE(NEW.session_id, OLD.session_id);

    IF v_session_id IS NOT NULL THEN
        -- Räkna indoor inspections
        SELECT COUNT(*) INTO v_indoor_count
        FROM indoor_station_inspections
        WHERE session_id = v_session_id;

        -- Räkna outdoor inspections
        SELECT COUNT(*) INTO v_outdoor_count
        FROM outdoor_station_inspections
        WHERE session_id = v_session_id;

        -- Uppdatera sessionen
        UPDATE station_inspection_sessions
        SET
            inspected_indoor_stations = v_indoor_count,
            inspected_outdoor_stations = v_outdoor_count,
            updated_at = NOW()
        WHERE id = v_session_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger för indoor inspections
DROP TRIGGER IF EXISTS update_session_progress_indoor ON indoor_station_inspections;
CREATE TRIGGER update_session_progress_indoor
    AFTER INSERT OR UPDATE OR DELETE ON indoor_station_inspections
    FOR EACH ROW
    EXECUTE FUNCTION update_inspection_session_progress();

-- Trigger för outdoor inspections
DROP TRIGGER IF EXISTS update_session_progress_outdoor ON outdoor_station_inspections;
CREATE TRIGGER update_session_progress_outdoor
    AFTER INSERT OR UPDATE OR DELETE ON outdoor_station_inspections
    FOR EACH ROW
    EXECUTE FUNCTION update_inspection_session_progress();

-- ============================================
-- 10. KOMMENTARER FÖR DOKUMENTATION
-- ============================================

COMMENT ON TABLE station_inspection_sessions IS 'Bokade stationskontroll-sessioner för tekniker';
COMMENT ON TABLE outdoor_station_inspections IS 'Inspektionsloggar för utomhusstationer (equipment_placements)';
COMMENT ON COLUMN station_inspection_sessions.status IS 'scheduled = inbokad, in_progress = pågående, completed = avslutad, cancelled = avbokad';
COMMENT ON COLUMN outdoor_station_inspections.status IS 'ok = godkänd, activity = aktivitet, needs_service = service krävs, replaced = utbytt';
