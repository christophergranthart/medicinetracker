import { supabase } from '@/lib/supabase';
import type {
  Medicine,
  PhaseSchedule,
  DailyMedLog,
  DoseSlot,
} from '@/types';

interface AllSlotsContext {
  medicineId: string;
  scheduledTime: string;
  status: string;
  dailyLogId: string;
  doseNumber: number;
}

function normalizeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (value == null) return [];
  return [];
}

function normalizeMedicine(m: Record<string, unknown>): Medicine {
  return {
    ...m,
    blackout_windows: normalizeArray(m.blackout_windows),
    inter_med_buffers: normalizeArray(m.inter_med_buffers),
    sequence_order: typeof m.sequence_order === 'number' ? m.sequence_order : 1,
    depends_on_medicine_id: m.depends_on_medicine_id ?? null,
    min_gap_after_prerequisite_mins: typeof m.min_gap_after_prerequisite_mins === 'number' ? m.min_gap_after_prerequisite_mins : 60,
    start_trigger_mode: m.start_trigger_mode === 'fixed_schedule' ? 'fixed_schedule' : 'dynamic_first_checkin',
  } as unknown as Medicine;
}

function normalizeSchedule(s: Record<string, unknown>): PhaseSchedule {
  return {
    ...s,
    fixed_times_list: normalizeArray(s.fixed_times_list),
  } as unknown as PhaseSchedule;
}
import {
  generateInitialSlots,
  recalculateRemainingSlots,
  delaySlot,
  getDueStatus,
} from '@/lib/schedulingEngine';
import {
  todayStr,
  parseTimeToMinutes,
  getCurrentTimeStr,
  getCurrentTimeMinutes,
  getDelayText,
  addMinutesToTime,
} from '@/lib/timeUtils';

