# Data Dictionary: EV Charging Station Network Orchestrator

This document details all 16 entities, attributes, data types, nullability, default values, and integrity constraints in the `ev_charging_orchestrator` database.

---

## Table 1: `states`
Predefined Infrastructure Master Table.
- **Source**: `state.csv` (1 row)

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `state_id` | SERIAL | NO | auto | PRIMARY KEY | Unique identifier for state |
| `name` | VARCHAR(80) | NO | None | UNIQUE | State or territory name (e.g. Karnataka) |

---

## Table 2: `towns`
Predefined Infrastructure Master Table.
- **Source**: `town.csv` (415 rows)

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `town_id` | SERIAL | NO | auto | PRIMARY KEY | Unique identifier for town |
| `name` | VARCHAR(100) | NO | None | None | Town / municipality name |
| `state_id` | INT | NO | None | FK $\rightarrow$ `states(state_id)` | Parent state reference |

*Table-Level Constraints:* `UNIQUE (name, state_id)`

---

## Table 3: `charging_networks`
Predefined Infrastructure Master Table.
- **Source**: `charging_network.csv` (30 rows)

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `network_id` | SERIAL | NO | auto | PRIMARY KEY | Unique identifier for charging network brand |
| `name` | VARCHAR(80) | NO | None | UNIQUE | Brand name (e.g. BESCOM, Ather, BPCL) |

---

## Table 4: `vehicle_categories`
Predefined Infrastructure Master Table.
- **Source**: `vehicle_category.csv` (5 rows)

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `category_id` | SERIAL | NO | auto | PRIMARY KEY | Unique identifier for vehicle category |
| `code` | VARCHAR(20) | NO | None | UNIQUE | Category short code (`EM`, `4W`, `3W`, `2W`, `HV`) |
| `queue_rank` | INT | NO | None | CHECK (`queue_rank > 0`) | Priority rank (1 = highest, 5 = lowest) |

---

## Table 5: `connector_types`
Predefined Infrastructure Master Table.
- **Source**: `connector_type.csv` (7 rows)

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `connector_type_id` | SERIAL | NO | auto | PRIMARY KEY | Unique identifier for connector standard |
| `code` | VARCHAR(20) | NO | None | UNIQUE | Industry code (e.g. `CCS2`, `TYPE2_AC`) |
| `description` | VARCHAR(100) | YES | NULL | None | Full standard description |
| `current_type` | VARCHAR(2) | NO | None | CHECK (`current_type IN ('AC', 'DC')`) | Electrical current type |

---

## Table 6: `stations`
Predefined Infrastructure Master Table.
- **Source**: `station.csv` (6,068 rows)

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `station_id` | SERIAL | NO | auto | PRIMARY KEY | Unique identifier for charging station |
| `name` | VARCHAR(150) | NO | None | None | Display name of the station |
| `address` | VARCHAR(250) | YES | NULL | None | Street address (34 NULL in source dataset) |
| `town_id` | INT | YES | NULL | FK $\rightarrow$ `towns(town_id)` | Town jurisdiction |
| `postcode` | VARCHAR(15) | YES | NULL | None | PIN / postal code (1,495 NULL in source dataset) |
| `latitude` | DECIMAL(9,6) | YES | NULL | CHECK (`BETWEEN -90 AND 90`) | GPS latitude |
| `longitude` | DECIMAL(9,6) | YES | NULL | CHECK (`BETWEEN -180 AND 180`) | GPS longitude |
| `usage_type` | VARCHAR(60) | YES | NULL | None | Usage classification (`Government`, `Private`) |
| `tariff_per_kwh` | DECIMAL(6,2) | YES | NULL | CHECK (`tariff_per_kwh >= 0`) | Base tariff per kWh (NULL in source dataset) |
| `status` | VARCHAR(40) | YES | NULL | CHECK (`status IN ('ACTIVE', ...)` or NULL) | Station operational status |
| `network_id` | INT | YES | NULL | FK $\rightarrow$ `charging_networks(network_id)` | Affiliated charging network brand |

---

