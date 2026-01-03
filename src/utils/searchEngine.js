/**
 * Advanced Search Engine Utility
 * Implements fuzzy search, text normalization, phonetic matching,
 * synonyms, tokenization, and weighted field search using Fuse.js
 */

import Fuse from "fuse.js";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Stop words to filter out (common words that add noise to search)
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "for", "in", "on", "of", "at", "by",
  "with", "is", "are", "was", "were", "be", "have",
  "has", "had", "would", "should", "could", "we", "he", "she",
  "may", "might", "can", "it", "its", "i", "am", "my", "me", "myself",
  "need", "want", "require", "requirements", "requirement", "required", "needs", "wants",
  "looking", "for", "please", "can", "could", "would", "any", "some", "anyone", "someone", "anybody", "somebody"
]);

// Domain-specific synonyms for better search matching
export const SYNONYMS = {
  // ===== LOCATIONS & MICRO-MARKETS =====
  bangalore: ["bengaluru", "blr", "bangaluru", "banglore", "bengalore", "karnataka", "electronic city", "whitefield", "koramangala", "indiranagar"],
  delhi: ["new delhi", "ncr", "dilli", "dilhi", "dwarka", "rohini", "south delhi", "gurgaon", "noida", "ghaziabad", "faridabad"],
  mumbai: ["bombay", "mumbai city", "bombai", "mumabi", "navimumbai", "thane", "andheri", "bandra", "borivali", "dadar", "powai"],
  chennai: ["madras", "chenai", "channai", "tn", "adyar", "velachery", "tambaram"],
  kolkata: ["calcutta", "kolkatta", "wb"],
  hyderabad: ["hyd", "secunderabad", "hydrabad", "hyderbad",],
  pune: ["poona", "pcmc", "hinjewadi", "baner", "wakad", "viman nagar"],
  ahmedabad: ["amdavad", "ahmdabad", "gujarat",],
  gurgaon: ["gurugram", "gurgon"],
  noida: ["greater noida", "noida extension"],
  chandigarh: ["tricity", "mohali", "panchkula", "zirakpur"],

  // ===== TRANSACTIONAL & INTENT =====
  buy: ["purchase", "looking for", "wanted", "need", "chahiye", "khareedna", "lele", "requirement", "buyer", "procure"],
  sale: ["selling", "resale", "available", "bechna", "stock", "deal", "seller", "inventory", "put up for sale"],
  rent: ["rental", "lease", "for rent", "kiraya", "bhaada", "occupancy", "let out", "accommodation", "on rent"],
  exchange: ["swap", "old for new", "trade", "barter", "exchange offer", "upgrade", "replacement"],
  free: ["giveaway", "muft", "fokat", "zero cost", "donation", "charity", "complimentary", "nil"],
  urgent: ["emergency", "asap", "jaldi", "turant", "immediate", "fast track", "quick", "priority", "right away"],
  price: ["rate", "cost", "amount", "daam", "kimat", "budget", "pricing", "value", "quote", "estimation"],
  cheap: ["affordable", "budget", "low cost", "sasta", "discount", "offer", "economy", "pocket friendly", "low price"],
  expensive: ["premium", "luxury", "high end", "costly", "mehnga", "exclusive", "brand", "posh", "expensive"],
  negotiable: ["nego", "discussion possible", "bargain", "flexible price", "little bit nego", "price on call"],

  // ===== CONDITION & AGE =====
  secondhand: ["used", "pre owned", "purana", "old", "second hand", "2nd hand", "pre-loved", "working condition"],
  new: ["brand new", "sealed", "unused", "box piece", "latest", "naya", "fresh", "unopened", "current year"],
  scrap: ["junk", "raddi", "broken", "parts only", "kabaad", "waste", "damage", "non working", "bhangar"],
  refurbished: ["renewed", "reconditioned", "certified", "repaired", "qc passed", "factory seconds"],

  // ===== ELECTRONICS & GADGETS (GENERIC + BRANDS) =====
  mobile: ["phone", "smartphone", "cellphone", "iphone", "android", "handset", "ios", "mi", "samsung", "oneplus", "vivo", "oppo"],
  laptop: ["computer", "pc", "desktop", "macbook", "notebook", "workstation", "dell", "hp", "lenovo", "asus"],
  tablet: ["ipad", "tab", "kindle", "surface"],
  appliance: ["fridge", "refrigerator", "washing machine", "ac", "microwave", "tv", "led", "cooler", "deep freezer", "oven", "chimney"],
  camera: ["dslr", "lens", "digicam", "cctv", "gopro", "photography gear", "tripod"],
  gadgets: ["smartwatch", "earbuds", "headphones", "speakers", "bluetooth", "airpods", "powerbank", "charger"],
  accessory: ["accessories", "accessories for phone", "phone accessories", "accessories for camera", "camera accessories"],


  // ===== VEHICLES & SPARES =====
  bike: ["scooter", "two wheeler", "motorcycle", "scooty", "activa", "bullet", "bikey", "pulsar", "royal enfield", "yamaha"],
  car: ["four wheeler", "suv", "sedan", "hatchback", "jeep", "luxury car", "gaadi", "swift", "wagonr", "fortuner", "creta"],
  auto: ["auto rickshaw", "auto wala", "tuk tuk", "three wheeler", "ape"],
  truck: ["tempo", "lorry", "loading gaadi", "pickup", "tata ace", "chota hathi", "dost", "bolero pickup"],
  ev: ["electric vehicle", "electric scooter", "electric car", "ola bike", "ather", "tvs iqube", "revolt"],
  cng: ["gas kit", "cng fitted", "green fuel", "sequential kit"],
  spare: ["spare parts", "parts", "accessories", "accessories for car", "car accessories", "accessories for bike", "bike accessories"],
  land: ["plot", "site", "ground", "khata", "agricultural land", "farmhouse", "corner plot", "residential land"],

  // ===== REAL ESTATE & PG =====
  home: ["house", "apartment", "flat", "makaan", "villa", "kothi", "bungalow", "residence", "duplex", "triplex"],
  pg: ["paying guest", "hostel", "accommodation", "shared room", "co-living", "bachelor room", "working men pg", "working women pg"],
  room: ["rooms", "bedroom", "bhk", "kholii", "single room", "hall kitchen", "1bhk", "2bhk", "3bhk"],
  office: ["commercial space", "shop", "dukan", "coworking", "warehouse", "godown", "factory", "industrial shed", "showroom"],
  owner: ["direct owner", "no broker", "landlord", "malik", "individual", "direct party", "by owner"],
  broker: ["agent", "property dealer", "consultant", "middleman", "real estate consultant", "dealer"],

  // ===== JOBS & WORK =====
  job: ["jobs", "work", "career", "employment", "role", "vacancy", "naukri", "kaam", "opening", "recruitment", "staff", "staffing"],
  fresher: ["freshers", "entry level", "junior", "no experience", "graduate", "undergraduate", "10th pass", "12th pass"],
  experienced: ["expert", "professional", "skilled", "senior", "lead", "manager", "team lead", "specialist"],
  parttime: ["part time", "temporary", "side hustle", "weekend job", "extra income", "flexible hours"],
  fulltime: ["full time", "permanent", "regular job"],
  freelance: ["remote", "work from home", "wfh", "gig", "consultant", "contractor", "freelancer", "online job"],

  // ===== HOME SERVICES & SKILLED LABOR =====
  plumber: ["plumbing", "tap repair", "water work", "nal wala", "leakage", "pipeline", "tank cleaning"],
  electrician: ["electrical", "wiring", "bijli wala", "ac repair", "fan repair", "current", "inverter repair", "motor winding"],
  carpenter: ["woodwork", "furniture", "mistry", "interior", "sofa repair", "bed maker", "modular kitchen"],
  painter: ["painting", "whitewash", "putty", "wall painter", "distemper", "polish", "texture painting"],
  cleaner: ["cleaning", "housekeeping", "maid", "helper", "safai", "bathroom cleaning", "deep cleaning", "sofa cleaning"],
  cook: ["chef", "home cook", "cook aunty", "khansama", "tiffin", "mess", " Maharaj"],
  driver: ["chauffeur", "cab driver", "taxi", "personal driver", "gaadi wala", "heavy driver", "commercial driver"],
  security: ["guard", "watchman", "chowkidar", "bouncers", "agency", "security services", "bodyguard"],
  beautician: ["parlour", "makeup artist", "salon", "waxing", "facial", "threading", "bridal makeup", "pedicure", "manicure"],
  pestcontrol: ["cockroach", "termite", "ants", "pest service", "rodent", "bed bug", "mosquito control"],
  laundry: ["dhobi", "dry cleaning", "washing machine", "press wala", "ironing", "steam press"],
  tutor: ["teacher", "coaching", "tuition", "classes", "home tuition", "professor", "online tutor", "subjects"],
  doctor: ["dr", "clinic", "hospital", "physician", "specialist", "medical", "dentist", "pediatrician"],
  mechanic: ["mechanic", "engineer", "repair", "maintenance", "auto mechanic", "car mechanic", "bike mechanic", "mechanical engineer"],
  caretaker: ["caregiver", "babysitter", "nanny", "child care", "elder care", "home help", "care taker", "baby sitter"],
  advisor: ["advisor", "consultant", "expert", "guide", "counsellor", "mentor", "coach", "trainer"],
  friend: ["friend", "mate", "companion", "partner", "acquaintance", " acquaintance", "frienemies"],
  iron: ["iron", "ironing", "press", "steam press", "dhobi", "dry cleaning"],
  washer: ["washer", "washing", "dry cleaning", "dhobi", "press wala", "ironing", "steam press", "laundry"],
  marketer: [" marketer", " advertising", " promotion", " branding", " marketing", " sales", " advertising", " promotion", " branding", " marketing", " sales"],
  seller: ["seller", "vendor", "merchant", "trader", "shopkeeper", "business", "enterprise", "company", "factory", "warehouse"],
  buyer: ["buyer", "customer", "consumer", "shopper", "retailer", "merchant", "trader", "shopkeeper", "business", "enterprise"],
  love: ["love", "relationship", "dating", "romance", "partner", "girlfriend", "boyfriend", "husband", "wife"],

  // ===== LOGISTICS & EVENTS =====
  packers: ["movers", "shifting", "relocation", "house shifting", "transporters", "luggage shifting", "tempo for shifting"],
  courier: ["parcel", "shipping", "speed post", "cargo", "delivery", "transport service"],
  photographer: ["videographer", "cameraman", "photo shoot", "pre wedding", "editor", "album", "drone"],
  catering: ["food service", "halwai", "party food", "event catering", "buffet", "dinner service"],
  decoration: ["tent house", "flower decoration", "stage setup", "lighting", "event", "balloon decoration", "birthday setup"],

  // ===== PETS & ANIMALS =====
  dog: ["dogs", "puppy", "canine", "doggo", "indie", "pet", "labrador", "german shepherd", "golden retriever"],
  cat: ["cats", "kitten", "feline", "kitty", "persian cat"],
  vet: ["veterinary", "animal doctor", "pet clinic", "animal hospital"],
  petfood: ["dog food", "cat food", "pedigree", "royal canin"],

  // ===== PROFESSIONAL SERVICES =====
  legal: ["lawyer", "advocate", "vakil", "notary", "affidavit", "court", "legal advice", "property lawyer"],
  tax: ["gst filling", "income tax", "itr", "audit", "ca", "accountant", "tally", "bookkeeping"],
  insurance: ["car insurance", "bike insurance", "lic", "policy renewal", "bima", "health insurance"],

  // ===== CLOTHING & FASHION =====
  clothes: ["clothing", "garments", "kapde", "fashion", "apparel", "wear"],
  menswear: ["shirt", "tshirt", "jeans", "trouser", "suit", "blazer"],
  womenswear: ["saree", "kurti", "suit", "lehenga", "top", "dress", "gown"],
  footwear: ["shoes", "sneakers", "sandals", "slippers", "boots", "heels"],
  dating: ["date", "girlfriend", "boyfriend", "husband", "wife", "couple", "dating", "relationship"],

  // ===== GENERAL SLANG & VERNACULAR =====
  nearby: ["near me", "around me", "close by", "paas mein", "local", "area", "within 5km", "nearby me"],
  contact: ["mobile number", "whatsapp", "call", "phone", "details", "contact info", "number", "puchna"],
  repair: ["service", "fixing", "broken", "maintenance", "theek", "servicing", "mending", "overhaul"],
  grocery: ["kirana", "ration", "provision store", "supermarket", "dukan"],
  medicine: ["chemist", "pharma", "dawa", "dawaii", "pharmacy", "medical store"],
  furniture: ["sofa", "bed", "table", "chair", "almari", "wardrobe", "dining table"],
};


