# Paketi opsforma — interni vodič za tim

Interni vodič: šta vlasnik dobija u svakom paketu, šta radi on, kako se alati povezuju i šta košta. Cene usluga opsforma su namerno ostavljene kao **[cena]**.

Cene alata su proverene na zvaničnim stranicama **20. 10. 2026.** Izvori su navedeni uz svaku cenu. Kad stranica nije dala jasan odgovor, piše **„potrebna provera“**. Cene alata su u USD, bez PDV-a, i menjaju se, pa ih proveri pre svake ponude.

---

## Zajedničko za sva tri paketa

**Hosting.** Demoi su na GitHub Pages i tu mogu da ostanu. Za prave sajtove klijenata **ne koristi GitHub Pages**. GitHub u dokumentaciji piše da Pages nije namenjen niti dozvoljen kao besplatan hosting za vođenje online biznisa ([GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)). Za klijente koristi **Cloudflare Pages, Free**: zahtevi ka statičnim fajlovima su besplatni i neograničeni ([Cloudflare Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)), uz 500 build-ova mesečno, do 20.000 fajlova i do 100 domena po projektu ([Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)). Vlasnika to košta **0 USD**.

**Domen.** Cenu .rs ili .co.rs domena određuje registrar koji izabereš. **Potrebna provera** kod registrara pre ponude. Domen uvek registruj na ime firme klijenta, a ne na svoje ime.

