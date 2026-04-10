-- HiveLog Apiary MVP — Supabase Schema
-- Run this in the Supabase SQL Editor to create all tables and RLS policies.

-- Enable pgcrypto for gen_random_uuid() if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- YARDS
-- ============================================================
CREATE TABLE yards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  location_note TEXT,
  hive_count  INTEGER NOT NULL DEFAULT 0,
  address     TEXT,
  county      TEXT,
  state       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE yards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own yards"
  ON yards FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own yards"
  ON yards FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own yards"
  ON yards FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own yards"
  ON yards FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================================
-- COLONIES
-- ============================================================
CREATE TABLE colonies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yard_id     UUID NOT NULL REFERENCES yards(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deadout')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE colonies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view colonies in their yards"
  ON colonies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM yards WHERE yards.id = colonies.yard_id AND yards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert colonies in their yards"
  ON colonies FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM yards WHERE yards.id = colonies.yard_id AND yards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update colonies in their yards"
  ON colonies FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM yards WHERE yards.id = colonies.yard_id AND yards.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM yards WHERE yards.id = colonies.yard_id AND yards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete colonies in their yards"
  ON colonies FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM yards WHERE yards.id = colonies.yard_id AND yards.owner_id = auth.uid()
    )
  );

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colony_id   UUID NOT NULL REFERENCES colonies(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('inspection', 'treatment', 'feed', 'split', 'loss', 'requeen', 'harvest', 'transfer', 'mite', 'swarm', 'queenless')),
  notes       TEXT,
  logged_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events for colonies in their yards"
  ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM colonies
      JOIN yards ON yards.id = colonies.yard_id
      WHERE colonies.id = events.colony_id AND yards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert events for colonies in their yards"
  ON events FOR INSERT
  WITH CHECK (
    auth.uid() = logged_by
    AND EXISTS (
      SELECT 1 FROM colonies
      JOIN yards ON yards.id = colonies.yard_id
      WHERE colonies.id = events.colony_id AND yards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own events"
  ON events FOR UPDATE
  USING (auth.uid() = logged_by)
  WITH CHECK (auth.uid() = logged_by);

CREATE POLICY "Users can delete their own events"
  ON events FOR DELETE
  USING (auth.uid() = logged_by);

-- ============================================================
-- INDEXES
-- ============================================================

-- FK indexes (PostgreSQL does NOT auto-create these)
CREATE INDEX idx_yards_owner_id ON yards(owner_id);
CREATE INDEX idx_colonies_yard_id ON colonies(yard_id);
CREATE INDEX idx_events_colony_id ON events(colony_id);
CREATE INDEX idx_events_logged_by ON events(logged_by);

-- Composite index for event queries ordered by date per colony
CREATE INDEX idx_events_colony_created ON events(colony_id, created_at DESC);

-- Uniqueness constraints to prevent duplicate names within scope
CREATE UNIQUE INDEX idx_yards_owner_name ON yards(owner_id, name);
CREATE UNIQUE INDEX idx_colonies_yard_label ON colonies(yard_id, label);

-- ============================================================
-- YARD EVENTS (bulk / yard-level operations)
-- ============================================================
CREATE TABLE yard_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yard_id         UUID NOT NULL REFERENCES yards(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN (
    'split_out', 'split_in', 'split_local',
    'transfer_out', 'transfer_in', 'move_out',
    'loss', 'addition', 'adjustment',
    'inspection', 'treatment', 'feed', 'harvest',
    'mite', 'swarm', 'queenless'
  )),
  count           INTEGER,
  related_yard_id UUID REFERENCES yards(id) ON DELETE SET NULL,
  pair_id         UUID,
  notes           TEXT,
  logged_by       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE yard_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view yard events in their yards"
  ON yard_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM yards WHERE yards.id = yard_events.yard_id AND yards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert yard events in their yards"
  ON yard_events FOR INSERT
  WITH CHECK (
    auth.uid() = logged_by
    AND EXISTS (
      SELECT 1 FROM yards WHERE yards.id = yard_events.yard_id AND yards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own yard events"
  ON yard_events FOR UPDATE
  USING (auth.uid() = logged_by)
  WITH CHECK (auth.uid() = logged_by);

CREATE POLICY "Users can delete their own yard events"
  ON yard_events FOR DELETE
  USING (auth.uid() = logged_by);

CREATE INDEX idx_yard_events_yard_id ON yard_events(yard_id);
CREATE INDEX idx_yard_events_logged_by ON yard_events(logged_by);
CREATE INDEX idx_yard_events_yard_created ON yard_events(yard_id, created_at DESC);
CREATE INDEX idx_yard_events_related_yard ON yard_events(related_yard_id);
CREATE INDEX idx_yard_events_pair_id ON yard_events(pair_id);

-- ============================================================
-- QUEENS
-- ============================================================
CREATE TABLE queens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colony_id         UUID NOT NULL REFERENCES colonies(id) ON DELETE CASCADE,
  marking_color     TEXT CHECK (marking_color IN ('white', 'yellow', 'red', 'green', 'blue')),
  source            TEXT,
  introduction_date DATE,
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'replaced', 'lost')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE queens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view queens in their colonies"
  ON queens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM colonies
      JOIN yards ON yards.id = colonies.yard_id
      WHERE colonies.id = queens.colony_id AND yards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert queens in their colonies"
  ON queens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM colonies
      JOIN yards ON yards.id = colonies.yard_id
      WHERE colonies.id = queens.colony_id AND yards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update queens in their colonies"
  ON queens FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM colonies
      JOIN yards ON yards.id = colonies.yard_id
      WHERE colonies.id = queens.colony_id AND yards.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM colonies
      JOIN yards ON yards.id = colonies.yard_id
      WHERE colonies.id = queens.colony_id AND yards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete queens in their colonies"
  ON queens FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM colonies
      JOIN yards ON yards.id = colonies.yard_id
      WHERE colonies.id = queens.colony_id AND yards.owner_id = auth.uid()
    )
  );

CREATE INDEX idx_queens_colony_id ON queens(colony_id);
CREATE INDEX idx_queens_colony_status ON queens(colony_id, status);

-- ============================================================
-- TREATMENT DETAILS
-- ============================================================
CREATE TABLE treatment_details (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id               UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  product_name           TEXT NOT NULL,
  dosage                 TEXT,
  application_method     TEXT,
  withdrawal_period_days INTEGER,
  lot_number             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE treatment_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view treatment details for their events"
  ON treatment_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      JOIN colonies ON colonies.id = events.colony_id
      JOIN yards ON yards.id = colonies.yard_id
      WHERE events.id = treatment_details.event_id AND yards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert treatment details for their events"
  ON treatment_details FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      JOIN colonies ON colonies.id = events.colony_id
      JOIN yards ON yards.id = colonies.yard_id
      WHERE events.id = treatment_details.event_id AND yards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update treatment details for their events"
  ON treatment_details FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM events
      JOIN colonies ON colonies.id = events.colony_id
      JOIN yards ON yards.id = colonies.yard_id
      WHERE events.id = treatment_details.event_id AND yards.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      JOIN colonies ON colonies.id = events.colony_id
      JOIN yards ON yards.id = colonies.yard_id
      WHERE events.id = treatment_details.event_id AND yards.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete treatment details for their events"
  ON treatment_details FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM events
      JOIN colonies ON colonies.id = events.colony_id
      JOIN yards ON yards.id = colonies.yard_id
      WHERE events.id = treatment_details.event_id AND yards.owner_id = auth.uid()
    )
  );

