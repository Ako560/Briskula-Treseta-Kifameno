# Karte Score

Jednostavna PWA aplikacija za praćenje Briškule, Trešete i Kifamena.

## Trenutna pravila aplikacije

- Briškula: 2, 3 ili 4 igrača. U svakoj rundi bira se samo pobjednik. Kod 4 igrača moguće je uključiti 2 na 2.
- Trešeta: 11 osnovnih bodova po rundi. Preostali bodovi se automatski ograničavaju i zadnjem igraču se ostatak dodjeljuje automatski.
- Kifameno: 11 osnovnih bodova po rundi, manji konačni rezultat je bolji, Kapot je -11.
- Zvanja: nema unaprijed zadanog popisa. Odabere se igrač, po želji upiše naziv zvanja i odabere broj bodova.

## GitHub Pages

Repozitorij može biti objavljen direktno iz `main` branch-a i `/ (root)` foldera.

Settings -> Pages -> Deploy from a branch -> main -> /(root)

## PWA i update

Nakon što se aplikacija jednom doda na Home Screen, nije je potrebno ponovno instalirati nakon izmjena. Service worker provjerava noviju verziju s GitHub Pagesa, a lokalni podaci ostaju spremljeni u localStorageu na tom uređaju.
