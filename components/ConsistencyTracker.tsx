
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity } from '../types';
import { toLocalISODate } from '../src/date';
import {
  ensureWeeklyResetLocal,
  FreedomStreakDoc,
  getFreedomMode,
  getFreedomStreak,
  markBrokeIt,
  markCleanToday,
} from '../src/freedomStreak';

interface Props {
  activities: Activity[];
  currentStreak?: number;
  longestStreak?: number;
  uid?: string;
}

export const ConsistencyTracker: React.FC<Props> = ({
  activities,
  currentStreak: _currentStreak,
  longestStreak: _longestStreak,
  uid,
}) => {
  const [now, setNow] = useState(() => new Date());

  // Freedom Streak state
  const [freedom, setFreedom] = useState<FreedomStreakDoc | null>(null);
  const [freedomLoading, setFreedomLoading] = useState(false);
  const [encourage, setEncourage] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [reward, setReward] = useState<{ title: string; body: string } | null>(null);

  const rewards = useMemo(
    () => [
      'Buy yourself an ice cream',
      'Enjoy your favorite coffee or milkshake',
      'Eat one small chocolate or dessert',
      'Watch one movie or one episode guilt-free',
      'Eat your favorite snack once – OK: Lava Cake',
      'Play games for 30–45 minutes',
      'Buy one small affordable item under your budget limit',
      'Go for a relaxing evening walk with music',
      'Spend 1 hour doing your favorite hobby such as reading or sketching',
      'Take a no-work relaxation evening just for yourself',
    ],
    []
  );

  const pickReward = useCallback(() => {
    const idx = Math.floor(Math.random() * rewards.length);
    const r = rewards[idx] ?? rewards[0];
    return {
      title: 'Milestone reward (optional)',
      body: r!,
    };
  }, [rewards]);

  useEffect(() => {
    if (!uid) return;
    setFreedomLoading(true);
    getFreedomStreak(uid)
      .then((d) => setFreedom(ensureWeeklyResetLocal(d)))
      .catch((e) => console.error('Failed to load freedom streak', e))
      .finally(() => setFreedomLoading(false));
  }, [uid]);

  // Tiny celebration auto-hide
  useEffect(() => {
    if (!celebrate) return;
    const id = window.setTimeout(() => setCelebrate(false), 1600);
    return () => window.clearTimeout(id);
  }, [celebrate]);

  // Keep the time bar fresh without being too noisy.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const freedomMode = freedom ? getFreedomMode(freedom) : 'progressive';
  const todayISO = useMemo(() => toLocalISODate(new Date()), [now]);

  const canShowCleanToday = useMemo(() => {
    if (!uid) return false;
    if (!freedom) return true;

    // If the user broke today, hide the Clean button until the next day.
    if (freedom.last_action_date === todayISO && freedom.last_action_kind === 'broke') return false;

    // If already marked clean today, also hide (already counted).
    if (freedom.last_action_date === todayISO && freedom.last_action_kind === 'clean') return false;

    return true;
  }, [freedom, todayISO, uid]);

  const freedomTargetLabel = useMemo(() => {
    if (!freedom) return '—';
    if (freedomMode === 'weekly') return 'Weekly Control Mode';
    return `${freedom.target_days} Days`;
  }, [freedom, freedomMode]);

  const freedomProgress = useMemo(() => {
    if (!freedom) return { label: '0/0', pct: 0 };
    if (freedomMode === 'weekly') {
      const used = freedom.weekly_usage_count ?? 0;
      return { label: `Used: ${used}/1 this week`, pct: Math.min(1, used / 1) };
    }
    const cur = freedom.current_streak ?? 0;
    const tgt = freedom.target_days;
    return { label: `${cur}/${tgt} Days`, pct: tgt <= 0 ? 0 : Math.min(1, cur / tgt) };
  }, [freedom, freedomMode]);

  const weeklyRecap = useMemo(() => {
    if (!freedom) {
      return { cleanDays: 0, brokeDays: 0, totalDays: 0, weekStart: null as string | null };
    }
    const actions = freedom.weekly_actions ?? {};
    let cleanDays = 0;
    let brokeDays = 0;
    for (const k of Object.keys(actions)) {
      if (actions[k] === 'clean') cleanDays++;
      else if (actions[k] === 'broke') brokeDays++;
    }
    const totalDays = cleanDays + brokeDays;
    return {
      cleanDays,
      brokeDays,
      totalDays,
      weekStart: freedom.weekly_recap_week_start ?? null,
    };
  }, [freedom]);

  const isSunday = useMemo(() => {
    // local Sunday
    return now.getDay() === 0;
  }, [now]);

  const onCleanToday = async () => {
    if (!uid) return;
    setEncourage(null);
    setFreedomLoading(true);
    try {
      const res = await markCleanToday(uid);
      setFreedom(ensureWeeklyResetLocal(res.updated));
      if (res.levelCompleted) {
        setCelebrate(true);
        // show reward popups only for milestone targets (2/3/5/7), not when entering weekly
        if (!res.enteredWeeklyMode) setReward(pickReward());
      }
    } catch (e) {
      console.error('markCleanToday failed', e);
    } finally {
      setFreedomLoading(false);
    }
  };

  const onBrokeIt = async () => {
    if (!uid) return;
    setFreedomLoading(true);
    try {
      const updated = await markBrokeIt(uid);
      setFreedom(ensureWeeklyResetLocal(updated));
      setEncourage(
        "That’s okay. Take a breath, reset, and we’ll go again today."
      );
    } catch (e) {
      console.error('markBrokeIt failed', e);
    } finally {
      setFreedomLoading(false);
    }
  };

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

  const timeWindow = useMemo(() => {
    const start = new Date(now);
    start.setHours(5, 30, 0, 0); // 5:30 AM
    const end = new Date(now);
    end.setHours(22, 0, 0, 0); // 10:00 PM

    const totalMs = Math.max(1, end.getTime() - start.getTime());
    const elapsedMs = now.getTime() - start.getTime();
    const clampedProgress = Math.min(1, Math.max(0, elapsedMs / totalMs));

    const remainingMs = Math.max(0, end.getTime() - now.getTime());

    const fmtTime = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });

    const fmtDuration = (ms: number) => {
      const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      if (h <= 0) return `${m}m`;
      if (m === 0) return `${h}h`;
      return `${h}h ${m}m`;
    };

    let statusLabel = '';
    if (now.getTime() < start.getTime()) {
      statusLabel = `Starts in ${fmtDuration(start.getTime() - now.getTime())}`;
    } else if (now.getTime() >= end.getTime()) {
      statusLabel = 'Window finished';
    } else {
      statusLabel = `${fmtDuration(remainingMs)} remaining`;
    }

    return {
      start,
      end,
      progress: clampedProgress,
      statusLabel,
      startLabel: fmtTime.format(start),
      endLabel: fmtTime.format(end),
      nowLabel: fmtTime.format(now),
    };
  }, [now]);

  const progressColor = useMemo(() => {
    // Interpolate green -> blue -> red based on progress
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const toRgb = (r: number, g: number, b: number) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;

    const p = timeWindow.progress;
    const green = { r: 34, g: 197, b: 94 };
    const blue = { r: 59, g: 130, b: 246 };
    const red = { r: 239, g: 68, b: 68 };

    if (p <= 0.5) {
      const t = p / 0.5;
      return toRgb(lerp(green.r, blue.r, t), lerp(green.g, blue.g, t), lerp(green.b, blue.b, t));
    }

    const t = (p - 0.5) / 0.5;
    return toRgb(lerp(blue.r, red.r, t), lerp(blue.g, red.g, t), lerp(blue.b, red.b, t));
  }, [timeWindow.progress]);

  const getColor = (count: number, inMonth: boolean) => {
    if (!inMonth) return 'bg-transparent';
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800';
    // Inverted intensity:
    // - more activity => brighter
    // - less activity => darker
    if (count <= 1) return 'bg-emerald-900';
    if (count <= 3) return 'bg-emerald-700';
    if (count <= 5) return 'bg-emerald-500';
    return 'bg-emerald-200';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Growth</h2>
      </div>

      {/* Freedom Streak */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Freedom Streak</div>
            <div className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{freedomTargetLabel}</span>
              {celebrate && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-black animate-in zoom-in duration-300">
                  Unlocked!
                </span>
              )}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
              {freedom ? freedomProgress.label : uid ? 'Loading…' : 'Sign in to start'}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Status</div>
            <div className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">
              {freedomLoading ? 'Saving…' : freedomMode === 'weekly' ? 'Controlled' : 'Building'}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-700 bg-indigo-600"
              style={{ width: `${Math.round(freedomProgress.pct * 100)}%` }}
            />
          </div>
        </div>

        {encourage && (
          <div className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-2xl px-4 py-3">
            {encourage}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {canShowCleanToday && (
            <button
              onClick={onCleanToday}
              disabled={!uid || freedomLoading}
              className="w-full px-4 py-3 rounded-2xl bg-indigo-600 text-white font-extrabold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              I Stayed Clean Today
            </button>
          )}
          <button
            onClick={onBrokeIt}
            disabled={!uid || freedomLoading}
            className={`w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition ${
              canShowCleanToday ? '' : 'sm:col-span-2'
            }`}
          >
            I Broke It
          </button>
        </div>
      </div>

      {/* Weekly Recap (Sundays only) */}
      {isSunday && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Weekly Recap</div>
              <div className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100">
                {weeklyRecap.weekStart ? `Week of ${weeklyRecap.weekStart}` : 'This week'}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Clean days: <span className="text-emerald-600 dark:text-emerald-400 font-black">{weeklyRecap.cleanDays}</span>
                {'  '}•{'  '}
                Break days: <span className="text-rose-600 dark:text-rose-400 font-black">{weeklyRecap.brokeDays}</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Total</div>
              <div className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">
                {weeklyRecap.totalDays}/7 days logged
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-700 bg-emerald-500"
                style={{ width: `${Math.round((weeklyRecap.cleanDays / 7) * 100)}%` }}
              />
            </div>
            <div className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Weekly reset tomorrow. Celebrate progress, then recommit.
            </div>
          </div>
        </div>
      )}

      {/* Reward Popup */}
      {reward && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-8 animate-in zoom-in duration-200">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{reward.title}</div>
            <div className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100">You earned it.</div>
            <div className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
              {reward.body}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => setReward(null)}
                className="px-4 py-3 rounded-2xl bg-indigo-600 text-white font-extrabold hover:bg-indigo-700 transition"
              >
                Accept Reward
              </button>
              <button
                onClick={() => setReward(null)}
                className="px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-extrabold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Layout: month calendars scroll horizontally; stats stay visible without long vertical scrolling */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Month calendars (horizontal scroll) */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{year}</div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span>Less</span>
              <div className="w-3 h-3 rounded-[2px] bg-slate-100 dark:bg-slate-800" />
              <div className="w-3 h-3 rounded-[2px] bg-emerald-900" />
              <div className="w-3 h-3 rounded-[2px] bg-emerald-700" />
              <div className="w-3 h-3 rounded-[2px] bg-emerald-500" />
              <div className="w-3 h-3 rounded-[2px] bg-emerald-200" />
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
            <div className="w-3 h-3 rounded-[2px] bg-emerald-900" />
            <div className="w-3 h-3 rounded-[2px] bg-emerald-700" />
            <div className="w-3 h-3 rounded-[2px] bg-emerald-500" />
            <div className="w-3 h-3 rounded-[2px] bg-emerald-200" />
            <span>More</span>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase mb-1">Day Progress</p>
                <p className="text-lg font-black text-slate-900 dark:text-slate-100">
                  {timeWindow.startLabel} – {timeWindow.endLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold text-slate-400 uppercase">Now</p>
                <p className="text-sm font-black text-slate-900 dark:text-slate-100">{timeWindow.nowLabel}</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{
                    width: `${Math.round(timeWindow.progress * 100)}%`,
                    backgroundColor: progressColor,
                  }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>{timeWindow.startLabel}</span>
                <span className="text-slate-700 dark:text-slate-200">{timeWindow.statusLabel}</span>
                <span>{timeWindow.endLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
