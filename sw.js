// Service worker unique pour tout le site (Chez nous + Budget perso). A la racine
// pour que son scope couvre toutes les pages : un SW place dans assets/ ne peut
// jamais controler une page servie a la racine (regle du navigateur).
// Reseau d'abord : en ligne on prend toujours la derniere version, hors ligne on
// retombe sur le cache. Incrementer CACHE force la detection de mise a jour.
const CACHE = 'orgafamille-v1';
const FICHIERS = [
  'index.html',
  'menage.html',
  'agenda.html',
  'activites.html',
  'checklists.html',
  'baptiste.html',
  'budget.html',
  'parametres.html',
  'budget-perso.html',
  'assets/style.css',
  'assets/app.js',
  'assets/config.js',
  'assets/manifest.json',
  'assets/icon.svg',
  'assets/budget-perso/style.css',
  'assets/budget-perso/app.js',
  'assets/budget-perso/calc.js',
  'assets/budget-perso/db.js',
  'assets/budget-perso/manifest.json',
  'assets/budget-perso/icon.svg'
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
    fetch(event.request).then(res => {
      const copie = res.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copie));
      return res;
    }).catch(() => caches.match(event.request))
  );
});
