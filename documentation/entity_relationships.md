# EV Charging Station Network Orchestrator
## Functional Dependencies and BCNF Analysis – Version 3

## 1. Introduction

Functional Dependencies (FDs) describe the relationship between attributes in a relational database.

A functional dependency `X → Y` means that the value of attribute set X uniquely determines the value of attribute set Y.

This document identifies the functional dependencies for all 16 relations in the EV Charging Station Network Orchestrator database and verifies their compliance with Boyce-Codd Normal Form (BCNF).

### BCNF Condition

A relation is in BCNF if, for every non-trivial functional dependency:

`X → Y`

X must be a superkey of that relation.

A candidate key is a minimal superkey that uniquely identifies every tuple in a relation.

### Notation

- `PK` – Primary Key
- `FK` – Foreign Key
- `UK` – Unique Key
- `X+` – Attribute closure of X
- `→` – Functionally determines

---

# 2. Functional Dependencies of Each Relation

## 2.1 USER

**Attributes:**

`USER(user_id, name, email, password_hash, role, created_at, latitude, longitude)`

**Functional Dependencies:**

1. `user_id → name, email, password_hash, role, created_at, latitude, longitude`
2. `email → user_id, name, password_hash, role, created_at, latitude, longitude`

**Candidate Keys:**

- `user_id` (Primary Key)
- `email` (Unique Key, assuming NOT NULL)

**Attribute Closure:**

Using the first FD:

`user_id+ = {user_id, name, email, password_hash, role, created_at, latitude, longitude}`

Using the second FD:

`email+ = {email, user_id, name, password_hash, role, created_at, latitude, longitude}`

Both closures contain all attributes of USER.

**BCNF Verification:** Satisfied. Both determinants are candidate keys.

---

## 2.2 OPERATOR

**Attributes:**

`OPERATOR(user_id, station_id)`

**Functional Dependencies:**

1. `user_id → station_id`
2. `station_id → user_id`

**Candidate Keys:**

- `user_id` (Primary Key and Foreign Key)
- `station_id` (Unique Foreign Key)

**Attribute Closure:**

`user_id+ = {user_id, station_id}`

`station_id+ = {station_id, user_id}`

Both closures contain all attributes.

**BCNF Verification:** Satisfied. Both determinants are candidate keys.

---

## 2.3 STATION

**Attributes (as represented in the ER diagram):**

`STATION(station_id, source_id, name, address, town_id, state_id, postcode, latitude, longitude, usage_type, tariff_per_kwh, status, network_id)`

**Functional Dependencies:**

1. `station_id → source_id, name, address, town_id, state_id, postcode, latitude, longitude, usage_type, tariff_per_kwh, status, network_id`
2. `source_id → station_id, name, address, town_id, state_id, postcode, latitude, longitude, usage_type, tariff_per_kwh, status, network_id` (when source_id is NOT NULL and unique)

**Candidate Keys:**

- `station_id` (Primary Key)
- `source_id` (Conditional alternate identifier; UNIQUE and nullable)

**Attribute Closure:**

`station_id+ = {all attributes of STATION}`

`source_id+ = {all attributes of STATION}` for non-NULL source IDs.

**BCNF Verification:** Satisfied based on the declared dependencies. The nullable UNIQUE column is not a formal candidate key for the entire relation unless its NULL behavior is restricted appropriately.

---

## 2.4 CHARGER

**Attributes:**

`CHARGER(charger_id, label, power_kw, status, station_id, connector_type_id)`

**Functional Dependencies:**

1. `charger_id → label, power_kw, status, station_id, connector_type_id`

2. `(station_id, label) → charger_id, power_kw, status, connector_type_id` (only if the composite UNIQUE constraint is enforced)

**Candidate Keys:**

- `charger_id` (Primary Key)
- `(station_id, label)` (Conditional alternate candidate key)

**Attribute Closure:**

Using the primary key:

`charger_id+ = {charger_id, label, power_kw, status, station_id, connector_type_id}`

Using the composite key:

`(station_id, label)+ = {station_id, label, charger_id, power_kw, status, connector_type_id}`

Both closures contain all attributes, provided the composite uniqueness rule holds.

