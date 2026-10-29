/* opsforma Premium · praćenje vozila uživo i digitalni garantni list (detailing)
   Praćenje: faza rada (primljeno → u radu → kontrola → gotovo), korak u radu i fotografije posle svakog koraka.
     Mušterija otvara link iz SMS-a (broj termina + ključ) ili upisuje broj termina i registraciju.
     DEMO: stanje je u terminu u ovom pregledaču (vlasnik ga menja u panelu, i u drugom prozoru se odmah vidi),
           a primer (S-DEMO42 · BG 1234 AB) ima dugme „sledeći korak“. PRAVI: stanje i fotografije su na serveru (D1 + R2).
   Garantni list: broj G-GGGG-NNNN, vozilo, usluga, merenja laka na 12 tačaka, važi do, godišnji pregledi, PDF sa QR kodom
     koji vodi na proveru na sajtu. Proverava ga svako ko ima broj i registraciju (npr. kupac polovnog vozila). */
(function (w, d) {
  'use strict';
  var OF = w.OF, D = OF.datum, P = OF.pracenje = {}, G = OF.garancija = {};
  var cfgP = function () { return OF.d.pracenje || { faze: [], koraci: {} }; };
  var cfgG = function () { return OF.d.garancija || { tacke: [], uslovi: {} }; };
  var norm = function (r) { return String(r || '').toUpperCase().replace(/[^A-Z0-9ČĆŽŠĐ]/g, ''); };
  P.norm = norm;
  var usluga = function (id) { return (OF.d.usluge || []).filter(function (u) { return u.id === id; })[0]; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* =====================================================================
     PRAĆENJE
     ===================================================================== */
  P.koraci = function (uslugaId) {
    var u = usluga(uslugaId) || {}, k = cfgP().koraci || {};
    return (k[u.grupa] || k.pranje || []).map(function (x) { return OF.tx(x); });
  };
  P.slikaDemo = function (i) { var s = cfgP().demoSlike || []; return s.length ? s[i % s.length].src : null; };
  P.src = function (s) { return !s || /^(data:|blob:|https?:|\/)/.test(s) ? s : OF.koren + s; };   // putanje iz podataka su od korena sajta

  /* termin u zapis za prikaz */
  P.izTermina = function (t) {
    var pr = t.pracenje || {}, koraci = P.koraci(t.paket), danas = OF.sad().iso;
    var faza = pr.faza != null ? pr.faza : t.stigao ? 0 : -1;
    var korak = pr.korak || 0;
    return {
      broj: t.id, token: t.token, reg: t.registracija || '', vozilo: t.vozilo || '', paket: t.paketNaziv || '', faza: faza, korak: korak, koraci: koraci,
      procenat: faza === 1 ? Math.round((korak + 0.5) / Math.max(1, koraci.length) * 100) : faza > 1 ? 100 : 0,
      slike: pr.slike || [], predaja: t.gotovo ? D.dug(t.gotovo.datum) + ', ' + D.vreme(t.gotovo.vreme) : '', gotovoVreme: pr.gotovo || null,
      ostavljanje: D.dug(t.datum) + ', ' + D.vreme(t.vreme), zakazano: faza < 0, danas: t.datum === danas, otkazan: t.status === 'otkazan', primer: !!t.primer
    };
  };
  /* primer iz podataka: jedno vozilo usred posla */
  var primerStanje = null;
  P.primer = function () {
    var x = (OF.d.demo || {}).pracenje; if (!x) return null;
    if (!primerStanje) {
      var koraci = P.koraci(x.usluga);
      primerStanje = { broj: x.broj, reg: x.registracija, vozilo: x.vozilo, paket: OF.tx((usluga(x.usluga) || {}).naziv), faza: 1, korak: 3, koraci: koraci, procenat: 62,
        slike: (x.slike || []).map(function (s) { return { vreme: s[0], faza: s[1], src: s[2], opis: OF.tx(s[3]), korak: s[4] }; }), predaja: OF.t('pc.predaja_sutra', { vreme: (x.predaja || '').split(' ').pop() }), primer: true, uzivo: true };
    }
    return primerStanje;
  };
  P.primerSledeci = function () {
    // demo: svaki sledeći korak je oko sat vremena posle prethodnog (ne „sada“), najkasnije do 18:30
    var x = P.primer(), n = x.koraci.length, posl = (x.slike[x.slike.length - 1] || {}).vreme || '09:00';
    var vreme = D.uHHMM(Math.min(D.uMin(posl) + (x.faza === 1 ? 70 : 35), 1110));
    if (x.faza === 1) {
      if (x.korak < n - 1) { x.korak++; x.procenat = Math.round((x.korak + 0.5) / n * 100); x.slike.push({ vreme: vreme, faza: 1, src: P.slikaDemo(x.korak + 2), opis: x.koraci[x.korak], korak: x.korak }); }
      else { x.faza = 2; x.procenat = 100; x.slike.push({ vreme: vreme, faza: 2, src: P.slikaDemo(7), opis: OF.t('pc.kontrola_svetlo') }); }
    } else if (x.faza === 2) {
      x.faza = 3; x.gotovoVreme = vreme;
      OF.int.dogadjaj('pracenje.korak', { termin: { id: x.broj, ime: 'Ana Primer', telefon: '060 000 00 00', email: 'ana@primer.rs', registracija: x.reg, vozilo: x.vozilo, paketNaziv: x.paket, token: 'primer', primer: true }, faza: 3 });
      OF.obavesti(OF.t('pc.sms_poslat'));
    }
    return x;
  };
  P.primerPonovo = function () { primerStanje = null; return P.primer(); };

  /* traženje: primer, termini u ovom pregledaču (demo) ili server (pravi) */
  P.nadji = function (o) {
    var x = (OF.d.demo || {}).pracenje;
    if (o.primer || (x && o.broj && String(o.broj).toUpperCase() === x.broj && norm(o.reg) === norm(x.registracija))) return Promise.resolve(P.primer());
    if (!OF.demo) {
      var q = o.token ? 'id=' + encodeURIComponent(o.broj) + '&t=' + encodeURIComponent(o.token) : 'broj=' + encodeURIComponent(o.broj) + '&reg=' + encodeURIComponent(norm(o.reg));
      return fetch(OF.int.api('/pracenje?' + q), { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (r) { return r && r.vozilo ? r.vozilo : null; }, function () { return null; });
    }
    var t = (OF.zak ? OF.zak.termini() : []).filter(function (t) {
      return t.tip === 'vozilo' && t.id === String(o.broj || '').toUpperCase() && (o.token ? t.token === o.token : norm(t.registracija) === norm(o.reg));
    })[0];
    return Promise.resolve(t ? P.izTermina(t) : null);
  };

  /* prikaz praćenja */
  P.prikaz = function (x) {
    var F = cfgP().faze || [];
    var faze = OF.h('ol', { class: 's-pr__faze', 'aria-label': OF.t('pc.faze') }, F.map(function (f, i) {
      var st = x.faza > i ? 'gotovo' : x.faza === i ? 'trenutno' : '';
      var opis = i === 1 && x.faza === 1 ? x.koraci[x.korak] : OF.tx(f.opis);
      return OF.h('li', { class: st, 'aria-current': x.faza === i ? 'step' : null, style: i === 1 && x.faza === 1 ? { '--p': x.procenat + '%' } : null }, [
        OF.h('strong', null, [OF.tx(f.naziv), i === 1 && x.faza === 1 ? OF.h('span', { class: 's-mono' }, ' · ' + x.procenat + '%') : null]), OF.h('span', null, opis),
        st === 'gotovo' || (st === 'trenutno' && i === 3) ? OF.h('span', { class: 's-mono' }, vremeFaze(x, i)) : null
      ]);
    }));
    var koraci = OF.h('ol', { class: 's-pr__koraci', 'aria-label': OF.t('pc.koraci') }, x.koraci.map(function (k, i) {
      var st = x.faza > 1 || (x.faza === 1 && i < x.korak) ? 'gotovo' : x.faza === 1 && i === x.korak ? 'trenutno' : '';
      var sl = x.slike.filter(function (s) { return s.faza === 1 && (s.korak != null ? s.korak === i : s.opis === k); }).pop();
      return OF.h('li', { class: st }, [OF.h('span', null, k), OF.h('span', { class: 's-mono' }, sl ? sl.vreme : st === 'trenutno' ? OF.t('pc.sada') : '')]);
    }));
    var foto = OF.h('div', { class: 's-pr__foto' });
    var slike = x.slike.filter(function (s) { return s.src; });
    if (slike.length) {
      var glavna = OF.h('figure', { class: 's-pr__foto-glavna' }), palcevi = OF.h('div', { class: 's-pr__palcevi', role: 'group', 'aria-label': OF.t('pc.fotografije') });
      var pokazi = function (i) {
        var s = slike[i]; glavna.innerHTML = '';
        glavna.appendChild(OF.h('img', { src: P.src(s.src), alt: s.opis || '', loading: 'lazy' }));
        glavna.appendChild(OF.h('figcaption', null, [OF.h('span', null, s.vreme), OF.h('span', null, s.opis || '')]));
        OF.$$('button', palcevi).forEach(function (b, k) { b.setAttribute('aria-current', k === i ? 'true' : 'false'); });
      };
      slike.forEach(function (s, i) { palcevi.appendChild(OF.h('button', { type: 'button', 'aria-label': s.vreme + ' · ' + (s.opis || ''), onclick: function () { pokazi(i); } }, [OF.h('img', { src: P.src(s.src), alt: '', loading: 'lazy' }), OF.h('span', null, s.vreme)])); });
      foto.appendChild(glavna); foto.appendChild(palcevi); pokazi(slike.length - 1);
    } else foto.appendChild(OF.h('p', { class: 'of-polje__pomoc' }, x.zakazano ? OF.t('pc.slike_posle_prijema') : OF.t('pc.nema_slika')));
    var glava = OF.h('div', { class: 's-pr__glava' }, [
      OF.h('div', null, [OF.h('p', { class: 's-oznaka' }, x.primer ? OF.t('pc.primer') : OF.t('pc.vozilo') + ' · ' + x.broj), OF.h('p', { class: 's-pr__reg' }, x.reg), OF.h('p', { class: 's-pr__vozilo' }, [x.vozilo, x.paket].filter(Boolean).join(' · '))]),
      OF.h('p', { class: 's-pr__predaja' }, x.zakazano ? [OF.h('span', null, OF.t('pc.ostavljanje')), OF.h('strong', null, x.ostavljanje)] : x.faza === 3 ? [OF.h('span', null, OF.t('pc.gotovo_od')), OF.h('strong', null, x.gotovoVreme || OF.t('pc.danas'))] : [OF.h('span', null, OF.t('pc.predaja')), OF.h('strong', null, x.predaja || '–')])
    ]);
    var dno = OF.h('div', { class: 's-pr__dno' }, [
      x.otkazan ? OF.h('span', null, OF.t('moj.otkazan')) : x.zakazano ? OF.h('span', null, OF.t('pc.zakazano_opis')) : x.faza === 3 ? OF.h('span', null, OF.t('pc.gotovo_opis')) : OF.h('span', { class: 's-pr__uzivo' }, OF.t('pc.uzivo')),
      OF.h('span', null, [OF.t('pc.pitanja') + ' ', OF.h('a', { href: OF.viber() }, 'Viber'), ' · ', OF.h('a', { href: OF.tel() }, OF.d.firma.telefon)])
    ]);
    return OF.h('section', { class: 's-pr', 'aria-label': OF.t('pc.stanje') }, [glava, faze, OF.h('div', { class: 's-pr__telo' }, [x.zakazano ? OF.h('div', { class: 's-pr__koraci' }, OF.h('p', { class: 'of-polje__pomoc' }, OF.t('pc.koraci_posle'))) : koraci, foto]), dno]);
  };
  function vremeFaze(x, i) {
    var s = x.slike.filter(function (y) { return y.faza === i; });
    if (i === 3) return x.gotovoVreme || '';
    return s.length ? s[i === 1 ? s.length - 1 : 0].vreme : '';
  }

  /* stranica praćenja */
  P.stranica = function (koren) {
    if (!koren) return;
    var forma = OF.h('form', { class: 'of-forma s-pr-forma', novalidate: true }, [
      OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'pr-broj' }, OF.t('pc.broj')), OF.h('input', { id: 'pr-broj', name: 'broj', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'S-XXXXXX', value: OF.upit('id') || '' })]),
      OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'pr-reg' }, OF.t('pc.registracija')), OF.h('input', { id: 'pr-reg', name: 'reg', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'BG 123-AB' })]),
      OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno' }, OF.t('pc.prati')),
      OF.h('p', null, [OF.t('pc.forma_pomoc') + ' ', OF.demo ? OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () { forma.elements.broj.value = OF.d.demo.pracenje.broj; forma.elements.reg.value = OF.d.demo.pracenje.registracija; prikazi({ primer: true }); } }, OF.t('pc.pogledaj_primer')) : null])
    ]);
    var mesto = OF.h('div', { 'aria-live': 'polite' });
    koren.innerHTML = ''; koren.appendChild(forma); koren.appendChild(mesto);
    var trenutni = null, tajmer = null;
    function prikazi(o, tiho) {
      trenutni = o;
      return P.nadji(o).then(function (x) {
        mesto.innerHTML = '';
        if (!x) { mesto.appendChild(OF.h('div', { class: 'of-nalog__prazno' }, [OF.h('p', null, OF.t('pc.nije_nadjeno')), OF.demo ? OF.h('p', { class: 'of-polje__pomoc' }, OF.t('pc.demo_pomoc', { broj: OF.d.demo.pracenje.broj, reg: OF.d.demo.pracenje.registracija })) : null])); return; }
        mesto.appendChild(P.prikaz(x));
        if (x.primer && OF.demo) {
          mesto.appendChild(OF.h('div', { class: 'of-zak__dugmad' }, [
            x.faza < 3 ? OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { P.primerSledeci(); prikazi(o, true); } }, OF.t('pc.demo_sledeci')) : OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { P.primerPonovo(); prikazi(o, true); } }, OF.t('pc.demo_ponovo')),
            OF.h('p', { class: 'of-polje__pomoc' }, OF.t('pc.demo_objasnjenje'))]));
        }
        if (!tiho) { var y = mesto.getBoundingClientRect().top + w.scrollY - 90; w.scrollTo({ top: y, behavior: OF.manjePokreta() ? 'auto' : 'smooth' }); }
        clearInterval(tajmer);
        if (!OF.demo && !x.primer && x.faza < 3) tajmer = setInterval(function () { prikazi(o, true); }, 60000);   // pravi režim: osvežava se samo
      });
    }
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!OF.forma(forma, { broj: function (v) { return String(v).trim().length >= 4 ? '' : OF.t('pc.g_broj'); }, reg: function (v) { return norm(v).length >= 5 ? '' : OF.t('pc.g_reg'); } })) return;
      prikazi({ broj: forma.elements.broj.value.trim().toUpperCase(), reg: forma.elements.reg.value });
    });
    /* demo: vlasnik menja fazu u panelu (drugi prozor) → ovde se odmah vidi */
    w.addEventListener('storage', function (e) { if (trenutni && e.key && /:termini$/.test(e.key)) prikazi(trenutni, true); });
    if (OF.upit('primer')) prikazi({ primer: true }, true);
    else if (OF.upit('id') && OF.upit('t')) prikazi({ broj: OF.upit('id'), token: OF.upit('t') }, true);
  };
  P.link = function (t) { return OF.int.apsolutno(OF.link('pracenje', 'id=' + encodeURIComponent(t.id) + '&t=' + encodeURIComponent(t.token || ''))); };

  /* =====================================================================
     GARANTNI LIST
     ===================================================================== */
  G.sve = function () { return OF.store.get('garantni', []); };
  /* pravi režim: garantni listovi iz naloga (posle prijave linkom) */
  OF.on('nalog.server', function (o) { (o.garantni || []).forEach(function (g) { OF.store.set('garantni', [g].concat(G.sve().filter(function (y) { return y.broj !== g.broj; }))); }); });
  /* „1 sloj, 2 sloja, 5 slojeva“ */
  G.slojevi = function (n) { n = +n || 0; var d = n % 10, s = n % 100; return OF.t(d === 1 && s !== 11 ? 'gl.sloj_1' : d >= 2 && d <= 4 && (s < 12 || s > 14) ? 'gl.sloj_2' : 'gl.sloj_5', { n: n }); };
  G.godina = function (g) { var u = usluga(g.usluga) || {}; return u.godina || (u.grupa === 'folija' ? cfgG().ugradnjaGodina || 2 : 1); };
  G.vaziDo = function (g) { return g.vaziDo || D.dodaj(g.datum, Math.round(G.godina(g) * 365.25)); };
  G.dodajMesece = function (iso, n) { return OF.clanstvo ? OF.clanstvo.dodajMesec(iso, n) : D.dodaj(iso, Math.round(n * 30.44)); };
  /* godišnji pregledi (keramika): prozor od 11. do 13. meseca svake godine */
  G.pregledi = function (g) {
    var u = usluga(g.usluga) || {}; if (u.grupa !== 'keramika') return [];
    var C = cfgG(), rez = [], kraj = G.vaziDo(g);
    for (var k = 0; k < (u.godina || 1); k++) {
      var od = G.dodajMesece(g.datum, 12 * k + (C.pregledOd || 11)), dO = G.dodajMesece(g.datum, 12 * k + (C.pregledDo || 13));
      if (od > kraj) break;
      var obavljen = (g.pregledi || []).filter(function (p) { return p.datum >= D.dodaj(od, -31) && p.datum <= dO; })[0];
      rez.push({ od: od, do: dO, obavljen: obavljen ? obavljen.datum : null });
    }
    return rez;
  };
  G.status = function (g) {
    var danas = OF.sad().iso;
    if (G.vaziDo(g) < danas) return 'istekao';
    var propusten = G.pregledi(g).filter(function (p) { return !p.obavljen && p.do < danas; })[0];
    return propusten ? 'pregled-propusten' : 'vazi';
  };
  G.primer = function () {
    var x = (OF.d.demo || {}).garantni; if (!x) return null;
    var g = Object.assign({ primer: true, ime: 'Ana Primer' }, x, { pre: OF.d.demoMerenje || {}, posle: x.posle || {} });
    g.pregledi = (x.pregledi || []).slice();
    return g;
  };
  G.nadji = function (broj, reg) {
    broj = String(broj || '').toUpperCase().trim();
    var p = G.primer();
    if (p && broj === p.broj && norm(reg) === norm(p.registracija)) return Promise.resolve(p);
    if (!OF.demo) return fetch(OF.int.api('/garancija?broj=' + encodeURIComponent(broj) + '&reg=' + encodeURIComponent(norm(reg))), { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (r) { return r && r.garancija ? r.garancija : null; }, function () { return null; });
    return Promise.resolve(G.sve().filter(function (g) { return g.broj === broj && norm(g.registracija) === norm(reg); })[0] || null);
  };
  G.novi = function (t, o) {
    var god = OF.sad().iso.slice(0, 4), sva = G.sve().filter(function (g) { return g.broj.indexOf('G-' + god) === 0; });
    var rb = 142 + sva.length + 1 + Math.floor(OF.seme(t.id) * 20);
    var g = { broj: (cfgG().prefiks || 'G') + '-' + god + '-' + String(rb).padStart(4, '0'), registracija: t.registracija, vozilo: t.vozilo, sasija: o.sasija || '', usluga: t.paket,
      slojeva: (usluga(t.paket) || {}).slojeva || null, datum: OF.sad().iso, ime: t.ime, email: t.email, telefon: t.telefon, termin: t.id, pre: o.pre || {}, posle: o.posle || {}, pregledi: [], jezik: t.jezik || OF.jezik };
    g.vaziDo = G.vaziDo(g);
    var a = G.sve(); a.unshift(g); OF.store.set('garantni', a.slice(0, 300));
    return g;
  };
  G.link = function (g) { return OF.int.apsolutno(OF.link('garancija', 'broj=' + encodeURIComponent(g.broj) + '&reg=' + encodeURIComponent(norm(g.registracija)))); };
  G.pdf = function (g) { return OF.pdf.preuzmi('garantni', g, { ime: OF.sajt + '-' + OF.t('gl.pdf_ime') + '-' + g.broj, naslov: OF.t('gl.naslov') + ' ' + g.broj }); };

  /* prikaz provere */
  G.rezultat = function (g) {
    var st = G.status(g), u = usluga(g.usluga) || {}, T = cfgG().tacke || [];
    var pregledi = G.pregledi(g), sledeci = pregledi.filter(function (p) { return !p.obavljen && p.do >= OF.sad().iso; })[0];
    var red = function (k, v) { return v ? [OF.h('dt', null, k), OF.h('dd', null, v)] : []; };
    var mere = OF.h('ul', { class: 's-gl__mere', role: 'list', 'aria-label': OF.t('gl.merenja') }, T.map(function (t) {
      var v = (g.posle || {})[t.id] || (g.pre || {})[t.id]; if (!v) return null;
      return OF.h('li', { class: v < 80 ? 'nisko' : v > 160 ? 'visoko' : '' }, [OF.h('span', null, OF.tx(t.naziv)), OF.h('b', null, v + ' µm')]);
    }).filter(Boolean));
    return OF.h('div', { class: 's-gl__rez' + (st === 'istekao' ? ' istekao' : '') }, [
      OF.h('p', { class: 's-gl__status' }, OF.t('gl.status_' + st)),
      OF.h('dl', null, [].concat(red(OF.t('gl.broj'), g.broj), red(OF.t('gl.vozilo'), (g.vozilo || '') + ' · ' + g.registracija), red(OF.t('gl.sasija'), g.sasija),
        red(OF.t('gl.usluga'), OF.tx(u.naziv) + (g.slojeva ? ' · ' + G.slojevi(g.slojeva) : '')), red(OF.t('gl.datum'), D.dug(g.datum)), red(OF.t('gl.vazi_do'), D.dug(G.vaziDo(g))),
        sledeci ? red(OF.t('gl.pregled'), D.dug(sledeci.od) + ' – ' + D.dug(sledeci.do)) : [], (g.pregledi || []).length ? red(OF.t('gl.pregledi'), g.pregledi.map(function (p) { return D.dug(p.datum); }).join(', ')) : [])),
      Object.keys(g.posle || {}).length || Object.keys(g.pre || {}).length ? OF.h('p', { class: 'of-polje__pomoc' }, OF.t(Object.keys(g.posle || {}).length ? 'gl.merenja_posle' : 'gl.merenja')) : null, mere,
      OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { G.pdf(g); } }, OF.t('gl.preuzmi_pdf')),
        sledeci ? OF.h('a', { class: 'of-dugme of-dugme--tekst', href: OF.link('zakazivanje', 'paket=pregled-keramike') }, OF.t('gl.zakazi_pregled')) : null]),
      g.primer ? OF.h('p', { class: 'of-polje__pomoc' }, OF.t('gl.primer_napomena')) : null
    ]);
  };
  G.stranica = function (koren) {
    if (!koren) return;
    var forma = OF.h('form', { class: 'of-forma s-gl', novalidate: true }, [
      OF.h('p', { class: 's-gl__naslov' }, OF.t('gl.provera_naslov')),
      OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'gl-broj' }, OF.t('gl.broj')), OF.h('input', { id: 'gl-broj', name: 'broj', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'G-2026-0000', value: OF.upit('broj') || '' })]),
      OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'gl-reg' }, OF.t('gl.registracija')), OF.h('input', { id: 'gl-reg', name: 'reg', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'BG 123-AB', value: OF.upit('reg') || '' })]),
      OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno' }, OF.t('gl.proveri')),
      OF.demo ? OF.h('p', { class: 'of-polje__pomoc' }, [OF.t('gl.demo_pomoc') + ' ', OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () { var p = G.primer(); forma.elements.broj.value = p.broj; forma.elements.reg.value = p.registracija; proveri(); } }, OF.d.demo.garantni.broj + ' · ' + OF.d.demo.garantni.registracija)]) : null
    ]);
    var mesto = OF.h('div', { 'aria-live': 'polite' });
    koren.innerHTML = ''; koren.appendChild(forma); koren.appendChild(mesto);
    function proveri() {
      G.nadji(forma.elements.broj.value, forma.elements.reg.value).then(function (g) {
        mesto.innerHTML = '';
        mesto.appendChild(g ? G.rezultat(g) : OF.h('p', { class: 's-napomena' }, OF.t('gl.nije_nadjen')));
      });
    }
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!OF.forma(forma, { broj: function (v) { return /^[A-Z]-\d{4}-\d{3,5}$/i.test(String(v).trim()) ? '' : OF.t('gl.g_broj'); }, reg: function (v) { return norm(v).length >= 5 ? '' : OF.t('pc.g_reg'); } })) return;
      proveri();
    });
    if (OF.upit('broj') && OF.upit('reg')) proveri();
  };

  /* ---------- PDF: garantni list ---------- */
  OF.pdfDodatno = OF.pdfDodatno || {};
  OF.pdfDodatno.garantni = function (a, g) {
    var b = OF.d.brend || {}, f = OF.d.firma, tamna = b.pdfTamna || '#0A0C0F', akc = b.pdfAkcenat || '#9AB01E', svetla = b.pdfSvetla || '#EEF1F3', linija = b.pdfLinija || '#D5DBE0';
    var u = usluga(g.usluga) || {}, x0 = 16, x1 = a.sirina - 16, T = cfgG().tacke || [];
    a.pravougaonik(0, 0, a.sirina, 42, tamna);
    a.pravougaonik(0, 42, a.sirina, 1.6, '#CFEA35');
    a.font('b', 22, '#FFFFFF'); a.tekst((f.ime || '').toUpperCase(), x0, 20);
    a.font('n', 8.5, '#9AA5B1'); a.tekst(OF.t('gl.pdf_podnaslov'), x0, 28);
    a.font('n', 8.5, '#9AA5B1'); a.tekst(OF.t('gl.naslov').toUpperCase(), x1, 17, { align: 'right' });
    a.font('b', 15, '#FFFFFF'); a.tekst(g.broj, x1, 26, { align: 'right' });
    var st = G.status(g);
    a.font('n', 8.5, st === 'istekao' ? '#FF8A70' : '#CFEA35'); a.tekst(OF.t('gl.status_' + st), x1, 34, { align: 'right' });
    var y = 56;
    var naslov = function (t) { a.font('b', 8, '#59636F'); a.tekst(t.replace(/^[^(]*/, function (m) { return m.toUpperCase(); }), x0, y); a.linija(x0, y + 2, x1 - 58, y + 2, linija); y += 8; };
    var red = function (k, v, sirina) { if (!v) return; a.font('n', 9, '#6A7480'); a.tekst(k, x0, y); a.font('b', 10.5, tamna); y = a.prelom(v, x0 + 42, y, (sirina || (x1 - 58 - x0 - 42))) + 1.6; };
    naslov(OF.t('gl.vozilo'));
    red(OF.t('gl.vozilo'), g.vozilo); red(OF.t('gl.registracija'), g.registracija); red(OF.t('gl.sasija'), g.sasija); red(OF.t('gl.vlasnik'), g.ime);
    y += 4; naslov(OF.t('gl.usluga'));
    red(OF.t('gl.usluga'), OF.tx(u.naziv)); red(OF.t('gl.slojevi'), g.slojeva ? String(g.slojeva) : ''); red(OF.t('gl.datum'), D.dug(g.datum)); red(OF.t('gl.vazi_do'), D.dug(G.vaziDo(g)));
    var pr = G.pregledi(g);
    if (pr.length) red(OF.t('gl.pregledi_prozori'), pr.map(function (p) { return D.sGodinom(p.od) + ' – ' + D.sGodinom(p.do) + (p.obavljen ? ' (' + OF.t('gl.obavljen') + ')' : ''); }).join('\n'));
    // QR za proveru (desno gore)
    a.qr(G.link(g), x1 - 46, 52, 46);
    a.font('n', 7.5, '#6A7480'); a.prelom(OF.t('gl.pdf_qr'), x1 - 46, 104, 46);
    // merenja
    y = Math.max(y + 4, 116); naslov(OF.t('gl.merenja_naslov'));
    var imaPre = Object.keys(g.pre || {}).length, imaPosle = Object.keys(g.posle || {}).length;
    var kolX = [x0, x0 + 46, x0 + 66, x0 + 86], kolX2 = kolX.map(function (v) { return v + (x1 - x0) / 2; });
    var zaglavlje = function (k) { a.font('b', 7.5, '#6A7480'); a.tekst(OF.t('gl.tacka'), k[0], y); if (imaPre) a.tekst(OF.t('gl.pre'), k[1], y); if (imaPosle) a.tekst(OF.t('gl.posle'), k[2], y); };
    zaglavlje(kolX); zaglavlje(kolX2); y += 5;
    var pola = Math.ceil(T.length / 2);
    for (var i = 0; i < pola; i++) {
      [[T[i], kolX], [T[i + pola], kolX2]].forEach(function (par) {
        var t = par[0], k = par[1]; if (!t) return;
        if (i % 2 === 0) a.pravougaonik(k[0] - 1.5, y - 3.6, (x1 - x0) / 2 - 3, 5.4, svetla);
        a.font('n', 8.5, tamna); a.tekst(OF.tx(t.naziv), k[0], y);
        a.font('b', 8.5, tamna); if (imaPre) a.tekst(g.pre[t.id] ? g.pre[t.id] + ' µm' : '–', k[1], y); if (imaPosle) a.tekst(g.posle[t.id] ? g.posle[t.id] + ' µm' : '–', k[2], y);
      });
      y += 5.6;
    }
    a.font('n', 7.5, '#6A7480'); y = a.prelom(OF.t('gl.pdf_merenja_napomena'), x0, y + 2, x1 - x0);
    // uslovi
    y += 4; naslov(OF.t('gl.uslovi'));
    a.font('n', 9, '#2C333C');
    ((cfgG().uslovi || {})[OF.jezik] || (cfgG().uslovi || {}).sr || []).forEach(function (s, n) { a.font('b', 9, akc); a.tekst(pad(n + 1), x0, y); a.font('n', 9, '#2C333C'); y = a.prelom(s, x0 + 8, y, x1 - x0 - 8, 1.35) + 1.2; });
    // potpis
    y = Math.max(y + 8, a.visina - 40);
    a.linija(x0, y, x0 + 60, y, '#9AA5B1'); a.font('n', 8, '#6A7480'); a.tekst(OF.t('gl.izdao') + ': ' + (f.direktor || f.ime), x0, y + 5);
    a.linija(x1 - 60, y, x1, y, '#9AA5B1'); a.tekst(OF.t('gl.datum_izdavanja') + ': ' + D.sGodinom(g.datum), x1 - 60, y + 5);
    a.font('n', 7.5, '#6A7480'); a.tekst([f.punoIme || f.ime, OF.int.adresa(), 'PIB ' + (f.pib || ''), f.telefon, f.email].filter(Boolean).join(' · '), a.sirina / 2, a.visina - 12, { align: 'center' });
  };

  /* ---------- nalog: vozila i garantni listovi ---------- */
  function deoNaloga(n) {
    var termini = (OF.zak ? OF.zak.termini() : []).filter(function (t) { return t.email === n.email && t.tip === 'vozilo'; });
    var garantni = G.sve().filter(function (g) { return g.email === n.email; });
    var vozila = {};
    termini.forEach(function (t) { if (t.registracija) vozila[norm(t.registracija)] = vozila[norm(t.registracija)] || { reg: t.registracija, vozilo: t.vozilo, termini: [] }; if (t.registracija) vozila[norm(t.registracija)].termini.push(t); });
    garantni.forEach(function (g) { var k = norm(g.registracija); vozila[k] = vozila[k] || { reg: g.registracija, vozilo: g.vozilo, termini: [] }; });
    var k = OF.h('div');
    var danas = OF.sad().iso;
    var uRadu = termini.filter(function (t) { return t.status !== 'otkazan' && (t.datum === danas || (t.datum < danas && t.pracenje && t.pracenje.faza < 3)); })[0];
    if (uRadu) k.appendChild(OF.h('div', { class: 's-cl__rez' }, [OF.h('p', null, [OF.h('span', null, OF.t('pc.vozilo_danas', { reg: uRadu.registracija })), OF.h('a', { class: 'of-dugme of-dugme--glavno', href: P.link(uRadu) }, OF.t('pc.prati'))])]));
    if (!Object.keys(vozila).length) return OF.h('div', { class: 'of-nalog__prazno' }, [OF.h('p', null, OF.t('pc.nema_vozila')), OF.h('a', { class: 'of-dugme of-dugme--glavno', href: OF.link('zakazivanje') }, OF.t('n.zakazi'))]);
    k.appendChild(OF.h('h3', { class: 'of-nalog__podnaslov' }, OF.t('gl.garantni_listovi')));
    if (!garantni.length) k.appendChild(OF.h('p', { class: 'of-polje__pomoc' }, OF.t('gl.nema')));
    garantni.forEach(function (g) { k.appendChild(G.rezultat(g)); });
    k.appendChild(OF.h('h3', { class: 'of-nalog__podnaslov' }, OF.t('pc.vasa_vozila')));
    k.appendChild(OF.h('ul', { class: 'of-nalog__lista', role: 'list' }, Object.keys(vozila).map(function (key) {
      var v = vozila[key];
      return OF.h('li', { class: 'of-nalog__stavka' }, [OF.h('div', { class: 'of-nalog__datum' }, [OF.h('strong', { class: 's-mono' }, v.reg)]),
        OF.h('div', { class: 'of-nalog__opis' }, [OF.h('p', { class: 'of-nalog__naslov' }, v.vozilo || ''), OF.h('p', null, OF.t('pc.poseta', { n: v.termini.length }))]),
        OF.h('a', { class: 'of-dugme of-dugme--tekst', href: OF.link('zakazivanje') }, OF.t('n.zakazi'))]);
    })));
    return k;
  }
  if (OF.nalogUi) (OF.nalogUi.dodatniDelovi = OF.nalogUi.dodatniDelovi || []).push({ id: 'vozila', naziv: function () { return OF.t('pc.naslov_naloga'); }, crtaj: deoNaloga });
  OF.on('nalog', function (n) {
    if (!OF.demo || !n || !n.primer || !OF.d.demo || !OF.d.demo.istorija) return;
    if (OF.store.get('primer-garantni-' + n.email)) return;
    OF.store.set('primer-garantni-' + n.email, true);
    var p = G.primer(); if (!p) return;
    var g = Object.assign({}, p, { email: n.email, ime: n.ime || p.ime, datum: D.dodaj(OF.sad().iso, -229) });
    g.vaziDo = D.dodaj(g.datum, Math.round(G.godina(g) * 365.25));
    var a = G.sve().filter(function (x) { return !(x.broj === g.broj && x.email === n.email); }); a.unshift(g); OF.store.set('garantni', a);
    var voz = (OF.d.demo.istorija.vozila || [])[0];
    if (voz && OF.zak) OF.zak.sacuvaj({ tip: 'vozilo', ime: n.ime || 'Ana Primer', telefon: '060 000 00 00', email: n.email, datum: g.datum, vreme: '08:30', paket: p.usluga, paketNaziv: OF.tx((usluga(p.usluga) || {}).naziv), vozilo: voz.vozilo, registracija: voz.registracija, status: 'obavljen', primer: true, stigao: g.datum + 'T08:30:00Z', pracenje: { faza: 3, korak: 0, slike: [] } });
  });
  OF.on('nalog.obrisi', function (email) { OF.store.set('garantni', G.sve().filter(function (g) { return g.email !== email; })); });

  /* ---------- recepti poruka ---------- */
  var R = OF.int && OF.int.recepti;
  if (R) {
    var F = function () { return OF.d.firma; };
    var kol = function (k) { return OF.jezik === 'sr' ? k.sr : k.en; };
    R['pracenje.korak'] = function (p) {
      var t = p.termin, f = F(), faza = ((cfgP().faze || [])[p.faza] || {}), link = P.link(t);
      var izlaz = { sazetak: OF.t('r.sazetak_pracenje', { reg: t.registracija, faza: OF.tx(faza.naziv) }),
        tabela: { list: OF.t('r.list_pracenje'), kolone: kol({ sr: ['Vreme', 'Broj', 'Registracija', 'Faza', 'Korak'], en: ['Time', 'ID', 'Plate', 'Stage', 'Step'] }), red: [D.uHHMM(OF.sad().min), t.id, t.registracija, OF.tx(faza.naziv), p.korak || ''] } };
      if (p.faza === 0) {
        izlaz.sms = [{ tekst: OF.t('r.sms_pracenje_primljeno', { firma: f.ime, reg: t.registracija, link: link }), kada: OF.t('r.odmah') }];
        izlaz.mejlKupcu = { za: t.email, naslov: OF.t('r.mejl_primljeno_naslov', { firma: f.ime, reg: t.registracija }), html: OF.int.mejl({ naslov: OF.t('r.mejl_primljeno_h1'), uvod: OF.t('r.mejl_primljeno_uvod', { reg: t.registracija }), redovi: [[OF.t('zak.broj'), t.id], [OF.t('zak.paket'), t.paketNaziv || ''], [OF.t('zak.gotovo'), t.gotovo ? D.dug(t.gotovo.datum) + ', ' + D.vreme(t.gotovo.vreme) : '']], dugmad: [{ href: link, tekst: OF.t('pc.prati') }] }) };
      }
      if (p.faza === 3) {
        izlaz.sms = [{ tekst: OF.t('r.sms_pracenje_gotovo', { firma: f.ime, reg: t.registracija, do: (function () { var st = OF.status(); return st.otvoreno ? OF.t('r.do_h', { h: Math.floor(st.do / 60) }) : OF.t('r.od_sutra'); })() }), kada: OF.t('r.odmah') }];
        izlaz.mejlKupcu = { za: t.email, naslov: OF.t('r.mejl_gotovo_naslov', { firma: f.ime, reg: t.registracija }), html: OF.int.mejl({ naslov: OF.t('r.mejl_gotovo_h1'), uvod: OF.t('r.mejl_gotovo_uvod', { reg: t.registracija }), dugmad: [{ href: link, tekst: OF.t('pc.fotografije') }] }) };
        izlaz.viber = { tekst: OF.t('r.viber_gotovo') + '\n' + t.registracija + ' · ' + (t.paketNaziv || '') + '\n' + (t.ime || '') + ' · ' + (t.telefon || '') };
      }
      return izlaz;
    };
    R['garancija.izdata'] = function (p) {
      var g = p.garancija, f = F(), u = usluga(g.usluga) || {};
      return { sazetak: OF.t('r.sazetak_garancija', { broj: g.broj, reg: g.registracija }),
        mejlKupcu: g.email ? { za: g.email, naslov: OF.t('r.mejl_garancija_naslov', { firma: f.ime, broj: g.broj }), prilozi: [OF.sajt + '-' + OF.t('gl.pdf_ime') + '-' + g.broj + '.pdf'],
          html: OF.int.mejl({ naslov: OF.t('r.mejl_garancija_h1'), uvod: OF.t('r.mejl_garancija_uvod', { usluga: OF.tx(u.naziv), do: D.dug(G.vaziDo(g)) }), redovi: [[OF.t('gl.broj'), g.broj], [OF.t('gl.vozilo'), (g.vozilo || '') + ' · ' + g.registracija], [OF.t('gl.vazi_do'), D.dug(G.vaziDo(g))]],
            dugmad: [{ href: G.link(g), tekst: OF.t('gl.proveri') }], napomena: OF.t('r.mejl_garancija_napomena') }) } : null,
        tabela: { list: OF.t('r.list_garancije'), kolone: kol({ sr: ['Broj', 'Datum', 'Registracija', 'Vozilo', 'Usluga', 'Važi do', 'Mejl'], en: ['No.', 'Date', 'Plate', 'Car', 'Service', 'Valid until', 'Email'] }), red: [g.broj, g.datum, g.registracija, g.vozilo || '', OF.tx(u.naziv), G.vaziDo(g), g.email || ''] },
        ostalo: [{ naziv: 'PDF', tekst: OF.t('r.garancija_pdf', { broj: g.broj }) }] };
    };
    R['garancija.podsetnik'] = function (p) {
      var g = p.garancija, f = F();
      return { sazetak: OF.t('r.sazetak_podsetnik_pregled', { reg: g.registracija }),
        mejlKupcu: g.email ? { za: g.email, naslov: OF.t('r.mejl_pregled_naslov', { firma: f.ime }), html: OF.int.mejl({ naslov: OF.t('r.mejl_pregled_h1'), uvod: OF.t('r.mejl_pregled_uvod', { od: D.datum(p.od), do: D.datum(p.do), reg: g.registracija }), dugmad: [{ href: OF.int.apsolutno(OF.link('zakazivanje', 'paket=pregled-keramike')), tekst: OF.t('gl.zakazi_pregled') }] }) } : null,
        sms: g.telefon ? [{ tekst: OF.t('r.sms_pregled', { firma: f.ime, reg: g.registracija, od: D.kratko(p.od), do: D.kratko(p.do) }), kada: OF.t('r.mesec_pre') }] : null };
    };
  }

  OF.spremno(function () {
    P.stranica(OF.$('[data-of-pracenje]'));
    G.stranica(OF.$('[data-of-garancija]'));
  });
})(window, document);