// ============================================================================
// TEXT NORMALIZATION
// ============================================================================

/**
 * Normalize text: lowercase, remove accents/diacritics, trim, collapse spaces
 * ENHANCED: Space-insensitive normalization for matching "plu mber" with "plumber"
 * @param {string} text - Input text to normalize
 * @returns {string} Normalized text
 */
export function normalizeText(text = "") {
  if (!text) return "";

  return text
    .toString()
    .normalize("NFD") // Decompose combined characters
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .replace(/[^\w\s]/g, " "); // Replace special chars with space
}

/**
 * ENHANCED: Space-insensitive text normalization
 * Removes ALL spaces for fuzzy matching "plu mber" with "plumber"
 * @param {string} text - Input text
 * @returns {string} Text with spaces removed
 */
export function normalizeSpaceInsensitive(text = "") {
  if (!text) return "";

  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // Remove ALL non-alphanumeric (including spaces)
}

/**
 * Remove accents and diacritics from text
 * @param {string} text - Input text
 * @returns {string} Text without accents
 */
export function removeAccents(text = "") {
  if (!text) return "";

  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ============================================================================
// TOKENIZATION
// ============================================================================

/**
 * Tokenize text into individual words, filtering stop words
 * @param {string} text - Input text to tokenize
 * @returns {Array<string>} Array of tokens
 */
export function tokenize(text = "") {
  if (!text) return [];

  const normalized = normalizeText(text);
  const tokens = normalized
    .split(/[^a-z0-9]+/i)
    .filter(token => token && token.length > 1 && !STOP_WORDS.has(token));

  return tokens;
}

/**
 * ENHANCED: Generate advanced n-grams from text for powerful character-level matching
 * Supports multiple n-gram sizes (2, 3, 4) for maximum coverage
 * Handles both normal text and space-removed text for comprehensive matching
 * @param {string} text - Input text
 * @param {number} n - N-gram size (default: 3)
 * @returns {Array<string>} Array of n-grams with enhanced coverage
 */
export function generateNGrams(text = "", n = 3) {
  if (!text) return [];

  const normalized = normalizeText(text);
  const spaceInsensitive = normalizeSpaceInsensitive(text);
  const ngrams = new Set(); // Use Set to avoid duplicates

  // Generate n-grams for normal text (with spaces)
  if (normalized.length >= 2) {
    for (let i = 0; i <= normalized.length - 2; i++) { // Start with 2-grams for better coverage
      ngrams.add(normalized.substring(i, i + 2));
    }
  }

  if (normalized.length >= 3) {
    for (let i = 0; i <= normalized.length - 3; i++) {
      ngrams.add(normalized.substring(i, i + 3));
    }
  }

  if (normalized.length >= 4) {
    for (let i = 0; i <= normalized.length - 4; i++) {
      ngrams.add(normalized.substring(i, i + 4));
    }
  }

  // ENHANCED: Generate n-grams for space-removed text
  // This allows "plu mber" to match "plumber" via n-grams
  if (spaceInsensitive.length >= 2) {
    for (let i = 0; i <= spaceInsensitive.length - 2; i++) {
      ngrams.add(spaceInsensitive.substring(i, i + 2));
    }
  }

  if (spaceInsensitive.length >= 3) {
    for (let i = 0; i <= spaceInsensitive.length - 3; i++) {
      ngrams.add(spaceInsensitive.substring(i, i + 3));
    }
  }

  if (spaceInsensitive.length >= 4) {
    for (let i = 0; i <= spaceInsensitive.length - 4; i++) {
      ngrams.add(spaceInsensitive.substring(i, i + 4));
    }
  }



  return Array.from(ngrams);
}

/**
 * Generate prefix tokens for partial word matching
 * ENHANCED: Support single-character prefixes for "m", "my" searches
 * @param {string} text - Input text
 * @param {number} minLength - Minimum prefix length (default: 2)
 * @returns {Array<string>} Array of prefixes
 */
export function generatePrefixes(text = "", minLength = 2) {
  if (!text) return [];

  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/).filter(w => w && !STOP_WORDS.has(w)); // Split by whitespace and filter stop words
  const prefixes = new Set(); // Use Set to avoid duplicates

  words.forEach(word => {
    // Generate prefixes from minLength up to full word length (max 8 chars)
    for (let i = minLength; i <= Math.min(word.length, 8); i++) {
      prefixes.add(word.slice(0, i));
    }
  });

  return Array.from(prefixes);
}

