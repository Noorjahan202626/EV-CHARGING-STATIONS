-- ============================================================
-- FILE: 10_compatibility_migration.sql
-- PURPOSE: Backfill vehicle_connector_compatibility with default connectors per vehicle category.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- Insert default connectors for vehicles that have none.
INSERT INTO vehicle_connector_compatibility (vehicle_id, connector_type_id)
SELECT v.vehicle_id, ct.connector_type_id
FROM vehicles v
JOIN vehicle_categories vc ON v.category_id = vc.category_id
-- Determine default connector codes per category
LEFT JOIN LATERAL (
    SELECT unnest(
        CASE vc.code
            WHEN '4W' THEN ARRAY['CCS2', 'TYPE2_AC']
            WHEN '3W' THEN ARRAY['BHARAT_AC001', 'BHARAT_DC001', 'LEV_AC', 'LEV_DC']
            WHEN '2W' THEN ARRAY['LEV_AC', 'LEV_DC']
            ELSE ARRAY[]::text[]
        END
    ) AS code
) AS default_codes ON true
JOIN connector_types ct ON ct.code = default_codes.code
WHERE NOT EXISTS (
    SELECT 1 FROM vehicle_connector_compatibility vcc WHERE vcc.vehicle_id = v.vehicle_id
)
ON CONFLICT DO NOTHING;

-- Index for fast charger lookup by station and connector type.
DO $$BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'chargers' AND indexname = 'idx_chargers_station_connector') THEN
        CREATE INDEX idx_chargers_station_connector ON chargers (station_id, connector_type_id);
    END IF;
END$$;

-- Note: vehicles table currently has no column for max charge kW. This migration does NOT add such a column.
