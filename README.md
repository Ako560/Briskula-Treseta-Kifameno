# PARTIJA

Mobilni PWA scorekeeper za Trešetu, Briškulu, Kifameno i Remi.

## Objavljivanje na GitHub Pages

1. U GitHub repozitorij uploadaj sadržaj ovog foldera tako da `index.html` bude u rootu.
2. Otvori **Settings → Pages**.
3. Pod **Build and deployment** odaberi **Deploy from a branch**.
4. Branch: `main`, folder: `/(root)`.
5. Klikni **Save**.

Nakon deploya GitHub će prikazati URL aplikacije.

## Instalacija na mobitel

### Android
Otvori GitHub Pages link u Chromeu i odaberi **Install app** / **Add to Home screen**.

### iPhone
Otvori link u Safariju → Share → **Add to Home Screen**.

Aplikaciju je potrebno dodati na Home Screen samo jednom. Nove verzije se povlače preko service workera nakon GitHub deploya.

## Podaci

Postojeći storage ključevi iz ranijih verzija nisu promijenjeni, zato update dizajna ne bi trebao obrisati spremljene igrače, aktivnu partiju ni povijest.

## Pravila koja su trenutno implementirana

- Trešeta: pojedinačno ili 2 na 2; 11 bodova po normalnoj rundi; zvanja i ručni bodovi.
- Briškula: 2–4 igrača ili 2 na 2; po rundi se bira pobjednik.
- Kifameno: 0–10 po igraču u normalnoj rundi; Kapot odmah završava rundu i igraču daje -11.
- Remi: rezultati po igraču su -2, -1 ili 1–20.

## Dizajn

Verzija v9 prebacuje aplikaciju na novi identitet **Partija**: tamna kartaška podloga, zlatni detalji i vlastite vektorske ilustracije za svaku igru. Nema vanjskih slika ni CDN ovisnosti, pa PWA radi offline nakon prvog učitavanja.
