/* opsforma Premium · recepti: koja poruka ide kome za koji događaj
   Sajt može da zameni ili dopuni bilo koji recept (OF.int.recepti['tip'] = function (p) {...}). */
(function (w) {
  'use strict';
  var OF = w.OF, R = OF.int.recepti, D = OF.datum;
  var F = function () { return OF.d.firma; };
  var telKupcu = function () { var f = F(); return OF.jezik === 'sr' ? f.telefon : (f.telefonMedjunarodni || f.telefon); };   // strancima broj sa +381
  var cfg = function (ime) { return (OF.c.integracije || {})[ime] || {}; };
  var vlasnikMejl = function () { return cfg('mejl').vlasnik || F().email; };
  var mejlUsluge = function (t) { return OF.tx((OF.zak && OF.zak.usluga(t.usluga) || {}).naziv); };
  var osobaIme = function (t) { var o = OF.zak && OF.zak.osoba(t.osoba); return o ? o.ime : ''; };
  var prostor = function (id) { var p = ((OF.d.zakazivanje || {}).prostori || []).filter(function (x) { return x.id === id; })[0]; return p ? OF.tx(p.naziv) : id; };
  var kolone = function (k) { return OF.jezik === 'sr' ? k.sr : k.en; };

  /* opis termina u jednom redu, po tipu */
  function opisTermina(t) {
    if (t.tip === 'sto') return OF.t('r.sto_opis', { n: t.osobe, prostor: prostor(t.prostor) });
    if (t.tip === 'vozilo') return (t.paketNaziv || '') + (t.vozilo ? ' · ' + t.vozilo : '') + (t.registracija ? ' · ' + t.registracija : '');
    return mejlUsluge(t) + (osobaIme(t) ? ' · ' + osobaIme(t) : '');
  }
  R.opisTermina = opisTermina;

  R['termin.novi'] = function (p) {
    var t = p.termin, f = F(), kada = OF.int.vreme(t), dog = OF.zak.dogadjajZaKalendar(t);
    var redovi = [[OF.t('zak.broj'), t.id]];
    if (t.tip === 'termin') { redovi.push([OF.t('zak.usluga'), mejlUsluge(t)], [OF.t('zak.osoba'), osobaIme(t)]); }
    if (t.tip === 'sto') { redovi.push([OF.t('zak.osoba_broj'), String(t.osobe)], [OF.t('zak.prostor'), prostor(t.prostor)]); }
    if (t.tip === 'vozilo') { redovi.push([OF.t('zak.paket'), t.paketNaziv || ''], [OF.t('zak.vozilo'), (t.vozilo || '') + (t.registracija ? ' · ' + t.registracija : '')]); }
    redovi.push([t.tip === 'vozilo' ? OF.t('zak.ostavljanje') : OF.t('zak.kada'), kada]);
    if (t.gotovo) redovi.push([OF.t('zak.gotovo'), D.dug(t.gotovo.datum) + ', ' + D.vreme(t.gotovo.vreme)]);
    if (t.depozit) redovi.push([OF.t('zak.placen_depozit'), OF.din(t.depozit)]);
    if (t.meet) redovi.push(['Google Meet', t.meet]);
    if (!t.meet) redovi.push([OF.t('zak.adresa'), OF.int.adresa()]);
    var sms = [{ tekst: OF.t('r.sms_podsetnik', { firma: f.ime, kada: D.format(t.datum, { weekday: 'long' }) + ' ' + D.vreme(t.vreme), tel: telKupcu() }), kada: OF.t('r.dan_pre', { datum: D.kratko(D.dodaj(t.datum, -1)) }) }];
    var kal = { datum: t.datum, od: t.vreme, do: D.uHHMM(D.uMin(t.vreme) + (t.trajanje || 60)), naslov: (t.tip === 'termin' ? mejlUsluge(t) : opisTermina(t)) + ' · ' + t.ime,
      kalendar: t.tip === 'termin' ? osobaIme(t) : t.tip === 'sto' ? prostor(t.prostor) : OF.t('r.radionica'), boja: (OF.zak.osoba(t.osoba) || {}).boja,
      opis: [t.telefon, t.email, t.napomena ? OF.t('f.napomena') + ': ' + t.napomena : '', t.tip === 'termin' && t.prvaPoseta ? OF.t('r.prva_poseta') : ''].filter(Boolean).join('\n'), meet: t.meet };
    return {
      sazetak: OF.t('r.sazetak_termin', { ime: t.ime, kada: kada }),
      viber: { tekst: OF.t('r.viber_termin_naslov') + '\n' + opisTermina(t) + '\n' + kada + '\n' + t.ime + ' · ' + t.telefon + (t.napomena ? '\n„' + t.napomena + '“' : '') + (t.depozit ? '\n' + OF.t('zak.placen_depozit') + ': ' + OF.din(t.depozit) : ''), dugmad: [OF.t('r.pozovi'), OF.t('r.otvori_panel')] },
      kalendar: kal,
      mejlKupcu: { za: t.email, naslov: OF.t('r.mejl_termin_naslov', { firma: f.ime, kada: D.kratko(t.datum) + ' ' + D.vreme(t.vreme) }), prilozi: [OF.sajt + '-' + t.id + '.ics'],
        html: OF.int.mejl({ naslov: OF.tx((OF.d.zakazivanje || {}).mejlNaslov) || OF.t('r.mejl_termin_h1', { ime: t.ime.split(' ')[0] }), uvod: OF.tx((OF.d.zakazivanje || {}).mejlUvod) || OF.t('r.mejl_termin_uvod'), redovi: redovi, html: p.dodatakMejla || '',
          dugmad: [{ href: OF.int.googleKalendarLink(dog), tekst: OF.t('zak.dodaj_kalendar') }, { href: p.link, tekst: OF.t('zak.pomeri_otkazi'), sporedno: true }],
          napomena: OF.tx((OF.d.zakazivanje || {}).mejlNapomena) || OF.t('r.mejl_termin_napomena', { sati: (OF.d.zakazivanje || {}).otkazivanjeSati || 24, tel: telKupcu() }) }) },
      mejlVlasniku: { za: vlasnikMejl(), naslov: OF.t('r.mejl_vlasnik_termin', { kada: D.kratko(t.datum) + ' ' + D.vreme(t.vreme), ime: t.ime }), tekst: redovi.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') + '\n' + OF.t('f.telefon') + ': ' + t.telefon + '\n' + OF.t('f.email') + ': ' + t.email + (t.napomena ? '\n' + OF.t('f.napomena') + ': ' + t.napomena : '') },
      tabela: { list: OF.t('r.list_termini'), kolone: kolone({ sr: ['Broj', 'Kreirano', 'Datum', 'Vreme', 'Opis', 'Ime', 'Telefon', 'Mejl', 'Depozit'], en: ['ID', 'Created', 'Date', 'Time', 'Details', 'Name', 'Phone', 'Email', 'Deposit'] }),
        red: [t.id, D.kratko(OF.sad().iso) + ' ' + D.uHHMM(OF.sad().min), t.datum, t.vreme, opisTermina(t), t.ime, t.telefon, t.email, t.depozit ? OF.din(t.depozit) : '–'] },
      sms: sms
    };
  };
  R['termin.pomeren'] = function (p) {
    var t = p.termin, f = F(), kada = OF.int.vreme(t), staro = OF.int.vreme(p.stari);
    return {
      sazetak: OF.t('r.sazetak_pomeren', { ime: t.ime, kada: kada }),
      viber: { tekst: OF.t('r.viber_pomeren') + '\n' + opisTermina(t) + '\n' + staro + ' → ' + kada + '\n' + t.ime + ' · ' + t.telefon },
      kalendar: { datum: t.datum, od: t.vreme, do: D.uHHMM(D.uMin(t.vreme) + (t.trajanje || 60)), naslov: opisTermina(t) + ' · ' + t.ime, kalendar: t.tip === 'termin' ? osobaIme(t) : '', opis: OF.t('r.pomereno_sa', { kada: staro }) },
      mejlKupcu: { za: t.email, naslov: OF.t('r.mejl_pomeren_naslov', { firma: f.ime }), html: OF.int.mejl({ naslov: OF.t('r.mejl_pomeren_h1'), uvod: OF.t('r.mejl_pomeren_uvod', { staro: staro }), redovi: [[OF.t('zak.broj'), t.id], [OF.t('zak.kada'), kada], [OF.t('zak.adresa'), OF.int.adresa()]], dugmad: [{ href: p.link, tekst: OF.t('zak.pomeri_otkazi'), sporedno: true }] }) },
      tabela: { list: OF.t('r.list_termini'), kolone: kolone({ sr: ['Broj', 'Status', 'Novi datum', 'Novo vreme'], en: ['ID', 'Status', 'New date', 'New time'] }), red: [t.id, OF.t('moj.pomeren'), t.datum, t.vreme] }
    };
  };
  R['termin.otkazan'] = function (p) {
    var t = p.termin, f = F(), kada = OF.int.vreme(t);
    return {
      sazetak: OF.t('r.sazetak_otkazan', { ime: t.ime, kada: kada }),
      viber: { tekst: OF.t('r.viber_otkazan') + '\n' + opisTermina(t) + '\n' + kada + '\n' + t.ime + ' · ' + t.telefon + (t.depozit ? '\n' + OF.t('r.depozit_vratiti', { iznos: OF.din(t.depozit) }) : '') },
      kalendar: { datum: t.datum, od: t.vreme, do: D.uHHMM(D.uMin(t.vreme) + (t.trajanje || 60)), naslov: OF.t('r.kal_otkazano') + ' · ' + opisTermina(t), kalendar: t.tip === 'termin' ? osobaIme(t) : '', opis: OF.t('r.kal_otkazano_opis') },
      mejlKupcu: { za: t.email, naslov: OF.t('r.mejl_otkazan_naslov', { firma: f.ime }), html: OF.int.mejl({ naslov: OF.t('r.mejl_otkazan_h1'), uvod: OF.t('r.mejl_otkazan_uvod', { kada: kada }), dugmad: [{ href: OF.int.apsolutno(OF.link('zakazivanje')), tekst: OF.t('moj.novi') }] }) },
      tabela: { list: OF.t('r.list_termini'), kolone: kolone({ sr: ['Broj', 'Status'], en: ['ID', 'Status'] }), red: [t.id, OF.t('moj.otkazan')] }
    };
  };
  R['porudzbina.nova'] = function (p) {
    var o = p.porudzbina, f = F();
    var stavke = o.stavke.map(function (s) { return s.kolicina + ' × ' + s.naziv; }).join('\n');
    var redovi = [[OF.t('k.broj_porudzbine'), o.id], [OF.t('ukupno'), OF.din(o.ukupno)], [OF.t('pl.kartica'), o.placanje ? o.placanje.kartica : '']];
    if (o.preuzimanje) { var x = o.preuzimanje.split(' '); redovi.push([OF.t('k.preuzimanje'), D.dug(x[0]) + ', ' + D.vreme(x[1])]); }
    if (o.posiljka) redovi.push([OF.t('k.posiljka'), o.posiljka.servis + ' · ' + o.posiljka.broj]);
    if (o.adresa) redovi.push([OF.t('k.adresa'), o.adresa]);
    var listaHtml = '<table role="presentation" width="100%" style="margin:0 0 14px;font-size:14px">' + o.stavke.map(function (s) { return '<tr><td style="padding:4px 0">' + s.kolicina + ' × ' + OF.esc(s.naziv) + '</td><td style="padding:4px 0;text-align:right">' + OF.esc(OF.din(s.cena * s.kolicina)) + '</td></tr>'; }).join('') + '</table>';
    var kodoviHtml = (o.kodovi || []).length ? '<p style="font-size:14px;margin:0 0 6px"><strong>' + OF.esc(OF.t('r.kodovi')) + '</strong></p>' + o.kodovi.map(function (k) { return '<p style="margin:0 0 4px;font-size:14px">' + OF.esc(k.naziv) + ': <code>' + OF.esc(k.kod) + '</code></p>'; }).join('') : '';
    var prilozi = (o.kodovi || []).map(function (k) { return k.kod + '.pdf'; });
    var izlaz = {
      sazetak: OF.t('r.sazetak_porudzbina', { ime: o.kupac.ime, iznos: OF.din(o.ukupno) }),
      viber: { tekst: OF.t('r.viber_porudzbina', { broj: o.id }) + '\n' + stavke + '\n' + OF.t('ukupno') + ': ' + OF.din(o.ukupno) + ' (' + OF.t('r.placeno_karticom') + ')' + (o.preuzimanje ? '\n' + OF.t('k.preuzimanje') + ': ' + o.preuzimanje.split(' ').map(function (v, i) { return i ? D.vreme(v) : D.kratko(v); }).join(' ') : '') + (o.posiljka ? '\n' + o.posiljka.servis + ': ' + o.posiljka.broj : '') + '\n' + o.kupac.ime + ' · ' + o.kupac.telefon, dugmad: [OF.t('r.otvori_panel')] },
      mejlKupcu: { za: o.kupac.email, naslov: OF.t('r.mejl_porudzbina_naslov', { firma: f.ime, broj: o.id }), prilozi: ['racun-' + o.id + '.pdf'].concat(prilozi),
        html: OF.int.mejl({ naslov: OF.t('r.mejl_porudzbina_h1', { ime: o.kupac.ime.split(' ')[0] }), uvod: OF.tx((OF.d.prodaja || {}).mejlUvod) || OF.t('r.mejl_porudzbina_uvod'), redovi: redovi, html: listaHtml + kodoviHtml + OF.placanje.racunHtml(o.racun),
          dugmad: o.posiljka ? [{ href: OF.int.apsolutno(OF.link('pracenje-posiljke', 'broj=' + o.posiljka.broj)), tekst: OF.t('r.prati_posiljku') }] : [], napomena: OF.t('r.mejl_porudzbina_napomena') }) },
      mejlVlasniku: { za: vlasnikMejl(), naslov: OF.t('r.mejl_vlasnik_porudzbina', { broj: o.id, iznos: OF.din(o.ukupno) }), tekst: stavke + '\n\n' + redovi.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') + '\n' + o.kupac.ime + ' · ' + o.kupac.telefon + ' · ' + o.kupac.email + (o.napomena ? '\n' + OF.t('f.napomena') + ': ' + o.napomena : '') },
      tabela: { list: OF.t('r.list_porudzbine'), kolone: kolone({ sr: ['Broj', 'Vreme', 'Stavke', 'Ukupno', 'Kupac', 'Telefon', 'Preuzimanje / pošiljka'], en: ['ID', 'Time', 'Items', 'Total', 'Customer', 'Phone', 'Pickup / shipment'] }),
        red: [o.id, D.uHHMM(OF.sad().min), o.stavke.map(function (s) { return s.kolicina + '× ' + s.naziv; }).join(', '), o.ukupno, o.kupac.ime, o.kupac.telefon, o.preuzimanje || (o.posiljka ? o.posiljka.broj : '–')] },
      ostalo: [{ naziv: OF.t('r.fiskalni'), html: OF.placanje.racunHtml(o.racun) }]
    };
    if (o.posiljka) izlaz.ostalo.push({ naziv: OF.t('r.kurir'), tekst: OF.t('r.kurir_tekst', { servis: o.posiljka.servis, broj: o.posiljka.broj, adresa: o.adresa || '' }) });
    if (o.preuzimanje) izlaz.sms = [{ tekst: OF.t('r.sms_spremno', { firma: f.ime, broj: o.id }), kada: OF.t('r.kad_spremno') }];
    return izlaz;
  };
  R['kontakt.poruka'] = function (p) {
    return {
      sazetak: OF.t('r.sazetak_poruka', { ime: p.ime }),
      viber: { tekst: OF.t('r.viber_poruka') + '\n' + p.ime + ' · ' + (p.telefon || p.email) + '\n„' + p.poruka + '“' },
      mejlVlasniku: { za: vlasnikMejl(), naslov: OF.t('r.mejl_vlasnik_poruka', { ime: p.ime }), tekst: p.poruka + '\n\n' + p.ime + '\n' + (p.email || '') + '\n' + (p.telefon || '') },
      mejlKupcu: p.email ? { za: p.email, naslov: OF.t('r.mejl_poruka_naslov', { firma: F().ime }), html: OF.int.mejl({ naslov: OF.t('r.mejl_poruka_h1'), uvod: OF.t('r.mejl_poruka_uvod'), html: '<blockquote style="margin:0 0 14px;padding:10px 14px;border-left:3px solid #ccc;font-size:14px;color:#444">' + OF.esc(p.poruka) + '</blockquote>' }) } : null,
      tabela: { list: OF.t('r.list_poruke'), kolone: kolone({ sr: ['Vreme', 'Ime', 'Kontakt', 'Poruka'], en: ['Time', 'Name', 'Contact', 'Message'] }), red: [D.uHHMM(OF.sad().min), p.ime, p.telefon || p.email, p.poruka] }
    };
  };
  R['newsletter.prijava'] = function (p) {
    var f = F(), link = OF.int.apsolutno(OF.link('newsletter-potvrda', 'k=' + p.potvrda + '&e=' + encodeURIComponent(p.email)));
    return {
      sazetak: OF.t('r.sazetak_newsletter', { email: p.email }),
      mejlKupcu: { za: p.email, naslov: OF.t('r.mejl_newsletter_naslov', { firma: f.ime }), html: OF.int.mejl({ naslov: OF.t('r.mejl_newsletter_h1'), uvod: OF.t('r.mejl_newsletter_uvod'), dugmad: [{ href: link, tekst: OF.t('r.potvrdi_prijavu') }], napomena: OF.t('r.mejl_newsletter_napomena') }) },
      ostalo: [{ naziv: 'Brevo', tekst: OF.t('r.brevo_tekst', { email: p.email }) }]
    };
  };
  R['nalog.link'] = function (p) {
    var f = F();
    return {
      sazetak: OF.t('r.sazetak_nalog', { email: p.email }),
      mejlKupcu: { za: p.email, naslov: OF.t('r.mejl_nalog_naslov', { firma: f.ime }), html: OF.int.mejl({ naslov: OF.t('r.mejl_nalog_h1'), uvod: OF.t('r.mejl_nalog_uvod'), dugmad: [{ href: p.link, tekst: OF.t('r.prijavi_se') }], napomena: OF.t('r.mejl_nalog_napomena') }) }
    };
  };
  R['recenzija.molba'] = function (p) {
    var f = F(), link = 'https://search.google.com/local/writereview?placeid=' + encodeURIComponent(cfg('recenzije').placeId || 'PLACE_ID');
    return {
      sazetak: OF.t('r.sazetak_recenzija', { ime: p.ime }),
      mejlKupcu: { za: p.email, naslov: OF.t('r.mejl_recenzija_naslov', { firma: f.ime }), html: OF.int.mejl({ naslov: OF.t('r.mejl_recenzija_h1', { ime: (p.ime || '').split(' ')[0] }), uvod: OF.t('r.mejl_recenzija_uvod'), dugmad: [{ href: link, tekst: OF.t('r.ostavi_recenziju') }], napomena: OF.t('r.mejl_recenzija_napomena') }) },
      sms: [{ tekst: OF.t('r.sms_recenzija', { firma: f.ime }), kada: OF.t('r.posle_posete') }]
    };
  };
  R['placanje.odbijeno'] = function (p) { return { sazetak: OF.t('r.sazetak_odbijeno', { iznos: OF.din(p.iznos) }) }; };
  R['*'] = function (p) { return { sazetak: p.tip }; };
})(window);
