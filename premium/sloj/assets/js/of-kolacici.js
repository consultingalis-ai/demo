/* opsforma Premium · pristanak na kolačiće i analitika
   GA4, Google Tag Manager i Meta Pixel se učitavaju TEK posle pristanka, po kategorijama.
   DEMO: skripte se ne učitavaju; u dnevnik se upisuje šta bi se učitalo. */
(function (w, d) {
  'use strict';
  var OF = w.OF, A = OF.analitika = {}, VERZIJA = 1;
  var cfg = function () { return (OF.c.integracije || {}).analitika || {}; };
  var ucitano = {};

  A.izbor = function () { var x = OF.store.get('kolacici', null); return x && x.v === VERZIJA ? x : null; };
  A.sacuvaj = function (analitika, marketing) {
    var x = { v: VERZIJA, analitika: !!analitika, marketing: !!marketing, vreme: new Date().toISOString() };
    OF.store.set('kolacici', x); primeni(x); OF.emit('kolacici', x); return x;
  };

  function primeni(x) {
    if (!x) return;
    var c = cfg();
    if (x.analitika) { if (c.gtm) ucitajGTM(c.gtm); if (c.ga4) ucitajGA4(c.ga4); }
    if (x.marketing && c.metaPixel) ucitajPixel(c.metaPixel);
    if (w.gtag) w.gtag('consent', 'update', { analytics_storage: x.analitika ? 'granted' : 'denied', ad_storage: x.marketing ? 'granted' : 'denied', ad_user_data: x.marketing ? 'granted' : 'denied', ad_personalization: x.marketing ? 'granted' : 'denied' });
  }
  function demoZapis(sta) {
    if (ucitano[sta]) return; ucitano[sta] = true;
    OF.int.dogadjaj('analitika.ucitano', { sta: sta, tiho: true });
  }
  function ucitajSkriptu(src) { var s = d.createElement('script'); s.async = true; s.src = src; d.head.appendChild(s); }
  function ucitajGA4(id) {
    if (OF.demo) return demoZapis('GA4 ' + id);
    if (ucitano.ga4) return; ucitano.ga4 = true;
    w.dataLayer = w.dataLayer || []; w.gtag = function () { w.dataLayer.push(arguments); };
    w.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    w.gtag('js', new Date()); w.gtag('config', id, { anonymize_ip: true });
    ucitajSkriptu('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id));
  }
  function ucitajGTM(id) {
    if (OF.demo) return demoZapis('Google Tag Manager ' + id);
    if (ucitano.gtm) return; ucitano.gtm = true;
    w.dataLayer = w.dataLayer || []; w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    ucitajSkriptu('https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(id));
  }
  function ucitajPixel(id) {
    if (OF.demo) return demoZapis('Meta Pixel ' + id);
    if (ucitano.pixel) return; ucitano.pixel = true;
    /* zvanični Meta isečak, bez <noscript> slike */
    var n = w.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!w._fbq) w._fbq = n; n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    ucitajSkriptu('https://connect.facebook.net/en_US/fbevents.js');
    w.fbq('init', id); w.fbq('track', 'PageView');
  }

  /* događaji: zakazivanje, kupovina, prijava na newsletter */
  A.dogadjaj = function (ime, p) {
    var x = A.izbor(); if (!x) return;
    if (x.analitika && w.gtag) w.gtag('event', ime, p || {});
    if (x.analitika && w.dataLayer && !w.gtag) w.dataLayer.push(Object.assign({ event: ime }, p || {}));
    var meta = { generate_lead: 'Lead', purchase: 'Purchase', schedule: 'Schedule', sign_up: 'CompleteRegistration' }[ime];
    if (x.marketing && w.fbq && meta) w.fbq('track', meta, p && p.value ? { value: p.value, currency: 'RSD' } : {});
  };
  OF.on('zak.potvrdjeno', function (t) { A.dogadjaj('schedule', { value: t.depozit || 0, currency: 'RSD' }); });
  OF.on('integracija', function (z) {
    // prodavnica šalje kupovinu sa stavkama sama (of-prodavnica.js), pa se ovde preskače
    if (z.tip === 'porudzbina.nova' && !OF.prod) { var p = OF.store.get('porudzbine', [])[0]; A.dogadjaj('purchase', { value: p ? p.ukupno : 0, currency: 'RSD', transaction_id: p ? p.id : '' }); }
    if (z.tip === 'newsletter.prijava') A.dogadjaj('sign_up', {});
    if (z.tip === 'kontakt.poruka') A.dogadjaj('generate_lead', {});
  });

  /* ---------- baner ---------- */
  var baner = null;
  A.baner = function (podesavanja) {
    if (baner) baner.remove();
    var x = A.izbor() || { analitika: false, marketing: false };
    var c = cfg();
    var prekidac = function (ime, naslov, opis, ukljuceno, zakljucano) {
      var id = 'kol-' + ime;
      return OF.h('div', { class: 'of-kolacici__kat' }, [
        OF.h('div', null, [OF.h('label', { for: id, class: 'of-kolacici__kat-naslov' }, naslov), OF.h('p', { id: id + '-o' }, opis)]),
        OF.h('input', { type: 'checkbox', role: 'switch', id: id, name: ime, checked: ukljuceno, disabled: zakljucano ? true : null, 'aria-describedby': id + '-o', class: 'of-prekidac' })
      ]);
    };
    var detalji = OF.h('div', { class: 'of-kolacici__detalji', hidden: !podesavanja }, [
      prekidac('neophodni', OF.t('kol.neophodni'), OF.t('kol.neophodni_opis'), true, true),
      prekidac('analitika', OF.t('kol.analitika'), OF.t('kol.analitika_opis', { alati: [c.ga4 ? 'Google Analytics 4' : 'Google Analytics 4', 'Google Tag Manager'].join(', ') }), x.analitika),
      prekidac('marketing', OF.t('kol.marketing'), OF.t('kol.marketing_opis'), x.marketing)
    ]);
    var sacuvajIzbor = OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', hidden: !podesavanja, onclick: function () {
      zatvori(A.sacuvaj(OF.$('#kol-analitika', baner).checked, OF.$('#kol-marketing', baner).checked));
    } }, OF.t('kol.sacuvaj_izbor'));
    var dugmePodesavanja = OF.h('button', { type: 'button', class: 'of-dugme of-dugme--tekst', 'aria-expanded': podesavanja ? 'true' : 'false', hidden: !!podesavanja, onclick: function () {
      detalji.hidden = false; sacuvajIzbor.hidden = false; dugmePodesavanja.hidden = true; OF.$('#kol-analitika', baner).focus();
    } }, OF.t('kol.podesavanja'));
    baner = OF.h('section', { class: 'of-kolacici', role: 'region', 'aria-label': OF.t('kol.naslov'), tabindex: '-1' }, [
      OF.h('h2', { class: 'of-kolacici__naslov' }, OF.t('kol.naslov')),
      OF.h('p', null, [OF.t('kol.tekst') + ' ', OF.h('a', { href: OF.link('kolacici') }, OF.t('kol.vise'))]),
      detalji,
      OF.h('div', { class: 'of-kolacici__dugmad' }, [
        dugmePodesavanja, sacuvajIzbor,
        OF.h('button', { type: 'button', class: 'of-dugme of-dugme--sporedno', onclick: function () { zatvori(A.sacuvaj(false, false)); } }, OF.t('kol.samo_neophodni')),
        OF.h('button', { type: 'button', class: 'of-dugme of-dugme--glavno', onclick: function () { zatvori(A.sacuvaj(true, true)); } }, OF.t('kol.prihvati_sve'))
      ])
    ]);
    // Escape: zatvara podešavanja (izbor ostaje kakav je bio); pri prvom izboru samo skuplja detalje
    baner.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (A.izbor()) { e.preventDefault(); var b = baner; baner = null; b.remove(); return; }
      if (!detalji.hidden) { e.preventDefault(); detalji.hidden = true; sacuvajIzbor.hidden = true; dugmePodesavanja.hidden = false; dugmePodesavanja.focus(); }
    });
    d.body.appendChild(baner);
    if (podesavanja) baner.focus();
    function zatvori(x) {
      baner.classList.add('izlaz'); var b = baner; baner = null; setTimeout(function () { b.remove(); }, 250);
      OF.obavesti(x.analitika || x.marketing ? OF.t('kol.sacuvano') : OF.t('kol.samo_neophodni_ok'));
    }
  };

  OF.spremno(function () {
    var x = A.izbor();
    var panel = !!OF.$('[data-of-panel]');   // panel vlasnika: bez trake, analitika se tu ne učitava
    if (x) { if (!panel) primeni(x); } else if (!panel) setTimeout(function () { if (!A.izbor()) A.baner(false); }, 900);   // posle prvog prikaza, da ne smeta učitavanju
    OF.$$('[data-of-kolacici]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); A.baner(true); }); });
  });
})(window, document);
