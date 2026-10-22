/* =====================================================================
   KAMEA · podešavanja sajta
   rezim: 'DEMO'  → sve integracije su simulirane, ništa se ne šalje, nema ključeva.
          'PRAVI' → sajt šalje događaje na /api (Cloudflare Worker), a server šalje Viber, mejl,
                    upis u kalendar i tabelu, SMS. Pristupni ključevi su SAMO na serveru
                    (Cloudflare → Settings → Variables and Secrets), nikad u ovom fajlu.
   Ovde idu samo javni podaci (ID-jevi koji se ionako vide u pregledaču). Vidi INTEGRACIJE.md.
   ===================================================================== */
window.CONFIG = {
  rezim: 'DEMO',                       // 'DEMO' ili 'PRAVI'
  jezikVlasnika: 'sr',                 // jezik poruka vlasniku (Viber, mejl, kalendar, tabela)
  api: { osnova: '/premium/kamea/api' },   // adresa servera (Cloudflare Worker) na istom domenu; vidi api/README.md
  panel: { demoPin: '1234' },          // samo za DEMO; pravi panel štiti Cloudflare Access (prijava mejlom)
  bezSW: false,                        // true = isključi rad bez interneta (service worker)
  integracije: {
    viber:      { ukljuceno: true, brojVlasnika: '', zajednicaLink: '' },
    whatsapp:   { ukljuceno: true, broj: '381600001001' },
    mejl:       { ukljuceno: true, servis: 'brevo', posiljalac: '', vlasnik: '' },
    kalendar:   { ukljuceno: true, kalendari: {} },          // { 'mila-ristic': 'id-kalendara@group.calendar.google.com', ... }
    sheets:     { ukljuceno: true, tabelaId: '', cenovnikUzivo: false },
    mape:       { ukljuceno: true },
    recenzije:  { ukljuceno: true, placeId: '' },
    instagram:  { ukljuceno: true, nalog: '' },
    sms:        { ukljuceno: true, posiljalac: 'Kamea' },
    newsletter: { ukljuceno: true, listaId: '' },
    analitika:  { ukljuceno: true, ga4: '', gtm: '', metaPixel: '' },
    turnstile:  { ukljuceno: true, siteKey: '' },
    meet:       { ukljuceno: true, kalendarNalog: '' },
    upitnik:    { ukljuceno: true, javniKljuc: '', skladiste: '' }
  }
};
