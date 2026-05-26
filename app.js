// ============== Aura Lux — Pure JS ==============
const WHATSAPP_NUMBER = "919539600019";
const buyOnWhatsApp = (name) => {
  const msg = encodeURIComponent(`Hi, I want to buy ${name} from Aura Lux.`);
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
};
const inquireOnWhatsApp = () => {
  const msg = encodeURIComponent("Hi, I'd like to know more about Aura Lux perfumes.");
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
};

// Use data from products.js
const PRODUCT_IMAGES = window.PERFUME_PRODUCTS.PERFUME_PRODUCT_IMAGES;
let CATEGORIES = window.PERFUME_PRODUCTS.PERFUME_CATEGORIES || [];
const FALLBACK_PRODUCTS = window.PERFUME_PRODUCTS.PERFUME_DATABASE || [];
const FALLBACK_COMBOS = [
  { id: "combo-static-1", name: "Signature Duo", size: "2x30ml", price: "1399", offer: "2 perfumes · ₹1399", image: PRODUCT_IMAGES[0] },
  { id: "combo-static-2", name: "Bridal Bliss Set", size: "3x20ml", price: "1899", offer: "3 perfumes · ₹1899", image: PRODUCT_IMAGES[1] },
  { id: "combo-static-3", name: "Evening Romance", size: "2x50ml", price: "1699", offer: "2 perfumes · ₹1699", image: PRODUCT_IMAGES[2] },
  { id: "combo-static-4", name: "Oud & Amber Box", size: "2x100ml", price: "2299", offer: "2 perfumes · ₹2299", image: PRODUCT_IMAGES[3] },
  { id: "combo-static-5", name: "Luxe Trio", size: "3x20ml", price: "2099", offer: "3 perfumes · ₹2099", image: PRODUCT_IMAGES[0] },
  { id: "combo-static-6", name: "Daily Essentials", size: "2x30ml", price: "1299", offer: "2 perfumes · ₹1299", image: PRODUCT_IMAGES[1] }
];

// Default placeholder image for perfumes without images
const DEFAULT_PERFUME_IMAGE = PRODUCT_IMAGES[0] || "assets/perfume-a.jpg";
const GOOGLE_SHEET_ID_PERFUMES = "1YD6wSGyVx84ldqZNOc9Vl1rMRNdZE61jD9G6It6KuA8";
const GOOGLE_SHEET_ID_COMBO = "1dSMplHYDhl4uL2sTQruVvFir3HapC2h3_oYQaL6Ubgs";
const GOOGLE_SHEET_BASE_PERFUMES = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID_PERFUMES}/gviz/tq?tqx=out:csv&sheet=`;
const GOOGLE_SHEET_BASE_COMBO = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID_COMBO}/gviz/tq?tqx=out:csv&sheet=`;
const GOOGLE_SHEET_TAB_PERFUMES = "perfumes";
const GOOGLE_SHEET_TAB_COMBO = "combo";
const GOOGLE_SHEET_PERFUMES = `${GOOGLE_SHEET_BASE_PERFUMES}${GOOGLE_SHEET_TAB_PERFUMES}`;
const GOOGLE_SHEET_COMBO = `${GOOGLE_SHEET_BASE_COMBO}${GOOGLE_SHEET_TAB_COMBO}`;

const safeJSON = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};
const safeLocalStorageGet = (key, fallback) => {
  try { return safeJSON(localStorage.getItem(key) || JSON.stringify(fallback), fallback); } catch { return fallback; }
};
const safeLocalStorageSet = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};
const safeSessionStorageGet = (key) => {
  try { return sessionStorage.getItem(key); } catch { return null; }
};

