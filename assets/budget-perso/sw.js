// Service worker de l'app Budget perso — cache l'app shell pour la saisie hors ligne.
const CACHE = 'budget-perso-v1';
const FICHIERS = [
  '../../budget-perso.html',
  'style.css',
  'app.js',
  'calc.js',
  'db.js',
  'manifest.json',
  'icon.svg',
  '../style.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FICHIERS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(clefs => Promise.all(clefs.filter(c => c !== CACHE).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(reponse => {
      if (reponse) return reponse;
      return fetch(event.request).then(res => {
        const copie = res.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copie));
        return res;
      }).catch(() => reponse);
    })
  );
});
