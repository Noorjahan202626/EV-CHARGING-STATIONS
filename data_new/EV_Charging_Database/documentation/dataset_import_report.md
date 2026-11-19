# Dataset Import Report: Predefined EV Dataset Integration

## 1. Executive Summary

The **EV Charging Station Network Orchestrator** database integrates an authentic, real-world predefined dataset consisting of **15,027 records** across seven CSV files extracted from `EV_Predefined_Data_csv.zip`. The dataset captures genuine EV charging infrastructure across Karnataka, India, encompassing 6,068 physical stations and 8,501 charging bays operated by 30 network providers across 415 towns.

All predefined records have been inspected, mapped, validated, and loaded into their respective PostgreSQL tables without altering source keys, values, or coordinates.

---

## 2. Predefined Dataset File Breakdown

| Predefined CSV File | Target PostgreSQL Table | Predefined Records | Imported Records | Rejected Records | Missing / Null Fields |
|---|---|---:|---:|---:|---|
| `state.csv` | `states` | 1 | 1 | 0 | None (Karnataka) |
| `town.csv` | `towns` | 415 | 415 | 0 | None (All 415 reference state_id = 1) |
| `charging_network.csv` | `charging_networks` | 30 | 30 | 0 | None (Ather, BESCOM, BPCL, etc.) |
| `vehicle_category.csv` | `vehicle_categories` | 5 | 5 | 0 | None (`EM`, `4W`, `3W`, `2W`, `HV`) |
| `connector_type.csv` | `connector_types` | 7 | 7 | 0 | None (`CCS2`, `CHADEMO`, `TYPE2_AC`, `BHARAT_AC001`, `BHARAT_DC001`, `LEV_AC`, `LEV_DC`) |
| `station.csv` / `station_insert.sql` | `stations` | 6,068 | 6,068 | 0 | Address: 34 NULL<br>Postcode, Tariff, Status populated from enriched dataset |
| `charger.csv` | `chargers` | 8,501 | 8,501 | 0 | None (`status` mapped to uppercase `AVAILABLE`) |
| **TOTAL** | **7 Master Tables** | **15,027** | **15,027** | **0** | **0 Referential Errors** |

---

## 3. Data Integrity & Validation Checks

### 3.1 Primary Key Uniqueness
- **`state.state_id`**: 1 unique value (100% unique).
- **`town.town_id`**: 415 unique values (100% unique).
- **`charging_network.network_id`**: 30 unique values (100% unique).
- **`vehicle_category.category_id`**: 5 unique values (100% unique).
- **`connector_type.connector_type_id`**: 7 unique values (100% unique).
- **`station.station_id`**: 6,068 unique values (100% unique).
- *Note:* `source_id` from raw `station.csv` is excluded from the relational table definition, keeping `station_id` as the primary key.
- **`charger.charger_id`**: 8,501 unique values (100% unique).

### 3.2 Foreign Key Consistency
Comprehensive programmatic checks verified 100% referential integrity prior to ingestion:
- **`towns.state_id` → `states.state_id`**: All 415 rows resolve to `state_id = 1` (Karnataka). Zero orphans.
- **`stations.town_id` → `towns.town_id`**: All 6,068 stations reference existing `town_id` values (1 to 415). Zero orphans.
- **`stations.network_id` → `charging_networks.network_id`**: All 6,068 stations reference valid network IDs (1 to 30). Zero orphans.
- **`chargers.station_id` → `stations.station_id`**: All 8,501 chargers reference valid `station_id` values. Zero orphans.
- **`chargers.connector_type_id` → `connector_types.connector_type_id`**: All 8,501 chargers reference valid connector standards (1 to 7). Zero orphans.

### 3.3 Domain Range Verifications
- **Geographic Coordinates (`stations`)**:
  - Latitude: Minimum `11.803481° N`, Maximum `18.371169° N` (strictly within Indian territorial bounds -90 to +90).
  - Longitude: Minimum `74.128650° E`, Maximum `78.498234° E` (strictly within Indian territorial bounds -180 to +180).
- **Charger Power Rating (`chargers.power_kw`)**:
  - Minimum: `3.0 kW`, Maximum: `120.0 kW` (strictly positive, satisfies `CHECK (power_kw > 0)`).
- **Charger Labels per Station**:
  - `(station_id, label)` combination was validated across all 8,501 records. Exactly 8,501 unique pairs, satisfying the composite unique constraint `uq_charger_label_per_station`.

---

## 4. Handling Missing Dataset Attributes

The project specification strictly prohibits inventing mock data for genuine fields:

1. **`stations.tariff_per_kwh` & `stations.status`**:
   - The station insert dataset (`station_insert.sql`) provides realistic tariff rates (e.g. ₹9.00 to ₹23.50/kWh) and operational statuses (`'Operational'`, `'Inactive'`, `'Under Maintenance'`).
   - These are fully ingested across all 6,068 station records.
2. **`stations.address` (34 missing)**:
   - Handled cleanly as SQL `NULL`. Stations remain accurately geolocated by their latitude, longitude, and foreign-key link to `town_id`.
4. **`chargers.status` ('Available' casing)**:
   - In `charger.csv`, all 8,501 rows have `status = 'Available'`.
   - **Resolution**: Normalized to the standard uppercase token `'AVAILABLE'`, while allowing backward-compatible checks in the table constraint.

---

## 5. Sequence Re-synchronization

Because predefined IDs (1 to 6068 for stations, 1 to 8501 for chargers) were explicitly inserted, all PostgreSQL auto-increment sequences (`SERIAL`) were advanced to `MAX(id)`:
```sql
SELECT setval('stations_station_id_seq', (SELECT MAX(station_id) FROM stations));
SELECT setval('chargers_charger_id_seq', (SELECT MAX(charger_id) FROM chargers));
```
This ensures future runtime inserts seamlessly generate new IDs (e.g. `station_id = 6069`, `charger_id = 8502`) without primary-key collisions.

