import React, { useCallback, useEffect, useState } from 'react';
import { Layout, LayoutGrid, CheckSquare, BarChart3 } from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { ConsistencyTracker } from './components/ConsistencyTracker';
import { Planner } from './components/Planner';
import { VisionBoard } from './components/VisionBoard';
import { Activity, Task, VisionItem } from './types';
import { getUserStreak, recordActivityForUser, StreakDoc } from './src/streak';
import type { User } from 'firebase/auth';

const AuthedApp: React.FC<{ user: User }> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'vision' | 'planner' | 'progress'>('vision');
  const [streak, setStreak] = useState<StreakDoc | null>(null);

  // Persistence logic
  const [visionItems, setVisionItems] = useState<VisionItem[]>(() => {
    const saved = localStorage.getItem('vision_items');
    return saved ? JSON.parse(saved) : [];
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('planner_tasks');
    return saved ? JSON.parse(saved) : [];
  });

  const [activities, setActivities] = useState<Activity[]>(() => {
    const saved = localStorage.getItem('activity_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('vision_items', JSON.stringify(visionItems));
  }, [visionItems]);

  useEffect(() => {
    localStorage.setItem('planner_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('activity_history', JSON.stringify(activities));
  }, [activities]);

  // Load streak when the signed-in user changes
  useEffect(() => {
    getUserStreak(user.uid)
      .then(setStreak)
      .catch((err) => console.error('Failed to load streak', err));
  }, [user.uid]);

  const logActivityWithUser = useCallback((date?: string) => {
    const today = date || new Date().toISOString().split('T')[0];

    // local heatmap
    setActivities(prev => {
      const existing = prev.find(a => a.date === today);
      if (existing) {
        return prev.map(a => a.date === today ? { ...a, count: a.count + 1 } : a);
      }
      return [...prev, { date: today, count: 1 }];
    });

    // Firestore streak update
    recordActivityForUser(user.uid, today)
      .then(() => getUserStreak(user.uid))
      .then(setStreak)
      .catch((err) => console.error('Failed to record streak', err));
  }, [user.uid]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-0 md:pt-16">
      {/* Top Header - Desktop Only */}
      <header className="hidden md:flex fixed top-0 w-full glass border-b border-slate-200 dark:border-slate-800 z-50 px-8 py-4 justify-between items-center">
        <h1 className="text-xl font-bold text-indigo-600 tracking-tight flex items-center gap-2">
          <Layout className="w-6 h-6" /> VisionFlow
        </h1>
        <div className="flex gap-8">
          <button onClick={() => setActiveTab('vision')} className={`flex items-center gap-2 font-medium transition-colors ${activeTab === 'vision' ? 'text-indigo-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
            <LayoutGrid className="w-4 h-4" /> Vision Board
          </button>
          <button onClick={() => setActiveTab('planner')} className={`flex items-center gap-2 font-medium transition-colors ${activeTab === 'planner' ? 'text-indigo-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
            <CheckSquare className="w-4 h-4" /> Daily Planner
          </button>
          <button onClick={() => setActiveTab('progress')} className={`flex items-center gap-2 font-medium transition-colors ${activeTab === 'progress' ? 'text-indigo-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
            <BarChart3 className="w-4 h-4" /> Progress
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === 'vision' && (
          <VisionBoard
            items={visionItems}
            onAddItem={(item) => {
              setVisionItems(prev => [item, ...prev]);
              logActivityWithUser();
            }}
            onDeleteItem={(id) => setVisionItems(prev => prev.filter(i => i.id !== id))}
          />
        )}
        {activeTab === 'planner' && (
          <Planner
            tasks={tasks}
            setTasks={(newTasks) => {
              setTasks(newTasks);
              if (newTasks.length >= tasks.length) logActivityWithUser();
            }}
          />
        )}
        {activeTab === 'progress' && (
          <ConsistencyTracker
            activities={activities}
            currentStreak={streak?.currentStreak}
            longestStreak={streak?.longestStreak}
          />
        )}
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full glass border-t border-slate-200 dark:border-slate-800 flex justify-around items-center py-4 px-2 z-50">
        <button onClick={() => setActiveTab('vision')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'vision' ? 'text-indigo-600 scale-110' : 'text-slate-400 dark:text-slate-500'}`}>
          <LayoutGrid className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Vision</span>
        </button>
        <button onClick={() => setActiveTab('planner')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'planner' ? 'text-indigo-600 scale-110' : 'text-slate-400 dark:text-slate-500'}`}>
          <CheckSquare className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Plan</span>
        </button>
        <button onClick={() => setActiveTab('progress')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'progress' ? 'text-indigo-600 scale-110' : 'text-slate-400 dark:text-slate-500'}`}>
          <BarChart3 className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Growth</span>
        </button>
      </nav>
    </div>
  );
};

const App: React.FC = () => {
  return <AuthGate>{(user) => <AuthedApp user={user} />}</AuthGate>;
};

export default App;