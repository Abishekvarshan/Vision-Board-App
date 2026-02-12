
import React, { useMemo } from 'react';
import { Activity } from '../types';
import { toLocalISODate } from '../src/date';

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
  const { year, months } = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();

    const activityMap = new Map<string, number>();
    for (const a of activities) activityMap.set(a.date, a.count);

    const formatDate = (d: Date) => toLocalISODate(d);
    const monthNameFmt = new Intl.DateTimeFormat(undefined, { month: 'short' });

    const months = Array.from({ length: 12 }).map((_, monthIdx) => {
      const first = new Date(year, monthIdx, 1);
      const last = new Date(year, monthIdx + 1, 0);

      const startDow = first.getDay(); // 0=Sun
      const totalDays = last.getDate();
      const totalCells = startDow + totalDays;
      const weeksCount = Math.ceil(totalCells / 7);

      const cells = Array.from({ length: weeksCount * 7 }).map((__, i) => {
        const dayNum = i - startDow + 1;
        if (dayNum < 1 || dayNum > totalDays) return { inMonth: false as const, date: '', count: 0 };
        const d = new Date(year, monthIdx, dayNum);
        const date = formatDate(d);
        const count = activityMap.get(date) ?? 0;
        return { inMonth: true as const, date, count };
      });

      return {
        monthIdx,
        label: monthNameFmt.format(first),
        weeksCount,
        cells,
      };
    });

    return { year, months };
  }, [activities]);

  const CELL = 12;
  const GAP = 3;

  const todayISO = useMemo(() => toLocalISODate(new Date()), []);
  const todayCount = useMemo(() => {
    const a = activities.find((x) => x.date === todayISO);
    return a && Number.isFinite(a.count) ? a.count : 0;
  }, [activities, todayISO]);

  const getColor = (count: number, inMonth: boolean) => {
    if (!inMonth) return 'bg-transparent';
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800';
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

      {/* Layout: month calendars scroll horizontally; stats stay visible without long vertical scrolling */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Month calendars (horizontal scroll) */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{year}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Monthly calendars (28/30/31 days)</div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span>Less</span>
              <div className="w-3 h-3 rounded-[2px] bg-slate-100 dark:bg-slate-800" />
              <div className="w-3 h-3 rounded-[2px] bg-indigo-200" />
              <div className="w-3 h-3 rounded-[2px] bg-indigo-400" />
              <div className="w-3 h-3 rounded-[2px] bg-indigo-600" />
              <div className="w-3 h-3 rounded-[2px] bg-indigo-900" />
              <span>More</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="flex gap-6 min-w-max pb-2">
              {months.map((m) => (
                <div
                  key={m.monthIdx}
                  className="w-[280px] shrink-0 bg-white/60 dark:bg-slate-950/30 border border-slate-100 dark:border-slate-800 rounded-3xl p-5"
                >
                  <div className="flex items-baseline justify-between">
                    <div className="text-sm font-black text-slate-900 dark:text-slate-100">{m.label}</div>
                  </div>

                  {/* Weekday header */}
                  <div className="grid grid-cols-7 mt-3 text-[10px] font-semibold text-slate-400" style={{ gap: GAP }}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                      <div key={`${d}-${i}`} className="text-center" style={{ width: CELL }}>
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 mt-2" style={{ gap: GAP }}>
                    {m.cells.map((c, idx) => (
                      <div
                        key={idx}
                        title={c.inMonth ? `${c.date}: ${c.count} activities` : ''}
                        className={`rounded-[2px] ${c.inMonth ? 'cursor-help hover:ring-2 hover:ring-indigo-300' : ''} ${getColor(c.count, c.inMonth)}`}
                        style={{ width: CELL, height: CELL }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Legend (mobile) */}
          <div className="sm:hidden mt-6 flex items-center justify-end gap-2 text-xs text-slate-400 font-medium">
            <span>Less</span>
            <div className="w-3 h-3 rounded-[2px] bg-slate-100 dark:bg-slate-800" />
            <div className="w-3 h-3 rounded-[2px] bg-indigo-200" />
            <div className="w-3 h-3 rounded-[2px] bg-indigo-400" />
            <div className="w-3 h-3 rounded-[2px] bg-indigo-600" />
            <div className="w-3 h-3 rounded-[2px] bg-indigo-900" />
            <span>More</span>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-400 uppercase mb-1">Today's Activities</p>
            <p className="text-4xl font-black text-slate-900 dark:text-slate-100">
              {todayCount}
            </p>
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
    </div>
  );
};