export async function fetchActiveMedicines(): Promise<Medicine[]> {
  const { data, error } = await supabase
    .from('medicines')
    .select('*')
    .eq('is_archived', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((m) => normalizeMedicine(m as Record<string, unknown>));
}

export async function fetchAllMedicines(): Promise<Medicine[]> {
  const { data, error } = await supabase
    .from('medicines')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((m) => normalizeMedicine(m as Record<string, unknown>));
}

export async function fetchPhaseSchedules(medicineId: string): Promise<PhaseSchedule[]> {
  const { data, error } = await supabase
    .from('phase_schedules')
    .select('*')
    .eq('medicine_id', medicineId)
    .order('start_date', { ascending: true });
  if (error) throw error;
  return (data || []).map((s) => normalizeSchedule(s as Record<string, unknown>));
}

export async function fetchAllPhaseSchedules(): Promise<PhaseSchedule[]> {
  const { data, error } = await supabase
    .from('phase_schedules')
    .select('*')
    .order('start_date', { ascending: true });
  if (error) throw error;
  return (data || []).map((s) => normalizeSchedule(s as Record<string, unknown>));
}

export async function fetchDailyLog(medicineId: string, date: string): Promise<DailyMedLog | null> {
  const { data, error } = await supabase
    .from('daily_med_logs')
    .select('*')
    .eq('medicine_id', medicineId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return data as DailyMedLog | null;
}

export async function fetchAllDailyLogs(date: string): Promise<DailyMedLog[]> {
  const { data, error } = await supabase
    .from('daily_med_logs')
    .select('*')
    .eq('date', date);
  if (error) throw error;
  return (data || []) as DailyMedLog[];
}

export async function fetchDoseSlots(dailyLogId: string): Promise<DoseSlot[]> {
  const { data, error } = await supabase
    .from('dose_slots')
    .select('*')
    .eq('daily_log_id', dailyLogId)
    .order('dose_number', { ascending: true });
  if (error) throw error;
  return (data || []) as DoseSlot[];
}

export async function fetchDoseSlotsByLogIds(logIds: string[]): Promise<DoseSlot[]> {
  if (logIds.length === 0) return [];
  const { data, error } = await supabase
    .from('dose_slots')
    .select('*')
    .in('daily_log_id', logIds)
    .order('dose_number', { ascending: true });
  if (error) throw error;
  return (data || []) as DoseSlot[];
}

export async function fetchDoseSlotsForDate(date: string): Promise<DoseSlot[]> {
  const { data: logs, error: logError } = await supabase
    .from('daily_med_logs')
    .select('id')
    .eq('date', date);
  if (logError) throw logError;
  if (!logs || logs.length === 0) return [];
  return fetchDoseSlotsByLogIds(logs.map((l) => l.id));
}

export async function fetchAllDoseSlotsForDate(date: string): Promise<Record<string, DoseSlot[]>> {
  const { data: logs, error: logError } = await supabase
    .from('daily_med_logs')
    .select('id, medicine_id')
    .eq('date', date);
  if (logError) throw logError;
  if (!logs || logs.length === 0) return {};

  const logIds = logs.map((l) => l.id);
  const slots = await fetchDoseSlotsByLogIds(logIds);

  const result: Record<string, DoseSlot[]> = {};
  const logIdToMedId: Record<string, string> = {};
  for (const log of logs) {
    logIdToMedId[log.id] = log.medicine_id;
  }
  for (const slot of slots) {
    const medId = logIdToMedId[slot.daily_log_id];
    if (medId) {
      if (!result[medId]) result[medId] = [];
      result[medId].push(slot);
    }
  }
  return result;
}

export async function fetchHistoryLogs(daysBack: number = 30): Promise<DailyMedLog[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startDateStr = startDate.toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('daily_med_logs')
    .select('*')
    .gte('date', startDateStr)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data || []) as DailyMedLog[];
}

export async function fetchAllDoseSlotsForLogIds(logIds: string[]): Promise<Record<string, DoseSlot[]>> {
  if (logIds.length === 0) return {};
  const slots = await fetchDoseSlotsByLogIds(logIds);
  const result: Record<string, DoseSlot[]> = {};
  for (const slot of slots) {
    if (!result[slot.daily_log_id]) result[slot.daily_log_id] = [];
    result[slot.daily_log_id].push(slot);
  }
  return result;
}

function findActiveSchedule(schedules: PhaseSchedule[], date: string): PhaseSchedule | null {
  for (const s of schedules) {
    if (date >= s.start_date && date <= s.end_date) return s;
  }
  return null;
}

export async function ensureDailyLog(
  medicine: Medicine,
  schedules: PhaseSchedule[],
  date: string
): Promise<{ log: DailyMedLog | null; slots: DoseSlot[]; schedule: PhaseSchedule | null; warning: string | null }> {
  const schedule = findActiveSchedule(schedules, date);
  if (!schedule) {
    return { log: null, slots: [], schedule: null, warning: 'No active schedule for this date.' };
  }

  let log = await fetchDailyLog(medicine.id, date);
  if (!log) {
    const { data: newLog, error: logError } = await supabase
      .from('daily_med_logs')
      .insert({
        medicine_id: medicine.id,
        schedule_id: schedule.id,
        date,
        first_dose_time: null,
        status: 'pending',
      })
      .select()
      .single();
    if (logError) {
      log = await fetchDailyLog(medicine.id, date);
      if (!log) throw logError;
    } else {
      log = newLog as DailyMedLog;
    }

    if (medicine.start_trigger_mode === 'dynamic_first_checkin') {
      return { log, slots: [], schedule, warning: null };
    }

    const allSlots = await fetchAllDoseSlotsContextForDate(date, medicine.id);
    const initialSlots = generateInitialSlots(medicine, schedule, allSlots);

    const slotInserts = initialSlots.map((s, i) => ({
      daily_log_id: log!.id,
      medicine_id: medicine.id,
      dose_number: i + 1,
      scheduled_time: s.time,
      original_time: s.time,
      status: 'pending',
      taken_at: null,
      is_anchored: schedule.schedule_type === 'fixed_times' && schedule.fixed_times_list?.[i]?.is_anchored || false,
      is_custom_added: false,
      delay_text: null,
    }));

    if (slotInserts.length > 0) {
      const { data: newSlots, error: slotError } = await supabase
        .from('dose_slots')
        .insert(slotInserts)
        .select();
      if (slotError) throw slotError;
      return {
        log,
        slots: (newSlots || []) as DoseSlot[],
        schedule,
        warning: initialSlots.some((s) => s.clamped) ? 'Cutoff reached. Doses spaced equally to fit before cutoff.' : null,
      };
    }

    return { log, slots: [], schedule, warning: null };
  }

  const slots = await fetchDoseSlots(log.id);
  return { log, slots, schedule, warning: null };
}

export async function fetchAllDoseSlotsContextForDate(date: string, excludeMedicineId?: string): Promise<AllSlotsContext[]> {
  const { data: logs, error } = await supabase
    .from('daily_med_logs')
    .select('id, medicine_id')
    .eq('date', date);
  if (error) throw error;
  if (!logs || logs.length === 0) return [];

  const filteredLogs = excludeMedicineId
    ? logs.filter((l) => l.medicine_id !== excludeMedicineId)
    : logs;
  if (filteredLogs.length === 0) return [];

  const { data: slots, error: slotError } = await supabase
    .from('dose_slots')
    .select('*')
    .in('daily_log_id', filteredLogs.map((l) => l.id));
  if (slotError) throw slotError;

  return (slots || []).map((s) => ({
    medicineId: s.medicine_id,
    scheduledTime: s.scheduled_time,
    status: s.status,
    dailyLogId: s.daily_log_id,
    doseNumber: s.dose_number,
  }));
}

export async function checkInDose(
  slot: DoseSlot,
  medicine: Medicine,
  schedule: PhaseSchedule,
  userId: string,
  customTime?: string
): Promise<{ updatedSlot: DoseSlot; warning: string | null }> {
  const now = customTime || getCurrentTimeStr();
  const { data: updated, error } = await supabase
    .from('dose_slots')
    .update({
      status: 'taken',
      taken_at: now,
      checked_in_by_user_id: userId,
      delay_text: getDelayText(slot.original_time, now),
    })
    .eq('id', slot.id)
    .select()
    .single();
  if (error) throw error;
  const updatedSlot = updated as DoseSlot;

  const { data: log } = await supabase
    .from('daily_med_logs')
    .select('*')
    .eq('id', slot.daily_log_id)
    .single();
  if (!log) throw new Error('Daily log not found');

  const allSlots = await fetchDoseSlots(slot.daily_log_id);
  const takenSlots = allSlots.filter((s) => s.status === 'taken');
  const pendingSlots = allSlots.filter((s) => s.status === 'pending');

  let firstDoseTime = log.first_dose_time;
  if (slot.dose_number === 1 || !firstDoseTime) {
    firstDoseTime = now;
    await supabase
      .from('daily_med_logs')
      .update({ first_dose_time: firstDoseTime, status: 'in_progress' })
      .eq('id', slot.daily_log_id);
  }

  let warning: string | null = null;

  if (pendingSlots.length > 0 && firstDoseTime) {
    const otherSlotsCtx = await fetchAllDoseSlotsContextForDate(log.date, medicine.id);
    const updates = recalculateRemainingSlots(medicine, schedule, allSlots, otherSlotsCtx, firstDoseTime);

    for (const update of updates) {
      const updateData: Record<string, unknown> = { scheduled_time: update.newTime };
      const origSlot = allSlots.find((s) => s.id === update.id);
      if (origSlot) {
        updateData.delay_text = getDelayText(origSlot.original_time, update.newTime);
      }
      if (update.clamped) warning = 'Cutoff reached. Doses spaced equally to fit before cutoff.';
      await supabase.from('dose_slots').update(updateData).eq('id', update.id);
    }
  }

  if (takenSlots.length + 1 >= schedule.times_per_day) {
    await supabase
      .from('daily_med_logs')
      .update({ status: 'completed' })
      .eq('id', slot.daily_log_id);
  }

  await cascadeOtherMeds(medicine, updatedSlot);
  await recascadeDependents(medicine, log.date);

  return { updatedSlot, warning };
}

async function cascadeOtherMeds(medicine: Medicine, checkedInSlot: DoseSlot): Promise<void> {
  const logDate = checkedInSlot.daily_log_id ? await getLogDate(checkedInSlot.daily_log_id) : todayStr();

  const { data: logs } = await supabase
    .from('daily_med_logs')
    .select('id, medicine_id')
    .eq('date', logDate);
  if (!logs) return;

  const { data: allMeds } = await supabase.from('medicines').select('id, depends_on_medicine_id').eq('is_archived', false);
  const dependentIds = new Set(
    (allMeds || [])
      .filter((m: Record<string, unknown>) => m.depends_on_medicine_id === medicine.id)
      .map((m: Record<string, unknown>) => m.id as string)
  );

  const prerequisiteId = medicine.depends_on_medicine_id;

  const otherLogIds = (logs || [])
    .filter((l) =>
      l.medicine_id !== medicine.id &&
      !dependentIds.has(l.medicine_id) &&
      l.medicine_id !== prerequisiteId
    )
    .map((l) => l.id);
  if (otherLogIds.length === 0) return;

  const { data: otherSlots } = await supabase
    .from('dose_slots')
    .select('*')
    .in('daily_log_id', otherLogIds)
    .eq('status', 'pending');

  if (!otherSlots || otherSlots.length === 0) return;

  const takenTime = parseTimeToMinutes(checkedInSlot.taken_at || checkedInSlot.scheduled_time);
  const defaultBuffer = medicine.inter_med_default_buffer_mins || 60;

  for (const otherSlot of otherSlots) {
    const specificBuffer = medicine.inter_med_buffers?.find((b) => b.target_medicine_id === otherSlot.medicine_id);
    const buffer = specificBuffer
      ? Math.max(specificBuffer.buffer_before_mins, specificBuffer.buffer_after_mins)
      : defaultBuffer;

    const slotTime = parseTimeToMinutes(otherSlot.scheduled_time);
    const diff = Math.abs(takenTime - slotTime);

    if (diff < buffer) {
      const newTime = addMinutesToTime(otherSlot.scheduled_time, buffer - diff + 1);
      const delayText = getDelayText(otherSlot.original_time, newTime);
      await supabase
        .from('dose_slots')
        .update({ scheduled_time: newTime, delay_text: delayText })
        .eq('id', otherSlot.id);
    }
  }
}

async function getLogDate(logId: string): Promise<string> {
  const { data } = await supabase
    .from('daily_med_logs')
    .select('date')
    .eq('id', logId)
    .single();
  return data?.date || todayStr();
}

export async function delayDoseSlot(
  slot: DoseSlot,
  delayMins: number,
  medicine: Medicine
): Promise<{ updatedSlot: DoseSlot; warning: string | null }> {
  const logDate = await getLogDate(slot.daily_log_id);
  const otherSlotsCtx = await fetchAllDoseSlotsContextForDate(logDate, medicine.id);
  const result = delaySlot(slot, delayMins, medicine, otherSlotsCtx);

  const { data: updated, error } = await supabase
    .from('dose_slots')
    .update({
      scheduled_time: result.newTime,
      delay_text: getDelayText(slot.original_time, result.newTime),
    })
    .eq('id', slot.id)
    .select()
    .single();
  if (error) throw error;

  await recascadeDependents(medicine, logDate);

  return {
    updatedSlot: updated as DoseSlot,
    warning: result.clamped ? 'Cutoff reached. Dose moved to latest allowed time.' : null,
  };
}

export async function skipDoseSlot(slotId: string): Promise<void> {
  await supabase
    .from('dose_slots')
    .update({ status: 'skipped' })
    .eq('id', slotId);
}

export async function addCustomDoseSlot(
  dailyLogId: string,
  medicineId: string,
  time: string,
  maxDoses: number
): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .from('dose_slots')
    .select('id')
    .eq('daily_log_id', dailyLogId);
  if ((existing || []).length >= maxDoses) {
    return { error: `Maximum ${maxDoses} doses reached for today.` };
  }

  const { data: existingSlots } = await supabase
    .from('dose_slots')
    .select('dose_number')
    .eq('daily_log_id', dailyLogId)
    .order('dose_number', { ascending: false })
    .limit(1);

  const nextDoseNum = (existingSlots && existingSlots.length > 0 ? existingSlots[0].dose_number : 0) + 1;

  const { error } = await supabase.from('dose_slots').insert({
    daily_log_id: dailyLogId,
    medicine_id: medicineId,
    dose_number: nextDoseNum,
    scheduled_time: time,
    original_time: time,
    status: 'pending',
    is_custom_added: true,
    is_anchored: false,
  });

  return { error: error?.message || null };
}

