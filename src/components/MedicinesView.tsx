import { useEffect, useState } from 'react';
import { Pill, Plus, Pencil, Clock, Calendar } from 'lucide-react';
import type { Medicine, PhaseSchedule } from '@/types';
import { fetchAllMedicines, fetchAllPhaseSchedules } from '@/lib/dataService';

interface MedicinesViewProps {
  onAddMedicine: () => void;
  onEditMedicine: (med: Medicine) => void;
}

export function MedicinesView({ onAddMedicine, onEditMedicine }: MedicinesViewProps) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [schedulesMap, setSchedulesMap] = useState<Record<string, PhaseSchedule[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMedicines();
  }, []);

  const loadMedicines = async () => {
    setLoading(true);
    try {
      const [meds, allSchedules] = await Promise.all([fetchAllMedicines(), fetchAllPhaseSchedules()]);
      setMedicines(meds);
      const sMap: Record<string, PhaseSchedule[]> = {};
      for (const s of allSchedules) {
        if (!sMap[s.medicine_id]) sMap[s.medicine_id] = [];
        sMap[s.medicine_id].push(s);
      }
      setSchedulesMap(sMap);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const activeMeds = medicines.filter((m) => !m.is_archived);
  const archivedMeds = medicines.filter((m) => m.is_archived);

  const getActiveSchedule = (med: Medicine): PhaseSchedule | null => {
    const today = new Date().toISOString().split('T')[0];
    const schedules = schedulesMap[med.id] || [];
    return schedules.find((s) => today >= s.start_date && today <= s.end_date) || null;
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-5 pb-28">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-med-50 to-teal-50 dark:from-med-900/40 dark:to-teal-900/40 rounded-xl flex items-center justify-center">
            <Pill className="w-5 h-5 text-med-600 dark:text-med-400" />
          </div>
          <div>
            <h1 className="font-bold text-app-primary" style={{ fontSize: 'var(--font-heading)' }}>Medicines</h1>
            <p className="text-app-muted" style={{ fontSize: 'var(--font-small)' }}>Manage your medication list</p>
          </div>
        </div>
        <button
          onClick={onAddMedicine}
          className="flex items-center gap-1.5 bg-med-600 text-white rounded-xl px-3.5 py-2.5 font-bold hover:bg-med-700 transition-colors active:scale-95"
          style={{ fontSize: 'var(--font-small)' }}
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Add
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-med-200 border-t-med-600 rounded-full animate-spin" />
        </div>
      ) : activeMeds.length === 0 ? (
        <div className="card p-10 text-center animate-fade-in">
          <div className="w-16 h-16 bg-med-50 dark:bg-med-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Pill className="w-8 h-8 text-med-400" />
          </div>
          <h3 className="font-bold text-app-primary" style={{ fontSize: 'var(--font-heading)' }}>No medications yet</h3>
          <p className="text-app-muted mt-1 mb-5" style={{ fontSize: 'var(--font-base)' }}>
            Tap "Add" to create your first medication.
          </p>
          <button
            onClick={onAddMedicine}
            className="inline-flex items-center gap-2 bg-med-600 text-white rounded-xl px-5 py-2.5 font-bold hover:bg-med-700 transition-colors"
            style={{ fontSize: 'var(--font-base)' }}
          >
            <Plus className="w-4 h-4" />
            Add Medication
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {activeMeds.map((med) => {
            const schedule = getActiveSchedule(med);
            return (
              <button
                key={med.id}
                onClick={() => onEditMedicine(med)}
                className="w-full card p-3.5 text-left hover:shadow-float transition-all active:scale-[0.99] animate-slide-up"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-med-50 to-teal-50 dark:from-med-900/40 dark:to-teal-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Pill className="w-5 h-5 text-med-600 dark:text-med-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-app-primary" style={{ fontSize: 'var(--font-base)' }}>{med.name}</span>
                    </div>
                    {med.dosage_instructions && (
                      <p className="text-app-muted mt-1 truncate" style={{ fontSize: 'var(--font-small)' }}>{med.dosage_instructions}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-app-faint font-medium" style={{ fontSize: 'var(--font-tiny)' }}>
                      {schedule && (
                        <span className="inline-flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {schedule.times_per_day}x daily
                        </span>
                      )}
                      <span className="inline-flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" />
                        {med.earliest_allowed} - {med.latest_allowed}
                      </span>
                    </div>
                  </div>
                  <Pencil className="w-4 h-4 text-app-faint flex-shrink-0 mt-1" />
                </div>
              </button>
            );
          })}

          {archivedMeds.length > 0 && (
            <div className="pt-3">
              <p className="font-semibold text-app-faint uppercase tracking-wider mb-2" style={{ fontSize: 'var(--font-tiny)' }}>Archived</p>
              <div className="space-y-2">
                {archivedMeds.map((med) => (
                  <button
                    key={med.id}
                    onClick={() => onEditMedicine(med)}
                    className="w-full card p-3 text-left opacity-60 hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center gap-2.5">
                      <Pill className="w-4 h-4 text-app-faint" />
                      <span className="font-medium text-app-muted" style={{ fontSize: 'var(--font-base)' }}>{med.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