// ============================================================================
// PHONETIC MATCHING
// ============================================================================

/**
 * Generate Soundex code for phonetic matching
 * Soundex is a phonetic algorithm that indexes names by sound
 * @param {string} text - Input text
 * @returns {string} Soundex code (4 characters)
 */
export function soundex(text = "") {
  if (!text) return "";

  const normalized = normalizeText(text).replace(/[^a-z]/g, "");
  if (!normalized) return "";

  const firstLetter = normalized[0].toUpperCase();

  // Soundex mapping
  const map = {
    b: "1", f: "1", p: "1", v: "1",
    c: "2", g: "2", j: "2", k: "2", q: "2", s: "2", x: "2", z: "2",
    d: "3", t: "3",
    l: "4",
    m: "5", n: "5",
    r: "6",
  };

  let code = firstLetter;
  let lastCode = map[firstLetter.toLowerCase()] || "";

  for (let i = 1; i < normalized.length && code.length < 4; i++) {
    const char = normalized[i];
    const currentCode = map[char] || "";

    if (currentCode && currentCode !== lastCode) {
      code += currentCode;
      lastCode = currentCode;
    } else if (!currentCode) {
      lastCode = "";
    }
  }

  return (code + "000").slice(0, 4);
}

/**
 * ENHANCED: Generate metaphone code (phonetic algorithm)
 * Improved with additional phonetic rules for better matching
 * @param {string} text - Input text
 * @returns {string} Metaphone code
 */
export function metaphone(text = "") {
  if (!text) return "";

  let metaphone = normalizeText(text).replace(/[^a-z]/g, "").toUpperCase();
  if (!metaphone) return "";

  // ENHANCED: Apply comprehensive metaphone rules
  // Initial consonant combinations
  metaphone = metaphone.replace(/^KN/, "N");
  metaphone = metaphone.replace(/^GN/, "N");
  metaphone = metaphone.replace(/^PN/, "N");
  metaphone = metaphone.replace(/^AE/, "E");
  metaphone = metaphone.replace(/^WR/, "R");
  metaphone = metaphone.replace(/^X/, "S");

  // H after vowel
  metaphone = metaphone.replace(/([AEIOU])H/g, "$1");

  // Common patterns
  metaphone = metaphone.replace(/MB$/, "M");
  metaphone = metaphone.replace(/PH/, "F");
  metaphone = metaphone.replace(/TCH/, "CH");
  metaphone = metaphone.replace(/SH/, "X");
  metaphone = metaphone.replace(/TH/, "0"); // 0 represents "th" sound
  metaphone = metaphone.replace(/CH/, "X");

  // CK becomes K
  metaphone = metaphone.replace(/CK/, "K");

  // C rules
  metaphone = metaphone.replace(/C([IEY])/g, "S$1");
  metaphone = metaphone.replace(/C/g, "K");

  // DGE/DGI/DGY becomes J
  metaphone = metaphone.replace(/DG([EIY])/g, "J$1");

  // GH at end or before consonant becomes silent
  metaphone = metaphone.replace(/GH($|[^AEIOU])/g, "$1");

  // G before I, E, Y becomes J
  metaphone = metaphone.replace(/G([IEY])/g, "J$1");

  // Double letters become single
  metaphone = metaphone.replace(/(.)\1+/g, "$1");

  // Remove vowels (but keep first if it's the first character)
  const firstChar = metaphone[0];
  metaphone = metaphone.substring(1).replace(/[AEIOU]/g, "");
  metaphone = firstChar + metaphone;

  return metaphone.slice(0, 6); // Increased from 4 to 6 for better accuracy
}

/**
 * IMPLEMENT DOUBLE METAPHONE ALGORITHM
 * Generates both primary and secondary phonetic encodings for enhanced matching
 * Handles multiple possible pronunciations for better accuracy
 * @param {string} text - Input text
 * @returns {Object} Object with primary and secondary metaphone codes
 */
