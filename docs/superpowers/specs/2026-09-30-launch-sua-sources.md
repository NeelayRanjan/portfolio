# Launch-site airspace: public polygon sources (researched 2026-09-30)

## 1. Polygon source: FAA AIS "Special_Use_Airspace" ArcGIS layer (verified working)

- **Layer**: `https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Special_Use_Airspace/FeatureServer/0`
  (ArcGIS item `dd0d1b726e504137ab3c41b21835d05b`, owner `AeronauticalInformationServices_FAA`; hub: https://adds-faa.opendata.arcgis.com/).
- **Status/license**: item credit "FAA, ATO, Mission Support Services, Aeronautical Information Services"; licenseInfo says "The data provided is for public use." US federal work, so public domain (17 USC 105). Published every 56 days; current cycle **0901Z 03 Sep 2026 to 0901Z 29 Oct 2026**. Record the cycle date with any snapshot.
- **Contents**: 1,542 features (MOA 718, R 555, W 212, A 39, P 13, D 5). Fields include `NAME` (e.g. `R-2516`), `TYPE_CODE`, `LOWER_VAL/UOM/CODE`, `UPPER_VAL/UOM/CODE`/`UPPER_DESC` (`-9998` + `UNLTD` = unlimited), `TIMESOFUSE`, `CONT_AGENT`, `STATE`, `REMARKS`. There is no "using agency" field.
- **Export formats**: csv, shapefile, geojson, kml, filegdb, and others.
- **Sample queries that returned polygons**:
  - Single designator: `.../FeatureServer/0/query?where=NAME%3D%27R-2516%27&outFields=NAME,TYPE_CODE,LOWER_VAL,UPPER_DESC,TIMESOFUSE&f=geojson`
  - A family: `.../query?where=NAME+LIKE+%27R-293%25%27+OR+NAME+LIKE+%27W-497%25%27&outFields=NAME&geometryPrecision=5&f=geojson` returned W-497A, W-497B x3, R-2932, R-2933, R-2934 x2, R-2935.
  - The whole layer (`where=1=1&outFields=*&f=geojson`) is one ~22 MB request, under maxRecordCount 2000.
- ⚠️ **Rate limit**: I hit HTTP 429 ("6000 request units per minute", 60 s retry) after a handful of queries. Pull once in a hand-run script and commit the subset. Don't query it from the browser.
- ⚠️ **One designator can map to several features.** Altitude-band pieces and exclusions are separate rows, e.g. R-5107B has 12 rows and R-2934 has 2 (one "EXCLUDES BELOW 1200 FT AGL"). For a 2D demo, union or dissolve by NAME and record that you did.
- Not verified: the NASR 28-day subscription's AIXM SAA files. I didn't find the link on the subscription page, so I'm not citing it.

## 2. Ephemeral launch TFRs: tfr.faa.gov (verified working)

- Current list (JSON): `https://tfr.faa.gov/tfrapi/exportTfrList` (filter `type == "SPACE OPERATIONS"`).
- Current polygons (GeoJSON WFS): `https://tfr.faa.gov/geoserver/TFR/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=TFR:V_TFR_LOC&maxFeatures=1000&outputFormat=application/json&srsname=EPSG:4326`. It only serves active TFRs, which is 110 features today.
- **Per-NOTAM XML with vertices**: `https://tfr.faa.gov/download/detail_<yr>_<seq>.xml` (also `.aixm50`). **Expired space TFRs are still downloadable**, which I confirmed for 2025 ones. The NOTAM text is FAA public-domain data. `notams.aim.faa.gov` PDFs return 403 (Akamai) to curl and WebFetch.
- These are the only public polygons for Starbase, Van Horn and Kodiak. Each one is **a single past event, not permanent airspace**, and should be labeled that way.

## 3. Per-site table

| Site | Designators / area | Polygon source | Launch-association source | Confidence | Notes |
|---|---|---|---|---|---|
| Cape Canaveral SFS / KSC (FL) | R-2932 (SFC-4,999, continuous), R-2933 (5,000-UNL), R-2934 (SFC-UNL, 2 rows), R-2935 (11,000-UNL), W-497A, W-497B (3 rows) | FAA SUA layer (above) | FAA Spaceports by State, https://www.faa.gov/space/spaceports_by_state, lists all six by name for CCSFS and R-2932 to R-2935 for KSC. Also FR 2015-32159 (using agency 45th Space Wing), and live TFR FDC 6/6219 (https://tfr.faa.gov/download/detail_6_6219.xml, "SpaceX NROL97", 4 Oct 2026): "THIS AREA ENCOMPASSES R2932, R2933 AND PORTIONS OF R2934 AND W497A" | High | W-497B runs offshore to 77°W, 27-30°N, so the Atlantic part is outside land. The TFR has 37 vertices, SFC-FL180, and excludes international waters. |
| Vandenberg SFB (CA) | R-2516, R-2517 (SFC-UNL), R-2534A/B (500 AGL-UNL, by NOTAM), W-532S | FAA SUA layer | FAA Spaceports by State: "R-2516/2517, W-532S" and "R-2534A/B". FR 2017-24103 (Vandenberg boundary amendments), FR 02-23282 (R-2534 using agency) | High (R-areas, W-532S); Low (W-532E/N) | W-532E and W-532N exist in the layer (Point Arguello) but no source ties them to launches, so leave them out. W-532 extends to 123.6°W, which is offshore. |
| Wallops / MARS (VA) | R-6604A-E; VACAPES warning areas (the FAA layer names W-386 and W-387A/B "VIRGINIA CAPES") | FAA SUA layer | NASA Wallops Range User's Handbook 840-HDBK-0003 §3.1.4, https://www.nasa.gov/wp-content/uploads/2023/09/wallopsrangehandbook-lowres.pdf ("R-6604 ... connecting WFF and offshore warning areas"; "Virginia Capes warning areas"). NASA R-6604 EA: https://www.nasa.gov/wp-content/uploads/2024/10/airspace-r6604-cde-ea-fonsi.pdf | High (R-6604A/B); Medium (W-386); Low (W-387) | The handbook text says "VACAPES" and doesn't name a W number (its Fig. 3-4 does, but I didn't read it). R-6604C-E are low-altitude areas (to 3,500 ft) from the R-6604 C/D/E EA, likely for UAS. W-386 runs offshore to 72.7°W. |
| Starbase, Boca Chica (TX) | **No charted SUA.** Launch TFR example: FDC 5/3325, Starship Flight 10, 27 Aug 2025, SFC-UNL, 6 vertices: 25°55'N 97°12'W, 26°01'N 97°14'W, 26°08'N 97°02'W, 26°11'N 96°56'W, 26°00'N 96°55'W, 26°00'N 97°00'W. Also FDC 5/4390 (Flight 9) | https://tfr.faa.gov/download/detail_5_3325.xml (also `detail_5_4390.xml`) | The TFR text itself ("AIRSPACE BOCA CHICA, TX ... SPACE OPS AREA"). FAA Starship page: https://www.faa.gov/space/stakeholder_engagement/spacex_starship | High (TFR polygon); Medium (representativeness) | The downrange Gulf and Caribbean AHAs are separate international NOTAMs (e.g. MMFR B1736/25), and I couldn't fetch them (403). The FAA tiered EA (20250919 draft) shows AHAs only as notional figures, with no coordinates. Year-long TFRs 5/3678 and 5/3679 (Brownsville, SFC-2,000/5,000) are site security, not launch. W-228A-D (Corpus Christi) is NOT a Starbase launch area, so don't use it. |
| Spaceport America (NM) | R-5111A (13,000-UNL, 4 rows), R-5111B (SFC-13,000). Also R-5111C/D (Elephant Butte) in the layer, not cited | FAA SUA layer | FAA Hermeus WSMR reliance doc (https://www.faa.gov/about/office_org/headquarters_offices/apl/aee/env_policy/sfa_supersonic/Hermeus_SFA_gtM1_WSMR_20260409_Final.pdf) as summarized by search: "located within WSMR's R-5111 A & B restricted area" | Medium | I saw that quote only through the search summary and didn't open the PDF. Read it before shipping. Vertical Launch Area is at 32°56'25.0"N 106°55'15.2"W (Spaceport America mishap plan). |
| White Sands Missile Range (NM) | R-5107A-K, R-5109A/B | FAA SUA layer | FR E8-19271 (R-5107A revision, WSMR), https://www.federalregister.gov/documents/2008/08/20/E8-19271/revision-of-restricted-area-5107a-white-sands-missile-range-nm; WSMR "About" page | Medium-High | This is a missile and sounding-rocket range, not orbital. R-5107F/G are FL240-450 and cross into R-5109. It is large (~33 rows) and would dominate the map. |
| Mojave Air & Space Port (CA) | R-2515 (SFC-UNL), R-2508 (complex, 20,000-UNL) | FAA SUA layer | FAA Spaceports by State: "Restricted Airspace Access (R2508/2515)" | Low | Horizontal-launch site only. It lists these as *access to* Edwards' airspace, not launch-hazard airspace, and R-2508 covers much of the Mojave. I'd drop it or label it clearly. |
| Blue Origin Launch Site One, Van Horn (TX) (addition) | No SUA. TFR example FDC 5/0611, NS-35, 26 Aug 2025, SFC-UNL, 8 vertices from 31°41'N 105°08'W (full list in the XML) | https://tfr.faa.gov/download/detail_5_0611.xml | TFR text ("250826 Blue Origin-NS-35", "VAN HORN, TX ... SPACE OPS AREA"); site listed on FAA Spaceports by State | High | The only active suborbital crewed site in the lower 48 not covered above. |
| Black Rock, NV (addition) | Current SPACE OPERATIONS TFRs FDC 6/6134-6/6136 (2-5 Oct 2026) | tfr.faa.gov WFS/XML | TFR type only | Low | Probably amateur high-power rocketry, not a licensed site. Mention it but leave it out of the preset. |

## 4. Outside the lower-48 domain

- **Pacific Spaceport Complex Alaska (Kodiak)** is FAA-licensed (LSO 03-008). The SUA layer has **no** feature near Kodiak (57°N, 152°W). Launches use per-event TFRs (see Wikipedia/AAC sources) and maritime warnings. It's outside the domain, so leave it out. W-612 (AK) lies in the Gulf of Alaska east of Kenai, and nothing ties it to Kodiak.
- **Offshore-only parts**: W-497B (Atlantic to 77°W), W-532S (Pacific to 122.9°W), W-386/387 (Atlantic to 72.7°W). They're charted, but most of their area is over ocean. Clip them to the model's bounding box, or disclose them as partly outside the domain.

## 5. Uncertain or not verified

- The Spaceport America to R-5111A/B link rests on a search summary of an FAA PDF I didn't open.
- I didn't check the Wallops W-number against the handbook figure.
- Starship downrange AHA coordinates only exist in NOTAM PDFs that return 403. Search-result snippets cite points (e.g. 2600N 09700W, 2600N 09555W for Flight 5/11), but I didn't verify them, so I'm not using them.
- tfr.faa.gov's retention of expired XMLs is observed behavior, not a documented archive. Snapshot anything you use, with the NOTAM number and URL.
- `CONT_AGENT` is the controlling ATC facility, not the using agency. The launch associations above come from the cited documents, not the layer.
