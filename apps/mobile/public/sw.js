// Push-only service worker. Deliberately no caching, so a new deploy is always picked up.
//
// Renders Gullak's notifications (see packages/core/src/push-voice.ts for the copy):
//  - the mascot as the icon, a one-colour pot as the status-bar badge
//  - up to two action buttons (Android / desktop Chrome; iOS shows the notification without them)
//  - optional big image, vibration pattern, "stay until tapped" for the important ones
// When the app is open and visible, the notification arrives silently and the app shows its own
// tappable banner instead (src/components/push-banner.tsx), so nothing buzzes twice.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const ICON = '/mascot-192.png';
const BADGE = '/badge-96.png';

function parse(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch {
    return { title: event.data ? event.data.text() : 'New payment' };
  }
}

self.addEventListener('push', (event) => {
  const data = parse(event);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const visible = list.some((c) => c.visibilityState === 'visible');
      // Tell open windows: reload data, and (if on screen) show the in-app banner.
      list.forEach((c) => {
        c.postMessage({ type: 'refresh' });
        if (visible) c.postMessage({ type: 'push', payload: data });
      });
      const actions = Array.isArray(data.actions) ? data.actions.slice(0, 2) : [];
      return self.registration.showNotification(data.title || 'New payment', {
        body: data.body || '',
        tag: data.tag,
        icon: ICON,
        badge: BADGE,
        image: data.image,
        actions: actions.map((a) => ({ action: a.action, title: a.title })),
        requireInteraction: !visible && !!data.requireInteraction,
        renotify: !!(data.renotify && data.tag),
        silent: visible,
        vibrate: data.vibrate || [40, 40, 80],
        timestamp: Date.now(),
        data: { url: data.url || '/', actions, kind: data.kind },
      });
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const button = event.action && (d.actions || []).find((a) => a.action === event.action);
  const url = (button && button.url) || d.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
