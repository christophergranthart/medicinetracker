CREATE UNIQUE INDEX IF NOT EXISTS daily_med_logs_medicine_date_unique
  ON daily_med_logs (medicine_id, date);
