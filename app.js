(() => {
// ---------------- DOM helpers ----------------
const $ = (sel) => document.querySelector(sel);
const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };

const overlay = $("#homeOverlay");
const stage = $("#stage");
const hudEls = [$("#hud"), $("#controls"), $("#gestureHint")].filter(Boolean);

const playBtn = $("#playBtn");
const searchBtn = $("#searchBtn");
const searchPanel = $("#searchPanel");
const searchForm = $("#searchForm");
const searchInput = $("#searchInput");
const searchResults = $("#searchResults");

function hideOverlay() { if (overlay) overlay.classList.add("hidden"); }
function showOverlaySub(txt) { setText("#homeOverlay .sub", txt); }

function toggleHUD() {
hudEls.forEach(el => el.classList.toggle("hidden"));
}
function showHUD() { hudEls.forEach(el => el.classList.remove("hidden")); }
function hideHUD() { hudEls.forEach(el => el.classList.add("hidden")); }

// ---------------- state ----------------
const RITUAL_MS = 7000; // tempo base (6–10; tu hai scelto 7)
const MANUAL_HOLD_MS = 10000; // modalità B: manuale per 10s dopo swipe
const FETCH_TIMEOUT_MS = 8000; // guardrail iOS
const BIG_TARGET = 300;
const NORMAL_TARGET = 120;

let running = false;
let ritualTimer = null;
let tickTimer = null;
let seconds = 0;

// Exhibition engine
// An exhibition is: { title, subtitle, items: [Item], sourceTag }
// Item: { provider, id, title, sub, image }
let currentEx = null;
let queue = [];
let idx = 0;

// History for prev/next
let history = []; // Items visited in order
let hIndex = -1; // pointer in history

// Manual mode after swipe
let manualUntil = 0;

// Rotation when idle: rotate coherent exhibitions (not random works)
const lenses = [
"Impressionism",
"Renaissance",
"Baroque",
"Cubism",
"Japanese print",
"Portrait",
"Landscape",
"Still life",
"Sculpture",
"Fresco",
"Mythology"
];

// ---------------- time/meta ----------------
function fmtTime(s) {
const mm = String(Math.floor(s / 60)).padStart(2, "0");
const ss = String(s % 60).padStart(2, "0");
return `${mm}:${ss}`;
}
function startClock() {
stopClock();
seconds = 0;
tickTimer = setInterval(() => {
seconds++;
setText("#meta", `${fmtTime(seconds)} · ${running ? "running" : "paused"}`);
}, 1000);
}
function stopClock() {
if (tickTimer) clearInterval(tickTimer);
tickTimer = null;
}

// ---------------- image render ----------------
function setStageImage(url) {
if (!stage) return;
stage.innerHTML = "";
const img = new Image();
img.decoding = "async";
img.loading = "eager";
img.alt = "";
img.style.position = "absolute";
img.style.inset = "0";
img.style.width = "100%";
img.style.height = "100%";
img.style.objectFit = "contain";
img.src = url;
stage.appendChild(img);
}

// ---------------- network with timeout ----------------
async function fetchJSON(url, timeoutMs = FETCH_TIMEOUT_MS) {
const controller = new AbortController();
const t = setTimeout(() => controller.abort(), timeoutMs);
try {
const r = await fetch(url, { cache: "no-store", signal: controller.signal });
if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
return await r.json();
} finally {
clearTimeout(t);
}
}

// ---------------- provider: AIC ----------------
function aicImg(imageId, max = 2400) {
return `https://www.artic.edu/iiif/2/${imageId}/full/!${max},${max}/0/default.jpg`;
}
function normAIC(x) {
return {
provider: "aic",
id: String(x.id),
title: x.title || "Untitled",
sub: x.artist_title || "Art Institute of Chicago",
image: x.image_id ? aicImg(x.image_id) : null
};
}

async function aicSearchPaged(query, targetCount) {
const q = encodeURIComponent(query.trim());
const perPage = 100;
const maxPages = Math.ceil(targetCount / perPage) + 2;
const out = [];
const ids = new Set();

for (let page = 1; page <= maxPages; page++) {
const url =
`https://api.artic.edu/api/v1/artworks/search?q=${q}` +
`&fields=id,title,artist_title,image_id&limit=${perPage}&page=${page}` +
`&query[term][is_public_domain]=true`;

let json;
try { json = await fetchJSON(url); }
catch (e) { console.warn("AIC page failed", page, e); continue; }

const data = json?.data || [];
if (!data.length) break;

for (const d of data) {
if (!d.image_id) continue;
const it = normAIC(d);
if (!it.image) continue;
if (ids.has(it.id)) continue;
ids.add(it.id);
out.push(it);
if (out.length >= targetCount) return out;
}
}
return out;
}

async function aicRandomBatch(batchSize = 30) {
const page = 1 + Math.floor(Math.random() * 500);
const url =
`https://api.artic.edu/api/v1/artworks/search?` +
`query[term][is_public_domain]=true&fields=id,title,artist_title,image_id&` +
`limit=${batchSize}&page=${page}`;
const json = await fetchJSON(url);
const data = json?.data || [];
return data.filter(d => d.image_id).map(normAIC).filter(it => it.image);
}

// ---------------- provider: Wikidata/Commons (artist heavy) ----------------
async function wdEntityQID(query) {
const url =
`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}` +
`&language=en&format=json&origin=*`;
const json = await fetchJSON(url);
return json?.search?.[0]?.id || null; // e.g. Q5592
}

function commonsFileNameFromURL(url) {
try {
const u = new URL(url);
const last = u.pathname.split("/").pop();
return decodeURIComponent(last || "");
} catch { return ""; }
}

function commonsIIIF(fileName, max = 2400) {
const name = fileName.startsWith("File:") ? fileName : `File:${fileName}`;
return `https://iiif.wmcloud.org/iiif/commons/${encodeURIComponent(name)}/full/!${max},${max}/0/default.jpg`;
}

function normWD(row) {
const label = row?.itemLabel?.value || "Untitled";
const img = row?.image?.value || "";
const fileName = commonsFileNameFromURL(img);
const iiif = fileName ? commonsIIIF(fileName) : null;
const qid = row?.item?.value?.split("/").pop() || label;

return {
provider: "wikidata",
id: String(qid),
title: label,
sub: "Wikidata / Commons",
image: iiif
};
}

async function wdArtistWorks(query, targetCount) {
const qid = await wdEntityQID(query);
if (!qid) return [];

const pageSize = 50;
const maxPages = Math.ceil(targetCount / pageSize) + 1;

const out = [];
const ids = new Set();

for (let p = 0; p < maxPages; p++) {
const offset = p * pageSize;
const sparql = `
SELECT ?item ?itemLabel ?image WHERE {
?item wdt:P170 wd:${qid} .
?item wdt:P18 ?image .
SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${pageSize}
OFFSET ${offset}
`.trim();

const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;

let json;
try { json = await fetchJSON(url, 10000); }
catch (e) { console.warn("Wikidata page failed", p, e); continue; }

const rows = json?.results?.bindings || [];
if (!rows.length) break;

for (const r of rows) {
const it = normWD(r);
if (!it.image) continue;
if (ids.has(it.id)) continue;
ids.add(it.id);
out.push(it);
if (out.length >= targetCount) return out;
}
}
return out;
}

// ---------------- AI light 50% (museum-like, not encyclopedia) ----------------
// No external AI: we generate light prompts. 50% chance.
const noteBank = [
"Stay with the light for a moment.",
"Notice the hands — they carry the tension.",
"Look at the background: it’s not empty.",
"Follow the lines before the subject.",
"Watch where the silence is placed.",
"The composition is doing the emotion.",
"Look for the smallest detail that changes everything."
];
function maybeNote() {
if (Math.random() < 0.5) {
const n = noteBank[Math.floor(Math.random() * noteBank.length)];
setText("#hSub", n);
setTimeout(() => {
const cur = history[hIndex] || queue[idx] || null;
if (cur) setText("#hSub", cur.sub || "—");
}, 2600);
}
}

// ---------------- exhibition builder ----------------
function targetForQuery(q) {
const s = q.toLowerCase();
const big = ["picasso","michelangelo","caravaggio","rembrandt","monet","vangogh","van gogh","warhol"];
if (big.some(k => s.includes(k))) return BIG_TARGET;
return NORMAL_TARGET;
}

function resetPlayback(items, title, subtitle, sourceTag) {
currentEx = { title, subtitle, sourceTag };
queue = items.filter(it => it && it.image);
idx = 0;

history = [];
hIndex = -1;

setText("#hTitle", title || "—");
setText("#hSub", subtitle || "—");
}

async function buildExhibition(query) {
const q = query.trim();
const target = targetForQuery(q);

showOverlaySub("Building exhibition…");

// AIC always
const aicItems = await aicSearchPaged(q, Math.min(target, 300));

// Add Wikidata for “serious” artists or if AIC is thin
const needWD = q.toLowerCase().includes("michelangelo") || aicItems.length < 60;
let wdItems = [];
if (needWD) {
wdItems = await wdArtistWorks(q, Math.max(120, target - aicItems.length));
}

// Merge + trim
const merged = [];
const mset = new Set();
for (const it of [...aicItems, ...wdItems]) {
const key = it.provider + ":" + it.id;
if (mset.has(key)) continue;
mset.add(key);
merged.push(it);
if (merged.length >= target) break;
}

if (merged.length < 15) {
// Fallback: coherent lens exhibition from AIC random
const fallback = await aicRandomBatch(60);
resetPlayback(fallback, q, "Not enough matches · showing chance works", "fallback");
hideOverlay();
return;
}

const src = needWD ? "AIC + Commons" : "AIC";
resetPlayback(merged, q, `Exhibition · ${merged.length} works · ${src}`, "search");
hideOverlay();
}

async function buildNextIdleExhibition() {
// Coherent “chance”: pick a lens, build a proper exhibition (not random works)
const lens = lenses[Math.floor(Math.random() * lenses.length)];
await buildExhibition(lens);
}

// ---------------- player (next/prev + history) ----------------
function showItem(item) {
if (!item || !item.image) return;
setStageImage(item.image);
setText("#hTitle", item.title || "Untitled");
setText("#hSub", item.sub || (currentEx?.subtitle || "—"));
maybeNote();
}

function nextItem() {
// If we are in history and can go forward, use it
if (hIndex + 1 < history.length) {
hIndex++;
showItem(history[hIndex]);
return;
}

// Else take from queue
const item = queue[idx];
if (!item) return;

history.push(item);
hIndex = history.length - 1;
showItem(item);

idx++;
if (idx >= queue.length) {
// End of this exhibition: rotate to a new coherent exhibition automatically
// (keeps “infinite exhibitions”)
idx = queue.length; // lock
scheduleRotateExhibition();
}
}

function prevItem() {
if (hIndex > 0) {
hIndex--;
showItem(history[hIndex]);
}
}

// ---------------- ritual loop ----------------
function startRitual() {
running = true;
if (playBtn) playBtn.textContent = "⏸";
setText("#meta", `${fmtTime(seconds)} · running`);

nextItem();
clearInterval(ritualTimer);
ritualTimer = setInterval(() => {
// If user swiped recently (manual mode), do not auto-advance
if (Date.now() < manualUntil) return;
nextItem();
}, RITUAL_MS);
}

function stopRitual(reason = "") {
running = false;
if (playBtn) playBtn.textContent = "▶";
setText("#meta", `${fmtTime(seconds)} · paused${reason ? " · " + reason : ""}`);
if (ritualTimer) clearInterval(ritualTimer);
ritualTimer = null;
}

function togglePlay() {
if (running) stopRitual("");
else startRitual();
}

let rotateTimer = null;
async function scheduleRotateExhibition() {
if (rotateTimer) clearTimeout(rotateTimer);

// After an exhibition ends, load another one after a short breath
rotateTimer = setTimeout(async () => {
try {
showOverlaySub("Loading next exhibition…");
if (overlay) overlay.classList.remove("hidden"); // show overlay briefly
await buildNextIdleExhibition();
// Make sure we continue running
if (!running) startRitual();
} catch (e) {
console.error(e);
showOverlaySub("Retrying…");
scheduleRotateExhibition();
}
}, 900);
}

// ---------------- gestures (mobile-friendly) ----------------
// Tap single: toggle HUD (no stop)
// Double tap: play/pause
// Swipe left/right: next/prev + manual mode 10s (B)

let lastTapTs = 0;

function onStageTap() {
const now = Date.now();
if (now - lastTapTs < 260) {
// double tap
lastTapTs = 0;
togglePlay();
return;
}
lastTapTs = now;
// single tap: toggle UI
toggleHUD();
}

// Swipe detection (simple)
let touchX = null;
let touchY = null;

function startManualHold() {
manualUntil = Date.now() + MANUAL_HOLD_MS;
// Keep playing, but pause auto-advance for the hold window
// (the interval checks manualUntil)
}

function onTouchStart(e) {
const t = e.touches?.[0];
if (!t) return;
touchX = t.clientX;
touchY = t.clientY;
}

function onTouchEnd(e) {
const t = e.changedTouches?.[0];
if (!t || touchX === null || touchY === null) return;

const dx = t.clientX - touchX;
const dy = t.clientY - touchY;

touchX = null; touchY = null;

// horizontal swipe threshold
if (Math.abs(dx) > 55 && Math.abs(dy) < 60) {
showHUD(); // when user navigates, show info
startManualHold();
if (dx < 0) nextItem(); // swipe left = next
else prevItem(); // swipe right = prev
}
}

// ---------------- search ----------------
function openSearch() {
if (!searchPanel) return;
searchPanel.classList.toggle("open");
if (searchPanel.classList.contains("open")) {
if (searchInput) searchInput.focus();
// Opening search is an intentional interaction: keep playing but no need to pause automatically.
// (User can pause with double tap if they want.)
}
}

function renderSearchHints(q) {
if (!searchResults) return;
const s = (q || "").trim();
if (!s) {
searchResults.innerHTML = `
<div class="resItem">Try: <b>Picasso</b></div>
<div class="resItem">Try: <b>Michelangelo</b></div>
<div class="resItem">Try: <b>Impressionism</b></div>
<div class="resItem">Try: <b>Louvre</b></div>
`;
[...searchResults.querySelectorAll(".resItem")].forEach(el => {
el.addEventListener("click", () => {
const txt = el.textContent.replace("Try:", "").trim();
if (searchInput) searchInput.value = txt;
if (searchInput) searchInput.focus();
});
});
return;
}
searchResults.innerHTML = `
<div class="resItem">Press Enter to build: <b>${s}</b></div>
<div class="resItem" style="opacity:.7">Target size: <b>${targetForQuery(s)}</b></div>
`;
}

// ---------------- global start ----------------
window.karmasynStart = async function () {
showOverlaySub("Loading…");
startClock();

try {
// Start with a coherent exhibition (not random works)
await buildNextIdleExhibition();

// Start playing
hideOverlay();
startRitual();
} catch (e) {
console.error(e);
showOverlaySub("Couldn’t load. Retrying…");
setTimeout(() => window.karmasynStart(), 1200);
}
};

// ---------------- wire events ----------------
// Stage gestures
if (stage) {
stage.addEventListener("click", (e) => {
// ignore clicks when search is open and click inside search panel
if (searchPanel?.classList.contains("open") && e.target?.closest("#searchPanel")) return;
onStageTap();
});
stage.addEventListener("touchstart", onTouchStart, { passive: true });
stage.addEventListener("touchend", onTouchEnd, { passive: true });
}

// Buttons
if (playBtn) playBtn.addEventListener("click", (e) => { e.preventDefault(); togglePlay(); });
if (searchBtn) searchBtn.addEventListener("click", (e) => { e.preventDefault(); openSearch(); });

// Search input (hints) + submit
if (searchInput) {
searchInput.addEventListener("input", () => renderSearchHints(searchInput.value));
}
if (searchForm) {
searchForm.addEventListener("submit", async (e) => {
e.preventDefault();
const q = (searchInput?.value || "").trim();
if (!q) return;

// Build exhibition from query
if (overlay) overlay.classList.remove("hidden");
showOverlaySub("Building exhibition…");
try {
await buildExhibition(q);
if (searchPanel) searchPanel.classList.remove("open");
// continue playing, reset manual hold
manualUntil = 0;
if (!running) startRitual();
} catch (err) {
console.error(err);
showOverlaySub("Search failed. Try again.");
setTimeout(() => hideOverlay(), 900);
}
});
}

// Autostart
window.addEventListener("DOMContentLoaded", () => {
if (typeof window.karmasynStart === "function") window.karmasynStart();
});

})();
