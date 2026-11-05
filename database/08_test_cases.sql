-- ============================================================
-- FILE: 08_test_cases.sql
-- PROJECT: EV Charging Station Network Orchestrator
-- DESCRIPTION: Comprehensive database test suite verifying:
--              1. Primary key integrity
--              2. Foreign key constraints
--              3. Unique constraints (email, booking_code, connector code, etc.)
--              4. Check constraints (power > 0, lat/lon bounds, slot_end > slot_start, energy >= 0)
--              5. Exclusion constraint (overlapping reservations prevention)
--              6. Normalization views accuracy
--              7. Predefined EV dataset row counts and integrity
-- Run AFTER: 06_import_ev_dataset.sql
-- ============================================================

BEGIN;

-- ================================================================
-- SECTION 1: PREDEFINED EV DATASET VERIFICATION
-- ================================================================
DO $$
DECLARE
    cnt_states INT;
    cnt_towns INT;
    cnt_networks INT;
    cnt_categories INT;
    cnt_connectors INT;
    cnt_stations INT;
    cnt_chargers INT;
BEGIN
    SELECT COUNT(*) INTO cnt_states FROM states;
    SELECT COUNT(*) INTO cnt_towns FROM towns;
    SELECT COUNT(*) INTO cnt_networks FROM charging_networks;
    SELECT COUNT(*) INTO cnt_categories FROM vehicle_categories;
    SELECT COUNT(*) INTO cnt_connectors FROM connector_types;
    SELECT COUNT(*) INTO cnt_stations FROM stations;
    SELECT COUNT(*) INTO cnt_chargers FROM chargers;

    ASSERT cnt_states = 1, format('States count mismatch: expected 1, got %s', cnt_states);
    ASSERT cnt_towns = 415, format('Towns count mismatch: expected 415, got %s', cnt_towns);
    ASSERT cnt_networks = 30, format('Networks count mismatch: expected 30, got %s', cnt_networks);
    ASSERT cnt_categories = 5, format('Categories count mismatch: expected 5, got %s', cnt_categories);
    ASSERT cnt_connectors = 7, format('Connectors count mismatch: expected 7, got %s', cnt_connectors);
    ASSERT cnt_stations = 6068, format('Stations count mismatch: expected 6068, got %s', cnt_stations);
    ASSERT cnt_chargers = 8501, format('Chargers count mismatch: expected 8501, got %s', cnt_chargers);

    RAISE NOTICE 'SECTION 1 PASSED: All 15,027 predefined records successfully verified.';
END;
$$;


-- ================================================================
-- SECTION 2: PRIMARY KEY VIOLATION TESTS
-- ================================================================

-- Test 2.1: Duplicate state PK
SAVEPOINT sp_pk_state;
DO $$
BEGIN
    INSERT INTO states (state_id, name) VALUES (1, 'Duplicate State');
    RAISE EXCEPTION 'TEST 2.1 FAILED: Duplicate state_id was accepted!';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'TEST 2.1 PASSED: Duplicate state primary key rejected.';
END;
$$;
ROLLBACK TO SAVEPOINT sp_pk_state;

-- Test 2.2: Duplicate charger PK
SAVEPOINT sp_pk_charger;
DO $$
BEGIN
    INSERT INTO chargers (charger_id, label, power_kw, status, station_id, connector_type_id)
    VALUES (1, 'DUP-BAY', 50.0, 'AVAILABLE', 1, 1);
    RAISE EXCEPTION 'TEST 2.2 FAILED: Duplicate charger_id was accepted!';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'TEST 2.2 PASSED: Duplicate charger primary key rejected.';
END;
$$;
ROLLBACK TO SAVEPOINT sp_pk_charger;


-- ================================================================
-- SECTION 3: FOREIGN KEY VIOLATION TESTS
-- ================================================================

-- Test 3.1: Charger referencing non-existent station
SAVEPOINT sp_fk_charger_station;
DO $$
BEGIN
    INSERT INTO chargers (label, power_kw, status, station_id, connector_type_id)
    VALUES ('GHOST-01', 50.0, 'AVAILABLE', 999999, 1);
    RAISE EXCEPTION 'TEST 3.1 FAILED: Orphan station_id accepted!';
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 3.1 PASSED: Foreign key rejection on invalid station_id.';
END;
$$;
ROLLBACK TO SAVEPOINT sp_fk_charger_station;

-- Test 3.2: Charger referencing non-existent connector_type
SAVEPOINT sp_fk_charger_connector;
DO $$
BEGIN
    INSERT INTO chargers (label, power_kw, status, station_id, connector_type_id)
    VALUES ('GHOST-02', 50.0, 'AVAILABLE', 1, 9999);
    RAISE EXCEPTION 'TEST 3.2 FAILED: Orphan connector_type_id accepted!';
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 3.2 PASSED: Foreign key rejection on invalid connector_type_id.';
END;
$$;
ROLLBACK TO SAVEPOINT sp_fk_charger_connector;

