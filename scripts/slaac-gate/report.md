# SLAAC snapped-plan gate

Generated 2026-09-30 by `scripts/slaac/gate.py` (owner's pipeline, imported by path).

## Cases

- Library: 373 routes.
- Launch preset (all 23 polygons at once): 80 affected routes, 293 skipped (no leg within 25 nm).
- Random: 200 cases from `eval_sua.build_cases` (seed 0, 372 eligible routes after its CONUS / 300-2500 nm / >=4-fix filters), 0 skipped.
- Policies hug (1-waypoint) and wide (infinite lookahead), margin 25 nm, clear_margin 25 nm.
- exceptions count as not clear; medians over runs without exceptions.

## All cases

| policy | steps | n | leg-clear % | clear at margin % | added nm (med) | added % (med) | min clearance nm (med) | shorter | exceptions | t_gen s (med) |
|---|---|---|---|---|---|---|---|---|---|---|
| hug | 20 | 280 | 99.29 | 87.14 | 30.4 | 2.66 | 31.5 | 15 | 0 | 1.177 |
| hug | 30 | 280 | 100.00 | 87.86 | 30.2 | 2.65 | 31.6 | 15 | 0 | 2.596 |
| hug | 40 | 280 | 97.50 | 86.79 | 29.8 | 2.60 | 31.7 | 12 | 0 | 3.492 |
| hug | 50 | 280 | 99.64 | 88.21 | 31.0 | 2.62 | 31.8 | 12 | 0 | 4.372 |
| wide | 20 | 280 | 98.57 | 85.71 | 7.8 | 0.62 | 33.0 | 97 | 0 | 1.696 |
| wide | 30 | 280 | 98.21 | 86.43 | 6.7 | 0.42 | 32.4 | 105 | 0 | 2.622 |
| wide | 40 | 280 | 100.00 | 87.14 | 7.1 | 0.50 | 33.8 | 103 | 0 | 3.483 |
| wide | 50 | 280 | 98.57 | 86.79 | 6.7 | 0.41 | 33.2 | 105 | 0 | 4.339 |

## launch cases only

| policy | steps | n | leg-clear % | clear at margin % | added nm (med) | min clearance nm (med) | shorter | exceptions |
|---|---|---|---|---|---|---|---|---|
| hug | 20 | 80 | 97.50 | 71.25 | 41.4 | 25.1 | 4 | 0 |
| hug | 30 | 80 | 100.00 | 76.25 | 43.7 | 25.8 | 4 | 0 |
| hug | 40 | 80 | 91.25 | 67.50 | 35.8 | 25.2 | 1 | 0 |
| hug | 50 | 80 | 98.75 | 73.75 | 35.8 | 25.7 | 1 | 0 |
| wide | 20 | 80 | 95.00 | 67.50 | 19.1 | 26.3 | 20 | 0 |
| wide | 30 | 80 | 93.75 | 66.25 | 7.1 | 26.3 | 29 | 0 |
| wide | 40 | 80 | 100.00 | 67.50 | 8.5 | 26.6 | 26 | 0 |
| wide | 50 | 80 | 95.00 | 68.75 | 7.1 | 26.3 | 28 | 0 |

## random cases only

| policy | steps | n | leg-clear % | clear at margin % | added nm (med) | min clearance nm (med) | shorter | exceptions |
|---|---|---|---|---|---|---|---|---|
| hug | 20 | 200 | 100.00 | 93.50 | 30.4 | 34.1 | 11 | 0 |
| hug | 30 | 200 | 100.00 | 92.50 | 29.8 | 33.8 | 11 | 0 |
| hug | 40 | 200 | 100.00 | 94.50 | 29.8 | 34.2 | 11 | 0 |
| hug | 50 | 200 | 100.00 | 94.00 | 31.0 | 34.2 | 11 | 0 |
| wide | 20 | 200 | 100.00 | 93.00 | 5.3 | 36.9 | 77 | 0 |
| wide | 30 | 200 | 100.00 | 94.50 | 5.6 | 36.8 | 76 | 0 |
| wide | 40 | 200 | 100.00 | 95.00 | 6.6 | 36.8 | 77 | 0 |
| wide | 50 | 200 | 100.00 | 94.00 | 5.4 | 36.7 | 77 | 0 |

## Decision

- steps 20 hug: |clear rate diff| 1.79 <= 0.5 pts NO; |median added diff| 0.67 nm <= 2.98 (10%) yes; |median clearance diff| 0.17 <= 2 nm yes -> not acceptable
- steps 20 wide: |clear rate diff| 1.43 <= 0.5 pts NO; |median added diff| 0.67 nm <= 0.71 (10%) yes; |median clearance diff| 0.80 <= 2 nm yes -> not acceptable
- steps 20: not acceptable (both policies)
- steps 30 hug: |clear rate diff| 2.50 <= 0.5 pts NO; |median added diff| 0.49 nm <= 2.98 (10%) yes; |median clearance diff| 0.07 <= 2 nm yes -> not acceptable
- steps 30 wide: |clear rate diff| 1.79 <= 0.5 pts NO; |median added diff| 0.43 nm <= 0.71 (10%) yes; |median clearance diff| 1.38 <= 2 nm yes -> not acceptable
- steps 30: not acceptable (both policies)
- steps 40 hug: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.00 nm <= 2.98 (10%) yes; |median clearance diff| 0.00 <= 2 nm yes -> acceptable
- steps 40 wide: |clear rate diff| 0.00 <= 0.5 pts yes; |median added diff| 0.00 nm <= 0.71 (10%) yes; |median clearance diff| 0.00 <= 2 nm yes -> acceptable
- steps 40: ACCEPTABLE (both policies)
- steps 50 hug: |clear rate diff| 2.14 <= 0.5 pts NO; |median added diff| 1.24 nm <= 2.98 (10%) yes; |median clearance diff| 0.07 <= 2 nm yes -> not acceptable
- steps 50 wide: |clear rate diff| 1.43 <= 0.5 pts NO; |median added diff| 0.41 nm <= 0.71 (10%) yes; |median clearance diff| 0.55 <= 2 nm yes -> not acceptable
- steps 50: not acceptable (both policies)
- chosen_steps = smallest acceptable = 40
- hug @ 40: leg-clear 97.50% >= 98.0%: NO
- hug @ 40: exceptions 0 == 0: yes
- hug @ 40: shorter_after_reroute 12 == 0: NO
- wide @ 40: leg-clear 100.00% >= 99.0%: yes
- wide @ 40: exceptions 0 == 0: yes
- wide @ 40: shorter_after_reroute 103 == 0: NO
- display = continuous

**chosen_steps = 40, display = continuous**

## Failing runs (legs crossing > 0 or exception)

| policy | steps | kind | pair | route | polygon | legs crossing | stage / exception |
|---|---|---|---|---|---|---|---|
| hug | 20 | launch | KJFK-KMIA | 0 | launch-preset | 2 | dense path inside |
| hug | 20 | launch | KJFK-KMIA | 5 | launch-preset | 1 | snapping/repair |
| wide | 20 | launch | KMIA-KBOS | 2 | launch-preset | 2 | dense path inside |
| wide | 20 | launch | KMIA-KBOS | 7 | launch-preset | 2 | dense path inside |
| wide | 20 | launch | KMIA-KBOS | 4 | launch-preset | 2 | dense path inside |
| wide | 20 | launch | KMIA-KBOS | 1 | launch-preset | 2 | dense path inside |
| wide | 30 | launch | KJFK-KMIA | 1 | launch-preset | 2 | dense path inside |
| wide | 30 | launch | KJFK-KMIA | 3 | launch-preset | 2 | dense path inside |
| wide | 30 | launch | KJFK-KMIA | 4 | launch-preset | 2 | dense path inside |
| wide | 30 | launch | KJFK-KMIA | 7 | launch-preset | 2 | dense path inside |
| wide | 30 | launch | KJFK-KMIA | 2 | launch-preset | 2 | dense path inside |
| hug | 40 | launch | KJFK-KMIA | 0 | launch-preset | 2 | dense path inside |
| hug | 40 | launch | KJFK-KMIA | 2 | launch-preset | 2 | dense path inside |
| hug | 40 | launch | KJFK-KMIA | 1 | launch-preset | 2 | dense path inside |
| hug | 40 | launch | KJFK-KMIA | 6 | launch-preset | 2 | dense path inside |
| hug | 40 | launch | KJFK-KMIA | 4 | launch-preset | 2 | dense path inside |
| hug | 40 | launch | KJFK-KMIA | 3 | launch-preset | 2 | dense path inside |
| hug | 40 | launch | KJFK-KMIA | 7 | launch-preset | 2 | dense path inside |
| hug | 50 | launch | KJFK-KMIA | 0 | launch-preset | 2 | dense path inside |
| wide | 50 | launch | KMIA-KBOS | 2 | launch-preset | 2 | dense path inside |
| wide | 50 | launch | KMIA-KBOS | 4 | launch-preset | 2 | dense path inside |
| wide | 50 | launch | KMIA-KBOS | 1 | launch-preset | 2 | dense path inside |
| wide | 50 | launch | KMIA-KBOS | 7 | launch-preset | 2 | dense path inside |

## Plans shorter than the filed route

Each replaced stretch: filed length between the anchors / plan length / straight chord (nm).

| policy | steps | pair | route | polygon | added nm | stretches |
|---|---|---|---|---|---|---|
| hug | 20 | KMCO-KPHL | 4 | launch-preset | -0.53 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 20 | KMCO-KPHL | 7 | launch-preset | -0.53 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 20 | KMCO-KPHL | 5 | launch-preset | -0.53 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 20 | KMCO-KPHL | 3 | launch-preset | -0.53 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| wide | 20 | KIAH-KSAN | 3 | launch-preset | -52.85 | CWK>ITUCO 712/659/637 |
| wide | 20 | KIAH-KSAN | 7 | launch-preset | -55.27 | CWK>ITUCO 715/659/637 |
| wide | 20 | KFLL-KSAN | 3 | launch-preset | -12.29 | MAF>SSO 370/358/358 |
| wide | 20 | KFLL-KSAN | 4 | launch-preset | -206.08 | LEV>GBN 1382/1176/1176 |
| wide | 20 | KMCO-KPHL | 3 | launch-preset | -27.75 | KMCO>KPHL 792/764/753 |
| wide | 20 | KMCO-KPHL | 4 | launch-preset | -27.75 | KMCO>KPHL 792/764/753 |
| wide | 20 | KMCO-KPHL | 7 | launch-preset | -27.75 | KMCO>KPHL 792/764/753 |
| wide | 20 | KMCO-KPHL | 1 | launch-preset | -35.99 | KMCO>KPHL 800/764/753 |
| wide | 20 | KMCO-KPHL | 2 | launch-preset | -37.22 | KMCO>KPHL 801/764/753 |
| wide | 20 | KMCO-KPHL | 6 | launch-preset | -115.39 | KMCO>SAV197051 275/181/175; SAV197051>KPHL 620/598/598 |
| wide | 20 | KMCO-KPHL | 0 | launch-preset | -130.55 | KMCO>KPHL 895/764/753 |
| wide | 20 | KMCO-KPHL | 5 | launch-preset | -27.75 | KMCO>KPHL 792/764/753 |
| wide | 20 | KDTW-KMCO | 3 | launch-preset | -3.67 | AMG163024>KMCO 177/174/173 |
| wide | 20 | KDTW-KMCO | 0 | launch-preset | -2.22 | GNV349047>KMCO 138/136/136 |
| wide | 20 | KPHX-KAUS | 0 | launch-preset | -5.44 | PXR115025>UCOKA 604/598/589 |
| wide | 20 | KPHX-KAUS | 6 | launch-preset | -5.35 | PXR148014>UCOKA 618/613/604 |
| wide | 20 | KPHX-KBNA | 5 | launch-preset | -3.28 | PHASE>MHZ 969/965/959 |
| wide | 20 | KSEA-KFLL | 3 | launch-preset | -28.74 | OTK>KFLL 356/327/327 |
| wide | 20 | KCLT-KSAN | 5 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 20 | KCLT-KSAN | 4 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| hug | 30 | KMCO-KPHL | 3 | launch-preset | -0.48 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 30 | KMCO-KPHL | 4 | launch-preset | -0.48 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 30 | KMCO-KPHL | 5 | launch-preset | -0.48 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| hug | 30 | KMCO-KPHL | 7 | launch-preset | -0.48 | KMCO>VIYAP 170/176/170; JROSS>JIIMS 501/495/495 |
| wide | 30 | KIAH-KSAN | 3 | launch-preset | -67.19 | CWK>ITUCO 712/645/637 |
| wide | 30 | KJFK-KMIA | 0 | launch-preset | -5.92 | SIE>KMIA 943/937/848 |
| wide | 30 | KIAH-KSAN | 7 | launch-preset | -69.61 | CWK>ITUCO 715/645/637 |
| wide | 30 | KMIA-KBOS | 4 | launch-preset | -44.10 | KMIA>ROBUC 1187/1143/1050 |
| wide | 30 | KMCO-KPHL | 0 | launch-preset | -132.27 | KMCO>KPHL 895/762/753 |
| wide | 30 | KMCO-KPHL | 1 | launch-preset | -37.70 | KMCO>KPHL 800/762/753 |
| wide | 30 | KMCO-KPHL | 4 | launch-preset | -29.47 | KMCO>KPHL 792/762/753 |
| wide | 30 | KMCO-KPHL | 5 | launch-preset | -29.47 | KMCO>KPHL 792/762/753 |
| wide | 30 | KMCO-KPHL | 7 | launch-preset | -29.47 | KMCO>KPHL 792/762/753 |
| wide | 30 | KLAX-KAUS | 0 | launch-preset | -10.02 | TFD>UCOKA 618/608/606 |
| wide | 30 | KMCO-KPHL | 2 | launch-preset | -38.94 | KMCO>KPHL 801/762/753 |
| wide | 30 | KMCO-KPHL | 3 | launch-preset | -29.47 | KMCO>KPHL 792/762/753 |
| wide | 30 | KFLL-KSAN | 4 | launch-preset | -206.08 | LEV>GBN 1382/1176/1176 |
| wide | 30 | KLAX-KAUS | 5 | launch-preset | -10.02 | TFD>UCOKA 618/608/606 |
| wide | 30 | KDTW-KMCO | 0 | launch-preset | -2.22 | GNV349047>KMCO 138/136/136 |
| wide | 30 | KDTW-KMCO | 1 | launch-preset | -6.95 | TEUFL>KMCO 218/211/210 |
| wide | 30 | KDTW-KMCO | 3 | launch-preset | -3.66 | AMG163024>KMCO 177/174/173 |
| wide | 30 | KMCO-KPHL | 6 | launch-preset | -106.86 | KMCO>SAV197051 275/189/175; SAV197051>KPHL 620/598/598 |
| wide | 30 | KDTW-KMCO | 5 | launch-preset | -6.95 | TEUFL>KMCO 218/211/210 |
| wide | 30 | KFLL-KSAN | 3 | launch-preset | -12.29 | MAF>SSO 370/358/358 |
| wide | 30 | KDTW-KMCO | 6 | launch-preset | -6.95 | TEUFL>KMCO 218/211/210 |
| wide | 30 | KPHX-KAUS | 0 | launch-preset | -5.22 | PXR115025>UCOKA 604/599/589 |
| wide | 30 | KPHX-KBNA | 5 | launch-preset | -3.28 | PHASE>MHZ 969/965/959 |
| wide | 30 | KDTW-KMCO | 4 | launch-preset | -6.95 | TEUFL>KMCO 218/211/210 |
| wide | 30 | KSEA-KFLL | 3 | launch-preset | -28.74 | OTK>KFLL 356/327/327 |
| wide | 30 | KDTW-KMCO | 2 | launch-preset | -6.95 | TEUFL>KMCO 218/211/210 |
| wide | 30 | KCLT-KSAN | 4 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 30 | KCLT-KSAN | 5 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 30 | KPHX-KAUS | 6 | launch-preset | -5.35 | PXR148014>UCOKA 618/613/604 |
| hug | 40 | KSAN-KAUS | 1 | launch-preset | -3.65 | KSAN>DILLO 955/951/941 |
| wide | 40 | KJFK-KMIA | 0 | launch-preset | -5.92 | SIE>KMIA 943/937/848 |
| wide | 40 | KIAH-KSAN | 7 | launch-preset | -57.93 | CWK>ITUCO 715/657/637 |
| wide | 40 | KIAH-KSAN | 3 | launch-preset | -55.51 | CWK>ITUCO 712/657/637 |
| wide | 40 | KMIA-KBOS | 4 | launch-preset | -36.75 | KMIA>ROBUC 1187/1150/1050 |
| wide | 40 | KFLL-KSAN | 4 | launch-preset | -206.12 | LEV>GBN 1382/1176/1176 |
| wide | 40 | KMCO-KPHL | 0 | launch-preset | -130.60 | KMCO>KPHL 895/764/753 |
| wide | 40 | KMCO-KPHL | 2 | launch-preset | -37.27 | KMCO>KPHL 801/764/753 |
| wide | 40 | KMCO-KPHL | 3 | launch-preset | -27.80 | KMCO>KPHL 792/764/753 |
| wide | 40 | KMCO-KPHL | 5 | launch-preset | -27.80 | KMCO>KPHL 792/764/753 |
| wide | 40 | KMCO-KPHL | 7 | launch-preset | -27.80 | KMCO>KPHL 792/764/753 |
| wide | 40 | KMCO-KPHL | 6 | launch-preset | -106.85 | KMCO>SAV197051 275/189/175; SAV197051>KPHL 620/598/598 |
| wide | 40 | KMCO-KPHL | 1 | launch-preset | -36.04 | KMCO>KPHL 800/764/753 |
| wide | 40 | KFLL-KSAN | 3 | launch-preset | -12.29 | MAF>SSO 370/358/358 |
| wide | 40 | KMCO-KPHL | 4 | launch-preset | -27.80 | KMCO>KPHL 792/764/753 |
| wide | 40 | KDTW-KMCO | 3 | launch-preset | -3.66 | AMG163024>KMCO 177/174/173 |
| wide | 40 | KDTW-KMCO | 2 | launch-preset | -4.48 | TEUFL>KMCO 218/214/210 |
| wide | 40 | KDTW-KMCO | 0 | launch-preset | -2.22 | GNV349047>KMCO 138/136/136 |
| wide | 40 | KDTW-KMCO | 4 | launch-preset | -4.48 | TEUFL>KMCO 218/214/210 |
| wide | 40 | KDTW-KMCO | 5 | launch-preset | -4.48 | TEUFL>KMCO 218/214/210 |
| wide | 40 | KDTW-KMCO | 1 | launch-preset | -4.48 | TEUFL>KMCO 218/214/210 |
| wide | 40 | KDTW-KMCO | 6 | launch-preset | -4.48 | TEUFL>KMCO 218/214/210 |
| wide | 40 | KPHX-KAUS | 0 | launch-preset | -5.50 | PXR115025>UCOKA 604/598/589 |
| wide | 40 | KPHX-KAUS | 4 | launch-preset | -10.71 | PXR136019>UCOKA 612/601/598 |
| wide | 40 | KCLT-KSAN | 5 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 40 | KCLT-KSAN | 4 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 40 | KSEA-KFLL | 3 | launch-preset | -28.74 | OTK>KFLL 356/327/327 |
| hug | 50 | KSAN-KAUS | 1 | launch-preset | -4.50 | KSAN>DILLO 955/950/941 |
| wide | 50 | KIAH-KSAN | 3 | launch-preset | -52.85 | CWK>ITUCO 712/659/637 |
| wide | 50 | KIAH-KSAN | 7 | launch-preset | -55.27 | CWK>ITUCO 715/659/637 |
| wide | 50 | KJFK-KMIA | 0 | launch-preset | -12.17 | SIE>KMIA 943/931/848 |
| wide | 50 | KMIA-KBOS | 4 | launch-preset | -18.31 | KMIA>ROBUC 1187/1169/1050 |
| wide | 50 | KMCO-KPHL | 0 | launch-preset | -132.26 | KMCO>KPHL 895/762/753 |
| wide | 50 | KFLL-KSAN | 3 | launch-preset | -12.29 | MAF>SSO 370/358/358 |
| wide | 50 | KMCO-KPHL | 1 | launch-preset | -37.70 | KMCO>KPHL 800/762/753 |
| wide | 50 | KMCO-KPHL | 2 | launch-preset | -38.93 | KMCO>KPHL 801/762/753 |
| wide | 50 | KMCO-KPHL | 5 | launch-preset | -29.46 | KMCO>KPHL 792/762/753 |
| wide | 50 | KMCO-KPHL | 7 | launch-preset | -29.46 | KMCO>KPHL 792/762/753 |
| wide | 50 | KLAX-KAUS | 0 | launch-preset | -10.02 | TFD>UCOKA 618/608/606 |
| wide | 50 | KMCO-KPHL | 6 | launch-preset | -106.86 | KMCO>SAV197051 275/189/175; SAV197051>KPHL 620/598/598 |
| wide | 50 | KFLL-KSAN | 4 | launch-preset | -206.10 | LEV>GBN 1382/1176/1176 |
| wide | 50 | KLAX-KAUS | 5 | launch-preset | -10.02 | TFD>UCOKA 618/608/606 |
| wide | 50 | KMCO-KPHL | 3 | launch-preset | -29.46 | KMCO>KPHL 792/762/753 |
| wide | 50 | KDTW-KMCO | 0 | launch-preset | -2.22 | GNV349047>KMCO 138/136/136 |
| wide | 50 | KDTW-KMCO | 1 | launch-preset | -3.79 | TEUFL>KMCO 218/214/210 |
| wide | 50 | KMCO-KPHL | 4 | launch-preset | -29.46 | KMCO>KPHL 792/762/753 |
| wide | 50 | KDTW-KMCO | 3 | launch-preset | -3.65 | AMG163024>KMCO 177/174/173 |
| wide | 50 | KDTW-KMCO | 2 | launch-preset | -3.79 | TEUFL>KMCO 218/214/210 |
| wide | 50 | KDTW-KMCO | 4 | launch-preset | -3.79 | TEUFL>KMCO 218/214/210 |
| wide | 50 | KDTW-KMCO | 5 | launch-preset | -3.79 | TEUFL>KMCO 218/214/210 |
| wide | 50 | KPHX-KAUS | 0 | launch-preset | -11.07 | PXR115025>UCOKA 604/593/589 |
| wide | 50 | KPHX-KAUS | 6 | launch-preset | -5.35 | PXR148014>UCOKA 618/613/604 |
| wide | 50 | KDTW-KMCO | 6 | launch-preset | -3.79 | TEUFL>KMCO 218/214/210 |
| wide | 50 | KSEA-KFLL | 3 | launch-preset | -28.74 | OTK>KFLL 356/327/327 |
| hug | 20 | KMSP-KJFK | 4 | rand001 | -60.24 | KMSP>HOXIE 765/705/691 |
| hug | 20 | KSFO-KLAS | 1 | rand008 | -38.53 | LOSHN>MISEN 219/180/180 |
| hug | 20 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| hug | 20 | KLAS-KDFW | 7 | rand033 | -87.95 | KLAS>CNX 577/489/472 |
| wide | 50 | KCLT-KSAN | 5 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| hug | 20 | KMDW-KBWI | 0 | rand066 | -15.46 | KMDW>ZZV031040 327/311/293 |
| hug | 20 | KORD-KCLT | 2 | rand067 | -13.25 | CVG>SKYWA 206/193/152 |
| hug | 20 | KJFK-KMIA | 1 | rand062 | -1.70 | EMJAY>HOAGG 687/685/680 |
| hug | 20 | KDEN-KBNA | 7 | rand091 | -92.48 | KDEN>RANTS 930/837/796 |
| hug | 20 | KMSP-KORD | 4 | rand128 | -1.02 | FGT>FYTTE 247/246/238 |
| hug | 20 | KATL-KIAD | 1 | rand130 | -87.20 | KATL>CAVLR 572/485/435 |
| hug | 20 | KLGA-KORD | 7 | rand144 | -22.00 | KLGA>LTOUR 547/525/506 |
| wide | 50 | KCLT-KSAN | 4 | launch-preset | -2.45 | TXK>SSO 774/772/764 |
| wide | 20 | KMSP-KJFK | 4 | rand001 | -61.29 | KMSP>STENT 798/737/724 |
| wide | 20 | KSFO-KLAS | 1 | rand008 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 20 | KCLT-KSAN | 4 | rand002 | -10.27 | TXK>SSO 774/764/764 |
| wide | 20 | KCLT-KSAN | 7 | rand009 | -32.84 | CHOPZ>INK 1018/986/986 |
| wide | 20 | KMDW-KCLT | 4 | rand010 | -90.01 | KMDW>SOT031071 495/405/393 |
| wide | 20 | KPHX-KAUS | 0 | rand011 | -16.31 | PXR>UCOKA 629/612/612 |
| wide | 20 | KATL-KIAD | 3 | rand014 | -73.17 | KATL>RIC255063 478/405/357 |
| wide | 20 | KDEN-KBNA | 7 | rand015 | -111.74 | KDEN>FAM261069 750/638/620 |
| wide | 20 | KLAX-KBOS | 7 | rand023 | -2.39 | EKR>BAE 901/898/893 |
| wide | 20 | KLAS-KDFW | 5 | rand016 | -0.91 | GUP>VKTRY 572/571/566 |
| wide | 20 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| wide | 20 | KDCA-KPHX | 2 | rand018 | -18.72 | IIU>IRW 621/603/597 |
| wide | 20 | KLGA-KDEN | 0 | rand031 | -4.06 | MIKYG>OATHE 1195/1191/1189 |
| wide | 20 | KLAS-KDFW | 7 | rand033 | -115.82 | KLAS>INK 770/654/640 |
| wide | 20 | KLAX-KAUS | 0 | rand036 | -14.44 | BLH>UCOKA 766/752/751 |
| wide | 20 | KLGA-KSEA | 2 | rand047 | -47.70 | MIKYG>HCT 1180/1132/1132 |
| wide | 20 | KTPA-KSLC | 0 | rand050 | -2.27 | JAWJA>FSM 622/619/611 |
| wide | 20 | KMDW-KLGA | 0 | rand045 | -18.46 | DJB>MIP 339/321/247 |
| wide | 20 | KSLC-KIAH | 5 | rand049 | -9.48 | TCH031005>DRLLR 1026/1016/1008 |
| wide | 20 | KDFW-KSFO | 7 | rand055 | -3.18 | HULZE>OAL 902/899/885 |
| wide | 20 | KLAX-KBOS | 5 | rand057 | -8.54 | SLN>KLYNE 671/662/662 |
| wide | 20 | KEWR-KSEA | 1 | rand060 | -7.13 | NOSIK>MLP 1418/1411/1411 |
| wide | 20 | KJFK-KMIA | 1 | rand062 | -8.87 | WAVEY>KMIA 948/939/936 |
| wide | 20 | KMDW-KBWI | 0 | rand066 | -22.02 | KMDW>LUNDY 445/423/411 |
| wide | 20 | KSEA-KFLL | 4 | rand065 | -45.43 | MCI>ACORI 671/625/625 |
| wide | 20 | KORD-KCLT | 2 | rand067 | -87.87 | KORD>FILPZ 562/474/473 |
| wide | 20 | KATL-KIAD | 1 | rand068 | -94.01 | KATL>RIC229062 478/384/355 |
| wide | 20 | KDEN-KMDW | 7 | rand070 | -3.24 | HCT>KMDW 605/602/596 |
| wide | 20 | KMSP-KJFK | 4 | rand071 | -29.16 | FNT>STENT 374/345/301 |
| wide | 20 | KLGA-KTPA | 4 | rand069 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 20 | KTPA-KSLC | 0 | rand074 | -6.91 | JAWJA>PER 783/776/772 |
| wide | 20 | KDTW-KMCO | 2 | rand077 | -16.37 | SVM169033>TEUFL 626/609/609 |
| wide | 20 | KDCA-KPHX | 5 | rand092 | -5.74 | LAJUG>ABQ 950/944/944 |
| wide | 20 | KSLC-KMSP | 0 | rand095 | -7.27 | TCH069060>UFFDA 680/672/671 |
| wide | 20 | KDEN-KBNA | 7 | rand091 | -103.46 | KDEN>RYYMN 974/871/839 |
| wide | 20 | KPHX-KAUS | 6 | rand096 | -18.78 | PXR>UCOKA 632/613/612 |
| wide | 20 | KMSP-KJFK | 1 | rand101 | -34.38 | DLL>DAFLU 391/356/317 |
| wide | 20 | KTPA-KSLC | 1 | rand104 | -0.18 | CTY303025>HBU 1280/1280/1270 |
| wide | 20 | KMCO-KPHL | 1 | rand100 | -5.67 | KMCO>ORF235018 589/584/555 |
| wide | 20 | KLAX-KAUS | 6 | rand105 | -3.66 | BXK110038>DILLO 719/715/690 |
| wide | 20 | KSEA-KIAH | 6 | rand112 | -10.39 | KSEA>MQP 1424/1413/1413 |
| wide | 20 | KSLC-KDEN | 0 | rand116 | -5.01 | TCH>KDEN 366/361/337 |
| wide | 20 | KMSP-KORD | 2 | rand120 | -23.79 | KMSP>FYTTE 294/270/248 |
| wide | 20 | KDEN-KBNA | 7 | rand121 | -111.05 | KDEN>FAM261069 750/639/620 |
| wide | 20 | KMSP-KJFK | 5 | rand118 | -111.81 | KMSP>JHW282063 694/582/569 |
| wide | 20 | KATL-KIAD | 1 | rand130 | -150.74 | KATL>KIAD 615/464/464 |
| wide | 20 | KFLL-KSAN | 3 | rand133 | -32.39 | ROZZI>DAS 497/465/431 |
| wide | 20 | KMSP-KORD | 4 | rand128 | -12.10 | KMSP>KORD 304/292/290 |
| wide | 20 | KFLL-KSAN | 4 | rand136 | -167.16 | LEV>HOGGZ 1453/1286/1245 |
| wide | 20 | KDTW-KMCO | 7 | rand137 | -101.15 | KDTW>SZW049067 774/673/661 |
| wide | 20 | KLGA-KORD | 1 | rand138 | -37.69 | DJB>WATSN 289/252/173 |
| wide | 20 | KLGA-KTPA | 1 | rand139 | -28.67 | KLGA>DADES 884/855/855 |
| wide | 20 | KMDW-KBWI | 1 | rand140 | -2.15 | ANEWA>KBWI 360/357/347 |
| wide | 20 | KLGA-KORD | 7 | rand144 | -43.43 | KLGA>WYNDE 646/603/598 |
| wide | 20 | KLGA-KTPA | 4 | rand143 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 20 | KLAX-KDEN | 1 | rand150 | -21.06 | KLAX>KDEN 773/752/744 |
| wide | 20 | KDEN-KMDW | 4 | rand155 | -5.34 | ZIRKL>ENDEE 598/593/584 |
| wide | 20 | KEWR-KORD | 2 | rand158 | -7.16 | KEWR>WYNDE 600/593/586 |
| wide | 20 | KMDW-KCLT | 7 | rand159 | -15.54 | EMMLY>FILPZ 400/385/385 |
| wide | 20 | KCLT-KSAN | 5 | rand160 | -10.27 | TXK>SSO 774/764/764 |
| wide | 20 | KMDW-KCLT | 3 | rand162 | -75.82 | KMDW>VXV351045 444/368/355 |
| wide | 20 | KCLT-KSAN | 1 | rand165 | -19.04 | CHOPZ>SJT 874/855/855 |
| wide | 20 | KCLT-KSAN | 4 | rand166 | -23.62 | TXK>GBN 951/927/927 |
| wide | 20 | KFLL-KSAN | 1 | rand169 | -57.24 | KFLL>CWK112048 1004/947/909 |
| wide | 20 | KLAX-KAUS | 4 | rand173 | -36.89 | TRM>FST 732/695/684 |
| wide | 20 | KLGA-KDEN | 7 | rand176 | -2.15 | NEWEL>KDEN 1337/1335/1333 |
| wide | 20 | KMCO-KPHL | 4 | rand178 | -27.88 | KMCO>JIIMS 768/740/740 |
| wide | 20 | KMDW-KCLT | 1 | rand179 | -23.77 | KMDW>FILPZ 483/460/460 |
| wide | 20 | KSLC-KMSP | 3 | rand184 | -108.55 | OCS>TORGY 772/664/664 |
| wide | 20 | KEWR-KORD | 4 | rand191 | -2.52 | KEWR>WYNDE 600/598/586 |
| wide | 20 | KMDW-KCLT | 2 | rand190 | -9.41 | EMMLY>FILPZ 400/391/385 |
| wide | 20 | KDCA-KPHX | 7 | rand183 | -101.16 | DACOS>IRW 760/659/659 |
| wide | 20 | KDCA-KPHX | 6 | rand187 | -55.69 | HUMBO>EAGUL 1108/1052/1051 |
| wide | 20 | KCLT-KSAN | 0 | rand192 | -0.72 | CHOPZ>LFK 584/583/578 |
| wide | 20 | KMDW-KCLT | 1 | rand195 | -10.27 | KMDW>FILPZ 483/473/460 |
| wide | 20 | KLGA-KTPA | 3 | rand194 | -39.81 | KLGA>WIGVO 676/637/637 |
| wide | 20 | KSEA-KIAH | 7 | rand197 | -24.81 | KSEA>MQP 1438/1413/1413 |
| hug | 30 | KMSP-KJFK | 4 | rand001 | -60.24 | KMSP>HOXIE 765/705/691 |
| hug | 30 | KSFO-KLAS | 1 | rand008 | -38.53 | LOSHN>MISEN 219/180/180 |
| hug | 30 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| hug | 30 | KLAS-KDFW | 7 | rand033 | -48.24 | KLAS>CNX 577/528/472 |
| hug | 30 | KMDW-KBWI | 0 | rand066 | -15.46 | KMDW>ZZV031040 327/311/293 |
| hug | 30 | KJFK-KMIA | 1 | rand062 | -4.37 | EMJAY>HOAGG 687/683/680 |
| hug | 30 | KORD-KCLT | 2 | rand067 | -13.25 | CVG>SKYWA 206/193/152 |
| hug | 30 | KDEN-KBNA | 7 | rand091 | -92.48 | KDEN>RANTS 930/837/796 |
| hug | 30 | KMSP-KORD | 4 | rand128 | -1.02 | FGT>FYTTE 247/246/238 |
| hug | 30 | KATL-KIAD | 1 | rand130 | -87.20 | KATL>CAVLR 572/485/435 |
| hug | 30 | KLGA-KORD | 7 | rand144 | -22.00 | KLGA>LTOUR 547/525/506 |
| wide | 30 | KMSP-KJFK | 4 | rand001 | -61.29 | KMSP>STENT 798/737/724 |
| wide | 30 | KCLT-KSAN | 4 | rand002 | -10.27 | TXK>SSO 774/764/764 |
| wide | 30 | KSFO-KLAS | 1 | rand008 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 30 | KMDW-KCLT | 4 | rand010 | -90.01 | KMDW>SOT031071 495/405/393 |
| wide | 30 | KCLT-KSAN | 7 | rand009 | -32.84 | CHOPZ>INK 1018/986/986 |
| wide | 30 | KPHX-KAUS | 0 | rand011 | -16.31 | PXR>UCOKA 629/612/612 |
| wide | 30 | KLAS-KDFW | 5 | rand016 | -0.91 | GUP>VKTRY 572/571/566 |
| wide | 30 | KATL-KIAD | 3 | rand014 | -73.17 | KATL>RIC255063 478/405/357 |
| wide | 30 | KDCA-KPHX | 2 | rand018 | -18.72 | IIU>IRW 621/603/597 |
| wide | 30 | KDEN-KBNA | 7 | rand015 | -111.74 | KDEN>FAM261069 750/638/620 |
| wide | 30 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| wide | 30 | KLAX-KBOS | 7 | rand023 | -2.39 | EKR>BAE 901/898/893 |
| wide | 30 | KLAS-KDFW | 7 | rand033 | -115.82 | KLAS>INK 770/654/640 |
| wide | 30 | KLGA-KDEN | 0 | rand031 | -4.06 | MIKYG>OATHE 1195/1191/1189 |
| wide | 30 | KLAX-KAUS | 0 | rand036 | -14.44 | BLH>UCOKA 766/752/751 |
| wide | 30 | KMDW-KLGA | 0 | rand045 | -18.46 | DJB>MIP 339/321/247 |
| wide | 30 | KSLC-KIAH | 5 | rand049 | -9.48 | TCH031005>DRLLR 1026/1016/1008 |
| wide | 30 | KTPA-KSLC | 0 | rand050 | -2.27 | JAWJA>FSM 622/619/611 |
| wide | 30 | KLGA-KSEA | 2 | rand047 | -47.70 | MIKYG>HCT 1180/1132/1132 |
| wide | 30 | KEWR-KSEA | 1 | rand060 | -7.13 | NOSIK>MLP 1418/1411/1411 |
| wide | 30 | KJFK-KMIA | 1 | rand062 | -5.18 | WAVEY>KMIA 948/943/936 |
| wide | 30 | KDFW-KSFO | 7 | rand055 | -3.18 | HULZE>OAL 902/899/885 |
| wide | 30 | KSEA-KFLL | 4 | rand065 | -45.43 | MCI>ACORI 671/625/625 |
| wide | 30 | KLAX-KBOS | 5 | rand057 | -8.54 | SLN>KLYNE 671/662/662 |
| wide | 30 | KORD-KCLT | 2 | rand067 | -87.87 | KORD>FILPZ 562/474/473 |
| wide | 30 | KATL-KIAD | 1 | rand068 | -101.54 | KATL>RIC229062 478/376/355 |
| wide | 30 | KLGA-KTPA | 4 | rand069 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 30 | KDEN-KMDW | 7 | rand070 | -3.24 | HCT>KMDW 605/602/596 |
| wide | 30 | KMDW-KBWI | 0 | rand066 | -22.02 | KMDW>LUNDY 445/423/411 |
| wide | 30 | KTPA-KSLC | 0 | rand074 | -6.91 | JAWJA>PER 783/776/772 |
| wide | 30 | KMSP-KJFK | 4 | rand071 | -29.16 | FNT>STENT 374/345/301 |
| wide | 30 | KDTW-KMCO | 2 | rand077 | -16.37 | SVM169033>TEUFL 626/609/609 |
| wide | 30 | KDEN-KBNA | 7 | rand091 | -103.46 | KDEN>RYYMN 974/871/839 |
| wide | 30 | KDCA-KPHX | 5 | rand092 | -5.74 | LAJUG>ABQ 950/944/944 |
| wide | 30 | KSLC-KMSP | 0 | rand095 | -7.27 | TCH069060>UFFDA 680/672/671 |
| wide | 30 | KPHX-KAUS | 6 | rand096 | -18.78 | PXR>UCOKA 632/613/612 |
| wide | 30 | KMCO-KPHL | 1 | rand100 | -7.72 | KMCO>ORF235018 589/582/555 |
| wide | 30 | KTPA-KSLC | 1 | rand104 | -0.18 | CTY303025>HBU 1280/1280/1270 |
| wide | 30 | KMSP-KJFK | 1 | rand101 | -34.38 | DLL>DAFLU 391/356/317 |
| wide | 30 | KSEA-KIAH | 6 | rand112 | -10.39 | KSEA>MQP 1424/1413/1413 |
| wide | 30 | KMSP-KJFK | 5 | rand118 | -111.81 | KMSP>JHW282063 694/582/569 |
| wide | 30 | KMSP-KORD | 2 | rand120 | -15.54 | KMSP>FYTTE 294/278/248 |
| wide | 30 | KSLC-KDEN | 0 | rand116 | -5.01 | TCH>KDEN 366/361/337 |
| wide | 30 | KDEN-KBNA | 7 | rand121 | -111.05 | KDEN>FAM261069 750/639/620 |
| wide | 30 | KMSP-KORD | 4 | rand128 | -10.03 | KMSP>KORD 304/294/290 |
| wide | 30 | KFLL-KSAN | 3 | rand133 | -32.39 | ROZZI>DAS 497/465/431 |
| wide | 30 | KATL-KIAD | 1 | rand130 | -150.74 | KATL>KIAD 615/464/464 |
| wide | 30 | KDTW-KMCO | 7 | rand137 | -101.15 | KDTW>SZW049067 774/673/661 |
| wide | 30 | KLGA-KORD | 1 | rand138 | -37.69 | DJB>WATSN 289/252/173 |
| wide | 30 | KMDW-KBWI | 1 | rand140 | -2.15 | ANEWA>KBWI 360/357/347 |
| wide | 30 | KFLL-KSAN | 4 | rand136 | -157.95 | LEV>HOGGZ 1453/1295/1245 |
| wide | 30 | KLGA-KTPA | 1 | rand139 | -28.67 | KLGA>DADES 884/855/855 |
| wide | 30 | KLGA-KTPA | 4 | rand143 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 30 | KLGA-KORD | 7 | rand144 | -43.43 | KLGA>WYNDE 646/603/598 |
| wide | 30 | KDEN-KMDW | 4 | rand155 | -5.34 | ZIRKL>ENDEE 598/593/584 |
| wide | 30 | KLAX-KDEN | 1 | rand150 | -17.52 | KLAX>KDEN 773/755/744 |
| wide | 30 | KMDW-KCLT | 7 | rand159 | -15.54 | EMMLY>FILPZ 400/385/385 |
| wide | 30 | KCLT-KSAN | 5 | rand160 | -10.27 | TXK>SSO 774/764/764 |
| wide | 30 | KMDW-KCLT | 3 | rand162 | -75.82 | KMDW>VXV351045 444/368/355 |
| wide | 30 | KEWR-KORD | 2 | rand158 | -7.16 | KEWR>WYNDE 600/593/586 |
| wide | 30 | KFLL-KSAN | 1 | rand169 | -57.24 | KFLL>CWK112048 1004/947/909 |
| wide | 30 | KCLT-KSAN | 1 | rand165 | -19.04 | CHOPZ>SJT 874/855/855 |
| wide | 30 | KLAX-KAUS | 4 | rand173 | -36.21 | TRM>FST 732/696/684 |
| wide | 30 | KCLT-KSAN | 4 | rand166 | -23.62 | TXK>GBN 951/927/927 |
| wide | 30 | KLGA-KDEN | 7 | rand176 | -2.15 | NEWEL>KDEN 1337/1335/1333 |
| wide | 30 | KMDW-KCLT | 1 | rand179 | -23.77 | KMDW>FILPZ 483/460/460 |
| wide | 30 | KDCA-KPHX | 7 | rand183 | -101.16 | DACOS>IRW 760/659/659 |
| wide | 30 | KMCO-KPHL | 4 | rand178 | -27.88 | KMCO>JIIMS 768/740/740 |
| wide | 30 | KSLC-KMSP | 3 | rand184 | -108.55 | OCS>TORGY 772/664/664 |
| wide | 30 | KMDW-KCLT | 2 | rand190 | -9.41 | EMMLY>FILPZ 400/391/385 |
| wide | 30 | KEWR-KORD | 4 | rand191 | -2.52 | KEWR>WYNDE 600/598/586 |
| wide | 30 | KCLT-KSAN | 0 | rand192 | -0.72 | CHOPZ>LFK 584/583/578 |
| wide | 30 | KDCA-KPHX | 6 | rand187 | -55.69 | HUMBO>EAGUL 1108/1052/1051 |
| wide | 30 | KLGA-KTPA | 3 | rand194 | -39.81 | KLGA>WIGVO 676/637/637 |
| wide | 30 | KSEA-KIAH | 7 | rand197 | -24.81 | KSEA>MQP 1438/1413/1413 |
| wide | 30 | KMDW-KCLT | 1 | rand195 | -10.27 | KMDW>FILPZ 483/473/460 |
| hug | 40 | KMSP-KJFK | 4 | rand001 | -60.24 | KMSP>HOXIE 765/705/691 |
| hug | 40 | KSFO-KLAS | 1 | rand008 | -38.53 | LOSHN>MISEN 219/180/180 |
| hug | 40 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| hug | 40 | KLAS-KDFW | 7 | rand033 | -48.24 | KLAS>CNX 577/528/472 |
| hug | 40 | KMDW-KBWI | 0 | rand066 | -15.46 | KMDW>ZZV031040 327/311/293 |
| hug | 40 | KJFK-KMIA | 1 | rand062 | -1.27 | EMJAY>HOAGG 687/686/680 |
| hug | 40 | KORD-KCLT | 2 | rand067 | -13.25 | CVG>SKYWA 206/193/152 |
| hug | 40 | KDEN-KBNA | 7 | rand091 | -92.48 | KDEN>RANTS 930/837/796 |
| hug | 40 | KMSP-KORD | 4 | rand128 | -1.02 | FGT>FYTTE 247/246/238 |
| hug | 40 | KATL-KIAD | 1 | rand130 | -87.20 | KATL>CAVLR 572/485/435 |
| hug | 40 | KLGA-KORD | 7 | rand144 | -22.00 | KLGA>LTOUR 547/525/506 |
| wide | 40 | KMSP-KJFK | 4 | rand001 | -61.29 | KMSP>STENT 798/737/724 |
| wide | 40 | KCLT-KSAN | 4 | rand002 | -10.27 | TXK>SSO 774/764/764 |
| wide | 40 | KMDW-KCLT | 4 | rand010 | -90.01 | KMDW>SOT031071 495/405/393 |
| wide | 40 | KPHX-KAUS | 0 | rand011 | -16.31 | PXR>UCOKA 629/612/612 |
| wide | 40 | KSFO-KLAS | 1 | rand008 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 40 | KCLT-KSAN | 7 | rand009 | -32.84 | CHOPZ>INK 1018/986/986 |
| wide | 40 | KLAS-KDFW | 5 | rand016 | -0.91 | GUP>VKTRY 572/571/566 |
| wide | 40 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| wide | 40 | KATL-KIAD | 3 | rand014 | -73.17 | KATL>RIC255063 478/405/357 |
| wide | 40 | KDCA-KPHX | 2 | rand018 | -18.72 | IIU>IRW 621/603/597 |
| wide | 40 | KDEN-KBNA | 7 | rand015 | -111.74 | KDEN>FAM261069 750/638/620 |
| wide | 40 | KLAX-KBOS | 7 | rand023 | -2.39 | EKR>BAE 901/898/893 |
| wide | 40 | KLAS-KDFW | 7 | rand033 | -115.82 | KLAS>INK 770/654/640 |
| wide | 40 | KLGA-KDEN | 0 | rand031 | -4.06 | MIKYG>OATHE 1195/1191/1189 |
| wide | 40 | KLAX-KAUS | 0 | rand036 | -14.44 | BLH>UCOKA 766/752/751 |
| wide | 40 | KLGA-KSEA | 2 | rand047 | -47.70 | MIKYG>HCT 1180/1132/1132 |
| wide | 40 | KMDW-KLGA | 0 | rand045 | -18.46 | DJB>MIP 339/321/247 |
| wide | 40 | KSLC-KIAH | 5 | rand049 | -9.48 | TCH031005>DRLLR 1026/1016/1008 |
| wide | 40 | KTPA-KSLC | 0 | rand050 | -2.27 | JAWJA>FSM 622/619/611 |
| wide | 40 | KDFW-KSFO | 7 | rand055 | -3.18 | HULZE>OAL 902/899/885 |
| wide | 40 | KEWR-KSEA | 1 | rand060 | -7.13 | NOSIK>MLP 1418/1411/1411 |
| wide | 40 | KJFK-KMIA | 1 | rand062 | -5.38 | WAVEY>KMIA 948/943/936 |
| wide | 40 | KLAX-KBOS | 5 | rand057 | -8.54 | SLN>KLYNE 671/662/662 |
| wide | 40 | KORD-KCLT | 2 | rand067 | -87.87 | KORD>FILPZ 562/474/473 |
| wide | 40 | KATL-KIAD | 1 | rand068 | -101.54 | KATL>RIC229062 478/376/355 |
| wide | 40 | KDEN-KMDW | 7 | rand070 | -3.24 | HCT>KMDW 605/602/596 |
| wide | 40 | KMSP-KJFK | 4 | rand071 | -29.16 | FNT>STENT 374/345/301 |
| wide | 40 | KSEA-KFLL | 4 | rand065 | -45.43 | MCI>ACORI 671/625/625 |
| wide | 40 | KMDW-KBWI | 0 | rand066 | -22.02 | KMDW>LUNDY 445/423/411 |
| wide | 40 | KLGA-KTPA | 4 | rand069 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 40 | KTPA-KSLC | 0 | rand074 | -6.91 | JAWJA>PER 783/776/772 |
| wide | 40 | KDTW-KMCO | 2 | rand077 | -16.37 | SVM169033>TEUFL 626/609/609 |
| wide | 40 | KDEN-KBNA | 7 | rand091 | -103.46 | KDEN>RYYMN 974/871/839 |
| wide | 40 | KDCA-KPHX | 5 | rand092 | -5.74 | LAJUG>ABQ 950/944/944 |
| wide | 40 | KPHX-KAUS | 6 | rand096 | -18.78 | PXR>UCOKA 632/613/612 |
| wide | 40 | KSLC-KMSP | 0 | rand095 | -7.27 | TCH069060>UFFDA 680/672/671 |
| wide | 40 | KMCO-KPHL | 1 | rand100 | -5.67 | KMCO>ORF235018 589/584/555 |
| wide | 40 | KTPA-KSLC | 1 | rand104 | -0.18 | CTY303025>HBU 1280/1280/1270 |
| wide | 40 | KMSP-KJFK | 1 | rand101 | -34.38 | DLL>DAFLU 391/356/317 |
| wide | 40 | KLAX-KAUS | 6 | rand105 | -3.90 | BXK110038>DILLO 719/715/690 |
| wide | 40 | KSEA-KIAH | 6 | rand112 | -10.39 | KSEA>MQP 1424/1413/1413 |
| wide | 40 | KMSP-KJFK | 5 | rand118 | -111.81 | KMSP>JHW282063 694/582/569 |
| wide | 40 | KSLC-KDEN | 0 | rand116 | -5.01 | TCH>KDEN 366/361/337 |
| wide | 40 | KDEN-KBNA | 7 | rand121 | -111.05 | KDEN>FAM261069 750/639/620 |
| wide | 40 | KMSP-KORD | 2 | rand120 | -23.64 | KMSP>FYTTE 294/270/248 |
| wide | 40 | KMSP-KORD | 4 | rand128 | -12.10 | KMSP>KORD 304/292/290 |
| wide | 40 | KATL-KIAD | 1 | rand130 | -150.74 | KATL>KIAD 615/464/464 |
| wide | 40 | KFLL-KSAN | 3 | rand133 | -32.39 | ROZZI>DAS 497/465/431 |
| wide | 40 | KLGA-KORD | 1 | rand138 | -37.69 | DJB>WATSN 289/252/173 |
| wide | 40 | KMDW-KBWI | 1 | rand140 | -2.15 | ANEWA>KBWI 360/357/347 |
| wide | 40 | KFLL-KSAN | 4 | rand136 | -183.00 | LEV>HOGGZ 1453/1270/1245 |
| wide | 40 | KLGA-KTPA | 4 | rand143 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 40 | KDTW-KMCO | 7 | rand137 | -101.15 | KDTW>SZW049067 774/673/661 |
| wide | 40 | KLGA-KTPA | 1 | rand139 | -28.67 | KLGA>DADES 884/855/855 |
| wide | 40 | KLGA-KORD | 7 | rand144 | -43.43 | KLGA>WYNDE 646/603/598 |
| wide | 40 | KLAX-KDEN | 1 | rand150 | -17.52 | KLAX>KDEN 773/755/744 |
| wide | 40 | KDEN-KMDW | 4 | rand155 | -5.34 | ZIRKL>ENDEE 598/593/584 |
| wide | 40 | KMDW-KCLT | 7 | rand159 | -15.54 | EMMLY>FILPZ 400/385/385 |
| wide | 40 | KEWR-KORD | 2 | rand158 | -7.16 | KEWR>WYNDE 600/593/586 |
| wide | 40 | KCLT-KSAN | 5 | rand160 | -10.27 | TXK>SSO 774/764/764 |
| wide | 40 | KMDW-KCLT | 3 | rand162 | -75.82 | KMDW>VXV351045 444/368/355 |
| wide | 40 | KCLT-KSAN | 4 | rand166 | -23.62 | TXK>GBN 951/927/927 |
| wide | 40 | KCLT-KSAN | 1 | rand165 | -19.04 | CHOPZ>SJT 874/855/855 |
| wide | 40 | KFLL-KSAN | 1 | rand169 | -57.24 | KFLL>CWK112048 1004/947/909 |
| wide | 40 | KLAX-KAUS | 4 | rand173 | -35.64 | TRM>FST 732/696/684 |
| wide | 40 | KLGA-KDEN | 7 | rand176 | -2.15 | NEWEL>KDEN 1337/1335/1333 |
| wide | 40 | KMCO-KPHL | 4 | rand178 | -27.88 | KMCO>JIIMS 768/740/740 |
| wide | 40 | KDCA-KPHX | 7 | rand183 | -101.16 | DACOS>IRW 760/659/659 |
| wide | 40 | KMDW-KCLT | 1 | rand179 | -23.77 | KMDW>FILPZ 483/460/460 |
| wide | 40 | KSLC-KMSP | 3 | rand184 | -108.55 | OCS>TORGY 772/664/664 |
| wide | 40 | KDCA-KPHX | 6 | rand187 | -55.69 | HUMBO>EAGUL 1108/1052/1051 |
| wide | 40 | KMDW-KCLT | 2 | rand190 | -9.41 | EMMLY>FILPZ 400/391/385 |
| wide | 40 | KCLT-KSAN | 0 | rand192 | -0.72 | CHOPZ>LFK 584/583/578 |
| wide | 40 | KMDW-KCLT | 1 | rand195 | -10.27 | KMDW>FILPZ 483/473/460 |
| wide | 40 | KEWR-KORD | 4 | rand191 | -2.52 | KEWR>WYNDE 600/598/586 |
| wide | 40 | KSEA-KIAH | 7 | rand197 | -24.81 | KSEA>MQP 1438/1413/1413 |
| wide | 40 | KLGA-KTPA | 3 | rand194 | -39.81 | KLGA>WIGVO 676/637/637 |
| hug | 50 | KMSP-KJFK | 4 | rand001 | -60.24 | KMSP>HOXIE 765/705/691 |
| hug | 50 | KSFO-KLAS | 1 | rand008 | -38.53 | LOSHN>MISEN 219/180/180 |
| hug | 50 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| hug | 50 | KLAS-KDFW | 7 | rand033 | -87.94 | KLAS>CNX 577/489/472 |
| hug | 50 | KJFK-KMIA | 1 | rand062 | -2.47 | EMJAY>HOAGG 687/685/680 |
| hug | 50 | KORD-KCLT | 2 | rand067 | -13.25 | CVG>SKYWA 206/193/152 |
| hug | 50 | KMDW-KBWI | 0 | rand066 | -15.46 | KMDW>ZZV031040 327/311/293 |
| hug | 50 | KDEN-KBNA | 7 | rand091 | -92.48 | KDEN>RANTS 930/837/796 |
| hug | 50 | KMSP-KORD | 4 | rand128 | -1.02 | FGT>FYTTE 247/246/238 |
| hug | 50 | KATL-KIAD | 1 | rand130 | -87.20 | KATL>CAVLR 572/485/435 |
| hug | 50 | KLGA-KORD | 7 | rand144 | -22.00 | KLGA>LTOUR 547/525/506 |
| wide | 50 | KMSP-KJFK | 4 | rand001 | -61.29 | KMSP>STENT 798/737/724 |
| wide | 50 | KCLT-KSAN | 4 | rand002 | -10.27 | TXK>SSO 774/764/764 |
| wide | 50 | KSFO-KLAS | 1 | rand008 | -84.12 | KAYEX>KLAS 363/279/279 |
| wide | 50 | KPHX-KAUS | 0 | rand011 | -16.31 | PXR>UCOKA 629/612/612 |
| wide | 50 | KCLT-KSAN | 7 | rand009 | -32.84 | CHOPZ>INK 1018/986/986 |
| wide | 50 | KMDW-KCLT | 4 | rand010 | -90.01 | KMDW>SOT031071 495/405/393 |
| wide | 50 | KLAS-KDFW | 5 | rand016 | -0.91 | GUP>VKTRY 572/571/566 |
| wide | 50 | KATL-KIAD | 3 | rand014 | -73.17 | KATL>RIC255063 478/405/357 |
| wide | 50 | KDCA-KPHX | 2 | rand018 | -18.72 | IIU>IRW 621/603/597 |
| wide | 50 | KDEN-KBNA | 7 | rand015 | -111.74 | KDEN>FAM261069 750/638/620 |
| wide | 50 | KLAX-KBOS | 7 | rand023 | -2.39 | EKR>BAE 901/898/893 |
| wide | 50 | KMSP-KORD | 0 | rand017 | -4.99 | KMSP>FYTTE 290/286/248 |
| wide | 50 | KLGA-KDEN | 0 | rand031 | -4.06 | MIKYG>OATHE 1195/1191/1189 |
| wide | 50 | KLAS-KDFW | 7 | rand033 | -115.82 | KLAS>INK 770/654/640 |
| wide | 50 | KLAX-KAUS | 0 | rand036 | -11.41 | BLH>UCOKA 766/755/751 |
| wide | 50 | KLGA-KSEA | 2 | rand047 | -47.70 | MIKYG>HCT 1180/1132/1132 |
| wide | 50 | KMDW-KLGA | 0 | rand045 | -18.46 | DJB>MIP 339/321/247 |
| wide | 50 | KSLC-KIAH | 5 | rand049 | -9.48 | TCH031005>DRLLR 1026/1016/1008 |
| wide | 50 | KTPA-KSLC | 0 | rand050 | -2.27 | JAWJA>FSM 622/619/611 |
| wide | 50 | KDFW-KSFO | 7 | rand055 | -3.18 | HULZE>OAL 902/899/885 |
| wide | 50 | KEWR-KSEA | 1 | rand060 | -7.13 | NOSIK>MLP 1418/1411/1411 |
| wide | 50 | KJFK-KMIA | 1 | rand062 | -7.07 | WAVEY>KMIA 948/941/936 |
| wide | 50 | KLAX-KBOS | 5 | rand057 | -8.54 | SLN>KLYNE 671/662/662 |
| wide | 50 | KSEA-KFLL | 4 | rand065 | -45.43 | MCI>ACORI 671/625/625 |
| wide | 50 | KORD-KCLT | 2 | rand067 | -87.87 | KORD>FILPZ 562/474/473 |
| wide | 50 | KLGA-KTPA | 4 | rand069 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 50 | KMDW-KBWI | 0 | rand066 | -22.02 | KMDW>LUNDY 445/423/411 |
| wide | 50 | KDEN-KMDW | 7 | rand070 | -3.24 | HCT>KMDW 605/602/596 |
| wide | 50 | KMSP-KJFK | 4 | rand071 | -29.16 | FNT>STENT 374/345/301 |
| wide | 50 | KATL-KIAD | 1 | rand068 | -94.01 | KATL>RIC229062 478/384/355 |
| wide | 50 | KTPA-KSLC | 0 | rand074 | -6.91 | JAWJA>PER 783/776/772 |
| wide | 50 | KDTW-KMCO | 2 | rand077 | -16.37 | SVM169033>TEUFL 626/609/609 |
| wide | 50 | KDCA-KPHX | 5 | rand092 | -5.74 | LAJUG>ABQ 950/944/944 |
| wide | 50 | KSLC-KMSP | 0 | rand095 | -7.27 | TCH069060>UFFDA 680/672/671 |
| wide | 50 | KDEN-KBNA | 7 | rand091 | -103.46 | KDEN>RYYMN 974/871/839 |
| wide | 50 | KPHX-KAUS | 6 | rand096 | -18.78 | PXR>UCOKA 632/613/612 |
| wide | 50 | KMCO-KPHL | 1 | rand100 | -9.08 | KMCO>ORF235018 589/580/555 |
| wide | 50 | KTPA-KSLC | 1 | rand104 | -0.18 | CTY303025>HBU 1280/1280/1270 |
| wide | 50 | KLAX-KAUS | 6 | rand105 | -3.89 | BXK110038>DILLO 719/715/690 |
| wide | 50 | KMSP-KJFK | 1 | rand101 | -34.38 | DLL>DAFLU 391/356/317 |
| wide | 50 | KSEA-KIAH | 6 | rand112 | -10.39 | KSEA>MQP 1424/1413/1413 |
| wide | 50 | KMSP-KJFK | 5 | rand118 | -111.81 | KMSP>JHW282063 694/582/569 |
| wide | 50 | KSLC-KDEN | 0 | rand116 | -5.01 | TCH>KDEN 366/361/337 |
| wide | 50 | KDEN-KBNA | 7 | rand121 | -111.05 | KDEN>FAM261069 750/639/620 |
| wide | 50 | KMSP-KORD | 2 | rand120 | -23.98 | KMSP>FYTTE 294/270/248 |
| wide | 50 | KMSP-KORD | 4 | rand128 | -10.03 | KMSP>KORD 304/294/290 |
| wide | 50 | KFLL-KSAN | 3 | rand133 | -32.39 | ROZZI>DAS 497/465/431 |
| wide | 50 | KATL-KIAD | 1 | rand130 | -150.74 | KATL>KIAD 615/464/464 |
| wide | 50 | KFLL-KSAN | 4 | rand136 | -161.53 | LEV>HOGGZ 1453/1292/1245 |
| wide | 50 | KDTW-KMCO | 7 | rand137 | -101.15 | KDTW>SZW049067 774/673/661 |
| wide | 50 | KLGA-KTPA | 1 | rand139 | -28.67 | KLGA>DADES 884/855/855 |
| wide | 50 | KMDW-KBWI | 1 | rand140 | -2.15 | ANEWA>KBWI 360/357/347 |
| wide | 50 | KLGA-KORD | 1 | rand138 | -37.69 | DJB>WATSN 289/252/173 |
| wide | 50 | KLGA-KTPA | 4 | rand143 | -28.92 | KLGA>DADES 884/855/855 |
| wide | 50 | KLGA-KORD | 7 | rand144 | -43.43 | KLGA>WYNDE 646/603/598 |
| wide | 50 | KLAX-KDEN | 1 | rand150 | -17.52 | KLAX>KDEN 773/755/744 |
| wide | 50 | KDEN-KMDW | 4 | rand155 | -5.34 | ZIRKL>ENDEE 598/593/584 |
| wide | 50 | KCLT-KSAN | 5 | rand160 | -10.27 | TXK>SSO 774/764/764 |
| wide | 50 | KEWR-KORD | 2 | rand158 | -7.16 | KEWR>WYNDE 600/593/586 |
| wide | 50 | KMDW-KCLT | 3 | rand162 | -75.82 | KMDW>VXV351045 444/368/355 |
| wide | 50 | KMDW-KCLT | 7 | rand159 | -15.54 | EMMLY>FILPZ 400/385/385 |
| wide | 50 | KCLT-KSAN | 1 | rand165 | -19.04 | CHOPZ>SJT 874/855/855 |
| wide | 50 | KCLT-KSAN | 4 | rand166 | -23.62 | TXK>GBN 951/927/927 |
| wide | 50 | KFLL-KSAN | 1 | rand169 | -57.24 | KFLL>CWK112048 1004/947/909 |
| wide | 50 | KLGA-KDEN | 7 | rand176 | -2.15 | NEWEL>KDEN 1337/1335/1333 |
| wide | 50 | KLAX-KAUS | 4 | rand173 | -36.02 | TRM>FST 732/696/684 |
| wide | 50 | KMCO-KPHL | 4 | rand178 | -27.88 | KMCO>JIIMS 768/740/740 |
| wide | 50 | KMDW-KCLT | 1 | rand179 | -23.77 | KMDW>FILPZ 483/460/460 |
| wide | 50 | KDCA-KPHX | 7 | rand183 | -101.16 | DACOS>IRW 760/659/659 |
| wide | 50 | KSLC-KMSP | 3 | rand184 | -108.55 | OCS>TORGY 772/664/664 |
| wide | 50 | KDCA-KPHX | 6 | rand187 | -55.69 | HUMBO>EAGUL 1108/1052/1051 |
| wide | 50 | KMDW-KCLT | 2 | rand190 | -9.41 | EMMLY>FILPZ 400/391/385 |
| wide | 50 | KEWR-KORD | 4 | rand191 | -2.52 | KEWR>WYNDE 600/598/586 |
| wide | 50 | KLGA-KTPA | 3 | rand194 | -39.81 | KLGA>WIGVO 676/637/637 |
| wide | 50 | KMDW-KCLT | 1 | rand195 | -10.27 | KMDW>FILPZ 483/473/460 |
| wide | 50 | KCLT-KSAN | 0 | rand192 | -0.72 | CHOPZ>LFK 584/583/578 |
| wide | 50 | KSEA-KIAH | 7 | rand197 | -24.81 | KSEA>MQP 1438/1413/1413 |