export function doubleMetaphone(text = "") {
  if (!text) return { primary: "", secondary: "" };

  const original = text.toUpperCase();
  let primary = "";
  let secondary = "";
  let current = 0;
  const length = original.length;

  // Add buffer characters to avoid boundary checks
  const input = " " + original + "  ";

  // Slavo-Germanic check
  const isSlavoGermanic = /W|K|CZ|WITZ/.test(original);

  // Process each character
  while (current < length) {
    const char = input[current + 1];

    switch (char) {
      case 'A': case 'E': case 'I': case 'O': case 'U': case 'Y':
        if (current === 0) {
          primary += 'A';
          secondary += 'A';
        }
        current++;
        break;

      case 'B':
        primary += 'P';
        secondary += 'P';
        if (input[current + 1] === 'B') current += 2;
        else current += 1;
        break;

      case 'Ç':
        primary += 'S';
        secondary += 'S';
        current += 1;
        break;

      case 'C':
        // Various C rules
        if (current > 1 && !isVowel(input[current]) &&
          areSlavoGermanic(input[current - 2]) &&
          input[current + 1] === 'H') {
          primary += 'K';
          secondary += 'K';
          current += 2;
        } else if (input[current + 1] === 'H') {
          if (current === 0) {
            if (input[current + 2] === 'A' || input[current + 2] === 'E' || input[current + 2] === 'I' || input[current + 2] === 'O' || input[current + 2] === 'U') {
              primary += 'K';
              secondary += 'K';
            } else {
              primary += 'X';
              secondary += 'K';
            }
            current += 2;
          } else {
            if (current === length - 1 && isVowel(input[current - 1])) {
              primary += 'K';
              secondary += 'K';
            } else if (input[current + 2] === 'L' || input[current + 2] === 'R' || input[current + 2] === 'N' || input[current + 2] === 'M' || input[current + 2] === 'B' || input[current + 2] === 'H' || input[current + 2] === 'F' || input[current + 2] === 'V' || input[current + 2] === 'W' || input[current + 2] === ' ' || input[current + 2] === 'Z') {
              primary += 'K';
              secondary += 'K';
            } else {
              primary += 'X';
              secondary += 'X';
            }
            current += 2;
          }
        } else if (input[current + 1] === 'Z') {
          primary += 'S';
          secondary += 'X';
          current += 2;
        } else if (input[current - 1] === 'C' && input[current + 1] !== 'H') {
          current += 1;
        } else if (input[current + 1] === 'C' && !(current === 1 && input[0] === 'M')) {
          if (input[current + 2] === 'I' || input[current + 2] === 'E' || input[current + 2] === 'Y') {
            primary += 'S';
            secondary += 'S';
            current += 3;
          } else {
            primary += 'K';
            secondary += 'K';
            current += 3;
          }
        } else if (input[current + 1] === 'K' || input[current + 1] === 'Q') {
          primary += 'K';
          secondary += 'K';
          if (input[current + 1] === 'K') current += 2;
          else current += 2;
        } else if (input[current + 1] === 'I' || input[current + 1] === 'E' || input[current + 1] === 'Y') {
          primary += 'S';
          secondary += 'S';
          current += 2;
        } else {
          primary += 'K';
          secondary += 'K';
          current += 1;
        }
        break;

      case 'D':
        if (input[current + 1] === 'G') {
          if (input[current + 2] === 'I' || input[current + 2] === 'E' || input[current + 2] === 'Y') {
            primary += 'J';
            secondary += 'J';
            current += 3;
          } else {
            primary += 'TK';
            secondary += 'TK';
            current += 2;
          }
        } else if (input[current + 1] === 'T') {
          primary += 'T';
          secondary += 'T';
          current += 2;
        } else {
          primary += 'T';
          secondary += 'T';
          current += 1;
        }
        break;

      case 'F':
        if (input[current + 1] === 'F') current += 2;
        else current += 1;
        primary += 'F';
        secondary += 'F';
        break;

      case 'G':
        if (input[current + 1] === 'H') {
          if (current > 0 && !isVowel(input[current - 1])) {
            primary += 'K';
            secondary += 'K';
            current += 2;
          } else if (current === 0) {
            if (input[current + 2] === 'I' || input[current + 2] === 'E' || input[current + 2] === 'Y') {
              primary += 'J';
              secondary += 'J';
            } else {
              primary += 'K';
              secondary += 'K';
            }
            current += 2;
          } else if (((current > 1 && input[current - 2] === 'B') || input[current - 2] === 'H' || input[current - 2] === 'D') ||
            ((current > 2 && input[current - 3] === 'B') || input[current - 3] === 'H' || input[current - 3] === 'D') ||
            ((current > 3 && input[current - 4] === 'B') || input[current - 4] === 'H')) {
            current += 2;
          } else {
            if (current > 2 && input[current - 1] === 'U' &&
              (input[current - 3] === 'C' || input[current - 3] === 'G' || input[current - 3] === 'L')) {
              primary += 'F';
              secondary += 'F';
            } else if (current > 0 && input[current - 1] !== 'N') {
              primary += 'K';
              secondary += 'K';
            }
            current += 2;
          }
        } else if (input[current + 1] === 'N') {
          if (current === length - 2 && isVowel(input[current - 1]) && !isSlavoGermanic) {
            primary += 'KN';
            secondary += 'N';
          } else {
            if (input[current + 2] !== 'E' && input[current + 2] !== 'Y' && input[current + 1] !== 'E' && input[current + 1] !== 'Y') {
              primary += 'N';
              secondary += 'KN';
            } else {
              primary += 'KN';
              secondary += 'KN';
            }
          }
          current += 2;
        } else if (input[current + 1] === 'N' && input[current + 2] === 'E' && input[current + 3] === 'D') {
          current += 4;
        } else {
          if (input[current + 1] === 'G') current += 2;
          else current += 1;
          primary += 'K';
          secondary += 'K';
        }
        break;

      case 'H':
        if ((current === 0 || isVowel(input[current - 1])) && isVowel(input[current + 1]) && current < length - 1) {
          primary += 'H';
          secondary += 'H';
          current += 2;
        } else {
          current += 1;
        }
        break;

      case 'J':
        if (current === 0 && input.substr(current + 1, 4) === 'OSE') {
          if (input[current + 4] === ' ' || input[current + 4] === 'A' || input[current + 4] === 'O') {
            primary += 'H';
            secondary += 'H';
          } else {
            primary += 'J';
            secondary += 'H';
          }
        } else if (current === length - 1) {
          primary += 'J';
          secondary += '';
        } else if (!isVowel(input[current - 1]) && input[current + 1] !== 'A' && input[current + 1] !== 'O') {
          primary += 'J';
          secondary += 'J';
        } else {
          primary += 'J';
          secondary += 'H';
        }
        if (input[current + 1] === 'J') current += 2;
        else current += 1;
        break;

      case 'K':
        if (input[current + 1] === 'K') current += 2;
        else current += 1;
        primary += 'K';
        secondary += 'K';
        break;

      case 'L':
        if (input[current + 1] === 'L') {
          if ((current === length - 2 && input[current - 1] === 'A') ||
            ((current > 1 && input.substr(current - 1, 2) === 'IL') &&
              (input[current + 2] === 'A' || input[current + 2] === 'O' || input[current + 2] === 'U')) ||
            ((input[current - 1] === 'A' || input[current - 1] === 'O') && input[current + 2] === 'E')) {
            primary += 'L';
            secondary += '';
          } else {
            primary += 'L';
            secondary += 'L';
          }
          current += 2;
        } else {
          primary += 'L';
          secondary += 'L';
          current += 1;
        }
        break;

      case 'M':
        if (input[current + 1] === 'M') current += 2;
        else current += 1;
        primary += 'M';
        secondary += 'M';
        break;

      case 'N':
        if (input[current + 1] === 'N') current += 2;
        else current += 1;
        primary += 'N';
        secondary += 'N';
        break;

      case 'Ñ':
        current += 1;
        primary += 'N';
        secondary += 'N';
        break;

      case 'P':
        if (input[current + 1] === 'H') {
          primary += 'F';
          secondary += 'F';
          current += 2;
        } else {
          if (input[current + 1] === 'P') current += 2;
          else current += 1;
          primary += 'P';
          secondary += 'P';
        }
        break;

      case 'Q':
        if (input[current + 1] === 'Q') current += 2;
        else current += 1;
        primary += 'K';
        secondary += 'K';
        break;

      case 'R':
        if (input[current + 1] === 'R') current += 2;
        else current += 1;
        primary += 'R';
        secondary += 'R';
        break;

      case 'S':
        if (input[current + 1] === 'H') {
          primary += 'X';
          secondary += 'X';
          current += 2;
        } else if (input[current + 1] === 'I' && (input[current + 2] === 'O' || input[current + 2] === 'A')) {
          if (isSlavoGermanic) {
            primary += 'S';
            secondary += 'S';
          } else {
            primary += 'S';
            secondary += 'X';
          }
          current += 3;
        } else if (((current === 0 && input[current + 1] === 'I') && (input[current + 2] === 'A' || input[current + 2] === 'O')) ||
          input[current + 1] === 'Z') {
          primary += 'S';
          secondary += 'X';
          if (input[current + 1] === 'Z') current += 2;
          else current += 3;
        } else if (input[current + 1] === 'S') {
          current += 2;
          primary += 'S';
          secondary += 'S';
        } else {
          primary += 'S';
          secondary += 'S';
          if (input[current + 1] === 'Z') current += 2;
          else current += 1;
        }
        break;

      case 'T':
        if (input[current + 1] === 'I' && (input[current + 2] === 'O' || input[current + 2] === 'A') && !isSlavoGermanic) {
          primary += 'X';
          secondary += 'X';
          current += 3;
        } else if (input[current + 1] === 'H') {
          if (isSlavoGermanic) {
            primary += 'T';
            secondary += 'T';
          } else {
            primary += '0';
            secondary += 'T';
          }
          current += 2;
        } else if (input[current + 1] === 'C' && input[current + 2] === 'H') {
          primary += 'X';
          secondary += 'X';
          current += 3;
        } else if (input[current + 1] === 'S') {
          current += 2;
          primary += 'S';
          secondary += 'S';
        } else {
          if (input[current + 1] === 'T') current += 2;
          else current += 1;
          primary += 'T';
          secondary += 'T';
        }
        break;

      case 'V':
        if (input[current + 1] === 'V') current += 2;
        else current += 1;
        primary += 'F';
        secondary += 'F';
        break;

      case 'W':
        if (input[current + 1] === 'R') {
          primary += 'R';
          secondary += 'R';
          current += 2;
        } else if (current === 0) {
          if (isVowel(input[current + 1])) {
            primary += 'A';
            secondary += 'F';
          } else {
            primary += 'A';
            secondary += 'A';
          }
          current += 1;
        } else if (current === length - 1 && isVowel(input[current - 1])) {
          primary += '';
          secondary += 'F';
        } else if (input[current - 1] === 'E' && input[current + 1] === 'S' && input[current + 2] === 'K' && input[current + 3] === 'I') {
          primary += 'A';
          secondary += 'F';
        } else if (input[current + 1] === 'H' || input[current + 1] === 'W') {
          if (current === 0 || isVowel(input[current - 1])) {
            primary += 'A';
            secondary += 'F';
          } else {
            primary += 'A';
            secondary += 'A';
          }
          current += 2;
        } else {
          current += 1;
        }
        break;

      case 'X':
        if (current === 0) {
          primary += 'S';
          secondary += 'S';
          current += 1;
        } else {
          if (!(current === length - 1 && (input[current - 1] === 'U' || input[current - 1] === 'A' || input[current - 1] === 'O')))
            primary += 'KS';
          secondary += 'KS';
          if (input[current + 1] === 'X') current += 2;
          else current += 1;
        }
        break;

      case 'Z':
        if (input[current + 1] === 'H') {
          primary += 'J';
          secondary += 'J';
          current += 2;
        } else if (input[current + 1] === 'Z' && input[current + 2] === 'I') {
          primary += 'TS';
          secondary += 'TS';
          current += 3;
        } else {
          if (isSlavoGermanic) {
            primary += 'S';
            secondary += 'S';
          } else {
            primary += 'S';
            secondary += 'S';
          }
          if (input[current + 1] === 'Z') current += 2;
          else current += 1;
        }
        break;

      default:
        current += 1;
    }
  }

  return { primary: primary.slice(0, 4), secondary: secondary.slice(0, 4) };
}

