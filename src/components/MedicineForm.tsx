import { useState, useEffect } from 'react';
import { Pill, ChevronRight, ChevronLeft, Plus, Trash2, Anchor, Archive, TriangleAlert as AlertTriangle, Clock, Ban, Calendar, ListOrdered, GitBranch, Rocket, CalendarDays } from 'lucide-react';
import type {
  Medicine,
  PhaseSchedule,
  BlackoutWindow,
  FixedTimeSlot,
  ScheduleType,
  StartTriggerMode,
} from '@/types';
import {
  createMedicine,
  updateMedicine,
  archiveMedicine,
  deleteMedicine,
  fetchAllMedicines,
  fetchPhaseSchedules,
} from '@/lib/dataService';
import { addDays, todayStr } from '@/lib/timeUtils';
import { showToast } from '@/components/Toast';
import { Modal } from '@/components/Modal';

interface MedicineFormProps {
  isOpen: boolean;
  onClose: () => void;
  editingMedicine: Medicine | null;
  onSaved: () => void;
}

interface PhaseFormData {
  phase_name: string;
  start_date: string;
  end_date: string;
  times_per_day: number;
  schedule_type: ScheduleType;
  fixed_times_list: FixedTimeSlot[];
}

function genId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function timeToInputValue(timeStr: string): string {
  if (!timeStr) return '07:00';
  const upper = timeStr.trim().toUpperCase();
  if (upper.includes('AM') || upper.includes('PM')) {
    const match = upper.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)$/);
    if (!match) return '07:00';
    let h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3];
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  return upper.length >= 4 ? upper.substring(0, 5) : '07:00';
}

