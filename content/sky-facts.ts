/**
 * Every card and desk one-liner in the night sky (spec
 * docs/superpowers/specs/2026-09-15-sky-objects-design.md §5-§7): one entry
 * per selectable thing, keyed by the same id the renderer uses (objects.json
 * ids, lowercase planet names, "moon", "iss", "milky-way", shower ids, IAU
 * constellation abbreviations).
 *
 * ⚠️ NO RUNTIME IMPORTS. scripts/test-sky-facts.mjs imports this file straight
 * into node. Types only.
 *
 * Rules, all binding (the plan's Task 3 spells them out):
 *   - Every number in an entry appears in one of its cited sources. No
 *     uncited claim. A quote is verbatim inside “curly quotes”; a paraphrase
 *     changes the wording, never the fact.
 *   - Voice-gated by scripts/check-voice.mjs with copy.ts's rules. The
 *     citation fields are the sources' own words and are not scanned; kind,
 *     oneLiner, body and visibility are. A quote that would trip the gate
 *     gets paraphrased instead.
 *   - `accessed` is the ISO date the source was actually read.
 */

export type Citation = {
  /** APA author: "Ridpath, I.", or an organisation: "NASA Science". */
  author: string;
  /** Four digits, or "n.d." when the page carries no date. */
  year: string;
  title: string;
  site: string;
  url: string;
  /** ISO date the page was read, rendered "Retrieved September 15, 2026". */
  accessed: string;
};

export type SkyFact = {
  id: string;
  /** Card kind line: "Spiral galaxy · 2.5 million light-years". */
  kind: string;
  /** Desk hover line, a label rather than a sentence, at most 64 characters. */
  oneLiner: string;
  /** One to three sentences. */
  body: string[];
  /** Starts with "Naked eye", "Binoculars", "Telescope" or "Not visible". */
  visibility: string;
  citations: Citation[];
};

/* Sources shared by many entries. */

export const IAU_TABLE: Citation = {
  author: "Wikipedia contributors",
  year: "2026",
  title: "IAU designated constellations (revision 1373165890)",
  site: "Wikipedia",
  url: "https://en.wikipedia.org/w/index.php?title=IAU_designated_constellations&oldid=1373165890",
  accessed: "2026-09-15",
};

export const IMO_2026: Citation = {
  author: "Rendtel, J. (Ed.)",
  year: "2025",
  title: "2026 meteor shower calendar (IMO INFO(3-25))",
  site: "International Meteor Organization, via the Internet Archive",
  url: "https://web.archive.org/web/20260905025331id_/https://www.imo.net/files/meteor-shower/cal2026.pdf",
  accessed: "2026-09-15",
};

export const HORIZONS: Citation = {
  author: "NASA Jet Propulsion Laboratory",
  year: "n.d.",
  title: "Horizons system",
  site: "JPL Solar System Dynamics",
  url: "https://ssd.jpl.nasa.gov/horizons/",
  accessed: "2026-09-15",
};

export const CELESTRAK_ISS: Citation = {
  author: "Kelso, T. S.",
  year: "n.d.",
  title: "ISS (ZARYA), NORAD 25544, two-line element set",
  site: "CelesTrak",
  url: "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE",
  accessed: "2026-09-15",
};

/**
 * The link between an emission line and the colour it photographs as
 * (controller ruling R-COLOUR-2, .superpowers/sdd/sky-colour/progress.md).
 * Its own words: hydrogen-alpha is "in the deep red at 656.28 nanometers",
 * and planetary nebulae "are blue-green in color from emission lines of
 * doubly ionized oxygen at 495.9 nanometers and 500.7 nanometers".
 *
 * A freely published book by a career astrophotographer, which is exactly
 * whose field this is. It sits below NASA/ESA in authority, so it is cited as
 * him and never dressed up as an institution. It is carried by the colour
 * note on the cards whose palette rests on a line's own wavelength (task 7),
 * not by the card bodies: one shared citation beats fifteen edited
 * paragraphs. [N II] = red is NOT sourced by it or by anything else here, and
 * nothing on the site states it.
 */
export const EMISSION_LINE_COLOUR: Citation = {
  author: "Lodriguss, J.",
  year: "n.d.",
  title: "Color in astronomical objects",
  site: "Beginner's Guide to Astronomical Image Processing (AstroPix)",
  url: "https://www.astropix.com/books/BGAIP/chapter1/103.html",
  accessed: "2026-09-15",
};

/** Ian Ridpath's Star Tales page for one constellation (http only: the site has no TLS). */
function starTales(slug: string, title: string, accessed: string): Citation {
  return {
    author: "Ridpath, I.",
    year: "n.d.",
    title,
    site: "Star Tales",
    url: `http://www.ianridpath.com/startales/${slug}.html`,
    accessed,
  };
}

/** A NASA Hubble Messier Catalog page. */
function hubbleMessier(n: number, title: string, accessed: string): Citation {
  return {
    author: "NASA Science",
    year: "n.d.",
    title,
    site: "NASA Hubble Messier Catalog",
    url: `https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-${n}/`,
    accessed,
  };
}

/** A Wikipedia article pinned to one revision (the year is the revision's). */
function wikipedia(title: string, oldid: number, year: string, accessed: string): Citation {
  return {
    author: "Wikipedia contributors",
    year,
    title: `${title} (revision ${oldid})`,
    site: "Wikipedia",
    url: `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title.replace(/ /g, "_"))}&oldid=${oldid}`,
    accessed,
  };
}

/**
 * A NASA Science page, by its path under https://science.nasa.gov/. `year` is
 * the date the page itself carries (APOD entries and news articles all do);
 * it stays "n.d." for the undated evergreen pages.
 */
function nasaScience(path: string, title: string, accessed: string, year = "n.d."): Citation {
  return {
    author: "NASA Science",
    year,
    title,
    site: "NASA Science",
    url: `https://science.nasa.gov/${path}`,
    accessed,
  };
}

/** A NASA Hubble Caldwell Catalog page. */
function hubbleCaldwell(n: number, title: string, accessed: string): Citation {
  return {
    author: "NASA Science",
    year: "n.d.",
    title,
    site: "NASA Hubble Caldwell Catalog",
    url: `https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-caldwell-catalog/caldwell-${n}/`,
    accessed,
  };
}

/* Sources behind the fifteen deep-sky objects added 2026-09-15. Each URL was
   fetched and returned 200 while these cards were written; the set is the one
   .superpowers/sdd/colour-sources.md verified, and scripts/test-sky-facts.mjs
   holds those cards to it. */

const AAA_HUBBLE_PALETTE: Citation = {
  author: "Amateur Astronomers Association",
  year: "2020",
  title: "Pillars of Creation: Using the Hubble Palette",
  site: "Amateur Astronomers Association",
  url: "https://aaa.org/2020/06/23/pillars-of-creation-using-the-hubble-palette/",
  accessed: "2026-09-15",
};

const ESA_TRIFID: Citation = {
  author: "ESA/Hubble",
  year: "2026",
  title: "Trifid Nebula, annotated (heic2608c)",
  site: "ESA/Hubble",
  url: "https://esahubble.org/images/heic2608c/",
  accessed: "2026-09-15",
};

const ESA_SOMBRERO: Citation = {
  author: "ESA/Hubble",
  year: "2004",
  title: "Hubble mosaic of the majestic Sombrero Galaxy (opo0328a)",
  site: "ESA/Hubble",
  url: "https://esahubble.org/images/opo0328a/",
  accessed: "2026-09-15",
};

const ESA_HORSEHEAD: Citation = {
  author: "European Space Agency",
  year: "2023",
  title: "Euclid’s view of the Horsehead Nebula",
  site: "esa.int",
  url: "https://www.esa.int/Science_Exploration/Space_Science/Euclid/Euclid_s_view_of_the_Horsehead_Nebula",
  accessed: "2026-09-15",
};

const NASA_FLAME: Citation = {
  author: "NASA",
  year: "2014",
  title: "Inside the Flame Nebula",
  site: "nasa.gov",
  url: "https://www.nasa.gov/image-article/inside-flame-nebula/",
  accessed: "2026-09-15",
};

const JPL_M81_PINK: Citation = {
  author: "NASA/JPL-Caltech",
  year: "n.d.",
  title: "M81 Galaxy is Pretty in Pink",
  site: "NASA Jet Propulsion Laboratory",
  url: "https://www.jpl.nasa.gov/images/pia09579-m81-galaxy-is-pretty-in-pink/",
  accessed: "2026-09-15",
};

const CHANDRA_M82: Citation = {
  author: "NASA/CXC",
  year: "2010",
  title: "M82 and J144701-5919 (Chandra Photo Album, April 29, 2010)",
  site: "Chandra X-ray Observatory",
  url: "https://chandra.harvard.edu/photo/2010/m82/",
  accessed: "2026-09-15",
};

const APOD_DOUBLE_CLUSTER: Citation = {
  author: "Nemiroff, R., & Bonnell, J.",
  year: "2014",
  title: "Double Cluster in Perseus",
  site: "Astronomy Picture of the Day",
  url: "https://apod.nasa.gov/apod/ap140123.html",
  accessed: "2026-09-15",
};

const CG_NORTH_AMERICA: Citation = {
  author: "Constellation Guide",
  year: "n.d.",
  title: "North America Nebula",
  site: "constellation-guide.com",
  url: "https://www.constellation-guide.com/north-america-nebula/",
  accessed: "2026-09-15",
};

const ESA_VEIL: Citation = {
  author: "ESA/Hubble",
  year: "n.d.",
  title: "Hubble views the Veil Nebula (heic0712)",
  site: "ESA/Hubble",
  url: "https://esahubble.org/news/heic0712/",
  accessed: "2026-09-15",
};

const NASA_VEIL: Citation = {
  author: "NASA Science",
  year: "2025",
  title: "Hubble Captures New View of Colorful Veil",
  site: "NASA Science",
  url: "https://science.nasa.gov/missions/hubble/hubble-captures-new-view-of-colorful-veil/",
  accessed: "2026-09-15",
};

const SKYWATCHING = nasaScience("skywatching/", "Skywatching Tips From NASA", "2026-09-15");

/* The colours the chart draws on the objects that already had cards before the
   colour round (final review C1, 2026-09-16). Those cards cited only the one
   Hubble Messier page they shipped with, while their palettes came from these
   pages, so a reader checking the Sources list found nothing behind the
   colour. Every URL below was fetched again while this was written and
   returned 200; the sentence each one carries is quoted above it, and
   scripts/test-sky-objects.mjs pins each coloured object to the citation its
   palette actually rests on. */

/** “But a bright yellow nucleus, dark winding dust lanes, luminous blue
 *  spiral arms, and bright red emission nebulas are recorded in this stunning
 *  six-hour telescopic digital mosaic of our closest major galactic
 *  neighbor.” */
const APOD_M31: Citation = {
  author: "Nemiroff, R., & Bonnell, J.",
  year: "2019",
  title: "M31: The Andromeda Galaxy",
  site: "Astronomy Picture of the Day",
  url: "https://apod.nasa.gov/apod/ap190909.html",
  accessed: "2026-09-16",
};

/** “Blue stars are hot and red stars are cool so that astronomical color
 *  index ranging from bluer to redder follows the relative stellar
 *  temperature scale”, and “higher mass stars have evolved off the main
 *  sequence into red, then blue giants and beyond”. */
const APOD_M13: Citation = {
  author: "Nemiroff, R., & Bonnell, J.",
  year: "2019",
  title: "The Colors and Magnitudes of M13",
  site: "Astronomy Picture of the Day",
  url: "https://apod.nasa.gov/apod/ap190613.html",
  accessed: "2026-09-16",
};

/** “A large, spherical cluster containing thousands of bright stars, so dense
 *  in the middle it looks solid white.” */
