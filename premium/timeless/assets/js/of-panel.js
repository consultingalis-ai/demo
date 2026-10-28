/* opsforma Premium · panel vlasnika (/panel/)
   Termini i rezervacije po danu i po osobi, prodaja sa grafikonima, provera vaučera, ulaznica i dolazaka
   skeniranjem QR koda, izmena cenovnika, mušterije, izvoz u CSV i pregled svih integracija.
   DEMO: podaci su iz ovog pregledača (localStorage) + stalni primer podaci da panel ne bude prazan.
   PRAVI: panel je zaštićen (Cloudflare Access) i čita iste podatke sa servera (/api/panel/*). */
(function (w, d) {
  'use strict';
  var OF = w.OF, P = OF.panel = { sekcije: [] }, D = OF.datum, Z = function () { return OF.zak; };
  var cfg = function () { return (OF.c.panel || {}); };
  var tip = function () { return (OF.d.zakazivanje || {}).tip || null; };

  /* ---------- podaci ---------- */
  /* termini dana: stvarni (lokalni) + primer (demo) */
  P.terminiDana = function (iso) {
    var rez = [];
    var stvarni = OF.zak ? OF.zak.termini().filter(function (t) { return t.datum === iso && t.status !== 'otkazan'; }) : [];
    stvarni.forEach(function (t) { rez.push(Object.assign({ izvor: 'sajt' }, t)); });
    if (OF.demo && OF.zak) {
      if (tip() === 'termin') {
        (OF.d.tim || []).forEach(function (o) {
          if (o.bezZakazivanja) return;
          var iv = OF.zak.intervaliOsobe(o.id, iso);
          OF.zak.zauzetoDemo(o.id, iso, iv).forEach(function (b, i) {
            var usl = (OF.d.usluge || []).filter(function (u) { return (u.osobe || []).indexOf(o.id) >= 0 && u.online !== false; });
            var duz = b.do - b.od;   // usluga koja odgovara dužini bloka
            var pas = usl.filter(function (u) { return u.trajanje <= duz && u.trajanje > duz - 30; }); if (!pas.length) pas = usl.filter(function (u) { return u.trajanje <= duz; }); if (!pas.length) pas = usl;
            var u = pas[Math.floor(OF.seme(iso + o.id + i) * pas.length)] || {};
            rez.push({ id: 'PR-' + o.id.slice(0, 2).toUpperCase() + (b.od), tip: 'termin', datum: iso, vreme: D.uHHMM(b.od), trajanje: Math.min(duz, u.trajanje || duz), osoba: o.id, usluga: u.id, ime: b.ime, telefon: '060 000 ' + String(1000 + Math.floor(OF.seme(b.ime + iso) * 8999)).replace(/(\d\d)(\d\d)/, '$1 $2'), primer: true, izvor: 'primer', status: iso < OF.sad().iso ? 'obavljen' : 'potvrdjen' });
          });
        });
      } else if (tip() === 'sto') {
        ((OF.d.zakazivanje || {}).prostori || []).forEach(function (p) {
          (p.stolovi || []).forEach(function (s) {
            var iv = OF.intervali(iso);
            iv.forEach(function (a) {
              OF.zak.zauzetoDemo(p.id + '-' + s.id, iso, [[a[0], a[1]]], (OF.d.zakazivanje || {}).demoZauzetost || 0.38).forEach(function (b) {
                rez.push({ id: 'PR-' + s.id + b.od, tip: 'sto', datum: iso, vreme: D.uHHMM(b.od % 1440), trajanje: 120, prostor: p.id, sto: p.id + '-' + s.id, osobe: Math.max(1, Math.min(s.mesta, 2 + Math.floor(OF.seme(b.ime) * (s.mesta - 1)))), ime: b.ime, telefon: '060 000 00 00', primer: true, izvor: 'primer', status: 'potvrdjen' });
              });
            });
          });
        });
      } else if (tip() === 'vozilo') {
        var n = OF.intervali(iso).length ? 2 + Math.floor(OF.seme('voz' + iso) * 3) : 0;
        var paketi = (OF.d.demo && OF.d.demo.paketi) || ['Pranje i zaštita'];
        var vozila = (OF.d.demo && OF.d.demo.vozila) || ['Škoda Octavia'];
        for (var i = 0; i < n; i++) {
          var r = OF.seme(iso + 'v' + i);
          rez.push({ id: 'PR-V' + i + iso.slice(8), tip: 'vozilo', datum: iso, vreme: ['08:00', '08:30', '09:00', '09:30', '10:00'][i % 5], trajanje: 30, paketNaziv: paketi[Math.floor(r * paketi.length)], vozilo: vozila[Math.floor(OF.seme(iso + 'vz' + i) * vozila.length)], registracija: 'BG ' + (100 + Math.floor(r * 899)) + '-' + 'ABCDEFGHJK'[i] + 'X', ime: (OF.zak && OF.seme ? ['Marko S.', 'Ivana P.', 'Nenad K.', 'Sanja M.', 'Bojan T.'][i % 5] : ''), telefon: '060 000 00 00', primer: true, izvor: 'primer', faza: iso < OF.sad().iso ? 3 : iso === OF.sad().iso ? Math.min(3, i) : 0, status: 'potvrdjen' });
        }
      }
    }
    return rez.sort(function (a, b) { return a.vreme < b.vreme ? -1 : 1; });
  };

  /* porudžbine: stvarne + primer istorija (30 dana) */
  P.porudzbine = function () {
    var stvarne = OF.store.get('porudzbine', []).map(function (p) { return Object.assign({ izvor: p.primer ? 'primer' : 'sajt' }, p); });
    if (!OF.demo || !(OF.d.demo && OF.d.demo.prodaja)) return stvarne;
    var dp = OF.d.demo.prodaja, artikli = dp.artikli || [], danas = OF.sad().iso, primer = [];
    for (var k = 29; k >= 0; k--) {
      var iso = D.dodaj(danas, -k), n = Math.floor((dp.dnevno[0] + OF.seme('dan' + iso) * (dp.dnevno[1] - dp.dnevno[0])) * (D.danUNedelji(iso) >= 5 || D.danUNedelji(iso) === 0 ? 1.35 : 1));
      if (!OF.intervali(iso).length) n = Math.floor(n * 0.3);
      if (k === 0) n = Math.floor(n * Math.min(1, OF.sad().min / 1200));
      for (var i = 0; i < n; i++) {
        var r = OF.seme(iso + 'p' + i), stavke = [], br = 1 + Math.floor(r * 3);
        for (var j = 0; j < br; j++) { var a = artikli[Math.floor(OF.seme(iso + i + 'a' + j) * artikli.length)]; stavke.push({ naziv: OF.tx(a.naziv), kategorija: OF.tx(a.kategorija), cena: a.cena, kolicina: 1 + Math.floor(OF.seme(iso + i + 'k' + j) * (a.maks || 2)) }); }
        var uk = stavke.reduce(function (s, x) { return s + x.cena * x.kolicina; }, 0);
        var mn = 600 + Math.floor(r * 660); if (k === 0) { mn = Math.min(mn, OF.sad().min - 12 - i * 9); if (mn < 0) continue; }
        primer.push({ id: 'PR-' + iso.slice(5).replace('-', '') + i, vreme: iso + 'T' + D.uHHMM(mn) + ':00', kupac: { ime: ['Marija P.', 'Nikola J.', 'Ana S.', 'Stefan M.', 'Jovana K.', 'Milan D.'][i % 6], email: 'kupac' + (i % 6) + '@primer.rs', telefon: '060 000 00 0' + (i % 6) }, stavke: stavke, ukupno: uk, status: k === 0 && i === n - 1 ? 'primljeno' : 'zavrseno', izvor: 'primer', primer: true });
      }
    }
    return stvarne.concat(primer).sort(function (a, b) { return a.vreme > b.vreme ? -1 : 1; });
  };

  /* mušterije: iz termina, porudžbina i newslettera */
  P.musterije = function () {
    var m = {};
    var dodaj = function (email, ime, tel, iznos, datum, vrsta) {
      if (!email && !tel) return; var k = (email || tel).toLowerCase();
      var x = m[k] = m[k] || { ime: ime || '', email: email || '', telefon: tel || '', posete: 0, porudzbine: 0, ukupno: 0, poslednje: '', newsletter: false };
      if (ime && !x.ime) x.ime = ime; if (tel && !x.telefon) x.telefon = tel;
      if (vrsta === 't') x.posete++; if (vrsta === 'p') { x.porudzbine++; x.ukupno += iznos || 0; }
      if (vrsta === 'n') x.newsletter = true;
      if (datum && datum > x.poslednje) x.poslednje = datum;
    };
    (OF.zak ? OF.zak.termini() : []).forEach(function (t) { dodaj(t.email, t.ime, t.telefon, 0, t.datum, 't'); });
    P.porudzbine().forEach(function (p) { dodaj(p.kupac.email, p.kupac.ime, p.kupac.telefon, p.ukupno, OF.datum.lokalno(p.vreme).iso, 'p'); });
    OF.store.get('newsletter', []).forEach(function (n) { dodaj(n.email, '', '', 0, OF.datum.lokalno(n.vreme).iso, 'n'); });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return a.poslednje > b.poslednje ? -1 : 1; });
  };

  /* ---------- CSV (separator ; i BOM, da se lepo otvori u Excelu) ---------- */
  P.csv = function (ime, kolone, redovi) {
    var esc = function (v) { v = v == null ? '' : String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var s = '﻿' + kolone.map(esc).join(';') + '\r\n' + redovi.map(function (r) { return r.map(esc).join(';'); }).join('\r\n');
    OF.preuzmi(ime + '-' + OF.sad().iso + '.csv', s, 'text/csv;charset=utf-8');
  };

  /* ---------- SVG grafikoni ---------- */
  P.stubici = function (podaci, opcije) {
    opcije = opcije || {};
    var W = 640, H = 220, pl = 46, pd = 8, pt = 12, pb = 28, max = Math.max.apply(null, podaci.map(function (x) { return x.v; }).concat([1]));
    var sirovo = max / 4, red = Math.pow(10, Math.floor(Math.log10(sirovo || 1)));
    var korak = [1, 2, 2.5, 5, 10].map(function (x) { return x * red; }).filter(function (x) { return x >= sirovo; })[0] || red * 10;   // „okrugli“ podeoci
    var gore = korak * 4;
    var sir = (W - pl - pd) / podaci.length;
    var s = '<svg class="of-graf" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + OF.esc(opcije.naslov || '') + '" preserveAspectRatio="none">';
    for (var g = 0; g <= 4; g++) {
      var y = pt + (H - pt - pb) * (1 - g / 4), v = gore * g / 4;
      s += '<line x1="' + pl + '" x2="' + (W - pd) + '" y1="' + y + '" y2="' + y + '" class="of-graf__mreza"/><text x="' + (pl - 6) + '" y="' + (y + 4) + '" text-anchor="end" class="of-graf__osa">' + OF.esc(opcije.format ? opcije.format(v) : OF.broj(v)) + '</text>';
    }
    podaci.forEach(function (x, i) {
      var h = (H - pt - pb) * (x.v / gore), xx = pl + i * sir + sir * 0.18, ww = sir * 0.64;
      s += '<rect x="' + xx.toFixed(1) + '" y="' + (H - pb - h).toFixed(1) + '" width="' + ww.toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) + '" class="of-graf__stub' + (x.istaknuto ? ' istaknuto' : '') + '"><title>' + OF.esc(x.oznaka + ': ' + (opcije.format ? opcije.format(x.v) : x.v)) + '</title></rect>';
      if (podaci.length <= 16 || i % 2 === 0) s += '<text x="' + (xx + ww / 2).toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle" class="of-graf__osa">' + OF.esc(x.kratko || x.oznaka) + '</text>';
    });
    return s + '</svg>';
  };
  P.trake = function (podaci, format) {
    var max = Math.max.apply(null, podaci.map(function (x) { return x.v; }).concat([1]));
    return OF.h('ul', { class: 'of-trake', role: 'list' }, podaci.map(function (x) {
      return OF.h('li', null, [OF.h('span', { class: 'of-trake__ime' }, x.oznaka), OF.h('span', { class: 'of-trake__traka', 'aria-hidden': 'true' }, OF.h('span', { style: { width: (x.v / max * 100).toFixed(1) + '%' } })), OF.h('span', { class: 'of-trake__v' }, format ? format(x.v) : String(x.v))]);
    }));
  };

  /* =====================================================================
     STRANICA PANELA
     ===================================================================== */
  P.pokreni = function (koren) {
    if (!koren) return;
    if (OF.demo && !OF.store.get('panel-prijava', false)) return prijava(koren);
    if (!OF.demo) return P.ucitajSaServera(koren);
    crtaj(koren);
  };
  /* PRAVI režim: panel štiti Cloudflare Access (prijava mejlom vlasnika); podaci dolaze sa servera */
  P.ucitajSaServera = function (koren) {
    koren.innerHTML = ''; koren.appendChild(OF.h('p', { class: 'of-panel__prazno' }, [OF.h('span', { class: 'of-spiner', 'aria-hidden': 'true' }), ' ' + OF.t('zak.ucitavam')]));
    return fetch(OF.int.api('/panel/podaci'), { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401 || r.status === 403) throw new Error('pristup');
      if (!r.ok) throw new Error('server'); return r.json();
    }).then(function (o) {
      ['termini', 'porudzbine', 'kodovi', 'newsletter', 'podsetnici', 'procene', 'integracije-dnevnik', 'zalihe-izmene', 'kuponi-izmene', 'odustanci', 'reklamacije', 'zaliha-javi'].forEach(function (k) { if (o[k]) OF.store.set(k, o[k]); });
      if (o.cene) OF.store.set('cene-izmene', o.cene);
      crtaj(koren);
    }).catch(function (e) {
      koren.innerHTML = '';
      koren.appendChild(OF.h('div', { class: 'of-panel__prijava' }, [OF.h('h1', null, OF.t('p.naslov')), OF.h('p', null, e.message === 'pristup' ? OF.t('p.access') : OF.t('zak.server_greska'))]));
    });
  };
  function prijava(koren) {
    koren.innerHTML = '';
    var pin = cfg().demoPin || '1234';
    var forma = OF.h('form', { class: 'of-forma of-panel__prijava', novalidate: true }, [
      OF.h('h1', null, OF.t('p.naslov')), OF.h('p', null, OF.t('p.prijava_opis')),
      OF.h('p', { class: 'of-panel__demo' }, OF.t('p.demo_pin', { pin: pin })),
      OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'p-pin' }, OF.t('p.pin')), OF.h('input', { id: 'p-pin', name: 'pin', inputmode: 'numeric', autocomplete: 'off', maxlength: '8' })]),
      OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno' }, OF.t('p.udji'))
    ]);
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!OF.forma(forma, { pin: function (v) { return v === pin ? '' : OF.t('p.pogresan_pin'); } })) return;
      OF.store.set('panel-prijava', true); crtaj(koren);
    });
    koren.appendChild(forma);
  }

  function crtaj(koren) {
    koren.innerHTML = '';
    var f = OF.d.firma, sekcije = [];
    sekcije.push({ id: 'danas', naziv: OF.t('p.pregled'), crtaj: sekcijaPregled });
    if (tip()) sekcije.push({ id: 'termini', naziv: tip() === 'sto' ? OF.t('p.rezervacije') : tip() === 'vozilo' ? OF.t('p.vozila') : OF.t('p.termini'), crtaj: sekcijaTermini });
    if (OF.d.prodaja) sekcije.push({ id: 'prodaja', naziv: OF.t('p.prodaja'), crtaj: sekcijaProdaja });
    sekcije.push({ id: 'skener', naziv: OF.t('p.provera'), crtaj: sekcijaSkener });
    sekcije = sekcije.concat(P.sekcije);
    sekcije.push({ id: 'cene', naziv: OF.t('p.cenovnik'), crtaj: sekcijaCene });
    sekcije.push({ id: 'musterije', naziv: OF.t('p.musterije'), crtaj: sekcijaMusterije });
    sekcije.push({ id: 'integracije', naziv: OF.t('p.integracije'), crtaj: sekcijaIntegracije });

    var nav = OF.h('nav', { class: 'of-panel__nav', 'aria-label': OF.t('p.sekcije') });
    var lista = OF.h('ul', { role: 'list' }); nav.appendChild(lista);
    var sadrzaj = OF.h('main', { class: 'of-panel__sadrzaj', id: 'panel-sadrzaj', tabindex: '-1' });
    var trenutna = (w.location.hash || '').slice(1) || 'danas';
    if (!sekcije.some(function (s) { return s.id === trenutna; })) trenutna = 'danas';
    sekcije.forEach(function (s) {
      lista.appendChild(OF.h('li', null, OF.h('a', { href: '#' + s.id, 'aria-current': s.id === trenutna ? 'page' : null, onclick: function (e) { e.preventDefault(); idi(s.id, true); } }, s.naziv)));
    });
    var glava = OF.h('header', { class: 'of-panel__glava' }, [
      OF.h('div', null, [OF.h('p', { class: 'of-panel__firma' }, f.ime), OF.h('p', { class: 'of-panel__datum' }, D.dug(OF.sad().iso))]),
      OF.h('div', { class: 'of-panel__glava-desno' }, [
        OF.h('span', { class: 'of-panel__rezim of-panel__rezim--' + (OF.demo ? 'demo' : 'pravi') }, OF.demo ? OF.t('p.rezim_demo') : OF.t('p.rezim_pravi')),
        OF.h('a', { class: 'of-dugme of-dugme--tekst', href: OF.link('pocetna') }, OF.t('p.na_sajt')),
        OF.demo ? OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () { OF.store.remove('panel-prijava'); prijava(koren); } }, OF.t('p.odjava')) : null
      ])
    ]);
    koren.appendChild(glava);
    koren.appendChild(OF.h('div', { class: 'of-panel__raspored' }, [nav, sadrzaj]));
    function idi(id, fokus) {
      trenutna = id;
      OF.$$('a', nav).forEach(function (a) { a.setAttribute('aria-current', a.getAttribute('href') === '#' + id ? 'page' : 'false'); });
      try { w.history.replaceState(null, '', '#' + id); } catch (e) {}
      sadrzaj.innerHTML = '';
      var s = sekcije.filter(function (x) { return x.id === id; })[0];
      sadrzaj.appendChild(OF.h('h1', { class: 'of-panel__naslov' }, s.naziv));
      try { s.crtaj(sadrzaj, { idi: idi }); } catch (e) { console.error(e); sadrzaj.appendChild(OF.h('p', null, String(e))); }
      if (fokus) sadrzaj.focus();
      if (P._zaustaviKameru && id !== 'skener') P._zaustaviKameru();
    }
    idi(trenutna);
    OF.on('integracija', function () { if (trenutna === 'integracije' || trenutna === 'danas') idi(trenutna); });
  }

  /* ---------- pregled dana ---------- */
  function kartica(oznaka, vrednost, opis) { return OF.h('div', { class: 'of-panel__kartica' }, [OF.h('p', { class: 'of-panel__kartica-oznaka' }, oznaka), OF.h('p', { class: 'of-panel__kartica-vrednost' }, vrednost), opis ? OF.h('p', { class: 'of-panel__kartica-opis' }, opis) : null]); }
  function sekcijaPregled(s, nav) {
    var danas = OF.sad().iso, kartice = OF.h('div', { class: 'of-panel__kartice' });
    var st = OF.statusTekst(); kartice.appendChild(kartica(OF.t('p.sada'), st.tekst));
    if (tip()) {
      var t = P.terminiDana(danas), sada = OF.sad().min;
      var sledeci = t.filter(function (x) { return D.uMin(x.vreme) >= sada; })[0];
      kartice.appendChild(kartica(tip() === 'sto' ? OF.t('p.rezervacija_danas') : tip() === 'vozilo' ? OF.t('p.vozila_danas') : OF.t('p.termina_danas'), String(t.length), sledeci ? OF.t('p.sledeci', { vreme: D.vreme(sledeci.vreme), ime: sledeci.ime }) : OF.t('p.nema_vise')));
    }
    if (OF.d.prodaja) {
      var por = P.porudzbine().filter(function (p) { return OF.datum.lokalno(p.vreme).iso === danas; });
      kartice.appendChild(kartica(OF.t('p.prodaja_danas'), OF.din(por.reduce(function (a, p) { return a + p.ukupno; }, 0)), OF.t('p.porudzbina_n', { n: por.length })));
    }
    var dnevnik = OF.store.get('integracije-dnevnik', []);
    kartice.appendChild(kartica(OF.t('p.poruke_poslate'), String(dnevnik.length), OF.t('p.iz_dnevnika')));
    s.appendChild(kartice);
    s.appendChild(OF.h('h2', { class: 'of-panel__podnaslov' }, OF.t('p.poslednje')));
    s.appendChild(listaDnevnika(dnevnik.slice(0, 6)));
    if (OF.demo) s.appendChild(OF.h('p', { class: 'of-panel__demo' }, OF.t('p.demo_napomena')));
  }

  /* ---------- termini po danu i po osobi ---------- */
  var izabraniDan = null;
  function sekcijaTermini(s) {
    izabraniDan = izabraniDan || OF.sad().iso;
    var traka = OF.h('div', { class: 'of-panel__dan' });
    var naslovDana = OF.h('h2', { class: 'of-panel__dan-naslov', 'aria-live': 'polite' });
    var prikazLista = OF.store.get('panel-prikaz', w.matchMedia('(max-width: 760px)').matches ? 'lista' : 'kolone') === 'lista';
    var unos = OF.h('input', { type: 'date', value: izabraniDan, 'aria-label': OF.t('zak.datum'), onchange: function (e) { if (e.target.value) { izabraniDan = e.target.value; osvezi(); } } });
    traka.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', 'aria-label': OF.t('p.prethodni_dan'), onclick: function () { izabraniDan = D.dodaj(izabraniDan, -1); osvezi(); } }, '‹'));
    traka.appendChild(naslovDana);
    traka.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', 'aria-label': OF.t('p.sledeci_dan'), onclick: function () { izabraniDan = D.dodaj(izabraniDan, 1); osvezi(); } }, '›'));
    traka.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () { izabraniDan = OF.sad().iso; osvezi(); } }, OF.t('danas')));
    traka.appendChild(unos);
    var prekidac = OF.h('div', { class: 'of-segment', role: 'group', 'aria-label': OF.t('p.prikaz') }, [
      OF.h('button', { type: 'button', 'aria-pressed': prikazLista ? 'false' : 'true', onclick: function () { prikazLista = false; OF.store.set('panel-prikaz', 'kolone'); osvezi(); } }, tip() === 'termin' ? OF.t('p.po_osobi') : OF.t('p.po_prostoru')),
      OF.h('button', { type: 'button', 'aria-pressed': prikazLista ? 'true' : 'false', onclick: function () { prikazLista = true; OF.store.set('panel-prikaz', 'lista'); osvezi(); } }, OF.t('p.lista'))
    ]);
    if (tip() !== 'vozilo') traka.appendChild(prekidac);
    var mesto = OF.h('div', { class: 'of-panel__termini' });
    s.appendChild(traka); s.appendChild(mesto);
    s.appendChild(OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: izvozTermina }, OF.t('p.izvoz_csv'))]));
    function osvezi() {
      unos.value = izabraniDan; naslovDana.textContent = D.dug(izabraniDan);
      OF.$$('button', prekidac).forEach(function (b, i) { b.setAttribute('aria-pressed', (i === 1) === prikazLista ? 'true' : 'false'); });
      mesto.innerHTML = '';
      var lista = P.terminiDana(izabraniDan);
      var praznik = OF.praznik(izabraniDan);
      if (!OF.intervali(izabraniDan).length) mesto.appendChild(OF.h('p', { class: 'of-panel__prazno' }, OF.t('p.zatvoreno') + (praznik ? ' · ' + OF.tx(praznik) : '')));
      if (!lista.length) { mesto.appendChild(OF.h('p', { class: 'of-panel__prazno' }, OF.t('p.nema_termina'))); return; }
      if (tip() === 'vozilo') return mesto.appendChild(listaVozila(lista));
      if (prikazLista) return mesto.appendChild(listaTermina(lista));
      mesto.appendChild(kolone(lista));
    }
    osvezi();
  }
  function opis(t) { return OF.int.recepti.opisTermina ? OF.int.recepti.opisTermina(t) : ''; }
  function listaTermina(lista) {
    return OF.h('ul', { class: 'of-panel__lista', role: 'list' }, lista.map(function (t) {
      return OF.h('li', null, OF.h('button', { type: 'button', class: 'of-panel__termin' + (t.izvor === 'sajt' ? ' sa-sajta' : '') + (t.stigao ? ' stigao' : ''), onclick: function () { detalji(t); } }, [
        OF.h('strong', null, D.vreme(t.vreme)), OF.h('span', null, t.ime), OF.h('span', { class: 'of-panel__termin-opis' }, opis(t)),
        t.izvor === 'sajt' ? OF.h('span', { class: 'of-panel__znacka' }, OF.t('p.sa_sajta')) : null, t.stigao ? OF.h('span', { class: 'of-panel__znacka of-panel__znacka--ok' }, OF.t('p.stigao')) : null
      ]));
    }));
  }
  function kolone(lista) {
    var kljucevi = [];
    if (tip() === 'termin') kljucevi = (OF.d.tim || []).filter(function (o) { return !o.bezZakazivanja; }).map(function (o) { return { id: o.id, naziv: o.ime, boja: o.boja, po: function (t) { return t.osoba === o.id; } }; });
    else kljucevi = ((OF.d.zakazivanje || {}).prostori || []).map(function (p) { return { id: p.id, naziv: OF.tx(p.naziv), po: function (t) { return t.prostor === p.id; } }; });
    var iv = OF.intervali(izabraniDan), od = iv.length ? iv[0][0] : 540, dO = iv.length ? iv[iv.length - 1][1] : 1200;
    od = Math.floor(od / 60) * 60; dO = Math.ceil(dO / 60) * 60;
    var PX = 1.1; // px po minutu
    var mreza = OF.h('div', { class: 'of-raspored', style: { '--kolone': String(kljucevi.length) } });
    var vreme = OF.h('div', { class: 'of-raspored__sati', 'aria-hidden': 'true' }, [OF.h('div', { class: 'of-raspored__glava' }, '')]);
    for (var m = od; m < dO; m += 60) vreme.appendChild(OF.h('div', { class: 'of-raspored__sat', style: { height: (60 * PX) + 'px' } }, D.uHHMM(m % 1440)));
    mreza.appendChild(vreme);
    kljucevi.forEach(function (k) {
      var kol = OF.h('div', { class: 'of-raspored__kolona', role: 'list', 'aria-label': k.naziv }, [OF.h('div', { class: 'of-raspored__glava', role: 'presentation' }, k.naziv)]);
      var telo = OF.h('div', { class: 'of-raspored__telo', style: { height: ((dO - od) * PX) + 'px' } });
      lista.filter(k.po).forEach(function (t) {
        var poc = D.uMin(t.vreme); if (poc < od) poc += 1440;
        telo.appendChild(OF.h('button', { type: 'button', role: 'listitem', class: 'of-raspored__blok' + (t.izvor === 'sajt' ? ' sa-sajta' : '') + (t.stigao ? ' stigao' : ''), style: { top: ((poc - od) * PX) + 'px', height: Math.max(22, (t.trajanje || 30) * PX - 2) + 'px', borderLeftColor: k.boja || '' },
          'aria-label': D.vreme(t.vreme) + ', ' + t.ime + ', ' + opis(t), onclick: function () { detalji(t); } }, [OF.h('strong', null, D.vreme(t.vreme) + ' ' + t.ime), OF.h('span', null, opis(t))]));
      });
      kol.appendChild(telo); mreza.appendChild(kol);
    });
    return OF.h('div', { class: 'of-raspored__okvir' }, mreza);
  }
  var FAZE = function () { return (OF.d.pracenje && OF.d.pracenje.faze) || []; };
  function listaVozila(lista) {
    return OF.h('ul', { class: 'of-panel__lista', role: 'list' }, lista.map(function (t) {
      var faza = t.faza || 0, faze = FAZE();
      return OF.h('li', { class: 'of-panel__vozilo' }, [
        OF.h('div', null, [OF.h('strong', null, D.vreme(t.vreme) + ' · ' + (t.registracija || '')), OF.h('p', null, [t.vozilo, ' · ', t.paketNaziv, ' · ', t.ime].join(''))]),
        faze.length ? OF.h('ol', { class: 'of-faze', 'aria-label': OF.t('p.faza') }, faze.map(function (f, i) { return OF.h('li', { class: i < faza ? 'gotovo' : i === faza ? 'trenutno' : '', 'aria-current': i === faza ? 'step' : null }, OF.tx(f.naziv)); })) : null,
        OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { detalji(t); } }, OF.t('p.detalji'))])
      ]);
    }));
  }
  function detalji(t) {
    var redovi = [[OF.t('zak.broj'), t.id], [OF.t('zak.kada'), D.dug(t.datum) + ', ' + D.vreme(t.vreme)], [OF.t('f.ime'), t.ime], [OF.t('f.telefon'), t.telefon || ''], [OF.t('p.sta'), opis(t)]];
    if (t.email) redovi.push([OF.t('f.email'), t.email]); if (t.napomena) redovi.push([OF.t('f.napomena'), t.napomena]);
    if (t.depozit) redovi.push([OF.t('zak.placen_depozit'), OF.din(t.depozit)]);
    if (t.primer) redovi.push(['', OF.t('p.primer_termin')]);
    var telo = OF.h('div', null, [OF.h('dl', { class: 'of-pregled' }, [].concat.apply([], redovi.map(function (r) { return [OF.h('dt', null, r[0]), OF.h('dd', null, r[1])]; })))]);
    var akcije = OF.h('div', { class: 'of-zak__dugmad' });
    if (t.telefon) akcije.appendChild(OF.h('a', { class: 'of-dugme of-dugme--sporedno', href: 'tel:' + String(t.telefon).replace(/\s/g, '') }, OF.t('pozovite')));
    if (t.izvor === 'sajt') {
      if (!t.stigao) akcije.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: function () { oznaciDolazak(t.id); dl.zatvori(); } }, tip() === 'vozilo' ? OF.t('p.vozilo_primljeno') : OF.t('p.oznaci_stigao')));
      akcije.appendChild(OF.h('a', { class: 'of-dugme of-dugme--tekst', href: OF.zak.linkMojTermin(t) }, OF.t('p.otvori_kao_kupac')));
      if (t.email && tip() === 'termin') akcije.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () { OF.int.dogadjaj('recenzija.molba', { ime: t.ime, email: t.email }); dl.zatvori(); } }, OF.t('p.molba_recenzija')));
    }
    telo.appendChild(akcije);
    var dl = OF.dijalog({ naslov: t.ime, id: 'pt', sadrzaj: telo });
  }
  function oznaciDolazak(id) {
    OF.store.izmeni('termini', id, function (x) { x.stigao = new Date().toISOString(); return x; });
    OF.emit('panel.dolazak', id); OF.obavesti(OF.t('p.oznaceno'));
    OF.int.dogadjaj('termin.dolazak', { termin: OF.zak.nadji(id), tiho: true });
  }
  function izvozTermina() {
    var sve = OF.zak.termini();
    P.csv('termini', ['Broj', 'Datum', 'Vreme', 'Opis', 'Ime', 'Telefon', 'Mejl', 'Status', 'Depozit', 'Napomena'],
      sve.map(function (t) { return [t.id, t.datum, t.vreme, opis(t), t.ime, t.telefon, t.email, t.status, t.depozit || '', t.napomena || '']; }));
  }

  /* ---------- prodaja ---------- */
  function sekcijaProdaja(s) {
    var sve = P.porudzbine(), danas = OF.sad().iso, dani = [];
    for (var k = 13; k >= 0; k--) {
      var iso = D.dodaj(danas, -k), uk = sve.filter(function (p) { return D.lokalno(p.vreme).iso === iso; }).reduce(function (a, p) { return a + p.ukupno; }, 0);
      dani.push({ oznaka: D.kratko(iso), kratko: D.format(iso, { day: 'numeric' }), v: uk, istaknuto: k === 0 });
    }
    var ukupno14 = dani.reduce(function (a, x) { return a + x.v; }, 0), br14 = sve.filter(function (p) { return D.razlika(D.lokalno(p.vreme).iso, danas) < 14; }).length;
    s.appendChild(OF.h('div', { class: 'of-panel__kartice' }, [kartica(OF.t('p.14_dana'), OF.din(ukupno14), OF.t('p.porudzbina_n', { n: br14 })), kartica(OF.t('p.prosek'), OF.din(br14 ? Math.round(ukupno14 / br14) : 0), OF.t('p.po_porudzbini'))]));
    s.appendChild(OF.h('h2', { class: 'of-panel__podnaslov' }, OF.t('p.promet_po_danu')));
    s.appendChild(OF.h('figure', { class: 'of-graf__okvir', html: P.stubici(dani, { naslov: OF.t('p.promet_po_danu'), format: function (v) { return v >= 1000 ? OF.broj(Math.round(v / 1000)) + 'k' : OF.broj(v); } }) }));
    var kat = {}, art = {};
    sve.filter(function (p) { return D.razlika(D.lokalno(p.vreme).iso, danas) < 30; }).forEach(function (p) {
      p.stavke.forEach(function (x) { var c = x.cena * x.kolicina; var kk = nazivKategorije(x); kat[kk] = (kat[kk] || 0) + c; art[x.naziv] = (art[x.naziv] || 0) + x.kolicina; });
    });
    var dva = OF.h('div', { class: 'of-panel__dva' }, [
      OF.h('section', null, [OF.h('h2', { class: 'of-panel__podnaslov' }, OF.t('p.po_kategoriji')), P.trake(Object.keys(kat).map(function (k) { return { oznaka: k, v: kat[k] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 6), OF.din)]),
      OF.h('section', null, [OF.h('h2', { class: 'of-panel__podnaslov' }, OF.t('p.najprodavanije')), P.trake(Object.keys(art).map(function (k) { return { oznaka: k, v: art[k] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 6), function (v) { return OF.t('p.kom', { n: v }); })])
    ]);
    s.appendChild(dva);
    s.appendChild(OF.h('h2', { class: 'of-panel__podnaslov' }, OF.t('p.poslednje_porudzbine')));
    var tabela = OF.h('div', { class: 'of-tabela__okvir', tabindex: '0', role: 'region', 'aria-label': OF.t('p.poslednje_porudzbine') }, OF.h('table', { class: 'of-tabela-podataka' }, [
      OF.h('thead', null, OF.h('tr', null, [OF.t('zak.broj'), OF.t('p.vreme'), OF.t('p.kupac'), OF.t('p.stavke'), OF.t('ukupno'), OF.t('p.status')].map(function (k) { return OF.h('th', { scope: 'col' }, k); }))),
      OF.h('tbody', null, sve.slice(0, 25).map(function (p) {
        return OF.h('tr', { class: p.izvor === 'sajt' ? 'sa-sajta' : '' }, [OF.h('td', null, p.id), OF.h('td', null, (function (l) { return D.kratko(l.iso) + ' ' + l.hhmm; })(D.lokalno(p.vreme))), OF.h('td', null, p.kupac.ime), OF.h('td', null, p.stavke.map(function (x) { return x.kolicina + '× ' + x.naziv; }).join(', ')), OF.h('td', { class: 'broj' }, OF.din(p.ukupno)), OF.h('td', null, statusPorudzbine(p))]);
      }))
    ]));
    s.appendChild(tabela);
    s.appendChild(OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () {
      P.csv('porudzbine', ['Broj', 'Vreme', 'Kupac', 'Mejl', 'Telefon', 'Stavke', 'Ukupno', 'Status'], sve.map(function (p) { var l = D.lokalno(p.vreme); return [p.id, l.iso + ' ' + l.hhmm, p.kupac.ime, p.kupac.email, p.kupac.telefon, p.stavke.map(function (x) { return x.kolicina + 'x ' + x.naziv; }).join(', '), p.ukupno, statusPorudzbine(p, true)]; }));
    } }, OF.t('p.izvoz_csv'))]));
  }
  function statusPorudzbine(p, bezPosiljke) {
    var t;
    if (OF.prod && OF.prod.nazivStatusa) t = OF.prod.nazivStatusa({ primljeno: 'primljena', placeno: 'placena', zavrseno: 'isporucena', preuzeto: 'isporucena' }[p.status] || p.status);   // prodavnica: isti nazivi kao u porudžbinama
    else t = { primljeno: OF.t('p.s_primljeno'), placeno: OF.t('p.s_placeno'), zavrseno: OF.t('p.s_zavrseno'), preuzeto: OF.t('p.s_zavrseno') }[p.status] || p.status;
    if (p.posiljka && !bezPosiljke) t += ' · ' + p.posiljka.broj;
    return t;
  }
  // kategorija stavke: prodavnica čuva id kategorije, primeri naziv
  function nazivKategorije(x) {
    var k = x.kategorija; if (!k) return OF.t('p.ostalo');
    var kat = OF.prod && OF.prod.kategorija && OF.prod.kategorija(k);
    return kat ? OF.tx(kat.naziv) : k;
  }

  /* ---------- provera koda (QR skener) ---------- */
  function sekcijaSkener(s) {
    s.appendChild(OF.h('p', null, OF.t('p.skener_opis')));
    var video = OF.h('video', { class: 'of-skener__video', playsinline: true, muted: true, 'aria-label': OF.t('p.kamera') });
    var platno = OF.h('canvas', { hidden: true });
    var okvir = OF.h('div', { class: 'of-skener', hidden: true }, [video, OF.h('div', { class: 'of-skener__okvir', 'aria-hidden': 'true' })]);
    var rezultat = OF.h('div', { class: 'of-skener__rezultat', 'aria-live': 'polite' });
    var dugmeKamera = OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: pokreniKameru }, OF.t('p.ukljuci_kameru'));
    var forma = OF.h('form', { class: 'of-forma of-skener__rucno', novalidate: true }, [
      OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'p-kod' }, OF.t('p.unesi_kod')), OF.h('div', { class: 'of-polje__red' }, [OF.h('input', { id: 'p-kod', name: 'kod', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' }), OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--sporedno' }, OF.t('p.proveri'))])])
    ]);
    forma.addEventListener('submit', function (e) { e.preventDefault(); proveri(forma.elements.kod.value); });
    s.appendChild(OF.h('div', { class: 'of-zak__dugmad' }, [dugmeKamera]));
    s.appendChild(okvir); s.appendChild(platno); s.appendChild(forma); s.appendChild(rezultat);
    var primeri = OF.store.get('kodovi', []).filter(function (k) { return !k.iskoriscen; }).slice(0, 3);
    var termini = OF.zak ? OF.zak.termini().filter(function (t) { return t.status !== 'otkazan' && !t.stigao && !t.primer; }).slice(0, 2) : [];
    if (OF.demo && (primeri.length || termini.length)) {
      s.appendChild(OF.h('p', { class: 'of-panel__demo' }, OF.t('p.probajte')));
      s.appendChild(OF.h('div', { class: 'of-panel__primeri' }, primeri.map(function (k) { return OF.h('button', { type: 'button', class: 'of-dugme of-dugme--mini', onclick: function () { proveri(k.kod); } }, k.kod); })
        .concat(termini.map(function (t) { return OF.h('button', { type: 'button', class: 'of-dugme of-dugme--mini', onclick: function () { proveri(t.id); } }, t.id); }))));
    }
    var tok = null, rafId = 0;
    P._zaustaviKameru = function () { if (tok) tok.getTracks().forEach(function (t) { t.stop(); }); tok = null; cancelAnimationFrame(rafId); okvir.hidden = true; dugmeKamera.textContent = OF.t('p.ukljuci_kameru'); dugmeKamera.onclick = pokreniKameru; };
    function pokreniKameru() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { rezultat.textContent = OF.t('p.nema_kamere'); return; }
      Promise.all([OF.ucitaj('assets/vendor/jsqr.min.js'), navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })]).then(function (r) {
        tok = r[1]; video.srcObject = tok; video.play(); okvir.hidden = false;
        dugmeKamera.textContent = OF.t('p.iskljuci_kameru'); dugmeKamera.onclick = P._zaustaviKameru;
        var ctx = platno.getContext('2d', { willReadFrequently: true });
        (function skeniraj() {
          if (!tok) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            platno.width = video.videoWidth; platno.height = video.videoHeight; ctx.drawImage(video, 0, 0);
            var slika = ctx.getImageData(0, 0, platno.width, platno.height);
            var qr = w.jsQR(slika.data, slika.width, slika.height, { inversionAttempts: 'dontInvert' });
            if (qr && qr.data) { if (navigator.vibrate) navigator.vibrate(60); P._zaustaviKameru(); proveri(qr.data); return; }
          }
          rafId = requestAnimationFrame(skeniraj);
        })();
      }).catch(function (e) { rezultat.textContent = e && e.name === 'NotAllowedError' ? OF.t('p.kamera_odbijena') : OF.t('p.nema_kamere'); });
    }
    function proveri(vrednost) {
      var kod = String(vrednost || '').trim().toUpperCase(); rezultat.innerHTML = '';
      if (!kod) return;
      var m = /[?&]id=([A-Z0-9-]+)/i.exec(vrednost); if (m) kod = m[1].toUpperCase();      // QR sa linkom „moj termin“
      var k = OF.store.get('kodovi', []).filter(function (x) { return x.kod === kod; })[0];
      var t = OF.zak && OF.zak.termini().filter(function (x) { return x.id === kod; })[0];
      if (k) return prikaziKod(k);
      if (t) return prikaziTermin(t);
      rezultat.appendChild(OF.h('div', { class: 'of-skener__kartica of-skener__kartica--ne' }, [OF.h('h2', null, OF.t('p.kod_nije_nadjen')), OF.h('p', null, kod)]));
    }
    function prikaziKod(k) {
      var istekao = k.vaziDo && k.vaziDo < OF.sad().iso, iskoriscen = !!k.iskoriscen, ok = !istekao && !iskoriscen;
      var kart = OF.h('div', { class: 'of-skener__kartica ' + (ok ? 'of-skener__kartica--da' : 'of-skener__kartica--ne') }, [
        OF.h('p', { class: 'of-skener__oznaka' }, ok ? OF.t('p.vazeci') : iskoriscen ? OF.t('p.vec_iskoriscen', { kad: D.kratko(k.iskoriscen.slice(0, 10)) + ' ' + k.iskoriscen.slice(11, 16) }) : OF.t('p.istekao')),
        OF.h('h2', null, k.naziv), OF.h('p', null, (k.tip === 'vaucer' ? OF.din(k.iznos) + ' · ' : '') + k.kod + (k.opcije && k.opcije.primalac ? ' · ' + k.opcije.primalac : ''))
      ]);
      if (ok) kart.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: function () {
        var sve = OF.store.get('kodovi', []).map(function (x) { if (x.kod === k.kod) x.iskoriscen = new Date().toISOString(); return x; }); OF.store.set('kodovi', sve);
        OF.int.dogadjaj('kod.iskoriscen', { kod: k, tiho: true }); OF.obavesti(k.tip === 'ulaznica' ? OF.t('p.ulaz_ok') : OF.t('p.vaucer_ok')); proveri(k.kod);
      } }, k.tip === 'ulaznica' ? OF.t('p.pusti_ulaz') : OF.t('p.iskoristi')));
      rezultat.appendChild(kart);
    }
    function prikaziTermin(t) {
      var kart = OF.h('div', { class: 'of-skener__kartica ' + (t.status === 'otkazan' ? 'of-skener__kartica--ne' : 'of-skener__kartica--da') }, [
        OF.h('p', { class: 'of-skener__oznaka' }, t.status === 'otkazan' ? OF.t('moj.otkazan') : t.stigao ? OF.t('p.vec_stigao') : OF.t('p.termin_nadjen')),
        OF.h('h2', null, t.ime), OF.h('p', null, opis(t) + ' · ' + D.dug(t.datum) + ', ' + D.vreme(t.vreme))
      ]);
      if (t.status !== 'otkazan' && !t.stigao) kart.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: function () { oznaciDolazak(t.id); proveri(t.id); } }, tip() === 'vozilo' ? OF.t('p.vozilo_primljeno') : OF.t('p.oznaci_stigao')));
      rezultat.appendChild(kart);
    }
  }

  /* ---------- cenovnik ---------- */
  function sekcijaCene(s) {
    s.appendChild(OF.h('p', null, OF.demo ? OF.t('p.cene_demo') : OF.t('p.cene_pravi')));
    var stavke = (OF.d.panelCene ? OF.d.panelCene() : null) || (OF.d.usluge || []).map(function (u) { return { id: u.id, naziv: OF.tx(u.naziv), grupa: OF.tx(u.kategorija), cena: u.cena }; });
    var forma = OF.h('form', { class: 'of-forma of-cene', novalidate: true });
    var grupe = {}, redosled = [];
    stavke.forEach(function (x) { var g = x.grupa || ''; if (!grupe[g]) { grupe[g] = []; redosled.push(g); } grupe[g].push(x); });
    redosled.forEach(function (g) {
      var fs = OF.h('fieldset', { class: 'of-cene__grupa' }, [g ? OF.h('legend', null, g) : null]);
      grupe[g].forEach(function (x) {
        var tr = OF.cene.za(x.id, x.cena), raspon = tr && typeof tr === 'object';
        var red = OF.h('div', { class: 'of-cene__red' }, [OF.h('span', { class: 'of-cene__naziv', id: 'cn-' + x.id }, x.naziv)]);
        if (raspon) {
          red.appendChild(OF.h('label', { class: 'of-cene__polje' }, [OF.h('span', null, OF.t('p.od')), OF.h('input', { type: 'number', min: '0', step: '100', name: x.id + '|od', value: tr.od, 'aria-describedby': 'cn-' + x.id, inputmode: 'numeric' })]));
          red.appendChild(OF.h('label', { class: 'of-cene__polje' }, [OF.h('span', null, OF.t('p.do')), OF.h('input', { type: 'number', min: '0', step: '100', name: x.id + '|do', value: tr.do, 'aria-describedby': 'cn-' + x.id, inputmode: 'numeric' })]));
        } else red.appendChild(OF.h('label', { class: 'of-cene__polje' }, [OF.h('span', { class: 'of-sr' }, OF.t('p.cena')), OF.h('input', { type: 'number', min: '0', step: '10', name: x.id, value: tr, 'aria-describedby': 'cn-' + x.id, inputmode: 'numeric' }), OF.h('span', { 'aria-hidden': 'true' }, ' din')]));
        fs.appendChild(red);
      });
      forma.appendChild(fs);
    });
    forma.appendChild(OF.h('div', { class: 'of-zak__dugmad of-cene__dugmad' }, [
      OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () { OF.cene.vrati(); OF.obavesti(OF.t('p.cene_vracene')); sekcijaPonovo(); } }, OF.t('p.vrati_cene')),
      OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno' }, OF.t('p.sacuvaj_cene'))
    ]));
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var nove = {};
      Array.prototype.forEach.call(forma.elements, function (el) {
        if (!el.name || el.type !== 'number') return;
        var v = Math.max(0, Math.round(+el.value || 0)), delovi = el.name.split('|');
        if (delovi.length === 2) { nove[delovi[0]] = nove[delovi[0]] || {}; nove[delovi[0]][delovi[1]] = v; } else nove[el.name] = v;
      });
      var promenjeno = [];
      Object.keys(nove).forEach(function (id) {
        var stara = OF.cene.za(id, (stavke.filter(function (x) { return x.id === id; })[0] || {}).cena);
        if (JSON.stringify(stara) !== JSON.stringify(nove[id])) { OF.cene.postavi(id, nove[id]); promenjeno.push(id); }
      });
      OF.obavesti(promenjeno.length ? OF.t('p.cene_sacuvane', { n: promenjeno.length }) : OF.t('p.nema_izmena'));
      if (promenjeno.length) OF.int.dogadjaj('cenovnik.izmena', { stavke: promenjeno, cene: promenjeno.reduce(function (o, id) { o[id] = nove[id]; return o; }, {}), tiho: true });
    });
    s.appendChild(forma);
    function sekcijaPonovo() { s.innerHTML = ''; s.appendChild(OF.h('h1', { class: 'of-panel__naslov' }, OF.t('p.cenovnik'))); sekcijaCene(s); }
  }

  /* ---------- mušterije ---------- */
  function sekcijaMusterije(s) {
    var sve = P.musterije();
    var pretraga = OF.h('input', { type: 'search', id: 'p-trazi', placeholder: OF.t('p.trazi_placeholder'), autocomplete: 'off' });
    s.appendChild(OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'p-trazi' }, OF.t('p.trazi')), pretraga]));
    var mesto = OF.h('div');
    s.appendChild(mesto);
    function crtajTabelu() {
      var q = OF.bezKvacica(pretraga.value);
      var lista = sve.filter(function (m) { return !q || OF.bezKvacica(m.ime + ' ' + m.email + ' ' + m.telefon).indexOf(q) >= 0; });
      mesto.innerHTML = '';
      if (!lista.length) { mesto.appendChild(OF.h('p', { class: 'of-panel__prazno' }, sve.length ? OF.t('p.nema_rezultata') : OF.t('p.nema_musterija'))); return; }
      mesto.appendChild(OF.h('div', { class: 'of-tabela__okvir', tabindex: '0', role: 'region', 'aria-label': OF.t('p.musterije') }, OF.h('table', { class: 'of-tabela-podataka' }, [
        OF.h('thead', null, OF.h('tr', null, [OF.t('f.ime'), OF.t('f.email'), OF.t('f.telefon'), OF.prod ? OF.t('p.br_porudzbina') : OF.t('p.posete'), OF.t('p.kupovine'), OF.t('p.poslednji_put'), 'Newsletter'].map(function (k) { return OF.h('th', { scope: 'col' }, k); }))),
        OF.h('tbody', null, lista.slice(0, 100).map(function (m) {
          return OF.h('tr', null, [OF.h('td', null, m.ime || '–'), OF.h('td', null, m.email), OF.h('td', null, m.telefon), OF.h('td', { class: 'broj' }, String(OF.prod ? m.porudzbine : m.posete)),   // prodavnica: broj porudžbina umesto poseta
            OF.h('td', { class: 'broj' }, m.porudzbine ? OF.din(m.ukupno) : '–'), OF.h('td', null, m.poslednje ? D.kratko(m.poslednje) : ''), OF.h('td', null, m.newsletter ? OF.t('da') : '')]);
        }))
      ])));
    }
    pretraga.addEventListener('input', crtajTabelu); crtajTabelu();
    s.appendChild(OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () {
      P.csv('musterije', ['Ime', 'Mejl', 'Telefon', 'Posete', 'Porudžbine', 'Ukupno (din)', 'Poslednji put', 'Newsletter'], sve.map(function (m) { return [m.ime, m.email, m.telefon, m.posete, m.porudzbine, m.ukupno, m.poslednje, m.newsletter ? 'da' : 'ne']; }));
    } }, OF.t('p.izvoz_csv'))]));
    if (OF.demo) s.appendChild(OF.h('p', { class: 'of-panel__demo' }, OF.t('p.musterije_demo')));
  }

  /* ---------- integracije ---------- */
  var NAZIV_STANJA = function (s) { return { demo: OF.t('p.st_demo'), ukljuceno: OF.t('p.st_ukljuceno'), nedostaje: OF.t('p.st_nedostaje'), iskljuceno: OF.t('p.st_iskljuceno') }[s]; };
  function sekcijaIntegracije(s) {
    s.appendChild(OF.h('p', null, OF.demo ? OF.t('p.int_demo') : OF.t('p.int_pravi')));
    s.appendChild(OF.h('ul', { class: 'of-integracije', role: 'list' }, OF.int.spisak().map(function (x) {
      return OF.h('li', { class: 'of-integracije__stavka' }, [
        OF.h('div', null, [OF.h('p', { class: 'of-integracije__naziv' }, x.naziv), OF.h('p', { class: 'of-integracije__opis' }, x.opis), x.nedostaje.length && !OF.demo ? OF.h('p', { class: 'of-integracije__nedostaje' }, OF.t('p.nedostaje', { polja: x.nedostaje.join(', ') })) : null]),
        OF.h('span', { class: 'of-stanje of-stanje--' + x.stanje }, NAZIV_STANJA(x.stanje))
      ]);
    })));
    s.appendChild(OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () {
      OF.int.dogadjaj('kontakt.poruka', { ime: OF.t('p.proba_ime'), email: OF.d.firma.email, telefon: OF.d.firma.telefon, poruka: OF.t('p.proba_poruka') });
    } }, OF.t('p.posalji_probu'))]));
    s.appendChild(OF.h('h2', { class: 'of-panel__podnaslov' }, OF.t('p.dnevnik')));
    var dnevnik = OF.store.get('integracije-dnevnik', []);
    s.appendChild(listaDnevnika(dnevnik.slice(0, 40)));
    if (dnevnik.length) s.appendChild(OF.h('div', { class: 'of-zak__dugmad' }, [
      OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () { P.csv('dnevnik-integracija', ['Vreme', 'Događaj', 'Režim', 'Opis'], dnevnik.map(function (z) { return [z.vreme, z.tip, z.rezim, z.sazetak]; })); } }, OF.t('p.izvoz_csv')),
      OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () { OF.store.remove('integracije-dnevnik'); OF.obavesti(OF.t('p.dnevnik_obrisan')); OF.emit('integracija', {}); } }, OF.t('p.obrisi_dnevnik'))
    ]));
  }
  function listaDnevnika(lista) {
    if (!lista.length) return OF.h('p', { class: 'of-panel__prazno' }, OF.t('p.dnevnik_prazan'));
    return OF.h('ul', { class: 'of-dnevnik', role: 'list' }, lista.map(function (z) {
      var kanali = z.izlaz ? ['viber', 'kalendar', 'mejlKupcu', 'mejlVlasniku', 'sms', 'tabela'].filter(function (k) { return z.izlaz[k]; }).map(function (k) { return { viber: 'Viber', kalendar: 'Kalendar', mejlKupcu: OF.t('p.mejl'), mejlVlasniku: OF.t('p.mejl'), sms: 'SMS', tabela: 'Sheets' }[k]; }) : [];
      kanali = kanali.filter(function (x, i) { return kanali.indexOf(x) === i; });
      return OF.h('li', { class: 'of-dnevnik__stavka' }, [
        OF.h('time', { datetime: z.vreme }, D.kratko(OF.datum.lokalno(z.vreme).iso) + ' ' + OF.datum.uHHMM(OF.sad(new Date(z.vreme)).min)),
        OF.h('span', { class: 'of-dnevnik__opis' }, z.sazetak), OF.h('span', { class: 'of-dnevnik__kanali' }, kanali.join(' · ')),
        z.izlaz && kanali.length ? OF.h('button', { type: 'button', class: 'of-dugme of-dugme--mini', onclick: function () { OF.int.prikazi(z); } }, OF.t('p.prikazi')) : null
      ]);
    }));
  }

  OF.spremno(function () { P.pokreni(OF.$('[data-of-panel]')); });
})(window, document);
