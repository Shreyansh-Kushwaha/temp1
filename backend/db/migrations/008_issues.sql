-- Support / ops queue. One row = one ticket the support team needs to look at.
-- Generic schema so we can add new types ('whatsapp_missing', 'duplicate_student',
-- etc.) without further migrations.
CREATE TABLE IF NOT EXISTS ptm_issues (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,                 -- 'email_missing' | future types
  status          TEXT NOT NULL DEFAULT 'open',  -- open | in_progress | resolved | wont_fix
  severity        TEXT NOT NULL DEFAULT 'medium', -- low | medium | high
  title           TEXT NOT NULL,
  description     TEXT,
  entity_type     TEXT,                          -- 'student' | 'report' | etc.
  entity_id       TEXT,
  entity_name     TEXT,
  metadata        JSONB,
  created_by      TEXT,                          -- 'system_check' | 'auto_approve' | <user>
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  resolved_at     TEXT,
  resolved_by     TEXT,
  resolution_note TEXT
);

-- Dedupe: at most one OPEN ticket per (type, entity_id). Reopen if the entity
-- gets back into a broken state after being resolved.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ptm_issues_open_per_entity
  ON ptm_issues(type, entity_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_ptm_issues_status_created
  ON ptm_issues(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ptm_issues_type
  ON ptm_issues(type);
