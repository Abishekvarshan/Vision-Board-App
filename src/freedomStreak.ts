import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { fromISODateLocal, toLocalISODate } from './date';

export type FreedomMode = 'progressive' | 'weekly';

export type FreedomStreakDoc = {
  user_id: string;

  // Progressive levels: 2 -> 3 -> 5 -> 7, then weekly mode.
  current_level: 0 | 1 | 2 | 3 | 4;
  target_days: 2 | 3 | 5 | 7;
  current_streak: number;
  last_action_date: string | null; // YYYY-MM-DD (local)
  last_action_kind: 'clean' | 'broke' | null;

  // Weekly recap (current week only)
  weekly_recap_week_start: string | null; // YYYY-MM-DD (Monday)
  weekly_actions: Record<string, 'clean' | 'broke'>; // date -> action (only this week)

  // Weekly control mode
  weekly_usage_count: number; // used: 0..1
  weekly_reset_date: string | null; // YYYY-MM-DD when count was last reset

  updatedAt?: unknown;
  createdAt?: unknown;
};

const LEVEL_TARGETS: Array<2 | 3 | 5 | 7> = [2, 3, 5, 7];

const defaultDoc = (uid: string): FreedomStreakDoc => ({
  user_id: uid,
  current_level: 0,
  target_days: 2,
  current_streak: 0,
  last_action_date: null,
  last_action_kind: null,

  weekly_recap_week_start: null,
  weekly_actions: {},

  weekly_usage_count: 0,
  weekly_reset_date: null,
});

const cacheKey = (uid: string) => `freedom_streak:${uid}`;

export function readFreedomCache(uid: string): FreedomStreakDoc | null {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FreedomStreakDoc>;
    return { ...defaultDoc(uid), ...parsed, user_id: uid } as FreedomStreakDoc;
  } catch {
    return null;
  }
}

export function writeFreedomCache(uid: string, doc: FreedomStreakDoc) {
  try {
    localStorage.setItem(cacheKey(uid), JSON.stringify(doc));
  } catch {
    // ignore
  }
}

export const userFreedomRef = (uid: string) => doc(db, 'users', uid, 'stats', 'freedom');

export function getFreedomMode(doc: FreedomStreakDoc): FreedomMode {
  return doc.current_level >= 4 ? 'weekly' : 'progressive';
}

function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfWeekISO(d: Date): string {
  // Use Monday-start week.
  const copy = new Date(d);
  const dow = copy.getDay(); // 0 Sun ... 6 Sat
  const diffToMonday = (dow + 6) % 7;
  copy.setDate(copy.getDate() - diffToMonday);
  copy.setHours(0, 0, 0, 0);
  return toLocalISODate(copy);
}

function applyWeeklyRecap(prev: FreedomStreakDoc, todayISO: string, kind: 'clean' | 'broke'): Pick<
  FreedomStreakDoc,
  'weekly_recap_week_start' | 'weekly_actions'
> {
  const weekStart = startOfWeekISO(fromISODateLocal(todayISO));
  const needsReset = prev.weekly_recap_week_start !== weekStart;
  const baseActions = needsReset ? {} : (prev.weekly_actions ?? {});
  return {
    weekly_recap_week_start: weekStart,
    weekly_actions: {
      ...baseActions,
      [todayISO]: kind,
    },
  };
}

export async function getFreedomStreak(uid: string): Promise<FreedomStreakDoc> {
  const ref = userFreedomRef(uid);
  const cached = readFreedomCache(uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data() as FreedomStreakDoc;
      // Ensure new fields are present after schema upgrades
      const merged = {
        ...defaultDoc(uid),
        ...d,
        user_id: uid,
      };
      writeFreedomCache(uid, merged);
      return merged;
    }
    // No server doc yet: fallback to cache if present
    return cached ?? defaultDoc(uid);
  } catch {
    // Offline / blocked: fallback to cache
    return cached ?? defaultDoc(uid);
  }
}

export type FreedomActionResult = {
  updated: FreedomStreakDoc;
  levelCompleted: boolean;
  enteredWeeklyMode: boolean;
};

/**
 * User says: "I Stayed Clean Today".
 * - Once per day max.
 * - In progressive mode, streak increases only if yesterday was last action; otherwise resets to 1.
 * - When reaching the target, level increments and streak resets to 0 for the next target.
 */
