// Service Worker fyrir push notifications
self.addEventListener("push", function (event) {
  const data = event.data?.json() || {};
  const title = data.title || "Ný tilkynning";
  const options = {
    body: data.body || "Ný skilaboð",
    icon: "/icon.svg",
    badge: "/icon.svg",
    data: data.url || "/",
    tag: "bonus-notification",
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data || "/"));
});
