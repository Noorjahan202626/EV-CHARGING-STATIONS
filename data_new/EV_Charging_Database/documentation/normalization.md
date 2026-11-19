# Database Normalization Report: 3NF Implementation

## 1. Normalization Foundations (1NF, 2NF, 3NF)

The database schema strictly adheres to Third Normal Form (3NF) principles across all 16 entities:

1. **First Normal Form (1NF)**:
   - All attributes are atomic (single-valued scalar values).
   - Multi-valued connector compatibility is moved out of `vehicles` into the dedicated junction table `vehicle_connector_compatibility`.
   - All tables define explicit, immutable primary keys.
2. **Second Normal Form (2NF)**:
   - Every non-key attribute is fully functionally dependent on the entire primary key.
   - In composite-key tables such as `vehicle_connector_compatibility(vehicle_id, connector_type_id)`, no partial dependencies exist.
3. **Third Normal Form (3NF)**:
   - No non-prime attribute depends transitively on the primary key via another non-prime attribute.
   - Derived attributes and redundant functional paths are systematically removed.

---

## 2. Four Core Normalization Decisions (Revised V3 Specification)

### Decision A: Elimination of Stored Cost in `charging_sessions`

- **Violation Avoided**:
  If `cost` were persisted in `charging_sessions`, it would create a derived functional dependency:
  $$\text{cost} = \text{energy\_kwh} \times \text{tariff\_applied}$$
  Any update to `energy_kwh` or tariff correction would risk update anomalies, leading to desynchronized data.
- **3NF Resolution**:
  The `cost` attribute is **not** stored in `charging_sessions`.
  Instead, the database dynamically calculates the billing cost using the view **`v_charging_session_cost`**:
  ```sql
  CREATE OR REPLACE VIEW v_charging_session_cost AS
  SELECT
      cs.session_id,
      cs.reservation_id,
      r.booking_code,
      cs.energy_kwh,
      cs.tariff_applied,
      ROUND(cs.energy_kwh * cs.tariff_applied, 2) AS cost
  FROM charging_sessions cs
  JOIN reservations r ON r.reservation_id = cs.reservation_id;
  ```

---

### Decision B: Retention of `payment.amount` as a Financial Snapshot

- **Architectural Rationale**:
  While `charging_sessions` computes physical cost dynamically, the `payments` table represents an immutable, legally binding financial ledger entry.
- **Why Retain `amount`**:
  - Payment transactions are finalized through payment gateways (e.g. Razorpay, UPI) at a fixed point in time.
  - If tariffs, rounding rules, or dispute adjustments occur later in the platform lifecycle, the historical payment amount must remain frozen as recorded by the banking gateway.
  - Preserving `payments.amount` satisfies financial auditing, tax compliance, and double-entry accounting standards without violating 3NF, because it records the actual monetary sum exchanged during that specific payment transaction.

---

### Decision C: Normalized Hierarchical Location Structure (Town & State)

- **Violation Avoided**:
  Flattening state names or postal boundaries into a combined `location` or denormalized `station` table introduces extensive transitive redundancy:
  $$\text{station} \rightarrow \text{town} \rightarrow \text{state}$$
- **3NF Resolution**:
  Separate, normalized `states` and `towns` tables are maintained:
  - `states (state_id, name)`
  - `towns (town_id, name, state_id REFERENCES states)`
  - `stations` holds a foreign key `town_id REFERENCES towns` (nullable for fallback placeholder towns).
  - No bloated or superfluous `location` table is created.

---

### Decision D: Elimination of Stored `priority_class` in `waiting_queue_entries`

- **Violation Avoided**:
  Storing `priority_class` in `waiting_queue_entries` introduces a transitive dependency:
  $$\text{waiting\_queue\_entry} \rightarrow \text{vehicle} \rightarrow \text{vehicle\_category} \rightarrow \text{priority\_class}$$
  If a vehicle category's priority policy changes (e.g., heavy transport promoted during transit emergencies), redundant values stored across thousands of queue rows would become inconsistent.
- **3NF Resolution**:
  `priority_class` is **not** stored in `waiting_queue_entries`.
  Priority dispatch is dynamically resolved through the view **`v_queue_priority`**:
  ```sql
  CREATE OR REPLACE VIEW v_queue_priority AS
  SELECT
      wqe.queue_id,
      wqe.station_id,
      st.name AS station_name,
      v.registration_no,
      vc.code AS vehicle_category_code,
      vc.queue_rank AS priority_rank,
      wqe.join_time,
      wqe.status
  FROM waiting_queue_entries wqe
  JOIN stations st ON st.station_id = wqe.station_id
  JOIN vehicles v ON v.vehicle_id = wqe.vehicle_id
  JOIN vehicle_categories vc ON vc.category_id = v.category_id
  ORDER BY wqe.station_id, vc.queue_rank ASC, wqe.join_time ASC;
  ```

---

## 3. Supplementary Normalization View: `v_charger_connector`

To eliminate the need for application-side multi-table joins when searching for compatible charging bays, the normalized schema provides **`v_charger_connector`**:
- Joins: `chargers` $\rightarrow$ `connector_types` $\rightarrow$ `stations` $\rightarrow$ `towns` $\rightarrow$ `states` $\rightarrow$ `charging_networks`.
- Allows EV routing and driver reservation workflows to query power ratings, connector plug types, real-time bay status, and station coordinates in a single performant SELECT query.

