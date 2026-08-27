// ====================================================================
// data-overlay.js — Spoiler troll choices + multi-inventor support
// Load AFTER data.js, BEFORE core.js
// ====================================================================

// name-to-index lookup, so entries survive reordering
var _nameToIdx = {};
for (var i = 0; i < _d.length; i++) _nameToIdx[_d[i].name] = i;

function _resolveByName(obj) {
  var resolved = {};
  for (var k in obj) {
    if (obj.hasOwnProperty(k)) {
      var idx = _nameToIdx[k];
      if (idx !== undefined) resolved[idx] = obj[k];
    }
  }
  return resolved;
}

// ====== SPOILER TROLL CHOICES ======
// For inventions whose name contains the inventor's name.
// Four curated wrong answers per entry.
var _spoilerChoices = _resolveByName({
  "Morse Code": [
    "David Morse",           // actor
    "Inspector Morse",       // fictional detective
    "Alexander Graham Bell", // same era telecom
    "Alfred Vail"            // actual co-developer (sneaky!)
  ],
  "Braille": [
    "Louis Pasteur",    // wrong Louis
    "Louis Daguerre",   // wrong Louis
    "Louis Armstrong",  // wrong Louis
    "Helen Keller"      // thematic
  ],
  "Diesel Engine": [
    "Vin Diesel",       // actor, real name Mark Sinclair
    "Nikolaus Otto",    // invented the Otto cycle engine
    "Karl Benz",        // same era German engineer
    "Gottlieb Daimler"  // same era German engineer
  ],
  "Zeppelin": [
    "Ferdinand von Hindenburg", // wrong Ferdinand, wrong airship
    "The Wright Brothers",      // aviation confusion
    "Alberto Santos-Dumont",    // aviation pioneer
    "Hugo Eckener"              // actually piloted Zeppelins
  ],
  "Pasteurization": [
    "Louis Braille",    // wrong Louis
    "Louis XVI",        // wrong Louis, bad ending
    "Louis Vuitton",    // wrong Louis, right country
    "Robert Koch"       // rival germ theory scientist
  ],
  "Turing Machine Concept": [
    "Charles Babbage",   // earlier computing pioneer
    "John von Neumann",  // same era, related field
    "Ada Lovelace",      // same vibes
    "Claude Shannon"     // information theory
  ],
  "Voltaic Pile": [
    "Luigi Galvani",     // actual rival scientist!
    "Benjamin Franklin", // electricity guy
    "Michael Faraday",   // electricity guy
    "Georg Ohm"          // electricity guy
  ],
  "Stirling Engine": [
    "James Watt",         // wrong engine guy
    "James Stirling",     // real mathematician, same name
    "Thomas Newcomen",    // earlier engine
    "Raheem Sterling"     // footballer, wrong spelling, chaos
  ],
  "Watt Steam Engine": [
    "Thomas Newcomen",    // earlier steam engine (tricky!)
    "Richard Trevithick", // later steam locomotive
    "Robert Stirling",    // different engine
    "James Joule"         // wrong James, same thermodynamics
  ],
  "Bunsen Burner": [
    "Peter Desaga",      // actual co-creator! (both correct)
    "Robert Boyle",      // wrong Robert, right chemistry
    "Antoine Lavoisier", // chemistry vibes
    "Humphry Davy"       // chemistry vibes
  ],
  "Tesla Coil": [
    "Thomas Edison",     // actual rival!
    "Elon Musk",         // named his company Tesla
    "Guglielmo Marconi", // Tesla's radio rival
    "Michael Faraday"    // electricity pioneer
  ],
  "Gatling Gun": [
    "Hiram Maxim",         // actual rival machine gun inventor!
    "Samuel Colt",         // firearms, same era
    "John Browning",       // firearms designer
    "Mikhail Kalashnikov"  // wrong era firearms
  ],
  "Tupperware": [
    "Milton Hershey",    // food brand named after founder
    "Henry Heinz",       // food brand named after founder
    "Colonel Sanders",   // food brand vibes
    "Walt Disney"        // American brand empire
  ],
  "Richter Scale": [
    "Beno Gutenberg",      // actual co-developer! (both correct)
    "Burton Richter",      // real physicist, different field
    "Hans Richter",        // real conductor
    "Charles Francis Richter" // his full name (same person trick)
  ],
  "Bessemer Steel Process": [
    "William Kelly",      // actual independent inventor! (both correct)
    "Andrew Carnegie",    // used Bessemer steel, didn't invent it
    "Abraham Darby",      // ironmaking pioneer
    "Charles Siemens"     // competing steel process
  ],
  "Dolby Surround Sound": [
    "Thomas Dolby",       // 1980s musician, "She Blinded Me with Science"
    "Phil Spector",       // Wall of Sound producer
    "Edwin Armstrong",    // FM radio pioneer
    "Lee De Forest"       // audio amplification pioneer
  ],
  "Ford Model T": [
    "Harrison Ford",      // actor
    "Gerald Ford",        // president
    "Henry Ford II",      // his grandson
    "Ransom Olds"         // earlier car manufacturer
  ],
  "Rubik's Cube": [
    "Tibor Laczi",        // actually helped market the Cube
    "Tom Kremer",         // actually helped bring it to market
    "Ole Kirk Christiansen", // LEGO founder (toy confusion)
    "Milton Bradley"       // board game company founder
  ],
  "Ferris Wheel": [
    "George Westinghouse", // same 1893 World's Fair!
    "Gustave Eiffel",      // built a famous structure for a fair
    "P.T. Barnum",         // entertainment/spectacle
    "Walt Disney"          // amusement rides
  ],
  "Gore-Tex": [
    "Al Gore",             // wrong Gore
    "Wilbert Gore",        // Robert's father, founded the company (tricky!)
    "Charles Goodyear",    // material science
    "Stephanie Kwolek"     // Kevlar inventor, same vibes
  ],
  "Daguerreotype": [
    "Nicephore Niepce",        // actual partner! (both correct)
    "William Henry Fox Talbot", // rival photography process
    "George Eastman",          // later photography pioneer
    "Eadweard Muybridge"      // motion photography
  ],
  "Jacquard Loom": [
    "Edmund Cartwright",  // power loom inventor (tricky!)
    "James Hargreaves",   // spinning jenny
    "Eli Whitney",        // cotton gin, textile connection
    "Samuel Crompton"     // spinning mule
  ]
});

