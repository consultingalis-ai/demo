/* opsforma Premium · plaćanje karticom
   DEMO: generički ekran, jasno označen kao demo, ne liči ni na jednu banku ni procesora.
         Prihvata samo test brojeve koje sam ponudi. Ništa se ne čuva i ne šalje.
   PRAVI: podaci kartice NIKAD ne prolaze kroz naš kod. Sajt traži od servera (/api/placanje/start)
         adresu stranice procesora plaćanja i preusmerava kupca tamo; procesor vraća kupca na
         stranicu „povratak“ i javlja serveru rezultat (webhook). */
(function (w, d) {
  'use strict';
  var OF = w.OF, P = OF.placanje = {};
  var TEST = { uspeh: '4242424242424242', odbijena: '4000000000000002' };
  P.test = TEST;

  P.pokreni = function (n) {
    n = n || {};
    if (!OF.demo) return pravi(n);
    return new Promise(function (ok, ne) { demoEkran(n, ok, ne); });
  };

  /* ---------------- pravi režim ---------------- */
  function pravi(n) {
    var porudzbina = n.porudzbinaId || OF.id('P');
    OF.store.set('placanje-u-toku', { id: porudzbina, n: n, vreme: Date.now() });
    return fetch(OF.int.api('/placanje/start'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
      body: JSON.stringify({ porudzbinaId: porudzbina, iznos: n.iznos, valuta: 'RSD', opis: n.opis, tip: n.tip, ponavljanje: n.ponavljanje || null,
        kupac: n.kupac, jezik: OF.jezik, povratak: OF.int.apsolutno(OF.link('placanje-povratak', 'porudzbina=' + porudzbina)) })
    }).then(function (r) { if (!r.ok) throw new Error('start'); return r.json(); }).then(function (o) {
      w.location.href = o.url;                   // stranica procesora plaćanja
      return new Promise(function () {});        // stranica odlazi
    }).catch(function () { throw { poruka: OF.t('pl.greska_veza') }; });
  }
  P.proveriPovratak = function () {
    var id = OF.upit('porudzbina');
    return fetch(OF.int.api('/placanje/status?id=' + encodeURIComponent(id)), { credentials: 'omit' }).then(function (r) { return r.json(); });
  };

  /* ---------------- demo ekran ---------------- */
  function grupisi(br) { return br.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '); }
  function demoEkran(n, ok, ne) {
    var zavrseno = false;
    var telo = OF.h('div', { class: 'of-pl' });
    var dlg = OF.dijalog({ naslov: OF.t('pl.naslov'), id: 'pl', klasa: 'of-dialog--placanje', sadrzaj: telo, naZatvaranje: function () {
      if (!zavrseno) { zavrseno = true; ne({ prekinuto: true, poruka: OF.t('pl.prekinuto') }); }
    } });
    function korakKartica(greska) {
      telo.innerHTML = '';
      telo.appendChild(OF.h('div', { class: 'of-pl__demo', role: 'note' }, [OF.h('strong', null, OF.t('pl.demo_oznaka')), ' ', OF.t('pl.ne_unosite')]));
      telo.appendChild(OF.h('div', { class: 'of-pl__iznos' }, [OF.h('span', null, n.opis || ''), OF.h('strong', null, OF.din(n.iznos))]));
      var testovi = OF.h('div', { class: 'of-pl__test' }, [OF.h('p', { class: 'of-pl__test-naslov' }, OF.t('pl.test_kartice')),
        testRed(TEST.uspeh, OF.t('pl.test_uspeh')), testRed(TEST.odbijena, OF.t('pl.test_odbijena'))]);
      telo.appendChild(testovi);
      var forma = OF.h('form', { class: 'of-forma of-pl__forma', novalidate: true, autocomplete: 'off' });
      var polje = function (ime, oznaka, a, klasa) {
        return OF.h('div', { class: 'of-polje ' + (klasa || '') }, [OF.h('label', { for: 'pl-' + ime }, oznaka), OF.h('input', Object.assign({ id: 'pl-' + ime, name: ime, autocomplete: 'off', spellcheck: 'false' }, a))]);
      };
      forma.appendChild(polje('ime', OF.t('pl.ime_na_kartici'), { type: 'text', value: (n.kupac && n.kupac.ime) || '' }));
      var broj = polje('broj', OF.t('pl.broj'), { type: 'text', inputmode: 'numeric', placeholder: '0000 0000 0000 0000', maxlength: '19' });
      forma.appendChild(broj);
      forma.appendChild(OF.h('div', { class: 'of-pl__red' }, [polje('vazi', OF.t('pl.vazi'), { type: 'text', inputmode: 'numeric', placeholder: OF.t('pl.vazi_primer'), maxlength: '5' }), polje('cvc', 'CVC', { type: 'text', inputmode: 'numeric', placeholder: '123', maxlength: '4' })]));
      var ulazBroj = OF.$('input', broj);
      ulazBroj.addEventListener('input', function () { ulazBroj.value = grupisi(ulazBroj.value); });
      forma.elements.vazi.addEventListener('input', function (e) { var v = e.target.value.replace(/\D/g, '').slice(0, 4); e.target.value = v.length > 2 ? v.slice(0, 2) + '/' + v.slice(2) : v; });
      forma.appendChild(OF.h('div', { class: 'of-pl__logotipi', 'aria-label': OF.t('pl.logotipi') }, [
        OF.h('span', { class: 'of-pl__logo' }, 'VISA'), OF.h('span', { class: 'of-pl__logo' }, 'Mastercard'), OF.h('span', { class: 'of-pl__logo' }, 'Maestro'), OF.h('span', { class: 'of-pl__logo' }, 'DinaCard'),
        OF.h('span', { class: 'of-pl__logo of-pl__logo--3ds' }, '3-D Secure')]));
      forma.appendChild(OF.h('p', { class: 'of-pl__sitno' }, OF.t('pl.sitno')));
      var dugmad = OF.h('div', { class: 'of-zak__dugmad' }, [
        OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { dlg.zatvori(); } }, OF.t('pl.odustani')),
        OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno' }, OF.t('pl.plati', { iznos: OF.din(n.iznos) }))
      ]);
      forma.appendChild(dugmad);
      forma.addEventListener('submit', function (e) {
        e.preventDefault();
        var cist = forma.elements.broj.value.replace(/\D/g, '');
        var ispravno = OF.forma(forma, {
          ime: function (v) { return OF.provera.ime(v) ? '' : OF.t('pl.g_ime'); },
          broj: function () { return cist === TEST.uspeh || cist === TEST.odbijena ? '' : OF.t('pl.g_samo_test'); },
          vazi: function (v) { var m = /^(\d{2})\/(\d{2})$/.exec(v); if (!m || +m[1] < 1 || +m[1] > 12) return OF.t('pl.g_vazi'); var s = OF.sad().iso; var god = 2000 + +m[2]; return (god > +s.slice(0, 4) || (god === +s.slice(0, 4) && +m[1] >= +s.slice(5, 7))) ? '' : OF.t('pl.g_istekla'); },
          cvc: function (v) { return /^\d{3,4}$/.test(v) ? '' : OF.t('pl.g_cvc'); }
        });
        if (!ispravno) { if (cist && cist !== TEST.uspeh && cist !== TEST.odbijena) forma.elements.broj.value = ''; return; }
        var poslednje = cist.slice(-4);
        forma.reset();                              // demo: polja se odmah brišu, ništa se ne čuva
        korak3ds(cist === TEST.uspeh, poslednje);
      });
      telo.appendChild(forma);
      if (greska) telo.insertBefore(OF.h('p', { class: 'of-pl__greska', role: 'alert' }, greska), telo.children[1]);
      OF.$('input', forma).focus();
      function testRed(br, opis) {
        return OF.h('div', { class: 'of-pl__test-red' }, [OF.h('code', null, grupisi(br)), OF.h('span', null, opis),
          OF.h('button', { type: 'button', class: 'of-dugme of-dugme--mini', onclick: function () {
            ulazBroj.value = grupisi(br); forma.elements.vazi.value = '12/' + String((+OF.sad().iso.slice(2, 4) + 2)); forma.elements.cvc.value = '123'; ulazBroj.focus();
          } }, OF.t('pl.upisi'))]);
      }
    }
    function korak3ds(uspeh, poslednje) {
      telo.innerHTML = '';
      telo.appendChild(OF.h('div', { class: 'of-pl__demo', role: 'note' }, [OF.h('strong', null, OF.t('pl.demo_oznaka')), ' ', OF.t('pl.3ds_sim')]));
      var forma = OF.h('form', { class: 'of-forma of-pl__3ds', novalidate: true });
      forma.appendChild(OF.h('h3', null, OF.t('pl.3ds_naslov')));
      forma.appendChild(OF.h('p', null, OF.t('pl.3ds_opis', { iznos: OF.din(n.iznos), kartica: '•••• ' + poslednje })));
      forma.appendChild(OF.h('div', { class: 'of-polje' }, [OF.h('label', { for: 'pl-kod' }, OF.t('pl.3ds_kod')), OF.h('p', { class: 'of-polje__pomoc' }, OF.t('pl.3ds_demo_kod')),
        OF.h('input', { id: 'pl-kod', name: 'kod', inputmode: 'numeric', maxlength: '6', autocomplete: 'one-time-code' })]));
      forma.appendChild(OF.h('div', { class: 'of-zak__dugmad' }, [
        OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { dlg.zatvori(); } }, OF.t('pl.3ds_otkazi')),
        OF.h('button', { type: 'submit', class: 'of-dugme of-dugme--glavno' }, OF.t('pl.3ds_potvrdi'))]));
      forma.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!OF.forma(forma, { kod: function (v) { return v === '123456' ? '' : OF.t('pl.g_kod'); } })) return;
        obrada(uspeh, poslednje);
      });
      telo.appendChild(forma);
      OF.$('#pl-kod', forma).focus();
    }
    function obrada(uspeh, poslednje) {
      telo.innerHTML = '';
      telo.appendChild(OF.h('div', { class: 'of-pl__obrada', role: 'status' }, [OF.h('span', { class: 'of-spiner', 'aria-hidden': 'true' }), OF.t('pl.obrada')]));
      setTimeout(function () {
        if (!uspeh) {
          korakKartica(OF.t('pl.odbijena'));
          OF.int.dogadjaj('placanje.odbijeno', { iznos: n.iznos, opis: n.opis, tiho: true });
          return;
        }
        zavrseno = true;
        var rez = { nacin: 'kartica', id: OF.id('TX'), iznos: n.iznos, kartica: '•••• ' + poslednje, tipKartice: poslednje === TEST.uspeh.slice(-4) ? 'Visa' : '', odobrenje: String(100000 + Math.floor(Math.random() * 899999)), vreme: new Date().toISOString(), demo: true, ponavljanje: n.ponavljanje || null };
        telo.innerHTML = '';
        telo.appendChild(OF.h('div', { class: 'of-pl__uspeh', role: 'status' }, [OF.h('p', { class: 'of-pl__uspeh-znak', 'aria-hidden': 'true' }, '✓'), OF.h('h3', null, OF.t('pl.uspeh')), OF.h('p', null, OF.t('pl.uspeh_opis', { iznos: OF.din(n.iznos), kartica: rez.kartica }))]));
        setTimeout(function () { dlg.zatvori(); ok(rez); }, 1100);
      }, 1300);
    }
    korakKartica();
  }

  /* ---------------- IPS (instant plaćanje NBS) ----------------
     DEMO: dijalog sa QR kodom koji NE sadrži nalog za plaćanje (samo natpis „DEMO“), da ga nijedna
           bankarska aplikacija ne bi prihvatila; uplata se simulira dugmetom.
     PRAVI: server od procesora (npr. WSPay ili banke) dobija stranicu ili QR za IPS i potvrdu uplate. */
  P.ips = function (n) {
    n = n || {};
    if (!OF.demo) return pravi(Object.assign({ metod: 'ips' }, n));
    return new Promise(function (ok, ne) {
      var zavrseno = false, telo = OF.h('div', { class: 'of-pl of-pl--ips' });
      var dlg = OF.dijalog({ naslov: OF.t('pl.ips_naslov'), id: 'ips', klasa: 'of-dialog--placanje', sadrzaj: telo, naZatvaranje: function () { if (!zavrseno) { zavrseno = true; ne({ prekinuto: true, poruka: OF.t('pl.prekinuto') }); } } });
      telo.appendChild(OF.h('div', { class: 'of-pl__demo', role: 'note' }, [OF.h('strong', null, OF.t('pl.demo_oznaka')), ' ', OF.t('pl.ips_demo')]));
      telo.appendChild(OF.h('div', { class: 'of-pl__iznos' }, [OF.h('span', null, n.opis || ''), OF.h('strong', null, OF.din(n.iznos))]));
      var qr = OF.h('div', { class: 'of-pl__qr', role: 'img', 'aria-label': OF.t('pl.ips_qr_oznaka') });
      telo.appendChild(OF.h('div', { class: 'of-pl__ips' }, [qr, OF.h('ol', { class: 'of-pl__koraci' }, [OF.t('pl.ips_k1'), OF.t('pl.ips_k2'), OF.t('pl.ips_k3')].map(function (x) { return OF.h('li', null, x); }))]));
      OF.pdf.qrNaEkranu(qr, 'DEMO · opsforma · ' + OF.t('pl.ips_qr_demo_tekst') + ' · ' + (n.porudzbinaId || ''), 168);
      var status = OF.h('p', { class: 'of-pl__ips-status', role: 'status' }, [OF.h('span', { class: 'of-spiner', 'aria-hidden': 'true' }), ' ' + OF.t('pl.ips_cekam')]);
      telo.appendChild(status);
      telo.appendChild(OF.h('div', { class: 'of-zak__dugmad' }, [
        OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { dlg.zatvori(); } }, OF.t('pl.odustani')),
        OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: function () {
          status.textContent = OF.t('pl.obrada');
          setTimeout(function () {
            zavrseno = true;
            var rez = { nacin: 'ips', id: OF.id('IPS'), iznos: n.iznos, odobrenje: String(100000 + Math.floor(Math.random() * 899999)), vreme: new Date().toISOString(), demo: true };
            telo.innerHTML = '';
            telo.appendChild(OF.h('div', { class: 'of-pl__uspeh', role: 'status' }, [OF.h('p', { class: 'of-pl__uspeh-znak', 'aria-hidden': 'true' }, '✓'), OF.h('h3', null, OF.t('pl.uspeh')), OF.h('p', null, OF.t('pl.ips_uspeh', { iznos: OF.din(n.iznos) }))]));
            setTimeout(function () { dlg.zatvori(); ok(rez); }, 1000);
          }, 900);
        } }, OF.t('pl.ips_simuliraj'))]));
    });
  };

  /* ---------------- uplatnica (predračun) sa NBS IPS QR kodom za m-banking ----------------
     Format „PR“ (nalog za prenos) po NBS standardu. U DEMO režimu QR nikad ne sadrži broj računa. */
  P.ipsTekst = function (o) {
    var u = (OF.d.prodaja || {}).uplatnica || {};
    var racun = String(u.racun || '').replace(/\D/g, '');
    if (OF.demo || racun.length !== 18) return 'DEMO · ' + OF.t('pl.ips_qr_demo_tekst');
    var iznos = (Math.round(o.iznos * 100) / 100).toFixed(2).replace('.', ',');
    var cisto = function (s, n) { return String(s || '').replace(/[|\n\r]/g, ' ').slice(0, n); };
    return ['K:PR', 'V:01', 'C:1', 'R:' + racun, 'N:' + cisto(u.primalac || OF.d.firma.punoIme, 70), 'I:RSD' + iznos, 'SF:' + (u.sifra || '289'),
      'S:' + cisto(OF.t('pl.svrha', { broj: o.broj }), 35), 'RO:' + cisto((u.model || '00') + o.poziv, 35)].join('|');
  };
  P.uplatnicaPodaci = function (por) {
    var u = (OF.d.prodaja || {}).uplatnica || {};
    // poziv na broj (model 00): broj porudžbine u ciframa, slova kao dvocifreni brojevi (A=10 … Z=35)
    var poziv = String(por.id).toUpperCase().replace(/[^A-Z0-9]/g, '').split('').map(function (c) { return /\d/.test(c) ? c : String(c.charCodeAt(0) - 55); }).join('').slice(0, 20) || String(Date.now()).slice(-8);
    return { primalac: u.primalac || OF.d.firma.punoIme, adresa: OF.int.adresa(), racun: OF.demo ? (u.racunDemo || '000-0000000000000-00') : u.racun, iznos: por.ukupno, sifra: u.sifra || '289',
      svrha: OF.t('pl.svrha', { broj: por.id }), model: u.model || '00', poziv: poziv, broj: por.id, rok: u.rokDana || 3 };
  };
  P.uplatnicaPrikaz = function (por) {
    var p = P.uplatnicaPodaci(por);
    var qr = OF.h('div', { class: 'of-uplatnica__qr', role: 'img', 'aria-label': OF.t('pl.ips_qr_oznaka') });
    OF.pdf.qrNaEkranu(qr, P.ipsTekst({ iznos: p.iznos, broj: p.broj, poziv: p.poziv }), 150);
    var red = function (k, v) { return [OF.h('dt', null, k), OF.h('dd', null, v)]; };
    return OF.h('div', { class: 'of-uplatnica' }, [
      OF.h('h3', null, OF.t('pl.uplatnica_naslov')),
      OF.demo ? OF.h('p', { class: 'of-pl__demo', role: 'note' }, [OF.h('strong', null, OF.t('pl.demo_oznaka')), ' ', OF.t('pl.uplatnica_demo')]) : null,
      OF.h('div', { class: 'of-uplatnica__telo' }, [
        OF.h('dl', { class: 'of-pregled' }, [].concat(red(OF.t('pl.u_primalac'), p.primalac + ', ' + p.adresa), red(OF.t('pl.u_racun'), p.racun), red(OF.t('pl.u_iznos'), OF.din(p.iznos)),
          red(OF.t('pl.u_sifra'), p.sifra), red(OF.t('pl.u_svrha'), p.svrha), red(OF.t('pl.u_poziv'), (p.model ? p.model + ' ' : '') + p.poziv))),
        OF.h('figure', { class: 'of-uplatnica__qr-okvir' }, [qr, OF.h('figcaption', null, OF.t('pl.u_qr'))])]),
      OF.h('p', { class: 'of-uplatnica__rok' }, OF.t('pl.u_rok', { dana: p.rok })),
      OF.pdf.predracun ? OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { OF.pdf.predracun(por); } }, OF.t('pl.u_pdf')) : null
    ]);
  };

  /* ---------------- (demo) fiskalni račun ---------------- */
  P.racun = function (o) {
    // o: { stavke: [{naziv, kolicina, cena, pdv}], ukupno, placanje: {kartica, id}, kupac }
    var f = OF.d.firma, sada = OF.sad();
    var pdv = 0; (o.stavke || []).forEach(function (s) { var st = (s.pdv != null ? s.pdv : 20) / 100; pdv += s.cena * s.kolicina * st / (1 + st); });
    return {
      broj: 'DEMO-' + OF.id().slice(0, 4) + '-' + OF.id().slice(0, 4) + '-' + (1000 + Math.floor(Math.random() * 8999)),
      datum: sada.iso, vreme: OF.datum.uHHMM(sada.min), firma: f.punoIme || f.ime, pib: f.pib, adresa: OF.int.adresa(),
      stavke: o.stavke || [], ukupno: o.ukupno, pdv: Math.round(pdv * 100) / 100, placanje: o.placanje,
      qr: 'DEMO: ovo nije fiskalni račun. Na pravom sajtu QR vodi na proveru računa kod Poreske uprave.'
    };
  };
  P.racunHtml = function (r) {
    if (!r) return '';
    // pravi fiskalni račun (ESIR): tekst računa onako kako ga vraća V-PFR, uz link za proveru
    if (r.esir) return '<pre style="font-family:Courier New,monospace;font-size:12px;line-height:1.35;border:1px dashed #999;padding:12px;margin:14px 0;background:#fff;color:#111;white-space:pre-wrap">' + OF.esc(r.tekst || '') + '</pre>' + (r.provera ? '<p style="font-size:13px"><a href="' + OF.esc(r.provera) + '">' + OF.esc(OF.t('pl.provera_racuna')) + '</a></p>' : '');
    var red = function (a, b, c) { return '<tr><td style="padding:3px 0">' + OF.esc(a) + '</td><td style="padding:3px 0;text-align:right">' + OF.esc(b) + '</td><td style="padding:3px 0;text-align:right">' + OF.esc(c) + '</td></tr>'; };
    return '<div style="font-family:Courier New,monospace;font-size:13px;line-height:1.45;border:1px dashed #999;padding:14px;margin:14px 0;background:#fff;color:#111">' +
      '<p style="margin:0;text-align:center;font-weight:bold">' + OF.esc(OF.t('pl.racun_demo')) + '</p>' +
      '<p style="margin:6px 0;text-align:center">' + OF.esc(r.firma) + '<br>PIB ' + OF.esc(r.pib) + '<br>' + OF.esc(r.adresa) + '</p>' +
      '<p style="margin:6px 0">' + OF.esc(OF.t('pl.racun_broj')) + ': ' + OF.esc(r.broj) + '<br>' + OF.esc(r.datum + ' ' + r.vreme) + '</p>' +
      '<table style="width:100%;border-collapse:collapse">' + red(OF.t('pl.racun_stavka'), OF.t('pl.racun_kol'), OF.t('pl.racun_iznos')) +
      r.stavke.map(function (s) { return red(s.naziv, String(s.kolicina), OF.din(s.cena * s.kolicina)); }).join('') + '</table>' +
      '<p style="margin:8px 0 0;text-align:right;font-weight:bold">' + OF.esc(OF.t('ukupno')) + ': ' + OF.esc(OF.din(r.ukupno)) + '</p>' +
      '<p style="margin:0;text-align:right">' + OF.esc(OF.t('pl.racun_pdv')) + ': ' + OF.esc(OF.din(Math.round(r.pdv))) + '</p>' +
      '<p style="margin:6px 0 0">' + OF.esc(OF.t('pl.racun_placeno')) + ': ' + OF.esc(r.placanje ? (r.placanje.nacin && r.placanje.nacin !== 'kartica' && OF.korpa ? OF.korpa.nazivPlacanja(r.placanje.nacin) : OF.t('pl.kartica') + ' ' + (r.placanje.kartica || '')) : '') + '</p>' +
      '<p style="margin:10px 0 0;text-align:center;font-size:11px">' + OF.esc(OF.t('pl.racun_qr')) + '</p></div>';
  };
})(window, document);