export async function markCleanToday(uid: string, todayISO?: string): Promise<FreedomActionResult> {
  const ref = userFreedomRef(uid);
  const today = todayISO ?? toLocalISODate(new Date());

  const applyCleanLocal = (prevIn: FreedomStreakDoc): FreedomActionResult => {
    const prev = { ...defaultDoc(uid), ...prevIn, user_id: uid };

    // Disallow clean on a day the user already marked "broke".
    if (prev.last_action_date === today && prev.last_action_kind === 'broke') {
      return { updated: prev, levelCompleted: false, enteredWeeklyMode: getFreedomMode(prev) === 'weekly' };
    }

    if (getFreedomMode(prev) === 'weekly') {
      const next: FreedomStreakDoc = {
        ...prev,
        last_action_date: today,
        last_action_kind: 'clean',
        ...applyWeeklyRecap(prev, today, 'clean'),
      };
      return { updated: next, levelCompleted: false, enteredWeeklyMode: true };
    }

    if (prev.last_action_date === today) {
      return { updated: prev, levelCompleted: false, enteredWeeklyMode: false };
    }

    let nextStreak = 1;
    if (prev.last_action_date) {
      const lastDate = fromISODateLocal(prev.last_action_date);
      const expected = toLocalISODate(addDays(lastDate, 1));
      if (expected === today) nextStreak = (prev.current_streak ?? 0) + 1;
    }

    const target = prev.target_days;
    let levelCompleted = false;
    let enteredWeeklyMode = false;

    let nextLevel = prev.current_level;
    let nextTarget: 2 | 3 | 5 | 7 = prev.target_days;
    let nextStreakPost = nextStreak;

    if (nextStreak >= target) {
      levelCompleted = true;
      nextLevel = (Math.min(4, prev.current_level + 1) as any) as FreedomStreakDoc['current_level'];
      if (nextLevel >= 4) {
        enteredWeeklyMode = true;
        nextStreakPost = 0;
      } else {
        nextTarget = LEVEL_TARGETS[nextLevel] ?? 7;
        nextStreakPost = 0;
      }
    }

    const next: FreedomStreakDoc = {
      ...prev,
      current_level: nextLevel,
      target_days: nextTarget,
      current_streak: nextStreakPost,
      last_action_date: today,
      last_action_kind: 'clean',
      ...applyWeeklyRecap(prev, today, 'clean'),
    };

    return { updated: next, levelCompleted, enteredWeeklyMode };
  };

  try {
    const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists() ? ({ ...defaultDoc(uid), ...(snap.data() as any) } as FreedomStreakDoc) : defaultDoc(uid);

    // Disallow clean on a day the user already marked "broke".
    if (prev.last_action_date === today && prev.last_action_kind === 'broke') {
      return { updated: prev, levelCompleted: false, enteredWeeklyMode: getFreedomMode(prev) === 'weekly' };
    }

    // Weekly mode: clean action just updates last_action_date for UX (optional).
    if (getFreedomMode(prev) === 'weekly') {
      const next: FreedomStreakDoc = {
        ...prev,
        user_id: uid,
        last_action_date: today,
        last_action_kind: 'clean',
        ...applyWeeklyRecap(prev, today, 'clean'),
        updatedAt: serverTimestamp(),
        createdAt: (prev as any).createdAt ?? serverTimestamp(),
      };
      tx.set(ref, next, { merge: true });
      return { updated: next, levelCompleted: false, enteredWeeklyMode: true };
    }

    // Progressive mode
    if (prev.last_action_date === today) {
      // already counted today
      return { updated: prev, levelCompleted: false, enteredWeeklyMode: false };
    }

    let nextStreak = 1;
    if (prev.last_action_date) {
      const lastDate = fromISODateLocal(prev.last_action_date);
      const expected = toLocalISODate(addDays(lastDate, 1));
      if (expected === today) nextStreak = (prev.current_streak ?? 0) + 1;
    }

    const target = prev.target_days;
    let levelCompleted = false;
    let enteredWeeklyMode = false;

    let nextLevel = prev.current_level;
    let nextTarget: 2 | 3 | 5 | 7 = prev.target_days;
    let nextStreakPost = nextStreak;

    if (nextStreak >= target) {
      levelCompleted = true;
      nextLevel = (Math.min(4, prev.current_level + 1) as any) as FreedomStreakDoc['current_level'];
      if (nextLevel >= 4) {
        // Weekly control mode unlocked
        enteredWeeklyMode = true;
        nextStreakPost = 0;
      } else {
        nextTarget = LEVEL_TARGETS[nextLevel] ?? 7;
        // Reset streak for next level (progress tracked from 0 again)
        nextStreakPost = 0;
      }
    }

    const next: FreedomStreakDoc = {
      ...prev,
      user_id: uid,
      current_level: nextLevel,
      target_days: nextTarget,
      current_streak: nextStreakPost,
      last_action_date: today,
      last_action_kind: 'clean',
      ...applyWeeklyRecap(prev, today, 'clean'),
      updatedAt: serverTimestamp(),
      createdAt: (prev as any).createdAt ?? serverTimestamp(),
    };

    tx.set(ref, next, { merge: true });
    return { updated: next, levelCompleted, enteredWeeklyMode };
    });

    writeFreedomCache(uid, result.updated);
    return result;
  } catch {
    const prev = readFreedomCache(uid) ?? defaultDoc(uid);
    const res = applyCleanLocal(prev);
    writeFreedomCache(uid, res.updated);
    return res;
  }
}

