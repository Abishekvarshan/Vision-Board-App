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
  weekly_usage_count: 0,
  weekly_reset_date: null,
});

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

export async function getFreedomStreak(uid: string): Promise<FreedomStreakDoc> {
  const ref = userFreedomRef(uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const d = snap.data() as FreedomStreakDoc;
    // Ensure new fields are present after schema upgrades
    return {
      ...defaultDoc(uid),
      ...d,
      user_id: uid,
    };
  }
  return defaultDoc(uid);
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

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists() ? ({ ...defaultDoc(uid), ...(snap.data() as any) } as FreedomStreakDoc) : defaultDoc(uid);

    // Weekly mode: clean action just updates last_action_date for UX (optional).
    if (getFreedomMode(prev) === 'weekly') {
      const next: FreedomStreakDoc = {
        ...prev,
        user_id: uid,
        last_action_date: today,
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
      updatedAt: serverTimestamp(),
      createdAt: (prev as any).createdAt ?? serverTimestamp(),
    };

    tx.set(ref, next, { merge: true });
    return { updated: next, levelCompleted, enteredWeeklyMode };
  });
}

/**
 * User says: "I Broke It".
 * - Progressive mode: reset ONLY current_streak to 0, keep level/target.
 * - Weekly mode: increment weekly_usage_count (max 1 per week) and set last_action_date.
 */
export async function markBrokeIt(uid: string, todayISO?: string): Promise<FreedomStreakDoc> {
  const ref = userFreedomRef(uid);
  const today = todayISO ?? toLocalISODate(new Date());

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists() ? ({ ...defaultDoc(uid), ...(snap.data() as any) } as FreedomStreakDoc) : defaultDoc(uid);

    if (getFreedomMode(prev) === 'weekly') {
      // Reset weekly counter when week changes
      const weekStart = startOfWeekISO(fromISODateLocal(today));
      const needsReset = prev.weekly_reset_date !== weekStart;
      const count = needsReset ? 0 : (prev.weekly_usage_count ?? 0);
      const nextCount = Math.min(1, count + 1);

      const next: FreedomStreakDoc = {
        ...prev,
        user_id: uid,
        weekly_reset_date: weekStart,
        weekly_usage_count: nextCount,
        last_action_date: today,
        updatedAt: serverTimestamp(),
        createdAt: (prev as any).createdAt ?? serverTimestamp(),
      };
      tx.set(ref, next, { merge: true });
      return next;
    }

    const next: FreedomStreakDoc = {
      ...prev,
      user_id: uid,
      current_streak: 0,
      last_action_date: today,
      updatedAt: serverTimestamp(),
      createdAt: (prev as any).createdAt ?? serverTimestamp(),
    };

    tx.set(ref, next, { merge: true });
    return next;
  });
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