export async function recreateScheduleForDate(
  medicine: Medicine,
  schedule: PhaseSchedule,
  date: string
): Promise<{ warning: string | null }> {
  const existingLog = await fetchDailyLog(medicine.id, date);
  if (existingLog) {
    await supabase.from('dose_slots').delete().eq('daily_log_id', existingLog.id);
    await supabase.from('daily_med_logs').delete().eq('id', existingLog.id);
  }

  const allSlots = await fetchAllDoseSlotsContextForDate(date, medicine.id);
  const initialSlots = generateInitialSlots(medicine, schedule, allSlots);

  const { data: newLog, error: logError } = await supabase
    .from('daily_med_logs')
    .insert({
      medicine_id: medicine.id,
      schedule_id: schedule.id,
      date,
      first_dose_time: null,
      status: 'pending',
    })
    .select()
    .single();
  if (logError) throw logError;

  const slotInserts = initialSlots.map((s, i) => ({
    daily_log_id: newLog.id,
    medicine_id: medicine.id,
    dose_number: i + 1,
    scheduled_time: s.time,
    original_time: s.time,
    status: 'pending',
    is_anchored: schedule.schedule_type === 'fixed_times' && schedule.fixed_times_list?.[i]?.is_anchored || false,
    is_custom_added: false,
  }));

  if (slotInserts.length > 0) {
    const { error: slotError } = await supabase.from('dose_slots').insert(slotInserts);
    if (slotError) throw slotError;
  }

  return {
    warning: initialSlots.some((s) => s.clamped) ? 'Cutoff reached. Required spacing exceeds latest allowed time.' : null,
  };
}

