import { useState, useMemo } from 'react';
import { Pill, Calendar, CircleCheck as CheckCircle2, Clock, TriangleAlert as AlertTriangle, RotateCcw, Check, ChevronDown, ChevronLeft, ChevronRight, Pencil, Ban, ListOrdered, GitBranch, Rocket, X, Trash2, Tablets } from 'lucide-react';
import type { Medicine, PhaseSchedule, DoseSlot, DailyMedLog } from '@/types';
import {
  checkInDose,
  delayDoseSlot,
  skipDoseSlot,
  checkPrerequisiteMet,
  startDayForMedicine,
  editDoseLog,
  resetDayForAllMeds,
} from '@/lib/dataService';
import {
  formatDateStr,
  parseTimeToMinutes,
  formatTime,
} from '@/lib/timeUtils';
import { getDueStatus } from '@/lib/schedulingEngine';
import { showToast } from '@/components/Toast';
import { playSelectedTone, sendLocalNotification } from '@/lib/notifications';

interface DashboardProps {
  medicines: Medicine[];
  schedulesMap: Record<string, PhaseSchedule[]>;
  slotsMap: Record<string, DoseSlot[]>;
  logsMap: Record<string, DailyMedLog>;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onEditMedicine: (medicine: Medicine) => void;
  onRefresh: () => void;
  userId: string;
}

interface PrerequisiteDialogState {
  open: boolean;
  prerequisiteMedName: string | null;
  waitUntilTime: string | null;
  pendingSlot: DoseSlot | null;
  pendingMedicine: Medicine | null;
  pendingSchedule: PhaseSchedule | null;
}

interface EditLogDialogState {
  open: boolean;
  slot: DoseSlot | null;
  medicine: Medicine | null;
  schedule: PhaseSchedule | null;
  newTime: string;
}

interface TimelineEntry {
  slot: DoseSlot;
  medicine: Medicine;
  schedule: PhaseSchedule;
  doseNumberOfTotal: string;
  prerequisiteMedName: string | null;
}

