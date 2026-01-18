-- Migration: Create indoor stations system
-- Date: 2026-01-18
-- Description: Tables for floor plans and indoor station placements

-- ============================================
-- 1. FLOOR PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS floor_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,                    -- "Våning 1", "Kök", etc.
    description TEXT,
    building_name TEXT,                    -- Valfri gruppering: "Huvudbyggnad"
    image_path TEXT NOT NULL,              -- Supabase Storage sökväg
    image_width INTEGER,                   -- Original bildbredd i pixlar
    image_height INTEGER,                  -- Original bildhöjd i pixlar
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index för snabba uppslag per kund
CREATE INDEX IF NOT EXISTS idx_floor_plans_customer_id ON floor_plans(customer_id);

-- ============================================
-- 2. INDOOR STATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS indoor_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    floor_plan_id UUID REFERENCES floor_plans(id) ON DELETE CASCADE NOT NULL,

    -- Stationsinfo
    station_type TEXT NOT NULL CHECK (station_type IN ('mechanical_trap', 'bait_station', 'concrete_station')),
    station_number TEXT,                   -- T.ex. "I-001", auto-genererat eller manuellt

    -- Position som procent (0-100) av bildens dimensioner
    -- Detta gör positionen oberoende av hur bilden visas
    position_x_percent DECIMAL(5,2) NOT NULL CHECK (position_x_percent >= 0 AND position_x_percent <= 100),
    position_y_percent DECIMAL(5,2) NOT NULL CHECK (position_y_percent >= 0 AND position_y_percent <= 100),

    -- Beskrivning och metadata
    location_description TEXT,             -- "Vid diskbänk", "Hörn mot fönster"
    comment TEXT,
    photo_path TEXT,                       -- Supabase Storage sökväg för stationsfoto

    -- Status (samma som equipment_placements)
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'removed', 'missing', 'damaged')),
    status_updated_at TIMESTAMPTZ,
    status_updated_by UUID REFERENCES profiles(id),

    -- Vem placerade och när
    placed_at TIMESTAMPTZ DEFAULT NOW(),
    placed_by_technician_id UUID REFERENCES technicians(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index för snabba uppslag per planritning
CREATE INDEX IF NOT EXISTS idx_indoor_stations_floor_plan_id ON indoor_stations(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_indoor_stations_status ON indoor_stations(status);

-- ============================================
-- 3. INDOOR STATION INSPECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS indoor_station_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID REFERENCES indoor_stations(id) ON DELETE CASCADE NOT NULL,

    -- Kontrollinfo
    inspected_at TIMESTAMPTZ DEFAULT NOW(),
    inspected_by UUID REFERENCES technicians(id),

    -- Resultat
    status TEXT NOT NULL CHECK (status IN ('ok', 'activity', 'needs_service', 'replaced')),
    findings TEXT,                         -- Beskrivning av fynd
    photo_path TEXT,                       -- Foto från kontrollen

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index för snabb historik per station
CREATE INDEX IF NOT EXISTS idx_indoor_station_inspections_station_id ON indoor_station_inspections(station_id);
CREATE INDEX IF NOT EXISTS idx_indoor_station_inspections_inspected_at ON indoor_station_inspections(inspected_at DESC);

-- ============================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE indoor_station_inspections ENABLE ROW LEVEL SECURITY;

-- Floor plans policies
CREATE POLICY "Authenticated users can read floor plans"
ON floor_plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create floor plans"
ON floor_plans FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update floor plans"
ON floor_plans FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete floor plans"
ON floor_plans FOR DELETE TO authenticated USING (true);

-- Indoor stations policies
CREATE POLICY "Authenticated users can read indoor stations"
ON indoor_stations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create indoor stations"
ON indoor_stations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update indoor stations"
ON indoor_stations FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete indoor stations"
ON indoor_stations FOR DELETE TO authenticated USING (true);

-- Inspections policies
CREATE POLICY "Authenticated users can read inspections"
ON indoor_station_inspections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create inspections"
ON indoor_station_inspections FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- 5. STORAGE BUCKETS
-- ============================================

-- Bucket för planritningar
INSERT INTO storage.buckets (id, name, public)
VALUES ('floor-plans', 'floor-plans', false)
ON CONFLICT (id) DO NOTHING;

-- Bucket för inomhusstationsfoton
INSERT INTO storage.buckets (id, name, public)
VALUES ('indoor-station-photos', 'indoor-station-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies för floor-plans bucket
CREATE POLICY "Authenticated users can upload floor plans"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'floor-plans');

CREATE POLICY "Authenticated users can view floor plans"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'floor-plans');

CREATE POLICY "Authenticated users can delete floor plans"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'floor-plans');

-- Storage policies för indoor-station-photos bucket
CREATE POLICY "Authenticated users can upload indoor station photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'indoor-station-photos');

CREATE POLICY "Authenticated users can view indoor station photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'indoor-station-photos');

CREATE POLICY "Authenticated users can delete indoor station photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'indoor-station-photos');

-- ============================================
-- 6. AUTO-UPDATE TIMESTAMPS TRIGGER
-- ============================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_indoor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to floor_plans
DROP TRIGGER IF EXISTS floor_plans_updated_at ON floor_plans;
CREATE TRIGGER floor_plans_updated_at
    BEFORE UPDATE ON floor_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_indoor_updated_at();

-- Apply trigger to indoor_stations
DROP TRIGGER IF EXISTS indoor_stations_updated_at ON indoor_stations;
CREATE TRIGGER indoor_stations_updated_at
    BEFORE UPDATE ON indoor_stations
    FOR EACH ROW
    EXECUTE FUNCTION update_indoor_updated_at();
