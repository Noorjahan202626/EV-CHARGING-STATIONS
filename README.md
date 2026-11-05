# EV Charging Station Network Orchestrator – Database Implementation

A normalized, transaction-safe PostgreSQL database architecture designed to manage large-scale electric vehicle (EV) charging station networks. This database handles physical charging bays, driver reservations, priority waiting queues, power delivery sessions, and billing snapshots.

---

## 1. Project Overview & Objectives

The primary objective of this project is to develop an enterprise-grade database model for an EV charging network orchestrator without relying on application-level constraints for concurrency or data integrity.

### Key Capabilities:
- **16 Relational Tables**: Strictly structured according to the **Revised V3 Relational Schema**.
- **15,027 Authentic Predefined Records**: Ingested directly from real-world EV charging network data across Karnataka, India.
- **Strict 3NF Compliance**: Eliminates redundant derived attributes (charging session cost, queue priority ranks) through normalized views.
- **Engine-Level Concurrency Protection**: Uses PostgreSQL GiST exclusion constraints (`btree_gist`) to guarantee that no two drivers can double-book the same charger for overlapping time slots.
- **Dual Naming Flexibility**: Native support for both plural (`stations`, `chargers`) and singular (`station`, `charger`) table names using SQL synonym views.

---

## 2. Technology Stack

- **Database Engine**: PostgreSQL (Version 14, 15, or 16 recommended)
- **Management GUI**: pgAdmin 4
- **CLI Client**: `psql`
- **Extensions**:
  - `btree_gist`: Enables scalar GiST exclusion constraints for timestamp intervals.
  - `pgcrypto`: Cryptographic password hashing functions.
  - `uuid-ossp`: Unique identifier generation.

---

## 3. Project Directory Structure

```text
EV_Charging_Database/
├── database/
│   ├── 01_create_database.sql        # Database initialization & extensions
│   ├── 02_create_tables.sql          # All 16 tables in dependency order
│   ├── 03_constraints.sql            # Exclusion & domain check constraints
│   ├── 04_indexes.sql                # Foreign key, range & performance indexes
│   ├── 05_normalization_views.sql    # 3NF normalization views
│   ├── 06_import_ev_dataset.sql      # Ingests 15,027 predefined records + test data
│   ├── 07_transaction_logic.sql      # Concurrency & locking walkthrough
│   ├── 08_test_cases.sql             # Comprehensive constraint test suite
│   └── 09_useful_queries.sql         # 20 operational SQL queries
├── data/
│   ├── EV_Predefined_Data_csv.zip    # Original compressed dataset
│   ├── state.csv                     # 1 state record (Karnataka)
│   ├── town.csv                      # 415 town records
│   ├── charging_network.csv          # 30 charging network brands
│   ├── vehicle_category.csv          # 5 vehicle categories
│   ├── connector_type.csv            # 7 hardware connector standards
│   ├── station.csv                   # 6,068 charging station records
│   └── charger.csv                   # 8,501 charging bay records
├── documentation/
│   ├── database_overview.md          # Architectural background & classification
│   ├── entity_relationships.md       # Detailed relationship & cardinality catalog
│   ├── normalization.md              # 3NF decisions & view derivations
│   ├── dataset_import_report.md      # Statistical validation & ingestion report
│   ├── data_dictionary.md            # Complete attribute-level specification
│   └── testing_results.md            # Constraint test results & double-booking logs
└── README.md                         # Main user guide & operational documentation
```

---

## 4. Integration of Predefined EV Dataset (15,027 Records)

The database incorporates genuine infrastructure data from Karnataka, India:

| Table | CSV Source | Records | Key Columns & Characteristics |
|---|---|---:|---|
| `states` | `state.csv` | 1 | `state_id`, `name` (Karnataka) |
| `towns` | `town.csv` | 415 | `town_id`, `name`, `state_id` (415 towns across Karnataka) |
| `charging_networks` | `charging_network.csv` | 30 | `network_id`, `name` (BESCOM, Ather, BPCL, etc.) |
| `vehicle_categories` | `vehicle_category.csv` | 5 | `category_id`, `code` (`EM`, `4W`, `3W`, `2W`, `HV`), `queue_rank` |
| `connector_types` | `connector_type.csv` | 7 | `connector_type_id`, `code` (`CCS2`, `TYPE2_AC`, etc.), `current_type` (`AC`/`DC`) |
| `stations` | `station.csv` | 6,068 | `station_id`, `name`, `latitude`, `longitude`, `town_id`, `network_id` |
| `chargers` | `charger.csv` | 8,501 | `charger_id`, `label`, `power_kw` (3 kW to 120 kW), `station_id`, `connector_type_id` |
| **TOTAL** | **7 Master Tables** | **15,027** | **100% Validated. Zero Referential Errors.** |

