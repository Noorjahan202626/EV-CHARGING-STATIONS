-- ============================================================
-- FILE: 05_normalization_views.sql
-- PROJECT: EV Charging Station Network Orchestrator
-- DESCRIPTION: Implements the three required 3NF normalization views:
--              1. v_charging_session_cost (derived billing cost)
--              2. v_queue_priority (derived queue priority rank)
--              3. v_charger_connector (combined charger & connector spec)
-- Run AFTER: 04_indexes.sql
-- ============================================================

-- ============================================================
-- VIEW 1: v_charging_session_cost
-- Normalization Decision A (3NF):
-- Charging session cost is derived as:
--   cost = energy_kwh * tariff_applied
-- Cost is deliberately NOT stored redundantly in charging_sessions.
-- This view presents the calculated cost along with full session context.
-- ============================================================
CREATE OR REPLACE VIEW v_charging_session_cost AS
SELECT
    cs.session_id,
    cs.reservation_id,
    r.booking_code,
    r.status                           AS reservation_status,
    u.user_id,
    u.name                             AS user_name,
    u.email                            AS user_email,
    v.vehicle_id,
    v.registration_no                  AS vehicle_registration,
    v.make || ' ' || v.model           AS vehicle_model,
    st.station_id,
    st.name                            AS station_name,
    c.charger_id,
    c.label                            AS charger_label,
    cs.start_time,
    cs.end_time,
    cs.energy_kwh,
    cs.tariff_applied,
    -- 3NF FORMULA: cost = energy_kwh * tariff_applied
    ROUND(cs.energy_kwh * cs.tariff_applied, 2) AS cost,
    cs.end_reason
FROM
    charging_sessions cs
    JOIN reservations r  ON r.reservation_id  = cs.reservation_id
    JOIN vehicles     v  ON v.vehicle_id      = r.vehicle_id
    JOIN users        u  ON u.user_id         = v.user_id
    LEFT JOIN chargers c ON c.charger_id      = r.charger_id
    LEFT JOIN stations st ON st.station_id    = c.station_id;

COMMENT ON VIEW v_charging_session_cost IS
    '3NF View: Computes cost = energy_kwh * tariff_applied dynamically without storing derived data';

-- ============================================================
-- VIEW 2: v_queue_priority
-- Normalization Decision D (3NF):
-- Queue priority_class is derived via:
--   waiting_queue_entries -> vehicles -> vehicle_categories.queue_rank
-- Priority rank is NOT stored redundantly in waiting_queue_entries.
-- Lower queue_rank integer indicates higher dispatch priority (e.g. 1 = Emergency).
-- ============================================================
CREATE OR REPLACE VIEW v_queue_priority AS
SELECT
    wqe.queue_id,
    wqe.station_id,
    st.name                            AS station_name,
    wqe.vehicle_id,
    v.registration_no                  AS vehicle_registration,
    v.make || ' ' || v.model           AS vehicle_model,
    u.name                             AS owner_name,
    u.email                            AS owner_email,
    vc.category_id,
    vc.code                            AS vehicle_category_code,
    vc.queue_rank                      AS priority_rank,
    wqe.join_time,
    wqe.status                         AS queue_status,
    wqe.offer_expires_at,
    wqe.reservation_id                 AS linked_reservation_id
FROM
    waiting_queue_entries wqe
    JOIN stations           st ON st.station_id  = wqe.station_id
    JOIN vehicles           v  ON v.vehicle_id   = wqe.vehicle_id
    JOIN users              u  ON u.user_id      = v.user_id
    JOIN vehicle_categories vc ON vc.category_id = v.category_id
ORDER BY
    wqe.station_id,
    vc.queue_rank ASC,       -- lower rank number = higher allocation priority
    wqe.join_time ASC;       -- FIFO within the same category rank

COMMENT ON VIEW v_queue_priority IS
    '3NF View: Derives waiting queue priority rank through vehicle category without redundant column storage';

-- ============================================================
-- VIEW 3: v_charger_connector
-- Normalization Decision E:
-- Integrates charger physical attributes, connector specifications,
-- station location, and charging network into a single queryable view.
-- ============================================================
CREATE OR REPLACE VIEW v_charger_connector AS
SELECT
    c.charger_id,
    c.label                            AS charger_label,
    c.power_kw,
    c.status                           AS charger_status,
    ct.connector_type_id,
    ct.code                            AS connector_code,
    ct.description                     AS connector_description,
    ct.current_type,
    st.station_id,
    st.name                            AS station_name,
    st.address                         AS station_address,
    st.latitude,
    st.longitude,
    st.tariff_per_kwh                  AS station_tariff,
    t.town_id,
    t.name                             AS town_name,
    s.state_id,
    s.name                             AS state_name,
    cn.network_id,
    cn.name                            AS network_name
FROM
    chargers         c
    JOIN connector_types  ct ON ct.connector_type_id = c.connector_type_id
    JOIN stations         st ON st.station_id        = c.station_id
    LEFT JOIN towns       t  ON t.town_id            = st.town_id
    LEFT JOIN states      s  ON s.state_id           = t.state_id
    LEFT JOIN charging_networks cn ON cn.network_id  = st.network_id;

COMMENT ON VIEW v_charger_connector IS
    'Comprehensive view combining charger, connector type, station, and network attributes';

