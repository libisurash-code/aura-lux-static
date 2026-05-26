// ============== AURA LUX — app-new.js (FIXED) ==============

if (window.__AURA_LOADED) {
  console.warn("AURA already initialized — skipping duplicate load.");
} 
window.__AURA_LOADED = true;

const WHATSAPP_NUMBER = window.WHATSAPP_NUMBER || "919539600019";
// Default to the published CSV URL provided by the owner. Can be overridden via window.GOOGLE_SHEET_PERFUMES_URL
const GOOGLE_SHEET_PERFUMES_URL = window.GOOGLE_SHEET_PERFUMES_URL || `https://docs.google.com/spreadsheets/d/e/2PACX-1vTvs4joWqG7VkzwPE5Y9xU8Rw5LW9sWe57bXIeWcBNrBXhh-VlkoFiXtsms9gJDK2rjFT6DNBQ8Txmq/pub?output=csv`;
const GOOGLE_SHEET_COMBO_URL = window.GOOGLE_SHEET_COMBO_URL || (window.GOOGLE_SHEET_COMBO_URL || "");

// Small inline SVG data-URL used as a safe placeholder when an image file is missing.
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#f4f0ea"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#9a8878" font-family="Arial,Helvetica,sans-serif" font-size="28">No Image</text></svg>');

const buyOnWhatsApp = (name) => {
  const msg = encodeURIComponent(`Hi, I want to buy ${name} from Aura Lux.`);
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
};

const inquireOnWhatsApp = () => {
  const msg = encodeURIComponent("Hi, I'd like to know more about Aura Lux perfumes.");
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
};

// ===== UTILITIES =====
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

const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// ===== DATA STATE =====
let PERFUMES = [];
let COMBOS = [];
let CATEGORIES = [];

