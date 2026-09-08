# Fotografirane mađarice

Ova mapa sadrži svih 32 lica korisnikova špila, spremna za prikaz u igri.
Datoteke su WebP s prozirnim zaobljenim kutovima, omjera 3:5 i dimenzija
360 × 600 px. Naziv svake datoteke odgovara ID-u karte iz enginea.

- Vrijednosti: `7`, `8`, `9`, `10`, `J` (dolnji), `Q` (gornji), `K`, `A`.
- Boje: `HERC` (srce), `KARA` (bundeva/zvono), `PIK` (list), `TREF` (žir).
- Primjer: `7HERC.webp`, `QPIK.webp`, `AKARA.webp`.

Izvorne HEIC fotografije ostaju neizmijenjene u `/assets`. Obrada je
deterministička: detektira vanjski obris fizičke karte, ispravlja perspektivu,
čuva cijeli papirnati rub izvan crnog okvira i uklanja pozadinu izvan
zaobljenih kutova. Ne generira niti ponovno crta ilustracije.

Za ponovnu obradu pokrenuti:

```bash
python scripts/prepare_card_assets.py
```

Potrebni su `opencv-python-headless`, `Pillow` i macOS alat `sips` za HEIC.
Vizualna kontrola cijelog kompleta nalazi se u `design/cards/contact-sheet.jpg`.
