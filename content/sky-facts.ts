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

export const SKY_FACTS: readonly SkyFact[] = [
  /* ---- deep-sky objects and landmarks ---- */
  {
    id: "m31",
    kind: "Spiral galaxy · 2.5 million light-years",
    oneLiner: "The nearest major galaxy to the Milky Way",
    body: [
      "The first known report of it is in al-Sufi’s Book of Fixed Stars, from the year 964.",
      "We see its disk almost edge-on, tilted 77 degrees from our line of sight.",
    ],
    visibility: "Naked eye, even with moderate light pollution; best in November",
    citations: [hubbleMessier(31, "Messier 31 (The Andromeda Galaxy)", "2026-09-15")],
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
      "The stars are packed so closely that nobody could make out individual ones until 1779.",
      "Near the core the stars are about a hundred times denser than around the Sun, close enough that they sometimes collide.",
    ],
    visibility: "Binoculars, most easily in July",
    citations: [hubbleMessier(13, "Messier 13 (The Hercules Cluster)", "2026-09-15")],
  },
  {
    id: "m42",
    kind: "Star-forming nebula · 1,500 light-years",
    oneLiner: "The closest large star-forming region to Earth",
    body: [
      "The Maya of Mesoamerica are thought to have seen it as the cosmic fire of creation.",
      "Four massive young stars at its centre, called the Trapezium, are carving a cavity in the cloud.",
    ],
    visibility: "Naked eye, just below Orion’s belt; best in January",
    citations: [hubbleMessier(42, "Messier 42 (The Orion Nebula)", "2026-09-15")],
  },
  {
    id: "m44",
    kind: "Open cluster · about 600 light-years",
    oneLiner: "The Beehive, about 1,000 stars in Cancer",
    body: [
      "Galileo was the first to see it as more than a cloudy patch, and picked out about 40 of its stars.",
      "The cluster is thought to be 600 to 700 million years old; the Milky Way is about 13 billion.",
    ],
    visibility: "Naked eye as a blur of light; binoculars show about 20 stars; highest in March",
    citations: [hubbleMessier(44, "Messier 44", "2026-09-15")],
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
    id: "sgr-a-star",
    kind: "Supermassive black hole · about 27,000 light-years",
    oneLiner: "Sagittarius A*, the black hole at the Milky Way’s centre",
    body: [
      "It has four million times the mass of the Sun.",
      "The Event Horizon Telescope released the first image of it on 12 May 2022; in our sky it is about the size of a doughnut on the Moon.",
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
    oneLiner: "An empty-looking speck of sky full of galaxies",
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
    citations: [starTales("ursamajor", "Ursa Major", "2026-09-15"), IAU_TABLE],
  },
];
