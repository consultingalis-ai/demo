/* opsforma Premium · prodavnica
   Katalog (filteri, sortiranje, pretraga), stranica proizvoda (varijante, zalihe, gravura, galerija),
   lista želja, nedavno gledano, fioka korpe, status porudžbine, odustanak i reklamacija, „javi mi kad stigne“,
   događaji za Google Analytics (e-commerce) i recepti poruka za prodavnicu.
   Podaci: PODACI.katalog (proizvodi, kategorije, kolekcije) i PODACI.prodaja (dostava, plaćanje, kuponi).
   Stranice su napravljene unapred (HTML za pretraživače); ovaj kod ih samo oživljava. */
(function (w, d) {
  'use strict';
  var OF = w.OF, PR = OF.prod = {}, D = OF.datum, R = OF.int && OF.int.recepti;
  var KAT = function () { return OF.d.katalog || { proizvodi: [], kategorije: [], kolekcije: [] }; };
  var PROD = function () { return OF.d.prodaja || {}; };

  /* =====================================================================
     PODACI KATALOGA
     ===================================================================== */
  var indeks = null;
  PR.sve = function () { return KAT().proizvodi || []; };
  PR.proizvod = function (id) { if (!indeks) { indeks = {}; PR.sve().forEach(function (p) { indeks[p.id] = p; }); } return indeks[id] || null; };
  /* kome je komad namenjen: muški nakit i oznaka „on“ → on; ostalo i oznaka „ona“ → ona (isto kao filter „za“ na listi) */
  PR.zaKoga = function (p) {
    var za = p.za || [], r = [];
    if (p.kategorija === 'muski-nakit' || za.indexOf('on') >= 0) r.push('on');
    if (p.kategorija !== 'muski-nakit' || za.indexOf('ona') >= 0) r.push('ona');
    return r;
  };
  PR.imaDoplatu = function (p) { return (p.ose || []).some(function (o) { return o.opcije.some(function (x) { return x.doplata > 0; }); }); };
  /* upit iz pretrage: cena („do 5.000“, „od 3000“, „5k“), kome („za njega“, „for her“), ostale reči */
  var REC_ON = ['njega', 'muz', 'muza', 'muzu', 'muskarac', 'muskarca', 'muski', 'musko', 'decko', 'tata', 'otac', 'brat', 'him', 'men', 'man', 'husband', 'boyfriend', 'dad'];
  var REC_ONA = ['nju', 'zena', 'zenu', 'zeni', 'devojka', 'devojku', 'mama', 'majka', 'sestra', 'zenski', 'her', 'women', 'woman', 'wife', 'girlfriend', 'mum', 'mom'];
  var REC_PRAZNE = ['poklon', 'pokloni', 'za', 'i', 'sa', 'od', 'do', 'nakit', 'nesto', 'gift', 'gifts', 'for', 'with', 'jewellery', 'jewelry', 'something', 'din', 'rsd', 'dinara'];
  PR.citajUpit = function (q) {
    var x = OF.bezKvacica(String(q || '')).replace(/(\d)[.,](\d{3})/g, '$1$2'), u = { reci: [] }, m;
    var broj = function (n, k) { n = +n; return k || n < 100 ? n * 1000 : n; };
    if ((m = /(?:do|ispod|max|under|below|up to)\s*(\d{1,6})\s*(k\b|hiljad\w*)?/.exec(x))) { u.max = broj(m[1], m[2]); x = x.replace(m[0], ' '); }
    if ((m = /(?:od|preko|min|over|from|above)\s*(\d{1,6})\s*(k\b|hiljad\w*)?/.exec(x))) { u.min = broj(m[1], m[2]); x = x.replace(m[0], ' '); }
    if ((m = /\b(\d{1,6})\s*(k\b|hiljad\w*|din\w*|rsd)/.exec(x)) && u.max == null) { u.max = broj(m[1], /^(k|hiljad)/.test(m[2]) ? m[2] : null); x = x.replace(m[0], ' '); }
    x.split(/[^a-z0-9]+/).filter(Boolean).forEach(function (r) {
      if (REC_ON.indexOf(r) >= 0) u.za = 'on'; else if (REC_ONA.indexOf(r) >= 0) u.za = 'ona';
      else if (REC_PRAZNE.indexOf(r) < 0 && r.length > 1) u.reci.push(r);
    });
    return u;
  };
  PR.kategorija = function (id) { return (KAT().kategorije || []).filter(function (k) { return k.id === id; })[0] || null; };
  PR.kolekcija = function (id) { return (KAT().kolekcije || []).filter(function (k) { return k.id === id; })[0] || null; };
  PR.link = function (p) { return OF.link('proizvod-' + p.id); };
  PR.slika = function (p, vel) { var s = (p.slikeMale || [])[0]; return s ? (vel === 'velika' && p.slikaVelika ? p.slikaVelika : s) : null; };
  PR.kombinacija = function (p, izbor) { return (p.ose || []).map(function (o) { return (izbor || {})[o.id] || ''; }).join('|'); };
  PR.podrazumevaniIzbor = function (p) {
    var izbor = {};
    (p.ose || []).forEach(function (o) {
      // prva opcija koja je na stanju (ili prva uopšte)
      var dostupna = o.opcije.filter(function (op) { var t = Object.assign({}, izbor); t[o.id] = op.id; return PR.mozeKombinacija(p, t); })[0];
      izbor[o.id] = (o.podrazumevano && o.opcije.some(function (x) { return x.id === o.podrazumevano; }) ? o.podrazumevano : (dostupna || o.opcije[0]).id);
    });
    return izbor;
  };
  /* cena: osnovna (vlasnik je menja u panelu) + doplate opcija + gravura */
  PR.cena = function (p, izbor) {
    var c = OF.cene.za(p.id, p.cena);
    (p.ose || []).forEach(function (o) { var op = o.opcije.filter(function (x) { return x.id === (izbor || {})[o.id]; })[0]; if (op && op.doplata) c += op.doplata; });
    if (izbor && izbor.gravura && p.gravura) c += p.gravura.doplata || 0;
    return c;
  };
  PR.naAkciji = function (p) { return p.staraCena && p.staraCena > OF.cene.za(p.id, p.cena); };

  /* kuponi: osnovni iz PODACI.js + izmene iz panela (DEMO: u ovom pregledaču) */
  PR.spojiKupone = function () {
    if (!OF.d.prodaja) return;
    var osnova = (OF.d.prodaja._kuponiOsnova = OF.d.prodaja._kuponiOsnova || (OF.d.prodaja.kuponi || []).slice()), iz = OF.store.get('kuponi-izmene', {});
    var lista = osnova.map(function (k) { return iz[k.kod] ? Object.assign({}, k, iz[k.kod]) : k; });
    Object.keys(iz).forEach(function (kod) { if (!osnova.some(function (k) { return k.kod === kod; })) lista.push(iz[kod]); });
    OF.d.prodaja.kuponi = lista;
  };
  if (OF.store) PR.spojiKupone();

  /* ---------- zalihe ----------
     DEMO: početne zalihe iz PODACI.js; prodaja na sajtu i izmene iz panela čuvaju se u ovom pregledaču.
     PRAVI: server vodi zalihe (smanjuje ih atomski pri porudžbini); sajt ih čita sa /api/zalihe. */
  var Z = OF.zalihe = {};
  var sa_servera = null;
  Z.izmene = function () { return OF.store.get('zalihe-izmene', {}); };
  Z.za = function (p, komb) {
    if (typeof p === 'string') p = PR.proizvod(p); if (!p) return 0;
    komb = komb == null ? '' : komb;
    if (sa_servera && sa_servera[p.id] && sa_servera[p.id][komb] != null) return sa_servera[p.id][komb];
    var iz = Z.izmene()[p.id + '#' + komb];
    if (iz != null) return iz;
    var z = p.zalihe || {};
    return z[komb] != null ? z[komb] : (z['*'] != null ? z['*'] : 0);
  };
  Z.ukupno = function (p) { var z = p.zalihe || {}, kljucevi = Object.keys(z); if (!kljucevi.length) return Z.za(p, ''); return kljucevi.reduce(function (s, k) { return s + Math.max(0, Z.za(p, k)); }, 0); };
  Z.postavi = function (id, komb, n) { var iz = Z.izmene(); iz[id + '#' + (komb || '')] = Math.max(0, Math.round(n)); OF.store.set('zalihe-izmene', iz); OF.emit('zalihe', { id: id, komb: komb }); };
  Z.umanji = function (stavke) {
    var malo = [];
    (stavke || []).forEach(function (x) {
      if (x.tip !== 'proizvod') return; var p = PR.proizvod(x.id); if (!p) return;
      var komb = x.varijanta || '', pre = Z.za(p, komb), posle = Math.max(0, pre - x.kolicina);
      Z.postavi(p.id, komb, posle);
      if (posle <= (PROD().malaZaliha || 1)) malo.push({ id: p.id, naziv: OF.tx(p.naziv), varijanta: komb, ostalo: posle });
    });
    if (malo.length) OF.int.dogadjaj('zaliha.malo', { stavke: malo, tiho: true });
  };
  Z.ucitaj = function () {
    if (OF.demo) return Promise.resolve(null);
    return fetch(OF.int.api('/zalihe'), { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (o) { if (o && o.zalihe) { sa_servera = o.zalihe; OF.emit('zalihe', {}); } return o; }).catch(function () { return null; });
  };
  PR.mozeKombinacija = function (p, izbor) { return Z.za(p, PR.kombinacija(p, izbor)) > 0 || !!p.poPorudzbini; };
  PR.stanje = function (p, izbor) {
    var n = Z.za(p, PR.kombinacija(p, izbor));
    if (n > 0) return { ima: true, n: n, poslednji: n === 1, malo: n <= 3 };
    if (p.poPorudzbini) return { ima: true, n: 0, izrada: p.poPorudzbini };
    return { ima: false, n: 0 };
  };
  OF.korpa.cenaStavkeHook = function (x) {
    if (x.tip !== 'proizvod') return null;
    var p = PR.proizvod(x.id); return p ? PR.cena(p, x.opcije || {}) : null;
  };
  OF.korpa.posleZavrsetka = function (por) { if (OF.demo) Z.umanji(por.stavke); };

  /* ---------- rok isporuke: šaljemo radnim danima do X h, kurir isporučuje sledećeg radnog dana ---------- */
  var radniDan = function (iso) { var dan = D.danUNedelji(iso); return dan > 0 && dan < 6 && !OF.praznik(iso); };
  var sledeciRadni = function (iso) { var x = iso; for (var i = 0; i < 14; i++) { if (radniDan(x)) return x; x = D.dodaj(x, 1); } return x; };
  PR.isporuka = function (izradaDana) {
    var s = PROD().slanje || {}, sada = OF.sad(), slanje = sada.iso;
    if (!radniDan(slanje) || sada.h >= (s.doSata || 14)) slanje = sledeciRadni(D.dodaj(slanje, 1));
    for (var i = 0; i < (izradaDana || 0); i++) slanje = sledeciRadni(D.dodaj(slanje, 1));
    var stize = slanje; for (var k = 0; k < (s.kurirDana || 1); k++) stize = sledeciRadni(D.dodaj(stize, 1));
    return { slanje: slanje, stize: stize, danas: slanje === sada.iso, doSata: s.doSata || 14 };
  };
  // gravura: izrada se produžava za PODACI.prodaja.gravuraDana (podrazumevano 2 radna dana)
  PR.isporukaTekst = function (izradaDana, gravura) {
    var g = gravura ? (PROD().gravuraDana || 2) : 0;
    var i = PR.isporuka((izradaDana || 0) + g), dan = function (iso) { return iso === D.dodaj(OF.sad().iso, 1) ? OF.t('sutra') : D.uDan(iso); };
    if (izradaDana) return OF.t('pr.isporuka_izrada', { dana: izradaDana + g, dan: dan(i.stize) });
    if (g) return OF.t('pr.isporuka_gravura', { dana: g, dan: dan(i.stize) });
    return i.danas ? OF.t('pr.isporuka_danas', { sat: i.doSata, dan: dan(i.stize) }) : OF.t('pr.isporuka_kasnije', { slanje: dan(i.slanje), dan: dan(i.stize) });
  };

  /* =====================================================================
     ANALITIKA (GA4 e-commerce preko dataLayer-a; GA se učitava tek posle pristanka na kolačiće)
     ===================================================================== */
  /* GA4 e-commerce i Meta Pixel: šalje se SAMO uz pristanak (analitika / marketing), ništa pre toga.
     GA4 direktno (gtag) ili preko Google Tag Manager-a (dataLayer); kupovina se šalje jednom po porudžbini. */
  var META = { view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', add_payment_info: 'AddPaymentInfo', purchase: 'Purchase', add_to_wishlist: 'AddToWishlist', search: 'Search' };
  PR.ga = function (dogadjaj, stavke, dodatno) {
    try {
      var x = OF.analitika && OF.analitika.izbor && OF.analitika.izbor();
      if (!x || (!x.analitika && !x.marketing)) return;
      if (dogadjaj === 'purchase' && dodatno && dodatno.transaction_id) {
        var poslate = OF.store.get('ga-kupovine', []);
        if (poslate.indexOf(dodatno.transaction_id) >= 0) return;
        OF.store.set('ga-kupovine', [dodatno.transaction_id].concat(poslate).slice(0, 50));
      }
      var e = Object.assign({ currency: 'RSD', items: (stavke || []).map(function (s, i) {
        var p = PR.proizvod(s.id) || {};
        return { item_id: p.sku || s.id, item_name: OF.tx(p.naziv || s.naziv, 'sr'), item_category: p.kategorija || s.kategorija || s.tip, item_variant: s.varijanta || undefined, price: s.cena, quantity: s.kolicina || 1, index: i };
      }) }, dodatno || {});
      if (x.analitika) {
        if (w.gtag) w.gtag('event', dogadjaj, e);
        else if (w.dataLayer) { w.dataLayer.push({ ecommerce: null }); w.dataLayer.push({ event: dogadjaj, ecommerce: e }); }
      }
      if (x.marketing && w.fbq && META[dogadjaj]) w.fbq('track', META[dogadjaj], dogadjaj === 'search' ? { search_string: e.search_term } : { value: e.value, currency: 'RSD', content_type: 'product', content_ids: e.items.map(function (i) { return i.item_id; }) });
    } catch (er) {}
  };
  OF.on('korpa:dodato', function (s) { PR.ga('add_to_cart', [s], { value: OF.korpa.cenaStavke(s) * (s.kolicina || 1) }); });
  OF.on('korpa:uklonjeno', function (s) { PR.ga('remove_from_cart', [s], { value: OF.korpa.cenaStavke(s) * s.kolicina }); });
  OF.on('kasa:otvorena', function (o) { PR.ga('begin_checkout', o.stavke, { value: o.medjuzbir }); });
  OF.on('kasa:placanje', function (o) { PR.ga('add_payment_info', o.obracun.stavke, { value: o.obracun.ukupno, payment_type: o.podaci.placanje }); });
  OF.on('porudzbina', function (p) { PR.ga('purchase', p.stavke, { transaction_id: p.id, value: p.ukupno, shipping: p.dostava, coupon: p.kupon || undefined }); });

  /* =====================================================================
     LISTA ŽELJA I NEDAVNO GLEDANO
     ===================================================================== */
  var ZE = OF.zelje = {};
  ZE.lista = function () { return OF.store.get('zelje', []).filter(function (id) { return PR.proizvod(id); }); };
  ZE.ima = function (id) { return ZE.lista().indexOf(id) >= 0; };
  ZE.prebaci = function (id) {
    var l = ZE.lista(), ima = l.indexOf(id) >= 0;
    l = ima ? l.filter(function (x) { return x !== id; }) : [id].concat(l);
    OF.store.set('zelje', l.slice(0, 60)); OF.emit('zelje', l);
    var p = PR.proizvod(id); OF.obavesti(OF.t(ima ? 'pr.zelja_uklonjena' : 'pr.zelja_dodata', { naziv: OF.tx(p.naziv) }));
    if (!ima) PR.ga('add_to_wishlist', [{ id: id, cena: PR.cena(p, {}) }]);
    return !ima;
  };
  ZE.link = function (l) { return OF.int.apsolutno(OF.link('lista-zelja', 'l=' + (l || ZE.lista()).join(','))); };
  function osveziZelje() {
    var n = ZE.lista().length;
    OF.$$('[data-of-zelje-broj]').forEach(function (el) { el.textContent = String(n); el.hidden = n === 0; });
    OF.$$('[data-of-zelja]').forEach(function (b) { var ima = ZE.ima(b.getAttribute('data-of-zelja')); b.setAttribute('aria-pressed', ima ? 'true' : 'false'); var t = OF.$('[data-of-zelja-tekst]', b); if (t) t.textContent = ima ? OF.t('pr.u_listi') : OF.t('pr.dodaj_u_listu'); });
  }
  PR.zapamtiGledano = function (id) { var l = OF.store.get('nedavno', []).filter(function (x) { return x !== id; }); l.unshift(id); OF.store.set('nedavno', l.slice(0, 12)); };

  /* mala kartica proizvoda (za listu želja, nedavno, pretragu, pomoćnika) */
  PR.kartica = function (p, opcije) {
    opcije = opcije || {};
    var cena = OF.cene.za(p.id, p.cena), od = (p.ose || []).some(function (o) { return o.opcije.some(function (x) { return x.doplata; }); });
    var stanje = Z.ukupno(p) > 0 || p.poPorudzbini;
    return OF.h('li', { class: 'of-pk' + (stanje ? '' : ' rasprodato') }, [
      OF.h('a', { href: PR.link(p), class: 'of-pk__link' }, [
        OF.h('span', { class: 'of-pk__slika' }, PR.slika(p) ? OF.h('img', { src: OF.koren + PR.slika(p), alt: '', width: '400', height: '400', loading: 'lazy', decoding: 'async' }) : null),
        OF.h('span', { class: 'of-pk__naziv' }, OF.tx(p.naziv)),
        OF.h('span', { class: 'of-pk__cena' }, [od ? OF.t('cena.od', { od: OF.din(cena) }) : OF.din(cena), PR.naAkciji(p) ? OF.h('s', { class: 'of-pk__stara' }, OF.din(p.staraCena)) : null, !stanje ? OF.h('span', { class: 'of-pk__nema' }, ' · ' + OF.t('pr.rasprodato')) : null])
      ]),
      opcije.ukloni ? OF.h('button', { type: 'button', class: 'of-pk__ukloni', 'aria-label': OF.t('pr.ukloni_iz_liste', { naziv: OF.tx(p.naziv) }), onclick: opcije.ukloni }, OF.h('span', { 'aria-hidden': 'true', html: '&times;' })) : null
    ]);
  };
  PR.mreza = function (lista, opcije) { return OF.h('ul', { class: 'of-pk-mreza', role: 'list' }, lista.map(function (p) { return PR.kartica(p, opcije && opcije(p)); })); };

  /* =====================================================================
     KATALOG: filteri, cena, sortiranje, pretraga (radi nad karticama koje su već u HTML-u)
     ===================================================================== */
  PR.katalog = function (koren) {
    if (!koren) return;
    var kartice = OF.$$('[data-of-pk]', koren), lista = OF.$('[data-of-pk-lista]', koren), forma = OF.$('[data-of-katalog-filteri]', koren);
    var broj = OF.$('[data-of-katalog-broj]', koren), prazno = OF.$('[data-of-katalog-prazno]', koren), sort = OF.$('[data-of-katalog-sort]', koren), pretraga = OF.$('[data-of-katalog-pretraga]', koren);
    var aktivni = OF.$('[data-of-katalog-aktivni]', koren);
    var stanje = { f: {}, q: '', sort: 'preporuka', min: null, max: null };
    // stanje iz adrese (?kamen=oniks&sort=cena-rastuce&q=...)
    try { new URLSearchParams(w.location.search).forEach(function (v, k) { if (k === 'q') stanje.q = v; else if (k === 'sort') stanje.sort = v; else if (k === 'min') stanje.min = +v || null; else if (k === 'max') stanje.max = +v || null; else stanje.f[k] = v.split(','); }); } catch (e) {}
    if (forma) {
      OF.$$('input[type=checkbox]', forma).forEach(function (c) { c.checked = (stanje.f[c.name] || []).indexOf(c.value) >= 0; c.addEventListener('change', procitaj); });
      OF.$$('input[type=number]', forma).forEach(function (c) { if (stanje[c.name] != null) c.value = stanje[c.name]; c.addEventListener('change', procitaj); });
      var ponisti = OF.$('[data-of-katalog-ponisti]', forma); if (ponisti) ponisti.addEventListener('click', function () { OF.$$('input', forma).forEach(function (c) { if (c.type === 'checkbox') c.checked = false; else c.value = ''; }); if (pretraga) pretraga.value = ''; stanje.q = ''; stanje.f = {}; procitaj(); });
      forma.addEventListener('submit', function (e) { e.preventDefault(); procitaj(); if (postaviFiltere) postaviFiltere(false); });
    }
    if (sort) { sort.value = stanje.sort; sort.addEventListener('change', function () { stanje.sort = sort.value; primeni(true); }); }
    if (pretraga) { pretraga.value = stanje.q; var tajmer; pretraga.addEventListener('input', function () { clearTimeout(tajmer); tajmer = setTimeout(function () { stanje.q = pretraga.value.trim(); primeni(true); }, 160); }); }
    // filteri na telefonu: fioka
    // dugme „Filteri“ otvara fioku; dugme X u fioci (isti atribut) je zatvara. Escape i klik na pozadinu takođe.
    var fDugmad = OF.$$('[data-of-filteri-dugme]', koren), fPanel = forma && forma.closest('[data-of-filteri-panel]');
    var fGlavno = fDugmad.filter(function (x) { return !fPanel || !fPanel.contains(x); })[0];
    var postaviFiltere = function (o) {
      if (!fPanel) return;
      if (fGlavno) fGlavno.setAttribute('aria-expanded', o ? 'true' : 'false');
      fPanel.classList.toggle('otvoren', o); d.documentElement.classList.toggle('filteri-otvoreni', o);
      if (o) { var prvi = OF.$('input, button', fPanel); if (prvi) prvi.focus(); } else if (fGlavno && fPanel.contains(d.activeElement)) fGlavno.focus();
    };
    fDugmad.forEach(function (x) { x.addEventListener('click', function () { postaviFiltere(!(fPanel && fPanel.classList.contains('otvoren'))); }); });
    if (fPanel) {
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && fPanel.classList.contains('otvoren')) postaviFiltere(false); });
      d.addEventListener('click', function (e) { if (fPanel.classList.contains('otvoren') && !fPanel.contains(e.target) && !fDugmad.some(function (x) { return x.contains(e.target); })) postaviFiltere(false); });
    }
    function procitaj() {
      var bezPolja = {}; Object.keys(stanje.f).forEach(function (k) { if (forma && !OF.$('input[name="' + k + '"]', forma)) bezPolja[k] = stanje.f[k]; });
      stanje.f = bezPolja;
      OF.$$('input[type=checkbox]:checked', forma).forEach(function (c) { (stanje.f[c.name] = stanje.f[c.name] || []).push(c.value); });
      var mn = forma.elements.min, mx = forma.elements.max;
      stanje.min = mn && mn.value ? +mn.value : null; stanje.max = mx && mx.value ? +mx.value : null;
      if (stanje.min != null && stanje.max != null && stanje.min > stanje.max) { var t = stanje.min; stanje.min = stanje.max; stanje.max = t; mn.value = stanje.min; mx.value = stanje.max; }   // „od“ veće od „do“: zameni
      primeni(true);
    }
    function vrednosti(el, ime) { return (el.getAttribute('data-' + ime) || '').split(' ').filter(Boolean); }
    function primeni(upisi) {
      var q = OF.bezKvacica(stanje.q), n = 0;
      var vidljive = kartice.filter(function (el) {
        var id = el.getAttribute('data-of-pk'), p = PR.proizvod(id), ok = true;
        Object.keys(stanje.f).forEach(function (k) { if (!stanje.f[k].length) return; var v = vrednosti(el, k); if (!stanje.f[k].some(function (x) { return v.indexOf(x) >= 0; })) ok = false; });
        var cena = p ? OF.cene.za(p.id, p.cena) : +el.getAttribute('data-cena');
        if (stanje.min != null && cena < stanje.min) ok = false;
        if (stanje.max != null && cena > stanje.max) ok = false;
        if (q && OF.bezKvacica(el.getAttribute('data-trazi') || el.textContent).indexOf(q) < 0) ok = false;
        el.hidden = !ok; if (ok) n++;
        return ok;
      });
      // sortiranje: promena redosleda u DOM-u
      var poredak = vidljive.slice().sort(function (a, b) {
        var pa = PR.proizvod(a.getAttribute('data-of-pk')), pb = PR.proizvod(b.getAttribute('data-of-pk'));
        var ca = OF.cene.za(pa.id, pa.cena), cb = OF.cene.za(pb.id, pb.cena);
        if (stanje.sort === 'cena-rastuce') return ca - cb;
        if (stanje.sort === 'cena-opadajuce') return cb - ca;
        if (stanje.sort === 'najnovije') return (pb.dodato || '').localeCompare(pa.dodato || '');
        return (+a.getAttribute('data-redosled')) - (+b.getAttribute('data-redosled'));
      });
      poredak.forEach(function (el) { lista.appendChild(el); });
      kartice.filter(function (el) { return el.hidden; }).forEach(function (el) { lista.appendChild(el); });
      if (broj) broj.textContent = OF.t('pr.prikazano', { n: n });
      if (prazno) prazno.hidden = n > 0;
      crtajAktivne();
      if (upisi) {
        var u = new URLSearchParams();
        Object.keys(stanje.f).forEach(function (k) { if (stanje.f[k].length) u.set(k, stanje.f[k].join(',')); });
        if (stanje.min != null) u.set('min', stanje.min); if (stanje.max != null) u.set('max', stanje.max);
        if (stanje.q) u.set('q', stanje.q); if (stanje.sort !== 'preporuka') u.set('sort', stanje.sort);
        try { w.history.replaceState(null, '', w.location.pathname + (u.toString() ? '?' + u : '')); } catch (e) {}
        PR.ga('view_item_list', vidljive.slice(0, 12).map(function (el) { var p = PR.proizvod(el.getAttribute('data-of-pk')); return { id: p.id, cena: OF.cene.za(p.id, p.cena) }; }), { item_list_name: d.title });
      }
    }
    function crtajAktivne() {
      if (!aktivni) return; aktivni.innerHTML = '';
      Object.keys(stanje.f).forEach(function (k) {
        stanje.f[k].forEach(function (v) {
          var c = forma && OF.$('input[name="' + k + '"][value="' + v + '"]', forma);
          if (!c) {     // filter iz adrese bez polja u formi (npr. „za njega“ iz pomoćnika): čip koji ga uklanja
            aktivni.appendChild(OF.h('button', { type: 'button', class: 'of-cip', onclick: function () { stanje.f[k] = stanje.f[k].filter(function (x) { return x !== v; }); primeni(true); } }, [OF.t('pr.filter_' + k + '_' + v) !== 'pr.filter_' + k + '_' + v ? OF.t('pr.filter_' + k + '_' + v) : v, OF.h('span', { 'aria-hidden': 'true', html: ' &times;' }), OF.h('span', { class: 'of-sr' }, ' ' + OF.t('ukloni'))]));
            return;
          }
          var oznaka = (OF.$('label[for="' + c.id + '"] [data-of-oznaka]', forma) || OF.$('label[for="' + c.id + '"]', forma) || {}).textContent || v;
          aktivni.appendChild(OF.h('button', { type: 'button', class: 'of-cip', onclick: function () { c.checked = false; procitaj(); } }, [oznaka.trim(), OF.h('span', { 'aria-hidden': 'true', html: ' &times;' }), OF.h('span', { class: 'of-sr' }, ' ' + OF.t('ukloni'))]));
        });
      });
      if (stanje.min != null || stanje.max != null) aktivni.appendChild(OF.h('button', { type: 'button', class: 'of-cip', onclick: function () { forma.elements.min.value = ''; forma.elements.max.value = ''; procitaj(); } }, [stanje.min != null && stanje.max != null ? OF.din(stanje.min) + ' – ' + OF.din(stanje.max) : stanje.max != null ? OF.t('pr.cena_do', { iznos: OF.din(stanje.max) }) : OF.t('pr.cena_od', { iznos: OF.din(stanje.min) }), OF.h('span', { 'aria-hidden': 'true', html: ' &times;' })]));
    }
    function osveziStanje() {
      kartice.forEach(function (el) {
        var p = PR.proizvod(el.getAttribute('data-of-pk')); if (!p) return;
        var ima = Z.ukupno(p) > 0 || !!p.poPorudzbini; el.classList.toggle('rasprodato', !ima);
        var oz = OF.$('[data-of-pk-stanje]', el); if (oz) { oz.hidden = ima && Z.ukupno(p) > 2; oz.textContent = !ima ? OF.t('pr.rasprodato') : Z.ukupno(p) <= 2 && Z.ukupno(p) > 0 ? OF.t('pr.jos_malo') : ''; if (ima && Z.ukupno(p) > 2) oz.textContent = ''; }
        var c = OF.$('[data-of-pk-cena]', el); if (c) { var cena = OF.cene.za(p.id, p.cena); c.textContent = el.hasAttribute('data-od') ? OF.t('cena.od', { od: OF.din(cena) }) : OF.din(cena); }
      });
    }
    OF.on('zalihe', osveziStanje); OF.on('cene', function () { osveziStanje(); primeni(false); });
    osveziStanje(); primeni(false);
  };

  /* ---------- pretraga u zaglavlju (rezultati odmah, bez servera) ---------- */
  PR.pretraga = function (forma) {
    if (!forma) return;
    var ulaz = OF.$('input[type=search]', forma), rez = OF.h('div', { class: 'of-pretraga__rezultati', id: 'of-pretraga-rez', role: 'listbox', hidden: true });
    forma.appendChild(rez); ulaz.setAttribute('aria-controls', 'of-pretraga-rez'); ulaz.setAttribute('aria-autocomplete', 'list'); ulaz.setAttribute('aria-expanded', 'false');
    var sadasnji = [], aktivan = -1;
    var upit = { reci: [] };
    function trazi(q) {
      if (OF.bezKvacica(q).trim().length < 2) return [];
      upit = PR.citajUpit(q);
      var K = KAT();
      return PR.sve().map(function (p) {
        var cena = OF.cene.za(p.id, p.cena);
        if ((upit.max != null && cena > upit.max) || (upit.min != null && cena < upit.min) || (upit.za && PR.zaKoga(p).indexOf(upit.za) < 0)) return { p: p, s: -1 };
        var mat = (p.materijali || []).map(function (m) { return m + ' ' + OF.tx(((K.materijali || []).filter(function (x) { return x.id === m; })[0] || {}).naziv); }).join(' ');
        var kam = p.kamen ? p.kamen + ' ' + OF.tx(((K.kamenje || []).filter(function (x) { return x.id === p.kamen; })[0] || {}).naziv) : '';
        var t = OF.bezKvacica([OF.tx(p.naziv), OF.tx((PR.kategorija(p.kategorija) || {}).naziv), OF.tx((PR.kolekcija(p.kolekcija) || {}).naziv), (p.trazi || ''), mat, kam].join(' '));
        // bez reči (npr. „poklon do 5.000“): svi koji prolaze cenu i „za“, prvo najprodavaniji
        var s = upit.reci.length ? upit.reci.reduce(function (a, r) { return a + (t.indexOf(r) >= 0 ? (t.indexOf(r) === 0 ? 2 : 1) : -5); }, 0) : ((p.oznake || []).indexOf('najprodavanije') >= 0 ? 1.5 : 1);
        if (!(Z.ukupno(p) > 0 || p.poPorudzbini)) s -= 0.5;
        return { p: p, s: s };
      }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s || a.p.cena - b.p.cena; }).slice(0, 6).map(function (x) { return x.p; });
    }
    function linkSvih() {     // „Svi rezultati“: lista sa istim filterima (cena, za, reči)
      var u = []; if (upit.reci.length) u.push('q=' + encodeURIComponent(upit.reci.join(' '))); if (upit.max != null) u.push('max=' + upit.max); if (upit.min != null) u.push('min=' + upit.min); if (upit.za) u.push('za=' + upit.za);
      return OF.link(forma.getAttribute('data-stranica') || 'prodavnica', u.join('&'));
    }
    function crtaj() {
      var lista = sadasnji = trazi(ulaz.value); aktivan = -1; rez.innerHTML = '';
      if (ulaz.value.trim().length < 2) { rez.hidden = true; ulaz.setAttribute('aria-expanded', 'false'); return; }
      if (!lista.length) rez.appendChild(OF.h('p', { class: 'of-pretraga__nema' }, OF.t('pr.nema_rezultata', { q: ulaz.value.trim() })));
      lista.forEach(function (p, i) {
        rez.appendChild(OF.h('a', { href: PR.link(p), class: 'of-pretraga__stavka', role: 'option', id: 'of-pr-' + i, 'aria-selected': 'false' }, [
          PR.slika(p) ? OF.h('img', { src: OF.koren + PR.slika(p), alt: '', width: '48', height: '48', loading: 'lazy' }) : null,
          OF.h('span', null, [OF.h('span', { class: 'of-pretraga__naziv' }, OF.tx(p.naziv)), OF.h('span', { class: 'of-pretraga__cena' }, PR.imaDoplatu && PR.imaDoplatu(p) ? OF.t('cena.od', { od: OF.din(OF.cene.za(p.id, p.cena)) }) : OF.din(OF.cene.za(p.id, p.cena)))])]));
      });
      if (lista.length) rez.appendChild(OF.h('a', { href: linkSvih(), class: 'of-pretraga__sve' }, OF.t('pr.svi_rezultati')));
      rez.hidden = false; ulaz.setAttribute('aria-expanded', 'true');
    }
    ulaz.addEventListener('input', crtaj);
    ulaz.addEventListener('keydown', function (e) {
      var st = OF.$$('.of-pretraga__stavka', rez);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!st.length) return; e.preventDefault(); aktivan = (aktivan + (e.key === 'ArrowDown' ? 1 : st.length - 1 + (aktivan < 0 ? 1 : 0))) % st.length; st.forEach(function (a, i) { a.setAttribute('aria-selected', i === aktivan ? 'true' : 'false'); }); ulaz.setAttribute('aria-activedescendant', 'of-pr-' + aktivan); }
      if (e.key === 'Enter' && aktivan >= 0 && st[aktivan]) { e.preventDefault(); w.location.href = st[aktivan].href; }
      if (e.key === 'Escape') { rez.hidden = true; ulaz.setAttribute('aria-expanded', 'false'); }
    });
    d.addEventListener('click', function (e) { if (!forma.contains(e.target)) { rez.hidden = true; ulaz.setAttribute('aria-expanded', 'false'); } });
    forma.addEventListener('submit', function (e) {
      if (!ulaz.value.trim()) { e.preventDefault(); return; }
      PR.ga('search', [], { search_term: ulaz.value.trim() });
      upit = PR.citajUpit(ulaz.value);
      if (upit.max != null || upit.min != null || upit.za) { e.preventDefault(); w.location.href = linkSvih(); }
    });
  };

  /* =====================================================================
     STRANICA PROIZVODA
     ===================================================================== */
  PR.stranica = function (koren) {
    if (!koren) return;
    var p = PR.proizvod(koren.getAttribute('data-of-proizvod')); if (!p) return;
    PR.zapamtiGledano(p.id);
    var izbor = PR.podrazumevaniIzbor(p);
    var cenaEl = OF.$('[data-of-p-cena]', koren), stanjeEl = OF.$('[data-of-p-stanje]', koren), dugme = OF.$('[data-of-p-dodaj]', koren), kol = OF.$('[data-of-p-kolicina]', koren);
    var javi = OF.$('[data-of-p-javi]', koren), isporuka = OF.$('[data-of-p-isporuka]', koren), forma = OF.$('[data-of-p-forma]', koren);
    var gravura = OF.$('[data-of-p-gravura]', koren);
    // izbor varijanti (radio dugmad, već u HTML-u)
    OF.$$('[data-of-osa]', koren).forEach(function (grupa) {
      var osa = grupa.getAttribute('data-of-osa');
      OF.$$('input[type=radio]', grupa).forEach(function (r) {
        r.checked = r.value === izbor[osa];
        r.addEventListener('change', function () { izbor[osa] = r.value; osvezi(); });
      });
    });
    // gravura sa pregledom uživo
    var tekstGravure = '', fontGravure = 'klasican';
    if (gravura && p.gravura) {
      var cek = OF.$('input[type=checkbox]', gravura), deo = OF.$('[data-of-gravura-deo]', gravura), ulaz = OF.$('input[type=text]', gravura), pregled = OF.$('[data-of-gravura-pregled]', gravura), brojac = OF.$('[data-of-gravura-brojac]', gravura);
      var crtajGravuru = function () {
        tekstGravure = cek.checked ? ulaz.value.replace(/[<>]/g, '').slice(0, p.gravura.max) : '';
        if (brojac) brojac.textContent = OF.t('pr.znakova', { n: ulaz.value.length, max: p.gravura.max });
        if (pregled) { OF.$$('[data-of-gravura-tekst]', pregled).forEach(function (t) { t.textContent = tekstGravure || OF.tx(p.gravura.primer) || 'A ♡ M'; t.setAttribute('data-font', fontGravure); }); pregled.classList.toggle('prazno', !tekstGravure); }
        osvezi();
      };
      cek.addEventListener('change', function () { deo.hidden = !cek.checked; if (cek.checked) ulaz.focus(); crtajGravuru(); });
      ulaz.addEventListener('input', crtajGravuru);
      OF.$$('input[name="gravura-font"]', gravura).forEach(function (r) { r.addEventListener('change', function () { fontGravure = r.value; crtajGravuru(); }); });
    }
    function izborSaGravurom() { var o = Object.assign({}, izbor); if (tekstGravure) { o.gravura = tekstGravure; o.gravuraFont = fontGravure; } return o; }
    function osvezi() {
      var komb = PR.kombinacija(p, izbor), st = PR.stanje(p, izbor), cena = PR.cena(p, izborSaGravurom());
      if (cenaEl) cenaEl.textContent = OF.din(cena);
      // nedostupne opcije: precrtane, ali mogu da se izaberu (pa se nudi „javi mi“)
      OF.$$('[data-of-osa]', koren).forEach(function (grupa) {
        var osa = grupa.getAttribute('data-of-osa');
        OF.$$('input[type=radio]', grupa).forEach(function (r) { var t = Object.assign({}, izbor); t[osa] = r.value; var ok = PR.mozeKombinacija(p, t); r.closest('.of-opcija').classList.toggle('nema', !ok); r.setAttribute('aria-describedby', ok ? '' : 'p-nema-' + osa); });
        var izabrano = OF.$('[data-of-osa-izbor]', grupa); if (izabrano) { var op = (p.ose.filter(function (o) { return o.id === osa; })[0] || { opcije: [] }).opcije.filter(function (x) { return x.id === izbor[osa]; })[0]; izabrano.textContent = op ? OF.tx(op.naziv) : ''; }
      });
      if (stanjeEl) { stanjeEl.className = 'of-p-stanje ' + (st.ima ? (st.izrada ? 'izrada' : st.poslednji ? 'poslednji' : 'ima') : 'nema'); stanjeEl.textContent = !st.ima ? OF.t('pr.nema_na_stanju') : st.izrada ? OF.t('pr.izrada', { dana: st.izrada }) : st.poslednji ? OF.t('pr.poslednji_komad') : st.malo ? OF.t('pr.jos_n', { n: st.n }) : OF.t('pr.na_stanju'); }
      if (dugme) { dugme.disabled = !st.ima; dugme.textContent = st.ima ? OF.t('pr.u_korpu') : OF.t('pr.nema_na_stanju'); }
      if (kol) { kol.max = st.izrada ? 5 : Math.max(1, st.n); if (+kol.value > +kol.max) kol.value = kol.max; }
      if (javi) javi.hidden = st.ima;
      if (isporuka) isporuka.textContent = st.ima ? PR.isporukaTekst(st.izrada && !st.n ? st.izrada : 0, !!tekstGravure) : '';
      koren.setAttribute('data-kombinacija', komb);
    }
    if (forma) forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var st = PR.stanje(p, izbor); if (!st.ima) return;
      if (gravura && OF.$('input[type=checkbox]', gravura).checked && !tekstGravure.trim()) { var u = OF.$('input[type=text]', gravura); OF.forma(gravura.closest('form'), { 'gravura-tekst': function () { return OF.t('pr.unesite_gravuru'); } }); u.focus(); return; }
      var opc = izborSaGravurom(), n = Math.max(1, Math.min(+((kol && kol.value) || 1), st.izrada ? 5 : st.n));
      OF.korpa.dodaj({ id: p.id, tip: 'proizvod', naziv: p.naziv, detalj: PR.detalj(p, opc), cena: PR.cena(p, opc), kolicina: n, opcije: (p.ose || []).length || opc.gravura ? opc : null,
        varijanta: PR.kombinacija(p, izbor), slika: PR.slika(p), link: 'proizvod-' + p.id, maks: st.izrada ? 5 : st.n, kategorija: p.kategorija });
    });
    if (javi) {
      var f = OF.$('form', javi);
      if (f) f.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!OF.forma(f, { email: function (v) { return OF.provera.email(v) ? '' : OF.t('g.email'); } })) return;
        var email = f.elements.email.value.trim().toLowerCase(), komb = PR.kombinacija(p, izbor);
        OF.store.dodaj('zaliha-javi', { id: OF.id('J'), proizvod: p.id, kombinacija: komb, email: email, jezik: OF.jezik, vreme: new Date().toISOString() }, 300);
        OF.int.dogadjaj('zaliha.javi', { email: email, proizvod: p.id, naziv: OF.tx(p.naziv), detalj: PR.detalj(p, izbor), kombinacija: komb, link: OF.int.apsolutno(PR.link(p)) });
        f.replaceWith(OF.h('p', { class: 'of-hvala', role: 'status' }, OF.t('pr.javicemo', { email: email })));
      });
    }
    // lista želja
    OF.$$('[data-of-zelja]', koren).forEach(function (b) { b.addEventListener('click', function () { ZE.prebaci(b.getAttribute('data-of-zelja')); }); });
    // deljenje
    OF.$$('[data-of-podeli]', koren).forEach(function (b) {
      b.addEventListener('click', function () {
        var url = w.location.href.split('?')[0];
        if (navigator.share) navigator.share({ title: OF.tx(p.naziv), url: url }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { OF.obavesti(OF.t('pr.link_kopiran')); });
      });
    });
    PR.galerija(OF.$('[data-of-p-galerija]', koren));
    OF.on('zalihe', osvezi); OF.on('cene', osvezi);
    osvezi();
    PR.ga('view_item', [{ id: p.id, cena: PR.cena(p, izbor), varijanta: PR.kombinacija(p, izbor) }], { value: PR.cena(p, izbor) });
  };
  /* opis izabrane varijante za korpu i porudžbinu, na oba jezika */
  PR.detalj = function (p, izbor) {
    var r = {};
    (OF.d.sajt.jezici || ['sr']).forEach(function (j) {
      var delovi = (p.ose || []).map(function (o) { var op = o.opcije.filter(function (x) { return x.id === izbor[o.id]; })[0]; return op ? OF.tx(o.naziv, j) + ' ' + OF.tx(op.naziv, j) : ''; }).filter(Boolean);
      if (izbor.gravura) {
        var st = OF.jezik; OF.jezik = j;   // natpis na jeziku koji se pravi
        try {
          // prevod tog jezika možda nije učitan na stranici (npr. engleski na srpskoj): rezervni tekst
          var ima = OF.I18N && OF.I18N[j] && OF.I18N[j]['pr.gravura_kratko'], R = { sr: ['Gravura „{tekst}“', 'klasična slova', 'moderna slova'], en: ['Engraving “{tekst}”', 'classic lettering', 'modern lettering'] }[j] || null;
          var g = ima || !R ? OF.t('pr.gravura_kratko', { tekst: izbor.gravura }) : R[0].replace('{tekst}', izbor.gravura);
          var f = !izbor.gravuraFont ? '' : ima || !R ? OF.t('pr.gravura_font_' + (izbor.gravuraFont === 'moderan' ? 'moderan' : 'klasican')) : R[izbor.gravuraFont === 'moderan' ? 2 : 1];
          delovi.push(g + (f ? ' (' + f + ')' : ''));
        } finally { OF.jezik = st; }
      }
      r[j] = delovi.join(' · ');
    });
    return r.sr || r.en ? r : null;
  };
  /* galerija proizvoda: sličice, uvećanje mišem (računar), prevlačenje (telefon), prikaz preko celog ekrana */
  PR.galerija = function (g) {
    if (!g) return;
    var glavna = OF.$('[data-of-galerija-glavna]', g), slike = OF.$$('[data-of-galerija-slika]', g), palcevi = OF.$$('[data-of-galerija-palac]', g), i = 0;
    function prikazi(n) {
      i = (n + slike.length) % slike.length;
      slike.forEach(function (s, k) { s.hidden = k !== i; });
      palcevi.forEach(function (b, k) { b.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    }
    palcevi.forEach(function (b, k) { b.addEventListener('click', function () { prikazi(k); }); });
    if (glavna && w.matchMedia('(hover: hover) and (pointer: fine)').matches && !OF.manjePokreta()) {
      glavna.addEventListener('mousemove', function (e) { var r = glavna.getBoundingClientRect(); glavna.style.setProperty('--zx', ((e.clientX - r.left) / r.width * 100) + '%'); glavna.style.setProperty('--zy', ((e.clientY - r.top) / r.height * 100) + '%'); glavna.classList.add('zum'); });
      glavna.addEventListener('mouseleave', function () { glavna.classList.remove('zum'); });
    }
    if (glavna) {
      var x0 = null;
      glavna.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      glavna.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) prikazi(i + (dx < 0 ? 1 : -1)); x0 = null; });
      var veliko = OF.$('[data-of-galerija-uvecaj]', g);
      if (veliko) veliko.addEventListener('click', function () {
        var img = OF.h('img', { class: 'of-lightbox__slika', alt: '' }), brojac = OF.h('p', { class: 'of-lightbox__brojac', 'aria-live': 'polite' });
        var pokazi = function (n) { prikazi(n); var s = OF.$('img', slike[i]); img.src = s.currentSrc || s.src; img.srcset = s.getAttribute('data-velika') || ''; img.alt = s.alt; brojac.textContent = slike.length > 1 ? (i + 1) + ' / ' + slike.length : ''; };   // jedna slika: bez brojača
        var dl = OF.dijalog({ naslov: OF.t('g.galerija'), id: 'pgal', klasa: 'of-dialog--lightbox', sadrzaj: OF.h('figure', { class: 'of-lightbox' }, [img,
          slike.length > 1 ? OF.h('button', { type: 'button', class: 'of-lightbox__nav of-lightbox__nav--pret', 'aria-label': OF.t('g.prethodna'), onclick: function () { pokazi(i - 1); } }, '‹') : null,
          slike.length > 1 ? OF.h('button', { type: 'button', class: 'of-lightbox__nav of-lightbox__nav--sled', 'aria-label': OF.t('g.sledeca'), onclick: function () { pokazi(i + 1); } }, '›') : null,
          OF.h('figcaption', null, brojac)]) });
        dl.el.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') pokazi(i - 1); if (e.key === 'ArrowRight') pokazi(i + 1); });
        pokazi(i);
      });
    }
    prikazi(0);
  };

  /* nedavno gledano (bez trenutnog proizvoda) */
  PR.nedavno = function (koren) {
    if (!koren) return;
    var tren = koren.getAttribute('data-osim'), l = OF.store.get('nedavno', []).filter(function (id) { return id !== tren && PR.proizvod(id); }).slice(0, 4);
    if (!l.length) return;
    koren.hidden = false;
    var mesto = OF.$('[data-of-nedavno-lista]', koren) || koren;
    mesto.appendChild(PR.mreza(l.map(PR.proizvod)));
  };

  /* stranica liste želja (i deljena lista ?l=id,id) */
  PR.zeljeStranica = function (koren) {
    if (!koren) return;
    var deljena = OF.upit('l');
    function crtaj() {
      koren.innerHTML = '';
      var ids = deljena ? deljena.split(',').filter(function (id) { return PR.proizvod(id); }) : ZE.lista();
      if (deljena) koren.appendChild(OF.h('div', { class: 'of-zelje__deljena' }, [OF.h('p', null, OF.t('pr.deljena_lista', { n: ids.length })),
        OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { var l = ZE.lista(); ids.forEach(function (id) { if (l.indexOf(id) < 0) l.push(id); }); OF.store.set('zelje', l); OF.emit('zelje', l); deljena = null; try { w.history.replaceState(null, '', w.location.pathname); } catch (e) {} OF.obavesti(OF.t('pr.sacuvano_u_listu')); crtaj(); } }, OF.t('pr.sacuvaj_listu'))]));
      if (!ids.length) { koren.appendChild(OF.h('div', { class: 'of-nalog__prazno' }, [OF.h('p', null, OF.t('pr.lista_prazna')), OF.h('a', { class: 'of-dugme of-dugme--glavno', href: OF.link('prodavnica') }, OF.t('pr.pogledaj_nakit'))])); return; }
      koren.appendChild(PR.mreza(ids.map(PR.proizvod), deljena ? null : function (p) { return { ukloni: function () { ZE.prebaci(p.id); } }; }));
      if (!deljena) koren.appendChild(OF.h('div', { class: 'of-zelje__deli' }, [OF.h('p', null, OF.t('pr.podeli_listu_opis')),
        OF.h('div', { class: 'of-polje__red' }, [OF.h('input', { type: 'text', readonly: true, value: ZE.link(), 'aria-label': OF.t('pr.link_liste'), onfocus: function (e) { e.target.select(); } }),
          OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { var u = ZE.link(); if (navigator.share) navigator.share({ title: OF.t('pr.moja_lista', { firma: OF.d.firma.ime }), url: u }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(u).then(function () { OF.obavesti(OF.t('pr.link_kopiran')); }); } }, OF.t('pr.podeli'))])]));
    }
    OF.on('zelje', function () { if (!deljena) crtaj(); }); crtaj();
  };

  /* =====================================================================
     FIOKA KORPE (otvara se posle dodavanja i klikom na korpu u zaglavlju)
     ===================================================================== */
  var fioka = null;
  PR.otvoriKorpu = function () {
    if (OF.$('[data-of-korpa-stranica]') || OF.$('[data-of-kasa]')) { var k = OF.$('[data-of-korpa-stranica]'); if (k) k.scrollIntoView({ behavior: 'smooth' }); return; }
    if (!fioka) {
      var telo = OF.h('div', { class: 'of-fk__telo' });
      fioka = OF.h('dialog', { class: 'of-fk', 'aria-labelledby': 'fk-n' }, [
        OF.h('div', { class: 'of-fk__glava' }, [OF.h('h2', { id: 'fk-n', class: 'of-fk__naslov' }, OF.t('k.korpa')), OF.h('button', { type: 'button', class: 'of-dialog__x', 'aria-label': OF.t('zatvori'), onclick: function () { fioka.close(); } }, OF.h('span', { 'aria-hidden': 'true', html: '&times;' }))]),
        telo]);
      fioka.addEventListener('click', function (e) { if (e.target === fioka) fioka.close(); });
      fioka.addEventListener('close', function () { d.documentElement.classList.remove('fioka-otvorena'); });
      d.body.appendChild(fioka);
      OF.korpa.prikaz(telo, { kompaktno: true, kasaLink: OF.link('kasa'), korpaLink: OF.link('korpa'), nazadLink: OF.link('prodavnica'), posle: function (k) {
        var predlog = PR.predlogUzKorpu(); if (!predlog.length) return;
        k.appendChild(OF.h('div', { class: 'of-fk__predlog' }, [OF.h('p', { class: 'of-fk__predlog-naslov' }, OF.t('pr.uz_ovo')), PR.mreza(predlog.slice(0, 2))]));
      } });
    }
    if (!fioka.open) { fioka.showModal ? fioka.showModal() : fioka.setAttribute('open', ''); d.documentElement.classList.add('fioka-otvorena'); }
    PR.ga('view_cart', OF.korpa.stavke(), { value: OF.korpa.medjuzbir() });
  };
  PR.predlogUzKorpu = function () {
    var u = OF.korpa.stavke().map(function (x) { return x.id; }), pred = [];
    u.forEach(function (id) { var p = PR.proizvod(id); ((p && p.uzOvo) || []).forEach(function (r) { if (u.indexOf(r) < 0 && pred.indexOf(r) < 0 && PR.proizvod(r) && Z.ukupno(PR.proizvod(r)) > 0) pred.push(r); }); });
    return pred.map(PR.proizvod);
  };
  OF.korpa.imaFioku = true;
  OF.on('korpa:dodato', function () { setTimeout(PR.otvoriKorpu, 60); });

  /* =====================================================================
     STATUS PORUDŽBINE (broj + mejl, ili link iz mejla)
     ===================================================================== */
  var KORACI = ['primljena', 'placena', 'spakovana', 'poslata', 'isporucena'];
  PR.nazivStatusa = function (s) { return OF.t('pr.s_' + s.replace('-', '_')); };
  PR.nadjiPorudzbinu = function (broj, email, kljuc) {
    broj = String(broj || '').trim().toUpperCase(); email = String(email || '').trim().toLowerCase();
    if (!OF.demo) {
      var u = 'broj=' + encodeURIComponent(broj) + (kljuc ? '&k=' + encodeURIComponent(kljuc) : '&email=' + encodeURIComponent(email));
      return fetch(OF.int.api('/porudzbina?' + u), { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (o) { return o && o.porudzbina || null; }).catch(function () { return null; });
    }
    var p = OF.store.get('porudzbine', []).filter(function (x) { return x.id === broj && ((kljuc && x.kljuc === kljuc) || (email && x.kupac.email === email)); })[0];
    if (!p && PROD().demoPorudzbina && broj === PROD().demoPorudzbina.id && (kljuc || email === String(PROD().demoPorudzbina.email || '').toLowerCase())) p = PR.demoPorudzbina();   // i primer traži tačan mejl, kao prava porudžbina
    return Promise.resolve(p || null);
  };
  /* primer porudžbine za probu statusa (jasno označen) */
  PR.demoPorudzbina = function () {
    var x = PROD().demoPorudzbina, p = PR.proizvod(x.proizvod), danas = OF.sad().iso, juce = D.dodaj(danas, -2);
    return { id: x.id, primer: true, vreme: juce + 'T10:12:00.000Z', kupac: { ime: 'Ana Primer', email: x.email, telefon: '060 000 00 00' }, stavke: [{ id: p.id, tip: 'proizvod', naziv: OF.tx(p.naziv), detalj: null, cena: p.cena, kolicina: 1, slika: PR.slika(p) }],
      medjuzbir: p.cena, popust: 0, dostava: 0, ukupno: p.cena, nacin: 'kurir', nacinNaziv: OF.tx((PROD().dostava || [])[0].naziv), adresa: 'Primer ulica 1, 11000 Beograd', placanje: { nacin: 'kartica', kartica: '•••• 4242' }, status: 'poslata',
      posiljka: { servis: x.servis, broj: x.posiljka }, istorija: [{ status: 'primljena', vreme: juce + 'T10:12:00.000Z' }, { status: 'placena', vreme: juce + 'T10:12:00.000Z' }, { status: 'spakovana', vreme: juce + 'T15:40:00.000Z' }, { status: 'poslata', vreme: D.dodaj(danas, -1) + 'T09:05:00.000Z' }] };
  };
  PR.porudzbinaStranica = function (koren) {
    if (!koren) return;
    var broj = OF.upit('broj'), kljuc = OF.upit('k');
    if (broj && kljuc) PR.nadjiPorudzbinu(broj, null, kljuc).then(function (p) { p ? crtaj(p) : forma(OF.t('pr.nije_nadjena')); }); else forma();
    function forma(greska) {
      koren.innerHTML = '';
      var f = OF.h('form', { class: 'of-forma of-porudzbina__forma', novalidate: true }, [
        OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'po-broj' }, OF.t('k.broj_porudzbine')), OF.h('input', { id: 'po-broj', name: 'broj', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', value: broj || '', placeholder: (PROD().prefiks || 'P') + '-XXXXXX' })]),
        OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'po-email' }, OF.t('f.email')), OF.h('input', { id: 'po-email', name: 'email', type: 'email', autocomplete: 'email' })]),
        OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno' }, OF.t('pr.proveri_status'))]);
      if (greska) f.insertBefore(OF.h('p', { class: 'of-greska', role: 'alert' }, greska), f.firstChild);
      if (OF.demo && PROD().demoPorudzbina) f.appendChild(OF.h('p', { class: 'of-korpa__demo' }, OF.t('pr.demo_porudzbina', { broj: PROD().demoPorudzbina.id, email: PROD().demoPorudzbina.email })));
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!OF.forma(f, { broj: function (v) { return v.trim().length >= 4 ? '' : OF.t('g.obavezno'); }, email: function (v) { return OF.provera.email(v) ? '' : OF.t('g.email'); } })) return;
        PR.nadjiPorudzbinu(f.elements.broj.value, f.elements.email.value).then(function (p) { p ? crtaj(p) : forma(OF.t('pr.nije_nadjena')); });
      });
      koren.appendChild(f);
    }
    function crtaj(p) {
      koren.innerHTML = '';
      var status = p.status, otkazana = status === 'otkazana', ceka = status === 'ceka-uplatu';
      var dostignut = KORACI.indexOf(status === 'ceka-uplatu' ? 'primljena' : status);
      var istorija = {}; (p.istorija || []).forEach(function (x) { istorija[x.status] = x.vreme; });
      var koraci = p.nacin && (PR.nacinDostave(p.nacin) || {}).adresa === false ? ['primljena', 'placena', 'spakovana', 'isporucena'] : KORACI;
      if (p.placanje && p.placanje.nacin === 'pouzece') koraci = koraci.filter(function (k) { return k !== 'placena'; });
      koren.appendChild(OF.h('div', { class: 'of-porudzbina__glava' }, [OF.h('p', { class: 'of-porudzbina__oznaka' }, OF.t('k.broj_porudzbine') + ' ' + p.id + (p.primer ? ' · ' + OF.t('n.primer') : '')),
        OF.h('h2', null, otkazana ? OF.t('pr.s_otkazana') : ceka ? OF.t('pr.s_ceka_uplatu') : PR.nazivStatusa(status)),
        OF.h('p', null, OF.t('pr.porucena', { datum: D.dug(OF.datum.lokalno(p.vreme).iso) }))]));
      if (!otkazana) koren.appendChild(OF.h('ol', { class: 'of-koraci' }, koraci.map(function (k) {
        var gotovo = istorija[k] || KORACI.indexOf(k) <= dostignut && !(k === 'placena' && ceka);
        return OF.h('li', { class: 'of-koraci__korak' + (gotovo ? ' gotovo' : '') + (k === status ? ' trenutno' : ''), 'aria-current': k === status ? 'step' : null }, [OF.h('span', { class: 'of-koraci__tacka', 'aria-hidden': 'true' }), OF.h('span', { class: 'of-koraci__naziv' }, PR.nazivStatusa(k)),
          istorija[k] ? OF.h('span', { class: 'of-koraci__vreme' }, D.kratko(istorija[k].slice(0, 10)) + ' ' + OF.datum.uHHMM(OF.sad(new Date(istorija[k])).min)) : null]);
      })));
      if (p.posiljka) koren.appendChild(OF.h('p', { class: 'of-porudzbina__posiljka' }, [OF.t('pr.posiljka', { servis: p.posiljka.servis, broj: p.posiljka.broj }) + ' ', PROD().pracenje ? OF.h('a', { href: PROD().pracenje.replace('{broj}', encodeURIComponent(p.posiljka.broj)), target: '_blank', rel: 'noopener' }, OF.t('pr.prati_kod_kurira')) : null]));
      if (ceka && OF.placanje.uplatnicaPrikaz) koren.appendChild(OF.placanje.uplatnicaPrikaz(p));
      koren.appendChild(OF.h('ul', { class: 'of-porudzbina__stavke', role: 'list' }, p.stavke.map(function (x) {
        return OF.h('li', null, [x.slika ? OF.h('img', { src: OF.koren + x.slika, alt: '', width: '64', height: '64', loading: 'lazy' }) : OF.h('span'), OF.h('span', null, [OF.h('strong', null, x.kolicina + ' × ' + x.naziv), x.detalj ? OF.h('span', { class: 'of-porudzbina__detalj' }, typeof x.detalj === 'string' ? x.detalj : OF.tx(x.detalj)) : null]), OF.h('span', { class: 'of-porudzbina__cena' }, OF.din(x.cena * x.kolicina))]);
      })));
      koren.appendChild(OF.korpa.tabelaObracuna({ medjuzbir: p.medjuzbir, popust: p.popust, kupon: p.kupon ? { kod: p.kupon } : null, pakovanje: p.pakovanje, imaRobu: !!p.nacin, nacin: { id: p.nacin }, dostava: p.dostava, vaucer: p.vaucer ? { kod: p.vaucer.kod, iskorisceno: p.vaucer.iznos } : null, ukupno: p.ukupno }));
      var dugmad = OF.h('div', { class: 'of-zak__dugmad' });
      if (p.racun && status !== 'ceka-uplatu') dugmad.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { OF.dijalog({ naslov: OF.t('r.fiskalni'), id: 'rac', sadrzaj: OF.h('div', { html: OF.placanje.racunHtml(p.racun) }) }); } }, OF.t('n.racun')));
      if (OF.pdf.predracun) dugmad.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { OF.pdf.predracun(p); } }, status === 'ceka-uplatu' ? OF.t('pl.u_pdf') : OF.t('pr.potvrda_pdf')));
      if (!otkazana) {
        dugmad.appendChild(OF.h('a', { class: 'of-dugme of-dugme--tekst', href: OF.link('povracaj', 'broj=' + p.id + '#odustanak') }, OF.t('pr.odustani')));
        dugmad.appendChild(OF.h('a', { class: 'of-dugme of-dugme--tekst', href: OF.link('povracaj', 'broj=' + p.id + '#reklamacija') }, OF.t('pr.reklamacija')));
      }
      koren.appendChild(dugmad);
      if (OF.demo && !p.primer) koren.appendChild(OF.h('p', { class: 'of-korpa__demo' }, OF.t('pr.demo_status')));
    }
  };
  PR.nacinDostave = function (id) { return (PROD().dostava || []).filter(function (x) { return x.id === id; })[0] || null; };

  /* =====================================================================
     ODUSTANAK OD KUPOVINE I REKLAMACIJA (obrasci, potvrda sa brojem)
     ===================================================================== */
  PR.povracaj = function (koren, vrsta) {
    if (!koren) return;
    var forma = OF.$('form', koren); if (!forma) return;
    var broj = OF.upit('broj'); if (broj && forma.elements.broj) forma.elements.broj.value = broj;
    var stavkeMesto = OF.$('[data-of-povracaj-stavke]', forma);
    var nadjena = null;
    function ucitajStavke() {
      if (!stavkeMesto) return;
      var b = forma.elements.broj.value, e = forma.elements.email.value;
      if (!b || !OF.provera.email(e)) return;
      PR.nadjiPorudzbinu(b, e).then(function (p) {
        nadjena = p; stavkeMesto.innerHTML = '';
        if (!p) return;
        stavkeMesto.appendChild(OF.h('fieldset', { class: 'of-povracaj__stavke' }, [OF.h('legend', null, OF.t('pr.koje_stavke'))].concat(p.stavke.filter(function (x) { return x.tip === 'proizvod'; }).map(function (x, i) {
          var gravirano = x.opcije && x.opcije.gravura && vrsta === 'odustanak';
          return OF.h('div', { class: 'of-polje of-polje--cek' }, [OF.h('input', { type: 'checkbox', id: vrsta + '-st-' + i, name: 'stavka', value: String(i), checked: !gravirano, disabled: gravirano }),
            OF.h('label', { for: vrsta + '-st-' + i }, [x.kolicina + ' × ' + x.naziv + (x.detalj ? ' (' + (typeof x.detalj === 'string' ? x.detalj : OF.tx(x.detalj)) + ')' : ''), gravirano ? OF.h('span', { class: 'of-polje__pomoc', style: { display: 'block', marginTop: '.15rem' } }, OF.t('pr.gravirano_izuzeto')) : null])]);
        }))));
        var nacin = p.placanje && p.placanje.nacin, racunPolje = OF.$('[data-of-povracaj-racun]', forma);
        if (racunPolje) racunPolje.hidden = !(nacin === 'pouzece' || nacin === 'uplatnica');
      });
    }
    ['broj', 'email'].forEach(function (k) { if (forma.elements[k]) forma.elements[k].addEventListener('change', ucitajStavke); });
    var racun = OF.$('[data-of-povracaj-racun]', forma); if (racun) racun.hidden = true;
    var cekaj = OF.int.turnstile(forma);
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var pravila = { broj: function (v) { return v.trim().length >= 4 ? '' : OF.t('g.obavezno'); }, email: function (v) { return OF.provera.email(v) ? '' : OF.t('g.email'); }, ime: function (v) { return OF.provera.ime(v) ? '' : OF.t('g.ime'); } };
      if (forma.elements.opis) pravila.opis = function (v) { return v.trim().length >= 10 ? '' : OF.t('pr.g_opis'); };
      if (racun && !racun.hidden && forma.elements.tekuci) pravila.tekuci = function (v) { return /^\d{3}-?\d{6,13}-?\d{2}$/.test(v.replace(/\s/g, '')) ? '' : OF.t('pr.g_racun'); };
      if (forma.elements.saglasnost) pravila.saglasnost = function (v) { return v ? '' : OF.t('g.uslovi'); };
      if (!OF.forma(forma, pravila)) return;
      var podaci = {}; Array.prototype.forEach.call(forma.elements, function (el) { if (el.name && el.type !== 'checkbox' && el.type !== 'submit' && el.type !== 'file') podaci[el.name] = el.value.trim(); });
      podaci.stavke = OF.$$('input[name=stavka]:checked', forma).map(function (c) { var x = nadjena && nadjena.stavke.filter(function (s) { return s.tip === 'proizvod'; })[+c.value]; return x ? x.kolicina + ' × ' + x.naziv : ''; }).filter(Boolean);
      var fajl = forma.elements.slika && forma.elements.slika.files && forma.elements.slika.files[0];
      podaci.slika = fajl ? fajl.name : null;
      podaci.id = (vrsta === 'odustanak' ? 'O-' : 'R-') + OF.id().slice(0, 6);
      podaci.vreme = new Date().toISOString();
      podaci.email = podaci.email.toLowerCase();
      cekaj().then(function (token) {
        return OF.int.posaljiFormu(vrsta === 'odustanak' ? 'odustanak.zahtev' : 'reklamacija.prijava', podaci, token);
      }).then(function (r) {
        if (r && r.id) podaci.id = r.id;
        OF.store.dodaj(vrsta === 'odustanak' ? 'odustanci' : 'reklamacije', podaci, 100);
        var hvala = OF.h('div', { class: 'of-hvala', role: 'status', tabindex: '-1' }, [OF.h('h3', null, OF.t(vrsta === 'odustanak' ? 'pr.odustanak_primljen' : 'pr.reklamacija_primljena', { broj: podaci.id })),
          OF.h('p', null, OF.t(vrsta === 'odustanak' ? 'pr.odustanak_dalje' : 'pr.reklamacija_dalje', { email: podaci.email, dana: (PROD().reklamacijaDana || 8) })),
          vrsta === 'odustanak' && OF.pdf.odustanak ? OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { OF.pdf.odustanak(podaci); } }, OF.t('pr.obrazac_pdf')) : null]);
        forma.replaceWith(hvala); hvala.focus();
      }, function () { OF.obavesti(OF.t('f.greska_slanja'), 'greska'); });
    });
    if (broj) setTimeout(ucitajStavke, 50);
  };

  /* povratak sa stranice procesora plaćanja (PRAVI režim) */
  PR.povratak = function (koren) {
    if (!koren) return;
    var u = OF.store.get('placanje-u-toku', null), broj = OF.upit('porudzbina') || (u && u.id);
    koren.innerHTML = ''; koren.appendChild(OF.h('p', { role: 'status' }, [OF.h('span', { class: 'of-spiner', 'aria-hidden': 'true' }), ' ' + OF.t('pl.proveravam')]));
    if (!broj) { koren.innerHTML = ''; koren.appendChild(OF.h('p', null, OF.t('pr.nije_nadjena'))); return; }
    fetch(OF.int.api('/placanje/status?id=' + encodeURIComponent(broj)), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (o) {
      koren.innerHTML = '';
      if (o.vrsta === 'depozit' || o.vrsta === 'clanarina') return povratakVozila(koren, o, broj, u);
      var b = o.banka || {};
      var redovi = [[OF.t('k.broj_porudzbine'), broj], [OF.t('pl.status'), o.uspeh ? OF.t('pl.uspeh') : OF.t('pl.neuspeh')], [OF.t('ukupno'), OF.din(o.iznos || 0)],
        [OF.t('pl.odobrenje'), b.authCode || '–'], [OF.t('pl.transakcija'), b.transId || '–'], [OF.t('pl.kod_odgovora'), b.procReturnCode || '–'], ['3D Secure', b.mdStatus || '–'], [OF.t('pl.kartica'), b.kartica || '–'], [OF.t('pl.vreme'), b.vreme || '–']];
      koren.appendChild(OF.h('section', { class: 'of-potvrda' }, [OF.h('h2', { tabindex: '-1' }, o.uspeh ? OF.t('pl.uspeh') : OF.t('pl.neuspeh_naslov')), OF.h('p', null, o.uspeh ? OF.t('k.racun_mejlom', { email: (u && u.email) || '' }) : OF.t('pl.neuspeh_opis')),
        OF.h('dl', { class: 'of-pregled' }, [].concat.apply([], redovi.map(function (r) { return [OF.h('dt', null, r[0]), OF.h('dd', null, r[1])]; }))),
        // banka traži i kupca, stavke i podatke trgovca na ovoj stranici (i kad plaćanje ne prođe)
        o.porudzbina ? OF.h('div', { class: 'of-porudzbina__stavke' }, [OF.h('p', null, OF.t('pl.kupac') + ': ' + o.porudzbina.kupac.ime)].concat(o.porudzbina.stavke.map(function (x) { return OF.h('p', null, x.kolicina + ' × ' + x.naziv + (x.detalj ? ' (' + x.detalj + ')' : '') + ' · ' + OF.din(x.cena * x.kolicina)); }))) : null,
        OF.h('p', { class: 'of-kasa__sitno' }, OF.t('pl.trgovac') + ': ' + OF.d.firma.punoIme + ', ' + OF.int.adresa() + ', PIB ' + OF.d.firma.pib),
        OF.h('div', { class: 'of-zak__dugmad' }, o.uspeh ? [OF.h('a', { class: 'of-dugme of-dugme--glavno', href: OF.link('porudzbina', 'broj=' + encodeURIComponent(broj) + '&k=' + encodeURIComponent(o.kljuc || '')) }, OF.t('k.prati_porudzbinu'))] : [OF.h('a', { class: 'of-dugme of-dugme--glavno', href: OF.link('kasa') }, OF.t('pl.pokusaj_ponovo'))])]));
      if (o.uspeh) { OF.korpa.isprazni(); OF.store.remove('placanje-u-toku'); if (o.porudzbina) OF.emit('porudzbina', o.porudzbina); }
    }).catch(function () { koren.innerHTML = ''; koren.appendChild(OF.h('p', null, OF.t('pl.greska_veza'))); });
  };

  /* povratak posle depozita za termin ili prve članarine (detailing) */
  function povratakVozila(koren, o, broj, u) {
    var b = o.banka || {}, dep = o.vrsta === 'depozit', dugmad = [];
    var redovi = [[OF.t('pl.status'), o.uspeh ? OF.t('pl.uspeh') : o.ceka ? OF.t('pl.proveravam') : OF.t('pl.neuspeh')], [OF.t('ukupno'), OF.din(o.iznos || 0)],
      [OF.t('pl.odobrenje'), b.authCode || '–'], [OF.t('pl.transakcija'), b.transId || '–'], [OF.t('pl.kartica'), b.kartica || '–']];
    if (dep && o.termin) {
      var t = Object.assign({ tip: 'vozilo', status: 'potvrdjen', email: (u && u.email) || '' }, o.termin);
      redovi.unshift([OF.t('zak.broj'), t.id], [OF.t('zak.paket'), t.paketNaziv || ''], [OF.t('zak.ostavljanje'), D.dug(t.datum) + ', ' + D.vreme(t.vreme)]);
      if (o.uspeh && OF.zak) { OF.zak.sacuvaj(t); dugmad.push(OF.h('a', { class: 'of-dugme of-dugme--glavno', href: OF.zak.linkMojTermin(t) }, OF.t('vz.moj_termin'))); if (OF.pracenje) dugmad.push(OF.h('a', { class: 'of-dugme of-dugme--sporedno', href: OF.pracenje.link(t) }, OF.t('vz.sacuvaj_link'))); }
    }
    if (!dep && o.clanstvo && o.uspeh && OF.clanstvo) { OF.clanstvo.sacuvaj(o.clanstvo); dugmad.push(OF.h('a', { class: 'of-dugme of-dugme--glavno', href: OF.link('zakazivanje', 'paket=clan-pranje') }, OF.t('cl.zakazi_pranje')), OF.h('a', { class: 'of-dugme of-dugme--sporedno', href: OF.link('nalog') }, OF.t('cl.u_nalog'))); }
    if (!o.uspeh && !o.ceka) dugmad.push(OF.h('a', { class: 'of-dugme of-dugme--glavno', href: OF.link(dep ? 'zakazivanje' : 'clanstvo') }, dep ? OF.t('vz.zakazi_ponovo') : OF.t('cl.pokusaj_ponovo')));
    koren.appendChild(OF.h('section', { class: 'of-potvrda' }, [OF.h('h2', { tabindex: '-1' }, o.uspeh ? (dep ? OF.t('vz.depozit_placen_naslov') : OF.t('pl.uspeh')) : OF.t('pl.neuspeh_naslov')),
      OF.h('p', null, o.uspeh ? (dep ? OF.t('vz.depozit_placen_opis') : OF.t('cl.placanje_uspeh_opis')) : (dep ? OF.t('vz.depozit_neuspeh_opis') : OF.t('cl.placanje_neuspeh_opis'))),
      OF.h('dl', { class: 'of-pregled' }, [].concat.apply([], redovi.map(function (r) { return [OF.h('dt', null, r[0]), OF.h('dd', null, r[1])]; }))),
      OF.h('p', { class: 'of-kasa__sitno' }, OF.t('pl.trgovac') + ': ' + OF.d.firma.punoIme + ', ' + OF.int.adresa() + ', PIB ' + OF.d.firma.pib),
      OF.h('div', { class: 'of-zak__dugmad' }, dugmad)]));
    if (o.uspeh) OF.store.remove('placanje-u-toku');
  }

  /* pošalji korpu na mejl (kupac sam traži: link za nastavak kupovine sa drugog uređaja) */
  PR.linkKorpe = function () {
    var stavke = OF.korpa.stavke().filter(function (x) { return x.tip === 'proizvod'; }).map(function (x) { return [x.id, x.kolicina, x.varijanta || ''].join('~'); });
    return OF.int.apsolutno(OF.link('korpa', 'k=' + encodeURIComponent(stavke.join(','))));
  };
  PR.posaljiKorpu = function (email) {
    var link = PR.linkKorpe();
    return OF.int.dogadjaj('korpa.sacuvana', { email: email, link: link, stavke: OF.korpa.stavke().map(function (x) { return { naziv: OF.tx(x.naziv), detalj: x.detalj ? OF.tx(x.detalj) : '', kolicina: x.kolicina, cena: OF.korpa.cenaStavke(x) }; }) });
  };
  /* korpa iz linka (?k=id~kol~varijanta,...) */
  PR.korpaIzLinka = function () {
    var k = OF.upit('k'); if (!k || !OF.$('[data-of-korpa-stranica]')) return;
    k.split(',').forEach(function (deo) {
      var a = deo.split('~'), p = PR.proizvod(a[0]); if (!p) return;
      var izbor = {}; (p.ose || []).forEach(function (o, i) { izbor[o.id] = (a[2] || '').split('|')[i] || o.opcije[0].id; });
      var st = PR.stanje(p, izbor); if (!st.ima) return;
      OF.korpa.dodaj({ id: p.id, tip: 'proizvod', naziv: p.naziv, detalj: PR.detalj(p, izbor), cena: PR.cena(p, izbor), kolicina: Math.max(1, +a[1] || 1), opcije: (p.ose || []).length ? izbor : null, varijanta: PR.kombinacija(p, izbor), slika: PR.slika(p), link: 'proizvod-' + p.id, maks: st.izrada ? 5 : st.n, kategorija: p.kategorija }, false);
    });
    try { w.history.replaceState(null, '', w.location.pathname); } catch (e) {}
  };

  /* =====================================================================
     RECEPTI PORUKA PRODAVNICE (isti tekst u demo prikazu i na serveru)
     ===================================================================== */
  if (R) {
    var F = function () { return OF.d.firma; };
    var cfg = function (ime) { return (OF.c.integracije || {})[ime] || {}; };
    var vlasnikMejl = function () { return cfg('mejl').vlasnik || F().email; };
    var kolone = function (k) { return OF.jezik === 'sr' ? k.sr : k.en; };
    var opisStavke = function (s) { return s.kolicina + ' × ' + s.naziv + (s.detalj ? ' (' + (typeof s.detalj === 'string' ? s.detalj : OF.tx(s.detalj)) + ')' : ''); };
    var stavkeHtml = function (o) {
      return '<table role="presentation" width="100%" style="margin:0 0 14px;font-size:14px;border-collapse:collapse">' + o.stavke.map(function (s) {
        return '<tr><td style="padding:6px 0;border-bottom:1px solid #eee">' + OF.esc(s.kolicina + ' × ' + s.naziv) + (s.detalj ? '<br><span style="color:#777;font-size:13px">' + OF.esc(typeof s.detalj === 'string' ? s.detalj : OF.tx(s.detalj)) + '</span>' : '') + '</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">' + OF.esc(OF.din(s.cena * s.kolicina)) + '</td></tr>';
      }).join('') + (o.dostava ? '<tr><td style="padding:6px 0">' + OF.esc(OF.t('k.dostava')) + '</td><td style="padding:6px 0;text-align:right">' + OF.esc(OF.din(o.dostava)) + '</td></tr>' : '') +
        (o.pakovanje ? '<tr><td style="padding:6px 0">' + OF.esc(OF.t('k.pakovanje')) + '</td><td style="padding:6px 0;text-align:right">' + OF.esc(OF.din(o.pakovanje)) + '</td></tr>' : '') +
        (o.popust ? '<tr><td style="padding:6px 0">' + OF.esc(OF.t('k.popust')) + '</td><td style="padding:6px 0;text-align:right">− ' + OF.esc(OF.din(o.popust)) + '</td></tr>' : '') +
        (o.vaucer ? '<tr><td style="padding:6px 0">' + OF.esc(OF.t('k.vaucer_kratko') + ' ' + o.vaucer.kod) + '</td><td style="padding:6px 0;text-align:right">− ' + OF.esc(OF.din(o.vaucer.iznos)) + '</td></tr>' : '') +
        '<tr><td style="padding:8px 0;font-weight:bold">' + OF.esc(OF.t('ukupno')) + '</td><td style="padding:8px 0;text-align:right;font-weight:bold">' + OF.esc(OF.din(o.ukupno)) + '</td></tr></table>';
    };
    var nazivPl = function (o) { return OF.korpa.nazivPlacanja((o.placanje || {}).nacin || 'kartica'); };
    var navod = function (t) { return OF.jezik === 'en' ? '“' + t + '”' : '„' + t + '“'; };   // navodnici po jeziku poruke
    R['porudzbina.nova'] = function (p) {
      var o = p.porudzbina, f = F(), pl = o.placanje || {}, nacin = pl.nacin || 'kartica', link = p.link || OF.int.apsolutno(OF.link('porudzbina', 'broj=' + o.id + '&k=' + (o.kljuc || '')));
      var redovi = [[OF.t('k.broj_porudzbine'), o.id], [OF.t('ukupno'), OF.din(o.ukupno)], [OF.t('k.placanje'), nazivPl(o) + (pl.kartica ? ' · ' + pl.kartica : '')]];
      if (pl.odobrenje) redovi.push([OF.t('pl.odobrenje'), pl.odobrenje]);
      if (o.nacinNaziv) redovi.push([OF.t('k.dostava'), OF.tx(o.nacinNaziv)]);
      if (o.adresa) redovi.push([OF.t('k.adresa'), o.adresa]);
      if (o.primalac) redovi.push([OF.t('k.primalac'), o.primalac.ime + ', ' + o.primalac.adresa + ', ' + o.primalac.telefon]);
      if (o.poklonPoruka != null) redovi.push([OF.t('k.pakovanje'), o.poklonPoruka ? '„' + o.poklonPoruka + '“' : OF.t('da')]);
      var uvod = OF.korpa.uvodPorudzbine(o, nacin, 'r.p_uvod_');
      var uplata = '';
      if (nacin === 'uplatnica' && OF.placanje.uplatnicaPodaci) {
        var u = OF.placanje.uplatnicaPodaci(o);
        uplata = '<table role="presentation" width="100%" style="margin:0 0 14px;font-size:14px;background:#faf8f4;border:1px solid #eee"><tr><td style="padding:12px">' +
          [[OF.t('pl.u_primalac'), u.primalac], [OF.t('pl.u_racun'), u.racun], [OF.t('pl.u_iznos'), OF.din(u.iznos)], [OF.t('pl.u_sifra'), u.sifra], [OF.t('pl.u_svrha'), u.svrha], [OF.t('pl.u_poziv'), u.model + ' ' + u.poziv]].map(function (r) { return OF.esc(r[0]) + ': <strong>' + OF.esc(r[1]) + '</strong>'; }).join('<br>') + '</td></tr></table>';
      }
      var kodoviHtml = (o.kodovi || []).length ? '<p style="font-size:14px;margin:0 0 6px"><strong>' + OF.esc(OF.t('r.kodovi')) + '</strong></p>' + o.kodovi.map(function (k) { return '<p style="margin:0 0 4px;font-size:14px">' + OF.esc(k.naziv) + ': <code>' + OF.esc(k.kod) + '</code>' + (k.aktivan ? '' : ' · ' + OF.esc(OF.t('k.kod_posle_uplate'))) + '</p>'; }).join('') : '';
      var placeno = nacin === 'kartica' || nacin === 'ips' || nacin === 'vaucer';
      var gravure = o.stavke.filter(function (s) { return s.opcije && s.opcije.gravura; });
      var izlaz = {
        sazetak: OF.t('r.sazetak_porudzbina', { ime: o.kupac.ime, iznos: OF.din(o.ukupno) }),
        viber: { tekst: OF.t('r.viber_porudzbina', { broj: o.id }) + '\n' + o.stavke.map(opisStavke).join('\n') + '\n' + OF.t('ukupno') + ': ' + OF.din(o.ukupno) + ' · ' + nazivPl(o) + (placeno ? ' ✓' : '') + '\n' + (o.nacinNaziv || '') + (o.primalac ? ' · ' + OF.t('k.primalac') + ': ' + o.primalac.ime : '') + (o.poklonPoruka != null ? '\n🎁 ' + OF.t('k.pakovanje') + (o.poklonPoruka ? ': ' + navod(o.poklonPoruka) : '') : '') + (gravure.length ? '\n✎ ' + gravure.map(function (s) { return navod(s.opcije.gravura); }).join(', ') : '') + '\n' + o.kupac.ime + ' · ' + o.kupac.telefon, dugmad: [OF.t('r.otvori_panel')] },
        mejlKupcu: { za: o.kupac.email, naslov: OF.t(placeno ? 'r.mejl_porudzbina_naslov' : 'r.p_naslov_primljena', { firma: f.ime, broj: o.id }), prilozi: [(placeno ? 'racun-' : 'potvrda-') + o.id + '.pdf'].concat((o.kodovi || []).filter(function (k) { return k.aktivan; }).map(function (k) { return k.kod + '.pdf'; })),
          html: OF.int.mejl({ naslov: OF.t('r.mejl_porudzbina_h1', { ime: o.kupac.ime.split(' ')[0] }), uvod: uvod, redovi: redovi, html: uplata + stavkeHtml(o) + kodoviHtml + (placeno ? OF.placanje.racunHtml(o.racun) : ''),
            dugmad: [{ href: link, tekst: OF.t('k.prati_porudzbinu') }], napomena: OF.t('r.p_napomena', { dana: (PROD().odustanakDana || 14) }) }) },
        mejlVlasniku: { za: vlasnikMejl(), naslov: OF.t('r.mejl_vlasnik_porudzbina', { broj: o.id, iznos: OF.din(o.ukupno) }), tekst: o.stavke.map(opisStavke).join('\n') + '\n\n' + redovi.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') + '\n' + o.kupac.ime + ' · ' + o.kupac.telefon + ' · ' + o.kupac.email + (o.napomena ? '\n' + OF.t('f.napomena') + ': ' + o.napomena : '') },
        tabela: { list: OF.t('r.list_porudzbine'), kolone: kolone({ sr: ['Broj', 'Vreme', 'Stavke', 'Ukupno', 'Plaćanje', 'Dostava', 'Kupac', 'Telefon', 'Mejl', 'Status'], en: ['ID', 'Time', 'Items', 'Total', 'Payment', 'Delivery', 'Customer', 'Phone', 'Email', 'Status'] }),
          red: [o.id, D.kratko(OF.sad().iso) + ' ' + D.uHHMM(OF.sad().min), o.stavke.map(opisStavke).join(', '), o.ukupno, nazivPl(o), OF.tx(o.nacinNaziv) || '–', o.kupac.ime, o.kupac.telefon, o.kupac.email, PR.nazivStatusa(o.status || 'primljena')] },
        ostalo: []
      };
      if (placeno) izlaz.ostalo.push({ naziv: OF.t('r.fiskalni'), html: OF.placanje.racunHtml(o.racun) });
      izlaz.ostalo.push({ naziv: OF.t('r.zalihe'), tekst: OF.t('r.zalihe_tekst', { stavke: o.stavke.filter(function (s) { return s.tip === 'proizvod'; }).map(opisStavke).join(', ') }) });
      return izlaz;
    };
    R['porudzbina.status'] = function (p) {
      var o = p.porudzbina, f = F(), s = p.status, link = OF.int.apsolutno(OF.link('porudzbina', 'broj=' + o.id + '&k=' + (o.kljuc || '')));
      var pracenje = o.posiljka && PROD().pracenje ? PROD().pracenje.replace('{broj}', encodeURIComponent(o.posiljka.broj)) : null;
      var tekst = { placena: OF.t('r.st_placena'), spakovana: o.nacin && (PR.nacinDostave(o.nacin) || {}).adresa === false ? OF.t('r.st_spremno', { adresa: OF.int.adresa() }) : OF.t('r.st_spakovana'), poslata: OF.t('r.st_poslata', { servis: o.posiljka ? o.posiljka.servis : '', broj: o.posiljka ? o.posiljka.broj : '' }), isporucena: OF.t('r.st_isporucena'), otkazana: OF.t('r.st_otkazana') }[s] || '';
      var izlaz = {
        sazetak: OF.t('r.sazetak_status', { broj: o.id, status: PR.nazivStatusa(s) }),
        mejlKupcu: { za: o.kupac.email, naslov: OF.t('r.mejl_status_naslov', { firma: f.ime, broj: o.id, status: PR.nazivStatusa(s).toLowerCase() }), html: OF.int.mejl({ naslov: PR.nazivStatusa(s), uvod: tekst, redovi: [[OF.t('k.broj_porudzbine'), o.id]].concat(o.posiljka && s === 'poslata' ? [[OF.t('k.posiljka'), o.posiljka.servis + ' · ' + o.posiljka.broj]] : []),
          dugmad: [{ href: link, tekst: OF.t('k.prati_porudzbinu') }].concat(pracenje && s === 'poslata' ? [{ href: pracenje, tekst: OF.t('pr.prati_kod_kurira'), sporedno: true }] : []) }) },
        tabela: { list: OF.t('r.list_porudzbine'), kolone: kolone({ sr: ['Broj', 'Status', 'Pošiljka'], en: ['ID', 'Status', 'Shipment'] }), red: [o.id, PR.nazivStatusa(s), o.posiljka ? o.posiljka.broj : '–'] }
      };
      if (s === 'poslata' || (s === 'spakovana' && o.nacin && (PR.nacinDostave(o.nacin) || {}).adresa === false)) izlaz.sms = [{ tekst: s === 'poslata' ? OF.t('r.sms_poslata', { firma: f.ime, broj: o.posiljka ? o.posiljka.broj : '' }) : OF.t('r.sms_spremno_preuzimanje', { firma: f.ime, broj: o.id }), kada: OF.t('r.odmah') }];
      if (s === 'poslata' && o.posiljka) izlaz.ostalo = [{ naziv: OF.t('r.kurir'), tekst: OF.t('r.kurir_tekst', { servis: o.posiljka.servis, broj: o.posiljka.broj, adresa: o.primalac ? o.primalac.adresa : (o.adresa || '') }) }];
      if (s === 'isporucena') izlaz.mejlKupcu.html = OF.int.mejl({ naslov: PR.nazivStatusa(s), uvod: tekst, dugmad: [{ href: link, tekst: OF.t('k.prati_porudzbinu') }], napomena: OF.t('r.st_isporucena_napomena', { dana: PROD().odustanakDana || 14 }) });
      return izlaz;
    };
    R['odustanak.zahtev'] = function (p) {
      var f = F();
      return {
        sazetak: OF.t('r.sazetak_odustanak', { broj: p.broj, ime: p.ime }),
        viber: { tekst: OF.t('r.viber_odustanak', { broj: p.broj }) + '\n' + (p.stavke || []).join('\n') + '\n' + p.ime + ' · ' + p.email + (p.razlog ? '\n„' + p.razlog + '“' : ''), dugmad: [OF.t('r.otvori_panel')] },
        mejlKupcu: { za: p.email, naslov: OF.t('r.mejl_odustanak_naslov', { firma: f.ime, broj: p.id }), html: OF.int.mejl({ naslov: OF.t('r.mejl_odustanak_h1'), uvod: OF.t('r.mejl_odustanak_uvod', { dana: PROD().odustanakDana || 14 }),
          redovi: [[OF.t('pr.broj_zahteva'), p.id], [OF.t('k.broj_porudzbine'), p.broj], [OF.t('pr.stavke'), (p.stavke || []).join(', ') || '–']], napomena: OF.t('r.mejl_odustanak_napomena', { adresa: OF.int.adresa() }) }) },
        mejlVlasniku: { za: vlasnikMejl(), naslov: OF.t('r.mejl_vlasnik_odustanak', { broj: p.broj }), tekst: [p.id, p.broj, (p.stavke || []).join(', '), p.ime, p.email, p.tekuci ? OF.t('pr.tekuci') + ': ' + p.tekuci : '', p.razlog || ''].filter(Boolean).join('\n') },
        tabela: { list: OF.t('r.list_povracaj'), kolone: kolone({ sr: ['Zahtev', 'Vrsta', 'Porudžbina', 'Kupac', 'Mejl', 'Stavke', 'Opis'], en: ['Request', 'Type', 'Order', 'Customer', 'Email', 'Items', 'Note'] }), red: [p.id, OF.t('pr.odustanak'), p.broj, p.ime, p.email, (p.stavke || []).join(', '), p.razlog || ''] }
      };
    };
    R['reklamacija.prijava'] = function (p) {
      var f = F(), dana = PROD().reklamacijaDana || 8;
      return {
        sazetak: OF.t('r.sazetak_reklamacija', { broj: p.broj, ime: p.ime }),
        viber: { tekst: OF.t('r.viber_reklamacija', { broj: p.broj }) + '\n' + (p.stavke || []).join('\n') + '\n„' + (p.opis || '') + '“\n' + p.ime + ' · ' + p.email, dugmad: [OF.t('r.otvori_panel')] },
        mejlKupcu: { za: p.email, naslov: OF.t('r.mejl_reklamacija_naslov', { firma: f.ime, broj: p.id }), html: OF.int.mejl({ naslov: OF.t('r.mejl_reklamacija_h1'), uvod: OF.t('r.mejl_reklamacija_uvod', { dana: dana }),
          redovi: [[OF.t('pr.broj_zahteva'), p.id], [OF.t('k.broj_porudzbine'), p.broj], [OF.t('pr.stavke'), (p.stavke || []).join(', ') || '–'], [OF.t('pr.zahtev'), p.zahtev || '–']], html: '<blockquote style="margin:0 0 14px;padding:10px 14px;border-left:3px solid #ccc;font-size:14px;color:#444">' + OF.esc(p.opis || '') + '</blockquote>' }) },
        mejlVlasniku: { za: vlasnikMejl(), naslov: OF.t('r.mejl_vlasnik_reklamacija', { broj: p.broj }), tekst: [p.id, p.broj, (p.stavke || []).join(', '), p.zahtev || '', p.opis || '', p.ime, p.email, p.telefon || '', p.slika ? OF.t('pr.prilozena_slika') + ': ' + p.slika : ''].filter(Boolean).join('\n') },
        tabela: { list: OF.t('r.list_povracaj'), kolone: kolone({ sr: ['Zahtev', 'Vrsta', 'Porudžbina', 'Kupac', 'Mejl', 'Stavke', 'Opis'], en: ['Request', 'Type', 'Order', 'Customer', 'Email', 'Items', 'Note'] }), red: [p.id, OF.t('pr.reklamacija'), p.broj, p.ime, p.email, (p.stavke || []).join(', '), p.opis || ''] }
      };
    };
    R['zaliha.javi'] = function (p) {
      var f = F();
      return { sazetak: OF.t('r.sazetak_javi', { naziv: p.naziv, email: p.email }),
        mejlKupcu: { za: p.email, naslov: OF.t('r.mejl_javi_naslov', { firma: f.ime }), html: OF.int.mejl({ naslov: OF.t('r.mejl_javi_h1'), uvod: OF.t('r.mejl_javi_uvod', { naziv: p.naziv + (p.detalj && OF.tx(p.detalj) ? ' (' + OF.tx(p.detalj) + ')' : '') }), dugmad: [{ href: p.link, tekst: OF.t('r.pogledaj_proizvod'), sporedno: true }], napomena: OF.t('r.mejl_javi_napomena') }) },
        tabela: { list: OF.t('r.list_javi'), kolone: kolone({ sr: ['Vreme', 'Proizvod', 'Varijanta', 'Mejl'], en: ['Time', 'Product', 'Variant', 'Email'] }), red: [D.uHHMM(OF.sad().min), p.naziv, p.kombinacija || '–', p.email] } };
    };
    R['zaliha.stigla'] = function (p) {
      var f = F();
      return { sazetak: OF.t('r.sazetak_stigla', { naziv: p.naziv, n: (p.mejlovi || []).length }),
        mejlKupcu: (p.mejlovi || []).length ? { za: p.mejlovi.join(', '), naslov: OF.t('r.mejl_stigla_naslov', { naziv: p.naziv, firma: f.ime }), html: OF.int.mejl({ naslov: OF.t('r.mejl_stigla_h1', { naziv: p.naziv }), uvod: OF.t('r.mejl_stigla_uvod'), dugmad: [{ href: p.link, tekst: OF.t('r.pogledaj_proizvod') }], napomena: OF.t('r.mejl_stigla_napomena') }) } : null };
    };
    R['zaliha.malo'] = function (p) {
      return { sazetak: OF.t('r.sazetak_malo', { n: p.stavke.length }),
        viber: { tekst: OF.t('r.viber_malo') + '\n' + p.stavke.map(function (s) { return s.naziv + (s.varijanta ? ' (' + s.varijanta.replace(/\|/g, ', ') + ')' : '') + ': ' + s.ostalo; }).join('\n') } };
    };
    R['korpa.sacuvana'] = function (p) {
      var f = F(), o = { stavke: p.stavke, ukupno: p.stavke.reduce(function (s, x) { return s + x.cena * x.kolicina; }, 0) };
      return { sazetak: OF.t('r.sazetak_korpa', { email: p.email }),
        mejlKupcu: { za: p.email, naslov: OF.t('r.mejl_korpa_naslov', { firma: f.ime }), html: OF.int.mejl({ naslov: OF.t('r.mejl_korpa_h1'), uvod: OF.t('r.mejl_korpa_uvod'), html: stavkeHtml(o), dugmad: [{ href: p.link, tekst: OF.t('r.nastavi_kupovinu') }], napomena: OF.t('r.mejl_korpa_napomena') }) } };
    };
    R['korpa.podsetnik'] = function (p) {
      var r = R['korpa.sacuvana'](p), f = F();
      r.sazetak = OF.t('r.sazetak_podsetnik', { email: p.email });
      r.mejlKupcu.naslov = OF.t('r.mejl_podsetnik_naslov', { firma: f.ime });
      r.mejlKupcu.html = OF.int.mejl({ naslov: OF.t('r.mejl_podsetnik_h1'), uvod: OF.t('r.mejl_podsetnik_uvod'), html: stavkeHtml({ stavke: p.stavke, ukupno: p.stavke.reduce(function (z, x) { return z + x.cena * x.kolicina; }, 0) }), dugmad: [{ href: p.link, tekst: OF.t('r.nastavi_kupovinu') }], napomena: OF.t('r.mejl_podsetnik_napomena') });
      r.ostalo = [{ naziv: OF.t('r.podsetnik_kada'), tekst: OF.t('r.podsetnik_kada_tekst') }];
      return r;
    };
    // molba za Google recenziju: samo kupcu, nekoliko dana posle isporuke, najviše jednom u 180 dana (server, cron)
    R['porudzbina.recenzija'] = function (p) {
      var f = F(), place = ((OF.c.integracije || {}).recenzije || {}).placeId;
      var link = 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(place || 'PLACE_ID');
      return { sazetak: OF.t('r.sazetak_rec_kupovina', { broj: p.broj, email: p.email }),
        mejlKupcu: { za: p.email, naslov: OF.t('r.mejl_rec_kupovina_naslov', { firma: f.ime }), html: OF.int.mejl({ naslov: OF.t('r.mejl_rec_kupovina_h1', { ime: (p.ime || '').split(' ')[0] }), uvod: OF.t('r.mejl_rec_kupovina_uvod'), dugmad: [{ href: link, tekst: OF.t('r.napisi_recenziju') }], napomena: OF.t('r.mejl_rec_kupovina_napomena') }) } };
    };
    R['porudzbina.uplata'] = function (p) {
      var o = p.porudzbina, f = F();
      return { sazetak: OF.t('r.sazetak_uplata', { broj: o.id, iznos: OF.din(o.ukupno) }),
        mejlKupcu: { za: o.kupac.email, naslov: OF.t('r.mejl_uplata_naslov', { firma: f.ime, broj: o.id }), prilozi: ['racun-' + o.id + '.pdf'].concat((o.kodovi || []).filter(function (k) { return k.aktivan; }).map(function (k) { return k.kod + '.pdf'; })), html: OF.int.mejl({ naslov: OF.t('r.mejl_uplata_h1'), uvod: OF.t('r.mejl_uplata_uvod'), redovi: [[OF.t('k.broj_porudzbine'), o.id], [OF.t('ukupno'), OF.din(o.ukupno)]], html: o.racun ? OF.placanje.racunHtml(o.racun) : '' }) },
        ostalo: o.racun ? [{ naziv: OF.t('r.fiskalni'), html: OF.placanje.racunHtml(o.racun) }] : [] };
    };
  }

  /* =====================================================================
     POKRETANJE
     ===================================================================== */
  OF.spremno(function () {
    PR.korpaIzLinka();
    osveziZelje(); OF.on('zelje', osveziZelje); w.addEventListener('storage', function (e) { if (e.key && e.key.indexOf(':zelje') > 0) osveziZelje(); });
    OF.$$('[data-of-pretraga]').forEach(PR.pretraga);
    OF.$$('[data-of-katalog]').forEach(PR.katalog);
    PR.stranica(OF.$('[data-of-proizvod]'));
    OF.$$('[data-of-nedavno]').forEach(PR.nedavno);
    PR.zeljeStranica(OF.$('[data-of-zelje]'));
    PR.porudzbinaStranica(OF.$('[data-of-porudzbina]'));
    PR.povracaj(OF.$('[data-of-odustanak]'), 'odustanak'); PR.povracaj(OF.$('[data-of-reklamacija]'), 'reklamacija');
    PR.povratak(OF.$('[data-of-placanje-povratak]'));
    OF.korpa.prikaz(OF.$('[data-of-korpa-stranica]'), { kasaLink: OF.link('kasa'), nazadLink: OF.link('prodavnica'), praznaTekst: OF.t('pr.korpa_prazna_tekst') });
    OF.korpa.kasa(OF.$('[data-of-kasa]'), {});
    OF.$$('[data-of-korpa-link]').forEach(function (a) { a.addEventListener('click', function (e) { if (OF.korpa.broj() && !OF.$('[data-of-korpa-stranica]')) { e.preventDefault(); PR.otvoriKorpu(); } }); });
    OF.$$('[data-of-zelja]').forEach(function (b) { if (!b.closest('[data-of-proizvod]')) b.addEventListener('click', function (e) { e.preventDefault(); ZE.prebaci(b.getAttribute('data-of-zelja')); }); });
    OF.$$('[data-of-posalji-korpu]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault(); if (!OF.forma(f, { email: function (v) { return OF.provera.email(v) ? '' : OF.t('g.email'); } })) return;
        var email = f.elements.email.value.trim(); PR.posaljiKorpu(email).then(function () { f.replaceWith(OF.h('p', { class: 'of-hvala', role: 'status' }, OF.t('pr.korpa_poslata', { email: email }))); });
      });
    });
    Z.ucitaj();
  });
})(window, document);
