/* opsforma Premium · članstvo sa automatskom mesečnom naplatom (npr. pranja mesečno u detailing studiju)
   DEMO: prva članarina ide kroz demo ekran plaćanja; „kartica“ je samo oznaka (•••• 4242), ništa se ne čuva ni ne šalje.
   PRAVI: sajt traži od servera (/api/clanstvo/start) stranicu procesora plaćanja. Procesor čuva karticu i vraća
         samo oznaku (token) za buduće naplate; server jednom dnevno naplaćuje članove kojima je dan naplate (cron)
         i šalje račun. Podaci kartice nikad ne prolaze kroz naš kod.
   Podaci: PODACI.clanstvo (planovi, cene za dve veličine vozila, pravila pauze i otkazivanja). */
(function (w, d) {
  'use strict';
  var OF = w.OF, D = OF.datum, C = OF.clanstvo = {};
  var cfg = function () { return OF.d.clanstvo || { planovi: [] }; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ---------- podaci ---------- */
  C.planovi = function () { return cfg().planovi || []; };
  C.plan = function (id) { return C.planovi().filter(function (p) { return p.id === id; })[0]; };
  C.cena = function (planId, vel) { var p = C.plan(planId); return p ? OF.cene.za('clanstvo-' + planId + '-' + (vel || 0), p.cene[vel || 0]) : 0; };
  C.sva = function () { return OF.store.get('clanstva', []); };
  C.nadji = function (id) { return C.sva().filter(function (c) { return c.id === id; })[0]; };
  C.za = function (email) {
    if (!email) return null;
    return C.sva().filter(function (c) { return c.email === email && c.status !== 'zavrseno'; }).sort(function (a, b) { return a.od < b.od ? 1 : -1; })[0] || null;
  };
  C.aktivno = function (c) { return !!c && (c.status === 'aktivno' || (c.status === 'otkazano' && c.vaziDo >= OF.sad().iso)); };
  C.mojeAktivno = function () { var n = OF.nalog(); var c = n && C.za(n.email); return C.aktivno(c) ? c : null; };
  C.mesec = function (iso) { return (iso || OF.sad().iso).slice(0, 7); };
  C.iskorisceno = function (c) { return ((c && c.pranja) || {})[C.mesec()] || 0; };
  C.preostalo = function (c) { var p = c && C.plan(c.plan); return p ? Math.max(0, p.pranja - C.iskorisceno(c)) : 0; };
  /* isti dan u mesecu (31. → poslednji dan kraćeg meseca) */
  C.dodajMesec = function (iso, n) {
    var y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1 + (n == null ? 1 : n), dan = +iso.slice(8, 10);
    var y2 = y + Math.floor(m / 12), m2 = ((m % 12) + 12) % 12, max = new Date(Date.UTC(y2, m2 + 1, 0)).getUTCDate();
    return y2 + '-' + pad(m2 + 1) + '-' + pad(Math.min(dan, max));
  };
  C.pauzaOveGodine = function (c) { return ((c.pauze || {})[OF.sad().iso.slice(0, 4)] || 0); };
  C.sacuvaj = function (c) { var a = C.sva().filter(function (x) { return x.id !== c.id; }); a.unshift(c); OF.store.set('clanstva', a.slice(0, 200)); OF.emit('clanstvo', c); return c; };
  C.izmeni = function (id, fn) { var c = OF.store.izmeni('clanstva', id, fn); OF.emit('clanstvo', c); return c; };
  C.normReg = function (r) { return String(r || '').toUpperCase().replace(/[^A-Z0-9ČĆŽŠĐ]/g, ''); };
  C.nazivStatusa = function (s) { return OF.t('cl.status_' + s); };

  /* pranje iz članstva: upiše se kad se zakaže (u demo režimu), server broji iz termina u pravom */
  C.upisiPranje = function (c) { return C.izmeni(c.id, function (x) { x.pranja = x.pranja || {}; x.pranja[C.mesec()] = (x.pranja[C.mesec()] || 0) + 1; return x; }); };
  C.vratiPranje = function (c) { return C.izmeni(c.id, function (x) { x.pranja = x.pranja || {}; x.pranja[C.mesec()] = Math.max(0, (x.pranja[C.mesec()] || 0) - 1); return x; }); };

  /* ---------- prijava: pravi režim ide preko servera ---------- */
  C.naServeru = function (x) {
    OF.store.set('placanje-u-toku', { tip: 'clanarina', plan: x.plan, vreme: Date.now() });
    return fetch(OF.int.api('/clanstvo/start'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ clanstvo: x, jezik: OF.jezik, povratak: OF.int.apsolutno(OF.link('placanje-povratak')) })
    }).then(function (r) { return r.json().then(function (o) { return { ok: r.ok, o: o }; }); }).then(function (r) {
      if (!r.ok || !(r.o.url || r.o.forma)) throw { poruka: (r.o && r.o.poruka) || OF.t('pl.greska_veza') };
      OF.store.set('placanje-u-toku', { tip: 'clanarina', id: null, clanstvo: r.o.clanstvo && r.o.clanstvo.id, email: x.email, vreme: Date.now() });
      OF.placanje.idiNaBanku(r.o); return new Promise(function () {});
    }, function (e) { throw e && e.poruka ? e : { poruka: OF.t('pl.greska_veza') }; });
  };

  C.novo = function (x, pl) {
    var danas = OF.sad().iso, iznos = C.cena(x.plan, x.velicina);
    var c = { id: OF.id(cfg().prefiks || 'C'), token: OF.token(), email: x.email, ime: x.ime, telefon: x.telefon, vozilo: x.vozilo, registracija: x.registracija,
      plan: x.plan, velicina: x.velicina, status: 'aktivno', od: danas, sledecaNaplata: C.dodajMesec(danas, 1), iznos: iznos, kartica: pl ? pl.kartica : '',
      naplate: [{ datum: danas, iznos: iznos, ok: true, id: pl ? pl.id : OF.id('TX'), kartica: pl ? pl.kartica : '' }], pranja: {}, pauze: {}, kreirano: new Date().toISOString(), jezik: OF.jezik };
    return C.sacuvaj(c);
  };

  /* ---------- obrazac za učlanjenje (stranica članstva) ---------- */
  C.forma = function (koren) {
    if (!koren) return;
    var n = OF.nalog() || {}, postoji = n.email && C.za(n.email);
    koren.innerHTML = '';
    if (C.aktivno(postoji)) {
      koren.appendChild(OF.h('div', { class: 's-cl' }, [OF.h('p', { class: 's-oznaka' }, OF.t('cl.vec_ste_clan')), C.kartica(postoji, { kratko: true }),
        OF.h('a', { class: 'of-dugme of-dugme--glavno', href: OF.link('nalog') + '#clanstvo' }, OF.t('cl.upravljaj'))]));
      return;
    }
    var planovi = C.planovi(), izbor = { plan: OF.upit('plan') || (planovi.filter(function (p) { return p.istaknuto; })[0] || planovi[0] || {}).id, velicina: +(OF.store.get('clanstvo-velicina', 0)) || 0 };
    if (!C.plan(izbor.plan)) izbor.plan = planovi[0] && planovi[0].id;
    var forma = OF.h('form', { class: 'of-forma s-cl', novalidate: true });
    var planGrupa = OF.h('fieldset', { class: 's-osa s-cl__plan' }, [OF.h('legend', null, OF.t('cl.plan'))]);
    var velGrupa = OF.h('fieldset', { class: 's-osa' }, [OF.h('legend', null, OF.t('cl.velicina'))]);
    function crtajPlanove() {
      OF.$$('.of-opcija', planGrupa).forEach(function (x) { x.remove(); });
      planovi.forEach(function (p) {
        var id = 'clp-' + p.id;
        var r = OF.h('input', { type: 'radio', name: 'plan', id: id, value: p.id, checked: p.id === izbor.plan });
        r.addEventListener('change', function () { izbor.plan = p.id; sazetak(); OF.emit('clanstvo.izbor', izbor); });
        planGrupa.appendChild(OF.h('span', { class: 'of-opcija' }, [r, OF.h('label', { for: id }, [OF.h('span', null, OF.tx(p.naziv) + ' · ' + OF.t('cl.pranja_mesecno', { n: p.pranja })), OF.h('span', null, OF.din(C.cena(p.id, izbor.velicina)))])]));
      });
    }
    var velicine = (OF.d.clanstvo.velicine || [{ sr: 'Malo i srednje', en: 'Small and medium' }, { sr: 'SUV i kombi', en: 'SUV and van' }]);
    var velOpcije = OF.h('div', { class: 's-osa__opcije' }, velicine.map(function (v, i) {
      var id = 'clv-' + i, r = OF.h('input', { type: 'radio', name: 'velicina', id: id, value: String(i), checked: i === izbor.velicina });
      r.addEventListener('change', function () { izbor.velicina = i; OF.store.set('clanstvo-velicina', i); crtajPlanove(); sazetak(); OF.emit('clanstvo.izbor', izbor); });
      return OF.h('span', { class: 'of-opcija' }, [r, OF.h('label', { for: id }, OF.tx(v))]);
    }));
    velGrupa.appendChild(velOpcije);
    crtajPlanove();
    var polje = function (ime, oznaka, a, pomoc) {
      return OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'cl-' + ime }, oznaka), pomoc ? OF.h('p', { class: 'of-polje__pomoc' }, pomoc) : null, OF.h('input', Object.assign({ id: 'cl-' + ime, name: ime, value: n[ime] || '' }, a || {}))]);
    };
    var rez = OF.h('div', { class: 's-cl__rez', 'aria-live': 'polite' });
    var ponavljanje = OF.h('label', { for: 'cl-ponavljanje' });
    var dugme = OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno of-dugme--siroko' });
    function sazetak() {
      var p = C.plan(izbor.plan); if (!p) return;
      var iznos = C.cena(p.id, izbor.velicina), danas = OF.sad().iso, sled = C.dodajMesec(danas, 1);
      rez.innerHTML = '';
      [[OF.t('cl.plan'), OF.tx(p.naziv)], [OF.t('cl.danas'), OF.din(iznos)], [OF.t('cl.sledeca'), D.dug(sled)]].forEach(function (r) { rez.appendChild(OF.h('p', null, [OF.h('span', null, r[0]), OF.h('strong', null, r[1])])); });
      rez.appendChild(OF.h('p', { class: 's-cl__ukupno' }, [OF.h('span', null, OF.t('cl.mesecno')), OF.h('strong', null, OF.din(iznos))]));
      ponavljanje.textContent = OF.t('cl.saglasnost_ponavljanje', { iznos: OF.din(iznos), dan: +danas.slice(8), firma: OF.d.firma.ime });
      dugme.textContent = OF.t('cl.plati', { iznos: OF.din(iznos) });
    }
    [planGrupa, velGrupa,
      polje('vozilo', OF.t('cl.vozilo'), { autocomplete: 'off', placeholder: 'Škoda Octavia 2019', maxlength: '60', required: true }),
      polje('registracija', OF.t('cl.registracija'), { autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'BG 123-AB', maxlength: '14', required: true }, OF.t('cl.registracija_pomoc')),
      polje('ime', OF.t('f.ime'), { autocomplete: 'name', required: true }),
      polje('telefon', OF.t('f.telefon'), { type: 'tel', autocomplete: 'tel', inputmode: 'tel', required: true }),
      polje('email', OF.t('f.email'), { type: 'email', autocomplete: 'email', required: true }, OF.t('cl.email_pomoc')),
      rez,
      OF.h('div', { class: 'of-polje of-polje--cek' }, [OF.h('input', { type: 'checkbox', id: 'cl-uslovi', name: 'uslovi' }), OF.h('label', { for: 'cl-uslovi' }, [OF.t('cl.saglasnost_uslovi') + ' ', OF.h('a', { href: OF.link('uslovi') + '#clanstvo', target: '_blank', rel: 'noopener' }, OF.t('cl.uslovi'))])]),
      OF.h('div', { class: 'of-polje of-polje--cek s-cl__saglasnost' }, [OF.h('input', { type: 'checkbox', id: 'cl-ponavljanje', name: 'ponavljanje' }), ponavljanje]),
      dugme,
      OF.h('p', { class: 'of-polje__pomoc' }, OF.t('cl.kartica_napomena'))
    ].forEach(function (x) { forma.appendChild(x); });
    sazetak();
    OF.on('clanstvo.spolja', function (x) {           // dugmad „Izaberite“ i prekidač veličine na stranici
      if (x.plan && C.plan(x.plan)) izbor.plan = x.plan;
      if (x.velicina != null) izbor.velicina = x.velicina;
      OF.$$('input[name=velicina]', forma).forEach(function (r) { r.checked = +r.value === izbor.velicina; });
      crtajPlanove(); sazetak();
    });
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = OF.forma(forma, {
        vozilo: function (v) { return String(v).trim().length >= 2 ? '' : OF.t('g.obavezno'); },
        registracija: function (v) { return C.normReg(v).length >= 5 ? '' : OF.t('cl.g_registracija'); },
        ime: function (v) { return OF.provera.ime(v) ? '' : OF.t('g.ime'); },
        telefon: function (v) { return OF.provera.telefon(v) ? '' : OF.t('g.telefon'); },
        email: function (v) { return OF.provera.email(v) ? '' : OF.t('g.email'); },
        uslovi: function (v) { return v ? '' : OF.t('cl.g_uslovi'); },
        ponavljanje: function (v) { return v ? '' : OF.t('cl.g_ponavljanje'); }
      });
      if (!ok) return;
      var x = { plan: izbor.plan, velicina: izbor.velicina, vozilo: forma.elements.vozilo.value.trim(), registracija: forma.elements.registracija.value.trim().toUpperCase(),
        ime: forma.elements.ime.value.trim(), telefon: forma.elements.telefon.value.trim(), email: forma.elements.email.value.trim().toLowerCase(), saglasnostPonavljanje: new Date().toISOString() };
      var iznos = C.cena(x.plan, x.velicina);
      dugme.disabled = true; dugme.setAttribute('aria-busy', 'true');
      var korak = OF.demo ? OF.placanje.pokreni({ iznos: iznos, opis: OF.t('cl.opis_placanja', { plan: OF.tx(C.plan(x.plan).naziv), firma: OF.d.firma.ime }), tip: 'clanarina', ponavljanje: { ucestalost: 'mesecno', iznos: iznos, dan: +OF.sad().iso.slice(8) }, kupac: { ime: x.ime, email: x.email, telefon: x.telefon } }) : C.naServeru(x);
      korak.then(function (pl) {
        var c = C.novo(x, pl);
        var nalog = OF.nalog(); if (nalog && nalog.email === c.email) { nalog.vozilo = nalog.vozilo || c.vozilo; nalog.registracija = nalog.registracija || c.registracija; OF.nalogUi.zapamti(nalog); }
        return OF.int.dogadjaj('clanstvo.novo', { clanstvo: c, placanje: pl }).then(function () { potvrda(c); });
      }).then(null, function (g) { dugme.disabled = false; dugme.removeAttribute('aria-busy'); if (g && g.poruka && !g.prekinuto) OF.obavesti(g.poruka, 'greska'); });
    });
    koren.appendChild(forma);

    function potvrda(c) {
      koren.innerHTML = '';
      var p = C.plan(c.plan);
      var s = OF.h('section', { class: 'of-zak__potvrda s-cl', 'aria-labelledby': 'cl-potvrda', tabindex: '-1' }, [
        OF.h('p', { class: 'of-zak__potvrda-oznaka' }, OF.t('cl.potvrdjeno')),
        OF.h('h3', { id: 'cl-potvrda', class: 's-h3' }, OF.t('cl.dobrodosli', { ime: c.ime.split(' ')[0] })),
        OF.h('dl', { class: 'of-pregled' }, [].concat.apply([], [[OF.t('cl.broj'), c.id], [OF.t('cl.plan'), OF.tx(p.naziv)], [OF.t('cl.vozilo'), c.vozilo + ' · ' + c.registracija], [OF.t('cl.placeno'), OF.din(c.iznos) + (c.kartica ? ' · ' + c.kartica : '')], [OF.t('cl.sledeca'), D.dug(c.sledecaNaplata)]].map(function (r) { return [OF.h('dt', null, r[0]), OF.h('dd', null, r[1])]; }))),
        OF.h('p', null, OF.t('cl.stize_mejl', { email: c.email })),
        OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('a', { class: 'of-dugme of-dugme--glavno', href: OF.link('zakazivanje', 'paket=clan-pranje') }, OF.t('cl.zakazi_pranje')),
          OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { otvoriNalog(c); } }, OF.t('cl.u_nalog'))])
      ]);
      koren.appendChild(s); s.focus();
      w.scrollTo({ top: koren.getBoundingClientRect().top + w.scrollY - 100, behavior: OF.manjePokreta() ? 'auto' : 'smooth' });
    }
    function otvoriNalog(c) {
      var nalog = OF.nalog();
      if (nalog && nalog.email === c.email) { w.location.href = OF.link('nalog') + '#clanstvo'; return; }
      OF.nalogUi.posaljiLink(c.email).then(function (r) {
        if (OF.demo && r.link) w.location.href = r.link;
        else OF.obavesti(OF.t('n.link_poslat', { email: c.email }));
      });
    }
  };

  /* ---------- kartica članstva (nalog, stranica članstva) ---------- */
  C.kartica = function (c, o) {
    o = o || {};
    var p = C.plan(c.plan) || { naziv: c.plan, pranja: 0 }, danas = OF.sad().iso;
    var iskorisceno = C.iskorisceno(c);
    var pranja = OF.h('div', { class: 's-cl-status__pranja', role: 'img', 'aria-label': OF.t('cl.pranja_ovog_meseca', { n: iskorisceno, uk: p.pranja }) });
    for (var i = 0; i < p.pranja; i++) pranja.appendChild(OF.h('i', { class: i < iskorisceno ? 'iskorisceno' : '' }));
    var redovi = [[OF.t('cl.vozilo'), (c.vozilo || '') + ' · ' + (c.registracija || '')], [OF.t('cl.mesecno'), OF.din(c.iznos || C.cena(c.plan, c.velicina))]];
    if (c.status === 'aktivno') redovi.push([OF.t('cl.sledeca'), D.dug(c.sledecaNaplata) + (c.kartica ? ' · ' + c.kartica : '')]);
    if (c.status === 'pauza') redovi.push([OF.t('cl.pauza_do'), D.dug(c.pauzaDo)]);
    if (c.status === 'otkazano') redovi.push([OF.t('cl.vazi_do'), D.dug(c.vaziDo)]);
    if (c.status === 'neuspela-naplata') redovi.push([OF.t('cl.naplata'), OF.t('cl.naplata_nije_prosla', { datum: D.datum(c.sledecaNaplata) })]);
    return OF.h('div', { class: 's-cl-status' }, [
      OF.h('div', { class: 's-cl-status__glava' }, [OF.h('p', { class: 's-cl-status__naziv' }, OF.tx(p.naziv)), OF.h('span', { class: 's-cl-status__znacka ' + c.status }, C.nazivStatusa(c.status))]),
      C.aktivno(c) || c.status === 'pauza' ? OF.h('div', null, [OF.h('p', { class: 'of-polje__pomoc' }, OF.t('cl.pranja_ovog_meseca', { n: iskorisceno, uk: p.pranja })), pranja]) : null,
      OF.h('dl', { class: 'of-pregled' }, [].concat.apply([], redovi.map(function (r) { return [OF.h('dt', null, r[0]), OF.h('dd', null, r[1])]; }))),
      c.primer ? OF.h('p', { class: 'of-nalog__primer' }, OF.t('n.primer_napomena')) : null
    ]);
  };

  /* ---------- upravljanje u nalogu ---------- */
  function deoNaloga(n) {
    var c = C.za(n.email);
    if (!c) return OF.h('div', { class: 'of-nalog__prazno' }, [OF.h('p', null, OF.t('cl.nema')), OF.h('a', { class: 'of-dugme of-dugme--glavno', href: OF.link('clanstvo') }, OF.t('cl.pogledaj_planove'))]);
    var k = OF.h('div', { class: 's-cl' }, [C.kartica(c)]);
    var dugmad = OF.h('div', { class: 's-cl-status__dugmad' });
    var preostalo = C.preostalo(c);
    if (C.aktivno(c) && preostalo > 0) dugmad.appendChild(OF.h('a', { class: 'of-dugme of-dugme--glavno', href: OF.link('zakazivanje', 'paket=clan-pranje') }, OF.t('cl.zakazi_pranje')));
    if (c.status === 'aktivno') {
      if (C.pauzaOveGodine(c) < (cfg().pauzaMeseci || 2)) dugmad.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { pauza(c); } }, OF.t('cl.pauziraj')));
      dugmad.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { promenaPlana(c); } }, OF.t('cl.promeni_plan')));
      dugmad.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { promenaVozila(c); } }, OF.t('cl.promeni_vozilo')));
    }
    if (c.status === 'pauza') dugmad.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: function () { nastavi(c); } }, OF.t('cl.nastavi')));
    if (c.status === 'neuspela-naplata') dugmad.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: function () { novaKartica(c); } }, OF.t('cl.nova_kartica')));
    if (c.status === 'aktivno' || c.status === 'pauza' || c.status === 'neuspela-naplata') dugmad.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () { otkazi(c); } }, OF.t('cl.otkazi')));
    if (c.status === 'otkazano' && c.vaziDo >= OF.sad().iso) dugmad.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { obnovi(c); } }, OF.t('cl.obnovi')));
    k.appendChild(dugmad);
    if ((c.naplate || []).length) {
      k.appendChild(OF.h('h3', { class: 'of-nalog__podnaslov' }, OF.t('cl.naplate')));
      k.appendChild(OF.h('ul', { class: 'of-nalog__lista', role: 'list' }, c.naplate.slice().reverse().map(function (x) {
        return OF.h('li', { class: 'of-nalog__stavka' }, [OF.h('div', { class: 'of-nalog__datum' }, [OF.h('strong', null, D.format(x.datum, { day: 'numeric' })), OF.h('span', null, D.format(x.datum, { month: 'short', year: 'numeric' }))]),
          OF.h('div', { class: 'of-nalog__opis' }, [OF.h('p', { class: 'of-nalog__naslov' }, OF.din(x.iznos) + ' · ' + (x.ok ? OF.t('cl.naplaceno') : OF.t('cl.odbijeno'))), OF.h('p', null, (x.kartica || '') + (x.id ? ' · ' + x.id : ''))])]);
      })));
    }
    return k;
  }
  function osvezi(poruka) { if (poruka) OF.obavesti(poruka); OF.emit('nalog', OF.nalog()); }
  /* izmena članstva: u pravom režimu server primenjuje pravila i vraća članstvo kakvo je u bazi */
  function posalji(tip, p, poruka, staro) {
    return OF.int.dogadjaj(tip, p).then(function (r) {
      if (!OF.demo) {
        if (!r || !r.ok) { if (staro) C.sacuvaj(staro); OF.obavesti((r && r.poruka) || OF.t('zak.server_greska'), 'greska'); OF.emit('nalog', OF.nalog()); return; }
        if (r.clanstvo) C.sacuvaj(Object.assign({}, C.nadji(r.clanstvo.id) || {}, r.clanstvo));
      }
      osvezi(poruka);
    });
  }
  function potvrdaDijalog(naslov, tekst, dugmeTekst, fn) {
    var dl = OF.dijalog({ naslov: naslov, id: 'cl', sadrzaj: OF.h('div', null, [OF.h('p', null, tekst), OF.h('div', { class: 'of-zak__dugmad' }, [
      OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { dl.zatvori(); } }, OF.t('moj.ne_hvala')),
      OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: function () { dl.zatvori(); fn(); } }, dugmeTekst)])]) });
  }
  function pauza(c) {
    var meseci = Math.min(1, (cfg().pauzaMeseci || 2) - C.pauzaOveGodine(c));
    var pauzaDo = C.dodajMesec(c.sledecaNaplata, meseci);
    potvrdaDijalog(OF.t('cl.pauziraj'), OF.t('cl.pauza_pitanje', { do: D.datum(pauzaDo), ostalo: OF.tn('cl.meseci', (cfg().pauzaMeseci || 2) - C.pauzaOveGodine(c)) }), OF.t('cl.pauziraj'), function () {
      var staro = JSON.parse(JSON.stringify(c));
      var x = C.izmeni(c.id, function (y) { y.status = 'pauza'; y.pauzaDo = pauzaDo; y.pauze = y.pauze || {}; var g = OF.sad().iso.slice(0, 4); y.pauze[g] = (y.pauze[g] || 0) + meseci; return y; });
      posalji('clanstvo.izmena', { clanstvo: x, vrsta: 'pauza' }, OF.t('cl.pauzirano', { do: D.datum(pauzaDo) }), staro);
    });
  }
  function nastavi(c) {
    var staro = JSON.parse(JSON.stringify(c));
    var x = C.izmeni(c.id, function (y) { y.status = 'aktivno'; delete y.pauzaDo; if (y.sledecaNaplata < OF.sad().iso) y.sledecaNaplata = OF.sad().iso; return y; });
    posalji('clanstvo.izmena', { clanstvo: x, vrsta: 'nastavak' }, OF.t('cl.nastavljeno'), staro);
  }
  function otkazi(c) {
    var vaziDo = D.dodaj(c.sledecaNaplata, -1);
    potvrdaDijalog(OF.t('cl.otkazi'), OF.t('cl.otkazi_pitanje', { do: D.datum(vaziDo) }), OF.t('cl.da_otkazi'), function () {
      var staro = JSON.parse(JSON.stringify(c));
      var x = C.izmeni(c.id, function (y) { y.status = 'otkazano'; y.vaziDo = vaziDo; y.otkazano = new Date().toISOString(); return y; });
      posalji('clanstvo.otkazano', { clanstvo: x }, OF.t('cl.otkazano', { do: D.datum(vaziDo) }), staro);
    });
  }
  function obnovi(c) {
    var staro = JSON.parse(JSON.stringify(c));
    var x = C.izmeni(c.id, function (y) { y.status = 'aktivno'; delete y.vaziDo; delete y.otkazano; return y; });
    posalji('clanstvo.izmena', { clanstvo: x, vrsta: 'obnova' }, OF.t('cl.obnovljeno'), staro);
  }
  function promenaPlana(c) {
    var izabran = c.plan;
    var lista = OF.h('div', { class: 's-osa__opcije s-cl__plan' }, C.planovi().map(function (p) {
      var id = 'clpp-' + p.id, r = OF.h('input', { type: 'radio', name: 'novi-plan', id: id, checked: p.id === c.plan });
      r.addEventListener('change', function () { izabran = p.id; });
      return OF.h('span', { class: 'of-opcija' }, [r, OF.h('label', { for: id }, [OF.h('span', null, OF.tx(p.naziv)), OF.h('span', null, OF.din(C.cena(p.id, c.velicina)))])]);
    }));
    var dl = OF.dijalog({ naslov: OF.t('cl.promeni_plan'), id: 'clp', sadrzaj: OF.h('div', null, [OF.h('p', null, OF.t('cl.plan_od', { datum: D.datum(c.sledecaNaplata) })), lista,
      OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: function () {
        dl.zatvori(); if (izabran === c.plan) return;
        var staro = JSON.parse(JSON.stringify(c));
        var x = C.izmeni(c.id, function (y) { y.noviPlan = izabran; y.plan = izabran; y.iznos = C.cena(izabran, y.velicina); return y; });
        posalji('clanstvo.izmena', { clanstvo: x, vrsta: 'plan' }, OF.t('cl.plan_promenjen', { datum: D.datum(c.sledecaNaplata) }), staro);
      } }, OF.t('n.sacuvaj'))])]) });
  }
  function promenaVozila(c) {
    var mesec = C.mesec();
    if (c.voziloMenjano === mesec) { OF.obavesti(OF.t('cl.vozilo_jednom'), 'greska'); return; }
    var forma = OF.h('form', { class: 'of-forma', novalidate: true }, [
      OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'clv-v' }, OF.t('cl.vozilo')), OF.h('input', { id: 'clv-v', name: 'vozilo', value: c.vozilo || '' })]),
      OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'clv-r' }, OF.t('cl.registracija')), OF.h('input', { id: 'clv-r', name: 'registracija', value: c.registracija || '', autocapitalize: 'characters' })]),
      OF.h('p', { class: 'of-polje__pomoc' }, OF.t('cl.vozilo_napomena')),
      OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno' }, OF.t('n.sacuvaj'))])]);
    var dl = OF.dijalog({ naslov: OF.t('cl.promeni_vozilo'), id: 'clvv', sadrzaj: forma });
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!OF.forma(forma, { vozilo: function (v) { return String(v).trim().length >= 2 ? '' : OF.t('g.obavezno'); }, registracija: function (v) { return C.normReg(v).length >= 5 ? '' : OF.t('cl.g_registracija'); } })) return;
      var staro = JSON.parse(JSON.stringify(c));
      var x = C.izmeni(c.id, function (y) { y.vozilo = forma.elements.vozilo.value.trim(); y.registracija = forma.elements.registracija.value.trim().toUpperCase(); y.voziloMenjano = mesec; return y; });
      dl.zatvori(); posalji('clanstvo.izmena', { clanstvo: x, vrsta: 'vozilo' }, OF.t('n.sacuvano'), staro);
    });
  }
  function novaKartica(c) {
    var iznos = c.iznos || C.cena(c.plan, c.velicina);
    var korak = OF.demo ? OF.placanje.pokreni({ iznos: iznos, opis: OF.t('cl.opis_placanja', { plan: OF.tx((C.plan(c.plan) || {}).naziv), firma: OF.d.firma.ime }), tip: 'clanarina', ponavljanje: { ucestalost: 'mesecno', iznos: iznos, dan: +c.od.slice(8) }, kupac: { ime: c.ime, email: c.email, telefon: c.telefon } })
      : C.naServeru(Object.assign({}, c, { obnovaKartice: true }));
    korak.then(function (pl) {
      var danas = OF.sad().iso;
      var x = C.izmeni(c.id, function (y) { y.status = 'aktivno'; y.kartica = pl.kartica; y.naplate = (y.naplate || []).concat([{ datum: danas, iznos: iznos, ok: true, id: pl.id, kartica: pl.kartica }]); y.sledecaNaplata = C.dodajMesec(danas, 1); return y; });
      OF.int.dogadjaj('clanstvo.naplata', { clanstvo: x, iznos: iznos }).then(function () { osvezi(OF.t('cl.naplata_uspela')); });
    }, function (g) { if (g && g.poruka && !g.prekinuto) OF.obavesti(g.poruka, 'greska'); });
  }

  if (OF.nalogUi) (OF.nalogUi.dodatniDelovi = OF.nalogUi.dodatniDelovi || []).unshift({ id: 'clanstvo', naziv: function () { return OF.t('cl.naslov_naloga'); }, crtaj: deoNaloga });

  /* demo nalog: primer članstva (jasno označen), samo prvi put */
  OF.on('nalog', function (n) {
    if (!OF.demo || !n || !n.primer || !OF.d.demo || !OF.d.demo.istorija || !OF.d.demo.istorija.clanstvo) return;
    if (C.za(n.email) || OF.store.get('primer-clanstvo-' + n.email)) return;
    OF.store.set('primer-clanstvo-' + n.email, true);
    var x = OF.d.demo.istorija.clanstvo, voz = (OF.d.demo.istorija.vozila || [])[0] || {}, danas = OF.sad().iso;
    var od = D.dodaj(danas, x.od || -60), sled = D.dodaj(danas, x.sledecaNaplata || 10), iznos = C.cena(x.plan, x.velicina || 0);
    var c = { id: OF.id(cfg().prefiks || 'C'), token: OF.token(), email: n.email, ime: n.ime || 'Ana Primer', telefon: '060 000 00 00', vozilo: voz.vozilo || '', registracija: voz.registracija || '',
      plan: x.plan, velicina: x.velicina || 0, status: 'aktivno', od: od, sledecaNaplata: sled, iznos: iznos, kartica: '•••• 4242', pranja: {}, pauze: {}, primer: true,
      naplate: [C.dodajMesec(sled, -3), C.dodajMesec(sled, -2), C.dodajMesec(sled, -1)].filter(function (dt) { return dt >= od; }).map(function (dt) { return { datum: dt, iznos: iznos, ok: true, kartica: '•••• 4242', id: 'TX-' + dt.replace(/-/g, '') }; }) };
    c.pranja[C.mesec()] = x.iskorisceno || 0;
    C.sacuvaj(c);
  });
  /* pravi režim: članstva sa servera posle prijave linkom */
  OF.on('nalog.server', function (o) { (o.clanstva || []).forEach(function (c) { C.sacuvaj(c); }); });
  /* brisanje podataka iz naloga briše i članstvo (u pravom režimu server ga otkazuje) */
  OF.on('nalog.obrisi', function (email) { OF.store.set('clanstva', C.sva().filter(function (c) { return c.email !== email; })); });

  /* ---------- recepti poruka ---------- */
  var R = OF.int && OF.int.recepti;
  if (R) {
    var F = function () { return OF.d.firma; };
    var vlasnik = function () { return ((OF.c.integracije || {}).mejl || {}).vlasnik || F().email; };
    var kol = function (k) { return OF.jezik === 'sr' ? k.sr : k.en; };
    var naziv = function (c) { return OF.tx((C.plan(c.plan) || {}).naziv); };
    R['clanstvo.novo'] = function (p) {
      var c = p.clanstvo, f = F(), redovi = [[OF.t('cl.broj'), c.id], [OF.t('cl.plan'), naziv(c)], [OF.t('cl.vozilo'), c.vozilo + ' · ' + c.registracija], [OF.t('cl.placeno'), OF.din(c.iznos) + (c.kartica ? ' · ' + c.kartica : '')], [OF.t('cl.sledeca'), D.dug(c.sledecaNaplata)]];
      return {
        sazetak: OF.t('r.sazetak_clanstvo', { ime: c.ime, plan: naziv(c) }),
        viber: { tekst: OF.t('r.viber_clanstvo') + '\n' + naziv(c) + ' · ' + OF.din(c.iznos) + '/' + OF.t('cl.mes') + '\n' + c.vozilo + ' · ' + c.registracija + '\n' + c.ime + ' · ' + c.telefon, dugmad: [OF.t('r.otvori_panel')] },
        mejlKupcu: { za: c.email, naslov: OF.t('r.mejl_clanstvo_naslov', { firma: f.ime }), prilozi: ['racun-' + c.id + '.pdf'],
          html: OF.int.mejl({ naslov: OF.t('r.mejl_clanstvo_h1', { ime: c.ime.split(' ')[0] }), uvod: OF.t('r.mejl_clanstvo_uvod', { dan: +c.od.slice(8), iznos: OF.din(c.iznos) }), redovi: redovi,
            dugmad: [{ href: OF.int.apsolutno(OF.link('zakazivanje', 'paket=clan-pranje')), tekst: OF.t('cl.zakazi_pranje') }, { href: OF.int.apsolutno(OF.link('nalog')), tekst: OF.t('cl.upravljaj'), sporedno: true }], napomena: OF.t('r.mejl_clanstvo_napomena') }) },
        mejlVlasniku: { za: vlasnik(), naslov: OF.t('r.mejl_vlasnik_clanstvo', { ime: c.ime, plan: naziv(c) }), tekst: redovi.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') + '\n' + c.telefon + ' · ' + c.email },
        tabela: { list: OF.t('r.list_clanovi'), kolone: kol({ sr: ['Broj', 'Od', 'Ime', 'Plan', 'Iznos', 'Vozilo', 'Telefon', 'Mejl', 'Status'], en: ['ID', 'Since', 'Name', 'Plan', 'Amount', 'Car', 'Phone', 'Email', 'Status'] }),
          red: [c.id, c.od, c.ime, naziv(c), c.iznos, c.vozilo + ' ' + c.registracija, c.telefon, c.email, C.nazivStatusa(c.status)] },
        ostalo: [{ naziv: OF.t('r.ponavljanje_naslov'), tekst: OF.t('r.ponavljanje_tekst', { dan: +c.od.slice(8), iznos: OF.din(c.iznos) }) }, { naziv: OF.t('r.fiskalni'), tekst: OF.t('r.fiskalni_clanarina', { iznos: OF.din(c.iznos) }) }]
      };
    };
    R['clanstvo.izmena'] = function (p) {
      var c = p.clanstvo;
      return { sazetak: OF.t('r.sazetak_clanstvo_izmena', { ime: c.ime, vrsta: OF.t('cl.vrsta_' + p.vrsta) }),
        viber: { tekst: OF.t('r.viber_clanstvo_izmena', { vrsta: OF.t('cl.vrsta_' + p.vrsta) }) + '\n' + c.ime + ' · ' + naziv(c) + ' · ' + c.registracija },
        mejlKupcu: { za: c.email, naslov: OF.t('r.mejl_clanstvo_izmena_naslov', { firma: F().ime }), html: OF.int.mejl({ naslov: OF.t('cl.vrsta_' + p.vrsta), uvod: OF.t('r.mejl_clanstvo_izmena_uvod_' + p.vrsta, { datum: D.datum(c.pauzaDo || c.sledecaNaplata || OF.sad().iso), plan: naziv(c), iznos: OF.din(c.iznos) }) }) },
        tabela: { list: OF.t('r.list_clanovi'), kolone: kol({ sr: ['Broj', 'Status', 'Plan', 'Vozilo'], en: ['ID', 'Status', 'Plan', 'Car'] }), red: [c.id, C.nazivStatusa(c.status), naziv(c), c.registracija] } };
    };
    R['clanstvo.otkazano'] = function (p) {
      var c = p.clanstvo;
      return { sazetak: OF.t('r.sazetak_clanstvo_otkazano', { ime: c.ime }),
        viber: { tekst: OF.t('r.viber_clanstvo_otkazano') + '\n' + c.ime + ' · ' + naziv(c) + '\n' + OF.t('cl.vazi_do') + ': ' + D.dug(c.vaziDo) },
        mejlKupcu: { za: c.email, naslov: OF.t('r.mejl_clanstvo_otkazano_naslov', { firma: F().ime }), html: OF.int.mejl({ naslov: OF.t('r.mejl_clanstvo_otkazano_h1'), uvod: OF.t('r.mejl_clanstvo_otkazano_uvod', { do: D.datum(c.vaziDo) }), dugmad: [{ href: OF.int.apsolutno(OF.link('nalog')), tekst: OF.t('cl.obnovi'), sporedno: true }] }) },
        tabela: { list: OF.t('r.list_clanovi'), kolone: kol({ sr: ['Broj', 'Status', 'Važi do'], en: ['ID', 'Status', 'Valid until'] }), red: [c.id, C.nazivStatusa(c.status), c.vaziDo] } };
    };
    R['clanstvo.naplata'] = function (p) {
      var c = p.clanstvo;
      return { sazetak: OF.t('r.sazetak_clanstvo_naplata', { ime: c.ime, iznos: OF.din(p.iznos) }),
        mejlKupcu: { za: c.email, naslov: OF.t('r.mejl_clanstvo_naplata_naslov', { firma: F().ime }), prilozi: ['racun-' + c.id + '.pdf'], html: OF.int.mejl({ naslov: OF.t('r.mejl_clanstvo_naplata_h1'), uvod: OF.t('r.mejl_clanstvo_naplata_uvod', { iznos: OF.din(p.iznos), datum: D.dug(c.sledecaNaplata) }) }) },
        tabela: { list: OF.t('r.list_naplate'), kolone: kol({ sr: ['Broj', 'Datum', 'Iznos', 'Kartica'], en: ['ID', 'Date', 'Amount', 'Card'] }), red: [c.id, OF.sad().iso, p.iznos, c.kartica || ''] } };
    };
    R['clanstvo.neuspela'] = function (p) {
      var c = p.clanstvo;
      return { sazetak: OF.t('r.sazetak_clanstvo_neuspela', { ime: c.ime }),
        viber: { tekst: OF.t('r.viber_clanstvo_neuspela') + '\n' + c.ime + ' · ' + c.telefon + ' · ' + OF.din(c.iznos) },
        mejlKupcu: { za: c.email, naslov: OF.t('r.mejl_clanstvo_neuspela_naslov', { firma: F().ime }), html: OF.int.mejl({ naslov: OF.t('r.mejl_clanstvo_neuspela_h1'), uvod: OF.t('r.mejl_clanstvo_neuspela_uvod', { dana: cfg().ponovniPokusajDana || 3 }), dugmad: [{ href: OF.int.apsolutno(OF.link('nalog')), tekst: OF.t('cl.nova_kartica') }] }) },
        sms: [{ tekst: OF.t('r.sms_clanstvo_neuspela', { firma: F().ime }), kada: OF.t('r.odmah') }] };
    };
    /* tri dana pre naplate (šalje server, cron u 9 h) */
    R['clanstvo.podsetnik'] = function (p) {
      var c = p.clanstvo;
      return { sazetak: OF.t('r.sazetak_clanstvo_podsetnik', { ime: c.ime, iznos: OF.din(c.iznos) }),
        mejlKupcu: { za: c.email, naslov: OF.t('r.mejl_clanstvo_podsetnik_naslov', { firma: F().ime, datum: D.dug(c.sledecaNaplata) }), html: OF.int.mejl({ naslov: OF.t('r.mejl_clanstvo_podsetnik_h1'), uvod: OF.t('r.mejl_clanstvo_podsetnik_uvod', { datum: D.datum(c.sledecaNaplata), iznos: OF.din(c.iznos), kartica: c.kartica || '' }),
          dugmad: [{ href: OF.int.apsolutno(OF.link('nalog')), tekst: OF.t('cl.upravljaj') }] }) } };
    };
  }

  OF.spremno(function () { C.forma(OF.$('[data-of-clanstvo]')); });
})(window, document);