**BCNF Verification:** Satisfied based on the primary key. The second dependency requires an enforced composite UNIQUE constraint.

---

## 2.5 CONNECTOR_TYPE

**Attributes:**

`CONNECTOR_TYPE(connector_type_id, code, description, current_type)`

**Functional Dependencies:**

1. `connector_type_id → code, description, current_type`
2. `code → connector_type_id, description, current_type`

**Candidate Keys:**

- `connector_type_id` (Primary Key)
- `code` (Unique Key)

**Attribute Closure:**

`connector_type_id+ = {connector_type_id, code, description, current_type}`

`code+ = {code, connector_type_id, description, current_type}`

Both closures contain all attributes.

**BCNF Verification:** Satisfied. Both determinants are candidate keys.

---

## 2.6 CHARGING_NETWORK

**Attributes:**

`CHARGING_NETWORK(network_id, name)`

**Functional Dependencies:**

1. `network_id → name`
2. `name → network_id`

**Candidate Keys:**

- `network_id` (Primary Key)
- `name` (Unique Key)

**Attribute Closure:**

`network_id+ = {network_id, name}`

`name+ = {name, network_id}`

Both closures contain all attributes.

**BCNF Verification:** Satisfied. Both determinants are candidate keys.

---

## 2.7 VEHICLE

**Attributes:**

`VEHICLE(vehicle_id, registration_no, user_id, category_id)`

**Functional Dependencies:**

1. `vehicle_id → registration_no, user_id, category_id`
2. `registration_no → vehicle_id, user_id, category_id` (when registration_no is NOT NULL and unique)

**Candidate Keys:**

- `vehicle_id` (Primary Key)
- `registration_no` (Conditional alternate identifier; UNIQUE and nullable)

**Attribute Closure:**

`vehicle_id+ = {vehicle_id, registration_no, user_id, category_id}`

`registration_no+ = {registration_no, vehicle_id, user_id, category_id}` for non-NULL registration numbers.

**BCNF Verification:** Satisfied based on the primary key and conditional alternate identifier.

---

## 2.8 VEHICLE_CATEGORY

**Attributes:**

`VEHICLE_CATEGORY(category_id, code, queue_rank)`

**Functional Dependencies:**

1. `category_id → code, queue_rank`
2. `code → category_id, queue_rank`

**Candidate Keys:**

- `category_id` (Primary Key)
- `code` (Unique Key)

**Attribute Closure:**

`category_id+ = {category_id, code, queue_rank}`

`code+ = {code, category_id, queue_rank}`

Both closures contain all attributes.

**BCNF Verification:** Satisfied. Both determinants are candidate keys.

---

## 2.9 VEHICLE_CONNECTOR

**Attributes:**

`VEHICLE_CONNECTOR(vehicle_id, connector_type_id)`

**Functional Dependencies:**

1. `(vehicle_id, connector_type_id) → vehicle_id, connector_type_id`

The composite primary key uniquely identifies each vehicle-connector combination.

**Candidate Key:**

- `(vehicle_id, connector_type_id)` (Composite Primary Key)

**Attribute Closure:**

`(vehicle_id, connector_type_id)+ = {vehicle_id, connector_type_id}`

There are no additional non-key attributes in this relation.

**BCNF Verification:** Satisfied. There is no non-trivial functional dependency with a non-superkey determinant.

---

## 2.10 RESERVATION

**Attributes:**

`RESERVATION(reservation_id, booking_code, slot_start, slot_end, status, created_at, checked_in_at, vehicle_id, charger_id)`

**Functional Dependencies:**

1. `reservation_id → booking_code, slot_start, slot_end, status, created_at, checked_in_at, vehicle_id, charger_id`
2. `booking_code → reservation_id, slot_start, slot_end, status, created_at, checked_in_at, vehicle_id, charger_id`

**Candidate Keys:**

- `reservation_id` (Primary Key)
- `booking_code` (Unique Key)

**Attribute Closure:**

`reservation_id+ = {all attributes of RESERVATION}`

`booking_code+ = {all attributes of RESERVATION}`

Both closures contain all attributes.

**BCNF Verification:** Satisfied. Both determinants are candidate keys.

