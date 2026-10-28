/* opsforma Premium · integracije
   DEMO: ništa se ne šalje; sajt napravi poruke koje bi otišle (Viber, mejl, kalendar, tabela, SMS)
         i pokaže ih vlasniku. Sve se upisuje u lokalni dnevnik (vidi se u panelu).
   PRAVI: sajt šalje JEDAN poziv na /api/dogadjaj (Cloudflare Worker), a tek server, sa ključevima
         koji nikad nisu u kodu sajta, šalje Viber, mejl, upis u kalendar i tabelu, SMS. */
(function (w, d) {
  'use strict';
  var OF = w.OF, I = OF.int = {};
  var cfg = function (ime) { return (OF.c.integracije || {})[ime] || {}; };
  I.ukljuceno = function (ime) { var c = cfg(ime); return c.ukljuceno !== false; };

  /* ---------- spisak integracija (za panel i dokumentaciju) ---------- */
  I.spisak = function () {
    var I18 = function (sr, en) { return OF.jezik === 'sr' ? sr : en; };
    var c = OF.c.integracije || {}, prod = !!OF.d.katalog;    // prodavnica: drugi opisi, bez kalendara
    var sve = [
      ['viber', 'Viber', prod ? I18('Obaveštenje vlasniku za svaku porudžbinu i malu zalihu; Viber zajednica', 'Owner notification for every order and low stock; Viber community') : I18('Obaveštenje vlasniku za svaki termin i kupovinu; Viber zajednica', 'Owner notification for every booking and purchase; Viber community'), ['brojVlasnika']],
      ['whatsapp', 'WhatsApp', I18('Dugme za razgovor', 'Chat button'), ['broj']],
      ['mejl', I18('Mejl (Brevo ili Resend)', 'Email (Brevo or Resend)'), prod ? I18('Potvrde i statusi porudžbina kupcu, sa PDF-om; obaveštenja vlasniku', 'Order confirmations and status emails with PDFs; owner alerts') : I18('Potvrde kupcu i obaveštenja vlasniku', 'Customer confirmations and owner alerts'), ['posiljalac']],
      prod ? null : ['kalendar', 'Google Kalendar', I18('Svaki termin se sam upiše, poseban kalendar po osobi', 'Every booking is added, one calendar per person'), ['kalendari']],
      ['sheets', 'Google Sheets', prod ? I18('Cenovnik iz tabele; sve porudžbine i zahtevi u tabelu', 'Prices from a sheet; all orders and requests into a sheet') : I18('Cenovnik iz tabele; sve rezervacije i porudžbine u tabelu', 'Prices from a sheet; all bookings and orders into a sheet'), ['tabelaId']],
      ['mape', 'Google Maps', prod ? I18('Mapa i ruta do radionice', 'Map and directions to the workshop') : I18('Mapa i ruta do firme', 'Map and directions'), []],
      ['recenzije', I18('Google recenzije', 'Google reviews'), prod ? I18('Ocena i recenzije; molba za recenziju samo kupcima, posle isporuke', 'Rating and reviews; review request only to customers, after delivery') : I18('Ocena i recenzije; molba za recenziju posle posete', 'Rating and reviews; review request after the visit'), ['placeId']],
      ['instagram', 'Instagram', I18('Najnovije objave na sajtu', 'Latest posts on the site'), ['nalog']],
      ['sms', I18('SMS (Infobip)', 'SMS (Infobip)'), prod ? I18('Poslata pošiljka i spremno za preuzimanje', 'Parcel shipped and ready for pickup') : I18('Podsetnik dan pre i obaveštenje kad je nešto spremno', 'Reminder the day before and “ready” alerts'), ['posiljalac']],
      ['newsletter', I18('Newsletter (Brevo)', 'Newsletter (Brevo)'), I18('Prijava sa potvrdom na mejl', 'Sign-up with email confirmation'), ['listaId']],
      ['analitika', 'GA4 · GTM · Meta Pixel', I18('Uključuje se tek posle pristanka na kolačiće', 'Loads only after cookie consent'), ['ga4', 'gtm', 'metaPixel']],
      ['turnstile', 'Cloudflare Turnstile', prod ? I18('Zaštita kase i formi od spama i lažnih porudžbina', 'Protects checkout and forms from spam and fake orders') : I18('Zaštita formi od spama', 'Spam protection for forms'), ['siteKey']]
    ];
    sve = sve.filter(Boolean);
    (OF.d.dodatneIntegracije || []).forEach(function (x) { sve.push([x.id, OF.tx(x.naziv), OF.tx(x.opis), x.polja || []]); });
    return sve.map(function (s) {
      var podesavanja = c[s[0]] || {};
      var nedostaje = s[3].filter(function (p) { var v = podesavanja[p]; return v == null || v === '' || (typeof v === 'object' && !Object.keys(v).length); });
      var stanje = podesavanja.ukljuceno === false ? 'iskljuceno' : OF.demo ? 'demo' : nedostaje.length ? 'nedostaje' : 'ukljuceno';
      return { id: s[0], naziv: s[1], opis: s[2], stanje: stanje, nedostaje: nedostaje };
    });
  };

  /* ---------- glavni ulaz: svaki događaj na sajtu prolazi ovuda ---------- */
  I.dogadjaj = function (tip, p) {
    p = p || {};
    p.tip = tip; p.vreme = new Date().toISOString(); p.jezik = OF.jezik;
    var izlaz = I.recept(tip, p);
    var zapis = { id: OF.id('D'), tip: tip, vreme: p.vreme, rezim: OF.demo ? 'DEMO' : 'PRAVI', izlaz: izlaz, sazetak: izlaz.sazetak || tip };
    OF.store.dodaj('integracije-dnevnik', zapis, 150);
    OF.emit('integracija', zapis);
    if (OF.demo) return Promise.resolve({ ok: true, demo: true, zapis: zapis });
    // događaji iz panela vlasnika idu na putanju koju štiti Cloudflare Access
    return fetch(api(OF.$('[data-of-panel]') ? '/panel/dogadjaj' : '/dogadjaj'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ tip: tip, podaci: cistiZaServer(p), sajt: OF.sajt })
    }).then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); }).catch(function (e) { console.warn('integracije', e); return { ok: false, greska: String(e) }; });
  };
  function api(put) { return String((OF.c.api && OF.c.api.osnova) || '/api').replace(/\/$/, '') + put; }
  I.api = api;
  function cistiZaServer(p) {
    var kopija = JSON.parse(JSON.stringify(p));
    delete kopija.kartica;                         // podaci kartice NIKAD ne idu kroz naš kod
    if (kopija.upitnik) kopija.upitnik = '[ne šalje se: podaci o zdravlju idu samo u šifrovani sistem klinike]';
    return kopija;
  }

  /* ---------- recepti: šta se šalje kome za koji događaj ---------- */
  var F = function () { return OF.d.firma || {}; };
  I.recepti = {};      // sajt može da doda svoje recepte
  I.recept = function (tip, p) {
    var fn = I.recepti[tip] || I.recepti['*'] || function () { return {}; };
    var r = fn(p) || {};
    // poruke vlasniku (Viber, mejl, kalendar, tabela) uvek na jeziku vlasnika, a mušteriji na jeziku stranice
    var jv = OF.c.jezikVlasnika || 'sr';
    // na serveru su svi jezici učitani; u demo prikazu na stranici drugog jezika prevod vlasnikovog jezika
    // postoji samo ako je učitan ili ako sajt ima svoje tekstove (PODACI.tekstovi), a ključ koji fali
    // uzima se sa jezika stranice (OF.t), da vlasnik nikad ne vidi sirov ključ
    if (OF.jezik !== jv && ((OF.I18N && OF.I18N[jv]) || OF.d.tekstovi)) {
      var stari = OF.jezik; OF.jezik = jv; OF.jezikStrane = stari;
      try { var v = fn(p) || {}; ['sazetak', 'viber', 'mejlVlasniku', 'kalendar', 'tabela', 'ostalo'].forEach(function (k) { if (v[k] !== undefined) r[k] = v[k]; }); }
      catch (e) { console.error(e); } finally { OF.jezik = stari; OF.jezikStrane = null; }
    }
    if (!I.ukljuceno('viber')) delete r.viber;
    if (!I.ukljuceno('mejl')) { delete r.mejlKupcu; delete r.mejlVlasniku; }
    if (!I.ukljuceno('kalendar')) delete r.kalendar;
    if (!I.ukljuceno('sheets')) delete r.tabela;
    if (!I.ukljuceno('sms')) delete r.sms;
    return r;
  };

  /* zajednički delovi poruka */
  I.vreme = function (t) { return OF.datum.dug(t.datum) + ', ' + OF.datum.vreme(t.vreme); };
  I.ics = function (dog) {
    var f = function (dt) { return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
    var esc = function (s) { return String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); };
    var linije = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//opsforma//' + OF.sajt + '//SR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', 'UID:' + dog.uid + '@' + OF.sajt + '.opsforma.rs', 'DTSTAMP:' + f(new Date()),
      'DTSTART:' + f(dog.pocetak), 'DTEND:' + f(dog.kraj), 'SUMMARY:' + esc(dog.naslov), 'LOCATION:' + esc(dog.lokacija),
      'DESCRIPTION:' + esc(dog.opis)];
    if (dog.url) linije.push('URL:' + dog.url);
    linije.push('BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(dog.naslov), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');
    // redovi najviše 75 oktetâ (RFC 5545)
    return linije.map(function (l) { var o = ''; while (l.length > 74) { o += l.slice(0, 74) + '\r\n '; l = l.slice(74); } return o + l; }).join('\r\n') + '\r\n';
  };
  I.googleKalendarLink = function (dog) {
    var f = function (dt) { return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); };
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(dog.naslov) +
      '&dates=' + f(dog.pocetak) + '/' + f(dog.kraj) + '&details=' + encodeURIComponent(dog.opis || '') + '&location=' + encodeURIComponent(dog.lokacija || '');
  };
  I.adresa = function () { var a = F().adresa || {}; return [a.ulica, a.postanski + ' ' + a.grad].filter(Boolean).join(', '); };
  I.apsolutno = function (rel) {
    try { return new URL(rel, w.location.href).href; } catch (e) { return rel; }
  };

  /* ---------- mejl (HTML) u brendu sajta ---------- */
  I.mejl = function (o) {
    var b = OF.d.brend || {}, f = F();
    var red = function (k, v) { return '<tr><td style="padding:8px 0;color:' + (b.mejlSporedno || '#5b6270') + ';font-size:14px;width:38%;vertical-align:top">' + OF.esc(k) + '</td><td style="padding:8px 0;font-size:15px;color:' + (b.mejlTekst || '#1d232c') + ';font-weight:600">' + OF.esc(v) + '</td></tr>'; };
    var dugme = function (d) { return '<a href="' + OF.esc(d.href) + '" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 20px;background:' + (d.sporedno ? 'transparent' : (b.mejlAkcenat || '#2D4866')) + ';color:' + (d.sporedno ? (b.mejlAkcenat || '#2D4866') : (b.mejlAkcenatTekst || '#fff')) + ';border:1px solid ' + (b.mejlAkcenat || '#2D4866') + ';text-decoration:none;font-size:15px;font-weight:600;border-radius:' + (b.mejlRadius || '2px') + '">' + OF.esc(d.tekst) + '</a>'; };
    return '<!doctype html><html lang="' + OF.jezik + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>' + OF.esc(o.naslov) + '</title></head>' +
      '<body style="margin:0;background:' + (b.mejlPozadina || '#f4f1ec') + ';font-family:' + (b.mejlFont || 'Arial,Helvetica,sans-serif') + '">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + (b.mejlPozadina || '#f4f1ec') + ';padding:24px 12px"><tr><td align="center">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:' + (b.mejlKartica || '#ffffff') + ';border-radius:' + (b.mejlRadius || '2px') + '">' +
      '<tr><td style="padding:22px 28px;border-bottom:1px solid ' + (b.mejlLinija || '#e7e1d7') + ';background:' + (b.mejlZaglavlje || '#ffffff') + '">' +
      (o.logo !== false && b.logoMejl ? '<img src="' + OF.esc(I.apsolutno(OF.koren + b.logoMejl)) + '" alt="' + OF.esc(f.ime) + '" height="40" style="display:block;height:40px">' : '<strong style="font-size:20px;color:' + (b.mejlZaglavljeTekst || '#1d232c') + '">' + OF.esc(f.ime) + '</strong>') + '</td></tr>' +
      '<tr><td style="padding:28px">' +
      '<h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:' + (b.mejlTekst || '#1d232c') + ';font-family:' + (b.mejlNaslovFont || 'Georgia,serif') + ';font-weight:400">' + OF.esc(o.naslov) + '</h1>' +
      (o.uvod ? '<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:' + (b.mejlTekst || '#1d232c') + '">' + OF.esc(o.uvod) + '</p>' : '') +
      (o.redovi && o.redovi.length ? '<table role="presentation" width="100%" style="border-top:1px solid ' + (b.mejlLinija || '#e7e1d7') + ';border-bottom:1px solid ' + (b.mejlLinija || '#e7e1d7') + ';margin:0 0 18px">' + o.redovi.map(function (x) { return red(x[0], x[1]); }).join('') + '</table>' : '') +
      (o.html || '') +
      (o.dugmad || []).map(dugme).join('') +
      (o.napomena ? '<p style="margin:18px 0 0;font-size:13px;line-height:1.55;color:' + (b.mejlSporedno || '#5b6270') + '">' + OF.esc(o.napomena) + '</p>' : '') +
      '</td></tr>' +
      '<tr><td style="padding:18px 28px;border-top:1px solid ' + (b.mejlLinija || '#e7e1d7') + ';font-size:12px;line-height:1.6;color:' + (b.mejlSporedno || '#5b6270') + '">' +
      OF.esc(f.ime) + ' · ' + OF.esc(I.adresa()) + '<br>' + OF.esc(f.telefon || '') + ' · ' + OF.esc(f.email || '') +
      (OF.demo ? '<br><em>' + OF.esc(OF.t('demo.mejl_napomena')) + '</em>' : '') +
      '</td></tr></table></td></tr></table></body></html>';
  };

  /* =====================================================================
     PRIKAZ ZA VLASNIKA (samo demo): šta je upravo stiglo na Viber, u kalendar, mejl…
     ===================================================================== */
  var fioka;
  I.prikazi = function (zapis) {
    if (!OF.demo || !zapis || !zapis.izlaz) return;
    var iz = zapis.izlaz, kartice = [];
    if (iz.viber) kartice.push(['viber', 'Viber', prikazViber(iz.viber)]);
    if (iz.kalendar) kartice.push(['kalendar', OF.t('int.kalendar'), prikazKalendar(iz.kalendar)]);
    if (iz.mejlKupcu) kartice.push(['mejl', OF.t('int.mejl_kupcu'), prikazMejl(iz.mejlKupcu)]);
    if (iz.mejlVlasniku) kartice.push(['mejlv', OF.t('int.mejl_vlasniku'), prikazMejlTekst(iz.mejlVlasniku)]);
    if (iz.sms) kartice.push(['sms', 'SMS', prikazSms(iz.sms)]);
    if (iz.tabela) kartice.push(['tabela', 'Google Sheets', prikazTabela(iz.tabela)]);
    if (iz.ostalo) iz.ostalo.forEach(function (o, i) { kartice.push(['o' + i, o.naziv, prikazOstalo(o)]); });
    if (!kartice.length) return;
    if (fioka) fioka.remove();
    var tabs = OF.h('div', { class: 'of-fioka__tabovi', role: 'tablist', 'aria-label': OF.t('int.sta_je_stiglo') });
    var paneli = OF.h('div', { class: 'of-fioka__paneli' });
    kartice.forEach(function (k, i) {
      var tid = 'oft-' + k[0], pid = 'ofp-' + k[0];
      var b = OF.h('button', { type: 'button', role: 'tab', id: tid, 'aria-controls': pid, 'aria-selected': i === 0 ? 'true' : 'false', tabindex: i === 0 ? '0' : '-1', class: 'of-fioka__tab' }, k[1]);
      var p = OF.h('div', { role: 'tabpanel', id: pid, 'aria-labelledby': tid, class: 'of-fioka__panel', hidden: i !== 0 }, k[2]);
      b.addEventListener('click', function () { izaberi(i); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); izaberi((i + (e.key === 'ArrowRight' ? 1 : kartice.length - 1)) % kartice.length, true); }
      });
      tabs.appendChild(b); paneli.appendChild(p);
    });
    function izaberi(n, fokus) {
      OF.$$('[role=tab]', tabs).forEach(function (b, i) { b.setAttribute('aria-selected', i === n ? 'true' : 'false'); b.tabIndex = i === n ? 0 : -1; if (i === n && fokus) b.focus(); });
      OF.$$('[role=tabpanel]', paneli).forEach(function (p, i) { p.hidden = i !== n; });
    }
    var zatvori = OF.h('button', { type: 'button', class: 'of-fioka__x', 'aria-label': OF.t('zatvori'), onclick: function () { fioka.classList.remove('otvorena'); setTimeout(function () { fioka && fioka.remove(); fioka = null; }, 300); } }, OF.h('span', { 'aria-hidden': 'true', html: '&times;' }));
    // fioka ne sme da pokrije stranicu: kreće skupljena (traka dole levo), osim prvi put na širokom ekranu gde ima mesta
    // pored sadržaja; klik bilo gde na stranici je skuplja
    var skupi = function (z) { fioka.classList.toggle('skupljena', z); min.setAttribute('aria-expanded', z ? 'false' : 'true'); min.textContent = z ? OF.t('int.prikazi') : OF.t('int.sakrij'); };
    var min = OF.h('button', { type: 'button', class: 'of-fioka__min', 'aria-expanded': 'true', onclick: function () { skupi(!fioka.classList.contains('skupljena')); } }, OF.t('int.sakrij'));
    var pocetnoSkupljeno = w.innerWidth < 1500 || !!OF.$('[data-of-panel]') || !!OF.store.get('fioka-vidjena', false);
    OF.store.set('fioka-vidjena', true);
    fioka = OF.h('section', { class: 'of-fioka', 'aria-label': OF.t('int.sta_je_stiglo') }, [
      OF.h('div', { class: 'of-fioka__glava' }, [
        OF.h('div', null, [OF.h('p', { class: 'of-fioka__oznaka' }, OF.t('int.demo_oznaka')), OF.h('h2', { class: 'of-fioka__naslov' }, OF.t('int.sta_je_stiglo') + ' (' + kartice.length + ')')]),
        OF.h('div', { class: 'of-fioka__akcije' }, [min, zatvori])
      ]),
      tabs, paneli,
      OF.h('p', { class: 'of-fioka__fus' }, OF.t('int.fus'))
    ]);
    d.body.appendChild(fioka);
    if (pocetnoSkupljeno) skupi(true);
    requestAnimationFrame(function () { fioka.classList.add('otvorena'); });
  };
  d.addEventListener('pointerdown', function (e) {
    if (fioka && !fioka.classList.contains('skupljena') && !fioka.contains(e.target)) { fioka.classList.add('skupljena'); var m = OF.$('.of-fioka__min', fioka); if (m) { m.setAttribute('aria-expanded', 'false'); m.textContent = OF.t('int.prikazi'); } }
  }, true);
  OF.on('integracija', function (z) { if (!z.tiho) setTimeout(function () { I.prikazi(z); }, 350); });

  function vremeSada() { var s = OF.sad(); return OF.datum.uHHMM(s.min); }
  function prikazViber(v) {
    return OF.h('div', { class: 'of-tel' }, [
      OF.h('div', { class: 'of-tel__glava' }, [OF.h('span', { class: 'of-tel__avatar', 'aria-hidden': 'true' }, (F().ime || '?').slice(0, 1)),
        OF.h('div', null, [OF.h('strong', null, v.od || (F().ime + ' · ' + OF.t('int.obavestenja'))), OF.h('span', null, 'Viber · ' + OF.t('int.telefon_vlasnika'))])]),
      OF.h('div', { class: 'of-tel__poruke' }, [OF.h('div', { class: 'of-tel__poruka' }, [OF.h('p', { style: { whiteSpace: 'pre-line' } }, v.tekst), OF.h('time', null, vremeSada())])].concat(
        v.dugmad ? [OF.h('div', { class: 'of-tel__dugmad' }, v.dugmad.map(function (x) { return OF.h('span', null, x); }))] : []))
    ]);
  }
  function prikazKalendar(k) {
    var lista = Array.isArray(k) ? k : [k];
    return OF.h('div', { class: 'of-kal' }, lista.map(function (e) {
      return OF.h('div', { class: 'of-kal__dan' }, [
        OF.h('div', { class: 'of-kal__datum' }, [OF.h('strong', null, OF.datum.format(e.datum, { day: 'numeric' })), OF.h('span', null, OF.datum.format(e.datum, { weekday: 'short', month: 'short' }))]),
        OF.h('div', { class: 'of-kal__mreza' }, [
          OF.h('div', { class: 'of-kal__dogadjaj', style: { borderLeftColor: e.boja || '#2D4866' } }, [
            OF.h('strong', null, e.naslov), OF.h('span', null, OF.datum.vreme(e.od) + ' – ' + OF.datum.vreme(e.do)),
            OF.h('span', null, e.kalendar ? OF.t('int.kalendar_osobe', { ime: e.kalendar }) : ''), e.meet ? OF.h('span', null, 'Google Meet: ' + e.meet) : null,
            e.opis ? OF.h('p', { style: { whiteSpace: 'pre-line' } }, e.opis) : null
          ])
        ])
      ]);
    }));
  }
  function prikazMejl(m) {
    var okvir = OF.h('iframe', { class: 'of-mejl__okvir', title: m.naslov, sandbox: '', loading: 'lazy' });
    okvir.srcdoc = m.html;
    return OF.h('div', { class: 'of-mejl' }, [
      OF.h('dl', { class: 'of-mejl__glava' }, [OF.h('dt', null, OF.t('int.za')), OF.h('dd', null, m.za || ''), OF.h('dt', null, OF.t('int.naslov')), OF.h('dd', null, m.naslov)]),
      m.prilozi && m.prilozi.length ? OF.h('p', { class: 'of-mejl__prilozi' }, OF.t('int.prilozi') + ': ' + m.prilozi.join(', ')) : null,
      okvir
    ]);
  }
  function prikazMejlTekst(m) {
    return OF.h('div', { class: 'of-mejl' }, [
      OF.h('dl', { class: 'of-mejl__glava' }, [OF.h('dt', null, OF.t('int.za')), OF.h('dd', null, m.za || ''), OF.h('dt', null, OF.t('int.naslov')), OF.h('dd', null, m.naslov)]),
      OF.h('pre', { class: 'of-mejl__tekst' }, m.tekst)
    ]);
  }
  function prikazSms(lista) {
    lista = Array.isArray(lista) ? lista : [lista];
    return OF.h('div', { class: 'of-tel of-tel--sms' }, [
      OF.h('div', { class: 'of-tel__glava' }, [OF.h('span', { class: 'of-tel__avatar', 'aria-hidden': 'true' }, 'SMS'), OF.h('div', null, [OF.h('strong', null, (OF.c.integracije.sms && OF.c.integracije.sms.posiljalac) || F().ime), OF.h('span', null, OF.t('int.telefon_kupca'))])]),
      OF.h('div', { class: 'of-tel__poruke' }, lista.map(function (s) { return OF.h('div', { class: 'of-tel__poruka' }, [OF.h('p', null, s.tekst), OF.h('time', null, s.kada || vremeSada())]); }))
    ]);
  }
  function prikazTabela(t) {
    return OF.h('div', { class: 'of-tabela' }, [
      OF.h('p', { class: 'of-tabela__ime' }, t.list + ' · ' + OF.t('int.novi_red')),
      OF.h('div', { class: 'of-tabela__okvir' }, OF.h('table', null, [
        OF.h('thead', null, OF.h('tr', null, t.kolone.map(function (k) { return OF.h('th', { scope: 'col' }, k); }))),
        OF.h('tbody', null, OF.h('tr', null, t.red.map(function (v) { return OF.h('td', null, String(v)); })))
      ]))
    ]);
  }
  function prikazOstalo(o) {
    return OF.h('div', { class: 'of-ostalo' }, [o.html ? OF.h('div', { html: o.html }) : OF.h('pre', { class: 'of-mejl__tekst' }, o.tekst)]);
  }

  /* ---------- Turnstile (zaštita formi): u demo režimu simulacija ---------- */
  I.turnstile = function (forma) {
    var c = cfg('turnstile');
    var mesto = OF.$('.of-turnstile', forma);
    if (!mesto) { mesto = OF.h('div', { class: 'of-turnstile' }); var dugme = OF.$('[type=submit]', forma); dugme ? dugme.parentNode.insertBefore(mesto, dugme) : forma.appendChild(mesto); }
    if (OF.demo || !c.siteKey) {
      mesto.innerHTML = '';
      mesto.appendChild(OF.h('p', { class: 'of-turnstile__demo' }, OF.t('turnstile.demo')));
      return function () { return Promise.resolve('demo'); };
    }
    if (!w.turnstile) { var s = d.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'; s.async = true; s.defer = true; d.head.appendChild(s); }
    var id = null;
    var render = function () { if (w.turnstile) id = w.turnstile.render(mesto, { sitekey: c.siteKey, language: OF.jezik }); else setTimeout(render, 300); };
    render();
    return function () { return Promise.resolve(w.turnstile ? w.turnstile.getResponse(id) : ''); };
  };

  /* ---------- obične forme (kontakt, upit) ---------- */
  I.posaljiFormu = function (tip, podaci, token) {
    if (OF.demo) return I.dogadjaj(tip, podaci);
    podaci.turnstile = token;
    return I.dogadjaj(tip, podaci).then(function (r) { if (!r || !r.ok) throw new Error((r && r.poruka) || 'server'); return r; });
  };

  /* ---------- newsletter ---------- */
  I.newsletter = function (email) {
    var p = { email: email, potvrda: OF.token() };
    OF.store.dodaj('newsletter', { email: email, vreme: new Date().toISOString(), potvrdjeno: false, potvrda: p.potvrda }, 200);
    // pravi režim: server pravi svoj ključ za potvrdu i šalje ga samo na mejl (ovaj iz pregledača se ne koristi)
    return I.dogadjaj('newsletter.prijava', p).then(function (r) { if (!OF.demo && (!r || !r.ok)) throw new Error((r && r.poruka) || 'server'); return r; });
  };
})(window, document);
