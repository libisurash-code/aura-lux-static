// ============== AURA LUX — CONFIGURATION ==============

window.WHATSAPP_NUMBER          = "919539600019";
window.GOOGLE_SHEET_ID_PERFUMES = "1YD6wSGyVx84ldqZNOc9Vl1rMRNdZE61jD9G6It6KuA8";
window.GOOGLE_SHEET_ID_COMBO    = "1dSMplHYDhl4uL2sTQruVvFir3HapC2h3_oYQaL6Ubgs";

window.GOOGLE_SHEET_PERFUMES_URL = `https://docs.google.com/spreadsheets/d/${window.GOOGLE_SHEET_ID_PERFUMES}/gviz/tq?tqx=out:csv&sheet=perfumes`;
window.GOOGLE_SHEET_COMBO_URL    = `https://docs.google.com/spreadsheets/d/${window.GOOGLE_SHEET_ID_COMBO}/gviz/tq?tqx=out:csv&sheet=combo`;

console.log("[Config] ✅ Loaded");
console.log("[Config] Perfumes URL →", window.GOOGLE_SHEET_PERFUMES_URL);
console.log("[Config] Combos URL   →", window.GOOGLE_SHEET_COMBO_URL);