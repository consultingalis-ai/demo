/* opsforma Premium · PDF dokumenti (ponuda, vaučer, ulaznica, garantni list) i QR kodovi
   jsPDF i font se učitavaju tek kad zatrebaju. Font sa č, ć, ž, š, đ je u assets/js/pdf-font.js. */
(function (w, d) {
  'use strict';
  var OF = w.OF, PDF = OF.pdf = { sabloni: {} };

  PDF.ucitaj = function () {
    return Promise.all([OF.ucitaj('assets/vendor/jspdf.umd.min.js'), OF.ucitaj('assets/vendor/qrcode.min.js'), OF.ucitaj('assets/js/pdf-font.js')]);
  };

  /* QR kao SVG (za ekran) */
  PDF.qrSvg = function (tekst, velicina, boja) {
    var qr = w.qrcode(0, 'M'); qr.addData(tekst); qr.make();
    var n = qr.getModuleCount(), m = 4, s = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) s += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + 2 * m) + ' ' + (n + 2 * m) + '" width="' + (velicina || 160) + '" height="' + (velicina || 160) + '" shape-rendering="crispEdges" role="img" aria-label="QR kod"><rect width="100%" height="100%" fill="#fff"/><path d="' + s + '" fill="' + (boja || '#000') + '"/></svg>';
  };
  PDF.qrNaEkranu = function (el, tekst, velicina) {
    return OF.ucitaj('assets/vendor/qrcode.min.js').then(function () { el.innerHTML = PDF.qrSvg(tekst, velicina); });
  };

  /* pomoćnici za crtanje */
  function alati(doc) {
    var F = w.OF_PDF_FONT || {};
    var a = {
      doc: doc, sirina: doc.internal.pageSize.getWidth(), visina: doc.internal.pageSize.getHeight(),
      boja: function (hex) { var c = hex.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; },
      font: function (tezina, velicina, hex) {      // tezina: 'n' obična, 'b' podebljana, 'h' naslovni font (ako ga sajt ima)
        if (tezina === 'h' && F.naslov) doc.setFont(F.naslov.ime, 'normal');
        else doc.setFont(F.ime || 'helvetica', tezina === 'b' && F.bold ? 'bold' : 'normal');
        doc.setFontSize(velicina || 10);
        var c = a.boja(hex || '#1D232C'); doc.setTextColor(c[0], c[1], c[2]);
      },
      tekst: function (t, x, y, o) { doc.text(String(t), x, y, o || {}); },
      prelom: function (t, x, y, sirina, razmak) { var r = doc.splitTextToSize(String(t), sirina); doc.text(r, x, y, { lineHeightFactor: razmak || 1.4 }); return y + r.length * doc.getFontSize() * 0.3528 * (razmak || 1.4); },
      linija: function (x1, y1, x2, y2, hex, deb) { var c = a.boja(hex || '#CCCCCC'); doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(deb || 0.2); doc.line(x1, y1, x2, y2); },
      pravougaonik: function (x, y, s, v, hex, okvir) { var c = a.boja(hex); if (okvir) { doc.setDrawColor(c[0], c[1], c[2]); doc.rect(x, y, s, v, 'S'); } else { doc.setFillColor(c[0], c[1], c[2]); doc.rect(x, y, s, v, 'F'); } },
      qr: function (tekst, x, y, vel, hex) {
        var qr = w.qrcode(0, 'M'); qr.addData(tekst); qr.make();
        var n = qr.getModuleCount(), m = vel / n, c = a.boja(hex || '#000000');
        doc.setFillColor(255, 255, 255); doc.rect(x - 2, y - 2, vel + 4, vel + 4, 'F');
        doc.setFillColor(c[0], c[1], c[2]);
        for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (qr.isDark(r, k)) doc.rect(x + k * m, y + r * m, m + 0.02, m + 0.02, 'F');
      },
      slika: function (dataUrl, x, y, s, v) { try { doc.addImage(dataUrl, 'PNG', x, y, s, v); } catch (e) { /* bez slike */ } },
      din: OF.din, datum: OF.datum
    };
    return a;
  }
  function noviDokument(opcije) {
    var jsPDF = w.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: (opcije && opcije.format) || 'a4', orientation: (opcije && opcije.orijentacija) || 'portrait', compress: true });
    var F = w.OF_PDF_FONT;
    if (F && F.regular) {
      doc.addFileToVFS(F.ime + '-r.ttf', F.regular); doc.addFont(F.ime + '-r.ttf', F.ime, 'normal');
      if (F.bold) { doc.addFileToVFS(F.ime + '-b.ttf', F.bold); doc.addFont(F.ime + '-b.ttf', F.ime, 'bold'); }
      if (F.naslov) { doc.addFileToVFS(F.naslov.ime + '-n.ttf', F.naslov.regular); doc.addFont(F.naslov.ime + '-n.ttf', F.naslov.ime, 'normal'); }
      doc.setFont(F.ime, 'normal');
    }
    doc.setProperties({ title: (opcije && opcije.naslov) || OF.d.firma.ime, creator: OF.d.firma.ime + ' (opsforma)' });
    return doc;
  }
  /* napravi PDF po šablonu: sinhrono kad su jsPDF i font već učitani (na serveru uvek jesu, za priloge mejla), inače posle učitavanja */
  PDF.napraviOdmah = function (sablon, podaci, opcije) {
    var fn = typeof sablon === 'function' ? sablon : PDF.sabloni[sablon];
    if (!fn) throw new Error('Nema PDF šablona: ' + sablon);
    var doc = noviDokument(opcije);
    var a = alati(doc);
    fn(a, podaci);
    if (OF.demo) {           // jasna oznaka na svakoj strani
      var n = doc.getNumberOfPages();
      for (var i = 1; i <= n; i++) { doc.setPage(i); a.font('n', 7, '#8A8A8A'); a.tekst(OF.t('pdf.demo'), a.sirina / 2, a.visina - 5, { align: 'center' }); }
    }
    return { doc: doc, ime: ((opcije && opcije.ime) || 'dokument') + '.pdf' };
  };
  PDF.napravi = function (sablon, podaci, opcije) {
    return PDF.ucitaj().then(function () {
      var r = PDF.napraviOdmah(sablon, podaci, opcije);
      return { blob: r.doc.output('blob'), ime: r.ime, doc: r.doc };
    });
  };
  PDF.preuzmi = function (sablon, podaci, opcije) {
    return PDF.napravi(sablon, podaci, opcije).then(function (r) { OF.preuzmi(r.ime, r.blob, 'application/pdf'); return r; });
  };

  /* podrazumevani šablon za vaučer i ulaznicu (sajt može da ga zameni) */
  PDF.sabloni.kod = function (a, k) {
    var b = OF.d.brend || {}, f = OF.d.firma;
    var tamna = b.pdfTamna || '#1D232C', akcenat = b.pdfAkcenat || '#2D4866', svetla = b.pdfSvetla || '#F5F1EA';
    a.pravougaonik(0, 0, a.sirina, 70, tamna);
    a.font('b', 22, '#FFFFFF'); a.tekst(f.ime, 18, 26);
    a.font('n', 10, '#FFFFFF'); a.tekst(k.tip === 'vaucer' ? OF.t('pdf.poklon_vaucer') : OF.t('pdf.ulaznica'), 18, 36);
    a.font('b', 26, '#FFFFFF'); a.tekst(k.tip === 'vaucer' ? OF.din(k.iznos) : k.naziv, 18, 58);
    a.pravougaonik(0, 70, a.sirina, 4, akcenat);
    var y = 92;
    a.font('n', 10, '#555555');
    var red = function (kljuc, v) { if (!v) return; a.font('n', 9, '#777777'); a.tekst(kljuc, 18, y); a.font('b', 12, tamna); y = a.prelom(v, 60, y, a.sirina - 18 - 52 - 8 - 60) + 2; };   // vrednosti ne ulaze pod QR kod
    if (k.tip === 'ulaznica') { red(OF.t('pdf.dogadjaj'), k.naziv); red(OF.t('zak.datum'), k.opcije.datum ? OF.datum.dug(k.opcije.datum) + (k.opcije.vreme ? ', ' + k.opcije.vreme : '') : ''); }
    red(OF.t('pdf.za'), k.opcije && k.opcije.primalac); red(OF.t('pdf.od'), k.opcije && k.opcije.od); red(OF.t('pdf.poruka'), k.opcije && k.opcije.poruka);
    red(OF.t('pdf.kod'), k.kod); red(OF.t('pdf.vazi_do'), k.vaziDo ? OF.datum.dug(k.vaziDo) : '');
    a.qr(k.kod, a.sirina - 18 - 52, 90, 52);
    a.font('n', 8, '#777777'); a.tekst(OF.t('pdf.pokazite_qr'), a.sirina - 18 - 26, 150, { align: 'center' });
    y = Math.max(y, 165) + 6;
    a.linija(18, y, a.sirina - 18, y, '#DDDDDD'); y += 8;
    a.font('n', 9, '#555555'); y = a.prelom(OF.tx((OF.d.prodaja || {}).uslovKoda) || OF.t('pdf.uslov_koda'), 18, y, a.sirina - 36);
    a.font('n', 9, '#555555'); a.tekst(f.ime + ' · ' + OF.int.adresa() + ' · ' + f.telefon, 18, a.visina - 14);
  };
  PDF.kod = function (k) { return PDF.preuzmi(OF.d.brend && OF.d.brend.pdfSablonKoda || 'kod', k, { ime: OF.sajt + '-' + k.kod }); };

  /* potvrda porudžbine / predračun (uplatnica sa IPS QR kodom kad se čeka uplata) */
  PDF.sabloni.predracun = function (a, p) {
    var b = OF.d.brend || {}, f = OF.d.firma, tamna = b.pdfTamna || '#1D232C', svetla = b.pdfSvetla || '#F5F1EA', linija = b.pdfLinija || '#DDDDDD';
    var ceka = p.status === 'ceka-uplatu', x0 = 18, x1 = a.sirina - 18;
    a.font('h', 22, tamna); a.tekst(f.ime, x0, 24);
    a.font('n', 8.5, '#666666'); a.prelom([f.punoIme || f.ime, OF.int.adresa(), 'PIB ' + f.pib + (f.mb ? ' · MB ' + f.mb : ''), f.telefon + ' · ' + f.email].join('\n'), x1 - 70, 16, 70, 1.35);
    a.linija(x0, 38, x1, 38, linija, 0.3);
    a.font('b', 15, tamna); a.tekst(ceka ? OF.t('pdf.predracun') : OF.t('pdf.potvrda'), x0, 50);
    a.font('n', 9.5, '#444444');
    a.tekst(OF.t('k.broj_porudzbine') + ': ' + p.id, x0, 58); a.tekst(OF.t('pdf.datum') + ': ' + OF.datum.dug(OF.datum.lokalno(p.vreme).iso), x0, 64);
    a.font('n', 8.5, '#777777'); a.tekst(OF.t('pdf.kupac'), x1 - 70, 50);
    a.font('n', 9.5, '#222222'); a.prelom([p.kupac.ime, p.kupac.email, p.kupac.telefon].concat(p.adresa ? [p.adresa] : []).join('\n'), x1 - 70, 56, 70, 1.35);
    var y = 82;
    a.pravougaonik(x0, y - 5.5, x1 - x0, 8, svetla);
    a.font('b', 8.5, tamna); a.tekst(OF.t('pl.racun_stavka'), x0 + 2, y); a.tekst(OF.t('pl.racun_kol'), x1 - 52, y, { align: 'right' }); a.tekst(OF.t('pdf.cena'), x1 - 30, y, { align: 'right' }); a.tekst(OF.t('pl.racun_iznos'), x1 - 2, y, { align: 'right' });
    y += 8;
    var red = function (naziv, detalj, kol, cena, iznos) {
      a.font('n', 9.5, '#222222'); var y2 = a.prelom(naziv, x0 + 2, y, x1 - x0 - 70, 1.3);
      if (detalj) { a.font('n', 8, '#777777'); y2 = a.prelom(detalj, x0 + 2, y2 - 1, x1 - x0 - 70, 1.3); }
      a.font('n', 9.5, '#222222'); if (kol != null) a.tekst(String(kol), x1 - 52, y, { align: 'right' }); if (cena != null) a.tekst(OF.din(cena), x1 - 30, y, { align: 'right' }); a.tekst(iznos, x1 - 2, y, { align: 'right' });
      y = Math.max(y + 6, y2 + 1); a.linija(x0, y - 3.5, x1, y - 3.5, '#EEEEEE');
    };
    p.stavke.forEach(function (s) { red(s.naziv, s.detalj ? (typeof s.detalj === 'string' ? s.detalj : OF.tx(s.detalj)) : '', s.kolicina, s.cena, OF.din(s.cena * s.kolicina)); });
    if (p.pakovanje) red(OF.t('k.pakovanje'), p.poklonPoruka ? '„' + p.poklonPoruka + '“' : '', 1, p.pakovanje, OF.din(p.pakovanje));
    if (p.dostava) red(OF.t('k.dostava'), OF.tx(p.nacinNaziv) || '', 1, p.dostava, OF.din(p.dostava));
    if (p.popust) red(OF.t('k.popust') + (p.kupon ? ' (' + p.kupon + ')' : ''), '', null, null, '− ' + OF.din(p.popust));
    if (p.vaucer) red(OF.t('k.vaucer_kratko') + ' ' + p.vaucer.kod, '', null, null, '− ' + OF.din(p.vaucer.iznos));
    y += 2; a.font('b', 12, tamna); a.tekst(OF.t('ukupno'), x1 - 60, y); a.tekst(OF.din(p.ukupno), x1 - 2, y, { align: 'right' });
    var pdv = Math.round(p.stavke.filter(function (s) { return s.tip !== 'vaucer'; }).reduce(function (s2, s) { return s2 + s.cena * s.kolicina; }, 0) * 20 / 120);
    y += 6; a.font('n', 8.5, '#666666'); a.tekst(OF.t('pdf.pdv_ukljucen', { iznos: OF.din(pdv) }), x1 - 2, y, { align: 'right' });
    y += 12;
    a.font('n', 9, '#444444'); a.tekst(OF.t('k.placanje') + ': ' + OF.korpa.nazivPlacanja((p.placanje || {}).nacin || 'kartica') + (p.placanje && p.placanje.kartica ? ' · ' + p.placanje.kartica : ''), x0, y);
    if (ceka && OF.placanje.uplatnicaPodaci) {
      var u = OF.placanje.uplatnicaPodaci(p); y += 10;
      a.pravougaonik(x0, y - 6, x1 - x0, 58, svetla);
      a.font('b', 11, tamna); a.tekst(OF.t('pl.uplatnica_naslov'), x0 + 5, y + 1);
      var yy = y + 9;
      [[OF.t('pl.u_primalac'), u.primalac], [OF.t('pl.u_racun'), u.racun], [OF.t('pl.u_iznos'), OF.din(u.iznos)], [OF.t('pl.u_sifra'), u.sifra], [OF.t('pl.u_svrha'), u.svrha], [OF.t('pl.u_poziv'), u.model + ' ' + u.poziv]].forEach(function (r) {
        a.font('n', 8.5, '#777777'); a.tekst(r[0], x0 + 5, yy); a.font('b', 9.5, '#222222'); a.tekst(String(r[1]), x0 + 38, yy); yy += 6.5;
      });
      a.qr(OF.placanje.ipsTekst({ iznos: u.iznos, broj: u.broj, poziv: u.poziv }), x1 - 50, y - 2, 42);
      y += 60; a.font('n', 8.5, '#555555'); y = a.prelom(OF.t('pl.u_qr') + ' ' + OF.t('pl.u_rok', { dana: u.rok }) + (OF.demo ? ' ' + OF.t('pl.uplatnica_demo') : ''), x0, y, x1 - x0);
    }
    y = Math.max(y + 10, a.visina - 40);
    a.linija(x0, y, x1, y, linija); y += 6;
    a.font('n', 8, '#666666'); a.prelom(OF.tx((OF.d.prodaja || {}).pdfNapomena) || OF.t(p.racun ? 'pdf.napomena_placeno' : 'pdf.napomena_porudzbine', { dana: (OF.d.prodaja || {}).odustanakDana || 14 }), x0, y, x1 - x0);
  };
  PDF.predracun = function (p) { return PDF.preuzmi('predracun', p, { ime: OF.sajt + '-' + (p.status === 'ceka-uplatu' ? 'predracun-' : 'potvrda-') + p.id, naslov: p.id }); };

  /* obrazac za odustanak od ugovora zaključenog na daljinu (Zakon o zaštiti potrošača), popunjen */
  PDF.sabloni.odustanak = function (a, z) {
    var b = OF.d.brend || {}, f = OF.d.firma, tamna = b.pdfTamna || '#1D232C', x0 = 20, x1 = a.sirina - 20, y = 26;
    a.font('b', 15, tamna); y = a.prelom(OF.t('pdf.odustanak_naslov'), x0, y, x1 - x0, 1.25) + 2;
    a.font('n', 9, '#555555'); y = a.prelom(OF.t('pdf.odustanak_uvod'), x0, y, x1 - x0) + 4;
    var red = function (k, v) { a.font('n', 8.5, '#777777'); a.tekst(k, x0, y); a.font('n', 10.5, '#111111'); y = a.prelom(v || '–', x0, y + 5, x1 - x0) + 3; a.linija(x0, y - 2, x1, y - 2, '#E5E5E5'); y += 3; };
    red(OF.t('pdf.trgovac'), [f.punoIme || f.ime, OF.int.adresa(), f.email, 'PIB ' + f.pib].join(', '));
    red(OF.t('pdf.izjava'), OF.t('pdf.odustanak_izjava'));
    red(OF.t('k.broj_porudzbine'), z.broj);
    red(OF.t('pr.stavke'), (z.stavke || []).join(', '));
    red(OF.t('pdf.datum_prijema'), z.prijem || '');
    red(OF.t('pdf.potrosac'), z.ime + ', ' + z.email + (z.adresa ? ', ' + z.adresa : ''));
    if (z.tekuci) red(OF.t('pr.tekuci'), z.tekuci);
    red(OF.t('pr.broj_zahteva'), z.id + ' · ' + OF.datum.dug(OF.datum.lokalno(z.vreme).iso));
    y += 4; a.font('n', 8.5, '#555555'); a.prelom(OF.t('pdf.odustanak_napomena'), x0, y, x1 - x0);
  };
  PDF.odustanak = function (z) { return PDF.preuzmi('odustanak', z, { ime: OF.sajt + '-odustanak-' + z.id }); };
})(window, document);
