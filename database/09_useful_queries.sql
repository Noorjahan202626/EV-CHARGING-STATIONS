-- ============================================================
-- FILE: 09_useful_queries.sql
-- PROJECT: EV Charging Station Network Orchestrator
-- DESCRIPTION: Contains the 20 operational SQL queries specified
--              in the database requirements, demonstrating all
--              relationships, normalization views, and aggregation.
-- Run AFTER: 06_import_ev_dataset.sql
-- ============================================================

-- ============================================================
-- QUERY 1: Display all charging stations
-- Displays stations with their town, state, and network names.
-- ============================================================
SELECT
    st.station_id,
    st.name                     AS station_name,
    st.address,
    t.name                      AS town,
    s.name                      AS state,
    cn.name                     AS network,
    st.latitude,
    st.longitude,
    st.usage_type,
    st.tariff_per_kwh,
    st.status
FROM
    stations st
    LEFT JOIN towns             t  ON t.town_id    = st.town_id
    LEFT JOIN states            s  ON s.state_id   = t.state_id
    LEFT JOIN charging_networks cn ON cn.network_id = st.network_id
ORDER BY
    st.station_id
LIMIT 50;


-- ============================================================
-- QUERY 2: Display all chargers belonging to a particular station
-- Example: station_id = 1 (BPCL Abichikanahalli 1)
-- ============================================================
SELECT
    c.charger_id,
    c.label                     AS charger_label,
    c.power_kw,
    c.status                    AS charger_status,
    ct.code                     AS connector_code,
    ct.current_type,
    ct.description              AS connector_description,
    st.name                     AS station_name
FROM
    chargers c
    JOIN stations        st ON st.station_id        = c.station_id
    JOIN connector_types ct ON ct.connector_type_id = c.connector_type_id
WHERE
    c.station_id = 1
ORDER BY
    c.label;


-- ============================================================
-- QUERY 3: Display available chargers
-- ============================================================
SELECT
    c.charger_id,
    c.label                     AS charger_label,
    c.power_kw,
    c.status,
    ct.code                     AS connector_code,
    st.name                     AS station_name,
    t.name                      AS town_name
FROM
    chargers c
    JOIN connector_types ct ON ct.connector_type_id = c.connector_type_id
    JOIN stations        st ON st.station_id        = c.station_id
    LEFT JOIN towns      t  ON t.town_id            = st.town_id
WHERE
    c.status = 'AVAILABLE'
ORDER BY
    c.power_kw DESC, c.charger_id
LIMIT 50;


-- ============================================================
-- QUERY 4: Display all charging networks
-- ============================================================
SELECT
    cn.network_id,
    cn.name                     AS network_name,
    COUNT(st.station_id)        AS total_stations
FROM
    charging_networks cn
    LEFT JOIN stations st ON st.network_id = cn.network_id
GROUP BY
    cn.network_id, cn.name
ORDER BY
    total_stations DESC, cn.name;


-- ============================================================
-- QUERY 5: Display connector types
-- ============================================================
SELECT
    ct.connector_type_id,
    ct.code                     AS connector_code,
    ct.current_type,
    ct.description,
    COUNT(c.charger_id)         AS installed_chargers
FROM
    connector_types ct
    LEFT JOIN chargers c ON c.connector_type_id = ct.connector_type_id
GROUP BY
    ct.connector_type_id, ct.code, ct.current_type, ct.description
ORDER BY
    installed_chargers DESC;


-- ============================================================
-- QUERY 6: Display vehicles belonging to a user
-- Example: user_id = 1
-- ============================================================
SELECT
    u.user_id,
    u.name                      AS owner_name,
    u.email,
    v.vehicle_id,
    v.registration_no,
    v.make,
    v.model,
    v.battery_capacity_kwh,
    vc.code                     AS category_code,
    vc.queue_rank
FROM
    vehicles v
    JOIN users              u  ON u.user_id     = v.user_id
    JOIN vehicle_categories vc ON vc.category_id = v.category_id
WHERE
    u.user_id = 1
ORDER BY
    v.vehicle_id;


-- ============================================================
-- QUERY 7: Display reservations made by a user
-- Resolved via vehicle ownership (3NF).
-- ============================================================
SELECT
    u.user_id,
    u.name                      AS user_name,
    r.reservation_id,
    r.booking_code,
    r.status                    AS reservation_status,
    v.registration_no,
    v.make || ' ' || v.model    AS vehicle,
    r.slot_start,
    r.slot_end,
    r.created_at