// Helper functions for Double Metaphone
function isVowel(char) {
  return /[AEIOU]/.test(char);
}

function areSlavoGermanic(text) {
  return /W|K|CZ|WITZ/.test(text);
}

// ============================================================================
// SYNONYMS & QUERY EXPANSION
// ============================================================================

/**
 * Expand query with synonyms for better matching
 * OPTIMIZED: Added fuzzy matching for partial token matches
 * @param {string} query - Search query
 * @returns {Array<string>} Expanded tokens including synonyms
 */
export function expandQueryWithSynonyms(query = "") {
  if (!query) return [];

  const tokens = tokenize(query);
  const expanded = new Set(tokens);

  tokens.forEach(token => {
    // Check if token matches any synonym key
    const synonyms = SYNONYMS[token];
    if (synonyms) {
      synonyms.forEach(syn => expanded.add(syn));
    }

    // OPTIMIZED: Check for partial matches in synonym keys
    Object.entries(SYNONYMS).forEach(([key, values]) => {
      // Direct key match
      if (key.includes(token) || token.includes(key)) {
        expanded.add(key);
        values.forEach(v => expanded.add(v));
      }
      // Value matches
      if (values.some(v => v.includes(token) || token.includes(v))) {
        expanded.add(key);
        values.forEach(v => expanded.add(v));
      }
    });
  });

  return Array.from(expanded);
}

/**
 * Generate comprehensive search tokens including various expansions
 * @param {string} text - Input text
 * @returns {Object} Object with various token types
 */
export function generateSearchTokens(text = "") {
  if (!text) return {
    normalized: "",
    tokens: [],
    prefixes: [],
    ngrams: [],
    soundex: "",
    metaphone: "",
    doubleMetaphonePrimary: "",
    doubleMetaphoneSecondary: "",
  };

  return {
    normalized: normalizeText(text),
    tokens: tokenize(text),
    prefixes: generatePrefixes(text),
    ngrams: generateNGrams(text, 3),
    soundex: soundex(text),
    metaphone: metaphone(text),
    doubleMetaphonePrimary: doubleMetaphone(text).primary,
    doubleMetaphoneSecondary: doubleMetaphone(text).secondary,
  };
}

