-- ============================================================
-- FILE: 07_transaction_logic.sql
-- PROJECT: EV Charging Station Network Orchestrator
-- DESCRIPTION: Transaction safety, concurrency control, and
--              overlapping reservation prevention using PostgreSQL
--              primitives (BEGIN, COMMIT, ROLLBACK, SELECT FOR UPDATE,
--              and exclusion constraints).
-- Run AFTER: 06_import_ev_dataset.sql
-- ============================================================

-- ============================================================
-- SCENARIO 1: ATOMIC RESERVATION BOOKING (SELECT FOR UPDATE)
-- ============================================================
-- Demonstrates the step-by-step transaction procedure required
-- by the database specification:
--   1. Identify requested charger
--   2. Check charger status
--   3. Lock charger row exclusively using SELECT FOR UPDATE
--   4. Check for overlapping active/confirmed bookings
--   5. Insert reservation if clear
--   6. Dispatch confirmation notification
--   7. Commit transaction
-- ============================================================

BEGIN;

    -- Step 1 & 3: Exclusively lock the charger record to serialize booking attempts
    SELECT charger_id, label, status, station_id
    FROM   chargers
    WHERE  charger_id = 1
    FOR UPDATE;

    -- Step 2: In application logic, verify status = 'AVAILABLE'.
    -- If status IN ('FAULT', 'OFFLINE'), application executes ROLLBACK.

    -- Step 4: Optional pre-flight check in SQL (the exclusion constraint
    -- guarantees physical integrity even if this step is skipped).
    SELECT COUNT(*) AS active_overlaps
    FROM   reservations
    WHERE  charger_id = 1
      AND  status IN ('CONFIRMED', 'ACTIVE')
      AND  tstzrange(slot_start, slot_end, '[)') &&
           tstzrange('2026-11-20 09:00:00+05:30',
                     '2026-11-20 10:30:00+05:30', '[)');

    -- Step 5: Insert confirmed reservation
    INSERT INTO reservations (
        vehicle_id, charger_id,
        slot_start, slot_end,
        booking_code, status
    ) VALUES (
        1, 1,
        '2026-11-20 09:00:00+05:30',
        '2026-11-20 10:30:00+05:30',
        'BK-TX-20261120-001',
        'CONFIRMED'
    );

    -- Step 6: Dispatch notification to the vehicle owner
    INSERT INTO notifications (user_id, type, message)
    SELECT
        v.user_id,
        'BOOKING_CONFIRMED',
        'Reservation BK-TX-20261120-001 at Charger P001 confirmed for 09:00-10:30.'
    FROM vehicles v WHERE v.vehicle_id = 1;

COMMIT;


-- ============================================================
-- SCENARIO 2: CONFLICTING BOOKING PREVENTION (Exclusion Constraint)
-- ============================================================
-- Attempting to book the SAME charger (charger_id = 1) for an
-- OVERLAPPING time interval (09:30 to 11:00) while the reservation
-- above is CONFIRMED will be rejected automatically by PostgreSQL's
-- exclusion constraint `excl_no_charger_overlap`.
-- ============================================================

BEGIN;

    -- This INSERT will fail immediately with:
    -- ERROR: conflicting key value violates exclusion constraint "excl_no_charger_overlap"
    -- DETAIL: Key (charger_id, tstzrange(slot_start, slot_end, '[)'::text))=(1, ["2026-11-20 09:30:00+05:30","2026-11-20 11:00:00+05:30"))
    -- conflicts with existing key (1, ["2026-11-20 09:00:00+05:30","2026-11-20 10:30:00+05:30")).

    INSERT INTO reservations (
        vehicle_id, charger_id,
        slot_start, slot_end,
        booking_code, status
    ) VALUES (
        3, 1,
        '2026-11-20 09:30:00+05:30',  -- overlaps by 60 minutes
        '2026-11-20 11:00:00+05:30',
        'BK-TX-CONFLICT-001',
        'CONFIRMED'
    );

-- Since an error is raised by the engine, the transaction must roll back:
ROLLBACK;


-- ============================================================
-- SCENARIO 3: ADJACENT (NON-OVERLAPPING) BOOKING ALLOWED
-- ============================================================
-- Using half-open intervals [start, end), a slot ending at 10:30
-- allows the next booking to start at exactly 10:30 without conflict.
-- ============================================================

BEGIN;

    INSERT INTO reservations (
        vehicle_id, charger_id,
        slot_start, slot_end,
        booking_code, status
    ) VALUES (
        3, 1,
        '2026-11-20 10:30:00+05:30',  -- begins exactly at previous slot end
        '2026-11-20 11:30:00+05:30',
        'BK-TX-ADJACENT-001',
        'CONFIRMED'
    );

COMMIT;


-- ============================================================
-- SCENARIO 4: VEHICLE CHECK-IN & SESSION START TRANSACTION
-- ============================================================
-- When the EV arrives at the station:
--   1. Mark reservation as ACTIVE and set checked_in_at
--   2. Update charger status to OCCUPIED
--   3. Create charging_session with start snapshot tariff
-- ============================================================

