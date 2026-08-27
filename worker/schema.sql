-- Inventle Global Stats Database Schema
-- Cloudflare D1 (SQLite)

-- Individual game results (anonymous, no PII)
CREATE TABLE IF NOT EXISTS game_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  puzzle_num INTEGER NOT NULL,
  play_date TEXT NOT NULL,
  country TEXT DEFAULT 'XX',
  won INTEGER NOT NULL DEFAULT 0,
  guesses INTEGER DEFAULT 0,
  total_time INTEGER DEFAULT 0,
  guess_intervals TEXT DEFAULT '[]',
  first_guess INTEGER DEFAULT 0,
  used_bc INTEGER DEFAULT 0,
  input_method TEXT DEFAULT 'none',
  keyboard_type TEXT DEFAULT 'none',
  b1_result TEXT DEFAULT 'none',
  b2_result TEXT DEFAULT 'none',
  shared INTEGER DEFAULT 0,
  mobile INTEGER DEFAULT 0,
  dark_mode INTEGER DEFAULT 0,
  color_scheme INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  hour_utc INTEGER DEFAULT 0,
  dedup_hash TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_results_puzzle ON game_results(puzzle_num);
CREATE INDEX IF NOT EXISTS idx_results_date ON game_results(play_date);
CREATE INDEX IF NOT EXISTS idx_results_country ON game_results(country);
CREATE INDEX IF NOT EXISTS idx_results_dedup ON game_results(dedup_hash);

-- Daily aggregates (pre-computed for fast reads)
CREATE TABLE IF NOT EXISTS daily_stats (
  play_date TEXT NOT NULL,
  country TEXT DEFAULT 'ALL',
  total_players INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_guesses INTEGER DEFAULT 0,
  total_time INTEGER DEFAULT 0,
  dist_1 INTEGER DEFAULT 0,
  dist_2 INTEGER DEFAULT 0,
  dist_3 INTEGER DEFAULT 0,
  dist_4 INTEGER DEFAULT 0,
  dist_5 INTEGER DEFAULT 0,
  dist_6 INTEGER DEFAULT 0,
  b1_played INTEGER DEFAULT 0,
  b1_won INTEGER DEFAULT 0,
  b2_played INTEGER DEFAULT 0,
  b2_won INTEGER DEFAULT 0,
  shared_count INTEGER DEFAULT 0,
  mobile_count INTEGER DEFAULT 0,
  desktop_count INTEGER DEFAULT 0,
  keyboard_count INTEGER DEFAULT 0,
  numpad_count INTEGER DEFAULT 0,
  bc_used_count INTEGER DEFAULT 0,
  first_guess_sum INTEGER DEFAULT 0,
  -- Extended stats (added 2026-04)
  dark_count INTEGER DEFAULT 0,
  scheme_0 INTEGER DEFAULT 0,
  scheme_1 INTEGER DEFAULT 0,
  scheme_2 INTEGER DEFAULT 0,
  scheme_3 INTEGER DEFAULT 0,
  streak_sum INTEGER DEFAULT 0,
  streak_max INTEGER DEFAULT 0,
  both_count INTEGER DEFAULT 0,
  bc_win_count INTEGER DEFAULT 0,
  shared_win_count INTEGER DEFAULT 0,
  shared_loss_count INTEGER DEFAULT 0,
  b1_first_try INTEGER DEFAULT 0,
  both_won INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (play_date, country)
);

-- Puzzle-based aggregates (replaces daily_stats for all stat queries)
-- Keyed by puzzle_num instead of play_date so stats align with invention day, not UTC calendar
CREATE TABLE IF NOT EXISTS puzzle_stats (
  puzzle_num INTEGER NOT NULL,
  country TEXT DEFAULT 'ALL',
  total_players INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_guesses INTEGER DEFAULT 0,
  total_time INTEGER DEFAULT 0,
  dist_1 INTEGER DEFAULT 0,
  dist_2 INTEGER DEFAULT 0,
  dist_3 INTEGER DEFAULT 0,
  dist_4 INTEGER DEFAULT 0,
  dist_5 INTEGER DEFAULT 0,
  dist_6 INTEGER DEFAULT 0,
  b1_played INTEGER DEFAULT 0,
  b1_won INTEGER DEFAULT 0,
  b2_played INTEGER DEFAULT 0,
  b2_won INTEGER DEFAULT 0,
  shared_count INTEGER DEFAULT 0,
  mobile_count INTEGER DEFAULT 0,
  desktop_count INTEGER DEFAULT 0,
  keyboard_count INTEGER DEFAULT 0,
  numpad_count INTEGER DEFAULT 0,
  bc_used_count INTEGER DEFAULT 0,
  first_guess_sum INTEGER DEFAULT 0,
  dark_count INTEGER DEFAULT 0,
  scheme_0 INTEGER DEFAULT 0,
  scheme_1 INTEGER DEFAULT 0,
  scheme_2 INTEGER DEFAULT 0,
  scheme_3 INTEGER DEFAULT 0,
  streak_sum INTEGER DEFAULT 0,
  streak_max INTEGER DEFAULT 0,
  both_count INTEGER DEFAULT 0,
  bc_win_count INTEGER DEFAULT 0,
  shared_win_count INTEGER DEFAULT 0,
  shared_loss_count INTEGER DEFAULT 0,
  b1_first_try INTEGER DEFAULT 0,
  both_won INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (puzzle_num, country)
);

CREATE INDEX IF NOT EXISTS idx_puzzle_stats_num ON puzzle_stats(puzzle_num);

-- Migration: add new columns to existing daily_stats table
-- (safe to run multiple times — ALTER TABLE will error on existing columns, that's fine)
-- Run these one at a time if your DB already has data:
-- ALTER TABLE daily_stats ADD COLUMN dark_count INTEGER DEFAULT 0;
-- ALTER TABLE daily_stats ADD COLUMN scheme_0 INTEGER DEFAULT 0;
-- ALTER TABLE daily_stats ADD COLUMN scheme_1 INTEGER DEFAULT 0;
-- ALTER TABLE daily_stats ADD COLUMN scheme_2 INTEGER DEFAULT 0;
-- ALTER TABLE daily_stats ADD COLUMN scheme_3 INTEGER DEFAULT 0;
-- ALTER TABLE daily_stats ADD COLUMN streak_sum INTEGER DEFAULT 0;
-- ALTER TABLE daily_stats ADD COLUMN streak_max INTEGER DEFAULT 0;
-- ALTER TABLE daily_stats ADD COLUMN both_count INTEGER DEFAULT 0;
-- ALTER TABLE daily_stats ADD COLUMN bc_win_count INTEGER DEFAULT 0;
-- ALTER TABLE daily_stats ADD COLUMN shared_win_count INTEGER DEFAULT 0;
-- ALTER TABLE daily_stats ADD COLUMN shared_loss_count INTEGER DEFAULT 0;
-- ALTER TABLE daily_stats ADD COLUMN b1_first_try INTEGER DEFAULT 0;
-- ALTER TABLE daily_stats ADD COLUMN both_won INTEGER DEFAULT 0;