// ============================================================================
// FUSE.JS CONFIGURATION & SEARCH
// ============================================================================

/**
 * Build a Fuse.js search index with optimized configuration
 * ULTRA-FUZZY: Handles severe typos like "vets" → "pets", "r" → "are"
 * @param {Array} items - Array of items to index
 * @param {Object} options - Fuse.js configuration options
 * @returns {Fuse} Configured Fuse instance
 */
export function buildFuseIndex(items, options = {}) {
  const defaultOptions = {
    includeScore: true,
    threshold: 0.6, // INCREASED: 0.6 for ultra-fuzzy matching (handles severe typos)
    distance: 1000, // INCREASED: Allow matches very far apart to avoid interfering with custom relevance ranking
    minMatchCharLength: 1, // Match from single character
    ignoreLocation: true, // Search entire string (don't use distance for location)
    useExtendedSearch: false, // Keep false for performance
    findAllMatches: true, // Find ALL matches for better coverage
    isCaseSensitive: false, // Case-insensitive
    shouldSort: false, // CHANGED: Don't sort by score here - we'll do custom sorting
    ignoreFieldNorm: true, // CHANGED: Don't penalize longer fields (better for typos)
    keys: [], // Must be provided by caller
  };

  const fuseOptions = { ...defaultOptions, ...options };

  return new Fuse(items, fuseOptions);
}

/**
 * Perform search using Fuse.js with query expansion
 * OPTIMIZED: More lenient scoring for Google-like behavior
 * @param {Fuse} fuse - Fuse instance
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Array|null} Search results or null if no query
 */
export function performSearch(fuse, query, options = {}) {
  if (!query || !query.trim()) return null;

  const {
    expandSynonyms = true,
    maxResults = 500, // INCREASED: Show more results
    minScore = 1.0, // INCREASED: Accept more results (lower score is better, max 1.0)
  } = options;

  // Expand query with synonyms if enabled
  let searchQuery = query;
  if (expandSynonyms) {
    const expandedTokens = expandQueryWithSynonyms(query);
    if (expandedTokens.length === 0) return []; // Return empty if query becomes empty (e.g. only stop words)
    searchQuery = expandedTokens.join(" ");
  }

  if (!searchQuery.trim()) return [];

  // Perform search
  let results = fuse.search(searchQuery, { limit: maxResults });

  // Filter by minimum score if specified
  if (minScore < 1) {
    results = results.filter(r => (r.score || 0) <= minScore);
  }

  return results.map(r => ({
    item: r.item,
    score: r.score || 0,
    matches: r.matches || [],
  }));
}

/**
 * CUSTOM RELEVANCE SCORING: Re-rank results based on strict hierarchy
 * Prioritizes:
 * 1. Exact substring match in title/tags (highest)
 * 2. Prefix match in title/tags
 * 3. Ordered subsequence match (characters in sequence)
 * 4. Partial overlap matches (fuzzy matches)
 * @param {Array} results - Fuse.js search results
 * @param {string} query - Original search query
 * @returns {Array} Re-ranked results with custom scores
 */
export function reRankByRelevance(results, query) {
  if (!results || results.length === 0 || !query) return results;

  const normalizedQuery = normalizeText(query).trim();
  const queryLower = normalizedQuery.toLowerCase();

  // Calculate custom relevance score for each result
  const scoredResults = results.map(result => {
    const item = result.item;
    const title = normalizeText(item.title || "").toLowerCase();
    const tags = (item.tags || []).map(t => normalizeText(t).toLowerCase()).join(" ");
    const username = normalizeText(item.searchData?.username || "").toLowerCase();

    let customScore = 0;

    // 1. EXACT SUBSTRING MATCH (highest priority - score 1000+)
    if (title.includes(queryLower)) {
      customScore += 1000;
      // Bonus for exact word match
      if ((title === queryLower) || (title.includes(queryLower + " ")) || (title.includes(" " + queryLower + " ")) || (title.includes(" " + queryLower))) {
        customScore += 500;
      }
    }
    if (tags.includes(queryLower)) {
      customScore += 950; // High priority for tags too
      if ((tags.includes(queryLower + " ")) || (tags.includes(" " + queryLower + " ")) || (tags.includes(" " + queryLower))) {
        customScore += 450;
      }
    }

    // 2. PREFIX MATCH (high priority - score 800+)
    if (title.startsWith(queryLower)) {
      customScore += 800;
      if ((title === queryLower) || (title.startsWith(queryLower + " "))) {
        customScore += 400;
      }
    }
    if (tags.startsWith(queryLower)) {
      customScore += 750; // High priority for tag prefix too
      if ((tags === queryLower) || (tags.startsWith(queryLower + " "))) {
        customScore += 350;
      }
    }

    // 3. ORDERED SUBSEQUENCE MATCH (score 600+)
    // Check for ordered character sequence matches
    const titleOrderedMatch = hasOrderedSubsequence(title, queryLower);
    const tagsOrderedMatch = hasOrderedSubsequence(tags, queryLower);

    if (titleOrderedMatch) {
      customScore += 600;
      // Bonus based on how well characters align
      const alignmentBonus = calculateCharacterAlignment(title, queryLower) * 200;
      customScore += alignmentBonus;
    }
    if (tagsOrderedMatch) {
      customScore += 550; // High for tags too
      const alignmentBonus = calculateCharacterAlignment(tags, queryLower) * 180;
      customScore += alignmentBonus;
    }

    // 4. PREFIX MATCH IN USERNAME (score 400+)
    if (username.startsWith(queryLower)) {
      customScore += 400;
    }

    // 5. CONTAINS QUERY IN USERNAME (score 200+)
    if (username.includes(queryLower)) {
      customScore += 200;
    }

    // 6. CHARACTER ALIGNMENT SCORE (progressive matching)
    // For queries like 't', 'te', 'tes', 'test'
    const alignmentScore = calculateCharacterAlignment(title, queryLower) +
      calculateCharacterAlignment(tags, queryLower);
    customScore += alignmentScore * 100; // Increased weight for alignment

    // 7. FUSE.JS SCORE (inverse - lower is better)
    // Convert Fuse score (0-1, lower better) to points (0-100, higher better)
    const fusePoints = (1 - (result.score || 0)) * 100;
    customScore += fusePoints;

    return {
      ...result,
      customScore,
      originalFuseScore: result.score
    };
  });

  // Sort by custom score (descending - higher is better)
  scoredResults.sort((a, b) => b.customScore - a.customScore);

  return scoredResults;
}

/**
 * Calculate character alignment score for progressive matching
 * Higher score = more characters match in sequence
 * @param {string} text - Text to search in
 * @param {string} query - Query to search for
 * @returns {number} Alignment score (0-10)
 */