export async function createMedicine(
  medicine: Omit<Medicine, 'id' | 'created_at' | 'is_archived'>,
  phases: Omit<PhaseSchedule, 'id' | 'medicine_id'>[]
): Promise<Medicine> {
  const { data: medData, error: medError } = await supabase
    .from('medicines')
    .insert({
      name: medicine.name,
      dosage_instructions: medicine.dosage_instructions,
      earliest_allowed: medicine.earliest_allowed,
      latest_allowed: medicine.latest_allowed,
      min_interval_hours: medicine.min_interval_hours,
      inter_med_default_buffer_mins: medicine.inter_med_default_buffer_mins,
      blackout_windows: medicine.blackout_windows || [],
      inter_med_buffers: medicine.inter_med_buffers || [],
      sequence_order: medicine.sequence_order ?? 1,
      depends_on_medicine_id: medicine.depends_on_medicine_id ?? null,
      min_gap_after_prerequisite_mins: medicine.min_gap_after_prerequisite_mins ?? 60,
      start_trigger_mode: medicine.start_trigger_mode ?? 'dynamic_first_checkin',
      is_archived: false,
    })
    .select()
    .single();
  if (medError) throw medError;

  const newMed = medData as Medicine;

  if (phases.length > 0) {
    const phaseInserts = phases.map((p) => ({
      medicine_id: newMed.id,
      phase_name: p.phase_name,
      start_date: p.start_date,
      end_date: p.end_date,
      times_per_day: p.times_per_day,
      schedule_type: p.schedule_type,
      fixed_times_list: p.fixed_times_list || [],
    }));
    const { error: phaseError } = await supabase.from('phase_schedules').insert(phaseInserts);
    if (phaseError) throw phaseError;
  }

  return newMed;
}

