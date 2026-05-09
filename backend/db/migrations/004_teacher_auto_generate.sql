-- Per-teacher opt-in for the n8n daily auto-generate job.
-- A row exists only after the teacher has explicitly toggled the flag.
CREATE TABLE IF NOT EXISTS ptm_teacher_settings (
  teacher_name          TEXT PRIMARY KEY,
  auto_generate_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at            TEXT NOT NULL
);