function calculateCharacterAlignment(text, query) {
  if (!text || !query) return 0;

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  let maxAlignment = 0;

  // Check all positions in text
  for (let i = 0; i <= textLower.length - queryLower.length; i++) {
    let alignment = 0;
    for (let j = 0; j < queryLower.length; j++) {
      if (textLower[i + j] === queryLower[j]) {
        alignment++;
      }
    }
    maxAlignment = Math.max(maxAlignment, alignment);
  }

  // Return ratio of aligned characters
  return queryLower.length > 0 ? maxAlignment / queryLower.length : 0;
}

/**
 * Check if query characters appear in text in the same order (ordered subsequence)
 * For example: "t-e-s-t" appears in "test worker" in order
 * @param {string} text - Text to search in
 * @param {string} query - Query to search for
 * @returns {boolean} True if query is an ordered subsequence of text
 */
function hasOrderedSubsequence(text, query) {
  if (!text || !query) return false;

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  let textIndex = 0;
  let queryIndex = 0;

  while (textIndex < textLower.length && queryIndex < queryLower.length) {
    if (textLower[textIndex] === queryLower[queryIndex]) {
      queryIndex++;
    }
    textIndex++;
  }

  return queryIndex === queryLower.length;
}

/**
 * Perform tiered search (strict then relaxed)
 * First tries strict search, if few results, tries fuzzy search
 * @param {Array} items - Items to search
 * @param {string} query - Search query
 * @param {Object} keys - Fuse.js keys configuration
 * @returns {Array} Search results
 */
export function performTieredSearch(items, query, keys) {
  if (!query || !query.trim()) return null;

  // Tier 1: Strict search (threshold 0.2 - close to exact)
  const strictFuse = buildFuseIndex(items, {
    keys,
    threshold: 0.2,
    distance: 50,
  });

  let results = performSearch(strictFuse, query);

  // Tier 2: If too few results, try fuzzy search
  if (!results || results.length < 3) {
    const fuzzyFuse = buildFuseIndex(items, {
      keys,
      threshold: 0.5,
      distance: 150,
    });

    results = performSearch(fuzzyFuse, query);
  }

  return results;
}

// ============================================================================
// FIELD WEIGHT CONFIGURATIONS
// ============================================================================

/**
 * Get default weighted keys for Workers search
 * ULTRA-FUZZY: Includes n-grams and prefixes for severe typo tolerance
 * Title & Tags = 60%, N-grams = 20%, Username = 15%, Location = 5%
 * @returns {Array} Weighted keys configuration
 */
export function getWorkerSearchKeys() {
  return [
    { name: "searchData.title", weight: 0.25 },      // 25% - Post title (PRIMARY)
    { name: "searchData.tags", weight: 0.25 },       // 25% - Skills/categories (PRIMARY)
    { name: "searchData.ngrams", weight: 0.12 },     // 12% - Character-level matching (TYPOS)
    { name: "searchData.prefixes", weight: 0.10 },   // 10% - Prefix matching (PARTIAL)
    { name: "searchData.doubleMetaphonePrimary", weight: 0.05 },  // 5% - Phonetic matching (PRIMARY)
    { name: "searchData.doubleMetaphoneSecondary", weight: 0.05 },  // 5% - Phonetic matching (SECONDARY)
    { name: "searchData.username", weight: 0.13 },   // 13% - Creator name
    { name: "searchData.city", weight: 0.02 },       // 2% - Location (minimal)
    { name: "searchData.area", weight: 0.015 },      // 1.5% - Location (minimal)
    { name: "searchData.landmark", weight: 0.01 },   // 1% - Location (minimal)
    { name: "searchData.pincode", weight: 0.005 },   // 0.5% - Location (minimal)
  ];
}

/**
 * Get default weighted keys for Services search
 * ULTRA-FUZZY: Includes n-grams and prefixes for severe typo tolerance
 * Title & Tags = 60%, N-grams = 20%, Username = 15%, Location = 5%
 * @returns {Array} Weighted keys configuration
 */
export function getServiceSearchKeys() {
  return [
    { name: "searchData.title", weight: 0.25 },      // 25% - Service title (PRIMARY)
    { name: "searchData.tags", weight: 0.25 },       // 25% - Service categories (PRIMARY)
    { name: "searchData.ngrams", weight: 0.12 },     // 12% - Character-level matching (TYPOS)
    { name: "searchData.prefixes", weight: 0.10 },   // 10% - Prefix matching (PARTIAL)
    { name: "searchData.doubleMetaphonePrimary", weight: 0.05 },  // 5% - Phonetic matching (PRIMARY)
    { name: "searchData.doubleMetaphoneSecondary", weight: 0.05 },  // 5% - Phonetic matching (SECONDARY)
    { name: "searchData.username", weight: 0.13 },   // 13% - Creator name
    { name: "searchData.city", weight: 0.02 },       // 2% - Location (minimal)
    { name: "searchData.area", weight: 0.015 },      // 1.5% - Location (minimal)
    { name: "searchData.landmark", weight: 0.01 },   // 1% - Location (minimal)
    { name: "searchData.pincode", weight: 0.005 },   // 0.5% - Location (minimal)
  ];
}

/**
 * Get default weighted keys for Ads search
 * ULTRA-FUZZY: Includes n-grams and prefixes for severe typo tolerance
 * Title & Tags = 62%, N-grams = 20%, Username = 13%, Location = 5%
 * NO DESCRIPTION SEARCH - Focus on title, tags, username only
 * @returns {Array} Weighted keys configuration
 */
export function getAdSearchKeys() {
  return [
    { name: "searchData.title", weight: 0.26 },      // 26% - Ad title (PRIMARY)
    { name: "searchData.tags", weight: 0.26 },       // 26% - Ad categories (PRIMARY)
    { name: "searchData.ngrams", weight: 0.12 },     // 12% - Character-level matching (TYPOS)
    { name: "searchData.prefixes", weight: 0.10 },   // 10% - Prefix matching (PARTIAL)
    { name: "searchData.doubleMetaphonePrimary", weight: 0.05 },  // 5% - Phonetic matching (PRIMARY)
    { name: "searchData.doubleMetaphoneSecondary", weight: 0.05 },  // 5% - Phonetic matching (SECONDARY)
    { name: "searchData.username", weight: 0.11 },   // 11% - Creator name
    { name: "searchData.city", weight: 0.02 },       // 2% - Location (minimal)
    { name: "searchData.area", weight: 0.015 },      // 1.5% - Location (minimal)
    { name: "searchData.landmark", weight: 0.01 },   // 1% - Location (minimal)
    { name: "searchData.pincode", weight: 0.005 },   // 0.5% - Location (minimal)
  ];
}

// ============================================================================
// DATA PREPARATION FOR SEARCH
// ============================================================================

/**
 * ULTRA-FUZZY: Prepare worker data for search indexing
 * Includes character-level n-grams for severe typo tolerance
 * Space-insensitive normalization ONLY for tags (not titles)
 * @param {Object} worker - Worker object
 * @param {Object} creatorProfile - Creator profile object
 * @returns {Object} Worker with searchData
 */
