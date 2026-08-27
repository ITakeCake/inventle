-- "See something wrong?" reports. The table doubles as the rate limiter: counting
-- recent rows per ip_hash needs no extra storage and cannot drift out of sync.
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  page TEXT,
  country TEXT,
  ip_hash TEXT NOT NULL,
  emailed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created);
CREATE INDEX IF NOT EXISTS idx_reports_ip ON reports(ip_hash, created);