// ===== IMAGE PATH RESOLVER =====
const resolveImagePath = (filename, folder = "perfumes") => {
  if (!filename) return { candidates: [PLACEHOLDER_IMAGE], original: "" };
  // Remove zero-width / BOM and trim whitespace/newlines
  let clean = String(filename).replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  if (!clean) return { candidates: [PLACEHOLDER_IMAGE], original: filename };
  if (/^https?:\/\//i.test(clean)) return { candidates: [clean], original: clean };
  // Strip any leading ./ or / or images/ prefix supplied by sheet
  clean = clean.replace(/^\.?\/+/, "").replace(/^images\//i, "");

  const base = `images/${folder}/`;
  const candidates = [];
  const extMatch = clean.match(/(\.[a-z0-9]{2,5})$/i);
  if (extMatch) {
    const name = clean.replace(/^\//, "");
    candidates.push(base + name);
    candidates.push(base + name.toLowerCase());
    candidates.push(base + name.replace(/\s+/g, ""));
    candidates.push(base + name.replace(/\s+/g, "").toLowerCase());
  } else {
    const tried = new Set();
    [".jpg", ".jpeg", ".png", ".webp", ".avif"].forEach(ext => {
      [clean, clean.toLowerCase(), clean.replace(/\s+/g, ""), clean.replace(/\s+/g, "").toLowerCase()].forEach(n => {
        const cand = base + n + ext;
        if (!tried.has(cand)) { candidates.push(cand); tried.add(cand); }
      });
    });
  }
  // Debug log to help trace generated candidates
  console.debug("[Images] resolveImagePath ->", { original: filename, folder, candidates });
  return { candidates, original: filename };
};

// ===== PERFUME PARSER =====
const buildPerfumeFromSheet = (item, index) => {
  const id = String(item.id || `perf-${index}`).trim();
  const name = String(item.name || item.product || item.title || "").trim();
  const category = String(item.category || item.type || item.group || "Others").trim();
  const image = resolveImagePath(item.image || item.img, "perfumes");
  const parsePrice = (val) => {
    const num = Number(String(val || "0").trim().replace(/[^0-9.]/g, ""));
    return isFinite(num) ? num : 0;
  };
  const prices = {
    "20ml": parsePrice(item["20ml"] || item["20 ml"]),
    "30ml": parsePrice(item["30ml"] || item["30 ml"]),
    "50ml": parsePrice(item["50ml"] || item["50 ml"]),
    "100ml": parsePrice(item["100ml"] || item["100 ml"])
  };
  if (!name) return null;
  return { id, name, category, bottleImage: image, background: `images/cat-others.jpg`, prices };
};

// ===== COMBO PARSER =====
const buildComboFromSheet = (item, index) => {
  const id = String(item.id || `combo-${index}`).trim();
  const name = String(item.name || item.combo || item.title || "").trim();
  const image = resolveImagePath(item.image || item.img, "combo");
  const price = String(item.price || item.amount || "0").trim().replace(/[^0-9.]/g, "");
  const size = String(item.size || item.ml || "").trim();
  const offer = String(item.offer || item.description || "").trim();
  if (!name) return null;
  return { id, name, image, price: price || "0", size: size || "Combo", offer: offer || name };
};

// ===== FETCH =====
const fetchPerfumesFromSheet = async () => {
  try {
    // Append timestamp to force a fresh CSV fetch (cache-busting). Store result in local cache as fallback.
    const url = GOOGLE_SHEET_PERFUMES_URL + (GOOGLE_SHEET_PERFUMES_URL.includes("?") ? "&" : "?") + "t=" + Date.now();
    console.debug('[Data] fetching perfumes CSV:', url);
    const csv = await cachedFetchText(url, "aura-perfumes-cache", 0);
    const rows = parseCSV(csv || "");
    console.debug('[Data] fetched CSV rows:', rows.length);
    const perfumes = rows.map(buildPerfumeFromSheet).filter(Boolean);
    if (perfumes.length === 0) throw new Error("No valid perfumes found in sheet");
    PERFUMES.splice(0, PERFUMES.length, ...perfumes);
    const cats = Array.from(new Set(PERFUMES.map(p => p.category).filter(Boolean)));
    CATEGORIES.splice(0, CATEGORIES.length, ...cats.sort());
    return perfumes;
  } catch (error) {
    console.error("[Data] Perfume fetch failed:", error.message);
    throw error;
  }
};

const fetchCombosFromSheet = async () => {
  const combosEl = typeof document !== 'undefined' ? document.getElementById('comboScroll') : null;
  if (combosEl) combosEl.innerHTML = '<div class="combo-loading" style="padding:1rem;text-align:center;">Loading combos…</div>';
  try {
    if (!GOOGLE_SHEET_COMBO_URL) {
      // No combo sheet provided — create fallback combos from PERFUMES so the UI remains populated.
      // This preserves the dynamic perfume loading while restoring the combo section exactly as cards.
      const fallback = PERFUMES.slice(0, 6).map((p, i) => ({
        id: `combo-fallback-${i}`,
        name: p.name ? `${p.name} Pair` : `Combo ${i + 1}`,
        image: (p.bottleImage && p.bottleImage.candidates) ? p.bottleImage : (Array.isArray(p.bottleImage) ? p.bottleImage : [p.bottleImage || PLACEHOLDER_IMAGE]),
        price: (p.prices && p.prices["30ml"]) ? String(p.prices["30ml"]) : "0",
        size: "Combo",
        offer: p.category || "Special"
      }));
      COMBOS.splice(0, COMBOS.length, ...fallback);
      console.debug('[Combos] using fallback combos derived from PERFUMES', COMBOS.length);
      console.log('[Combos] data', COMBOS);
      if (combosEl) combosEl.innerHTML = COMBOS.map(c => `<div>${comboCardHTML(c)}</div>`).join("");
      return COMBOS;
    }
    const url = GOOGLE_SHEET_COMBO_URL + (GOOGLE_SHEET_COMBO_URL.includes("?") ? "&" : "?") + "t=" + Date.now();
    console.debug('[Combos] fetching combos CSV:', url);
    const csv = await cachedFetchText(url, "aura-combos-cache", 0);
    const rows = parseCSV(csv || "");
    console.log('[Combos] raw rows (first 5):', rows.slice(0, 5));
    const combos = rows.map(buildComboFromSheet).filter(Boolean);
    COMBOS.splice(0, COMBOS.length, ...combos);
    console.debug('[Combos] parsed combos from sheet:', combos.length);
    console.log('[Combos] data', COMBOS);
    if (combosEl) combosEl.innerHTML = COMBOS.map(c => `<div>${comboCardHTML(c)}</div>`).join("");
    // If sheet provided but returned nothing, attempt fallback from PERFUMES
    if (COMBOS.length === 0 && PERFUMES.length > 0) {
      const fallback = PERFUMES.slice(0, 6).map((p, i) => ({
        id: `combo-fallback-${i}`,
        name: p.name ? `${p.name} Pair` : `Combo ${i + 1}`,
        image: (p.bottleImage && p.bottleImage.candidates) ? p.bottleImage : (Array.isArray(p.bottleImage) ? p.bottleImage : [p.bottleImage || PLACEHOLDER_IMAGE]),
        price: (p.prices && p.prices["30ml"]) ? String(p.prices["30ml"]) : "0",
        size: "Combo",
        offer: p.category || "Special"
      }));
      COMBOS.splice(0, COMBOS.length, ...fallback);
      console.debug('[Combos] sheet empty — fallback combos created from PERFUMES', COMBOS.length);
      console.log('[Combos] data (fallback)', COMBOS);
      if (combosEl) combosEl.innerHTML = COMBOS.map(c => `<div>${comboCardHTML(c)}</div>`).join("");
    }
    return COMBOS;
  } catch (error) {
    console.error("[Data] Combo fetch failed:", error && error.message ? error.message : error);
    // On failure, fall back to PERFUMES-derived combos so the UI remains usable
    if (PERFUMES.length > 0) {
      const fallback = PERFUMES.slice(0, 6).map((p, i) => ({
        id: `combo-fallback-${i}`,
        name: p.name ? `${p.name} Pair` : `Combo ${i + 1}`,
        image: (p.bottleImage && p.bottleImage.candidates) ? p.bottleImage : (Array.isArray(p.bottleImage) ? p.bottleImage : [p.bottleImage || PLACEHOLDER_IMAGE]),
        price: (p.prices && p.prices["30ml"]) ? String(p.prices["30ml"]) : "0",
        size: "Combo",
        offer: p.category || "Special"
      }));
      COMBOS.splice(0, COMBOS.length, ...fallback);
      console.debug('[Combos] fallback created after fetch error', COMBOS.length);
      console.log('[Combos] data (fallback on error)', COMBOS);
      if (combosEl) combosEl.innerHTML = COMBOS.map(c => `<div>${comboCardHTML(c)}</div>`).join("");
      return COMBOS;
    }
    if (combosEl) combosEl.innerHTML = '<div class="combo-error" style="padding:1rem;text-align:center;color:#b33;">Failed to load combos</div>';
    return COMBOS;
  }
};

// ===== WISHLIST HELPERS =====
function getWishlist() {
  return safeLocalStorageGet("aura-wishlist", []);
}
function saveWishlist(list) {
  safeLocalStorageSet("aura-wishlist", list);
}

function updateWishlistCount() {
  const count = getWishlist().length;
  const wlCount        = document.getElementById("wlCount");
  const wlCountDesktop = document.getElementById("wlCountDesktop");
  const wlTitle        = document.getElementById("wlTitle");
  if (wlCount)        wlCount.textContent        = count;
  if (wlCountDesktop) wlCountDesktop.textContent = count;
  if (wlTitle)        wlTitle.textContent        = `${count} item${count !== 1 ? "s" : ""}`;
}

function syncHeartButtons() {
  const list = getWishlist();
  document.querySelectorAll(".btn-heart").forEach(btn => {
    const liked = list.some(w => w.name === btn.dataset.name);
    btn.classList.toggle("liked", liked);
    btn.textContent = liked ? "♥" : "♡";
  });
}

function renderWishlistSidebar() {
  const itemsEl  = document.getElementById("wlItems");
  const emptyEl  = document.getElementById("wlEmpty");
  const footerEl = document.getElementById("wlFooter");
  if (!itemsEl) return;

  const list = getWishlist();

  if (list.length === 0) {
    itemsEl.innerHTML = "";
    if (emptyEl)  emptyEl.style.display  = "";
    if (footerEl) footerEl.style.display = "none";
    updateWishlistCount();
    return;
  }

  if (emptyEl)  emptyEl.style.display  = "none";
  if (footerEl) footerEl.style.display = "";

  itemsEl.innerHTML = list.map((item, idx) => `
    <div class="wishlist-item" data-idx="${idx}">
      <img
        src="${PLACEHOLDER_IMAGE}"
        data-candidates='${esc(JSON.stringify((item.image && item.image.candidates) ? item.image.candidates : (Array.isArray(item.image) ? item.image : [item.image || PLACEHOLDER_IMAGE])))}'
        alt="${esc(item.name)}"
        onerror="this.onerror=null;this.src='${PLACEHOLDER_IMAGE}'"
      >
      <div class="wishlist-item-info">
        <div class="wishlist-item-name">${esc(item.name)}</div>
        <div class="wishlist-item-price">₹${item.price || "–"}</div>
        <button
          class="wishlist-item-buy"
          data-wl-buy="${esc(item.name)}"
          data-wl-price="${item.price || ''}"
        >Buy on WhatsApp</button>
      </div>
      <button class="wishlist-item-remove" data-remove="${idx}" aria-label="Remove">✕</button>
    </div>
  `).join("");
  updateWishlistCount();
  // Resolve wishlist images
  hydrateImages().catch(e => console.error('[Images] hydrateImages failed', e));
}

function openWishlist() {
  renderWishlistSidebar();
  const sidebar = document.getElementById("wlSidebar");
  const overlay = document.getElementById("wlOverlay");
  if (sidebar) sidebar.classList.add("open");
  if (overlay) overlay.classList.add("show");
  document.body.style.overflow = "hidden";
}

function closeWishlist() {
  const sidebar = document.getElementById("wlSidebar");
  const overlay = document.getElementById("wlOverlay");
  if (sidebar) sidebar.classList.remove("open");
  if (overlay) overlay.classList.remove("show");
  document.body.style.overflow = "";
}

function initWishlist() {
  // Open
  ["wlFab", "wlFabDesktop"].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", openWishlist);
  });

  // Close button
  const closeBtn = document.getElementById("wlClose");
  if (closeBtn) closeBtn.addEventListener("click", closeWishlist);

  // Overlay click
  const overlay = document.getElementById("wlOverlay");
  if (overlay) overlay.addEventListener("click", closeWishlist);

  // Sidebar delegated clicks (remove + buy)
  const sidebar = document.getElementById("wlSidebar");
  if (sidebar) {
    sidebar.addEventListener("click", e => {
      // Remove item
      const removeBtn = e.target.closest("[data-remove]");
      if (removeBtn) {
        const idx = parseInt(removeBtn.dataset.remove);
        const list = getWishlist();
        list.splice(idx, 1);
        saveWishlist(list);
        renderWishlistSidebar();
        syncHeartButtons();
        return;
      }
      // Buy from sidebar
      const buyBtn = e.target.closest("[data-wl-buy]");
      if (buyBtn) {
        const name  = buyBtn.dataset.wlBuy;
        const price = buyBtn.dataset.wlPrice;
        const msg   = encodeURIComponent(
          `Hi, I want to buy ${name}${price ? " — ₹" + price : ""} from Aura Lux.`
        );
        window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
        return;
      }
    });
  }

  // Send full wishlist on WhatsApp
  const sendWA = document.getElementById("wlSendWA");
  if (sendWA) {
    sendWA.addEventListener("click", () => {
      const list = getWishlist();
      if (!list.length) return;
      const lines = list.map(
        (item, i) => `${i + 1}. ${item.name}${item.price ? " — ₹" + item.price : ""}`
      );
      const msg = encodeURIComponent(
        `Hi! I'd like to order the following perfumes from Aura Lux:\n\n${lines.join("\n")}\n\nPlease confirm availability.`
      );
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
    });
  }

  updateWishlistCount();
}

// ===== UI: PRODUCT CARD =====
function productCardHTML(p) {
  const badge = p.badge ? `<span class="badge">${esc(p.badge)}</span>` : "";
  const isLiked = getWishlist().some(w => w.name === p.name);

  const prices = p.prices || { "20ml": 0, "30ml": 0, "50ml": 0, "100ml": 0 };
  const price20ml = prices["20ml"] || 0;
  const price30ml = prices["30ml"] || 0;
  const price50ml = prices["50ml"] || 0;
  const price100ml = prices["100ml"] || 0;

  const bottleImage = p.bottleImage || PLACEHOLDER_IMAGE;
  const bottleCandidates =
    bottleImage && bottleImage.candidates
      ? bottleImage.candidates
      : Array.isArray(bottleImage)
      ? bottleImage
      : [bottleImage];

  return `<div class="card" data-product-name="${esc(p.name)}">
    ${badge}

    <button class="btn-heart ${isLiked ? "liked" : ""}"
      data-name="${esc(p.name)}"
      data-image="${esc(bottleCandidates[0] || PLACEHOLDER_IMAGE)}"
      data-price="${price20ml}"
      aria-label="Save to wishlist">${isLiked ? "♥" : "♡"}</button>

    <div class="img-wrap">
      <img src="${PLACEHOLDER_IMAGE}"
        data-candidates='${esc(JSON.stringify(bottleCandidates))}'
        alt="${esc(p.name)}"
        loading="lazy"
        onerror="this.onerror=null;this.src='${PLACEHOLDER_IMAGE}'">
    </div>

    <div class="body">
      <div>
        <h4>${esc(p.name)}</h4>
        <p class="cat-label">${esc(p.category || "")}</p>
      </div>

      <div class="size-selector" style="display:flex;gap:.4rem;margin-bottom:.75rem;flex-wrap:wrap">
        <button class="size-btn active" data-size="20ml" data-price="${price20ml}" style="flex:1;min-width:45px;padding:.4rem .5rem;border:1px solid var(--border);background:linear-gradient(135deg,#d4a64f,#8a6826);color:#fff;border-radius:.5rem;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:all .2s">20ml</button>

        <button class="size-btn" data-size="30ml" data-price="${price30ml}" style="flex:1;min-width:45px;padding:.4rem .5rem;border:1px solid var(--border);background:transparent;color:var(--muted-fg);border-radius:.5rem;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:all .2s">30ml</button>

        <button class="size-btn" data-size="50ml" data-price="${price50ml}" style="flex:1;min-width:45px;padding:.4rem .5rem;border:1px solid var(--border);background:transparent;color:var(--muted-fg);border-radius:.5rem;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:all .2s">50ml</button>

        <button class="size-btn" data-size="100ml" data-price="${price100ml}" style="flex:1;min-width:45px;padding:.4rem .5rem;border:1px solid var(--border);background:transparent;color:var(--muted-fg);border-radius:.5rem;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:all .2s">100ml</button>
      </div>

      <p class="price">₹${price20ml}</p>

      <button class="btn-buy"
        data-buy="${esc(p.name)}"
        data-price="${price20ml}"
        data-size="20ml">Buy Now</button>
    </div>
  </div>`;
}

// ===== UI: COMBO CARD =====
function comboCardHTML(c) {
  const comboImg = c.image || PLACEHOLDER_IMAGE;
  const comboCandidates = (comboImg && comboImg.candidates) ? comboImg.candidates : (Array.isArray(comboImg) ? comboImg : [comboImg]);
  return `<div class="combo">
    <div class="img-wrap">
      <img src="${PLACEHOLDER_IMAGE}" data-candidates='${esc(JSON.stringify(comboCandidates))}' alt="${esc(c.name)}" loading="lazy"
           onerror="this.onerror=null;this.src='${PLACEHOLDER_IMAGE}'">
    </div>
    <div class="body">
      <span class="offer">${esc(c.offer)}</span>
      <h4>${esc(c.name)}</h4>
      <button class="btn-buy" data-buy="${esc(c.name)}" data-price="${esc(c.price)}" data-size="${esc(c.size)}">Explore Combo</button>
    </div>
  </div>`;
}

// ===== RENDER HOME =====
function renderHome() {
  const sets1  = document.getElementById("setsScroll1");
  const combos = document.getElementById("comboScroll");

  if (sets1 && PERFUMES.length > 0) {
    sets1.innerHTML = PERFUMES.slice(0, 8).map(p => `<div>${productCardHTML(p)}</div>`).join("");
  }
  if (combos) {
    combos.innerHTML = COMBOS.map(c => `<div>${comboCardHTML(c)}</div>`).join("");
  }
  // After inserting HTML, attempt to resolve actual image URLs asynchronously
  hydrateImages().catch(e => console.error('[Images] hydrateImages failed', e));
}

// ===== STORE PAGE =====
function initStorePage(opts) {
  const { source, pageSize = 12 } = opts;
  const params = new URLSearchParams(location.search);
  let cat = params.get("cat") || "All";
  let query = "";
  let minPrice = "";
  let maxPrice = "";
  let selectedSize = "20ml";
  let visible = pageSize;

  const grid     = document.getElementById("productGrid");
  const empty    = document.getElementById("emptyState");
  const loadWrap = document.getElementById("loadMoreWrap");
  const countEl  = document.getElementById("countLabel");
  const search   = document.getElementById("searchInput");
  const chipsWrap = document.getElementById("chips");

  ["All", ...CATEGORIES].forEach(c => {
    const b = document.createElement("button");
    b.className = "chip" + (c === cat ? " active" : "");
    b.textContent = c;
    b.addEventListener("click", () => {
      cat = c; visible = pageSize;
      const u = new URL(location.href);
      if (c === "All") u.searchParams.delete("cat"); else u.searchParams.set("cat", c);
      history.replaceState(null, "", u);
      [...chipsWrap.children].forEach(ch => ch.classList.toggle("active", ch.textContent === c));
      render();
    });
    chipsWrap.appendChild(b);
  });

  const priceFilterWrap = document.createElement("div");
  priceFilterWrap.className = "price-filter";
  priceFilterWrap.innerHTML = `
    <div class="price-inputs">
      <input type="number" id="minPrice" placeholder="Min ₹" min="0">
      <span>—</span>
      <input type="number" id="maxPrice" placeholder="Max ₹" min="0">
    </div>
    <select id="priceSizeFilter">
      <option value="20ml">20ml</option>
      <option value="30ml">30ml</option>
      <option value="50ml">50ml</option>
      <option value="100ml">100ml</option>
    </select>`;
  chipsWrap.appendChild(priceFilterWrap);

  const minPriceInput = document.getElementById("minPrice");
  const maxPriceInput = document.getElementById("maxPrice");
  const sizeFilter    = document.getElementById("priceSizeFilter");

  [minPriceInput, maxPriceInput, sizeFilter].forEach(el => {
    el.addEventListener("input", () => {
      minPrice = minPriceInput.value;
      maxPrice = maxPriceInput.value;
      selectedSize = sizeFilter.value;
      visible = pageSize;
      render();
    });
  });

  if (search) search.addEventListener("input", e => { query = e.target.value; visible = pageSize; render(); });

  function getFiltered() {
    return source.filter(p => {
      if (cat !== "All" && p.category !== cat) return false;
      if (query.trim() && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (minPrice || maxPrice) {
        const productPrice = p.prices ? p.prices[selectedSize] : p.price;
        if (!productPrice) return false;
        const min = minPrice ? parseInt(minPrice) : 0;
        const max = maxPrice ? parseInt(maxPrice) : Infinity;
        if (productPrice < min || productPrice > max) return false;
      }
      return true;
    });
  }

  function render() {
    const f = getFiltered();
    if (f.length === 0) {
      grid.innerHTML = ""; empty.style.display = "";
      loadWrap.style.display = "none"; countEl.style.display = "none";
      return;
    }
    empty.style.display = "none";
    grid.innerHTML = f.slice(0, visible).map(productCardHTML).join("");
    loadWrap.style.display = visible < f.length ? "" : "none";
    countEl.style.display = "";
    countEl.textContent = `Showing ${Math.min(visible, f.length)} of ${f.length}`;
    // Resolve image URLs for newly rendered items
    hydrateImages().catch(e => console.error('[Images] hydrateImages failed', e));
  }

  document.getElementById("loadMoreBtn").addEventListener("click", () => {
    const f = getFiltered(); visible = Math.min(visible + pageSize, f.length); render();
  });

  const sentinel = document.getElementById("sentinel");
  if (sentinel) {
    new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        const f = getFiltered();
        if (visible < f.length) { visible = Math.min(visible + pageSize, f.length); render(); }
      }
    }, { rootMargin: "300px" }).observe(sentinel);
  }

  render();
}

