CREATE TABLE IF NOT EXISTS ptm_reports (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  reporting_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  draft_content TEXT NOT NULL,
  pdf_url TEXT,
  teacher_note TEXT,
  regeneration_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS ptm_questionnaire_responses (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES ptm_reports(id),
  engagement_rating INTEGER,
  concept_rating INTEGER,
  application_rating INTEGER,
  topics_correction TEXT,
  next_month_topics TEXT,
  free_form_note TEXT,
  submitted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ptm_delivery_log (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES ptm_reports(id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  sent_at TEXT,
  error_msg TEXT
);