const cachedFetchJSON = async (url, cacheKey, ttl = 60 * 60 * 1000) => {
  const now = Date.now();
  let cached = null;
  try { cached = safeJSON(localStorage.getItem(cacheKey), null); } catch {}
  if (cached && cached.timestamp && now - cached.timestamp < ttl && Array.isArray(cached.data)) {
    return cached.data;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (cached && Array.isArray(cached.data)) return cached.data;
      throw new Error(`Fetch failed: ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid JSON data");
    safeLocalStorageSet(cacheKey, { timestamp: now, data });
    return data;
  } catch (error) {
    if (cached && Array.isArray(cached.data)) return cached.data;
    throw error;
  }
};

const cachedFetchText = async (url, cacheKey, ttl = 60 * 60 * 1000) => {
  const now = Date.now();
  let cached = null;
  try { cached = safeJSON(localStorage.getItem(cacheKey), null); } catch {}
  if (cached && cached.timestamp && now - cached.timestamp < ttl && typeof cached.data === 'string') {
    return cached.data;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (cached && typeof cached.data === 'string') return cached.data;
      throw new Error(`Fetch failed: ${response.status}`);
    }
    const data = await response.text();
    safeLocalStorageSet(cacheKey, { timestamp: now, data });
    return data;
  } catch (error) {
    if (cached && typeof cached.data === 'string') return cached.data;
    throw error;
  }
};

const parseCSVLine = (line) => {
  const result = [];
  const regex = /(?:^|,)(?:(?:"([^"]*(?:""[^"]*)*)")|([^",]*))/g;
  let match;
  while ((match = regex.exec(line))) {
    const value = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
    result.push(value || '');
  }
  return result;
};

const parseCSV = (csv) => {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] !== undefined ? values[index].trim() : '';
    });
    return row;
  });
};

// Live collections, rebuilt from SheetDB data
let SIGNATURE = [];
let PERFUME_SETS = [];
let ALL_PRODUCTS = [];
let SPECIAL_PRODUCTS = [];
let COMBOS = [];

const normalizeCategory = (rawCategory) => {
  const value = String(rawCategory || "").trim();
  if (!value) return "Others";
  const exact = CATEGORIES.find(cat => cat.toLowerCase() === value.toLowerCase());
  return exact || value;
};

const deriveCategories = (products) => {
  const categories = Array.from(new Set(products.map(item => String(item.category || item.type || item.group || item.subcategory || "").trim()).filter(Boolean)));
  return categories.sort((a,b)=>a.localeCompare(b));
};

const getCategoryBackground = (category) => {
  const backMap = {
    "Men": "assets/cat-men.jpg",
    "Women": "assets/cat-women.jpg",
    "Oud": "assets/cat-others.jpg",
    "Romantic": "assets/cat-others.jpg",
    "Daily Wear": "assets/cat-others.jpg",
    "Party Wear": "assets/cat-others.jpg",
    "Kids / Sweet & Soft": "assets/cat-kids.jpg",
    "Unisex": "assets/cat-others.jpg",
    "Wedding": "assets/cat-wedding.jpg"
  };
  return backMap[category] || "assets/cat-others.jpg";
};

const parseSheetPrice = (value, fallback = 0) => {
  const number = Number(String(value || "").trim().replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) ? number : fallback;
};

const buildStaticProduct = (item, index) => {
  const sizes = Array.isArray(item.sizes) ? item.sizes : [];
  const prices = {
    "20ml": sizes[0] || 600,
    "30ml": sizes[1] || 800,
    "50ml": sizes[2] || 1000,
    "100ml": sizes[3] || 1500
  };
  const category = normalizeCategory(item.category);
  const bottleImage = resolveSheetImage(item.image || item.bottle) || DEFAULT_PERFUME_IMAGE;
  return {
    id: item.id || `static-${index}`,
    name: String(item.name || "").trim(),
    category,
    bottleImage,
    background: getCategoryBackground(category),
    prices,
    badge: item.badge
  };
};

const buildFallbackCollections = () => {
  const products = FALLBACK_PRODUCTS.map(buildStaticProduct);
  CATEGORIES = deriveCategories(products);
  SIGNATURE.splice(0, SIGNATURE.length, ...products.slice(0, 4).map((p) => ({ ...p, badge: p.badge || "Signature" })));
  PERFUME_SETS.splice(0, PERFUME_SETS.length, ...products.slice(0, 10));
  ALL_PRODUCTS.splice(0, ALL_PRODUCTS.length, ...products.map((p, i) => ({ ...p, id: p.id || `all-${i}` })));
  SPECIAL_PRODUCTS.splice(0, SPECIAL_PRODUCTS.length, ...products.slice(4, 19).map((p, i) => ({ ...p, badge: "Special", id: p.id || `sp-${i}` })));
  COMBOS.splice(0, COMBOS.length, ...FALLBACK_COMBOS);
  window.AURA = { SIGNATURE, COMBOS, PERFUME_SETS, ALL_PRODUCTS, SPECIAL_PRODUCTS, CATEGORIES, buyOnWhatsApp, inquireOnWhatsApp };
};

const resolveSheetImage = (rawValue) => {
  const raw = String(rawValue || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  if (!raw) return "";
  if (/^(https?:)?\/\//i.test(raw)) return raw;
  const cleaned = raw.replace(/^\.\/?+/, "").replace(/^\//, "");
  if (cleaned.startsWith("assets/")) return cleaned;
  if (cleaned.startsWith("images/")) return cleaned;
  return /\.[a-z]{2,4}$/i.test(cleaned) ? `images/${cleaned}` : `images/${cleaned}.png`;
};

const buildProductFromSheet = (item, index) => {
  const prices = {
    "20ml": parseSheetPrice(item["20ml"] || item["20 ml"] || item["20ML"] || item["20 Ml"]),
    "30ml": parseSheetPrice(item["30ml"] || item["30 ML"] || item["30ML"] || item["30 Ml"]),
    "50ml": parseSheetPrice(item["50ml"] || item["50 ML"] || item["50ML"] || item["50 Ml"]),
    "100ml": parseSheetPrice(item["100ml"] || item["100 ML"] || item["100ML"] || item["100 Ml"])
  };
  const bottleImage = resolveSheetImage(item.image || item.img || item.photo || item.filename || item.file || item.bottle) || DEFAULT_PERFUME_IMAGE;
  const category = normalizeCategory(item.category || item.type || item.group || "");
  return {
    id: item.id || `perfume-${index}`,
    name: String(item.name || item.title || item.product || "").trim(),
    category,
    bottleImage,
    background: getCategoryBackground(category),
    prices
  };
};

const buildCollectionsFromSheet = (rows) => {
  const products = rows.map(buildProductFromSheet);
  CATEGORIES = deriveCategories(products);
  const newSignature = products.slice(0, 4).map((p) => ({ ...p, badge: "Signature" }));
  const newSets = products.slice(0, 10);
  const newAll = products.map((p, i) => ({ ...p, id: p.id || `all-${i}` }));
  const newSpecial = products.slice(0, 15).map((p, i) => ({ ...p, badge: "Special", id: p.id || `sp-${i}` }));
  SIGNATURE.splice(0, SIGNATURE.length, ...newSignature);
  PERFUME_SETS.splice(0, PERFUME_SETS.length, ...newSets);
  ALL_PRODUCTS.splice(0, ALL_PRODUCTS.length, ...newAll);
  SPECIAL_PRODUCTS.splice(0, SPECIAL_PRODUCTS.length, ...newSpecial);
  window.AURA = { SIGNATURE, COMBOS, PERFUME_SETS, ALL_PRODUCTS, SPECIAL_PRODUCTS, CATEGORIES, buyOnWhatsApp, inquireOnWhatsApp };
};

const buildComboFromSheet = (item, index) => {
  const name = String(item.name || item.combo || item.title || "").trim();
  const size = String(item.size || item.ml || item.offer_size || "").trim();
  const price = String(item.price || item.amount || item.cost || "").trim().replace(/[^0-9.]/g, "");
  const offerText = String(item.offer || item.offer_text || item.description || "").trim();
  const image = resolveSheetImage(item.image || item.img || item.photo || item.filename || item.file) || DEFAULT_PERFUME_IMAGE;
  const offer = offerText || `${size ? size + " · " : ""}₹${price}`.trim();
  const hasComboFields = Boolean(name && (price || offerText || item.price || item.amount || item.cost || item.offer || item.combo || item.title || size));
  if (!hasComboFields) return null;
  return {
    id: `combo-${index}`,
    name: name || `Combo ${index + 1}`,
    size: size || "Combo",
    price: price || "",
    offer: offer || name || "Exclusive Combo",
    image,
  };
};

const fetchComboOffers = async () => {
  try {
    const csv = await cachedFetchText(GOOGLE_SHEET_COMBO, "aura-combos-cache");
    const rows = parseCSV(csv);
    console.log(`[Combo] Fetched ${rows.length} rows from sheet`);
    const comboData = rows.map(buildComboFromSheet).filter(Boolean);
    console.log(`[Combo] Parsed ${comboData.length} valid combos from sheet`);
    if (!comboData.length) {
      COMBOS.splice(0, COMBOS.length);
      if (window.AURA) window.AURA.COMBOS = COMBOS;
      console.warn("[Combo] No valid combo rows found in combo sheet.");
      return;
    }
    COMBOS.splice(0, COMBOS.length, ...comboData);
    if (window.AURA) window.AURA.COMBOS = COMBOS;
    console.log(`[Combo] Combos loaded successfully: ${COMBOS.length} items`);
  } catch (error) {
    console.error("[Combo] Failed to fetch combos from sheet:", error.message);
    throw error;
  }
};

const showDataError = (message) => {
  const emptyState = document.getElementById("emptyState");
  if (emptyState) {
    emptyState.textContent = message;
    emptyState.style.display = "";
  }
  const signatureScroll = document.getElementById("signatureScroll");
  if (signatureScroll) signatureScroll.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--muted-fg);">${esc(message)}</div>`;
  const setsScroll1 = document.getElementById("setsScroll1");
  if (setsScroll1) setsScroll1.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--muted-fg);">${esc(message)}</div>`;
};

const fetchSheetProducts = async () => {
  const csv = await cachedFetchText(GOOGLE_SHEET_PERFUMES, "aura-products-cache");
  const rows = parseCSV(csv);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Invalid product data");
  buildCollectionsFromSheet(rows);
};

window.AURA_READY_CALLBACKS = [];
window.AURA_DATA_LOADED = false;
window.onAuraReady = (callback) => {
  if (window.AURA_DATA_LOADED) callback();
  else window.AURA_READY_CALLBACKS.push(callback);
};
const dispatchAuraReady = () => {
  window.AURA_DATA_LOADED = true;
  window.AURA_READY_CALLBACKS.forEach(cb => cb());
  window.AURA_READY_CALLBACKS = [];
};

// ===== HTML helpers =====
const esc = s => String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function comboCardHTML(c){
  return `<div class="combo">
    <div class="img-wrap"><img src="${c.image}" alt="${esc(c.name)}" loading="lazy"></div>
    <div class="body">
      <span class="offer">${esc(c.offer)}</span>
      <h4>${esc(c.name)}</h4>
      <button class="btn-buy" data-buy="${esc(c.name)}" data-price="${esc(c.price)}" data-size="${esc(c.size)}">Explore Combo</button>
    </div>
  </div>`;
}

// Wire up buy buttons globally
document.addEventListener("click", e => {
  // Size selector buttons
  if(e.target.closest(".size-btn")) {
    const btn = e.target.closest(".size-btn");
    const card = btn.closest(".card");
    const priceEl = card.querySelector(".price");
    const buyBtn = card.querySelector(".btn-buy");
    const size = btn.dataset.size;
    const price = btn.dataset.price;
    
    card.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    btn.style.background = "var(--gradient-gold)";
    btn.style.color = "#fffaf0";
    
    card.querySelectorAll(".size-btn:not(.active)").forEach(b => {
      b.style.background = "transparent";
      b.style.color = "var(--muted-fg)";
    });
    
    priceEl.textContent = "₹" + price;
    buyBtn.dataset.price = price;
    buyBtn.dataset.selectedSize = size;
    buyBtn.textContent = `Buy Now (${size})`;
  }
  
  const t = e.target.closest("[data-buy]");
  if (t) {
    const name = t.dataset.buy;
    const size = t.dataset.selectedSize || t.dataset.size || "";
    const card = t.closest(".card");
    const priceEl = card ? card.querySelector(".price") : null;
    const price = t.dataset.price || (priceEl ? priceEl.textContent.replace("₹", "").trim() : "Price not available");
    const sizeInfo = size ? ` - ${size}` : "";
    buyOnWhatsApp(`${name}${sizeInfo} - ₹${price}`);
  }
  if (e.target.closest("#fabWA")) inquireOnWhatsApp();
});


// ===== Hero slider =====
function initHero(){
  const frame = document.querySelector(".hero-frame");
  if(!frame) return;
  const imgs = frame.querySelectorAll("img");
  const dotsWrap = frame.querySelector(".dots");
  let active = 0;
  imgs.forEach((_,i)=>{
    const b = document.createElement("button");
    b.setAttribute("aria-label",`Slide ${i+1}`);
    if(i===0) b.classList.add("active");
    b.addEventListener("click",()=>setActive(i));
    dotsWrap.appendChild(b);
  });
  const dots = dotsWrap.querySelectorAll("button");
  function setActive(i){
    active=i;
    imgs.forEach((im,k)=>im.classList.toggle("active",k===i));
    dots.forEach((d,k)=>d.classList.toggle("active",k===i));
  }
  setInterval(()=>setActive((active+1)%imgs.length),6000);
}

// ===== About slider =====
const ABOUT_SLIDES = [
  {img:"assets/here1.jpeg",eyebrow: "Our Boutique",
    title: "Step Into a World of Pure Opulence",
    text: "Experience a sanctuary of fragrance specifically designed to stir the soul. Crafted in deep black velvet tones and radiant warm gold accents, our Manjeri boutique is more than just a shop—it is a private haven for the senses. Here, every visit is treated as a personal rendezvous with luxury, where time slows down to let you discover your signature scent in an atmosphere of absolute comfort and elegance."
  },
  {img:"assets/about-inaug.jpeg",eyebrow: "The Grand Beginning · 2024",
    title: "A Vision Brought to Life",
    text: "Aura Lux was born from a singular, bold vision: to bridge the gap between high-end international perfumery and the local heart of Kerala. On the day we opened our doors, we promised to bring world-class, long-lasting essences within everyone's reach. By offering a premium experience at a single, transparent signature price, we have democratized luxury, ensuring that elegance is no longer a privilege, but a daily standard."
  },
  {img:"assets/about-customers.jpeg",eyebrow: "The Heart of Aura Lux",
    title: "A Legacy Built on Your Trust",
    text: "Our story isn't written in ink; it is written in the smiles of the thousands who have walked through our doors. From curious first-time visitors to our most loyal lifelong patrons, we believe that every customer who chooses Aura Lux becomes part of our extended family. Your satisfaction is our highest reward, and the lingering scent of our perfumes on your journey is the truest testimonial to the passion and craft we pour into every bottle."
  },
  {img:"assets/about-story.jpeg",eyebrow: "The Craftsmanship",
    title: "The Art of Bottling Memories",
    text: "At the core of Aura Lux lies an obsession with the finest raw materials. We source and hand-blend the richest essences of aged Oud, velvet Rose, sun-drenched Amber, and rare Saffron. These aren't just chemical compositions; they are distilled emotions, carefully aged to ensure they stay with you from dawn until dusk. Every spray is a chapter of your own story, a silent language of sophistication that carries your presence long after you have left the room."
  }
];
function initAbout(){
  const root = document.getElementById("about");
  if(!root) return;
  const eyEl = root.querySelector(".about-text .eyebrow");
  const tEl = root.querySelector(".about-text h4");
  const pEl = root.querySelector(".about-text p");
  const imgEl = root.querySelector(".about-img img");
  const dotsWrap = root.querySelector(".about-dots");
  let i = 0;
  ABOUT_SLIDES.forEach((_,k)=>{
    const b = document.createElement("button");
    b.setAttribute("aria-label",`Story ${k+1}`);
    if(k===0) b.classList.add("active");
    b.addEventListener("click",()=>render(k));
    dotsWrap.appendChild(b);
  });
  const dots = dotsWrap.querySelectorAll("button");
  function render(k){
    i=k; const s=ABOUT_SLIDES[k];
    eyEl.textContent=s.eyebrow; tEl.textContent=s.title; pEl.textContent=s.text;
    imgEl.src=s.img; imgEl.alt=s.title;
    dots.forEach((d,n)=>d.classList.toggle("active",n===k));
    root.querySelector(".about-text").classList.remove("fade-in");void root.offsetWidth;
    root.querySelector(".about-text").classList.add("fade-in");
    root.querySelector(".about-img").classList.remove("fade-in");void root.offsetWidth;
    root.querySelector(".about-img").classList.add("fade-in");
  }
  render(0);
  setInterval(()=>render((i+1)%ABOUT_SLIDES.length),7000);
}

// ===== Render homepage lists =====
function skeletonHTML(width=""){
  return `<div class="skeleton-card" ${width?`style="width:${width}"`:""}>
    <div class="skeleton skeleton-img"></div>
    <div class="skeleton-body">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-sub"></div>
      <div class="skeleton skeleton-btn"></div>
    </div>
  </div>`;
}

function productCardHTML(p) {
  const isLiked = getWishlist().some(w => w.name === p.name);
  const prices = p.prices || { "20ml": 0, "30ml": 0, "50ml": 0, "100ml": 0 };

  const bottleImage = p.bottleImage || PLACEHOLDER_IMAGE;
  const bottleCandidates =
    bottleImage && bottleImage.candidates
      ? bottleImage.candidates
      : Array.isArray(bottleImage)
      ? bottleImage
      : [bottleImage];

  return `<div class="card luxury-clean-card" data-product-name="${esc(p.name)}">

    <button class="btn-heart ${isLiked ? "liked" : ""}"
      data-name="${esc(p.name)}"
      data-image="${esc(bottleCandidates[0] || PLACEHOLDER_IMAGE)}"
      data-price="${prices["20ml"] || 0}"
      aria-label="Save to wishlist">${isLiked ? "♥" : "♡"}</button>

    <div class="clean-img-wrap">
      <img src="${PLACEHOLDER_IMAGE}"
        data-candidates='${esc(JSON.stringify(bottleCandidates))}'
        alt="${esc(p.name)}"
        loading="lazy"
        onerror="this.onerror=null;this.src='${PLACEHOLDER_IMAGE}'">
    </div>

    <div class="clean-body">
      <h4>${esc(p.name)}</h4>
      <p class="clean-category">${esc(p.category || "Eau De Parfum")}</p>

      <p class="price">₹${prices["20ml"] || 0}</p>

      <div class="size-selector clean-sizes">
        <button class="size-btn active" data-size="20ml" data-price="${prices["20ml"] || 0}">20ml</button>
        <button class="size-btn" data-size="30ml" data-price="${prices["30ml"] || 0}">30ml</button>
        <button class="size-btn" data-size="50ml" data-price="${prices["50ml"] || 0}">50ml</button>
        <button class="size-btn" data-size="100ml" data-price="${prices["100ml"] || 0}">100ml</button>
      </div>

      <button class="btn-buy clean-buy"
        data-buy="${esc(p.name)}"
        data-price="${prices["20ml"] || 0}"
        data-size="20ml">
        Order on WhatsApp
      </button>
    </div>
  </div>`;
}

function initComboSection(){
  if (document.getElementById("comboScroll")) return;
  if (!location.pathname.includes("special.html")) return;
  const main = document.querySelector('.store-main');
  if (!main) return;
  const section = document.createElement('div');
  section.style.marginTop = '3rem';
  section.innerHTML = `
    <p class="eyebrow">Combo Offers</p>
    <h3 class="font-display">Special Combo Collections</h3>
    <div id="comboScroll" class="hscroll combo-scroll"></div>
  `;
  main.appendChild(section);
}

// ===== Splash =====
function initSplash(){
  const s = document.getElementById("splash");
  if(!s) return;
  if(safeSessionStorageGet("aura-splash-shown")){ s.remove(); return; }
  setTimeout(()=>s.classList.add("fade"),2000);
  setTimeout(()=>{ if(s.parentNode) s.parentNode.removeChild(s); try { sessionStorage.setItem("aura-splash-shown","1"); } catch {} },2800);
  setTimeout(()=>{ if(document.getElementById("splash")) document.getElementById("splash").remove(); }, 5000);
}

// ===== Store/Special pages =====
function initStorePage(opts){
  const { source, pageSize=12 } = opts;
  const params = new URLSearchParams(location.search);
  let cat = params.get("cat") || "All";
  let query = "";
  let minPrice = "";
  let maxPrice = "";
  let selectedSize = "20ml"; // Default size for price filtering
  let visible = pageSize;

  const grid = document.getElementById("productGrid");
  const empty = document.getElementById("emptyState");
  const loadWrap = document.getElementById("loadMoreWrap");
  const countEl = document.getElementById("countLabel");
  const search = document.getElementById("searchInput");
  const chipsWrap = document.getElementById("chips");

  // Create category filter buttons
  ["All", ...CATEGORIES].forEach(c=>{
    const b=document.createElement("button");
    b.className="chip"+(c===cat?" active":"");
    b.textContent=c;
    b.addEventListener("click",()=>{
      cat=c; visible=pageSize;
      const u=new URL(location.href);
      if(c==="All") u.searchParams.delete("cat"); else u.searchParams.set("cat",c);
      history.replaceState(null,"",u);
      [...chipsWrap.children].forEach(ch=>ch.classList.toggle("active",ch.textContent===c));
      render();
    });
    chipsWrap.appendChild(b);
  });

  // Create price range inputs
  const priceFilterWrap = document.createElement("div");
  priceFilterWrap.className = "price-filter";
  priceFilterWrap.innerHTML = `
    <div class="price-inputs">
      <input type="number" id="minPrice" placeholder="Min ₹" min="0">
      <span>—</span>
      <input type="number" id="maxPrice" placeholder="Max ₹" min="0">
    </div>
    <select id="priceSizeFilter">
      <option value="20ml">20ml prices</option>
      <option value="30ml">30ml prices</option>
      <option value="50ml">50ml prices</option>
      <option value="100ml">100ml prices</option>
    </select>
  `;
  chipsWrap.appendChild(priceFilterWrap);

  const minPriceInput = document.getElementById("minPrice");
  const maxPriceInput = document.getElementById("maxPrice");
  const sizeFilter = document.getElementById("priceSizeFilter");

  // Event listeners for price filtering
  [minPriceInput, maxPriceInput, sizeFilter].forEach(el => {
    el.addEventListener("input", () => {
      minPrice = minPriceInput.value;
      maxPrice = maxPriceInput.value;
      selectedSize = sizeFilter.value;
      visible = pageSize;
      render();
    });
  });

  search.addEventListener("input",e=>{query=e.target.value;visible=pageSize;render();});

  function getFiltered(){
    return source.filter(p=>{
      // Category filter
      if(cat !== "All" && p.category !== cat) return false;

      // Search filter
      if(query.trim() && !p.name.toLowerCase().includes(query.toLowerCase())) return false;

      // Price filter
      if(minPrice || maxPrice) {
        const productPrice = p.prices ? p.prices[selectedSize] : p.price;
        if(!productPrice) return false;

        const min = minPrice ? parseInt(minPrice) : 0;
        const max = maxPrice ? parseInt(maxPrice) : Infinity;

        if(productPrice < min || productPrice > max) return false;
      }

      return true;
    });
  }

  function render(){
    const f = getFiltered();
    if(f.length===0){
      grid.innerHTML=""; empty.style.display=""; loadWrap.style.display="none"; countEl.style.display="none";
      return;
    }
    empty.style.display="none";
    const slice = f.slice(0,visible);
    grid.innerHTML = slice.map(productCardHTML).join("");
    if(visible<f.length){loadWrap.style.display="";} else {loadWrap.style.display="none";}
    countEl.style.display="";
    countEl.textContent=`Showing ${Math.min(visible,f.length)} of ${f.length}`;
  }
  document.getElementById("loadMoreBtn").addEventListener("click",()=>{
    const f=getFiltered(); visible=Math.min(visible+pageSize,f.length); render();
  });
  // Infinite scroll sentinel
  const sentinel=document.getElementById("sentinel");
  const obs=new IntersectionObserver(entries=>{
    if(entries[0].isIntersecting){
      const f=getFiltered();
      if(visible<f.length){visible=Math.min(visible+pageSize,f.length);render();}
    }
  },{rootMargin:"300px"});
  obs.observe(sentinel);
  render();
}

function initRevealAnimations(){
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },{threshold:0.15});
  document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
}