### Handling of Missing Fields in Dataset:
1. **Station Tariff (`tariff_per_kwh`)**: Entirely empty in `station.csv`. Preserved as SQL `NULL` to avoid inventing fictional rates.
2. **Station Status (`status`)**: Empty in `station.csv`. Defined as nullable in the schema and stored as `NULL`.
3. **Station Address (34 missing) & Postcode (1,495 missing)**: Stored as SQL `NULL`. Stations remain accurately geolocated by their latitude and longitude coordinates.
4. **Charger Status**: All rows in `charger.csv` have status `'Available'`. Mapped to standard uppercase `'AVAILABLE'` during import.

---

## 5. The 16 Relational Tables

### Master Infrastructure Entities (Populated from CSVs):
1. **`states`**: State territorial records.
2. **`towns`**: Municipalities mapped to states (`1:N`).
3. **`charging_networks`**: Charging network providers operating stations (`1:N`).
4. **`vehicle_categories`**: Vehicle types with associated queue ranks.
5. **`connector_types`**: Hardware charging plugs (`AC` and `DC`).
6. **`stations`**: Physical stations geolocated by latitude and longitude.
7. **`chargers`**: Individual charging points/bays within stations.

### Operational Dynamic Entities (Populated via Platform Activity):
8. **`users`**: Customer, operator, and administrator accounts.
9. **`operators`**: User-to-station assignment (`1:1` relationship).
10. **`vehicles`**: Electric vehicles owned by registered users.
11. **`vehicle_connector_compatibility`**: M:N junction table mapping vehicles to compatible connector types.
12. **`reservations`**: Scheduled charger time slots.
13. **`waiting_queue_entries`**: Dynamic queue for high-demand stations.
14. **`charging_sessions`**: Actual physical charging delivery telemetry (`1:1` with reservation).
15. **`payments`**: Transaction records capturing billing snapshots.
16. **`notifications`**: User alert and messaging dispatch history.

---

## 6. Normalization Decisions (Strict 3NF)

### A. Charging Session Cost
- **Problem**: Persisting `cost` in `charging_sessions` creates a derived redundancy: $\text{Cost} = \text{Energy\_kWh} \times \text{Tariff\_Applied}$.
- **Resolution**: `cost` is not stored in the table. Instead, view **`v_charging_session_cost`** calculates it on the fly:
  $$\text{cost} = \text{ROUND}(\text{energy\_kwh} \times \text{tariff\_applied}, 2)$$

### B. Payment Amount
- **Problem**: Should `payments.amount` be removed because cost can be computed?
- **Resolution**: **Retained**. `payments.amount` represents an immutable financial snapshot of the exact amount billed and approved by the payment gateway at that point in time.

### C. Normalized Location Hierarchy
- **Problem**: A combined `location` table would introduce transitive dependencies.
- **Resolution**: Separate `states` and `towns` tables are maintained with foreign key cascading.

### D. Queue Priority
- **Problem**: Persisting `priority_class` redundantly in `waiting_queue_entries` violates 3NF.
- **Resolution**: `priority_class` is derived dynamically through the vehicle's category via **`v_queue_priority`**.

---

## 7. Concurrency Control & Double-Booking Prevention

### The Problem:
If two drivers simultaneously attempt to reserve Charger Bay `P001` for overlapping time slots (e.g. 09:00–10:30 and 09:30–11:00), application-level checks can fail due to race conditions.

### The Solution: Engine-Level Exclusion Constraint
In `03_constraints.sql`, PostgreSQL's GiST exclusion constraint guarantees atomicity:
```sql
ALTER TABLE reservations
    ADD CONSTRAINT excl_no_charger_overlap
    EXCLUDE USING gist (
        charger_id WITH =,
        tstzrange(slot_start, slot_end, '[)') WITH &&
    )
    WHERE (status IN ('CONFIRMED', 'ACTIVE') AND charger_id IS NOT NULL);
```

### How to Test Concurrent Bookings in pgAdmin 4:
1. Open **two separate Query Tool windows** in pgAdmin 4.
2. In **Session 1**, lock Charger 2:
   ```sql
   BEGIN;
   SELECT * FROM chargers WHERE charger_id = 2 FOR UPDATE;
   ```
