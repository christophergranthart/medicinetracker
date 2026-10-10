import type { Medicine, PhaseSchedule, DoseSlot, DailyMedLog, BlackoutWindow } from '@/types';
import {
  parseTimeToMinutes,
  minutesToTimeStr,
  addMinutesToTime,
  getCurrentTimeMinutes,
} from './timeUtils';

interface AllSlotsContext {
  medicineId: string;
  scheduledTime: string;
  status: string;
  dailyLogId: string;
  doseNumber: number;
}

export function isInBlackout(timeMinutes: number, blackoutWindows: BlackoutWindow[]): boolean {
  for (const window of blackoutWindows) {
    const from = parseTimeToMinutes(window.from);
    const to = parseTimeToMinutes(window.to);
    if (timeMinutes >= from && timeMinutes <= to) return true;
  }
  return false;
}

function findBlackoutEnd(timeMinutes: number, blackoutWindows: BlackoutWindow[]): number | null {
  for (const window of blackoutWindows) {
    const from = parseTimeToMinutes(window.from);
    const to = parseTimeToMinutes(window.to);
    if (timeMinutes >= from && timeMinutes <= to) return to;
  }
  return null;
}

function getInterMedBuffer(medicine: Medicine, targetMedId: string): number {
  const specific = medicine.inter_med_buffers?.find((b) => b.target_medicine_id === targetMedId);
  if (specific) return Math.max(specific.buffer_before_mins, specific.buffer_after_mins);
  return medicine.inter_med_default_buffer_mins || 60;
}

function isDependencyPair(medicine: Medicine, otherMedId: string): boolean {
  if (medicine.depends_on_medicine_id === otherMedId) return true;
  return false;
}

function hasConflict(
  timeMinutes: number,
  medicine: Medicine,
  allOtherSlots: AllSlotsContext[]
): { conflict: boolean; conflictEndTime: number | null } {
  for (const slot of allOtherSlots) {
    if (slot.medicineId === medicine.id) continue;
    if (slot.status === 'taken' || slot.status === 'skipped') continue;

    if (isDependencyPair(medicine, slot.medicineId)) continue;

    const buffer = getInterMedBuffer(medicine, slot.medicineId);
    const slotTime = parseTimeToMinutes(slot.scheduledTime);
    const diff = Math.abs(timeMinutes - slotTime);
    if (diff < buffer) {
      const conflictEnd = Math.max(timeMinutes, slotTime) + buffer;
      return { conflict: true, conflictEndTime: conflictEnd };
    }
  }
  return { conflict: false, conflictEndTime: null };
}

function resolveTime(
  proposedTime: number,
  medicine: Medicine,
  allOtherSlots: AllSlotsContext[],
  latestAllowed: number
): { time: number; clamped: boolean } {
  let time = proposedTime;
  let clamped = false;
  let iterations = 0;

  while (iterations < 20) {
    iterations++;
    if (time > latestAllowed) {
      time = latestAllowed;
      clamped = true;
      break;
    }

    if (isInBlackout(time, medicine.blackout_windows || [])) {
      const blackoutEnd = findBlackoutEnd(time, medicine.blackout_windows || []);
      if (blackoutEnd !== null) {
        time = blackoutEnd;
        continue;
      }
    }

    const conflict = hasConflict(time, medicine, allOtherSlots);
    if (conflict.conflict && conflict.conflictEndTime !== null) {
      time = conflict.conflictEndTime;
      continue;
    }
    break;
  }

  if (time > latestAllowed) {
    time = latestAllowed;
    clamped = true;
  }

  return { time, clamped };
}

export function generateInitialSlots(
  medicine: Medicine,
  schedule: PhaseSchedule,
  allOtherSlots: AllSlotsContext[],
  prerequisiteTakenTime: string | null = null
): { time: string; clamped: boolean }[] {
  const earliest = parseTimeToMinutes(medicine.earliest_allowed);
  const latest = parseTimeToMinutes(medicine.latest_allowed);
  const count = schedule.times_per_day;

  let effectiveEarliest = earliest;
  if (medicine.depends_on_medicine_id && prerequisiteTakenTime) {
    const gapMins = medicine.min_gap_after_prerequisite_mins || 60;
    const prereqBasedStart = parseTimeToMinutes(prerequisiteTakenTime) + gapMins;
    effectiveEarliest = Math.max(earliest, prereqBasedStart);
  }

  if (schedule.schedule_type === 'fixed_times' && schedule.fixed_times_list?.length > 0) {
    return schedule.fixed_times_list.map((ft) => {
      const timeMin = parseTimeToMinutes(ft.time);
      const resolved = resolveTime(timeMin, medicine, allOtherSlots, latest);
      return { time: minutesToTimeStr(resolved.time), clamped: resolved.clamped };
    });
  }

  const window = latest - effectiveEarliest;
  const equalGap = count > 1 ? window / (count - 1) : 0;
  const minIntervalMins = (medicine.min_interval_hours || 3) * 60;
  // Backward planning: if equal spacing is tighter than min interval, flex down
  // to guarantee all doses fit before cutoff. Use min interval only when there's
  // enough room (equalGap >= minInterval).
  const actualGap = equalGap < minIntervalMins ? equalGap : minIntervalMins;
  const clamped = equalGap < minIntervalMins && count > 1;

  const slots: { time: string; clamped: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const proposed = effectiveEarliest + i * actualGap;
    const resolved = resolveTime(proposed, medicine, allOtherSlots, latest);
    slots.push({ time: minutesToTimeStr(resolved.time), clamped: resolved.clamped || (clamped && i === count - 1) });
  }
  return slots;
}