CREATE INDEX idx_treatment_details_event_id ON treatment_details(event_id);

-- ============================================================
-- CONSULTANTS
-- ============================================================
CREATE TABLE consultants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE consultants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultants can view their own record"
  ON consultants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Consultants can insert their own record"
  ON consultants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Consultants can update their own record"
  ON consultants FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_consultants_user_id ON consultants(user_id);

-- ============================================================
-- CONSULTANT CLIENTS (junction table)
-- ============================================================
CREATE TABLE consultant_clients (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id           UUID NOT NULL REFERENCES consultants(id) ON DELETE CASCADE,
  beekeeper_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  region                  TEXT,
  expected_winter_loss    NUMERIC DEFAULT 40,
  expected_summer_loss    NUMERIC DEFAULT 25,
  check_in_interval_days  INTEGER DEFAULT 14,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(consultant_id, beekeeper_id)
);

ALTER TABLE consultant_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultants can view their own clients"
  ON consultant_clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM consultants WHERE consultants.id = consultant_clients.consultant_id AND consultants.user_id = auth.uid()
    )
  );

CREATE POLICY "Consultants can insert their own clients"
  ON consultant_clients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consultants WHERE consultants.id = consultant_clients.consultant_id AND consultants.user_id = auth.uid()
    )
  );

CREATE POLICY "Consultants can update their own clients"
  ON consultant_clients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM consultants WHERE consultants.id = consultant_clients.consultant_id AND consultants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consultants WHERE consultants.id = consultant_clients.consultant_id AND consultants.user_id = auth.uid()
    )
  );

CREATE POLICY "Consultants can delete their own clients"
  ON consultant_clients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM consultants WHERE consultants.id = consultant_clients.consultant_id AND consultants.user_id = auth.uid()
    )
  );

CREATE INDEX idx_consultant_clients_consultant_id ON consultant_clients(consultant_id);
CREATE INDEX idx_consultant_clients_beekeeper_id ON consultant_clients(beekeeper_id);

-- ============================================================
-- CONSULTANT READ-ONLY ACCESS POLICIES
-- Allow consultants to read yards/colonies/events/yard_events
-- for their linked beekeepers
-- ============================================================
CREATE POLICY "Consultants can view client yards"
  ON yards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM consultant_clients cc
      JOIN consultants c ON c.id = cc.consultant_id
      WHERE cc.beekeeper_id = yards.owner_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Consultants can view client colonies"
  ON colonies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM yards
      JOIN consultant_clients cc ON cc.beekeeper_id = yards.owner_id
      JOIN consultants c ON c.id = cc.consultant_id
      WHERE yards.id = colonies.yard_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Consultants can view client events"
  ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM colonies
      JOIN yards ON yards.id = colonies.yard_id
      JOIN consultant_clients cc ON cc.beekeeper_id = yards.owner_id
      JOIN consultants c ON c.id = cc.consultant_id
      WHERE colonies.id = events.colony_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Consultants can view client yard events"
  ON yard_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM yards
      JOIN consultant_clients cc ON cc.beekeeper_id = yards.owner_id
      JOIN consultants c ON c.id = cc.consultant_id
      WHERE yards.id = yard_events.yard_id AND c.user_id = auth.uid()
    )
  );
