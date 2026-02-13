
import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import { Activity, Task } from '../types';
import { toLocalISODate } from '../src/date';

interface Props {
  tasks: Task[];
  activities: Activity[];
  setTasks: (tasks: Task[]) => void;
  onAddTaskActivity?: (isoDate?: string) => void;
}

export const Planner: React.FC<Props> = ({ tasks, activities, setTasks, onAddTaskActivity }) => {
  const [newTaskText, setNewTaskText] = useState('');
  const todayISO = useMemo(() => toLocalISODate(new Date()), []);
  const [filterDate, setFilterDate] = useState(todayISO);

  const isFutureDate = filterDate > todayISO;

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

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Daily Planner</h2>
          <p className="text-slate-500 dark:text-slate-400">One step at a time towards your vision.</p>
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
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            {activityCountForDay} Activities
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
                <button onClick={() => toggleTask(task.id)} className="text-indigo-600">
                  {task.completed ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Circle className="w-6 h-6 text-slate-300" />}
                </button>
                <span className={`flex-1 font-medium ${task.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                  {task.text}
                </span>
                <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
