import { useEffect, useState } from 'react';
import { Clock, CircleCheck as CheckCircle2, Circle as XCircle, Pill, Calendar, TrendingUp } from 'lucide-react';
import type { Medicine, DailyMedLog, DoseSlot } from '@/types';
import { fetchHistoryLogs, fetchAllDoseSlotsForLogIds, fetchAllMedicines } from '@/lib/dataService';
import { formatDateShort, formatTime } from '@/lib/timeUtils';

interface HistoryViewProps {
  onRefresh?: () => void;
}

interface HistoryGroup {
  date: string;
  logs: DailyMedLog[];
  slotMap: Record<string, DoseSlot[]>;
}

export function HistoryView({ }: HistoryViewProps) {
  const [history, setHistory] = useState<HistoryGroup[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const [meds, logs] = await Promise.all([
        fetchAllMedicines(),
        fetchHistoryLogs(30),
      ]);
      setMedicines(meds);

      const grouped: Record<string, DailyMedLog[]> = {};
      for (const log of logs) {
        if (!grouped[log.date]) grouped[log.date] = [];
        grouped[log.date].push(log);
      }

      const allLogIds = logs.map((l) => l.id);
      const allSlotsMap = await fetchAllDoseSlotsForLogIds(allLogIds);

      const groups: HistoryGroup[] = Object.entries(grouped)
        .map(([date, dateLogs]) => ({
          date,
          logs: dateLogs,
          slotMap: allSlotsMap,
        }))
        .sort((a, b) => b.date.localeCompare(a.date));

      setHistory(groups);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const getMedName = (id: string) => medicines.find((m) => m.id === id)?.name || 'Unknown';

  return (
    <div className="max-w-2xl mx-auto px-2.5 pt-3 pb-28">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-10 h-10 bg-gradient-to-br from-med-50 to-teal-50 rounded-xl flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-med-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">History</h1>
          <p className="text-slate-500 text-xs">Last 30 days of medication logs</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-med-200 border-t-med-600 rounded-full animate-spin" />
        </div>
      ) : history.length === 0 ? (
        <div className="card p-10 text-center animate-fade-in">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-700">No history yet</h3>
          <p className="text-slate-500 text-sm mt-1">
            Medication check-ins will appear here over time.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((group) => {
            const allSlots = group.logs.flatMap((l) => group.slotMap[l.id] || []);
            const taken = allSlots.filter((s) => s.status === 'taken').length;
            const total = allSlots.length;
            const pct = total > 0 ? Math.round((taken / total) * 100) : 0;

            return (
              <div key={group.date} className="card overflow-hidden animate-slide-up">
                {/* Date Header */}
                <div
                  className="px-3 py-2 flex items-center justify-between"
                  style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)' }}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-white" />
                    <span className="text-white font-bold text-sm">{formatDateShort(group.date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-teal-100 text-xs font-medium">{taken}/{total}</span>
                    <span className="text-white text-sm font-bold tabular-nums">{pct}%</span>
                  </div>
                </div>

                {/* Medicine rows */}
                <div className="divide-y divide-slate-100">
                  {group.logs.map((log) => {
                    const slots = group.slotMap[log.id] || [];
                    const logTaken = slots.filter((s) => s.status === 'taken').length;
                    const logTotal = slots.length;
                    const isComplete = log.status === 'completed';
                    const isSkipped = log.status === 'skipped';

                    return (
                      <div key={log.id} className="px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 bg-gradient-to-br from-med-50 to-teal-50 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Pill className="w-4 h-4 text-med-600" />
                            </div>
                            <span className="text-sm font-semibold text-slate-700 truncate">
                              {getMedName(log.medicine_id)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-slate-400 font-semibold tabular-nums">
                              {logTaken}/{logTotal}
                            </span>
                            {isComplete ? (
                              <div className="w-6 h-6 bg-emerald-50 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              </div>
                            ) : isSkipped ? (
                              <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center">
                                <XCircle className="w-4 h-4 text-slate-300" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 bg-amber-50 rounded-full flex items-center justify-center">
                                <Clock className="w-4 h-4 text-amber-400" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Slot details */}
                        {slots.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2 pl-9">
                            {slots.map((slot) => (
                              <span
                                key={slot.id}
                                className={`text-[10px] font-medium px-2 py-1 rounded-md ${
                                  slot.status === 'taken'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : slot.status === 'skipped'
                                    ? 'bg-slate-100 text-slate-400'
                                    : 'bg-amber-50 text-amber-600'
                                }`}
                              >
                                {formatTime(slot.scheduled_time)}
                                {slot.taken_at && slot.taken_at !== slot.scheduled_time && ` \u2192 ${formatTime(slot.taken_at)}`}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
