/*
# Base44 MedTracker - Schema Creation

Creates the complete database schema for a multi-user shared household medication tracker.
All authenticated users share the same household dataset (shared access model).

## Tables: medicines, phase_schedules, daily_med_logs, dose_slots
## Security: RLS on all tables, shared access for all authenticated users
*/

CREATE TABLE IF NOT EXISTS medicines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  dosage_instructions text DEFAULT '',
  earliest_allowed text DEFAULT '07:00 AM',
  latest_allowed text DEFAULT '09:00 PM',
  min_interval_hours numeric DEFAULT 3.0,
  inter_med_default_buffer_mins integer DEFAULT 60,
  blackout_windows jsonb DEFAULT '[]'::jsonb,
  inter_med_buffers jsonb DEFAULT '[]'::jsonb,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medicines_shared_select" ON medicines;
CREATE POLICY "medicines_shared_select" ON medicines FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "medicines_shared_insert" ON medicines;
CREATE POLICY "medicines_shared_insert" ON medicines FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "medicines_shared_update" ON medicines;
CREATE POLICY "medicines_shared_update" ON medicines FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "medicines_shared_delete" ON medicines;
CREATE POLICY "medicines_shared_delete" ON medicines FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS phase_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  phase_name text NOT NULL DEFAULT 'Phase 1',
  start_date date NOT NULL,
  end_date date NOT NULL,
  times_per_day integer NOT NULL DEFAULT 2,
  schedule_type text NOT NULL DEFAULT 'staggered_auto' CHECK (schedule_type IN ('staggered_auto', 'fixed_times')),
  fixed_times_list jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE phase_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "phase_schedules_shared_select" ON phase_schedules;
CREATE POLICY "phase_schedules_shared_select" ON phase_schedules FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "phase_schedules_shared_insert" ON phase_schedules;
CREATE POLICY "phase_schedules_shared_insert" ON phase_schedules FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "phase_schedules_shared_update" ON phase_schedules;
CREATE POLICY "phase_schedules_shared_update" ON phase_schedules FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "phase_schedules_shared_delete" ON phase_schedules;
CREATE POLICY "phase_schedules_shared_delete" ON phase_schedules FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS daily_med_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES phase_schedules(id) ON DELETE CASCADE,
  date date NOT NULL,
  first_dose_time text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped'))
);

ALTER TABLE daily_med_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_med_logs_shared_select" ON daily_med_logs;
CREATE POLICY "daily_med_logs_shared_select" ON daily_med_logs FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "daily_med_logs_shared_insert" ON daily_med_logs;
CREATE POLICY "daily_med_logs_shared_insert" ON daily_med_logs FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "daily_med_logs_shared_update" ON daily_med_logs;
CREATE POLICY "daily_med_logs_shared_update" ON daily_med_logs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "daily_med_logs_shared_delete" ON daily_med_logs;
CREATE POLICY "daily_med_logs_shared_delete" ON daily_med_logs FOR DELETE
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS dose_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id uuid NOT NULL REFERENCES daily_med_logs(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  dose_number integer NOT NULL,
  scheduled_time text NOT NULL,
  original_time text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'deferred', 'skipped')),
  taken_at text,
  checked_in_by_user_id uuid,
  is_anchored boolean DEFAULT false,
  is_custom_added boolean DEFAULT false,
  delay_text text
);

ALTER TABLE dose_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dose_slots_shared_select" ON dose_slots;
CREATE POLICY "dose_slots_shared_select" ON dose_slots FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "dose_slots_shared_insert" ON dose_slots;
CREATE POLICY "dose_slots_shared_insert" ON dose_slots FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "dose_slots_shared_update" ON dose_slots;
CREATE POLICY "dose_slots_shared_update" ON dose_slots FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "dose_slots_shared_delete" ON dose_slots;
CREATE POLICY "dose_slots_shared_delete" ON dose_slots FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_phase_schedules_medicine_id ON phase_schedules(medicine_id);
CREATE INDEX IF NOT EXISTS idx_daily_med_logs_medicine_id ON daily_med_logs(medicine_id);
CREATE INDEX IF NOT EXISTS idx_daily_med_logs_date ON daily_med_logs(date);
CREATE INDEX IF NOT EXISTS idx_daily_med_logs_schedule_id ON daily_med_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_dose_slots_daily_log_id ON dose_slots(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_dose_slots_medicine_id ON dose_slots(medicine_id);
CREATE INDEX IF NOT EXISTS idx_medicines_archived ON medicines(is_archived);
