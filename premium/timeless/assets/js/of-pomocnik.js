/* opsforma Premium · pomoćnik za pitanja (chat prozor)
   Odgovara samo iz podataka firme: radno vreme, cene, adresa, parking, usluge, česta pitanja.
   Ne izmišlja: kad ne zna, nudi da se razgovor nastavi na Viberu, WhatsApp-u ili telefonom.
   Znanje (česta pitanja i teme) se učitava tek kad se prozor otvori: assets/js/pomocnik-<jezik>.js */
(function (w, d) {
  'use strict';
  var OF = w.OF, PM = OF.pomocnik = {}, D = OF.datum;

  /* ---------- obrada teksta ---------- */
  var STOP = 'i u na je da se za sa od do li ili a ali koji koja koje kako sta šta da li me mi mogu moze može vas vam vi ja ti to ovo ono imate imam treba the a an to of in on for is are do does can i you your we what how when where with it de der die das und ist ich sie wie was wann wo mit ein eine zu bei'.split(' ');
  PM.norm = function (s) { return OF.bezKvacica(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); };
  PM.reci = function (s) { return PM.norm(s).split(' ').filter(function (r) { return r.length > 1 && STOP.indexOf(r) < 0; }); };
  var koren = function (r) { return r.length > 5 ? r.slice(0, 5) : r; };          // grubo „korenovanje“ za padeže
  function sadrzi(reci, lista) { return lista.some(function (k) { k = PM.norm(k); if (k.indexOf(' ') > 0) return (' ' + reci.join(' ') + ' ').indexOf(' ' + k + ' ') >= 0 || (' ' + reci.join(' ')).indexOf(' ' + k) >= 0; return reci.some(function (r) { return r === k || (k.length > 3 && koren(r) === koren(k)) || (k.length > 4 && r.indexOf(k) === 0); }); }); }
  function poklapanje(reci, tekst) {
    var t = PM.reci(tekst).map(koren); if (!t.length) return 0;
    var n = 0; reci.forEach(function (r) { if (t.indexOf(koren(r)) >= 0) n++; });
    return n / Math.sqrt(t.length + 2);
  }

  /* ---------- namere (iz podataka firme) ---------- */
  var K = {
    vreme: ['radno', 'vreme', 'radite', 'otvoreno', 'zatvoreno', 'subota', 'subotom', 'nedelja', 'nedeljom', 'praznik', 'sati', 'hours', 'open', 'opening', 'closed', 'saturday', 'sunday', 'offnungszeiten', 'geoffnet', 'samstag', 'sonntag', 'uhr'],
    adresa: ['adresa', 'gde', 'nalazite', 'lokacija', 'mapa', 'stici', 'doci', 'address', 'where', 'located', 'location', 'map', 'directions', 'adresse', 'wo', 'anfahrt', 'karte'],
    parking: ['parking', 'parkirati', 'parkiram', 'garaza', 'park', 'parken', 'parkplatz', 'auto'],
    prevoz: ['autobus', 'trolejbus', 'tramvaj', 'prevoz', 'stanica', 'bus', 'transport', 'tram', 'aerodrom', 'airport', 'flughafen'],
    telefon: ['telefon', 'broj', 'pozvati', 'pozovem', 'kontakt', 'phone', 'call', 'number', 'contact', 'anrufen', 'telefonnummer', 'kontakt', 'mejl', 'email', 'mail'],
    cena: ['cena', 'cene', 'kosta', 'kostaju', 'kosta', 'cenovnik', 'koliko', 'dinara', 'din', 'price', 'prices', 'cost', 'costs', 'much', 'preis', 'preise', 'kostet', 'kosten', 'eur', 'evra'],
    zakazi: ['zakazati', 'zakazem', 'zakazivanje', 'termin', 'rezervacija', 'rezervisati', 'rezervisem', 'book', 'booking', 'appointment', 'reserve', 'reservation', 'buchen', 'termin', 'reservieren'],
    otkazi: ['otkazati', 'otkazem', 'pomeriti', 'pomerim', 'otkazivanje', 'cancel', 'reschedule', 'change', 'stornieren', 'absagen', 'verschieben'],
    placanje: ['placanje', 'platiti', 'platim', 'kartica', 'kartice', 'karticom', 'gotovina', 'gotovinom', 'rate', 'pay', 'payment', 'card', 'cash', 'bezahlen', 'zahlung', 'karte', 'bar'],
    jezik: ['engleski', 'nemacki', 'jezik', 'jezici', 'english', 'german', 'language', 'speak', 'englisch', 'deutsch', 'sprache', 'sprechen'],
    zdravo: ['zdravo', 'cao', 'pozdrav', 'dobar', 'hello', 'hi', 'hallo', 'guten', 'servus']
  };
  function radnoVremeTekst() {
    var rv = OF.d.radnoVreme || {}, red = ['pon', 'uto', 'sre', 'cet', 'pet', 'sub', 'ned'], grupe = [];
    red.forEach(function (dan, i) {
      var v = (rv[dan] || []).map(function (p) { return D.vreme(p[0]) + '–' + D.vreme(p[1]); }).join(', ') || OF.t('pm.zatvoreno');
      var poslednja = grupe[grupe.length - 1];
      if (poslednja && poslednja.v === v) poslednja.do = i; else grupe.push({ od: i, do: i, v: v });
    });
    var ime = function (i) { return D.format(D.dodaj('2026-01-05', i), { weekday: 'short' }); };
    return grupe.map(function (g) { return (g.od === g.do ? ime(g.od) : ime(g.od) + '–' + ime(g.do)) + ': ' + g.v; }).join('\n');
  }
  function stavkeCena() {
    var lista = (OF.d.usluge || []).map(function (u) { return { naziv: OF.tx(u.naziv), cena: OF.cene.za(u.id, u.cena), id: u.id, zakazi: u.online !== false }; });
    (OF.d.cenovnikDodatno || []).forEach(function (x) { lista.push({ naziv: OF.tx(x.naziv), cena: OF.cene.za(x.id, x.cena), id: x.id }); });
    if (OF.d.pomocnikStavke) lista = lista.concat(OF.d.pomocnikStavke());
    return lista;
  }
  PM.odgovori = function (pitanje) {
    var r = PM.reci(pitanje), Z = w.OF_POMOCNIK || { faq: [], teme: [] }, f = OF.d.firma;
    if (!r.length && !/\d/.test(pitanje)) return { tekst: OF.t('pm.nisam_razumeo'), akcije: kontaktAkcije(pitanje) };
    var odgovori = [];
    // namere koje dodaje sajt (npr. prodavnica: preporuka po budžetu, status porudžbine, veličine)
    var sajtovi = [];
    (PM.namere || []).forEach(function (fn) { try { var x = fn(r, pitanje, { sadrzi: sadrzi, poklapanje: poklapanje }); if (x) sajtovi = sajtovi.concat(Array.isArray(x) ? x : [x]); } catch (e) { console.error(e); } });
    var prvi = sajtovi.filter(function (x) { return x.s >= 3; }).sort(function (a, b) { return b.s - a.s; })[0];
    if (prvi) return prvi.a;
    odgovori = odgovori.concat(sajtovi);
    // cene konkretne stavke
    if (sadrzi(r, K.cena) && (OF.d.usluge || OF.d.cenovnikDodatno || OF.d.pomocnikStavke)) {
      var st = stavkeCena().map(function (x) { return { x: x, s: poklapanje(r, x.naziv) }; }).filter(function (y) { return y.s > 0.3; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 4);
      if (st.length) return { tekst: st.map(function (y) { return y.x.naziv + ': ' + OF.cenaTekst(y.x.cena); }).join('\n') + (OF.d.pomocnikNapomenaCene ? '\n\n' + OF.tx(OF.d.pomocnikNapomenaCene) : ''),
        akcije: [st[0].x.zakazi ? { tekst: OF.t('pm.zakazi'), href: OF.link('zakazivanje', 'usluga=' + st[0].x.id) } : null, { tekst: OF.t('pm.cenovnik'), href: OF.link('cenovnik') }].filter(Boolean) };
    }
    // FAQ i teme sajta
    var kandidati = (Z.teme || []).map(function (t) { return { o: t, s: sadrzi(r, t.kljucne || []) ? 1.2 + poklapanje(r, (t.kljucne || []).join(' ')) : 0 }; })
      .concat((Z.faq || []).map(function (q) { return { o: { odgovor: q.o, pitanje: q.p, akcije: q.akcije }, s: poklapanje(r, q.p) * 1.2 + poklapanje(r, q.o) * 0.35 }; }));
    kandidati.sort(function (a, b) { return b.s - a.s; });
    var najbolji = kandidati[0];
    // ugrađene namere
    if (sadrzi(r, K.vreme)) { var s = OF.statusTekst(); odgovori.push({ s: 1.5, a: { tekst: s.tekst + '\n\n' + radnoVremeTekst() + (OF.d.pomocnikNapomenaVreme ? '\n' + OF.tx(OF.d.pomocnikNapomenaVreme) : ''), akcije: OF.postoji('zakazivanje') ? [{ tekst: OF.t('pm.zakazi'), href: OF.link('zakazivanje') }] : [{ tekst: OF.t('pm.kontakt'), href: OF.link('kontakt') }] } }); }
    if (sadrzi(r, K.parking) && OF.d.parking) odgovori.push({ s: 1.6, a: { tekst: OF.tx(OF.d.parking), akcije: [{ tekst: OF.t('pm.ruta'), href: OF.d.firma.mapaRuta, spolja: true }] } });
    if (sadrzi(r, K.prevoz) && OF.d.prevoz) odgovori.push({ s: 1.45, a: { tekst: OF.tx(OF.d.prevoz), akcije: [{ tekst: OF.t('pm.ruta'), href: OF.d.firma.mapaRuta, spolja: true }] } });
    if (sadrzi(r, K.adresa)) odgovori.push({ s: 1.4, a: { tekst: OF.int.adresa() + (OF.d.ulaz ? '\n' + OF.tx(OF.d.ulaz) : ''), akcije: [{ tekst: OF.t('pm.ruta'), href: OF.d.firma.mapaRuta, spolja: true }, { tekst: OF.t('pm.kontakt'), href: OF.link('kontakt') }] } });
    if (sadrzi(r, K.telefon)) odgovori.push({ s: 1.3, a: { tekst: OF.t('pm.kontakt_tekst', { tel: f.telefon, email: f.email }), akcije: kontaktAkcije(pitanje) } });
    if (sadrzi(r, K.otkazi) && OF.d.zakazivanje) odgovori.push({ s: 1.35, a: { tekst: OF.tx((OF.d.zakazivanje || {}).pravilaOtkazivanja) || OF.t('pm.otkazivanje'), akcije: [{ tekst: OF.t('pm.nalog'), href: OF.link('nalog') }] } });
    if (sadrzi(r, K.zakazi) && OF.postoji('zakazivanje')) odgovori.push({ s: 1.25, a: { tekst: OF.tx(OF.d.pomocnikZakazivanje) || OF.t('pm.zakazivanje'), akcije: [{ tekst: OF.t('pm.zakazi'), href: OF.link('zakazivanje') }] } });
    if (sadrzi(r, K.placanje) && OF.d.placanjeOpis) odgovori.push({ s: 1.3, a: { tekst: OF.tx(OF.d.placanjeOpis), akcije: [] } });
    if (sadrzi(r, K.jezik) && OF.d.jeziciOpis) odgovori.push({ s: 1.3, a: { tekst: OF.tx(OF.d.jeziciOpis), akcije: [] } });
    if (sadrzi(r, K.cena) && OF.postoji('cenovnik')) odgovori.push({ s: 1.1, a: { tekst: OF.t('pm.cene_opste'), akcije: [{ tekst: OF.t('pm.cenovnik'), href: OF.link('cenovnik') }] } });
    if (sadrzi(r, K.zdravo) && r.length <= 3) odgovori.push({ s: 2, a: { tekst: OF.t('pm.zdravo', { firma: f.ime }), akcije: [] } });
    if (najbolji && najbolji.s >= 0.55) odgovori.push({ s: najbolji.s, a: { tekst: najbolji.o.odgovor, akcije: (najbolji.o.akcije || []).map(function (a) { return { tekst: OF.tx(a.tekst), href: a.stranica ? OF.link(a.stranica, a.upit) : a.href, spolja: !!a.href }; }), izvor: najbolji.o.pitanje } });
    odgovori.sort(function (a, b) { return b.s - a.s; });
    if (!odgovori.length) return { tekst: OF.t('pm.ne_znam'), akcije: kontaktAkcije(pitanje), nepoznato: true };
    return odgovori[0].a;
  };
  function kontaktAkcije(pitanje) {
    return [{ tekst: 'Viber', href: OF.viber(), spolja: true }, OF.d.firma.whatsapp ? { tekst: 'WhatsApp', href: OF.whatsapp(pitanje ? OF.t('pm.wa_uvod') + ' ' + pitanje : ''), spolja: true } : null, { tekst: OF.t('pozovite'), href: OF.tel(), spolja: true }].filter(Boolean);
  }

  /* ---------- prozor ---------- */
  var prozor = null, poruke = null, dugme = null, ucitavanje = null;
  function ucitajZnanje() { return ucitavanje || (ucitavanje = OF.ucitaj('assets/js/pomocnik-' + OF.jezik + '.js').catch(function () {})); }
  PM.otvori = function () {
    if (prozor) { prozor.hidden = false; dugme.setAttribute('aria-expanded', 'true'); OF.$('input', prozor).focus(); return; }
    ucitajZnanje();
    poruke = OF.h('ol', { class: 'of-pm__poruke', 'aria-live': 'polite', 'aria-relevant': 'additions' });
    var forma = OF.h('form', { class: 'of-pm__forma' }, [
      OF.h('label', { for: 'pm-unos', class: 'of-sr' }, OF.t('pm.vase_pitanje')),
      OF.h('input', { id: 'pm-unos', name: 'q', autocomplete: 'off', placeholder: OF.t('pm.placeholder'), maxlength: '300' }),
      OF.h('button', { type: 'submit', class: 'of-pm__posalji', 'aria-label': OF.t('pm.posalji') }, OF.h('span', { 'aria-hidden': 'true', html: '&#8594;' }))
    ]);
    forma.addEventListener('submit', function (e) { e.preventDefault(); var q = forma.elements.q.value.trim(); if (!q) return; forma.elements.q.value = ''; pitaj(q); });
    var cipovi = OF.h('div', { class: 'of-pm__cipovi', role: 'group', 'aria-label': OF.t('pm.cesto') }, (OF.d.pomocnikCipovi || [OF.t('pm.c_vreme'), OF.t('pm.c_cene'), OF.t('pm.c_parking'), OF.t('pm.c_zakazi')]).map(function (c) {
      var t = OF.tx(c); return OF.h('button', { type: 'button', class: 'of-pm__cip', onclick: function () { pitaj(t); } }, t);
    }));
    prozor = OF.h('section', { class: 'of-pm', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'pm-naslov', id: 'of-pomocnik' }, [
      OF.h('header', { class: 'of-pm__glava' }, [
        OF.h('div', null, [OF.h('h2', { id: 'pm-naslov', class: 'of-pm__naslov' }, OF.t('pm.naslov')), OF.h('p', { class: 'of-pm__pod' }, OF.t('pm.podnaslov'))]),
        OF.h('button', { type: 'button', class: 'of-pm__x', 'aria-label': OF.t('zatvori'), onclick: PM.zatvori }, OF.h('span', { 'aria-hidden': 'true', html: '&times;' }))
      ]),
      poruke, cipovi, forma,
      OF.h('p', { class: 'of-pm__napomena' }, OF.tx(OF.d.pomocnikNapomena) || OF.t('pm.napomena'))
    ]);
    prozor.addEventListener('keydown', function (e) { if (e.key === 'Escape') PM.zatvori(); });
    d.body.appendChild(prozor);
    dodaj('bot', { tekst: OF.t('pm.uvod', { firma: OF.d.firma.ime }) });
    dugme.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(function () { prozor.classList.add('otvoren'); OF.$('input', prozor).focus(); });
  };
  PM.zatvori = function () { if (!prozor) return; prozor.hidden = true; dugme.setAttribute('aria-expanded', 'false'); dugme.focus(); };
  PM.pitaj = function (q) { if (!prozor || prozor.hidden) PM.otvori(); pitaj(q); };
  PM.dodaj = function (ko, o) { return dodaj(ko, o); };
  function pitaj(q) {
    dodaj('ja', { tekst: q });
    var kuca = dodaj('bot', { tekst: '…', kuca: true });
    ucitajZnanje().then(function () {
      setTimeout(function () {
        var o = PM.odgovori(q);
        // pravila nemaju odgovor: u pravom režimu, ako je uključen, pita se AI na serveru (podaci prodavnice, ključ samo na serveru)
        if (o.nepoznato && PM.ai()) return pitajAI(q, o, kuca);
        kuca.remove(); dodaj('bot', o); OF.store.dodaj('pomocnik-pitanja', { q: q, vreme: new Date().toISOString(), nepoznato: !!o.nepoznato }, 80);
      }, OF.manjePokreta() ? 0 : 450);
    });
  }
  PM.ai = function () { var a = (OF.c.integracije || {}).asistent || {}; return !OF.demo && a.ai === true && a.ukljuceno !== false && typeof fetch === 'function'; };
  function pitajAI(q, rezerva, kuca) {
    var gotovo = false, kontrola = typeof AbortController === 'function' ? new AbortController() : null;
    var t = setTimeout(function () { if (kontrola) kontrola.abort(); }, 20000);
    var istorija = razgovor.slice(-7, -1);
    fetch(OF.int.api('/asistent'), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, signal: kontrola ? kontrola.signal : undefined,
      body: JSON.stringify({ pitanje: q, jezik: OF.jezik, istorija: istorija }) })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (!r || !r.ok || !r.odgovor) throw new Error('nema odgovora');
        gotovo = true; kuca.remove();
        dodaj('bot', { tekst: r.odgovor, ai: true, kartice: PM.karticeZa && r.proizvodi && r.proizvodi.length ? PM.karticeZa(r.proizvodi) : null, akcije: kontaktAkcije(q) });
      })
      .catch(function () { if (!gotovo) { kuca.remove(); dodaj('bot', rezerva); } })
      .then(function () { clearTimeout(t); OF.store.dodaj('pomocnik-pitanja', { q: q, vreme: new Date().toISOString(), nepoznato: !gotovo, ai: gotovo }, 80); });
  }
  var razgovor = [];
  function dodaj(ko, o) {
    if (!o.kuca && o.tekst) { razgovor.push({ ko: ko, tekst: String(o.tekst).slice(0, 600) }); if (razgovor.length > 12) razgovor.shift(); }
    var li = OF.h('li', { class: 'of-pm__poruka of-pm__poruka--' + ko + (o.kuca ? ' kuca' : '') }, [
      OF.h('span', { class: 'of-sr' }, ko === 'ja' ? OF.t('pm.vi') + ': ' : OF.d.firma.ime + ': '),
      OF.h('p', { style: { whiteSpace: 'pre-line' } }, o.tekst),
      o.ai ? OF.h('p', { class: 'of-pm__ai' }, OF.t('pm.ai_napomena')) : null,
      o.kartice && o.kartice.length ? OF.h('ul', { class: 'of-pm__kartice', role: 'list' }, o.kartice.map(function (k) {
        return OF.h('li', null, OF.h('a', { href: k.href, class: 'of-pm__kartica' }, [k.slika ? OF.h('img', { src: k.slika, alt: '', width: '56', height: '56', loading: 'lazy' }) : null, OF.h('span', null, [OF.h('span', { class: 'of-pm__kartica-naziv' }, k.naziv), k.opis ? OF.h('span', { class: 'of-pm__kartica-opis' }, k.opis) : null])]));
      })) : null,
      o.forma ? o.forma : null,
      o.akcije && o.akcije.length ? OF.h('div', { class: 'of-pm__akcije' }, o.akcije.map(function (a) { return OF.h('a', { href: a.href, class: 'of-dugme of-dugme--mini', target: a.spolja && /^https?:/.test(a.href || '') ? '_blank' : null, rel: a.spolja ? 'noopener' : null }, a.tekst); })) : null
    ]);
    poruke.appendChild(li); poruke.scrollTop = poruke.scrollHeight;
    if (o.posle) setTimeout(function () { o.posle(li); }, 0);      // odgovor koji se sam dopuni (npr. status porudžbine)
    return li;
  }

  OF.spremno(function () {
    if (OF.d.pomocnik === false || OF.$('[data-of-panel]')) return;
    dugme = OF.h('button', { type: 'button', class: 'of-pm-dugme', 'aria-controls': 'of-pomocnik', 'aria-expanded': 'false', onclick: function () { prozor && !prozor.hidden ? PM.zatvori() : PM.otvori(); } }, [
      OF.h('span', { class: 'of-pm-dugme__ikona', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>' }),
      OF.h('span', { class: 'of-pm-dugme__tekst' }, OF.t('pm.dugme'))
    ]);
    d.body.appendChild(dugme);
    OF.$$('[data-of-pomocnik]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); PM.otvori(); }); });
  });
})(window, document);
