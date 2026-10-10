/*
# Add Regimen Sequencing & Dependency Fields to Medicines

## Overview
Adds three new columns to the `medicines` table to support inter-medication
sequential ordering and prerequisite dependencies.

## Modified Tables

### medicines
- `sequence_order` (integer, default 1): Relative priority order in the daily
  sequence (1 = "Take First", 2 = "Take Second", etc.). Determines which
  medication initiates the daily schedule.
- `depends_on_medicine_id` (uuid, nullable): References a prerequisite medicine
  that must be taken before this medicine's dose cycle begins. NULL means no
  dependency.
- `min_gap_after_prerequisite_mins` (integer, default 60): Minimum wait time
  required after completing the prerequisite medicine's dose before this
  medicine starts.

## Security
No security changes — existing shared-access RLS policies on `medicines`
already cover these new columns.

## Important Notes
1. All three columns are additive — no data is lost.
2. `depends_on_medicine_id` is nullable so existing medicines are unaffected.
3. No foreign key constraint is added to allow flexible referencing (a medicine
   may be deleted while another still references it, handled gracefully in app
   logic).
*/

ALTER TABLE medicines
  ADD COLUMN IF NOT EXISTS sequence_order integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS depends_on_medicine_id uuid,
  ADD COLUMN IF NOT EXISTS min_gap_after_prerequisite_mins integer NOT NULL DEFAULT 60;
