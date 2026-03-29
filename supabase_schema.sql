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
  type        TEXT NOT NULL CHECK (type IN ('inspection', 'treatment', 'feed', 'split', 'loss', 'requeen', 'harvest')),
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
