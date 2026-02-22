import { doc, onSnapshot, serverTimestamp, setDoc, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import type { Activity, Task } from '../types';

export type PlannerSyncDoc = {
  tasks: Task[];
  activities: Activity[];
  /** Server timestamp, used for ordering/diagnostics; do NOT compare client clocks. */
  updatedAt?: unknown;
};

export const plannerSyncRef = (uid: string) => doc(db, 'users', uid, 'app', 'planner');

export function subscribePlannerSync(
  uid: string,
  onData: (doc: PlannerSyncDoc | null) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const ref = plannerSyncRef(uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(snap.data() as PlannerSyncDoc);
    },
    (err) => onError?.(err)
  );
}

export async function writePlannerSync(uid: string, data: Omit<PlannerSyncDoc, 'updatedAt'>) {
  const ref = plannerSyncRef(uid);
  await setDoc(
    ref,
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
