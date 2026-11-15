-- ============================================================
-- FILE: 02_create_tables.sql
-- PROJECT: EV Charging Station Network Orchestrator
-- DESCRIPTION: Creates all 16 tables in dependency order,
--              matching the Revised V3 relational schema and
--              the predefined EV dataset column specifications.
-- Run AFTER: 01_create_database.sql
-- ============================================================

-- Safe teardown for recreation
DROP VIEW IF EXISTS notification CASCADE;
DROP VIEW IF EXISTS payment CASCADE;
DROP VIEW IF EXISTS charging_session CASCADE;
DROP VIEW IF EXISTS waiting_queue_entry CASCADE;
DROP VIEW IF EXISTS reservation CASCADE;
DROP VIEW IF EXISTS vehicle_connector CASCADE;
DROP VIEW IF EXISTS vehicle CASCADE;
DROP VIEW IF EXISTS operator CASCADE;
DROP VIEW IF EXISTS "user" CASCADE;
DROP VIEW IF EXISTS charger CASCADE;
DROP VIEW IF EXISTS station CASCADE;
DROP VIEW IF EXISTS connector_type CASCADE;
DROP VIEW IF EXISTS vehicle_category CASCADE;
DROP VIEW IF EXISTS charging_network CASCADE;
DROP VIEW IF EXISTS town CASCADE;
DROP VIEW IF EXISTS state CASCADE;

DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS charging_sessions CASCADE;
DROP TABLE IF EXISTS waiting_queue_entries CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS vehicle_connector_compatibility CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS operators CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS chargers CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS connector_types CASCADE;
DROP TABLE IF EXISTS vehicle_categories CASCADE;
DROP TABLE IF EXISTS charging_networks CASCADE;
DROP TABLE IF EXISTS towns CASCADE;
DROP TABLE IF EXISTS states CASCADE;

-- ============================================================
-- 1. STATES
-- Predefined data: state.csv (1 record)
-- ============================================================
CREATE TABLE states (
    state_id   SERIAL       PRIMARY KEY,
    name       VARCHAR(80)  NOT NULL UNIQUE
);

COMMENT ON TABLE  states          IS 'Indian states and union territories (predefined dataset: state.csv)';
COMMENT ON COLUMN states.state_id IS 'Primary key for state';
COMMENT ON COLUMN states.name     IS 'Unique state name';