/**
 * User says: "I Broke It".
 * - Progressive mode: reset ONLY current_streak to 0, keep level/target.
 * - Weekly mode: increment weekly_usage_count (max 1 per week) and set last_action_date.
 */
export async function markBrokeIt(uid: string, todayISO?: string): Promise<FreedomStreakDoc> {
  const ref = userFreedomRef(uid);
  const today = todayISO ?? toLocalISODate(new Date());

  const applyBrokeLocal = (prevIn: FreedomStreakDoc): FreedomStreakDoc => {
    const prev = { ...defaultDoc(uid), ...prevIn, user_id: uid };

    const recap = applyWeeklyRecap(prev, today, 'broke');

    if (getFreedomMode(prev) === 'weekly') {
      const weekStart = startOfWeekISO(fromISODateLocal(today));
      const needsReset = prev.weekly_reset_date !== weekStart;
      const count = needsReset ? 0 : (prev.weekly_usage_count ?? 0);
      const nextCount = Math.min(1, count + 1);
      return {
        ...prev,
        ...recap,
        weekly_reset_date: weekStart,
        weekly_usage_count: nextCount,
        last_action_date: today,
        last_action_kind: 'broke',
      };
    }

    return {
      ...prev,
      ...recap,
      current_streak: 0,
      last_action_date: today,
      last_action_kind: 'broke',
    };
  };

  try {
    const updated = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists() ? ({ ...defaultDoc(uid), ...(snap.data() as any) } as FreedomStreakDoc) : defaultDoc(uid);

    const recap = applyWeeklyRecap(prev, today, 'broke');

    if (getFreedomMode(prev) === 'weekly') {
      // Reset weekly counter when week changes
      const weekStart = startOfWeekISO(fromISODateLocal(today));
      const needsReset = prev.weekly_reset_date !== weekStart;
      const count = needsReset ? 0 : (prev.weekly_usage_count ?? 0);
      const nextCount = Math.min(1, count + 1);

      const next: FreedomStreakDoc = {
        ...prev,
        user_id: uid,
        ...recap,
        weekly_reset_date: weekStart,
        weekly_usage_count: nextCount,
        last_action_date: today,
        last_action_kind: 'broke',
        updatedAt: serverTimestamp(),
        createdAt: (prev as any).createdAt ?? serverTimestamp(),
      };
      tx.set(ref, next, { merge: true });
      return next;
    }

    const next: FreedomStreakDoc = {
      ...prev,
      user_id: uid,
      ...recap,
      current_streak: 0,
      last_action_date: today,
      last_action_kind: 'broke',
      updatedAt: serverTimestamp(),
      createdAt: (prev as any).createdAt ?? serverTimestamp(),
    };

    tx.set(ref, next, { merge: true });
    return next;
    });

    writeFreedomCache(uid, updated);
    return updated;
  } catch {
    const prev = readFreedomCache(uid) ?? defaultDoc(uid);
    const updated = applyBrokeLocal(prev);
    writeFreedomCache(uid, updated);
    return updated;
  }
}

export function ensureWeeklyResetLocal(docIn: FreedomStreakDoc, now = new Date()): FreedomStreakDoc {
  if (getFreedomMode(docIn) !== 'weekly') return docIn;
  const weekStart = startOfWeekISO(now);
  if (docIn.weekly_reset_date === weekStart) return docIn;
  return {
    ...docIn,
    weekly_reset_date: weekStart,
    weekly_usage_count: 0,
  };
}
