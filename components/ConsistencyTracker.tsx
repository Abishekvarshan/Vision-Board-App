
import React, { useMemo } from 'react';
import { Activity } from '../types';

interface Props {
  activities: Activity[];
  currentStreak?: number;
  longestStreak?: number;
}

export const ConsistencyTracker: React.FC<Props> = ({
  activities,
  currentStreak,
  longestStreak,
}) => {
  const heatmapData = useMemo(() => {
    const data = [];
    const today = new Date();
    // 53 weeks * 7 days
    for (let i = 370; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const activity = activities.find(a => a.date === dateStr);
      data.push({
        date: dateStr,
        count: activity ? activity.count : 0
      });
    }
    return data;
  }, [activities]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-slate-100';
    if (count <= 1) return 'bg-indigo-200';
    if (count <= 3) return 'bg-indigo-400';
    if (count <= 5) return 'bg-indigo-600';
    return 'bg-indigo-900';
  };

  // Group by weeks for the grid
  const weeks = [];
  for (let i = 0; i < heatmapData.length; i += 7) {
    weeks.push(heatmapData.slice(i, i + 7));
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-slate-900">Consistency Tracker</h2>
        <p className="text-slate-500">Visualization of your discipline and progress over the past year.</p>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 overflow-x-auto">
        <div className="flex gap-[3px] min-w-max">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-[3px]">
              {week.map((day, dIdx) => (
                <div 
                  key={dIdx} 
                  title={`${day.date}: ${day.count} activities`}
                  className={`w-[14px] h-[14px] rounded-[2px] cursor-help transition-all hover:ring-2 hover:ring-indigo-300 ${getColor(day.count)}`} 
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-end gap-2 text-xs text-slate-400 font-medium">
          <span>Less</span>
          <div className="w-3 h-3 rounded-[2px] bg-slate-100" />
          <div className="w-3 h-3 rounded-[2px] bg-indigo-200" />
          <div className="w-3 h-3 rounded-[2px] bg-indigo-400" />
          <div className="w-3 h-3 rounded-[2px] bg-indigo-600" />
          <div className="w-3 h-3 rounded-[2px] bg-indigo-900" />
          <span>More</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-sm font-bold text-slate-400 uppercase mb-1">Total Activities</p>
          <p className="text-4xl font-black text-slate-900">{activities.reduce((acc, curr) => acc + curr.count, 0)}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-sm font-bold text-slate-400 uppercase mb-1">Active Days</p>
          <p className="text-4xl font-black text-indigo-600">{activities.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-sm font-bold text-slate-400 uppercase mb-1">Current Streak</p>
          <p className="text-4xl font-black text-slate-900">
            {typeof currentStreak === 'number' ? `${currentStreak} Days` : '—'}
          </p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <p className="text-sm font-bold text-slate-400 uppercase mb-1">Longest Streak</p>
          <p className="text-4xl font-black text-indigo-600">
            {typeof longestStreak === 'number' ? `${longestStreak} Days` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
};