-- Test 3.3: Station referencing non-existent town
SAVEPOINT sp_fk_station_town;
DO $$
BEGIN
    INSERT INTO stations (name, latitude, longitude, town_id)
    VALUES ('Ghost Town Station', 12.97, 77.59, 999999);
    RAISE EXCEPTION 'TEST 3.3 FAILED: Orphan town_id accepted!';
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'TEST 3.3 PASSED: Foreign key rejection on invalid town_id.';
END;
$$;
ROLLBACK TO SAVEPOINT sp_fk_station_town;


-- ================================================================
-- SECTION 4: UNIQUE CONSTRAINT VIOLATION TESTS
-- ================================================================

-- Test 4.1: Duplicate user email
SAVEPOINT sp_uq_email;
DO $$
BEGIN
    INSERT INTO users (name, email, password_hash, role)
    VALUES ('Duplicate User', 'aarav.sharma@example.in', 'hash', 'USER');
    RAISE EXCEPTION 'TEST 4.1 FAILED: Duplicate email accepted!';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'TEST 4.1 PASSED: Duplicate email address rejected.';
END;
$$;
ROLLBACK TO SAVEPOINT sp_uq_email;

-- Test 4.2: Duplicate reservation booking code
SAVEPOINT sp_uq_booking;
DO $$
BEGIN
    INSERT INTO reservations (vehicle_id, charger_id, slot_start, slot_end, booking_code, status)
    VALUES (1, 1, '2027-01-01 10:00+05:30', '2027-01-01 11:00+05:30', 'BK-202610-001', 'CONFIRMED');
    RAISE EXCEPTION 'TEST 4.2 FAILED: Duplicate booking code accepted!';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'TEST 4.2 PASSED: Duplicate booking code rejected.';
END;
$$;
ROLLBACK TO SAVEPOINT sp_uq_booking;

-- Test 4.3: Duplicate charger label within same station
SAVEPOINT sp_uq_charger_label;
DO $$
BEGIN
    INSERT INTO chargers (label, power_kw, status, station_id, connector_type_id)
    VALUES ('P001', 60.0, 'AVAILABLE', 1, 1);
    RAISE EXCEPTION 'TEST 4.3 FAILED: Duplicate charger label within station accepted!';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'TEST 4.3 PASSED: Duplicate charger label within station rejected.';
END;
$$;
ROLLBACK TO SAVEPOINT sp_uq_charger_label;

-- Test 4.4: Duplicate town name within same state
SAVEPOINT sp_uq_town_state;
DO $$
BEGIN
    INSERT INTO towns (name, state_id) VALUES ('Bengaluru', 1);
    RAISE EXCEPTION 'TEST 4.4 FAILED: Duplicate town within state accepted!';
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'TEST 4.4 PASSED: Duplicate town within state rejected.';
END;
$$;
ROLLBACK TO SAVEPOINT sp_uq_town_state;


-- ================================================================
-- SECTION 5: CHECK CONSTRAINT VIOLATION TESTS
-- ================================================================

-- Test 5.1: Negative or zero charger power
SAVEPOINT sp_chk_power;
DO $$
BEGIN
    INSERT INTO chargers (label, power_kw, status, station_id, connector_type_id)
    VALUES ('ZERO-KW', 0.0, 'AVAILABLE', 1, 1);
    RAISE EXCEPTION 'TEST 5.1 FAILED: Zero charger power accepted!';
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE 'TEST 5.1 PASSED: Zero charger power rejected (power_kw > 0).';
END;
$$;
ROLLBACK TO SAVEPOINT sp_chk_power;

-- Test 5.2: Invalid latitude (> 90 degrees)
SAVEPOINT sp_chk_lat;
DO $$
BEGIN
    INSERT INTO stations (name, latitude, longitude)
    VALUES ('North Pole Plus', 95.500000, 77.590000);
    RAISE EXCEPTION 'TEST 5.2 FAILED: Invalid latitude accepted!';
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE 'TEST 5.2 PASSED: Out-of-bounds latitude rejected (-90 to +90).';
END;
$$;
ROLLBACK TO SAVEPOINT sp_chk_lat;

-- Test 5.3: Invalid longitude (< -180 degrees)
SAVEPOINT sp_chk_lon;
DO $$
BEGIN
    INSERT INTO stations (name, latitude, longitude)
    VALUES ('West Extreme', 12.970000, -185.000000);
    RAISE EXCEPTION 'TEST 5.3 FAILED: Invalid longitude accepted!';
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE 'TEST 5.3 PASSED: Out-of-bounds longitude rejected (-180 to +180).';
END;
$$;
ROLLBACK TO SAVEPOINT sp_chk_lon;

