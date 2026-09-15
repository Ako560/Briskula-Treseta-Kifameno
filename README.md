# Karte Score v8

Mobilna PWA aplikacija za praćenje rezultata u Trešeti, Briškuli, Kifamenu i Remiju.

## Što je novo u v8

- Trešeta i Briškula imaju jasan izbor `Pojedinačno` ili `2 na 2`.
- Kod `2 na 2` više se ne biraju četiri igrača. Upišu se samo dva imena timova.
- Trešeta 2 na 2 vodi svih 11 bodova direktno po timu.
- Zvanja i ručni bodovi u timskoj Trešeti dodjeljuju se direktno timu.
- Briškula 2 na 2 po rundi traži samo pobjednički tim.
- Pojedinačne partije i dalje koriste spremljene igrače.
- Redizajniran je UI u jednostavniji i ozbiljniji stil, bez emojija i nepotrebnih opisa.
- Postojeće lokalno spremljene partije i povijest ostaju kompatibilne.

## GitHub Pages update

Zamijeni datoteke u repozitoriju i napravi commit. Service Worker koristi cache `v8`, pa se postojeća Home Screen instalacija ne mora ponovno dodavati.

Preporuka nakon deploya: potpuno zatvori aplikaciju i ponovno je otvori jednom kako bi nova verzija odmah sjela.
