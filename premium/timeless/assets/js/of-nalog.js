/* opsforma Premium · nalog mušterije
   Prijava linkom na mejl, bez lozinke. U demo režimu link se „šalje“ (vidi se u prikazu za vlasnika)
   i može odmah da se otvori. U pravom režimu server pravi jednokratni link i šalje ga mejlom.
   Prikaz: termini, kupovine, vaučeri i ulaznice, bodovi, sačuvani podaci. */
(function (w, d) {
  'use strict';
  var OF = w.OF, N = OF.nalogUi = {}, D = OF.datum;
  var L = function () { return OF.d.lojalnost || {}; };

  N.prijavljen = function () { return OF.nalog(); };
  N.odjava = function () {
    OF.store.remove('nalog'); N.aktivnaKartica = null; OF.emit('nalog', null);
    if (!OF.demo) fetch(OF.int.api('/nalog/odjava'), { method: 'POST', credentials: 'same-origin' }).catch(function () {});
  };

  /* ---------- slanje linka ---------- */
  N.posaljiLink = function (email) {
    var token = OF.token();
    var tokeni = OF.store.get('nalog-tokeni', {});
    tokeni[token] = { email: email, vazi: Date.now() + 30 * 60000 };
    OF.store.set('nalog-tokeni', tokeni);
    var link = OF.int.apsolutno(OF.link('nalog', 'prijava=' + token));
    if (!OF.demo) {
      return fetch(OF.int.api('/nalog/link'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
        body: JSON.stringify({ email: email, jezik: OF.jezik, povratak: OF.int.apsolutno(OF.link('nalog')) }) }).then(function () { return { ok: true }; });
    }
    return OF.int.dogadjaj('nalog.link', { email: email, link: link }).then(function () { return { ok: true, link: link }; });
  };

  /* ---------- potvrda linka (?prijava=token) ---------- */
  N.potvrdi = function () {
    var token = OF.upit('prijava'); if (!token) return Promise.resolve(null);
    var ocisti = function () { try { w.history.replaceState(null, '', w.location.pathname); } catch (e) {} };
    if (!OF.demo) {
      return fetch(OF.int.api('/nalog/potvrdi?t=' + encodeURIComponent(token)), { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (o) {
          ocisti(); if (!o || !o.email) return null;
          (o.termini || []).forEach(function (t) { if (OF.zak) OF.zak.sacuvaj(t); });
          (o.porudzbine || []).forEach(function (x) { OF.store.set('porudzbine', [x].concat(OF.store.get('porudzbine', []).filter(function (y) { return y.id !== x.id; }))); });
          (o.kodovi || []).forEach(function (x) { OF.store.set('kodovi', [x].concat(OF.store.get('kodovi', []).filter(function (y) { return y.kod !== x.kod; }))); });
          OF.emit('nalog.server', o);                       // moduli sajta (članstvo, garantni listovi) uzimaju svoje
          var profil = { ime: o.ime || '', telefon: o.telefon || '', bodovi: o.bodovi || 0 }; (OF.d.nalogPolja || []).forEach(function (p) { if (o[p.ime] != null) profil[p.ime] = o[p.ime]; });
          return N.otvori(o.email, profil);
        });
    }
    var tokeni = OF.store.get('nalog-tokeni', {}), t = tokeni[token];
    ocisti();
    if (!t || t.vazi < Date.now()) return Promise.resolve({ greska: true });
    delete tokeni[token]; OF.store.set('nalog-tokeni', tokeni);
    return Promise.resolve(N.otvori(t.email));
  };
  N.otvori = function (email, dodatno) {
    var postojeci = OF.store.get('nalozi', {})[email] || {};
    var n = Object.assign({ email: email, ime: '', telefon: '', bodovi: 0, od: new Date().toISOString(), podsetnikKontrola: true }, postojeci, dodatno || {});
    if (!postojeci.email && OF.demo && OF.d.demo && OF.d.demo.istorija) N.ucitajPrimer(n);
    OF.store.set('nalog', n); N.zapamti(n);
    OF.emit('nalog', n);
    return n;
  };
  N.zapamti = function (n) { var sve = OF.store.get('nalozi', {}); sve[n.email] = n; OF.store.set('nalozi', sve); OF.store.set('nalog', n); };

  /* primer istorije za demo nalog (jasno označen) */
  N.ucitajPrimer = function (n) {
    var p = OF.d.demo.istorija, danas = OF.sad().iso;
    (p.termini || []).forEach(function (x) {
      var t = Object.assign({ tip: (OF.d.zakazivanje || {}).tip || 'termin', ime: x.ime || 'Ana Primer', telefon: '060 000 00 00', email: n.email, status: 'obavljen', primer: true }, x);
      t.datum = D.dodaj(danas, x.pre ? -x.pre : x.za || 0); delete t.pre; delete t.za;
      if (t.status === 'obavljen' && t.datum >= danas) t.status = 'potvrdjen';
      OF.zak.sacuvaj(t);
    });
    (p.porudzbine || []).forEach(function (x) {
      var por = Object.assign({ id: OF.id((OF.d.prodaja || {}).prefiks || 'P'), kupac: { ime: x.ime || 'Ana Primer', email: n.email, telefon: '060 000 00 00' }, status: 'preuzeto', primer: true }, x);
      por.vreme = new Date(Date.now() - (x.pre || 10) * 864e5).toISOString(); OF.store.dodaj('porudzbine', por, 300);
    });
    (p.kodovi || []).forEach(function (x) { OF.store.dodaj('kodovi', Object.assign({ kod: (x.tip === 'vaucer' ? 'V' : 'U') + '-' + OF.id().slice(0, 4) + '-' + OF.id().slice(0, 4), kupac: n.email, primer: true, vaziDo: D.dodaj(danas, x.vaziDana || 300) }, x), 500); });
    n.bodovi = p.bodovi || 0; n.primer = true;
  };

  /* ---------- podaci za prikaz ---------- */
  N.terminiZa = function (email) { return OF.zak ? OF.zak.termini().filter(function (t) { return t.email === email; }) : []; };
  N.porudzbineZa = function (email) { return OF.store.get('porudzbine', []).filter(function (p) { return p.kupac && p.kupac.email === email; }).sort(function (a, b) { return String(b.vreme).localeCompare(String(a.vreme)); }); };   // najnovije prvo
  N.kodoviZa = function (email) { return OF.store.get('kodovi', []).filter(function (k) { return k.kupac === email; }); };

  /* =====================================================================
     STRANICA NALOGA
     ===================================================================== */
  N.stranica = function (koren) {
    if (!koren) return;
    N.potvrdi().then(function (r) {
      if (r && r.greska) OF.obavesti(OF.t('n.link_istekao'), 'greska');
      crtaj();
    });
    OF.on('nalog', crtaj);

    function crtaj() {
      var n = N.prijavljen();
      koren.innerHTML = '';
      if (!n) return koren.appendChild(prijava());
      koren.appendChild(pregled(n));
    }

    function prijava() {
      var k = OF.h('div', { class: 'of-nalog of-nalog--prijava' });
      k.appendChild(OF.h('h2', null, OF.t('n.prijava_naslov')));
      k.appendChild(OF.h('p', null, OF.t('n.prijava_opis')));
      var forma = OF.h('form', { class: 'of-forma', novalidate: true }, [
        OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'n-email' }, OF.t('f.email')), OF.h('input', { id: 'n-email', name: 'email', type: 'email', autocomplete: 'email', required: true })]),
        OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno' }, OF.t('n.posalji_link'))
      ]);
      forma.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!OF.forma(forma, { email: function (v) { return OF.provera.email(v) ? '' : OF.t('g.email'); } })) return;
        var email = forma.elements.email.value.trim().toLowerCase();
        N.posaljiLink(email).then(function (r) {
          var poslato = OF.h('div', { class: 'of-hvala', role: 'status', tabindex: '-1' }, [
            OF.h('h3', null, OF.t('n.proverite_mejl')), OF.h('p', null, OF.t('n.link_poslat', { email: email })),
            OF.demo && r.link ? OF.h('a', { class: 'of-dugme of-dugme--glavno', href: r.link }, OF.t('n.otvori_link_demo')) : null
          ]);
          forma.replaceWith(poslato); poslato.focus();
        });
      });
      k.appendChild(forma);
      var prednosti = OF.d.nalogPrednosti ? OF.d.nalogPrednosti.map(function (x) { return OF.tx(x); }) : [OF.t('n.prednost_1'), OF.t('n.prednost_2'), OF.t('n.prednost_3')];   // sajt može da ima svoje
      k.appendChild(OF.h('ul', { class: 'of-nalog__prednosti' }, prednosti.map(function (x) { return OF.h('li', null, x); })));
      return k;
    }

    function pregled(n) {
      var k = OF.h('div', { class: 'of-nalog' });
      k.appendChild(OF.h('div', { class: 'of-nalog__glava' }, [
        OF.h('div', null, [OF.h('p', { class: 'of-nalog__oznaka' }, OF.t('n.prijavljeni_ste')), OF.h('h2', null, n.ime || n.email), n.ime ? OF.h('p', { class: 'of-nalog__email' }, n.email) : null]),
        OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { N.odjava(); OF.obavesti(OF.t('n.odjavljeni')); } }, OF.t('n.odjava'))
      ]));
      if (n.primer) k.appendChild(OF.h('p', { class: 'of-nalog__primer' }, OF.t('n.primer_napomena')));
      var termini = N.terminiZa(n.email), porudzbine = N.porudzbineZa(n.email), kodovi = N.kodoviZa(n.email);
      var delovi = [];
      var imaTermine = (OF.d.zakazivanje || {}).tip;
      if (imaTermine) delovi.push(['termini', OF.t('n.termini'), sekcijaTermini(termini)]);
      if (OF.d.prodaja) delovi.push(['kupovine', OF.t('n.kupovine'), sekcijaKupovine(porudzbine)]);
      if (OF.d.prodaja && (OF.d.prodaja.vauceri || OF.d.prodaja.ulaznice)) delovi.push(['kodovi', OF.t('n.kodovi'), sekcijaKodovi(kodovi)]);
      if (OF.d.lojalnost) delovi.push(['bodovi', OF.t('n.bodovi'), sekcijaBodovi(n, termini)]);
      (N.dodatniDelovi || []).forEach(function (x) { var el = x.crtaj(n); if (el) delovi.push([x.id, typeof x.naziv === 'function' ? x.naziv() : x.naziv, el]); });   // sajt dodaje svoje (npr. procene)
      delovi.push(['podaci', OF.t('n.podaci'), sekcijaPodaci(n)]);
      var tabovi = OF.h('div', { class: 'of-tabovi__lista', role: 'tablist', 'aria-label': OF.t('n.vas_nalog') });
      var paneli = OF.h('div');
      delovi.forEach(function (x, i) {
        tabovi.appendChild(OF.h('button', { type: 'button', role: 'tab', id: 'nt-' + x[0], 'aria-controls': 'np-' + x[0], 'aria-selected': i === 0 ? 'true' : 'false', tabindex: i === 0 ? '0' : '-1', class: 'of-tabovi__tab' }, x[1]));
        paneli.appendChild(OF.h('div', { role: 'tabpanel', id: 'np-' + x[0], 'aria-labelledby': 'nt-' + x[0], hidden: i !== 0, class: 'of-tabovi__panel', tabindex: '0' }, x[2]));
      });
      var tb = OF.h('div', { class: 'of-tabovi' }, [tabovi, paneli]);
      k.appendChild(tb);
      // posle izmene (pauza, plan, podaci…) nalog se crta ponovo: ostajemo na kartici na kojoj je kupac bio
      var izaberi = OF.ui.tabovi(tb), zapamti = function () { var t = OF.$('[role=tab][aria-selected=true]', tabovi); if (t) N.aktivnaKartica = t.id.slice(3); };
      tabovi.addEventListener('click', zapamti); tabovi.addEventListener('keyup', zapamti);
      var idx = delovi.map(function (x) { return x[0]; }).indexOf(N.aktivnaKartica);
      if (idx > 0) izaberi(idx);
      return k;
    }

    function prazno(tekst, link, linkTekst) {
      return OF.h('div', { class: 'of-nalog__prazno' }, [OF.h('p', null, tekst), link ? OF.h('a', { class: 'of-dugme of-dugme--glavno', href: link }, linkTekst) : null]);
    }
    function sekcijaTermini(lista) {
      if (!lista.length) return prazno(OF.t('n.nema_termina'), OF.link('zakazivanje'), OF.t('n.zakazi'));
      var danas = OF.sad().iso;
      var buduci = lista.filter(function (t) { return t.datum >= danas && t.status !== 'otkazan'; }).sort(function (a, b) { return (a.datum + a.vreme) < (b.datum + b.vreme) ? -1 : 1; });
      var prosli = lista.filter(function (t) { return t.datum < danas || t.status === 'otkazan'; }).sort(function (a, b) { return (a.datum + a.vreme) > (b.datum + b.vreme) ? -1 : 1; });
      var stavka = function (t) {
        var opis = OF.int.recepti.opisTermina ? OF.int.recepti.opisTermina(t) : '';
        var status = t.status === 'otkazan' ? OF.t('moj.otkazan') : t.datum < danas ? OF.t('n.obavljen') : OF.t('moj.potvrdjen');
        return OF.h('li', { class: 'of-nalog__stavka' + (t.status === 'otkazan' ? ' otkazan' : '') }, [
          OF.h('div', { class: 'of-nalog__datum' }, [OF.h('strong', null, D.format(t.datum, { day: 'numeric' })), OF.h('span', null, D.format(t.datum, { month: 'short', year: 'numeric' }))]),
          OF.h('div', { class: 'of-nalog__opis' }, [OF.h('p', { class: 'of-nalog__naslov' }, opis), OF.h('p', null, D.format(t.datum, { weekday: 'long' }) + ', ' + D.vreme(t.vreme) + ' · ' + status + (t.primer ? ' · ' + OF.t('n.primer') : ''))]),
          t.datum >= danas && t.status !== 'otkazan' ? OF.h('a', { class: 'of-dugme of-dugme--sporedno', href: OF.zak.linkMojTermin(t) }, OF.t('zak.pomeri_otkazi')) :
            t.usluga ? OF.h('a', { class: 'of-dugme of-dugme--tekst', href: OF.link('zakazivanje', 'usluga=' + t.usluga + (t.osoba ? '&osoba=' + t.osoba : '')) }, OF.t('n.ponovo')) : null
        ]);
      };
      return OF.h('div', null, [
        OF.h('h3', { class: 'of-nalog__podnaslov' }, OF.t('n.predstojeci')),
        buduci.length ? OF.h('ul', { class: 'of-nalog__lista', role: 'list' }, buduci.map(stavka)) : prazno(OF.t('n.nema_predstojecih'), OF.link('zakazivanje'), OF.t('n.zakazi')),
        prosli.length ? OF.h('h3', { class: 'of-nalog__podnaslov' }, OF.t('n.istorija')) : null,
        prosli.length ? OF.h('ul', { class: 'of-nalog__lista', role: 'list' }, prosli.map(stavka)) : null
      ]);
    }
    function sekcijaKupovine(lista) {
      if (!lista.length) return prazno(OF.t('n.nema_kupovina'), OF.link((OF.d.prodaja || {}).pocetnaStranica || 'pocetna'), OF.t('n.kupovina'));
      return OF.h('ul', { class: 'of-nalog__lista', role: 'list' }, lista.map(function (p) {
        return OF.h('li', { class: 'of-nalog__stavka' }, [
          OF.h('div', { class: 'of-nalog__datum' }, [OF.h('strong', null, D.format(OF.datum.lokalno(p.vreme).iso, { day: 'numeric' })), OF.h('span', null, D.format(OF.datum.lokalno(p.vreme).iso, { month: 'short', year: 'numeric' }))]),
          OF.h('div', { class: 'of-nalog__opis' }, [OF.h('p', { class: 'of-nalog__naslov' }, p.stavke.map(function (s) { return s.kolicina + ' × ' + OF.tx(s.naziv); }).join(', ')),
            OF.h('p', null, p.id + ' · ' + OF.din(p.ukupno) + (p.posiljka ? ' · ' + p.posiljka.servis + ' ' + p.posiljka.broj : '') + (p.primer ? ' · ' + OF.t('n.primer') : ''))]),
          p.racun ? OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () { OF.dijalog({ naslov: OF.t('r.fiskalni'), id: 'rac', sadrzaj: OF.h('div', { html: OF.placanje.racunHtml(p.racun) }) }); } }, OF.t('n.racun')) : null
        ]);
      }));
    }
    function sekcijaKodovi(lista) {
      if (!lista.length) return prazno(OF.t('n.nema_kodova'), OF.link((OF.d.prodaja || {}).stranicaKodova || 'pocetna'), OF.t('n.pogledaj'));
      return OF.h('ul', { class: 'of-kodovi', role: 'list' }, lista.map(function (k) {
        var iskoriscen = !!k.iskoriscen, istekao = k.vaziDo && k.vaziDo < OF.sad().iso;
        return OF.h('li', { class: 'of-kodovi__stavka' + (iskoriscen || istekao ? ' neaktivan' : '') }, [
          OF.h('span', null, [OF.h('strong', null, OF.tx(k.naziv)), OF.h('br'), k.tip === 'vaucer' ? OF.din(k.iznos) + ' · ' + OF.t('n.vazi_do', { datum: D.format(k.vaziDo, { day: 'numeric', month: 'numeric', year: 'numeric' }) }) : (k.opcije && k.opcije.datum ? D.dug(k.opcije.datum) : ''),
            iskoriscen ? ' · ' + OF.t('n.iskoriscen') : istekao ? ' · ' + OF.t('n.istekao') : '', k.primer ? ' · ' + OF.t('n.primer') : '']),
          OF.h('code', null, k.kod),
          OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { OF.pdf.kod(k); } }, OF.t('k.preuzmi_pdf'))
        ]);
      }));
    }
    function sekcijaBodovi(n, termini) {
      var l = L(), b = n.bodovi || 0, prag = (l.pragovi || [])[0];
      var deca = [OF.h('p', { class: 'of-nalog__bodovi' }, [OF.h('strong', null, String(b)), ' ' + OF.t('n.bodova')]), OF.h('p', null, OF.tx(l.opis))];
      if (l.pragovi) {
        deca.push(OF.h('ul', { class: 'of-nalog__pragovi', role: 'list' }, l.pragovi.map(function (p) {
          var dostupno = b >= p.bodova;
          return OF.h('li', { class: dostupno ? 'dostupno' : '' }, [OF.h('strong', null, OF.t('n.prag', { n: p.bodova })), ' ', OF.tx(p.nagrada), dostupno ? OF.h('span', { class: 'of-nalog__oznaka-dostupno' }, ' · ' + OF.t('n.dostupno')) : null]);
        })));
        if (prag && b < prag.bodova) deca.push(OF.h('div', { class: 'of-traka-napretka', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(prag.bodova), 'aria-valuenow': String(b), 'aria-label': OF.t('n.do_nagrade') }, OF.h('span', { style: { width: Math.min(100, b / prag.bodova * 100) + '%' } })));
      }
      return OF.h('div', null, deca);
    }
    function sekcijaPodaci(n) {
      var forma = OF.h('form', { class: 'of-forma', novalidate: true });
      var polja = [['ime', OF.t('f.ime'), 'text', 'name'], ['telefon', OF.t('f.telefon'), 'tel', 'tel']].concat((OF.d.nalogPolja || []).map(function (p) { return [p.ime, OF.tx(p.oznaka), p.tip || 'text', p.autocomplete || 'off']; }));
      polja.forEach(function (p) {
        forma.appendChild(OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'np-' + p[0] }, p[1]), OF.h('input', { id: 'np-' + p[0], name: p[0], type: p[2], autocomplete: p[3], value: n[p[0]] || '' })]));
      });
      if ((OF.d.zakazivanje || {}).podsetnikKontrola) {
        forma.appendChild(OF.h('div', { class: 'of-polje of-polje--cek' }, [OF.h('input', { type: 'checkbox', id: 'np-kontrola', name: 'podsetnikKontrola', checked: n.podsetnikKontrola !== false }), OF.h('label', { for: 'np-kontrola' }, OF.tx(OF.d.zakazivanje.podsetnikKontrola))]));
      }
      forma.appendChild(OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno' }, OF.t('n.sacuvaj'))]));
      forma.addEventListener('submit', function (e) {
        e.preventDefault();
        var pravila = { telefon: function (v) { return !v || OF.provera.telefon(v) ? '' : OF.t('g.telefon'); } };
        if (!OF.forma(forma, pravila)) return;
        Array.prototype.forEach.call(forma.elements, function (el) { if (el.name) n[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
        N.zapamti(n); OF.obavesti(OF.t('n.sacuvano'));
        if (!OF.demo) fetch(OF.int.api('/nalog/podaci'), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(n) }).catch(function () {});
      });
      var brisanje = OF.h('div', { class: 'of-nalog__brisanje' }, [
        OF.h('h3', { class: 'of-nalog__podnaslov' }, OF.t('n.brisanje_naslov')), OF.h('p', null, OF.t('n.brisanje_opis')),
        OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () {
          var dl = OF.dijalog({ naslov: OF.t('n.brisanje_naslov'), id: 'bris', sadrzaj: OF.h('div', null, [OF.h('p', null, OF.t('n.brisanje_pitanje')), OF.h('div', { class: 'of-zak__dugmad' }, [
            OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { dl.zatvori(); } }, OF.t('moj.ne_hvala')),
            OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: function () { N.obrisi(n.email); dl.zatvori(); OF.obavesti(OF.t('n.obrisano')); } }, OF.t('n.obrisi'))])]) });
        } }, OF.t('n.obrisi_podatke'))
      ]);
      return OF.h('div', null, [forma, brisanje]);
    }
  };
  /* brisanje svih podataka mušterije (lokalno; u pravom režimu i zahtev serveru) */
  N.obrisi = function (email) {
    OF.store.set('termini', (OF.store.get('termini', [])).filter(function (t) { return t.email !== email; }));
    OF.store.set('porudzbine', OF.store.get('porudzbine', []).filter(function (p) { return !p.kupac || p.kupac.email !== email; }));
    OF.store.set('kodovi', OF.store.get('kodovi', []).filter(function (k) { return k.kupac !== email; }));
    var sve = OF.store.get('nalozi', {}); delete sve[email]; OF.store.set('nalozi', sve);
    OF.emit('nalog.obrisi', email);                // moduli sajta brišu svoje (članstvo, vozila, garancije)
    if (!OF.demo) fetch(OF.int.api('/nalog/obrisi'), { method: 'POST', credentials: 'same-origin' }).catch(function () {});
    N.odjava();
  };

  /* mali prikaz u zaglavlju: „Nalog“ ili ime */
  function zaglavlje() {
    var n = N.prijavljen();
    OF.$$('[data-of-nalog-link]').forEach(function (a) {
      var t = OF.$('[data-of-nalog-tekst]', a) || a;
      t.textContent = n ? (n.ime ? n.ime.split(' ')[0] : OF.t('n.moj_nalog')) : OF.t('n.prijava');
    });
  }
  OF.spremno(function () { zaglavlje(); N.stranica(OF.$('[data-of-nalog]')); });
  OF.on('nalog', zaglavlje);
})(window, document);
