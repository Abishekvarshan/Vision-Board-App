import React, { useState, useEffect } from 'react';
import { VisionBoard } from './components/VisionBoard';
import { Planner } from './components/Planner';
import { ConsistencyTracker } from './components/ConsistencyTracker';
import { Layout, LayoutGrid, CheckSquare, BarChart3 } from 'lucide-react';
import { VisionItem, Task, Activity } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'vision' | 'planner' | 'progress'>('vision');
  
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

  const logActivity = (date?: string) => {
    const today = date || new Date().toISOString().split('T')[0];
    setActivities(prev => {
      const existing = prev.find(a => a.date === today);
      if (existing) {
        return prev.map(a => a.date === today ? { ...a, count: a.count + 1 } : a);
      }
      return [...prev, { date: today, count: 1 }];
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-0 md:pt-16">
      {/* Top Header - Desktop Only */}
      <header className="hidden md:flex fixed top-0 w-full glass border-b border-slate-200 z-50 px-8 py-4 justify-between items-center">
        <h1 className="text-xl font-bold text-indigo-600 tracking-tight flex items-center gap-2">
          <Layout className="w-6 h-6" /> VisionFlow
        </h1>
        <div className="flex gap-8">
          <button onClick={() => setActiveTab('vision')} className={`flex items-center gap-2 font-medium ${activeTab === 'vision' ? 'text-indigo-600' : 'text-slate-500'}`}>
            <LayoutGrid className="w-4 h-4" /> Vision Board
          </button>
          <button onClick={() => setActiveTab('planner')} className={`flex items-center gap-2 font-medium ${activeTab === 'planner' ? 'text-indigo-600' : 'text-slate-500'}`}>
            <CheckSquare className="w-4 h-4" /> Daily Planner
          </button>
          <button onClick={() => setActiveTab('progress')} className={`flex items-center gap-2 font-medium ${activeTab === 'progress' ? 'text-indigo-600' : 'text-slate-500'}`}>
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
              logActivity();
            }} 
            onDeleteItem={(id) => setVisionItems(prev => prev.filter(i => i.id !== id))}
          />
        )}
        {activeTab === 'planner' && (
          <Planner 
            tasks={tasks} 
            setTasks={(newTasks) => {
              setTasks(newTasks);
              if (newTasks.length >= tasks.length) logActivity();
            }} 
          />
        )}
        {activeTab === 'progress' && (
          <ConsistencyTracker activities={activities} />
        )}
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full glass border-t border-slate-200 flex justify-around items-center py-4 px-2 z-50">
        <button onClick={() => setActiveTab('vision')} className={`flex flex-col items-center gap-1 ${activeTab === 'vision' ? 'text-indigo-600' : 'text-slate-500'}`}>
          <LayoutGrid className="w-6 h-6" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Vision</span>
        </button>
        <button onClick={() => setActiveTab('planner')} className={`flex flex-col items-center gap-1 ${activeTab === 'planner' ? 'text-indigo-600' : 'text-slate-500'}`}>
          <CheckSquare className="w-6 h-6" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Plan</span>
        </button>
        <button onClick={() => setActiveTab('progress')} className={`flex flex-col items-center gap-1 ${activeTab === 'progress' ? 'text-indigo-600' : 'text-slate-500'}`}>
          <BarChart3 className="w-6 h-6" />
          <span className="text-[10px] font-medium uppercase tracking-wider">Growth</span>
        </button>
      </nav>
    </div>
  );
};

export default App;