-- ============================================================
-- FILE: 04_indexes.sql
-- PROJECT: EV Charging Station Network Orchestrator
-- DESCRIPTION: Creates B-tree and GiST indexes for high-frequency
--              queries, foreign keys, spatial searches, and range lookups.
-- Run AFTER: 03_constraints.sql
-- ============================================================

-- ============================================================
-- 1. FOREIGN KEY INDEXES (Avoid sequential scans on joins)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_towns_state_id
    ON towns (state_id);

CREATE INDEX IF NOT EXISTS idx_stations_town_id
    ON stations (town_id);

CREATE INDEX IF NOT EXISTS idx_stations_network_id
    ON stations (network_id);

CREATE INDEX IF NOT EXISTS idx_chargers_station_id
    ON chargers (station_id);

CREATE INDEX IF NOT EXISTS idx_chargers_connector_type_id
    ON chargers (connector_type_id);

CREATE INDEX IF NOT EXISTS idx_operators_station_id
    ON operators (station_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_user_id
    ON vehicles (user_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_category_id
    ON vehicles (category_id);

CREATE INDEX IF NOT EXISTS idx_vcc_connector_type_id
    ON vehicle_connector_compatibility (connector_type_id);

CREATE INDEX IF NOT EXISTS idx_reservations_vehicle_id
    ON reservations (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_reservations_charger_id
    ON reservations (charger_id);

CREATE INDEX IF NOT EXISTS idx_queue_station_id
    ON waiting_queue_entries (station_id);

CREATE INDEX IF NOT EXISTS idx_queue_vehicle_id
    ON waiting_queue_entries (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_queue_reservation_id
    ON waiting_queue_entries (reservation_id);

CREATE INDEX IF NOT EXISTS idx_charging_sessions_reservation_id
    ON charging_sessions (reservation_id);

CREATE INDEX IF NOT EXISTS idx_payments_session_id
    ON payments (session_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
    ON notifications (user_id);

-- ============================================================
-- 2. STATUS & OPERATIONAL FILTER INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_chargers_status
    ON chargers (status);

CREATE INDEX IF NOT EXISTS idx_reservations_status
    ON reservations (status);

CREATE INDEX IF NOT EXISTS idx_queue_status
    ON waiting_queue_entries (status);

CREATE INDEX IF NOT EXISTS idx_payments_status
    ON payments (status);

CREATE INDEX IF NOT EXISTS idx_stations_status
    ON stations (status);

-- ============================================================
-- 3. SEARCH & RANGE INDEXES
-- ============================================================
-- Spatial coordinates on stations (box/radius searches)
CREATE INDEX IF NOT EXISTS idx_stations_lat_lon
    ON stations (latitude, longitude);

-- Fast user email lookup
CREATE INDEX IF NOT EXISTS idx_users_email
    ON users (email);

-- Queue priority scheduling (station + FIFO join time)
CREATE INDEX IF NOT EXISTS idx_queue_station_join
    ON waiting_queue_entries (station_id, join_time);

-- Reservation slot time ranges (GiST range index)
CREATE INDEX IF NOT EXISTS idx_reservations_slot_range
    ON reservations USING gist (
        charger_id,
        tstzrange(slot_start, slot_end, '[)')
    );

-- Notification chronology
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);

