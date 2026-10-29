/* opsforma Premium · zajednička logika · jezgro
   Radi bez servera i bez modula (otvara se i lokalno, file://).
   Podaci firme: window.PODACI (podaci.js), podešavanja: window.CONFIG (config.js). */
(function (w, d) {
  'use strict';
  var OF = w.OF = w.OF || {};
  OF.d = w.PODACI || {};
  OF.c = w.CONFIG || { rezim: 'DEMO', integracije: {} };
  OF.demo = String(OF.c.rezim || 'DEMO').toUpperCase() !== 'PRAVI';
  OF.jezik = (d.documentElement.getAttribute('lang') || 'sr').slice(0, 2);
  OF.sajt = (OF.d.firma && OF.d.firma.id) || 'sajt';
  OF.koren = d.documentElement.getAttribute('data-koren') || './';   // relativna putanja do korena sajta

  /* ---------- tekst i jezik ---------- */
  OF.tx = function (v, jez) {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    jez = jez || OF.jezik;
    return v[jez] != null ? v[jez] : (v.sr != null ? v.sr : (v.en != null ? v.en : ''));
  };
  OF.t = function (kljuc, vars) {
    var I = OF.I18N || {};
    var s = (I[OF.jezik] && I[OF.jezik][kljuc]) || (OF.jezikStrane && I[OF.jezikStrane] && I[OF.jezikStrane][kljuc]) || (I.sr && I.sr[kljuc]) || kljuc;
    var lok = OF.d.tekstovi && OF.d.tekstovi[kljuc];
    if (lok) s = OF.tx(lok);
    // datum na srpskom već završava tačkom („14. mart 2026.“), pa „{do}.“ ne sme da da dve tačke
    if (vars) s = s.replace(/\{(\w+)\}(\.?)/g, function (m, k, t) { if (vars[k] == null) return m; var v = String(vars[k]); return v + (t && v.slice(-1) === '.' ? '' : t); });
    return s;
  };
  /* množina: ključ_1 (1, 21…), ključ_2 (2–4, 22–24…), ključ_5 (ostalo); ako oblika nema, koristi se sam ključ */
  OF.tn = function (kljuc, n, vars) {
    var d = Math.abs(n) % 10, s = Math.abs(n) % 100;
    var oblik = OF.jezik === 'sr' ? (d === 1 && s !== 11 ? '_1' : d >= 2 && d <= 4 && (s < 12 || s > 14) ? '_2' : '_5') : (n === 1 ? '_1' : '_5');
    var k = kljuc + oblik, I = OF.I18N || {};
    var ima = (OF.d.tekstovi && OF.d.tekstovi[k]) || (I[OF.jezik] && I[OF.jezik][k]) || (I.sr && I.sr[k]);
    return OF.t(ima ? k : kljuc, Object.assign({ n: n }, vars || {}));
  };
  OF.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  /* mali graditelj elemenata: OF.h('a', {href:'#', class:'x', onclick: fn}, ['tekst', el]) */
  OF.h = function (tag, attrs, deca) {
    var el = d.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;            // samo za naš, već očišćen sadržaj
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (sk) { if (sk.slice(0, 2) === '--') el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; });
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    (Array.isArray(deca) ? deca : deca != null ? [deca] : []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? d.createTextNode(String(c)) : c);
    });
    return el;
  };
  OF.$ = function (s, r) { return (r || d).querySelector(s); };
  OF.$$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  OF.bezKvacica = function (s) {
    return String(s || '').toLowerCase().replace(/đ/g, 'dj').normalize('NFD').replace(/[̀-ͯ]/g, '');
  };

  /* ---------- skladište (localStorage, sa zaštitom) ---------- */
  var PREF = 'of:' + OF.sajt + ':';
  var memorija = {};
  OF.store = {
    get: function (k, def) {
      try { var v = w.localStorage.getItem(PREF + k); return v == null ? def : JSON.parse(v); }
      catch (e) { return memorija[k] !== undefined ? memorija[k] : def; }
    },
    set: function (k, v) {
      memorija[k] = v;
      try { w.localStorage.setItem(PREF + k, JSON.stringify(v)); } catch (e) { /* privatni prozor */ }
      return v;
    },
    remove: function (k) { delete memorija[k]; try { w.localStorage.removeItem(PREF + k); } catch (e) {} },
    dodaj: function (k, stavka, max) {
      var a = OF.store.get(k, []); a.unshift(stavka); if (max) a = a.slice(0, max); OF.store.set(k, a); return stavka;
    },
    izmeni: function (k, id, fn) {
      var a = OF.store.get(k, []), nadjen = null;
      a = a.map(function (x) { if (x.id === id) { nadjen = fn(x) || x; return nadjen; } return x; });
      OF.store.set(k, a); return nadjen;
    }
  };

  /* ---------- događaji ---------- */
  var slusaoci = {};
  OF.on = function (ime, fn) { (slusaoci[ime] = slusaoci[ime] || []).push(fn); };
  OF.emit = function (ime, p) { (slusaoci[ime] || []).forEach(function (fn) { try { fn(p); } catch (e) { console.error(e); } }); };

  /* ---------- identifikatori ---------- */
  OF.id = function (prefiks) {
    var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    var buf = new Uint8Array(6); (w.crypto || w.msCrypto).getRandomValues(buf);
    for (var i = 0; i < 6; i++) s += a[buf[i] % a.length];
    return (prefiks ? prefiks + '-' : '') + s;
  };
  OF.token = function () {
    var buf = new Uint8Array(12); (w.crypto || w.msCrypto).getRandomValues(buf);
    return Array.prototype.map.call(buf, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  };
  /* deterministički „slučajan“ broj iz teksta (za realne zauzete termine u demo režimu) */
  OF.seme = function (str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  };

  /* ---------- novac ---------- */
  OF.broj = function (n, dec) {
    var loc = OF.jezik === 'en' ? 'en-GB' : OF.jezik === 'de' ? 'de-DE' : 'sr-Latn-RS';
    return new Intl.NumberFormat(loc, { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }).format(n);
  };
  OF.din = function (n) {
    if (n == null || isNaN(n)) return '';
    return OF.jezik === 'sr' ? OF.broj(n) + ' din' : OF.broj(n) + ' RSD';
  };
  OF.cenaTekst = function (c) {
    if (c == null) return '';
    if (typeof c === 'number') return c === 0 ? OF.t('besplatno') : OF.din(c);
    if (c.od != null && c.do != null) return OF.t('cena.od_do', { od: OF.broj(c.od), do: OF.din(c.do) });
    if (c.od != null) return OF.t('cena.od', { od: OF.din(c.od) });
    return '';
  };

  /* ---------- vreme po Beogradu ---------- */
  var TZ = 'Europe/Belgrade';
  var fmtDelovi = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short'
  });
  OF.sad = function (datumObj) {
    var p = {}; fmtDelovi.formatToParts(datumObj || new Date()).forEach(function (x) { p[x.type] = x.value; });
    var h = +p.hour % 24;
    return { iso: p.year + '-' + p.month + '-' + p.day, h: h, m: +p.minute, min: h * 60 + (+p.minute),
             dan: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
  };
  var D = OF.datum = {};
  D.uDate = function (iso) { var a = iso.split('-'); return new Date(Date.UTC(+a[0], +a[1] - 1, +a[2], 12)); };
  D.iso = function (dt) { return dt.toISOString().slice(0, 10); };
  D.dodaj = function (iso, n) { var dt = D.uDate(iso); dt.setUTCDate(dt.getUTCDate() + n); return D.iso(dt); };
  D.danUNedelji = function (iso) { return D.uDate(iso).getUTCDay(); };           // 0 = nedelja
  D.razlika = function (a, b) { return Math.round((D.uDate(b) - D.uDate(a)) / 864e5); };
  D.uMin = function (hhmm) { var a = String(hhmm).split(':'); return (+a[0]) * 60 + (+a[1] || 0); };
  /* vreme zapisa u beogradskom vremenu: ISO sa „Z“ (porudžbine sa sajta) se pretvara, lokalno („2026-10-28T09:14:00“) ostaje */
  D.lokalno = function (v) {
    v = String(v || '');
    if (/(Z|[+-]\d\d:\d\d)$/.test(v)) { var x = OF.sad(new Date(v)); return { iso: x.iso, hhmm: D.uHHMM(x.min) }; }
    return { iso: v.slice(0, 10), hhmm: v.slice(11, 16) };
  };
  D.uHHMM = function (min) { return ('0' + Math.floor(min / 60)).slice(-2) + ':' + ('0' + (min % 60)).slice(-2); };
  var LOC = function () { return OF.jezik === 'en' ? 'en-GB' : OF.jezik === 'de' ? 'de-DE' : 'sr-Latn-RS'; };
  var GENITIV = { januar: 'januara', februar: 'februara', mart: 'marta', april: 'aprila', maj: 'maja', jun: 'juna', jul: 'jula', avgust: 'avgusta', septembar: 'septembra', oktobar: 'oktobra', novembar: 'novembra', decembar: 'decembra' };
  D.format = function (iso, opcije) {
    var o = Object.assign({ timeZone: 'UTC' }, opcije || { weekday: 'long', day: 'numeric', month: 'long' });
    var s = new Intl.DateTimeFormat(LOC(), o).format(D.uDate(iso));
    // srpski: mesec uz dan ide u genitivu („29. novembra“), kako se piše u rečenici
    if (LOC() === 'sr-Latn-RS' && o.day && o.month === 'long') s = s.replace(/(\d+\.\s*)(januar|februar|mart|april|maj|jun|jul|avgust|septembar|oktobar|novembar|decembar)(?![a-z])/g, function (m, a, b) { return a + GENITIV[b]; });
    return s;
  };
  /* „u sredu, 4. novembra“ / „on Wednesday 4 November“ / „am Mittwoch, 4. November“ (za rečenice tipa „stiže …“) */
  var AKUZATIV = { sreda: 'sredu', subota: 'subotu', nedelja: 'nedelju' };
  D.uDan = function (iso) {
    var s = D.format(iso, { weekday: 'long', day: 'numeric', month: 'long' });
    if (OF.jezik === 'en') return 'on ' + s;
    if (OF.jezik === 'de') return 'am ' + s;
    return 'u ' + s.replace(/^(sreda|subota|nedelja)/, function (m) { return AKUZATIV[m]; });
  };
  D.datum = function (iso) { return D.format(iso, { day: 'numeric', month: 'long', year: 'numeric' }); };   // bez dana u nedelji, za „do 29. novembra 2026.“
  D.sGodinom = function (iso) { return D.format(iso, { day: 'numeric', month: 'numeric', year: 'numeric' }); };
  D.kratko = function (iso) { return D.format(iso, { weekday: 'short', day: 'numeric', month: 'numeric' }); };
  D.dug = function (iso) { return D.format(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };
  D.vreme = function (hhmm) { return OF.jezik === 'en' ? hhmm : hhmm.replace(/^0/, ''); };
  /* UTC trenutak za datum i vreme po Beogradu (za .ics i kalendar) */
  D.uUTC = function (iso, hhmm) {
    var a = iso.split('-'), m = D.uMin(hhmm);
    var guess = Date.UTC(+a[0], +a[1] - 1, +a[2], Math.floor(m / 60), m % 60);
    for (var i = 0; i < 2; i++) {
      var s = OF.sad(new Date(guess));
      var razlika = (D.razlika(iso, s.iso) * 1440) + s.min - m;
      guess -= razlika * 60000;
    }
    return new Date(guess);
  };

  /* ---------- praznici u Srbiji ---------- */
  function pravoslavniUskrs(god) {          // julijanski kalendar + 13 dana (1900–2099)
    var a = god % 4, b = god % 7, c = god % 19;
    var dd = (19 * c + 15) % 30, e = (2 * a + 4 * b - dd + 34) % 7;
    var mes = Math.floor((dd + e + 114) / 31), dan = ((dd + e + 114) % 31) + 1;
    var iso = god + '-' + ('0' + mes).slice(-2) + '-' + ('0' + dan).slice(-2);
    return D.dodaj(iso, 13);
  }
  var kesPraznika = {};
  OF.praznici = function (god) {
    if (kesPraznika[god]) return kesPraznika[god];
    var P = {}, dodaj = function (iso, ime, prenosi) {
      P[iso] = ime;
      if (prenosi && D.danUNedelji(iso) === 0) P[D.dodaj(iso, 1)] = ime;
    };
    var g = god + '-';
    dodaj(g + '01-01', { sr: 'Nova godina', en: 'New Year', de: 'Neujahr' }, true);
    dodaj(g + '01-02', { sr: 'Nova godina', en: 'New Year', de: 'Neujahr' }, true);
    dodaj(g + '01-07', { sr: 'Božić', en: 'Orthodox Christmas', de: 'Orthodoxe Weihnachten' });
    dodaj(g + '02-15', { sr: 'Sretenje', en: 'Statehood Day', de: 'Nationalfeiertag' }, true);
    dodaj(g + '02-16', { sr: 'Sretenje', en: 'Statehood Day', de: 'Nationalfeiertag' }, true);
    dodaj(g + '05-01', { sr: 'Praznik rada', en: 'Labour Day', de: 'Tag der Arbeit' }, true);
    dodaj(g + '05-02', { sr: 'Praznik rada', en: 'Labour Day', de: 'Tag der Arbeit' }, true);
    dodaj(g + '11-11', { sr: 'Dan primirja', en: 'Armistice Day', de: 'Waffenstillstandstag' }, true);
    var u = pravoslavniUskrs(god), uskrs = { sr: 'Uskrs', en: 'Orthodox Easter', de: 'Orthodoxes Ostern' };
    [-2, -1, 0, 1].forEach(function (n) { P[D.dodaj(u, n)] = uskrs; });
    (OF.d.neradniDani || []).forEach(function (x) { if (x.datum.slice(0, 4) === String(god)) P[x.datum] = x.naziv || { sr: 'Neradni dan', en: 'Closed', de: 'Geschlossen' }; });
    return (kesPraznika[god] = P);
  };
  OF.praznik = function (iso) { return OF.praznici(+iso.slice(0, 4))[iso] || null; };

  /* ---------- radno vreme ---------- */
  var DANI = ['ned', 'pon', 'uto', 'sre', 'cet', 'pet', 'sub'];
  OF.DANI = DANI;
  /* intervali [[od,do]] u minutima za dati dan; rv = objekat radnog vremena (podrazumevano firma) */
  OF.intervali = function (iso, rv) {
    rv = rv || OF.d.radnoVreme || {};
    var posebno = (OF.d.posebnoRadnoVreme || {})[iso];
    if (posebno) return posebno.map(function (p) { return [D.uMin(p[0]), D.uMin(p[1])]; });
    if (OF.praznik(iso) && !(OF.d.radiPraznikom)) return [];
    var dan = rv[DANI[D.danUNedelji(iso)]] || [];
    return dan.map(function (p) {
      var od = D.uMin(p[0]), dO = D.uMin(p[1]); if (dO <= od) dO += 1440;   // posle ponoći (restoran do 01 h)
      return [od, dO];
    });
  };
  OF.status = function (sada) {
    sada = sada || OF.sad();
    var danas = OF.intervali(sada.iso), juce = OF.intervali(D.dodaj(sada.iso, -1));
    var i, iv;
    for (i = 0; i < juce.length; i++) {          // radno vreme od juče koje prelazi ponoć
      iv = juce[i]; if (iv[1] > 1440 && sada.min < iv[1] - 1440) return { otvoreno: true, do: iv[1] - 1440 };
    }
    for (i = 0; i < danas.length; i++) {
      iv = danas[i]; if (sada.min >= iv[0] && sada.min < iv[1]) return { otvoreno: true, do: iv[1] % 1440, uskoro: iv[1] - sada.min <= 45 };
    }
    for (var k = 0; k < 8; k++) {
      var iso = D.dodaj(sada.iso, k), ivs = OF.intervali(iso);
      for (i = 0; i < ivs.length; i++) {
        if (k > 0 || ivs[i][0] > sada.min) return { otvoreno: false, sledece: { iso: iso, od: ivs[i][0], k: k }, praznik: OF.praznik(sada.iso) };
      }
    }
    return { otvoreno: false };
  };
  OF.statusTekst = function (s) {
    s = s || OF.status();
    if (s.otvoreno) return { klasa: s.uskoro ? 'uskoro' : 'otvoreno', tekst: OF.t(s.uskoro ? 'status.zatvara' : 'status.otvoreno', { do: D.vreme(D.uHHMM(s.do)) }) };
    if (!s.sledece) return { klasa: 'zatvoreno', tekst: OF.t('status.zatvoreno') };
    var kad = s.sledece.k === 0 ? OF.t('danas') : s.sledece.k === 1 ? OF.t('sutra') : D.format(s.sledece.iso, { weekday: 'long' });
    var pr = s.praznik ? ' (' + OF.tx(s.praznik) + ')' : '';
    return { klasa: 'zatvoreno', tekst: OF.t('status.zatvoreno_otvara', { kad: kad, od: D.vreme(D.uHHMM(s.sledece.od % 1440)) }) + pr };
  };

  /* ---------- cene: vlasnik ih menja (panel u demo režimu, Google tabela u pravom) ---------- */
  OF.cene = {
    izmene: function () { return OF.store.get('cene-izmene', {}); },
    za: function (id, osnovna) { var iz = OF.cene.izmene(); return iz[id] !== undefined ? iz[id] : osnovna; },
    postavi: function (id, vrednost) { var iz = OF.cene.izmene(); iz[id] = vrednost; OF.store.set('cene-izmene', iz); OF.emit('cene', iz); },
    vrati: function () { OF.store.remove('cene-izmene'); OF.emit('cene', {}); }
  };

  /* ---------- obaveštenja na ekranu ---------- */
  var region;
  OF.obavesti = function (poruka, tip) {
    if (!region) {
      region = OF.h('div', { class: 'of-toasts', 'aria-live': 'polite', role: 'status' });
      d.body.appendChild(region);
    }
    var t = OF.h('div', { class: 'of-toast' + (tip ? ' of-toast--' + tip : '') }, poruka);
    region.appendChild(t);
    setTimeout(function () { t.classList.add('izlaz'); setTimeout(function () { t.remove(); }, 400); }, 4200);
  };

  /* ---------- dijalog (modal) sa fokusom ---------- */
  OF.dijalog = function (opcije) {
    var dlg = OF.h('dialog', { class: 'of-dialog ' + (opcije.klasa || ''), 'aria-labelledby': 'dlg-' + (opcije.id || 'x') });
    var zatvori = OF.h('button', { type: 'button', class: 'of-dialog__x', 'aria-label': OF.t('zatvori'), onclick: function () { dlg.close(); } },
      OF.h('span', { 'aria-hidden': 'true', html: '&times;' }));
    var glava = OF.h('div', { class: 'of-dialog__glava' }, [OF.h('h2', { id: 'dlg-' + (opcije.id || 'x'), class: 'of-dialog__naslov' }, opcije.naslov || ''), zatvori]);
    var telo = OF.h('div', { class: 'of-dialog__telo' });
    if (opcije.sadrzaj) telo.appendChild(opcije.sadrzaj);
    dlg.appendChild(glava); dlg.appendChild(telo);
    d.body.appendChild(dlg);
    dlg.addEventListener('close', function () { if (opcije.naZatvaranje) opcije.naZatvaranje(); setTimeout(function () { dlg.remove(); }, 50); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    return { el: dlg, telo: telo, zatvori: function () { dlg.close(); } };
  };

  /* ---------- linkovi ---------- */
  OF.link = function (stranica, upit) {        // stranica = id iz mape stranica (generator je upisuje u PODACI._stranice)
    var mapa = (OF.d._stranice || {})[OF.jezik] || {};
    var put = mapa[stranica] != null ? mapa[stranica] : stranica;   // početna je prazna putanja kod čistih linkova
    return OF.koren + put + (upit ? '?' + upit : '');
  };
  OF.postoji = function (stranica) { var m = (OF.d._stranice || {})[OF.jezik] || {}; return m[stranica] != null; };
  OF.upit = function (ime) { try { return new URLSearchParams(w.location.search).get(ime); } catch (e) { return null; } };
  OF.tel = function () { return 'tel:' + (OF.d.firma.telefonLink || ''); };
  OF.viber = function () { return 'viber://chat?number=%2B' + String(OF.d.firma.viber || OF.d.firma.telefonLink || '').replace(/\D/g, ''); };
  OF.whatsapp = function (tekst) { return 'https://wa.me/' + String(OF.d.firma.whatsapp || '').replace(/\D/g, '') + (tekst ? '?text=' + encodeURIComponent(tekst) : ''); };

  /* ---------- provera unosa ---------- */
  OF.provera = {
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim()); },
    telefon: function (v) { var c = String(v || '').replace(/[^\d+]/g, ''); return /^(\+?381|0)6\d{6,8}$/.test(c) || /^\+\d{8,15}$/.test(c); },
    ime: function (v) { return String(v || '').trim().length >= 2; }
  };
  /* forma: prikaz grešaka uz polja, fokus na prvo pogrešno */
  OF.forma = function (forma, pravila) {
    var greske = [];
    OF.$$('.of-greska', forma).forEach(function (g) { g.remove(); });
    OF.$$('[aria-invalid]', forma).forEach(function (p) { p.removeAttribute('aria-invalid'); p.removeAttribute('aria-describedby'); });
    Object.keys(pravila).forEach(function (ime) {
      var polje = forma.elements[ime]; if (!polje) return;
      var poruka = pravila[ime](polje.type === 'checkbox' ? polje.checked : polje.value, polje);
      if (poruka) {
        var id = 'g-' + ime + '-' + Math.random().toString(36).slice(2, 6);
        var g = OF.h('p', { class: 'of-greska', id: id }, poruka);
        (polje.closest('.of-polje') || polje.parentNode).appendChild(g);
        polje.setAttribute('aria-invalid', 'true'); polje.setAttribute('aria-describedby', id);
        greske.push(polje);
      }
    });
    if (greske.length) greske[0].focus();
    return greske.length === 0;
  };

  /* ---------- nalog (sesija) ---------- */
  OF.nalog = function () { return OF.store.get('nalog', null); };

  /* ---------- učitavanje skripti na zahtev (PDF, QR, skener) ---------- */
  var ucitane = {};
  OF.ucitaj = function (put) {
    if (ucitane[put]) return ucitane[put];
    return (ucitane[put] = new Promise(function (ok, ne) {
      var s = d.createElement('script'); s.src = OF.koren + put; s.async = true;
      s.onload = function () { ok(); }; s.onerror = function () { delete ucitane[put]; ne(new Error('Ne mogu da učitam ' + put)); };
      d.head.appendChild(s);
    }));
  };

  /* ---------- preuzimanje fajla ---------- */
  OF.preuzmi = function (ime, sadrzaj, tip) {
    var blob = sadrzaj instanceof Blob ? sadrzaj : new Blob([sadrzaj], { type: tip || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = OF.h('a', { href: url, download: ime, style: { display: 'none' } });
    d.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  };

  OF.manjePokreta = function () { try { return w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  OF.spremno = function (fn) { if (d.readyState !== 'loading') fn(); else d.addEventListener('DOMContentLoaded', fn); };
})(window, document);
