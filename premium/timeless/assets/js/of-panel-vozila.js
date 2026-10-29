/* opsforma Premium · panel vlasnika: vozila (detailing)
   Praćenje uživo (prijem → koraci → kontrola → gotovo, fotografije, merenja laka), izdavanje garantnog lista,
   članovi sa mesečnom naplatom (MRR, neuspele naplate), garancije i godišnji pregledi, cenovnik usluga po veličini vozila.
   U demo režimu sve ostaje u ovom pregledaču; poruke kupcu (SMS, mejl) vide se u „Integracije“. */
(function (w, d) {
  'use strict';
  var OF = w.OF, PN = OF.panel, D = OF.datum, P = OF.pracenje, G = OF.garancija, C = OF.clanstvo;
  if (!PN || !P) return;
  var kartica = function (oznaka, vrednost, opis) { return OF.h('div', { class: 'of-panel__kartica' }, [OF.h('p', { class: 'of-panel__kartica-oznaka' }, oznaka), OF.h('p', { class: 'of-panel__kartica-vrednost' }, vrednost), opis ? OF.h('p', { class: 'of-panel__kartica-opis' }, opis) : null]); };
  var usluga = function (id) { return (OF.d.usluge || []).filter(function (u) { return u.id === id; })[0]; };
  var sada = function () { return D.uHHMM(OF.sad().min); };

  /* ---------- cenovnik: usluge (cena za srednje vozilo; ostale veličine se računaju), dodaci, članstvo, pa proizvodi ---------- */
  var proizvodiCene = OF.d.panelCene;
  OF.d.panelCene = function () {
    var g = function (u) { return OF.t('pv.grupa_usluga', { grupa: OF.tx(u.kategorija) }); };
    var lista = (OF.d.usluge || []).filter(function (u) { return !u.naUpit; }).map(function (u) { return { id: u.id, naziv: OF.tx(u.naziv) + (u.istaCena ? '' : ' · ' + OF.t('pv.srednje')), grupa: g(u), cena: u.cena }; });
    lista = lista.concat((OF.d.dodaci || []).map(function (x) { return { id: 'dodatak-' + x.id, naziv: OF.tx(x.naziv) + (x.istaCena ? '' : ' · ' + OF.t('pv.srednje')), grupa: OF.t('pv.dodaci'), cena: x.cena }; }));
    if (C) C.planovi().forEach(function (p) { p.cene.forEach(function (c, i) { lista.push({ id: 'clanstvo-' + p.id + '-' + i, naziv: OF.tx(p.naziv) + ' · ' + OF.tx(((OF.d.clanstvo || {}).velicine || [])[i] || String(i)), grupa: OF.t('pv.clanarine'), cena: c }); }); });
    return lista.concat(proizvodiCene ? proizvodiCene() : []);
  };

  /* ---------- vozila: pravi termini + primer za danas ---------- */
  var primeri = function () { return OF.store.get('pracenje-primeri', {}); };
  function vozilaZaPracenje() {
    var danas = OF.sad().iso;
    var prave = (OF.zak ? OF.zak.termini() : []).filter(function (t) { return t.tip === 'vozilo' && t.status !== 'otkazan' && !t.primer && (t.datum === danas || (t.datum < danas && t.pracenje && t.pracenje.faza < 3)); });
    var stanje = primeri();
    var demo = OF.demo ? PN.terminiDana(danas).filter(function (t) { return t.primer && t.tip === 'vozilo'; }).map(function (t, i) {
      var u = (OF.d.usluge || []).filter(function (x) { return OF.tx(x.naziv) === t.paketNaziv || x.id === t.paket; })[0] || (OF.d.usluge || [])[[3, 6, 0, 1, 4][i % 5]];
      var s = stanje[t.id];
      var x = Object.assign({}, t, { paket: u.id, paketNaziv: OF.tx(u.naziv), email: 'kupac' + i + '@primer.rs', token: 'primer' });
      x.pracenje = s || (t.faza > 0 ? { faza: Math.min(3, t.faza), korak: 1, slike: [{ vreme: t.vreme, faza: 0, src: P.slikaDemo(0), opis: OF.tn('pv.prijem_slike', 24) }] } : null);
      if (x.pracenje) x.stigao = x.stigao || (danas + 'T' + t.vreme + ':00Z');
      return x;
    }) : [];
    return prave.concat(demo).sort(function (a, b) { return (a.datum + a.vreme) < (b.datum + b.vreme) ? -1 : 1; });
  }
  // isto stanje i u sekciji Termini
  PN.fazaVozila = function (t) {
    if (t.primer) { var s = primeri()[t.id]; return s ? s.faza : (t.faza > 0 ? Math.min(3, t.faza) : -1); }
    return t.pracenje ? t.pracenje.faza : -1;
  };
  function sacuvajStanje(t, pr) {
    if (t.primer) { var s = primeri(); s[t.id] = pr; OF.store.set('pracenje-primeri', s); return; }
    OF.store.izmeni('termini', t.id, function (x) { x.pracenje = pr; if (pr && !x.stigao) x.stigao = new Date().toISOString(); return x; });
    if (!OF.demo) posaljiPanel('/panel/pracenje', { id: t.id, pracenje: pr }).then(function (r) {   // pravi režim: stanje je u bazi, kupac ga vidi na praćenju
      if (r && r.pracenje) { t.pracenje = r.pracenje; OF.store.izmeni('termini', t.id, function (x) { x.pracenje = r.pracenje; return x; }); }
    });
  }
  function posaljiPanel(put, telo) {
    return fetch(OF.int.api(put), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(telo) })
      .then(function (r) { return r.json().then(function (o) { if (!r.ok) throw o; return o; }); })
      .catch(function (e) { OF.obavesti((e && e.poruka) || OF.t('zak.server_greska'), 'greska'); return null; });
  }
  function pomeri(t) {
    var koraci = P.koraci(t.paket), pr = JSON.parse(JSON.stringify(t.pracenje || { faza: -1, korak: 0, slike: [] }));
    if (pr.faza < 0) { pr.faza = 0; pr.korak = 0; pr.slike = [{ vreme: sada(), faza: 0, src: P.slikaDemo(0), opis: OF.tn('pv.prijem_slike', 24) }]; }
    else if (pr.faza === 0) { pr.faza = 1; pr.korak = 0; pr.slike.push({ vreme: sada(), faza: 1, src: P.slikaDemo(1), opis: koraci[0], korak: 0 }); }
    else if (pr.faza === 1 && pr.korak < koraci.length - 1) { pr.korak++; pr.slike.push({ vreme: sada(), faza: 1, src: P.slikaDemo(pr.korak + 1), opis: koraci[pr.korak], korak: pr.korak }); }
    else if (pr.faza === 1) { pr.faza = 2; pr.slike.push({ vreme: sada(), faza: 2, src: P.slikaDemo(7), opis: OF.t('pc.kontrola_svetlo') }); }
    else if (pr.faza === 2) { pr.faza = 3; pr.gotovo = sada(); }
    sacuvajStanje(t, pr); t.pracenje = pr;
    if (pr.faza === 0 || pr.faza === 3 || (pr.faza === 1 && pr.korak === 0)) OF.int.dogadjaj('pracenje.korak', { termin: t, faza: pr.faza, korak: pr.faza === 1 ? koraci[pr.korak] : '' });
    OF.obavesti(pr.faza === 0 ? OF.t('pv.primljeno_sms') : pr.faza === 3 ? OF.t('pv.gotovo_sms') : OF.t('pv.korak_upisan'));
  }
  function dodajFotografiju(t, gotovo) {
    var ulaz = OF.h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });
    d.body.appendChild(ulaz);
    ulaz.addEventListener('change', function () {
      var f = ulaz.files && ulaz.files[0]; ulaz.remove(); if (!f) return;
      var img = new Image(), url = URL.createObjectURL(f);
      img.onload = function () {
        var k = Math.min(1, 900 / Math.max(img.width, img.height)), c = d.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        var src = c.toDataURL('image/jpeg', 0.72);
        if (!OF.demo && !t.primer) {                          // pravi režim: fotografija ide u skladište (R2), stanje se vraća sa servera
          posaljiPanel('/panel/foto', { id: t.id, slika: src, opis: (t.pracenje || {}).faza === 1 ? P.koraci(t.paket)[(t.pracenje || {}).korak || 0] : OF.t('pv.fotografija') }).then(function (r) {
            if (r && r.pracenje) { t.pracenje = r.pracenje; OF.store.izmeni('termini', t.id, function (x) { x.pracenje = r.pracenje; return x; }); OF.obavesti(OF.t('pv.slika_dodata')); gotovo(); }
          });
          return;
        }
        var pr = JSON.parse(JSON.stringify(t.pracenje || { faza: 0, korak: 0, slike: [] }));
        var vlastite = pr.slike.filter(function (s) { return s.vlastita; }).length;
        if (OF.demo && vlastite >= 3) { OF.obavesti(OF.t('pv.max_slika'), 'greska'); return; }
        pr.slike.push({ vreme: sada(), faza: Math.max(0, pr.faza), src: src, opis: pr.faza === 1 ? P.koraci(t.paket)[pr.korak] : OF.t('pv.fotografija'), korak: pr.faza === 1 ? pr.korak : null, vlastita: true });
        try { sacuvajStanje(t, pr); t.pracenje = pr; OF.obavesti(OF.t('pv.slika_dodata')); } catch (e) { OF.obavesti(OF.t('pv.slika_prevelika'), 'greska'); }
        gotovo();
      };
      img.src = url;
    });
    ulaz.click();
  }
  function merenja(t, gotovo) {
    var T = (OF.d.garancija || {}).tacke || [], pr = t.pracenje || {}, m = pr.merenja || { pre: {}, posle: {} };
    var forma = OF.h('form', { class: 'of-forma of-cene', novalidate: true });
    forma.appendChild(OF.h('p', null, OF.t('pv.merenja_opis')));
    T.forEach(function (x) {
      forma.appendChild(OF.h('div', { class: 'of-cene__red' }, [OF.h('span', { class: 'of-cene__naziv' }, OF.tx(x.naziv)),
        OF.h('label', { class: 'of-cene__polje' }, [OF.h('span', null, OF.t('gl.pre')), OF.h('input', { type: 'number', min: '20', max: '600', step: '1', inputmode: 'numeric', name: 'pre|' + x.id, value: m.pre[x.id] || '' })]),
        OF.h('label', { class: 'of-cene__polje' }, [OF.h('span', null, OF.t('gl.posle')), OF.h('input', { type: 'number', min: '20', max: '600', step: '1', inputmode: 'numeric', name: 'posle|' + x.id, value: m.posle[x.id] || '' })])]));
    });
    if (OF.demo) forma.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () {
      var dm = OF.d.demoMerenje || {};
      T.forEach(function (x) { var v = dm[x.id] || 110; forma.elements['pre|' + x.id].value = v; forma.elements['posle|' + x.id].value = Math.max(60, v - 3 - Math.round(OF.seme(t.id + x.id) * 3)); });
    } }, OF.t('pv.popuni_primer')));
    forma.appendChild(OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno' }, OF.t('n.sacuvaj'))]));
    var dl = OF.dijalog({ naslov: OF.t('pv.merenja') + ' · ' + t.registracija, id: 'mer', sadrzaj: forma });
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var nova = { pre: {}, posle: {} };
      var lose = null;
      Array.prototype.forEach.call(forma.elements, function (el) { if (el.name && el.value) { var v = Math.round(+el.value), p = el.name.split('|'); if (!(v >= 20 && v <= 600)) lose = lose || el; else nova[p[0]][p[1]] = v; } });
      var stara = OF.$('.of-panel__greska', forma); if (stara) stara.remove();
      var greska = lose ? OF.t('pv.merenja_opseg') : !Object.keys(nova.pre).length && !Object.keys(nova.posle).length ? OF.t('pv.merenja_prazno') : '';
      if (greska) { forma.insertBefore(OF.h('p', { class: 'of-pl__greska of-panel__greska', role: 'alert' }, greska), forma.lastChild); (lose || forma.elements[0]).focus(); return; }
      var x = JSON.parse(JSON.stringify(t.pracenje || { faza: 0, korak: 0, slike: [] })); x.merenja = nova;
      sacuvajStanje(t, x); t.pracenje = x; dl.zatvori(); OF.obavesti(OF.t('n.sacuvano')); gotovo();
    });
  }
  function izdajGarantni(t, gotovo) {
    var m = (t.pracenje || {}).merenja || { pre: {}, posle: {} };
    if (!Object.keys(m.posle || {}).length) { OF.obavesti(OF.t('pv.prvo_merenja'), 'greska'); merenja(t, gotovo); return; }
    var forma = OF.h('form', { class: 'of-forma', novalidate: true }, [
      OF.h('p', null, OF.t('pv.garantni_opis', { usluga: OF.tx((usluga(t.paket) || {}).naziv), reg: t.registracija })),
      OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'gl-sasija' }, OF.t('pv.sasija')), OF.h('p', { class: 'of-polje__pomoc' }, OF.t('pv.sasija_pomoc')), OF.h('input', { id: 'gl-sasija', name: 'sasija', maxlength: '6', autocapitalize: 'characters', autocomplete: 'off', value: OF.demo ? 'K' + String(204500 + Math.floor(OF.seme(t.id) * 99)).slice(1) : '' })]),
      OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno' }, OF.t('pv.izdaj'))])]);
    var dl = OF.dijalog({ naslov: OF.t('pv.garantni'), id: 'gar', sadrzaj: forma });
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!OF.forma(forma, { sasija: function (v) { return /^[A-Z0-9]{6}$/i.test(String(v).trim()) ? '' : OF.t('pv.g_sasija'); } })) return;
      var sasija = '…' + forma.elements.sasija.value.trim().toUpperCase();
      if (!OF.demo && !t.primer) {                            // pravi režim: broj daje server (redom u godini), PDF ide kupcu mejlom
        OF.int.dogadjaj('garancija.izdata', { garancija: { termin: t.id, sasija: sasija } }).then(function (r) {
          if (!r || !r.garancija) { OF.obavesti((r && r.poruka) || OF.t('zak.server_greska'), 'greska'); return; }
          var g = r.garancija; OF.store.set('garantni', [g].concat(G.sve().filter(function (y) { return y.broj !== g.broj; })));
          var x = JSON.parse(JSON.stringify(t.pracenje)); x.garantni = g.broj; sacuvajStanje(t, x); t.pracenje = x;
          dl.zatvori(); OF.obavesti(OF.t('pv.garantni_izdat', { broj: g.broj })); gotovo(); G.pdf(g);
        });
        return;
      }
      var g = G.novi(t, { pre: m.pre, posle: m.posle, sasija: sasija });
      var x = JSON.parse(JSON.stringify(t.pracenje)); x.garantni = g.broj; sacuvajStanje(t, x); t.pracenje = x;
      OF.int.dogadjaj('garancija.izdata', { garancija: g }).then(function () {
        dl.zatvori(); OF.obavesti(OF.t('pv.garantni_izdat', { broj: g.broj })); gotovo();
        G.pdf(g);
      });
    });
  }

  function sekcijaPracenje(s) {
    var lista = vozilaZaPracenje(), F = (OF.d.pracenje || {}).faze || [];
    var u = { ceka: 0, radi: 0, gotovo: 0 };
    lista.forEach(function (t) { var f = t.pracenje ? t.pracenje.faza : -1; if (f < 0) u.ceka++; else if (f < 3) u.radi++; else u.gotovo++; });
    s.appendChild(OF.h('div', { class: 'of-panel__kartice' }, [kartica(OF.t('pv.ceka_prijem'), String(u.ceka)), kartica(OF.t('pv.u_radu'), String(u.radi)), kartica(OF.t('pv.gotova'), String(u.gotovo), OF.t('pv.radna_mesta', { n: (OF.d.zakazivanje || {}).radnaMesta || 2 }))]));
    s.appendChild(OF.h('p', { class: 'of-panel__opis' }, OF.t('pv.pracenje_opis')));
    if (!lista.length) { s.appendChild(OF.h('p', { class: 'of-panel__demo' }, OF.t('pv.nema_vozila'))); return; }
    var ponovo = function () { s.innerHTML = ''; s.appendChild(OF.h('h1', { class: 'of-panel__naslov' }, OF.t('pv.pracenje'))); sekcijaPracenje(s); };
    s.appendChild(OF.h('ul', { class: 'of-panel__lista', role: 'list' }, lista.map(function (t) {
      var pr = t.pracenje || { faza: -1, korak: 0, slike: [] }, koraci = P.koraci(t.paket), u2 = usluga(t.paket) || {};
      var garancija = u2.grupa === 'keramika' || u2.grupa === 'folija';
      var tekst = pr.faza < 0 ? OF.t('pv.ostavljanje_u', { vreme: D.vreme(t.vreme) }) : pr.faza === 1 ? koraci[pr.korak] + ' (' + (pr.korak + 1) + '/' + koraci.length + ')' : OF.tx((F[pr.faza] || {}).opis);
      var akcije = [];
      if (pr.faza < 3) akcije.push(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: function () { pomeri(t); ponovo(); } }, pr.faza < 0 ? OF.t('p.vozilo_primljeno') : pr.faza === 2 ? OF.t('pv.oznaci_gotovo') : OF.t('pv.sledeci_korak')));
      if (pr.faza >= 0) akcije.push(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { dodajFotografiju(t, ponovo); } }, OF.t('pv.dodaj_sliku')));
      if (pr.faza >= 0 && garancija) akcije.push(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { merenja(t, ponovo); } }, OF.t('pv.merenja')));
      if (pr.faza >= 2 && garancija && !pr.garantni) akcije.push(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { izdajGarantni(t, ponovo); } }, OF.t('pv.izdaj_garantni')));
      if (pr.garantni) akcije.push(OF.h('span', { class: 'of-panel__znacka of-panel__znacka--ok' }, OF.t('pv.garantni_br', { broj: pr.garantni })));
      akcije.push(OF.h('a', { class: 'of-dugme of-dugme--tekst', href: t.primer ? OF.link('pracenje', 'primer=1') : P.link(t), target: '_blank', rel: 'noopener' }, OF.t('pv.kako_vidi')));
      return OF.h('li', { class: 'of-panel__vozilo' }, [
        OF.h('div', null, [OF.h('strong', null, D.vreme(t.vreme) + ' · ' + (t.registracija || '')), OF.h('p', null, [t.vozilo, t.paketNaziv, t.ime].filter(Boolean).join(' · ')), OF.h('p', { class: 'of-panel__kartica-opis' }, tekst + (pr.slike && pr.slike.length ? ' · ' + OF.tn('pv.slika_n', pr.slike.length) : '') + (t.primer ? ' · ' + OF.t('n.primer') : ''))]),
        F.length ? OF.h('ol', { class: 'of-faze', 'aria-label': OF.t('p.faza') }, F.map(function (f, i) { return OF.h('li', { class: i < pr.faza ? 'gotovo' : i === pr.faza ? 'trenutno' : '', 'aria-current': i === pr.faza ? 'step' : null }, OF.tx(f.naziv)); })) : null,
        OF.h('div', { class: 'of-zak__dugmad' }, akcije)
      ]);
    })));
    if (OF.demo) s.appendChild(OF.h('p', { class: 'of-panel__demo' }, OF.t('pv.demo_pracenje')));
  }

  /* ---------- članovi ---------- */
  function svaClanstva() {
    var danas = OF.sad().iso, prava = C ? C.sva().filter(function (c) { return !c.primer; }) : [];
    var demo = OF.demo ? ((OF.d.demo || {}).clanovi || []).map(function (x, i) {
      var od = D.dodaj(danas, x.od), sled = od; while (sled <= danas) sled = C.dodajMesec(sled, 1);
      var iznos = C.cena(x.plan, x.velicina);
      var naplate = []; for (var dt = od; dt <= danas; dt = C.dodajMesec(dt, 1)) naplate.push({ datum: dt, iznos: iznos, ok: !(x.status === 'neuspela-naplata' && C.dodajMesec(dt, 1) > danas) });
      return { id: 'C-PR' + (i + 1), ime: x.ime, email: 'clan' + i + '@primer.rs', telefon: '060 000 0' + (100 + i), plan: x.plan, velicina: x.velicina, registracija: x.registracija, vozilo: '', status: x.status, od: od,
        sledecaNaplata: x.status === 'neuspela-naplata' ? C.dodajMesec(sled, -1) : sled, iznos: iznos, kartica: '•••• ' + (4242 + i * 7), naplate: naplate, primer: true, pauzaDo: x.status === 'pauza' ? C.dodajMesec(sled, 1) : null };
    }) : [];
    var izmene = OF.store.get('clanovi-primer-izmene', {});
    demo.forEach(function (c) { if (izmene[c.id]) Object.assign(c, izmene[c.id]); });
    return prava.concat(demo);
  }
  function izmeniPrimer(c, x) { var iz = OF.store.get('clanovi-primer-izmene', {}); iz[c.id] = Object.assign(iz[c.id] || {}, x); OF.store.set('clanovi-primer-izmene', iz); }
  function sekcijaClanovi(s) {
    if (!C) return;
    var sva = svaClanstva(), danas = OF.sad().iso, za7 = D.dodaj(danas, 7);
    var aktivni = sva.filter(function (c) { return c.status === 'aktivno'; });
    var mrr = aktivni.reduce(function (a, c) { return a + (c.iznos || 0); }, 0);
    var uskoro = aktivni.filter(function (c) { return c.sledecaNaplata >= danas && c.sledecaNaplata <= za7; });
    var neuspele = sva.filter(function (c) { return c.status === 'neuspela-naplata'; });
    s.appendChild(OF.h('div', { class: 'of-panel__kartice' }, [
      kartica(OF.t('pv.aktivni'), String(aktivni.length), OF.t('pv.na_pauzi', { n: sva.filter(function (c) { return c.status === 'pauza'; }).length })),
      kartica(OF.t('pv.mrr'), OF.din(mrr), OF.t('pv.mrr_opis')),
      kartica(OF.t('pv.naplate_7'), OF.din(uskoro.reduce(function (a, c) { return a + c.iznos; }, 0)), OF.t('pv.clanova_n', { n: uskoro.length })),
      kartica(OF.t('pv.neuspele'), String(neuspele.length), neuspele.length ? OF.t('pv.neuspele_opis', { dana: (OF.d.clanstvo || {}).ponovniPokusajDana || 3 }) : '')
    ]));
    // prihod po mesecima (poslednjih 6)
    var meseci = []; for (var k = 5; k >= 0; k--) { var m = C.dodajMesec(danas.slice(0, 8) + '01', -k).slice(0, 7); meseci.push({ oznaka: D.format(m + '-01', { month: 'long', year: 'numeric' }), kratko: D.format(m + '-01', { month: 'short' }), v: 0, istaknuto: k === 0 }); }
    sva.forEach(function (c) { (c.naplate || []).forEach(function (n) { if (!n.ok) return; var x = meseci.filter(function (mm, i) { return n.datum.slice(0, 7) === C.dodajMesec(danas.slice(0, 8) + '01', -(5 - i)).slice(0, 7); })[0]; if (x) x.v += n.iznos; }); });
    s.appendChild(OF.h('h2', { class: 'of-panel__podnaslov' }, OF.t('pv.prihod_clanarine')));
    s.appendChild(OF.h('div', { html: PN.stubici(meseci, { naslov: OF.t('pv.prihod_clanarine'), format: function (v) { return OF.broj(v / 1000) + 'k'; } }) }));
    s.appendChild(OF.h('h2', { class: 'of-panel__podnaslov' }, OF.t('pv.clanovi')));
    var ponovo = function () { s.innerHTML = ''; s.appendChild(OF.h('h1', { class: 'of-panel__naslov' }, OF.t('pv.clanovi'))); sekcijaClanovi(s); };
    var tabela = OF.h('table', { class: 'of-tabela-podataka' }, [OF.h('thead', null, OF.h('tr', null, [OF.t('f.ime'), OF.t('cl.plan'), OF.t('cl.vozilo'), OF.t('pv.od'), OF.t('cl.sledeca'), OF.t('pv.iznos'), OF.t('pv.status')].map(function (x) { return OF.h('th', { scope: 'col' }, x); }))),
      OF.h('tbody', null, sva.map(function (c) {
        var akcija = c.status === 'neuspela-naplata' ? OF.h('button', { type: 'button', class: 'of-dugme of-dugme--mini', onclick: function () {
          var x = { status: 'aktivno', sledecaNaplata: C.dodajMesec(danas, 1), naplate: (c.naplate || []).concat([{ datum: danas, iznos: c.iznos, ok: true }]) };
          if (c.primer) izmeniPrimer(c, x); else C.izmeni(c.id, function (y) { return Object.assign(y, x); });
          OF.int.dogadjaj('clanstvo.naplata', { clanstvo: Object.assign({}, c, x), iznos: c.iznos }).then(function () { OF.obavesti(OF.t('pv.naplata_ponovljena')); ponovo(); });
        } }, OF.t('pv.pokusaj_ponovo')) : null;
        return OF.h('tr', null, [OF.h('td', null, [c.ime, c.primer ? OF.h('small', null, ' · ' + OF.t('n.primer')) : null]), OF.h('td', null, OF.tx((C.plan(c.plan) || {}).naziv)), OF.h('td', null, c.registracija || ''), OF.h('td', null, D.kratko(c.od)),
          OF.h('td', null, c.status === 'aktivno' || c.status === 'neuspela-naplata' ? D.kratko(c.sledecaNaplata) : '–'), OF.h('td', { class: 'broj' }, OF.din(c.iznos)), OF.h('td', null, [C.nazivStatusa(c.status), akcija ? OF.h('div', { class: 'of-panel__akcija' }, akcija) : null])]);
      }))]);
    s.appendChild(OF.h('div', { class: 'of-tabela__okvir', tabindex: '0', role: 'region', 'aria-label': OF.t('pv.clanovi') }, tabela));
    s.appendChild(OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () {
      PN.csv('clanovi', [OF.t('cl.broj'), OF.t('f.ime'), OF.t('f.email'), OF.t('f.telefon'), OF.t('cl.plan'), OF.t('cl.registracija'), OF.t('pv.od'), OF.t('cl.sledeca'), OF.t('pv.iznos'), OF.t('pv.status')],
        sva.map(function (c) { return [c.id, c.ime, c.email, c.telefon, OF.tx((C.plan(c.plan) || {}).naziv), c.registracija, c.od, c.sledecaNaplata, c.iznos, C.nazivStatusa(c.status)]; }));
    } }, OF.t('p.izvoz_csv'))]));
    s.appendChild(OF.h('p', { class: 'of-panel__demo' }, OF.t(OF.demo ? 'pv.clanovi_demo' : 'pv.clanovi_pravi')));
  }

  /* ---------- garancije ---------- */
  function sekcijaGarancije(s) {
    var danas = OF.sad().iso, sve = G.sve().slice();
    var p = G.primer(); if (p && OF.demo && !sve.some(function (g) { return g.broj === p.broj; })) sve.push(p);
    if (OF.demo) sve = sve.concat(primeriGarancija());
    var zaPregled = [];
    sve.forEach(function (g) { G.pregledi(g).forEach(function (pr) { if (!pr.obavljen && pr.do >= danas && pr.od <= D.dodaj(danas, 31)) zaPregled.push({ g: g, pr: pr }); }); });
    s.appendChild(OF.h('div', { class: 'of-panel__kartice' }, [kartica(OF.t('pv.garancije_aktivne'), String(sve.filter(function (g) { return G.status(g) !== 'istekao'; }).length)), kartica(OF.t('pv.pregledi_uskoro'), String(zaPregled.length), OF.t('pv.pregledi_opis'))]));
    var ponovo = function () { s.innerHTML = ''; s.appendChild(OF.h('h1', { class: 'of-panel__naslov' }, OF.t('pv.garancije'))); sekcijaGarancije(s); };
    if (zaPregled.length) {
      s.appendChild(OF.h('h2', { class: 'of-panel__podnaslov' }, OF.t('pv.pregledi_uskoro')));
      s.appendChild(OF.h('ul', { class: 'of-panel__lista', role: 'list' }, zaPregled.map(function (x) {
        return OF.h('li', { class: 'of-panel__vozilo' }, [OF.h('div', null, [OF.h('strong', null, x.g.registracija + ' · ' + x.g.broj), OF.h('p', null, D.dug(x.pr.od) + ' – ' + D.dug(x.pr.do))]),
          OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { OF.int.dogadjaj('garancija.podsetnik', { garancija: x.g, od: x.pr.od, do: x.pr.do }).then(function () { OF.obavesti(OF.t('pv.podsetnik_poslat')); }); } }, OF.t('pv.posalji_podsetnik')),
            OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () { upisiPregled(x.g); ponovo(); } }, OF.t('pv.upisi_pregled'))])]);
      })));
    }
    s.appendChild(OF.h('h2', { class: 'of-panel__podnaslov' }, OF.t('pv.izdati')));
    if (!sve.length) { s.appendChild(OF.h('p', null, OF.t('gl.nema'))); return; }
    var sGodinom = function (iso) { return D.format(iso, { day: 'numeric', month: 'numeric', year: 'numeric' }); };
    var tabela = OF.h('table', { class: 'of-tabela-podataka' }, [OF.h('thead', null, OF.h('tr', null, [OF.t('pv.k_broj'), OF.t('pv.k_registracija'), OF.t('gl.usluga'), OF.t('pv.k_naneto'), OF.t('gl.vazi_do'), OF.t('pv.status'), ''].map(function (x) { return OF.h('th', { scope: 'col' }, x); }))),
      OF.h('tbody', null, sve.map(function (g) {
        return OF.h('tr', null, [OF.h('td', null, [g.broj, g.primer ? OF.h('small', null, ' · ' + OF.t('n.primer')) : null]), OF.h('td', null, g.registracija), OF.h('td', null, OF.tx((usluga(g.usluga) || {}).naziv)), OF.h('td', null, sGodinom(g.datum)), OF.h('td', null, sGodinom(G.vaziDo(g))), OF.h('td', null, OF.t('gl.status_' + G.status(g))),
          OF.h('td', null, OF.h('button', { type: 'button', class: 'of-dugme of-dugme--mini', onclick: function () { G.pdf(g); } }, 'PDF'))]);
      }))]);
    s.appendChild(OF.h('div', { class: 'of-tabela__okvir', tabindex: '0', role: 'region', 'aria-label': OF.t('pv.izdati') }, tabela));
  }
  function upisiPregled(g) {
    if (!OF.demo && !g.primer) { OF.int.dogadjaj('garancija.pregled', { garancija: { broj: g.broj } }).then(function (r) { if (r && r.garancija) OF.store.set('garantni', G.sve().map(function (y) { return y.broj === g.broj ? r.garancija : y; })); }); }
    if (g.primer) { var iz = OF.store.get('garantni-primer-pregledi', {}); iz[g.broj] = (iz[g.broj] || []).concat([{ datum: OF.sad().iso }]); OF.store.set('garantni-primer-pregledi', iz); }
    else OF.store.set('garantni', G.sve().map(function (x) { if (x.broj === g.broj) { x.pregledi = (x.pregledi || []).concat([{ datum: OF.sad().iso }]); } return x; }));
    OF.obavesti(OF.t('pv.pregled_upisan'));
  }
  /* demo: još nekoliko garantnih listova, datumi u odnosu na danas (godišnji pregled koji uskoro ističe) */
  function primeriGarancija() {
    var danas = OF.sad().iso, iz = OF.store.get('garantni-primer-pregledi', {}), p = G.primer() || {};
    return ((OF.d.demo || {}).garantniPanel || []).map(function (x) {
      var g = Object.assign({ primer: true, pre: {}, posle: p.posle || {}, sasija: '' }, x, { datum: D.dodaj(danas, x.dana) });
      g.pregledi = (x.preglediDana || []).map(function (d) { return { datum: D.dodaj(danas, d) }; }).concat(iz[g.broj] || []);
      return g;
    });
  }
  // upisani pregledi važe i za glavni primer garantnog lista
  var primerPregledi = G && G.primer;
  if (G) G.primer = function () { var g = primerPregledi(); if (g) { var iz = OF.store.get('garantni-primer-pregledi', {}); g.pregledi = g.pregledi.concat(iz[g.broj] || []); } return g; };

  PN.sekcije.push({ id: 'pracenje', naziv: OF.t('pv.pracenje'), crtaj: sekcijaPracenje, posle: 'termini' });
  if (C) PN.sekcije.push({ id: 'clanovi', naziv: OF.t('pv.clanovi'), crtaj: sekcijaClanovi, posle: 'termini' });
  if (G) PN.sekcije.push({ id: 'garancije', naziv: OF.t('pv.garancije'), crtaj: sekcijaGarancije, posle: 'termini' });
})(window, document);
