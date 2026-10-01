# SLAAC snapped-plan gate

Generated 2026-09-30 by `scripts/slaac/gate.py` (owner's pipeline, imported by path).

## Cases

- Library: 373 routes.
- Launch preset (all 6 polygons at once): 80 affected routes, 293 skipped (no leg within 25 nm).
- Random: 200 cases from `eval_sua.build_cases` (seed 0, 363 eligible routes after its CONUS / 300-2500 nm / >=4-fix filters), 0 skipped.
- Policies hug (1-waypoint) and wide (infinite lookahead), margin 25 nm, clear_margin 25 nm.
- exceptions count as not clear; medians over runs without exceptions.
- Inputs: launch-sua.json sha256 `06ae3ca77f5931e6eb0cdbcf348c82160fd3912ba6e0498462e8bcfa33280b63`, routes.json sha256 `427f4f86935c7b1746115cf75b9c9c984f30d6a5cda0872d5317b8829eadc5cf`, options sha256 `09d8c4ff6ee9f6b5beebf45ec15a64d8b902c6628afd53d14edfff1633a95825`.
- Sweep: 2240 runs, 927.8 s wall.
- Anchor-chord column: anchor-chord invariant (0 by construction): a polyline is never shorter than the chord between its own ends, so this count cannot be nonzero; kept in the ladder per R9, not a test (R11).

## All cases

| policy | steps | n | leg-clear % | clear at margin % | added nm (med) | added % (med) | min clearance nm (med) | anchor-chord invariant (0 by construction) | shorter than filed | exceptions | t_gen s (med) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| hug | 20 | 280 | 99.64 | 86.07 | 27.2 | 2.73 | 31.7 | 0 | 12 | 0 | 1.100 |
| hug | 30 | 280 | 99.64 | 87.14 | 26.8 | 2.59 | 31.7 | 0 | 19 | 0 | 2.166 |
| hug | 40 | 280 | 99.64 | 89.29 | 27.2 | 2.59 | 31.7 | 0 | 18 | 0 | 2.867 |
| hug | 50 | 280 | 99.64 | 86.43 | 26.5 | 2.58 | 31.2 | 0 | 14 | 0 | 3.618 |
| wide | 20 | 280 | 99.29 | 85.36 | 8.1 | 0.64 | 32.5 | 0 | 90 | 0 | 1.382 |
| wide | 30 | 280 | 99.29 | 82.86 | 7.9 | 0.63 | 32.3 | 0 | 89 | 0 | 2.112 |
| wide | 40 | 280 | 99.29 | 85.36 | 8.2 | 0.64 | 33.8 | 0 | 89 | 0 | 2.851 |
| wide | 50 | 280 | 99.29 | 82.50 | 8.3 | 0.65 | 33.3 | 0 | 89 | 0 | 3.500 |

## launch cases only

| policy | steps | n | leg-clear % | clear at margin % | added nm (med) | min clearance nm (med) | anchor-chord invariant (0 by construction) | shorter than filed | exceptions |
|---|---|---|---|---|---|---|---|---|---|
| hug | 20 | 80 | 100.00 | 68.75 | 38.8 | 25.1 | 0 | 0 | 0 |
| hug | 30 | 80 | 100.00 | 76.25 | 28.5 | 25.6 | 0 | 5 | 0 |
| hug | 40 | 80 | 100.00 | 77.50 | 28.5 | 26.0 | 0 | 5 | 0 |
| hug | 50 | 80 | 100.00 | 70.00 | 28.5 | 25.7 | 0 | 1 | 0 |
| wide | 20 | 80 | 100.00 | 65.00 | 8.5 | 26.3 | 0 | 25 | 0 |
| wide | 30 | 80 | 100.00 | 60.00 | 9.8 | 26.2 | 0 | 24 | 0 |
| wide | 40 | 80 | 100.00 | 70.00 | 7.2 | 26.3 | 0 | 25 | 0 |
| wide | 50 | 80 | 100.00 | 58.75 | 7.2 | 26.3 | 0 | 26 | 0 |

## random cases only

| policy | steps | n | leg-clear % | clear at margin % | added nm (med) | min clearance nm (med) | anchor-chord invariant (0 by construction) | shorter than filed | exceptions |
|---|---|---|---|---|---|---|---|---|---|
| hug | 20 | 200 | 99.50 | 93.00 | 25.8 | 34.1 | 0 | 12 | 0 |
| hug | 30 | 200 | 99.50 | 91.50 | 25.7 | 33.2 | 0 | 14 | 0 |
| hug | 40 | 200 | 99.50 | 94.00 | 26.2 | 33.4 | 0 | 13 | 0 |
| hug | 50 | 200 | 99.50 | 93.00 | 25.6 | 33.3 | 0 | 13 | 0 |
| wide | 20 | 200 | 99.00 | 93.50 | 8.1 | 35.9 | 0 | 65 | 0 |
| wide | 30 | 200 | 99.00 | 92.00 | 7.9 | 35.9 | 0 | 65 | 0 |
| wide | 40 | 200 | 99.00 | 91.50 | 8.2 | 37.1 | 0 | 64 | 0 |
| wide | 50 | 200 | 99.00 | 92.00 | 8.3 | 37.2 | 0 | 63 | 0 |

## Decision

- steps 20 hug: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.06 nm <= 2.72 (10%) yes; |median clearance diff| 0.00 <= 2 nm yes -> acceptable
- steps 20 wide: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.11 nm <= 0.82 (10%) yes; |median clearance diff| 1.29 <= 2 nm yes -> acceptable
- steps 20: ACCEPTABLE (both policies)
- steps 30 hug: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.35 nm <= 2.72 (10%) yes; |median clearance diff| 0.03 <= 2 nm yes -> acceptable
- steps 30 wide: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.24 nm <= 0.82 (10%) yes; |median clearance diff| 1.53 <= 2 nm yes -> acceptable
- steps 30: ACCEPTABLE (both policies)
- steps 40 hug: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.00 nm <= 2.72 (10%) yes; |median clearance diff| 0.00 <= 2 nm yes -> acceptable
- steps 40 wide: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.00 nm <= 0.82 (10%) yes; |median clearance diff| 0.00 <= 2 nm yes -> acceptable
- steps 40: ACCEPTABLE (both policies)
- steps 50 hug: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.70 nm <= 2.72 (10%) yes; |median clearance diff| 0.44 <= 2 nm yes -> acceptable
- steps 50 wide: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.12 nm <= 0.82 (10%) yes; |median clearance diff| 0.58 <= 2 nm yes -> acceptable
- steps 50: ACCEPTABLE (both policies)
- chosen_steps = smallest acceptable = 20
- hug @ 20: leg-clear 99.64% >= 98.0%: yes
- hug @ 20: exceptions 0 == 0: yes
- hug @ 20: anchor-chord invariant 0 == 0 (0 by construction, not a test): yes
- hug @ 20: PASSES
- wide @ 20: leg-clear 99.29% >= 99.0%: yes
- wide @ 20: exceptions 0 == 0: yes
- wide @ 20: anchor-chord invariant 0 == 0 (0 by construction, not a test): yes
- wide @ 20: PASSES
- hug and wide both pass -> display snapped, policies [wide, hug]
- display = snapped

**chosen_steps = 20, display = snapped, policies = ['wide', 'hug']**

## Failing runs (legs crossing > 0 or exception)

| policy | steps | kind | pair | route | polygon | legs crossing | stage / exception |
|---|---|---|---|---|---|---|---|
| hug | 20 | random | KJFK-KMIA | 4 | rand121 | 1 | snapping/repair |
| wide | 20 | random | KPHX-KAUS | 2 | rand018 | 1 | snapping/repair |
| wide | 20 | random | KJFK-KMIA | 4 | rand121 | 1 | snapping/repair |
| hug | 30 | random | KJFK-KMIA | 4 | rand121 | 1 | snapping/repair |
| wide | 30 | random | KPHX-KAUS | 2 | rand018 | 1 | snapping/repair |
| wide | 30 | random | KJFK-KMIA | 4 | rand121 | 1 | snapping/repair |
| hug | 40 | random | KJFK-KMIA | 4 | rand121 | 1 | snapping/repair |
| wide | 40 | random | KPHX-KAUS | 2 | rand018 | 1 | snapping/repair |
| wide | 40 | random | KJFK-KMIA | 4 | rand121 | 1 | snapping/repair |
| hug | 50 | random | KJFK-KMIA | 4 | rand121 | 1 | snapping/repair |
| wide | 50 | random | KPHX-KAUS | 2 | rand018 | 1 | snapping/repair |
| wide | 50 | random | KJFK-KMIA | 4 | rand121 | 1 | snapping/repair |

## Plans shorter than the filed route (information only, ruling R8)

Each replaced stretch: filed length between the anchors / plan length / straight chord (nm).

| policy | steps | pair | route | polygon | added nm | stretches |
|---|---|---|---|---|---|---|
| wide | 20 | KFLL-KSAN | 3 | launch-preset | -12.29 | MAF>SSO 370/358/358 |
| wide | 20 | KMCO-KPHL | 1 | launch-preset | -2.07 | KMCO>KPHL 766/764/753 |
| wide | 20 | KMCO-KPHL | 2 | launch-preset | -12.30 | KMCO>KPHL 776/764/753 |
| wide | 20 | KMCO-KPHL | 3 | launch-preset | -27.82 | KMCO>KPHL 792/764/753 |
| wide | 20 | KMCO-KPHL | 4 | launch-preset | -27.82 | KMCO>KPHL 792/764/753 |
| wide | 20 | KMCO-KPHL | 0 | launch-preset | -2.76 | KMCO>KPHL 767/764/753 |
| wide | 20 | KMCO-KPHL | 6 | launch-preset | -30.40 | KMCO>KPHL 794/764/753 |
| wide | 20 | KDTW-KMCO | 1 | launch-preset | -6.73 | TEUFL>KMCO 218/211/210 |
| wide | 20 | KMCO-KPHL | 5 | launch-preset | -27.82 | KMCO>KPHL 792/764/753 |
| wide | 20 | KDTW-KMCO | 3 | launch-preset | -3.66 | AMG163024>KMCO 177/174/173 |
| wide | 20 | KMCO-KPHL | 7 | launch-preset | -27.82 | KMCO>KPHL 792/764/753 |
| wide | 20 | KDTW-KMCO | 0 | launch-preset | -2.22 | GNV349047>KMCO 138/136/136 |
| wide | 20 | KDTW-KMCO | 2 | launch-preset | -6.73 | TEUFL>KMCO 218/211/210 |
| wide | 20 | KDTW-KMCO | 5 | launch-preset | -6.73 | TEUFL>KMCO 218/211/210 |
| wide | 20 | KDTW-KMCO | 6 | launch-preset | -6.73 | TEUFL>KMCO 218/211/210 |
| wide | 20 | KDTW-KMCO | 4 | launch-preset | -6.73 | TEUFL>KMCO 218/211/210 |
| wide | 20 | KPHX-KAUS | 1 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 20 | KPHX-KAUS | 5 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 20 | KPHX-KAUS | 6 | launch-preset | -5.35 | PXR148014>UCOKA 618/613/604 |
| wide | 20 | KPHX-KBNA | 5 | launch-preset | -3.28 | PHASE>MHZ 969/965/959 |
| wide | 20 | KPHX-KAUS | 0 | launch-preset | -11.07 | PXR115025>UCOKA 604/593/589 |
| wide | 20 | KCLT-KSAN | 4 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 20 | KPHX-KAUS | 2 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 20 | KCLT-KSAN | 5 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 20 | KSEA-KFLL | 3 | launch-preset | -28.74 | OTK>KFLL 356/327/327 |
| hug | 30 | KMCO-KPHL | 2 | launch-preset | -0.03 | KMCO>JIIMS 753/753/740 |
| hug | 30 | KMCO-KPHL | 4 | launch-preset | -0.50 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 30 | KMCO-KPHL | 3 | launch-preset | -0.50 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 30 | KMCO-KPHL | 5 | launch-preset | -0.50 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 30 | KMCO-KPHL | 7 | launch-preset | -0.50 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| wide | 30 | KFLL-KSAN | 3 | launch-preset | -12.29 | MAF>SSO 370/358/358 |
| wide | 30 | KFLL-KSAN | 4 | launch-preset | -2.28 | KFLL>GBN 1742/1739/1739 |
| wide | 30 | KMCO-KPHL | 2 | launch-preset | -13.98 | KMCO>KPHL 776/762/753 |
| wide | 30 | KMCO-KPHL | 4 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 30 | KMCO-KPHL | 3 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 30 | KMCO-KPHL | 5 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 30 | KMCO-KPHL | 6 | launch-preset | -32.08 | KMCO>KPHL 794/762/753 |
| wide | 30 | KMCO-KPHL | 0 | launch-preset | -4.44 | KMCO>KPHL 767/762/753 |
| wide | 30 | KLAX-KAUS | 0 | launch-preset | -10.02 | TFD>UCOKA 618/608/606 |
| wide | 30 | KMCO-KPHL | 1 | launch-preset | -3.75 | KMCO>KPHL 766/762/753 |
| wide | 30 | KDTW-KMCO | 0 | launch-preset | -2.22 | GNV349047>KMCO 138/136/136 |
| wide | 30 | KDTW-KMCO | 3 | launch-preset | -3.73 | AMG163024>KMCO 177/174/173 |
| wide | 30 | KMCO-KPHL | 7 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 30 | KDTW-KMCO | 4 | launch-preset | -6.96 | TEUFL>KMCO 218/211/210 |
| wide | 30 | KDTW-KMCO | 2 | launch-preset | -6.96 | TEUFL>KMCO 218/211/210 |
| wide | 30 | KDTW-KMCO | 6 | launch-preset | -6.96 | TEUFL>KMCO 218/211/210 |
| wide | 30 | KPHX-KAUS | 0 | launch-preset | -5.36 | PXR115025>UCOKA 604/599/589 |
| wide | 30 | KPHX-KAUS | 4 | launch-preset | -5.34 | PXR136019>UCOKA 612/607/598 |
| wide | 30 | KLAX-KAUS | 5 | launch-preset | -10.02 | TFD>UCOKA 618/608/606 |
| wide | 30 | KDTW-KMCO | 1 | launch-preset | -6.96 | TEUFL>KMCO 218/211/210 |
| wide | 30 | KSEA-KFLL | 3 | launch-preset | -28.74 | OTK>KFLL 356/327/327 |
| wide | 30 | KDTW-KMCO | 5 | launch-preset | -6.96 | TEUFL>KMCO 218/211/210 |
| wide | 30 | KCLT-KSAN | 4 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 30 | KCLT-KSAN | 5 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| hug | 40 | KMCO-KPHL | 2 | launch-preset | -0.04 | KMCO>JIIMS 753/753/740 |
| hug | 40 | KMCO-KPHL | 4 | launch-preset | -0.17 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 40 | KMCO-KPHL | 3 | launch-preset | -0.17 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 40 | KMCO-KPHL | 5 | launch-preset | -0.17 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 40 | KMCO-KPHL | 7 | launch-preset | -0.17 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| wide | 40 | KMCO-KPHL | 0 | launch-preset | -4.44 | KMCO>KPHL 767/762/753 |
| wide | 40 | KFLL-KSAN | 3 | launch-preset | -12.29 | MAF>SSO 370/358/358 |
| wide | 40 | KMCO-KPHL | 1 | launch-preset | -3.75 | KMCO>KPHL 766/762/753 |
| wide | 40 | KMCO-KPHL | 3 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 40 | KMCO-KPHL | 4 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 40 | KMCO-KPHL | 6 | launch-preset | -32.08 | KMCO>KPHL 794/762/753 |
| wide | 40 | KMCO-KPHL | 7 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 40 | KLAX-KAUS | 0 | launch-preset | -10.02 | TFD>UCOKA 618/608/606 |
| wide | 40 | KMCO-KPHL | 5 | launch-preset | -29.50 | KMCO>KPHL 792/762/753 |
| wide | 40 | KMCO-KPHL | 2 | launch-preset | -13.98 | KMCO>KPHL 776/762/753 |
| wide | 40 | KDTW-KMCO | 1 | launch-preset | -7.13 | TEUFL>KMCO 218/211/210 |
| wide | 40 | KDTW-KMCO | 0 | launch-preset | -2.22 | GNV349047>KMCO 138/136/136 |
| wide | 40 | KFLL-KSAN | 4 | launch-preset | -1.13 | KFLL>GBN 1742/1741/1739 |
| wide | 40 | KLAX-KAUS | 5 | launch-preset | -10.02 | TFD>UCOKA 618/608/606 |
| wide | 40 | KDTW-KMCO | 2 | launch-preset | -7.13 | TEUFL>KMCO 218/211/210 |
| wide | 40 | KDTW-KMCO | 6 | launch-preset | -7.13 | TEUFL>KMCO 218/211/210 |
| wide | 40 | KPHX-KAUS | 1 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 40 | KDTW-KMCO | 3 | launch-preset | -3.67 | AMG163024>KMCO 177/174/173 |
| wide | 40 | KDTW-KMCO | 4 | launch-preset | -7.13 | TEUFL>KMCO 218/211/210 |
| wide | 40 | KDTW-KMCO | 5 | launch-preset | -7.13 | TEUFL>KMCO 218/211/210 |
| wide | 40 | KSEA-KFLL | 3 | launch-preset | -28.74 | OTK>KFLL 356/327/327 |
| wide | 40 | KCLT-KSAN | 5 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 40 | KPHX-KAUS | 2 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 40 | KPHX-KAUS | 5 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 40 | KCLT-KSAN | 4 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| hug | 50 | KMCO-KPHL | 2 | launch-preset | -2.09 | KMCO>JIIMS 753/750/740 |
| wide | 50 | KMCO-KPHL | 2 | launch-preset | -12.38 | KMCO>KPHL 776/764/753 |
| wide | 50 | KFLL-KSAN | 3 | launch-preset | -12.29 | MAF>SSO 370/358/358 |
| wide | 50 | KMCO-KPHL | 3 | launch-preset | -27.91 | KMCO>KPHL 792/764/753 |
| wide | 50 | KMCO-KPHL | 4 | launch-preset | -27.91 | KMCO>KPHL 792/764/753 |
| wide | 50 | KMCO-KPHL | 0 | launch-preset | -2.84 | KMCO>KPHL 767/764/753 |
| wide | 50 | KMCO-KPHL | 6 | launch-preset | -30.49 | KMCO>KPHL 794/764/753 |
| wide | 50 | KMCO-KPHL | 7 | launch-preset | -27.91 | KMCO>KPHL 792/764/753 |
| wide | 50 | KMCO-KPHL | 1 | launch-preset | -2.16 | KMCO>KPHL 766/764/753 |
| wide | 50 | KDTW-KMCO | 0 | launch-preset | -2.22 | GNV349047>KMCO 138/136/136 |
| wide | 50 | KMCO-KPHL | 5 | launch-preset | -27.91 | KMCO>KPHL 792/764/753 |
| wide | 50 | KDTW-KMCO | 3 | launch-preset | -3.71 | AMG163024>KMCO 177/174/173 |
| wide | 50 | KDTW-KMCO | 1 | launch-preset | -3.54 | TEUFL>KMCO 218/215/210 |
| wide | 50 | KFLL-KSAN | 4 | launch-preset | -1.21 | KFLL>GBN 1742/1740/1739 |
| wide | 50 | KDTW-KMCO | 4 | launch-preset | -3.54 | TEUFL>KMCO 218/215/210 |
| wide | 50 | KDTW-KMCO | 6 | launch-preset | -3.54 | TEUFL>KMCO 218/215/210 |
| wide | 50 | KDTW-KMCO | 5 | launch-preset | -3.54 | TEUFL>KMCO 218/215/210 |
| wide | 50 | KPHX-KAUS | 0 | launch-preset | -5.44 | PXR115025>UCOKA 604/598/589 |
| wide | 50 | KPHX-KAUS | 2 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 50 | KPHX-KAUS | 1 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 50 | KPHX-KAUS | 6 | launch-preset | -5.35 | PXR148014>UCOKA 618/613/604 |
| wide | 50 | KPHX-KAUS | 5 | launch-preset | -4.52 | PHASE>UCOKA 476/471/465 |
| wide | 50 | KDTW-KMCO | 2 | launch-preset | -3.54 | TEUFL>KMCO 218/215/210 |
| wide | 50 | KSEA-KFLL | 3 | launch-preset | -28.74 | OTK>KFLL 356/327/327 |
| wide | 50 | KCLT-KSAN | 4 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 50 | KPHX-KAUS | 4 | launch-preset | -5.34 | PXR136019>UCOKA 612/607/598 |
| hug | 20 | KMDW-KBWI | 5 | rand039 | -11.88 | GIJ094026>NUSMM 256/244/244 |
| hug | 20 | KDTW-KIAD | 6 | rand059 | -48.85 | SVM138032>AIR 245/196/159 |
| hug | 20 | KLGA-KDEN | 1 | rand090 | -2.33 | HOTEE>MCI 841/839/835 |
| hug | 20 | KATL-KIAD | 1 | rand095 | -13.86 | KATL>CAVLR 449/435/435 |
| hug | 20 | KMDW-KBWI | 5 | rand098 | -1.89 | JERRI>ANTHM 277/275/265 |
| hug | 20 | KSAN-KAUS | 0 | rand100 | -1.02 | ELP>DILLO 392/391/388 |
| hug | 20 | KEWR-KSEA | 2 | rand126 | -18.90 | IRK>HCT 402/383/378 |
| wide | 50 | KCLT-KSAN | 5 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| hug | 20 | KEWR-KSEA | 5 | rand147 | -33.71 | SAW>MLP 1195/1161/1161 |
| hug | 20 | KSFO-KLAS | 0 | rand179 | -35.24 | LOSHN>MISEN 219/183/180 |
| hug | 20 | KSFO-KLAS | 2 | rand183 | -38.53 | LOSHN>MISEN 219/180/180 |
| hug | 20 | KFLL-KSAN | 1 | rand187 | -48.92 | KFLL>FUSCO 1219/1170/1157 |
| hug | 20 | KEWR-KSEA | 3 | rand189 | -5.44 | SSM>HML 547/542/541 |
| wide | 20 | KJFK-KMIA | 6 | rand007 | -1.85 | KJFK>KMIA 958/956/952 |
| wide | 20 | KMSP-KJFK | 1 | rand001 | -2.69 | KMSP>STENT 734/732/724 |
| wide | 20 | KORD-KCLT | 2 | rand013 | -19.16 | KORD>FILPZ 493/474/473 |
| wide | 20 | KLGA-KORD | 5 | rand006 | -2.01 | JFK332023>WYNDE 598/595/589 |
| wide | 20 | KMDW-KBWI | 3 | rand009 | -0.46 | KMDW>KBWI 533/532/526 |
| wide | 20 | KPHX-KAUS | 0 | rand020 | -9.58 | PXR115025>LAIKS 711/702/696 |
| wide | 20 | KLAX-KBOS | 3 | rand023 | -9.03 | BLD237031>ONL 882/873/872 |
| wide | 20 | KMCO-KPHL | 2 | rand024 | -9.47 | KMCO>JIIMS 753/743/740 |
| wide | 20 | KLGA-KORD | 4 | rand038 | -2.05 | KLGA>WYNDE 607/605/598 |
| wide | 20 | KMSP-KCLT | 6 | rand033 | -7.02 | KMSP>TAFTT 651/644/642 |
| wide | 20 | KTPA-KSLC | 2 | rand041 | -6.34 | ADUKE>JNC 834/828/828 |
| wide | 20 | KMDW-KBWI | 5 | rand039 | -15.95 | KMDW>ANTHM 508/492/490 |
| wide | 20 | KDFW-KSFO | 5 | rand055 | -9.68 | KDFW>KITTN 935/926/926 |
| wide | 20 | KDTW-KIAD | 4 | rand052 | -7.79 | LIDDS>KIAD 317/310/295 |
| wide | 20 | KDTW-KIAD | 6 | rand059 | -53.87 | KDTW>MGW 313/259/225 |
| wide | 20 | KEWR-KDEN | 0 | rand053 | -4.42 | DANNR>OBH 1000/995/992 |
| wide | 20 | KMSP-KCLT | 4 | rand067 | -15.96 | MCW029064>SKYWA 605/589/588 |
| wide | 20 | KSFO-KLAS | 6 | rand073 | -18.20 | SSTIK>HELDE 323/305/299 |
| wide | 20 | KTPA-KSLC | 0 | rand079 | -0.17 | FSM>JNC 727/727/722 |
| wide | 20 | KDCA-KPHX | 6 | rand081 | -55.69 | HUMBO>EAGUL 1108/1052/1051 |
| wide | 20 | KSLC-KMSP | 0 | rand076 | -8.78 | OCS>UFFDA 599/590/590 |
| wide | 20 | KMDW-KCLT | 6 | rand084 | -9.28 | KMDW>KCLT 530/521/508 |
| wide | 20 | KMDW-KIAH | 7 | rand083 | -4.56 | BEKKI>ZEEKK 679/675/662 |
| wide | 20 | KDTW-KIAD | 5 | rand093 | -42.22 | KDTW>AIR 260/218/175 |
| wide | 20 | KATL-KIAD | 1 | rand095 | -28.47 | KATL>KIAD 492/464/464 |
| wide | 20 | KLGA-KDEN | 1 | rand090 | -8.35 | PARKE358003>OATHE 1236/1228/1222 |
| wide | 20 | KEWR-KSEA | 3 | rand101 | -18.32 | WOZEE>HML 864/845/845 |
| wide | 20 | KDTW-KMCO | 7 | rand103 | -3.24 | KDTW>GRNCH 815/812/798 |
| wide | 20 | KMDW-KBWI | 4 | rand105 | -8.88 | KMDW>ANTHM 508/499/490 |
| wide | 20 | KSAN-KAUS | 0 | rand100 | -5.24 | GBN>LAIKS 756/751/750 |
| wide | 20 | KPHX-KBNA | 5 | rand099 | -71.89 | ELP>SQS 882/810/810 |
| wide | 20 | KDEN-KMSP | 3 | rand104 | -49.59 | WYNDM>NITZR 469/420/420 |
| wide | 20 | KDCA-KPHX | 4 | rand120 | -12.50 | KDCA>EAGUL 1656/1643/1643 |
| wide | 20 | KDFW-KSFO | 1 | rand125 | -1.75 | FTI>RUMPS 609/607/596 |
| wide | 20 | KEWR-KSEA | 2 | rand126 | -46.84 | SPI>BFF 680/633/633 |
| wide | 20 | KFLL-KSAN | 3 | rand119 | -5.72 | DAS>PEQ 479/474/465 |
| wide | 20 | KDTW-KIAD | 6 | rand129 | -27.68 | ZEYOU>MGW 237/209/157 |
| wide | 20 | KMDW-KBWI | 6 | rand130 | -5.95 | LEWKE>NUSMM 316/310/300 |
| wide | 20 | KSLC-KDEN | 1 | rand127 | -20.65 | KSLC>KDEN 362/341/336 |
| wide | 20 | KSLC-KMSP | 7 | rand132 | -6.61 | KSLC>TORGY 844/838/805 |
| wide | 20 | KEWR-KSEA | 2 | rand135 | -22.13 | AIR>HCT 940/918/912 |
| wide | 20 | KTPA-KSLC | 2 | rand138 | -7.01 | KTPA>PNH 1076/1069/1067 |
| wide | 20 | KSAN-KAUS | 2 | rand136 | -0.30 | ZZOOO>FST 736/736/731 |
| wide | 20 | KEWR-KSEA | 5 | rand147 | -40.84 | KENPA>GLASR 1652/1612/1612 |
| wide | 20 | KSAN-KAUS | 3 | rand142 | -5.06 | ZZOOO>FST 736/731/731 |
| wide | 20 | KLGA-KTPA | 6 | rand149 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 20 | KFLL-KSAN | 1 | rand145 | -47.71 | KFLL>ACT 1009/962/960 |
| wide | 20 | KORD-KCLT | 3 | rand152 | -9.41 | EMMLY>FILPZ 400/391/385 |
| wide | 20 | KEWR-KORD | 6 | rand154 | -24.74 | KEWR>KORD 644/619/619 |
| wide | 20 | KDEN-KMDW | 3 | rand155 | -11.42 | KDEN>KMDW 798/787/770 |
| wide | 20 | KEWR-KSEA | 5 | rand163 | -38.56 | SAW>GLASR 1422/1384/1384 |
| wide | 20 | KCLT-KSAN | 7 | rand161 | -4.35 | ACT>LUCKI 994/989/989 |
| wide | 20 | KMDW-KCLT | 6 | rand167 | -9.28 | KMDW>KCLT 530/521/508 |
| wide | 20 | KDEN-KMDW | 3 | rand172 | -11.42 | KDEN>KMDW 798/787/770 |
| wide | 20 | KDCA-KPHX | 7 | rand171 | -7.07 | LAJUG>LORAT 972/965/965 |
| wide | 20 | KEWR-KSEA | 3 | rand173 | -16.01 | WOZEE>HML 864/848/845 |
| wide | 20 | KDCA-KPHX | 1 | rand168 | -2.81 | HVQ294030>BUKKO 1236/1233/1227 |
| wide | 20 | KSFO-KLAS | 0 | rand179 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 20 | KLGA-KTPA | 7 | rand175 | -28.67 | KLGA>DADES 884/855/855 |
| wide | 20 | KEWR-KORD | 0 | rand185 | -11.05 | JFK332043>KORD 628/617/611 |
| wide | 20 | KFLL-KSAN | 1 | rand187 | -52.66 | KFLL>PEQ 1335/1282/1273 |
| wide | 20 | KEWR-KSEA | 3 | rand189 | -37.18 | HOZIR>ISN 1116/1079/1079 |
| wide | 20 | KSFO-KLAS | 2 | rand183 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 20 | KEWR-KORD | 4 | rand195 | -11.53 | KEWR>WYNDE 600/588/586 |
| wide | 20 | KEWR-KSEA | 5 | rand194 | -38.56 | SAW>GLASR 1422/1384/1384 |
| hug | 30 | KMDW-KBWI | 5 | rand039 | -11.88 | GIJ094026>NUSMM 256/244/244 |
| hug | 30 | KSLC-KIAH | 5 | rand051 | -0.56 | PUB>MQP 464/464/459 |
| hug | 30 | KDTW-KIAD | 6 | rand059 | -48.85 | SVM138032>AIR 245/196/159 |
| hug | 30 | KLGA-KDEN | 1 | rand090 | -2.33 | HOTEE>MCI 841/839/835 |
| hug | 30 | KDTW-KIAD | 5 | rand093 | -12.58 | KDTW>GRIVY 193/180/117 |
| hug | 30 | KATL-KIAD | 1 | rand095 | -13.86 | KATL>CAVLR 449/435/435 |
| hug | 30 | KMDW-KBWI | 5 | rand098 | -1.89 | JERRI>ANTHM 277/275/265 |
| hug | 30 | KSAN-KAUS | 0 | rand100 | -1.02 | ELP>DILLO 392/391/388 |
| hug | 30 | KEWR-KSEA | 2 | rand126 | -18.90 | IRK>HCT 402/383/378 |
| hug | 30 | KEWR-KSEA | 5 | rand147 | -33.71 | SAW>MLP 1195/1161/1161 |
| hug | 30 | KSFO-KLAS | 2 | rand183 | -38.53 | LOSHN>MISEN 219/180/180 |
| hug | 30 | KSFO-KLAS | 0 | rand179 | -35.24 | LOSHN>MISEN 219/183/180 |
| hug | 30 | KFLL-KSAN | 1 | rand187 | -48.92 | KFLL>FUSCO 1219/1170/1157 |
| hug | 30 | KEWR-KSEA | 3 | rand189 | -5.44 | SSM>HML 547/542/541 |
| wide | 30 | KMSP-KJFK | 1 | rand001 | -9.88 | KMSP>STENT 734/724/724 |
| wide | 30 | KLGA-KORD | 5 | rand006 | -2.01 | JFK332023>WYNDE 598/595/589 |
| wide | 30 | KORD-KCLT | 2 | rand013 | -4.46 | KORD>FILPZ 493/489/473 |
| wide | 30 | KMDW-KBWI | 3 | rand009 | -0.46 | KMDW>KBWI 533/532/526 |
| wide | 30 | KMCO-KPHL | 2 | rand024 | -9.47 | KMCO>JIIMS 753/743/740 |
| wide | 30 | KLAX-KBOS | 3 | rand023 | -9.03 | BLD237031>ONL 882/873/872 |
| wide | 30 | KPHX-KAUS | 0 | rand020 | -9.58 | PXR115025>LAIKS 711/702/696 |
| wide | 30 | KMSP-KCLT | 6 | rand033 | -7.74 | KMSP>TAFTT 651/643/642 |
| wide | 30 | KMDW-KBWI | 5 | rand039 | -15.95 | KMDW>ANTHM 508/492/490 |
| wide | 30 | KTPA-KSLC | 2 | rand041 | -6.34 | ADUKE>JNC 834/828/828 |
| wide | 30 | KLGA-KORD | 4 | rand038 | -2.05 | KLGA>WYNDE 607/605/598 |
| wide | 30 | KDTW-KIAD | 4 | rand052 | -7.79 | LIDDS>KIAD 317/310/295 |
| wide | 30 | KEWR-KDEN | 0 | rand053 | -4.42 | DANNR>OBH 1000/995/992 |
| wide | 30 | KDTW-KIAD | 6 | rand059 | -53.87 | KDTW>MGW 313/259/225 |
| wide | 30 | KDFW-KSFO | 5 | rand055 | -9.68 | KDFW>KITTN 935/926/926 |
| wide | 30 | KEWR-KDEN | 5 | rand063 | -0.31 | MIKYG>OATHE 1195/1195/1189 |
| wide | 30 | KMSP-KCLT | 4 | rand067 | -15.96 | MCW029064>SKYWA 605/589/588 |
| wide | 30 | KSLC-KMSP | 0 | rand076 | -8.78 | OCS>UFFDA 599/590/590 |
| wide | 30 | KSFO-KLAS | 6 | rand073 | -18.20 | SSTIK>HELDE 323/305/299 |
| wide | 30 | KDCA-KPHX | 6 | rand081 | -55.69 | HUMBO>EAGUL 1108/1052/1051 |
| wide | 30 | KTPA-KSLC | 0 | rand079 | -0.17 | FSM>JNC 727/727/722 |
| wide | 30 | KMDW-KIAH | 7 | rand083 | -4.56 | BEKKI>ZEEKK 679/675/662 |
| wide | 30 | KLGA-KDEN | 1 | rand090 | -8.35 | PARKE358003>OATHE 1236/1228/1222 |
| wide | 30 | KMDW-KCLT | 6 | rand084 | -9.28 | KMDW>KCLT 530/521/508 |
| wide | 30 | KDTW-KIAD | 5 | rand093 | -42.39 | KDTW>AIR 260/217/175 |
| wide | 30 | KSAN-KAUS | 0 | rand100 | -4.09 | GBN>LAIKS 756/752/750 |
| wide | 30 | KPHX-KBNA | 5 | rand099 | -71.89 | ELP>SQS 882/810/810 |
| wide | 30 | KEWR-KSEA | 3 | rand101 | -18.32 | WOZEE>HML 864/845/845 |
| wide | 30 | KATL-KIAD | 1 | rand095 | -28.47 | KATL>KIAD 492/464/464 |
| wide | 30 | KDTW-KMCO | 7 | rand103 | -3.24 | KDTW>GRNCH 815/812/798 |
| wide | 30 | KDEN-KMSP | 3 | rand104 | -49.59 | WYNDM>NITZR 469/420/420 |
| wide | 30 | KMDW-KBWI | 4 | rand105 | -8.88 | KMDW>ANTHM 508/499/490 |
| wide | 30 | KDCA-KPHX | 4 | rand120 | -12.50 | KDCA>EAGUL 1656/1643/1643 |
| wide | 30 | KFLL-KSAN | 3 | rand119 | -5.72 | DAS>PEQ 479/474/465 |
| wide | 30 | KSLC-KDEN | 1 | rand127 | -20.65 | KSLC>KDEN 362/341/336 |
| wide | 30 | KEWR-KSEA | 2 | rand126 | -46.84 | SPI>BFF 680/633/633 |
| wide | 30 | KDTW-KIAD | 6 | rand129 | -27.68 | ZEYOU>MGW 237/209/157 |
| wide | 30 | KMDW-KBWI | 6 | rand130 | -5.95 | LEWKE>NUSMM 316/310/300 |
| wide | 30 | KSLC-KMSP | 7 | rand132 | -6.61 | KSLC>TORGY 844/838/805 |
| wide | 30 | KDFW-KSFO | 1 | rand125 | -1.75 | FTI>RUMPS 609/607/596 |
| wide | 30 | KSAN-KAUS | 2 | rand136 | -0.30 | ZZOOO>FST 736/736/731 |
| wide | 30 | KTPA-KSLC | 2 | rand138 | -7.01 | KTPA>PNH 1076/1069/1067 |
| wide | 30 | KSAN-KAUS | 3 | rand142 | -5.06 | ZZOOO>FST 736/731/731 |
| wide | 30 | KEWR-KSEA | 2 | rand135 | -22.13 | AIR>HCT 940/918/912 |
| wide | 30 | KFLL-KSAN | 1 | rand145 | -47.71 | KFLL>ACT 1009/962/960 |
| wide | 30 | KEWR-KSEA | 5 | rand147 | -40.84 | KENPA>GLASR 1652/1612/1612 |
| wide | 30 | KLGA-KTPA | 6 | rand149 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 30 | KDEN-KMDW | 3 | rand155 | -11.42 | KDEN>KMDW 798/787/770 |
| wide | 30 | KEWR-KORD | 6 | rand154 | -24.74 | KEWR>KORD 644/619/619 |
| wide | 30 | KORD-KCLT | 3 | rand152 | -9.41 | EMMLY>FILPZ 400/391/385 |
| wide | 30 | KMDW-KCLT | 6 | rand167 | -9.28 | KMDW>KCLT 530/521/508 |
| wide | 30 | KCLT-KSAN | 7 | rand161 | -4.35 | ACT>LUCKI 994/989/989 |
| wide | 30 | KDCA-KPHX | 1 | rand168 | -2.81 | HVQ294030>BUKKO 1236/1233/1227 |
| wide | 30 | KEWR-KSEA | 5 | rand163 | -38.56 | SAW>GLASR 1422/1384/1384 |
| wide | 30 | KEWR-KSEA | 3 | rand173 | -16.01 | WOZEE>HML 864/848/845 |
| wide | 30 | KDCA-KPHX | 7 | rand171 | -7.07 | LAJUG>LORAT 972/965/965 |
| wide | 30 | KSFO-KLAS | 0 | rand179 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 30 | KDEN-KMDW | 3 | rand172 | -11.42 | KDEN>KMDW 798/787/770 |
| wide | 30 | KLGA-KTPA | 7 | rand175 | -28.67 | KLGA>DADES 884/855/855 |
| wide | 30 | KSFO-KLAS | 2 | rand183 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 30 | KFLL-KSAN | 1 | rand187 | -52.66 | KFLL>PEQ 1335/1282/1273 |
| wide | 30 | KEWR-KORD | 0 | rand185 | -11.05 | JFK332043>KORD 628/617/611 |
| wide | 30 | KEWR-KSEA | 5 | rand194 | -38.56 | SAW>GLASR 1422/1384/1384 |
| wide | 30 | KEWR-KSEA | 3 | rand189 | -37.18 | HOZIR>ISN 1116/1079/1079 |
| wide | 30 | KEWR-KORD | 4 | rand195 | -11.53 | KEWR>WYNDE 600/588/586 |
| hug | 40 | KMDW-KBWI | 5 | rand039 | -11.88 | GIJ094026>NUSMM 256/244/244 |
| hug | 40 | KSLC-KIAH | 5 | rand051 | -0.56 | PUB>MQP 464/464/459 |
| hug | 40 | KDTW-KIAD | 6 | rand059 | -48.85 | SVM138032>AIR 245/196/159 |
| hug | 40 | KLGA-KDEN | 1 | rand090 | -2.33 | HOTEE>MCI 841/839/835 |
| hug | 40 | KATL-KIAD | 1 | rand095 | -13.86 | KATL>CAVLR 449/435/435 |
| hug | 40 | KSAN-KAUS | 0 | rand100 | -1.02 | ELP>DILLO 392/391/388 |
| hug | 40 | KMDW-KBWI | 5 | rand098 | -1.89 | JERRI>ANTHM 277/275/265 |
| hug | 40 | KEWR-KSEA | 2 | rand126 | -18.90 | IRK>HCT 402/383/378 |
| hug | 40 | KEWR-KSEA | 5 | rand147 | -33.71 | SAW>MLP 1195/1161/1161 |
| hug | 40 | KSFO-KLAS | 0 | rand179 | -35.24 | LOSHN>MISEN 219/183/180 |
| hug | 40 | KFLL-KSAN | 1 | rand187 | -48.92 | KFLL>FUSCO 1219/1170/1157 |
| hug | 40 | KEWR-KSEA | 3 | rand189 | -5.44 | SSM>HML 547/542/541 |
| hug | 40 | KSFO-KLAS | 2 | rand183 | -38.53 | LOSHN>MISEN 219/180/180 |
| wide | 40 | KLGA-KORD | 5 | rand006 | -2.01 | JFK332023>WYNDE 598/595/589 |
| wide | 40 | KMSP-KJFK | 1 | rand001 | -9.88 | KMSP>STENT 734/724/724 |
| wide | 40 | KORD-KCLT | 2 | rand013 | -7.07 | KORD>FILPZ 493/486/473 |
| wide | 40 | KMDW-KBWI | 3 | rand009 | -0.46 | KMDW>KBWI 533/532/526 |
| wide | 40 | KPHX-KAUS | 0 | rand020 | -9.58 | PXR115025>LAIKS 711/702/696 |
| wide | 40 | KLAX-KBOS | 3 | rand023 | -8.94 | BLD237031>ONL 882/873/872 |
| wide | 40 | KLGA-KORD | 4 | rand038 | -2.05 | KLGA>WYNDE 607/605/598 |
| wide | 40 | KMDW-KBWI | 5 | rand039 | -15.95 | KMDW>ANTHM 508/492/490 |
| wide | 40 | KMSP-KCLT | 6 | rand033 | -7.74 | KMSP>TAFTT 651/643/642 |
| wide | 40 | KTPA-KSLC | 2 | rand041 | -6.34 | ADUKE>JNC 834/828/828 |
| wide | 40 | KEWR-KDEN | 0 | rand053 | -4.42 | DANNR>OBH 1000/995/992 |
| wide | 40 | KDFW-KSFO | 5 | rand055 | -9.68 | KDFW>KITTN 935/926/926 |
| wide | 40 | KDTW-KIAD | 4 | rand052 | -7.79 | LIDDS>KIAD 317/310/295 |
| wide | 40 | KDTW-KIAD | 6 | rand059 | -53.87 | KDTW>MGW 313/259/225 |
| wide | 40 | KEWR-KDEN | 5 | rand063 | -0.31 | MIKYG>OATHE 1195/1195/1189 |
| wide | 40 | KMSP-KCLT | 4 | rand067 | -15.96 | MCW029064>SKYWA 605/589/588 |
| wide | 40 | KSFO-KLAS | 6 | rand073 | -9.92 | SSTIK>HELDE 323/314/299 |
| wide | 40 | KDCA-KPHX | 6 | rand081 | -55.69 | HUMBO>EAGUL 1108/1052/1051 |
| wide | 40 | KSLC-KMSP | 0 | rand076 | -8.78 | OCS>UFFDA 599/590/590 |
| wide | 40 | KMDW-KCLT | 6 | rand084 | -9.28 | KMDW>KCLT 530/521/508 |
| wide | 40 | KTPA-KSLC | 0 | rand079 | -0.17 | FSM>JNC 727/727/722 |
| wide | 40 | KMDW-KIAH | 7 | rand083 | -4.56 | BEKKI>ZEEKK 679/675/662 |
| wide | 40 | KLGA-KDEN | 1 | rand090 | -8.35 | PARKE358003>OATHE 1236/1228/1222 |
| wide | 40 | KDTW-KIAD | 5 | rand093 | -51.32 | KDTW>AIR 260/208/175 |
| wide | 40 | KATL-KIAD | 1 | rand095 | -28.47 | KATL>KIAD 492/464/464 |
| wide | 40 | KEWR-KSEA | 3 | rand101 | -18.32 | WOZEE>HML 864/845/845 |
| wide | 40 | KDTW-KMCO | 7 | rand103 | -3.24 | KDTW>GRNCH 815/812/798 |
| wide | 40 | KDEN-KMSP | 3 | rand104 | -49.59 | WYNDM>NITZR 469/420/420 |
| wide | 40 | KMDW-KBWI | 4 | rand105 | -8.88 | KMDW>ANTHM 508/499/490 |
| wide | 40 | KPHX-KBNA | 5 | rand099 | -71.89 | ELP>SQS 882/810/810 |
| wide | 40 | KSAN-KAUS | 0 | rand100 | -5.24 | GBN>LAIKS 756/751/750 |
| wide | 40 | KFLL-KSAN | 3 | rand119 | -5.72 | DAS>PEQ 479/474/465 |
| wide | 40 | KDCA-KPHX | 4 | rand120 | -12.50 | KDCA>EAGUL 1656/1643/1643 |
| wide | 40 | KDFW-KSFO | 1 | rand125 | -1.75 | FTI>RUMPS 609/607/596 |
| wide | 40 | KEWR-KSEA | 2 | rand126 | -46.84 | SPI>BFF 680/633/633 |
| wide | 40 | KSLC-KMSP | 7 | rand132 | -6.61 | KSLC>TORGY 844/838/805 |
| wide | 40 | KSLC-KDEN | 1 | rand127 | -20.65 | KSLC>KDEN 362/341/336 |
| wide | 40 | KEWR-KSEA | 2 | rand135 | -22.13 | AIR>HCT 940/918/912 |
| wide | 40 | KSAN-KAUS | 2 | rand136 | -0.30 | ZZOOO>FST 736/736/731 |
| wide | 40 | KDTW-KIAD | 6 | rand129 | -33.49 | ZEYOU>MGW 237/203/157 |
| wide | 40 | KMDW-KBWI | 6 | rand130 | -5.95 | LEWKE>NUSMM 316/310/300 |
| wide | 40 | KTPA-KSLC | 2 | rand138 | -7.01 | KTPA>PNH 1076/1069/1067 |
| wide | 40 | KFLL-KSAN | 1 | rand145 | -47.71 | KFLL>ACT 1009/962/960 |
| wide | 40 | KSAN-KAUS | 3 | rand142 | -5.06 | ZZOOO>FST 736/731/731 |
| wide | 40 | KORD-KCLT | 3 | rand152 | -9.41 | EMMLY>FILPZ 400/391/385 |
| wide | 40 | KEWR-KORD | 6 | rand154 | -24.74 | KEWR>KORD 644/619/619 |
| wide | 40 | KLGA-KTPA | 6 | rand149 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 40 | KEWR-KSEA | 5 | rand147 | -40.84 | KENPA>GLASR 1652/1612/1612 |
| wide | 40 | KDEN-KMDW | 3 | rand155 | -11.42 | KDEN>KMDW 798/787/770 |
| wide | 40 | KEWR-KSEA | 5 | rand163 | -38.56 | SAW>GLASR 1422/1384/1384 |
| wide | 40 | KMDW-KCLT | 6 | rand167 | -9.28 | KMDW>KCLT 530/521/508 |
| wide | 40 | KCLT-KSAN | 7 | rand161 | -4.35 | ACT>LUCKI 994/989/989 |
| wide | 40 | KDCA-KPHX | 1 | rand168 | -2.81 | HVQ294030>BUKKO 1236/1233/1227 |
| wide | 40 | KDCA-KPHX | 7 | rand171 | -7.07 | LAJUG>LORAT 972/965/965 |
| wide | 40 | KLGA-KTPA | 7 | rand175 | -28.67 | KLGA>DADES 884/855/855 |
| wide | 40 | KDEN-KMDW | 3 | rand172 | -11.42 | KDEN>KMDW 798/787/770 |
| wide | 40 | KSFO-KLAS | 0 | rand179 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 40 | KEWR-KSEA | 3 | rand173 | -16.01 | WOZEE>HML 864/848/845 |
| wide | 40 | KSFO-KLAS | 2 | rand183 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 40 | KEWR-KSEA | 3 | rand189 | -37.18 | HOZIR>ISN 1116/1079/1079 |
| wide | 40 | KEWR-KORD | 0 | rand185 | -11.05 | JFK332043>KORD 628/617/611 |
| wide | 40 | KFLL-KSAN | 1 | rand187 | -52.66 | KFLL>PEQ 1335/1282/1273 |
| wide | 40 | KEWR-KORD | 4 | rand195 | -11.53 | KEWR>WYNDE 600/588/586 |
| wide | 40 | KEWR-KSEA | 5 | rand194 | -38.56 | SAW>GLASR 1422/1384/1384 |
| hug | 50 | KMDW-KBWI | 5 | rand039 | -11.88 | GIJ094026>NUSMM 256/244/244 |
| hug | 50 | KSLC-KIAH | 5 | rand051 | -0.56 | PUB>MQP 464/464/459 |
| hug | 50 | KDTW-KIAD | 6 | rand059 | -48.85 | SVM138032>AIR 245/196/159 |
| hug | 50 | KLGA-KDEN | 1 | rand090 | -2.33 | HOTEE>MCI 841/839/835 |
| hug | 50 | KATL-KIAD | 1 | rand095 | -13.86 | KATL>CAVLR 449/435/435 |
| hug | 50 | KDTW-KIAD | 5 | rand093 | -12.73 | KDTW>GRIVY 193/180/117 |
| hug | 50 | KMDW-KBWI | 5 | rand098 | -1.89 | JERRI>ANTHM 277/275/265 |
| hug | 50 | KEWR-KSEA | 2 | rand126 | -18.90 | IRK>HCT 402/383/378 |
| hug | 50 | KEWR-KSEA | 5 | rand147 | -33.71 | SAW>MLP 1195/1161/1161 |
| hug | 50 | KSFO-KLAS | 0 | rand179 | -35.24 | LOSHN>MISEN 219/183/180 |
| hug | 50 | KFLL-KSAN | 1 | rand187 | -48.92 | KFLL>FUSCO 1219/1170/1157 |
| hug | 50 | KEWR-KSEA | 3 | rand189 | -5.44 | SSM>HML 547/542/541 |
| hug | 50 | KSFO-KLAS | 2 | rand183 | -38.53 | LOSHN>MISEN 219/180/180 |
| wide | 50 | KMSP-KJFK | 1 | rand001 | -9.88 | KMSP>STENT 734/724/724 |
| wide | 50 | KMDW-KBWI | 3 | rand009 | -0.46 | KMDW>KBWI 533/532/526 |
| wide | 50 | KLGA-KORD | 5 | rand006 | -2.01 | JFK332023>WYNDE 598/595/589 |
| wide | 50 | KORD-KCLT | 2 | rand013 | -7.07 | KORD>FILPZ 493/486/473 |
| wide | 50 | KPHX-KAUS | 0 | rand020 | -9.58 | PXR115025>LAIKS 711/702/696 |
| wide | 50 | KMCO-KPHL | 2 | rand024 | -9.47 | KMCO>JIIMS 753/743/740 |
| wide | 50 | KLAX-KBOS | 3 | rand023 | -8.94 | BLD237031>ONL 882/873/872 |
| wide | 50 | KLGA-KORD | 4 | rand038 | -2.05 | KLGA>WYNDE 607/605/598 |
| wide | 50 | KMSP-KCLT | 6 | rand033 | -4.75 | KMSP>TAFTT 651/646/642 |
| wide | 50 | KMDW-KBWI | 5 | rand039 | -15.95 | KMDW>ANTHM 508/492/490 |
| wide | 50 | KTPA-KSLC | 2 | rand041 | -6.34 | ADUKE>JNC 834/828/828 |
| wide | 50 | KDTW-KIAD | 4 | rand052 | -7.79 | LIDDS>KIAD 317/310/295 |
| wide | 50 | KEWR-KDEN | 0 | rand053 | -4.42 | DANNR>OBH 1000/995/992 |
| wide | 50 | KDTW-KIAD | 6 | rand059 | -53.87 | KDTW>MGW 313/259/225 |
| wide | 50 | KDFW-KSFO | 5 | rand055 | -9.68 | KDFW>KITTN 935/926/926 |
| wide | 50 | KMSP-KCLT | 4 | rand067 | -15.96 | MCW029064>SKYWA 605/589/588 |
| wide | 50 | KTPA-KSLC | 0 | rand079 | -0.17 | FSM>JNC 727/727/722 |
| wide | 50 | KSLC-KMSP | 0 | rand076 | -8.78 | OCS>UFFDA 599/590/590 |
| wide | 50 | KDCA-KPHX | 6 | rand081 | -55.20 | HUMBO>EAGUL 1108/1052/1051 |
| wide | 50 | KMDW-KIAH | 7 | rand083 | -4.56 | BEKKI>ZEEKK 679/675/662 |
| wide | 50 | KLGA-KDEN | 1 | rand090 | -8.35 | PARKE358003>OATHE 1236/1228/1222 |
| wide | 50 | KMDW-KCLT | 6 | rand084 | -9.28 | KMDW>KCLT 530/521/508 |
| wide | 50 | KDTW-KIAD | 5 | rand093 | -51.22 | KDTW>AIR 260/209/175 |
| wide | 50 | KATL-KIAD | 1 | rand095 | -28.47 | KATL>KIAD 492/464/464 |
| wide | 50 | KSAN-KAUS | 0 | rand100 | -5.24 | GBN>LAIKS 756/751/750 |
| wide | 50 | KDTW-KMCO | 7 | rand103 | -3.24 | KDTW>GRNCH 815/812/798 |
| wide | 50 | KPHX-KBNA | 5 | rand099 | -71.89 | ELP>SQS 882/810/810 |
| wide | 50 | KEWR-KSEA | 3 | rand101 | -18.32 | WOZEE>HML 864/845/845 |
| wide | 50 | KDEN-KMSP | 3 | rand104 | -49.59 | WYNDM>NITZR 469/420/420 |
| wide | 50 | KMDW-KBWI | 4 | rand105 | -8.88 | KMDW>ANTHM 508/499/490 |
| wide | 50 | KFLL-KSAN | 3 | rand119 | -5.72 | DAS>PEQ 479/474/465 |
| wide | 50 | KDCA-KPHX | 4 | rand120 | -12.50 | KDCA>EAGUL 1656/1643/1643 |
| wide | 50 | KDFW-KSFO | 1 | rand125 | -1.75 | FTI>RUMPS 609/607/596 |
| wide | 50 | KEWR-KSEA | 2 | rand126 | -46.84 | SPI>BFF 680/633/633 |
| wide | 50 | KSLC-KDEN | 1 | rand127 | -20.65 | KSLC>KDEN 362/341/336 |
| wide | 50 | KMDW-KBWI | 6 | rand130 | -5.95 | LEWKE>NUSMM 316/310/300 |
| wide | 50 | KEWR-KSEA | 2 | rand135 | -22.13 | AIR>HCT 940/918/912 |
| wide | 50 | KDTW-KIAD | 6 | rand129 | -27.68 | ZEYOU>MGW 237/209/157 |
| wide | 50 | KSLC-KMSP | 7 | rand132 | -6.61 | KSLC>TORGY 844/838/805 |
| wide | 50 | KSAN-KAUS | 2 | rand136 | -0.30 | ZZOOO>FST 736/736/731 |
| wide | 50 | KSAN-KAUS | 3 | rand142 | -5.06 | ZZOOO>FST 736/731/731 |
| wide | 50 | KTPA-KSLC | 2 | rand138 | -7.01 | KTPA>PNH 1076/1069/1067 |
| wide | 50 | KLGA-KTPA | 6 | rand149 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 50 | KFLL-KSAN | 1 | rand145 | -47.71 | KFLL>ACT 1009/962/960 |
| wide | 50 | KEWR-KORD | 6 | rand154 | -24.74 | KEWR>KORD 644/619/619 |
| wide | 50 | KORD-KCLT | 3 | rand152 | -9.41 | EMMLY>FILPZ 400/391/385 |
| wide | 50 | KDEN-KMDW | 3 | rand155 | -11.42 | KDEN>KMDW 798/787/770 |
| wide | 50 | KEWR-KSEA | 5 | rand147 | -40.84 | KENPA>GLASR 1652/1612/1612 |
| wide | 50 | KCLT-KSAN | 7 | rand161 | -4.35 | ACT>LUCKI 994/989/989 |
| wide | 50 | KEWR-KSEA | 5 | rand163 | -38.56 | SAW>GLASR 1422/1384/1384 |
| wide | 50 | KDCA-KPHX | 1 | rand168 | -2.81 | HVQ294030>BUKKO 1236/1233/1227 |
| wide | 50 | KDCA-KPHX | 7 | rand171 | -7.07 | LAJUG>LORAT 972/965/965 |
| wide | 50 | KDEN-KMDW | 3 | rand172 | -11.42 | KDEN>KMDW 798/787/770 |
| wide | 50 | KEWR-KSEA | 3 | rand173 | -16.01 | WOZEE>HML 864/848/845 |
| wide | 50 | KMDW-KCLT | 6 | rand167 | -9.28 | KMDW>KCLT 530/521/508 |
| wide | 50 | KLGA-KTPA | 7 | rand175 | -28.67 | KLGA>DADES 884/855/855 |
| wide | 50 | KEWR-KORD | 0 | rand185 | -11.05 | JFK332043>KORD 628/617/611 |
| wide | 50 | KSFO-KLAS | 0 | rand179 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 50 | KSFO-KLAS | 2 | rand183 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 50 | KFLL-KSAN | 1 | rand187 | -52.66 | KFLL>PEQ 1335/1282/1273 |
| wide | 50 | KEWR-KSEA | 3 | rand189 | -37.18 | HOZIR>ISN 1116/1079/1079 |
| wide | 50 | KEWR-KSEA | 5 | rand194 | -38.56 | SAW>GLASR 1422/1384/1384 |
| wide | 50 | KEWR-KORD | 4 | rand195 | -11.53 | KEWR>WYNDE 600/588/586 |
