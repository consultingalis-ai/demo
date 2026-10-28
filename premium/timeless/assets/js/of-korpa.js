/* opsforma Premium · korpa, kuponi, poklon vaučeri, dostava i kasa
   Stavke: proizvod (prodavnica, sa varijantama i opcijama), vaucer (poklon vaučer), ulaznica, jelo.
   DEMO: cela kupovina se odvija u pregledaču (ništa se ne šalje, kartica je simulirana).
   PRAVI: kasa šalje korpu serveru (/api/porudzbina); server sam računa cene, zalihe, popust i dostavu
          iz istih podataka (PODACI.js) i vraća adresu stranice procesora plaćanja ili podatke za uplatu. */
(function (w, d) {
  'use strict';
  var OF = w.OF, K = OF.korpa = {};
  var P = function () { return OF.d.prodaja || {}; };
  var nadji = function (lista, id) { return (lista || []).filter(function (x) { return x.id === id; })[0] || null; };

  /* ---------- stavke ---------- */
  K.stavke = function () { return OF.store.get('korpa', []); };
  K.sacuvaj = function (a) { OF.store.set('korpa', a); OF.emit('korpa', a); osveziBedz(); return a; };
  K.kljuc = function (s) { return s.id + (s.opcije ? '|' + JSON.stringify(s.opcije) : ''); };
  K.dodaj = function (s, poruka) {
    var a = K.stavke(), k = K.kljuc(s), postoji = a.filter(function (x) { return x.kljuc === k; })[0];
    var maks = s.maks != null ? s.maks : 99, n = s.kolicina || 1;
    if (maks <= 0) { OF.obavesti(OF.t('k.nema_na_stanju'), 'greska'); return a; }
    var umanjeno = false;
    if (postoji) {
      var nova = Math.min(maks, postoji.kolicina + n);
      if (nova === postoji.kolicina) { OF.obavesti(OF.t('k.najvise', { n: maks }), 'greska'); return a; }
      umanjeno = nova < postoji.kolicina + n; postoji.kolicina = nova; postoji.maks = s.maks;
    } else { s.kljuc = k; s.kolicina = Math.min(maks, n); umanjeno = s.kolicina < n; s.dodato = new Date().toISOString(); a.push(s); }
    if (umanjeno) { OF.obavesti(OF.t('k.dodato_samo', { n: maks })); poruka = false; }   // traženo više nego što ima: kažemo koliko je dodato
    K.sacuvaj(a);
    OF.emit('korpa:dodato', s);
    if (poruka !== false && !K.imaFioku) OF.obavesti(OF.t('k.dodato', { naziv: OF.tx(s.naziv) }));
    return a;
  };
  K.promeni = function (kljuc, kol) {
    var a = K.stavke().map(function (x) {
      if (x.kljuc !== kljuc) return x;
      var maks = x.maks != null ? x.maks : 99;
      if (kol > maks) OF.obavesti(OF.t('k.najvise', { n: maks }), 'greska');
      x.kolicina = Math.max(0, Math.min(maks, 99, kol)); return x;
    }).filter(function (x) { return x.kolicina > 0; });
    return K.sacuvaj(a);
  };
  K.ukloni = function (kljuc) { var s = K.stavke().filter(function (x) { return x.kljuc === kljuc; })[0]; K.sacuvaj(K.stavke().filter(function (x) { return x.kljuc !== kljuc; })); if (s) OF.emit('korpa:uklonjeno', s); };
  K.isprazni = function () { OF.store.remove('kupon'); OF.store.remove('korpa-vaucer'); OF.store.remove('korpa-poklon'); return K.sacuvaj([]); };
  K.broj = function () { return K.stavke().reduce(function (s, x) { return s + x.kolicina; }, 0); };
  /* cena jedne stavke: sajt može da je računa sam (varijante, doplate) preko K.cenaStavkeHook */
  K.cenaStavke = function (x) { if (K.cenaStavkeHook) { var c = K.cenaStavkeHook(x); if (c != null) return c; } return x.tip === 'vaucer' ? x.cena : OF.cene.za(x.cenaId || x.id, x.cena); };
  K.medjuzbir = function (a) { return (a || K.stavke()).reduce(function (s, x) { return s + K.cenaStavke(x) * x.kolicina; }, 0); };
  K.ima = function (tip, a) { return (a || K.stavke()).some(function (x) { return x.tip === tip; }); };

  /* ---------- poklon: pakovanje i poruka na čestitki ---------- */
  K.poklon = function () { return OF.store.get('korpa-poklon', { pakovanje: false, poruka: '' }); };
  K.postaviPoklon = function (o) { var p = Object.assign(K.poklon(), o); OF.store.set('korpa-poklon', p); OF.emit('korpa', K.stavke()); return p; };

  /* ---------- kuponi ---------- */
  K.kupon = function () { return OF.store.get('kupon', null); };
  K.primeniKupon = function (kod) {
    kod = String(kod || '').trim().toUpperCase();
    var k = (P().kuponi || []).filter(function (x) { return x.kod === kod; })[0];
    if (!k) return { ok: false, poruka: OF.t('k.kupon_nepostoji') };
    if (k.vaziDo && OF.sad().iso > k.vaziDo) return { ok: false, poruka: OF.t('k.kupon_istekao') };
    if (k.aktivan === false) return { ok: false, poruka: OF.t('k.kupon_nepostoji') };
    var osnovica = osnovicaKupona(k);
    if (!osnovica) return { ok: false, poruka: OF.t('k.kupon_ne_vazi') };
    if (k.min && osnovica < k.min) return { ok: false, poruka: OF.t('k.kupon_min', { iznos: OF.din(k.min) }) };
    OF.store.set('kupon', k.kod); OF.emit('korpa', K.stavke());
    return { ok: true, poruka: OF.t('k.kupon_ok', { opis: OF.tx(k.opis) }) };
  };
  K.ukloniKupon = function () { OF.store.remove('kupon'); OF.emit('korpa', K.stavke()); };
  /* kupon važi za tipove stavki (k.za) i, ako je navedeno, samo za kategorije (k.kategorije) */
  function osnovicaKupona(k, a) {
    return (a || K.stavke()).filter(function (x) { return (!k.za || k.za.indexOf(x.tip) >= 0) && (!k.kategorije || k.kategorije.indexOf(x.kategorija) >= 0); })
      .reduce(function (s, x) { return s + K.cenaStavke(x) * x.kolicina; }, 0);
  }

  /* ---------- poklon vaučer kao plaćanje (delimično ili celo) ---------- */
  K.vaucer = function () { return OF.store.get('korpa-vaucer', null); };
  K.proveriVaucer = function (kod) {
    kod = String(kod || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!/^V-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(kod)) return Promise.resolve({ ok: false, poruka: OF.t('k.vaucer_format') });
    if (!OF.demo) {
      return fetch(OF.int.api('/vaucer?kod=' + encodeURIComponent(kod)), { credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (o) {
        return o && o.ok ? { ok: true, kod: kod, iznos: o.iznos, vaziDo: o.vaziDo } : { ok: false, poruka: (o && o.poruka) || OF.t('k.vaucer_nepostoji') };
      }).catch(function () { return { ok: false, poruka: OF.t('pl.greska_veza') }; });
    }
    var demo = (P().demoVauceri || []).filter(function (x) { return x.kod === kod; })[0];
    var v = demo || OF.store.get('kodovi', []).filter(function (x) { return x.kod === kod && x.tip === 'vaucer'; })[0];
    if (!v) return Promise.resolve({ ok: false, poruka: OF.t('k.vaucer_nepostoji') });
    if (v.iskoriscen) return Promise.resolve({ ok: false, poruka: OF.t('k.vaucer_iskoriscen') });
    if (v.vaziDo && v.vaziDo < OF.sad().iso) return Promise.resolve({ ok: false, poruka: OF.t('k.vaucer_istekao') });
    return Promise.resolve({ ok: true, kod: kod, iznos: v.iznos, vaziDo: v.vaziDo || null, demo: !!demo });
  };
  K.primeniVaucer = function (kod) {
    return K.proveriVaucer(kod).then(function (r) { if (r.ok) { OF.store.set('korpa-vaucer', { kod: r.kod, iznos: r.iznos, demo: r.demo }); OF.emit('korpa', K.stavke()); } return r; });
  };
  K.ukloniVaucer = function () { OF.store.remove('korpa-vaucer'); OF.emit('korpa', K.stavke()); };

  /* ---------- obračun ---------- */
  K.dostavaPorudzbine = function (nd, osnovica) {
    if (!nd) return 0;
    var c = nd.cena || 0;
    if (nd.besplatnoOd && osnovica >= nd.besplatnoOd) c = 0;
    return c;
  };
  K.obracun = function (nacinDostave) {
    var a = K.stavke(), medjuzbir = K.medjuzbir(a), popust = 0, kod = K.kupon(), k = null;
    var proizvodi = a.filter(function (x) { return x.tip === 'proizvod'; }), imaRobu = proizvodi.length > 0;
    if (kod) k = (P().kuponi || []).filter(function (x) { return x.kod === kod; })[0] || null;
    var nacini = P().dostava || [];
    var nd = imaRobu ? (nadji(nacini, nacinDostave) || null) : null;
    var robaMedjuzbir = K.medjuzbir(proizvodi);
    if (k) {
      var osn = osnovicaKupona(k, a);
      if (!osn || (k.min && osn < k.min)) k = null;
      else if (k.tip === 'procenat') popust = Math.round(osn * k.vrednost / 100);
      else if (k.tip === 'iznos') popust = Math.min(osn, k.vrednost);
    }
    var prag = (nacini.filter(function (x) { return x.besplatnoOd; })[0] || {}).besplatnoOd || null;
    var osnovicaDostave = robaMedjuzbir - (k && (!k.za || k.za.indexOf('proizvod') >= 0) ? popust : 0);
    var dostava = imaRobu ? K.dostavaPorudzbine(nd, osnovicaDostave) : 0;
    if (k && k.tip === 'dostava') popust = dostava;
    var poklon = K.poklon(), pp = P().poklonPakovanje;
    var pakovanje = imaRobu && poklon.pakovanje && pp ? (pp.cena || 0) : 0;
    var pre = Math.max(0, medjuzbir - popust + dostava + pakovanje);
    // poklon vaučerom se ne plaćaju drugi poklon vaučeri
    var vauceriUKorpi = K.medjuzbir(a.filter(function (x) { return x.tip === 'vaucer'; }));
    var v = K.vaucer(), vaucer = v ? Math.min(v.iznos, Math.max(0, pre - vauceriUKorpi)) : 0;
    var ukupno = pre - vaucer;
    return { stavke: a, medjuzbir: medjuzbir, popust: popust, kupon: k, dostava: dostava, nacin: nd, pakovanje: pakovanje, poklon: poklon,
      vaucer: v ? { kod: v.kod, iznos: v.iznos, iskorisceno: vaucer } : null, ukupno: ukupno, imaRobu: imaRobu,
      pragDostave: prag, doBesplatne: prag && imaRobu ? Math.max(0, prag - osnovicaDostave) : null };
  };

  /* ---------- bedž sa brojem stavki ---------- */
  function osveziBedz() {
    var n = K.broj();
    OF.$$('[data-of-korpa-broj]').forEach(function (el) { el.textContent = String(n); el.hidden = n === 0; });
    OF.$$('[data-of-korpa-link]').forEach(function (el) { el.setAttribute('aria-label', OF.t('k.korpa_broj', { n: n })); });
  }
  OF.spremno(osveziBedz);
  w.addEventListener('storage', function (e) { if (!e.key || e.key.indexOf(':korpa') > 0) { osveziBedz(); OF.emit('korpa', K.stavke()); } });

  /* ---------- vremena preuzimanja (restoran) ---------- */
  K.vremenaPreuzimanja = function () {
    var c = P().preuzimanje || {}, priprema = c.pripremaMin || 30, korak = c.korakMin || 15, rez = [], sada = OF.sad();
    for (var k = 0; k < (c.danaUnapred || 3); k++) {
      var iso = OF.datum.dodaj(sada.iso, k), ivs = (c.radnoVreme ? OF.intervali(iso, c.radnoVreme) : OF.intervali(iso));
      ivs.forEach(function (iv) {
        for (var t = Math.ceil((iv[0] + priprema) / korak) * korak; t <= iv[1] - (c.zadnjeMinPre || 30); t += korak) {
          if (iso === sada.iso && t < sada.min + priprema) continue;
          rez.push({ iso: iso, t: t });
        }
      });
    }
    return rez;
  };

  /* =====================================================================
     PRIKAZ KORPE (stranica korpe i bočna fioka)
     ===================================================================== */
  function slikaStavke(x) {
    if (!x.slika) return null;
    var img = OF.h('img', { class: 'of-korpa__slika', src: OF.koren + x.slika, alt: '', width: '80', height: '80', loading: 'lazy' });
    return x.link ? OF.h('a', { href: OF.link(x.link), tabindex: '-1', 'aria-hidden': 'true', class: 'of-korpa__slika-link' }, img) : img;
  }
  function redObracuna(lista, oznaka, vrednost, klasa) { lista.push(OF.h('dt', klasa ? { class: klasa } : null, oznaka), OF.h('dd', klasa ? { class: klasa } : null, vrednost)); }
  K.tabelaObracuna = function (o, opcije) {
    opcije = opcije || {};
    var r = [];
    redObracuna(r, OF.t('k.medjuzbir'), OF.din(o.medjuzbir));
    if (o.popust) redObracuna(r, OF.t('k.popust') + (o.kupon ? ' (' + o.kupon.kod + ')' : ''), '− ' + OF.din(o.popust));
    if (o.pakovanje) redObracuna(r, OF.t('k.pakovanje'), OF.din(o.pakovanje));
    if (o.imaRobu) redObracuna(r, OF.t('k.dostava'), opcije.dostavaKasnije && !o.nacin ? OF.t('k.dostava_u_kasi') : o.dostava ? OF.din(o.dostava) : OF.t('besplatno'));
    if (o.vaucer && o.vaucer.iskorisceno) redObracuna(r, OF.t('k.vaucer_iskorisceno', { kod: o.vaucer.kod }), '− ' + OF.din(o.vaucer.iskorisceno));
    redObracuna(r, OF.t('ukupno'), OF.din(o.ukupno), 'ukupno');
    return OF.h('dl', { class: 'of-korpa__obracun' }, r);
  };
  K.prikaz = function (koren, opcije) {
    if (!koren) return;
    opcije = opcije || {};
    function crtaj() {
      koren.innerHTML = '';
      var a = K.stavke();
      if (!a.length) {
        koren.appendChild(OF.h('div', { class: 'of-korpa of-korpa--prazna' }, [OF.h('p', { class: 'of-korpa__prazna-naslov' }, OF.t('k.prazna')), opcije.praznaTekst ? OF.h('p', null, opcije.praznaTekst) : null,
          opcije.nazadLink ? OF.h('a', { class: 'of-dugme of-dugme--glavno', href: opcije.nazadLink }, opcije.nazadTekst || OF.t('k.nastavi_kupovinu')) : null]));
        return;
      }
      var o = K.obracun(null);
      if (o.pragDostave && o.imaRobu) {
        var procenat = Math.min(100, Math.round((o.pragDostave - o.doBesplatne) / o.pragDostave * 100));
        koren.appendChild(OF.h('div', { class: 'of-korpa__prag' + (o.doBesplatne ? '' : ' dostignut') }, [
          OF.h('p', null, o.doBesplatne ? OF.t('k.do_besplatne', { iznos: OF.din(o.doBesplatne) }) : OF.t('k.besplatna_dostava')),
          OF.h('span', { class: 'of-korpa__prag-traka', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(procenat), 'aria-label': OF.t('k.prag_oznaka') }, OF.h('span', { style: { width: procenat + '%' } }))]));
      }
      var lista = OF.h('ul', { class: 'of-korpa__lista', role: 'list' });
      a.forEach(function (x) {
        var cena = K.cenaStavke(x), naziv = OF.tx(x.naziv);
        lista.appendChild(OF.h('li', { class: 'of-korpa__stavka' }, [
          slikaStavke(x),
          OF.h('div', { class: 'of-korpa__opis' }, [
            OF.h('p', { class: 'of-korpa__naziv' }, x.link ? OF.h('a', { href: OF.link(x.link) }, naziv) : naziv),
            x.detalj ? OF.h('p', { class: 'of-korpa__detalj' }, OF.tx(x.detalj)) : null,
            x.kolicina > 1 ? OF.h('p', { class: 'of-korpa__cena' }, OF.din(cena) + ' · ' + OF.t('k.komad')) : null,   // cena komada samo kad ih ima više (inače je ista kao zbir)
            x.maks != null && x.maks <= 2 && x.tip === 'proizvod' ? OF.h('p', { class: 'of-korpa__zaliha' }, x.maks === 1 ? OF.t('k.poslednji_komad') : OF.t('k.jos_n', { n: x.maks })) : null
          ]),
          OF.h('div', { class: 'of-korpa__kol' }, [
            OF.h('button', { type: 'button', class: 'of-brojac__dugme', 'aria-label': OF.t('k.manje', { naziv: naziv }), onclick: function () { K.promeni(x.kljuc, x.kolicina - 1); } }, '−'),
            OF.h('span', { class: 'of-korpa__broj', 'aria-live': 'polite', 'aria-label': OF.t('k.kolicina') + ': ' + x.kolicina }, String(x.kolicina)),
            OF.h('button', { type: 'button', class: 'of-brojac__dugme', 'aria-label': OF.t('k.vise', { naziv: naziv }), disabled: x.tip === 'vaucer' || (x.maks != null && x.kolicina >= x.maks) ? true : null, onclick: function () { K.promeni(x.kljuc, x.kolicina + 1); } }, '+')]),
          OF.h('p', { class: 'of-korpa__zbir' }, OF.din(cena * x.kolicina)),
          OF.h('button', { type: 'button', class: 'of-korpa__ukloni', 'aria-label': OF.t('k.ukloni_stavku', { naziv: naziv }), onclick: function () { K.ukloni(x.kljuc); } }, OF.h('span', { 'aria-hidden': 'true', html: '&times;' }))
        ]));
      });
      koren.appendChild(lista);
      if (!opcije.kompaktno) {
        var dodaci = OF.h('div', { class: 'of-korpa__dodaci' });
        if (P().poklonPakovanje && o.imaRobu) dodaci.appendChild(formaPoklon());
        if ((P().kuponi || []).length) dodaci.appendChild(formaKupon());
        if (P().vauceri) dodaci.appendChild(formaVaucer());
        koren.appendChild(dodaci);
      }
      koren.appendChild(K.tabelaObracuna(o, { dostavaKasnije: true }));
      koren.appendChild(OF.h('p', { class: 'of-korpa__pdv' }, OF.t('k.pdv') + (o.imaRobu ? ' ' + OF.t('k.dostava_kasnije') : '')));
      var dugmad = OF.h('div', { class: 'of-korpa__dugmad' });
      if (opcije.kasaLink) dugmad.appendChild(OF.h('a', { class: 'of-dugme of-dugme--glavno of-dugme--siroko', href: opcije.kasaLink }, OF.t('k.na_placanje')));
      if (opcije.korpaLink) dugmad.appendChild(OF.h('a', { class: 'of-dugme of-dugme--sporedno of-dugme--siroko', href: opcije.korpaLink }, OF.t('k.pogledaj_korpu')));
      koren.appendChild(dugmad);
      if (opcije.posle) opcije.posle(koren, o);
    }
    OF.on('korpa', crtaj); crtaj();
  };
  function formaPoklon() {
    var p = K.poklon(), pp = P().poklonPakovanje;
    var cek = OF.h('input', { type: 'checkbox', id: 'k-poklon', checked: !!p.pakovanje });
    var poruka = OF.h('textarea', { id: 'k-poruka', rows: 2, maxlength: String(pp.maksPoruka || 200), placeholder: OF.t('k.poruka_primer') });
    poruka.value = p.poruka || '';
    var deo = OF.h('div', { class: 'of-polje', hidden: !p.pakovanje }, [OF.h('label', { for: 'k-poruka' }, [OF.t('k.poruka_cestitka'), ' ', OF.h('span', { class: 'of-polje__opciono' }, OF.t('opciono'))]), poruka]);
    cek.addEventListener('change', function () { deo.hidden = !cek.checked; K.postaviPoklon({ pakovanje: cek.checked }); });
    poruka.addEventListener('change', function () { K.postaviPoklon({ poruka: poruka.value.trim().slice(0, pp.maksPoruka || 200) }); });
    return OF.h('div', { class: 'of-korpa__poklon' }, [
      OF.h('div', { class: 'of-polje of-polje--cek' }, [cek, OF.h('label', { for: 'k-poklon' }, [OF.h('strong', null, OF.tx(pp.naziv) || OF.t('k.pakovanje')), ' · ' + (pp.cena ? OF.din(pp.cena) : OF.t('besplatno')), pp.opis ? OF.h('span', { class: 'of-polje__pomoc' }, OF.tx(pp.opis)) : null])]),
      deo]);
  }
  function formaKupon() {
    var kod = K.kupon();
    var forma = OF.h('form', { class: 'of-korpa__kupon', novalidate: true }, kod ? [OF.h('p', null, [OF.t('k.kupon_primenjen', { kod: kod }) + ' ', OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () { K.ukloniKupon(); } }, OF.t('ukloni'))])] : [
      OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'k-kupon' }, OF.t('k.kupon')), OF.h('div', { class: 'of-polje__red' }, [OF.h('input', { id: 'k-kupon', name: 'kupon', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' }), OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--sporedno' }, OF.t('k.primeni'))])])]);
    forma.addEventListener('submit', function (e) {
      e.preventDefault(); var r = K.primeniKupon(forma.elements.kupon.value);
      if (!r.ok) OF.forma(forma, { kupon: function () { return r.poruka; } }); else OF.obavesti(r.poruka);
    });
    var omot = OF.h('div', null, [forma]);
    if (OF.demo && P().demoKuponi && !kod) omot.appendChild(OF.h('p', { class: 'of-korpa__demo' }, OF.tx(P().demoKuponi)));
    return omot;
  }
  function formaVaucer() {
    var v = K.vaucer();
    if (v) return OF.h('p', { class: 'of-korpa__vaucer' }, [OF.t('k.vaucer_primenjen', { kod: v.kod, iznos: OF.din(v.iznos) }) + ' ', OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () { K.ukloniVaucer(); } }, OF.t('ukloni'))]);
    var forma = OF.h('form', { class: 'of-korpa__kupon', novalidate: true }, [
      OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'k-vaucer' }, OF.t('k.vaucer')), OF.h('div', { class: 'of-polje__red' }, [OF.h('input', { id: 'k-vaucer', name: 'vaucer', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'V-XXXX-XXXX' }), OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--sporedno' }, OF.t('k.iskoristi'))])])]);
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      K.primeniVaucer(forma.elements.vaucer.value).then(function (r) { if (!r.ok) OF.forma(forma, { vaucer: function () { return r.poruka; } }); else OF.obavesti(OF.t('k.vaucer_ok', { iznos: OF.din(r.iznos) })); });
    });
    var omot = OF.h('div', null, [forma]);
    if (OF.demo && (P().demoVauceri || []).length) omot.appendChild(OF.h('p', { class: 'of-korpa__demo' }, OF.t('k.vaucer_demo', { kod: P().demoVauceri[0].kod })));
    return omot;
  }

  /* =====================================================================
     KASA: podaci → dostava → plaćanje → potvrda (jedna stranica)
     ===================================================================== */
  K.naciniPlacanja = function (nacinDostave, ukupno, opcije) {
    var svi = P().placanje || [{ id: 'kartica' }];
    if (ukupno === 0) return [{ id: 'vaucer', naziv: OF.t('k.placeno_vaucerom'), opis: '' }];
    // poklon na drugu adresu: bez pouzeća (primalac ne plaća poklon)
    return svi.filter(function (m) { return m.aktivan !== false && (!m.samoZaDostavu || m.samoZaDostavu.indexOf(nacinDostave) >= 0) && (!m.max || ukupno <= m.max) && !(opcije && opcije.drugaAdresa && m.id === 'pouzece'); });
  };
  K.kasa = function (koren, opcije) {
    if (!koren) return;
    opcije = opcije || {};
    var a = K.stavke();
    if (!a.length) { K.prikaz(koren, opcije); return; }
    OF.emit('kasa:otvorena', { stavke: a, medjuzbir: K.medjuzbir() });
    var nalog = OF.nalog() || {}, sacuvano = OF.store.get('kasa-podaci', {});
    var s = Object.assign({ ime: '', email: '', telefon: '', adresa: '', mesto: 'Beograd', postanski: '' }, sacuvano, { ime: nalog.ime || sacuvano.ime || '', email: nalog.email || sacuvano.email || '', telefon: nalog.telefon || sacuvano.telefon || '' });
    var nacini = P().dostava || [];
    var imaRobu = K.ima('proizvod');
    s.nacin = imaRobu ? (nadji(nacini, sacuvano.nacin) || nacini[0] || {}).id : null;
    s.placanje = null; s.drugaAdresa = false;
    koren.innerHTML = '';
    var forma = OF.h('form', { class: 'of-forma of-kasa', novalidate: true });
    var polje = function (ime, oznaka, a2, pomoc) {
      var id = 'ks-' + ime, u = a2 && a2.tip === 'textarea' ? OF.h('textarea', Object.assign({ id: id, name: ime, rows: 2 }, (a2 && a2.a) || {})) : OF.h('input', Object.assign({ id: id, name: ime, type: (a2 && a2.tip) || 'text', value: s[ime] || '' }, (a2 && a2.a) || {}));
      return OF.h('div', { class: 'of-polje' + (a2 && a2.klasa ? ' ' + a2.klasa : '') }, [OF.h('label', { for: id }, [oznaka, a2 && a2.opciono ? OF.h('span', { class: 'of-polje__opciono' }, ' ' + OF.t('opciono')) : null]), pomoc ? OF.h('p', { class: 'of-polje__pomoc', id: id + '-p' }, pomoc) : null, u]);
    };
    var korak = function (n, naslov) { return OF.h('legend', null, [OF.h('span', { class: 'of-kasa__br', 'aria-hidden': 'true' }, String(n)), naslov]); };
    var levo = OF.h('div', { class: 'of-kasa__levo' }), desno = OF.h('aside', { class: 'of-kasa__desno', 'aria-label': OF.t('k.pregled_porudzbine') });
    var br = 1;
    /* 1. kontakt */
    var fs1 = OF.h('fieldset', { class: 'of-kasa__grupa' }, [korak(br++, OF.t('k.vasi_podaci')),
      !nalog.email ? OF.h('p', { class: 'of-kasa__nalog' }, [OF.t('k.bez_naloga') + ' ', OF.h('a', { href: OF.link('nalog') }, OF.t('k.prijavi_se'))]) : OF.h('p', { class: 'of-kasa__nalog' }, OF.t('k.prijavljeni_kao', { email: nalog.email })),
      polje('email', OF.t('f.email'), { tip: 'email', a: { autocomplete: 'email', required: true } }, OF.t('k.email_pomoc')),
      polje('ime', OF.t('f.ime'), { a: { autocomplete: 'name', required: true } }),
      polje('telefon', OF.t('f.telefon'), { tip: 'tel', a: { autocomplete: 'tel', inputmode: 'tel', required: true } }, OF.t('k.telefon_pomoc'))]);
    levo.appendChild(fs1);
    /* 2. dostava */
    var adresa = null, drugaAdresa = null;
    if (imaRobu) {
      var fsD = OF.h('fieldset', { class: 'of-kasa__grupa' }, [korak(br++, OF.t('k.dostava'))]);
      var grupa = OF.h('div', { class: 'of-izbor' });
      nacini.forEach(function (n) {
        var id = 'ks-n-' + n.id, r = OF.h('input', { type: 'radio', id: id, name: 'nacin', value: n.id, class: 'of-izbor__ulaz', checked: s.nacin === n.id });
        r.addEventListener('change', function () { s.nacin = n.id; osveziDostavu(); obracun(); crtajPlacanje(); });
        grupa.appendChild(OF.h('div', { class: 'of-izbor__stavka' }, [r, OF.h('label', { for: id, class: 'of-izbor__oznaka' }, [OF.h('span', { class: 'of-izbor__glavno' }, OF.tx(n.naziv)), OF.h('span', { class: 'of-izbor__opis' }, OF.tx(n.opis) + (n.rok ? ' · ' + OF.tx(n.rok) : '')), OF.h('span', { class: 'of-izbor__desno', 'data-of-cena-dostave': n.id }, '')])]));
      });
      fsD.appendChild(grupa);
      adresa = OF.h('div', { class: 'of-kasa__adresa' }, [polje('adresa', OF.t('k.adresa'), { a: { autocomplete: 'street-address' } }),
        OF.h('div', { class: 'of-pl__red' }, [polje('postanski', OF.t('k.postanski'), { a: { autocomplete: 'postal-code', inputmode: 'numeric', maxlength: '5' } }), polje('mesto', OF.t('k.mesto'), { a: { autocomplete: 'address-level2' } })])]);
      fsD.appendChild(adresa);
      // poklon: pošalji na drugu adresu (primalac)
      var cekDruga = OF.h('input', { type: 'checkbox', id: 'ks-druga', name: 'drugaAdresa' });
      drugaAdresa = OF.h('div', { class: 'of-kasa__druga', hidden: true }, [polje('primalacIme', OF.t('k.primalac_ime'), { a: { autocomplete: 'off' } }), polje('primalacTelefon', OF.t('k.primalac_telefon'), { tip: 'tel', a: { autocomplete: 'off', inputmode: 'tel' } }, OF.t('k.primalac_pomoc')),
        polje('primalacAdresa', OF.t('k.adresa'), { a: { autocomplete: 'off' } }), OF.h('div', { class: 'of-pl__red' }, [polje('primalacPostanski', OF.t('k.postanski'), { a: { autocomplete: 'off', inputmode: 'numeric', maxlength: '5' } }), polje('primalacMesto', OF.t('k.mesto'), { a: { autocomplete: 'off' } })])]);
      cekDruga.addEventListener('change', function () { s.drugaAdresa = cekDruga.checked; drugaAdresa.hidden = !cekDruga.checked; crtajPlacanje(); });
      var deoDruga = OF.h('div', { class: 'of-polje of-polje--cek of-kasa__druga-cek' }, [cekDruga, OF.h('label', { for: 'ks-druga' }, OF.t('k.druga_adresa'))]);
      fsD.appendChild(deoDruga); fsD.appendChild(drugaAdresa);
      var preuzimanje = OF.h('p', { class: 'of-kasa__preuzimanje', hidden: true });
      fsD.insertBefore(preuzimanje, adresa);
      var osveziDostavu = function () {
        var nd = nadji(nacini, s.nacin) || {};
        adresa.hidden = !nd.adresa; deoDruga.hidden = !nd.adresa; if (!nd.adresa) { drugaAdresa.hidden = true; cekDruga.checked = false; s.drugaAdresa = false; }
        preuzimanje.hidden = !!nd.adresa || !nd.id; preuzimanje.textContent = nd.adresa ? '' : (OF.tx(nd.napomena) || OF.t('k.preuzimate_na', { adresa: OF.int.adresa() }));
      };
      osveziDostavu();
      levo.appendChild(fsD);
    }
    /* 3. plaćanje */
    var fsP = OF.h('fieldset', { class: 'of-kasa__grupa' }, [korak(br++, OF.t('k.placanje'))]);
    var placanjeLista = OF.h('div', { class: 'of-izbor' }), placanjeOpis = OF.h('div', { class: 'of-kasa__placanje-opis', 'aria-live': 'polite' });
    fsP.appendChild(placanjeLista); fsP.appendChild(placanjeOpis);
    levo.appendChild(fsP);
    function crtajPlacanje() {
      var o = K.obracun(s.nacin), lista = K.naciniPlacanja(s.nacin, o.ukupno, { drugaAdresa: s.drugaAdresa });
      if (!lista.some(function (m) { return m.id === s.placanje; })) s.placanje = (lista[0] || {}).id;
      placanjeLista.innerHTML = '';
      lista.forEach(function (m) {
        var id = 'ks-p-' + m.id, r = OF.h('input', { type: 'radio', id: id, name: 'placanje', value: m.id, class: 'of-izbor__ulaz', checked: s.placanje === m.id });
        r.addEventListener('change', function () { s.placanje = m.id; opisPlacanja(); dugmeTekst(); });
        placanjeLista.appendChild(OF.h('div', { class: 'of-izbor__stavka' }, [r, OF.h('label', { for: id, class: 'of-izbor__oznaka' }, [OF.h('span', { class: 'of-izbor__glavno' }, OF.tx(m.naziv)), m.kratko ? OF.h('span', { class: 'of-izbor__opis' }, OF.tx(m.kratko)) : null,
          m.id === 'kartica' ? OF.h('span', { class: 'of-izbor__desno of-kasa__kartice', 'aria-label': OF.t('pl.logotipi') }, (P().logotipi && P().logotipi.length ? P().logotipi.map(function (x) { return OF.h('img', { class: 'of-pl__slika', src: OF.koren + x.slika, alt: x.alt, height: '22' }); }) : (P().karticeOznake || ['Visa', 'Mastercard', 'Maestro', 'DinaCard']).map(function (x) { return OF.h('span', { class: 'of-pl__logo' }, x); }))) : null])]));
      });
      opisPlacanja(); dugmeTekst();
    }
    function opisPlacanja() { var m = nadji(K.naciniPlacanja(s.nacin, K.obracun(s.nacin).ukupno, { drugaAdresa: s.drugaAdresa }), s.placanje) || {}; placanjeOpis.textContent = OF.tx(m.opis) || ''; }
    /* 4. poklon, napomena, saglasnosti */
    var fsK = OF.h('fieldset', { class: 'of-kasa__grupa of-kasa__grupa--kraj' }, [OF.h('legend', { class: 'of-sr' }, OF.t('k.zavrsetak'))]);
    if (imaRobu && P().poklonPakovanje) {
      var pp = P().poklonPakovanje, po = K.poklon();
      var cekP = OF.h('input', { type: 'checkbox', id: 'ks-poklon', checked: !!po.pakovanje });
      var poruka = OF.h('textarea', { id: 'ks-poruka', name: 'poruka', rows: 2, maxlength: String(pp.maksPoruka || 200), placeholder: OF.t('k.poruka_primer') }); poruka.value = po.poruka || '';
      var deoP = OF.h('div', { class: 'of-polje', hidden: !po.pakovanje }, [OF.h('label', { for: 'ks-poruka' }, [OF.t('k.poruka_cestitka'), ' ', OF.h('span', { class: 'of-polje__opciono' }, OF.t('opciono'))]), poruka]);
      cekP.addEventListener('change', function () { deoP.hidden = !cekP.checked; K.postaviPoklon({ pakovanje: cekP.checked }); obracun(); });
      poruka.addEventListener('change', function () { K.postaviPoklon({ poruka: poruka.value.trim() }); });
      fsK.appendChild(OF.h('div', { class: 'of-polje of-polje--cek' }, [cekP, OF.h('label', { for: 'ks-poklon' }, [OF.tx(pp.naziv) || OF.t('k.pakovanje'), ' · ' + (pp.cena ? OF.din(pp.cena) : OF.t('besplatno'))])]));
      fsK.appendChild(deoP);
    }
    fsK.appendChild(polje('napomena', OF.t('f.napomena'), { tip: 'textarea', opciono: true, a: { maxlength: '500' } }));
    var uslovi = OF.h('div', { class: 'of-polje of-polje--cek' }, [OF.h('input', { type: 'checkbox', id: 'ks-uslovi', name: 'uslovi', required: true }),
      OF.h('label', { for: 'ks-uslovi' }, [OF.t('k.prihvatam') + ' ', OF.h('a', { href: OF.link('uslovi-kupovine'), target: '_blank', rel: 'noopener' }, OF.t('k.uslove')), ', ', OF.h('a', { href: OF.link('povracaj'), target: '_blank', rel: 'noopener' }, OF.t('k.pravo_odustanka')), ' ' + OF.t('i') + ' ', OF.h('a', { href: OF.link('privatnost'), target: '_blank', rel: 'noopener' }, OF.t('k.politiku'))])]);
    fsK.appendChild(uslovi);
    if (P().newsletterUKasi !== false && OF.d.firma) fsK.appendChild(OF.h('div', { class: 'of-polje of-polje--cek' }, [OF.h('input', { type: 'checkbox', id: 'ks-nl', name: 'newsletter' }), OF.h('label', { for: 'ks-nl' }, OF.tx(P().newsletterTekst) || OF.t('k.newsletter'))]));
    // podsetnik za napuštenu korpu: samo ako ga kupac sam uključi (jednom, posle 3 sata, ako ne poruči)
    if (P().podsetnikKorpe !== false && OF.prod && OF.prod.linkKorpe) {
      var cekPod = OF.h('input', { type: 'checkbox', id: 'ks-podseti', name: 'podsetnik' });
      cekPod.addEventListener('change', function () {
        var em = (forma.elements.email.value || '').trim();
        if (cekPod.checked && !OF.provera.email(em)) { cekPod.checked = false; OF.obavesti(OF.t('k.podseti_mejl'), 'greska'); forma.elements.email.focus(); return; }
        OF.int.dogadjaj(cekPod.checked ? 'korpa.podsetnik' : 'korpa.podsetnik.ukloni', { email: em, link: OF.prod.linkKorpe(), stavke: K.stavke().map(function (x) { return { naziv: OF.tx(x.naziv), detalj: x.detalj ? OF.tx(x.detalj) : '', kolicina: x.kolicina, cena: K.cenaStavke(x) }; }), tiho: !cekPod.checked });
      });
      fsK.appendChild(OF.h('div', { class: 'of-polje of-polje--cek' }, [cekPod, OF.h('label', { for: 'ks-podseti' }, OF.t('k.podseti'))]));
    }
    levo.appendChild(fsK);
    var dugme = OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno of-dugme--siroko of-kasa__dugme' }, '');
    levo.appendChild(dugme);
    var sigurno = OF.h('p', { class: 'of-kasa__sigurno' }, OF.t('k.sigurno'));   // samo za karticu
    levo.appendChild(sigurno);
    if (P().konverzija) levo.appendChild(OF.h('p', { class: 'of-kasa__sitno' }, OF.tx(P().konverzija)));
    /* pregled porudžbine (desno, lepljivo na računaru) */
    var pregled = OF.h('div', { class: 'of-kasa__pregled', 'aria-live': 'polite' });
    desno.appendChild(OF.h('h2', { class: 'of-kasa__pregled-naslov' }, OF.t('k.pregled_porudzbine')));
    desno.appendChild(OF.h('ul', { class: 'of-kasa__stavke', role: 'list' }, a.map(function (x) {
      return OF.h('li', null, [x.slika ? OF.h('span', { class: 'of-kasa__slika' }, [OF.h('img', { src: OF.koren + x.slika, alt: '', width: '56', height: '56', loading: 'lazy' }), OF.h('span', { class: 'of-kasa__kol' }, String(x.kolicina))]) : null,
        OF.h('span', { class: 'of-kasa__stavka-opis' }, [OF.h('span', { class: 'of-kasa__stavka-naziv' }, OF.tx(x.naziv)), x.detalj ? OF.h('span', { class: 'of-kasa__stavka-detalj' }, OF.tx(x.detalj)) : null]),
        OF.h('span', { class: 'of-kasa__stavka-cena' }, OF.din(K.cenaStavke(x) * x.kolicina))]);
    })));
    desno.appendChild(pregled);
    desno.appendChild(OF.h('a', { class: 'of-dugme of-dugme--tekst', href: OF.link('korpa') }, OF.t('k.izmeni_korpu')));
    forma.appendChild(levo); forma.appendChild(desno);

    function obracun() {
      var o = K.obracun(s.nacin); pregled.innerHTML = '';
      pregled.appendChild(K.tabelaObracuna(o));
      nacini.forEach(function (n) { var el = OF.$('[data-of-cena-dostave="' + n.id + '"]', forma); if (el) { var c = K.dostavaPorudzbine(n, o.medjuzbir - o.popust); el.textContent = c ? OF.din(c) : OF.t('besplatno'); } });
      dugmeTekst();
    }
    function dugmeTekst() {
      var o = K.obracun(s.nacin), iznos = OF.din(o.ukupno);
      sigurno.hidden = s.placanje !== 'kartica';
      dugme.textContent = s.placanje === 'kartica' ? OF.t('k.plati_karticom', { iznos: iznos }) : s.placanje === 'ips' ? OF.t('k.plati_ips', { iznos: iznos }) : s.placanje === 'vaucer' ? OF.t('k.poruci') : OF.t('k.poruci_iznos', { iznos: iznos });
    }
    var cekajToken = OF.int.turnstile(forma);
    OF.on('korpa', function () { obracun(); crtajPlacanje(); });
    crtajPlacanje(); obracun();
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var pravila = { email: function (v) { return OF.provera.email(v) ? '' : OF.t('g.email'); }, ime: function (v) { return OF.provera.ime(v) ? '' : OF.t('g.ime'); },
        telefon: function (v) { return OF.provera.telefon(v) ? '' : OF.t('g.telefon'); }, uslovi: function (v) { return v ? '' : OF.t('g.uslovi'); } };
      var nd = nadji(nacini, s.nacin);
      var adresaPravila = function (pref) {
        var p = pref ? function (x) { return pref + x.charAt(0).toUpperCase() + x.slice(1); } : function (x) { return x; };
        pravila[p('adresa')] = function (v) { return v.trim().length > 4 ? '' : OF.t('g.adresa'); };
        pravila[p('postanski')] = function (v) { return /^\d{5}$/.test(v.trim()) ? '' : OF.t('g.postanski'); };
        pravila[p('mesto')] = function (v) { return v.trim() ? '' : OF.t('g.obavezno'); };
      };
      if (nd && nd.adresa) adresaPravila('');
      if (s.drugaAdresa) { adresaPravila('primalac'); pravila.primalacIme = function (v) { return OF.provera.ime(v) ? '' : OF.t('g.ime'); }; pravila.primalacTelefon = function (v) { return OF.provera.telefon(v) ? '' : OF.t('g.telefon'); }; }
      if (!OF.forma(forma, pravila)) return;
      ['ime', 'email', 'telefon', 'adresa', 'postanski', 'mesto', 'napomena', 'primalacIme', 'primalacTelefon', 'primalacAdresa', 'primalacPostanski', 'primalacMesto'].forEach(function (k) { if (forma.elements[k]) s[k] = forma.elements[k].value.trim(); });
      s.email = s.email.toLowerCase(); s.newsletter = !!(forma.elements.newsletter && forma.elements.newsletter.checked);
      OF.store.set('kasa-podaci', { ime: s.ime, email: s.email, telefon: s.telefon, adresa: s.adresa, postanski: s.postanski, mesto: s.mesto, nacin: s.nacin });
      var o = K.obracun(s.nacin);
      dugme.disabled = true; dugme.setAttribute('aria-busy', 'true');
      var gotovo = function () { dugme.disabled = false; dugme.removeAttribute('aria-busy'); };
      cekajToken().then(function (token) {
        OF.emit('kasa:placanje', { obracun: o, podaci: s });
        if (!OF.demo) return K.posaljiServeru(o, s, token).then(gotovo, function (gr) { gotovo(); OF.obavesti((gr && gr.poruka) || OF.t('pl.greska_veza'), 'greska'); });
        var id = OF.id(P().prefiks || 'P');
        var placanje = s.placanje === 'kartica' ? OF.placanje.pokreni({ iznos: o.ukupno, opis: OF.t('k.porudzbina_opis', { firma: OF.d.firma.ime, broj: id }), tip: 'porudzbina', porudzbinaId: id, kupac: { ime: s.ime, email: s.email, telefon: s.telefon } })
          : s.placanje === 'ips' ? OF.placanje.ips({ iznos: o.ukupno, opis: OF.t('k.porudzbina_opis', { firma: OF.d.firma.ime, broj: id }), porudzbinaId: id })
          : Promise.resolve({ nacin: s.placanje });
        return placanje.then(function (pl) {
          pl = Object.assign({ nacin: s.placanje }, pl || {});
          var por = K.zavrsi(o, s, pl, id);
          if (opcije.posle) opcije.posle(por); else K.potvrda(koren, por, opcije);
        }, function (gr) { gotovo(); if (gr && gr.poruka) OF.obavesti(gr.poruka, gr.prekinuto ? '' : 'greska'); });
      });
    });
    koren.appendChild(forma);
  };

  /* PRAVI režim: server proverava i računa sve; sajt samo šalje šta je izabrano */
  K.posaljiServeru = function (o, s, token) {
    var telo = {
      stavke: o.stavke.map(function (x) { return { id: x.id, tip: x.tip, kolicina: x.kolicina, opcije: x.opcije || null, varijanta: x.varijanta || null }; }),
      kupac: { ime: s.ime, email: s.email, telefon: s.telefon }, nacin: s.nacin, placanje: s.placanje,
      adresa: s.adresa ? { ulica: s.adresa, postanski: s.postanski, mesto: s.mesto } : null,
      primalac: s.drugaAdresa ? { ime: s.primalacIme, telefon: s.primalacTelefon, ulica: s.primalacAdresa, postanski: s.primalacPostanski, mesto: s.primalacMesto } : null,
      kupon: o.kupon && o.kupon.kod, vaucer: o.vaucer && o.vaucer.kod, poklon: o.poklon, napomena: s.napomena, newsletter: s.newsletter,
      ocekivanIznos: o.ukupno, jezik: OF.jezik, turnstile: token,
      povratak: OF.int.apsolutno(OF.link('placanje-povratak'))
    };
    return fetch(OF.int.api('/porudzbina'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(telo) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.ok) throw { poruka: j && j.poruka }; return j; }); })
      .then(function (j) {
        OF.store.set('placanje-u-toku', { id: j.porudzbina.id, email: s.email, vreme: Date.now() });
        if (j.placanje && j.placanje.url) { w.location.href = j.placanje.url; return new Promise(function () {}); }
        if (j.placanje && j.placanje.forma) {           // NestPay i WSPay: potpisana POST forma ka stranici banke
          var f = OF.h('form', { method: 'POST', action: j.placanje.forma.url, hidden: true });
          Object.keys(j.placanje.forma.polja).forEach(function (k) { f.appendChild(OF.h('input', { type: 'hidden', name: k, value: j.placanje.forma.polja[k] })); });
          d.body.appendChild(f); f.submit(); return new Promise(function () {});
        }
        K.isprazni();
        OF.store.dodaj('porudzbine', j.porudzbina, 300);
        OF.emit('porudzbina', j.porudzbina);            // pouzeće i uplatnica: kupovina za analitiku (uz pristanak)
        setTimeout(function () { w.location.href = OF.link('porudzbina', 'broj=' + encodeURIComponent(j.porudzbina.id) + '&k=' + encodeURIComponent(j.kljuc || '')); }, 250);
        return new Promise(function () {});
      });
  };

  /* posle uspešnog plaćanja (ili porudžbine pouzećem / uplatnicom): porudžbina, kodovi vaučera, račun, zalihe, događaj */
  K.statusPoNacinu = function (nacin) { return { kartica: 'placena', ips: 'placena', vaucer: 'placena', pouzece: 'primljena', uplatnica: 'ceka-uplatu' }[nacin] || 'primljena'; };
  K.napraviRacun = function (por, pl) {
    var stopa = function (x) { return x.tip === 'vaucer' ? 0 : (P().pdvStopa != null ? P().pdvStopa : 20); };
    por.racun = OF.placanje.racun({ stavke: por.stavke.map(function (x) { return { naziv: x.naziv + (x.detalj ? ' (' + x.detalj + ')' : ''), kolicina: x.kolicina, cena: x.cena, pdv: stopa(x) }; })
      .concat(por.pakovanje ? [{ naziv: OF.t('k.pakovanje'), kolicina: 1, cena: por.pakovanje, pdv: stopa({}) }] : [])
      .concat(por.dostava ? [{ naziv: OF.t('k.dostava'), kolicina: 1, cena: por.dostava, pdv: stopa({}) }] : [])
      .concat(por.popust ? [{ naziv: OF.t('k.popust'), kolicina: 1, cena: -por.popust, pdv: stopa({}) }] : [])
      .concat(por.vaucer ? [{ naziv: OF.t('k.vaucer_kratko') + ' ' + por.vaucer.kod, kolicina: 1, cena: -por.vaucer.iznos, pdv: 0 }] : []), ukupno: por.ukupno, placanje: pl });
    return por.racun;
  };
  K.zavrsi = function (o, s, pl, id) {
    var nd = o.nacin;
    var por = { id: id || OF.id(P().prefiks || 'P'), kljuc: OF.token(), vreme: new Date().toISOString(), jezik: OF.jezik, kupac: { ime: s.ime, email: s.email, telefon: s.telefon },
      stavke: o.stavke.map(function (x) { return { id: x.id, tip: x.tip, naziv: OF.tx(x.naziv), detalj: x.detalj ? OF.tx(x.detalj) : null, cena: K.cenaStavke(x), kolicina: x.kolicina, opcije: x.opcije || null, varijanta: x.varijanta || null, slika: x.slika || null, kategorija: x.kategorija || null, link: x.link || null }; }),
      medjuzbir: o.medjuzbir, popust: o.popust, kupon: o.kupon && o.kupon.kod, pakovanje: o.pakovanje, poklonPoruka: o.poklon && o.poklon.pakovanje ? (o.poklon.poruka || '') : null,
      dostava: o.dostava, nacin: nd && nd.id, nacinNaziv: nd ? OF.tx(nd.naziv) : null,
      adresa: nd && nd.adresa && s.adresa ? [s.adresa, s.postanski + ' ' + s.mesto].join(', ') : null,
      primalac: s.drugaAdresa ? { ime: s.primalacIme, telefon: s.primalacTelefon, adresa: [s.primalacAdresa, s.primalacPostanski + ' ' + s.primalacMesto].join(', ') } : null,
      vaucer: o.vaucer && o.vaucer.iskorisceno ? { kod: o.vaucer.kod, iznos: o.vaucer.iskorisceno } : null,
      ukupno: o.ukupno, napomena: s.napomena || '', placanje: pl, newsletter: !!s.newsletter };
    por.status = K.statusPoNacinu(pl.nacin);
    por.istorija = [{ status: 'primljena', vreme: por.vreme }].concat(por.status === 'placena' ? [{ status: 'placena', vreme: por.vreme }] : []);
    // kodovi za kupljene vaučere i ulaznice (aktivni tek kad je plaćeno)
    por.kodovi = [];
    o.stavke.forEach(function (x) {
      if (x.tip !== 'vaucer' && x.tip !== 'ulaznica') return;
      for (var n = 0; n < x.kolicina; n++) {
        var kod = { kod: (x.tip === 'vaucer' ? 'V' : 'U') + '-' + OF.id().slice(0, 4) + '-' + OF.id().slice(0, 4), tip: x.tip, naziv: OF.tx(x.naziv), iznos: K.cenaStavke(x), opcije: x.opcije || {}, porudzbina: por.id, kupac: s.email,
          vaziDo: x.tip === 'vaucer' ? OF.datum.dodaj(OF.sad().iso, (P().vauceri && P().vauceri.vaziDana) || 365) : (x.opcije && x.opcije.datum), iskoriscen: null, aktivan: por.status === 'placena' };
        por.kodovi.push(kod); OF.store.dodaj('kodovi', kod, 500);
      }
    });
    // iskorišćen vaučer kao plaćanje
    if (por.vaucer) {
      OF.store.set('kodovi', OF.store.get('kodovi', []).map(function (k) { if (k.kod === por.vaucer.kod) { k.iznos = Math.max(0, k.iznos - por.vaucer.iznos); if (!k.iznos) k.iskoriscen = por.vreme; } return k; }));
    }
    // račun (demo) tek kad je plaćeno; pouzeće i uplatnica ga dobijaju kad vlasnik u panelu potvrdi uplatu ili isporuku
    if (por.status === 'placena') K.napraviRacun(por, pl);
    OF.store.dodaj('porudzbine', por, 300);
    var nalog = OF.nalog(); if (nalog && nalog.email === s.email && OF.d.lojalnost) { nalog.bodovi = (nalog.bodovi || 0) + Math.floor(por.ukupno / (OF.d.lojalnost.dinaraPoBodu || 100)); OF.store.set('nalog', nalog); }
    if (K.posleZavrsetka) K.posleZavrsetka(por);      // npr. zalihe
    if (s.newsletter && OF.int.newsletter) OF.int.newsletter(s.email).catch(function () {});
    K.isprazni();
    OF.int.dogadjaj('porudzbina.nova', { porudzbina: por, link: OF.int.apsolutno(OF.link('porudzbina', 'broj=' + por.id + '&k=' + por.kljuc)) });
    OF.emit('porudzbina', por);
    return por;
  };

  /* šta sledi posle porudžbine: drugačije za vaučer bez robe i za preuzimanje u radnji (bez kurira) */
  K.uvodPorudzbine = function (por, nacin, prefiks) {
    var samoKodovi = (por.stavke || []).length && por.stavke.every(function (x) { return x.tip === 'vaucer' || x.tip === 'ulaznica'; });
    var nd = (P().dostava || []).filter(function (x) { return x.id === por.nacin; })[0], preuzimanje = nd && nd.adresa === false;
    var placeno = nacin === 'kartica' || nacin === 'ips' || nacin === 'vaucer';
    var k = samoKodovi ? (placeno ? 'vaucer' : nacin === 'uplatnica' ? 'vaucer_uplatnica' : null)
      : preuzimanje ? (placeno ? 'preuzimanje' : nacin === 'uplatnica' ? 'preuzimanje_uplatnica' : null) : null;
    if (k) return OF.t(prefiks + k);
    var osnovno = prefiks === 'k.dalje_' ? { kartica: 'kartica', ips: 'kartica', vaucer: 'kartica', pouzece: 'pouzece', uplatnica: 'uplatnica' } : { kartica: 'placeno', ips: 'placeno', vaucer: 'placeno', pouzece: 'pouzece', uplatnica: 'uplatnica' };
    return osnovno[nacin] ? OF.t(prefiks + osnovno[nacin]) : '';
  };
  K.potvrda = function (koren, por, opcije) {
    koren.innerHTML = '';
    var pl = por.placanje || {}, nacin = pl.nacin || 'kartica';
    var s = OF.h('section', { class: 'of-potvrda', 'aria-labelledby': 'k-potvrda' });
    s.appendChild(OF.h('p', { class: 'of-potvrda__oznaka' }, por.status === 'placena' ? OF.t('k.placeno') : OF.t('k.primljeno')));
    s.appendChild(OF.h('h2', { id: 'k-potvrda', tabindex: '-1' }, OF.t('k.hvala', { ime: por.kupac.ime.split(' ')[0] })));
    s.appendChild(OF.h('p', { class: 'of-potvrda__uvod' }, K.uvodPorudzbine(por, nacin, 'k.dalje_')));
    var redovi = [[OF.t('k.broj_porudzbine'), por.id], [OF.t('ukupno'), OF.din(por.ukupno)], [OF.t('k.placanje'), K.nazivPlacanja(nacin) + (pl.kartica ? ' · ' + pl.kartica : '')]];
    if (pl.odobrenje) redovi.push([OF.t('pl.odobrenje'), pl.odobrenje]);
    if (pl.id) redovi.push([OF.t('pl.transakcija'), pl.id]);
    if (por.nacinNaziv) redovi.push([OF.t('k.dostava'), OF.tx(por.nacinNaziv) + (por.adresa ? ' · ' + (por.primalac ? por.primalac.adresa : por.adresa) : '')]);
    if (por.primalac) redovi.push([OF.t('k.primalac'), por.primalac.ime]);
    s.appendChild(OF.h('dl', { class: 'of-pregled' }, [].concat.apply([], redovi.map(function (r) { return [OF.h('dt', null, r[0]), OF.h('dd', null, r[1])]; }))));
    if (nacin === 'uplatnica' && OF.placanje.uplatnicaPrikaz) s.appendChild(OF.placanje.uplatnicaPrikaz(por));
    s.appendChild(OF.h('p', null, OF.t(por.status === 'placena' ? 'k.racun_mejlom' : 'k.potvrda_mejlom', { email: por.kupac.email })));
    if (por.kodovi.length) {
      var lista = OF.h('ul', { class: 'of-kodovi', role: 'list' });
      por.kodovi.forEach(function (k) {
        lista.appendChild(OF.h('li', { class: 'of-kodovi__stavka' }, [OF.h('span', null, k.naziv), OF.h('code', null, k.kod),
          k.aktivan ? OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { OF.pdf.kod(k); } }, OF.t('k.preuzmi_pdf')) : OF.h('span', { class: 'of-kodovi__napomena' }, OF.t('k.kod_posle_uplate'))]));
      });
      s.appendChild(lista);
    }
    if (opcije && opcije.dodatno) opcije.dodatno(s, por);
    s.appendChild(OF.h('div', { class: 'of-zak__dugmad' }, [
      OF.h('a', { class: 'of-dugme of-dugme--glavno', href: OF.link('porudzbina', 'broj=' + por.id + '&k=' + por.kljuc) }, OF.t('k.prati_porudzbinu')),
      OF.pdf && OF.pdf.predracun && nacin !== 'uplatnica' && !(por.stavke || []).every(function (x) { return x.tip === 'vaucer'; }) ? OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { OF.pdf.predracun(por); } }, OF.t('pr.potvrda_pdf')) : null,   // uplatnica ima svoje dugme za predračun
      OF.h('a', { class: 'of-dugme of-dugme--sporedno', href: OF.link('nalog') }, OF.nalog() ? OF.t('k.u_nalogu') : OF.t('k.otvori_nalog'))]));
    koren.appendChild(s);
    try { w.scrollTo({ top: Math.max(0, koren.getBoundingClientRect().top + w.pageYOffset - 90), behavior: OF.manjePokreta() ? 'auto' : 'smooth' }); } catch (e) {}
    OF.$('#k-potvrda', s).focus({ preventScroll: true });
    OF.emit('kasa:potvrda', por);     // sajt može da promeni naslov stranice (više nije „plaćanje i dostava“)
  };
  K.nazivPlacanja = function (id) { var m = nadji(P().placanje, id); return m ? OF.tx(m.naziv) : id === 'vaucer' ? OF.t('k.placeno_vaucerom') : id; };
})(window, document);