export function recalculateRemainingSlots(
  medicine: Medicine,
  schedule: PhaseSchedule,
  existingSlots: DoseSlot[],
  allOtherSlots: AllSlotsContext[],
  firstDoseTime: string
): { id: string; newTime: string; clamped: boolean }[] {
  const latest = parseTimeToMinutes(medicine.latest_allowed);
  const firstDoseMin = parseTimeToMinutes(firstDoseTime);
  const minIntervalMins = (medicine.min_interval_hours || 3) * 60;

  const takenSlots = existingSlots.filter((s) => s.status === 'taken');
  const pendingSlots = existingSlots.filter((s) => s.status === 'pending');
  const lastTakenTime = takenSlots.length > 0
    ? parseTimeToMinutes(takenSlots[takenSlots.length - 1].taken_at || takenSlots[takenSlots.length - 1].scheduled_time)
    : firstDoseMin;

  const remaining = pendingSlots.length;
  if (remaining === 0) return [];

  const window = latest - lastTakenTime;
  // Evenly distribute remaining doses across the window from last taken time to cutoff.
  // Use remaining (not remaining+1) so doses span the full window, not leaving a trailing gap.
  const equalGap = remaining > 0 ? window / remaining : 0;
  // Backward planning: prioritize fitting all remaining doses before cutoff.
  // Flex below min interval if equal spacing is tighter than the minimum.
  const fitsWithMinInterval = (lastTakenTime + remaining * minIntervalMins) <= latest;
  const requiredGap = fitsWithMinInterval ? Math.max(equalGap, minIntervalMins) : equalGap;
  const gapClamped = !fitsWithMinInterval;

  const updates: { id: string; newTime: string; clamped: boolean }[] = [];
  let prevTime = lastTakenTime;

  for (const slot of pendingSlots) {
    if (slot.is_anchored) {
      const resolved = resolveTime(parseTimeToMinutes(slot.original_time), medicine, allOtherSlots, latest);
      updates.push({ id: slot.id, newTime: minutesToTimeStr(resolved.time), clamped: resolved.clamped });
      prevTime = resolved.time;
      continue;
    }

    const proposed = prevTime + requiredGap;
    const resolved = resolveTime(proposed, medicine, allOtherSlots, latest);
    updates.push({ id: slot.id, newTime: minutesToTimeStr(resolved.time), clamped: resolved.clamped || gapClamped });
    prevTime = resolved.time;
  }

  return updates;
}

export function delaySlot(
  slot: DoseSlot,
  delayMins: number,
  medicine: Medicine,
  allOtherSlots: AllSlotsContext[]
): { newTime: string; clamped: boolean } {
  const latest = parseTimeToMinutes(medicine.latest_allowed);
  const currentMin = parseTimeToMinutes(slot.scheduled_time);
  const proposed = currentMin + delayMins;
  const resolved = resolveTime(proposed, medicine, allOtherSlots, latest);
  return { newTime: minutesToTimeStr(resolved.time), clamped: resolved.clamped };
}

export function cascadeShiftOtherMeds(
  checkedInSlot: DoseSlot,
  medicine: Medicine,
  allOtherPendingSlots: AllSlotsContext[]
): { id: string; newTime: string; medicineId: string }[] {
  const takenTime = parseTimeToMinutes(checkedInSlot.taken_at || checkedInSlot.scheduled_time);
  const shifts: { id: string; newTime: string; medicineId: string }[] = [];

  for (const slot of allOtherPendingSlots) {
    if (slot.medicineId === medicine.id) continue;
    if (slot.status !== 'pending') continue;

    if (isDependencyPair(medicine, slot.medicineId)) continue;

    const buffer = getInterMedBuffer(medicine, slot.medicineId);
    const slotTime = parseTimeToMinutes(slot.scheduledTime);
    const diff = Math.abs(takenTime - slotTime);

    if (diff < buffer) {
      const newTime = takenTime + buffer;
      shifts.push({
        id: slot.dailyLogId + '_' + slot.doseNumber,
        newTime: minutesToTimeStr(newTime),
        medicineId: slot.medicineId,
      });
    }
  }

  return shifts;
}

export function getDueStatus(scheduledTime: string): 'due_now' | 'upcoming' | 'overdue' {
  const now = getCurrentTimeMinutes();
  const scheduled = parseTimeToMinutes(scheduledTime);
  const diff = scheduled - now;
  if (diff <= -15) return 'overdue';
  if (diff <= 15) return 'due_now';
  return 'upcoming';
}
