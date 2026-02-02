# web2-projekt6
Napredni razvoj programske potpore za web - Šesti projekt (progresivna web-aplikacija)


WEB2 Projekt - PWA bilješke s kamerom

URL aplikacije na Renderu https://web2-projekt6-hmgz.onrender.com

Aplikacija se lokalno pokeće:
1) Klonirati repozitorij
2) U root folderu pokrenuti
   npm install
   npm run serve

Aplikacija se pokreće na http://localhost:3000

Opis aplikacije:
Aplikacija omogućuje spremanje bilješki uz fotografiju.
Bilješke se mogu spremati offline, a kad se uređaj ponovno spoji na internet, automatski se sinkroniziraju sa serverom.
Aplikacija je PWA i može se instalirati na uređaj te podržava push notifikacije.

Kako koristiti aplikaciju:
1) Uključiti kameru i snimiti fotografiju.
2) Ako kamera ne radi, moguće je odabrati sliku s uređaja.
3) Upisati tekst bilješke i kliknuti "Spremi lokalno".
4) Ako je korisnik online, bilješka se odmah sinkronizira.
5) Ako je offline, sinkronizacija se izvrši automatski kad se vrati internet.
6) Push notifikacije se mogu omogućiti klikom na "Omogući push" (radi samo na HTTPS Render).

Provjera traženih funkcionalnosti:

1) Korištenje native API-ja (kamera): Da
Aplikacija koristi Camera API. Klikom na "Uključi kameru" pokreće se kamera. Ako kamera nije dostupna, koristi se fallback za odabir slike.

2) Installable PWA: Da
Aplikacija ima manifest i može se instalirati iz Chrome address bara. Nakon instalacije otvara se kao standalone aplikacija.

3) Caching strategija: Da
Service Worker cacheira app shell (HTML, CSS, JS, ikone). Implementirane su strategije za navigaciju, statičke resurse i slike.

4) Offline rad (app shell): Da
Otvoriti aplikaciju, u Chrome DevTools uključiti Offline i napraviti refresh. Aplikacija se dalje prikazuje i radi.

5) Background sync: Da
Bilješke spremljene offline spremaju se u IndexedDB i automatski se sinkroniziraju kad se internet vrati.

6) Push notifikacije: Da
Push notifikacije rade na Renderu (HTTPS). Nakon sinkronizacije bilješki server šalje push notifikaciju.

7) Progressive enhancement/graceful degradation: Da
Ako kamera nije podržana, koristi se fallback.
Ako nema interneta, aplikacija radi offline.
Ako push nije podržan, aplikacija normalno radi.