export function Dashboard({
  medicines,
  schedulesMap,
  slotsMap,
  logsMap,
  selectedDate,
  onDateChange,
  onEditMedicine,
  onRefresh,
  userId,
}: DashboardProps) {
  const [delayMenuSlotId, setDelayMenuSlotId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [prereqDialog, setPrereqDialog] = useState<PrerequisiteDialogState>({
    open: false,
    prerequisiteMedName: null,
    waitUntilTime: null,
    pendingSlot: null,
    pendingMedicine: null,
    pendingSchedule: null,
  });
  const [checkingPrereq, setCheckingPrereq] = useState(false);
  const [showStartDayModal, setShowStartDayModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editDialog, setEditDialog] = useState<EditLogDialogState>({
    open: false,
    slot: null,
    medicine: null,
    schedule: null,
    newTime: '',
  });
  const [editSaving, setEditSaving] = useState(false);

  const activeMedicines = medicines.filter((m) => !m.is_archived);

  const { timeline, totalDoses, takenCount, isDayStarted } = useMemo(() => {
    const entries: TimelineEntry[] = [];
    let total = 0;
    let taken = 0;

    for (const med of activeMedicines) {
      const schedules = schedulesMap[med.id] || [];
      const activeSchedule = schedules.find(
        (s) => selectedDate >= s.start_date && selectedDate <= s.end_date
      );
      if (!activeSchedule) continue;

      const totalDosesForMed = activeSchedule.times_per_day;
      total += totalDosesForMed;
      const slots = slotsMap[med.id] || [];
      taken += slots.filter((s) => s.status === 'taken').length;

      if (slots.length === 0 && med.start_trigger_mode === 'dynamic_first_checkin') {
        continue;
      }

      for (const slot of slots) {
        const prereqMed = med.depends_on_medicine_id
          ? activeMedicines.find((m) => m.id === med.depends_on_medicine_id)
          : null;
        entries.push({
          slot,
          medicine: med,
          schedule: activeSchedule,
          doseNumberOfTotal: `${slot.dose_number}/${activeSchedule.times_per_day}`,
          prerequisiteMedName: prereqMed ? prereqMed.name : null,
        });
      }
    }

    entries.sort((a, b) => {
      const timeDiff = parseTimeToMinutes(a.slot.scheduled_time) - parseTimeToMinutes(b.slot.scheduled_time);
      if (timeDiff !== 0) return timeDiff;
      return a.slot.dose_number - b.slot.dose_number;
    });
    const dayStarted = entries.some((e) => e.slot.status === 'taken') || entries.some((e) => e.medicine.start_trigger_mode === 'fixed_schedule');

    return { timeline: entries, totalDoses: total, takenCount: taken, isDayStarted: dayStarted };
  }, [activeMedicines, schedulesMap, slotsMap, selectedDate]);

  const progressPercent = totalDoses > 0 ? Math.round((takenCount / totalDoses) * 100) : 0;

  const handleCheckIn = async (entry: TimelineEntry) => {
    const { slot, medicine, schedule } = entry;
    if (medicine.depends_on_medicine_id) {
      setCheckingPrereq(true);
      try {
        const prereq = await checkPrerequisiteMet(medicine, selectedDate);
        if (!prereq.met) {
          setPrereqDialog({
            open: true,
            prerequisiteMedName: prereq.prerequisiteMedName,
            waitUntilTime: prereq.waitUntilTime,
            pendingSlot: slot,
            pendingMedicine: medicine,
            pendingSchedule: schedule,
          });
          setCheckingPrereq(false);
          return;
        }
      } catch {
        // proceed on error
      }
      setCheckingPrereq(false);
    }
    await doCheckIn(slot, medicine, schedule);
  };

  const doCheckIn = async (slot: DoseSlot, medicine: Medicine, schedule: PhaseSchedule) => {
    try {
      const { warning } = await checkInDose(slot, medicine, schedule, userId);
      playSelectedTone();
      sendLocalNotification('Dose Checked In', `${medicine.name} - Dose ${slot.dose_number} taken at ${formatTime(slot.taken_at || slot.scheduled_time)}`);
      showToast('Dose checked in', 'success');
      if (warning) showToast(warning, 'error');
      onRefresh();
    } catch {
      showToast('Failed to check in dose', 'error');
    }
  };

  const handleOverridePrereq = async () => {
    const { pendingSlot, pendingMedicine, pendingSchedule } = prereqDialog;
    setPrereqDialog({ open: false, prerequisiteMedName: null, waitUntilTime: null, pendingSlot: null, pendingMedicine: null, pendingSchedule: null });
    if (pendingSlot && pendingMedicine && pendingSchedule) {
      await doCheckIn(pendingSlot, pendingMedicine, pendingSchedule);
    }
  };

  const handleDelay = async (entry: TimelineEntry, mins: number) => {
    try {
      const { warning } = await delayDoseSlot(entry.slot, mins, entry.medicine);
      showToast(`Delayed by ${mins >= 60 ? `${mins / 60}h` : `${mins}m`}`, 'success');
      if (warning) showToast(warning, 'error');
      setDelayMenuSlotId(null);
      onRefresh();
    } catch {
      showToast('Failed to delay dose', 'error');
    }
  };

  const handleSkip = async (slotId: string) => {
    try {
      await skipDoseSlot(slotId);
      showToast('Dose skipped', 'info');
      setDelayMenuSlotId(null);
      onRefresh();
    } catch {
      showToast('Failed to skip dose', 'error');
    }
  };

  const handleStartDay = async (medicine: Medicine) => {
    const schedules = schedulesMap[medicine.id] || [];
    const activeSchedule = schedules.find(
      (s) => selectedDate >= s.start_date && selectedDate <= s.end_date
    );
    if (!activeSchedule) {
      showToast('No active schedule for this medication', 'error');
      return;
    }
    try {
      const { warning } = await startDayForMedicine(medicine, activeSchedule, userId, selectedDate);
      showToast(`Day started with ${medicine.name}`, 'success');
      if (warning) showToast(warning, 'error');
      setShowStartDayModal(false);
      onRefresh();
    } catch {
      showToast('Failed to start day', 'error');
    }
  };

  const handleEditLog = async (action: 'change_time' | 'revert_pending') => {
    if (!editDialog.slot || !editDialog.medicine || !editDialog.schedule) return;
    setEditSaving(true);
    try {
      const { warning } = await editDoseLog(
        editDialog.slot,
        action === 'change_time' ? editDialog.newTime : null,
        action,
        editDialog.medicine,
        editDialog.schedule
      );
      showToast(action === 'revert_pending' ? 'Dose reverted to pending' : 'Log updated', 'success');
      if (warning) showToast(warning, 'error');
      setEditDialog({ open: false, slot: null, medicine: null, schedule: null, newTime: '' });
      onRefresh();
    } catch {
      showToast('Failed to update log', 'error');
    }
    setEditSaving(false);
  };

  const handleResetDay = async () => {
    setResetting(true);
    try {
      await resetDayForAllMeds(activeMedicines, schedulesMap, selectedDate);
      showToast('Today has been reset', 'success');
      setShowResetConfirm(false);
      onRefresh();
    } catch {
      showToast('Failed to reset day', 'error');
    }
    setResetting(false);
  };

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const openEditDialog = (entry: TimelineEntry) => {
    const time24 = convertTo24Hour(entry.slot.taken_at || entry.slot.scheduled_time);
    setEditDialog({
      open: true,
      slot: entry.slot,
      medicine: entry.medicine,
      schedule: entry.schedule,
      newTime: time24,
    });
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-2xl mx-auto px-2.5 pt-2 pb-24">
      {/* Date Selector Row */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => changeDate(-1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200/80 shadow-card hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
        </button>

        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="flex-1 mx-1.5 flex items-center justify-center gap-1.5 bg-white border border-slate-200/80 rounded-lg py-1.5 shadow-card hover:bg-slate-50 transition-colors relative"
        >
          <Calendar className="w-3 h-3 text-med-600" />
          <span className="text-[11px] font-semibold text-slate-700">
            {isToday ? 'Today' : formatDateStr(selectedDate)}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
          {showDatePicker && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl border border-slate-200 shadow-lg p-3 z-30 animate-slide-down min-w-[260px]">
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    onDateChange(e.target.value);
                    setShowDatePicker(false);
                  }}
                  className="input-field text-sm py-1.5 flex-1"
                />
              </div>
              <button
                onClick={() => {
                  onDateChange(new Date().toISOString().split('T')[0]);
                  setShowDatePicker(false);
                }}
                className="w-full text-sm font-medium text-med-600 py-2 hover:bg-med-50 rounded-lg transition-colors"
              >
                Jump to Today
              </button>
            </div>
          )}
        </button>

        <button
          onClick={() => changeDate(1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200/80 shadow-card hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>

      {/* Progress / Status Banner */}
      {isDayStarted && totalDoses > 0 && (
        <div
          className="rounded-xl p-2.5 mb-2 shadow-card animate-slide-up relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)' }}
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-teal-100 text-[9px] font-semibold tracking-wider uppercase">Daily Progress</p>
                <p className="text-white text-sm font-bold mt-0.5">
                  {takenCount} <span className="text-teal-200 font-semibold">of</span> {totalDoses} Doses
                </p>
              </div>
              <div className="text-right">
                <span className="text-white text-xl font-bold tabular-nums">{progressPercent}%</span>
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Reset Day Button - only when day is started */}
      {isDayStarted && (
        <div className="flex justify-end mb-1.5">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50/50"
          >
            <RotateCcw className="w-3 h-3" />
            Clear &amp; Start Over
          </button>
        </div>
      )}

      {/* Empty State */}
      {activeMedicines.length === 0 ? (
        <div className="card p-8 text-center animate-fade-in">
          <div className="w-14 h-14 bg-med-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Tablets className="w-7 h-7 text-med-400" />
          </div>
          <h3 className="text-base font-bold text-slate-700">No medications yet</h3>
          <p className="text-slate-500 text-xs mt-1 mb-4">
            Go to the Medicines tab to add your first medication.
          </p>
        </div>
      ) : !isDayStarted ? (
        /* Unstarted State */
        <div className="space-y-2">
          <div className="card p-4 text-center animate-slide-up">
            <div className="w-12 h-12 bg-gradient-to-br from-med-50 to-teal-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Rocket className="w-6 h-6 text-med-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Schedule Not Started</h3>
            <p className="text-slate-500 text-[11px] mt-1.5 mb-3">
              <span className="font-bold text-med-600">{totalDoses}</span> Total Doses Scheduled for Today
            </p>
            <button
              onClick={() => setShowStartDayModal(true)}
              className="w-full bg-gradient-to-r from-med-600 to-teal-600 text-white rounded-lg py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 hover:shadow-float transition-all active:scale-[0.98] shadow-md"
            >
              <Rocket className="w-3.5 h-3.5" />
              Log First Dose of Day
            </button>
          </div>

          {timeline.length > 0 && (
            <div className="card p-2.5 animate-slide-up">
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Scheduled Preview</p>
              <div className="space-y-1.5">
                {timeline.slice(0, 8).map((entry) => (
                  <div key={entry.slot.id} className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400 font-semibold tabular-nums text-[10px] w-14">{formatTime(entry.slot.scheduled_time)}</span>
                    <div className="w-5 h-5 bg-med-50 rounded-md flex items-center justify-center flex-shrink-0">
                      <Pill className="w-2.5 h-2.5 text-med-500" />
                    </div>
                    <span className="text-slate-700 font-medium truncate flex-1 text-[11px]">{entry.medicine.name}</span>
                    <span className="text-slate-400 text-[10px] font-medium">{entry.doseNumberOfTotal}</span>
                  </div>
                ))}
                {timeline.length > 8 && (
                  <p className="text-[11px] text-slate-400 text-center pt-0.5 font-medium">
                    +{timeline.length - 8} more doses
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : timeline.length === 0 ? (
        <div className="card p-5 text-center animate-fade-in">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="text-sm font-bold text-slate-700">All caught up!</h3>
          <p className="text-slate-500 text-xs mt-1">No pending doses remaining for today.</p>
        </div>
      ) : (
        /* Active State - Unified Master Timeline */
        <div className="card p-2.5 animate-slide-up">
          <div className="relative">
            {timeline.map((entry, idx) => (
              <TimelineNode
                key={entry.slot.id}
                entry={entry}
                isLast={idx === timeline.length - 1}
                delayMenuOpen={delayMenuSlotId === entry.slot.id}
                checkingPrereq={checkingPrereq}
                onToggleDelayMenu={() =>
                  setDelayMenuSlotId(delayMenuSlotId === entry.slot.id ? null : entry.slot.id)
                }
                onCheckIn={() => handleCheckIn(entry)}
                onDelay={(mins) => handleDelay(entry, mins)}
                onSkip={() => handleSkip(entry.slot.id)}
                onEdit={() => openEditDialog(entry)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Prerequisite Reminder Dialog */}
      {prereqDialog.open && (
        <DialogOverlay onClose={() => setPrereqDialog({ ...prereqDialog, open: false })}>
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 text-center mb-2">Recommended Order</h3>
          <p className="text-sm text-slate-600 text-center mb-5 leading-relaxed">
            Please take <span className="font-semibold text-slate-800">{prereqDialog.prerequisiteMedName}</span> first,
            {prereqDialog.waitUntilTime
              ? <> then wait until <span className="font-semibold text-amber-600">{formatTime(prereqDialog.waitUntilTime)}</span> before taking this dose.</>
              : ' then wait before taking this dose.'
            }
          </p>
          <div className="flex gap-3">
            <button onClick={() => setPrereqDialog({ ...prereqDialog, open: false })} className="btn-secondary flex-1 text-sm">
              Go Back
            </button>
            <button
              onClick={handleOverridePrereq}
              className="flex-1 bg-med-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-med-700 transition-colors active:scale-95"
            >
              Take Anyway
            </button>
          </div>
        </DialogOverlay>
      )}

      {/* Start Day Modal - Medicine Picker */}
      {showStartDayModal && (
        <DialogOverlay onClose={() => setShowStartDayModal(false)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">Which medication first?</h3>
            <button onClick={() => setShowStartDayModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-hide">
            {activeMedicines.map((med) => {
              const schedules = schedulesMap[med.id] || [];
              const activeSchedule = schedules.find(
                (s) => selectedDate >= s.start_date && selectedDate <= s.end_date
              );
              if (!activeSchedule) return null;
              const log = logsMap[med.id];
              const isDependentWaiting = med.depends_on_medicine_id !== null &&
                (!logsMap[med.depends_on_medicine_id!] || !logsMap[med.depends_on_medicine_id!].first_dose_time);
              return (
                <button
                  key={med.id}
                  onClick={() => handleStartDay(med)}
                  disabled={isDependentWaiting}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-med-300 hover:bg-med-50/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-med-50 to-teal-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Pill className="w-5 h-5 text-med-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{med.name}</p>
                    <p className="text-xs text-slate-500">
                      {activeSchedule.times_per_day} doses today
                      {isDependentWaiting && ' \u00b7 waiting for prerequisite'}
                    </p>
                  </div>
                  {log?.first_dose_time && (
                    <span className="med-badge bg-emerald-100 text-emerald-700">Started</span>
                  )}
                </button>
              );
            })}
          </div>
        </DialogOverlay>
      )}

      {/* Reset Day Confirmation */}
      {showResetConfirm && (
        <DialogOverlay onClose={() => setShowResetConfirm(false)}>
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 text-center mb-2">Reset today's logs?</h3>
          <p className="text-sm text-slate-600 text-center mb-5 leading-relaxed">
            This will clear all checked-in doses for today and allow you to restart the schedule sequence.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setShowResetConfirm(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button
              onClick={handleResetDay}
              disabled={resetting}
              className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-600 transition-colors active:scale-95 disabled:opacity-60"
            >
              {resetting ? 'Resetting...' : 'Clear & Start Over'}
            </button>
          </div>
        </DialogOverlay>
      )}

      {/* Edit Log Dialog */}
      {editDialog.open && editDialog.slot && editDialog.medicine && (
        <DialogOverlay onClose={() => setEditDialog({ ...editDialog, open: false })}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-800">Edit Dose Log</h3>
            <button onClick={() => setEditDialog({ ...editDialog, open: false })} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Pill className="w-4 h-4 text-med-600" />
              <span className="font-semibold text-slate-800 text-sm">{editDialog.medicine.name}</span>
            </div>
            <p className="text-xs text-slate-500">
              Dose #{editDialog.slot.dose_number} &middot; Scheduled at {formatTime(editDialog.slot.scheduled_time)}
              {editDialog.slot.taken_at && ` &middot; Logged at ${formatTime(editDialog.slot.taken_at)}`}
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Change Timestamp</label>
            <input
              type="time"
              value={editDialog.newTime}
              onChange={(e) => setEditDialog({ ...editDialog, newTime: e.target.value })}
              className="input-field text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Update when this dose was actually taken.</p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => handleEditLog('change_time')}
              disabled={editSaving}
              className="w-full bg-med-600 text-white rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-med-700 transition-colors active:scale-[0.98] disabled:opacity-60"
            >
              <Check className="w-4 h-4" />
              {editSaving ? 'Saving...' : 'Update Timestamp'}
            </button>
            <button
              onClick={() => handleEditLog('revert_pending')}
              disabled={editSaving}
              className="w-full bg-white text-amber-600 border-2 border-amber-400 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-amber-50 transition-colors active:scale-[0.98] disabled:opacity-60"
            >
              <RotateCcw className="w-4 h-4" />
              Unmark / Revert to Pending
            </button>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}

function DialogOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full animate-scale-in shadow-2xl">
        {children}
      </div>
    </div>
  );
}

interface TimelineNodeProps {
  entry: TimelineEntry;
  isLast: boolean;
  delayMenuOpen: boolean;
  checkingPrereq: boolean;
  onToggleDelayMenu: () => void;
  onCheckIn: () => void;
  onDelay: (mins: number) => void;
  onSkip: () => void;
  onEdit: () => void;
}

function TimelineNode({
  entry,
  isLast,
  delayMenuOpen,
  checkingPrereq,
  onToggleDelayMenu,
  onCheckIn,
  onDelay,
  onSkip,
  onEdit,
}: TimelineNodeProps) {
  const { slot, medicine, doseNumberOfTotal } = entry;
  const isTaken = slot.status === 'taken';
  const isSkipped = slot.status === 'skipped';
  const isPending = slot.status === 'pending';
  const dueStatus = isPending ? getDueStatus(slot.scheduled_time) : null;

  const lineColor = isTaken ? 'bg-emerald-400' : isPending ? 'bg-med-300' : 'bg-slate-200';
  const badgeBg = isTaken
    ? 'bg-emerald-500'
    : isSkipped
    ? 'bg-slate-300'
    : dueStatus === 'due_now' || dueStatus === 'overdue'
    ? 'bg-med-500'
    : 'bg-med-200';

  return (
    <div className="relative flex gap-2.5 pb-2.5">
      {!isLast && <div className={`absolute left-[12px] top-7 bottom-0 w-0.5 ${lineColor}`} />}

      {/* Timeline Badge */}
      <div
        className={`w-6 h-6 rounded-full ${badgeBg} flex items-center justify-center flex-shrink-0 z-10 ${
          isPending && dueStatus === 'due_now' ? 'animate-pulse-soft' : ''
        }`}
      >
        {isTaken ? (
          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
        ) : isSkipped ? (
          <Ban className="w-3 h-3 text-white" />
        ) : (
          <div className={`w-2 h-2 rounded-full ${dueStatus === 'due_now' || dueStatus === 'overdue' ? 'bg-white' : 'bg-med-500'}`} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Time + Dose Number */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-700 tabular-nums">{formatTime(slot.scheduled_time)}</span>
          <span className="text-[10px] text-slate-400 font-medium">{doseNumberOfTotal}</span>
          {slot.delay_text && (
            <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1 py-0.5 rounded">
              {slot.delay_text}
            </span>
          )}
        </div>

        {/* Medicine Name + Tags */}
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <span className="font-semibold text-slate-800 text-xs">{medicine.name}</span>
          {medicine.sequence_order > 0 && (
            <span className="med-badge bg-teal-100 text-teal-700 inline-flex items-center gap-0.5">
              <ListOrdered className="w-2 h-2" />
              Step {medicine.sequence_order}
            </span>
          )}
          {medicine.depends_on_medicine_id && (
            <span className="med-badge bg-amber-100 text-amber-700 inline-flex items-center gap-0.5">
              <GitBranch className="w-2 h-2" />
              {entry.prerequisiteMedName ? `After ${entry.prerequisiteMedName}` : 'Sequenced'}
            </span>
          )}
        </div>

        {/* Status Tags */}
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          {isTaken && <span className="med-badge bg-emerald-100 text-emerald-700">Taken</span>}
          {isSkipped && <span className="med-badge bg-slate-200 text-slate-500">Skipped</span>}
          {isPending && dueStatus === 'due_now' && (
            <span className="med-badge bg-med-100 text-med-700 animate-pulse-soft">Due Now</span>
          )}
          {isPending && dueStatus === 'overdue' && (
            <span className="med-badge bg-amber-100 text-amber-700">Overdue</span>
          )}
          {isPending && dueStatus === 'upcoming' && (
            <span className="med-badge bg-slate-100 text-slate-500">Upcoming</span>
          )}
          {slot.is_custom_added && (
            <span className="text-[9px] font-medium text-med-600 bg-med-50 px-1 py-0.5 rounded">Custom</span>
          )}
        </div>

        {isTaken && slot.taken_at && (
          <p className="text-[10px] text-emerald-600 mt-0.5 font-medium flex items-center gap-0.5">
            <Check className="w-2.5 h-2.5" />
            Logged at {formatTime(slot.taken_at)}
          </p>
        )}

        {/* Action Buttons for Pending */}
        {isPending && (
          <div className="flex items-center gap-1.5 mt-1.5 relative">
            <button
              onClick={onCheckIn}
              disabled={checkingPrereq}
              className="bg-med-600 text-white rounded-lg px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1 hover:bg-med-700 transition-all active:scale-95 disabled:opacity-60"
            >
              {checkingPrereq ? (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-3 h-3" strokeWidth={3} />
                  Check-In
                </>
              )}
            </button>
            <div className="relative">
              <button
                onClick={onToggleDelayMenu}
                className="bg-white text-amber-600 border-2 border-amber-400 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold flex items-center gap-0.5 hover:bg-amber-50 transition-all active:scale-95"
              >
                <Clock className="w-3 h-3" />
                +30m
              </button>
              {delayMenuOpen && (
                <div className="absolute top-9 left-0 bg-white rounded-xl border border-slate-200 shadow-lg p-1.5 z-20 animate-slide-down min-w-[130px]">
                  <DelayMenuItem label="+15 min" onClick={() => onDelay(15)} />
                  <DelayMenuItem label="+30 min" onClick={() => onDelay(30)} />
                  <DelayMenuItem label="+1 hour" onClick={() => onDelay(60)} />
                  <DelayMenuItem label="+2 hours" onClick={() => onDelay(120)} />
                  <div className="h-px bg-slate-100 my-1" />
                  <button
                    onClick={onSkip}
                    className="w-full text-left px-2.5 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Skip Dose
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Edit button for Taken */}
        {isTaken && (
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-slate-400 hover:text-med-600 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Edit Log
          </button>
        )}
      </div>
    </div>
  );
}

function DelayMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
    >
      {label}
    </button>
  );
}

function convertTo24Hour(timeStr: string): string {
  if (!timeStr) return '12:00';
  const cleaned = timeStr.trim().toUpperCase();
  if (cleaned.includes('AM') || cleaned.includes('PM')) {
    const match = cleaned.match(/^(\d{1,2}):?(\d{2})?(?:\.\d+)?\s*(AM|PM)$/);
    if (!match) return '12:00';
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3];
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  return cleaned;
}