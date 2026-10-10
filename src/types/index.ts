export type ScheduleType = 'staggered_auto' | 'fixed_times';
export type StartTriggerMode = 'dynamic_first_checkin' | 'fixed_schedule';
export type DailyLogStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type DoseSlotStatus = 'pending' | 'taken' | 'deferred' | 'skipped';

export interface BlackoutWindow {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface InterMedBuffer {
  id: string;
  target_medicine_id: string;
  buffer_before_mins: number;
  buffer_after_mins: number;
  label: string;
}

export interface FixedTimeSlot {
  slot_number: number;
  time: string;
  is_anchored: boolean;
}

export interface Medicine {
  id: string;
  name: string;
  dosage_instructions: string;
  earliest_allowed: string;
  latest_allowed: string;
  min_interval_hours: number;
  inter_med_default_buffer_mins: number;
  blackout_windows: BlackoutWindow[];
  inter_med_buffers: InterMedBuffer[];
  sequence_order: number;
  depends_on_medicine_id: string | null;
  min_gap_after_prerequisite_mins: number;
  start_trigger_mode: StartTriggerMode;
  is_archived: boolean;
  created_at: string;
}

export interface PhaseSchedule {
  id: string;
  medicine_id: string;
  phase_name: string;
  start_date: string;
  end_date: string;
  times_per_day: number;
  schedule_type: ScheduleType;
  fixed_times_list: FixedTimeSlot[];
}

export interface DailyMedLog {
  id: string;
  medicine_id: string;
  schedule_id: string;
  date: string;
  first_dose_time: string | null;
  status: DailyLogStatus;
}

export interface DoseSlot {
  id: string;
  daily_log_id: string;
  medicine_id: string;
  dose_number: number;
  scheduled_time: string;
  original_time: string;
  status: DoseSlotStatus;
  taken_at: string | null;
  checked_in_by_user_id: string | null;
  is_anchored: boolean;
  is_custom_added: boolean;
  delay_text: string | null;
}

export interface MedicineWithRelations extends Medicine {
  phase_schedules?: PhaseSchedule[];
}

export interface DailyLogWithSlots extends DailyMedLog {
  dose_slots?: DoseSlot[];
}
