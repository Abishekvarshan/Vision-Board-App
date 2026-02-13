
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Plus, Trash2, X } from 'lucide-react';
import { Activity, Task } from '../types';
import { toLocalISODate } from '../src/date';
import { getUserJournal, upsertUserJournal } from '../src/journal';

interface Props {
  uid: string;
  tasks: Task[];
  activities: Activity[];
  setTasks: (tasks: Task[]) => void;
  onAddTaskActivity?: (isoDate?: string) => void;
}

export const Planner: React.FC<Props> = ({ uid, tasks, activities, setTasks, onAddTaskActivity }) => {
  const [newTaskText, setNewTaskText] = useState('');
  const todayISO = useMemo(() => toLocalISODate(new Date()), []);
  const [filterDate, setFilterDate] = useState(todayISO);

  const [journalText, setJournalText] = useState<string>('');
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalSaving, setJournalSaving] = useState(false);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [draftJournal, setDraftJournal] = useState('');

  const isFutureDate = filterDate > todayISO;
  const isToday = filterDate === todayISO;
  const isPastDate = filterDate < todayISO;

  const dailyTasks = useMemo(() => {
    return tasks.filter(t => t.date === filterDate);
  }, [tasks, filterDate]);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    if (isFutureDate) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      text: newTaskText,
      completed: false,
      date: filterDate
    };

    // Count an activity only when user adds a new task.
    onAddTaskActivity?.(filterDate);

    setTasks([...tasks, newTask]);
    setNewTaskText('');
  };

  const toggleTask = (id: string) => {
    // Do NOT count an activity when checking/unchecking tasks.
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const progress = dailyTasks.length > 0 
    ? Math.round((dailyTasks.filter(t => t.completed).length / dailyTasks.length) * 100) 
    : 0;

  const completedCount = useMemo(() => dailyTasks.filter((t) => t.completed).length, [dailyTasks]);
  const activityCountForDay = useMemo(() => {
    const a = activities.find((x) => x.date === filterDate);
    return a && Number.isFinite(a.count) ? a.count : 0;
  }, [activities, filterDate]);

  // Load journal entry from Firestore when date changes.
  useEffect(() => {
    let alive = true;
    setJournalLoading(true);
    getUserJournal(uid, filterDate)
      .then((doc) => {
        if (!alive) return;
        setJournalText(doc?.text ?? '');
      })
      .catch((err) => console.error('Failed to load journal', err))
      .finally(() => {
        if (!alive) return;
        setJournalLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [uid, filterDate]);

  const openJournalModalForToday = () => {
    setDraftJournal(journalText);
    setShowJournalModal(true);
  };

  const saveJournalForToday = async () => {
    if (!isToday) return;
    setJournalSaving(true);
    try {
      await upsertUserJournal(uid, todayISO, draftJournal.trim());
      setJournalText(draftJournal.trim());
      setShowJournalModal(false);
    } catch (err) {
      console.error('Failed to save journal', err);
    } finally {
      setJournalSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Daily Planner</h2>
        </div>
        <div className="flex flex-col items-end gap-2">
           <input 
            type="date" 
            value={filterDate}
            max={todayISO}
            onChange={(e) => {
              const next = e.target.value;
              // Only allow selecting today or past days.
              if (!next) return;
              if (next > todayISO) return;
              setFilterDate(next);
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg text-sm font-medium shadow-sm text-slate-800 dark:text-slate-100"
          />
          <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
            {completedCount}/{dailyTasks.length} Done ({progress}%)
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 space-y-6">
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {isFutureDate && (
          <div className="text-sm font-semibold text-amber-600">
            Future days are disabled — select today or a past date.
          </div>
        )}

        {/* Today only: allow adding tasks. Past days show summary only. */}
        {isToday && (
          <form onSubmit={addTask} className="flex gap-2 w-full">
            <input 
              type="text" 
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder="Add a daily focus..."
              disabled={isFutureDate}
              className="flex-1 min-w-0 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={isFutureDate}
              className="shrink-0 p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:hover:bg-indigo-600"
            >
              <Plus className="w-6 h-6" />
            </button>
          </form>
        )}

        {(isPastDate || isFutureDate) && (
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {isPastDate ? 'Past day summary ' : 'Future days are disabled'}
          </div>
        )}

        <div className="space-y-3">
          {dailyTasks.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <p>No tasks for this day. Enjoy the quiet!</p>
            </div>
          ) : (
            dailyTasks.map(task => (
              <div 
                key={task.id} 
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                  task.completed ? 'bg-emerald-50/30 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                }`}
              >
                <button
                  onClick={() => isToday && toggleTask(task.id)}
                  className={isToday ? 'text-indigo-600' : 'text-slate-300 cursor-default'}
                  type="button"
                >
                  {task.completed ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Circle className="w-6 h-6 text-slate-300" />}
                </button>
                <span className={`flex-1 font-medium ${task.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                  {task.text}
                </span>
                <button
                  onClick={() => isToday && deleteTask(task.id)}
                  type="button"
                  className={
                    isToday
                      ? 'text-slate-300 hover:text-red-500 transition-colors'
                      : 'text-slate-200 dark:text-slate-700 cursor-default'
                  }
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Journal (below tasks) */}
        <div className="mt-2 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Journal</p>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100">{filterDate}</p>
            </div>
            {isToday && (
              <button
                onClick={openJournalModalForToday}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-700"
                type="button"
              >
                {journalText ? 'Edit' : 'Add'}
              </button>
            )}
          </div>

          <div className="mt-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap text-align-justify">
            {journalLoading ? (
              <span className="text-slate-400">Loading journal...</span>
            ) : journalText ? (
              journalText
            ) : (
              <span className="text-slate-400">No journal note for this day.</span>
            )}
          </div>
        </div>
      </div>

      {/* Journal modal */}
      {showJournalModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !journalSaving && setShowJournalModal(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Journal</p>
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{todayISO}</h3>
              </div>
              <button
                type="button"
                onClick={() => !journalSaving && setShowJournalModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <textarea
              value={draftJournal}
              onChange={(e) => setDraftJournal(e.target.value)}
              placeholder="Write your journal for today..."
              rows={8}
              className="mt-4 w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowJournalModal(false)}
                disabled={journalSaving}
                className="px-4 py-2 rounded-xl font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveJournalForToday}
                disabled={journalSaving}
                className="px-4 py-2 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {journalSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