const EARTHSKY_M13: Citation = {
  author: "EarthSky",
  year: "n.d.",
  title: "Meet M13, the Great Globular Cluster in Hercules",
  site: "earthsky.org",
  url: "https://earthsky.org/clusters-nebulae-galaxies/m13-finest-globular-cluster-in-northern-skies/",
  accessed: "2026-09-16",
};

/** “The cluster's few yellowish tinted, cool, red giants are scattered through
 *  the field of its brighter hot blue main sequence stars in this telescopic
 *  group snapshot.” */
const APOD_M44: Citation = {
  author: "Nemiroff, R., & Bonnell, J.",
  year: "2022",
  title: "M44: The Beehive Cluster",
  site: "Astronomy Picture of the Day",
  url: "https://apod.nasa.gov/apod/ap220430.html",
  accessed: "2026-09-16",
};

/** The calibrated broadband reading of the Trapezium region, as against
 *  NASA's narrowband picture of the same cloud: “The natural true color is
 *  shown to be blue-green, best described as teal”, and “The teal color is
 *  mainly created by OIII, H-beta, and H-gamma emission.” A career
 *  astrophotographer's own site, cited as him, the same standing as
 *  EMISSION_LINE_COLOUR above. */
const CLARK_M42: Citation = {
  author: "Clark, R. N.",
  year: "n.d.",
  title: "The True Color of the Trapezium Region in M42, The Great Nebula in Orion",
  site: "ClarkVision",
  url: "https://clarkvision.com/articles/astrophotography.m42-trapezium.true.color/",
  accessed: "2026-09-16",
};

/** “In the bluish patch to the upper left, called a reflection nebula, dusty
 *  gas scatters the light from nearby, Trifid-born stars”, and “dust grains
 *  and molecules scatter blue light more efficiently than red light”, against
 *  “the round, pink-reddish area typical of an emission nebula”. */
const ESO_TRIFID: Citation = {
  author: "European Southern Observatory",
  year: "2009",
  title: "Trifid Triple Treat (eso0930)",
  site: "ESO",
  url: "https://www.eso.org/public/news/eso0930/",
  accessed: "2026-09-16",
};

/** “Visible are many bright stars, dark dust lanes, red emission nebulae,
 *  blue reflection nebulae, and clusters of stars... A 40-minute exposure was
 *  used, and the colors were digitally enhanced.” */
const APOD_MILKY_WAY: Citation = {
  author: "Nemiroff, R., & Bonnell, J.",
  year: "1999",
  title: "A Milky Way Band",
  site: "Astronomy Picture of the Day",
  url: "https://apod.nasa.gov/apod/ap990224.html",
  accessed: "2026-09-16",
};

/** Why the same band is grey to the eye: “This night vision is primarily
 *  mediated by the rods, in which varying degrees of gray are seen but unable
 *  to distinguish the color spectrum.” Author, journal and year read off the
 *  article's own citation metadata (colour-sources.md had this one filed
 *  under the wrong author and year). */
const ROD_VISION: Citation = {
  author: "Loh, K. Y.",
  year: "2006",
  title: "The human eyes are color blind at night: Two views of the Milky Way",
  site: "Malaysian Family Physician, via PubMed Central",
  url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4453125/",
  accessed: "2026-09-16",
};

