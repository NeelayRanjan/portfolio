# SLAAC snapped-plan gate

Generated 2026-09-30 by `scripts/slaac/gate.py` (owner's pipeline, imported by path).

## Cases

- Library: 373 routes.
- Launch preset (all 6 polygons at once): 80 affected routes, 293 skipped (no leg within 25 nm).
- Random: 200 cases from `eval_sua.build_cases` (seed 0, 372 eligible routes after its CONUS / 300-2500 nm / >=4-fix filters), 0 skipped.
- Policies hug (1-waypoint) and wide (infinite lookahead), margin 25 nm, clear_margin 25 nm.
- exceptions count as not clear; medians over runs without exceptions.
- Inputs: launch-sua.json sha256 `06ae3ca77f5931e6eb0cdbcf348c82160fd3912ba6e0498462e8bcfa33280b63`, routes.json sha256 `d181b31b3bf147006cb831d74b1763b3c149cd9bf3974450bf6e8bde7e62a2ce`, options sha256 `09d8c4ff6ee9f6b5beebf45ec15a64d8b902c6628afd53d14edfff1633a95825`.
- Sweep: 2240 runs, 978.9 s wall.
- Anchor-chord column: anchor-chord invariant (0 by construction): a polyline is never shorter than the chord between its own ends, so this count cannot be nonzero; kept in the ladder per R9, not a test (R11).

## All cases

| policy | steps | n | leg-clear % | clear at margin % | added nm (med) | added % (med) | min clearance nm (med) | anchor-chord invariant (0 by construction) | shorter than filed | exceptions | t_gen s (med) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| hug | 20 | 280 | 100.00 | 86.07 | 31.0 | 2.66 | 31.8 | 0 | 11 | 0 | 0.859 |
| hug | 30 | 280 | 100.00 | 87.50 | 29.8 | 2.59 | 31.8 | 0 | 15 | 0 | 2.170 |
| hug | 40 | 280 | 100.00 | 89.29 | 29.8 | 2.60 | 32.1 | 0 | 16 | 0 | 2.768 |
| hug | 50 | 280 | 100.00 | 87.14 | 31.0 | 2.62 | 31.5 | 0 | 12 | 0 | 3.437 |
| wide | 20 | 280 | 100.00 | 85.00 | 6.6 | 0.42 | 33.0 | 0 | 106 | 0 | 1.451 |
| wide | 30 | 280 | 100.00 | 84.64 | 6.7 | 0.41 | 32.8 | 0 | 105 | 0 | 2.143 |
| wide | 40 | 280 | 100.00 | 87.86 | 7.1 | 0.44 | 34.2 | 0 | 106 | 0 | 2.723 |
| wide | 50 | 280 | 100.00 | 85.00 | 6.6 | 0.39 | 33.2 | 0 | 108 | 0 | 3.438 |

## launch cases only

| policy | steps | n | leg-clear % | clear at margin % | added nm (med) | min clearance nm (med) | anchor-chord invariant (0 by construction) | shorter than filed | exceptions |
|---|---|---|---|---|---|---|---|---|---|
| hug | 20 | 80 | 100.00 | 67.50 | 43.2 | 25.1 | 0 | 0 | 0 |
| hug | 30 | 80 | 100.00 | 75.00 | 35.7 | 25.3 | 0 | 4 | 0 |
| hug | 40 | 80 | 100.00 | 76.25 | 35.7 | 25.6 | 0 | 5 | 0 |
| hug | 50 | 80 | 100.00 | 70.00 | 35.7 | 25.7 | 0 | 1 | 0 |
| wide | 20 | 80 | 100.00 | 65.00 | 7.1 | 26.3 | 0 | 29 | 0 |
| wide | 30 | 80 | 100.00 | 60.00 | 7.1 | 26.3 | 0 | 29 | 0 |
| wide | 40 | 80 | 100.00 | 70.00 | 7.1 | 26.3 | 0 | 29 | 0 |
| wide | 50 | 80 | 100.00 | 62.50 | 7.1 | 26.3 | 0 | 31 | 0 |

## random cases only

| policy | steps | n | leg-clear % | clear at margin % | added nm (med) | min clearance nm (med) | anchor-chord invariant (0 by construction) | shorter than filed | exceptions |
|---|---|---|---|---|---|---|---|---|---|
| hug | 20 | 200 | 100.00 | 93.50 | 30.4 | 34.1 | 0 | 11 | 0 |
| hug | 30 | 200 | 100.00 | 92.50 | 29.8 | 33.8 | 0 | 11 | 0 |
| hug | 40 | 200 | 100.00 | 94.50 | 29.8 | 34.2 | 0 | 11 | 0 |
| hug | 50 | 200 | 100.00 | 94.00 | 31.0 | 34.2 | 0 | 11 | 0 |
| wide | 20 | 200 | 100.00 | 93.00 | 5.3 | 36.9 | 0 | 77 | 0 |
| wide | 30 | 200 | 100.00 | 94.50 | 5.6 | 36.8 | 0 | 76 | 0 |
| wide | 40 | 200 | 100.00 | 95.00 | 6.6 | 36.8 | 0 | 77 | 0 |
| wide | 50 | 200 | 100.00 | 94.00 | 5.4 | 36.7 | 0 | 77 | 0 |

## Decision

- steps 20 hug: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 1.24 nm <= 2.98 (10%) yes; |median clearance diff| 0.30 <= 2 nm yes -> acceptable
- steps 20 wide: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.50 nm <= 0.71 (10%) yes; |median clearance diff| 1.23 <= 2 nm yes -> acceptable
- steps 20: ACCEPTABLE (both policies)
- steps 30 hug: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.00 nm <= 2.98 (10%) yes; |median clearance diff| 0.23 <= 2 nm yes -> acceptable
- steps 30 wide: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.42 nm <= 0.71 (10%) yes; |median clearance diff| 1.37 <= 2 nm yes -> acceptable
- steps 30: ACCEPTABLE (both policies)
- steps 40 hug: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.00 nm <= 2.98 (10%) yes; |median clearance diff| 0.00 <= 2 nm yes -> acceptable
- steps 40 wide: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.00 nm <= 0.71 (10%) yes; |median clearance diff| 0.00 <= 2 nm yes -> acceptable
- steps 40: ACCEPTABLE (both policies)
- steps 50 hug: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 1.24 nm <= 2.98 (10%) yes; |median clearance diff| 0.55 <= 2 nm yes -> acceptable
- steps 50 wide: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.52 nm <= 0.71 (10%) yes; |median clearance diff| 0.97 <= 2 nm yes -> acceptable
- steps 50: ACCEPTABLE (both policies)
- chosen_steps = smallest acceptable = 20
- hug @ 20: leg-clear 100.00% >= 98.0%: yes
- hug @ 20: exceptions 0 == 0: yes
- hug @ 20: anchor-chord invariant 0 == 0 (0 by construction, not a test): yes
- hug @ 20: PASSES
- wide @ 20: leg-clear 100.00% >= 99.0%: yes
- wide @ 20: exceptions 0 == 0: yes
- wide @ 20: anchor-chord invariant 0 == 0 (0 by construction, not a test): yes
- wide @ 20: PASSES
- hug and wide both pass -> display snapped, policies [wide, hug]
- display = snapped

**chosen_steps = 20, display = snapped, policies = ['wide', 'hug']**


## Plans shorter than the filed route (information only, ruling R8)

Each replaced stretch: filed length between the anchors / plan length / straight chord (nm).

| policy | steps | pair | route | polygon | added nm | stretches |
|---|---|---|---|---|---|---|
| wide | 20 | KIAH-KSAN | 3 | launch-preset | -55.51 | CWK>ITUCO 712/657/637 |
| wide | 20 | KIAH-KSAN | 7 | launch-preset | -57.93 | CWK>ITUCO 715/657/637 |
| wide | 20 | KMIA-KBOS | 4 | launch-preset | -38.49 | KMIA>ROBUC 1187/1148/1050 |
| wide | 20 | KFLL-KSAN | 4 | launch-preset | -206.14 | LEV>GBN 1382/1176/1176 |
| wide | 20 | KFLL-KSAN | 3 | launch-preset | -12.29 | MAF>SSO 370/358/358 |
| wide | 20 | KMCO-KPHL | 4 | launch-preset | -27.82 | KMCO>KPHL 792/764/753 |
| wide | 20 | KMCO-KPHL | 0 | launch-preset | -130.62 | KMCO>KPHL 895/764/753 |
| wide | 20 | KMCO-KPHL | 7 | launch-preset | -27.82 | KMCO>KPHL 792/764/753 |
| wide | 20 | KMCO-KPHL | 6 | launch-preset | -106.83 | KMCO>SAV197051 275/189/175; SAV197051>KPHL 620/598/598 |
| wide | 20 | KMCO-KPHL | 1 | launch-preset | -36.06 | KMCO>KPHL 800/764/753 |
| wide | 20 | KMCO-KPHL | 2 | launch-preset | -37.29 | KMCO>KPHL 801/764/753 |
| wide | 20 | KMCO-KPHL | 3 | launch-preset | -27.82 | KMCO>KPHL 792/764/753 |
| wide | 20 | KDTW-KMCO | 0 | launch-preset | -2.22 | GNV349047>KMCO 138/136/136 |
| wide | 20 | KMCO-KPHL | 5 | launch-preset | -27.82 | KMCO>KPHL 792/764/753 |
| wide | 20 | KDTW-KMCO | 2 | launch-preset | -6.73 | TEUFL>KMCO 218/211/210 |
| wide | 20 | KDTW-KMCO | 6 | launch-preset | -6.73 | TEUFL>KMCO 218/211/210 |
| wide | 20 | KDTW-KMCO | 5 | launch-preset | -6.73 | TEUFL>KMCO 218/211/210 |
| wide | 20 | KPHX-KAUS | 0 | launch-preset | -11.07 | PXR115025>UCOKA 604/593/589 |
| wide | 20 | KPHX-KAUS | 1 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 20 | KPHX-KAUS | 2 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 20 | KPHX-KAUS | 5 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 20 | KDTW-KMCO | 1 | launch-preset | -6.73 | TEUFL>KMCO 218/211/210 |
| wide | 20 | KDTW-KMCO | 3 | launch-preset | -3.66 | AMG163024>KMCO 177/174/173 |
| wide | 20 | KPHX-KAUS | 6 | launch-preset | -5.35 | PXR148014>UCOKA 618/613/604 |
| wide | 20 | KDTW-KMCO | 4 | launch-preset | -6.73 | TEUFL>KMCO 218/211/210 |
| wide | 20 | KCLT-KSAN | 5 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 20 | KPHX-KBNA | 5 | launch-preset | -3.28 | PHASE>MHZ 969/965/959 |
| wide | 20 | KCLT-KSAN | 4 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 20 | KSEA-KFLL | 3 | launch-preset | -28.74 | OTK>KFLL 356/327/327 |
| hug | 30 | KMCO-KPHL | 4 | launch-preset | -0.50 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 30 | KMCO-KPHL | 5 | launch-preset | -0.50 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 30 | KMCO-KPHL | 3 | launch-preset | -0.50 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 30 | KMCO-KPHL | 7 | launch-preset | -0.50 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| wide | 30 | KIAH-KSAN | 3 | launch-preset | -67.19 | CWK>ITUCO 712/645/637 |
| wide | 30 | KIAH-KSAN | 7 | launch-preset | -69.61 | CWK>ITUCO 715/645/637 |
| wide | 30 | KJFK-KMIA | 0 | launch-preset | -6.39 | SIE>KMIA 943/937/848 |
| wide | 30 | KMIA-KBOS | 2 | launch-preset | -21.69 | KMIA>ROBUC 1138/1116/1050 |
| wide | 30 | KMIA-KBOS | 4 | launch-preset | -70.89 | KMIA>ROBUC 1187/1116/1050 |
| wide | 30 | KMCO-KPHL | 2 | launch-preset | -38.97 | KMCO>KPHL 801/762/753 |
| wide | 30 | KFLL-KSAN | 4 | launch-preset | -206.00 | LEV>GBN 1382/1176/1176 |
| wide | 30 | KFLL-KSAN | 3 | launch-preset | -12.29 | MAF>SSO 370/358/358 |
| wide | 30 | KMCO-KPHL | 3 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 30 | KMCO-KPHL | 5 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 30 | KLAX-KAUS | 0 | launch-preset | -10.02 | TFD>UCOKA 618/608/606 |
| wide | 30 | KMCO-KPHL | 0 | launch-preset | -132.30 | KMCO>KPHL 895/762/753 |
| wide | 30 | KMCO-KPHL | 1 | launch-preset | -37.74 | KMCO>KPHL 800/762/753 |
| wide | 30 | KMCO-KPHL | 7 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 30 | KMCO-KPHL | 4 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 30 | KLAX-KAUS | 5 | launch-preset | -10.02 | TFD>UCOKA 618/608/606 |
| wide | 30 | KDTW-KMCO | 1 | launch-preset | -6.96 | TEUFL>KMCO 218/211/210 |
| wide | 30 | KDTW-KMCO | 3 | launch-preset | -3.73 | AMG163024>KMCO 177/174/173 |
| wide | 30 | KMCO-KPHL | 6 | launch-preset | -115.16 | KMCO>SAV197051 275/181/175; SAV197051>KPHL 620/598/598 |
| wide | 30 | KDTW-KMCO | 2 | launch-preset | -6.96 | TEUFL>KMCO 218/211/210 |
| wide | 30 | KDTW-KMCO | 0 | launch-preset | -2.22 | GNV349047>KMCO 138/136/136 |
| wide | 30 | KPHX-KAUS | 0 | launch-preset | -5.36 | PXR115025>UCOKA 604/599/589 |
| wide | 30 | KDTW-KMCO | 6 | launch-preset | -6.96 | TEUFL>KMCO 218/211/210 |
| wide | 30 | KPHX-KAUS | 4 | launch-preset | -5.34 | PXR136019>UCOKA 612/607/598 |
| wide | 30 | KDTW-KMCO | 4 | launch-preset | -6.96 | TEUFL>KMCO 218/211/210 |
| wide | 30 | KDTW-KMCO | 5 | launch-preset | -6.96 | TEUFL>KMCO 218/211/210 |
| wide | 30 | KCLT-KSAN | 5 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 30 | KCLT-KSAN | 4 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 30 | KSEA-KFLL | 3 | launch-preset | -28.74 | OTK>KFLL 356/327/327 |
| hug | 40 | KSAN-KAUS | 1 | launch-preset | -3.65 | KSAN>DILLO 955/951/941 |
| hug | 40 | KMCO-KPHL | 3 | launch-preset | -0.17 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 40 | KMCO-KPHL | 4 | launch-preset | -0.17 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 40 | KMCO-KPHL | 5 | launch-preset | -0.17 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 40 | KMCO-KPHL | 7 | launch-preset | -0.17 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| wide | 40 | KIAH-KSAN | 3 | launch-preset | -55.51 | CWK>ITUCO 712/657/637 |
| wide | 40 | KIAH-KSAN | 7 | launch-preset | -57.93 | CWK>ITUCO 715/657/637 |
| wide | 40 | KJFK-KMIA | 0 | launch-preset | -5.92 | SIE>KMIA 943/937/848 |
| wide | 40 | KMIA-KBOS | 4 | launch-preset | -39.49 | KMIA>ROBUC 1187/1147/1050 |
| wide | 40 | KMCO-KPHL | 0 | launch-preset | -132.30 | KMCO>KPHL 895/762/753 |
| wide | 40 | KFLL-KSAN | 4 | launch-preset | -206.02 | LEV>GBN 1382/1176/1176 |
| wide | 40 | KFLL-KSAN | 3 | launch-preset | -12.29 | MAF>SSO 370/358/358 |
| wide | 40 | KMCO-KPHL | 2 | launch-preset | -38.97 | KMCO>KPHL 801/762/753 |
| wide | 40 | KMCO-KPHL | 3 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 40 | KMCO-KPHL | 4 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 40 | KMCO-KPHL | 5 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 40 | KMCO-KPHL | 7 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 40 | KLAX-KAUS | 0 | launch-preset | -10.02 | TFD>UCOKA 618/608/606 |
| wide | 40 | KLAX-KAUS | 5 | launch-preset | -10.02 | TFD>UCOKA 618/608/606 |
| wide | 40 | KMCO-KPHL | 1 | launch-preset | -37.74 | KMCO>KPHL 800/762/753 |
| wide | 40 | KDTW-KMCO | 0 | launch-preset | -2.22 | GNV349047>KMCO 138/136/136 |
| wide | 40 | KDTW-KMCO | 1 | launch-preset | -7.13 | TEUFL>KMCO 218/211/210 |
| wide | 40 | KDTW-KMCO | 3 | launch-preset | -3.67 | AMG163024>KMCO 177/174/173 |
| wide | 40 | KDTW-KMCO | 4 | launch-preset | -7.13 | TEUFL>KMCO 218/211/210 |
| wide | 40 | KPHX-KAUS | 1 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 40 | KDTW-KMCO | 5 | launch-preset | -7.13 | TEUFL>KMCO 218/211/210 |
| wide | 40 | KPHX-KAUS | 2 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 40 | KMCO-KPHL | 6 | launch-preset | -106.85 | KMCO>SAV197051 275/189/175; SAV197051>KPHL 620/598/598 |
| wide | 40 | KPHX-KAUS | 5 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 40 | KDTW-KMCO | 6 | launch-preset | -7.13 | TEUFL>KMCO 218/211/210 |
| wide | 40 | KDTW-KMCO | 2 | launch-preset | -7.13 | TEUFL>KMCO 218/211/210 |
| wide | 40 | KSEA-KFLL | 3 | launch-preset | -28.74 | OTK>KFLL 356/327/327 |
| wide | 40 | KCLT-KSAN | 4 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 40 | KCLT-KSAN | 5 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| hug | 50 | KSAN-KAUS | 1 | launch-preset | -4.50 | KSAN>DILLO 955/950/941 |
| wide | 50 | KIAH-KSAN | 3 | launch-preset | -52.85 | CWK>ITUCO 712/659/637 |
| wide | 50 | KJFK-KMIA | 0 | launch-preset | -5.92 | SIE>KMIA 943/937/848 |
| wide | 50 | KIAH-KSAN | 7 | launch-preset | -55.27 | CWK>ITUCO 715/659/637 |
| wide | 50 | KMIA-KBOS | 4 | launch-preset | -71.10 | KMIA>ROBUC 1187/1116/1050 |
| wide | 50 | KFLL-KSAN | 3 | launch-preset | -12.29 | MAF>SSO 370/358/358 |
| wide | 50 | KMIA-KBOS | 2 | launch-preset | -21.89 | KMIA>ROBUC 1138/1116/1050 |
| wide | 50 | KMCO-KPHL | 2 | launch-preset | -37.38 | KMCO>KPHL 801/764/753 |
| wide | 50 | KMCO-KPHL | 3 | launch-preset | -27.91 | KMCO>KPHL 792/764/753 |
| wide | 50 | KMCO-KPHL | 4 | launch-preset | -27.91 | KMCO>KPHL 792/764/753 |
| wide | 50 | KMCO-KPHL | 7 | launch-preset | -27.91 | KMCO>KPHL 792/764/753 |
| wide | 50 | KMCO-KPHL | 0 | launch-preset | -130.71 | KMCO>KPHL 895/764/753 |
| wide | 50 | KMCO-KPHL | 1 | launch-preset | -36.14 | KMCO>KPHL 800/764/753 |
| wide | 50 | KFLL-KSAN | 4 | launch-preset | -206.13 | LEV>GBN 1382/1176/1176 |
| wide | 50 | KMCO-KPHL | 5 | launch-preset | -27.91 | KMCO>KPHL 792/764/753 |
| wide | 50 | KDTW-KMCO | 2 | launch-preset | -3.54 | TEUFL>KMCO 218/215/210 |
| wide | 50 | KDTW-KMCO | 3 | launch-preset | -3.71 | AMG163024>KMCO 177/174/173 |
| wide | 50 | KDTW-KMCO | 4 | launch-preset | -3.54 | TEUFL>KMCO 218/215/210 |
| wide | 50 | KDTW-KMCO | 5 | launch-preset | -3.54 | TEUFL>KMCO 218/215/210 |
| wide | 50 | KPHX-KAUS | 1 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 50 | KMCO-KPHL | 6 | launch-preset | -106.87 | KMCO>SAV197051 275/189/175; SAV197051>KPHL 620/598/598 |
| wide | 50 | KPHX-KAUS | 2 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 50 | KDTW-KMCO | 1 | launch-preset | -3.54 | TEUFL>KMCO 218/215/210 |
| wide | 50 | KDTW-KMCO | 0 | launch-preset | -2.22 | GNV349047>KMCO 138/136/136 |
| wide | 50 | KPHX-KAUS | 4 | launch-preset | -5.34 | PXR136019>UCOKA 612/607/598 |
| wide | 50 | KPHX-KAUS | 5 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 50 | KDTW-KMCO | 6 | launch-preset | -3.54 | TEUFL>KMCO 218/215/210 |
| hug | 20 | KMSP-KJFK | 4 | rand001 | -60.24 | KMSP>HOXIE 765/705/691 |
| wide | 50 | KSEA-KFLL | 3 | launch-preset | -28.74 | OTK>KFLL 356/327/327 |
| wide | 50 | KPHX-KAUS | 0 | launch-preset | -5.44 | PXR115025>UCOKA 604/598/589 |
| wide | 50 | KCLT-KSAN | 4 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| hug | 20 | KSFO-KLAS | 1 | rand008 | -38.53 | LOSHN>MISEN 219/180/180 |
| hug | 20 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| hug | 20 | KLAS-KDFW | 7 | rand033 | -87.95 | KLAS>CNX 577/489/472 |
| hug | 20 | KJFK-KMIA | 1 | rand062 | -1.70 | EMJAY>HOAGG 687/685/680 |
| hug | 20 | KMDW-KBWI | 0 | rand066 | -15.46 | KMDW>ZZV031040 327/311/293 |
| hug | 20 | KORD-KCLT | 2 | rand067 | -13.25 | CVG>SKYWA 206/193/152 |
| wide | 50 | KPHX-KAUS | 6 | launch-preset | -5.35 | PXR148014>UCOKA 618/613/604 |
| hug | 20 | KDEN-KBNA | 7 | rand091 | -92.48 | KDEN>RANTS 930/837/796 |
| hug | 20 | KMSP-KORD | 4 | rand128 | -1.02 | FGT>FYTTE 247/246/238 |
| hug | 20 | KATL-KIAD | 1 | rand130 | -87.20 | KATL>CAVLR 572/485/435 |
| wide | 50 | KCLT-KSAN | 5 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| hug | 20 | KLGA-KORD | 7 | rand144 | -22.00 | KLGA>LTOUR 547/525/506 |
| wide | 20 | KMSP-KJFK | 4 | rand001 | -61.29 | KMSP>STENT 798/737/724 |
| wide | 20 | KMDW-KCLT | 4 | rand010 | -90.01 | KMDW>SOT031071 495/405/393 |
| wide | 20 | KCLT-KSAN | 4 | rand002 | -10.27 | TXK>SSO 774/764/764 |
| wide | 20 | KPHX-KAUS | 0 | rand011 | -16.31 | PXR>UCOKA 629/612/612 |
| wide | 20 | KATL-KIAD | 3 | rand014 | -73.17 | KATL>RIC255063 478/405/357 |
| wide | 20 | KSFO-KLAS | 1 | rand008 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 20 | KCLT-KSAN | 7 | rand009 | -32.84 | CHOPZ>INK 1018/986/986 |
| wide | 20 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| wide | 20 | KDEN-KBNA | 7 | rand015 | -111.74 | KDEN>FAM261069 750/638/620 |
| wide | 20 | KLAS-KDFW | 5 | rand016 | -0.91 | GUP>VKTRY 572/571/566 |
| wide | 20 | KDCA-KPHX | 2 | rand018 | -18.72 | IIU>IRW 621/603/597 |
| wide | 20 | KLAX-KBOS | 7 | rand023 | -2.39 | EKR>BAE 901/898/893 |
| wide | 20 | KLAX-KAUS | 0 | rand036 | -14.44 | BLH>UCOKA 766/752/751 |
| wide | 20 | KLGA-KDEN | 0 | rand031 | -4.06 | MIKYG>OATHE 1195/1191/1189 |
| wide | 20 | KLAS-KDFW | 7 | rand033 | -115.82 | KLAS>INK 770/654/640 |
| wide | 20 | KMDW-KLGA | 0 | rand045 | -18.46 | DJB>MIP 339/321/247 |
| wide | 20 | KSLC-KIAH | 5 | rand049 | -9.48 | TCH031005>DRLLR 1026/1016/1008 |
| wide | 20 | KDFW-KSFO | 7 | rand055 | -3.18 | HULZE>OAL 902/899/885 |
| wide | 20 | KLGA-KSEA | 2 | rand047 | -47.70 | MIKYG>HCT 1180/1132/1132 |
| wide | 20 | KTPA-KSLC | 0 | rand050 | -2.27 | JAWJA>FSM 622/619/611 |
| wide | 20 | KJFK-KMIA | 1 | rand062 | -8.87 | WAVEY>KMIA 948/939/936 |
| wide | 20 | KLAX-KBOS | 5 | rand057 | -8.54 | SLN>KLYNE 671/662/662 |
| wide | 20 | KORD-KCLT | 2 | rand067 | -87.87 | KORD>FILPZ 562/474/473 |
| wide | 20 | KEWR-KSEA | 1 | rand060 | -7.13 | NOSIK>MLP 1418/1411/1411 |
| wide | 20 | KDEN-KMDW | 7 | rand070 | -3.24 | HCT>KMDW 605/602/596 |
| wide | 20 | KMDW-KBWI | 0 | rand066 | -22.02 | KMDW>LUNDY 445/423/411 |
| wide | 20 | KMSP-KJFK | 4 | rand071 | -29.16 | FNT>STENT 374/345/301 |
| wide | 20 | KTPA-KSLC | 0 | rand074 | -6.91 | JAWJA>PER 783/776/772 |
| wide | 20 | KSEA-KFLL | 4 | rand065 | -45.43 | MCI>ACORI 671/625/625 |
| wide | 20 | KLGA-KTPA | 4 | rand069 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 20 | KATL-KIAD | 1 | rand068 | -94.01 | KATL>RIC229062 478/384/355 |
| wide | 20 | KDTW-KMCO | 2 | rand077 | -16.37 | SVM169033>TEUFL 626/609/609 |
| wide | 20 | KDEN-KBNA | 7 | rand091 | -103.46 | KDEN>RYYMN 974/871/839 |
| wide | 20 | KDCA-KPHX | 5 | rand092 | -5.74 | LAJUG>ABQ 950/944/944 |
| wide | 20 | KPHX-KAUS | 6 | rand096 | -18.78 | PXR>UCOKA 632/613/612 |
| wide | 20 | KSLC-KMSP | 0 | rand095 | -7.27 | TCH069060>UFFDA 680/672/671 |
| wide | 20 | KMSP-KJFK | 1 | rand101 | -34.38 | DLL>DAFLU 391/356/317 |
| wide | 20 | KTPA-KSLC | 1 | rand104 | -0.18 | CTY303025>HBU 1280/1280/1270 |
| wide | 20 | KMCO-KPHL | 1 | rand100 | -5.67 | KMCO>ORF235018 589/584/555 |
| wide | 20 | KSEA-KIAH | 6 | rand112 | -10.39 | KSEA>MQP 1424/1413/1413 |
| wide | 20 | KLAX-KAUS | 6 | rand105 | -3.66 | BXK110038>DILLO 719/715/690 |
| wide | 20 | KMSP-KJFK | 5 | rand118 | -111.81 | KMSP>JHW282063 694/582/569 |
| wide | 20 | KMSP-KORD | 2 | rand120 | -23.79 | KMSP>FYTTE 294/270/248 |
| wide | 20 | KDEN-KBNA | 7 | rand121 | -111.05 | KDEN>FAM261069 750/639/620 |
| wide | 20 | KSLC-KDEN | 0 | rand116 | -5.01 | TCH>KDEN 366/361/337 |
| wide | 20 | KMSP-KORD | 4 | rand128 | -12.10 | KMSP>KORD 304/292/290 |
| wide | 20 | KATL-KIAD | 1 | rand130 | -150.74 | KATL>KIAD 615/464/464 |
| wide | 20 | KDTW-KMCO | 7 | rand137 | -101.15 | KDTW>SZW049067 774/673/661 |
| wide | 20 | KLGA-KORD | 1 | rand138 | -37.69 | DJB>WATSN 289/252/173 |
| wide | 20 | KLGA-KTPA | 1 | rand139 | -28.67 | KLGA>DADES 884/855/855 |
| wide | 20 | KMDW-KBWI | 1 | rand140 | -2.15 | ANEWA>KBWI 360/357/347 |
| wide | 20 | KFLL-KSAN | 3 | rand133 | -32.39 | ROZZI>DAS 497/465/431 |
| wide | 20 | KFLL-KSAN | 4 | rand136 | -167.16 | LEV>HOGGZ 1453/1286/1245 |
| wide | 20 | KLGA-KTPA | 4 | rand143 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 20 | KLGA-KORD | 7 | rand144 | -43.43 | KLGA>WYNDE 646/603/598 |
| wide | 20 | KDEN-KMDW | 4 | rand155 | -5.34 | ZIRKL>ENDEE 598/593/584 |
| wide | 20 | KEWR-KORD | 2 | rand158 | -7.16 | KEWR>WYNDE 600/593/586 |
| wide | 20 | KMDW-KCLT | 7 | rand159 | -15.54 | EMMLY>FILPZ 400/385/385 |
| wide | 20 | KLAX-KDEN | 1 | rand150 | -21.06 | KLAX>KDEN 773/752/744 |
| wide | 20 | KMDW-KCLT | 3 | rand162 | -75.82 | KMDW>VXV351045 444/368/355 |
| wide | 20 | KCLT-KSAN | 5 | rand160 | -10.27 | TXK>SSO 774/764/764 |
| wide | 20 | KCLT-KSAN | 4 | rand166 | -23.62 | TXK>GBN 951/927/927 |
| wide | 20 | KCLT-KSAN | 1 | rand165 | -19.04 | CHOPZ>SJT 874/855/855 |
| wide | 20 | KLAX-KAUS | 4 | rand173 | -36.89 | TRM>FST 732/695/684 |
| wide | 20 | KLGA-KDEN | 7 | rand176 | -2.15 | NEWEL>KDEN 1337/1335/1333 |
| wide | 20 | KMCO-KPHL | 4 | rand178 | -27.88 | KMCO>JIIMS 768/740/740 |
| wide | 20 | KFLL-KSAN | 1 | rand169 | -57.24 | KFLL>CWK112048 1004/947/909 |
| wide | 20 | KMDW-KCLT | 1 | rand179 | -23.77 | KMDW>FILPZ 483/460/460 |
| wide | 20 | KSLC-KMSP | 3 | rand184 | -108.55 | OCS>TORGY 772/664/664 |
| wide | 20 | KDCA-KPHX | 7 | rand183 | -101.16 | DACOS>IRW 760/659/659 |
| wide | 20 | KDCA-KPHX | 6 | rand187 | -55.69 | HUMBO>EAGUL 1108/1052/1051 |
| wide | 20 | KLGA-KTPA | 3 | rand194 | -39.81 | KLGA>WIGVO 676/637/637 |
| wide | 20 | KMDW-KCLT | 1 | rand195 | -10.27 | KMDW>FILPZ 483/473/460 |
| wide | 20 | KSEA-KIAH | 7 | rand197 | -24.81 | KSEA>MQP 1438/1413/1413 |
| wide | 20 | KMDW-KCLT | 2 | rand190 | -9.41 | EMMLY>FILPZ 400/391/385 |
| wide | 20 | KEWR-KORD | 4 | rand191 | -2.52 | KEWR>WYNDE 600/598/586 |
| wide | 20 | KCLT-KSAN | 0 | rand192 | -0.72 | CHOPZ>LFK 584/583/578 |
| hug | 30 | KMSP-KJFK | 4 | rand001 | -60.24 | KMSP>HOXIE 765/705/691 |
| hug | 30 | KSFO-KLAS | 1 | rand008 | -38.53 | LOSHN>MISEN 219/180/180 |
| hug | 30 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| hug | 30 | KLAS-KDFW | 7 | rand033 | -48.24 | KLAS>CNX 577/528/472 |
| hug | 30 | KJFK-KMIA | 1 | rand062 | -4.37 | EMJAY>HOAGG 687/683/680 |
| hug | 30 | KMDW-KBWI | 0 | rand066 | -15.46 | KMDW>ZZV031040 327/311/293 |
| hug | 30 | KORD-KCLT | 2 | rand067 | -13.25 | CVG>SKYWA 206/193/152 |
| hug | 30 | KDEN-KBNA | 7 | rand091 | -92.48 | KDEN>RANTS 930/837/796 |
| hug | 30 | KMSP-KORD | 4 | rand128 | -1.02 | FGT>FYTTE 247/246/238 |
| hug | 30 | KATL-KIAD | 1 | rand130 | -87.20 | KATL>CAVLR 572/485/435 |
| hug | 30 | KLGA-KORD | 7 | rand144 | -22.00 | KLGA>LTOUR 547/525/506 |
| wide | 30 | KMSP-KJFK | 4 | rand001 | -61.29 | KMSP>STENT 798/737/724 |
| wide | 30 | KCLT-KSAN | 4 | rand002 | -10.27 | TXK>SSO 774/764/764 |
| wide | 30 | KSFO-KLAS | 1 | rand008 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 30 | KMDW-KCLT | 4 | rand010 | -90.01 | KMDW>SOT031071 495/405/393 |
| wide | 30 | KPHX-KAUS | 0 | rand011 | -16.31 | PXR>UCOKA 629/612/612 |
| wide | 30 | KATL-KIAD | 3 | rand014 | -73.17 | KATL>RIC255063 478/405/357 |
| wide | 30 | KCLT-KSAN | 7 | rand009 | -32.84 | CHOPZ>INK 1018/986/986 |
| wide | 30 | KLAS-KDFW | 5 | rand016 | -0.91 | GUP>VKTRY 572/571/566 |
| wide | 30 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| wide | 30 | KDEN-KBNA | 7 | rand015 | -111.74 | KDEN>FAM261069 750/638/620 |
| wide | 30 | KDCA-KPHX | 2 | rand018 | -18.72 | IIU>IRW 621/603/597 |
| wide | 30 | KLAX-KBOS | 7 | rand023 | -2.39 | EKR>BAE 901/898/893 |
| wide | 30 | KLGA-KDEN | 0 | rand031 | -4.06 | MIKYG>OATHE 1195/1191/1189 |
| wide | 30 | KLAS-KDFW | 7 | rand033 | -115.82 | KLAS>INK 770/654/640 |
| wide | 30 | KLAX-KAUS | 0 | rand036 | -14.44 | BLH>UCOKA 766/752/751 |
| wide | 30 | KLGA-KSEA | 2 | rand047 | -47.70 | MIKYG>HCT 1180/1132/1132 |
| wide | 30 | KSLC-KIAH | 5 | rand049 | -9.48 | TCH031005>DRLLR 1026/1016/1008 |
| wide | 30 | KTPA-KSLC | 0 | rand050 | -2.27 | JAWJA>FSM 622/619/611 |
| wide | 30 | KMDW-KLGA | 0 | rand045 | -18.46 | DJB>MIP 339/321/247 |
| wide | 30 | KDFW-KSFO | 7 | rand055 | -3.18 | HULZE>OAL 902/899/885 |
| wide | 30 | KEWR-KSEA | 1 | rand060 | -7.13 | NOSIK>MLP 1418/1411/1411 |
| wide | 30 | KMDW-KBWI | 0 | rand066 | -22.02 | KMDW>LUNDY 445/423/411 |
| wide | 30 | KLAX-KBOS | 5 | rand057 | -8.54 | SLN>KLYNE 671/662/662 |
| wide | 30 | KSEA-KFLL | 4 | rand065 | -45.43 | MCI>ACORI 671/625/625 |
| wide | 30 | KORD-KCLT | 2 | rand067 | -87.87 | KORD>FILPZ 562/474/473 |
| wide | 30 | KJFK-KMIA | 1 | rand062 | -5.18 | WAVEY>KMIA 948/943/936 |
| wide | 30 | KLGA-KTPA | 4 | rand069 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 30 | KATL-KIAD | 1 | rand068 | -101.54 | KATL>RIC229062 478/376/355 |
| wide | 30 | KDEN-KMDW | 7 | rand070 | -3.24 | HCT>KMDW 605/602/596 |
| wide | 30 | KMSP-KJFK | 4 | rand071 | -29.16 | FNT>STENT 374/345/301 |
| wide | 30 | KTPA-KSLC | 0 | rand074 | -6.91 | JAWJA>PER 783/776/772 |
| wide | 30 | KDTW-KMCO | 2 | rand077 | -16.37 | SVM169033>TEUFL 626/609/609 |
| wide | 30 | KDEN-KBNA | 7 | rand091 | -103.46 | KDEN>RYYMN 974/871/839 |
| wide | 30 | KDCA-KPHX | 5 | rand092 | -5.74 | LAJUG>ABQ 950/944/944 |
| wide | 30 | KPHX-KAUS | 6 | rand096 | -18.78 | PXR>UCOKA 632/613/612 |
| wide | 30 | KSLC-KMSP | 0 | rand095 | -7.27 | TCH069060>UFFDA 680/672/671 |
| wide | 30 | KMSP-KJFK | 1 | rand101 | -34.38 | DLL>DAFLU 391/356/317 |
| wide | 30 | KMCO-KPHL | 1 | rand100 | -7.72 | KMCO>ORF235018 589/582/555 |
| wide | 30 | KTPA-KSLC | 1 | rand104 | -0.18 | CTY303025>HBU 1280/1280/1270 |
| wide | 30 | KSEA-KIAH | 6 | rand112 | -10.39 | KSEA>MQP 1424/1413/1413 |
| wide | 30 | KSLC-KDEN | 0 | rand116 | -5.01 | TCH>KDEN 366/361/337 |
| wide | 30 | KMSP-KORD | 2 | rand120 | -15.54 | KMSP>FYTTE 294/278/248 |
| wide | 30 | KDEN-KBNA | 7 | rand121 | -111.05 | KDEN>FAM261069 750/639/620 |
| wide | 30 | KMSP-KJFK | 5 | rand118 | -111.81 | KMSP>JHW282063 694/582/569 |
| wide | 30 | KATL-KIAD | 1 | rand130 | -150.74 | KATL>KIAD 615/464/464 |
| wide | 30 | KFLL-KSAN | 3 | rand133 | -32.39 | ROZZI>DAS 497/465/431 |
| wide | 30 | KMSP-KORD | 4 | rand128 | -10.03 | KMSP>KORD 304/294/290 |
| wide | 30 | KFLL-KSAN | 4 | rand136 | -157.95 | LEV>HOGGZ 1453/1295/1245 |
| wide | 30 | KLGA-KORD | 1 | rand138 | -37.69 | DJB>WATSN 289/252/173 |
| wide | 30 | KLGA-KTPA | 1 | rand139 | -28.67 | KLGA>DADES 884/855/855 |
| wide | 30 | KMDW-KBWI | 1 | rand140 | -2.15 | ANEWA>KBWI 360/357/347 |
| wide | 30 | KDTW-KMCO | 7 | rand137 | -101.15 | KDTW>SZW049067 774/673/661 |
| wide | 30 | KLGA-KORD | 7 | rand144 | -43.43 | KLGA>WYNDE 646/603/598 |
| wide | 30 | KLGA-KTPA | 4 | rand143 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 30 | KLAX-KDEN | 1 | rand150 | -17.52 | KLAX>KDEN 773/755/744 |
| wide | 30 | KDEN-KMDW | 4 | rand155 | -5.34 | ZIRKL>ENDEE 598/593/584 |
| wide | 30 | KEWR-KORD | 2 | rand158 | -7.16 | KEWR>WYNDE 600/593/586 |
| wide | 30 | KMDW-KCLT | 7 | rand159 | -15.54 | EMMLY>FILPZ 400/385/385 |
| wide | 30 | KCLT-KSAN | 5 | rand160 | -10.27 | TXK>SSO 774/764/764 |
| wide | 30 | KCLT-KSAN | 4 | rand166 | -23.62 | TXK>GBN 951/927/927 |
| wide | 30 | KCLT-KSAN | 1 | rand165 | -19.04 | CHOPZ>SJT 874/855/855 |
| wide | 30 | KMDW-KCLT | 3 | rand162 | -75.82 | KMDW>VXV351045 444/368/355 |
| wide | 30 | KFLL-KSAN | 1 | rand169 | -57.24 | KFLL>CWK112048 1004/947/909 |
| wide | 30 | KLAX-KAUS | 4 | rand173 | -36.21 | TRM>FST 732/696/684 |
| wide | 30 | KMCO-KPHL | 4 | rand178 | -27.88 | KMCO>JIIMS 768/740/740 |
| wide | 30 | KDCA-KPHX | 7 | rand183 | -101.16 | DACOS>IRW 760/659/659 |
| wide | 30 | KSLC-KMSP | 3 | rand184 | -108.55 | OCS>TORGY 772/664/664 |
| wide | 30 | KLGA-KDEN | 7 | rand176 | -2.15 | NEWEL>KDEN 1337/1335/1333 |
| wide | 30 | KMDW-KCLT | 1 | rand179 | -23.77 | KMDW>FILPZ 483/460/460 |
| wide | 30 | KDCA-KPHX | 6 | rand187 | -55.69 | HUMBO>EAGUL 1108/1052/1051 |
| wide | 30 | KEWR-KORD | 4 | rand191 | -2.52 | KEWR>WYNDE 600/598/586 |
| wide | 30 | KCLT-KSAN | 0 | rand192 | -0.72 | CHOPZ>LFK 584/583/578 |
| wide | 30 | KMDW-KCLT | 2 | rand190 | -9.41 | EMMLY>FILPZ 400/391/385 |
| wide | 30 | KLGA-KTPA | 3 | rand194 | -39.81 | KLGA>WIGVO 676/637/637 |
| wide | 30 | KMDW-KCLT | 1 | rand195 | -10.27 | KMDW>FILPZ 483/473/460 |
| hug | 40 | KMSP-KJFK | 4 | rand001 | -60.24 | KMSP>HOXIE 765/705/691 |
| wide | 30 | KSEA-KIAH | 7 | rand197 | -24.81 | KSEA>MQP 1438/1413/1413 |
| hug | 40 | KSFO-KLAS | 1 | rand008 | -38.53 | LOSHN>MISEN 219/180/180 |
| hug | 40 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| hug | 40 | KLAS-KDFW | 7 | rand033 | -48.24 | KLAS>CNX 577/528/472 |
| hug | 40 | KMDW-KBWI | 0 | rand066 | -15.46 | KMDW>ZZV031040 327/311/293 |
| hug | 40 | KORD-KCLT | 2 | rand067 | -13.25 | CVG>SKYWA 206/193/152 |
| hug | 40 | KJFK-KMIA | 1 | rand062 | -1.27 | EMJAY>HOAGG 687/686/680 |
| hug | 40 | KDEN-KBNA | 7 | rand091 | -92.48 | KDEN>RANTS 930/837/796 |
| hug | 40 | KMSP-KORD | 4 | rand128 | -1.02 | FGT>FYTTE 247/246/238 |
| hug | 40 | KATL-KIAD | 1 | rand130 | -87.20 | KATL>CAVLR 572/485/435 |
| hug | 40 | KLGA-KORD | 7 | rand144 | -22.00 | KLGA>LTOUR 547/525/506 |
| wide | 40 | KMSP-KJFK | 4 | rand001 | -61.29 | KMSP>STENT 798/737/724 |
| wide | 40 | KSFO-KLAS | 1 | rand008 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 40 | KCLT-KSAN | 7 | rand009 | -32.84 | CHOPZ>INK 1018/986/986 |
| wide | 40 | KCLT-KSAN | 4 | rand002 | -10.27 | TXK>SSO 774/764/764 |
| wide | 40 | KATL-KIAD | 3 | rand014 | -73.17 | KATL>RIC255063 478/405/357 |
| wide | 40 | KDEN-KBNA | 7 | rand015 | -111.74 | KDEN>FAM261069 750/638/620 |
| wide | 40 | KLAS-KDFW | 5 | rand016 | -0.91 | GUP>VKTRY 572/571/566 |
| wide | 40 | KMDW-KCLT | 4 | rand010 | -90.01 | KMDW>SOT031071 495/405/393 |
| wide | 40 | KPHX-KAUS | 0 | rand011 | -16.31 | PXR>UCOKA 629/612/612 |
| wide | 40 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| wide | 40 | KDCA-KPHX | 2 | rand018 | -18.72 | IIU>IRW 621/603/597 |
| wide | 40 | KLGA-KDEN | 0 | rand031 | -4.06 | MIKYG>OATHE 1195/1191/1189 |
| wide | 40 | KLAX-KBOS | 7 | rand023 | -2.39 | EKR>BAE 901/898/893 |
| wide | 40 | KLAS-KDFW | 7 | rand033 | -115.82 | KLAS>INK 770/654/640 |
| wide | 40 | KLAX-KAUS | 0 | rand036 | -14.44 | BLH>UCOKA 766/752/751 |
| wide | 40 | KMDW-KLGA | 0 | rand045 | -18.46 | DJB>MIP 339/321/247 |
| wide | 40 | KLGA-KSEA | 2 | rand047 | -47.70 | MIKYG>HCT 1180/1132/1132 |
| wide | 40 | KSLC-KIAH | 5 | rand049 | -9.48 | TCH031005>DRLLR 1026/1016/1008 |
| wide | 40 | KTPA-KSLC | 0 | rand050 | -2.27 | JAWJA>FSM 622/619/611 |
| wide | 40 | KDFW-KSFO | 7 | rand055 | -3.18 | HULZE>OAL 902/899/885 |
| wide | 40 | KLAX-KBOS | 5 | rand057 | -8.54 | SLN>KLYNE 671/662/662 |
| wide | 40 | KSEA-KFLL | 4 | rand065 | -45.43 | MCI>ACORI 671/625/625 |
| wide | 40 | KMDW-KBWI | 0 | rand066 | -22.02 | KMDW>LUNDY 445/423/411 |
| wide | 40 | KEWR-KSEA | 1 | rand060 | -7.13 | NOSIK>MLP 1418/1411/1411 |
| wide | 40 | KLGA-KTPA | 4 | rand069 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 40 | KJFK-KMIA | 1 | rand062 | -5.38 | WAVEY>KMIA 948/943/936 |
| wide | 40 | KDEN-KMDW | 7 | rand070 | -3.24 | HCT>KMDW 605/602/596 |
| wide | 40 | KMSP-KJFK | 4 | rand071 | -29.16 | FNT>STENT 374/345/301 |
| wide | 40 | KORD-KCLT | 2 | rand067 | -87.87 | KORD>FILPZ 562/474/473 |
| wide | 40 | KATL-KIAD | 1 | rand068 | -101.54 | KATL>RIC229062 478/376/355 |
| wide | 40 | KTPA-KSLC | 0 | rand074 | -6.91 | JAWJA>PER 783/776/772 |
| wide | 40 | KDTW-KMCO | 2 | rand077 | -16.37 | SVM169033>TEUFL 626/609/609 |
| wide | 40 | KSLC-KMSP | 0 | rand095 | -7.27 | TCH069060>UFFDA 680/672/671 |
| wide | 40 | KPHX-KAUS | 6 | rand096 | -18.78 | PXR>UCOKA 632/613/612 |
| wide | 40 | KDEN-KBNA | 7 | rand091 | -103.46 | KDEN>RYYMN 974/871/839 |
| wide | 40 | KDCA-KPHX | 5 | rand092 | -5.74 | LAJUG>ABQ 950/944/944 |
| wide | 40 | KTPA-KSLC | 1 | rand104 | -0.18 | CTY303025>HBU 1280/1280/1270 |
| wide | 40 | KLAX-KAUS | 6 | rand105 | -3.90 | BXK110038>DILLO 719/715/690 |
| wide | 40 | KMCO-KPHL | 1 | rand100 | -5.67 | KMCO>ORF235018 589/584/555 |
| wide | 40 | KMSP-KJFK | 1 | rand101 | -34.38 | DLL>DAFLU 391/356/317 |
| wide | 40 | KSEA-KIAH | 6 | rand112 | -10.39 | KSEA>MQP 1424/1413/1413 |
| wide | 40 | KMSP-KJFK | 5 | rand118 | -111.81 | KMSP>JHW282063 694/582/569 |
| wide | 40 | KSLC-KDEN | 0 | rand116 | -5.01 | TCH>KDEN 366/361/337 |
| wide | 40 | KDEN-KBNA | 7 | rand121 | -111.05 | KDEN>FAM261069 750/639/620 |
| wide | 40 | KMSP-KORD | 4 | rand128 | -12.10 | KMSP>KORD 304/292/290 |
| wide | 40 | KMSP-KORD | 2 | rand120 | -23.64 | KMSP>FYTTE 294/270/248 |
| wide | 40 | KFLL-KSAN | 3 | rand133 | -32.39 | ROZZI>DAS 497/465/431 |
| wide | 40 | KATL-KIAD | 1 | rand130 | -150.74 | KATL>KIAD 615/464/464 |
| wide | 40 | KDTW-KMCO | 7 | rand137 | -101.15 | KDTW>SZW049067 774/673/661 |
| wide | 40 | KFLL-KSAN | 4 | rand136 | -183.00 | LEV>HOGGZ 1453/1270/1245 |
| wide | 40 | KMDW-KBWI | 1 | rand140 | -2.15 | ANEWA>KBWI 360/357/347 |
| wide | 40 | KLGA-KTPA | 4 | rand143 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 40 | KLGA-KORD | 7 | rand144 | -43.43 | KLGA>WYNDE 646/603/598 |
| wide | 40 | KLGA-KORD | 1 | rand138 | -37.69 | DJB>WATSN 289/252/173 |
| wide | 40 | KLGA-KTPA | 1 | rand139 | -28.67 | KLGA>DADES 884/855/855 |
| wide | 40 | KLAX-KDEN | 1 | rand150 | -17.52 | KLAX>KDEN 773/755/744 |
| wide | 40 | KDEN-KMDW | 4 | rand155 | -5.34 | ZIRKL>ENDEE 598/593/584 |
| wide | 40 | KMDW-KCLT | 7 | rand159 | -15.54 | EMMLY>FILPZ 400/385/385 |
| wide | 40 | KCLT-KSAN | 5 | rand160 | -10.27 | TXK>SSO 774/764/764 |
| wide | 40 | KMDW-KCLT | 3 | rand162 | -75.82 | KMDW>VXV351045 444/368/355 |
| wide | 40 | KEWR-KORD | 2 | rand158 | -7.16 | KEWR>WYNDE 600/593/586 |
| wide | 40 | KCLT-KSAN | 1 | rand165 | -19.04 | CHOPZ>SJT 874/855/855 |
| wide | 40 | KCLT-KSAN | 4 | rand166 | -23.62 | TXK>GBN 951/927/927 |
| wide | 40 | KLGA-KDEN | 7 | rand176 | -2.15 | NEWEL>KDEN 1337/1335/1333 |
| wide | 40 | KFLL-KSAN | 1 | rand169 | -57.24 | KFLL>CWK112048 1004/947/909 |
| wide | 40 | KMDW-KCLT | 1 | rand179 | -23.77 | KMDW>FILPZ 483/460/460 |
| wide | 40 | KLAX-KAUS | 4 | rand173 | -35.64 | TRM>FST 732/696/684 |
| wide | 40 | KMCO-KPHL | 4 | rand178 | -27.88 | KMCO>JIIMS 768/740/740 |
| wide | 40 | KSLC-KMSP | 3 | rand184 | -108.55 | OCS>TORGY 772/664/664 |
| wide | 40 | KDCA-KPHX | 6 | rand187 | -55.69 | HUMBO>EAGUL 1108/1052/1051 |
| wide | 40 | KMDW-KCLT | 2 | rand190 | -9.41 | EMMLY>FILPZ 400/391/385 |
| wide | 40 | KDCA-KPHX | 7 | rand183 | -101.16 | DACOS>IRW 760/659/659 |
| wide | 40 | KMDW-KCLT | 1 | rand195 | -10.27 | KMDW>FILPZ 483/473/460 |
| wide | 40 | KEWR-KORD | 4 | rand191 | -2.52 | KEWR>WYNDE 600/598/586 |
| wide | 40 | KCLT-KSAN | 0 | rand192 | -0.72 | CHOPZ>LFK 584/583/578 |
| wide | 40 | KSEA-KIAH | 7 | rand197 | -24.81 | KSEA>MQP 1438/1413/1413 |
| wide | 40 | KLGA-KTPA | 3 | rand194 | -39.81 | KLGA>WIGVO 676/637/637 |
| hug | 50 | KSFO-KLAS | 1 | rand008 | -38.53 | LOSHN>MISEN 219/180/180 |
| hug | 50 | KMSP-KJFK | 4 | rand001 | -60.24 | KMSP>HOXIE 765/705/691 |
| hug | 50 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| hug | 50 | KLAS-KDFW | 7 | rand033 | -87.94 | KLAS>CNX 577/489/472 |
| hug | 50 | KJFK-KMIA | 1 | rand062 | -2.47 | EMJAY>HOAGG 687/685/680 |
| hug | 50 | KMDW-KBWI | 0 | rand066 | -15.46 | KMDW>ZZV031040 327/311/293 |
| hug | 50 | KORD-KCLT | 2 | rand067 | -13.25 | CVG>SKYWA 206/193/152 |
| hug | 50 | KDEN-KBNA | 7 | rand091 | -92.48 | KDEN>RANTS 930/837/796 |
| hug | 50 | KMSP-KORD | 4 | rand128 | -1.02 | FGT>FYTTE 247/246/238 |
| hug | 50 | KATL-KIAD | 1 | rand130 | -87.20 | KATL>CAVLR 572/485/435 |
| hug | 50 | KLGA-KORD | 7 | rand144 | -22.00 | KLGA>LTOUR 547/525/506 |
| wide | 50 | KMSP-KJFK | 4 | rand001 | -61.29 | KMSP>STENT 798/737/724 |
| wide | 50 | KSFO-KLAS | 1 | rand008 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 50 | KMDW-KCLT | 4 | rand010 | -90.01 | KMDW>SOT031071 495/405/393 |
| wide | 50 | KCLT-KSAN | 4 | rand002 | -10.27 | TXK>SSO 774/764/764 |
| wide | 50 | KCLT-KSAN | 7 | rand009 | -32.84 | CHOPZ>INK 1018/986/986 |
| wide | 50 | KATL-KIAD | 3 | rand014 | -73.17 | KATL>RIC255063 478/405/357 |
| wide | 50 | KDEN-KBNA | 7 | rand015 | -111.74 | KDEN>FAM261069 750/638/620 |
| wide | 50 | KLAS-KDFW | 5 | rand016 | -0.91 | GUP>VKTRY 572/571/566 |
| wide | 50 | KPHX-KAUS | 0 | rand011 | -16.31 | PXR>UCOKA 629/612/612 |
| wide | 50 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| wide | 50 | KDCA-KPHX | 2 | rand018 | -18.72 | IIU>IRW 621/603/597 |
| wide | 50 | KLAX-KBOS | 7 | rand023 | -2.39 | EKR>BAE 901/898/893 |
| wide | 50 | KLAS-KDFW | 7 | rand033 | -115.82 | KLAS>INK 770/654/640 |
| wide | 50 | KLAX-KAUS | 0 | rand036 | -11.41 | BLH>UCOKA 766/755/751 |
| wide | 50 | KLGA-KDEN | 0 | rand031 | -4.06 | MIKYG>OATHE 1195/1191/1189 |
| wide | 50 | KSLC-KIAH | 5 | rand049 | -9.48 | TCH031005>DRLLR 1026/1016/1008 |
| wide | 50 | KMDW-KLGA | 0 | rand045 | -18.46 | DJB>MIP 339/321/247 |
| wide | 50 | KLGA-KSEA | 2 | rand047 | -47.70 | MIKYG>HCT 1180/1132/1132 |
| wide | 50 | KDFW-KSFO | 7 | rand055 | -3.18 | HULZE>OAL 902/899/885 |
| wide | 50 | KLAX-KBOS | 5 | rand057 | -8.54 | SLN>KLYNE 671/662/662 |
| wide | 50 | KTPA-KSLC | 0 | rand050 | -2.27 | JAWJA>FSM 622/619/611 |
| wide | 50 | KJFK-KMIA | 1 | rand062 | -7.07 | WAVEY>KMIA 948/941/936 |
| wide | 50 | KSEA-KFLL | 4 | rand065 | -45.43 | MCI>ACORI 671/625/625 |
| wide | 50 | KMDW-KBWI | 0 | rand066 | -22.02 | KMDW>LUNDY 445/423/411 |
| wide | 50 | KORD-KCLT | 2 | rand067 | -87.87 | KORD>FILPZ 562/474/473 |
| wide | 50 | KEWR-KSEA | 1 | rand060 | -7.13 | NOSIK>MLP 1418/1411/1411 |
| wide | 50 | KDEN-KMDW | 7 | rand070 | -3.24 | HCT>KMDW 605/602/596 |
| wide | 50 | KMSP-KJFK | 4 | rand071 | -29.16 | FNT>STENT 374/345/301 |
| wide | 50 | KATL-KIAD | 1 | rand068 | -94.01 | KATL>RIC229062 478/384/355 |
| wide | 50 | KDTW-KMCO | 2 | rand077 | -16.37 | SVM169033>TEUFL 626/609/609 |
| wide | 50 | KLGA-KTPA | 4 | rand069 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 50 | KTPA-KSLC | 0 | rand074 | -6.91 | JAWJA>PER 783/776/772 |
| wide | 50 | KDCA-KPHX | 5 | rand092 | -5.74 | LAJUG>ABQ 950/944/944 |
| wide | 50 | KSLC-KMSP | 0 | rand095 | -7.27 | TCH069060>UFFDA 680/672/671 |
| wide | 50 | KPHX-KAUS | 6 | rand096 | -18.78 | PXR>UCOKA 632/613/612 |
| wide | 50 | KDEN-KBNA | 7 | rand091 | -103.46 | KDEN>RYYMN 974/871/839 |
| wide | 50 | KMCO-KPHL | 1 | rand100 | -9.08 | KMCO>ORF235018 589/580/555 |
| wide | 50 | KMSP-KJFK | 1 | rand101 | -34.38 | DLL>DAFLU 391/356/317 |
| wide | 50 | KTPA-KSLC | 1 | rand104 | -0.18 | CTY303025>HBU 1280/1280/1270 |
| wide | 50 | KLAX-KAUS | 6 | rand105 | -3.89 | BXK110038>DILLO 719/715/690 |
| wide | 50 | KSEA-KIAH | 6 | rand112 | -10.39 | KSEA>MQP 1424/1413/1413 |
| wide | 50 | KMSP-KJFK | 5 | rand118 | -111.81 | KMSP>JHW282063 694/582/569 |
| wide | 50 | KMSP-KORD | 2 | rand120 | -23.98 | KMSP>FYTTE 294/270/248 |
| wide | 50 | KSLC-KDEN | 0 | rand116 | -5.01 | TCH>KDEN 366/361/337 |
| wide | 50 | KDEN-KBNA | 7 | rand121 | -111.05 | KDEN>FAM261069 750/639/620 |
| wide | 50 | KMSP-KORD | 4 | rand128 | -10.03 | KMSP>KORD 304/294/290 |
| wide | 50 | KATL-KIAD | 1 | rand130 | -150.74 | KATL>KIAD 615/464/464 |
| wide | 50 | KFLL-KSAN | 3 | rand133 | -32.39 | ROZZI>DAS 497/465/431 |
| wide | 50 | KDTW-KMCO | 7 | rand137 | -101.15 | KDTW>SZW049067 774/673/661 |
| wide | 50 | KLGA-KORD | 1 | rand138 | -37.69 | DJB>WATSN 289/252/173 |
| wide | 50 | KMDW-KBWI | 1 | rand140 | -2.15 | ANEWA>KBWI 360/357/347 |
| wide | 50 | KLGA-KTPA | 4 | rand143 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 50 | KLGA-KORD | 7 | rand144 | -43.43 | KLGA>WYNDE 646/603/598 |
| wide | 50 | KLGA-KTPA | 1 | rand139 | -28.67 | KLGA>DADES 884/855/855 |
| wide | 50 | KFLL-KSAN | 4 | rand136 | -161.53 | LEV>HOGGZ 1453/1292/1245 |
| wide | 50 | KLAX-KDEN | 1 | rand150 | -17.52 | KLAX>KDEN 773/755/744 |
| wide | 50 | KEWR-KORD | 2 | rand158 | -7.16 | KEWR>WYNDE 600/593/586 |
| wide | 50 | KMDW-KCLT | 7 | rand159 | -15.54 | EMMLY>FILPZ 400/385/385 |
| wide | 50 | KCLT-KSAN | 5 | rand160 | -10.27 | TXK>SSO 774/764/764 |
| wide | 50 | KMDW-KCLT | 3 | rand162 | -75.82 | KMDW>VXV351045 444/368/355 |
| wide | 50 | KDEN-KMDW | 4 | rand155 | -5.34 | ZIRKL>ENDEE 598/593/584 |
| wide | 50 | KCLT-KSAN | 4 | rand166 | -23.62 | TXK>GBN 951/927/927 |
| wide | 50 | KCLT-KSAN | 1 | rand165 | -19.04 | CHOPZ>SJT 874/855/855 |
| wide | 50 | KLAX-KAUS | 4 | rand173 | -36.02 | TRM>FST 732/696/684 |
| wide | 50 | KLGA-KDEN | 7 | rand176 | -2.15 | NEWEL>KDEN 1337/1335/1333 |
| wide | 50 | KFLL-KSAN | 1 | rand169 | -57.24 | KFLL>CWK112048 1004/947/909 |
| wide | 50 | KMDW-KCLT | 1 | rand179 | -23.77 | KMDW>FILPZ 483/460/460 |
| wide | 50 | KMCO-KPHL | 4 | rand178 | -27.88 | KMCO>JIIMS 768/740/740 |
| wide | 50 | KSLC-KMSP | 3 | rand184 | -108.55 | OCS>TORGY 772/664/664 |
| wide | 50 | KMDW-KCLT | 2 | rand190 | -9.41 | EMMLY>FILPZ 400/391/385 |
| wide | 50 | KEWR-KORD | 4 | rand191 | -2.52 | KEWR>WYNDE 600/598/586 |
| wide | 50 | KCLT-KSAN | 0 | rand192 | -0.72 | CHOPZ>LFK 584/583/578 |
| wide | 50 | KDCA-KPHX | 6 | rand187 | -55.69 | HUMBO>EAGUL 1108/1052/1051 |
| wide | 50 | KDCA-KPHX | 7 | rand183 | -101.16 | DACOS>IRW 760/659/659 |
| wide | 50 | KMDW-KCLT | 1 | rand195 | -10.27 | KMDW>FILPZ 483/473/460 |
| wide | 50 | KLGA-KTPA | 3 | rand194 | -39.81 | KLGA>WIGVO 676/637/637 |
| wide | 50 | KSEA-KIAH | 7 | rand197 | -24.81 | KSEA>MQP 1438/1413/1413 |