// ===== GLOBAL CLICK HANDLER =====
document.addEventListener("click", e => {
  // ── Heart / wishlist toggle ──
  if (e.target.closest(".btn-heart")) {
    const btn   = e.target.closest(".btn-heart");
    const name  = btn.dataset.name;
    const image = btn.dataset.image;
    const price = btn.dataset.price;
    const list  = getWishlist();
    const idx   = list.findIndex(w => w.name === name);
    if (idx >= 0) {
      list.splice(idx, 1);
      btn.classList.remove("liked");
      btn.textContent = "♡";
    } else {
      list.push({ name, image, price });
      btn.classList.add("liked");
      btn.textContent = "♥";
    }
    saveWishlist(list);
    updateWishlistCount();
    return; // don't fall through to buy handler
  }

  // ── Size selector ──
  if (e.target.closest(".size-btn")) {
    const btn   = e.target.closest(".size-btn");
    const card  = btn.closest(".card");
    const priceEl = card.querySelector(".price");
    const buyBtn  = card.querySelector(".btn-buy");
    const size    = btn.dataset.size;
    const price   = btn.dataset.price;

    card.querySelectorAll(".size-btn").forEach(b => {
      b.classList.remove("active");
      b.style.background = "transparent";
      b.style.color = "var(--muted-fg)";
    });
    btn.classList.add("active");
    btn.style.background = "linear-gradient(135deg,#d4a64f,#8a6826)";
    btn.style.color = "#fff";

    if (priceEl) priceEl.textContent = "₹" + price;
    if (buyBtn) {
      buyBtn.dataset.price = price;
      buyBtn.dataset.selectedSize = size;
      buyBtn.textContent = `Buy Now (${size})`;
    }
    // update heart price too
    const heartBtn = card.querySelector(".btn-heart");
    if (heartBtn) heartBtn.dataset.price = price;
    return;
  }

  // ── Buy button ──
  const buyBtn = e.target.closest("[data-buy]");
  if (buyBtn && !buyBtn.closest(".wishlist-sidebar")) {
    const name = buyBtn.dataset.buy;
    const size = buyBtn.dataset.selectedSize || buyBtn.dataset.size || "";
    const card = buyBtn.closest(".card");
    const priceEl = card ? card.querySelector(".price") : null;
    const price = buyBtn.dataset.price || (priceEl ? priceEl.textContent.replace("₹", "").trim() : "");
    const sizeInfo = size ? ` - ${size}` : "";
    buyOnWhatsApp(`${name}${sizeInfo}${price ? " - ₹" + price : ""}`);
    return;
  }

  // ── WhatsApp FAB ──
  if (e.target.closest("#fabWA")) {
    inquireOnWhatsApp();
  }
});

