/* TIMELESS · ponašanje specifično za ovaj sajt
   Meni nakita i pretraga u zaglavlju, poklon vaučer, pregled gravure, alat za veličinu prstena,
   traka „dodaj u korpu“ na telefonu i namere pomoćnika za prodavnicu (poklon po budžetu, veličine, status porudžbine).
   Učitava se i na serveru (recepti), zato sve što dira stranicu ide kroz OF.spremno. */
(function (w, d) {
  'use strict';
  var OF = w.OF, PR = OF.prod;
  var en = function () { return OF.jezik === 'en'; };
  /* veličine prstenja iz kataloga (sve kategorije sa prstenjem) */
  var velicinePrstena = function (kat) {
    var v = [];
    (PR ? PR.sve() : []).forEach(function (p) { if (kat && p.kategorija !== kat) return; (p.ose || []).forEach(function (o) { if (o.id === 'velicina') o.opcije.forEach(function (x) { if (/^\d+$/.test(x.id)) v.push(+x.id); }); }); });
    return v.length ? { min: Math.min.apply(null, v), max: Math.max.apply(null, v) } : { min: 50, max: 68 };
  };

  /* =====================================================================
     POMOĆNIK: namere prodavnice (odgovori iz kataloga, bez izmišljanja)
     ===================================================================== */
  if (OF.pomocnik && PR) {
    var PM = OF.pomocnik;
    var REC = {
      poklon: ['poklon', 'poklona', 'poklonim', 'pokloniti', 'rodjendan', 'rodendan', 'godisnjica', 'vencanje', 'gift', 'present', 'birthday', 'anniversary', 'wedding'],
      ona: ['mama', 'mami', 'mame', 'majka', 'majci', 'majke', 'devojka', 'devojci', 'devojke', 'zena', 'zeni', 'zene', 'supruga', 'supruzi', 'supruge', 'sestra', 'sestri', 'sestre', 'drugarica', 'drugarici', 'baka', 'baki', 'bake', 'cerka', 'cerki', 'cerke', 'kuma', 'kumi', 'kume', 'nju', 'her', 'mum', 'mom', 'mother', 'girlfriend', 'wife', 'sister', 'daughter', 'grandma'],
      on: ['muz', 'muzu', 'muza', 'decko', 'decku', 'decka', 'tata', 'tati', 'tate', 'otac', 'ocu', 'oca', 'brat', 'bratu', 'brata', 'sin', 'sinu', 'sina', 'kum', 'kumu', 'kuma', 'muski', 'musko', 'muskarac', 'muskarca', 'njega', 'him', 'husband', 'boyfriend', 'dad', 'father', 'brother', 'men', 'mens', 'man'],
      velicina: ['velicina', 'velicinu', 'velicine', 'izmerim', 'izmeriti', 'meri', 'obim', 'precnik', 'size', 'sizes', 'measure', 'fit'],
      // status: jasne reči posle kupovine (sama „porudžbina“ nije dovoljna: „izrada po porudžbini“, „ako poručim danas“)
      statusJak: ['pratim', 'pracenje', 'status', 'tracking', 'track', 'shipped', 'my order', 'kasni', 'nije stiglo', 'nije stigla', 'nije stigao'],
      gde: ['gde', 'where'],
      promena: ['promenim', 'promeniti', 'izmenim', 'izmeniti', 'promena', 'change', 'update'],
      adresa: ['adresu', 'adresa', 'adrese', 'address'],
      izrada: ['po porudzbini', 'izrada', 'izradu', 'izrade', 'izradjujete', 'made to order', 'to order'],
      status: ['porudzbina', 'porudzbinu', 'porudzbine', 'porucio', 'porucila', 'posiljka', 'posiljku', 'pratim', 'pracenje', 'order', 'parcel', 'tracking', 'track', 'shipped'],
      dostava: ['dostava', 'dostavu', 'dostave', 'postarina', 'kurir', 'slanje', 'saljete', 'stize', 'stici', 'stigne', 'paket', 'paketa', 'arrive', 'arrives', 'isporuka', 'delivery', 'shipping', 'courier', 'deliver'],
      gravura: ['gravura', 'gravuru', 'gravirati', 'graviranje', 'ugravirati', 'natpis', 'inicijali', 'engrave', 'engraving', 'initials'],
      nega: ['nega', 'negu', 'ocistiti', 'ciscenje', 'cisti', 'cistim', 'cistiti', 'ocistim', 'sjaj', 'sija', 'potamneo', 'potamni', 'crni', 'oksidira', 'care', 'clean', 'tarnish', 'tarnished', 'polish'],
      povracaj: ['vratiti', 'vracanje', 'povracaj', 'odustanak', 'zamena', 'zameniti', 'reklamacija', 'return', 'refund', 'exchange', 'complaint'],
      vaucer: ['vaucer', 'vaucera', 'poklon kartica', 'voucher', 'gift card', 'giftcard'],
      inostranstvo: ['inostranstvo', 'inostranstva', 'inostranstvu', 'nemacka', 'nemacku', 'austrija', 'austriju', 'svajcarska', 'svajcarsku', 'hrvatska', 'hrvatsku', 'bosna', 'bosnu', 'crna gora', 'crnu goru', 'slovenija', 'sloveniju', 'van srbije', 'abroad', 'international', 'germany', 'austria', 'switzerland', 'croatia', 'outside serbia', 'worldwide'],
      // pitanja o usluzi, ne o izboru nakita: odgovaraju teme pomoćnika (prepravka, popravka, alergija, voda, rate…)
      usluga: ['popravka', 'popraviti', 'popravljate', 'prepravka', 'prepraviti', 'prepravljate', 'smanjiti', 'povecati', 'alergija', 'alergican', 'osetljiva', 'nikl', 'tus', 'tusem', 'tusiranje', 'kupanje', 'plivanje', 'bazen', 'voda', 'teretana', 'probati', 'probam', 'isprobati', 'na rate', 'bodovi', 'po meri', 'unikat', 'na veliko', 'veleprodaja', 'stari nakit', 'repair', 'wholesale', 'bulk', 'old jewellery', 'resize', 'allergy', 'allergic', 'nickel', 'shower', 'swim', 'swimming', 'water', 'try on', 'installments', 'custom'],
      popularno: ['najprodavaniji', 'najprodavanije', 'najpopularniji', 'najtrazeniji', 'omiljeni', 'bestseller', 'popular', 'most popular', 'best selling'],
      jeftino: ['jeftin', 'jeftino', 'jeftiniji', 'povoljno', 'cheap', 'cheaper', 'affordable', 'budget']
    };
    var VRSTE = { prstenje: ['prsten', 'prstenje', 'prstena', 'ring', 'rings'], ogrlice: ['ogrlica', 'ogrlicu', 'lancic', 'lancica', 'privezak', 'necklace', 'pendant', 'chain'], narukvice: ['narukvica', 'narukvicu', 'bracelet', 'bangle', 'cuff'], mindjuse: ['mindjuse', 'mindjusa', 'mindjusice', 'earring', 'earrings', 'studs', 'hoops'], setovi: ['set', 'komplet', 'sets'] };
    var KAMEN = { cirkon: ['cirkon', 'cirkonom', 'cirkonima', 'sjaj', 'zircon', 'zirconia', 'sparkle'], oniks: ['oniks', 'onyx'], biser: ['biser', 'biserom', 'pearl', 'pearls'], tirkiz: ['tirkiz', 'turquoise'], sedef: ['sedef', 'mother'], plavi: ['plavi', 'plavim', 'safir', 'blue', 'sapphire'], zeleni: ['zeleni', 'zelenim', 'smaragd', 'green', 'emerald'] };
    var KAMENJE = function () { return { cirkon: { naziv: { sr: 'cirkon', en: 'cubic zirconia' } }, oniks: { naziv: { sr: 'oniks', en: 'onyx' } }, biser: { naziv: { sr: 'biser', en: 'pearls' } }, tirkiz: { naziv: { sr: 'tirkiz', en: 'turquoise' } }, sedef: { naziv: { sr: 'sedef', en: 'mother-of-pearl' } }, plavi: { naziv: { sr: 'plavi kristal', en: 'blue crystal' } }, zeleni: { naziv: { sr: 'zeleni kristal', en: 'green crystal' } } }; };
    var budzet = function (t) {
      var x = OF.bezKvacica(t).replace(/(\d)[.,](\d{3})/g, '$1$2').replace(/\d+([.,]\d+)?\s*(cm|mm|gr?\b|grama?|gram|kom\w*|karat\w*|kt\b|%)/g, ' '), m;   // 45 cm, 2 g, 18 karata nisu budžet
      var broj = function (n, jed) { n = +n; return jed || n < 100 ? n * 1000 : n; };
      if ((m = /(\d{1,6})\s*(hiljad\w*|k\b)?\s*(?:-|do|to|–)\s*(\d{1,6})\s*(hiljad\w*|k\b)?/.exec(x))) return { min: broj(m[1], m[2] || m[4]), max: broj(m[3], m[4]) };
      if ((m = /(?:do|ispod|manje od|under|below|up to|max|maks|budzet|budget)\s*(\d{1,6})\s*(hiljad\w*|k\b)?/.exec(x))) return { max: broj(m[1], m[2]) };
      if ((m = /(?:od|preko|vise od|over|above|from)\s*(\d{1,6})\s*(hiljad\w*|k\b)?/.exec(x))) return { min: broj(m[1], m[2]) };
      if ((m = /(\d{1,6})\s*(hiljad\w*|k\b|din\w*|rsd)/.exec(x))) return { max: broj(m[1], /hiljad|^k/.test(m[2]) ? m[2] : null) };
      return null;
    };
    var kartice = function (lista) {
      return lista.map(function (p) { return { href: PR.link(p), slika: PR.slika(p) ? OF.koren + PR.slika(p) : null, naziv: OF.tx(p.naziv), opis: OF.din(OF.cene.za(p.id, p.cena)) + ' · ' + OF.tx((PR.kategorija(p.kategorija) || {}).jednina || (PR.kategorija(p.kategorija) || {}).naziv) }; });
    };
    PM.karticeZa = function (ids) { return kartice(ids.map(PR.proizvod).filter(Boolean)); };   // predlozi AI pomoćnika (pravi režim)
    var dostupni = function () { return PR.sve().filter(function (p) { return OF.zalihe.ukupno(p) > 0 || p.poPorudzbini; }); };
    PM.namere = (PM.namere || []).concat([
      /* poklon po budžetu, kome je namenjen, vrsti i kamenu; ili pretraga nakita po opisu */
      function (r, pitanje, a) {
        var b = budzet(pitanje), vrsta = null, kamen = null, za = null;
        Object.keys(VRSTE).forEach(function (k) { if (a.sadrzi(r, VRSTE[k])) vrsta = k; });
        Object.keys(KAMEN).forEach(function (k) { if (a.sadrzi(r, KAMEN[k])) kamen = k; });
        if (a.sadrzi(r, REC.on)) za = 'on'; else if (a.sadrzi(r, REC.ona)) za = 'ona';
        if (/\bna veliko\b|veleprodaj|wholesale|\bbulk\b/.test(PM.norm(pitanje))) return null;   // veleprodaja: tema „po meri“
        var poklon = a.sadrzi(r, REC.poklon), jeftino = a.sadrzi(r, REC.jeftino), popularno = a.sadrzi(r, REC.popularno);
        if (!b && !vrsta && !kamen && !poklon && !za && !jeftino && !popularno) return null;
        if (a.sadrzi(r, REC.velicina) || a.sadrzi(r, REC.status) || a.sadrzi(r, REC.vaucer) || a.sadrzi(r, REC.povracaj) || a.sadrzi(r, REC.nega) || a.sadrzi(r, REC.dostava) || a.sadrzi(r, REC.inostranstvo) || a.sadrzi(r, REC.usluga)) return null;
        var gravura = a.sadrzi(r, REC.gravura);
        if (gravura && !b && !vrsta && !poklon && !za) return null;   // pitanje o gravuri: odgovara namera „gravura“
        var odgovara = function (p) {
          var c = OF.cene.za(p.id, p.cena);
          if (b && b.max && c > b.max) return false; if (b && b.min && c < b.min) return false;
          if (vrsta && p.kategorija !== vrsta) return false;
          if (kamen && p.kamen !== kamen) return false;
          if (gravura && !p.gravura) return false;
          if (za && PR.zaKoga(p).indexOf(za) < 0) return false;
          return true;
        };
        var lista = dostupni().filter(odgovara), naListi = PR.sve().filter(odgovara).length;   // lista na sajtu prikazuje i rasprodato
        if (popularno) { var naj = lista.filter(function (p) { return (p.oznake || []).indexOf('najprodavanije') >= 0; }); if (naj.length >= 2) lista = naj; }
        if (jeftino && !b) lista.sort(function (x, y) { return x.cena - y.cena; });
        else if (za === 'on') lista.sort(function (x, y) { return (y.kategorija === 'muski-nakit') - (x.kategorija === 'muski-nakit') || x.cena - y.cena; });
        else lista.sort(function (x, y) { return ((y.oznake || []).indexOf('najprodavanije') >= 0) - ((x.oznake || []).indexOf('najprodavanije') >= 0) || x.cena - y.cena; });
        var opis = [vrsta ? OF.tx(PR.kategorija(vrsta).naziv).toLowerCase() : (en() ? 'jewellery' : 'nakit'), kamen ? (en() ? 'with ' : 'sa kamenom: ') + OF.tx((KAMENJE()[kamen] || {}).naziv || kamen).toLowerCase() : '', b && b.max ? (en() ? 'up to ' : 'do ') + OF.din(b.max) : '', b && b.min ? (en() ? 'from ' : 'od ') + OF.din(b.min) : '', gravura ? (en() ? 'that can be engraved' : 'sa gravurom') : ''].filter(Boolean).join(' ');
        var upit = []; if (vrsta) upit.push('kategorija=' + vrsta); if (kamen) upit.push('kamen=' + kamen); if (b && b.max) upit.push('max=' + b.max); if (b && b.min) upit.push('min=' + b.min); if (za) upit.push('za=' + za); if (gravura) upit.push('gravura=da');
        if (!lista.length) return { s: 3.2, a: { tekst: en() ? 'There’s nothing in stock right now for ' + opis + '. A gift card lets them choose for themselves, or we can make something to order: message us.' : 'Trenutno nemamo na stanju ' + opis + '. Poklon vaučer im daje da sami izaberu, a možemo i da izradimo po porudžbini: pišite nam.',
          akcije: [{ tekst: OF.t('k.vaucer'), href: OF.link('poklon-vaucer') }, { tekst: 'Viber', href: OF.viber(), spolja: true }] } };
        return { s: 3.1, a: { tekst: (poklon || za ? (en() ? 'Gift ideas, ' : 'Predlozi za poklon, ') : popularno ? (en() ? 'Our bestsellers, ' : 'Najprodavanije, ') : (en() ? 'From the shop, ' : 'Iz ponude, ')) + opis + (en() ? ' (in stock):' : ' (na stanju):') + (poklon || za ? (en() ? '\nGift wrapping with a card is 300 RSD; we can send it straight to them.' : '\nPoklon pakovanje sa čestitkom je 300 din, a možemo da pošaljemo direktno na njihovu adresu.') : ''),
          kartice: kartice(lista.slice(0, 4)), akcije: [{ tekst: naListi === 1 ? (en() ? 'Open it' : 'Otvori') : en() ? 'See all ' + naListi : 'Pogledaj sve (' + naListi + ')', href: naListi === 1 ? PR.link(lista[0]) : OF.link('prodavnica', upit.join('&')) }, za === 'on' && vrsta !== 'muski-nakit' && lista.length < 3 ? { tekst: en() ? 'All men’s jewellery' : 'Sav muški nakit', href: OF.link('kategorija-muski-nakit') } : null, poklon ? { tekst: OF.t('k.vaucer'), href: OF.link('poklon-vaucer') } : null].filter(Boolean) } };
      },
      /* veličina prstena / lančića */
      function (r, pitanje, a) {
        if (!a.sadrzi(r, REC.velicina)) return null;
        var lanac = a.sadrzi(r, VRSTE.ogrlice), narukvica = a.sadrzi(r, VRSTE.narukvice);
        var tekst = lanac ? (en() ? 'Necklaces come in 40, 45 and 50 cm. 40 cm sits at the base of the neck, 45 cm on the collarbone (the most popular), 50 cm just below it. The size guide shows each length on a figure.' : 'Lančići su 40, 45 i 50 cm. 40 cm stoji pri dnu vrata, 45 cm na ključnoj kosti (najčešći izbor), 50 cm malo ispod. U vodiču su dužine prikazane na silueti.')
          : narukvica ? (en() ? 'Measure your wrist snugly and add 1.5–2 cm. Our bracelets are S (16 cm), M (17.5 cm) and L (19 cm), and chains have an extension.' : 'Izmerite zglob tesno i dodajte 1,5–2 cm. Narukvice su S (16 cm), M (17,5 cm) i L (19 cm), a lanci imaju produžetak.')
          : (en() ? 'Measure the inside diameter of a ring that fits you, or the circumference of your finger with a strip of paper. The size is the circumference in mm (EU sizes); our rings come in ' + velicinePrstena('prstenje').min + '–' + velicinePrstena('prstenje').max + ' and men’s rings up to ' + velicinePrstena('muski-nakit').max + '. If you’re between two sizes, take the larger one. We resize rings once free of charge within 30 days.' : 'Izmerite unutrašnji prečnik prstena koji Vam odgovara ili obim prsta trakom papira. Veličina je obim u milimetrima (EU veličine); prstenje imamo u veličinama ' + velicinePrstena('prstenje').min + '–' + velicinePrstena('prstenje').max + ', a muško prstenje do ' + velicinePrstena('muski-nakit').max + '. Ako ste između dve, uzmite veću. Prsten jednom besplatno prepravljamo u roku od 30 dana.');
        return { s: 3.3, a: { tekst: tekst, akcije: [{ tekst: en() ? 'Size guide' : 'Vodič za veličine', href: OF.link('vodic-velicine', null) + (lanac ? '#lanac' : narukvica ? '#narukvica' : '#prsten') }] } };
      },
      /* promena adrese posle porudžbine */
      function (r, pitanje, a) {
        if (!(a.sadrzi(r, REC.promena) && a.sadrzi(r, REC.adresa))) return null;
        return { s: 3.5, a: { tekst: en() ? 'Message us as soon as possible on Viber or by email, with your order number. Until the parcel is handed to the courier, we can change the address without any trouble.' : 'Pišite nam što pre na Viber ili mejl, sa brojem porudžbine. Dok paket nije predat kuriru, adresu menjamo bez problema.',
          akcije: [{ tekst: 'Viber', href: OF.viber(), spolja: true }, { tekst: OF.t('k.prati_porudzbinu'), href: OF.link('porudzbina') }] } };
      },
      /* izrada po porudžbini (komadi kojih nema na stanju) i gravura */
      function (r, pitanje, a) {
        if (!a.sadrzi(r, REC.izrada)) return null;
        var dani = PR.sve().filter(function (p) { return p.poPorudzbini; }).map(function (p) { return p.poPorudzbini; });
        if (!dani.length) return null;
        var od = Math.min.apply(null, dani), doo = Math.max.apply(null, dani), raspon = od === doo ? od : od + '–' + doo, g = OF.d.prodaja.gravuraDana || 2;
        return { s: 3.4, a: { tekst: en() ? 'Pieces we make to order take ' + raspon + ' working days, plus delivery the next working day; the product page shows the exact date. Engraving adds ' + g + ' working days.' : 'Komadi koje izrađujemo po porudžbini traju ' + raspon + ' radnih dana, pa kurir isporučuje sledećeg radnog dana; tačan datum piše na stranici proizvoda. Gravura dodaje ' + g + ' radna dana.',
          akcije: [{ tekst: OF.t('k.dostava'), href: OF.link('dostava') }] } };
      },
      /* status porudžbine: broj (T-XXXXXX) i mejl iz poruke */
      function (r, pitanje, a) {
        var broj = (/\b([A-Z]-[A-Z0-9]{6})\b/i.exec(pitanje) || [])[1], email = (/[^\s@]+@[^\s@]+\.[^\s@]{2,}/.exec(pitanje) || [])[0];
        var proslo = /\b(porucio|porucila|porucili|narucio|narucila|narucili|platio|platila|ordered)\b/.test(PM.norm(pitanje));   // već poručeno (ne „ako poručim“)
        if (!broj && !proslo && !a.sadrzi(r, REC.statusJak) && !(a.sadrzi(r, REC.gde) && a.sadrzi(r, REC.status))) return null;
        if (broj && email) {
          return { s: 3.6, a: { tekst: en() ? 'Checking order ' + broj.toUpperCase() + '…' : 'Proveravam porudžbinu ' + broj.toUpperCase() + '…', akcije: [{ tekst: OF.t('k.prati_porudzbinu'), href: OF.link('porudzbina') }], posle: function (el) {
            PR.nadjiPorudzbinu(broj, email).then(function (p) {
              var t = OF.$('p', el); if (!t) return;
              if (!p) { t.textContent = OF.t('pr.nije_nadjena'); return; }
              t.textContent = (en() ? 'Order ' : 'Porudžbina ') + p.id + ': ' + PR.nazivStatusa(p.status) + (p.posiljka ? ' · ' + p.posiljka.servis + ' ' + p.posiljka.broj : '') + '. ' + (en() ? 'Total ' : 'Ukupno ') + OF.din(p.ukupno) + '.';
              var a2 = OF.$('a', el); if (a2 && p.kljuc) a2.href = OF.link('porudzbina', 'broj=' + p.id + '&k=' + p.kljuc);
            });
          } } };
        }
        return { s: 3.0, a: { tekst: en() ? 'Send me your order number (e.g. T-ABC123) and the email you ordered with, in one message, and I’ll check the status. Or open the order status page.' : 'Pošaljite mi broj porudžbine (npr. T-ABC123) i mejl sa kojim ste poručili, u jednoj poruci, pa ću proveriti status. Ili otvorite stranicu za status.' + (OF.demo ? ' (Demo: T-DEMO01 ana@primer.rs)' : ''),
          akcije: [{ tekst: OF.t('k.prati_porudzbinu'), href: OF.link('porudzbina') }] } };
      },
      /* dostava, rok i cena (iz podešavanja prodaje) */
      function (r, pitanje, a) {
        if (a.sadrzi(r, REC.inostranstvo)) return { s: 3.2, a: { tekst: en() ? 'Through the website we ship only to addresses in Serbia. For other countries, message us on Viber or by email and we’ll quote the price and timing.' : 'Preko sajta šaljemo samo na adrese u Srbiji. Za inostranstvo nam pišite na Viber ili mejl, pa ćemo Vam reći cenu i rok slanja.', akcije: [{ tekst: 'Viber', href: OF.viber(), spolja: true }, { tekst: OF.t('k.dostava'), href: OF.link('dostava') }] } };
        if (!a.sadrzi(r, REC.dostava)) return null;
        var k = (OF.d.prodaja.dostava || [])[0] || {};
        var tekst = (en() ? 'Courier anywhere in Serbia: ' : 'Kurir na adresu, cela Srbija: ') + OF.din(k.cena) + (k.besplatnoOd ? (en() ? ', free from ' : ', besplatno od ') + OF.din(k.besplatnoOd) : '') + '. ' + PR.isporukaTekst(0) + '\n' + (en() ? 'Collection from the workshop in Dorćol is free.' : 'Preuzimanje u radionici na Dorćolu je besplatno.');
        return { s: 3.0, a: { tekst: tekst, akcije: [{ tekst: OF.t('k.dostava'), href: OF.link('dostava') }] } };
      }
    ]);
    /* gravura, nega, povraćaj, vaučer: kratko iz podataka + link (dodatno uz teme iz pomocnik-<jezik>.js) */
    PM.namere.push(function (r, pitanje, a) {
      var t = null;
      if (a.sadrzi(r, REC.vaucer)) t = { tekst: en() ? 'Gift cards from 2,000 to 50,000 RSD, valid for a year, online and in the workshop. You can redeem one in several purchases. They arrive as a PDF with a code right after payment.' : 'Poklon vaučeri od 2.000 do 50.000 din, važe godinu dana, na sajtu i u radionici, i mogu da se troše u više kupovina. Stižu kao PDF sa kodom odmah posle plaćanja.', akcije: [{ tekst: OF.t('k.vaucer'), href: OF.link('poklon-vaucer') }] };
      else if (a.sadrzi(r, REC.povracaj)) t = { tekst: en() ? 'You can withdraw from a purchase within 14 days of delivery without giving a reason (except engraved pieces); we refund you within 14 days the same way you paid. Complaints: we reply within 8 days.' : 'Od kupovine možete da odustanete u roku od 14 dana od prijema, bez obrazloženja (osim graviranog nakita); novac vraćamo u roku od 14 dana, istim putem kojim ste platili. Reklamacije: odgovaramo u roku od 8 dana.', akcije: [{ tekst: en() ? 'Returns and complaints' : 'Povraćaj i reklamacije', href: OF.link('povracaj') }] };
      else if (a.sadrzi(r, REC.gravura)) t = { tekst: en() ? 'Engraving costs 1,200 RSD and takes 1–2 working days. Up to 14–20 characters depending on the piece, in a classic or modern typeface; you see a preview before ordering. Engraved pieces can’t be returned.' : 'Gravura je 1.200 din i radi se 1–2 radna dana. Do 14–20 znakova, zavisno od komada, klasičnim ili modernim slovima; pregled vidite pre poručivanja. Gravirani nakit ne može da se vrati.', akcije: [{ tekst: en() ? 'Engraving' : 'Graviranje', href: OF.link('graviranje') }] };
      else if (a.sadrzi(r, REC.nega)) t = { tekst: en() ? 'Silver darkens in contact with air and some cosmetics; that’s normal. A soft polishing cloth brings back the shine; keep pieces in a closed pouch and take them off for swimming and the gym. We clean and polish your jewellery in the workshop free of charge.' : 'Srebro tamni u dodiru sa vazduhom i nekom kozmetikom; to je normalno. Mekana krpica za poliranje vraća sjaj; čuvajte nakit u zatvorenoj kesici i skidajte ga za plivanje i teretanu. U radionici čistimo i poliramo Vaš nakit bez naplate.', akcije: [{ tekst: en() ? 'Jewellery care' : 'Nega nakita', href: OF.link('nega') }] };
      return t ? { s: 2.9, a: t } : null;
    });
  }

  /* posle porudžbine naslov kase više nije „Plaćanje i dostava“ */
  OF.on('kasa:potvrda', function () {
    var h1 = d.getElementById('naslov-strane'); if (!h1) return;
    h1.textContent = en() ? 'Thank you for your order' : 'Hvala na kupovini';
    var uv = h1.closest('.t-uvod'), lead = uv && OF.$('.t-lead', uv); if (lead) lead.hidden = true;
    var m = uv && OF.$$('.t-mrvice li', uv); if (m && m.length) (OF.$('span', m[m.length - 1]) || m[m.length - 1]).textContent = h1.textContent;
    try { d.title = h1.textContent + ' · ' + OF.d.firma.ime; } catch (e) {}
  });

  /* =====================================================================
     STRANICA
     ===================================================================== */
  OF.spremno(function () {
    var glava = OF.$('[data-t-glava]');
    /* meni nakita (računar) */
    var mmDugme = OF.$('[data-t-mm]'), mm = d.getElementById('t-mm');
    if (mmDugme && mm) {
      var zatvoriMm = function (fokus) { mmDugme.setAttribute('aria-expanded', 'false'); mm.hidden = true; glava.classList.remove('mm-otvoren'); if (fokus) mmDugme.focus(); };
      mmDugme.addEventListener('click', function () { var o = mmDugme.getAttribute('aria-expanded') !== 'true'; mmDugme.setAttribute('aria-expanded', o ? 'true' : 'false'); mm.hidden = !o; glava.classList.toggle('mm-otvoren', o); });
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !mm.hidden) zatvoriMm(true); });
      d.addEventListener('click', function (e) { if (!mm.hidden && !mm.contains(e.target) && !mmDugme.contains(e.target)) zatvoriMm(); });
      var tajmer; [mmDugme.parentNode, mm].forEach(function (el) {
        el.addEventListener('mouseenter', function () { if (!w.matchMedia('(hover: hover)').matches) return; clearTimeout(tajmer); mmDugme.setAttribute('aria-expanded', 'true'); mm.hidden = false; glava.classList.add('mm-otvoren'); });
        el.addEventListener('mouseleave', function () { if (!w.matchMedia('(hover: hover)').matches) return; tajmer = setTimeout(zatvoriMm, 180); });
      });
    }
    /* pretraga u zaglavlju */
    var prDugme = OF.$('[data-t-pretraga]'), pr = d.getElementById('t-pretraga');
    if (prDugme && pr) {
      var postavi = function (o) { prDugme.setAttribute('aria-expanded', o ? 'true' : 'false'); pr.hidden = !o; if (o) OF.$('input', pr).focus(); else prDugme.focus(); };
      prDugme.addEventListener('click', function () { postavi(pr.hidden); });
      var x = OF.$('[data-t-pretraga-zatvori]', pr); if (x) x.addEventListener('click', function () { postavi(false); });
      pr.addEventListener('keydown', function (e) { if (e.key === 'Escape') postavi(false); });
    }
    /* meni na telefonu počinje tačno ispod zaglavlja (iznad su demo traka i najava dok se ne skroluje) */
    var meniDugme = OF.$('[data-of-meni-dugme]');
    if (meniDugme && glava) meniDugme.addEventListener('click', function () { d.documentElement.style.setProperty('--meni-vrh', Math.max(0, glava.getBoundingClientRect().bottom) + 'px'); }, true);

    /* senka zaglavlja kad se skroluje */
    if (glava) { var skrol = function () { glava.classList.toggle('skrolovano', w.pageYOffset > 8); }; w.addEventListener('scroll', skrol, { passive: true }); skrol(); }

    /* tema: bez izbora prati uređaj; izbor se pamti (OF.store 'tema'), a kad je isti kao na uređaju, briše se i sajt opet prati uređaj.
       Prvu temu postavlja skripta u <head> (pre prikaza), ovde samo dugme, promena na uređaju i drugi otvoreni prozori. */
    var koren = d.documentElement, mq = w.matchMedia ? w.matchMedia('(prefers-color-scheme: dark)') : null;
    var temaUredjaja = function () { return mq && mq.matches ? 'tamna' : 'svetla'; };
    var primeniTemu = function (t) {
      if (koren.getAttribute('data-tema') === t) return;
      koren.classList.add('t-bez-prelaza');
      koren.setAttribute('data-tema', t);
      var m = OF.$('meta[name="theme-color"]'); if (m && m.getAttribute('data-' + t)) m.setAttribute('content', m.getAttribute('data-' + t));
      w.requestAnimationFrame(function () { w.requestAnimationFrame(function () { koren.classList.remove('t-bez-prelaza'); }); });
      OF.emit('tema', t);
    };
    OF.$$('[data-t-tema]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = koren.getAttribute('data-tema') === 'tamna' ? 'svetla' : 'tamna';
        if (t === temaUredjaja()) OF.store.remove('tema'); else OF.store.set('tema', t);
        primeniTemu(t);
      });
    });
    if (mq) { var promenaUredjaja = function () { if (!OF.store.get('tema')) primeniTemu(temaUredjaja()); }; if (mq.addEventListener) mq.addEventListener('change', promenaUredjaja); else if (mq.addListener) mq.addListener(promenaUredjaja); }
    w.addEventListener('storage', function (e) { if (e.key && /:tema$/.test(e.key)) primeniTemu(OF.store.get('tema') || temaUredjaja()); });

    /* poklon vaučer */
    var vf = OF.$('[data-t-vaucer]');
    if (vf) {
      var drugi = OF.$('.t-vaucer-forma__drugi', vf), prikazIznosa = OF.$('[data-t-vaucer-iznos]'), prikazZa = OF.$('[data-t-vaucer-za]');
      var iznos = function () { var r = OF.$('input[name=iznos]:checked', vf); return !r ? 0 : r.value === 'drugi' ? Math.round(+vf.elements.drugi.value || 0) : +r.value; };
      var osvezi = function () { var n = iznos(); if (prikazIznosa) prikazIznosa.textContent = n ? OF.din(n) : '–'; if (prikazZa) prikazZa.textContent = vf.elements.primalac.value ? (en() ? 'For ' : 'Za: ') + vf.elements.primalac.value : ''; drugi.hidden = !OF.$('#v-drugi', vf).checked; };
      vf.addEventListener('input', osvezi); vf.addEventListener('change', osvezi); osvezi();
      vf.addEventListener('submit', function (e) {
        e.preventDefault();
        var V = OF.d.prodaja.vauceri, n = iznos();
        if (OF.$('#v-drugi', vf).checked && !OF.forma(vf, { drugi: function () { return n >= V.min && n <= V.max ? '' : (en() ? 'Enter an amount from ' : 'Upišite iznos od ') + OF.din(V.min) + (en() ? ' to ' : ' do ') + OF.din(V.max) + '.'; } })) return;
        var o = { primalac: vf.elements.primalac.value.trim(), od: vf.elements.od.value.trim(), poruka: vf.elements.poruka.value.trim() };
        OF.korpa.dodaj({ id: 'vaucer-' + n, tip: 'vaucer', naziv: { sr: 'Poklon vaučer ' + OF.broj(n) + ' din', en: 'Gift card ' + OF.broj(n) + ' RSD' }, detalj: o.primalac ? { sr: 'Za: ' + o.primalac, en: 'For: ' + o.primalac } : null, cena: n, kolicina: 1, opcije: o, slika: 'assets/img/vaucer.svg', link: 'poklon-vaucer', maks: 10 });
      });
    }

    /* pregled gravure (početna, graviranje) */
    OF.$$('[data-t-gravura-demo]').forEach(function (demo) {
      var ulaz = OF.$('input[type=text], input:not([type])', demo) || OF.$('input', demo), font = 'klasican';
      var crtaj = function () { OF.$$('[data-of-gravura-tekst]', demo).forEach(function (t) { t.textContent = (ulaz.value || 'A ♡ M').slice(0, 14); t.setAttribute('data-font', font); }); };
      ulaz.addEventListener('input', crtaj);
      OF.$$('input[type=radio]', demo).forEach(function (r) { r.addEventListener('change', function () { font = r.value; crtaj(); }); });
      var sablon = OF.$('[data-t-oblici]');
      OF.$$('[data-t-oblik]', demo).forEach(function (b) {
        b.addEventListener('click', function () {
          var oblik = b.getAttribute('data-t-oblik'), svg = OF.$('svg', demo);
          OF.$$('[data-t-oblik]', demo).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          if (!demo._prsten) demo._prsten = svg.cloneNode(true);
          var novo = oblik === 'prsten' ? demo._prsten.cloneNode(true) : sablon && OF.$('.t-gravura-svg--' + oblik, sablon.content).cloneNode(true);
          if (novo) { svg.replaceWith(novo); crtaj(); }
        });
      });
      OF.$$('form', demo).forEach(function (f) { f.addEventListener('submit', function (e) { e.preventDefault(); }); });
      crtaj();
    });

    /* alat za veličinu prstena: prečnik ili obim → EU veličina (obim u mm) */
    var alat = OF.$('[data-t-velicina-alat]');
    if (alat) {
      var nacin = 'precnik', polje = OF.$('input', alat), rez = OF.$('[data-t-alat-rezultat]', alat), oznaka = OF.$('[data-t-alat-oznaka]', alat), pomoc = OF.$('[data-t-alat-pomoc]', alat);
      var T = OF.d.alatVelicine || {};
      OF.$$('[data-t-nacin]', alat).forEach(function (b) {
        b.addEventListener('click', function () { nacin = b.getAttribute('data-t-nacin'); OF.$$('[data-t-nacin]', alat).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          oznaka.textContent = OF.tx(T[nacin + 'Polje']); pomoc.textContent = OF.tx(T[nacin + 'Pomoc']); polje.placeholder = nacin === 'obim' ? '54' : '17,2'; polje.min = nacin === 'obim' ? 38 : 12; polje.max = nacin === 'obim' ? 80 : 26; racunaj(); });
      });
      var racunaj = function () {
        var v = parseFloat(String(polje.value).replace(',', '.'));
        if (!v) { rez.textContent = ''; return; }
        var obim = nacin === 'obim' ? v : v * Math.PI;
        if (obim < 40 || obim > 76) { rez.textContent = OF.tx(T.vanOpsega); return; }
        var opseg = velicinePrstena(), vel = Math.round(obim), ponuda = vel % 2 ? vel + 1 : vel;
        rez.innerHTML = '';
        rez.appendChild(OF.h('strong', null, OF.tx(T.rezultat).replace('{v}', vel)));
        if (ponuda < opseg.min || ponuda > opseg.max) rez.appendChild(d.createTextNode(' ' + OF.tx(T.vanPonude).replace('{obim}', OF.broj(obim, 1)).replace('{min}', opseg.min).replace('{max}', opseg.max)));
        else rez.appendChild(d.createTextNode(' ' + OF.tx(T.rezultatOpis).replace('{obim}', OF.broj(obim, 1)).replace('{ponuda}', ponuda)));
      };
      polje.addEventListener('input', racunaj);
    }

    /* traka „dodaj u korpu“ na telefonu, kad glavno dugme nije na ekranu */
    var traka = OF.$('[data-t-kupi-traka]'), glavno = OF.$('[data-of-p-dodaj]');
    if (traka && glavno) {
      // traka se vidi kad je glavno dugme iznad ekrana (proverava se pri skrolu; IntersectionObserver propušta brz skok preko dugmeta)
      var cekaKadar = false, proveriTraku = function () { cekaKadar = false; var r = glavno.getBoundingClientRect(); traka.hidden = r.bottom > 0; };
      w.addEventListener('scroll', function () { if (!cekaKadar) { cekaKadar = true; w.requestAnimationFrame(proveriTraku); } }, { passive: true });
      w.addEventListener('resize', proveriTraku); proveriTraku();
      OF.$('[data-t-kupi-dugme]', traka).addEventListener('click', function () {
        var forma = glavno.form || glavno.closest('form');
        if (glavno.disabled) { forma.scrollIntoView({ behavior: OF.manjePokreta() ? 'auto' : 'smooth', block: 'center' }); return; }
        if ((OF.$$('[data-of-osa]', forma).length) || OF.$('[data-of-p-gravura] input[type=checkbox]:checked', forma)) { forma.scrollIntoView({ behavior: OF.manjePokreta() ? 'auto' : 'smooth', block: 'center' }); setTimeout(function () { glavno.focus(); }, 400); return; }
        glavno.click();
      });
      var cenaT = OF.$('[data-t-kupi-cena]', traka), cenaP = OF.$('[data-of-p-cena]');
      if (cenaT && cenaP && 'MutationObserver' in w) new MutationObserver(function () { cenaT.textContent = cenaP.textContent; }).observe(cenaP, { childList: true, characterData: true, subtree: true });
    }
  });
})(window, document);