// ====== MULTI-INVENTOR DATA ======
// altInventors: additional valid inventors beyond the primary one.
// Co-inventors only, not predecessors.
var _altInventors = _resolveByName({
  // === Communication ===
  "Telephone": ["Elisha Gray", "Antonio Meucci"],
  "Radio": ["Nikola Tesla", "Oliver Lodge"],
  "Phonograph": ["Charles Cros"],
  "Telegraph": ["William Fothergill Cooke", "Charles Wheatstone"],
  "Morse Code": ["Alfred Vail"],
  "Fiber Optic Cable": ["Donald Keck", "Peter Schultz"],
  "Ethernet": ["David Boggs", "Butler Lampson", "Chuck Thacker"],
  "YouTube": ["Steve Chen", "Jawed Karim"],
  "Facebook": ["Eduardo Saverin", "Andrew McCollum", "Dustin Moskovitz", "Chris Hughes"],
  "Arduino": ["David Cuartielles", "Tom Igoe", "Gianluca Martino", "David Mellis"],
  "Bluetooth": ["Sven Mattisson"],
  "SMS Text Messaging": ["Neil Papworth", "Friedhelm Hillebrand"],
  "World Wide Web": ["Robert Cailliau"],
  "Walkie-Talkie": ["Al Gross"],
  "Google Search": ["Sergey Brin"],
  "Twitter": ["Noah Glass", "Biz Stone", "Evan Williams"],
  "Instagram": ["Mike Krieger"],
  "Spotify": ["Martin Lorentzon"],
  "Wikipedia": ["Larry Sanger"],
  "Skype": ["Janus Friis", "Ahti Heinla", "Priit Kasesalu", "Jaan Tallinn"],
  "WhatsApp": ["Brian Acton"],
  "Snapchat": ["Bobby Murphy", "Reggie Brown"],
  "Reddit": ["Alexis Ohanian"],
  "Compact Disc": ["Sony"],
  // === Medicine ===
  "Vaccination": ["John Fewster"],
  "Pacemaker": ["Ake Senning", "Wilson Greatbatch"],
  "Insulin": ["Charles Best", "James Collip", "John Macleod"],
  "Penicillin": ["Howard Florey", "Ernst Chain"],
  "CRISPR Gene Editing": ["Emmanuelle Charpentier"],
  "Laser Eye Surgery": ["Rangaswamy Srinivasan"],
  "MRI Scanner": ["Paul Lauterbur", "Peter Mansfield"],
  "CT Scanner": ["Allan Cormack"],
  "Pulse Oximeter": ["Michio Kishi"],
  "Ultrasound Imaging": ["Tom Brown", "John MacVicar"],
  "Iron Lung": ["Louis Agassiz Shaw Jr."],
  "CPR Technique": ["William Kouwenhoven", "James Jude", "Guy Knickerbocker", "James Elam"],
  "Anesthesia": ["Crawford Long"],
  "Aspirin": ["Arthur Eichengrun"],
  "Syringe": ["Alexander Wood"],
  "Contraceptive Pill": ["John Rock", "Carl Djerassi", "Min-Chueh Chang", "Margaret Sanger", "Katharine McCormick"],
  "Artificial Heart": ["Willem Kolff", "William DeVries"],
  "Gene Therapy": ["Michael Blaese"],
  "Dialysis Machine": ["Hendrik Berk"],
  "Ibuprofen": ["John Nicholson"],
  "Chemotherapy": ["Louis Goodman"],
  "IVF": ["Patrick Steptoe", "Jean Purdy"],
  // === Computing ===
  "Transistor": ["Walter Brattain", "William Shockley"],
  "Microprocessor": ["Federico Faggin", "Stanley Mazor"],
  "Integrated Circuit": ["Robert Noyce"],
  "Computer": ["J. Presper Eckert", "Tommy Flowers"],
  "Hard Disk Drive": ["Reynold B. Johnson"],
  "Mouse": ["Bill English"],
  "Floppy Disk": ["Alan Shugart"],
  "Webcam": ["Paul Jardetzky"],
  "Spreadsheet Software": ["Bob Frankston"],
  "Barcode": ["Bernard Silver"],
  "USB Flash Drive": ["Amir Ban", "Oron Ogdan"],
  "Video Game Console": ["Bill Harrison", "Bill Rusch"],
  "CNC Machine": ["Frank Stulen"],
  "MIDI": ["Ikutaro Kakehashi"],
  // === Energy ===
  "Incandescent Light Bulb": ["Joseph Swan"],
  "Nuclear Reactor": ["Leo Szilard"],
  "Lithium-Ion Battery": ["John Goodenough", "M. Stanley Whittingham"],
  "Dynamo": ["Michael Faraday"],
  "Leyden Jar": ["Ewald Georg von Kleist"],
  "Photovoltaic Panel": ["Edmond Becquerel"],
  "Solar Cell": ["Daryl Chapin", "Calvin Fuller", "Gerald Pearson"],
  "Steam Engine": ["Thomas Savery", "James Watt"],
  "Transformer": ["Miksa Deri", "Karoly Zipernowsky"],
  "Rechargeable Battery": ["Gaston Plante"],
  // === Transport ===
  "Automobile": ["Gottlieb Daimler"],
  "Motorcycle": ["Wilhelm Maybach"],
  "Helicopter": ["Heinrich Focke"],
  "Jet Engine": ["Hans von Ohain"],
  "Steamboat": ["John Fitch"],
  "Pneumatic Tire": ["Robert Thomson"],
  "Electric Car": ["Robert Anderson"],
  "Snowmobile": ["Carl Eliason"],
  "Rickshaw": ["Suzuki Tokujiro", "Takayama Kosuke"],
  "Anti-lock Brakes": ["Dunlop", "Jensen Motors"],
  // === Warfare ===
  "Atomic Bomb": ["Leo Szilard", "Enrico Fermi", "Leslie Groves"],
  "Sonar": ["Paul Langevin", "Robert Boyle"],
  "Torpedo": ["Giovanni Luppis"],
  "Tank": ["William Tritton", "Walter Wilson", "Ernest Swinton"],
  "Stealth Aircraft": ["Ben Rich", "Denys Overholser"],
  "Kevlar Body Armor": [],
  // === Science ===
  "Periodic Table": ["Lothar Meyer"],
  "Richter Scale": ["Beno Gutenberg"],
  "Laser": ["Charles Townes", "Arthur Schawlow", "Gordon Gould"],
  "Photography": ["Louis Daguerre"],
  "Telescope": ["Zacharias Janssen", "Jacob Metius"],
  "Stroboscope": ["Joseph Plateau"],
  "Sextant": ["Thomas Godfrey"],
  "Atomic Clock": ["Jack Parry"],
  // === Construction ===
  "Bessemer Steel Process": ["William Kelly"],
  "Reinforced Concrete": ["William Wilkinson", "Joseph Monier"],
  "Geodesic Dome": ["Walter Bauersfeld"],
  "Stainless Steel": ["Benno Strauss", "Eduard Maurer"],
  // === Domestic ===
  "Sewing Machine": ["Barthelemy Thimonnier", "Isaac Singer"],
  "Zipper": ["Gideon Sundback"],
  "Flush Toilet": ["Alexander Cumming"],
  "Vacuum Cleaner": [],
  "Post-It Note": ["Art Fry"],
  "Bubble Wrap": ["Marc Chavannes"],
  "Electric Razor": ["Johann Bruecker"],
  // === Agriculture ===
  "Seed Drill": ["Camillo Torello"],
  "Mechanical Reaper": ["Obed Hussey"],
  "Synthetic Fertilizer": ["Carl Bosch", "Robert Le Rossignol"],
  "Cornflakes": ["Will Keith Kellogg"],
  // === Food & Drink ===
  "Energy Drink": ["Chaleo Yoovidhya"],
  "Worcestershire Sauce": ["William Henry Perrins"],
  "K-Cup Coffee Pod": ["Peter Dragone"],
  // === Recreation ===
  "Dungeons and Dragons": ["Dave Arneson"],
  "Trivial Pursuit": ["Scott Abbott"],
  "Hula Hoop": ["Richard Knerr"],
  "Monopoly": ["Elizabeth Magie"],
  "Scuba Diving Equipment": ["Emile Gagnan"],
  // === Clothing ===
  "Blue Jeans": ["Jacob Davis"],
  // === Electronics ===
  "OLED Display": ["Steven Van Slyke"],
  "Plasma Display": ["H. Gene Slottow", "Robert Willson"],
  "VHS Videocassette": ["Shizuo Takano", "Yuma Shiraishi"],
  "Pong": ["Allan Alcorn", "Nolan Bushnell"],
  "Electric Guitar": ["Adolph Rickenbacker", "Paul Barth"],
  "Optical Mouse": ["Richard Lyon"],
  // === Industrial ===
  "Assembly Line": ["Ransom Olds"],
  // === Other ===
  "PayPal": ["Max Levchin", "Luke Nosek", "Elon Musk"],
  "Computer Virus": ["Basit Farooq Alvi"],
  "MP3 Format": ["Bernhard Grill", "Juergen Herre"],
  "Credit Card": ["Ralph Schneider"],
  "ATM": ["Luther George Simjian"],
  "Tape Recorder": ["Valdemar Poulsen"],
  "Loudspeaker": ["Edward Kellogg"],
  "Microphone": ["David Edward Hughes", "Thomas Edison"],
  // === Space ===
  "James Webb Space Telescope": ["ESA", "CSA"],
  "Hubble Space Telescope": ["ESA", "Lyman Spitzer"],
  "GPS Navigation": ["Bradford Parkinson", "Roger Easton", "Ivan Getting"]
});

