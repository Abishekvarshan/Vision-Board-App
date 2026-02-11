
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
  const { weeks, monthLabels, monthStarts, dayLabels } = useMemo(() => {
    const today = new Date();
    const end = new Date(today);
    end.setHours(0, 0, 0, 0);

    // Start date: go back ~52 weeks and align to Sunday (GitHub-like)
    const start = new Date(end);
    start.setDate(start.getDate() - 364);
    start.setHours(0, 0, 0, 0);
    const day = start.getDay(); // 0=Sun
    start.setDate(start.getDate() - day);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const days: { date: string; count: number; jsDate: Date }[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const dateStr = formatDate(cursor);
      const activity = activities.find(a => a.date === dateStr);
      days.push({ date: dateStr, count: activity ? activity.count : 0, jsDate: new Date(cursor) });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Group into weeks (columns). Each week has 7 days (rows).
    const weeks: { date: string; count: number; jsDate: Date }[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      const week = days.slice(i, i + 7);
      if (week.length === 7) weeks.push(week);
    }

    // Month labels: show label when month changes at the start of a week
    const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short' });
    const monthStarts = weeks.map((week, idx) => {
      const firstDay = week[0].jsDate;
      const prevFirst = idx > 0 ? weeks[idx - 1][0].jsDate : null;
      return !prevFirst || prevFirst.getMonth() !== firstDay.getMonth() || prevFirst.getFullYear() !== firstDay.getFullYear();
    });

    const monthLabels = weeks.map((week, idx) => {
      if (!monthStarts[idx]) return '';
      return monthFmt.format(week[0].jsDate);
    });

    // Day labels on the left (GitHub shows Mon/Wed/Fri typically)
    const dayLabels = [
      { row: 1, label: 'Mon' },
      { row: 3, label: 'Wed' },
      { row: 5, label: 'Fri' },
    ];

    return { weeks, monthLabels, monthStarts, dayLabels };
  }, [activities]);

  const CELL = 12;
  const GAP = 3;
  const MONTH_GAP = 8;

  const getColor = (count: number) => {
    if (count === 0) return 'bg-slate-100';
    if (count <= 1) return 'bg-indigo-200';
    if (count <= 3) return 'bg-indigo-400';
    if (count <= 5) return 'bg-indigo-600';
    return 'bg-indigo-900';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Consistency Tracker</h2>
        <p className="text-slate-500 dark:text-slate-400">Visualization of your discipline and progress over the past year.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-x-auto">
        {/* Month labels */}
        <div className="flex min-w-max pl-10 mb-2">
          {monthLabels.map((label, idx) => (
            <div
              key={idx}
              style={{
                width: CELL,
                marginRight: idx === monthLabels.length - 1 ? 0 : GAP,
                marginLeft: monthStarts[idx] && idx !== 0 ? MONTH_GAP : 0,
              }}
              className="text-[10px] font-semibold text-slate-400"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Grid with day labels */}
        <div className="flex gap-2 min-w-max">
          <div className="w-8 flex flex-col" style={{ gap: GAP }}>
            {Array.from({ length: 7 }).map((_, row) => {
              const dl = dayLabels.find(d => d.row === row);
              return (
                <div key={row} className="text-[10px] text-slate-400" style={{ height: CELL, lineHeight: `${CELL}px` }}>
                  {dl ? dl.label : ''}
                </div>
              );
            })}
          </div>

          <div className="flex" style={{ gap: GAP }}>
            {weeks.map((week, wIdx) => (
              <div
                key={wIdx}
                className="flex flex-col"
                style={{
                  gap: GAP,
                  marginLeft: monthStarts[wIdx] && wIdx !== 0 ? MONTH_GAP : 0,
                }}
              >
                {week.map((day, dIdx) => (
                  <div
                    key={dIdx}
                    title={`${day.date}: ${day.count} activities`}
                    className={`rounded-[2px] cursor-help transition-all hover:ring-2 hover:ring-indigo-300 ${getColor(day.count)}`}
                    style={{ width: CELL, height: CELL }}
                  />
                ))}
              </div>
            ))}
          </div>
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
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-sm font-bold text-slate-400 uppercase mb-1">Total Activities</p>
          <p className="text-4xl font-black text-slate-900 dark:text-slate-100">{activities.reduce((acc, curr) => acc + curr.count, 0)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-sm font-bold text-slate-400 uppercase mb-1">Active Days</p>
          <p className="text-4xl font-black text-indigo-600">{activities.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-sm font-bold text-slate-400 uppercase mb-1">Current Streak</p>
          <p className="text-4xl font-black text-slate-900 dark:text-slate-100">
            {typeof currentStreak === 'number' ? `${currentStreak} Days` : '—'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-sm font-bold text-slate-400 uppercase mb-1">Longest Streak</p>
          <p className="text-4xl font-black text-indigo-600">
            {typeof longestStreak === 'number' ? `${longestStreak} Days` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
};
