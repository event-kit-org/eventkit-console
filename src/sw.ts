/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

// Precache the app shell only, so the app installs and opens quickly.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Single-page app: serve index.html for navigations, except API calls.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }),
);

// API responses are never cached here: scanning and everything else always
// talks to the server live. Web push handling arrives in stage 3.

// Urgent notifications arrive as web push. The API sends JSON:
// { title, body, url? } (see eventkit-core's channels module).
self.addEventListener('push', (event) => {
  const data = (() => {
    try {
      return event.data?.json() as { title?: string; body?: string; url?: string } | undefined;
    } catch {
      return { title: 'eventKit', body: event.data?.text() };
    }
  })();
  event.waitUntil(
    self.registration.showNotification(data?.title ?? 'eventKit', {
      body: data?.body,
      icon: '/pwa-192.png',
      data: { url: data?.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  event.waitUntil(self.clients.openWindow(url));
});
