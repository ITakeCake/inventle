-- Migration: Add extended stats columns to daily_stats
-- Run via: wrangler d1 execute inventle-stats --file=migrate-extended-stats.sql

ALTER TABLE daily_stats ADD COLUMN dark_count INTEGER DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN scheme_0 INTEGER DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN scheme_1 INTEGER DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN scheme_2 INTEGER DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN scheme_3 INTEGER DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN streak_sum INTEGER DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN streak_max INTEGER DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN both_count INTEGER DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN bc_win_count INTEGER DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN shared_win_count INTEGER DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN shared_loss_count INTEGER DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN b1_first_try INTEGER DEFAULT 0;
ALTER TABLE daily_stats ADD COLUMN both_won INTEGER DEFAULT 0;
