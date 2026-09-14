# Karte Score

Mobilni PWA scorekeeper za **Briškulu, Trešetu i Kifameno**.

Radi bez servera, bez baze i bez računa. Sve partije i igrači spremaju se u `localStorage` na uređaju.

## Što je uključeno

- Briškula, Trešeta i Kifameno
- spremanje igrača
- 11 bodova po rundi za Trešetu/Kifameno
- automatsko ograničavanje preostalih bodova
- automatski rezultat zadnjem igraču
- zvanja (`Napola ...` +3)
- ručni bonus/kazna
- Kifameno Kapot = -11
- individualna igra i 2-na-2 gdje je podržano
- povijest rundi
- uređivanje stare runde
- završene partije i osnovna statistika
- automatsko lokalno spremanje
- offline PWA
- automatsko preuzimanje nove verzije aplikacije kad je uređaj online

## Najlakši GitHub deploy

1. Napravi novi GitHub repository, npr. `karte-score`.
2. Upload-aj **sve datoteke iz ovog foldera**, uključujući `.github` folder.
3. Commit na `main` branch.
4. U GitHub repositoryju otvori **Settings → Pages**.
5. Pod `Build and deployment` postavi **Source: GitHub Actions**.
6. Otvori karticu **Actions** i pričekaj da `Deploy GitHub Pages` završi zeleno.
7. GitHub će ti dati adresu oblika:
   `https://TVOJ-USERNAME.github.io/karte-score/`

## Instalacija na Android

1. Otvori GitHub Pages link u Chromeu.
2. Izbornik `⋮`.
3. Odaberi **Add to Home screen** ili **Install app**.
4. Nakon toga aplikaciju otvaraš kao normalnu aplikaciju.

## Instalacija na iPhone

1. Otvori link u Safariju.
2. Pritisni **Share**.
3. Odaberi **Add to Home Screen**.
4. Pritisni **Add**.

## Kako rade budući updateovi

**Ne treba ponovno dodavati aplikaciju na Home Screen.**

Kad promijeniš `index.html`, `app.js`, `styles.css` ili drugu datoteku i napraviš push/commit na `main`:

1. GitHub Actions automatski objavi novu verziju.
2. Kad sljedeći put otvoriš aplikaciju dok imaš internet, service worker radi network-first provjeru i preuzima najnovije datoteke.
3. Ako nema interneta, koristi zadnju spremljenu verziju.
4. Igrači, povijest i aktivna partija ostaju u `localStorage` i update koda ih ne briše.

U Postavkama postoji i gumb **Provjeri update sada**.

## Važno o spremljenim podacima

Podaci su lokalni na konkretnom uređaju/browseru. Ako obrišeš podatke Safarija/Chromea ili deinstaliraš PWA i browser ukloni storage, povijest se može izgubiti.

Za sinkronizaciju između više mobitela kasnije bi trebalo dodati backend/cloud bazu.

## Mijenjanje pravila

Na vrhu `app.js` postoji objekt `RULES`.

Primjer:

```js
const RULES = {
  treseta: { basePoints: 11 },
  kifameno: { basePoints: 11, lowWins: true, kapot: -11 }
};
```

Zvanja su u polju `DECLARATIONS` odmah ispod.

## Struktura

- `index.html` — početna HTML datoteka
- `styles.css` — cijeli dizajn
- `app.js` — logika igre, spremanje i UI
- `manifest.webmanifest` — PWA konfiguracija
- `sw.js` — offline cache i update logika
- `icons/` — ikone za Home Screen
- `.github/workflows/pages.yml` — automatski deploy na GitHub Pages
