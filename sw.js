/* ================================================================
 * Service Worker — Rekap Dana GKPI JK Depok (PWA)
 * Strategi:
 *  - App shell (HTML/ikon/manifest) di-cache agar bisa dibuka offline.
 *  - Permintaan ke Google Apps Script (/exec) SELALU lewat jaringan
 *    (network-only) supaya data transaksi selalu yang terbaru.
 *  - Naikkan angka CACHE_VER setiap kali Anda mengubah index.html
 *    agar perangkat mengambil versi baru (bukan versi lama di cache).
 * ================================================================ */

const CACHE_VER = 'rekap-dana-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './favicon-64.png'
];

// Install: simpan app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VER).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// Activate: hapus cache versi lama
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VER).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // 1) Data Google Apps Script -> selalu jaringan (jangan pernah di-cache)
  const isApi = url.hostname.includes('script.google.com') ||
                url.hostname.includes('googleusercontent.com');
  if (isApi || req.method !== 'GET') {
    e.respondWith(fetch(req).catch(() =>
      new Response(JSON.stringify({ ok: false, error: 'offline' }),
        { headers: { 'Content-Type': 'application/json' } })
    ));
    return;
  }

  // 2) Navigasi halaman -> network dulu, fallback ke index.html cache (offline)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VER).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 3) Aset lain -> cache dulu, kalau tidak ada ambil jaringan lalu simpan
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VER).then((c) => c.put(req, copy));
        return res;
      }).catch(() => hit)
    )
  );
});