-- Test 5.4: Reservation slot_end before slot_start
SAVEPOINT sp_chk_slot;
DO $$
BEGIN
    INSERT INTO reservations (vehicle_id, charger_id, slot_start, slot_end, booking_code, status)
    VALUES (1, 1, '2027-02-01 12:00+05:30', '2027-02-01 10:00+05:30', 'BK-BAD-SLOT', 'CONFIRMED');
    RAISE EXCEPTION 'TEST 5.4 FAILED: slot_end <= slot_start accepted!';
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE 'TEST 5.4 PASSED: Inverted slot interval rejected (slot_end > slot_start).';
END;
$$;
ROLLBACK TO SAVEPOINT sp_chk_slot;

-- Test 5.5: Negative energy consumed
SAVEPOINT sp_chk_energy;
DO $$
BEGIN
    INSERT INTO charging_sessions (reservation_id, start_time, energy_kwh, tariff_applied)
    VALUES (3, NOW(), -15.50, 18.00);
    RAISE EXCEPTION 'TEST 5.5 FAILED: Negative energy_kwh accepted!';
EXCEPTION
    WHEN check_violation THEN
        RAISE NOTICE 'TEST 5.5 PASSED: Negative energy consumed rejected (energy_kwh >= 0).';
END;
$$;
ROLLBACK TO SAVEPOINT sp_chk_energy;


-- ================================================================
-- SECTION 6: EXCLUSION CONSTRAINT OVERLAP TESTS
-- ================================================================

-- Test 6.1: Direct overlapping confirmed reservation on same charger
SAVEPOINT sp_excl_overlap;
DO $$
BEGIN
    -- We have active reservation 3 on charger 2 for 2026-11-10 09:00 to 10:00
    INSERT INTO reservations (vehicle_id, charger_id, slot_start, slot_end, booking_code, status)
    VALUES (3, 2, '2026-11-10 09:30:00+05:30', '2026-11-10 10:30:00+05:30', 'BK-TEST-OVERLAP', 'CONFIRMED');
    RAISE EXCEPTION 'TEST 6.1 FAILED: Overlapping reservation accepted!';
EXCEPTION
    WHEN exclusion_violation THEN
        RAISE NOTICE 'TEST 6.1 PASSED: Overlapping reservation rejected by exclusion constraint.';
END;
$$;
ROLLBACK TO SAVEPOINT sp_excl_overlap;

-- Test 6.2: Adjacent booking on same charger is permitted
DO $$
BEGIN
    INSERT INTO reservations (vehicle_id, charger_id, slot_start, slot_end, booking_code, status)
    VALUES (3, 2, '2026-11-10 10:00:00+05:30', '2026-11-10 11:00:00+05:30', 'BK-TEST-ADJACENT', 'CONFIRMED');
    RAISE NOTICE 'TEST 6.2 PASSED: Adjacent reservation accepted (no overlap).';
END;
$$;


-- ================================================================
-- SECTION 7: NORMALIZATION VIEWS VERIFICATION
-- ================================================================

-- Test 7.1: Verify v_charging_session_cost computes energy * tariff correctly
DO $$
DECLARE
    mismatches INT;
BEGIN
    SELECT COUNT(*) INTO mismatches
    FROM v_charging_session_cost
    WHERE ABS(cost - ROUND(energy_kwh * tariff_applied, 2)) > 0.001;

    ASSERT mismatches = 0, format('Found %s cost calculation mismatches in view!', mismatches);
    RAISE NOTICE 'TEST 7.1 PASSED: v_charging_session_cost verified (energy * tariff matches).';
END;
$$;

-- Test 7.2: Verify v_queue_priority derives priority via vehicle category
DO $$
DECLARE
    q_count INT;
BEGIN
    SELECT COUNT(*) INTO q_count
    FROM v_queue_priority
    WHERE priority_rank IS NOT NULL;

    ASSERT q_count > 0, 'No priority queue records found!';
    RAISE NOTICE 'TEST 7.2 PASSED: v_queue_priority verified (% records with category ranks).', q_count;
END;
$$;

-- Test 7.3: Verify v_charger_connector joins charger and connector info
DO $$
DECLARE
    cc_count INT;
BEGIN
    SELECT COUNT(*) INTO cc_count
    FROM v_charger_connector;

    ASSERT cc_count = 8501, format('v_charger_connector count mismatch: expected 8501, got %s', cc_count);
    RAISE NOTICE 'TEST 7.3 PASSED: v_charger_connector verified (all 8,501 chargers mapped).';
END;
$$;

COMMIT;

-- Final test suite summary
SELECT 'ALL TESTS COMPLETED SUCCESSFULLY' AS status;