-- ============================================================
-- 2. TOWNS
-- Predefined data: town.csv (415 records)
-- 3NF: town -> state hierarchy maintained via state_id FK
-- ============================================================
CREATE TABLE towns (
    town_id    SERIAL       PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    state_id   INT          NOT NULL
        REFERENCES states (state_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uq_town_name_state UNIQUE (name, state_id)
);

COMMENT ON TABLE  towns          IS 'Towns and cities within states (predefined dataset: town.csv)';
COMMENT ON COLUMN towns.town_id  IS 'Primary key for town';
COMMENT ON COLUMN towns.name     IS 'Town name';
COMMENT ON COLUMN towns.state_id IS 'Foreign key to states table';

-- ============================================================
-- 3. CHARGING NETWORKS
-- Predefined data: charging_network.csv (30 records)
-- ============================================================
CREATE TABLE charging_networks (
    network_id  SERIAL       PRIMARY KEY,
    name        VARCHAR(80)  NOT NULL UNIQUE
);

COMMENT ON TABLE  charging_networks            IS 'EV charging network operators (predefined dataset: charging_network.csv)';
COMMENT ON COLUMN charging_networks.network_id IS 'Primary key for charging network';
COMMENT ON COLUMN charging_networks.name       IS 'Unique name of the charging network';

-- ============================================================
-- 4. VEHICLE CATEGORIES
-- Predefined data: vehicle_category.csv (5 records)
-- ============================================================
CREATE TABLE vehicle_categories (
    category_id  SERIAL      PRIMARY KEY,
    code         VARCHAR(20) NOT NULL UNIQUE,  -- e.g. EM, 4W, 3W, 2W, HV
    queue_rank   INT         NOT NULL          -- 1 = Emergency (highest), 5 = HV
        CHECK (queue_rank > 0)
);

COMMENT ON TABLE  vehicle_categories             IS 'Vehicle categories determining queue priority (predefined dataset)';
COMMENT ON COLUMN vehicle_categories.category_id IS 'Primary key for vehicle category';
COMMENT ON COLUMN vehicle_categories.code        IS 'Category code (EM, 4W, 3W, 2W, HV)';
COMMENT ON COLUMN vehicle_categories.queue_rank  IS 'Queue priority rank (lower number = higher priority)';

-- ============================================================
-- 5. CONNECTOR TYPES
-- Predefined data: connector_type.csv (7 records)
-- ============================================================
CREATE TABLE connector_types (
    connector_type_id SERIAL       PRIMARY KEY,
    code              VARCHAR(20)  NOT NULL UNIQUE,  -- e.g. CCS2, CHADEMO, TYPE2_AC
    description       VARCHAR(100),
    current_type      VARCHAR(2)   NOT NULL
        CHECK (current_type IN ('AC', 'DC'))
);

COMMENT ON TABLE  connector_types                   IS 'EV connector standards (predefined dataset: connector_type.csv)';
COMMENT ON COLUMN connector_types.connector_type_id IS 'Primary key for connector type';
COMMENT ON COLUMN connector_types.code              IS 'Unique connector standard code';
COMMENT ON COLUMN connector_types.description       IS 'Description of connector standard';
COMMENT ON COLUMN connector_types.current_type      IS 'Current type: AC or DC';

-- ============================================================
-- 6. STATIONS
-- Predefined data: station.csv (6,068 records)
-- Note: tariff_per_kwh and status are NULL in the predefined dataset;
-- addresses (34) and postcodes (1495) are nullable.
-- ============================================================
CREATE TABLE stations (
    station_id     SERIAL        PRIMARY KEY,
    name           VARCHAR(150)  NOT NULL,
    address        VARCHAR(250),
    town_id        INT
        REFERENCES towns (town_id) ON DELETE SET NULL ON UPDATE CASCADE,
    postcode       VARCHAR(15),
    latitude       DECIMAL(9,6)
        CHECK (latitude BETWEEN -90 AND 90),
    longitude      DECIMAL(9,6)
        CHECK (longitude BETWEEN -180 AND 180),
    usage_type     VARCHAR(60),
    tariff_per_kwh DECIMAL(6,2)
        CHECK (tariff_per_kwh >= 0),
    status         VARCHAR(40)
        CHECK (status IS NULL OR status IN ('ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE', 'OPERATIONAL', 'Active', 'Inactive', 'Under Maintenance', 'Operational')),
    network_id     INT
        REFERENCES charging_networks (network_id) ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE  stations                IS 'Physical EV charging stations (predefined dataset: station.csv, 6068 rows)';
COMMENT ON COLUMN stations.station_id     IS 'Primary key for station';
COMMENT ON COLUMN stations.name           IS 'Display name of the charging station';
COMMENT ON COLUMN stations.address        IS 'Physical address (nullable: 34 records missing in dataset)';
COMMENT ON COLUMN stations.postcode       IS 'Postal code (nullable: 1495 records missing in dataset)';
COMMENT ON COLUMN stations.tariff_per_kwh IS 'Tariff per kWh in INR (nullable: empty in dataset)';
COMMENT ON COLUMN stations.status         IS 'Operational status (nullable: empty in dataset)';

-- ============================================================
-- 7. CHARGERS
-- Predefined data: charger.csv (8,501 records)
-- ============================================================
CREATE TABLE chargers (
    charger_id        SERIAL       PRIMARY KEY,
    label             VARCHAR(20)  NOT NULL,
    power_kw          DECIMAL(6,1) NOT NULL
        CHECK (power_kw > 0),
    status            VARCHAR(15)  NOT NULL DEFAULT 'AVAILABLE'
        CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'FAULT', 'OFFLINE', 'Available', 'Occupied', 'Fault', 'Offline')),
    station_id        INT          NOT NULL
        REFERENCES stations (station_id) ON DELETE CASCADE ON UPDATE CASCADE,
    connector_type_id INT          NOT NULL
        REFERENCES connector_types (connector_type_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uq_charger_label_per_station UNIQUE (station_id, label)
);

COMMENT ON TABLE  chargers                   IS 'Individual chargers installed at stations (predefined dataset: charger.csv, 8501 rows)';
COMMENT ON COLUMN chargers.charger_id        IS 'Primary key for charger';
COMMENT ON COLUMN chargers.label             IS 'Charger bay label (e.g. P001, P002); unique per station';
COMMENT ON COLUMN chargers.power_kw          IS 'Power rating in kW; must be strictly positive';
COMMENT ON COLUMN chargers.status            IS 'Operational status: AVAILABLE, OCCUPIED, FAULT, OFFLINE';
COMMENT ON COLUMN chargers.station_id        IS 'Foreign key referencing parent station';
COMMENT ON COLUMN chargers.connector_type_id IS 'Foreign key referencing fitted connector standard';

-- ============================================================
-- 8. USERS
-- Registered platform users (EV owners, station operators, admins)
-- ============================================================
CREATE TABLE users (
    user_id       SERIAL       PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(10)  NOT NULL DEFAULT 'USER'
        CHECK (role IN ('USER', 'OPERATOR', 'ADMIN', 'user', 'operator', 'admin')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    latitude      DECIMAL(9,6)
        CHECK (latitude BETWEEN -90 AND 90),
    longitude     DECIMAL(9,6)
        CHECK (longitude BETWEEN -180 AND 180)
);

COMMENT ON TABLE  users               IS 'Registered platform users: EV owners, operators, and administrators';
COMMENT ON COLUMN users.user_id       IS 'Primary key for user';
COMMENT ON COLUMN users.email         IS 'Unique user email address';
COMMENT ON COLUMN users.password_hash IS 'Cryptographic hash of password';
COMMENT ON COLUMN users.role          IS 'Platform role: USER, OPERATOR, or ADMIN';

-- ============================================================
-- 9. OPERATORS
-- 1:0..1 with users (PK is user_id), 1:1 with station (station_id UNIQUE)
-- ============================================================
CREATE TABLE operators (
    user_id    INT PRIMARY KEY
        REFERENCES users (user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    station_id INT NOT NULL UNIQUE
        REFERENCES stations (station_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

COMMENT ON TABLE  operators            IS 'Station operators: exactly one station per operator, 1:1 constraint';
COMMENT ON COLUMN operators.user_id    IS 'Primary key & Foreign key referencing users table (1:0..1)';
COMMENT ON COLUMN operators.station_id IS 'Foreign key referencing managed station (UNIQUE enforces 1:1)';

-- ============================================================
-- 10. VEHICLES
-- Registered electric vehicles owned by users
-- ============================================================
CREATE TABLE vehicles (
    vehicle_id           SERIAL       PRIMARY KEY,
    registration_no      VARCHAR(15)  UNIQUE,       -- unique when provided, nullable
    user_id              INT          NOT NULL
        REFERENCES users (user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    category_id          INT          NOT NULL
        REFERENCES vehicle_categories (category_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

COMMENT ON TABLE  vehicles                      IS 'Electric vehicles owned by registered users';
COMMENT ON COLUMN vehicles.vehicle_id           IS 'Primary key for vehicle';
COMMENT ON COLUMN vehicles.registration_no      IS 'Vehicle registration number (unique when present)';
COMMENT ON COLUMN vehicles.user_id              IS 'Foreign key referencing vehicle owner in users table';
COMMENT ON COLUMN vehicles.category_id          IS 'Foreign key referencing vehicle category (drives queue rank)';

-- ============================================================
-- 11. VEHICLE_CONNECTOR_COMPATIBILITY
-- M:N junction table between vehicles and connector types
-- ============================================================
CREATE TABLE vehicle_connector_compatibility (
    vehicle_id        INT NOT NULL
        REFERENCES vehicles (vehicle_id) ON DELETE CASCADE ON UPDATE CASCADE,
    connector_type_id INT NOT NULL
        REFERENCES connector_types (connector_type_id) ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY (vehicle_id, connector_type_id)
);

COMMENT ON TABLE  vehicle_connector_compatibility                   IS 'M:N junction: connector standards compatible with each vehicle';
COMMENT ON COLUMN vehicle_connector_compatibility.vehicle_id        IS 'Composite PK and FK to vehicles table';
COMMENT ON COLUMN vehicle_connector_compatibility.connector_type_id IS 'Composite PK and FK to connector_types table';

-- ============================================================
-- 12. RESERVATIONS
-- Time-slot bookings. User is resolved through vehicle_id (3NF).
-- ============================================================
CREATE TABLE reservations (
    reservation_id SERIAL       PRIMARY KEY,
    booking_code   VARCHAR(50)  NOT NULL UNIQUE,
    slot_start     TIMESTAMPTZ  NOT NULL,
    slot_end       TIMESTAMPTZ  NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'CONFIRMED'
        CHECK (status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'Confirmed', 'Active', 'Completed', 'Cancelled', 'No-Show')),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    checked_in_at  TIMESTAMPTZ,
    vehicle_id     INT          NOT NULL
        REFERENCES vehicles (vehicle_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    charger_id     INT
        REFERENCES chargers (charger_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_slot_order CHECK (slot_end > slot_start)
);

COMMENT ON TABLE  reservations                IS 'Time-slot bookings for chargers. User resolved via vehicle_id (3NF).';
COMMENT ON COLUMN reservations.reservation_id IS 'Primary key for reservation';
COMMENT ON COLUMN reservations.booking_code   IS 'Unique booking reference';
COMMENT ON COLUMN reservations.slot_start     IS 'Reservation start timestamp';
COMMENT ON COLUMN reservations.slot_end       IS 'Reservation end timestamp (must be > slot_start)';
COMMENT ON COLUMN reservations.status         IS 'Reservation status: CONFIRMED, ACTIVE, COMPLETED, CANCELLED, NO_SHOW';
COMMENT ON COLUMN reservations.vehicle_id     IS 'Foreign key referencing booked vehicle';
COMMENT ON COLUMN reservations.charger_id     IS 'Foreign key referencing booked charger (nullable when displaced)';

-- ============================================================
-- 13. WAITING_QUEUE_ENTRIES
-- Station waiting queue. Priority derived from vehicle category (3NF).
-- ============================================================
CREATE TABLE waiting_queue_entries (
    queue_id         SERIAL       PRIMARY KEY,
    join_time        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    status           VARCHAR(20)  NOT NULL DEFAULT 'WAITING'
        CHECK (status IN ('WAITING', 'ASSIGNED', 'SERVED', 'CANCELLED', 'Waiting', 'Assigned', 'Served', 'Cancelled', 'Notified', 'Allocated', 'Expired', 'Left')),
    offer_expires_at TIMESTAMPTZ,
    station_id       INT          NOT NULL
        REFERENCES stations (station_id) ON DELETE CASCADE ON UPDATE CASCADE,
    vehicle_id       INT          NOT NULL
        REFERENCES vehicles (vehicle_id) ON DELETE CASCADE ON UPDATE CASCADE,
    reservation_id   INT          UNIQUE
        REFERENCES reservations (reservation_id) ON DELETE SET NULL ON UPDATE CASCADE
);

COMMENT ON TABLE  waiting_queue_entries                IS 'Station waiting queue. Priority derived via vehicle category (3NF).';
COMMENT ON COLUMN waiting_queue_entries.queue_id       IS 'Primary key for queue entry';
COMMENT ON COLUMN waiting_queue_entries.station_id     IS 'Foreign key referencing station where vehicle is queued';
COMMENT ON COLUMN waiting_queue_entries.vehicle_id     IS 'Foreign key referencing waiting vehicle';
COMMENT ON COLUMN waiting_queue_entries.reservation_id IS 'Foreign key referencing displaced reservation (1:0..1 UNIQUE)';

-- ============================================================
-- 14. CHARGING_SESSIONS
-- 1:1 with reservation. Cost is calculated, NOT stored (3NF).
-- ============================================================
CREATE TABLE charging_sessions (
    session_id     SERIAL        PRIMARY KEY,
    start_time     TIMESTAMPTZ   NOT NULL,
    end_time       TIMESTAMPTZ,
    energy_kwh     DECIMAL(7,2)  NOT NULL DEFAULT 0
        CHECK (energy_kwh >= 0),
    tariff_applied DECIMAL(6,2)  NOT NULL
        CHECK (tariff_applied >= 0),
    end_reason     VARCHAR(20),
    reservation_id INT           NOT NULL UNIQUE
        REFERENCES reservations (reservation_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

COMMENT ON TABLE  charging_sessions                IS 'Charging session records. Cost derived in view v_charging_session_cost (3NF).';
COMMENT ON COLUMN charging_sessions.session_id     IS 'Primary key for charging session';
COMMENT ON COLUMN charging_sessions.energy_kwh     IS 'Energy delivered in kWh (must be >= 0)';
COMMENT ON COLUMN charging_sessions.tariff_applied IS 'Applied billing tariff in INR/kWh (frozen billing snapshot)';
COMMENT ON COLUMN charging_sessions.reservation_id IS 'Foreign key to reservation (UNIQUE enforces 1:1)';

-- ============================================================
-- 15. PAYMENTS
-- Financial transaction record. Amount retained as snapshot (3NF).
-- ============================================================
CREATE TABLE payments (
    payment_id SERIAL       PRIMARY KEY,
    amount     DECIMAL(9,2) NOT NULL
        CHECK (amount >= 0),
    status     VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'Pending', 'Completed', 'Failed', 'Refunded')),
    paid_at    TIMESTAMPTZ,
    attempts   INT          NOT NULL DEFAULT 0
        CHECK (attempts >= 0),
    session_id INT          NOT NULL UNIQUE
        REFERENCES charging_sessions (session_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

COMMENT ON TABLE  payments            IS 'Payment records. Amount is retained as a financial transaction snapshot (3NF).';
COMMENT ON COLUMN payments.payment_id IS 'Primary key for payment';
COMMENT ON COLUMN payments.amount     IS 'Amount charged in INR (financial snapshot)';
COMMENT ON COLUMN payments.status     IS 'Payment status: PENDING, SUCCESS, FAILED';
COMMENT ON COLUMN payments.session_id IS 'Foreign key to charging session (UNIQUE enforces 1:1)';

-- ============================================================
-- 16. NOTIFICATIONS
-- Notifications delivered to platform users
-- ============================================================
CREATE TABLE notifications (
    notification_id SERIAL       PRIMARY KEY,
    type            VARCHAR(30)  NOT NULL,
    message         VARCHAR(500) NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    delivered_at    TIMESTAMPTZ,
    user_id         INT          NOT NULL
        REFERENCES users (user_id) ON DELETE CASCADE ON UPDATE CASCADE
);

COMMENT ON TABLE  notifications                 IS 'Platform notifications dispatched to users';
COMMENT ON COLUMN notifications.notification_id IS 'Primary key for notification';
COMMENT ON COLUMN notifications.user_id         IS 'Foreign key referencing recipient user';
COMMENT ON COLUMN notifications.type            IS 'Notification category/event type';
COMMENT ON COLUMN notifications.message         IS 'Notification message text';

-- ============================================================
-- BACKWARD-COMPATIBLE SYNONYM VIEWS
-- Allows queries to use either singular or plural table names
-- ============================================================
CREATE OR REPLACE VIEW state AS SELECT * FROM states;
CREATE OR REPLACE VIEW town AS SELECT * FROM towns;
CREATE OR REPLACE VIEW charging_network AS SELECT * FROM charging_networks;
CREATE OR REPLACE VIEW vehicle_category AS SELECT * FROM vehicle_categories;
CREATE OR REPLACE VIEW connector_type AS SELECT * FROM connector_types;
CREATE OR REPLACE VIEW station AS SELECT * FROM stations;
CREATE OR REPLACE VIEW charger AS SELECT * FROM chargers;
CREATE OR REPLACE VIEW "user" AS SELECT * FROM users;
CREATE OR REPLACE VIEW operator AS SELECT * FROM operators;
CREATE OR REPLACE VIEW vehicle AS SELECT * FROM vehicles;
CREATE OR REPLACE VIEW vehicle_connector AS SELECT * FROM vehicle_connector_compatibility;
CREATE OR REPLACE VIEW reservation AS SELECT * FROM reservations;
CREATE OR REPLACE VIEW waiting_queue_entry AS SELECT * FROM waiting_queue_entries;
CREATE OR REPLACE VIEW charging_session AS SELECT * FROM charging_sessions;
CREATE OR REPLACE VIEW payment AS SELECT * FROM payments;
CREATE OR REPLACE VIEW notification AS SELECT * FROM notifications;
