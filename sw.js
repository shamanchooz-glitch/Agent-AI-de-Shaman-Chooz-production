// Service worker de l'app Shaman.
// Objectif : rendre l'app installable et utilisable PARTOUT (Android, iOS,
// ordinateur, tablette), y compris hors ligne ou avec une connexion très
// faible, tant que la connexion n'est pas revenue.
//
// Stratégie :
// - La "coquille" de l'app (HTML/CSS/JS/icônes) est mise en cache et servie
//   en priorité depuis le cache (cache-first), avec rafraîchissement en
//   tâche de fond dès que le réseau est là. Résultat : l'app s'ouvre
//   instantanément, même sans réseau du tout.
// - Le widget de chat Botpress (qui a besoin d'un vrai serveur pour
//   répondre) n'est jamais servi depuis le cache comme s'il fonctionnait :
//   si le réseau manque, c'est la page elle-même (via index.html) qui bascule
//   sur l'assistant local de secours, pas le service worker qui simule une
//   réponse.

const CACHE_VERSION = 'v5';
const CACHE_NAME = `shaman-shell-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isAppShellRequest(requestUrl) {
  const url = new URL(requestUrl);
  if (url.origin !== self.location.origin) return false;
  return APP_SHELL.some((path) => {
    const clean = path.replace('./', '');
    return url.pathname.endsWith(clean) || (clean === '' && url.pathname.endsWith('/'));
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  // Fichiers de l'app elle-même : on essaie TOUJOURS le réseau en premier
  // pour avoir la toute dernière version dès qu'il y a de la connexion ;
  // le cache ne sert que de secours si le réseau échoue (hors ligne).
  if (isAppShellRequest(req.url)) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, response.clone()));
          }
          return response;
        })
        .catch(() =>
          caches.open(CACHE_NAME).then((cache) =>
            cache.match(req).then((cached) => cached || caches.match('./index.html'))
          )
        )
    );
    return;
  }

  // Navigation directe (ex : on ouvre l'app depuis l'écran d'accueil hors
  // ligne) : toujours renvoyer la page principale depuis le cache si le
  // réseau ne répond pas.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Tout le reste (Botpress, polices, QR code, etc.) : en direct depuis le
  // réseau, jamais simulé depuis le cache — un chat qui semble répondre
  // hors ligne serait trompeur.
  event.respondWith(
    fetch(req).catch(() => new Response('', { status: 503, statusText: 'Hors ligne' }))
  );
});