// ====== YEAR RANGES ======
// For inventions where a range of years is historically valid.
// [startYear, endYear] — any guess within this range counts as correct.
// Negative years = BCE.
var _yearRanges = _resolveByName({
  // Wide ranges (genuinely uncertain ancient dates)
  "Fish Farming": [-8000, -2000],
  "Battering Ram": [-2500, -900],
  "Prosthetic Limb": [-1500, -710],
  "Crossbow": [-700, -600],
  "Crane": [-700, -515],
  "Gunpowder": [808, 850],
  "Hand Grenade": [1000, 1044],
  // Medium ranges (development span or disputed dates)
  "Printing Press": [1440, 1455],
  "Microscope": [1590, 1600],
  "35mm Film Camera": [1913, 1925],
  "Pencil": [1564, 1565],
  "Safety Matches": [1844, 1853],
  "Hovercraft": [1955, 1959],
  "Taser": [1969, 1974],
  "Desk Lamp": [1932, 1934],
  "Tape Recorder": [1928, 1935],
  "Mouse": [1964, 1968],
  "Video Game Console": [1966, 1972],
  "Diesel Engine": [1893, 1897],
  "Photo Booth": [1925, 1926],
  "Grain Elevator": [1842, 1843],
  "VHS Videocassette": [1971, 1976],
  "Food Processor": [1963, 1971],
  "Carbon Fiber": [1958, 1964],
  "Polyethylene": [1933, 1939],
  "Stapler": [1866, 1879],
  "Electric Razor": [1928, 1931],
  "Floppy Disk": [1967, 1971],
  "Holography": [1947, 1948],
  "Synthetic Fertilizer": [1909, 1913],
  "Velcro": [1941, 1955],
  "Post-It Note": [1968, 1980],
  "Zipper": [1893, 1917],
  "Photocopier": [1938, 1959],
  "Laser Eye Surgery": [1981, 1987],
  "mRNA Vaccine": [2005, 2020],
  "3D-Printed Prosthetics": [2008, 2012],
  // Announce-to-release gaps (<=3yr rule: accept both dates)
  "Apple Watch": [2014, 2015],
  "Oculus VR Headset": [2012, 2013],
  "Raspberry Pi": [2011, 2012],
  "Fitness Tracker": [2008, 2009],         // Fitbit announced 2008, shipped 2009
  "PlayStation": [1991, 1994],
  "Xbox": [2000, 2001],
  "DVD": [1995, 1996],
  "Android OS": [2007, 2008],
  "Windows OS": [1983, 1985],              // announced Nov 1983, released Nov 1985
  "Spotify": [2006, 2008],                 // founded 2006, launched Oct 2008
  "Google Search": [1996, 1998],            // project started 1996, incorporated 1998
  "PayPal": [1998, 1999],                  // Confinity founded 1998, PayPal product 1999
  "Segway": [2001, 2002],
  "Polaroid Camera": [1947, 1948],          // demonstrated Feb 1947, sold Nov 1948
  "Electric Cigarette": [2003, 2004],
  "Noise-Canceling Headphones": [1986, 1989],
  "Super Soaker": [1989, 1990],
  "Smartwatch": [2012, 2013],               // Pebble Kickstarter 2012, shipped 2013
  // Off-by-1 (sources disagree, both dates defensible)
  "Microphone": [1876, 1877],
  "Speedboat": [1902, 1903],
  "Computer": [1945, 1946],                // ENIAC completed late 1945, dedicated Feb 1946
  "RAM Memory": [1947, 1948],              // Williams tube developed 1947, operational 1948
  "Particle Accelerator": [1930, 1931],
  "I-Beam": [1849, 1850],
  "Three Ring Binder": [1886, 1887],
  "Stent": [1986, 1987],
  "Monopoly": [1935, 1936],               // patented 1935, commercially sold 1936
  "Minecraft": [2010, 2011],               // alpha 2010, full release 2011
  // Both-valid ranges (sources disagree, both dates defensible)
  "Suspension Bridge": [1779, 1826],        // earlier bridges existed, Telford's Menai 1826
  "Superglue": [1942, 1951],                // discovered 1942, rediscovered 1951
  "Ice Cream Cone": [1896, 1904],           // Marchiony patent 1896, 1904 World's Fair
  "Window Blinds": [1764, 1769],
  "Toaster": [1893, 1909],                  // Crompton 1893, GE D-12 1909
  "Paper Napkin": [1887, 1930],             // imported 1887, mass commercial 1930s
  "Pepsi-Cola": [1893, 1898],               // Brad's Drink 1893, renamed Pepsi-Cola 1898
  "Drone (Military UAV)": [1994, 2001],     // Predator first flight 1994, combat ops 2001
  "Trolleybus": [1882, 1901],                // Siemens Elektromote 1882, modern trolleybus 1901
  "Electric Oven": [1896, 1897],             // Hadaway patent filed 1896, granted 1897
  "Night Vision Goggles": [1939, 1960],     // Gen 0 (AEG/Germany 1939) to Gen 1 (passive, 1960s)
  "Jackhammer": [1849, 1894],               // Couch pneumatic drill 1849, King modern jackhammer 1894
  "Fluoride Toothpaste": [1914, 1955],      // fluoride added 1914, Crest stannous fluoride 1955
  "Cruise Missile": [1944, 1957],            // V-1 (1944) to Regulus operational (1954-1957)
  "Center Pivot Irrigation": [1947, 1952],  // prototype 1947, patent granted 1952
  "Corrugated Cardboard": [1856, 1871],     // corrugated paper 1856, packaging patent 1871
  "Answering Machine": [1935, 1949]         // Muller's 1935 device, later improved models
});

