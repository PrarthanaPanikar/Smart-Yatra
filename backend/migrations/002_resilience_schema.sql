-- Migration: Resilience System Schema
-- Challenge 1: The Blackout - Database Failure Recovery
-- Tables: system_backups, operation_journal, recovery_events

-- System Backups Table
CREATE TABLE IF NOT EXISTS system_backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,
  size_bytes INTEGER,
  backup_type TEXT NOT NULL CHECK(backup_type IN ('scheduled', 'manual', 'pre-recovery')),
  duration_ms INTEGER,
  status TEXT NOT NULL CHECK(status IN ('SUCCESS', 'FAILED')),
  error TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_backups_status ON system_backups(status);
CREATE INDEX IF NOT EXISTS idx_backups_created ON system_backups(created_at DESC);

-- Operation Journal Table
CREATE TABLE IF NOT EXISTS operation_journal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,
  payload TEXT NOT NULL,
  event_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'REPLAYED', 'FAILED')),
  error TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  replayed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_journal_status ON operation_journal(status);
CREATE INDEX IF NOT EXISTS idx_journal_created ON operation_journal(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_journal_event_id ON operation_journal(event_id);

-- Recovery Events Table
CREATE TABLE IF NOT EXISTS recovery_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  details TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_type ON recovery_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON recovery_events(created_at DESC);
