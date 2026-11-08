const inboxPath = "/Admin/Notifications";

self.addEventListener("push", (event) => {
  let message;
  try {
    message = event.data?.json();
  } catch {
    return;
  }
  if (typeof message?.id !== "string" || !/^[a-f0-9-]{36}$/i.test(message.id)) return;

  event.waitUntil(self.registration.showNotification("Burton Pride Admin", {
    body: message.test ? "Your phone notifications are working." : "A moderation job needs review.",
    tag: "burton-pride-" + message.id,
    icon: "/image/AdminLogo.png",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const destination = new URL(inboxPath, self.location.origin);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((window) => {
      const current = new URL(window.url);
      return current.origin === destination.origin && current.pathname === destination.pathname;
    });
    if (existing) return existing.focus();
    return self.clients.openWindow(destination.href);
  })());
});
