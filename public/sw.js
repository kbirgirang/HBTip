// Service Worker fyrir push notifications
self.addEventListener("push", function (event) {
  let data = {};
  try {
    if (event.data) {
      data = event.data.json() || {};
    }
  } catch (e) {
    // Ef json() fallar, prófa text()
    try {
      const text = event.data.text();
      if (text) {
        data = JSON.parse(text) || {};
      }
    } catch (e2) {
      console.error("Failed to parse push data:", e2);
    }
  }

  const title = data.title || "Ný tilkynning";
  const options = {
    body: data.body || "Ný skilaboð",
    icon: "/BET-appicon-dark-0126.svg",
    badge: "/BET-appicon-dark-0126.svg",
    data: data.url || "/",
    tag: "bonus-notification",
    requireInteraction: false,
    // vibrate er ekki alltaf studdur í Safari iOS, þannig við sleppum því eða prófum
  };

  // Prófa að bæta við vibrate ef studdur
  if ("vibrate" in navigator) {
    options.vibrate = [200, 100, 200];
  }

  event.waitUntil(
    self.registration.showNotification(title, options).catch((error) => {
      console.error("Failed to show notification:", error);
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data || "/"));
});