// ===== Boot =====
document.addEventListener("DOMContentLoaded",()=>{
  initSplash();
  initAbout();
  renderHome();
  initRevealAnimations();
  const y=document.getElementById("year"); if(y) y.textContent=new Date().getFullYear();

  const menuToggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      menuToggle.classList.toggle('open');
    });
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        menuToggle.classList.remove('open');
      });
    });
  }

  initComboSection();
  renderHome();

  Promise.allSettled([fetchSheetProducts(), fetchComboOffers()]).then((results) => {
    const productsResult = results[0];
    const combosResult = results[1];

    if (productsResult.status === "rejected") {
      console.error("Failed to load perfumes from Google Sheets:", productsResult.reason);
      buildFallbackCollections();
      showDataError("Showing fallback products because the sheet load failed.");
    }

    if (combosResult.status === "rejected") {
      console.error("Failed to load combos from Google Sheets:", combosResult.reason);
      if (!COMBOS.length) {
        COMBOS.splice(0, COMBOS.length, ...FALLBACK_COMBOS);
        if (window.AURA) window.AURA.COMBOS = COMBOS;
        console.log(`[Combo] Fallback loaded: ${COMBOS.length} combos`);
      }
    } else if (combosResult.status === "fulfilled" && !COMBOS.length) {
      console.warn("[Combo] Sheet fetch succeeded but no combos were parsed. Using fallback.");
      COMBOS.splice(0, COMBOS.length, ...FALLBACK_COMBOS);
      if (window.AURA) window.AURA.COMBOS = COMBOS;
      console.log(`[Combo] Fallback loaded: ${COMBOS.length} combos`);
    }

    renderHome();
    dispatchAuraReady();
  });
});
// Scroll to top button
  const scrollBtn = document.getElementById("scrollTopBtn");
  if(scrollBtn) {
    scrollBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    // Show only when See More / See All clicked
    document.querySelectorAll(".see-more, .see-all").forEach(link => {
      link.addEventListener("click", () => {
        scrollBtn.classList.add("visible");
      });
    });
  }
  // ===== WISHLIST =====
