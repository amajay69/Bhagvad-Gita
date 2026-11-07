// Gita Manan runs on the user's own computer and its journal needs the app running, so it keeps no offline copy.
// This replaces GitaViśva's offline cache: any browser that installed the old service worker picks this one up,
// deletes the saved copies and removes itself.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url);
    })(),
  );
});
