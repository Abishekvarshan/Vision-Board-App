
import React, { useState, useMemo } from 'react';
import { CheckCircle2, Circle, Plus, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { Task } from '../types';

interface Props {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
}

export const Planner: React.FC<Props> = ({ tasks, setTasks }) => {
  const [newTaskText, setNewTaskText] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  const dailyTasks = useMemo(() => {
    return tasks.filter(t => t.date === filterDate);
  }, [tasks, filterDate]);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      text: newTaskText,
      completed: false,
      date: filterDate
    };

    setTasks([...tasks, newTask]);
    setNewTaskText('');
  };

  const toggleTask = (id: string) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const progress = dailyTasks.length > 0 
    ? Math.round((dailyTasks.filter(t => t.completed).length / dailyTasks.length) * 100) 
    : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Daily Planner</h2>
          <p className="text-slate-500">One step at a time towards your vision.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
           <input 
            type="date" 
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="bg-white border border-slate-200 px-3 py-1 rounded-lg text-sm font-medium shadow-sm"
          />
          <div className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
            {progress}% Done
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 space-y-6">
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <form onSubmit={addTask} className="flex gap-2">
          <input 
            type="text" 
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder="Add a daily focus..."
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="submit" className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-colors">
            <Plus className="w-6 h-6" />
          </button>
        </form>

        <div className="space-y-3">
          {dailyTasks.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p>No tasks for this day. Enjoy the quiet!</p>
            </div>
          ) : (
            dailyTasks.map(task => (
              <div 
                key={task.id} 
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                  task.completed ? 'bg-emerald-50/30 border-emerald-100' : 'bg-white border-slate-100'
                }`}
              >
                <button onClick={() => toggleTask(task.id)} className="text-indigo-600">
                  {task.completed ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Circle className="w-6 h-6 text-slate-300" />}
                </button>
                <span className={`flex-1 font-medium ${task.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
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