## Table 7: `chargers`
Predefined Infrastructure Master Table.
- **Source**: `charger.csv` (8,501 rows)

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `charger_id` | SERIAL | NO | auto | PRIMARY KEY | Unique identifier for charging bay |
| `label` | VARCHAR(20) | NO | None | None | Bay identification label (e.g. `P001`, `P002`) |
| `power_kw` | DECIMAL(6,1) | NO | None | CHECK (`power_kw > 0`) | Maximum power output in kW |
| `status` | VARCHAR(15) | NO | `'AVAILABLE'` | CHECK (`IN ('AVAILABLE', 'OCCUPIED', 'FAULT', 'OFFLINE')`) | Bay operational availability |
| `station_id` | INT | NO | None | FK $\rightarrow$ `stations(station_id)` | Parent station reference |
| `connector_type_id` | INT | NO | None | FK $\rightarrow$ `connector_types(connector_type_id)` | Hardware connector standard fitted |

*Table-Level Constraints:* `UNIQUE (station_id, label)`

---

## Table 8: `users`
Platform Dynamic User Table.

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `user_id` | SERIAL | NO | auto | PRIMARY KEY | Unique user account ID |
| `name` | VARCHAR(100) | NO | None | None | User's full name |
| `email` | VARCHAR(120) | NO | None | UNIQUE | User email address |
| `password_hash` | VARCHAR(255) | NO | None | None | Bcrypt/Argon2 password hash |
| `role` | VARCHAR(10) | NO | `'USER'` | CHECK (`role IN ('USER', 'OPERATOR', 'ADMIN')`) | System role |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | None | Account registration timestamp |
| `latitude` | DECIMAL(9,6) | YES | NULL | CHECK (`BETWEEN -90 AND 90`) | Last recorded user latitude |
| `longitude` | DECIMAL(9,6) | YES | NULL | CHECK (`BETWEEN -180 AND 180`) | Last recorded user longitude |

---

## Table 9: `operators`
Platform Dynamic Operator Profile Table (1:1 with Station).

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `user_id` | INT | NO | None | PRIMARY KEY, FK $\rightarrow$ `users(user_id)` | Operator user account ID (1:0..1) |
| `station_id` | INT | NO | None | UNIQUE, FK $\rightarrow$ `stations(station_id)` | Exclusively managed station ID (1:1) |

---

## Table 10: `vehicles`
Platform Dynamic Electric Vehicle Registry.

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `vehicle_id` | SERIAL | NO | auto | PRIMARY KEY | Unique vehicle record ID |
| `registration_no` | VARCHAR(15) | YES | NULL | UNIQUE | Official registration number plate |
| `make` | VARCHAR(100) | YES | NULL | None | Vehicle manufacturer (e.g. Tata, Ather) |
| `model` | VARCHAR(100) | YES | NULL | None | Vehicle model name |
| `battery_capacity_kwh` | DECIMAL(6,2) | YES | NULL | CHECK (`battery_capacity_kwh > 0`) | Battery capacity in kWh |
| `user_id` | INT | NO | None | FK $\rightarrow$ `users(user_id)` | Owner user account ID |
| `category_id` | INT | NO | None | FK $\rightarrow$ `vehicle_categories(category_id)` | Category ID driving queue priority rank |

---

## Table 11: `vehicle_connector_compatibility`
Platform Dynamic M:N Junction Table.

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `vehicle_id` | INT | NO | None | Composite PK, FK $\rightarrow$ `vehicles(vehicle_id)` | Vehicle reference |
| `connector_type_id` | INT | NO | None | Composite PK, FK $\rightarrow$ `connector_types(connector_type_id)` | Connector reference |

---

## Table 12: `reservations`
Platform Dynamic Time-Slot Bookings.

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `reservation_id` | SERIAL | NO | auto | PRIMARY KEY | Unique reservation ID |
| `booking_code` | VARCHAR(50) | NO | None | UNIQUE | Customer booking reference code |
| `slot_start` | TIMESTAMPTZ | NO | None | None | Reservation slot start time |
| `slot_end` | TIMESTAMPTZ | NO | None | None | Reservation slot end time |
| `status` | VARCHAR(20) | NO | `'CONFIRMED'` | CHECK (`status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW')`) | Lifecycle status |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | None | Booking timestamp |
| `checked_in_at` | TIMESTAMPTZ | YES | NULL | CHECK (`checked_in_at >= slot_start` or NULL) | Arrival check-in timestamp |
| `vehicle_id` | INT | NO | None | FK $\rightarrow$ `vehicles(vehicle_id)` | Vehicle booked (resolves user via 3NF) |
| `charger_id` | INT | YES | NULL | FK $\rightarrow$ `chargers(charger_id)` | Booked charger bay (nullable if displaced) |