FROM
    reservations r
    JOIN vehicles v ON v.vehicle_id = r.vehicle_id
    JOIN users    u ON u.user_id    = v.user_id
WHERE
    u.user_id = 1
ORDER BY
    r.slot_start DESC;


-- ============================================================
-- QUERY 8: Display reservation details with station & charger info
-- ============================================================
SELECT
    r.booking_code,
    r.status                    AS reservation_status,
    u.name                      AS customer_name,
    v.registration_no,
    st.name                     AS station_name,
    t.name                      AS town,
    c.label                     AS charger_label,
    c.power_kw,
    ct.code                     AS connector,
    r.slot_start,
    r.slot_end,
    r.checked_in_at
FROM
    reservations r
    JOIN vehicles        v  ON v.vehicle_id        = r.vehicle_id
    JOIN users           u  ON u.user_id           = v.user_id
    LEFT JOIN chargers   c  ON c.charger_id        = r.charger_id
    LEFT JOIN stations   st ON st.station_id       = c.station_id
    LEFT JOIN towns      t  ON t.town_id           = st.town_id
    LEFT JOIN connector_types ct ON ct.connector_type_id = c.connector_type_id
ORDER BY
    r.slot_start DESC;


-- ============================================================
-- QUERY 9: Display charging session details
-- ============================================================
SELECT
    cs.session_id,
    r.booking_code,
    cs.start_time,
    cs.end_time,
    cs.energy_kwh,
    cs.tariff_applied,
    cs.end_reason,
    v.registration_no,
    u.name                      AS user_name
FROM
    charging_sessions cs
    JOIN reservations r ON r.reservation_id = cs.reservation_id
    JOIN vehicles     v ON v.vehicle_id     = r.vehicle_id
    JOIN users        u ON u.user_id        = v.user_id
ORDER BY
    cs.start_time DESC;


-- ============================================================
-- QUERY 10: Calculate charging costs using the cost view
-- Uses 3NF view v_charging_session_cost (cost = energy * tariff).
-- ============================================================
SELECT
    session_id,
    booking_code,
    user_name,
    vehicle_registration,
    station_name,
    charger_label,
    energy_kwh,
    tariff_applied,
    cost                        AS computed_cost_inr,
    start_time,
    end_time
FROM
    v_charging_session_cost
ORDER BY
    start_time DESC;


-- ============================================================
-- QUERY 11: Display successful and failed payments
-- ============================================================
SELECT
    p.payment_id,
    p.amount                    AS amount_inr,
    p.status                    AS payment_status,
    p.paid_at,
    p.attempts,
    cs.energy_kwh,
    r.booking_code,
    u.name                      AS user_name
FROM
    payments p
    JOIN charging_sessions cs ON cs.session_id    = p.session_id
    JOIN reservations      r  ON r.reservation_id = cs.reservation_id
    JOIN vehicles          v  ON v.vehicle_id      = r.vehicle_id
    JOIN users             u  ON u.user_id         = v.user_id
ORDER BY
    p.status, p.paid_at DESC;


-- ============================================================
-- QUERY 12: Display waiting queue entries
-- ============================================================
SELECT
    wqe.queue_id,
    st.name                     AS station_name,
    v.registration_no,
    v.make || ' ' || v.model    AS vehicle,
    u.name                      AS owner_name,
    wqe.join_time,
    wqe.status                  AS queue_status,
    wqe.offer_expires_at
FROM
    waiting_queue_entries wqe
    JOIN stations st ON st.station_id = wqe.station_id
    JOIN vehicles v  ON v.vehicle_id  = wqe.vehicle_id
    JOIN users    u  ON u.user_id     = v.user_id
ORDER BY
    st.name, wqe.join_time;


-- ============================================================
-- QUERY 13: Display queue priorities (using v_queue_priority view)
-- ============================================================
SELECT
    queue_id,
    station_name,
    vehicle_registration,
    vehicle_model,
    owner_name,
    vehicle_category_code,
    priority_rank,
    join_time,
    queue_status
FROM
    v_queue_priority
ORDER BY
    station_name, priority_rank, join_time;


-- ============================================================
-- QUERY 14: Display compatible connectors for a vehicle
-- Example: vehicle_id = 1 (Tata Nexon EV)
-- ============================================================
SELECT
    v.vehicle_id,
    v.registration_no,
    v.make || ' ' || v.model    AS vehicle,
    ct.connector_type_id,
    ct.code                     AS compatible_connector,
    ct.current_type,
    ct.description
