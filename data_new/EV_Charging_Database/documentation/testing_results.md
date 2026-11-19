# Testing Results & Validation Report

## 1. Test Suite Architecture

The database testing suite implemented in `08_test_cases.sql` rigorously validates:
- Ingestion of all **15,027 predefined records** across the 7 master tables.
- Primary key enforcement and duplicate rejection.
- Foreign key cascading and rejection of orphaned references.
- Unique constraints across emails, booking codes, vehicle registrations, and station charger labels.
- CHECK constraints on geographic boundaries, charger power ratings, timestamps, and energy consumptions.
- PostgreSQL GiST exclusion constraint (`excl_no_charger_overlap`) preventing double-bookings.
- Mathematical accuracy of 3NF normalization views.

---

## 2. Test Execution Summary

| Test Group | Test Case Description | Tested Constraint / Object | Expected Result | Actual Result | Status |
|---|---|---|---|---|:---:|
| **1. Ingestion** | Predefined `states` count = 1 | `states` table | 1 record | 1 record | **PASSED** |
| **1. Ingestion** | Predefined `towns` count = 415 | `towns` table | 415 records | 415 records | **PASSED** |
| **1. Ingestion** | Predefined `charging_networks` count = 30 | `charging_networks` table | 30 records | 30 records | **PASSED** |
| **1. Ingestion** | Predefined `vehicle_categories` count = 5 | `vehicle_categories` table | 5 records | 5 records | **PASSED** |
| **1. Ingestion** | Predefined `connector_types` count = 7 | `connector_types` table | 7 records | 7 records | **PASSED** |
| **1. Ingestion** | Predefined `stations` count = 6,068 | `stations` table | 6,068 records | 6,068 records | **PASSED** |
| **1. Ingestion** | Predefined `chargers` count = 8,501 | `chargers` table | 8,501 records | 8,501 records | **PASSED** |
| **2. Primary Key** | Insert duplicate `state_id = 1` | `states_pkey` | Error: `unique_violation` | Rejected duplicate key | **PASSED** |
| **2. Primary Key** | Insert duplicate `charger_id = 1` | `chargers_pkey` | Error: `unique_violation` | Rejected duplicate key | **PASSED** |
| **3. Foreign Key** | Charger referencing `station_id = 999999` | `chargers_station_id_fkey` | Error: `foreign_key_violation` | Rejected orphan record | **PASSED** |
| **3. Foreign Key** | Charger referencing `connector_type_id = 9999` | `chargers_connector_type_id_fkey` | Error: `foreign_key_violation` | Rejected orphan record | **PASSED** |
| **3. Foreign Key** | Station referencing `town_id = 999999` | `stations_town_id_fkey` | Error: `foreign_key_violation` | Rejected orphan record | **PASSED** |
| **4. Uniqueness** | Insert duplicate user email | `users_email_key` | Error: `unique_violation` | Duplicate email rejected | **PASSED** |
| **4. Uniqueness** | Insert duplicate booking code | `reservations_booking_code_key` | Error: `unique_violation` | Duplicate booking code rejected | **PASSED** |
| **4. Uniqueness** | Duplicate charger label within station `(1, 'P001')` | `uq_charger_label_per_station` | Error: `unique_violation` | Duplicate bay label rejected | **PASSED** |
| **4. Uniqueness** | Duplicate town in state `('Bengaluru', 1)` | `uq_town_name_state` | Error: `unique_violation` | Duplicate town in state rejected | **PASSED** |
| **5. Domain Check** | Insert charger with `power_kw = 0.0` | `chargers_power_kw_check` | Error: `check_violation` | Non-positive power rejected | **PASSED** |
| **5. Domain Check** | Station with latitude `95.5°` (> 90°) | `stations_latitude_check` | Error: `check_violation` | Out-of-bounds latitude rejected | **PASSED** |
| **5. Domain Check** | Station with longitude `-185.0°` (< -180°) | `stations_longitude_check` | Error: `check_violation` | Out-of-bounds longitude rejected | **PASSED** |
| **5. Domain Check** | Reservation with `slot_end <= slot_start` | `chk_slot_order` | Error: `check_violation` | Inverted slot order rejected | **PASSED** |
| **5. Domain Check** | Session with `energy_kwh = -15.5` | `charging_sessions_energy_kwh_check` | Error: `check_violation` | Negative energy rejected | **PASSED** |
| **6. Concurrency** | Overlapping confirmed reservation on same charger | `excl_no_charger_overlap` | Error: `exclusion_violation` | Double booking rejected | **PASSED** |
| **6. Concurrency** | Adjacent reservation on same charger `[10:00, 11:00)` | Half-open interval `[)` | Success | Clean insert, no collision | **PASSED** |
| **7. 3NF Views** | Verify `cost = energy_kwh * tariff_applied` | `v_charging_session_cost` | Exactly 0 mismatches | 0 mismatches found | **PASSED** |
| **7. 3NF Views** | Verify `priority_rank` derived via vehicle category | `v_queue_priority` | Rank assigned via `queue_rank` | Correct rank resolved | **PASSED** |
| **7. 3NF Views** | Verify combined charger-connector join count | `v_charger_connector` | Exactly 8,501 rows mapped | 8,501 rows returned | **PASSED** |

---

## 3. Detailed Transaction Safety Validation: Double-Booking Prevention

### 3.1 Test Case: Concurrent Overlap on Charger 2

- **Pre-existing Booking**:
  - Charger ID: `2`
  - Active Time Interval: `2026-11-10 09:00:00+05:30` to `2026-11-10 10:00:00+05:30`
  - Status: `CONFIRMED`
- **Attempted Overlapping Booking**:
  - Charger ID: `2`
  - Requested Time Interval: `2026-11-10 09:30:00+05:30` to `2026-11-10 10:30:00+05:30` (30-minute collision)
  - Booking Attempt:
    ```sql
    INSERT INTO reservations (vehicle_id, charger_id, slot_start, slot_end, booking_code, status)
    VALUES (3, 2, '2026-11-10 09:30:00+05:30', '2026-11-10 10:30:00+05:30', 'BK-TEST-OVERLAP', 'CONFIRMED');
    ```
- **Engine Reaction**:
  ```text
  ERROR: conflicting key value violates exclusion constraint "excl_no_charger_overlap"
  DETAIL: Key (charger_id, tstzrange(slot_start, slot_end, '[)'::text))=(2, ["2026-11-10 09:30:00+05:30","2026-11-10 10:30:00+05:30"))
  conflicts with existing key (2, ["2026-11-10 09:00:00+05:30","2026-11-10 10:00:00+05:30")).
  ```
- **Conclusion**:
  Double-booking is completely prevented at the PostgreSQL engine level independently of any application layer.

---

### 3.2 Adjacent Booking Behavior

- **Attempted Adjacent Booking**:
  - Charger ID: `2`
  - Requested Time Interval: `2026-11-10 10:00:00+05:30` to `2026-11-10 11:00:00+05:30`
- **Engine Reaction**:
  - Interval bounds `[start, end)` are inclusive on start and exclusive on end.
  - The instantaneous boundary `10:00:00` does not intersect.
  - **Result**: `INSERT 0 1` (Successfully confirmed).

