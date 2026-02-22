import { doc, onSnapshot, setDoc, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import type { Activity, Task } from '../types';

export type PlannerSyncDoc = {
  tasks: Task[];
  activities: Activity[];
  /** Milliseconds since epoch; used for simple last-write-wins conflict resolution. */
  updatedAtMs: number;
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

export async function writePlannerSync(uid: string, data: PlannerSyncDoc) {
  const ref = plannerSyncRef(uid);
  await setDoc(ref, data, { merge: true });
}