3. In **Session 2**, attempt to lock the same charger:
   ```sql
   BEGIN;
   SELECT * FROM chargers WHERE charger_id = 2 FOR UPDATE;
   -- Session 2 hangs, waiting for Session 1 to finish.
   ```
4. Back in **Session 1**, insert a confirmed reservation and commit:
   ```sql
   INSERT INTO reservations (vehicle_id, charger_id, slot_start, slot_end, booking_code, status)
   VALUES (1, 2, '2026-12-01 14:00+05:30', '2026-12-01 15:00+05:30', 'BK-SESS-1', 'CONFIRMED');
   COMMIT;
   ```
5. **Session 2** immediately unblocks. Attempt to book an overlapping interval:
   ```sql
   INSERT INTO reservations (vehicle_id, charger_id, slot_start, slot_end, booking_code, status)
   VALUES (3, 2, '2026-12-01 14:30+05:30', '2026-12-01 15:30+05:30', 'BK-SESS-2', 'CONFIRMED');
   -- ERROR: conflicting key value violates exclusion constraint "excl_no_charger_overlap"
   ROLLBACK;
   ```

---

## 8. Step-by-Step Execution Guide (pgAdmin 4)

### Step 1: Connect & Create the Database
1. Open **pgAdmin 4** and connect to your PostgreSQL server.
2. Open the **Query Tool** on the default `postgres` database.
3. Open and run **`01_create_database.sql`**:
   ```sql
   CREATE DATABASE ev_charging_orchestrator;
   ```
4. Disconnect from `postgres` and connect to the newly created **`ev_charging_orchestrator`** database.
5. In the new Query Tool, enable the required extensions:
   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```

### Step 2: Execute SQL Scripts in Exact Order
Run each file in the `database/` folder sequentially:

| Order | Script File | Purpose | Execution Time |
|:---:|---|---|:---:|
| **1** | `01_create_database.sql` | Creates database and initializes extensions | ~1 sec |
| **2** | `02_create_tables.sql` | Creates all 16 tables and synonym views | ~1 sec |
| **3** | `03_constraints.sql` | Adds exclusion constraint and check validations | ~1 sec |
| **4** | `04_indexes.sql` | Creates performance B-tree and GiST range indexes | ~1 sec |
| **5** | `05_normalization_views.sql` | Creates the 3NF views (`cost`, `priority`, `charger_connector`) | ~1 sec |
| **6** | `06_import_ev_dataset.sql` | Loads all 15,027 predefined records and test dataset | ~4-6 secs |
| **7** | `07_transaction_logic.sql` | Demonstrates safe booking, check-in, and session commits | ~1 sec |
| **8** | `08_test_cases.sql` | Runs automated constraint and verification test suite | ~2 secs |
| **9** | `09_useful_queries.sql` | Executes the 20 analytical and operational queries | ~2 secs |

---

## 9. Verification & Analytical Queries

To verify table counts after running `06_import_ev_dataset.sql`:
```sql
SELECT 'stations' AS entity, COUNT(*) FROM stations
UNION ALL SELECT 'chargers', COUNT(*) FROM chargers
UNION ALL SELECT 'towns', COUNT(*) FROM towns
UNION ALL SELECT 'charging_networks', COUNT(*) FROM charging_networks
UNION ALL SELECT 'connector_types', COUNT(*) FROM connector_types
UNION ALL SELECT 'vehicle_categories', COUNT(*) FROM vehicle_categories
UNION ALL SELECT 'states', COUNT(*) FROM states;
```
Expected output:
- `stations`: 6,068
- `chargers`: 8,501
- `towns`: 415
- `charging_networks`: 30
- `connector_types`: 7
- `vehicle_categories`: 5
- `states`: 1

---

## 10. Summary of Deliverables

- **Complete SQL Scripts**: 9 executable, production-ready SQL scripts in `database/`.
- **Predefined EV Dataset**: Original CSV files preserved in `data/`.
- **Architectural Documentation**: 6 detailed Markdown reports in `documentation/`.

- ### ER Diagram

[Click here to view ER Diagram](database/EV_ER_Diagram_Revised_v3.png)

### Relational Schema

[Click here to view Relational Schema](database/EV_Relational_Schema_Revised_v3.pdf)
- **Transaction Safety**: Verified protection against race conditions and double bookings.