// Flag: which ranges are announce-to-release vs historical uncertainty
var _rangeType = _resolveByName({
  // announce-release gaps
  "Apple Watch": "announce-release",
  "Oculus VR Headset": "announce-release",
  "Raspberry Pi": "announce-release",
  "Fitness Tracker": "announce-release",
  "PlayStation": "announce-release",
  "Xbox": "announce-release",
  "DVD": "announce-release",
  "Android OS": "announce-release",
  "Windows OS": "announce-release",
  "Spotify": "announce-release",
  "Google Search": "announce-release",
  "PayPal": "announce-release",
  "Segway": "announce-release",
  "Polaroid Camera": "announce-release",
  "Electric Cigarette": "announce-release",
  "Noise-Canceling Headphones": "announce-release",
  "Super Soaker": "announce-release",
  "Smartwatch": "announce-release",
  // historical uncertainty
  "Fish Farming": "historical",
  "Battering Ram": "historical",
  "Prosthetic Limb": "historical",
  "Crossbow": "historical",
  "Crane": "historical",
  "Gunpowder": "historical",
  "Hand Grenade": "historical",
  // development span (prototype to commercial)
  "Printing Press": "development",
  "Microscope": "development",
  "35mm Film Camera": "development",
  "Velcro": "development",
  "Zipper": "development",
  "Photocopier": "development",
  "mRNA Vaccine": "development",
  "Post-It Note": "development",
  // off-by-1 (source disagreement — both dates valid)
  "Microphone": "off-by-1",
  "Speedboat": "off-by-1",
  "Computer": "off-by-1",
  "RAM Memory": "off-by-1",
  "Particle Accelerator": "off-by-1",
  "I-Beam": "off-by-1",
  "Three Ring Binder": "off-by-1",
  "Stent": "off-by-1",
  "Monopoly": "off-by-1",
  "Minecraft": "off-by-1"
});