FROM
    vehicles v
    JOIN vehicle_connector_compatibility vcc ON vcc.vehicle_id = v.vehicle_id
    JOIN connector_types                ct  ON ct.connector_type_id = vcc.connector_type_id
WHERE
    v.vehicle_id = 1;


-- ============================================================
-- QUERY 15: Display stations grouped by town and state
-- ============================================================
SELECT
    s.name                      AS state_name,
    t.name                      AS town_name,
    COUNT(st.station_id)        AS total_stations
FROM
    states s
    JOIN towns    t  ON t.state_id = s.state_id
    JOIN stations st ON st.town_id = t.town_id
GROUP BY
    s.name, t.name
ORDER BY
    total_stations DESC, t.name
LIMIT 30;


-- ============================================================
-- QUERY 16: Display the number of chargers at each station
-- ============================================================
SELECT
    st.station_id,
    st.name                     AS station_name,
    t.name                      AS town_name,
    COUNT(c.charger_id)         AS charger_count,
    ROUND(COALESCE(AVG(c.power_kw), 0), 1) AS avg_power_kw
FROM
    stations st
    LEFT JOIN towns    t ON t.town_id    = st.town_id
    LEFT JOIN chargers c ON c.station_id = st.station_id
GROUP BY
    st.station_id, st.name, t.name
ORDER BY
    charger_count DESC, st.name
LIMIT 50;


-- ============================================================
-- QUERY 17: Display completed charging sessions
-- ============================================================
SELECT
    cs.session_id,
    r.booking_code,
    u.name                      AS user_name,
    v.registration_no,
    st.name                     AS station_name,
    c.label                     AS charger_label,
    cs.start_time,
    cs.end_time,
    cs.energy_kwh,
    cs.tariff_applied,
    ROUND(cs.energy_kwh * cs.tariff_applied, 2) AS session_cost_inr,
    p.status                    AS payment_status
FROM
    charging_sessions cs
    JOIN reservations r  ON r.reservation_id = cs.reservation_id
    JOIN vehicles     v  ON v.vehicle_id     = r.vehicle_id
    JOIN users        u  ON u.user_id        = v.user_id
    JOIN chargers     c  ON c.charger_id     = r.charger_id
    JOIN stations     st ON st.station_id    = c.station_id
    LEFT JOIN payments p ON p.session_id     = cs.session_id
WHERE
    r.status = 'COMPLETED'
ORDER BY
    cs.start_time DESC;


-- ============================================================
-- QUERY 18: Display stations belonging to a particular network
-- Example: network_id = 7 (BPCL)
-- ============================================================
SELECT
    st.station_id,
    st.name                     AS station_name,
    st.address,
    t.name                      AS town_name,
    cn.name                     AS network_name,
    COUNT(c.charger_id)         AS total_chargers
FROM
    stations st
    JOIN charging_networks cn ON cn.network_id = st.network_id
    LEFT JOIN towns        t  ON t.town_id    = st.town_id
    LEFT JOIN chargers     c  ON c.station_id = st.station_id
WHERE
    st.network_id = 7
GROUP BY
    st.station_id, st.name, st.address, t.name, cn.name
ORDER BY
    st.name
LIMIT 30;


-- ============================================================
-- QUERY 19: Display stations with missing tariff or status info
-- Predefined EV dataset characteristics: 6068 stations missing tariff
-- ============================================================
SELECT
    COUNT(*)                                              AS total_stations,
    COUNT(*) FILTER (WHERE tariff_per_kwh IS NULL)        AS missing_tariff_count,
    COUNT(*) FILTER (WHERE status IS NULL)                AS missing_status_count,
    COUNT(*) FILTER (WHERE address IS NULL)               AS missing_address_count,
    COUNT(*) FILTER (WHERE postcode IS NULL)              AS missing_postcode_count,
    ROUND(100.0 * COUNT(*) FILTER (WHERE tariff_per_kwh IS NULL) / COUNT(*), 2) AS pct_missing_tariff
FROM
    stations;


-- ============================================================
-- QUERY 20: Display chargers grouped by power rating
-- ============================================================
SELECT
    c.power_kw,
    COUNT(c.charger_id)         AS charger_count,
    ROUND(100.0 * COUNT(c.charger_id) / (SELECT COUNT(*) FROM chargers), 2) AS percentage_of_total,
    STRING_AGG(DISTINCT ct.code, ', ') AS supported_connectors
FROM
    chargers c
    JOIN connector_types ct ON ct.connector_type_id = c.connector_type_id
GROUP BY
    c.power_kw
ORDER BY
    c.power_kw DESC;

