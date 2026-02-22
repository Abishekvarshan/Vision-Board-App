/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */

// Custom service worker for:
// - Workbox precaching (vite-plugin-pwa injectManifest)
// - Push notifications (FCM / Web Push)

import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<any>;
};

// Precache build assets injected at build time.
precacheAndRoute(self.__WB_MANIFEST);

// Generic push handler.
// If using FCM, payload can arrive either as JSON in `event.data` or wrapped.
self.addEventListener('push', (event) => {
  const raw = event.data?.text();
  let payload: any = {};

  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { title: 'VisionFlow', body: raw || '' };
  }

  // Common patterns:
  // - { title, body, url }
  // - { notification: { title, body }, data: { url } }
  const title = payload?.title || payload?.notification?.title || 'VisionFlow';
  const body = payload?.body || payload?.notification?.body || 'Reminder: don\'t forget to log your day.';
  const url = payload?.url || payload?.data?.url || '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa/icon-192.png',
      badge: '/pwa/icon-192.png',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification as any)?.data?.url || '/';
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = allClients.find((c) => 'focus' in c) as WindowClient | undefined;
      if (existing) {
        await existing.focus();
        existing.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })()
  );
});
