# Entity Relationships: EV Charging Station Network Orchestrator

## 1. Complete Relationship Catalog

The Revised V3 database architecture implements the following relationships across the 16 tables:

| # | Relationship | Cardinality | Primary Enforcement Mechanism | Foreign Key Column(s) | Description |
|---|---|---|---|---|---|
| 1 | `states` → `towns` | 1:N | Foreign Key | `towns.state_id` | Towns belong to exactly one state |
| 2 | `towns` → `stations` | 1:N | Foreign Key (Nullable) | `stations.town_id` | Stations are situated within a town |
| 3 | `charging_networks` → `stations` | 1:N | Foreign Key (Nullable) | `stations.network_id` | Commercial/public network operating the station |
| 4 | `stations` → `chargers` | 1:N | Foreign Key (Cascade) | `chargers.station_id` | Stations house one or more physical charger bays |
| 5 | `connector_types` → `chargers` | 1:N | Foreign Key | `chargers.connector_type_id` | Connector standard fitted to the charger bay |
| 6 | `users` → `vehicles` | 1:N | Foreign Key (Cascade) | `vehicles.user_id` | Platform users register one or more electric vehicles |
| 7 | `vehicle_categories` → `vehicles` | 1:N | Foreign Key | `vehicles.category_id` | Vehicle category driving queue priority rank |
| 8 | `vehicles` ↔ `connector_types` | M:N | Composite PK / FK | `vehicle_connector_compatibility(vehicle_id, connector_type_id)` | Junction mapping supported charging plug standards |
| 9 | `users` → `operators` | 1:0..1 | PK as FK | `operators.user_id` | A user can hold at most one operator profile |
| 10 | `operators` → `stations` | 1:1 | FK + UNIQUE | `operators.station_id` | An operator manages exactly one station, station has one operator |
| 11 | `vehicles` → `reservations` | 1:N | Foreign Key | `reservations.vehicle_id` | Vehicle for which a charging slot is booked |
| 12 | `chargers` → `reservations` | 1:N | Foreign Key (Nullable) | `reservations.charger_id` | Specific charger allocated for the time interval |
| 13 | `users` → `reservations` | 1:N (Logical) | Derived via `vehicles` | `reservations.vehicle_id` → `vehicles.user_id` | **3NF Architecture**: User resolved via vehicle ownership |
| 14 | `reservations` → `charging_sessions` | 1:1 | FK + UNIQUE | `charging_sessions.reservation_id` | Telemetry record for an active/completed booking |
| 15 | `charging_sessions` → `payments` | 1:1 | FK + UNIQUE | `payments.session_id` | Financial transaction ledger for energy delivered |
| 16 | `stations` → `waiting_queue_entries` | 1:N | Foreign Key (Cascade) | `waiting_queue_entries.station_id` | Station-specific queue for over-capacity periods |
| 17 | `vehicles` → `waiting_queue_entries` | 1:N | Foreign Key (Cascade) | `waiting_queue_entries.vehicle_id` | Vehicle queued awaiting charger allocation |
| 18 | `reservations` ↔ `waiting_queue_entries` | 1:0..1 (Optional) | FK + UNIQUE | `waiting_queue_entries.reservation_id` | Displacement link when a booked charger faults |
| 19 | `users` → `notifications` | 1:N | Foreign Key (Cascade) | `notifications.user_id` | User alert delivery stream |

---

## 2. In-Depth Analysis of Special Relationships & Discrepancies

### 2.1 The USER–RESERVATION Relationship in 3NF

**Specification Observation**:
A common design discrepancy in naive EV schemas is placing a direct `user_id` column inside the `reservations` table alongside `vehicle_id`.

**Why Revised V3 Omits Direct `reservations.user_id`**:
1. **Transitive Dependency Elimination (3NF)**:
   - A vehicle is strictly owned by a registered user: `vehicles.vehicle_id → vehicles.user_id`.
   - A reservation is booked specifically for a physical vehicle: `reservations.vehicle_id`.
   - If `reservations.user_id` were stored directly in `reservations`, any change in vehicle ownership would introduce data anomaly vulnerabilities, and the dependency `reservations.reservation_id → reservations.vehicle_id → vehicles.user_id` would violate 3NF.
2. **Note 1 of the Revised V3 ER Diagram**:
   > *"A reservation's user is found through its vehicle (RESERVED_FOR + OWNS), so RESERVATION has no separate user link."*
3. **Query Resolution**:
   The database effortlessly retrieves the booking user via standard inner join:
   ```sql
   SELECT r.booking_code, u.name, u.email, v.registration_no
   FROM reservations r
   JOIN vehicles v ON v.vehicle_id = r.vehicle_id
   JOIN users u ON u.user_id = v.user_id;
   ```
   Both `v_charging_session_cost` and the useful queries expose the user directly through this normalized relationship.

---

### 2.2 The OPERATOR–STATION 1:1 Relationship

**Specification Requirement**:
Each station must be assigned to at most one operator, and an operator manages exactly one station.

**Database Implementation**:
```sql
CREATE TABLE operators (
    user_id    INT PRIMARY KEY
        REFERENCES users (user_id) ON DELETE CASCADE,
    station_id INT NOT NULL UNIQUE
        REFERENCES stations (station_id) ON DELETE RESTRICT
);
```

**Constraint Mechanics**:
1. **`user_id` as Primary Key & Foreign Key**:
   - Because `user_id` is the primary key of `operators`, a given `users` record can appear at most once in `operators`. This enforces the `1:0..1` relationship (a user may be a customer, an admin, or an operator, but never two separate operator records).
2. **`station_id INT NOT NULL UNIQUE`**:
   - The `UNIQUE` constraint guarantees that no two operators can manage the same `station_id`.
   - The `NOT NULL` constraint guarantees that every operator row is bound to a valid station.
   - Combined, these rules guarantee a strict mathematical bijection (1:1) between active operators and their managed stations.

---

### 2.3 The RESERVATION–WAITING_QUEUE_ENTRY Displacement Relationship

**Specification Requirement**:
When a charger suffers an unexpected hardware fault (`FAULT` / `OFFLINE`) while an active or confirmed reservation is scheduled, the platform displaces the customer into the station's waiting queue with elevated emergency priority.

**Database Implementation**:
```sql
CREATE TABLE waiting_queue_entries (
    queue_id       SERIAL PRIMARY KEY,
    station_id     INT NOT NULL REFERENCES stations (station_id),
    vehicle_id     INT NOT NULL REFERENCES vehicles (vehicle_id),
    reservation_id INT UNIQUE REFERENCES reservations (reservation_id) ON DELETE SET NULL,
    ...
);
```

**Constraint Mechanics**:
1. **`reservation_id` is Nullable**:
   - Standard walk-in or app-queued drivers join the queue directly without an existing reservation (`reservation_id IS NULL`).
2. **`reservation_id` is `UNIQUE`**:
   - A displaced reservation can generate at most one active queue displacement entry, preventing duplicate queue padding.
3. **`ON DELETE SET NULL`**:
   - If historical reservation logs are purged, the queue log preserves queue audit history without referential cascading failure.