*Table-Level Constraints:*
- `CHECK (slot_end > slot_start)`
- `EXCLUDE USING gist (charger_id WITH =, tstzrange(slot_start, slot_end, '[)') WITH &&) WHERE (status IN ('CONFIRMED', 'ACTIVE') AND charger_id IS NOT NULL)`

---

## Table 13: `waiting_queue_entries`
Platform Dynamic Station Waiting Queue.

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `queue_id` | SERIAL | NO | auto | PRIMARY KEY | Unique queue entry ID |
| `join_time` | TIMESTAMPTZ | NO | `NOW()` | None | Queue join timestamp |
| `status` | VARCHAR(20) | NO | `'WAITING'` | CHECK (`status IN ('WAITING', 'ASSIGNED', 'SERVED', 'CANCELLED')`) | Queue entry status |
| `offer_expires_at` | TIMESTAMPTZ | YES | NULL | CHECK (`offer_expires_at > join_time` or NULL) | Offer response deadline |
| `station_id` | INT | NO | None | FK $\rightarrow$ `stations(station_id)` | Station where vehicle is queued |
| `vehicle_id` | INT | NO | None | FK $\rightarrow$ `vehicles(vehicle_id)` | Queued vehicle (resolves category priority) |
| `reservation_id` | INT | YES | NULL | UNIQUE, FK $\rightarrow$ `reservations(reservation_id)` | Displaced reservation link (1:0..1) |

---

## Table 14: `charging_sessions`
Platform Dynamic Physical Energy Telemetry.

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `session_id` | SERIAL | NO | auto | PRIMARY KEY | Unique session ID |
| `start_time` | TIMESTAMPTZ | NO | None | None | Plug-in start timestamp |
| `end_time` | TIMESTAMPTZ | YES | NULL | None | Unplug end timestamp |
| `energy_kwh` | DECIMAL(7,2) | NO | 0.00 | CHECK (`energy_kwh >= 0`) | Total energy delivered |
| `tariff_applied` | DECIMAL(6,2) | NO | None | CHECK (`tariff_applied >= 0`) | Rate per kWh applied at session start |
| `end_reason` | VARCHAR(20) | YES | NULL | None | Termination reason (`NORMAL_STOP`, `EMERGENCY`) |
| `reservation_id` | INT | NO | None | UNIQUE, FK $\rightarrow$ `reservations(reservation_id)` | 1:1 linked reservation |

*Note on 3NF:* Cost is omitted from storage and dynamically calculated as `ROUND(energy_kwh * tariff_applied, 2)` via `v_charging_session_cost`.

---

## Table 15: `payments`
Platform Dynamic Financial Ledger.

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `payment_id` | SERIAL | NO | auto | PRIMARY KEY | Unique payment ledger record ID |
| `amount` | DECIMAL(9,2) | NO | None | CHECK (`amount >= 0`) | Monetary amount charged in INR |
| `status` | VARCHAR(20) | NO | `'PENDING'` | CHECK (`status IN ('PENDING', 'SUCCESS', 'FAILED')`) | Settlement status |
| `paid_at` | TIMESTAMPTZ | YES | NULL | None | Completion timestamp |
| `attempts` | INT | NO | 0 | CHECK (`attempts >= 0`) | Number of payment gateway retries |
| `session_id` | INT | NO | None | UNIQUE, FK $\rightarrow$ `charging_sessions(session_id)` | 1:1 linked charging session |

---

## Table 16: `notifications`
Platform Dynamic User Alert Stream.

| Column Name | Data Type | Nullable | Default | Constraints | Description |
|---|---|---|---|---|---|
| `notification_id` | SERIAL | NO | auto | PRIMARY KEY | Unique notification ID |
| `type` | VARCHAR(30) | NO | None | None | Alert category (`BOOKING_CONFIRMED`, etc.) |
| `message` | VARCHAR(500) | NO | None | None | Notification text body |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | None | Dispatch timestamp |
| `delivered_at` | TIMESTAMPTZ | YES | NULL | None | Delivery confirmation timestamp |
| `user_id` | INT | NO | None | FK $\rightarrow$ `users(user_id)` | Target recipient user |

