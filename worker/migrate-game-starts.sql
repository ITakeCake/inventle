-- Track games that were STARTED, so "played but never finished" can be measured.
-- A row is written on the player's FIRST GUESS (not on page load) — that is what makes
-- it "played", and it also keeps bot traffic out, since bots never submit a guess.
--
-- dedup_hash is computed exactly like game_results.dedup_hash (sha-256 of
-- "sid:<sid>:<country>:<puzzle_num>"), so a start row and its completion row share a
-- hash. Unfinished games are therefore starts with no matching result — an exact
-- per-player answer, not a difference of two counters.
CREATE TABLE IF NOT EXISTS game_starts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  puzzle_num INTEGER NOT NULL,
  play_date TEXT NOT NULL,
  country TEXT DEFAULT 'XX',
  hour_utc INTEGER DEFAULT 0,
  mobile INTEGER DEFAULT 0,
  dedup_hash TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_starts_puzzle ON game_starts(puzzle_num);
CREATE INDEX IF NOT EXISTS idx_starts_country ON game_starts(country);
CREATE INDEX IF NOT EXISTS idx_starts_dedup ON game_starts(dedup_hash);
