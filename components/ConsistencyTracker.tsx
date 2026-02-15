import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const currentMonthIdx = useMemo(() => new Date().getMonth(), []);
  const monthsScrollRef = useRef<HTMLDivElement>(null);
  const currentMonthRef = useRef<HTMLDivElement>(null);
  const didAutoScrollRef = useRef(false);

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
      'Eat your favorite snack once - OK: Lava Cake',
      'Play games for 30-45 minutes',
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
    return { title: 'Milestone reward (optional)', body: r! };
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

  // Auto-scroll the month strip to the current month once (on mount)
  useEffect(() => {
    if (didAutoScrollRef.current) return;
    didAutoScrollRef.current = true;

    const scrollToCurrentMonth = (behavior: ScrollBehavior) => {
      const container = monthsScrollRef.current;
      const el = currentMonthRef.current;
      if (!container || !el) return;

      // Get element's position and dimensions
      const elLeft = el.offsetLeft;
      const elWidth = el.offsetWidth;
      const containerWidth = container.clientWidth;

      // Calculate scroll position to center the current month
      // Formula: element's left - half of container width + half of element width
      const scrollPosition = elLeft - (containerWidth / 2) + (elWidth / 2);

      // Clamp to valid scroll range (can't scroll beyond content)
      const maxScroll = Math.max(0, container.scrollWidth - containerWidth);
      const finalPosition = Math.min(maxScroll, Math.max(0, scrollPosition));

      container.scrollTo({ left: finalPosition, behavior });
    };

    // Multiple timeouts to handle layout shifts as content loads
    const id1 = window.setTimeout(() => scrollToCurrentMonth('auto'), 0);
    const id2 = window.setTimeout(() => scrollToCurrentMonth('smooth'), 250);
    const id3 = window.setTimeout(() => scrollToCurrentMonth('smooth'), 900);
    
    return () => {
      window.clearTimeout(id1);
      window.clearTimeout(id2);
      window.clearTimeout(id3);
    };
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
        "That's okay. Take a breath, reset, and we'll go again today."
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
        if (dayNum < 1 || dayNum > totalDays)
          return { inMonth: false as const, date: '', count: 0 };

        const d = new Date(year, monthIdx, dayNum);
        const date = formatDate(d);
        const count = activityMap.get(date) ?? 0;
        return { inMonth: true as const, date, count };
      });

      return { monthIdx, label: monthNameFmt.format(first), weeksCount, cells };
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
    const toRgb = (r: number, g: number, b: number) =>
      `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;

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
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="px-4 py-5 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl font-extrabold tracking-tight">Growth</h1>
      </div>

      <div className="space-y-6 p-4">
        {/* Freedom Streak */}
        <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-5 space-y-4 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              Freedom Streak
            </h2>
            <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              {freedomTargetLabel}
            </span>
            {celebrate && (
              <span className="text-2xl animate-bounce">🎉 Unlocked! 🎉</span>
            )}
          </div>

          <p className="text-lg font-extrabold text-slate-700 dark:text-slate-300">
            {freedom ? freedomProgress.label : uid ? 'Loading…' : 'Sign in to start'}
          </p>

          <div className="relative h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-indigo-600 transition-all duration-700 ease-out rounded-full"
              style={{ width: `${freedomProgress.pct * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              Status
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {freedomLoading ? 'Saving…' : freedomMode === 'weekly' ? 'Controlled' : 'Building'}
            </span>
          </div>

          {encourage && (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-900">
              <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300">{encourage}</p>
            </div>
          )}

          {canShowCleanToday && (
            <button
              onClick={onCleanToday}
              disabled={freedomLoading}
              className="w-full py-4 px-6 rounded-2xl bg-indigo-600 text-white font-extrabold text-base hover:bg-indigo-700 active:scale-[0.98] transition disabled:opacity-50"
            >
              I Stayed Clean Today
            </button>
          )}

          <button
            onClick={onBrokeIt}
            disabled={freedomLoading}
            className="w-full py-4 px-6 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-extrabold text-base hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] transition disabled:opacity-50"
          >
            I Broke It
          </button>
        </div>

        {/* Reward Popup */}
        {reward && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {reward.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">You earned it.</p>
              <p className="text-base font-bold text-slate-800 dark:text-slate-200">{reward.body}</p>

              <div className="flex gap-3">
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
        <div className="space-y-4">
          {/* Month calendars (horizontal scroll) */}
          <div className="space-y-3">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              {year}
            </h2>

            {/* Legend (desktop) */}
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold">Less</span>
              <div className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="w-3 h-3 rounded bg-emerald-900" />
              <div className="w-3 h-3 rounded bg-emerald-700" />
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <div className="w-3 h-3 rounded bg-emerald-200" />
              <span className="font-bold">More</span>
            </div>

            <div
              ref={monthsScrollRef}
              className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent"
            >
              {months.map((m) => (
                <div
                  key={m.monthIdx}
                  ref={m.monthIdx === currentMonthIdx ? currentMonthRef : undefined}
                  className="flex-shrink-0 bg-slate-50 dark:bg-slate-900 rounded-2xl p-5 space-y-3 border border-slate-200 dark:border-slate-800"
                  style={{
                    width: `${7 * (CELL + GAP) + GAP + 40}px`,
                  }}
                >
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {m.label}
                  </h3>

                  {/* Weekday header */}
                  <div
                    className="grid gap-[3px]"
                    style={{
                      gridTemplateColumns: `repeat(7, ${CELL}px)`,
                    }}
                  >
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                      <div
                        key={i}
                        className="text-[10px] font-bold text-slate-400 dark:text-slate-600 text-center"
                        style={{ width: CELL, height: CELL, lineHeight: `${CELL}px` }}
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div
                    className="grid gap-[3px]"
                    style={{
                      gridTemplateColumns: `repeat(7, ${CELL}px)`,
                    }}
                  >
                    {m.cells.map((c, idx) => (
                      <div
                        key={idx}
                        className={`rounded ${getColor(c.count, c.inMonth)} transition-colors`}
                        style={{ width: CELL, height: CELL }}
                        title={c.inMonth ? `${c.date}: ${c.count}` : ''}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend (mobile) */}
            <div className="flex md:hidden items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold">Less</span>
              <div className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="w-3 h-3 rounded bg-emerald-900" />
              <div className="w-3 h-3 rounded bg-emerald-700" />
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <div className="w-3 h-3 rounded bg-emerald-200" />
              <span className="font-bold">More</span>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-5 space-y-4 border border-slate-200 dark:border-slate-800">
            <h2 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
              Day Progress
            </h2>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
              {timeWindow.startLabel} – {timeWindow.endLabel}
            </p>

            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xs font-extrabold text-white" style={{ backgroundColor: progressColor }}>
                Now
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-lg font-extrabold text-slate-800 dark:text-slate-200">
                  {timeWindow.nowLabel}
                </p>
              </div>
            </div>

            <div className="relative h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 transition-all duration-300 ease-linear rounded-full"
                style={{ width: `${timeWindow.progress * 100}%`, backgroundColor: progressColor }}
              />
            </div>

            <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>{timeWindow.startLabel}</span>
              <span>{timeWindow.statusLabel}</span>
              <span>{timeWindow.endLabel}</span>
            </div>
          </div>

          {/* Weekly Recap (Sundays only) */}
          {isSunday && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-6 space-y-4 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                    Weekly Recap
                  </h2>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
                    {weeklyRecap.weekStart ? `Week of ${weeklyRecap.weekStart}` : 'This week'}
                  </p>
                </div>
              </div>

              {/* Visual Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Clean Days Card */}
                <div className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-bold">
                      Clean Days
                    </span>
                  </div>
                  <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {weeklyRecap.cleanDays}
                  </p>
                  <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 dark:bg-emerald-600 rounded-full transition-all duration-500"
                      style={{ width: `${(weeklyRecap.cleanDays / 7) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Break Days Card */}
                <div className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs uppercase tracking-wider text-orange-700 dark:text-orange-400 font-bold">
                      Break Days
                    </span>
                  </div>
                  <p className="text-3xl font-extrabold text-orange-600 dark:text-orange-400">
                    {weeklyRecap.brokeDays}
                  </p>
                  <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 dark:bg-orange-600 rounded-full transition-all duration-500"
                      style={{ width: `${(weeklyRecap.brokeDays / 7) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Total Progress */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                    Total Logged
                  </span>
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                    {weeklyRecap.totalDays}<span className="text-lg text-slate-500 dark:text-slate-400">/7</span>
                  </span>
                </div>
                
                {/* Week Visualization */}
                <div className="flex gap-1.5">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const hasActivity = i < weeklyRecap.totalDays;
                    return (
                      <div 
                        key={i}
                        className={`flex-1 h-8 rounded-lg transition-all duration-300 ${
                          hasActivity 
                            ? 'bg-indigo-500 dark:bg-indigo-600' 
                            : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>


              {/* Reset Notice */}
              <div className="flex items-center gap-2 justify-center text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold">Weekly reset tomorrow</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};