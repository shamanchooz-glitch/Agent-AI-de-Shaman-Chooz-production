// Service worker minimal — juste ce qu'il faut pour rendre l'app installable.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Pas de mise en cache spéciale : on laisse toujours passer les requêtes
// vers le réseau, pour que le chat reste toujours à jour et en direct.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
