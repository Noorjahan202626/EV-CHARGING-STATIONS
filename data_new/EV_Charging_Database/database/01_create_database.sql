-- ============================================================
-- FILE: 01_create_database.sql
-- PROJECT: EV Charging Station Network Orchestrator
-- DESCRIPTION: Creates the PostgreSQL database and initial extensions
-- ============================================================

-- Step 1: Connect to the default 'postgres' database in pgAdmin 4 or psql
--         then run the command below to create the project database.

CREATE DATABASE ev_charging_orchestrator
    WITH
    OWNER      = postgres
    ENCODING   = 'UTF8'
    LC_COLLATE = 'C'
    LC_CTYPE   = 'C'
    CONNECTION LIMIT = -1;

COMMENT ON DATABASE ev_charging_orchestrator
    IS 'EV Charging Station Network Orchestrator - Revised V3 Database';

-- Step 2: Disconnect from 'postgres' and connect to 'ev_charging_orchestrator'
--         then execute the extension initialization commands below:

-- btree_gist extension is required for GiST exclusion constraints
-- (prevents overlapping reservation time intervals on the same charger)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- pgcrypto extension provides secure password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- uuid-ossp provides UUID generator functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

