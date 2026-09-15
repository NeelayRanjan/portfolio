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

/** A NASA Science page, by its path under https://science.nasa.gov/. */
function nasaScience(path: string, title: string, accessed: string): Citation {
  return {
    author: "NASA Science",
    year: "n.d.",
    title,
    site: "NASA Science",
    url: `https://science.nasa.gov/${path}`,
    accessed,
  };
}

const SKYWATCHING = nasaScience("skywatching/", "Skywatching Tips From NASA", "2026-09-15");

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

  /* ---- spacecraft and named stars ---- */
  {
    id: "voyager-1",
    kind: "Spacecraft · launched 1977",
    oneLiner: "No spacecraft has gone farther",
    body: [
      "On Aug. 25, 2012, it became the first spacecraft to leave the heliosphere and start measuring interstellar space.",
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
      "On Dec. 10, 2018, it became the second spacecraft to enter interstellar space.",
      "At Uranus it found 10 new moons, whose names were taken from Shakespeare.",
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
    ],
  },
  {
    id: "polaris",
    kind: "Yellow supergiant · Ursa Minor",
    oneLiner: "The North Star, less than 1° from the pole",
    body: [
      "It sits less than 1° from the north celestial pole, which makes it the current northern pole star.",
      "To the naked eye it is one point of light, but it is a system of three stars.",
      "The name is short for the Neo-Latin stella polaris, “polar star”, first printed in the Alfonsine Tables of 1492.",
    ],
    visibility: "Naked eye",
    citations: [wikipedia("Polaris", 1374743634, "2026", "2026-09-15")],
  },
  {
    id: "sirius",
    kind: "Binary star · 8.6 light-years",
    oneLiner: "The Dog Star, the brightest star in the night sky",
    body: [
      "The name comes from the Ancient Greek Seirios, “glowing” or “scorcher”.",
      "Its faint companion, the white dwarf Sirius B, orbits with it every 50 years.",
      "The heliacal rising of Sirius marked the Nile flood in Ancient Egypt.",
    ],
    visibility: "Naked eye",
    citations: [wikipedia("Sirius", 1374864849, "2026", "2026-09-15")],
  },
  {
    id: "arcturus",
    kind: "Red giant · 36.7 light-years",
    oneLiner: "The brightest star in the northern celestial hemisphere",
    body: [
      "The name means “Guardian of the Bear”, from the Greek words for bear and watcher.",
      "It has about the Sun’s mass but has expanded to 25 times its size.",
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
      "The name comes from the Arabic an-nasr al-wāqi’, “the falling eagle”.",
    ],
    visibility: "Naked eye; the fifth-brightest star in the night sky",
    citations: [wikipedia("Vega", 1374446348, "2026", "2026-09-15")],
  },
  {
    id: "capella",
    kind: "Quadruple star · 42.9 light-years",
    oneLiner: "The “little goat”, the brightest star in Auriga",
    body: [
      "It looks like one star but is two pairs: two yellow giants, and two faint red dwarfs around 10,000 AU away from them.",
      "The two giants orbit each other every 104 days.",
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
      "The name comes from the Arabic Rijl Jauzah al Yusrā, “the left leg (foot) of Jauzah”, Jauzah being a name for Orion.",
      "The single blue-white point the eye sees is a system of at least four stars.",
      "It is expected to end its life as a Type II supernova.",
    ],
    visibility: "Naked eye; generally the seventh-brightest star in the night sky",
    citations: [wikipedia("Rigel", 1374810813, "2026", "2026-09-15")],
  },
  {
    id: "procyon",
    kind: "Binary star · 11.46 light-years",
    oneLiner: "“Before the dog”: it crosses the sky ahead of Sirius",
    body: [
      "The name comes from the Ancient Greek Prokyon, “before the dog”, because it precedes the Dog Star, Sirius, across the sky.",
      "A faint white dwarf, Procyon B, orbits it every 40.84 years.",
    ],
    visibility: "Naked eye; usually the eighth-brightest star in the night sky",
    citations: [wikipedia("Procyon", 1366891007, "2026", "2026-09-15")],
  },
  {
    id: "betelgeuse",
    kind: "Red supergiant · Orion",
    oneLiner: "A red supergiant at Orion’s shoulder",
    body: [
      "Put in the Sun’s place, its surface would lie beyond the asteroid belt.",
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
      "It spins at about 286 km/s at its equator, fast enough to flatten it at the poles.",
      "The name is short for the Arabic Al-Nasr Al-Ṭā’ir, “the flying eagle”.",
    ],
    visibility: "Naked eye; the twelfth-brightest star in the night sky",
    citations: [wikipedia("Altair", 1374232322, "2026", "2026-09-15")],
  },
  {
    id: "aldebaran",
    kind: "Red giant · about 67 light-years",
    oneLiner: "“The follower”, which trails the Pleiades",
    body: [
      "The name comes from the Arabic for “the bright one of the follower”, because it follows the Pleiades.",
      "It lies along the line of sight to the Hyades cluster but is unrelated to it, and much older.",
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
      "The name comes from the Ancient Greek for “rival to Ares”, because its reddish colour looks like Mars.",
      "Put in the Sun’s place, it would reach somewhere into the asteroid belt.",
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
      "The name is from the Latin spīca virginis, “the virgin’s ear of [wheat] grain”.",
      "Its two stars are so close together that they are egg-shaped, and only their spectra tell them apart.",
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
      "The name comes from the Arabic Dhanab al-Dajājah, “tail of the hen”.",
      "Its distance is poorly known: estimates run from 1,400 to 2,600 light-years.",
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
      "The name is Latin for “prince” or “little king”.",
      "It looks like a single star but is four stars in two pairs.",
      "With five dimmer stars it makes the Sickle, the asterism that marks the lion’s head.",
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
      "It is named for the swiftest of the ancient Roman gods, and it is the fastest planet, going around the Sun every 88 Earth days.",
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
      "It is named for the Roman goddess of love and beauty, whom the Greeks knew as Aphrodite, and most features on it are named for women.",
      "A day there lasts 243 Earth days, longer than its 225-day year, and the Sun rises in the west.",
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
      "It is named for Jupiter, king of the Roman gods, and most of its moons for figures tied to him or to Zeus.",
      "Galileo first saw its four largest moons in 1610.",
      "A day there takes about 9.9 hours, the shortest in the solar system.",
    ],
    visibility: "Naked eye",
    citations: [nasaScience("jupiter/facts/", "Jupiter Facts", "2026-09-15"), SKYWATCHING],
  },
  {
    id: "saturn",
    kind: "Planet · sixth from the Sun",
    oneLiner: "The farthest planet found with the unaided eye",
    body: [
      "It is named for the Roman god of agriculture and wealth, who was also the father of Jupiter.",
      "As of March 2025 it had 274 confirmed moons, far more than any other planet.",
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
      "November 2, 2025, marked 25 years of continuous human presence aboard.",
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
    kind: "Galaxy · ours, seen edge-on from inside",
    oneLiner: "The disk of our own galaxy, seen from within",
    body: [
      "The solar system lies inside the Milky Way’s disk, so we see the disk edge-on as a band across the sky.",
      "Spitzer’s infrared images showed two major arms coming off the ends of a central bar; the galaxy was previously thought to have four.",
      "The Sun lies near a small, partial arm called the Orion Arm, or Orion Spur.",
    ],
    visibility: "Naked eye, as a band of faint light, away from bright city lights",
    citations: [nasaScience("resource/the-milky-way-galaxy/", "The Milky Way Galaxy", "2026-09-15"), SKYWATCHING],
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
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/quadrantids/", "Quadrantids", "2026-09-15")],
  },
  {
    id: "lyrids",
    kind: "Meteor shower · radiant in Lyra",
    oneLiner: "First recorded by the Chinese in 687 BC",
    body: [
      "It is one of the oldest known showers, observed for 2,700 years.",
      "Most years are modest, but watchers have seen as many as 100 meteors per hour, in 1803, 1922, 1945 and 1982.",
      "The meteors appear to come from near Vega, the brightest star in Lyra.",
    ],
    visibility: "Naked eye; best from the Northern Hemisphere, after moonset and before dawn",
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/lyrids/", "Lyrids", "2026-09-15")],
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
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/eta-aquarids/", "Eta Aquarids", "2026-09-15")],
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
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/delta-aquariids/", "Southern Delta Aquariids", "2026-09-15")],
  },
  {
    id: "perseids",
    kind: "Meteor shower · radiant in Perseus",
    oneLiner: "Often called the best meteor shower of the year",
    body: [
      "Giovanni Schiaparelli worked out in 1865 which comet it comes from.",
      "That comet’s nucleus is 16 miles across, almost twice the size of the object thought to have killed off the dinosaurs.",
      "Models expect lower background rates through 2026; in 2027 Earth passes parts of the stream that Jupiter has disturbed, which may raise them again.",
    ],
    visibility: "Naked eye; best from mid-northern latitudes, and poorly placed for most of the southern hemisphere",
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/perseids/", "Perseids", "2026-09-15")],
  },
  {
    id: "draconids",
    kind: "Meteor shower · exceptionally slow meteors",
    oneLiner: "Quiet most years, but it stormed in 1933 and 1946",
    body: [
      "It produced spectacular meteor storms in 1933 and 1946, and a predicted outburst in 2011 reached a ZHR of about 300.",
      "Its meteors move exceptionally slowly.",
      "The radiant never sets for observers north of about 45°N.",
    ],
    visibility: "Naked eye",
    citations: [IMO_2026],
  },
  {
    id: "southern-taurids",
    kind: "Meteor shower · bright, slow meteors",
    oneLiner: "The southern branch of the Taurids",
    body: [
      "It and the Northern Taurids are two branches of one debris complex.",
      "Many Taurids are bright and fairly slow, which makes them good targets for still photos.",
      "There is also an earlier maximum around October 13, a date often listed in the past as the main peak.",
    ],
    visibility: "Naked eye, from any latitude; the northern hemisphere is somewhat better placed",
    citations: [IMO_2026],
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
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/orionids/", "Orionids", "2026-09-15")],
  },
  {
    id: "northern-taurids",
    kind: "Meteor shower · bright, slow meteors",
    oneLiner: "The northern branch of the Taurids",
    body: [
      "Earlier results suggest its best rates hold for roughly ten days in early to mid November, so the peak is less sharp than one date implies.",
      "Its radiant is a large oval region, not a point.",
    ],
    visibility: "Naked eye, well placed through the night",
    citations: [IMO_2026],
  },
  {
    id: "leonids",
    kind: "Meteor shower · radiant in Leo",
    oneLiner: "A possible meteor storm every 33 years or so",
    body: [
      "Every 33 years or so Earth may get a Leonid storm, with hundreds to thousands of meteors per hour.",
      "In 1966 thousands of meteors per minute fell during a 15-minute period.",
      "The last Leonid storm was in 2002.",
    ],
    visibility: "Naked eye; the meteors look longer away from the radiant",
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/leonids/", "Leonids", "2026-09-15")],
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
    citations: [IMO_2026, nasaScience("solar-system/meteors-meteorites/geminids/", "Geminids", "2026-09-15")],
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
    citations: [IMO_2026, wikipedia("Ursids", 1328535157, "2025", "2026-09-15")],
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
      "In one story Pan leapt into a river to escape the monster Typhon and turned the lower half of his body into a fish.",
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
    visibility: "Naked eye, though no star in it is brighter than fourth magnitude",
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
    oneLiner: "Split from Centaurus by Plancius in 1589",
    body: [
      "The Greeks catalogued its stars as part of the hind legs of Centaurus.",
      "It holds the Coalsack, a dark cloud of dust seen in silhouette against the Milky Way.",
      "Star Tales dates its first appearance in modern form to globes by Plancius and Hondius in 1598 and 1600.",
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
    visibility: "Naked eye",
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
];