export async function updateMedicine(
  id: string,
  updates: Partial<Medicine>,
  phases: Omit<PhaseSchedule, 'id' | 'medicine_id'>[]
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.dosage_instructions !== undefined) updateData.dosage_instructions = updates.dosage_instructions;
  if (updates.earliest_allowed !== undefined) updateData.earliest_allowed = updates.earliest_allowed;
  if (updates.latest_allowed !== undefined) updateData.latest_allowed = updates.latest_allowed;
  if (updates.min_interval_hours !== undefined) updateData.min_interval_hours = updates.min_interval_hours;
  if (updates.inter_med_default_buffer_mins !== undefined) updateData.inter_med_default_buffer_mins = updates.inter_med_default_buffer_mins;
  if (updates.blackout_windows !== undefined) updateData.blackout_windows = updates.blackout_windows;
  if (updates.inter_med_buffers !== undefined) updateData.inter_med_buffers = updates.inter_med_buffers;
  if (updates.sequence_order !== undefined) updateData.sequence_order = updates.sequence_order;
  if (updates.depends_on_medicine_id !== undefined) updateData.depends_on_medicine_id = updates.depends_on_medicine_id;
  if (updates.min_gap_after_prerequisite_mins !== undefined) updateData.min_gap_after_prerequisite_mins = updates.min_gap_after_prerequisite_mins;
  if (updates.start_trigger_mode !== undefined) updateData.start_trigger_mode = updates.start_trigger_mode;
  if (updates.is_archived !== undefined) updateData.is_archived = updates.is_archived;

  const { error } = await supabase.from('medicines').update(updateData).eq('id', id);
  if (error) throw error;

  const { data: existingPhases } = await supabase
    .from('phase_schedules')
    .select('id')
    .eq('medicine_id', id);
  if (existingPhases && existingPhases.length > 0) {
    await supabase.from('phase_schedules').delete().eq('medicine_id', id);
  }

  if (phases.length > 0) {
    const phaseInserts = phases.map((p) => ({
      medicine_id: id,
      phase_name: p.phase_name,
      start_date: p.start_date,
      end_date: p.end_date,
      times_per_day: p.times_per_day,
      schedule_type: p.schedule_type,
      fixed_times_list: p.fixed_times_list || [],
    }));
    const { error: phaseError } = await supabase.from('phase_schedules').insert(phaseInserts);
    if (phaseError) throw phaseError;
  }
}

export async function archiveMedicine(id: string): Promise<void> {
  const { error } = await supabase.from('medicines').update({ is_archived: true }).eq('id', id);
  if (error) throw error;
}

export async function deleteMedicine(id: string): Promise<void> {
  const { error } = await supabase.from('medicines').delete().eq('id', id);
  if (error) throw error;
}

export async function startDayForMedicine(
  medicine: Medicine,
  schedule: PhaseSchedule,
  userId: string,
  date: string,
  customTime?: string
): Promise<{ warning: string | null }> {
  const log = await fetchDailyLog(medicine.id, date);
  if (!log) throw new Error('No daily log found. Please refresh and try again.');

  const existingSlots = await fetchDoseSlots(log.id);
  if (existingSlots.some((s) => s.status === 'taken')) {
    throw new Error('First dose already taken for today.');
  }

  const firstDoseTime = customTime || getCurrentTimeStr();

  await supabase.from('dose_slots').delete().eq('daily_log_id', log.id);

  await supabase
    .from('daily_med_logs')
    .update({ first_dose_time: firstDoseTime, status: 'in_progress' })
    .eq('id', log.id);

  const { data: dose1, error: dose1Error } = await supabase
    .from('dose_slots')
    .insert({
      daily_log_id: log.id,
      medicine_id: medicine.id,
      dose_number: 1,
      scheduled_time: firstDoseTime,
      original_time: firstDoseTime,
      status: 'taken',
      taken_at: firstDoseTime,
      checked_in_by_user_id: userId,
      is_anchored: false,
      is_custom_added: false,
      delay_text: null,
    })
    .select()
    .single();
  if (dose1Error) throw dose1Error;

  let warning: string | null = null;

  const remainingCount = schedule.times_per_day - 1;
  if (remainingCount > 0) {
    const otherSlotsCtx = await fetchAllDoseSlotsContextForDate(date, medicine.id);
    const latest = parseTimeToMinutes(medicine.latest_allowed);
    const minIntervalMins = (medicine.min_interval_hours || 3) * 60;
    const firstDoseMin = parseTimeToMinutes(firstDoseTime);
    const window = latest - firstDoseMin;
    const equalGap = remainingCount > 0 ? window / remainingCount : 0;
    // Backward planning: flex below min interval to fit all doses before cutoff
    const fitsWithMinInterval = (firstDoseMin + remainingCount * minIntervalMins) <= latest;
    const requiredGap = fitsWithMinInterval ? Math.max(equalGap, minIntervalMins) : equalGap;
    const gapClamped = !fitsWithMinInterval;

    const slotInserts: Record<string, unknown>[] = [];
    let prevTime = firstDoseMin;

    for (let i = 0; i < remainingCount; i++) {
      const proposed = prevTime + requiredGap;
      const clamped = proposed > latest || (gapClamped && i === remainingCount - 1);
      const slotTime = clamped ? latest : proposed;
      const timeStr = minutesToTimeStrForExport(slotTime);
      slotInserts.push({
        daily_log_id: log.id,
        medicine_id: medicine.id,
        dose_number: i + 2,
        scheduled_time: timeStr,
        original_time: timeStr,
        status: 'pending',
        taken_at: null,
        is_anchored: false,
        is_custom_added: false,
        delay_text: null,
      });
      prevTime = slotTime;
      if (clamped || gapClamped) warning = 'Cutoff reached. Required spacing exceeds latest allowed time. Doses spaced equally to fit before cutoff.';
    }

    if (slotInserts.length > 0) {
      const { error: slotError } = await supabase.from('dose_slots').insert(slotInserts);
      if (slotError) throw slotError;
    }
  }

  if (schedule.times_per_day <= 1) {
    await supabase
      .from('daily_med_logs')
      .update({ status: 'completed' })
      .eq('id', log.id);
  }

  await cascadeActivateDependents(medicine, firstDoseTime, date);

  return { warning };
}