export function prepareWorkerForSearch(worker, creatorProfile = {}) {
  const location = worker.location || {};
  const tags = worker.tags || [];
  const username = creatorProfile.username || "";
  const title = worker.title || "";

  const city = location.city || "";
  const area = location.area || "";
  const landmark = location.landmark || "";
  const pincode = location.pincode || "";

  const locationText = [area, city, landmark, pincode].filter(Boolean).join(" ");
  const allText = [username, title, tags.join(" "), locationText].join(" ");

  // ULTRA-FUZZY: Generate comprehensive search data with n-grams
  const titleNormalized = normalizeText(title);
  const tagsNormalized = tags.map(t => normalizeText(t)).join(" ");
  const tagsSpaceInsensitive = tags.map(t => normalizeSpaceInsensitive(t)).join(" "); // Only tags get space-insensitive

  // Generate n-grams and prefixes as STRINGS (not arrays) for Fuse.js
  const searchText = title + " " + tags.join(" ");
  const ngramsArray = generateNGrams(searchText, 3);
  const prefixesArray = generatePrefixes(searchText, 2); // Changed to 2 to avoid noise

  return {
    ...worker,
    searchData: {
      username: normalizeText(username),
      title: titleNormalized, // Normal normalization for titles (they are sentences)
      tags: tagsNormalized + " " + tagsSpaceInsensitive, // Space-insensitive boost for tags only
      city: normalizeText(city),
      area: normalizeText(area),
      landmark: normalizeText(landmark),
      pincode: normalizeText(pincode),
      location: normalizeText(locationText),
      tokens: tokenize(allText),
      prefixes: prefixesArray.join(" "), // Convert array to string
      ngrams: ngramsArray.join(" "), // Convert array to string for character-level matching
      soundex: soundex(title),
      metaphone: metaphone(title), // ENHANCED metaphone on title
      doubleMetaphonePrimary: doubleMetaphone(title).primary, // Double Metaphone primary code
      doubleMetaphoneSecondary: doubleMetaphone(title).secondary, // Double Metaphone secondary code
      allText: normalizeText(allText),
    },
  };
}

/**
 * ULTRA-FUZZY: Prepare service data for search indexing
 * Includes character-level n-grams for severe typo tolerance
 * Space-insensitive normalization ONLY for tags (not titles)
 * @param {Object} service - Service object
 * @param {Object} creatorProfile - Creator profile object
 * @returns {Object} Service with searchData
 */
export function prepareServiceForSearch(service, creatorProfile = {}) {
  const location = service.location || {};
  const tags = service.tags || [];
  const username = creatorProfile.username || "";
  const title = service.title || "";

  const city = location.city || "";
  const area = location.area || "";
  const landmark = location.landmark || "";
  const pincode = location.pincode || "";

  const locationText = [area, city, landmark, pincode].filter(Boolean).join(" ");
  const allText = [username, title, tags.join(" "), locationText].join(" ");

  // ULTRA-FUZZY: Generate comprehensive search data with n-grams
  const titleNormalized = normalizeText(title);
  const tagsNormalized = tags.map(t => normalizeText(t)).join(" ");
  const tagsSpaceInsensitive = tags.map(t => normalizeSpaceInsensitive(t)).join(" "); // Only tags get space-insensitive

  // Generate n-grams and prefixes as STRINGS (not arrays) for Fuse.js
  const searchText = title + " " + tags.join(" ");
  const ngramsArray = generateNGrams(searchText, 3);
  const prefixesArray = generatePrefixes(searchText, 2); // Changed to 2 to avoid noise

  return {
    ...service,
    searchData: {
      username: normalizeText(username),
      title: titleNormalized, // Normal normalization for titles (they are sentences)
      tags: tagsNormalized + " " + tagsSpaceInsensitive, // Space-insensitive boost for tags only
      city: normalizeText(city),
      area: normalizeText(area),
      landmark: normalizeText(landmark),
      pincode: normalizeText(pincode),
      location: normalizeText(locationText),
      tokens: tokenize(allText),
      prefixes: prefixesArray.join(" "), // Convert array to string
      ngrams: ngramsArray.join(" "), // Convert array to string for character-level matching
      soundex: soundex(title),
      metaphone: metaphone(title), // ENHANCED metaphone on title
      doubleMetaphonePrimary: doubleMetaphone(title).primary, // Double Metaphone primary code
      doubleMetaphoneSecondary: doubleMetaphone(title).secondary, // Double Metaphone secondary code
      allText: normalizeText(allText),
    },
  };
}

/**
 * ULTRA-FUZZY: Prepare ad data for search indexing
 * NO DESCRIPTION in search - Focus on title, tags, username only
 * Includes character-level n-grams for severe typo tolerance
 * Space-insensitive normalization ONLY for tags (not titles)
 * @param {Object} ad - Ad object
 * @param {Object} creatorProfile - Creator profile object
 * @returns {Object} Ad with searchData
 */
export function prepareAdForSearch(ad, creatorProfile = {}) {
  const location = ad.location || {};
  const tags = ad.tags || [];
  const username = creatorProfile.username || "";
  const title = ad.title || "";
  // NO DESCRIPTION - removed from search as per requirements

  const city = location.city || "";
  const area = location.area || "";
  const landmark = location.landmark || "";
  const pincode = location.pincode || "";

  const locationText = [area, city, landmark, pincode].filter(Boolean).join(" ");
  const allText = [username, title, tags.join(" "), locationText].join(" ");

  // ULTRA-FUZZY: Generate comprehensive search data with n-grams
  const titleNormalized = normalizeText(title);
  const tagsNormalized = tags.map(t => normalizeText(t)).join(" ");
  const tagsSpaceInsensitive = tags.map(t => normalizeSpaceInsensitive(t)).join(" "); // Only tags get space-insensitive

  // Generate n-grams and prefixes as STRINGS (not arrays) for Fuse.js
  const searchText = title + " " + tags.join(" ");
  const ngramsArray = generateNGrams(searchText, 3);
  const prefixesArray = generatePrefixes(searchText, 2); // Changed to 2 to avoid noise

  return {
    ...ad,
    searchData: {
      username: normalizeText(username),
      title: titleNormalized, // Normal normalization for titles (they are sentences)
      tags: tagsNormalized + " " + tagsSpaceInsensitive, // Space-insensitive boost for tags only
      city: normalizeText(city),
      area: normalizeText(area),
      landmark: normalizeText(landmark),
      pincode: normalizeText(pincode),
      location: normalizeText(locationText),
      tokens: tokenize(allText),
      prefixes: prefixesArray.join(" "), // Convert array to string
      ngrams: ngramsArray.join(" "), // Convert array to string for character-level matching
      soundex: soundex(title),
      metaphone: metaphone(title), // ENHANCED metaphone on title
      doubleMetaphonePrimary: doubleMetaphone(title).primary, // Double Metaphone primary code
      doubleMetaphoneSecondary: doubleMetaphone(title).secondary, // Double Metaphone secondary code
      allText: normalizeText(allText),
    },
  };
}

// ============================================================================
// EXPORTS - Named exports to avoid ESLint warning
// ============================================================================

// Export all functions individually (already done above with export keyword)
// No default export needed to avoid no-anonymous-default-export warning
