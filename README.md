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





---


## 7. Verification & Analytical Queries

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

### State diagram

[Click here to view State Diagram](database/State_Diagram.jpeg)
### Activity Diagram 

[Click here to view Activity Diagram](database/EV_Activity_Diagram_Final%20(2).png)
- **Transaction Safety**: Verified protection against race conditions and double bookings.

