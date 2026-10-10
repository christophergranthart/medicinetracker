import { useEffect, useState, useCallback } from 'react';
import { HeartPulse } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/AuthScreen';
import { Dashboard } from '@/components/Dashboard';
import { HistoryView } from '@/components/HistoryView';
import { MedicinesView } from '@/components/MedicinesView';
import { SettingsView } from '@/components/SettingsView';
import { BottomNav, type NavView } from '@/components/BottomNav';
import { MedicineForm } from '@/components/MedicineForm';
import { ToastContainer } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { Medicine, PhaseSchedule, DoseSlot, DailyMedLog } from '@/types';
import {
  fetchActiveMedicines,
  fetchAllPhaseSchedules,
  ensureDailyLog,
} from '@/lib/dataService';
import { todayStr } from '@/lib/timeUtils';

function AppContent() {
  const { user, loading, signOut } = useAuth();
  const [view, setView] = useState<NavView>('home');
  const [formOpen, setFormOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [schedulesMap, setSchedulesMap] = useState<Record<string, PhaseSchedule[]>>({});
  const [slotsMap, setSlotsMap] = useState<Record<string, DoseSlot[]>>({});
  const [logsMap, setLogsMap] = useState<Record<string, DailyMedLog>>({});
  const [dataLoading, setDataLoading] = useState(true);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const meds = await fetchActiveMedicines();
      setMedicines(meds);

      const allSchedules = await fetchAllPhaseSchedules();
      const sMap: Record<string, PhaseSchedule[]> = {};
      for (const s of allSchedules) {
        if (!sMap[s.medicine_id]) sMap[s.medicine_id] = [];
        sMap[s.medicine_id].push(s);
      }
      setSchedulesMap(sMap);

      const newLogsMap: Record<string, DailyMedLog> = {};
      const newSlotsMap: Record<string, DoseSlot[]> = {};

      for (const med of meds) {
        const schedules = sMap[med.id] || [];
        try {
          const { log, slots } = await ensureDailyLog(med, schedules, selectedDate);
          if (log) {
            newLogsMap[med.id] = log;
            newSlotsMap[med.id] = slots;
          }
        } catch {
          // skip if no active schedule
        }
      }

      setLogsMap(newLogsMap);
      setSlotsMap(newSlotsMap);
    } catch {
    } finally {
      setDataLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-med-50 to-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-med-600 rounded-2xl flex items-center justify-center shadow-float">
            <HeartPulse className="w-7 h-7 text-white" />
          </div>
          <div className="w-6 h-6 border-2 border-med-200 border-t-med-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const handleAddMedicine = () => {
    setEditingMedicine(null);
    setFormOpen(true);
  };

  const handleEditMedicine = (med: Medicine) => {
    setEditingMedicine(med);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingMedicine(null);
  };

  const handleSaved = () => {
    loadData();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-med-50/40 via-slate-50 to-slate-100">
      {/* Branded Top Bar */}
      <div className="sticky top-0 z-30 bg-white/85 backdrop-blur-lg border-b border-slate-200/60">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-med-500 to-teal-600 rounded-xl flex items-center justify-center shadow-sm">
              <HeartPulse className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 leading-tight">MedTracker</h1>
              <p className="text-[10px] text-slate-400 leading-tight font-medium">Medication Schedule</p>
            </div>
          </div>
        </div>
      </div>

      {dataLoading && view === 'home' ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-med-200 border-t-med-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {view === 'home' && (
            <Dashboard
              medicines={medicines}
              schedulesMap={schedulesMap}
              slotsMap={slotsMap}
              logsMap={logsMap}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onEditMedicine={handleEditMedicine}
              onRefresh={loadData}
              userId={user.id}
            />
          )}
          {view === 'history' && <HistoryView />}
          {view === 'medicines' && (
            <MedicinesView
              onAddMedicine={handleAddMedicine}
              onEditMedicine={handleEditMedicine}
            />
          )}
          {view === 'settings' && <SettingsView onSignOut={signOut} />}
        </>
      )}

      <BottomNav activeView={view} onNavigate={setView} />

      <MedicineForm
        isOpen={formOpen}
        onClose={handleFormClose}
        editingMedicine={editingMedicine}
        onSaved={handleSaved}
      />

      <ToastContainer />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