function productCardHTML(p){
  const badge = p.badge ? `<span class="badge">${esc(p.badge)}</span>` : "";
  const isLiked = safeLocalStorageGet("aura-wishlist", []).some(w=>w.name===p.name);
  const cardId = `card-${p.id}-${Date.now()}-${Math.random()}`;

  // Get prices from product data or fallback to defaults
  const prices = p.prices || { "20ml": 600, "30ml": 800, "50ml": 1000, "100ml": 1500 };
  const price20ml = prices["20ml"] || 600;
  const price30ml = prices["30ml"] || 800;
  const price50ml = prices["50ml"] || 1000;
  const price100ml = prices["100ml"] || 1500;

  // Get bottle and background images
  const bottleImage = p.bottleImage || p.image || DEFAULT_PERFUME_IMAGE;
  const background = p.background || getCategoryBackground(p.category || "Others");

  return `<div class="card" data-card-id="${cardId}" data-product-name="${esc(p.name)}">
    ${badge}
    <button class="btn-heart ${isLiked?'liked':''}" data-name="${esc(p.name)}" data-image="${bottleImage}" data-price="${price20ml}" aria-label="Save to wishlist">${isLiked?'♥':'♡'}</button>
    <div class="img-wrap">
      <img src="${bottleImage}" alt="${esc(p.name)}" loading="lazy">
    </div>
    <div class="body">
      <div>
        <h4>${esc(p.name)}</h4>
        <p class="cat-label">${esc(p.category||"")}</p>
      </div>
      <div class="size-selector" style="display:flex;gap:.4rem;margin-bottom:.75rem;flex-wrap:wrap">
        <button class="size-btn active" data-size="20ml" data-price="${price20ml}" style="flex:1;min-width:45px;padding:.4rem .5rem;border:1px solid var(--border);background:transparent;border-radius:.5rem;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-fg);cursor:pointer;transition:all .2s">20ml</button>
        <button class="size-btn" data-size="30ml" data-price="${price30ml}" style="flex:1;min-width:45px;padding:.4rem .5rem;border:1px solid var(--border);background:transparent;border-radius:.5rem;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-fg);cursor:pointer;transition:all .2s">30ml</button>
        <button class="size-btn" data-size="50ml" data-price="${price50ml}" style="flex:1;min-width:45px;padding:.4rem .5rem;border:1px solid var(--border);background:transparent;border-radius:.5rem;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-fg);cursor:pointer;transition:all .2s">50ml</button>
        <button class="size-btn" data-size="100ml" data-price="${price100ml}" style="flex:1;min-width:45px;padding:.4rem .5rem;border:1px solid var(--border);background:transparent;border-radius:.5rem;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-fg);cursor:pointer;transition:all .2s">100ml</button>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span class="price" data-base-price="${price20ml}">₹${price20ml}</span>
      </div>
      <button class="btn-buy" data-buy="${esc(p.name)}" data-selected-size="20ml" data-price="${price20ml}">Buy Now</button>
    </div>
  </div>`;
}


