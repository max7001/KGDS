/**
 * WebApp Karma - Espositori (WCAM 2.0)
 * Service Worker per supporto offline e caching PWA
 */

const CACHE_NAME = 'karma-wcam-v2.5';
const ASSETS_TO_CACHE = [
  './',
  'index.php',
  'shops.php',
  'camera.php',
  'manifest.json',
  'assets/css/modern.css',
  'assets/css/camera.css',
  'assets/js/app.js',
  'assets/js/camera-engine.js',
  'assets/js/image-editor.js',
  'assets/brand/karma-logo.svg',
  'assets/brand/ridem-logo.svg',
  'assets/brand/favicon-16x16.png',
  'assets/images/planigramma.jpg',
  'assets/images/esposizione.jpg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Alcuni asset non sono stati inseriti in cache preventiva:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Non mettere in cache le chiamate API di salvataggio
  if (e.request.url.includes('/api/save_photo.php') || e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});
