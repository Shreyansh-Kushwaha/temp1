-- Phase 2: per-version PDF URL.
-- ptm_reports.pdf_url already exists (in 001_init.sql) and tracks the latest PDF.
-- ptm_report_versions.pdf_url tracks the PDF for each generation snapshot so the
-- diff view + audit can link to the exact rendered report at that point in time.

ALTER TABLE ptm_report_versions ADD COLUMN pdf_url TEXT;