BEGIN;

    -- Update reservation to ACTIVE
    UPDATE reservations
    SET    status        = 'ACTIVE',
           checked_in_at = NOW()
    WHERE  booking_code  = 'BK-TX-20261120-001'
      AND  status        = 'CONFIRMED'
    RETURNING reservation_id, charger_id;

    -- Lock and set charger to OCCUPIED
    UPDATE chargers
    SET    status = 'OCCUPIED'
    WHERE  charger_id = 1;

    -- Start charging session (energy starts at 0 kWh; captures tariff snapshot)
    INSERT INTO charging_sessions (
        reservation_id,
        start_time,
        energy_kwh,
        tariff_applied
    ) VALUES (
        (SELECT reservation_id FROM reservations WHERE booking_code = 'BK-TX-20261120-001'),
        NOW(),
        0.00,
        18.00  -- billing tariff snapshot
    );

COMMIT;


-- ============================================================
-- SCENARIO 5: SESSION COMPLETION & PAYMENT CREATION
-- ============================================================
-- When the vehicle unplugs:
--   1. Record energy delivered and end_time
--   2. Mark reservation as COMPLETED
--   3. Release charger back to AVAILABLE
--   4. Create payment record (amount = energy * tariff snapshot)
-- ============================================================

BEGIN;

    -- Record final energy measurement
    UPDATE charging_sessions
    SET    end_time   = NOW(),
           energy_kwh = 22.50,
           end_reason = 'NORMAL_STOP'
    WHERE  reservation_id = (SELECT reservation_id FROM reservations WHERE booking_code = 'BK-TX-20261120-001');

    -- Mark reservation COMPLETED
    UPDATE reservations
    SET    status = 'COMPLETED'
    WHERE  booking_code = 'BK-TX-20261120-001';

    -- Free up the charger
    UPDATE chargers
    SET    status = 'AVAILABLE'
    WHERE  charger_id = 1;

    -- Create financial payment snapshot (amount = energy_kwh * tariff_applied)
    INSERT INTO payments (
        session_id,
        amount,
        status,
        attempts
    )
    SELECT
        cs.session_id,
        ROUND(cs.energy_kwh * cs.tariff_applied, 2),
        'PENDING',
        0
    FROM   charging_sessions cs
    JOIN   reservations r ON r.reservation_id = cs.reservation_id
    WHERE  r.booking_code = 'BK-TX-20261120-001';

    -- Notify user of payment amount due
    INSERT INTO notifications (user_id, type, message)
    SELECT
        v.user_id,
        'PAYMENT_PENDING',
        'Charging complete: 22.50 kWh delivered. Total due: INR 405.00.'
    FROM   reservations r
    JOIN   vehicles v ON v.vehicle_id = r.vehicle_id
    WHERE  r.booking_code = 'BK-TX-20261120-001';

COMMIT;


-- ============================================================
-- SCENARIO 6: QUEUE PRIORITY ALLOCATION TRANSACTION
-- ============================================================
-- When a charger becomes available, allocate the highest-priority
-- waiting vehicle based on vehicle category queue_rank:
-- ============================================================

BEGIN;

    -- Lock next eligible waiting entry by category priority then join time
    WITH next_vehicle AS (
        SELECT wqe.queue_id, wqe.vehicle_id, wqe.station_id
        FROM   waiting_queue_entries wqe
        JOIN   vehicles v ON v.vehicle_id = wqe.vehicle_id
        JOIN   vehicle_categories vc ON vc.category_id = v.category_id
        WHERE  wqe.station_id = 1
          AND  wqe.status = 'WAITING'
        ORDER BY vc.queue_rank ASC, wqe.join_time ASC
        LIMIT 1
        FOR UPDATE OF wqe
    )
    UPDATE waiting_queue_entries
    SET    status           = 'ASSIGNED',
           offer_expires_at = NOW() + INTERVAL '30 minutes'
    WHERE  queue_id = (SELECT queue_id FROM next_vehicle);

COMMIT;


-- ============================================================
-- SCENARIO 7: TWO-SESSION CONCURRENCY TEST WALKTHROUGH
-- ============================================================
-- To simulate simultaneous booking attempts in pgAdmin 4 or psql:
--
-- SESSION A (Open in Query Tool 1):
--   BEGIN;
--   SELECT * FROM chargers WHERE charger_id = 2 FOR UPDATE;
--   -- Session A now holds an exclusive row lock on Charger 2.
--   -- Do NOT commit yet.
--
-- SESSION B (Open in Query Tool 2):
--   BEGIN;
--   SELECT * FROM chargers WHERE charger_id = 2 FOR UPDATE;
--   -- Session B will immediately hang/wait because Session A holds the lock.
--
-- RETURN TO SESSION A:
--   INSERT INTO reservations (vehicle_id, charger_id, slot_start, slot_end, booking_code, status)
--   VALUES (1, 2, '2026-12-01 14:00+05:30', '2026-12-01 15:00+05:30', 'BK-SESS-A', 'CONFIRMED');
--   COMMIT;
--   -- Session A commits. The row lock is released.
--
-- RETURN TO SESSION B:
--   -- Session B immediately unblocks and acquires the lock.
--   -- If Session B attempts to book the overlapping interval:
--   INSERT INTO reservations (vehicle_id, charger_id, slot_start, slot_end, booking_code, status)
--   VALUES (3, 2, '2026-12-01 14:30+05:30', '2026-12-01 15:30+05:30', 'BK-SESS-B', 'CONFIRMED');
--   -- RESULT: The exclusion constraint fires and REJECTS Session B!
--   ROLLBACK;
-- ============================================================