---

## 2.11 CHARGING_SESSION

**Attributes:**

`CHARGING_SESSION(session_id, start_time, end_time, energy_kwh, tariff_applied, cost, end_reason, reservation_id)`

**Functional Dependencies:**

1. `session_id → start_time, end_time, energy_kwh, tariff_applied, cost, end_reason, reservation_id`
2. `reservation_id → session_id, start_time, end_time, energy_kwh, tariff_applied, cost, end_reason` (when reservation_id is NOT NULL and unique)

**Candidate Keys:**

- `session_id` (Primary Key)
- `reservation_id` (Conditional alternate identifier; UNIQUE and nullable)

**Attribute Closure:**

`session_id+ = {all attributes of CHARGING_SESSION}`

`reservation_id+ = {all attributes of CHARGING_SESSION}` for non-NULL reservation IDs.

**BCNF Verification:** Satisfied based on the declared dependencies.

**Note:** `tariff_applied` is stored as a historical tariff snapshot. The `cost` is derived from energy consumed and the applied tariff. Storing these values does not automatically create a BCNF violation.

---

## 2.12 PAYMENT

**Attributes:**

`PAYMENT(payment_id, amount, status, paid_at, attempts, session_id)`

**Functional Dependencies:**

1. `payment_id → amount, status, paid_at, attempts, session_id`
2. `session_id → payment_id, amount, status, paid_at, attempts` (when session_id is NOT NULL and unique)

**Candidate Keys:**

- `payment_id` (Primary Key)
- `session_id` (Conditional alternate identifier; UNIQUE and nullable)

**Attribute Closure:**

`payment_id+ = {payment_id, amount, status, paid_at, attempts, session_id}`

`session_id+ = {session_id, payment_id, amount, status, paid_at, attempts}` for non-NULL session IDs.

Both closures contain all attributes for the identified rows.

**BCNF Verification:** Satisfied based on the declared dependencies.

**Note:** The payment amount is maintained as a billing snapshot. Its presence does not independently create a BCNF violation.

---

## 2.13 WAITING_QUEUE_ENTRY

**Attributes:**

`WAITING_QUEUE_ENTRY(queue_id, priority_class, join_time, status, offer_expires_at, station_id, vehicle_id, reservation_id)`

**Functional Dependencies:**

1. `queue_id → priority_class, join_time, status, offer_expires_at, station_id, vehicle_id, reservation_id`
2. `reservation_id → queue_id, priority_class, join_time, status, offer_expires_at, station_id, vehicle_id` (when reservation_id is NOT NULL and unique)

**Candidate Keys:**

- `queue_id` (Primary Key)
- `reservation_id` (Conditional alternate identifier; UNIQUE and nullable)

**Attribute Closure:**

`queue_id+ = {all attributes of WAITING_QUEUE_ENTRY}`

`reservation_id+ = {all attributes of WAITING_QUEUE_ENTRY}` for non-NULL reservation IDs.

**BCNF Verification:** Satisfied based on the declared dependencies.

**Additional Consistency Rule:**

When `reservation_id` is populated, the queue entry's `vehicle_id` and `station_id` must match the vehicle and station associated with the displaced reservation.

This is a cross-table consistency requirement and must be enforced separately.

---

## 2.14 NOTIFICATION

**Attributes:**

`NOTIFICATION(notification_id, type, message, created_at, delivered_at, user_id)`

**Functional Dependencies:**

1. `notification_id → type, message, created_at, delivered_at, user_id`

**Candidate Key:**

- `notification_id` (Primary Key)

**Attribute Closure:**

`notification_id+ = {notification_id, type, message, created_at, delivered_at, user_id}`

The closure contains all attributes.

**BCNF Verification:** Satisfied. The determinant is a candidate key.

---

## 2.15 TOWN

**Attributes (as represented in the ER diagram):**

`TOWN(town_id, name)`

**Functional Dependencies:**

1. `town_id → name`

**Candidate Key:**

- `town_id` (Primary Key)

**Attribute Closure:**

`town_id+ = {town_id, name}`

The closure contains all attributes.

**BCNF Verification:** Satisfied based on the identified dependency.

