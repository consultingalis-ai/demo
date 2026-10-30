/* opsforma Premium · service worker (rad bez interneta)
   Generator upisuje verziju i spisak fajlova koji se čuvaju unapred.
   Stranice: prvo mreža, pa sačuvana kopija, pa offline stranica sa osnovnim informacijama.
   Slike, fontovi, CSS i JS: sačuvana kopija odmah, osvežava se u pozadini. */
var VERZIJA = 'c76f7d3c';
var UNAPRED = ["./","offline.html","config.js","assets/js/podaci.js","assets/css/sajt.css","manifest.webmanifest","assets/js/sajt.sr.js","assets/js/sajt.en.js","assets/js/panel.sr.js","assets/js/panel.en.js","en/","kontakt/","en/contact/","assets/img/logo.svg","assets/img/znak.svg","assets/fonts/geologica-400.woff2","assets/fonts/inconsolata-400.woff2"];
var KES = 'of-' + VERZIJA;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(KES).then(function (c) {
    return Promise.all(UNAPRED.map(function (u) { return c.add(new Request(u, { cache: 'reload' })).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (x) { return x.indexOf('of-') === 0 && x !== KES; }).map(function (x) { return caches.delete(x); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request, url = new URL(r.url);
  if (r.method !== 'GET' || url.origin !== self.location.origin || url.pathname.indexOf('/api/') >= 0) return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(function (odg) {
      var kopija = odg.clone(); caches.open(KES).then(function (c) { c.put(r, kopija); }); return odg;
    }).catch(function () {
      return caches.match(r, { ignoreSearch: true }).then(function (s) { return s || caches.match(new URL('offline.html', self.registration.scope).href); });
    }));
    return;
  }
  if (/\.(css|js|woff2|webp|png|svg|jpg|ico|webmanifest)$/.test(url.pathname)) {
    e.respondWith(caches.open(KES).then(function (c) {
      return c.match(r).then(function (s) {
        var mreza = fetch(r).then(function (odg) { if (odg.ok) c.put(r, odg.clone()); return odg; }).catch(function () { return s; });
        return s || mreza;
      });
    }));
  }
});
