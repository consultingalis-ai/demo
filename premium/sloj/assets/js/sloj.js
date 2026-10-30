/* SLOJ · ponašanje specifično za ovaj sajt
   Cene usluga po veličini vozila (iste formule kao šabloni i server), kalkulator, korak „usluga i vozilo“ u zakazivanju
   (depozit po pragovima, pranje iz članstva bez depozita), merenje laka na crtežu, pre/posle, brojači, galerija radova,
   zaglavlje (meni usluga, status, traka „Zakažite“), poklon vaučer, traka „u korpu“ i namere pomoćnika.
   Učitava se i na serveru (recepti i cene), zato sve što dira stranicu ide kroz OF.spremno. */
(function (w, d) {
  'use strict';
  var OF = w.OF, D = OF.datum, S = OF.sloj = {};
  var en = function () { return OF.jezik === 'en'; };

  /* =====================================================================
     CENE
     ===================================================================== */
  var z500 = function (n) { return Math.round(n / 500) * 500; };
  S.velicine = function () { return OF.d.velicine || []; };
  S.velicina = function (id) { return S.velicine().filter(function (v) { return v.id === id; })[0] || S.velicine()[1] || { id: 'srednje', koef: 1 }; };
  S.usluga = function (id) { return (OF.d.usluge || []).filter(function (u) { return u.id === id; })[0]; };
  S.dodatak = function (id) { return (OF.d.dodaci || []).filter(function (x) { return x.id === id; })[0]; };
  S.grupa = function (id) { return ((OF.d.grupe || []).filter(function (g) { return g.id === id; })[0] || {}).naziv; };
  S.cenaUsluge = function (u, vel) { var b = OF.cene.za(u.id, u.cena); return u.istaCena ? b : z500(b * S.velicina(vel).koef); };
  S.cenaDodatka = function (x, vel) { var b = OF.cene.za('dodatak-' + x.id, x.cena); return x.istaCena ? b : z500(b * S.velicina(vel).koef); };
  S.depozitZa = function (iznos) { var p = ((OF.d.depozit || {}).pragovi || []).filter(function (x) { return iznos <= x.do; })[0]; return p ? p.iznos : 0; };
  /* dodaci koji se nude uz uslugu */
  S.dodaciZa = function (u) {
    if (!u) return [];
    return (OF.d.dodaci || []).filter(function (x) { return (x.zaGrupe || []).indexOf(u.grupa) >= 0 && (x.osim || []).indexOf(u.id) < 0 && x.id !== u.id; });
  };
  var CLAN = 'clan-pranje';
  S.clanstvo = function (x) { return x && x.clanstvoObj !== undefined ? x.clanstvoObj : OF.clanstvo ? OF.clanstvo.mojeAktivno() : null; };   // server prosleđuje članstvo iz baze
  /* račun za izbor: { stavke, ukupno, depozit, sati, dana, garancija } */
  S.racun = function (x) {
    var vel = x.velicina || 'srednje', stavke = [], sati = 0, susenje = false;
    if (x.paket === CLAN) {
      var c = S.clanstvo(x), plan = c && OF.clanstvo.plan(c.plan);
      stavke.push([OF.t('vz.clan_pranje') + (plan ? ' · ' + OF.tx(plan.naziv) : ''), 0]); sati = 3;
      (x.dodaci || []).forEach(function (id) { var dx = S.dodatak(id); if (dx) { stavke.push([OF.tx(dx.naziv), S.cenaDodatka(dx, vel)]); sati += dx.sati || 0; if (id === 'enterijer' || id === 'koza') susenje = true; } });
      var uk0 = stavke.reduce(function (a, s) { return a + s[1]; }, 0);
      return { stavke: stavke, ukupno: uk0, popust: 0, depozit: 0, sati: sati, dana: danaTekst(sati, susenje, null), garancija: null, clan: true };
    }
    var u = S.usluga(x.paket); if (!u) return null;
    stavke.push([OF.tx(u.naziv), S.cenaUsluge(u, vel)]); sati = u.sati || 3;
    if (u.grupa === 'enterijer') susenje = true;
    (x.dodaci || []).forEach(function (id) { var dx = S.dodatak(id); if (!dx || S.dodaciZa(u).indexOf(dx) < 0) return; stavke.push([OF.tx(dx.naziv), S.cenaDodatka(dx, vel)]); sati += dx.sati || 0; if (id === 'enterijer' || id === 'koza') susenje = true; });
    var ukupno = stavke.reduce(function (a, s) { return a + s[1]; }, 0);
    var c = S.clanstvo(x), plan = c && OF.clanstvo.plan(c.plan), popust = plan && plan.popust ? z500(ukupno * plan.popust / 100) : 0;   // članovi: popust na ostale usluge
    var konacno = ukupno - popust;
    // keramika i folija se suše (IR lampe, pa noć): vozilo se preuzima najranije sledećeg radnog dana
    var nocenje = u.grupa === 'keramika' || u.grupa === 'folija' || u.grupa === 'wrap' || (x.dodaci || []).indexOf('folija-zone') >= 0;
    return { stavke: stavke, ukupno: konacno, bezPopusta: ukupno, popust: popust, popustProcenat: plan && plan.popust, depozit: S.depozitZa(konacno), sati: sati, nocenje: nocenje,
      dana: (x.dodaci || []).length ? danaTekst(sati, susenje, u) : OF.tx(u.dana), garancija: u.godina ? OF.t('vz.garancija_god', { n: u.godina, s: OF.garancija.slojevi(u.slojeva) }) : u.grupa === 'folija' ? OF.t('vz.garancija_folija', { n: (OF.d.garancija || {}).ugradnjaGodina || 2, m: (OF.d.garancija || {}).folijaGodina || 10 }) : u.garancija ? OF.tx(u.garancija) : null, naUpit: !!u.naUpit };
  };
  function danaTekst(sati, susenje, u) {
    if (sati <= 6 && !susenje) return OF.t('vz.isti_dan');
    if (sati <= 9) return OF.t('vz.do_sutra');
    var n = Math.ceil(sati / 9);
    return u && u.dana && n <= 1 ? OF.tx(u.dana) : OF.t('vz.dana', { n: n });
  }
  S.linkZakazivanja = function (x) {
    return OF.link('zakazivanje', ['paket=' + encodeURIComponent(x.paket || ''), 'velicina=' + encodeURIComponent(x.velicina || 'srednje'), (x.dodaci || []).length ? 'dodaci=' + x.dodaci.join(',') : ''].filter(Boolean).join('&'));
  };

  /* =====================================================================
     IZBOR USLUGE (kalkulator na stranici Cene i prvi korak zakazivanja)
     ===================================================================== */
  /* crta izbor u „koren“; stanje { velicina, grupa, paket, dodaci[] }; naPromenu(stanje, racun) */
  S.izbor = function (koren, stanje, naPromenu, o) {
    o = o || {};
    var c = o.clanovi !== false && S.clanstvo();
    var grupe = ['pranje', 'enterijer', 'poliranje', 'keramika', 'folija', 'wrap', 'zatamnjivanje', 'felne'];
    if (!stanje.velicina) stanje.velicina = 'srednje';
    if (stanje.paket && stanje.paket !== CLAN && S.usluga(stanje.paket)) stanje.grupa = S.usluga(stanje.paket).grupa;
    if (stanje.paket === CLAN && !c) stanje.paket = null;
    // pranje iz članstva: veličina vozila iz članstva (0 = malo i srednje, 1 = SUV i kombi), osim ako je izabrana u linku
    var velClana = function () { return c && c.velicina ? 'suv' : (stanje.velicina === 'malo' ? 'malo' : 'srednje'); };
    if (stanje.paket === CLAN && c && !OF.upit('velicina')) stanje.velicina = velClana();
    stanje.grupa = stanje.grupa || 'keramika';
    stanje.dodaci = stanje.dodaci || [];
    var el = { vel: OF.$('[data-s-kalk-velicine]', koren), grupe: OF.$('[data-s-kalk-grupe]', koren), usluge: OF.$('[data-s-kalk-usluge]', koren), dodaci: OF.$('[data-s-kalk-dodaci]', koren) };
    /* veličina */
    OF.$$('input[name=velicina]', koren).forEach(function (r) {
      r.checked = r.value === stanje.velicina;
      r.addEventListener('change', function () { stanje.velicina = r.value; crtajUsluge(); crtajDodatke(); javi(); });
    });
    /* grupa */
    OF.$$('[data-s-grupa]', koren).forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-s-grupa') === stanje.grupa));
      b.addEventListener('click', function () {
        stanje.grupa = b.getAttribute('data-s-grupa');
        OF.$$('[data-s-grupa]', koren).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        var kandidati = (OF.d.usluge || []).filter(function (u) { return u.grupa === stanje.grupa && !u.naUpit && u.online !== false && !u.odrzavanje; });
        var prva = kandidati.filter(function (u) { return u.istaknuto; })[0] || kandidati[0];
        stanje.paket = prva ? prva.id : null;
        // dodaci koji važe i za novu uslugu ostaju izabrani
        var dozvoljeni = prva ? S.dodaciZa(prva).map(function (d) { return d.id; }) : [];
        stanje.dodaci = (stanje.dodaci || []).filter(function (id) { return dozvoljeni.indexOf(id) >= 0; });
        crtajUsluge(); crtajDodatke(); javi();
      });
    });
    function izborStavka(tip, ime, vrednost, naslov, opis, desno, cekirano, iskljuceno, naKlik) {
      var id = (o.prefiks || 'k') + '-' + ime + '-' + vrednost;
      var ulaz = OF.h('input', { type: tip, name: (o.prefiks || 'k') + '-' + ime, id: id, value: vrednost, checked: !!cekirano, disabled: iskljuceno ? true : null });
      ulaz.addEventListener('change', function () { naKlik(ulaz.checked); });
      return OF.h('div', { class: 's-kalk__izbor' + (iskljuceno ? ' ne-moze' : '') }, [ulaz, OF.h('label', { for: id }, [OF.h('strong', null, naslov), OF.h('span', { class: 's-mono' }, desno), opis ? OF.h('small', null, opis) : null])]);
    }
    function crtajUsluge() {
      el.usluge.innerHTML = '';
      var lista = (OF.d.usluge || []).filter(function (u) { return u.grupa === stanje.grupa && u.online !== false; });
      if (!stanje.paket || (stanje.paket !== CLAN && !lista.some(function (u) { return u.id === stanje.paket; }))) { var mog = lista.filter(function (u) { return !u.naUpit && !u.odrzavanje; }), p = mog.filter(function (u) { return u.istaknuto; })[0] || mog[0]; stanje.paket = p ? p.id : null; }
      if (c && (stanje.grupa === 'pranje')) {
        el.usluge.appendChild(izborStavka('radio', 'usluga', CLAN, OF.t('vz.clan_pranje'), OF.t('vz.clan_pranje_opis', { n: OF.clanstvo.preostalo(c) }), OF.t('vz.ukljuceno'), stanje.paket === CLAN, OF.clanstvo.preostalo(c) < 1, function () { stanje.paket = CLAN; stanje.dodaci = []; stanje.velicina = velClana(); OF.$$('input[name=velicina]', koren).forEach(function (r) { r.checked = r.value === stanje.velicina; }); crtajDodatke(); javi(); }));
      }
      lista.forEach(function (u) {
        el.usluge.appendChild(izborStavka('radio', 'usluga', u.id, OF.tx(u.naziv) + (u.podnaslov ? ' · ' + OF.tx(u.podnaslov) : ''), OF.tx(u.kratko) + ' · ' + OF.tx(u.dana),
          u.naUpit ? OF.t('vz.po_pregledu') : OF.din(S.cenaUsluge(u, stanje.velicina)), stanje.paket === u.id, !!u.naUpit, function () { stanje.paket = u.id; crtajDodatke(); javi(); }));
      });
      var nu = lista.filter(function (u) { return u.naUpit; })[0];
      if (nu) el.usluge.appendChild(OF.h('p', { class: 'of-polje__pomoc' }, [OF.t('vz.na_upit_opis') + ' ', OF.h('a', { href: OF.link('kontakt') }, OF.t('vz.trazite_ponudu'))]));
    }
    function crtajDodatke() {
      if (!el.dodaci) return;
      el.dodaci.innerHTML = '';
      var u = stanje.paket === CLAN ? { grupa: 'pranje', id: CLAN } : S.usluga(stanje.paket), lista = S.dodaciZa(u);
      stanje.dodaci = stanje.dodaci.filter(function (id) { return lista.some(function (x) { return x.id === id; }); });
      if (!lista.length) { el.dodaci.appendChild(OF.h('p', { class: 'of-polje__pomoc' }, OF.t('vz.bez_dodataka'))); return; }
      lista.forEach(function (x) {
        var blok = x.iskljucuje && stanje.dodaci.indexOf(x.iskljucuje) >= 0;
        lista.forEach(function (y) { if (y.iskljucuje === x.id && stanje.dodaci.indexOf(y.id) >= 0) blok = true; });
        el.dodaci.appendChild(izborStavka('checkbox', 'dodatak', x.id, OF.tx(x.naziv), x.sati ? OF.t('vz.sati', { n: OF.broj(x.sati, x.sati % 1 ? 1 : 0) }) : '', '+ ' + OF.din(S.cenaDodatka(x, stanje.velicina)), stanje.dodaci.indexOf(x.id) >= 0, blok && stanje.dodaci.indexOf(x.id) < 0, function (da) {
          stanje.dodaci = stanje.dodaci.filter(function (id) { return id !== x.id; }); if (da) stanje.dodaci.push(x.id); crtajDodatke(); javi();
        }));
      });
    }
    function javi() { naPromenu(stanje, stanje.paket ? S.racun(stanje) : null); }
    crtajUsluge(); crtajDodatke(); javi();
    return { stanje: stanje, osvezi: function () { crtajUsluge(); crtajDodatke(); javi(); } };
  };

  /* kalkulator na stranici Cene */
  function kalkulator(k) {
    var stanje = { velicina: OF.upit('velicina') || 'srednje', paket: OF.upit('paket'), dodaci: (OF.upit('dodaci') || '').split(',').filter(Boolean) };
    var forma = OF.$('form', k);
    var velDiv = OF.$('.s-kalk__velicine', k), grupeDiv = OF.$('.s-kalk__grupe', k);
    if (velDiv) velDiv.setAttribute('data-s-kalk-velicine', ''); if (grupeDiv) grupeDiv.setAttribute('data-s-kalk-grupe', '');
    forma.addEventListener('submit', function (e) { e.preventDefault(); });
    var rez = { sazetak: OF.$('[data-s-kalk-sazetak]', k), ukupno: OF.$('[data-s-kalk-ukupno]', k), depozit: OF.$('[data-s-kalk-depozit]', k), vreme: OF.$('[data-s-kalk-vreme]', k), gar: OF.$('[data-s-kalk-garancija]', k), zakazi: OF.$('[data-s-kalk-zakazi]', k) };
    S.izbor(k, stanje, function (st, r) {
      rez.sazetak.innerHTML = '';
      if (!r) { rez.ukupno.textContent = '–'; return; }
      rez.sazetak.appendChild(OF.h('ul', { class: 's-kalk__sazetak', role: 'list' }, [OF.h('li', null, [OF.h('span', null, OF.t('vz.velicina')), OF.h('span', null, OF.tx(S.velicina(st.velicina).naziv))])].concat(r.stavke.map(function (s) { return OF.h('li', null, [OF.h('span', null, s[0]), OF.h('span', null, s[1] ? OF.din(s[1]) : OF.t('vz.ukljuceno'))]); }))
        .concat(r.popust ? [OF.h('li', null, [OF.h('span', null, OF.t('vz.popust_clan', { n: r.popustProcenat })), OF.h('span', null, '− ' + OF.din(r.popust))])] : [])));
      rez.ukupno.textContent = OF.din(r.ukupno); rez.ukupno.classList.remove('s-kalk__broji'); void rez.ukupno.offsetWidth; rez.ukupno.classList.add('s-kalk__broji');
      rez.depozit.textContent = r.depozit ? OF.din(r.depozit) : OF.t('vz.bez_depozita');
      rez.vreme.textContent = r.dana || '–';
      rez.gar.textContent = r.garancija || '–';
      rez.zakazi.href = S.linkZakazivanja(st);
      try { w.history.replaceState(null, '', w.location.pathname + '?paket=' + encodeURIComponent(st.paket) + '&velicina=' + st.velicina + (st.dodaci.length ? '&dodaci=' + st.dodaci.join(',') : '') + '#kalkulator'); } catch (e) {}
    }, { prefiks: 'kk' });
  }

  /* korak „usluga i vozilo“ u zakazivanju */
  var OPCIJE_ZAKAZIVANJA = {
    pocetnoStanje: function (stanje) {      // link sa ?paket= preskače prvi korak: sati rada za kapacitet dana
      if (OF.upit('napomena') && !stanje.napomena) stanje.napomena = String(OF.upit('napomena')).slice(0, 300);   // npr. izabrana boja folije ili zatamnjenje
      var c = S.clanstvo();
      if (!stanje.velicina && c && stanje.paket === CLAN) stanje.velicina = c.velicina ? 'suv' : 'srednje';   // veličina iz članstva
      stanje.velicina = stanje.velicina || 'srednje';
      var r = stanje.paket && (stanje.paket === CLAN || S.usluga(stanje.paket)) ? S.racun(stanje) : null;
      if (r) stanje.sati = r.sati;
    },
    korakPaket: function (koren, stanje, gotovo) {
      stanje.velicina = stanje.velicina || OF.upit('velicina') || 'srednje';
      if (stanje.paket && stanje.paket !== CLAN && !S.usluga(stanje.paket)) stanje.paket = null;
      var V = S.velicine();
      var omot = OF.h('div', { class: 's-vozilo-paket' }, [
        OF.h('div', { class: 's-vozilo-paket__grupa' }, [OF.h('p', { class: 's-vozilo-paket__naslov', id: 'zv-v' }, OF.t('vz.velicina')),
          OF.h('div', { class: 's-vozilo-paket__velicine', role: 'radiogroup', 'aria-labelledby': 'zv-v', 'data-s-kalk-velicine': '' }, V.map(function (v) {
            return OF.h('span', { class: 'of-opcija' }, [OF.h('input', { type: 'radio', name: 'velicina', id: 'zv-' + v.id, value: v.id }), OF.h('label', { for: 'zv-' + v.id }, [OF.h('strong', null, OF.tx(v.naziv)), OF.h('small', null, OF.tx(v.primeri))])]);
          }))]),
        OF.h('div', { class: 's-vozilo-paket__grupa' }, [OF.h('p', { class: 's-vozilo-paket__naslov' }, OF.t('vz.usluga')),
          OF.h('div', { class: 's-kalk__grupe', role: 'group', 'data-s-kalk-grupe': '' }, ['pranje', 'enterijer', 'poliranje', 'keramika', 'folija', 'felne'].map(function (g) { return OF.h('button', { type: 'button', class: 'of-cip', 'data-s-grupa': g, 'aria-pressed': 'false' }, OF.tx(S.grupa(g)) || g); })),
          OF.h('div', { class: 's-kalk__usluge', 'data-s-kalk-usluge': '' })]),
        OF.h('div', { class: 's-vozilo-paket__grupa' }, [OF.h('p', { class: 's-vozilo-paket__naslov' }, OF.t('vz.dodaci')), OF.h('div', { class: 's-kalk__dodaci', 'data-s-kalk-dodaci': '' })]),
        OF.h('div', { class: 's-vozilo-paket__sazetak', 'aria-live': 'polite' })
      ]);
      koren.appendChild(omot);
      var saz = OF.$('.s-vozilo-paket__sazetak', omot);
      S.izbor(omot, stanje, function (st, r) {
        saz.innerHTML = '';
        if (r) {
          stanje.sati = r.sati;
          saz.appendChild(OF.h('span', null, [OF.t('vz.okvirno') + ' ', OF.h('strong', null, r.ukupno ? OF.din(r.ukupno) : OF.t('vz.ukljuceno'))]));
          saz.appendChild(OF.h('span', null, (r.depozit ? OF.t('vz.depozit_karticom', { iznos: OF.din(r.depozit) }) : OF.t('vz.bez_depozita')) + ' · ' + OF.t('vz.kod_nas', { dana: r.dana })));
          if (r.popust) saz.appendChild(OF.h('span', null, OF.t('vz.popust_clan', { n: r.popustProcenat }) + ': − ' + OF.din(r.popust)));
        }
        gotovo(!!(r && !r.naUpit));
      }, { prefiks: 'zk' });
    },
    opisPaketa: function (stanje) {
      var r = S.racun(stanje); if (!r) return [];
      var red = [[OF.t('zak.paket'), r.stavke.map(function (s) { return s[0]; }).join(' + ')], [OF.t('vz.velicina'), OF.tx(S.velicina(stanje.velicina).naziv)], [OF.t('vz.okvirno'), r.ukupno ? OF.din(r.ukupno) : OF.t('vz.ukljuceno')]];
      if (r.depozit) red.push([OF.t('vz.depozit'), OF.din(r.depozit)]);
      return red;
    },
    depozit: function (stanje) { var r = S.racun(stanje); return r ? r.depozit : 0; },
    uTermin: function (t, stanje) {
      var r = S.racun(stanje) || {};
      t.paket = stanje.paket === CLAN ? 'pranje' : stanje.paket; t.velicina = stanje.velicina; t.dodaci = stanje.dodaci || [];
      t.paketNaziv = (r.stavke || []).map(function (s) { return s[0]; }).join(' + '); t.sati = r.sati || 3; t.nocenje = !!r.nocenje; t.cena = r.ukupno; t.popust = r.popust || 0;
      if (stanje.paket === CLAN) { var c = S.clanstvo(stanje); t.clanstvo = c && c.id; if (c && OF.demo) OF.clanstvo.upisiPranje(c); }
      t.registracija = String(t.registracija || '').toUpperCase();
    },
    redoviPotvrde: function (t) { return [[OF.t('zak.paket'), t.paketNaziv], [OF.t('zak.vozilo'), (t.vozilo || '') + ' · ' + (t.registracija || '')], [OF.t('vz.okvirno'), t.cena ? OF.din(t.cena) : OF.t('vz.ukljuceno')]]; },
    posle: function (s, t) {
      s.appendChild(OF.h('div', { class: 's-cl__rez', style: { marginTop: '1.4rem' } }, [
        OF.h('p', null, [OF.h('span', null, OF.t('vz.pracenje_link')), OF.h('a', { href: OF.pracenje ? OF.pracenje.link(t) : OF.link('pracenje') }, OF.t('vz.sacuvaj_link'))]),
        OF.h('p', null, [OF.h('span', null, OF.t('vz.sta_ponesete')), OF.h('strong', null, OF.t('vz.dokumenta'))])
      ]));
    }
  };
  /* isti račun i isti podaci termina koristi i server (pravi režim): api/src/vozila.js */
  OF.vozilo = { racun: S.racun, opcije: OPCIJE_ZAKAZIVANJA, CLAN: CLAN };
  /* popust za članove u prodavnici (plan „Bez brige“); server isto proverava iz baze */
  OF.korpaClanPopust = function () { var c = S.clanstvo(), p = c && OF.clanstvo && OF.clanstvo.plan(c.plan); return (p && p.popustProdavnica) || 0; };

  /* =====================================================================
     POMOĆNIK: cena za veličinu vozila, praćenje vozila, status porudžbine
     ===================================================================== */
  if (OF.pomocnik) {
    var PM = OF.pomocnik;
    var VEL = { malo: ['malo', 'mali', 'malog', 'gradski', 'small', 'city car', 'clio', 'polo', 'yaris'], srednje: ['srednje', 'srednji', 'srednjeg', 'limuzina', 'medium', 'sedan', 'golf', 'octavia', 'megane'], suv: ['suv', 'dzip', 'karavan', 'estate', 'tiguan', 'sportage', 'x3'], kombi: ['kombi', 'kombija', 'van', 'veliki suv', 'sedmosed', 'x5', 'q7', 'vito', 'transporter'] };
    var USL = { 'keramika-3': ['keramika', 'keramiku', 'keramike', 'keramicka', 'ceramic', 'coating'], 'poliranje-2': ['poliranje', 'polir', 'ispolirati', 'polish', 'correction'], pranje: ['pranje', 'oprati', 'wash'], enterijer: ['enterijer', 'unutrasnjost', 'sedista', 'interior', 'seats'], 'folija-zone': ['folija', 'foliju', 'ppf', 'film'] };
    var CENA = ['koliko', 'cena', 'cenu', 'cene', 'kosta', 'kostati', 'price', 'prices', 'cost', 'costs', 'much', 'how much'];
    PM.namere = (PM.namere || []).concat([
      function (r, pitanje, a) {
        if (!a.sadrzi(r, CENA) || a.sadrzi(r, ['traje', 'trajanje', 'dugo', 'long', 'duration'])) return null;
        var vel = null, usl = null;
        Object.keys(VEL).forEach(function (k) { if (a.sadrzi(r, VEL[k])) vel = k; });
        Object.keys(USL).forEach(function (k) { if (a.sadrzi(r, USL[k])) usl = k; });
        if (vel && !usl) {   // samo veličina: najtraženija usluga iz svake grupe
          var izbor = ['pranje', 'enterijer', 'poliranje-2', 'keramika-3', 'folija-zone'].map(S.usluga).filter(Boolean);
          return { s: 3.2, a: { tekst: OF.t('vz.pm_cene', { vel: OF.tx(S.velicina(vel).naziv) }) + '\n' + izbor.map(function (x) { return OF.tx(x.naziv) + ': ' + OF.din(S.cenaUsluge(x, vel)); }).join('\n') + '\n' + OF.t('vz.pm_cene_napomena'),
            akcije: [{ tekst: OF.t('vz.kalkulator'), href: OF.link('cene', 'velicina=' + vel) + '#kalkulator' }] } };
        }
        if (!usl || !vel) return null;
        var u = S.usluga(usl), cene = (OF.d.usluge || []).filter(function (x) { return x.grupa === u.grupa && !x.naUpit && !x.odrzavanje; });
        var tekst = OF.t('vz.pm_cene', { vel: OF.tx(S.velicina(vel).naziv) }) + '\n' + cene.map(function (x) { return OF.tx(x.naziv) + ': ' + OF.din(S.cenaUsluge(x, vel)); }).join('\n') + '\n' + OF.t('vz.pm_cene_napomena');
        return { s: 3.4, a: { tekst: tekst, akcije: [{ tekst: OF.t('vz.kalkulator'), href: OF.link('cene', 'paket=' + u.id + '&velicina=' + vel) + '#kalkulator' }, { tekst: OF.t('vz.zakazi'), href: OF.link('zakazivanje', 'paket=' + u.id + '&velicina=' + vel) }] } };
      },
      function (r, pitanje) {
        var broj = (/\b(S-[A-Z0-9]{5,6})\b/i.exec(pitanje) || [])[1], email = (/[^\s@]+@[^\s@]+\.[^\s@]{2,}/.exec(pitanje) || [])[0];
        if (!broj) return null;
        if (email && OF.prod) return null;   // porudžbina iz prodavnice: odgovara namera prodavnice
        var reg = (/\b([A-ZČĆŽŠĐ]{2}\s?\d{3,5}\s?-?\s?[A-ZČĆŽŠĐ]{2})\b/i.exec(pitanje) || [])[1];
        return { s: 3.6, a: { tekst: reg ? OF.t('vz.pm_pracenje', { broj: broj.toUpperCase(), reg: reg.toUpperCase() }) : OF.t('vz.pm_pracenje_reg'), akcije: [{ tekst: OF.t('pc.prati'), href: OF.link('pracenje') }] } };
      }
    ]);
  }

  /* posle porudžbine naslov kase više nije „Plaćanje i dostava“ */
  OF.on('kasa:potvrda', function () {
    var h1 = d.getElementById('naslov-strane'); if (!h1) return;
    h1.textContent = OF.t('vz.hvala_kupovina');
    var uv = h1.closest('.s-uvod'), lead = uv && OF.$('.s-lead', uv); if (lead) lead.hidden = true;
    var m = uv && OF.$$('.s-mrvice li', uv); if (m && m.length) (OF.$('span', m[m.length - 1]) || m[m.length - 1]).textContent = h1.textContent;
    try { d.title = h1.textContent + ' · ' + OF.d.firma.ime; } catch (e) {}
  });

  /* =====================================================================
     IZBOR BOJE FOLIJE: ista fotografija, karoserija prebojena po slojevima
     iz folija-maska.png (1280×1440): gore R = karoserija, G = senčenje laka,
     B = odsjaj; dole R = senčenje za mat, G i B = razliveni odsjaj.
     Nova boja = senčenje × boja folije + odsjaj (u linearnom svetlu); mat i
     saten gase i razlivaju odsjaje. Isti postupak pravi par pre/posle u
     _izvor/brend/radovi.py (razlozi, nova_boja).
     ===================================================================== */
  var LIN = new Float32Array(256), IZLAZ = null;
  for (var li = 0; li < 256; li++) { var lv = li / 255; LIN[li] = lv <= 0.04045 ? lv / 12.92 : Math.pow((lv + 0.055) / 1.055, 2.4); }
  function tablicaIzlaza() {   // linearno svetlo 0–4 → sRGB 0–255, svetli delovi se meko zasićuju
    if (IZLAZ) return IZLAZ; IZLAZ = new Uint8ClampedArray(16384);
    for (var k = 0; k < 16384; k++) { var x = k / 4096; if (x > 0.8) x = 0.8 + 0.2 * (1 - Math.exp(-(x - 0.8) / 0.2)); IZLAZ[k] = Math.round(255 * (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)); }
    return IZLAZ;
  }
  function ucitajSliku(src) { return new Promise(function (ok, ne) { var im = new Image(); im.decoding = 'async'; im.onload = function () { ok(im); }; im.onerror = ne; im.src = src; }); }
  function izabrano(koren, ime) { var x = OF.$('input[name="' + ime + '"]:checked', koren); return x ? x.value : null; }
  function velicinaNaziv(id) { return OF.tx(S.velicina(id).naziv); }

  S.konfiguratorFolije = function (koren) {
    if (!koren) return;
    var F = OF.d.folijaBoje || {}, slika = OF.$('[data-s-konf-slika]', koren), platno = OF.$('canvas', koren), natpis = OF.$('[data-s-konf-natpis]', koren);
    var cena = OF.$('[data-s-konf-cena]', koren), zakazi = OF.$('[data-s-konf-zakazi]', koren), u = S.usluga(F.usluga);
    var osnova = null, maska = null, priprema = null;
    var T = {}; try { T = JSON.parse(koren.getAttribute('data-tekst') || '{}'); } catch (e) {}
    var tekst = function (k, v) { var t = T[k] || ''; return v ? t.replace(/\{(\w+)\}/g, function (m, x) { return v[x] != null ? v[x] : m; }) : t; };
    function pripremi() {
      if (priprema) return priprema;
      priprema = Promise.all([ucitajSliku(slika.currentSrc || slika.src), ucitajSliku(koren.getAttribute('data-maska'))]).then(function (x) {
        var w = platno.width, h = platno.height, c = d.createElement('canvas'); c.width = w; c.height = h * 2; var cx = c.getContext('2d', { willReadFrequently: true });
        cx.drawImage(x[0], 0, 0, w, h); osnova = cx.getImageData(0, 0, w, h);
        cx.clearRect(0, 0, w, h * 2); cx.drawImage(x[1], 0, 0, w, h * 2); maska = cx.getImageData(0, 0, w, h * 2).data;
      });
      return priprema;
    }
    function crtaj() {
      var bojaIn = OF.$('input[name="kf-boja"]:checked', koren), zav = izabrano(koren, 'kf-zavrsni'), vel = izabrano(koren, 'kf-vel') || 'srednje';
      var fab = !bojaIn || bojaIn.value === 'fabricka';
      var nazivBoje = bojaIn ? OF.$('label[for="' + bojaIn.id + '"] .of-sr', koren).textContent : '';
      var nazivZav = zav ? OF.$('label[for="kfz-' + zav + '"]', koren).textContent : '';
      natpis.textContent = fab ? nazivBoje : nazivBoje + ' · ' + nazivZav;
      if (u) cena.textContent = OF.din(S.cenaUsluge(u, vel));
      if (zakazi) zakazi.href = OF.link('zakazivanje', 'paket=' + encodeURIComponent(F.usluga) + '&velicina=' + vel + (fab ? '' : '&napomena=' + encodeURIComponent(tekst('napomenaBoje', { boja: nazivBoje, zavrsni: nazivZav.toLowerCase() }))));
      slika.alt = tekst('slikaAria', { boja: natpis.textContent });
      if (fab) { platno.hidden = true; return; }
      pripremi().then(function () {
        var hx = bojaIn.getAttribute('data-boja'), boja = [1, 3, 5].map(function (k) { return LIN[parseInt(hx.substr(k, 2), 16)]; });
        var z = zav || 'sjaj', met = z === 'metalik', o = osnova.data, N = o.length, M = maska, iz = tablicaIzlaza();
        var odsjajBoja = boja.map(function (v) { return met ? 0.75 + 0.5 * v : 1; });   // metalik malo boji odsjaje
        var slikaNova = new ImageData(osnova.width, osnova.height), n = slikaNova.data; n.set(o);
        for (var i = 0; i < N; i += 4) {
          var a = M[i]; if (!a) continue;
          var D = LIN[M[i + 1]] * 4, Sp = LIN[M[i + 2]], j = i + N, kb, kd;   // j: isti piksel u donjoj polovini maske
          if (z === 'mat') { kb = LIN[M[j]] * 4; kd = 0.12 * LIN[M[j + 2]] + 0.004; }
          else if (z === 'saten') { kb = 0.5 * D + 2 * LIN[M[j]]; kd = 0.2 * Sp + 0.3 * LIN[M[j + 1]]; }
          else if (met) { kb = D * (1 + ((((i >> 2) * 2654435761) >>> 0) % 1000 / 1000 - 0.5) * 0.2); kd = Sp; }   // sitno zrno, uvek isto
          else { kb = D; kd = Sp; }
          var t = a / 255, ost = 1 - t;
          for (var c = 0; c < 3; c++) { var q = (kb * boja[c] + kd * odsjajBoja[c]) * 4096; n[i + c] = o[i + c] * ost + iz[q > 16383 ? 16383 : q | 0] * t; }
        }
        platno.getContext('2d').putImageData(slikaNova, 0, 0); platno.hidden = false;
      }, function () { platno.hidden = true; });
    }
    OF.$$('input', koren).forEach(function (x) {
      x.addEventListener('change', function () {
        if (x.name === 'kf-boja' && x.getAttribute('data-zavrsni')) { var zz = OF.$('#kfz-' + x.getAttribute('data-zavrsni'), koren); if (zz) zz.checked = true; }   // boja dolazi sa svojim uobičajenim završnim slojem
        crtaj();
      });
    });
    // maska i proračun se pripremaju tek kad posetilac priđe izboru (bez troška pri učitavanju stranice)
    ['pointerenter', 'touchstart', 'focusin'].forEach(function (ev) { koren.addEventListener(ev, function () { pripremi(); }, { once: true, passive: true }); });
    crtaj();
  };

  /* IZBOR ZATAMNJENJA: stakla na fotografiji se zatamne po izabranoj propustljivosti */
  S.konfiguratorStakala = function (koren) {
    if (!koren) return;
    var Z = OF.d.zatamnjenje || {}, slika = OF.$('[data-s-konf-slika]', koren), platno = OF.$('canvas', koren), natpis = OF.$('[data-s-konf-natpis]', koren);
    var cena = OF.$('[data-s-konf-cena]', koren), zakazi = OF.$('[data-s-konf-zakazi]', koren), osnova = null;
    var T = {}; try { T = JSON.parse(koren.getAttribute('data-tekst') || '{}'); } catch (e) {}
    var tekst = function (k, v) { var t = T[k] || ''; return v ? t.replace(/\{(\w+)\}/g, function (m, x) { return v[x] != null ? v[x] : m; }) : t; };
    var nivo = function (vlt) { return (Z.nivoi || []).filter(function (n) { return n.vlt === vlt; })[0]; };
    function staklo(cx, tacke, f) {
      var kx = platno.width / 1200, ky = platno.height / 675;
      cx.save(); cx.beginPath(); tacke.forEach(function (t, i) { cx[i ? 'lineTo' : 'moveTo'](t[0] * kx, t[1] * ky); }); cx.closePath();
      cx.globalCompositeOperation = 'multiply'; var v = Math.round(f * 255); cx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; cx.fill(); cx.restore();
    }
    function crtaj() {
      var zadnja = +izabrano(koren, 'ks-zadnja'), prednja = +izabrano(koren, 'ks-prednja'), tip = izabrano(koren, 'ks-tip'), vel = izabrano(koren, 'ks-vel') || 'srednje';
      var bez = OF.$('label[for="ksz-0"]', koren).textContent; bez = bez.charAt(0).toLowerCase() + bez.slice(1); var zt = zadnja ? zadnja + '%' : bez, pt = prednja ? prednja + '%' : bez;
      natpis.textContent = tekst('natpisStakla', { zadnja: zt, prednja: pt });
      OF.$$('input[name="ks-tip"]', koren).forEach(function (x) { x.disabled = !zadnja; });
      var uZ = S.usluga(tip), uP = S.usluga('zatamnjivanje-prednja');
      var ukupno = (zadnja && uZ ? S.cenaUsluge(uZ, vel) : 0) + (prednja && uP ? S.cenaUsluge(uP, vel) : 0);
      cena.textContent = ukupno ? OF.din(ukupno) : '–';
      var paket = zadnja ? tip : 'zatamnjivanje-prednja';
      zakazi.hidden = !ukupno;
      zakazi.href = OF.link('zakazivanje', 'paket=' + paket + '&velicina=' + vel + (zadnja && prednja ? '&dodaci=zatamnjivanje-prednja' : '') + '&napomena=' + encodeURIComponent(tekst('napomenaStakla', { zadnja: zt, prednja: pt })));
      slika.alt = tekst('staklaAria', { zadnja: zt, prednja: pt });
      var crtajSve = function () {
        var cx = platno.getContext('2d'); cx.globalCompositeOperation = 'source-over'; cx.drawImage(osnova, 0, 0, platno.width, platno.height);
        if (zadnja) (Z.stakla.zadnja || []).forEach(function (t) { staklo(cx, t, nivo(zadnja).f); });
        if (prednja) staklo(cx, Z.stakla.prednje, nivo(prednja).f);
        platno.hidden = false;
      };
      if (osnova) crtajSve(); else ucitajSliku(slika.currentSrc || slika.src).then(function (im) { osnova = im; crtajSve(); }, function () {});
    }
    OF.$$('input', koren).forEach(function (x) { x.addEventListener('change', crtaj); });
    if ('IntersectionObserver' in w) { var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { io.disconnect(); crtaj(); } }, { rootMargin: '200px' }); io.observe(koren); } else crtaj();
  };

  /* =====================================================================
     STRANICA
     ===================================================================== */
  OF.spremno(function () {
    var glava = OF.$('[data-s-glava]');
    /* meni usluga (računar) */
    var mmDugme = OF.$('[data-s-mm]'), mm = d.getElementById('s-mm');
    if (mmDugme && mm) {
      var zatvoriMm = function (fokus) { mmDugme.setAttribute('aria-expanded', 'false'); mm.hidden = true; if (fokus) mmDugme.focus(); };
      var hoverOd = 0;   // meni otvoren prelaskom miša: klik odmah posle toga ga ne zatvara
      mmDugme.addEventListener('click', function () { if (!mm.hidden && Date.now() - hoverOd < 700) return; var o = mmDugme.getAttribute('aria-expanded') !== 'true'; mmDugme.setAttribute('aria-expanded', String(o)); mm.hidden = !o; });
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !mm.hidden) zatvoriMm(true); });
      d.addEventListener('click', function (e) { if (!mm.hidden && !mm.contains(e.target) && !mmDugme.contains(e.target)) zatvoriMm(); });
      var tajmer; [mmDugme.parentNode, mm].forEach(function (el) {
        el.addEventListener('mouseenter', function () { if (!w.matchMedia('(hover: hover)').matches) return; clearTimeout(tajmer); if (mm.hidden) hoverOd = Date.now(); mmDugme.setAttribute('aria-expanded', 'true'); mm.hidden = false; });
        el.addEventListener('mouseleave', function () { if (!w.matchMedia('(hover: hover)').matches) return; tajmer = setTimeout(zatvoriMm, 160); });
      });
    }
    /* meni na telefonu počinje ispod zaglavlja */
    var meniDugme = OF.$('[data-of-meni-dugme]');
    if (meniDugme && glava) meniDugme.addEventListener('click', function () { d.documentElement.style.setProperty('--meni-vrh', Math.max(0, glava.getBoundingClientRect().bottom) + 'px'); }, true);

    /* status u zaglavlju: „Otvoreno do 19 h“ */
    var st = OF.$('[data-of-status-kratko]');
    if (st) { var osveziSt = function () { var s = OF.status(); st.classList.toggle('otvoreno', !!s.otvoreno); st.textContent = s.otvoreno ? OF.t('vz.otvoreno_do', { h: Math.floor(s.do / 60) }) : OF.statusTekst(s).tekst; }; osveziSt(); setInterval(osveziSt, 60000); }

    /* lepljiva traka „Zakažite“ na telefonu: posle prvog ekrana, sakriva se iznad futera i na zakazivanju */
    var traka = OF.$('[data-s-traka-zakazi]');
    if (traka && !OF.$('[data-of-zakazivanje]') && !OF.$('[data-s-kupi-traka]')) {
      var futer = OF.$('footer'), kadar = false;
      var proveri = function () { kadar = false; var dole = futer ? futer.getBoundingClientRect().top < w.innerHeight : false; traka.classList.toggle('vidljiva', w.scrollY > w.innerHeight * 0.7 && !dole); };
      w.addEventListener('scroll', function () { if (!kadar) { kadar = true; w.requestAnimationFrame(proveri); } }, { passive: true }); proveri();
    }

    /* mali kalkulator (početna) */
    OF.$$('[data-s-mk]').forEach(function (mk) {
      var cene = JSON.parse(mk.getAttribute('data-cene')), dep = JSON.parse(mk.getAttribute('data-depoziti')), u = S.usluga(mk.getAttribute('data-usluga'));
      var cena = OF.$('[data-s-mk-cena]', mk), depEl = OF.$('[data-s-mk-dep]', mk), sablon = depEl.textContent;
      var postavi = function (i) {
        var v = S.velicine()[i], c = u ? S.cenaUsluge(u, v.id) : cene[i], dp = S.depozitZa(c) || dep[i];
        OF.$$('button', mk).forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-i') === i)); });
        cena.textContent = OF.t('vz.od') + ' ' + OF.din(c);
        depEl.textContent = sablon.replace(/[\d.,\s]+(din|RSD)/, ' ' + OF.din(dp)).replace(/\s{2,}/g, ' ');
        cena.classList.remove('s-kalk__broji'); void cena.offsetWidth; cena.classList.add('s-kalk__broji');
      };
      OF.$$('button', mk).forEach(function (b) { b.addEventListener('click', function () { postavi(+b.getAttribute('data-i')); }); });
    });

    /* kalkulator (Cene) */
    var kk = OF.$('[data-s-kalk]'); if (kk) kalkulator(kk);

    /* zakazivanje i moj termin */
    var zak = OF.$('[data-of-zakazivanje]');
    if (zak && OF.zak) {
      var c = S.clanstvo();
      if (OF.upit('paket') === CLAN && !c) OF.obavesti(OF.t('vz.clan_prijava'), 'greska');
      OF.zak.pokreni(zak, OPCIJE_ZAKAZIVANJA);
    }
    var mt = OF.$('[data-of-moj-termin]'); if (mt && OF.zak) OF.zak.mojTermin(mt);
    OF.on('zak.kredit', function (k) { OF.obavesti(OF.t('vz.kredit_upisan', { iznos: OF.din(k.iznos), do: D.dug(k.do) })); });

    /* cene u tabelama (vlasnik ih menja u panelu) */
    var tabele = OF.$$('[data-of-cena-v]');
    var osveziCene = function () { tabele.forEach(function (td) { var p = td.getAttribute('data-of-cena-v').split('|'), u = S.usluga(p[0]); if (u) td.textContent = OF.din(S.cenaUsluge(u, p[1])); }); };
    if (tabele.length && Object.keys(OF.cene.izmene()).length) osveziCene();
    OF.on('cene', osveziCene);

    /* merenje laka: tačke na crtežu vozila odozgo */
    OF.$$('[data-s-merenje]').forEach(function (panel) {
      var nap = JSON.parse(panel.getAttribute('data-napomene') || '{}'), nazivi = JSON.parse(panel.getAttribute('data-nazivi') || '{}');
      var cit = OF.$('.s-merenje__citanje', panel), b = OF.$('b', cit), naziv = OF.$('span', cit), opis = OF.$('small', cit);
      var tacke = OF.$$('[data-s-tacka]', panel);
      var izaberi = function (t) {
        var v = +t.getAttribute('data-vrednost'), k = v < 80 ? 'nisko' : v > 160 ? 'visoko' : 'normalno';
        tacke.forEach(function (x) { x.setAttribute('aria-pressed', String(x === t)); });
        b.textContent = v; b.className = 's-mono ' + (k === 'normalno' ? '' : k); naziv.textContent = nazivi[t.getAttribute('data-s-tacka')] + ' · µm'; opis.textContent = nap[k] || '';
      };
      tacke.forEach(function (t) {
        t.addEventListener('click', function () { izaberi(t); });
        t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); izaberi(t); } });
      });
      if (tacke[0]) tacke[0].setAttribute('aria-pressed', 'true');
    });

    /* pre / posle */
    OF.$$('[data-s-pp]').forEach(function (pp) {
      var ulaz = OF.$('.s-pp__ulaz', pp);
      var postavi = function () { pp.style.setProperty('--pp', ulaz.value + '%'); };
      ulaz.addEventListener('input', postavi); postavi();
    });

    /* izbor boje folije i zatamnjenja (stranice usluga) */
    S.konfiguratorFolije(OF.$('[data-s-konf-folija]'));
    S.konfiguratorStakala(OF.$('[data-s-konf-stakla]'));

    /* brojači (početna): broje do vrednosti kad se pojave, bez pomeranja kod smanjenog kretanja */
    var brojaci = OF.$$('[data-s-broji]');
    if (brojaci.length && 'IntersectionObserver' in w && !OF.manjePokreta()) {
      var io = new IntersectionObserver(function (u) {
        u.forEach(function (x) {
          if (!x.isIntersecting) return; io.unobserve(x.target);
          var el = x.target, cilj = +el.getAttribute('data-s-broji'), t0 = null, traj = 700;
          if (!cilj) return;
          var korak = function (t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / traj), e = 1 - Math.pow(1 - p, 3); el.textContent = String(Math.round(cilj * e)); if (p < 1) w.requestAnimationFrame(korak); };
          el.textContent = '0'; w.requestAnimationFrame(korak);
        });
      }, { threshold: 0.6 });
      brojaci.forEach(function (b) { io.observe(b); });
    }

    /* galerija radova: filter po usluzi i uvećanje */
    var gal = OF.$('[data-of-galerija]');
    if (gal) {
      var stavke = OF.$$('li', gal);
      OF.$$('[data-s-gal-filter]').forEach(function (b) {
        b.addEventListener('click', function () {
          var g = b.getAttribute('data-s-gal-filter');
          OF.$$('[data-s-gal-filter]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          stavke.forEach(function (li) { li.hidden = g !== 'sve' && li.getAttribute('data-grupa') !== g; });
        });
      });
      OF.$$('[data-of-galerija-otvori]', gal).forEach(function (dugme) {
        dugme.addEventListener('click', function () {
          var vidljive = stavke.filter(function (li) { return !li.hidden; }).map(function (li) { return OF.$('button', li); }), i = vidljive.indexOf(dugme);
          var slika = OF.h('img', { class: 'of-lightbox__slika', alt: '' }), opis = OF.h('p', { class: 'of-lightbox__opis' }), brojac = OF.h('p', { class: 'of-lightbox__brojac', 'aria-live': 'polite' });
          var prikazi = function (n) { i = (n + vidljive.length) % vidljive.length; var im = OF.$('img', vidljive[i]); slika.src = im.getAttribute('data-velika') || im.currentSrc || im.src; slika.alt = im.alt; opis.textContent = im.alt; brojac.textContent = (i + 1) + ' / ' + vidljive.length; };
          var telo = OF.h('div', { class: 'of-lightbox' }, [slika, opis, brojac,
            OF.h('button', { type: 'button', class: 'of-lightbox__nav of-lightbox__nav--pret', 'aria-label': OF.t('g.prethodna'), onclick: function () { prikazi(i - 1); } }, '‹'),
            OF.h('button', { type: 'button', class: 'of-lightbox__nav of-lightbox__nav--sled', 'aria-label': OF.t('g.sledeca'), onclick: function () { prikazi(i + 1); } }, '›')]);
          var dl = OF.dijalog({ naslov: OF.t('vz.radovi'), id: 'gal', klasa: 'of-dialog--lightbox', sadrzaj: telo });
          dl.el.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') prikazi(i - 1); if (e.key === 'ArrowRight') prikazi(i + 1); });
          prikazi(i);
        });
      });
    }

    /* planovi članstva: veličina vozila i izbor plana */
    OF.$$('[data-s-planovi]').forEach(function (pl) {
      var seg = OF.$$('.s-segment button', pl);
      var postavi = function (i) {
        seg.forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-i') === i)); });
        OF.$$('[data-s-plan-cena]', pl).forEach(function (el) { el.textContent = OF.din(JSON.parse(el.getAttribute('data-cene'))[i]); });
        OF.store.set('clanstvo-velicina', i); OF.emit('clanstvo.spolja', { velicina: i });
      };
      seg.forEach(function (b) { b.addEventListener('click', function () { postavi(+b.getAttribute('data-i')); }); });
      if (seg.length && OF.store.get('clanstvo-velicina', 0)) postavi(OF.store.get('clanstvo-velicina', 0));
    });
    if (OF.$('[data-of-clanstvo]')) OF.$$('[data-s-plan]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault(); OF.emit('clanstvo.spolja', { plan: a.getAttribute('data-s-plan') });
        var cilj = d.getElementById('prijava'); if (cilj) cilj.scrollIntoView({ behavior: OF.manjePokreta() ? 'auto' : 'smooth' });
        var prvo = OF.$('[data-of-clanstvo] input[name=vozilo]'); if (prvo) setTimeout(function () { prvo.focus({ preventScroll: true }); }, 350);
      });
    });

    /* primer garantnog lista (PDF) */
    OF.$$('[data-s-garantni-pdf]').forEach(function (b) { b.addEventListener('click', function () { var g = OF.garancija && OF.garancija.primer(); if (g) OF.garancija.pdf(g); }); });

    /* poklon vaučer */
    var vf = OF.$('[data-s-vaucer]');
    if (vf) {
      var drugi = OF.$('.s-vaucer-forma__drugi', vf), prikazIznosa = OF.$('[data-s-vaucer-iznos]'), prikazZa = OF.$('[data-s-vaucer-za]'), prikazNamene = OF.$('[data-s-vaucer-namena]');
      var iznos = function () { var r = OF.$('input[name=iznos]:checked', vf); return !r ? 0 : r.value === 'drugi' ? Math.round(+vf.elements.drugi.value || 0) : +r.value; };
      var namena = function () { var r = OF.$('input[name=namena]:checked', vf); return r ? OF.$('label[for="' + r.id + '"]', vf).textContent : ''; };
      var osvezi = function () { var n = iznos(); if (prikazIznosa) prikazIznosa.textContent = n ? OF.din(n) : '–'; if (prikazNamene) prikazNamene.textContent = namena(); if (prikazZa) prikazZa.textContent = vf.elements.primalac.value ? OF.t('vz.za', { ime: vf.elements.primalac.value }) : ''; drugi.hidden = !OF.$('#v-drugi', vf).checked; };
      vf.addEventListener('input', osvezi); vf.addEventListener('change', osvezi); osvezi();
      vf.addEventListener('submit', function (e) {
        e.preventDefault();
        var V = OF.d.prodaja.vauceri, n = iznos();
        if (OF.$('#v-drugi', vf).checked && !OF.forma(vf, { drugi: function () { return n >= V.min && n <= V.max ? '' : OF.t('vz.vaucer_iznos', { min: OF.din(V.min), max: OF.din(V.max) }); } })) return;
        var nm = OF.$('input[name=namena]:checked', vf);
        var o = { primalac: vf.elements.primalac.value.trim(), od: vf.elements.od.value.trim(), poruka: vf.elements.poruka.value.trim(), namena: nm ? nm.value : 'opste', namenaTekst: namena() };
        OF.korpa.dodaj({ id: 'vaucer-' + n + '-' + o.namena, tip: 'vaucer', naziv: { sr: 'Poklon vaučer ' + OF.broj(n) + ' din', en: 'Gift card ' + OF.broj(n) + ' RSD' }, detalj: o.primalac ? { sr: 'Za: ' + o.primalac, en: 'For: ' + o.primalac } : null, cena: n, kolicina: 1, opcije: o, slika: 'assets/img/vaucer.svg', link: 'poklon-vaucer', maks: 10 });
      });
    }

    /* traka „u korpu“ na telefonu, kad glavno dugme nije na ekranu */
    var kt = OF.$('[data-s-kupi-traka]'), glavno = OF.$('[data-of-p-dodaj]');
    if (kt && glavno) {
      var cekaKadar = false, proveriTraku = function () { cekaKadar = false; kt.hidden = glavno.getBoundingClientRect().bottom > 0; };
      w.addEventListener('scroll', function () { if (!cekaKadar) { cekaKadar = true; w.requestAnimationFrame(proveriTraku); } }, { passive: true });
      w.addEventListener('resize', proveriTraku); proveriTraku();
      OF.$('[data-s-kupi-dugme]', kt).addEventListener('click', function () {
        var forma = glavno.form || glavno.closest('form');
        if (glavno.disabled || OF.$$('[data-of-osa]', forma).length) { forma.scrollIntoView({ behavior: OF.manjePokreta() ? 'auto' : 'smooth', block: 'center' }); setTimeout(function () { glavno.focus({ preventScroll: true }); }, 400); return; }
        glavno.click();
      });
      var cenaT = OF.$('[data-s-kupi-cena]', kt), cenaP = OF.$('[data-of-p-cena]');
      if (cenaT && cenaP && 'MutationObserver' in w) new MutationObserver(function () { cenaT.textContent = cenaP.textContent; }).observe(cenaP, { childList: true, characterData: true, subtree: true });
    }

  });
})(window, document);
