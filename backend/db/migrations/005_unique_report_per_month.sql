-- Hard durability guarantee: at most one live report per (student, month).
--
-- Step 1: Soft-delete older duplicates so the unique index can be created.
--   Existing live (deleted_at IS NULL) rows that share the same
--   (student_id, reporting_month) get all-but-the-most-recent marked deleted.
--   "Most recent" = max(updated_at). Ties broken by id (deterministic).
UPDATE ptm_reports
   SET deleted_at = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
 WHERE deleted_at IS NULL
   AND id NOT IN (
     SELECT id FROM (
       SELECT id,
              ROW_NUMBER() OVER (
                PARTITION BY student_id, reporting_month
                ORDER BY updated_at DESC, id ASC
              ) AS rn
       FROM ptm_reports
       WHERE deleted_at IS NULL
     ) AS ranked
     WHERE rn = 1
   );

-- Step 2: Add the partial unique index.
--   Future inserts for the same (student, month) will fail with
--   UNIQUE constraint failed — the auto-generate code catches this and
--   buckets it as "skipped — already exists" (race-safe).
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique_active_per_month
  ON ptm_reports (student_id, reporting_month)
  WHERE deleted_at IS NULL;