export const SKY_FACTS: readonly SkyFact[] = [
  /* ---- deep-sky objects and landmarks ---- */
  {
    id: "m31",
    kind: "Spiral galaxy · 2.5 million light-years",
    oneLiner: "The nearest major galaxy to the Milky Way",
    body: [
      "The first known report of it is in al-Sufi’s Book of Fixed Stars, from the year 964.",
      "We see its disk almost edge-on, tilted 77 degrees from our line of sight.",
      "A six-hour telescopic mosaic records a bright yellow nucleus, dark winding dust lanes, luminous blue spiral arms and bright red emission nebulae.",
    ],
    visibility: "Naked eye, even with moderate light pollution; best in November",
    citations: [hubbleMessier(31, "Messier 31 (The Andromeda Galaxy)", "2026-09-15"), APOD_M31],
  },
  {
    id: "m1",
    kind: "Supernova remnant · 6,500 light-years",
    oneLiner: "What is left of a star seen exploding in 1054",
    body: [
      "In 1054 Chinese astronomers recorded a “guest star” that stayed visible in the daytime sky for nearly a month; the nebula is the debris of that supernova.",
      "The neutron star at its centre spins fast enough to appear to pulse 30 times per second.",
      "Charles Messier mistook it for Halley’s Comet, and that mistake led him to start a catalogue of things that could be confused with comets.",
    ],
    visibility: "Telescope, a small one; best in January",
    citations: [hubbleMessier(1, "Messier 1 (The Crab Nebula)", "2026-09-15")],
  },
  {
    id: "m8",
    kind: "Star-forming nebula · 5,200 light-years",
    oneLiner: "A cloud of gas in Sagittarius where stars are forming",
    body: [
      "The Italian astronomer Giovanni Battista Hodierna discovered it in 1654.",
      "Its massive stars give off ultraviolet light that ionizes the gas around them and makes it shine.",
    ],
    visibility: "Naked eye, faintly, from a dark site; easy in binoculars; best in August",
    citations: [hubbleMessier(8, "Messier 8 (The Lagoon Nebula)", "2026-09-15")],
  },
  {
    id: "m13",
    kind: "Globular cluster · 25,000 light-years",
    oneLiner: "More than 100,000 stars in one tight ball",
    body: [
      "Edmond Halley, of Halley’s Comet, discovered it in 1714.",
      "The middle is dense enough that it looks solid white, and the stars around it sort by temperature, the hot ones blue and the cool giants red.",
      "Near the core the stars are about a hundred times denser than around the Sun, close enough that they sometimes collide.",
    ],
    visibility: "Binoculars, most easily in July",
    citations: [hubbleMessier(13, "Messier 13 (The Hercules Cluster)", "2026-09-15"), APOD_M13, EARTHSKY_M13],
  },
  {
    id: "m42",
    kind: "Star-forming nebula · 1,500 light-years",
    oneLiner: "The closest large star-forming region to Earth",
    body: [
      "The Maya of Mesoamerica are thought to have seen it as the cosmic fire of creation.",
      "Four massive young stars at its centre, called the Trapezium, are carving a cavity in the cloud.",
      "Two readings of its colour circulate: a calibrated analysis finds the Trapezium region blue-green, “best described as teal”, from oxygen and hydrogen lines, while Hubble’s familiar picture is a filter map that puts hydrogen in orange, oxygen in green and sulphur with infrared in red.",
    ],
    visibility: "Naked eye, just below Orion’s belt; best in January",
    citations: [hubbleMessier(42, "Messier 42 (The Orion Nebula)", "2026-09-15"), CLARK_M42],
  },
  {
    id: "m44",
    kind: "Open cluster · about 600 light-years",
    oneLiner: "The Beehive, about 1,000 stars in Cancer",
    body: [
      "Galileo was the first to see it as more than a cloudy patch, and picked out about 40 of its stars.",
      "The cluster is thought to be 600 to 700 million years old; the Milky Way is about 13 billion.",
      "A telescopic photograph shows a few yellowish, cool red giants scattered through a field of brighter hot blue main-sequence stars.",
    ],
    visibility: "Naked eye as a blur of light; binoculars show about 20 stars; highest in March",
    citations: [hubbleMessier(44, "Messier 44", "2026-09-15"), APOD_M44],
  },
  {
    id: "m45",
    kind: "Open cluster · roughly 445 light-years",
    oneLiner: "The Seven Sisters, watched since ancient times",
    body: [
      "It has no known discoverer, but Galileo was the first to look at it through a telescope.",
      "It holds over a thousand stars, loosely bound by gravity, and a handful of bright ones dominate the view.",
    ],
    visibility: "Naked eye, easily, from a fairly dark site; best in December",
    citations: [hubbleMessier(45, "Messier 45 (The Pleiades)", "2026-09-15")],
  },
  {
    id: "m51",
    kind: "Spiral galaxy · 31 million light-years",
    oneLiner: "A face-on spiral with a small galaxy passing behind it",
    body: [
      "Charles Messier discovered it in 1773.",
      "The small galaxy NGC 5195, at the tip of one arm, is passing behind it, and some astronomers think that encounter is why the arms stand out so clearly.",
    ],
    visibility: "Telescope, a small one; most easily in May",
    citations: [hubbleMessier(51, "Messier 51 (The Whirlpool Galaxy)", "2026-09-15")],
  },
  {
    id: "m57",
    kind: "Nebula · about 2,000 light-years",
    oneLiner: "A ring of gas at the bottom of Lyra’s lyre",
    body: [
      "The French astronomer Antoine Darquier de Pellepoix discovered it in 1779.",
      "It sits about halfway between Sheliak and Sulafat, the two stars that form the bottom of the lyre.",
      "Hubble showed the ring is a doughnut of gas with a football-shaped structure through its middle, seen end-on.",
    ],
    visibility: "Telescope; a moderately sized one shows the ring",
    citations: [hubbleMessier(57, "Messier 57 (The Ring Nebula)", "2026-09-15")],
  },
  {
    id: "m87",
    kind: "Elliptical galaxy · Virgo cluster",
    oneLiner: "The galaxy with the first black hole ever imaged",
    body: [
      "It has several trillion stars and roughly 15,000 globular clusters; the Milky Way has about 150.",
      "In 2019 the Event Horizon Telescope released the first image of a black hole, the one at its centre, which has 6.5 billion times the mass of the Sun.",
    ],
    visibility: "Telescope, a small one; most easily in May",
    citations: [
      hubbleMessier(87, "Messier 87", "2026-09-15"),
      {
        author: "European Southern Observatory",
        year: "2019",
        title: "Astronomers Capture First Image of a Black Hole (eso1907)",
        site: "ESO",
        url: "https://www.eso.org/public/news/eso1907/",
        accessed: "2026-09-15",
      },
    ],
  },
  {
    id: "m16",
    kind: "Emission nebula · 7,000 light-years",
    oneLiner: "The Pillars of Creation stand inside it",
    body: [
      "The pillars are roughly 4 to 5 light-years tall, a small feature of a nebula that spans 70 by 55 light-years.",
      "Ultraviolet light from a cluster of young stars just outside Hubble’s frame is slowly eroding them.",
      "The colours of the famous picture are narrowband filters assigned to channels, oxygen to blue, sulphur to red, nitrogen and hydrogen together to green, which is the Hubble palette rather than the view through an eyepiece.",
    ],
    visibility: "Telescope, a small one for the star cluster; best viewed during August",
    citations: [hubbleMessier(16, "Messier 16 (The Eagle Nebula)", "2026-09-15"), AAA_HUBBLE_PALETTE],
  },
  {
    id: "m20",
    kind: "Star-forming nebula · 5,000 light-years",
    oneLiner: "Dust lanes cut it into three lobes",
    body: [
      "Astronomers compared a Hubble image from 2026 against one taken in 1997 and found the nebula had changed on a human time scale.",
      "Two thin jets, each roughly three-quarters of a light-year long, are being eroded by radiation from a massive star just beyond the frame.",
      "One lobe glows with hydrogen’s own red light and another is dust scattering starlight, the same effect that makes the daytime sky blue, while the published Hubble colours are filter assignments: red for hydrogen and sulphur, green for oxygen.",
    ],
    visibility: "Telescope, a small one; best observed during August",
    citations: [hubbleMessier(20, "Messier 20 (The Trifid Nebula)", "2026-09-15"), ESA_TRIFID, ESO_TRIFID],
  },
  {
    id: "m27",
    kind: "Planetary nebula · more than 1,200 light-years",
    oneLiner: "The first planetary nebula anyone found",
    body: [
      "Charles Messier spotted it in 1764, and the name planetary nebula is a misnomer that comes from the round, planet-like look through smaller telescopes.",
      "It holds knots of gas and dust 17 billion to 56 billion kilometres across, several times the distance from the Sun to Pluto, each carrying about as much mass as three Earths.",
      "Hubble’s picture puts oxygen in blue, hydrogen in green and sulphur with nitrogen in red, so its colours track which atoms are emitting rather than what an eye would see.",
    ],
    visibility: "Telescope, a small one, most easily in September",
    citations: [hubbleMessier(27, "Messier 27 (The Dumbbell Nebula)", "2026-09-15")],
  },
  {
    id: "m33",
    kind: "Spiral galaxy · about 3 million light-years",
    oneLiner: "Stars form here ten times faster than in Andromeda",
    body: [
      "Blue regions scattered across the disk are sites of rapid star birth, and the brightest of them, NGC 604, is one of the largest stellar nurseries in the Local Group.",
      "It is about half the size of the Milky Way and the third-largest galaxy in that group.",
      "It could become a third party in the collision between Andromeda and the Milky Way more than 4 billion years from now.",
    ],
    visibility: "Binoculars, which suit it better than a telescope; naked eye under exceptionally dark skies",
    citations: [
      hubbleMessier(33, "Messier 33", "2026-09-15"),
      nasaScience("image-article/apod-2017-november-30-m33-triangulum-galaxy/", "APOD: 2017 November 30, M33: Triangulum Galaxy", "2026-09-15", "2017"),
    ],
  },
  {
    id: "m78",
    kind: "Reflection nebula · 1,600 light-years",
    oneLiner: "It reflects starlight instead of emitting its own",
    body: [
      "Dust here reflects the light of several bright blue stars that formed recently inside it, and the same scattering that colours the daytime sky deepens the blue.",
      "Pierre Méchain found it in 1780, and one side of it flares away like a comet’s tail, which has fooled comet hunters into believing they had a new discovery.",
    ],
    visibility: "Binoculars or a small telescope; 8 inches or larger reveals more detail, best in January",
    citations: [
      nasaScience("image-article/apod-2000-april-24-reflection-nebula-m78/", "APOD: 2000 April 24, Reflection Nebula M78", "2026-09-15", "2000"),
      hubbleMessier(78, "Messier 78", "2026-09-15"),
    ],
  },
  {
    id: "m81",
    kind: "Spiral galaxy · 11.6 million light-years",
    oneLiner: "Blue arms of young stars around an old yellow core",
    body: [
      "The arms are blue because they are made of hot stars formed in the past few million years, while the central bulge holds much older, redder ones.",
      "A black hole of 70 million solar masses sits at the centre, about 15 times the mass of the Milky Way’s.",
      "The widely shared pink version of this galaxy is a composite of ultraviolet, visible and infrared data, where the pink marks dust lanes seen in infrared rather than a colour anyone could see.",
    ],
    visibility: "Binoculars show a faint patch beside M82; a small telescope resolves the core, best in April",
    citations: [
      hubbleMessier(81, "Messier 81", "2026-09-15"),
      nasaScience("image-article/apod-1997-july-26-m81-in-true-color/", "APOD: 1997 July 26, M81 in True Color", "2026-09-15", "1997"),
      JPL_M81_PINK,
    ],
  },
  {
    id: "m82",
    kind: "Starburst galaxy · 12 million light-years",
    oneLiner: "Star birth at its centre runs ten times the Milky Way’s",
    body: [
      "The starburst limits itself: star formation this vigorous consumes or destroys the material needed to make more stars, so it should subside in a few tens of millions of years.",
      "Chandra sees gas heated to millions of degrees by the outflow blasting matter out of the galaxy, and Spitzer sees cool gas and dust being ejected with it.",
      "Both of its best-known portraits carry data the eye cannot see: one puts hydrogen and infrared light in red, the other puts X-rays in blue and infrared in red.",
    ],
    visibility: "Binoculars show a patch of light beside M81; larger telescopes resolve the core",
    citations: [nasaScience("image-detail/m82-2/", "Cigar Galaxy M82", "2026-09-15"), CHANDRA_M82],
  },
  {
    id: "m104",
    kind: "Spiral galaxy · 28 to 30 million light-years",
    oneLiner: "A brilliant white core inside a ring of dark dust",
    body: [
      "We see it nearly edge-on, from about six degrees north of its equatorial plane.",
      "The dust ring is where its stars form, and Hubble resolves nearly 2,000 globular clusters around it, ten times the number in the Milky Way.",
      "Its mass equals about 800 billion Suns, which makes it one of the most massive objects in the Virgo cluster.",
    ],
    visibility: "Telescope, a small one; it sits just past naked-eye range, most easily in May",
    citations: [hubbleMessier(104, "Messier 104", "2026-09-15"), ESA_SOMBRERO],
  },
  {
    id: "horsehead",
    kind: "Dark nebula · 1,300 to 1,375 light-years",
    oneLiner: "A pillar too thick for the radiation to erode",
    body: [
      "The gas that surrounded it has already dissipated, and the head survives because it is made of thick clumps of material that are harder to erode.",
      "Astronomers estimate it has about five million years left before it goes too.",
      "It is the closest giant star-forming region to Earth, and the radiation shaping it comes from the bright star Sigma Orionis just above it.",
    ],
    visibility: "Telescope; a dark cloud shaped like a horse’s head",
    citations: [
      nasaScience(
        "missions/webb/webb-captures-top-of-iconic-horsehead-nebula-in-unprecedented-detail/",
        "Webb Captures Top of Iconic Horsehead Nebula in Unprecedented Detail",
        "2026-09-15",
      ),
      ESA_HORSEHEAD,
    ],
  },
  {
    id: "flame",
    kind: "Emission nebula · 1,400 to 1,500 light-years",
    oneLiner: "Its reddish glow is hydrogen recombining",
    body: [
      "Hydrogen atoms stripped of their electrons glow as the atoms and electrons recombine, which is where the reddish colour comes from.",
      "A dark lane of dust stands in silhouette against that glow and hides the young massive star whose ultraviolet light does the ionizing.",
      "X-ray and infrared data put the stars at the cluster’s centre at about 200,000 years old and those on its outskirts at about 1.5 million, the reverse of the simplest picture of how a cluster forms.",
    ],
    visibility: "Telescope; the dust lane hides the nebula’s energy source from optical telescopes",
    citations: [
      NASA_FLAME,
      nasaScience("image-article/apod-2007-february-2-flame-nebula-close-up/", "APOD: 2007 February 2, Flame Nebula Close-Up", "2026-09-15", "2007"),
    ],
  },
  {
    id: "ngc869",
    kind: "Open cluster · 7,000 light-years",
    oneLiner: "The western half of the Double Cluster in Perseus",
    body: [
      "Only a few hundred light-years separate it from NGC 884, and the ages of their individual stars put both at 13 million years, evidence that one star-forming region produced them.",
      "Its stars are much younger and hotter than the Sun.",
      "Faint clouds of reddish ionized hydrogen lie across the whole field, though binoculars miss them and most telescopic images leave them out.",
    ],
    visibility: "Naked eye from dark locations; always a rewarding sight in binoculars",
    citations: [APOD_DOUBLE_CLUSTER],
  },
  {
    id: "ngc884",
    kind: "Open cluster · 7,000 light-years",
    oneLiner: "The eastern half of the Double Cluster in Perseus",
    body: [
      "It sits a few hundred light-years from NGC 869, and both clusters are 13 million years young.",
      "A third, smaller cluster nearby, NGC 957, has a similar age and distance and may be related to the pair.",
      "The picture those ages come from is a colour composite with narrowband data added to bring out the hydrogen clouds, so its red is enhanced rather than recorded straight.",
    ],
    visibility: "Naked eye from dark locations; binoculars show it beside NGC 869",
    citations: [APOD_DOUBLE_CLUSTER],
  },
  {
    id: "ngc7000",
    kind: "Emission nebula · 1,600 to 1,800 light-years",
    oneLiner: "Its outline resembles the North American continent",
    body: [
      "Hydrogen dominates the gas, and sensitive cameras pick up the reddish colour that goes with it, though the shape and the colour show up only in photographs.",
      "The dark notch along the “East Coast” is a cloud lying in front of the nebula, LDN 935, and not a gap in the gas.",
      "The hot 6th-magnitude binary HD 199579 is what sets it aglow; Deneb, three degrees away, was long suspected instead.",
    ],
    visibility: "Binoculars; its surface brightness is low, so the unaided eye needs exceptional conditions",
    citations: [hubbleCaldwell(20, "Caldwell 20 (North America Nebula)", "2026-09-15"), CG_NORTH_AMERICA],
  },
  {
    id: "ngc6960",
    kind: "Supernova remnant · 1,500 to 2,400 light-years",
    oneLiner: "The western arc of the Cygnus Loop",
    body: [
      "The star that exploded was roughly 20 times the mass of the Sun, and the blast happened somewhere between 5,000 and 10,000 years ago.",
      "The whole shell, with NGC 6992 along its eastern side, spans about 3 degrees, roughly six full Moons laid side by side.",
      "Anyone watching at the time would have seen a star brighten to about the brightness of the crescent Moon.",
    ],
    visibility: "Telescope; the shell covers about six full Moons of sky",
    citations: [ESA_VEIL, NASA_VEIL],
  },
  {
    id: "ngc6992",
    kind: "Supernova remnant · 1,500 to 2,400 light-years",
    oneLiner: "The eastern arc of the Cygnus Loop",
    body: [
      "It is the far side of the same shell as NGC 6960, debris from one star that exploded thousands of years ago.",
      "The published colours come from three filters, one each for hydrogen, sulphur and oxygen, so blue for oxygen and red for hydrogen is an assignment of filters to channels rather than the view.",
      "Hubble photographed this nebula in 1994, 1997 and 2015, and comparing those frames tracks the motion of individual knots and filaments of gas.",
    ],
    visibility: "Telescope; the two arcs sit at opposite edges of one shell about 3 degrees across",
    citations: [ESA_VEIL, NASA_VEIL],
  },
  {
    id: "sgr-a-star",
    kind: "Supermassive black hole · about 27,000 light-years",
    oneLiner: "Sagittarius A*, the black hole at the Milky Way’s centre",
    body: [
      "It has four million times the mass of the Sun.",
      "The Event Horizon Telescope released the first image of it on May 12, 2022; in our sky it is about the size of a doughnut on the Moon.",
    ],
    visibility: "Not visible; imaging it took eight radio observatories linked into one Earth-sized telescope",
    citations: [
      {
        author: "European Southern Observatory",
        year: "2022",
        title: "Astronomers reveal first image of the black hole at the heart of our galaxy (eso2208)",
        site: "ESO",
        url: "https://www.eso.org/public/news/eso2208-eht-mw/",
        accessed: "2026-09-15",
      },
    ],
  },
  {
    id: "kepler-field",
    kind: "Survey field · Cygnus",
    oneLiner: "Where NASA’s Kepler telescope stared, looking for planets",
    body: [
      "After its launch on March 6, 2009, Kepler watched 150,000 stars in this patch of sky for the tiny dips in brightness a crossing planet causes.",
      "In May 2013 it lost the second of its four reaction wheels and could no longer hold its aim here.",
      "Over nine years, counting the later K2 mission, it found more than 2,600 planets outside the solar system.",
    ],
    visibility: "Not visible as an object; the outline marks a region of sky",
    citations: [
      {
        author: "NASA Science",
        year: "n.d.",
        title: "Kepler / K2",
        site: "NASA Science",
        url: "https://science.nasa.gov/mission/kepler/",
        accessed: "2026-09-15",
      },
    ],
  },
  {
    id: "hubble-deep-field",
    kind: "Deep field · Hubble, 1995",
    oneLiner: "A speck of sky holding at least 1,500 galaxies",
    body: [
      "Hubble took 342 frames of this spot over ten consecutive days, December 18 to 28, 1995.",
      "The field is about as wide as a dime seen from 75 feet away, and it holds at least 1,500 galaxies.",
      "The faintest are close to 30th magnitude, nearly four billion times fainter than the limit of human vision.",
    ],
    visibility: "Not visible; a direction only",
    citations: [
      {
        author: "Space Telescope Science Institute",
        year: "1996",
        title: "Sample galaxies from the Hubble Deep Field (STScI-PRC96-01b)",
        site: "NASA Space Science Data Coordinated Archive",
        url: "https://nssdc.gsfc.nasa.gov/photo_gallery/caption/hst_deep_detail.txt",
        accessed: "2026-09-15",
      },
      {
        author: "ESA/Hubble",
        year: "n.d.",
        title: "Full WFPC2 Mosaic - Full Resolution",
        site: "ESA/Hubble",
        url: "https://esahubble.org/images/opo9601c/",
        accessed: "2026-09-15",
      },
      {
        author: "ESA/Hubble",
        year: "n.d.",
        title: "Hubble's Deepest-Ever View of the Universe Unveils Myriad Galaxies Back to the Beginning of Time",
        site: "ESA/Hubble",
        url: "https://esahubble.org/images/opo9601a/",
        accessed: "2026-09-15",
      },
    ],
  },

  /* ---- spacecraft and named stars ---- */
  {
    id: "voyager-1",
    kind: "Spacecraft · launched 1977",
    oneLiner: "No spacecraft has gone farther",
    body: [
      "On August 25, 2012, it became the first spacecraft to leave the heliosphere and start measuring interstellar space.",
      "Its last 64 images, taken 40 AU from the Sun, made a family portrait of six planets, and its image of Earth inspired the Pale Blue Dot.",
      "It carries a gold-plated copper record with greetings in 55 languages and 90 minutes of music.",
    ],
    visibility: "Not visible; the marker is a direction, computed by JPL Horizons for the date shown",
    citations: [
      HORIZONS,
      {
        author: "NASA Science",
        year: "n.d.",
        title: "Voyager 1",
        site: "NASA Science",
        url: "https://science.nasa.gov/mission/voyager/voyager-1/",
        accessed: "2026-09-15",
      },
    ],
  },
  {
    id: "voyager-2",
    kind: "Spacecraft · launched 1977",
    oneLiner: "The only spacecraft to fly past Uranus and Neptune",
    body: [
      "On December 10, 2018, it became the second spacecraft to enter interstellar space.",
      "At Uranus it found 10 new moons; the planet’s moons are named mostly for characters from Shakespeare, a couple for characters from Alexander Pope.",
      "At its speed relative to the Sun, it would take about 19,390 years to cross a single light-year.",
    ],
    visibility: "Not visible; the marker is a direction, computed by JPL Horizons for the date shown",
    citations: [
      HORIZONS,
      {
        author: "NASA Science",
        year: "n.d.",
        title: "Voyager 2",
        site: "NASA Science",
        url: "https://science.nasa.gov/mission/voyager/voyager-2/",
        accessed: "2026-09-15",
      },
      nasaScience("uranus/moons/", "Uranus Moons", "2026-09-15"),
    ],
  },
  {
    id: "polaris",
    kind: "Yellow supergiant · Ursa Minor",
    oneLiner: "The North Star, less than 1° from the pole",
    body: [
      "Less than 1° separates it from the north celestial pole, so for now it is the northern pole star.",
      "William Herschel discovered its outer companion in August 1779; the inner pair was only confirmed in the early 20th century.",
      "The Neo-Latin stella polaris, “polar star”, first appeared in print in the Alfonsine Tables of 1492.",
    ],
    visibility: "Naked eye",
    citations: [wikipedia("Polaris", 1374743634, "2026", "2026-09-15")],
  },
  {
    id: "sirius",
    kind: "Binary star · 8.6 light-years",
    oneLiner: "The Dog Star, the brightest star in the night sky",
    body: [
      "In Ancient Egypt its heliacal rising marked the flooding of the Nile.",
      "A faint white dwarf, Sirius B, goes around it every 50 years.",
      "Its name, from the Ancient Greek Seirios (“glowing” or “scorcher”), is first recorded in Hesiod’s Works and Days, from the 7th century BC.",
    ],
    visibility: "Naked eye",
    citations: [wikipedia("Sirius", 1374864849, "2026", "2026-09-15")],
  },
  {
    id: "arcturus",
    kind: "Red giant · 36.7 light-years",
    oneLiner: "The brightest star in the northern celestial hemisphere",
    body: [
      "It has about the Sun’s mass but has expanded to 25 times its size, and is around 170 times as luminous.",
      "Its Greek name, Arktouros, means “Guardian of the Bear”.",
    ],
    visibility: "Naked eye; the fourth-brightest star in the night sky",
    citations: [wikipedia("Arcturus", 1373255978, "2026", "2026-09-15")],
  },
  {
    id: "vega",
    kind: "Star · 25 light-years",
    oneLiner: "The pole star around 12000 BCE, and again around 13724",
    body: [
      "It was the first star other than the Sun to have its image and spectrum photographed.",
      "It spins at 236 km/s at its equator, fast enough to make the equator bulge.",
      "Webb found its disk of dust exceptionally smooth, with no evidence of shaping by massive planets.",
    ],
    visibility: "Naked eye; the fifth-brightest star in the night sky",
    citations: [wikipedia("Vega", 1374446348, "2026", "2026-09-15")],
  },
  {
    id: "capella",
    kind: "Quadruple star · 42.9 light-years",
    oneLiner: "The “little goat”, the brightest star in Auriga",
    body: [
      "Two yellow giants orbit each other every 104 days, with a pair of faint red dwarfs around 10,000 AU away.",
      "It is one of the brightest X-ray sources in the sky.",
      "In Greek mythology it was the goat Amalthea, who suckled Zeus.",
    ],
    visibility: "Naked eye; never sets for observers north of 44°N",
    citations: [wikipedia("Capella", 1374633159, "2026", "2026-09-15")],
  },
  {
    id: "rigel",
    kind: "Blue supergiant · about 850 light-years",
    oneLiner: "Orion’s foot, usually its brightest star",
    body: [
      "It is expected to end its life as a Type II supernova, leaving a neutron star or a black hole.",
      "Rijl Jauzah al Yusrā, Arabic for “the left leg (foot) of Jauzah”, gave it its name; Jauzah was a name for Orion.",
      "Pulsations in its unstable atmosphere make its brightness vary slightly, from magnitude 0.05 to 0.18.",
    ],
    visibility: "Naked eye; generally the seventh-brightest star in the night sky",
    citations: [wikipedia("Rigel", 1374810813, "2026", "2026-09-15")],
  },
  {
    id: "procyon",
    kind: "Binary star · 11.46 light-years",
    oneLiner: "“Before the dog”: it crosses the sky ahead of Sirius",
    body: [
      "Its Ancient Greek name, Prokyon, means “before the dog”, because it precedes the Dog Star, Sirius, across the sky.",
      "Greek mythology links it with Maera, a hound belonging to Erigone, daughter of Icarius of Athens.",
      "Its faint white dwarf companion, Procyon B, completes an orbit every 40.84 years.",
    ],
    visibility: "Naked eye; usually the eighth-brightest star in the night sky",
    citations: [wikipedia("Procyon", 1366891007, "2026", "2026-09-15")],
  },
  {
    id: "betelgeuse",
    kind: "Red supergiant · Orion",
    oneLiner: "A red supergiant at Orion’s shoulder",
    body: [
      "If it sat at the centre of the Solar System, its surface would lie beyond the asteroid belt.",
      "From October 2019 to mid-February 2020 it faded by a factor of about 3; a Hubble study suggests the cause was dust formed from material its surface threw off.",
      "It is expected to explode as a supernova, most likely within 100,000 years, and life on Earth will be unharmed.",
    ],
    visibility: "Naked eye; distinctly reddish",
    citations: [wikipedia("Betelgeuse", 1375003089, "2026", "2026-09-15")],
  },
  {
    id: "altair",
    kind: "Star · 16.7 light-years",
    oneLiner: "One corner of the Summer Triangle",
    body: [
      "An interferometer study showed it is not spherical: spinning at about 286 km/s at the equator, it is flattened at the poles.",
      "Medieval astrolabes of England and Western Europe drew it and Vega as birds.",
    ],
    visibility: "Naked eye; the twelfth-brightest star in the night sky",
    citations: [wikipedia("Altair", 1374232322, "2026", "2026-09-15")],
  },
  {
    id: "aldebaran",
    kind: "Red giant · about 67 light-years",
    oneLiner: "“The follower”, which trails the Pleiades",
    body: [
      "It lies along the line of sight to the Hyades cluster but is unrelated to it, and much older.",
      "Its Arabic name meant “the bright one of the follower”, for the way it follows the Pleiades.",
      "Pioneer 10 is heading in its general direction and should make its closest approach in about two million years.",
    ],
    visibility: "Naked eye; typically the fourteenth-brightest star in the night sky",
    citations: [wikipedia("Aldebaran", 1373519418, "2026", "2026-09-15")],
  },
  {
    id: "antares",
    kind: "Red supergiant · about 550 light-years",
    oneLiner: "“Rival to Ares”, the heart of the scorpion",
    body: [
      "It is one of the largest stars visible to the naked eye.",
      "Its reddish hue, like that of Mars, is why the Ancient Greek name means “rival to Ares”.",
      "Babylonian star catalogues from at least 1100 BCE call it “the Breast of the Scorpion”.",
    ],
    visibility: "Naked eye; distinctly reddish",
    citations: [wikipedia("Antares", 1374164910, "2026", "2026-09-15")],
  },
  {
    id: "spica",
    kind: "Binary star · 250 light-years",
    oneLiner: "The virgin’s ear of grain, the brightest star in Virgo",
    body: [
      "Its two stars are so close together that they are egg-shaped, and only their spectra tell them apart.",
      "With Arcturus and Denebola, or Regulus in some accounts, it forms the Spring Triangle.",
    ],
    visibility: "Naked eye; one of the 20 brightest stars in the night sky",
    citations: [wikipedia("Spica", 1374779636, "2026", "2026-09-15")],
  },
  {
    id: "pollux",
    kind: "Red giant · 34 light-years",
    oneLiner: "The closest giant star to the Sun",
    body: [
      "Since 1943 its spectrum has been one of the stable anchor points used to classify other stars.",
      "A planet orbiting it was announced in 2006 and later named Thestias.",
    ],
    visibility: "Naked eye; the brightest star in Gemini",
    citations: [wikipedia("Pollux (star)", 1374546808, "2026", "2026-09-15")],
  },
  {
    id: "deneb",
    kind: "Blue supergiant · Cygnus",
    oneLiner: "The “tail of the hen”, head of the Northern Cross",
    body: [
      "Its distance is poorly known: estimates run from 1,400 to 2,600 light-years.",
      "Its luminosity is estimated at between 55,000 and 196,000 times the Sun’s.",
      "It rivals Rigel as the most luminous first-magnitude star.",
    ],
    visibility: "Naked eye; the 19th brightest star in the night sky",
    citations: [wikipedia("Deneb", 1374679105, "2026", "2026-09-15")],
  },
  {
    id: "regulus",
    kind: "Quadruple star · about 79 light-years",
    oneLiner: "“Little king”, the brightest star in Leo",
    body: [
      "With five dimmer stars it makes the Sickle, the asterism that marks the lion’s head.",
      "What appears to be a single star is four stars in two pairs.",
      "Rēgulus is Latin for “prince” or “little king”; the Arabic Qalb al-Asad means “the heart of the lion”.",
    ],
    visibility: "Naked eye",
    citations: [wikipedia("Regulus", 1374633235, "2026", "2026-09-15")],
  },

  /* ---- solar system, the ISS, the Milky Way ---- */
  {
    id: "mercury",
    kind: "Planet · closest to the Sun",
    oneLiner: "Named for the swiftest of the Roman gods",
    body: [
      "It is the fastest planet, going around the Sun every 88 Earth days, and it takes its name from the swiftest of the ancient Roman gods.",
      "One solar day there, a full cycle of day and night, lasts 176 Earth days.",
    ],
    visibility: "Naked eye",
    citations: [nasaScience("mercury/facts/", "Mercury: Facts", "2026-09-15"), SKYWATCHING],
  },
  {
    id: "venus",
    kind: "Planet · second from the Sun",
    oneLiner: "The only planet named after a female god",
    body: [
      "A day there lasts 243 Earth days, longer than its 225-day year, and the Sun rises in the west.",
      "Its namesake is the Roman goddess of love and beauty, whom the Greeks knew as Aphrodite, and most features on its surface are named for women.",
    ],
    visibility: "Naked eye; the brightest object in the night sky after the Moon",
    citations: [nasaScience("venus/facts/", "Venus: Facts", "2026-09-15")],
  },
  {
    id: "mars",
    kind: "Planet · fourth from the Sun",
    oneLiner: "Named by the Romans for their god of war",
    body: [
      "The Romans named it for their god of war because its reddish colour was reminiscent of blood; the Egyptians called it “Her Desher”, meaning “the red one”.",
      "The red is iron minerals in the dirt that have oxidized, or rusted.",
      "Olympus Mons, the largest volcano in the solar system, stands more than 25 miles tall.",
    ],
    visibility: "Naked eye",
    citations: [nasaScience("mars/facts/", "Mars: Facts", "2026-09-15"), SKYWATCHING],
  },
  {
    id: "jupiter",
    kind: "Planet · the largest",
    oneLiner: "The king of planets, named for the king of the gods",
    body: [
      "A day there takes about 9.9 hours, the shortest in the solar system.",
      "Galileo first saw its four largest moons in 1610.",
      "Jupiter was king of the Roman gods, and most of the planet’s moons carry the names of figures tied to him or to Zeus.",
    ],
    visibility: "Naked eye",
    citations: [nasaScience("jupiter/facts/", "Jupiter Facts", "2026-09-15"), SKYWATCHING],
  },
  {
    id: "saturn",
    kind: "Planet · sixth from the Sun",
    oneLiner: "The farthest planet found with the unaided eye",
    body: [
      "As of March 2025 it had 274 confirmed moons, far more than any other planet.",
      "Its namesake, the Roman god of agriculture and wealth, was also the father of Jupiter.",
    ],
    visibility: "Naked eye",
    citations: [nasaScience("saturn/facts/", "Saturn: Facts", "2026-09-15"), SKYWATCHING],
  },
  {
    id: "moon",
    kind: "Natural satellite · 238,855 miles away on average",
    oneLiner: "Earth’s only natural satellite",
    body: [
      "All moons share its name because nobody knew other moons existed until Galileo found four around Jupiter in 1610.",
      "In Latin it was Luna, which gives us the word lunar.",
      "Nobody saw its far side until a Soviet spacecraft flew past in 1959.",
    ],
    visibility: "Naked eye",
    citations: [nasaScience("moon/facts/", "Moon Facts", "2026-09-15"), SKYWATCHING],
  },
  {
    id: "iss",
    kind: "Space station · launched 1998",
    oneLiner: "People have lived aboard without a break for over 25 years",
    body: [
      "Its principal partners are the space agencies of the United States, Russia, Europe, Japan and Canada.",
      "Over 280 people from 26 countries have visited it.",
    ],
    visibility: "Naked eye, within a few hours of sunrise or sunset; it looks like a very bright star moving steadily, with no flashing lights",
    citations: [
      CELESTRAK_ISS,
      {
        author: "NASA",
        year: "n.d.",
        title: "International Space Station",
        site: "NASA",
        url: "https://www.nasa.gov/international-space-station/",
        accessed: "2026-09-15",
      },
      {
        author: "NASA",
        year: "n.d.",
        title: "Spot The Station",
        site: "NASA",
        url: "https://www.nasa.gov/spot-the-station/",
        accessed: "2026-09-15",
      },
    ],
  },
  {
    id: "milky-way",
    kind: "Galaxy · our own",
    oneLiner: "The disk of our own galaxy, seen from within",
    body: [
      "The solar system lies inside the Milky Way’s disk, so we see the disk edge-on as a band across the sky.",
      "Spitzer’s infrared images showed two major arms coming off the ends of a central bar; the galaxy was previously thought to have four.",
      "The Sun lies near a small, partial arm called the Orion Arm, or Orion Spur.",
    ],
    visibility: "Naked eye, as a band of faint light, away from bright city lights",
    // The last two carry the band's own colour note (2026-09-16): a 40-minute
    // exposure records dust lanes and red and blue nebulae in it, and the
    // reason your eyes do not is that rod vision sees grey.
    citations: [
      nasaScience("resource/the-milky-way-galaxy/", "The Milky Way Galaxy", "2026-09-15"),
      SKYWATCHING,
      APOD_MILKY_WAY,
      ROD_VISION,
    ],
  },

  /* ---- meteor showers ---- */
  {
    id: "quadrantids",
    kind: "Meteor shower · radiant near Boötes",
    oneLiner: "Named for a constellation the IAU dropped in 1922",
    body: [
      "The name comes from Quadrans Muralis, a constellation Jerome Lalande created in 1795 and the IAU left off its list in 1922.",
      "Unlike most showers it comes from an asteroid, which may be a “dead comet”.",
      "The peak lasts only a few hours, because the stream is thin and Earth crosses it at a perpendicular angle.",
    ],
    visibility: "Naked eye; best from the Northern Hemisphere, at night and before dawn",
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/quadrantids/", "Quadrantids", "2026-09-15"), SKYWATCHING],
  },
  {
    id: "lyrids",
    kind: "Meteor shower · radiant near Lyra",
    oneLiner: "First recorded by the Chinese in 687 BC",
    body: [
      "It is one of the oldest known showers, observed for 2,700 years.",
      "Most years are modest, but watchers have seen as many as 100 meteors per hour, in 1803, 1922, 1945 and 1982.",
      "The meteors appear to come from near Vega, the brightest star in Lyra.",
    ],
    visibility: "Naked eye; best from the Northern Hemisphere, after moonset and before dawn",
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/lyrids/", "Lyrids", "2026-09-15"), SKYWATCHING],
  },
  {
    id: "eta-aquariids",
    kind: "Meteor shower · radiant in Aquarius",
    oneLiner: "Named for Eta Aquarii, a star in the water jar",
    body: [
      "Each time its parent comet comes back, it sheds ice and rock, and the same dust also makes the Orionids in October.",
      "The Southern Hemisphere sees more of it, because Aquarius rides higher there; in the north the hourly rate drops to about 10.",
      "From the north its meteors more often appear as “Earthgrazers”, long streaks that seem to skim the horizon.",
    ],
    visibility: "Naked eye, in the pre-dawn hours; better from the Southern Hemisphere",
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/eta-aquarids/", "Eta Aquarids", "2026-09-15"), SKYWATCHING],
  },
  {
    id: "southern-delta-aquariids",
    kind: "Meteor shower · radiant in Aquarius",
    oneLiner: "Faint meteors from the southern part of the sky",
    body: [
      "The meteors are faint and hard to spot, and moonlight hides them completely.",
      "Delta, the third brightest star in Aquarius, is in the name to tell it apart from the Eta Aquariids.",
      "The comet suspected to be its source goes around the Sun about once every five years.",
    ],
    visibility: "Naked eye, only without the Moon; best from the Southern Hemisphere",
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/delta-aquariids/", "Southern Delta Aquariids", "2026-09-15"), SKYWATCHING],
  },
  {
    id: "perseids",
    kind: "Meteor shower · radiant in Perseus",
    oneLiner: "Swift, bright meteors that often leave long wakes of light",
    body: [
      "Giovanni Schiaparelli worked out in 1865 which comet it comes from.",
      "That comet’s nucleus is 16 miles across, almost twice the size of the object thought to have killed off the dinosaurs.",
      "Models expect lower background rates through 2026; in 2027 Earth passes parts of the stream that Jupiter has disturbed, which may raise them again.",
    ],
    visibility: "Naked eye; best from mid-northern latitudes, and poorly placed for most of the southern hemisphere",
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/perseids/", "Perseids", "2026-09-15"), SKYWATCHING],
  },
  {
    id: "draconids",
    kind: "Meteor shower · exceptionally slow meteors",
    oneLiner: "Quiet most years, but it stormed in 1933 and 1946",
    body: [
      "It produced meteor storms in 1933 and 1946, and a predicted outburst in 2011 reached a ZHR of about 300.",
      "The 2018 return gave a ZHR of about 150 for about 4 hours.",
      "The radiant never sets for observers north of about 45°N.",
    ],
    visibility: "Naked eye",
    citations: [IMO_2026, SKYWATCHING],
  },
  {
    id: "southern-taurids",
    kind: "Meteor shower · near-ecliptic radiant",
    oneLiner: "Southern branch of the Comet 2P/Encke debris complex",
    body: [
      "Many Taurids are bright and fairly slow, which makes them good targets for still photos.",
      "There is also an earlier maximum around October 13, a date often listed in the past as the main peak.",
      "Koseki remarks that activity around that October maximum may be somewhat higher than average in 2026.",
    ],
    visibility: "Naked eye, from any latitude; the northern hemisphere is somewhat better placed",
    citations: [IMO_2026, SKYWATCHING],
  },
  {
    id: "orionids",
    kind: "Meteor shower · radiant in Orion",
    oneLiner: "Framed by some of the brightest stars in the sky",
    body: [
      "The comet that feeds it also feeds the Eta Aquariids in May.",
      "From 2006 to 2009 it produced unexpectedly strong rates, a ZHR of around 40 to 70, on two or three nights in a row.",
      "Looking 45 to 90 degrees away from the radiant makes the meteors appear longer.",
    ],
    visibility: "Naked eye; the radiant is well up from about local midnight in either hemisphere",
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/orionids/", "Orionids", "2026-09-15"), SKYWATCHING],
  },
  {
    id: "northern-taurids",
    kind: "Meteor shower · bright, slow meteors",
    oneLiner: "Northern branch of the Comet 2P/Encke debris complex",
    body: [
      "Earlier results suggest its best rates hold for roughly ten days in early to mid November, so the peak is less sharp than one date implies.",
      "Its radiant is a large oval region, not a point.",
    ],
    visibility: "Naked eye, well placed through the night",
    citations: [IMO_2026, SKYWATCHING],
  },
  {
    id: "leonids",
    kind: "Meteor shower · radiant in Leo",
    oneLiner: "Bright, fast meteors, and a storm every 33 years or so",
    body: [
      "A storm means at least 1,000 meteors per hour; in 1966 thousands of meteors per minute fell during a 15-minute period.",
      "Every 33 years or so Earth may get a Leonid storm, but rates are often as low as about three meteors per hour.",
      "The last Leonid storm was in 2002.",
    ],
    visibility: "Naked eye; the meteors look longer away from the radiant",
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/leonids/", "Leonids", "2026-09-15"), SKYWATCHING],
  },
  {
    id: "geminids",
    kind: "Meteor shower · radiant in Gemini",
    oneLiner: "A major shower that comes from an asteroid",
    body: [
      "Its parent looks like a rocky asteroid, but it may be a “dead comet” or a “rock comet”, and scientists are not certain how to define it.",
      "The shower first appeared in the mid-1800s with only 10 to 20 meteors per hour.",
      "Its meteors tend to be yellow.",
    ],
    visibility: "Naked eye; best from middle and northern latitudes",
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/geminids/", "Geminids", "2026-09-15"), SKYWATCHING],
  },
  {
    id: "ursids",
    kind: "Meteor shower · radiant in Ursa Minor",
    oneLiner: "A narrow stream, radiating from near the star Kochab",
    body: [
      "William F. Denning probably discovered it, around the start of the 20th century.",
      "In 1945 A. Bečvář saw an outburst of 169 per hour.",
      "Outbursts can come when its parent comet is farthest from the Sun, because some meteoroids are trapped in a 7/6 orbital resonance with Jupiter.",
    ],
    visibility: "Naked eye",
    citations: [IMO_2026, wikipedia("Ursids", 1328535157, "2025", "2026-09-15"), SKYWATCHING],
  },

  /* ---- constellations ---- */
  {
    id: "UMa",
    kind: "Constellation · the third largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "The seven stars of the Plough, or Big Dipper, are only the bear’s rump and tail; the rest of the animal is fainter.",
      "Homer’s Odyssey has the bear that “circles opposite Orion, and never bathes in the sea”, a way of saying it never sets.",
    ],
    visibility: "Naked eye",
    citations: [starTales("ursamajor", "Ursa Major", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "And",
    kind: "Constellation · 19th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Andromeda is the princess chained to a rock as a sacrifice to a sea monster, and rescued by Perseus, fresh from beheading Medusa.",
      "The goddess Athene is said to have placed her among the stars, between Perseus and her mother Cassiopeia.",
    ],
    visibility: "Naked eye",
    citations: [starTales("andromeda", "Andromeda", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Aql",
    kind: "Constellation · 22nd largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Aquila is the eagle of Zeus, which carried the thunderbolts he hurled at his enemies.",
      "In one story it snatched the Trojan boy Ganymede up to Olympus to be cup-bearer of the gods; Ganymede is the neighbouring constellation Aquarius.",
    ],
    visibility: "Naked eye",
    citations: [starTales("aquila", "Aquila", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Aqr",
    kind: "Constellation · 10th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Star maps show a young man pouring water from a jar, and the stream ends in the mouth of the Southern Fish, Piscis Austrinus.",
      "The most popular identification is Ganymede, the Trojan shepherd boy Zeus carried up to Olympus to serve the gods.",
    ],
    visibility: "Naked eye",
    citations: [starTales("aquarius", "Aquarius", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Ari",
    kind: "Constellation · 39th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Aries is the ram whose golden fleece Jason and the Argonauts sailed to Colchis to bring back.",
      "The mythologists said the missing fleece was why the constellation looks faint.",
    ],
    visibility: "Naked eye",
    citations: [starTales("aries", "Aries", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Aur",
    kind: "Constellation · 21st largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "The charioteer holds the reins and a whip but has no chariot, and on his left arm he carries a goat and her two kids that none of the myths explain.",
      "The most popular identification is Erichthonius, a king of Athens and the first person to yoke four horses to one chariot.",
    ],
    visibility: "Naked eye",
    citations: [starTales("auriga", "Auriga", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Boo",
    kind: "Constellation · 13th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "The name probably comes from a Greek word meaning “noisy” or “clamorous”, for a herdsman shouting at his animals.",
      "A story going back to Eratosthenes makes him Arcas, son of Zeus and Callisto.",
    ],
    visibility: "Naked eye",
    citations: [starTales("bootes", "Boötes", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Cnc",
    kind: "Constellation · 31st largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "The crab bit Heracles on the foot while he fought the Hydra, and he stamped on it; Hera, his enemy, put it among the stars of the zodiac.",
      "It is the faintest zodiac constellation, with only six stars brighter than magnitude 5.0.",
    ],
    visibility: "Naked eye",
    citations: [starTales("cancer", "Cancer", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "CMa",
    kind: "Constellation · 43rd largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "It is dominated by Sirius, the Dog Star, and the constellation almost certainly began with that star alone.",
      "Eratosthenes and Hyginus said it was Laelaps, a dog so swift that no prey could outrun it.",
    ],
    visibility: "Naked eye",
    citations: [starTales("canismajor", "Canis Major", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Cap",
    kind: "Constellation · 40th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "The Sumerians called it SUHUR-MASH-HA, the goat-fish; the Greeks identified it with Pan, god of the countryside.",
      "In one story Pan leapt into a river to escape the monster Typhon and turned the lower part of his body into a fish.",
    ],
    visibility: "Naked eye",
    citations: [starTales("capricornus", "Capricornus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Cas",
    kind: "Constellation · 25th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Queen Cassiopeia boasted that she was more beautiful than the sea nymphs called the Nereids, and Poseidon sent a monster to ravage her husband’s coast.",
      "Each night she circles the pole, sometimes hanging upside down, which the mythologists read as part of her punishment.",
    ],
    visibility: "Naked eye",
    citations: [starTales("cassiopeia", "Cassiopeia", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Cen",
    kind: "Constellation · 9th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Centaurus is Chiron, the one wise and scholarly centaur in a wild and ill-behaved race.",
      "Struck by accident with an arrow Heracles had dipped in the Hydra’s blood, Chiron could not die until he gave up his immortality, and was then placed among the stars.",
    ],
    visibility: "Naked eye",
    citations: [starTales("centaurus", "Centaurus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Cep",
    kind: "Constellation · 27th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Cepheus is the mythological king of Ethiopia, husband of Cassiopeia and father of Andromeda.",
      "Its star Delta Cephei, which varies in brightness every 5.4 days, is the prototype of the Cepheid variables that astronomers use to estimate distances.",
    ],
    visibility: "Naked eye",
    citations: [starTales("cepheus", "Cepheus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Cet",
    kind: "Constellation · 4th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Cetus is the sea monster Poseidon sent to ravage the coast of King Cepheus, and that Perseus killed.",
      "The Latin word cetus means whale, but the Greek Ketos meant any sea monster, and on most star maps it looks nothing like a whale.",
    ],
    visibility: "Naked eye",
    citations: [starTales("cetus", "Cetus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "CrB",
    kind: "Constellation · 73rd largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "The semicircle of stars is the golden crown Princess Ariadne of Crete wore when she married the god Dionysus.",
      "Ariadne had helped Theseus out of the Minotaur’s labyrinth with a ball of thread, and he then abandoned her on Naxos.",
    ],
    visibility: "Naked eye",
    citations: [starTales("coronaborealis", "Corona Borealis", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Cyg",
    kind: "Constellation · 16th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "A popular name for it is the Northern Cross; the Greeks saw a swan flying along the Milky Way.",
      "The mythographers say the swan is Zeus in disguise, on his way to a love affair, but disagree about who he was pursuing.",
    ],
    visibility: "Naked eye",
    citations: [starTales("cygnus", "Cygnus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Dra",
    kind: "Constellation · 8th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Draco is the dragon Ladon, which guarded Hera’s tree of golden apples until Heracles killed it.",
      "In the sky the dragon coils around the north pole, with one foot of Hercules planted on its head.",
    ],
    visibility: "Naked eye",
    citations: [starTales("draco", "Draco", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Gem",
    kind: "Constellation · 30th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Gemini is the twins Castor and Pollux, known together as the Dioskouroi, “sons of Zeus”.",
      "In the most common version only Pollux was fathered by Zeus and immortal; Castor was the mortal son of King Tyndareus.",
    ],
    visibility: "Naked eye",
    citations: [starTales("gemini", "Gemini", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Her",
    kind: "Constellation · 5th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "The figure is so ancient that even the Greeks had lost its identity, and called it Engonasin, “the kneeling one”.",
      "Eratosthenes, a century after Aratus, identified it as Heracles triumphing over the dragon that guarded the golden apples.",
    ],
    visibility: "Naked eye",
    citations: [starTales("hercules", "Hercules", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Hya",
    kind: "Constellation · the largest of the 88",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Hydra is the many-headed water snake that Heracles killed as the second of his labours.",
      "It winds over a quarter of the way around the sky, yet its only star of note is Alphard, from the Arabic for “the solitary one”.",
    ],
    visibility: "Naked eye",
    citations: [starTales("hydra", "Hydra", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Leo",
    kind: "Constellation · 12th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Leo is the lion of Nemea, whose skin no weapon could pierce; Heracles choked it to death as the first of his 12 labours.",
      "Six stars in the shape of a sickle outline the lion’s head and chest.",
    ],
    visibility: "Naked eye",
    citations: [starTales("leo", "Leo", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Lyr",
    kind: "Constellation · 52nd largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Lyra is the lyre of the musician Orpheus, and the first lyre ever made.",
      "Hermes built it from a tortoise shell and seven strings of cow gut, as many strings as there are Pleiades.",
    ],
    visibility: "Naked eye",
    citations: [starTales("lyra", "Lyra", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Oph",
    kind: "Constellation · 11th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Ophiuchus is a man gripping a huge snake, which is a separate constellation, Serpens.",
      "The Greeks saw him as Asclepius, god of medicine, whom Zeus struck down for bringing the dead back to life and later set among the stars.",
    ],
    visibility: "Naked eye",
    citations: [starTales("ophiuchus", "Ophiuchus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Ori",
    kind: "Constellation · 26th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "In legend Orion was the tallest and most handsome of men; Betelgeuse and Rigel mark his right shoulder and left foot.",
      "It is among the few star groups already known to the earliest Greek writers, such as Homer and Hesiod.",
    ],
    visibility: "Naked eye",
    citations: [starTales("orion", "Orion", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Peg",
    kind: "Constellation · 7th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Pegasus, the winged horse, sprang from the body of Medusa when Perseus cut off her head.",
      "Only the front half of the horse is in the sky, its body outlined by the four stars of the Square of Pegasus, one of which now belongs to Andromeda.",
    ],
    visibility: "Naked eye",
    citations: [starTales("pegasus", "Pegasus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Per",
    kind: "Constellation · 24th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Perseus is the hero who beheaded Medusa, and six constellations represent the characters in his story.",
      "He lies in a bright part of the Milky Way, which is perhaps why Aratus called him “dust-stained”.",
    ],
    visibility: "Naked eye",
    citations: [starTales("perseus", "Perseus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Sco",
    kind: "Constellation · 33rd largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "This is the scorpion that stung Orion to death; the two are placed opposite each other, so Orion sets as the scorpion rises.",
      "The Sumerians knew it as GIR-TAB, the scorpion, over 5,000 years ago.",
    ],
    visibility: "Naked eye",
    citations: [starTales("scorpius", "Scorpius", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Sgr",
    kind: "Constellation · 15th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "It is drawn as a centaur aiming a bow at the neighbouring scorpion; the stars of the bow and arrow form the Teapot.",
      "It began as PA.BIL.SAG, a Sumerian god of war and hunting, and as a result no particular Greek myths belong to it.",
    ],
    visibility: "Naked eye",
    citations: [starTales("sagittarius", "Sagittarius", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Tau",
    kind: "Constellation · 17th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Taurus is usually Zeus, disguised as the snow-white bull that carried Europa, daughter of King Agenor of Phoenicia, across the sea to Crete.",
      "The bull’s head is a V-shaped group of stars, and its horns are tipped with stars.",
    ],
    visibility: "Naked eye",
    citations: [starTales("taurus", "Taurus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Vir",
    kind: "Constellation · the second largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Virgo is usually identified as Dike, goddess of justice, who left the Earth for the sky when humans descended into violence and war.",
      "She holds an ear of wheat, the star Spica, in her left hand.",
    ],
    visibility: "Naked eye",
    citations: [starTales("virgo", "Virgo", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Ant",
    kind: "Constellation · 62nd largest",
    oneLiner: "Introduced by Lacaille in 1756",
    body: [
      "Lacaille said it symbolized experimental physics, and drew the single-cylinder air pump the French physicist Denis Papin used for his vacuum experiments.",
      "Francis Baily shortened its name from Antlia Pneumatica to Antlia in 1845.",
    ],
    visibility: "Naked eye",
    citations: [starTales("antlia", "Antlia", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Aps",
    kind: "Constellation · 67th largest",
    oneLiner: "Introduced by Plancius, Keyser and de Houtman in 1598",
    body: [
      "Apus is a bird of paradise, from the Greek apous, “footless”, because Europeans first knew the birds only from dead specimens without feet or wings.",
      "Its brightest stars are only of 4th magnitude.",
    ],
    visibility: "Naked eye",
    citations: [starTales("apus", "Apus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Ara",
    kind: "Constellation · 63rd largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Ara is the altar on which the gods swore allegiance before their war against the Titans, according to Eratosthenes and Manilius.",
    ],
    visibility: "Naked eye",
    citations: [starTales("ara", "Ara", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Cae",
    kind: "Constellation · 81st largest",
    oneLiner: "Introduced by Lacaille in 1756",
    body: [
      "Lacaille described it as two engraving tools, crossed and tied with a ribbon; now it is simply the chisel.",
      "John Herschel proposed shortening its name from Caelum Scalptorium to Caelum in 1844.",
    ],
    visibility: "Naked eye",
    citations: [starTales("caelum", "Caelum", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Cam",
    kind: "Constellation · 18th largest",
    oneLiner: "Introduced by Plancius in 1613",
    body: [
      "The Greeks called giraffes “camel leopards” because of their long necks and spots, which is where the name comes from.",
      "The Greeks left this part of the sky blank, because it has no stars brighter than fourth magnitude.",
    ],
    visibility: "Naked eye, but faint",
    citations: [starTales("camelopardalis", "Camelopardalis", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "CVn",
    kind: "Constellation · 38th largest",
    oneLiner: "Introduced by Hevelius in 1690",
    body: [
      "Hevelius drew a pair of greyhounds held on a lead by Boötes, snapping at the heels of the Great Bear.",
      "He named the dogs Asterion (“Starry”) and Chara (“Dear”).",
    ],
    visibility: "Naked eye",
    citations: [starTales("canesvenatici", "Canes Venatici", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "CMi",
    kind: "Constellation · 71st largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "The smaller of Orion’s two dogs began as just the bright star Procyon, Greek for “before the dog”, because it rises earlier than Canis Major.",
    ],
    visibility: "Naked eye",
    citations: [starTales("canisminor", "Canis Minor", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Car",
    kind: "Constellation · 34th largest",
    oneLiner: "Split from Argo Navis by Lacaille in 1756",
    body: [
      "Carina is the hull of Argo Navis, the ship of the Argonauts, which Lacaille divided into three parts.",
      "It inherited Canopus, the second-brightest star in the entire sky.",
    ],
    visibility: "Naked eye",
    citations: [starTales("carina", "Carina", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Cha",
    kind: "Constellation · 79th largest",
    oneLiner: "Introduced by Plancius, Keyser and de Houtman in 1598",
    body: [
      "It is named after the colour-changing lizard, and lies near the south celestial pole, in close pursuit of Musca, the fly.",
      "Chameleons are common in Madagascar, where the Dutch fleet stopped to rest and resupply in 1595.",
    ],
    visibility: "Naked eye",
    citations: [starTales("chamaeleon", "Chamaeleon", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Cir",
    kind: "Constellation · 85th largest",
    oneLiner: "Introduced by Lacaille in 1756",
    body: [
      "Circinus is a pair of dividing compasses, squeezed in their folded position between the forefeet of Centaurus and Triangulum Australe.",
      "It is the smallest of Lacaille’s 14 inventions, and the fourth-smallest constellation in the sky.",
    ],
    visibility: "Naked eye",
    citations: [starTales("circinus", "Circinus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Col",
    kind: "Constellation · 54th largest",
    oneLiner: "Split from Canis Major by Plancius in 1592",
    body: [
      "Columba is meant to be Noah’s dove, which returned to the Ark with an olive branch in its beak.",
      "Plancius formed it from stars that Ptolemy had listed as lying outside Canis Major.",
    ],
    visibility: "Naked eye",
    citations: [starTales("columba", "Columba", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Com",
    kind: "Constellation · 42nd largest",
    oneLiner: "Split from Leo by Caspar Vopel in 1536",
    body: [
      "It is the hair of Queen Berenice of Egypt, a fan-shaped swarm of faint stars that Ptolemy described as “a nebulous mass, called the lock”.",
      "Caspar Vopel first showed it as a separate constellation, on a globe.",
    ],
    visibility: "Naked eye",
    citations: [starTales("comaberenices", "Coma Berenices", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "CrA",
    kind: "Constellation · 80th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "The Greeks knew it as a wreath rather than a crown, a circlet of stars beneath the forefeet of Sagittarius.",
      "Hyginus said it was a wreath the archer had cast off “as by one at play”.",
    ],
    visibility: "Naked eye",
    citations: [starTales("coronaaustralis", "Corona Australis", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Crv",
    kind: "Constellation · 70th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Apollo sent the crow to fetch water, but it waited days for figs to ripen and came back blaming a water snake for blocking the spring.",
      "Apollo saw through the lie, condemned the crow to a life of thirst and put it in the sky beside the cup and the water snake.",
    ],
    visibility: "Naked eye",
    citations: [starTales("corvusandcrater", "Corvus and Crater", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Crt",
    kind: "Constellation · 53rd largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Crater is the bowl the crow carried when Apollo sent it to fetch water.",
      "A Greek krater was a bowl for mixing wine with water, not a cup as we know it.",
    ],
    visibility: "Naked eye",
    citations: [starTales("corvusandcrater", "Corvus and Crater", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Cru",
    kind: "Constellation · the smallest of the 88",
    oneLiner: "First shown in modern form by Plancius and Hondius in 1598",
    body: [
      "The Greeks catalogued its stars as part of the hind legs of Centaurus.",
      "It holds the Coalsack, a dark cloud of dust seen in silhouette against the Milky Way.",
      "Its brightest star, Acrux, is the most southerly first-magnitude star.",
    ],
    visibility: "Naked eye",
    citations: [starTales("crux", "Crux", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Del",
    kind: "Constellation · 69th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Eratosthenes says it is the dolphin that found the sea nymph Amphitrite and brought her back to marry Poseidon.",
      "Hyginus and Ovid say instead that it saved the life of Arion, a real poet and musician of the seventh century BC.",
    ],
    visibility: "Naked eye",
    citations: [starTales("delphinus", "Delphinus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Dor",
    kind: "Constellation · 72nd largest",
    oneLiner: "Introduced by Plancius, Keyser and de Houtman in 1598",
    body: [
      "Dorado is the dolphinfish, or mahi-mahi, not the goldfish.",
      "Dutch explorers saw these fish chasing flying fish, so it follows Volans, the flying fish, across the sky.",
    ],
    visibility: "Naked eye",
    citations: [starTales("dorado", "Dorado", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Equ",
    kind: "Constellation · 87th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "The second-smallest constellation is the head of a horse, next to the head of Pegasus.",
      "Its real inventor seems to have been Hipparchus, in the second century BC, not Ptolemy.",
    ],
    visibility: "Naked eye",
    citations: [starTales("equuleus", "Equuleus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Eri",
    kind: "Constellation · 6th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Ptolemy called it simply Potamos, the river, and Eratosthenes said it was the Nile.",
      "The celestial river flows from north to south, opposite to the real Nile.",
    ],
    visibility: "Naked eye",
    citations: [starTales("eridanus", "Eridanus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "For",
    kind: "Constellation · 41st largest",
    oneLiner: "Introduced by Lacaille in 1756",
    body: [
      "Fornax is a chemist’s furnace for distillation, tucked into a bend of the river Eridanus.",
      "It is sometimes said Lacaille made it to honour Antoine Lavoisier, but Lavoisier was only 13 when Lacaille’s chart was first published.",
    ],
    visibility: "Naked eye",
    citations: [starTales("fornax", "Fornax", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Gru",
    kind: "Constellation · 45th largest",
    oneLiner: "Introduced by Plancius, Keyser and de Houtman in 1598",
    body: [
      "Grus is a crane; the Dutch navigators possibly had in mind the sarus crane of India and southeast Asia, which stands nearly 6ft tall.",
      "De Houtman called it the heron in his catalogue, but Bayer kept the original name, Grus.",
    ],
    visibility: "Naked eye",
    citations: [starTales("grus", "Grus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Hor",
    kind: "Constellation · 58th largest",
    oneLiner: "Introduced by Lacaille in 1756",
    body: [
      "Lacaille wrote that it represented a pendulum clock beating seconds, the kind he used to time his observations.",
      "It was imagined with a full dial and a seconds-hand, in a patch of sky with no stars brighter than fourth magnitude.",
    ],
    visibility: "Naked eye",
    citations: [starTales("horologium", "Horologium", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Hyi",
    kind: "Constellation · 61st largest",
    oneLiner: "Introduced by Plancius, Keyser and de Houtman in 1598",
    body: [
      "Hydrus is a small male water snake, the southern counterpart of the much larger female Hydra.",
      "It represents the sea snakes the Dutch explorers would have seen on their voyages.",
    ],
    visibility: "Naked eye",
    citations: [starTales("hydrus", "Hydrus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Ind",
    kind: "Constellation · 49th largest",
    oneLiner: "Introduced by Plancius, Keyser and de Houtman in 1598",
    body: [
      "Indus is an Indian brandishing a spear as though hunting.",
      "Nobody knows where he is meant to be from, but early drawings closely resemble an engraving of a native of Madagascar.",
    ],
    visibility: "Naked eye",
    citations: [starTales("indus", "Indus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Lac",
    kind: "Constellation · 68th largest",
    oneLiner: "Introduced by Hevelius in 1690",
    body: [
      "The lizard sits between Cygnus and Andromeda like a lizard between rocks.",
      "Its two brightest stars are only of fourth magnitude.",
    ],
    visibility: "Naked eye",
    citations: [starTales("lacerta", "Lacerta", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "LMi",
    kind: "Constellation · 64th largest",
    oneLiner: "Introduced by Hevelius in 1690",
    body: [
      "Leo Minor is a lion cub accompanying Leo, formed from 18 faint stars, with no legends attached to it.",
      "Through an oversight by Francis Baily, it has a Beta star but no star labelled Alpha.",
    ],
    visibility: "Naked eye",
    citations: [starTales("leominor", "Leo Minor", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Lep",
    kind: "Constellation · 51st largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "The hare crouches beneath Orion’s feet; Eratosthenes says Hermes put it in the sky because of its swiftness.",
      "Aratus wrote that the Dog, Canis Major, chases it in an unending race.",
    ],
    visibility: "Naked eye",
    citations: [starTales("lepus", "Lepus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Lib",
    kind: "Constellation · 29th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "To the ancient Greeks this area was the scorpion’s claws; the Romans made it a balance in the first century BC.",
      "It is the only zodiac constellation that represents an inanimate object.",
    ],
    visibility: "Naked eye",
    citations: [starTales("libra", "Libra", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Lup",
    kind: "Constellation · 46th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "The Greeks saw an unspecified wild animal, impaled on a long pole held by the neighbouring centaur.",
      "The wolf seems to have become established in Renaissance times, harking back to the Babylonian UR.IDIM, meaning “wild dog” or “wolf”.",
    ],
    visibility: "Naked eye",
    citations: [starTales("lupus", "Lupus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Lyn",
    kind: "Constellation · 28th largest",
    oneLiner: "Introduced by Hevelius in 1690",
    body: [
      "Hevelius wrote that anyone who wanted to see it would need the eyesight of a lynx, though he exaggerated how faint its stars are.",
      "Apart from one third-magnitude star, it has nothing brighter than fourth magnitude.",
    ],
    visibility: "Naked eye, but faint",
    citations: [starTales("lynx", "Lynx", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Men",
    kind: "Constellation · 75th largest",
    oneLiner: "Introduced by Lacaille in 1756",
    body: [
      "Mensa commemorates Table Mountain near Cape Town, where Lacaille catalogued the southern stars in 1751–52.",
      "Part of the Large Magellanic Cloud lies in it, capping it with a white cloud like the one sometimes seen over the real mountain.",
    ],
    visibility: "Naked eye, but faint: the dimmest of the 88",
    citations: [starTales("mensa", "Mensa", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Mic",
    kind: "Constellation · 66th largest",
    oneLiner: "Introduced by Lacaille in 1756",
    body: [
      "Microscopium is an early compound microscope, one that uses more than one lens.",
      "Its brightest star, Gamma Microscopii, is only magnitude 4.7.",
    ],
    visibility: "Naked eye, but faint",
    citations: [starTales("microscopium", "Microscopium", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Mon",
    kind: "Constellation · 35th largest",
    oneLiner: "Introduced by Plancius in 1613",
    body: [
      "Plancius put the unicorn, a beast unknown to the ancient Greeks, on the same globe where Camelopardalis first appeared.",
      "Jacob Bartsch drew it in 1624, and as a result was sometimes wrongly credited with inventing it.",
    ],
    visibility: "Naked eye",
    citations: [starTales("monoceros", "Monoceros", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Mus",
    kind: "Constellation · 77th largest",
    oneLiner: "Introduced by Plancius, Keyser and de Houtman in 1598",
    body: [
      "The navigators saw chameleons eating flies on Madagascar, so in the sky the fly sits next to Chamaeleon.",
      "Bayer called it Apis, the bee, perhaps because the figure was unnamed on the globes he copied.",
    ],
    visibility: "Naked eye",
    citations: [starTales("musca", "Musca", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Nor",
    kind: "Constellation · 74th largest",
    oneLiner: "Introduced by Lacaille in 1756",
    body: [
      "Norma is an architect’s set-square and ruler, placed next to Lacaille’s compasses and the southern triangle.",
      "Its brightest stars are only of fourth magnitude, and none of them have names.",
    ],
    visibility: "Naked eye",
    citations: [starTales("norma", "Norma", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Oct",
    kind: "Constellation · 50th largest",
    oneLiner: "Introduced by Lacaille in 1756",
    body: [
      "Octans is a reflecting octant, the navigators’ instrument John Hadley invented in 1730.",
      "It holds the south celestial pole but no star brighter than fourth magnitude.",
    ],
    visibility: "Naked eye",
    citations: [starTales("octans", "Octans", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Pav",
    kind: "Constellation · 44th largest",
    oneLiner: "Introduced by Plancius, Keyser and de Houtman in 1598",
    body: [
      "The peacock was the sacred bird of Hera, who put the eyes of the 100-eyed watchman Argus on its tail after Hermes killed him.",
      "It seems to be the Java green peacock of the East Indies, not the common blue peacock.",
    ],
    visibility: "Naked eye",
    citations: [starTales("pavo", "Pavo", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Phe",
    kind: "Constellation · 37th largest",
    oneLiner: "Introduced by Plancius, Keyser and de Houtman in 1598",
    body: [
      "Phoenix is the mythical bird reborn from its own ashes; Ovid says it lived for 500 years.",
      "It is the largest of the 12 figures made from Keyser and de Houtman’s observations.",
    ],
    visibility: "Naked eye",
    citations: [starTales("phoenix", "Phoenix", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Pic",
    kind: "Constellation · 59th largest",
    oneLiner: "Introduced by Lacaille in 1756",
    body: [
      "Lacaille described it as “The Painter’s Easel, to which is attached a palette”, and set it next to the bright star Canopus.",
      "John Herschel proposed shortening its name to Pictor in 1844.",
    ],
    visibility: "Naked eye",
    citations: [starTales("pictor", "Pictor", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Psc",
    kind: "Constellation · 14th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Its story is set by the river Euphrates, a strong sign that the Greeks inherited it from the Babylonians.",
      "Fleeing the monster Typhon, Aphrodite and her son Eros leapt into the river and were carried off by two fish, or in another version became fish themselves.",
    ],
    visibility: "Naked eye",
    citations: [starTales("pisces", "Pisces", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "PsA",
    kind: "Constellation · 60th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Eratosthenes called it the Great Fish, and said it was the parent of the two fish of Pisces.",
      "It is supposed to have saved the Syrian goddess Derceto when she fell into a lake near the Euphrates.",
    ],
    visibility: "Naked eye",
    citations: [starTales("piscisaustrinus", "Piscis Austrinus", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Pup",
    kind: "Constellation · 20th largest",
    oneLiner: "Split from Argo Navis by Lacaille in 1756",
    body: [
      "Puppis is the stern, or poop, of Argo Navis, and the largest of the three sections Lacaille divided the ship into.",
      "It has no stars labelled Alpha or Beta, because Lacaille lettered the stars of the ship as a whole.",
    ],
    visibility: "Naked eye",
    citations: [starTales("puppis", "Puppis", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Pyx",
    kind: "Constellation · 65th largest",
    oneLiner: "Introduced by Lacaille in 1756",
    body: [
      "Pyxis is a magnetic compass as used by seamen, placed near the stern of the ship Argo, where the mast was.",
      "Lacaille invented it on its own, separately from the three parts he split Argo Navis into.",
    ],
    visibility: "Naked eye",
    citations: [starTales("pyxis", "Pyxis", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Ret",
    kind: "Constellation · 82nd largest",
    oneLiner: "Introduced by Lacaille in 1756",
    body: [
      "Reticulum commemorates the reticle in the eyepiece of the small telescope Lacaille used to catalogue the southern stars from the Cape of Good Hope.",
      "It sits next to Horologium, the clock he used to time stars as they passed through the reticle.",
    ],
    visibility: "Naked eye",
    citations: [starTales("reticulum", "Reticulum", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Sge",
    kind: "Constellation · 86th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "The third-smallest constellation has no stars brighter than fourth magnitude, but the Greeks knew it well.",
      "Aratus described it as “alone, without a bow”, since there is no sign of the archer who might have shot it.",
    ],
    visibility: "Naked eye",
    citations: [starTales("sagitta", "Sagitta", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Scl",
    kind: "Constellation · 36th largest",
    oneLiner: "Introduced by Lacaille in 1756",
    body: [
      "Lacaille called it the sculptor’s studio: a carved head on a three-legged table, with a mallet and a chisel on a block of marble.",
      "John Herschel proposed shortening its name to Sculptor in 1844.",
    ],
    visibility: "Naked eye, but faint",
    citations: [starTales("sculptor", "Sculptor", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Sct",
    kind: "Constellation · 84th largest",
    oneLiner: "Introduced by Hevelius in 1684, in Acta Eruditorum",
    body: [
      "Hevelius named it Sobieski’s Shield, for King John III Sobieski of Poland, who helped him rebuild his observatory after a fire in 1679.",
      "It is the only constellation introduced for political reasons that is still in use.",
      "Flamsteed and later Baily left it out of their catalogues; Benjamin Gould’s catalogue of 1879 made it permanent.",
    ],
    visibility: "Naked eye",
    citations: [starTales("scutum", "Scutum", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Ser",
    kind: "Constellation · 23rd largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Serpens is the only constellation divided into two parts, the head and the tail, one on each side of Ophiuchus, who holds the snake.",
      "Ptolemy called it the serpent of the serpent-holder, presumably to avoid confusion with Draco and Hydra.",
    ],
    visibility: "Naked eye",
    citations: [starTales("serpens", "Serpens", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Sex",
    kind: "Constellation · 47th largest",
    oneLiner: "Introduced by Hevelius in 1690",
    body: [
      "It commemorates the sextant Hevelius used to measure star positions, destroyed with his other instruments in a fire at his home in 1679.",
      "None of its stars is brighter than 5th magnitude.",
    ],
    visibility: "Naked eye, but faint",
    citations: [starTales("sextans", "Sextans", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Tel",
    kind: "Constellation · 57th largest",
    oneLiner: "Introduced by Lacaille in 1756",
    body: [
      "Telescopium is an aerial telescope, a long refractor hung from a pole, of the kind J. D. Cassini used at Paris Observatory.",
      "Lacaille drew it reaching north between Sagittarius and Scorpius, but astronomers have since cut off the top of its tube.",
    ],
    visibility: "Naked eye, but faint",
    citations: [starTales("telescopium", "Telescopium", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Tri",
    kind: "Constellation · 78th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "Aratus and Eratosthenes called it Deltoton, because its shape looked like a capital delta.",
      "Eratosthenes said it represented the Nile delta.",
    ],
    visibility: "Naked eye",
    citations: [starTales("triangulum", "Triangulum", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "TrA",
    kind: "Constellation · 83rd largest",
    oneLiner: "Introduced by Plancius, Keyser and de Houtman in 1598",
    body: [
      "It is the smallest of Keyser and de Houtman’s 12 constellations, but its three main stars are brighter than those of the northern Triangle.",
      "Lacaille saw it as a surveyor’s level, one of a group of drawing and surveying instruments with Circinus and Norma.",
    ],
    visibility: "Naked eye",
    citations: [starTales("triangulumaustrale", "Triangulum Australe", "2026-09-15"), IAU_TABLE, SKYWATCHING, starTales("circinus", "Circinus", "2026-09-15")],
  },
  {
    id: "Tuc",
    kind: "Constellation · 48th largest",
    oneLiner: "Introduced by Plancius, Keyser and de Houtman in 1598",
    body: [
      "Plancius named it Toucan, after the South American bird with a huge bill.",
      "De Houtman’s catalogue described an Oriental pied hornbill instead, which suggests the real inventor might have been Keyser, who had visited South America.",
    ],
    visibility: "Naked eye",
    citations: [starTales("tucana", "Tucana", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "UMi",
    kind: "Constellation · 56th largest",
    oneLiner: "One of the 48 constellations in Ptolemy’s Almagest",
    body: [
      "The Greeks said the astronomer Thales of Miletus first named the Little Bear, and that the Phoenicians steered by it.",
      "It is smaller and fainter than the Great Bear but closer to the pole, and so, Aratus pointed out, a better guide to true north.",
      "Its Greek name Kynosoura, “dog’s tail”, is the origin of the English word cynosure.",
    ],
    visibility: "Naked eye",
    citations: [starTales("ursaminor", "Ursa Minor", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Vel",
    kind: "Constellation · 32nd largest",
    oneLiner: "Split from Argo Navis by Lacaille in 1756",
    body: [
      "Vela is the sails of Argo Navis, one of the three sections Lacaille divided the ship into.",
      "Because Lacaille used one set of Greek letters for all of Argo, Vela has no stars labelled Alpha or Beta.",
    ],
    visibility: "Naked eye",
    citations: [starTales("vela", "Vela", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Vol",
    kind: "Constellation · 76th largest",
    oneLiner: "Introduced by Plancius, Keyser and de Houtman in 1598",
    body: [
      "Volans is a flying fish, which can leap out of the water and glide through the air on wings.",
      "In the sky the predatory Dorado chases it, just as real dolphinfish chase flying fish.",
    ],
    visibility: "Naked eye",
    citations: [starTales("volans", "Volans", "2026-09-15"), starTales("dorado", "Dorado", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
  {
    id: "Vul",
    kind: "Constellation · 55th largest",
    oneLiner: "Introduced by Hevelius in 1690",
    body: [
      "Hevelius drew a fox carrying a goose in its jaws; the goose has since dropped out of the figure, leaving just the fox.",
      "He said the fox was taking the goose to Cerberus, another of his inventions, which is now obsolete.",
    ],
    visibility: "Naked eye",
    citations: [starTales("vulpecula", "Vulpecula", "2026-09-15"), IAU_TABLE, SKYWATCHING],
  },
];
