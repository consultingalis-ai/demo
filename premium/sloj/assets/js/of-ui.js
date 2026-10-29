/* opsforma Premium · ponašanje stranice: meni, status otvoreno/zatvoreno, galerija, klizač pre/posle,
   lepljiva traka na telefonu, mapa na klik, forme, newsletter, Instagram i recenzije (demo), animacije pri skrolu. */
(function (w, d) {
  'use strict';
  var OF = w.OF;
  OF.ui = {};

  /* ---------- meni na telefonu ---------- */
  function meni() {
    OF.$$('[data-of-meni-dugme]').forEach(function (dugme) {
      var meni = d.getElementById(dugme.getAttribute('aria-controls')); if (!meni) return;
      var prethodni = null;
      function postavi(otvoren) {
        dugme.setAttribute('aria-expanded', otvoren ? 'true' : 'false');
        meni.classList.toggle('otvoren', otvoren); d.documentElement.classList.toggle('meni-otvoren', otvoren);
        if (otvoren) { prethodni = d.activeElement; var prvi = OF.$('a, button', meni); if (prvi) setTimeout(function () { prvi.focus(); }, 60); }
        else if (prethodni && prethodni.focus) prethodni.focus();
      }
      dugme.addEventListener('click', function () { postavi(dugme.getAttribute('aria-expanded') !== 'true'); });
      meni.addEventListener('click', function (e) { if (e.target.closest('a')) postavi(false); });
      d.addEventListener('keydown', function (e) {
        if (dugme.getAttribute('aria-expanded') !== 'true') return;
        if (e.key === 'Escape') postavi(false);
        if (e.key === 'Tab') {   // fokus ostaje u meniju
          var f = OF.$$('a, button, input', meni).filter(function (x) { return x.offsetParent !== null; }).concat([dugme]);
          var i = f.indexOf(d.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
      });
      w.matchMedia('(min-width: 1024px)').addEventListener('change', function (m) { if (m.matches) postavi(false); });
    });
  }

  /* ---------- status otvoreno / zatvoreno ---------- */
  function status() {
    var elementi = OF.$$('[data-of-status]'); if (!elementi.length) return;
    function osvezi() {
      var s = OF.statusTekst();
      elementi.forEach(function (el) {
        el.classList.remove('otvoreno', 'zatvoreno', 'uskoro'); el.classList.add(s.klasa);
        var t = OF.$('[data-of-status-tekst]', el) || el; t.textContent = s.tekst;
      });
    }
    osvezi(); setInterval(osvezi, 60000);
  }
  /* radno vreme: označi današnji dan */
  function danas() {
    var dan = OF.DANI[OF.datum.danUNedelji(OF.sad().iso)];
    OF.$$('[data-of-dan="' + dan + '"]').forEach(function (el) { el.classList.add('danas'); el.setAttribute('aria-current', 'date'); });
  }

  /* ---------- cene iz panela / tabele ---------- */
  function cene() {
    function osvezi() {
      OF.$$('[data-of-cena]').forEach(function (el) {
        var id = el.getAttribute('data-of-cena'), osnova = JSON.parse(el.getAttribute('data-of-osnova') || 'null');
        var c = OF.cene.za(id, osnova); el.textContent = OF.cenaTekst(c);
      });
    }
    osvezi(); OF.on('cene', osvezi);
    // pravi režim: važeće cene sa servera (izmene iz panela ili Google tabela; server ih kešira)
    if (!OF.demo) {
      fetch(OF.int.api('/cenovnik'), { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (o) {
        if (!o || !o.cene) return; OF.store.set('cene-izmene', o.cene); OF.emit('cene', o.cene);
      }).catch(function () {});
    }
  }

  /* ---------- galerija sa uvećanjem ---------- */
  function galerija() {
    OF.$$('[data-of-galerija]').forEach(function (g) {
      var linkovi = OF.$$('a[data-of-slika]', g);
      linkovi.forEach(function (a, i) {
        a.addEventListener('click', function (e) { e.preventDefault(); otvori(i); });
      });
      function otvori(i) {
        var slika = OF.h('img', { class: 'of-lightbox__slika', alt: '' });
        var opis = OF.h('p', { class: 'of-lightbox__opis' });
        var brojac = OF.h('p', { class: 'of-lightbox__brojac', 'aria-live': 'polite' });
        function prikazi(n) {
          i = (n + linkovi.length) % linkovi.length; var a = linkovi[i], img = OF.$('img', a);
          slika.src = a.getAttribute('href'); slika.alt = img ? img.alt : ''; if (a.getAttribute('data-of-srcset')) slika.srcset = a.getAttribute('data-of-srcset');
          opis.textContent = a.getAttribute('data-of-opis') || (img ? img.alt : ''); brojac.textContent = (i + 1) + ' / ' + linkovi.length;
        }
        var pret = OF.h('button', { type: 'button', class: 'of-lightbox__nav of-lightbox__nav--pret', 'aria-label': OF.t('g.prethodna'), onclick: function () { prikazi(i - 1); } }, '‹');
        var sled = OF.h('button', { type: 'button', class: 'of-lightbox__nav of-lightbox__nav--sled', 'aria-label': OF.t('g.sledeca'), onclick: function () { prikazi(i + 1); } }, '›');
        var dl = OF.dijalog({ naslov: OF.t('g.galerija'), id: 'gal', klasa: 'of-dialog--lightbox', sadrzaj: OF.h('figure', { class: 'of-lightbox' }, [slika, pret, sled, OF.h('figcaption', null, [opis, brojac])]) });
        dl.el.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') prikazi(i - 1); if (e.key === 'ArrowRight') prikazi(i + 1); });
        var x0 = null; slika.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
        slika.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) prikazi(i + (dx < 0 ? 1 : -1)); x0 = null; });
        prikazi(i);
      }
    });
  }

  /* ---------- klizač pre / posle ---------- */
  function preposle() {
    OF.$$('[data-of-preposle]').forEach(function (k) {
      var ulaz = OF.$('input[type=range]', k); if (!ulaz) return;
      var postavi = function () { k.style.setProperty('--pozicija', ulaz.value + '%'); };
      ulaz.addEventListener('input', postavi); postavi();
    });
  }

  /* ---------- lepljiva traka na telefonu: skriva se kad su glavna dugmad ili futer na ekranu ---------- */
  function traka() {
    var t = OF.$('[data-of-traka]'); if (!t || !('IntersectionObserver' in w)) return;
    var vidljivi = new Set();
    var io = new IntersectionObserver(function (u) {
      u.forEach(function (x) { if (x.isIntersecting) vidljivi.add(x.target); else vidljivi.delete(x.target); });
      t.classList.toggle('skrivena', vidljivi.size > 0);
    }, { threshold: 0.1 });
    OF.$$('[data-of-sakrij-traku], footer').forEach(function (el) { io.observe(el); });
  }

  /* ---------- mapa: učitava se tek na klik (brže i bez kolačića Google-a dok ne zatreba) ---------- */
  function mapa() {
    OF.$$('[data-of-mapa]').forEach(function (m) {
      var dugme = OF.$('button', m); if (!dugme) return;
      dugme.addEventListener('click', function () {
        var f = OF.d.firma, q = encodeURIComponent(f.mapaUpit || (f.ime + ', ' + OF.int.adresa()));
        var ifr = OF.h('iframe', { src: 'https://maps.google.com/maps?q=' + q + '&z=16&output=embed&hl=' + OF.jezik, title: OF.t('mapa.naslov', { ime: f.ime }), loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade', allowfullscreen: true });
        m.innerHTML = ''; m.appendChild(ifr); m.classList.add('ucitana');
      });
    });
  }

  /* ---------- forme: kontakt i upiti ---------- */
  function forme() {
    OF.$$('form[data-of-forma]').forEach(function (forma) {
      var tip = forma.getAttribute('data-of-forma');
      var token = OF.int.turnstile(forma);
      forma.addEventListener('submit', function (e) {
        e.preventDefault();
        var pravila = {};
        OF.$$('[required]', forma).forEach(function (p) {
          pravila[p.name] = function (v, el) {
            if (el.type === 'checkbox') return v ? '' : OF.t('g.saglasnost');
            if (!String(v).trim()) return OF.t('g.obavezno');
            if (el.type === 'email' && !OF.provera.email(v)) return OF.t('g.email');
            if (el.type === 'tel' && !OF.provera.telefon(v)) return OF.t('g.telefon');
            if (el.minLength > 0 && String(v).trim().length < el.minLength) return OF.t('g.kratko', { n: el.minLength });
            return '';
          };
        });
        if (!OF.forma(forma, pravila)) return;
        var p = {}; new FormData(forma).forEach(function (v, k) { p[k] = v; });
        var dugme = OF.$('[type=submit]', forma); if (dugme) dugme.disabled = true;
        token().then(function (tk) { return OF.int.posaljiFormu(tip, p, tk); }).then(function () {
          var hvala = OF.h('div', { class: 'of-hvala', role: 'status', tabindex: '-1' }, [OF.h('h3', null, OF.tx(forma.getAttribute('data-of-hvala-naslov')) || OF.t('f.hvala_naslov')), OF.h('p', null, forma.getAttribute('data-of-hvala') || OF.t('f.hvala'))]);
          forma.replaceWith(hvala); hvala.focus();
        }, function () { if (dugme) dugme.disabled = false; OF.obavesti(OF.t('f.greska_slanja'), 'greska'); });
      });
    });
    OF.$$('form[data-of-newsletter]').forEach(function (forma) {
      forma.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!OF.forma(forma, { email: function (v) { return OF.provera.email(v) ? '' : OF.t('g.email'); }, saglasnost: function (v) { return v === false ? OF.t('g.saglasnost') : ''; } })) return;
        var dugme = OF.$('[type=submit]', forma); if (dugme) dugme.disabled = true;
        OF.int.newsletter(forma.elements.email.value.trim()).then(function () {
          var em = forma.elements.email.value.trim(), z = OF.demo && OF.store.get('newsletter', []).filter(function (x) { return x.email === em; }).pop();
          // demo: mejl se ne šalje, pa nudimo link koji bi stigao (kao kod prijave u nalog)
          var p = OF.h('p', { class: 'of-hvala', role: 'status' }, [OF.t('nl.proverite'), z ? OF.h('br') : null, z ? OF.h('a', { href: OF.link('newsletter-potvrda', 'k=' + encodeURIComponent(z.potvrda) + '&e=' + encodeURIComponent(em)) }, OF.t('nl.demo_link')) : null]);
          forma.replaceWith(p);
        }, function () { if (dugme) dugme.disabled = false; OF.obavesti(OF.t('f.greska_slanja'), 'greska'); });
      });
    });
  }

  /* ---------- Instagram i Google recenzije ---------- */
  function instagram() {
    OF.$$('[data-of-instagram]').forEach(function (el) {
      if (OF.demo) return;                                         // demo objave su već u HTML-u
      // pravi režim: primeri sa demo sajta se ne prikazuju; deo se pojavi tek kad stignu prave objave
      var primer = OF.$('[data-of-demo-oznaka]', el), sekcija = el.closest('section') || el;
      if (primer) sekcija.hidden = true;
      if (!OF.int.ukljuceno('instagram')) return;
      fetch(OF.int.api('/instagram'), { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (o) {
        if (!o || !o.objave || !o.objave.length) return;
        var lista = OF.$('[data-of-instagram-lista]', el); if (!lista) return; lista.innerHTML = '';
        o.objave.slice(0, +(el.getAttribute('data-of-instagram') || 6)).forEach(function (x) {
          lista.appendChild(OF.h('li', null, OF.h('a', { href: x.link, target: '_blank', rel: 'noopener' }, OF.h('img', { src: x.slika, alt: x.opis || OF.t('ig.objava'), loading: 'lazy', width: '400', height: '400' }))));
        });
        if (primer) primer.remove();
        sekcija.hidden = false;
      }).catch(function () {});
    });
  }
  /* Google recenzije u pravom režimu: traže se tek kad se deo približi ekranu (svaki prikaz Google naplaćuje),
     primeri sa demo sajta se ne prikazuju, a uvek postoji link ka svim recenzijama na Google mapama */
  function recenzije() {
    OF.$$('[data-of-recenzije]').forEach(function (el) {
      if (OF.demo || !OF.int.ukljuceno('recenzije')) return;
      var lista = OF.$('[data-of-recenzije-lista]', el), primer = OF.$('[data-of-demo-oznaka]', el);
      var placeId = ((OF.c.integracije || {}).recenzije || {}).placeId || '';
      var naMapama = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(OF.d.firma.ime + ', ' + OF.int.adresa()) + (placeId ? '&query_place_id=' + encodeURIComponent(placeId) : '');
      if (primer) { primer.remove(); if (lista) lista.innerHTML = ''; el.classList.add('of-recenzije--bez-ocene'); }
      var izvor = OF.h('p', { class: 'of-recenzije__izvor' }, OF.h('a', { href: naMapama, target: '_blank', rel: 'noopener' }, OF.t('rec.sve_na_mapama')));
      el.appendChild(izvor);
      var ucitaj = function () {
        fetch(OF.int.api('/recenzije?jezik=' + OF.jezik), { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (o) {
          if (!o || !o.recenzije || !o.recenzije.length) return;
          var ocena = OF.$('[data-of-ocena]', el); if (ocena && o.ocena) ocena.textContent = OF.broj(o.ocena, 1);
          var broj = OF.$('[data-of-broj-recenzija]', el); if (broj) broj.textContent = String(o.ukupno);
          if (o.ocena) el.classList.remove('of-recenzije--bez-ocene');
          if (lista) {
            lista.innerHTML = '';
            o.recenzije.slice(0, 5).forEach(function (r) {
              lista.appendChild(OF.int.prikazRecenzije ? OF.int.prikazRecenzije(r) : OF.h('li', { class: 'of-recenzija' }, [OF.h('p', { class: 'of-recenzija__ocena' }, [OF.h('span', { class: 'of-sr' }, OF.t('rec.ocena', { n: r.ocena })), OF.h('span', { 'aria-hidden': 'true' }, '★★★★★'.slice(0, r.ocena))]), OF.h('blockquote', null, r.tekst), OF.int.autorRecenzije(r)]));
            });
          }
          izvor.innerHTML = '';
          izvor.appendChild(d.createTextNode(OF.t('rec.izvor') + ' '));
          izvor.appendChild(OF.h('a', { href: o.link || naMapama, target: '_blank', rel: 'noopener' }, OF.t('rec.sve_na_mapama')));
        }).catch(function () {});
      };
      if (!('IntersectionObserver' in w)) return ucitaj();
      var io = new IntersectionObserver(function (u) { if (u.some(function (x) { return x.isIntersecting; })) { io.disconnect(); ucitaj(); } }, { rootMargin: '300px 0px' });
      io.observe(el);
    });
  }
  /* autor recenzije sa linkom ka profilu i ka recenziji na Google mapama (Googleova pravila prikaza) */
  OF.int.autorRecenzije = function (r, klasa) {
    return OF.h('p', { class: klasa || 'of-recenzija__autor' }, [
      r.autorLink ? OF.h('a', { href: r.autorLink, target: '_blank', rel: 'noopener' }, r.autor) : (r.autor || ''),
      r.vreme ? ' · ' + r.vreme : '', ' · ',
      r.link ? OF.h('a', { href: r.link, target: '_blank', rel: 'noopener' }, 'Google Maps') : 'Google Maps'
    ]);
  };

  /* ---------- pojavljivanje pri skrolu (gasi se uz smanjeno kretanje) ---------- */
  function pojava() {
    var el = OF.$$('[data-of-pojava]'); if (!el.length || OF.manjePokreta() || !('IntersectionObserver' in w)) return;
    // Bez merenja na početku (bez prisilnog preračuna rasporeda): posmatrač javi šta je van ekrana,
    // samo to se sakrije i pojavi kad se doskroluje. Ono što je na ekranu se ne dira.
    var io = new IntersectionObserver(function (u) {
      u.forEach(function (x) {
        var t = x.target;
        if (!t._ofVidjen) { t._ofVidjen = true; if (x.isIntersecting) io.unobserve(t); else t.classList.add('of-ceka'); return; }
        if (x.isIntersecting) { t.classList.remove('of-ceka'); io.unobserve(t); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
    el.forEach(function (x) { io.observe(x); });
  }

  /* ---------- traka „Demo sajt“ ---------- */
  function demoTraka() {
    var t = OF.$('[data-of-demo-traka]'); if (!t) return;
    // pravi režim, a stranice još nisu ponovo izgrađene: traka i napomena se sklanjaju odmah
    if (!OF.demo) { t.remove(); OF.$$('[data-of-demo-traka-futer]').forEach(function (e) { e.remove(); }); d.documentElement.classList.remove('ima-demo-traku'); return; }
    var x = OF.$('button', t); if (x) x.addEventListener('click', function () { t.remove(); d.documentElement.classList.remove('ima-demo-traku'); });
  }

  /* ---------- prelazi između stranica (View Transitions, gde pregledač podržava) ---------- */
  function prelazi() {
    if (OF.manjePokreta()) d.documentElement.classList.add('bez-prelaza');
    // „glatki“ prelaz u pregledačima bez View Transitions: kratko zatamnjenje pre odlaska
    if ('onpagereveal' in w) return;
    d.addEventListener('click', function (e) {
      var a = e.target.closest('a'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank' || a.hasAttribute('download')) return;
      var href = a.getAttribute('href'); if (!href || href.charAt(0) === '#' || /^(tel|mailto|viber|https?):/.test(href) && a.host !== w.location.host) return;
      if (OF.manjePokreta()) return;
      d.documentElement.classList.add('odlazak');
      setTimeout(function () { d.documentElement.classList.remove('odlazak'); }, 900);
    });
    w.addEventListener('pageshow', function () { d.documentElement.classList.remove('odlazak'); });
  }

  /* ---------- tabovi (ARIA) ---------- */
  OF.ui.tabovi = function (koren) {
    var tabovi = OF.$$('[role=tab]', koren);
    tabovi.forEach(function (t, i) {
      t.addEventListener('click', function () { izaberi(i); });
      t.addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabovi.length - 1 : null;
        if (n == null) return; e.preventDefault(); izaberi((n + tabovi.length) % tabovi.length, true);
      });
    });
    function izaberi(n, fokus) {
      tabovi.forEach(function (t, i) { var sel = i === n; t.setAttribute('aria-selected', sel ? 'true' : 'false'); t.tabIndex = sel ? 0 : -1; var p = d.getElementById(t.getAttribute('aria-controls')); if (p) p.hidden = !sel; if (sel && fokus) t.focus(); });
      OF.emit('tab', { koren: koren, n: n });
    }
    return izaberi;
  };
  function svitabovi() { OF.$$('[data-of-tabovi]').forEach(function (k) { OF.ui.tabovi(k); }); }

  /* ---------- filteri (meni, prodavnica, galerija) ----------
     Jednostruki izbor: <button data-of-filter="vrednost" data-of-filter-grupa="kat">
     Uključi/isključi:  <button data-of-filter="veg" data-of-filter-grupa="osobine" data-of-filter-toggle>
     Grupa „bez“ isključuje stavke sa oznakom „sadrzi-<vrednost>“ (alergeni). */
  OF.ui.filteri = function (koren) {
    var stavke = OF.$$('[data-of-filter-stavka]', koren), dugmad = OF.$$('[data-of-filter]', koren), prazno = OF.$('[data-of-filter-prazno]', koren);
    var izbor = {};
    function aktivniPrekidaci() {
      return dugmad.filter(function (b) { return b.hasAttribute('data-of-filter-toggle') && b.getAttribute('aria-pressed') === 'true'; })
        .map(function (b) { return { grupa: b.getAttribute('data-of-filter-grupa') || 'g', v: b.getAttribute('data-of-filter') }; });
    }
    function primeni() {
      var prekidaci = aktivniPrekidaci(), n = 0;
      stavke.forEach(function (s) {
        var oznake = (s.getAttribute('data-oznake') || '').split(/\s+/);
        var ok = Object.keys(izbor).every(function (g) { var v = izbor[g]; return !v || v === 'sve' || oznake.indexOf(v) >= 0; }) &&
          prekidaci.every(function (p) { return p.grupa === 'bez' ? oznake.indexOf('sadrzi-' + p.v) < 0 : oznake.indexOf(p.v) >= 0; });
        s.hidden = !ok; if (ok) n++;
      });
      if (prazno) prazno.hidden = n > 0;
      OF.$$('[data-of-filter-broj]', koren).forEach(function (b) { b.textContent = OF.t('fl.prikazano', { n: n }); });
      OF.emit('filteri', { koren: koren, n: n });
    }
    dugmad.forEach(function (b) {
      var grupa = b.getAttribute('data-of-filter-grupa') || 'g';
      if (!b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        if (b.hasAttribute('data-of-filter-toggle')) b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        else {
          OF.$$('[data-of-filter-grupa="' + grupa + '"]:not([data-of-filter-toggle])', koren).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          izbor[grupa] = b.getAttribute('data-of-filter');
        }
        primeni();
      });
    });
    primeni();
    return primeni;
  };
  function svifilteri() { OF.$$('[data-of-filteri]').forEach(function (k) { OF.ui.filteri(k); }); }

  /* ---------- deljenje / kopiranje ---------- */
  function kopiraj() {
    OF.$$('[data-of-kopiraj]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-of-kopiraj');
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { OF.obavesti(OF.t('kopirano')); }, function () { w.prompt(OF.t('kopirajte'), t); });
      });
    });
  }

  /* ---------- linkovi: na serveru bez „index.html“ (lokalno, file://, mora sa njim) ---------- */
  function linkovi() {
    if (!/^https?:$/.test(w.location.protocol)) return;
    OF.$$('a[href$="index.html"], a[href*="index.html?"], a[href*="index.html#"]').forEach(function (a) {
      var h = a.getAttribute('href'); if (/^[a-z]+:/i.test(h)) return;
      a.setAttribute('href', h.replace(/index\.html(?=$|[?#])/, '') || './');
    });
  }
  /* ---------- rad bez interneta (PWA): service worker samo na https/localhost ---------- */
  function radBezInterneta() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(w.location.protocol) || OF.c.bezSW) return;
    w.addEventListener('load', function () { navigator.serviceWorker.register(OF.koren + 'sw.js', { scope: OF.koren }).catch(function () {}); });
  }

  /* ---------- potvrda prijave na newsletter (double opt-in): stranica sa [data-of-nl-potvrda] ---------- */
  function newsletterPotvrda() {
    var el = OF.$('[data-of-nl-potvrda]'); if (!el) return;
    var k = OF.upit('k'), e = OF.upit('e');
    var prikazi = function (ok) {
      OF.$$('[data-of-nl-ok]', el).forEach(function (x) { x.hidden = !ok; });
      OF.$$('[data-of-nl-greska]', el).forEach(function (x) { x.hidden = ok; });
      OF.$$('[data-of-nl-ceka]', el).forEach(function (x) { x.hidden = true; });
    };
    if (!k || !e) return prikazi(false);
    if (!OF.demo) {
      fetch(OF.int.api('/newsletter/potvrdi?k=' + encodeURIComponent(k) + '&e=' + encodeURIComponent(e)), { credentials: 'omit' })
        .then(function (r) { prikazi(r.ok); }, function () { prikazi(false); });
      return;
    }
    var lista = OF.store.get('newsletter', []), nadjen = false;
    lista.forEach(function (x) { if (x.email === e && x.potvrda === k) { nadjen = true; if (!x.potvrdjeno) { x.potvrdjeno = true; x.potvrdjenoVreme = new Date().toISOString(); } } });
    OF.store.set('newsletter', lista);
    prikazi(nadjen);
    try { w.history.replaceState(null, '', w.location.pathname); } catch (er) {}
  }

  OF.spremno(function () {
    [linkovi, radBezInterneta, meni, status, danas, cene, galerija, preposle, traka, mapa, forme, newsletterPotvrda, instagram, recenzije, pojava, demoTraka, prelazi, svitabovi, svifilteri, kopiraj].forEach(function (fn) {
      try { fn(); } catch (e) { console.error(e); }
    });
    OF.emit('spremno');
  });
})(window, document);
