import { firebaseApp, db } from './firebase';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: number | undefined;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms) as any;
  });
  return Promise.race([p, timeout]).finally(() => {
    if (t) clearTimeout(t);
  });
}

function getVapidKey(): string {
  const k = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
  if (!k) throw new Error('Missing VITE_FIREBASE_VAPID_KEY');
  return k;
}

function safeDocId(input: string): string {
  // Firestore doc ids cannot contain '/'. FCM tokens should not, but we sanitize anyway.
  return btoa(input)
    .replace(/=+$/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function waitForServiceWorkerActive(
  reg: ServiceWorkerRegistration,
  timeoutMs: number
): Promise<ServiceWorkerRegistration> {
  const started = Date.now();
  while (true) {
    if (reg.active) return reg;
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Service worker did not activate within ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function ensureMessagingServiceWorkerReady(): Promise<ServiceWorkerRegistration> {
  // Primary path: wait for existing registration to become ready.
  try {
    return await withTimeout(navigator.serviceWorker.ready, 15000, 'Service worker ready');
  } catch {
    // Fallback path (common in dev): attempt to get or register the SW ourselves.
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) {
      return await withTimeout(waitForServiceWorkerActive(existing, 15000), 15000, 'Service worker activate');
    }

    // Register explicitly.
    // In dev (vite-plugin-pwa), the SW URL is `/dev-sw.js?dev-sw`.
    // In prod builds, the SW is typically `/sw.js` (injectManifest output).
    const swUrl = import.meta.env.DEV ? '/dev-sw.js?dev-sw' : '/sw.js';
    const reg = await navigator.serviceWorker.register(swUrl, { type: 'module', scope: '/' });
    await reg.update().catch(() => void 0);
    return await withTimeout(waitForServiceWorkerActive(reg, 15000), 15000, 'Service worker activate');
  }
}

export async function enableDailyReminderPush(uid: string): Promise<{ token: string }> {
  const supported = await isSupported();
  if (!supported) throw new Error('Push notifications are not supported in this browser/device.');

  if (!('serviceWorker' in navigator)) throw new Error('Service workers are not available.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission not granted.');
  }

  // Ensure the PWA service worker is registered AND active.
  // In dev, `navigator.serviceWorker.ready` can time out if registration hasn’t happened yet,
  // so we try to register the dev SW as a fallback.
  const swReg = await ensureMessagingServiceWorkerReady();

  const messaging = getMessaging(firebaseApp);
  const token = await withTimeout(
    getToken(messaging, {
      vapidKey: getVapidKey(),
      serviceWorkerRegistration: swReg,
    }),
    15000,
    'FCM getToken'
  );

  if (!token) throw new Error('Failed to get FCM token.');

  const id = safeDocId(token);
  // Store under a distinct collection name so server-side senders can query via collection-group safely.
  const ref = doc(db, 'users', uid, 'pushTokens', id);
  await withTimeout(
    setDoc(
      ref,
      {
        token,
        platform: 'web',
        userAgent: navigator.userAgent,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    ),
    15000,
    'Firestore setDoc(pushTokens)'
  );

  return { token };
}