async function cascadeActivateDependents(
  parentMedicine: Medicine,
  parentFirstDoseTime: string,
  date: string
): Promise<void> {
  await recascadeDependents(parentMedicine, date);
}

async function recascadeDependents(
  parentMedicine: Medicine,
  date: string
): Promise<void> {
  const { data: allMeds } = await supabase
    .from('medicines')
    .select('*')
    .eq('is_archived', false);

  if (!allMeds) return;

  const dependents = allMeds.filter(
    (m: Record<string, unknown>) => m.depends_on_medicine_id === parentMedicine.id
  );
  if (dependents.length === 0) return;

  const parentLog = await fetchDailyLog(parentMedicine.id, date);
  if (!parentLog) return;
  const parentSlots = await fetchDoseSlots(parentLog.id);
  const parentDoses = parentSlots.filter((s) => s.status === 'taken' || s.status === 'pending');

  for (const depRaw of dependents) {
    const dep = normalizeMedicine(depRaw as Record<string, unknown>);
    const depLog = await fetchDailyLog(dep.id, date);
    if (!depLog) continue;

    const existingDepSlots = await fetchDoseSlots(depLog.id);
    if (existingDepSlots.some((s) => s.status === 'taken')) continue;

    const gapMins = dep.min_gap_after_prerequisite_mins || 30;
    const depLatest = parseTimeToMinutes(dep.latest_allowed);
    const depEarliest = parseTimeToMinutes(dep.earliest_allowed);
    const depMinInterval = (dep.min_interval_hours || 3) * 60;

    const depSchedules = await fetchPhaseSchedules(dep.id);
    const depSchedule = depSchedules.find((s) => date >= s.start_date && date <= s.end_date);
    if (!depSchedule) continue;

    const depCount = depSchedule.times_per_day;

    await supabase.from('dose_slots').delete().eq('daily_log_id', depLog.id);

    const depInserts: Record<string, unknown>[] = [];

    // Backward planning for dependents: if there's a parent dose to anchor to,
    // use the gap after that parent dose. For remaining doses, equal-space them
    // within the remaining window, flexing below min interval if needed.
    let lastDepTime = depEarliest;

    for (let i = 0; i < depCount; i++) {
      const parentDose = parentDoses[i];
      let proposed: number;

      if (parentDose) {
        const parentTime = parseTimeToMinutes(
          parentDose.taken_at || parentDose.scheduled_time
        );
        proposed = parentTime + gapMins;
      } else {
        // No matching parent dose — equal-space from last dep time
        const remainingDeps = depCount - i;
        const remainingWindow = depLatest - lastDepTime;
        const equalDepGap = remainingDeps > 1 ? remainingWindow / remainingDeps : depMinInterval;
        const fitsDep = (lastDepTime + remainingDeps * depMinInterval) <= depLatest;
        const depGap = fitsDep ? Math.max(equalDepGap, depMinInterval) : equalDepGap;
        proposed = lastDepTime + depGap;
      }

      proposed = Math.max(proposed, depEarliest);
      if (i > 0) {
        proposed = Math.max(proposed, lastDepTime + 1);
      }

      const clamped = proposed > depLatest;
      const slotTime = clamped ? depLatest : proposed;

      const timeStr = minutesToTimeStrForExport(slotTime);
      depInserts.push({
        daily_log_id: depLog.id,
        medicine_id: dep.id,
        dose_number: i + 1,
        scheduled_time: timeStr,
        original_time: timeStr,
        status: 'pending',
        taken_at: null,
        is_anchored: false,
        is_custom_added: false,
        delay_text: `After ${parentMedicine.name}`,
      });

      lastDepTime = slotTime;
    }

    if (depInserts.length > 0) {
      const { error } = await supabase.from('dose_slots').insert(depInserts);
      if (error) throw error;
    }
  }
}

