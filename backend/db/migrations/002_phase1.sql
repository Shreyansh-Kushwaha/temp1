-- Phase 1: confidence + evidence + action plan + tone
-- Phase 2: audio + version history + risk signals
-- Phase 3: copilot + student concept graph
-- Single migration so we don't re-migrate later. SQLite only ALTERs once because
-- run_migrations() tracks applied files in _schema_migrations.

ALTER TABLE ptm_reports ADD COLUMN overall_confidence INTEGER;
ALTER TABLE ptm_reports ADD COLUMN tone_warmth TEXT NOT NULL DEFAULT 'balanced';
ALTER TABLE ptm_reports ADD COLUMN tone_detail TEXT NOT NULL DEFAULT 'balanced';
ALTER TABLE ptm_reports ADD COLUMN audio_url TEXT;

-- Version history (for diff view + audit)
CREATE TABLE IF NOT EXISTS ptm_report_versions (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES ptm_reports(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  draft_content TEXT NOT NULL,
  trigger TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_report_versions_report ON ptm_report_versions(report_id, version_number);

-- Audio summaries
CREATE TABLE IF NOT EXISTS ptm_audio_summaries (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES ptm_reports(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  voice TEXT,
  script TEXT NOT NULL,
  audio_url TEXT,
  duration_seconds REAL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_msg TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audio_report ON ptm_audio_summaries(report_id);

-- Risk signals
CREATE TABLE IF NOT EXISTS ptm_risk_signals (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  report_id TEXT REFERENCES ptm_reports(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  trend TEXT,
  delta REAL,
  description TEXT,
  evidence TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_risk_student ON ptm_risk_signals(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_risk_severity ON ptm_risk_signals(severity, resolved_at);

-- Copilot conversations
CREATE TABLE IF NOT EXISTS ptm_copilot_messages (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_copilot_student ON ptm_copilot_messages(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_copilot_conv ON ptm_copilot_messages(conversation_id, created_at);

-- Student concept graph (knowledge graph backing data)
CREATE TABLE IF NOT EXISTS ptm_student_concepts (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  concept TEXT NOT NULL,
  mastery_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'learning',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  source_report_id TEXT REFERENCES ptm_reports(id) ON DELETE SET NULL,
  metadata TEXT,
  UNIQUE (student_id, subject, concept)
);
CREATE INDEX IF NOT EXISTS idx_concepts_student ON ptm_student_concepts(student_id, subject);