// ====== SOURCE LINKS ======
// Britannica links per invention, loaded from a separate file if available.
// Shown on the result card after the game.
var _sources = {};
// Sources are loaded from js/data-sources.js (auto-generated)

// ====== INVENTOR ORIGIN NOTES ======
// For inventions where the inventor was born in a different country than where they
// invented. Shown as a note on the result card.
var _inventorOrigin = _resolveByName({
  "mRNA Vaccine": {born:"Hungary", inventedIn:"USA", note:"Katalin Kariko was born in Hungary but did her groundbreaking mRNA research at the University of Pennsylvania, USA"},
  "Outboard Motor": {born:"Norway", inventedIn:"USA", note:"Ole Evinrude was born near Oslo, Norway but emigrated to the US as a child and invented the outboard motor in Milwaukee"},
  "RAM Memory": {born:"England", inventedIn:"England", note:"Freddie Williams and Tom Kilburn developed RAM at the University of Manchester, England — not in the USA"},
  "Refrigerator": {born:"USA", inventedIn:"England", note:"Jacob Perkins was born in Massachusetts but moved to London in 1819 and patented the refrigerator there"},
  "Holography": {born:"Hungary", inventedIn:"England", note:"Dennis Gabor fled Hungary in 1933 and invented holography while working in Rugby, England"},
  "Photo Booth": {born:"Russia", inventedIn:"USA", note:"Anatol Josepho fled Russia after the 1917 Revolution and invented the photo booth in New York City"},
  "Microphone": {born:"Germany", inventedIn:"USA", note:"Emile Berliner was born in Hanover, Germany but invented the microphone in Washington, D.C."},
  "Cannon": {born:"China", inventedIn:"Italy", note:"Cannons originated in China but the earliest European documentation is from Florence, Italy in 1326"},
  "Torpedo": {born:"England", inventedIn:"Croatia", note:"Robert Whitehead was English but invented the torpedo in Fiume (now Rijeka, Croatia) in Austria-Hungary"},
  "ATM": {born:"Scotland", inventedIn:"England", note:"John Shepherd-Barron was born in Scotland but the first ATM was installed in Enfield, North London"},
  "Steam Locomotive": {born:"England", inventedIn:"Wales", note:"Richard Trevithick was Cornish (England) but the first steam locomotive ran at Penydarren, Merthyr Tydfil, Wales"},
  "Antiseptic Surgery": {born:"England", inventedIn:"Scotland", note:"Joseph Lister was born in Essex, England but pioneered antiseptic surgery at Glasgow Royal Infirmary, Scotland"},
  "World Wide Web": {born:"England", inventedIn:"Switzerland", note:"Tim Berners-Lee is English but invented the Web at CERN in Geneva, Switzerland"},
  "Telephone": {born:"Scotland", inventedIn:"USA", note:"Alexander Graham Bell was born in Edinburgh, Scotland but invented the telephone in Boston, USA"},
  "Television": {born:"Scotland", inventedIn:"England", note:"John Logie Baird was born in Scotland but demonstrated mechanical TV in London. Farnsworth (USA) built the first electronic TV."},
  "Radar": {born:"Scotland", inventedIn:"England", note:"Robert Watson-Watt was born in Brechin, Scotland but developed radar for the British Air Ministry in England"},
  "Penicillin": {born:"Scotland", inventedIn:"England", note:"Alexander Fleming was born in Ayrshire, Scotland but discovered penicillin at St Mary's Hospital, London"},
  "Pneumatic Tire": {born:"Scotland", inventedIn:"Northern Ireland", note:"John Boyd Dunlop was born in Scotland but developed the pneumatic tire in Belfast, Ireland"}
});

// ====== AUGMENT _ip WITH ALT INVENTORS ======
// ensures all alt inventors exist in the people list for multiple-choice generation
(function() {
  var existingNames = {};
  for (var i = 0; i < _ip.length; i++) {
    existingNames[_ip[i].name.toLowerCase()] = true;
    for (var j = 0; j < _ip[i].a.length; j++) {
      existingNames[_ip[i].a[j].toLowerCase()] = true;
    }
  }
  for (var idx in _altInventors) {
    if (!_altInventors.hasOwnProperty(idx)) continue;
    var alts = _altInventors[idx];
    for (var i = 0; i < alts.length; i++) {
      if (!existingNames[alts[i].toLowerCase()]) {
        _ip.push({ name: alts[i], a: [alts[i]] });
        existingNames[alts[i].toLowerCase()] = true;
      }
    }
  }
})();
