import { doc, getDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { fromISODateLocal, toLocalISODate } from './date';

export type StreakDoc = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null; // YYYY-MM-DD
  updatedAt?: unknown;
  createdAt?: unknown;
};

const addDays = (d: Date, days: number) => {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
};

export const userStreakRef = (uid: string) => doc(db, 'users', uid, 'stats', 'streak');

export async function getUserStreak(uid: string): Promise<StreakDoc> {
  const ref = userStreakRef(uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as StreakDoc;
  return { currentStreak: 0, longestStreak: 0, lastActiveDate: null };
}

/**
 * Increment streak when the user does an activity on a given date.
 * Rules:
 * - same day: no change
 * - next day: currentStreak + 1
 * - gap > 1 day: reset to 1
 */
export async function recordActivityForUser(uid: string, activityDateISO?: string) {
  const ref = userStreakRef(uid);
  const todayISO = activityDateISO ?? toLocalISODate(new Date());

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prev: StreakDoc = snap.exists()
      ? (snap.data() as StreakDoc)
      : { currentStreak: 0, longestStreak: 0, lastActiveDate: null };

    const last = prev.lastActiveDate;
    let nextCurrent = prev.currentStreak;

    if (!last) {
      nextCurrent = 1;
    } else if (last === todayISO) {
      // already counted today
      nextCurrent = prev.currentStreak;
    } else {
      const lastDate = fromISODateLocal(last);
      const expectedNext = toLocalISODate(addDays(lastDate, 1));
      if (expectedNext === todayISO) nextCurrent = prev.currentStreak + 1;
      else nextCurrent = 1;
    }

    const nextLongest = Math.max(prev.longestStreak ?? 0, nextCurrent);

    const nextDoc: StreakDoc = {
      currentStreak: nextCurrent,
      longestStreak: nextLongest,
      lastActiveDate: todayISO,
      updatedAt: serverTimestamp(),
      createdAt: (prev as any).createdAt ?? serverTimestamp(),
    };

    tx.set(ref, nextDoc, { merge: true });
  });
}