document.addEventListener("DOMContentLoaded", function(){
  let list = safeLocalStorageGet("aura-wishlist", []);

  const sidebar = document.getElementById("wlSidebar");
  const fab     = document.getElementById("wlFab");
  const overlay = document.getElementById("wlOverlay");
  const countEl = document.getElementById("wlCount");
  const titleEl = document.getElementById("wlTitle");
  const itemsEl = document.getElementById("wlItems");
  const emptyEl = document.getElementById("wlEmpty");
  const footerEl= document.getElementById("wlFooter");

  if(!sidebar) return;

  function save(){ localStorage.setItem("aura-wishlist", JSON.stringify(list)); }

  function render(){
    const n = list.length;
    countEl.textContent = n;
    const d = document.getElementById("wlCountDesktop");
    if(d) d.textContent = n;
    titleEl.textContent = n + " item" + (n!==1?"s":"");
    emptyEl.style.display = n === 0 ? "" : "none";
    footerEl.style.display = n === 0 ? "none" : "";
    itemsEl.innerHTML = list.map((p,i) => `
      <div class="wishlist-item">
        <img src="${p.image}" alt="${esc(p.name)}">
        <div class="wishlist-item-info">
          <div class="wishlist-item-name">${esc(p.name)}</div>
          <div class="wishlist-item-price">₹${p.price}</div>
          <button class="wishlist-item-buy" data-buy="${esc(p.name)}" data-price="${p.price}">Buy Now</button>
        </div>
        <button class="wishlist-item-remove" data-remove="${i}">✕</button>
      </div>
    `).join("");
    document.querySelectorAll(".btn-heart").forEach(btn => {
      const liked = list.some(p => p.name === btn.dataset.name);
      btn.classList.toggle("liked", liked);
      btn.textContent = liked ? "♥" : "♡";
    });
  }

  function open(){
    sidebar.classList.add("open");
    fab.classList.add("shifted");
    overlay.classList.add("show");
  }
  function close(){
    sidebar.classList.remove("open");
    fab.classList.remove("shifted");
    overlay.classList.remove("show");
  }

  fab.addEventListener("click", () => sidebar.classList.contains("open") ? close() : open());
  document.getElementById("wlClose").addEventListener("click", close);
  overlay.addEventListener("click", close);

  document.addEventListener("click", e => {
    const rem = e.target.closest("[data-remove]");
    if(rem){ list.splice(+rem.dataset.remove, 1); save(); render(); return; }

    const heart = e.target.closest(".btn-heart");
    if(heart){
      const name  = heart.dataset.name;
      const image = heart.dataset.image;
      const card = heart.closest(".card");
      const priceEl = card ? card.querySelector(".price") : null;
      const price = priceEl ? priceEl.textContent.replace("₹", "").trim() : (heart.dataset.price || "1000");
      const idx   = list.findIndex(p => p.name === name);
      if(idx === -1){
        list.push({name, image, price});
        heart.style.transform = "scale(1.4)";
        setTimeout(() => heart.style.transform = "", 200);
        open();
      } else {
        list.splice(idx, 1);
      }
      save(); render(); return;
    }
  });

  document.getElementById("wlSendWA").addEventListener("click", () => {
    if(!list.length) return;
    const msg = "Hi, I'd like to order from my Aura Lux wishlist:\n" +
      list.map((p,i) => `${i+1}. ${p.name} — ₹${p.price}`).join("\n");
    window.open(`https://wa.me/919539600019?text=${encodeURIComponent(msg)}`, "_blank");
  });

  render();
});
// ===== PARTICLES =====
(function(){
  const canvas = document.getElementById("particlesCanvas");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  const particles = Array.from({length: 40}, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2 + 0.5,
    speedX: Math.random() * 0.8 + 0.2,
    speedY: (Math.random() - 0.5) * 0.3,
    opacity: Math.random() * 0.6 + 0.2
  }));

  function animate(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201, 169, 110, ${p.opacity})`;
      ctx.fill();
      p.x += p.speedX;
      p.y += p.speedY;
      if(p.x > canvas.width) p.x = 0;
      if(p.y < 0) p.y = canvas.height;
      if(p.y > canvas.height) p.y = 0;
    });
    requestAnimationFrame(animate);
  }
  animate();
})();
// ===== HERO SLIDER =====
(function(){
  const slides = document.querySelectorAll(".hero-slide");
  const dots = document.querySelectorAll(".hero-dot");
  if(!slides.length) return;

  let current = 0;

  function goTo(n) {
    slides[current].classList.remove("active");
    dots[current].classList.remove("active");
    current = (n + slides.length) % slides.length;
    slides[current].classList.add("active");
    dots[current].classList.add("active");
  }

  // Auto advance every 5 seconds
  let timer = setInterval(() => goTo(current + 1), 5000);

  // Click dots
  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      clearInterval(timer);
      goTo(i);
      timer = setInterval(() => goTo(current + 1), 5000);
    });
  });
})();