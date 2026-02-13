import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export type JournalDoc = {
  date: string; // YYYY-MM-DD
  text: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export const userJournalRef = (uid: string, dateISO: string) =>
  doc(db, 'users', uid, 'journals', dateISO);

export async function getUserJournal(uid: string, dateISO: string): Promise<JournalDoc | null> {
  const ref = userJournalRef(uid, dateISO);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as JournalDoc;
}

export async function upsertUserJournal(uid: string, dateISO: string, text: string) {
  const ref = userJournalRef(uid, dateISO);

  const next: JournalDoc = {
    date: dateISO,
    text,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  // merge keeps the original createdAt once it exists
  await setDoc(ref, next, { merge: true });
}
