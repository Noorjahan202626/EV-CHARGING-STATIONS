-- ============================================================
-- FILE: 03_constraints.sql
-- PROJECT: EV Charging Station Network Orchestrator
-- DESCRIPTION: Applies exclusion constraints (overlap prevention)
--              and additional domain-level integrity rules.
-- Run AFTER: 02_create_tables.sql
-- ============================================================

-- ============================================================
-- 1. EXCLUSION CONSTRAINT: PREVENT OVERLAPPING CHARGER BOOKINGS
-- ============================================================
-- Uses the btree_gist extension (enabled in 01_create_database.sql).
-- Ensures that no two CONFIRMED or ACTIVE reservations can share
-- the same charger during overlapping time intervals.
--
-- Interval type: [) (inclusive start, exclusive end)
-- This allows adjacent bookings: if Booking A ends at 11:00,
-- Booking B can start at exactly 11:00 without collision.
-- Cancelled, Completed, and No-Show bookings do not block new reservations.
-- ============================================================

ALTER TABLE reservations
    DROP CONSTRAINT IF EXISTS excl_no_charger_overlap;

ALTER TABLE reservations
    ADD CONSTRAINT excl_no_charger_overlap
    EXCLUDE USING gist (
        charger_id WITH =,
        tstzrange(slot_start, slot_end, '[)') WITH &&
    )
    WHERE (status IN ('CONFIRMED', 'ACTIVE', 'Confirmed', 'Active') AND charger_id IS NOT NULL);

COMMENT ON CONSTRAINT excl_no_charger_overlap ON reservations IS
    'Prevents concurrent confirmed or active bookings on the same charger for overlapping time slots';

-- ============================================================
-- 2. DOMAIN INTEGRITY RULES
-- ============================================================

-- Checked-in timestamp must not precede slot start
ALTER TABLE reservations
    DROP CONSTRAINT IF EXISTS chk_checkin_after_start;

ALTER TABLE reservations
    ADD CONSTRAINT chk_checkin_after_start
    CHECK (checked_in_at IS NULL OR checked_in_at >= slot_start);

-- Queue offer expiry must follow join time
ALTER TABLE waiting_queue_entries
    DROP CONSTRAINT IF EXISTS chk_offer_after_join;

ALTER TABLE waiting_queue_entries
    ADD CONSTRAINT chk_offer_after_join
    CHECK (offer_expires_at IS NULL OR offer_expires_at > join_time);

-- Payment completion consistency
ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS chk_paid_at_consistency;

ALTER TABLE payments
    ADD CONSTRAINT chk_paid_at_consistency
    CHECK (
        (status IN ('SUCCESS', 'Completed') AND paid_at IS NOT NULL)
        OR
        (status IN ('PENDING', 'FAILED', 'Pending', 'Failed'))
        OR
        paid_at IS NULL
    );

-- Station status check (ensures 'Operational', 'Inactive', 'Under Maintenance' are accepted)
ALTER TABLE stations
    DROP CONSTRAINT IF EXISTS stations_status_check;

ALTER TABLE stations
    ADD CONSTRAINT stations_status_check
    CHECK (status IS NULL OR status IN ('ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'OPERATIONAL', 'Active', 'Inactive', 'Under Maintenance', 'Operational'));