function inputValueToTime(val: string): string {
  const [h, m] = val.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

export function MedicineForm({ isOpen, onClose, editingMedicine, onSaved }: MedicineFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [allMedicines, setAllMedicines] = useState<Medicine[]>([]);

  // Step 1 fields
  const [name, setName] = useState('');
  const [dosageInstructions, setDosageInstructions] = useState('');
  const [earliestAllowed, setEarliestAllowed] = useState('07:00');
  const [latestAllowed, setLatestAllowed] = useState('21:00');
  const [minIntervalHours, setMinIntervalHours] = useState('3.0');
  const [blackoutWindows, setBlackoutWindows] = useState<BlackoutWindow[]>([]);
  const [sequenceOrder, setSequenceOrder] = useState(1);
  const [dependsOnMedicineId, setDependsOnMedicineId] = useState<string | null>(null);
  const [minGapAfterPrerequisite, setMinGapAfterPrerequisite] = useState('60');
  const [startTriggerMode, setStartTriggerMode] = useState<StartTriggerMode>('dynamic_first_checkin');

  // Step 2 fields
  const [phases, setPhases] = useState<PhaseFormData[]>([
    {
      phase_name: 'Phase 1',
      start_date: todayStr(),
      end_date: addDays(todayStr(), 7),
      times_per_day: 2,
      schedule_type: 'staggered_auto',
      fixed_times_list: [],
    },
  ]);

  const [showDangerZone, setShowDangerZone] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      if (editingMedicine) {
        setName(editingMedicine.name);
        setDosageInstructions(editingMedicine.dosage_instructions || '');
        setEarliestAllowed(timeToInputValue(editingMedicine.earliest_allowed || '07:00 AM'));
        setLatestAllowed(timeToInputValue(editingMedicine.latest_allowed || '09:00 PM'));
        setMinIntervalHours(String(editingMedicine.min_interval_hours || 3.0));
        setBlackoutWindows(editingMedicine.blackout_windows || []);
        setSequenceOrder(editingMedicine.sequence_order ?? 1);
        setDependsOnMedicineId(editingMedicine.depends_on_medicine_id ?? null);
        setMinGapAfterPrerequisite(String(editingMedicine.min_gap_after_prerequisite_mins ?? 60));
        setStartTriggerMode(editingMedicine.start_trigger_mode ?? 'dynamic_first_checkin');
        setShowDangerZone(true);

        fetchPhaseSchedules(editingMedicine.id).then((schedules) => {
          if (schedules.length > 0) {
            setPhases(
              schedules.map((s) => ({
                phase_name: s.phase_name,
                start_date: s.start_date,
                end_date: s.end_date,
                times_per_day: s.times_per_day,
                schedule_type: s.schedule_type,
                fixed_times_list: s.fixed_times_list || [],
              }))
            );
          }
        });
      } else {
        setName('');
        setDosageInstructions('');
        setEarliestAllowed('07:00');
        setLatestAllowed('21:00');
        setMinIntervalHours('3.0');
        setBlackoutWindows([]);
        setSequenceOrder(1);
        setDependsOnMedicineId(null);
        setMinGapAfterPrerequisite('60');
        setStartTriggerMode('dynamic_first_checkin');
        setShowDangerZone(false);
        setPhases([
          {
            phase_name: 'Phase 1',
            start_date: todayStr(),
            end_date: addDays(todayStr(), 7),
            times_per_day: 2,
            schedule_type: 'staggered_auto',
            fixed_times_list: [],
          },
        ]);
      }

      fetchAllMedicines().then(setAllMedicines).catch(() => {});
    }
  }, [isOpen, editingMedicine]);

  const otherMedicines = allMedicines.filter((m) => m.id !== editingMedicine?.id);

  const addBlackoutWindow = () => {
    setBlackoutWindows([
      ...blackoutWindows,
      { id: genId(), from: '01:00 PM', to: '03:00 PM', label: 'Nap / Fasting' },
    ]);
  };

  const updateBlackoutWindow = (id: string, field: keyof BlackoutWindow, value: string) => {
    setBlackoutWindows(blackoutWindows.map((w) => (w.id === id ? { ...w, [field]: value } : w)));
  };

  const removeBlackoutWindow = (id: string) => {
    setBlackoutWindows(blackoutWindows.filter((w) => w.id !== id));
  };

  const addPhase = () => {
    const lastPhase = phases[phases.length - 1];
    const newStart = addDays(lastPhase.end_date, 1);
    setPhases([
      ...phases,
      {
        phase_name: `Phase ${phases.length + 1}`,
        start_date: newStart,
        end_date: addDays(newStart, 7),
        times_per_day: 2,
        schedule_type: 'staggered_auto',
        fixed_times_list: [],
      },
    ]);
  };

  const updatePhase = (index: number, field: keyof PhaseFormData, value: string | number | ScheduleType) => {
    const updated = [...phases];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'end_date' && index < phases.length - 1) {
      const newNextStart = addDays(value as string, 1);
      updated[index + 1] = { ...updated[index + 1], start_date: newNextStart };
    }

    if (field === 'times_per_day' || field === 'schedule_type') {
      const tp = field === 'times_per_day' ? (value as number) : updated[index].times_per_day;
      const st = field === 'schedule_type' ? (value as ScheduleType) : updated[index].schedule_type;
      if (st === 'fixed_times') {
        const existing = updated[index].fixed_times_list || [];
        const newList: FixedTimeSlot[] = [];
        for (let i = 0; i < tp; i++) {
          newList.push(
            existing[i] || {
              slot_number: i + 1,
              time: inputValueToTime(
                `${(7 + i * 4).toString().padStart(2, '0')}:00`
              ),
              is_anchored: false,
            }
          );
        }
        updated[index].fixed_times_list = newList;
      }
    }

    setPhases(updated);
  };

  const updateFixedTime = (phaseIdx: number, slotIdx: number, time: string) => {
    const updated = [...phases];
    const list = [...updated[phaseIdx].fixed_times_list];
    list[slotIdx] = { ...list[slotIdx], time: inputValueToTime(time) };
    updated[phaseIdx].fixed_times_list = list;
    setPhases(updated);
  };

  const toggleAnchored = (phaseIdx: number, slotIdx: number) => {
    const updated = [...phases];
    const list = [...updated[phaseIdx].fixed_times_list];
    list[slotIdx] = { ...list[slotIdx], is_anchored: !list[slotIdx].is_anchored };
    updated[phaseIdx].fixed_times_list = list;
    setPhases(updated);
  };

  const removePhase = (index: number) => {
    if (phases.length <= 1) return;
    setPhases(phases.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Medicine name is required', 'error');
      setStep(1);
      return;
    }

    setLoading(true);
    try {
      const medData = {
        name: name.trim(),
        dosage_instructions: dosageInstructions,
        earliest_allowed: inputValueToTime(earliestAllowed),
        latest_allowed: inputValueToTime(latestAllowed),
        min_interval_hours: parseFloat(minIntervalHours) || 3.0,
        inter_med_default_buffer_mins: 60,
        blackout_windows: blackoutWindows,
        inter_med_buffers: [],
        sequence_order: sequenceOrder,
        depends_on_medicine_id: dependsOnMedicineId,
        min_gap_after_prerequisite_mins: parseInt(minGapAfterPrerequisite) || 60,
        start_trigger_mode: startTriggerMode,
      };

      const phaseData = phases.map((p) => ({
        phase_name: p.phase_name,
        start_date: p.start_date,
        end_date: p.end_date,
        times_per_day: p.times_per_day,
        schedule_type: p.schedule_type,
        fixed_times_list: p.fixed_times_list,
      }));

      if (editingMedicine) {
        await updateMedicine(editingMedicine.id, medData, phaseData);
        showToast('Medicine updated successfully', 'success');
      } else {
        await createMedicine(medData, phaseData);
        showToast('Medicine added successfully', 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save medicine', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!editingMedicine) return;
    setLoading(true);
    try {
      await archiveMedicine(editingMedicine.id);
      showToast('Medicine archived', 'success');
      onSaved();
      onClose();
    } catch {
      showToast('Failed to archive medicine', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingMedicine) return;
    if (!confirm('Permanently delete this medicine and all its history? This cannot be undone.')) return;
    setLoading(true);
    try {
      await deleteMedicine(editingMedicine.id);
      showToast('Medicine deleted', 'success');
      onSaved();
      onClose();
    } catch {
      showToast('Failed to delete medicine', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingMedicine ? 'Edit Medicine' : 'Add Medicine'}
      maxWidth="max-w-2xl"
    >
      {/* Stepper Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`flex items-center gap-2 ${step === 1 ? 'text-med-600' : 'text-slate-400'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
            step === 1 ? 'bg-med-600 text-white' : 'bg-slate-200 text-slate-500'
          }`}>
            1
          </div>
          <span className="text-sm font-semibold">Details</span>
        </div>
        <div className={`flex-1 h-0.5 ${step === 2 ? 'bg-med-400' : 'bg-slate-200'} rounded-full transition-colors`} />
        <div className={`flex items-center gap-2 ${step === 2 ? 'text-med-600' : 'text-slate-400'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
            step === 2 ? 'bg-med-600 text-white' : 'bg-slate-200 text-slate-500'
          }`}>
            2
          </div>
          <span className="text-sm font-semibold">Phases</span>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-5 animate-fade-in">
          {/* Basic Details */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Medicine name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Dexamethasone (Take first)"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Dosage instructions</label>
              <textarea
                value={dosageInstructions}
                onChange={(e) => setDosageInstructions(e.target.value)}
                placeholder="e.g., One drop in LEFT eye twice a day"
                rows={2}
                className="input-field resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Earliest allowed</label>
                <input
                  type="time"
                  value={earliestAllowed}
                  onChange={(e) => setEarliestAllowed(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Latest allowed</label>
                <input
                  type="time"
                  value={latestAllowed}
                  onChange={(e) => setLatestAllowed(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Dose Timing Parameters */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-med-600" />
              <h4 className="text-sm font-bold text-slate-700">Dose Timing & Separation</h4>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Min gap between doses (hours)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={minIntervalHours}
                onChange={(e) => setMinIntervalHours(e.target.value)}
                className="input-field text-sm"
              />
            </div>
          </div>

          {/* Blackout Windows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-bold text-slate-700">Forbidden / Blackout Windows</h4>
              </div>
            </div>
            {blackoutWindows.map((w) => (
              <div key={w.id} className="flex items-center gap-2 bg-amber-50/50 rounded-xl p-2">
                <input
                  type="time"
                  value={timeToInputValue(w.from)}
                  onChange={(e) => updateBlackoutWindow(w.id, 'from', inputValueToTime(e.target.value))}
                  className="input-field text-xs py-2 flex-1"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="time"
                  value={timeToInputValue(w.to)}
                  onChange={(e) => updateBlackoutWindow(w.id, 'to', inputValueToTime(e.target.value))}
                  className="input-field text-xs py-2 flex-1"
                />
                <input
                  type="text"
                  value={w.label}
                  onChange={(e) => updateBlackoutWindow(w.id, 'label', e.target.value)}
                  placeholder="Label"
                  className="input-field text-xs py-2 flex-1"
                />
                <button
                  onClick={() => removeBlackoutWindow(w.id)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400 flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addBlackoutWindow}
              className="w-full border-2 border-dashed border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-500 hover:border-amber-300 hover:text-amber-600 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Window
            </button>
          </div>

          {/* Regimen Sequence & Dependencies */}
          <div className="bg-med-50/40 rounded-xl p-4 space-y-3 border border-med-100">
            <div className="flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-med-600" />
              <h4 className="text-sm font-bold text-slate-700">Regimen Sequence & Dependencies</h4>
            </div>

            {/* Sequence Priority */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Sequence Priority / Order
              </label>
              <select
                value={sequenceOrder}
                onChange={(e) => setSequenceOrder(parseInt(e.target.value))}
                className="input-field text-sm"
              >
                <option value={1}>1 - Primary (Take First in Daily Cycle)</option>
                <option value={2}>2 - Secondary</option>
                <option value={3}>3 - Tertiary</option>
                <option value={4}>4 - Quaternary</option>
                <option value={5}>5 - Fifth</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Determines which medication initiates the daily schedule.
              </p>
            </div>

            {/* Prerequisite Dependency */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Requires Prerequisite Medicine First?
              </label>
              <select
                value={dependsOnMedicineId ?? ''}
                onChange={(e) => setDependsOnMedicineId(e.target.value || null)}
                className="input-field text-sm"
              >
                <option value="">None - No dependency</option>
                {otherMedicines.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {dependsOnMedicineId && (
              <div className="animate-slide-down space-y-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  <GitBranch className="w-3 h-3 inline mr-1 text-med-500" />
                  Wait time after prerequisite dose (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  step="15"
                  value={minGapAfterPrerequisite}
                  onChange={(e) => setMinGapAfterPrerequisite(e.target.value)}
                  className="input-field text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Automatically spaces this medication {minGapAfterPrerequisite || 60} minutes after the prerequisite dose is logged.
                </p>
              </div>
            )}
          </div>

          {/* Start Trigger Mode */}
          <div className="bg-teal-50/40 rounded-xl p-4 space-y-3 border border-teal-100">
            <div className="flex items-center gap-2">
              <Rocket className="w-4 h-4 text-teal-600" />
              <h4 className="text-sm font-bold text-slate-700">Daily Start Mode</h4>
            </div>
            <p className="text-[11px] text-slate-400 -mt-1">
              Choose how today's schedule activates each morning.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setStartTriggerMode('dynamic_first_checkin')}
                className={`flex items-start gap-3 rounded-xl p-3 text-left transition-all border-2 ${
                  startTriggerMode === 'dynamic_first_checkin'
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  startTriggerMode === 'dynamic_first_checkin' ? 'border-teal-500 bg-teal-500' : 'border-slate-300'
                }`}>
                  {startTriggerMode === 'dynamic_first_checkin' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Rocket className="w-3.5 h-3.5 text-teal-600" />
                    <span className="text-sm font-semibold text-slate-700">Floating Start</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Timeline starts blank. Check in Dose #1 whenever you take it, and the rest of the day's slots are calculated from that moment.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStartTriggerMode('fixed_schedule')}
                className={`flex items-start gap-3 rounded-xl p-3 text-left transition-all border-2 ${
                  startTriggerMode === 'fixed_schedule'
                    ? 'border-med-500 bg-med-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  startTriggerMode === 'fixed_schedule' ? 'border-med-500 bg-med-500' : 'border-slate-300'
                }`}>
                  {startTriggerMode === 'fixed_schedule' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-med-600" />
                    <span className="text-sm font-semibold text-slate-700">Fixed Schedule</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    All dose times are pre-generated at the start of the day based on your phase configuration, regardless of when you take the first dose.
                  </p>
                </div>
              </button>
            </div>
          </div>

          <button
            onClick={() => setStep(2)}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Continue to Phases
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5 animate-fade-in">
          <div className="space-y-3">
            {phases.map((phase, idx) => (
              <div key={idx} className="bg-slate-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-med-600" />
                    <input
                      type="text"
                      value={phase.phase_name}
                      onChange={(e) => updatePhase(idx, 'phase_name', e.target.value)}
                      className="font-bold text-sm text-slate-700 bg-transparent border-b border-slate-200 focus:border-med-500 focus:outline-none px-1 py-0.5"
                    />
                  </div>
                  {phases.length > 1 && (
                    <button
                      onClick={() => removePhase(idx)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Start date</label>
                    <input
                      type="date"
                      value={phase.start_date}
                      onChange={(e) => updatePhase(idx, 'start_date', e.target.value)}
                      className="input-field text-sm py-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      End date {idx < phases.length - 1 ? '(auto-cascades)' : ''}
                    </label>
                    <input
                      type="date"
                      value={phase.end_date}
                      onChange={(e) => updatePhase(idx, 'end_date', e.target.value)}
                      className="input-field text-sm py-2.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Times per day</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={phase.times_per_day}
                      onChange={(e) => updatePhase(idx, 'times_per_day', parseInt(e.target.value) || 1)}
                      className="input-field text-sm py-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Schedule type</label>
                    <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200">
                      <button
                        onClick={() => updatePhase(idx, 'schedule_type', 'staggered_auto')}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                          phase.schedule_type === 'staggered_auto'
                            ? 'bg-med-600 text-white'
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        Auto-Stagger
                      </button>
                      <button
                        onClick={() => updatePhase(idx, 'schedule_type', 'fixed_times')}
                        className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                          phase.schedule_type === 'fixed_times'
                            ? 'bg-med-600 text-white'
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        Fixed Times
                      </button>
                    </div>
                  </div>
                </div>

                {/* Fixed Times List */}
                {phase.schedule_type === 'fixed_times' && (
                  <div className="space-y-2 animate-slide-down">
                    {phase.fixed_times_list.map((ft, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500 w-16">Slot #{sIdx + 1}</span>
                        <input
                          type="time"
                          value={timeToInputValue(ft.time)}
                          onChange={(e) => updateFixedTime(idx, sIdx, e.target.value)}
                          className="input-field text-sm py-2 flex-1"
                        />
                        <button
                          onClick={() => toggleAnchored(idx, sIdx)}
                          className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                            ft.is_anchored
                              ? 'bg-med-100 text-med-700'
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          <Anchor className="w-3.5 h-3.5" />
                          {ft.is_anchored ? 'Anchored' : 'Flexible'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={addPhase}
            className="w-full border-2 border-dashed border-slate-200 rounded-xl py-2.5 text-sm font-medium text-slate-500 hover:border-med-300 hover:text-med-600 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Phase
          </button>

          {/* Danger Zone - Edit Mode Only */}
          {showDangerZone && editingMedicine && (
            <div className="border-2 border-red-100 rounded-xl p-4 space-y-2 bg-red-50/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h4 className="text-sm font-bold text-red-600">Danger Zone</h4>
              </div>
              <button
                onClick={handleArchive}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-white text-amber-600 border-2 border-amber-300 rounded-xl py-2.5 text-sm font-semibold hover:bg-amber-50 transition-colors disabled:opacity-50"
              >
                <Archive className="w-4 h-4" />
                Archive Medicine
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 border-2 border-red-300 rounded-xl py-2.5 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete Medicine
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(1)}
              className="btn-secondary flex items-center justify-center gap-1.5 px-5"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : editingMedicine ? (
                <>
                  <Pill className="w-5 h-5" />
                  Save Changes
                </>
              ) : (
                <>
                  <Pill className="w-5 h-5" />
                  Add Medicine
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
