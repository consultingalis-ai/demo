/* =====================================================================
   SLOJ · podešavanja sajta
   rezim: 'DEMO'  → sve integracije su simulirane, ništa se ne šalje, nema ključeva,
                    depozit, kupovina, članarina i IPS su jasno označena simulacija.
          'PRAVI' → zakazivanje, kasa i članstvo šalju podatke na /api (Cloudflare Worker). Server sam računa
                    cene, depozit, zalihe, popust i dostavu, šalje kupca na stranicu banke (kartica) ili procesora,
                    a potom mejl, Viber, kalendar, tabelu i SMS. Pristupni ključevi su SAMO na serveru
                    (Cloudflare → Settings → Variables and Secrets), nikad u ovom fajlu.
   Ovde idu samo javni podaci (ID-jevi koji se ionako vide u pregledaču). Vidi INTEGRACIJE.md.
   ===================================================================== */
window.CONFIG = {
  rezim: 'DEMO',                       // 'DEMO' ili 'PRAVI'
  jezikVlasnika: 'sr',                 // jezik poruka vlasniku (Viber, mejl, tabela)
  api: { osnova: '/premium/sloj/api' },      // adresa servera na istom domenu; vidi api/README.md
  panel: { demoPin: '1234' },          // samo za DEMO; pravi panel štiti Cloudflare Access (prijava mejlom)
  bezSW: false,                        // true = isključi rad bez interneta (service worker)
  integracije: {
    placanje:   { ukljuceno: true, procesor: 'allsecure', ponavljanje: true },   // 'allsecure', 'nestpay' ili 'wspay'; ponavljanje = automatska mesečna naplata članarine (mora je odobriti banka); ključevi samo na serveru
    ips:        { ukljuceno: true },                          // IPS preko procesora koji ga nudi; uplatnica sa QR kodom radi i bez njega
    viber:      { ukljuceno: true, brojVlasnika: '', zajednicaLink: '' },
    whatsapp:   { ukljuceno: true, broj: '381600001003' },
    mejl:       { ukljuceno: true, servis: 'brevo', posiljalac: '', vlasnik: '' },
    kalendar:   { ukljuceno: true, kalendarId: '' },          // Google Kalendar studija: svako vozilo kao događaj
    sheets:     { ukljuceno: true, tabelaId: '', cenovnikUzivo: false },
    mape:       { ukljuceno: true },
    recenzije:  { ukljuceno: true, placeId: '' },
    instagram:  { ukljuceno: true, nalog: '' },
    sms:        { ukljuceno: true, posiljalac: 'Sloj' },      // Infobip: link za praćenje, „gotovo“, podsetnik za pregled
    newsletter: { ukljuceno: true, listaId: '' },
    analitika:  { ukljuceno: true, ga4: '', gtm: '', metaPixel: '' },
    turnstile:  { ukljuceno: true, siteKey: '' },
    kurir:      { ukljuceno: true, servis: 'dexpress' },      // 'dexpress', 'postexpress' ili 'bex'; ključ samo na serveru
    fiskal:     { ukljuceno: true, servis: '' },              // ESIR servis za fiskalni račun; ključ samo na serveru
    fotografije: { ukljuceno: true },                         // fotografije iz praćenja: Cloudflare R2 (vlasnik ih šalje telefonom iz panela)
    asistent:   { ukljuceno: true, ai: false }                // ai: true = odgovori AI-ja preko servera (ključ samo na serveru)
  }
};
