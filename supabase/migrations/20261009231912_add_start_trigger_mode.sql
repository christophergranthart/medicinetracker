/*
# Add start_trigger_mode to Medicines

## Overview
Adds a `start_trigger_mode` column to the `medicines` table to support
Floating / Unscheduled Start Mode where dose timeline slots are only generated
after the user checks in Dose #1 for the day.

## Modified Tables

### medicines
- `start_trigger_mode` (text, default 'dynamic_first_checkin'):
  - 'dynamic_first_checkin': No pre-generated timeline. Dose slots are created
    only after the user taps "Start Today" and checks in their first dose.
    Remaining slots are then calculated from the first dose time.
  - 'fixed_schedule': Timeline slots are generated upfront when the daily log
    is created (existing behavior).

## Security
No security changes — existing shared-access RLS policies already cover this.

## Important Notes
1. Column is additive — no data loss.
2. Default is 'dynamic_first_checkin' so new medicines use floating mode by default.
3. Existing medicines get the default value automatically.
*/

ALTER TABLE medicines
  ADD COLUMN IF NOT EXISTS start_trigger_mode text NOT NULL DEFAULT 'dynamic_first_checkin'
  CHECK (start_trigger_mode IN ('dynamic_first_checkin', 'fixed_schedule'));