---

## 2.16 STATE

**Attributes (as represented in the ER diagram):**

`STATE(state_id, name)`

**Functional Dependencies:**

1. `state_id → name`

**Candidate Key:**

- `state_id` (Primary Key)

**Attribute Closure:**

`state_id+ = {state_id, name}`

The closure contains all attributes.

**BCNF Verification:** Satisfied based on the identified dependency.

---

# 3. Summary of Functional Dependencies and BCNF Verification

| No. | Relation | Primary Key | Other Declared Unique Attributes / Keys | BCNF Status |
|---|---|---|---|---|
| 1 | USER | user_id | email | Satisfied |
| 2 | OPERATOR | user_id | station_id | Satisfied |
| 3 | STATION | station_id | source_id (nullable) | Satisfied |
| 4 | CHARGER | charger_id | (station_id, label), if enforced | Satisfied |
| 5 | CONNECTOR_TYPE | connector_type_id | code | Satisfied |
| 6 | CHARGING_NETWORK | network_id | name | Satisfied |
| 7 | VEHICLE | vehicle_id | registration_no (nullable) | Satisfied |
| 8 | VEHICLE_CATEGORY | category_id | code | Satisfied |
| 9 | VEHICLE_CONNECTOR | vehicle_id, connector_type_id | None | Satisfied |
| 10 | RESERVATION | reservation_id | booking_code | Satisfied |
| 11 | CHARGING_SESSION | session_id | reservation_id (nullable) | Satisfied |
| 12 | PAYMENT | payment_id | session_id (nullable) | Satisfied |
| 13 | WAITING_QUEUE_ENTRY | queue_id | reservation_id (nullable) | Satisfied |
| 14 | NOTIFICATION | notification_id | None | Satisfied |
| 15 | TOWN | town_id | None shown | Satisfied |
| 16 | STATE | state_id | None shown | Satisfied |

---

# 4. Important Cross-Table Business Rules

The following rules maintain consistency between related relations. They are not automatically BCNF violations because BCNF evaluates functional dependencies within individual relations.

1. **USER and OPERATOR:** An OPERATOR record exists only for a user whose role is OPERATOR. Each operator manages exactly one station, and each station has exactly one operator, according to the ERD design.

2. **CHARGING_SESSION and PAYMENT:** PAYMENT stores the billing amount associated with a charging session. The amount is maintained as a billing snapshot.

3. **CHARGING_SESSION and STATION:** The tariff applied to a charging session is stored as a historical snapshot so that subsequent tariff changes do not alter previous billing calculations.

4. **WAITING_QUEUE_ENTRY and RESERVATION:** When a queue entry references a displaced reservation, its vehicle and station must match the referenced reservation.

5. **VEHICLE_CONNECTOR:** This junction relation records the connector types compatible with each vehicle.

These rules should be enforced through appropriate database constraints, triggers, or application-level validation.

---

# 5. Final BCNF Conclusion

The functional dependencies identified for the EV Charging Station Network Orchestrator were examined relation by relation.

For each relation, attribute closures were calculated to determine whether the determinants of the non-trivial functional dependencies are superkeys.

The primary keys determine all other attributes in their respective relations. The declared alternate unique keys also determine the remaining attributes where their uniqueness and non-NULL conditions are satisfied.

The composite primary key of VEHICLE_CONNECTOR uniquely identifies each vehicle-connector combination.

Therefore, **based on the functional dependencies and uniqueness constraints identified in this design, no definite BCNF violation has been demonstrated.**

The final BCNF claim is subject to verification of all business-rule dependencies, nullable UNIQUE columns, and the composite uniqueness constraint proposed for CHARGER.

---

# 6. Additional Schema Consistency Note

The current ER diagram contains 16 entities, whereas the supplied relational schema illustration displays 14 tables.

The TOWN and STATE relations must be added to the relational schema illustration.

The STATION attributes should also be made consistent between the diagrams. The ER diagram uses `town_id` and `state_id`, while the relational illustration currently displays `town` and `state` as text attributes.

The final relational schema and SQL implementation should use the same attribute names, data types, primary keys, foreign keys, and unique constraints.