// ===== ANIMATIONS =====
function initRevealAnimations() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("visible"); obs.unobserve(entry.target); }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll(".reveal").forEach(el => obs.observe(el));
}

// ===== HERO SLIDER =====
function initHeroSlider() {
  const slides = document.querySelectorAll(".hero-slide");
  const dots   = document.querySelectorAll(".hero-dot");
  if (!slides.length) return;
  let current = 0;

  function goTo(i) {
    slides[current].classList.remove("active");
    dots[current] && dots[current].classList.remove("active");
    current = i;
    slides[current].classList.add("active");
    dots[current] && dots[current].classList.add("active");
  }

  dots.forEach((dot, i) => dot.addEventListener("click", () => goTo(i)));
  setInterval(() => goTo((current + 1) % slides.length), 5000);
}

// ===== SPLASH =====
function initSplash() {
  const s = document.getElementById("splash");
  if (!s) return;
  if (safeSessionStorageGet("aura-splash-shown")) { s.remove(); return; }
  setTimeout(() => s.classList.add("fade"), 2000);
  setTimeout(() => {
    if (s.parentNode) s.parentNode.removeChild(s);
    try { sessionStorage.setItem("aura-splash-shown", "1"); } catch {}
  }, 2800);
}

// ===== SCROLL TO TOP =====
function initScrollTop() {
  const btn = document.getElementById("scrollTopBtn");
  if (!btn) return;
  window.addEventListener("scroll", () => {
    btn.classList.toggle("visible", window.scrollY > 400);
  });
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

// ===== IMAGE HYDRATOR =====
async function hydrateImages() {
  const imgs = Array.from(document.querySelectorAll('img[data-candidates]'));
  if (!imgs.length) return;
  for (const img of imgs) {
    try {
      const raw = img.getAttribute('data-candidates');
      if (!raw) continue;
      const candidates = JSON.parse(raw);
      let chosen = null;
      for (const cand of candidates) {
        if (!cand) continue;
        try {
          console.debug('[Images] trying', cand);
          const res = await fetch(cand, { method: 'HEAD', cache: 'no-store' });
          if (res && res.ok) { chosen = cand; break; }
        } catch (headErr) {
          try {
            const res2 = await fetch(cand, { method: 'GET', cache: 'no-store' });
            if (res2 && res2.ok) { chosen = cand; break; }
          } catch (getErr) {
            // ignore and try next candidate
          }
        }
      }
      if (chosen) {
        img.src = chosen;
        console.debug('[Images] loaded', chosen, 'for', img.alt || img.dataset.name || 'unknown');
      } else {
        img.src = PLACEHOLDER_IMAGE;
        console.debug('[Images] no candidate found for', img.getAttribute('data-candidates'));
      }
    } catch (err) {
      console.error('[Images] hydrate error', err);
      img.src = PLACEHOLDER_IMAGE;
    }
  }
}

// ===== BOOT =====
document.addEventListener("DOMContentLoaded", () => {
  if (window.__AURA_BOOTED) return;
  window.__AURA_BOOTED = true;
  // Year
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  // Mobile menu
  const menuToggle = document.querySelector(".menu-toggle");
  const navLinks   = document.querySelector(".nav-links");
  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      navLinks.classList.toggle("active");
      menuToggle.classList.toggle("open");
    });
    navLinks.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        menuToggle.classList.remove("open");
      });
    });
  }

  initSplash();
  initHeroSlider();
  initRevealAnimations();
  initScrollTop();
  initWishlist(); // ← FIXED: wires up the sidebar open/close + render

  // Fetch data then render
  Promise.all([
    fetchPerfumesFromSheet().catch(e => { console.error("[Boot] Perfume fetch failed:", e); return null; }),
    fetchCombosFromSheet().catch(e => { console.error("[Boot] Combo fetch failed:", e); return null; })
  ]).then(() => {
    renderHome();
    if (window._auraReadyCb) { window._auraReadyCb(); window._auraReadyCb = null; }
  });
});

// ===== AURA NAMESPACE =====
window.AURA = {
  PERFUMES: () => PERFUMES,
  COMBOS: () => COMBOS,
  CATEGORIES: () => CATEGORIES,
  ALL_PRODUCTS: () => PERFUMES,
  fetchPerfumesFromSheet,
  fetchCombosFromSheet,
  renderHome,
  initStorePage
};

window.onAuraReady = function(cb) {
  if (PERFUMES.length > 0) { cb(); } else { window._auraReadyCb = cb; }
};