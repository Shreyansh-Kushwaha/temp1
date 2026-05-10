-- Track which address each delivery actually went to so the Logs page can
-- show recipients without re-querying MongoDB on every render. NULL for
-- existing rows is fine — they predate the column.
ALTER TABLE ptm_delivery_log ADD COLUMN IF NOT EXISTS recipient TEXT;
ALTER TABLE ptm_delivery_log ADD COLUMN IF NOT EXISTS intended_recipient TEXT;

CREATE INDEX IF NOT EXISTS idx_ptm_delivery_log_sent_at
  ON ptm_delivery_log(sent_at DESC);
