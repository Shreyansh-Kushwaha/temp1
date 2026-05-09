-- AI-generated student knowledge dashboard. One row per student. The
-- frontend can ask the agent to (re)generate this from session summaries +
-- existing reports. Each subsequent generate appends new findings rather
-- than overwriting, so generation_count tracks how many times we've refined.
CREATE TABLE IF NOT EXISTS ptm_student_knowledge (
  student_id        TEXT PRIMARY KEY,
  student_name      TEXT,
  subject           TEXT,
  payload           JSONB NOT NULL,
  generation_count  INTEGER NOT NULL DEFAULT 1,
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