**Forma na mejl: Web3Forms.** Besplatan plan ima 250 poruka mesečno, jednog primaoca i zaštitu od spama (hCaptcha). Starter košta 49 USD godišnje za 5.000 poruka, Pro 12 USD mesečno ili 149 USD godišnje i dodaje automatski odgovor pošiljaocu i priloge. Kad se prođe mesečni limit, nove poruke staju do sledećeg meseca ([Web3Forms pricing](https://web3forms.com/pricing)). Mala radnja ne prelazi 250 poruka, pa vlasnika košta **0 USD**.

**Viber i poziv.** Dugme `viber://chat?number=%2B381…` i `tel:` link su besplatni.

---

## Paket 1 — Osnovni (vizitkarta)

**Šta vlasnik dobija:** jednu stranu sa uslugama i cenama, radnim vremenom, mapom, dugmetom za poziv i Viber i kontakt formom. Poruke iz forme stižu mu na mejl.

**Šta vlasnik radi svakog dana:** ništa novo. Odgovara na mejl, poziv ili Viber kao i do sada.

**Alati i povezivanje, korak po korak:**
1. Napravi Web3Forms pristupni ključ na vlasnikov mejl (web3forms.com, samo upiše mejl i potvrdi). Ključ upiši u skriveno polje `access_key` u formi i postavi `action="https://api.web3forms.com/submit"`. U demoima je to opisano u komentaru iznad forme.
2. Pošalji probnu poruku sa sajta i proveri da stiže, i da nije u spamu. Ako jeste, neka vlasnik označi „Nije spam“.
3. Zameni telefone, adresu, radno vreme i cene pravim podacima. Mapu ažuriraj preko `q=` u adresi iframe-a.
4. Napravi Cloudflare Pages projekat, poveži ga sa GitHub repoom klijenta i dodaj domen.
5. Ukloni `noindex` i traku „Primer sajta“. Dodaj `sitemap.xml` i prijavi sajt u Google Search Console.
6. Pošalji vlasniku link i kratku poruku: „Poruke sa sajta stižu Vam na ovaj mejl.“

**Koliko traje postavljanje:** procena 3–5 sati, ako vlasnik pošalje sve podatke odjednom. Najviše vremena ode na čekanje podataka, ne na rad.

**Šta može da pođe po zlu:**
- *Poruke idu u spam.* Neka vlasnik doda adresu pošiljaoca u kontakte i označi prvu poruku kao „Nije spam“.
- *Vlasnik ne gleda mejl.* Predloži da ga obaveštenje stiže na telefon (Gmail aplikacija), ili mu stavi Viber kao glavni poziv.
- *Prođe se limit od 250 poruka* (obično zbog spama). Uključi hCaptcha ili pređi na Starter.
- *Promena cena.* Vlasnik ti pošalje nove cene, a ti ih menjaš ([cena] za održavanje).

**Mesečni trošak alata za vlasnika:** **0 USD**. Plus domen jednom godišnje (potrebna provera) i [cena] za održavanje.

---

## Paket 2 — Zakazivanje ili porudžbine

**Šta vlasnik dobija:** sve iz paketa 1, plus online zakazivanje termina ili online porudžbine za preuzimanje ili dostavu. Kupac bira uslugu, dan i slobodan termin, ostavlja ime i telefon i dobija potvrdu.

**Šta vlasnik radi svakog dana:** ujutru pogleda kalendar na telefonu, kao i do sada. U varijanti a još odgovori na zahteve, poziv ili Viber poruka „Potvrđujem, vidimo se u 10“.

### Varijanta a — „Zahtev za termin“ (vlasnik ne uči ništa)

Sajt prikazuje radno vreme i termine, a kupac šalje *zahtev*. Vlasnik dobija mejl sa rezimeom i potvrđuje ga pozivom ili porukom. Termin se ne upisuje nigde sam.

1. Modul zakazivanja iz demoa ostaje isti. Na koraku „Pošalji“ podaci idu na Web3Forms (vidi komentar „PRODUKCIJA, varijanta a“ u kodu demoa). Naslov mejla neka bude „Zahtev za termin: <usluga>, <dan> u <vreme>“.
2. Ekran potvrde promeni u „Zahtev je poslat. Javićemo se da potvrdimo termin.“ Ne piši „Termin je zakazan“.
3. Opciono, dugme „Pošalji i na Viber“ otvara Viber sa već napisanim tekstom zahteva.
4. Zauzetost: sajt ne zna stvarnu zauzetost. Ili prikazuj samo radno vreme i dozvoli bilo koji termin, ili vlasnik javi stalne pauze pa ih unesi kao blokirane.

Odgovara kada vlasnik ima malo termina dnevno ili termin ionako mora da proveri (majstor na terenu, vodoinstalater, krojač).

### Varijanta b — Povezan kalendar (termini se sami upisuju)

Termini se sami upisuju u Google Kalendar na vlasnikovom telefonu, a kupac dobija potvrdu mejlom. Na sajtu se umesto demo modula ugrađuje jedan od ovih servisa:

| Servis | Šta je besplatno | Plaćeno | Izvor |
|---|---|---|---|
| **Google Kalendar, Appointment schedule** | Lični Google nalog može da napravi **jednu** stranicu za zakazivanje. | Više stranica traži Google One Premium, Google AI Pro/Ultra ili Workspace. Plaćanje termina traži Workspace. Da li besplatan nalog šalje automatske podsetnike: **potrebna provera**. Cene tih pretplata u Srbiji: **potrebna provera**. | [Google podrška: premium funkcije](https://support.google.com/calendar/answer/16287038?hl=en) |
| **Cal.com** | Free za jednog korisnika: neograničeno vrsta termina i kalendara, obaveštenja mejlom. | Teams 12 USD po korisniku mesečno (godišnje plaćanje), sa round-robin rasporedom za više radnika. | [Cal.com pricing](https://cal.com/pricing) |
| **Calendly** | Free: 1 vrsta termina, 1 povezan kalendar, bez podsetnika mejlom, sa Calendly brendom. | Standard 10 USD po korisniku mesečno, sa automatizacijama i podsetnicima. | [Calendly pricing](https://calendly.com/pricing) |

**Preporuka:** za jednog radnika i jednu vrstu usluge koristi **Google Appointment schedule**, jer vlasnik već ima Gmail i ne uči novu aplikaciju. Za više usluga sa različitim trajanjem koristi **Cal.com Free**.

**Postavljanje, korak po korak (Google Appointment schedule):**
1. Na vlasnikovom Gmail nalogu (računar, calendar.google.com): Kreiraj → Raspored zakazivanja.
2. Unesi naziv usluge, trajanje, radno vreme po danima, pauzu između termina, koliko unapred može da se zakaže (npr. 14 dana) i najkraći rok (npr. 2 sata unapred).
3. U formu za zakazivanje dodaj obavezno polje za telefon.
4. Uključi proveru zauzetosti u vlasnikovom glavnom kalendaru, da privatne obaveze blokiraju termine.
5. Kopiraj link stranice za zakazivanje i ugradi ga na sajt: dugme „Zakažite“ i ugrađeni iframe umesto demo modula. Vidi komentar „PRODUKCIJA, varijanta b“ u kodu.
6. Zakaži probni termin sa svog telefona. Proveri da se pojavio u vlasnikovom kalendaru na telefonu i da je stigla potvrda mejlom.
7. Pokaži vlasniku jednu stvar: kako blokira vreme. Napravi događaj u istom kalendaru, npr. „Zatvoreno“.

**Postavljanje, Cal.com:** napravi nalog na vlasnikov Gmail, poveži Google Kalendar, napravi vrstu termina po usluzi (trajanje i cena u opisu), podesi dostupnost, pa ugradi embed na sajt. Probni termin uradi isto kao gore.

### Porudžbine (pekara, cvećara, mesara, torte)

Porudžbine su uvek varijanta a. Korpa, dan i vreme preuzimanja ili zona dostave idu kao jedan mejl preko Web3Forms (vidi komentar u kodu demoa). Vlasnik potvrđuje pozivom ili Viberom, a plaća se na licu mesta ili kuriru. Za preuzimanje može da se doda i događaj u Google Kalendar ručno. Online plaćanje ne nudimo.

**Koliko traje postavljanje:** procena 5–8 sati za varijantu a i 6–10 sati za varijantu b, uključujući podešavanje usluga, trajanja i probni termin sa vlasnikom.

**Šta može da pođe po zlu:**
- *Duplo zakazan termin* (vlasnik zakaže telefonom, a neko i preko sajta). Pravilo za vlasnika: svaki telefonski termin odmah upiše u isti Google Kalendar. U varijanti a se to ne dešava, jer on potvrđuje.
- *Kupac ne dođe.* Uključi podsetnik ako servis to podržava, ili neka vlasnik pošalje Viber dan ranije.
- *Termini se ne vide u kalendaru na telefonu.* Proveri da je u Google Calendar aplikaciji uključen pravi nalog i kalendar.
- *Vlasnik zaboravi da blokira odmor.* Pre praznika i odmora pošalji mu podsetnik.
- *Kupac upiše pogrešan telefon.* Neka polje za telefon bude obavezno, sa proverom formata.
- *Zahtevi iz varijante a ostaju bez odgovora.* Dogovori sa vlasnikom rok za odgovor (npr. do kraja dana) i napiši ga na ekranu potvrde.

**Mesečni trošak alata za vlasnika:** **0 USD** sa Google Appointment schedule (jedna stranica), Cal.com Free ili Web3Forms Free. Ako treba Calendly sa podsetnicima: 10 USD mesečno. Plus [cena] za postavljanje i održavanje.

---

## Paket 3 — Plus

**Šta vlasnik dobija:** sve iz paketa 2, plus jedan ili više dodataka po potrebi zanata. Online plaćanja nema, plaća se na licu mesta, što je jednostavnije i za vlasnika i za porez.

**Šta vlasnik radi svakog dana:** isto kao u paketu 2. Zavisno od dodatka, još povremeno promeni cenu u tabeli ili pošalje fotografiju za galeriju.

### Dodaci, alati i povezivanje

**1. Više radnika ili mesta** (2 frizera, 2 dizalice, 2 instruktora)
- *Besplatno:* svaki radnik ima svoj Google nalog sa jednom stranicom za zakazivanje, ili svoj Cal.com Free nalog. Sajt prvo pita kod koga, pa otvara stranicu tog radnika. Vlasnik vidi sve ako mu radnici podele kalendare.
- *Plaćeno:* Cal.com Teams (12 USD po korisniku mesečno, godišnje plaćanje) daje zajedničku stranicu sa round-robin rasporedom i opcijom „Svejedno“ ([Cal.com pricing](https://cal.com/pricing)).
- *Mesta umesto ljudi* (dizalica 1 i 2): napravi poseban kalendar po mestu na vlasnikovom nalogu.

**2. Podsetnik dan ranije**
- *Mejl:* Cal.com Free šalje obaveštenja mejlom. Da li Google Appointment schedule šalje podsetnike sa besplatnog naloga: **potrebna provera** ([Google podrška](https://support.google.com/calendar/answer/16287038?hl=en)).
- *SMS preko Calendly:* od plana Standard (10 USD po korisniku mesečno). Srbija je na listi podržanih zemalja, poruka ima do 180 znakova, a podsetnici ne rade tokom probnog perioda ([Calendly: SMS](https://calendly.com/help/how-to-send-text-messages-with-workflows), [Calendly pricing](https://calendly.com/pricing)).
- *SMS preko Cal.com:* Free nema besplatne kredite, ali krediti mogu da se kupe. Jedan kredit je 0,01 USD. Poruka se naplaćuje po Twilio ceni za zemlju plus 80 % naknade. Teams plan dobija 750 kredita po članu mesečno ([Cal.com: messaging credits](https://cal.com/help/billing-and-usage/messaging-credits)). Tačna cena SMS-a za Srbiju: **potrebna provera**.
- *Najjeftinije:* vlasnik sam pošalje Viber podsetnik iz kalendara. Ne košta ništa, ali on to mora da radi.

**3. Cenovnik u Google Sheets tabeli**
1. Napravi tabelu na vlasnikovom nalogu sa kolonama: kategorija, naziv, cena, jedinica, aktivno (da/ne).
2. Datoteka → Deli → Objavi na vebu, izaberi list i format CSV, pa kopiraj link.
3. Sajt pri učitavanju čita CSV preko `fetch()` i iscrtava cenovnik. Ako čitanje ne uspe, prikazuje cene ugrađene u kod. Vidi komentar u demou poslastičarnice.
4. Vlasnik menja cenu u Sheets aplikaciji na telefonu, a sajt prikazuje novu cenu posle osvežavanja. Objavljena verzija se osvežava uz kašnjenje od nekoliko minuta.
- Trošak: **0 USD**. Rizik: ako vlasnik obriše kolonu ili zaglavlje, cenovnik pukne. Zaključaj prvi red (Podaci → Zaštićeni opsezi).

**4. Dvojezičan sajt (srpski i engleski)**
- Bez alata: tekstovi su u kodu, a prekidač SR/EN ih menja. Za pravi sajt bolja je posebna `/en/` stranica, zbog Google pretrage. Trošak **0 USD**. Prevod proveri sa vlasnikom (nazivi usluga).

**5. Link ka Google recenzijama**
- Samo pravi profil firme: Google profil firme (Google Business Profile) → Pozovite na recenziju → kopiraj link. Na sajt ide dugme „Pogledajte recenzije na Google-u“. Recenzije **ne prepisujemo** na sajt i ne izmišljamo ih. Trošak **0 USD**.

**6. Galerija radova koju vlasnik dopunjava**
- *Najjednostavnije za vlasnika:* pošalje ti fotografije na Viber, a ti ih dodaš uz [cena] mesečno za održavanje. Vlasnik ne uči ništa.
- *Bez tebe:* Google Sheets sa kolonama naslov i link fotografije. Fotografije u Google Drive folderu, podeljene za pregled, a sajt čita listu kao kod cenovnika. Trošak **0 USD**. Proveri da li se Drive slike pouzdano prikazuju na sajtu pre nego što ovo ponudiš: **potrebna provera**. Cloudinary Free je alternativa (**potrebna provera** cene).

**Koliko traje postavljanje:** procena: paket 2 plus 2–4 sata po dodatku. Više radnika i cenovnik iz tabele su najduži, oko 4 sata. Dvojezičnost zavisi od količine teksta.

**Šta može da pođe po zlu:**
- *Radnik ne vodi svoj kalendar.* Pravilo je isto kao u paketu 2: svaki telefonski termin ide u kalendar. Kod više radnika jednom nedeljno proveri sa vlasnikom.
- *SMS ne stigne* (operater blokira, pogrešan broj). Uvek ostavi i mejl potvrdu. Pre uključivanja testiraj na brojevima sva tri operatera (mts, Yettel, A1).
- *Potrošeni SMS krediti* (Cal.com). Postavi upozorenje u podešavanjima naplate i dogovori sa vlasnikom ko kupuje kredite.
- *Pokvarena tabela cenovnika.* Sajt prikazuje rezervne cene iz koda. Zaštiti zaglavlje tabele.
- *Galerija se ne dopunjava.* Najčešće se vlasniku ne da. Ponudi Viber varijantu.

**Mesečni trošak alata za vlasnika (procena):**
- Sa besplatnim varijantama (posebni nalozi po radniku, mejl podsetnik, Sheets, Viber galerija): **0 USD**.
- Sa zajedničkim zakazivanjem za 2 radnika na Cal.com Teams: 2 × 12 = **24 USD mesečno** (godišnje plaćanje).
- Sa SMS podsetnicima preko Calendly Standard: **10 USD po korisniku mesečno**.
- Cal.com SMS krediti: zavisi od broja poruka, **potrebna provera** cene za Srbiju.
- Plus [cena] za postavljanje i održavanje opsforma.

---

## Kratak pregled

| | Paket 1 | Paket 2 | Paket 3 |
|---|---|---|---|
| Šta vlasnik dobija | sajt, poziv, Viber, forma na mejl | + zakazivanje ili porudžbine | + dodaci po zanatu |
| Šta vlasnik radi | ništa novo | gleda kalendar ujutru (b) ili potvrđuje zahteve (a) | isto, plus povremeno tabela ili fotografije |
| Alati | Cloudflare Pages, Web3Forms | + Google Appointment schedule / Cal.com / Calendly | + Cal.com Teams, Calendly SMS, Google Sheets |
| Postavljanje (procena) | 3–5 h | 5–10 h | paket 2 + 2–4 h po dodatku |
| Alati mesečno | 0 USD | 0–10 USD | 0–24 USD i više, zavisno od dodataka |
| Cena opsforma | [cena] | [cena] | [cena] |

*Provereno 20. 10. 2026. Pre svake ponude ponovo proveri cene na linkovima iznad.*
