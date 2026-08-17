/* ================================================================
 * Service Worker — Rekap Dana GKPI JK Depok (PWA) — AUTO UPDATE
 *
 * TIDAK PERLU menaikkan versi manual lagi.
 * Strategi:
 *  - Navigasi & aset  : NETWORK-FIRST -> selalu ambil versi TERBARU
 *    dari GitHub; cache hanya dipakai sebagai cadangan saat OFFLINE.
 *  - Data Apps Script : NETWORK-ONLY  -> data transaksi selalu live.
 *  - skipWaiting + clients.claim -> SW baru langsung aktif, tanpa
 *    perlu menutup semua tab.
 *  Hasil: setiap kali Anda meng-upload index.html baru, semua
 *  perangkat otomatis melihat versi terbaru saat online.
 * ================================================================ */

const CACHE = 'rekap-dana-auto';   // nama tetap; isinya di-refresh otomatis
const OFFLINE_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
  './favicon-64.png',
  './logo-panitia.png',
  './logo-gkpi.png'
];

// Install: simpan cadangan offline, lalu langsung aktif
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(OFFLINE_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// Activate: bersihkan cache lama (mis. sisa versi manual v1) + ambil alih
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Helper: simpan salinan respon terbaru ke cache (untuk cadangan offline)
function cachePut(req, res) {
  try {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  } catch (e) {}
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Abaikan request non-http (chrome-extension, data:, dll) — tidak bisa di-cache
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 1) Data Google Apps Script -> SELALU jaringan (tidak pernah di-cache)
  const isApi = url.hostname.includes('script.google.com') ||
                url.hostname.includes('googleusercontent.com');
  if (isApi || req.method !== 'GET') {
    e.respondWith(
      fetch(req).catch(() =>
        new Response(JSON.stringify({ ok: false, error: 'offline' }),
          { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // 2) Navigasi halaman -> NETWORK-FIRST (selalu versi terbaru), offline pakai cache
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => cachePut('./index.html', res))
        .catch(() => caches.match('./index.html').then((h) => h || caches.match('./')))
    );
    return;
  }

  // 3) Aset lain (ikon/logo/manifest) -> NETWORK-FIRST juga, fallback ke cache saat offline
  e.respondWith(
    fetch(req)
      .then((res) => cachePut(req, res))
      .catch(() => caches.match(req))
  );
});
