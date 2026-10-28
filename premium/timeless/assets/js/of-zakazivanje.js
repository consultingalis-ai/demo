/* opsforma Premium · zakazivanje i rezervacije u više koraka
   Tipovi: 'termin' (usluga → osoba → datum i vreme → podaci → pregled → potvrda)
           'sto'    (datum, broj osoba, unutra/bašta, vreme → podaci → pregled → [depozit] → potvrda)
           'vozilo' (paket i dodaci → datum ostavljanja → podaci i vozilo → pregled → depozit → potvrda)
   Slobodni termini se računaju iz radnog vremena firme i rasporeda osobe. U demo režimu deo
   termina je „zauzet“ po stalnom pravilu (isti dan uvek izgleda isto), plus Vaši stvarni demo termini. */
(function (w, d) {
  'use strict';
  var OF = w.OF, D = OF.datum, Z = OF.zak = {};
  var cfg = function () { return OF.d.zakazivanje || {}; };

  /* ---------- podaci ---------- */
  Z.usluge = function () { return (OF.d.usluge || []).filter(function (u) { return u.online !== false; }); };
  Z.usluga = function (id) { return (OF.d.usluge || []).filter(function (u) { return u.id === id; })[0]; };
  Z.osoba = function (id) { return (OF.d.tim || []).filter(function (o) { return o.id === id; })[0]; };
  Z.cena = function (u) { return OF.cene.za(u.id, u.cena); };
  Z.termini = function () { return OF.store.get('termini', []); };

  /* ---------- zauzetost u demo režimu (stalna, „realna“) ---------- */
  var IMENA = ['Marija P.', 'Nikola J.', 'Ana S.', 'Stefan M.', 'Jovana K.', 'Milan D.', 'Ivana R.', 'Luka T.', 'Tamara V.', 'Marko Đ.', 'Jelena B.', 'Uroš L.', 'Teodora G.', 'Petar N.', 'Sara Ć.', 'Vuk A.', 'Mina Ž.', 'Đorđe S.', 'Katarina M.', 'Filip O.'];
  Z.zauzetoDemo = function (kljuc, iso, intervali, gustina) {
    gustina = gustina == null ? (cfg().demoZauzetost || 0.42) : gustina;
    var blokovi = [], seme = OF.sajt + '|' + kljuc + '|' + iso;
    var razlikaDana = D.razlika(OF.sad().iso, iso);
    if (razlikaDana > 21) gustina *= 0.55; else if (razlikaDana > 10) gustina *= 0.8;   // dalji dani su slobodniji
    intervali.forEach(function (iv) {
      for (var t = iv[0]; t + 30 <= iv[1]; t += 30) {
        var r = OF.seme(seme + '|' + t);
        if (r < gustina) {
          var duzina = r < gustina * 0.35 ? 90 : r < gustina * 0.7 ? 60 : 30;
          var kraj = Math.min(iv[1], t + duzina);
          blokovi.push({ od: t, do: kraj, ime: IMENA[Math.floor(OF.seme(seme + 'i' + t) * IMENA.length)], demo: true });
          t = kraj - 30;
        }
      }
    });
    return blokovi;
  };

  /* ---------- intervali rada osobe na dan ---------- */
  Z.intervaliOsobe = function (osobaId, iso) {
    var firma = OF.intervali(iso); if (!firma.length) return [];
    var o = Z.osoba(osobaId); if (!o || !o.raspored) return firma;
    var licni = OF.intervali(iso, o.raspored); if (OF.praznik(iso)) return [];
    var rez = [];
    firma.forEach(function (a) { licni.forEach(function (b) { var od = Math.max(a[0], b[0]), dO = Math.min(a[1], b[1]); if (dO > od) rez.push([od, dO]); }); });
    return rez;
  };

  /* PRAVI režim: zauzetost dolazi sa servera (baza termina + zauzeto u Google kalendaru), po ključu „osoba|datum“ */
  Z.server = {}; var ucitano = {};
  Z.serverBlokovi = function (kljuc, iso) { return (Z.server[kljuc + '|' + iso] || []).map(function (b) { return { od: b[0], do: b[1], id: b[2], server: true }; }); };
  Z.ucitajZauzeto = function (od, dO) {
    if (OF.demo) return Promise.resolve();
    var k = od + '_' + dO; if (ucitano[k]) return ucitano[k];
    return (ucitano[k] = fetch(OF.int.api('/zauzeto?od=' + od + '&do=' + dO), { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('zauzeto ' + r.status); return r.json(); })
      .then(function (o) { Object.keys(o.blokovi || {}).forEach(function (x) { Z.server[x] = o.blokovi[x]; }); if (o.kapacitet) Object.keys(o.kapacitet).forEach(function (x) { Z.server['kapacitet|' + x] = o.kapacitet[x]; }); })
      .catch(function (e) { delete ucitano[k]; console.warn(e); OF.obavesti(OF.t('zak.server_greska'), 'greska'); }));
  };
  Z.osveziZauzeto = function () { ucitano = {}; Z.server = {}; };

  /* zauzeti blokovi osobe (demo + server + lokalni termini) */
  Z.zauzeto = function (osobaId, iso) {
    var iv = Z.intervaliOsobe(osobaId, iso);
    var blok = OF.demo ? Z.zauzetoDemo(osobaId, iso, iv) : Z.serverBlokovi(osobaId, iso);
    Z.termini().forEach(function (t) {
      if (t.status === 'otkazan' || t.datum !== iso || t.osoba !== osobaId || (!OF.demo && !t.lokalno)) return;
      var od = D.uMin(t.vreme); blok.push({ od: od, do: od + (t.trajanje || 30), id: t.id });
    });
    return blok;
  };

  /* slobodna vremena za uslugu kod osobe na dan */
  Z.slobodno = function (uslugaId, osobaId, iso, ignorisiId) {
    var u = Z.usluga(uslugaId), traj = (u && u.trajanje) || 30, korak = cfg().korakMinuta || 15;
    var iv = Z.intervaliOsobe(osobaId, iso);
    var zauz = Z.zauzeto(osobaId, iso).filter(function (b) { return !ignorisiId || b.id !== ignorisiId; });
    var sada = OF.sad(), minimum = -1;
    if (iso === sada.iso) minimum = sada.min + (cfg().minimalnoUnapredMin || 90);
    if (iso < sada.iso) return [];
    var rez = [];
    iv.forEach(function (a) {
      var start = Math.ceil(a[0] / korak) * korak;
      for (var t = start; t + traj <= a[1]; t += korak) {
        if (t < minimum) continue;
        var preklapa = zauz.some(function (b) { return t < b.do && t + traj > b.od; });
        if (!preklapa) rez.push(t);
      }
    });
    return rez;
  };

  /* za „svejedno ko“: unija slobodnih vremena i ko je slobodan */
  Z.slobodnoBiloKo = function (uslugaId, osobe, iso) {
    var mapa = {};
    osobe.forEach(function (o) { Z.slobodno(uslugaId, o, iso).forEach(function (t) { (mapa[t] = mapa[t] || []).push(o); }); });
    return Object.keys(mapa).map(Number).sort(function (a, b) { return a - b; }).map(function (t) { return { t: t, osobe: mapa[t] }; });
  };

  /* ---------- restoran: stolovi ---------- */
  Z.prostori = function (iso) {
    return (cfg().prostori || []).filter(function (p) {
      if (!p.sezona) return true;
      var md = iso.slice(5); return md >= p.sezona[0] && md <= p.sezona[1];
    });
  };
  Z.slobodnoSto = function (iso, osoba, prostorId, ignorisiId) {
    var p = (cfg().prostori || []).filter(function (x) { return x.id === prostorId; })[0]; if (!p) return [];
    var trajanje = osoba >= 6 ? (cfg().trajanjeGrupe || 150) : (cfg().trajanje || 120);
    var stolovi = (p.stolovi || []).filter(function (s) { return s.mesta >= osoba && s.mesta <= osoba + 3; });
    if (!stolovi.length) return [];
    var iv = OF.intervali(iso), korak = cfg().korakMinuta || 30, sada = OF.sad();
    var poslednji = cfg().poslednjaRezervacijaPreZatvaranja || 90, rez = [];
    iv.forEach(function (a) {
      for (var t = Math.ceil(a[0] / korak) * korak; t <= a[1] - poslednji; t += korak) {
        if (iso === sada.iso && t < sada.min + (cfg().minimalnoUnapredMin || 60)) continue;
        var slobodnih = stolovi.filter(function (s) {
          var kljuc = p.id + '-' + s.id;
          var zauz = OF.demo ? Z.zauzetoDemo(kljuc, iso, [[a[0], a[1]]], cfg().demoZauzetost || 0.38) : Z.serverBlokovi(kljuc, iso);
          Z.termini().forEach(function (r) { if (r.status !== 'otkazan' && r.datum === iso && r.sto === kljuc && r.id !== ignorisiId) { var o = D.uMin(r.vreme); zauz.push({ od: o, do: o + (r.trajanje || trajanje) }); } });
          return !zauz.some(function (b) { return t < b.do && t + trajanje > b.od; });
        });
        if (slobodnih.length) rez.push({ t: t, sto: p.id + '-' + slobodnih[0].id, malo: slobodnih.length === 1 });
      }
    });
    return rez;
  };

  /* ---------- detailing: ostavljanje vozila ---------- */
  Z.kapacitetDana = function (iso, sati) {
    var iv = OF.intervali(iso); if (!iv.length) return { slobodno: 0 };
    var mesta = cfg().radnaMesta || 2, ukupno = 0; iv.forEach(function (a) { ukupno += (a[1] - a[0]) / 60; });
    ukupno *= mesta;
    var zauzeto = OF.demo ? ukupno * Math.min(0.92, OF.seme(OF.sajt + 'kap' + iso) * 0.9 + (D.razlika(OF.sad().iso, iso) < 5 ? 0.25 : 0)) : (Z.server['kapacitet|' + iso] || 0);
    if (OF.demo) Z.termini().forEach(function (t) { if (t.status !== 'otkazan' && t.datum === iso) zauzeto += (t.sati || 3); });
    return { slobodno: Math.max(0, ukupno - zauzeto), ukupno: ukupno };
  };
  Z.slobodnoVozilo = function (iso, sati) {
    var k = Z.kapacitetDana(iso, sati); if (k.slobodno < (sati || 3)) return [];
    var prozori = cfg().ostavljanje || [['08:00', '10:00']], korak = cfg().korakMinuta || 30, sada = OF.sad(), rez = [];
    prozori.forEach(function (p) {
      for (var t = D.uMin(p[0]); t <= D.uMin(p[1]); t += korak) {
        if (iso === sada.iso && t < sada.min + 60) continue;
        if (OF.demo && OF.seme(OF.sajt + 'vz' + iso + t) < 0.3) continue;
        rez.push({ t: t });
      }
    });
    return rez;
  };
  /* kada je vozilo gotovo: dodaje radne sate posle ostavljanja */
  Z.gotovo = function (iso, t, sati) {
    var dan = iso, ost = sati * 60 / ((cfg().radnaMesta || 2) > 1 ? 1 : 1), vreme = t, sigurnost = 0;
    while (ost > 0 && sigurnost++ < 30) {
      var iv = OF.intervali(dan);
      for (var i = 0; i < iv.length && ost > 0; i++) {
        var od = Math.max(iv[i][0], vreme), dO = iv[i][1];
        if (dO <= od) continue;
        var moze = Math.min(dO - od, ost); ost -= moze; vreme = od + moze;
      }
      if (ost > 0) { dan = D.dodaj(dan, 1); vreme = 0; }
    }
    var zavrseno = Math.ceil((vreme + 30) / 30) * 30;
    var ivd = OF.intervali(dan); if (ivd.length && zavrseno > ivd[ivd.length - 1][1]) zavrseno = ivd[ivd.length - 1][1];
    return { datum: dan, vreme: D.uHHMM(zavrseno) };
  };

  /* ---------- dani u kalendaru: koliko je slobodno ---------- */
  Z.dostupnostDana = function (stanje, iso) {
    var tip = cfg().tip || 'termin';
    if (iso < OF.sad().iso) return 0;
    if (D.razlika(OF.sad().iso, iso) > (cfg().unapredDana || 45)) return 0;
    if (tip === 'sto') return Z.slobodnoSto(iso, stanje.osoba || 2, stanje.prostor || ((Z.prostori(iso)[0] || {}).id)).length;
    if (tip === 'vozilo') return Z.slobodnoVozilo(iso, stanje.sati).length;
    if (!stanje.usluga) return OF.intervali(iso).length ? 1 : 0;
    var osobe = stanje.osoba && stanje.osoba !== 'bilo' ? [stanje.osoba] : (Z.usluga(stanje.usluga).osobe || []);
    var n = 0; osobe.forEach(function (o) { n += Z.slobodno(stanje.usluga, o, iso).length; });
    return n;
  };

  /* ---------- čuvanje termina ---------- */
  Z.pripremi = function (t) { t.id = t.id || OF.id(cfg().prefiks || 'T'); t.token = t.token || OF.token(); t.status = t.status || 'potvrdjen'; t.kreiran = t.kreiran || new Date().toISOString(); t.jezik = OF.jezik; return t; };
  Z.sacuvaj = function (t) {
    Z.pripremi(t);
    t.jezik = OF.jezik;
    var lista = Z.termini().filter(function (x) { return x.id !== t.id; }); lista.unshift(t); OF.store.set('termini', lista.slice(0, 300));
    return t;
  };
  Z.nadji = function (id, token) { return Z.termini().filter(function (t) { return t.id === id && (!token || t.token === token); })[0]; };
  Z.linkMojTermin = function (t) { return I().apsolutno(OF.link('moj-termin', 'id=' + encodeURIComponent(t.id) + '&t=' + t.token)); };
  function I() { return OF.int; }

  /* događaj za kalendar (.ics, Google link) */
  Z.dogadjajZaKalendar = function (t) {
    var f = OF.d.firma, poc = D.uUTC(t.datum, t.vreme), kraj = new Date(poc.getTime() + (t.trajanje || 60) * 60000);
    var naslov = (t.naslovKalendar || OF.tx((Z.usluga(t.usluga) || {}).naziv) || OF.t('zak.termin')) + ' · ' + f.ime;
    var opis = [OF.t('zak.kal_opis', { ime: f.ime, tel: f.telefon })];
    if (t.meet) opis.push('Google Meet: ' + t.meet);
    opis.push(OF.t('zak.pomeri_otkazi') + ': ' + Z.linkMojTermin(t));
    return { uid: t.id, pocetak: poc, kraj: kraj, naslov: naslov, opis: opis.join('\n'), lokacija: t.meet ? 'Google Meet' : f.ime + ', ' + I().adresa(), url: Z.linkMojTermin(t) };
  };
  Z.preuzmiIcs = function (t) { OF.preuzmi(OF.sajt + '-' + t.id + '.ics', I().ics(Z.dogadjajZaKalendar(t)), 'text/calendar;charset=utf-8'); };

  /* =====================================================================
     ČAROBNJAK (UI)
     ===================================================================== */
  Z.pokreni = function (koren, opcije) {
    if (!koren) return;
    opcije = opcije || {};
    var c = cfg(), tip = c.tip || 'termin';
    var nalog = OF.nalog() || {};
    var stanje = {
      usluga: OF.upit('usluga') || opcije.usluga || null, osoba: OF.upit('osoba') || null, datum: null, vreme: null,
      ime: nalog.ime || '', telefon: nalog.telefon || '', email: nalog.email || '', napomena: '',
      osobe: +(OF.upit('osoba-broj') || 2), prostor: null, sati: null, paket: OF.upit('paket') || null, velicina: OF.upit('velicina') || null, dodaci: (OF.upit('dodaci') || '').split(',').filter(Boolean),
      vozilo: nalog.vozilo || '', registracija: nalog.registracija || '', prvaPoseta: true, saglasnost: false
    };
    if (tip === 'sto') stanje.osoba = +(OF.upit('osobe') || 2);
    var koraci = (c.koraci || ['usluga', 'osoba', 'termin', 'podaci', 'pregled']).slice();
    var naziviKoraka = { usluga: OF.t('zak.k_usluga'), osoba: OF.t('zak.k_osoba'), termin: OF.t('zak.k_termin'), sto: OF.t('zak.k_sto'), paket: OF.t('zak.k_paket'), podaci: OF.t('zak.k_podaci'), pregled: OF.t('zak.k_pregled') };
    if (c.naziviKoraka) Object.keys(c.naziviKoraka).forEach(function (k) { naziviKoraka[k] = OF.tx(c.naziviKoraka[k]); });
    var i = 0;
    if (stanje.usluga && Z.usluga(stanje.usluga) && koraci[0] === 'usluga') i = 1;
    if (tip === 'vozilo' && stanje.paket && koraci[0] === 'paket') i = 1;

    koren.innerHTML = '';
    koren.classList.add('of-zak');
    var tok = OF.h('ol', { class: 'of-zak__tok', 'aria-label': OF.t('zak.koraci') });
    var telo = OF.h('div', { class: 'of-zak__telo' });
    var najava = OF.h('p', { class: 'of-sr', 'aria-live': 'polite' });
    var sazetak = OF.h('aside', { class: 'of-zak__sazetak', 'aria-label': OF.t('zak.vas_izbor') });
    koren.appendChild(tok); koren.appendChild(OF.h('div', { class: 'of-zak__raspored' }, [telo, sazetak])); koren.appendChild(najava);
    if (OF.demo) koren.appendChild(OF.h('p', { class: 'of-zak__demo' }, OF.t('zak.demo_napomena')));

    function crtajTok() {
      tok.innerHTML = '';
      koraci.forEach(function (k, n) {
        tok.appendChild(OF.h('li', { class: 'of-zak__korak' + (n < i ? ' gotov' : '') + (n === i ? ' trenutni' : ''), 'aria-current': n === i ? 'step' : null }, [
          OF.h('span', { class: 'of-zak__br', 'aria-hidden': 'true' }, String(n + 1)), OF.h('span', { class: 'of-zak__ime' }, naziviKoraka[k] || k)
        ]));
      });
    }
    function crtajSazetak() {
      sazetak.innerHTML = '';
      var redovi = opisStanja();
      if (!redovi.length) { sazetak.hidden = true; return; }
      sazetak.hidden = false;
      sazetak.appendChild(OF.h('h3', { class: 'of-zak__sazetak-naslov' }, OF.t('zak.vas_izbor')));
      sazetak.appendChild(OF.h('dl', null, [].concat.apply([], redovi.map(function (r) { return [OF.h('dt', null, r[0]), OF.h('dd', null, r[1])]; }))));
    }
    function opisStanja() {
      var r = [];
      if (tip === 'termin') {
        if (stanje.usluga) { var u = Z.usluga(stanje.usluga); r.push([OF.t('zak.usluga'), OF.tx(u.naziv)]); r.push([OF.t('zak.cena'), OF.cenaTekst(Z.cena(u))]); r.push([OF.t('zak.trajanje'), OF.t('zak.min', { n: u.trajanje })]); }
        if (stanje.osoba) r.push([OF.t('zak.osoba'), stanje.osoba === 'bilo' ? OF.t('zak.bilo_ko') : Z.osoba(stanje.osoba).ime]);
      }
      if (tip === 'sto') { r.push([OF.t('zak.osoba_broj'), String(stanje.osoba)]); if (stanje.prostor) r.push([OF.t('zak.prostor'), nazivProstora(stanje.prostor)]); }
      if (tip === 'vozilo' && stanje.paket) { var opis = opcije.opisPaketa ? opcije.opisPaketa(stanje) : null; if (opis) opis.forEach(function (x) { r.push(x); }); }
      if (stanje.datum) r.push([OF.t('zak.datum'), D.dug(stanje.datum)]);
      if (stanje.vreme) r.push([tip === 'vozilo' ? OF.t('zak.ostavljanje') : OF.t('zak.vreme'), D.vreme(stanje.vreme)]);
      return r;
    }
    function nazivProstora(id) { var p = (c.prostori || []).filter(function (x) { return x.id === id; })[0]; return p ? OF.tx(p.naziv) : id; }

    function idi(n) {
      i = Math.max(0, Math.min(n, koraci.length - 1));
      crtajTok(); crtajSazetak();
      telo.innerHTML = '';
      var k = koraci[i];
      var sekcija = OF.h('section', { class: 'of-zak__sekcija of-zak__sekcija--' + k, 'aria-labelledby': 'zak-naslov' });
      var naslov = OF.h('h2', { id: 'zak-naslov', class: 'of-zak__naslov', tabindex: '-1' }, [OF.h('span', { class: 'of-zak__naslov-br' }, OF.t('zak.korak_od', { n: i + 1, uk: koraci.length })), ' ', naziviKoraka[k] || k]);
      sekcija.appendChild(naslov);
      (KORACI[k] || function () {})(sekcija);
      telo.appendChild(sekcija);
      najava.textContent = OF.t('zak.korak_od', { n: i + 1, uk: koraci.length }) + ': ' + (naziviKoraka[k] || k);
      if (Z._prviPut) { naslov.focus({ preventScroll: true }); var y = koren.getBoundingClientRect().top + w.scrollY - 90; if (w.scrollY > y) w.scrollTo({ top: y, behavior: OF.manjePokreta() ? 'auto' : 'smooth' }); }
      Z._prviPut = true;
      OF.emit('zak.korak', { korak: k, stanje: stanje });
    }
    function dugmad(sekcija, opcijeD) {
      opcijeD = opcijeD || {};
      var red = OF.h('div', { class: 'of-zak__dugmad' });
      if (i > 0) red.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { idi(i - 1); } }, OF.t('nazad')));
      var dalje = OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', disabled: opcijeD.zakljucano ? true : null, onclick: function () {
        if (opcijeD.provera && !opcijeD.provera()) return;
        if (opcijeD.naKlik) return opcijeD.naKlik(dalje);
        idi(i + 1); } }, opcijeD.tekst || OF.t('dalje'));
      red.appendChild(dalje); sekcija.appendChild(red);
      return dalje;
    }
    /* radio-kartice */
    function izbor(ime, stavke, trenutno, naIzbor, klasa) {
      var grupa = OF.h('div', { class: 'of-izbor ' + (klasa || ''), role: 'radiogroup' });
      stavke.forEach(function (s) {
        var id = 'iz-' + ime + '-' + String(s.vrednost).replace(/\W/g, '');
        var ulaz = OF.h('input', { type: 'radio', name: ime, id: id, value: s.vrednost, class: 'of-izbor__ulaz', checked: String(trenutno) === String(s.vrednost), disabled: s.iskljuceno ? true : null });
        ulaz.addEventListener('change', function () { naIzbor(s.vrednost); });
        grupa.appendChild(OF.h('div', { class: 'of-izbor__stavka' + (s.iskljuceno ? ' iskljuceno' : '') }, [ulaz,
          OF.h('label', { for: id, class: 'of-izbor__oznaka' }, [s.slika ? OF.h('span', { class: 'of-izbor__slika', 'aria-hidden': 'true', html: s.slika }) : null,
            OF.h('span', { class: 'of-izbor__glavno' }, s.naziv), s.opis ? OF.h('span', { class: 'of-izbor__opis' }, s.opis) : null, s.desno ? OF.h('span', { class: 'of-izbor__desno' }, s.desno) : null])]));
      });
      return grupa;
    }

    var KORACI = {};
    /* --- usluga --- */
    KORACI.usluga = function (s) {
      var grupe = {}, redosled = [];
      Z.usluge().forEach(function (u) { var k = OF.tx(u.kategorija) || ''; if (!grupe[k]) { grupe[k] = []; redosled.push(k); } grupe[k].push(u); });
      var dalje;
      redosled.forEach(function (k) {
        if (k) s.appendChild(OF.h('h3', { class: 'of-zak__grupa' }, k));
        s.appendChild(izbor('usluga', grupe[k].map(function (u) {
          return { vrednost: u.id, naziv: OF.tx(u.naziv), opis: [OF.t('zak.min', { n: u.trajanje }), OF.tx(u.kratko)].filter(Boolean).join(' · '), desno: OF.cenaTekst(Z.cena(u)) };
        }), stanje.usluga, function (v) {
          stanje.usluga = v; var u = Z.usluga(v);
          if (stanje.osoba && stanje.osoba !== 'bilo' && (u.osobe || []).indexOf(stanje.osoba) < 0) stanje.osoba = null;
          stanje.datum = null; stanje.vreme = null; dalje.disabled = false; crtajSazetak();
        }));
      });
      dalje = dugmad(s, { zakljucano: !stanje.usluga });
    };
    /* --- osoba --- */
    KORACI.osoba = function (s) {
      var u = Z.usluga(stanje.usluga) || {}, osobe = u.osobe || [];
      var stavke = osobe.map(function (id) {
        var o = Z.osoba(id); return { vrednost: id, naziv: o.ime, opis: OF.tx(o.titula), slika: o.inicijali ? '<span class="of-inicijali">' + OF.esc(o.inicijali) + '</span>' : null };
      });
      if (osobe.length > 1) stavke.unshift({ vrednost: 'bilo', naziv: OF.t('zak.bilo_ko'), opis: OF.t('zak.bilo_ko_opis') });
      if (osobe.length === 1 && !stanje.osoba) stanje.osoba = osobe[0];
      var dalje;
      s.appendChild(izbor('osoba', stavke, stanje.osoba, function (v) { stanje.osoba = v; stanje.datum = null; stanje.vreme = null; dalje.disabled = false; crtajSazetak(); }, 'of-izbor--osobe'));
      dalje = dugmad(s, { zakljucano: !stanje.osoba });
    };
    /* --- restoran: osobe i prostor --- */
    KORACI.sto = function (s) {
      var maks = c.maksOsoba || 8;
      var brojac = OF.h('div', { class: 'of-brojac' }, [
        OF.h('span', { class: 'of-brojac__oznaka', id: 'brojac-osobe' }, OF.t('zak.osoba_broj')),
        OF.h('button', { type: 'button', class: 'of-brojac__dugme', 'aria-label': OF.t('manje'), onclick: function () { promeni(-1); } }, '−'),
        OF.h('output', { class: 'of-brojac__vrednost', 'aria-labelledby': 'brojac-osobe', 'aria-live': 'polite' }, String(stanje.osoba)),
        OF.h('button', { type: 'button', class: 'of-brojac__dugme', 'aria-label': OF.t('vise'), onclick: function () { promeni(1); } }, '+')
      ]);
      var vise = OF.h('p', { class: 'of-zak__napomena' }, [OF.t('zak.vise_osoba', { n: maks }) + ' ', OF.h('a', { href: OF.link('proslave') }, OF.t('zak.upit_proslava'))]);
      var dep = OF.h('p', { class: 'of-zak__depozit' });
      function promeni(n) {
        stanje.osoba = Math.max(1, Math.min(maks, stanje.osoba + n)); OF.$('output', brojac).textContent = String(stanje.osoba);
        stanje.datum = null; stanje.vreme = null; azurirajDepozit(); crtajSazetak();
      }
      function azurirajDepozit() {
        var dp = c.depozit; dep.hidden = !(dp && stanje.osoba >= dp.odOsoba);
        if (!dep.hidden) dep.textContent = OF.t('zak.depozit_info', { n: dp.odOsoba, iznos: OF.din(dp.poOsobi * stanje.osoba) });
      }
      s.appendChild(brojac); s.appendChild(dep); s.appendChild(vise); azurirajDepozit();
      var danas = OF.sad().iso, prostori = c.prostori || [];
      s.appendChild(OF.h('h3', { class: 'of-zak__grupa' }, OF.t('zak.prostor')));
      if (!stanje.prostor) stanje.prostor = prostori[0] && prostori[0].id;
      s.appendChild(izbor('prostor', prostori.map(function (p) {
        var sezona = p.sezona ? OF.t('zak.sezona', { od: D.format('2026-' + p.sezona[0], { day: 'numeric', month: 'long' }), do: D.format('2026-' + p.sezona[1], { day: 'numeric', month: 'long' }) }) : '';
        return { vrednost: p.id, naziv: OF.tx(p.naziv), opis: [OF.tx(p.opis), sezona].filter(Boolean).join(' · ') };
      }), stanje.prostor, function (v) { stanje.prostor = v; stanje.datum = null; stanje.vreme = null; crtajSazetak(); }));
      dugmad(s);
    };
    /* --- detailing: paket (iz kalkulatora) --- */
    KORACI.paket = function (s) {
      var sadrzaj = OF.h('div', { class: 'of-zak__paket' }); s.appendChild(sadrzaj);
      var dalje = dugmad(s, { zakljucano: !stanje.paket });
      if (opcije.korakPaket) opcije.korakPaket(sadrzaj, stanje, function (ok) { dalje.disabled = !ok; crtajSazetak(); });
    };
    /* --- datum i vreme --- */
    KORACI.termin = function (s) {
      var mesec = (stanje.datum || OF.sad().iso).slice(0, 7);
      var kal = OF.h('div', { class: 'of-kal-izbor' });
      var vremena = OF.h('div', { class: 'of-vremena', 'aria-live': 'polite' });
      var dalje;
      function crtajKal() {
        kal.innerHTML = '';
        var prvi = mesec + '-01', danas = OF.sad().iso;
        var naslov = OF.h('p', { class: 'of-kal-izbor__mesec', id: 'kal-mesec' }, D.format(prvi, { month: 'long', year: 'numeric' }));
        var pret = OF.h('button', { type: 'button', class: 'of-kal-izbor__nav', 'aria-label': OF.t('zak.prethodni_mesec'), disabled: prvi <= danas.slice(0, 7) + '-01' ? true : null, onclick: function () { mesec = D.dodaj(prvi, -1).slice(0, 7); crtajKal(); } }, '‹');
        var sled = OF.h('button', { type: 'button', class: 'of-kal-izbor__nav', 'aria-label': OF.t('zak.sledeci_mesec'), disabled: D.razlika(danas, D.dodaj(prvi, 32).slice(0, 7) + '-01') > (c.unapredDana || 45) ? true : null, onclick: function () { mesec = D.dodaj(prvi, 32).slice(0, 7); crtajKal(); } }, '›');
        kal.appendChild(OF.h('div', { class: 'of-kal-izbor__glava' }, [pret, naslov, sled]));
        var mreza = OF.h('div', { class: 'of-kal-izbor__mreza', role: 'grid', 'aria-labelledby': 'kal-mesec' });
        var ponedeljak = D.dodaj('2026-01-05', 0);   // ponedeljak, za nazive dana
        var red = OF.h('div', { class: 'of-kal-izbor__red of-kal-izbor__red--dani', role: 'row' });
        for (var k = 0; k < 7; k++) red.appendChild(OF.h('span', { role: 'columnheader', class: 'of-kal-izbor__dan-ime', title: D.format(D.dodaj(ponedeljak, k), { weekday: 'long' }) }, D.format(D.dodaj(ponedeljak, k), { weekday: 'narrow' })));
        mreza.appendChild(red);
        var pomak = (D.danUNedelji(prvi) + 6) % 7, dan = D.dodaj(prvi, -pomak);
        for (var nedelja = 0; nedelja < 6; nedelja++) {
          red = OF.h('div', { class: 'of-kal-izbor__red', role: 'row' });
          for (var j = 0; j < 7; j++) {
            var iso = dan, uMesecu = iso.slice(0, 7) === mesec;
            var n = uMesecu ? Z.dostupnostDana(stanje, iso) : 0;
            var praznik = OF.praznik(iso);
            var opisDana = D.dug(iso) + (praznik ? ', ' + OF.tx(praznik) : '') + (n ? ', ' + OF.t('zak.ima_termina') : ', ' + OF.t('zak.nema_termina'));
            var b = OF.h('button', { type: 'button', role: 'gridcell', class: 'of-kal-izbor__dan' + (iso === danas ? ' danas' : '') + (!uMesecu ? ' van' : '') + (n && n < 4 ? ' malo' : ''),
              'aria-label': opisDana, 'aria-pressed': stanje.datum === iso ? 'true' : 'false', disabled: n ? null : true, 'data-iso': iso },
              [OF.h('span', null, String(+iso.slice(8))), n ? OF.h('span', { class: 'of-kal-izbor__tacka', 'aria-hidden': 'true' }) : null]);
            (function (iso) { b.addEventListener('click', function () { stanje.datum = iso; stanje.vreme = null; crtajKal(); crtajVremena(); crtajSazetak(); dalje.disabled = true; var prvoVreme = OF.$('input', vremena); if (prvoVreme && w.matchMedia('(max-width: 760px)').matches) vremena.scrollIntoView({ block: 'start', behavior: OF.manjePokreta() ? 'auto' : 'smooth' }); }); })(iso);
            red.appendChild(b); dan = D.dodaj(dan, 1);
          }
          mreza.appendChild(red);
          if (dan.slice(0, 7) !== mesec && D.danUNedelji(dan) === 1) break;
        }
        kal.appendChild(mreza);
        kal.appendChild(OF.h('p', { class: 'of-kal-izbor__legenda' }, [OF.h('span', { class: 'of-kal-izbor__tacka', 'aria-hidden': 'true' }), ' ' + OF.t('zak.legenda')]));
      }
      function crtajVremena() {
        vremena.innerHTML = '';
        if (!stanje.datum) { vremena.appendChild(OF.h('p', { class: 'of-vremena__prazno' }, OF.t('zak.izaberite_dan'))); return; }
        var lista = [];
        if (tip === 'termin') {
          var u = Z.usluga(stanje.usluga);
          if (stanje.osoba && stanje.osoba !== 'bilo') lista = Z.slobodno(stanje.usluga, stanje.osoba, stanje.datum).map(function (t) { return { t: t }; });
          else lista = Z.slobodnoBiloKo(stanje.usluga, u.osobe || [], stanje.datum);
        } else if (tip === 'sto') lista = Z.slobodnoSto(stanje.datum, stanje.osoba, stanje.prostor);
        else lista = Z.slobodnoVozilo(stanje.datum, stanje.sati);
        vremena.appendChild(OF.h('h3', { class: 'of-vremena__naslov' }, D.dug(stanje.datum)));
        if (!lista.length) { vremena.appendChild(OF.h('p', { class: 'of-vremena__prazno' }, OF.t('zak.nema_termina_dan'))); return; }
        var delovi = tip === 'vozilo' ? [[0, 1440, OF.t('zak.ostavljanje_vozila')]] : [[0, 720, OF.t('zak.pre_podne')], [720, 1020, OF.t('zak.posle_podne')], [1020, 2000, OF.t('zak.uvece')]];
        delovi.forEach(function (dp) {
          var deo = lista.filter(function (x) { return x.t >= dp[0] && x.t < dp[1]; }); if (!deo.length) return;
          vremena.appendChild(OF.h('p', { class: 'of-vremena__deo' }, dp[2]));
          vremena.appendChild(izbor('vreme', deo.map(function (x) {
            return { vrednost: D.uHHMM(x.t % 1440), naziv: D.vreme(D.uHHMM(x.t % 1440)), opis: x.malo ? OF.t('zak.malo_mesta') : null };
          }), stanje.vreme, function (v) {
            stanje.vreme = v; var x = deo.filter(function (y) { return D.uHHMM(y.t % 1440) === v; })[0];
            stanje._osobeSlobodne = x && x.osobe; stanje.sto = x && x.sto; dalje.disabled = false; crtajSazetak();
          }, 'of-izbor--vremena'));
        });
      }
      s.appendChild(OF.h('div', { class: 'of-zak__kal-raspored' }, [kal, vremena]));
      dalje = dugmad(s, { zakljucano: !stanje.vreme });
      function prikazi() {
        if (!stanje.datum) {   // predloži prvi slobodan dan
          for (var k = 0; k < (c.unapredDana || 45); k++) { var iso = D.dodaj(OF.sad().iso, k); if (Z.dostupnostDana(stanje, iso)) { stanje.datum = iso; mesec = iso.slice(0, 7); break; } }
        }
        crtajKal(); crtajVremena();
      }
      if (OF.demo) prikazi();
      else { vremena.appendChild(OF.h('p', { class: 'of-vremena__prazno' }, [OF.h('span', { class: 'of-spiner', 'aria-hidden': 'true' }), ' ' + OF.t('zak.ucitavam')])); Z.ucitajZauzeto(OF.sad().iso, D.dodaj(OF.sad().iso, (c.unapredDana || 45) + 1)).then(prikazi); }
    };
    /* --- podaci --- */
    KORACI.podaci = function (s) {
      var forma = OF.h('form', { class: 'of-forma', novalidate: true });
      var polje = function (ime, oznaka, attrs, pomoc) {
        var id = 'zp-' + ime;
        var ulaz = attrs.tip === 'textarea' ? OF.h('textarea', Object.assign({ id: id, name: ime, rows: 3 }, attrs.a || {})) : OF.h('input', Object.assign({ id: id, name: ime, type: attrs.tip || 'text', value: stanje[ime] || '' }, attrs.a || {}));
        if (attrs.tip === 'textarea') ulaz.value = stanje[ime] || '';
        return OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: id }, [oznaka, attrs.opciono ? OF.h('span', { class: 'of-polje__opciono' }, ' ' + OF.t('opciono')) : null]), pomoc ? OF.h('p', { class: 'of-polje__pomoc', id: id + '-p' }, pomoc) : null, ulaz]);
      };
      forma.appendChild(polje('ime', OF.t('f.ime'), { a: { autocomplete: 'name', required: true } }));
      forma.appendChild(polje('telefon', OF.t('f.telefon'), { tip: 'tel', a: { autocomplete: 'tel', inputmode: 'tel', required: true } }, OF.t('f.telefon_pomoc')));
      forma.appendChild(polje('email', OF.t('f.email'), { tip: 'email', a: { autocomplete: 'email', required: true } }, OF.t('f.email_pomoc')));
      (c.dodatnaPolja || []).forEach(function (p) {
        if (p.tip === 'cekiraj') {
          var id = 'zp-' + p.ime, cb = OF.h('input', { type: 'checkbox', id: id, name: p.ime, checked: !!stanje[p.ime] });
          forma.appendChild(OF.h('div', { class: 'of-polje of-polje--cek' }, [cb, OF.h('label', { for: id }, OF.tx(p.oznaka))]));
        } else forma.appendChild(polje(p.ime, OF.tx(p.oznaka), { tip: p.tip, opciono: !p.obavezno, a: p.atributi || {} }, OF.tx(p.pomoc)));
      });
      forma.appendChild(polje('napomena', OF.tx(c.oznakaNapomene) || OF.t('f.napomena'), { tip: 'textarea', opciono: true }));
      var sid = 'zp-saglasnost';
      forma.appendChild(OF.h('div', { class: 'of-polje of-polje--cek' }, [OF.h('input', { type: 'checkbox', id: sid, name: 'saglasnost', checked: stanje.saglasnost }),
        OF.h('label', { for: sid }, [OF.t('f.saglasnost') + ' ', OF.h('a', { href: OF.link('privatnost'), target: '_blank', rel: 'noopener' }, OF.t('f.politika'))])]));
      s.appendChild(forma);
      dugmad(s, { provera: function () {
        var pravila = {
          ime: function (v) { return OF.provera.ime(v) ? '' : OF.t('g.ime'); },
          telefon: function (v) { return OF.provera.telefon(v) ? '' : OF.t('g.telefon'); },
          email: function (v) { return OF.provera.email(v) ? '' : OF.t('g.email'); },
          saglasnost: function (v) { return v ? '' : OF.t('g.saglasnost'); }
        };
        (c.dodatnaPolja || []).forEach(function (p) { if (p.obavezno) pravila[p.ime] = function (v) { return String(v || '').trim() ? '' : OF.t('g.obavezno'); }; });
        if (!OF.forma(forma, pravila)) return false;
        ['ime', 'telefon', 'email', 'napomena', 'saglasnost'].concat((c.dodatnaPolja || []).map(function (p) { return p.ime; })).forEach(function (k) {
          var el = forma.elements[k]; if (el) stanje[k] = el.type === 'checkbox' ? el.checked : el.value.trim();
        });
        return true;
      } });
    };
    /* --- pregled i slanje --- */
    KORACI.pregled = function (s) {
      var redovi = opisStanja().concat([[OF.t('f.ime'), stanje.ime], [OF.t('f.telefon'), stanje.telefon], [OF.t('f.email'), stanje.email]]);
      (c.dodatnaPolja || []).forEach(function (p) { if (stanje[p.ime] && p.tip !== 'cekiraj') redovi.push([OF.tx(p.oznaka), stanje[p.ime]]); });
      if (stanje.napomena) redovi.push([OF.t('f.napomena'), stanje.napomena]);
      s.appendChild(OF.h('dl', { class: 'of-pregled' }, [].concat.apply([], redovi.map(function (r) { return [OF.h('dt', null, r[0]), OF.h('dd', null, r[1])]; }))));
      var depozit = iznosDepozita();
      if (depozit) s.appendChild(OF.h('p', { class: 'of-zak__depozit' }, OF.t('zak.depozit_placa', { iznos: OF.din(depozit) })));
      if (c.pravilaOtkazivanja) s.appendChild(OF.h('p', { class: 'of-zak__napomena' }, OF.tx(c.pravilaOtkazivanja)));
      dugmad(s, { tekst: depozit ? OF.t('zak.plati_depozit', { iznos: OF.din(depozit) }) : OF.tx(c.tekstPotvrde) || OF.t('zak.potvrdi'), naKlik: function (dugme) {
        dugme.disabled = true; dugme.setAttribute('aria-busy', 'true');
        posalji(depozit).then(function () {}, function () { dugme.disabled = false; dugme.removeAttribute('aria-busy'); });
      } });
    };
    function iznosDepozita() {
      if (tip === 'sto' && c.depozit && stanje.osoba >= c.depozit.odOsoba) return c.depozit.poOsobi * stanje.osoba;
      if (tip === 'vozilo' && c.depozitVozilo) return opcije.depozit ? opcije.depozit(stanje) : c.depozitVozilo;
      return 0;
    }
    function posalji(depozit) {
      var t = { tip: tip, ime: stanje.ime, telefon: stanje.telefon, email: stanje.email, napomena: stanje.napomena, datum: stanje.datum, vreme: stanje.vreme };
      (c.dodatnaPolja || []).forEach(function (p) { t[p.ime] = stanje[p.ime]; });
      if (tip === 'termin') {
        var u = Z.usluga(stanje.usluga);
        t.usluga = u.id; t.trajanje = u.trajanje; t.cena = Z.cena(u);
        var osoba = stanje.osoba;
        if (!osoba || osoba === 'bilo') { var slobodne = stanje._osobeSlobodne || u.osobe; osoba = slobodne[Math.floor(OF.seme(stanje.datum + stanje.vreme) * slobodne.length)]; }
        t.osoba = osoba; t.biloKo = stanje.osoba === 'bilo';
        // demo: izmišljen link za prikaz; pravi režim: server napravi događaj u Google kalendaru sa pravim Meet linkom
        if (u.video) t.meet = OF.demo ? 'https://meet.google.com/' + ['abc', 'kmd', 'pvx', 'rta'][Math.floor(OF.seme(t.vreme + t.datum) * 4)] + '-' + OF.id().slice(0, 4).toLowerCase() + '-' + OF.id().slice(0, 3).toLowerCase() : null;
      }
      if (tip === 'sto') { t.osobe = stanje.osoba; t.prostor = stanje.prostor; t.sto = stanje.sto; t.trajanje = stanje.osoba >= 6 ? (c.trajanjeGrupe || 150) : (c.trajanje || 120); }
      if (tip === 'vozilo') { if (opcije.uTermin) opcije.uTermin(t, stanje); t.trajanje = 30; t.gotovo = Z.gotovo(stanje.datum, D.uMin(stanje.vreme), t.sati || 3); }
      var korak = depozit ? OF.placanje.pokreni({ iznos: depozit, opis: OF.t('zak.depozit_opis', { firma: OF.d.firma.ime }), tip: 'depozit', kupac: { ime: t.ime, email: t.email, telefon: t.telefon } }) : Promise.resolve(null);
      return korak.then(function (pl) {
        if (pl) { t.depozit = depozit; t.placanje = pl; }
        Z.pripremi(t);
        return OF.int.dogadjaj('termin.novi', { termin: t, link: Z.linkMojTermin(t) }).then(function (r) {
          if (!OF.demo && (!r || !r.ok)) {          // npr. termin je upravo zauzet: osveži kalendar
            Z.osveziZauzeto(); var g = { poruka: r && r.zauzeto ? OF.t('zak.zauzet') : ((r && r.poruka) || OF.t('zak.server_greska')) };
            if (r && r.zauzeto) { stanje.vreme = null; setTimeout(function () { idi(koraci.indexOf('termin')); }, 50); }
            throw g;
          }
          if (r && r.termin) Object.assign(t, r.termin);   // server vraća svoj broj termina, ključ za link, cenu i pravi Meet link
          Z.sacuvaj(t);
          // nalog: zapamti podatke
          var nalog = OF.nalog(); if (nalog && nalog.email === t.email) { nalog.ime = t.ime; nalog.telefon = t.telefon; OF.store.set('nalog', nalog); }
          potvrda(t);
        });
      }).then(null, function (greska) {
        if (greska && greska.poruka) OF.obavesti(greska.poruka, 'greska');
        throw greska;
      });
    }
    function potvrda(t) {
      tok.innerHTML = ''; sazetak.hidden = true; telo.innerHTML = '';
      var dog = Z.dogadjajZaKalendar(t);
      var s = OF.h('section', { class: 'of-zak__potvrda', 'aria-labelledby': 'zak-potvrda' });
      s.appendChild(OF.h('p', { class: 'of-zak__potvrda-oznaka' }, OF.t('zak.potvrdjeno')));
      s.appendChild(OF.h('h2', { id: 'zak-potvrda', tabindex: '-1' }, OF.tx(c.naslovPotvrde) || OF.t('zak.vidimo_se', { ime: t.ime.split(' ')[0] })));
      var redovi = [[OF.t('zak.broj'), t.id]].concat(tip === 'termin' ? [[OF.t('zak.usluga'), OF.tx(Z.usluga(t.usluga).naziv)], [OF.t('zak.osoba'), Z.osoba(t.osoba).ime]] : tip === 'sto' ? [[OF.t('zak.osoba_broj'), String(t.osobe)], [OF.t('zak.prostor'), nazivProstora(t.prostor)]] : (opcije.redoviPotvrde ? opcije.redoviPotvrde(t) : []))
        .concat([[OF.t('zak.datum'), D.dug(t.datum)], [tip === 'vozilo' ? OF.t('zak.ostavljanje') : OF.t('zak.vreme'), D.vreme(t.vreme)]]);
      if (t.gotovo) redovi.push([OF.t('zak.gotovo'), D.dug(t.gotovo.datum) + ', ' + D.vreme(t.gotovo.vreme)]);
      if (t.depozit) redovi.push([OF.t('zak.placen_depozit'), OF.din(t.depozit)]);
      if (t.meet) redovi.push(['Google Meet', t.meet]);
      s.appendChild(OF.h('dl', { class: 'of-pregled' }, [].concat.apply([], redovi.map(function (r) { return [OF.h('dt', null, r[0]), OF.h('dd', null, r[1])]; }))));
      s.appendChild(OF.h('p', null, OF.t('zak.stize_mejl', { email: t.email })));
      var akcije = OF.h('div', { class: 'of-zak__dugmad of-zak__dugmad--potvrda' }, [
        OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: function () { Z.preuzmiIcs(t); } }, OF.t('zak.dodaj_kalendar')),
        OF.h('a', { class: 'of-dugme of-dugme--sporedno', href: OF.int.googleKalendarLink(dog), target: '_blank', rel: 'noopener' }, 'Google Kalendar'),
        OF.h('a', { class: 'of-dugme of-dugme--tekst', href: Z.linkMojTermin(t) }, OF.t('zak.pomeri_otkazi'))
      ]);
      s.appendChild(akcije);
      if (opcije.posle) opcije.posle(s, t);
      telo.appendChild(s);
      OF.$('#zak-potvrda', s).focus();
      w.scrollTo({ top: koren.getBoundingClientRect().top + w.scrollY - 90, behavior: OF.manjePokreta() ? 'auto' : 'smooth' });
      OF.emit('zak.potvrdjeno', t);
    }
    idi(i);
    return { stanje: stanje, idi: idi };
  };

  /* =====================================================================
     MOJ TERMIN: pomeri ili otkaži preko linka iz mejla
     ===================================================================== */
  Z.mojTermin = function (koren, ponovo) {
    if (!koren) return;
    var id = OF.upit('id'), token = OF.upit('t'), t = Z.nadji(id, token), c = cfg();
    if (!OF.demo && !ponovo && id && token) {      // pravi režim: uvek najnovije stanje sa servera (link iz mejla radi na svakom uređaju)
      koren.innerHTML = ''; koren.appendChild(OF.h('p', null, [OF.h('span', { class: 'of-spiner', 'aria-hidden': 'true' }), ' ' + OF.t('zak.ucitavam')]));
      fetch(OF.int.api('/termin?id=' + encodeURIComponent(id) + '&t=' + encodeURIComponent(token)), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; }).then(function (o) { if (o && o.termin) Z.sacuvaj(o.termin); Z.mojTermin(koren, true); }, function () { Z.mojTermin(koren, true); });
      return;
    }
    koren.innerHTML = '';
    if (!t) {
      koren.appendChild(OF.h('div', { class: 'of-moj' }, [OF.h('h2', null, OF.t('moj.nije_nadjen')), OF.h('p', null, OF.t('moj.nije_nadjen_opis')),
        OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('a', { class: 'of-dugme of-dugme--glavno', href: OF.tel() }, OF.t('pozovite')), OF.h('a', { class: 'of-dugme of-dugme--sporedno', href: OF.link('nalog') }, OF.t('moj.nalog'))])]));
      return;
    }
    var tip = t.tip || c.tip || 'termin';
    var otkazan = t.status === 'otkazan';
    var minDo = (D.uUTC(t.datum, t.vreme) - new Date()) / 60000;
    var kasno = minDo < (c.otkazivanjeSati || 24) * 60;
    var prosao = minDo < 0;
    var red = function (k, v) { return [OF.h('dt', null, k), OF.h('dd', null, v)]; };
    var detalji = [].concat(red(OF.t('zak.broj'), t.id),
      tip === 'termin' ? red(OF.t('zak.usluga'), OF.tx(Z.usluga(t.usluga).naziv)).concat(red(OF.t('zak.osoba'), Z.osoba(t.osoba).ime)) : tip === 'sto' ? red(OF.t('zak.osoba_broj'), String(t.osobe)) : red(OF.t('zak.vozilo'), t.vozilo || ''),
      red(OF.t('zak.datum'), D.dug(t.datum)), red(tip === 'vozilo' ? OF.t('zak.ostavljanje') : OF.t('zak.vreme'), D.vreme(t.vreme)), red(OF.t('moj.status'), otkazan ? OF.t('moj.otkazan') : prosao ? OF.t('moj.prosao') : OF.t('moj.potvrdjen')));
    var kutija = OF.h('div', { class: 'of-moj' }, [OF.h('p', { class: 'of-moj__oznaka' }, OF.t('moj.vas_termin')), OF.h('h2', null, t.ime), OF.h('dl', { class: 'of-pregled' }, detalji)]);
    koren.appendChild(kutija);
    if (otkazan || prosao) { kutija.appendChild(OF.h('a', { class: 'of-dugme of-dugme--glavno', href: OF.link('zakazivanje') }, OF.t('moj.novi'))); return; }
    if (kasno) kutija.appendChild(OF.h('p', { class: 'of-zak__napomena' }, OF.t('moj.kasno', { sati: c.otkazivanjeSati || 24 })));
    var akcije = OF.h('div', { class: 'of-zak__dugmad' });
    if (!kasno && tip !== 'vozilo') akcije.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: pomeri }, OF.t('moj.pomeri')));
    akcije.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: otkazi }, OF.t('moj.otkazi')));
    akcije.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () { Z.preuzmiIcs(t); } }, OF.t('zak.dodaj_kalendar')));
    kutija.appendChild(akcije);
    var prostorZaPomeranje = OF.h('div', { class: 'of-moj__pomeranje' });
    koren.appendChild(prostorZaPomeranje);

    function otkazi() {
      var dl = OF.dijalog({ naslov: OF.t('moj.otkazi_naslov'), id: 'otk', sadrzaj: OF.h('div', null, [
        OF.h('p', null, OF.t('moj.otkazi_pitanje', { kad: D.dug(t.datum) + ', ' + D.vreme(t.vreme) })),
        t.depozit ? OF.h('p', { class: 'of-zak__napomena' }, OF.tx(c.povracajDepozita) || '') : null,
        OF.h('div', { class: 'of-zak__dugmad' }, [
          OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { dl.zatvori(); } }, OF.t('moj.ne_hvala')),
          OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: function () {
            var novi = Object.assign({}, t, { status: 'otkazan', otkazan: new Date().toISOString() });
            OF.int.dogadjaj('termin.otkazan', { termin: novi }).then(function (r) {
              if (!OF.demo && (!r || !r.ok)) { OF.obavesti((r && r.poruka) || OF.t('zak.server_greska'), 'greska'); return; }
              OF.store.izmeni('termini', t.id, function (x) { x.status = 'otkazan'; x.otkazan = novi.otkazan; return x; });
              dl.zatvori(); Z.mojTermin(koren, true); OF.obavesti(OF.t('moj.otkazano'));
            });
          } }, OF.t('moj.da_otkazi'))
        ])
      ]) });
    }
    function pomeri() {
      if (!OF.demo && !pomeri._ucitano) { pomeri._ucitano = true; return Z.ucitajZauzeto(OF.sad().iso, D.dodaj(OF.sad().iso, (c.unapredDana || 45) + 1)).then(pomeri); }
      prostorZaPomeranje.innerHTML = '';
      var stanje = { usluga: t.usluga, osoba: t.osoba, datum: null, vreme: null, osobe: t.osobe, prostor: t.prostor };
      var naslov = OF.h('h2', { tabindex: '-1' }, OF.t('moj.novo_vreme'));
      var kal = OF.h('div', { class: 'of-zak__kal-raspored' });
      prostorZaPomeranje.appendChild(naslov); prostorZaPomeranje.appendChild(kal);
      var dani = [], danas = OF.sad().iso;
      for (var k = 0; k < (c.unapredDana || 45) && dani.length < 14; k++) {
        var iso = D.dodaj(danas, k);
        var lista = tip === 'sto' ? Z.slobodnoSto(iso, t.osobe, t.prostor, t.id).map(function (x) { return x.t; }) : Z.slobodno(t.usluga, t.osoba, iso, t.id);
        if (lista.length) dani.push({ iso: iso, lista: lista });
      }
      var izabran = null, vreme = null;
      var traka = OF.h('div', { class: 'of-traka-dana', role: 'radiogroup', 'aria-label': OF.t('zak.datum') });
      var vremena = OF.h('div', { class: 'of-vremena' });
      var sacuvaj = OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', disabled: true, onclick: function () {
        var stari = { datum: t.datum, vreme: t.vreme };
        var novi = Object.assign({}, t, { datum: izabran.iso, vreme: vreme, pomeren: new Date().toISOString() });
        if (tip === 'sto') { var st = Z.slobodnoSto(izabran.iso, t.osobe, t.prostor, t.id).filter(function (y) { return D.uHHMM(y.t % 1440) === vreme; })[0]; if (st) novi.sto = st.sto; }
        sacuvaj.disabled = true;
        OF.int.dogadjaj('termin.pomeren', { termin: novi, stari: stari, link: Z.linkMojTermin(t) }).then(function (r) {
          if (!OF.demo && (!r || !r.ok)) { sacuvaj.disabled = false; Z.osveziZauzeto(); OF.obavesti((r && r.poruka) || OF.t('zak.server_greska'), 'greska'); return; }
          OF.store.izmeni('termini', t.id, function (x) { x.datum = novi.datum; x.vreme = novi.vreme; x.pomeren = novi.pomeren; if (novi.sto) x.sto = novi.sto; return x; });
          OF.obavesti(OF.t('moj.pomereno')); Z.mojTermin(koren, true);
        });
      } }, OF.t('moj.sacuvaj'));
      dani.forEach(function (dn, n) {
        var id = 'pd-' + n;
        var r = OF.h('input', { type: 'radio', name: 'pomeri-dan', id: id, class: 'of-izbor__ulaz' });
        r.addEventListener('change', function () { izabran = dn; vreme = null; sacuvaj.disabled = true; crtaj(); });
        traka.appendChild(OF.h('div', { class: 'of-traka-dana__stavka' }, [r, OF.h('label', { for: id }, [OF.h('span', null, D.format(dn.iso, { weekday: 'short' })), OF.h('strong', null, D.format(dn.iso, { day: 'numeric', month: 'numeric' }))])]));
      });
      function crtaj() {
        vremena.innerHTML = '';
        if (!izabran) return;
        var g = OF.h('div', { class: 'of-izbor of-izbor--vremena', role: 'radiogroup', 'aria-label': OF.t('zak.vreme') });
        izabran.lista.forEach(function (tt, n) {
          var v = D.uHHMM(tt % 1440), id = 'pv-' + n;
          var r = OF.h('input', { type: 'radio', name: 'pomeri-vreme', id: id, value: v, class: 'of-izbor__ulaz' });
          r.addEventListener('change', function () { vreme = v; sacuvaj.disabled = false; });
          g.appendChild(OF.h('div', { class: 'of-izbor__stavka' }, [r, OF.h('label', { for: id, class: 'of-izbor__oznaka' }, OF.h('span', { class: 'of-izbor__glavno' }, D.vreme(v)))]));
        });
        vremena.appendChild(g);
      }
      kal.appendChild(traka); kal.appendChild(vremena);
      prostorZaPomeranje.appendChild(OF.h('div', { class: 'of-zak__dugmad' }, [sacuvaj]));
      naslov.focus();
    }
  };
})(window, document);