export async function checkPrerequisiteMet(
  medicine: Medicine,
  date: string
): Promise<{ met: boolean; prerequisiteMedName: string | null; prerequisiteTakenTime: string | null; waitUntilTime: string | null }> {
  if (!medicine.depends_on_medicine_id) {
    return { met: true, prerequisiteMedName: null, prerequisiteTakenTime: null, waitUntilTime: null };
  }

  const { data: prereqMed } = await supabase
    .from('medicines')
    .select('name')
    .eq('id', medicine.depends_on_medicine_id)
    .maybeSingle();

  const prereqName = prereqMed?.name || 'the prerequisite medication';

  const prereqLog = await fetchDailyLog(medicine.depends_on_medicine_id, date);
  if (!prereqLog || !prereqLog.first_dose_time) {
    return { met: false, prerequisiteMedName: prereqName, prerequisiteTakenTime: null, waitUntilTime: null };
  }

  const takenMinutes = parseTimeToMinutes(prereqLog.first_dose_time);
  const waitMinutes = medicine.min_gap_after_prerequisite_mins || 60;
  const waitUntil = takenMinutes + waitMinutes;
  const now = getCurrentTimeMinutes();

  if (now < waitUntil) {
    return {
      met: false,
      prerequisiteMedName: prereqName,
      prerequisiteTakenTime: prereqLog.first_dose_time,
      waitUntilTime: minutesToTimeStrForExport(waitUntil),
    };
  }

  return {
    met: true,
    prerequisiteMedName: prereqName,
    prerequisiteTakenTime: prereqLog.first_dose_time,
    waitUntilTime: null,
  };
}

function minutesToTimeStrForExport(minutes: number): string {
  let m = Math.round(minutes) % 1440;
  if (m < 0) m += 1440;
  let hours = Math.floor(m / 60);
  const mins = m % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  let displayHours = hours % 12;
  if (displayHours === 0) displayHours = 12;
  return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
}

export async function updatePendingSlotTime(
  slot: DoseSlot,
  newTime: string,
  medicine: Medicine,
  schedule: PhaseSchedule
): Promise<{ warning: string | null }> {
  const { error } = await supabase
    .from('dose_slots')
    .update({
      scheduled_time: newTime,
      delay_text: getDelayText(slot.original_time, newTime),
    })
    .eq('id', slot.id);
  if (error) throw error;

  const allSlots = await fetchDoseSlots(slot.daily_log_id);
  const { data: log } = await supabase
    .from('daily_med_logs')
    .select('*')
    .eq('id', slot.daily_log_id)
    .single();
  if (!log) throw new Error('Daily log not found');

  let warning: string | null = null;
  const pendingSlots = allSlots.filter((s) => s.status === 'pending' && s.id !== slot.id);
  if (pendingSlots.length > 0 && log.first_dose_time) {
    const otherSlotsCtx = await fetchAllDoseSlotsContextForDate(log.date, medicine.id);
    const allSlotsWithUpdate = allSlots.map((s) =>
      s.id === slot.id ? { ...s, scheduled_time: newTime } : s
    );
    const updates = recalculateRemainingSlots(medicine, schedule, allSlotsWithUpdate, otherSlotsCtx, log.first_dose_time);
    for (const update of updates) {
      if (update.id === slot.id) continue;
      const updateData: Record<string, unknown> = { scheduled_time: update.newTime };
      const origSlot = allSlots.find((s) => s.id === update.id);
      if (origSlot) {
        updateData.delay_text = getDelayText(origSlot.original_time, update.newTime);
      }
      if (update.clamped) warning = 'Cutoff reached. Doses spaced equally to fit before cutoff.';
      await supabase.from('dose_slots').update(updateData).eq('id', update.id);
    }
  }

  await recascadeDependents(medicine, log.date);
  return { warning };
}

export async function reorderSlot(
  slot: DoseSlot,
  direction: 'up' | 'down',
  medicine: Medicine,
  schedule: PhaseSchedule
): Promise<{ warning: string | null }> {
  const allSlots = await fetchDoseSlots(slot.daily_log_id);
  const pendingSlots = allSlots.filter((s) => s.status === 'pending');
  const sortedPending = [...pendingSlots].sort(
    (a, b) => parseTimeToMinutes(a.scheduled_time) - parseTimeToMinutes(b.scheduled_time)
  );

  const currentIdx = sortedPending.findIndex((s) => s.id === slot.id);
  if (currentIdx === -1) return { warning: null };

  const swapIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
  if (swapIdx < 0 || swapIdx >= sortedPending.length) return { warning: null };

  const swapSlot = sortedPending[swapIdx];
  const currentTime = parseTimeToMinutes(slot.scheduled_time);
  const swapTime = parseTimeToMinutes(swapSlot.scheduled_time);

  const newCurrentTime = minutesToTimeStrForExport(swapTime);
  const newSwapTime = minutesToTimeStrForExport(currentTime);

  await supabase
    .from('dose_slots')
    .update({
      scheduled_time: newCurrentTime,
      delay_text: getDelayText(slot.original_time, newCurrentTime),
    })
    .eq('id', slot.id);

  await supabase
    .from('dose_slots')
    .update({
      scheduled_time: newSwapTime,
      delay_text: getDelayText(swapSlot.original_time, newSwapTime),
    })
    .eq('id', swapSlot.id);

  const { data: log } = await supabase
    .from('daily_med_logs')
    .select('date')
    .eq('id', slot.daily_log_id)
    .single();
  if (log) await recascadeDependents(medicine, log.date);

  return { warning: null };
}

