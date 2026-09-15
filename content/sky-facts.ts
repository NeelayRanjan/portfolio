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
