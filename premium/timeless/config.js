/* =====================================================================
   TIMELESS · podešavanja sajta
   rezim: 'DEMO'  → sve integracije su simulirane, ništa se ne šalje, nema ključeva,
                    plaćanje karticom i IPS su jasno označena simulacija.
          'PRAVI' → kasa šalje porudžbinu na /api (Cloudflare Worker). Server sam računa cene,
                    zalihe, popust i dostavu, šalje kupca na stranicu banke (kartica) ili procesora (IPS),
                    a potom mejl, Viber, tabelu i SMS. Pristupni ključevi su SAMO na serveru
                    (Cloudflare → Settings → Variables and Secrets), nikad u ovom fajlu.
   Ovde idu samo javni podaci (ID-jevi koji se ionako vide u pregledaču). Vidi INTEGRACIJE.md.
   ===================================================================== */
window.CONFIG = {
  rezim: 'DEMO',                       // 'DEMO' ili 'PRAVI'
  jezikVlasnika: 'sr',                 // jezik poruka vlasniku (Viber, mejl, tabela)
  api: { osnova: '/premium/timeless/api' },   // adresa servera na istom domenu; vidi api/README.md
  panel: { demoPin: '1234' },          // samo za DEMO; pravi panel štiti Cloudflare Access (prijava mejlom)
  bezSW: false,                        // true = isključi rad bez interneta (service worker)
  integracije: {
    placanje:   { ukljuceno: true, procesor: 'nestpay' },     // 'nestpay' (Intesa, AIK, NLB…), 'allsecure' ili 'wspay'; ključevi samo na serveru
    ips:        { ukljuceno: true },                          // IPS preko procesora koji ga nudi (npr. WSPay); uplatnica sa QR kodom radi i bez njega
    viber:      { ukljuceno: true, brojVlasnika: '', zajednicaLink: '' },
    whatsapp:   { ukljuceno: true, broj: '381600002002' },
    mejl:       { ukljuceno: true, servis: 'brevo', posiljalac: '', vlasnik: '' },
    sheets:     { ukljuceno: true, tabelaId: '', cenovnikUzivo: false },
    mape:       { ukljuceno: true },
    recenzije:  { ukljuceno: true, placeId: '' },
    instagram:  { ukljuceno: true, nalog: '' },
    sms:        { ukljuceno: true, posiljalac: 'Timeless' },
    newsletter: { ukljuceno: true, listaId: '' },
    analitika:  { ukljuceno: true, ga4: '', gtm: '', metaPixel: '' },
    turnstile:  { ukljuceno: true, siteKey: '' },
    kurir:      { ukljuceno: true, servis: '' },              // npr. 'dexpress'; ključ samo na serveru
    fiskal:     { ukljuceno: true, servis: '' },              // ESIR servis za fiskalni račun; ključ samo na serveru
    asistent:   { ukljuceno: true, ai: false }                // ai: true = odgovori AI-ja preko servera (ključ samo na serveru)
  }
};