export async function editDoseLog(
  slot: DoseSlot,
  newTime: string | null,
  action: 'change_time' | 'revert_pending',
  medicine: Medicine,
  schedule: PhaseSchedule
): Promise<{ warning: string | null }> {
  if (action === 'revert_pending') {
    const { error } = await supabase
      .from('dose_slots')
      .update({ status: 'pending', taken_at: null, checked_in_by_user_id: null, delay_text: null })
      .eq('id', slot.id);
    if (error) throw error;
  } else if (action === 'change_time' && newTime) {
    const { error } = await supabase
      .from('dose_slots')
      .update({ taken_at: newTime, delay_text: getDelayText(slot.original_time, newTime) })
      .eq('id', slot.id);
    if (error) throw error;
  }

  let warning: string | null = null;

  const allSlots = await fetchDoseSlots(slot.daily_log_id);
  const { data: log } = await supabase
    .from('daily_med_logs')
    .select('*')
    .eq('id', slot.daily_log_id)
    .single();
  if (!log) throw new Error('Daily log not found');

  const pendingSlots = allSlots.filter((s) => s.status === 'pending');
  if (pendingSlots.length > 0 && log.first_dose_time) {
    const otherSlotsCtx = await fetchAllDoseSlotsContextForDate(log.date, medicine.id);
    const updates = recalculateRemainingSlots(medicine, schedule, allSlots, otherSlotsCtx, log.first_dose_time);
    for (const update of updates) {
      const updateData: Record<string, unknown> = { scheduled_time: update.newTime };
      const origSlot = allSlots.find((s) => s.id === update.id);
      if (origSlot) {
        updateData.delay_text = getDelayText(origSlot.original_time, update.newTime);
      }
      if (update.clamped) warning = 'Cutoff reached. Doses spaced equally to fit before cutoff.';
      await supabase.from('dose_slots').update(updateData).eq('id', update.id);
    }
  }

  await recascadeDependents(medicine, log.date);

  const takenCount = allSlots.filter((s) => s.status === 'taken').length;
  if (action === 'revert_pending') {
    await supabase
      .from('daily_med_logs')
      .update({ status: 'in_progress' })
      .eq('id', slot.daily_log_id);
  } else if (takenCount >= schedule.times_per_day) {
    await supabase
      .from('daily_med_logs')
      .update({ status: 'completed' })
      .eq('id', slot.daily_log_id);
  }

  return { warning };
}

export async function resetDayForAllMeds(
  medicines: Medicine[],
  schedulesMap: Record<string, PhaseSchedule[]>,
  date: string
): Promise<void> {
  const { data: logs } = await supabase
    .from('daily_med_logs')
    .select('id')
    .eq('date', date);
  if (!logs || logs.length === 0) return;

  const logIds = logs.map((l) => l.id);
  const { error: slotErr } = await supabase
    .from('dose_slots')
    .delete()
    .in('daily_log_id', logIds);
  if (slotErr) throw slotErr;

  const { error: logErr } = await supabase
    .from('daily_med_logs')
    .delete()
    .in('id', logIds);
  if (logErr) throw logErr;

  for (const med of medicines) {
    if (med.is_archived) continue;
    const schedules = schedulesMap[med.id] || [];
    const activeSchedule = schedules.find((s) => date >= s.start_date && date <= s.end_date);
    if (!activeSchedule) continue;

    const { data: newLog, error: newLogErr } = await supabase
      .from('daily_med_logs')
      .insert({
        medicine_id: med.id,
        schedule_id: activeSchedule.id,
        date,
        first_dose_time: null,
        status: 'pending',
      })
      .select()
      .single();
    if (newLogErr) throw newLogErr;

    if (med.start_trigger_mode === 'fixed_schedule') {
      const allSlots = await fetchAllDoseSlotsContextForDate(date, med.id);
      const initialSlots = generateInitialSlots(med, activeSchedule, allSlots);
      const slotInserts = initialSlots.map((s, i) => ({
        daily_log_id: newLog.id,
        medicine_id: med.id,
        dose_number: i + 1,
        scheduled_time: s.time,
        original_time: s.time,
        status: 'pending',
        taken_at: null,
        is_anchored: activeSchedule.schedule_type === 'fixed_times' && activeSchedule.fixed_times_list?.[i]?.is_anchored || false,
        is_custom_added: false,
        delay_text: null,
      }));
      if (slotInserts.length > 0) {
        const { error: slotErr2 } = await supabase.from('dose_slots').insert(slotInserts);
        if (slotErr2) throw slotErr2;
      }
    }
  }
}

export { getDueStatus };