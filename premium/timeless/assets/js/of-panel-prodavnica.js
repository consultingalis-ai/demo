/* opsforma Premium · panel vlasnika: prodavnica
   Porudžbine po statusima (nova → plaćena → spakovana → poslata → isporučena), adresnica za kurira,
   zalihe po varijantama (sa obaveštenjem „stiglo je“), kuponi, zahtevi za povraćaj i reklamacije.
   Cene proizvoda menja zajednička sekcija „Cenovnik“ (OF.d.panelCene). */
(function (w, d) {
  'use strict';
  var OF = w.OF, PN = OF.panel, PR = OF.prod, Z = OF.zalihe, D = OF.datum;
  if (!PN || !PR) return;
  var PROD = function () { return OF.d.prodaja || {}; };
  var kartica = function (oznaka, vrednost, opis) { return OF.h('div', { class: 'of-panel__kartica' }, [OF.h('p', { class: 'of-panel__kartica-oznaka' }, oznaka), OF.h('p', { class: 'of-panel__kartica-vrednost' }, vrednost), opis ? OF.h('p', { class: 'of-panel__kartica-opis' }, opis) : null]); };

  /* cenovnik u panelu = proizvodi po kategorijama */
  OF.d.panelCene = function () {
    return PR.sve().map(function (p) { return { id: p.id, naziv: OF.tx(p.naziv), grupa: OF.tx((PR.kategorija(p.kategorija) || {}).naziv), cena: p.cena }; });
  };

  /* ---------- primer porudžbina za probu (samo DEMO, jednom po pregledaču) ---------- */
  function primeri() {
    if (!OF.demo || OF.store.get('panel-primeri', false)) return;
    var d0 = OF.sad().iso, lista = (PROD().demoPanel || []);
    lista.forEach(function (x, i) {
      var p = PR.proizvod(x.proizvod); if (!p) return;
      var izbor = PR.podrazumevaniIzbor(p); Object.assign(izbor, x.izbor || {});
      var cena = PR.cena(p, izbor);
      var vreme = D.dodaj(d0, -(x.pre || 0)) + 'T' + (x.vreme || '09:30') + ':00.000Z';
      var por = { id: (PROD().prefiks || 'P') + '-PR' + (i + 1) + String.fromCharCode(65 + i) + 'X' + i, kljuc: OF.token(), primer: true, vreme: vreme, kupac: x.kupac,
        stavke: [{ id: p.id, tip: 'proizvod', naziv: OF.tx(p.naziv), detalj: PR.detalj(p, izbor) ? OF.tx(PR.detalj(p, izbor)) : null, cena: cena, kolicina: 1, opcije: x.izbor || null, varijanta: PR.kombinacija(p, izbor), slika: PR.slika(p), kategorija: p.kategorija }],
        medjuzbir: cena, popust: 0, dostava: x.dostava || 0, nacin: x.nacin, nacinNaziv: OF.tx((PR.nacinDostave(x.nacin) || {}).naziv), adresa: x.adresa || null, primalac: x.primalac || null,
        poklonPoruka: x.poklonPoruka != null ? x.poklonPoruka : null, pakovanje: x.poklonPoruka != null ? ((PROD().poklonPakovanje || {}).cena || 0) : 0,
        ukupno: cena + (x.dostava || 0) + (x.poklonPoruka != null ? ((PROD().poklonPakovanje || {}).cena || 0) : 0), placanje: { nacin: x.placanje, kartica: x.placanje === 'kartica' ? '•••• 4242' : null }, status: x.status, napomena: x.napomena || '' };
      por.istorija = [{ status: 'primljena', vreme: vreme }].concat(x.status === 'placena' ? [{ status: 'placena', vreme: vreme }] : []);
      por.racun = OF.placanje.racun({ stavke: por.stavke.map(function (s) { return { naziv: s.naziv, kolicina: 1, cena: s.cena, pdv: 20 }; }), ukupno: por.ukupno, placanje: por.placanje });
      OF.store.dodaj('porudzbine', por, 300);
    });
    OF.store.set('panel-primeri', true);
  }

  /* ---------- promena statusa: upis, istorija, poruka kupcu ---------- */
  PN.statusPorudzbine = function (id, status, dodatno) {
    var por = null;
    OF.store.set('porudzbine', OF.store.get('porudzbine', []).map(function (p) {
      if (p.id !== id) return p;
      p.status = status; p.istorija = (p.istorija || []).concat([{ status: status, vreme: new Date().toISOString() }]);
      if (dodatno) Object.assign(p, dodatno);
      if (status === 'placena') { (p.kodovi || []).forEach(function (k) { k.aktivan = true; }); OF.store.set('kodovi', OF.store.get('kodovi', []).map(function (k) { if (k.porudzbina === p.id) k.aktivan = true; return k; })); }
      // demo: račun kad je uplata potvrđena (uplatnica) ili pošiljka isporučena (pouzeće)
      if (OF.demo && !p.racun && OF.korpa.napraviRacun && ((status === 'placena' && p.placanje && p.placanje.nacin === 'uplatnica') || (status === 'isporucena' && p.placanje && p.placanje.nacin === 'pouzece'))) OF.korpa.napraviRacun(p, p.placanje);
      if (status === 'otkazana' && !p.vracenoNaStanje) { (p.stavke || []).forEach(function (x) { if (x.tip === 'proizvod' && PR.proizvod(x.id)) Z.postavi(x.id, x.varijanta || '', Z.za(x.id, x.varijanta || '') + x.kolicina); }); p.vracenoNaStanje = true; }
      por = p; return p;
    }));
    if (!por) return null;
    if (!OF.demo) fetch(OF.int.api('/panel/porudzbina'), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, status: status, posiljka: dodatno && dodatno.posiljka || null }) }).catch(function () {});
    else OF.int.dogadjaj(status === 'placena' && por.placanje && por.placanje.nacin === 'uplatnica' ? 'porudzbina.uplata' : 'porudzbina.status', { porudzbina: por, status: status });
    return por;
  };

  /* ---------- adresnica (štampa) ---------- */
  function adresnica(p) {
    var f = OF.d.firma, prim = p.primalac || { ime: p.kupac.ime, telefon: p.kupac.telefon, adresa: p.adresa };
    var pouzece = p.placanje && p.placanje.nacin === 'pouzece';
    var html = '<div class="of-adresnica"><div class="of-adresnica__red"><div><p class="of-adresnica__oznaka">' + OF.esc(OF.t('pp.posiljalac')) + '</p><p>' + OF.esc(f.punoIme || f.ime) + '<br>' + OF.esc(OF.int.adresa()) + '<br>' + OF.esc(f.telefon) + '</p></div>' +
      '<div><p class="of-adresnica__oznaka">' + OF.esc(OF.t('pp.primalac')) + '</p><p class="of-adresnica__primalac">' + OF.esc(prim.ime) + '<br>' + OF.esc(prim.adresa || '') + '<br>' + OF.esc(prim.telefon || '') + '</p></div></div>' +
      '<div class="of-adresnica__red"><p><strong>' + OF.esc(p.id) + '</strong> · ' + OF.esc(D.kratko(OF.datum.lokalno(p.vreme).iso)) + '</p><p class="of-adresnica__otkup">' + (pouzece ? OF.esc(OF.t('pp.otkupnina')) + ': <strong>' + OF.esc(OF.din(p.ukupno)) + '</strong>' : OF.esc(OF.t('pp.placeno'))) + '</p></div>' +
      '<p class="of-adresnica__sadrzaj">' + OF.esc(OF.t('pp.sadrzaj')) + ': ' + OF.esc(p.stavke.map(function (x) { return x.kolicina + '× ' + x.naziv; }).join(', ')) + '</p>' +
      (OF.demo ? '<p class="of-adresnica__demo">' + OF.esc(OF.t('pp.adresnica_demo')) + '</p>' : '') + '</div>';
    var dl = OF.dijalog({ naslov: OF.t('pp.adresnica'), id: 'adr', klasa: 'of-dialog--sirok of-dialog--stampa', sadrzaj: OF.h('div', null, [OF.h('div', { html: html }), OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: function () { d.documentElement.classList.add('stampa-dijaloga'); w.print(); setTimeout(function () { d.documentElement.classList.remove('stampa-dijaloga'); }, 500); } }, OF.t('pp.stampaj'))])]) });
    return dl;
  }

  /* ---------- sekcija: porudžbine ---------- */
  var FILTERI = [['za-obradu', ['primljena', 'placena']], ['ceka-uplatu', ['ceka-uplatu']], ['spakovana', ['spakovana']], ['poslata', ['poslata']], ['sve', null]];
  var filter = 'za-obradu';
  function sekcijaPorudzbine(s) {
    primeri();
    var sve = OF.store.get('porudzbine', []).slice().sort(function (a, b) { return a.vreme > b.vreme ? -1 : 1; });
    var broj = function (st) { return sve.filter(function (p) { return !st || st.indexOf(p.status) >= 0; }).length; };
    s.appendChild(OF.h('div', { class: 'of-panel__kartice' }, [kartica(OF.t('pp.za_obradu'), String(broj(['primljena', 'placena'])), OF.t('pp.za_obradu_opis')), kartica(OF.t('pp.ceka_uplatu'), String(broj(['ceka-uplatu'])), OF.t('pp.ceka_uplatu_opis')), kartica(OF.t('pp.poslato'), String(broj(['poslata'])), OF.t('pp.poslato_opis'))]));
    var tabovi = OF.h('div', { class: 'of-panel__filteri', role: 'group', 'aria-label': OF.t('pp.filter') });
    FILTERI.forEach(function (f) { tabovi.appendChild(OF.h('button', { type: 'button', class: 'of-cip', 'aria-pressed': filter === f[0] ? 'true' : 'false', onclick: function () { filter = f[0]; ponovo(); } }, OF.t('pp.f_' + f[0].replace('-', '_')) + ' (' + broj(f[1]) + ')')); });
    s.appendChild(tabovi);
    var st = (FILTERI.filter(function (f) { return f[0] === filter; })[0] || [])[1];
    var lista = sve.filter(function (p) { return !st || st.indexOf(p.status) >= 0; });
    if (!lista.length) { s.appendChild(OF.h('p', { class: 'of-panel__prazno' }, OF.t('pp.nema'))); }
    var ul = OF.h('ul', { class: 'of-porudzbine', role: 'list' });
    lista.slice(0, 60).forEach(function (p) {
      var det = OF.h('details', { class: 'of-porudzbine__stavka' });
      det.appendChild(OF.h('summary', null, [OF.h('span', { class: 'of-porudzbine__broj' }, p.id), OF.h('span', { class: 'of-porudzbine__kupac' }, p.kupac.ime + (p.primer ? ' · ' + OF.t('n.primer') : '')), OF.h('span', { class: 'of-porudzbine__iznos' }, OF.din(p.ukupno)),
        OF.h('span', { class: 'of-stanje of-stanje--' + p.status }, PR.nazivStatusa(p.status)), OF.h('span', { class: 'of-porudzbine__vreme' }, D.kratko(OF.datum.lokalno(p.vreme).iso) + ' ' + OF.datum.lokalno(p.vreme).hhmm)]));
      var telo = OF.h('div', { class: 'of-porudzbine__telo' });
      telo.appendChild(OF.h('ul', { class: 'of-porudzbine__artikli', role: 'list' }, p.stavke.map(function (x) {
        return OF.h('li', null, [x.slika ? OF.h('img', { src: OF.koren + x.slika, alt: '', width: '48', height: '48', loading: 'lazy' }) : null, OF.h('span', null, [OF.h('strong', null, x.kolicina + ' × ' + x.naziv), x.detalj ? OF.h('span', { class: 'of-porudzbine__detalj' }, typeof x.detalj === 'string' ? x.detalj : OF.tx(x.detalj)) : null, x.opcije && x.opcije.gravura ? OF.h('span', { class: 'of-porudzbine__gravura' }, '✎ „' + x.opcije.gravura + '“') : null]), OF.h('span', null, OF.din(x.cena * x.kolicina))]);
      })));
      var red = function (k, v) { return v ? [OF.h('dt', null, k), OF.h('dd', null, v)] : []; };
      telo.appendChild(OF.h('dl', { class: 'of-pregled' }, [].concat(red(OF.t('f.telefon'), p.kupac.telefon), red(OF.t('f.email'), p.kupac.email), red(OF.t('k.placanje'), OF.korpa.nazivPlacanja((p.placanje || {}).nacin || 'kartica') + (p.placanje && p.placanje.kartica ? ' · ' + p.placanje.kartica : '')),
        red(OF.t('k.dostava'), (OF.tx(p.nacinNaziv) || '') + (p.dostava ? ' · ' + OF.din(p.dostava) : '')), red(OF.t('pp.adresa'), p.adresa), red(OF.t('k.primalac'), p.primalac ? p.primalac.ime + ', ' + p.primalac.adresa + ', ' + p.primalac.telefon : ''),
        red(OF.t('k.pakovanje'), p.poklonPoruka != null ? (p.poklonPoruka ? '„' + p.poklonPoruka + '“' : OF.t('da')) : ''), red(OF.t('f.napomena'), p.napomena), red(OF.t('k.posiljka'), p.posiljka ? p.posiljka.servis + ' · ' + p.posiljka.broj : ''))));
      var dug = OF.h('div', { class: 'of-zak__dugmad' });
      var pokupi = (PR.nacinDostave(p.nacin) || {}).adresa === false;
      var akcija = function (tekst, fn, glavno) { dug.appendChild(OF.h('button', { type: 'button', class: 'of-dugme ' + (glavno ? 'of-dugme--glavno' : 'of-dugme--sporedno'), onclick: fn }, tekst)); };
      if (p.status === 'ceka-uplatu') akcija(OF.t('pp.potvrdi_uplatu'), function () { PN.statusPorudzbine(p.id, 'placena'); OF.obavesti(OF.t('pp.uplata_potvrdjena')); ponovo(); }, true);
      if (p.status === 'primljena' || p.status === 'placena') akcija(pokupi ? OF.t('pp.spremno') : OF.t('pp.spakovano'), function () { PN.statusPorudzbine(p.id, 'spakovana'); OF.obavesti(OF.t('pp.status_promenjen')); ponovo(); }, true);
      if (p.status === 'spakovana' && !pokupi) akcija(OF.t('pp.posalji'), function () { posalji(p); }, true);
      if (p.status === 'poslata' || (p.status === 'spakovana' && pokupi)) akcija(pokupi ? OF.t('pp.preuzeto') : OF.t('pp.isporuceno'), function () { PN.statusPorudzbine(p.id, 'isporucena'); OF.obavesti(OF.t('pp.status_promenjen')); ponovo(); }, true);
      if (!pokupi && p.status !== 'otkazana' && p.status !== 'isporucena') akcija(OF.t('pp.adresnica'), function () { adresnica(p); });
      if (p.racun) akcija(OF.t('n.racun'), function () { OF.dijalog({ naslov: OF.t('r.fiskalni'), id: 'rac', sadrzaj: OF.h('div', { html: OF.placanje.racunHtml(p.racun) }) }); });
      if (['primljena', 'placena', 'ceka-uplatu', 'spakovana'].indexOf(p.status) >= 0) dug.appendChild(OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () {
        var dl = OF.dijalog({ naslov: OF.t('pp.otkazi_naslov', { broj: p.id }), id: 'otk', sadrzaj: OF.h('div', null, [OF.h('p', null, OF.t('pp.otkazi_pitanje')), OF.h('div', { class: 'of-zak__dugmad' }, [
          OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { dl.zatvori(); } }, OF.t('moj.ne_hvala')),
          OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: function () { PN.statusPorudzbine(p.id, 'otkazana'); dl.zatvori(); OF.obavesti(OF.t('pp.otkazana')); ponovo(); } }, OF.t('pp.otkazi'))])]) });
      } }, OF.t('pp.otkazi')));
      telo.appendChild(dug); det.appendChild(telo); ul.appendChild(OF.h('li', null, det));
    });
    s.appendChild(ul);
    if (OF.demo) s.appendChild(OF.h('p', { class: 'of-panel__demo' }, OF.t('pp.demo')));
    function posalji(p) {
      var forma = OF.h('form', { class: 'of-forma', novalidate: true }, [
        OF.h('p', null, OF.t('pp.posalji_opis')),
        OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'pp-broj' }, OF.t('pp.broj_posiljke')), OF.h('input', { id: 'pp-broj', name: 'broj', autocomplete: 'off', value: (PROD().prefiksPosiljke || 'DE') + String(Math.floor(1e8 + Math.random() * 8e8)) + 'RS' })]),
        OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno' }, OF.t('pp.oznaci_poslato'))])]);
      var dl = OF.dijalog({ naslov: OF.t('pp.posalji_naslov', { broj: p.id }), id: 'pos', sadrzaj: forma });
      forma.addEventListener('submit', function (e) {
        e.preventDefault(); if (!OF.forma(forma, { broj: function (v) { return v.trim().length >= 6 ? '' : OF.t('g.obavezno'); } })) return;
        PN.statusPorudzbine(p.id, 'poslata', { posiljka: { servis: PROD().kurir || OF.t('pp.kurir'), broj: forma.elements.broj.value.trim().toUpperCase() } });
        dl.zatvori(); OF.obavesti(OF.t('pp.poslato_ok')); ponovo();
      });
    }
    function ponovo() { s.innerHTML = ''; s.appendChild(OF.h('h1', { class: 'of-panel__naslov' }, OF.t('pp.porudzbine'))); sekcijaPorudzbine(s); }
  }

  /* ---------- sekcija: zalihe ---------- */
  var samoMalo = false, trazi = '';
  function sekcijaZalihe(s) {
    s.appendChild(OF.h('p', null, OF.demo ? OF.t('pp.zalihe_demo') : OF.t('pp.zalihe_pravi')));
    var redovi = [];
    PR.sve().forEach(function (p) {
      var ose = p.ose || [], kljucevi = Object.keys(p.zalihe || {});
      if (!kljucevi.length) kljucevi = [''];
      kljucevi.forEach(function (k) {
        var opis = k ? k.split('|').map(function (v, i) { var o = ose[i], op = o && o.opcije.filter(function (x) { return x.id === v; })[0]; return op ? OF.tx(op.naziv) : v; }).join(' · ') : '–';
        redovi.push({ p: p, k: k, opis: opis });
      });
    });
    var ukupnoNema = redovi.filter(function (r) { return Z.za(r.p, r.k) === 0 && !r.p.poPorudzbini; }).length, malo = redovi.filter(function (r) { var n = Z.za(r.p, r.k); return n > 0 && n <= (PROD().malaZaliha || 1); }).length;
    s.appendChild(OF.h('div', { class: 'of-panel__kartice' }, [kartica(OF.t('pp.artikala'), String(PR.sve().length), OF.t('pp.varijanti', { n: redovi.length })), kartica(OF.t('pp.malo'), String(malo), OF.t('pp.malo_opis')), kartica(OF.t('pp.nema_zaliha'), String(ukupnoNema), OF.t('pp.nema_opis'))]));
    var traka = OF.h('div', { class: 'of-panel__traka' }, [
      OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'pz-trazi' }, OF.t('p.trazi')), OF.h('input', { id: 'pz-trazi', type: 'search', value: trazi, oninput: function (e) { trazi = e.target.value; crtaj(); } })]),
      OF.h('div', { class: 'of-polje of-polje--cek' }, [OF.h('input', { type: 'checkbox', id: 'pz-malo', checked: samoMalo, onchange: function (e) { samoMalo = e.target.checked; crtaj(); } }), OF.h('label', { for: 'pz-malo' }, OF.t('pp.samo_malo'))])]);
    s.appendChild(traka);
    var mesto = OF.h('div'); s.appendChild(mesto);
    function crtaj() {
      var q = OF.bezKvacica(trazi);
      var lista = redovi.filter(function (r) { var n = Z.za(r.p, r.k); return (!samoMalo || n <= (PROD().malaZaliha || 1)) && (!q || OF.bezKvacica(OF.tx(r.p.naziv) + ' ' + r.opis + ' ' + (r.p.sku || '')).indexOf(q) >= 0); });
      mesto.innerHTML = '';
      mesto.appendChild(OF.h('div', { class: 'of-tabela__okvir', tabindex: '0', role: 'region', 'aria-label': OF.t('pp.zalihe') }, OF.h('table', { class: 'of-tabela-podataka of-zalihe' }, [
        OF.h('thead', null, OF.h('tr', null, [OF.t('pp.proizvod'), OF.t('pp.sifra'), OF.t('pp.varijanta'), OF.t('pp.na_stanju'), OF.t('pp.cekaju')].map(function (k) { return OF.h('th', { scope: 'col' }, k); }))),
        OF.h('tbody', null, lista.map(function (r) {
          var n = Z.za(r.p, r.k), cekaju = OF.store.get('zaliha-javi', []).filter(function (x) { return x.proizvod === r.p.id && (x.kombinacija || '') === r.k && !x.obavesten; });
          var ulaz = OF.h('input', { type: 'number', min: '0', step: '1', value: String(n), class: 'of-zalihe__ulaz', 'aria-label': OF.t('pp.na_stanju') + ': ' + OF.tx(r.p.naziv) + ' ' + r.opis, inputmode: 'numeric' });
          var promena = function (novo) {
            novo = Math.max(0, Math.round(novo)); var staro = Z.za(r.p, r.k); if (novo === staro) return;
            Z.postavi(r.p.id, r.k, novo); ulaz.value = String(novo);
            if (staro === 0 && novo > 0 && cekaju.length) {
              OF.int.dogadjaj('zaliha.stigla', { proizvod: r.p.id, naziv: OF.tx(r.p.naziv), mejlovi: cekaju.map(function (x) { return x.email; }), link: OF.int.apsolutno(PR.link(r.p)) });
              OF.store.set('zaliha-javi', OF.store.get('zaliha-javi', []).map(function (x) { if (x.proizvod === r.p.id && (x.kombinacija || '') === r.k) x.obavesten = new Date().toISOString(); return x; }));
              OF.obavesti(OF.t('pp.javljeno', { n: cekaju.length }));
            } else OF.obavesti(OF.t('pp.zaliha_sacuvana'));
            if (!OF.demo) fetch(OF.int.api('/panel/zaliha'), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.p.id, kombinacija: r.k, kolicina: novo }) }).catch(function () {});
            crtaj();
          };
          ulaz.addEventListener('change', function () { promena(+ulaz.value || 0); });
          return OF.h('tr', { class: n === 0 ? 'nema' : n <= (PROD().malaZaliha || 1) ? 'malo' : '' }, [OF.h('td', null, OF.h('a', { href: PR.link(r.p) }, OF.tx(r.p.naziv))), OF.h('td', null, r.p.sku || ''), OF.h('td', null, r.opis),
            OF.h('td', { class: 'broj' }, OF.h('span', { class: 'of-zalihe__red' }, [OF.h('button', { type: 'button', class: 'of-brojac__dugme', 'aria-label': OF.t('manje'), onclick: function () { promena(Z.za(r.p, r.k) - 1); } }, '−'), ulaz, OF.h('button', { type: 'button', class: 'of-brojac__dugme', 'aria-label': OF.t('vise'), onclick: function () { promena(Z.za(r.p, r.k) + 1); } }, '+')])),
            OF.h('td', { class: 'broj' }, cekaju.length ? String(cekaju.length) : '')]);
        }))
      ])));
    }
    crtaj();
    s.appendChild(OF.h('div', { class: 'of-zak__dugmad' }, [OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () {
      PN.csv('zalihe', ['Šifra', 'Proizvod', 'Varijanta', 'Na stanju'], redovi.map(function (r) { return [r.p.sku || r.p.id, OF.tx(r.p.naziv, 'sr'), r.opis, Z.za(r.p, r.k)]; }));
    } }, OF.t('p.izvoz_csv'))]));
  }

  /* ---------- sekcija: kuponi ---------- */
  function sekcijaKuponi(s) {
    s.appendChild(OF.h('p', null, OF.t('pp.kuponi_opis')));
    var lista = PROD().kuponi || [];
    s.appendChild(OF.h('div', { class: 'of-tabela__okvir', tabindex: '0', role: 'region', 'aria-label': OF.t('pp.kuponi') }, OF.h('table', { class: 'of-tabela-podataka' }, [
      OF.h('thead', null, OF.h('tr', null, [OF.t('pp.kod'), OF.t('pp.popust'), OF.t('pp.uslov'), OF.t('pp.vazi_do'), OF.t('pp.iskorisceno'), ''].map(function (k) { return OF.h('th', { scope: 'col' }, k); }))),
      OF.h('tbody', null, lista.map(function (k) {
        var br = OF.store.get('porudzbine', []).filter(function (p) { return p.kupon === k.kod; }).length;
        return OF.h('tr', { class: k.aktivan === false ? 'neaktivan' : '' }, [OF.h('td', null, OF.h('code', null, k.kod)), OF.h('td', null, k.tip === 'procenat' ? k.vrednost + '%' : k.tip === 'dostava' ? OF.t('pp.besplatna_dostava') : OF.din(k.vrednost)),
          OF.h('td', null, k.min ? OF.t('pp.min', { iznos: OF.din(k.min) }) : '–'), OF.h('td', null, k.vaziDo ? D.kratko(k.vaziDo) : '–'), OF.h('td', { class: 'broj' }, String(br)),
          OF.h('td', null, OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', onclick: function () { sacuvajKupon(Object.assign({}, k, { aktivan: k.aktivan === false })); ponovo(); } }, k.aktivan === false ? OF.t('pp.ukljuci') : OF.t('pp.iskljuci')))]);
      }))
    ])));
    s.appendChild(OF.h('h2', { class: 'of-panel__podnaslov' }, OF.t('pp.novi_kupon')));
    var forma = OF.h('form', { class: 'of-forma of-panel__forma', novalidate: true }, [
      OF.h('div', { class: 'of-pl__red' }, [OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'pk-kod' }, OF.t('pp.kod')), OF.h('input', { id: 'pk-kod', name: 'kod', autocapitalize: 'characters', autocomplete: 'off' })]),
        OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'pk-tip' }, OF.t('pp.vrsta')), OF.h('select', { id: 'pk-tip', name: 'tip' }, [['procenat', OF.t('pp.procenat')], ['iznos', OF.t('pp.iznos')], ['dostava', OF.t('pp.besplatna_dostava')]].map(function (o) { return OF.h('option', { value: o[0] }, o[1]); }))])]),
      OF.h('div', { class: 'of-pl__red' }, [OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'pk-v' }, OF.t('pp.vrednost')), OF.h('input', { id: 'pk-v', name: 'vrednost', type: 'number', min: '0', inputmode: 'numeric' })]),
        OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'pk-min' }, OF.t('pp.min_iznos')), OF.h('input', { id: 'pk-min', name: 'min', type: 'number', min: '0', inputmode: 'numeric' })]),
        OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'pk-do' }, OF.t('pp.vazi_do')), OF.h('input', { id: 'pk-do', name: 'vaziDo', type: 'date' })])]),
      OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno' }, OF.t('pp.dodaj_kupon'))]);
    forma.addEventListener('submit', function (e) {
      e.preventDefault();
      var tip = forma.elements.tip.value;
      if (!OF.forma(forma, { kod: function (v) { return /^[A-Z0-9-]{3,20}$/i.test(v.trim()) ? (lista.some(function (k) { return k.kod === v.trim().toUpperCase(); }) ? OF.t('pp.kod_postoji') : '') : OF.t('pp.g_kod'); }, vrednost: function (v) { return tip === 'dostava' || (+v > 0 && (tip !== 'procenat' || +v <= 90)) ? '' : OF.t('pp.g_vrednost'); } })) return;
      sacuvajKupon({ kod: forma.elements.kod.value.trim().toUpperCase(), tip: tip, vrednost: +forma.elements.vrednost.value || 0, min: +forma.elements.min.value || 0, vaziDo: forma.elements.vaziDo.value || null, za: ['proizvod'], opis: { sr: OF.t('pp.kupon_opis_sr'), en: 'Discount code' }, aktivan: true, novi: true });
      OF.obavesti(OF.t('pp.kupon_dodat')); ponovo();
    });
    s.appendChild(forma);
    function ponovo() { s.innerHTML = ''; s.appendChild(OF.h('h1', { class: 'of-panel__naslov' }, OF.t('pp.kuponi'))); sekcijaKuponi(s); }
  }
  function sacuvajKupon(k) {
    var iz = OF.store.get('kuponi-izmene', {}); iz[k.kod] = k; OF.store.set('kuponi-izmene', iz); PR.spojiKupone();
    if (!OF.demo) fetch(OF.int.api('/panel/kupon'), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(k) }).catch(function () {});
  }

  /* ---------- sekcija: povraćaj, reklamacije, „javi mi“ ---------- */
  function sekcijaZahtevi(s) {
    var odustanci = OF.store.get('odustanci', []), reklamacije = OF.store.get('reklamacije', []), javi = OF.store.get('zaliha-javi', []);
    s.appendChild(OF.h('div', { class: 'of-panel__kartice' }, [kartica(OF.t('pp.odustanci'), String(odustanci.length), OF.t('pp.rok_odustanak')), kartica(OF.t('pp.reklamacije'), String(reklamacije.length), OF.t('pp.rok_reklamacija', { dana: PROD().reklamacijaDana || 8 })), kartica(OF.t('pp.cekaju_zalihu'), String(javi.filter(function (x) { return !x.obavesten; }).length), OF.t('pp.cekaju_opis'))]));
    var tabela = function (naslov, lista, kolone, red) {
      s.appendChild(OF.h('h2', { class: 'of-panel__podnaslov' }, naslov));
      if (!lista.length) { s.appendChild(OF.h('p', { class: 'of-panel__prazno' }, OF.t('pp.nema_zahteva'))); return; }
      s.appendChild(OF.h('div', { class: 'of-tabela__okvir', tabindex: '0', role: 'region', 'aria-label': naslov }, OF.h('table', { class: 'of-tabela-podataka' }, [OF.h('thead', null, OF.h('tr', null, kolone.map(function (k) { return OF.h('th', { scope: 'col' }, k); }))), OF.h('tbody', null, lista.map(function (x) { return OF.h('tr', null, red(x).map(function (v) { return OF.h('td', null, v); })); }))])));
    };
    tabela(OF.t('pp.odustanci'), odustanci, [OF.t('pr.broj_zahteva'), OF.t('k.broj_porudzbine'), OF.t('f.ime'), OF.t('pr.stavke'), OF.t('p.vreme')], function (x) { return [x.id, x.broj, x.ime + ' · ' + x.email, (x.stavke || []).join(', '), D.kratko(x.vreme.slice(0, 10))]; });
    tabela(OF.t('pp.reklamacije'), reklamacije, [OF.t('pr.broj_zahteva'), OF.t('k.broj_porudzbine'), OF.t('f.ime'), OF.t('pr.zahtev'), OF.t('pr.opis'), OF.t('p.vreme')], function (x) { return [x.id, x.broj, x.ime + ' · ' + x.email, x.zahtev || '', x.opis || '', D.kratko(x.vreme.slice(0, 10))]; });
    tabela(OF.t('pp.cekaju_zalihu'), javi, [OF.t('pp.proizvod'), OF.t('pp.varijanta'), OF.t('f.email'), OF.t('p.status')], function (x) { var p = PR.proizvod(x.proizvod); return [p ? OF.tx(p.naziv) : x.proizvod, (x.kombinacija || '–').replace(/\|/g, ' · '), x.email, x.obavesten ? OF.t('pp.obavesten', { datum: D.kratko(x.obavesten.slice(0, 10)) }) : OF.t('pp.ceka')]; });
  }

  PN.sekcije.push({ id: 'porudzbine', naziv: OF.t('pp.porudzbine'), crtaj: sekcijaPorudzbine });
  PN.sekcije.push({ id: 'zalihe', naziv: OF.t('pp.zalihe'), crtaj: sekcijaZalihe });
  PN.sekcije.push({ id: 'kuponi', naziv: OF.t('pp.kuponi'), crtaj: sekcijaKuponi });
  PN.sekcije.push({ id: 'zahtevi', naziv: OF.t('pp.zahtevi'), crtaj: sekcijaZahtevi });
})(window, document);
