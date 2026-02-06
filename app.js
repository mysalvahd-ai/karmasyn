(() => {
// ---------------- DOM SAFE HELPERS ----------------
const $ = (sel) => document.querySelector(sel);
const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };

const overlay = $("#homeOverlay");
const stage = $("#stage");
const playBtn = $("#playBtn");
const searchBtn = $("#searchBtn");
const searchPanel = $("#searchPanel");
const searchForm = $("#searchForm");
const searchInput = $("#searchInput");
const searchResults = $("#searchResults");

function hideOverlay() { if (overlay) overlay.classList.add("hidden"); }
function showOverlaySub(txt) { setText("#homeOverlay .sub", txt); }

// ---------------- STATE ----------------
let running = false;
let humanStopped = false;
let tickTimer = null;
let ritualTimer = null;
let seconds = 0;

// tempo-museo
const RITUAL_MS = 10000; // 10s (puoi mettere 12s)

// MODE:
// "RITUAL" = infinite random stream
// "EXHIBITION" = generated list from search
let mode = "RITUAL";

// Queue for ritual (random) and exhibition (curated)
let queue = []; // array of items
let qIndex = 0;

// prevent repeats (light)
const seen = new Set();

// ---------------- TIMER / META ----------------
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

// ---------------- IMAGE RENDER ----------------
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

// ---------------- AIC PROVIDER (HUGE + IIIF) ----------------
async function fetchJSON(url) {
const r = await fetch(url, { cache: "no-store" });
if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
return r.json();
}

// Build IIIF image URL directly (faster than loading manifest)
function aicIIIFImage(imageId, max = 2200) {
// AIC IIIF Image API
return `https://www.artic.edu/iiif/2/${imageId}/full/!${max},${max}/0/default.jpg`;
}

function normalizeItem(x) {
// x = {id,title,artist_title,image_id}
return {
provider: "aic",
id: String(x.id),
title: x.title || "Untitled",
sub: x.artist_title || "Art Institute of Chicago",
image: x.image_id ? aicIIIFImage(x.image_id) : null,
raw: x
};
}

// Random page fetch (inevitable art)
async function aicFetchRandomBatch(batchSize = 12) {
// This is intentionally "chance":
// - pick a random page within a range
// - filter public domain + has image
const page = 1 + Math.floor(Math.random() * 400); // range is heuristic
const url =
`https://api.artic.edu/api/v1/artworks/search?` +
`query[term][is_public_domain]=true&` +
`fields=id,title,artist_title,image_id&` +
`limit=${batchSize}&page=${page}`;

const json = await fetchJSON(url);
const data = (json && json.data) ? json.data : [];
return data
.filter(d => d.image_id)
.map(normalizeItem)
.filter(it => it.image && !seen.has(it.provider + ":" + it.id));
}

// Search fetch (build a "real exhibition")
async function aicSearchExhibition(query, targetCount) {
const q = encodeURIComponent(query.trim());
// search in title/artist etc. (generic)
// limit 100 per call
const limit = Math.min(100, Math.max(25, targetCount));
const url =
`https://api.artic.edu/api/v1/artworks/search?q=${q}&` +
`fields=id,title,artist_title,image_id&` +
`limit=${limit}&` +
`query[term][is_public_domain]=true`;

const json = await fetchJSON(url);
const data = (json && json.data) ? json.data : [];
return data
.filter(d => d.image_id)
.map(normalizeItem);
}

function importanceTarget(query) {
// Very simple heuristic you can tweak:
// big names/periods => bigger exhibition
const q = query.toLowerCase();
const big = ["picasso","michelangelo","rembrandt","monet","vangogh","van gogh","warhol","caravaggio","renaissance","baroque","impressionism","cubism"];
if (big.some(k => q.includes(k))) return 120;
return 60;
}

// ---------------- AI LIGHT (micro-notes) ----------------
// For now: lightweight “museum-like” prompts, no API.
// Later we can swap this with real AI.
const microNotes = [
"Stay with the light for a second.",
"Look at the hands: they carry the story.",
"Notice the background—it's not empty.",
"The composition is doing the emotion.",
"Look for the quiet detail, not the subject."
];

function maybeShowNote() {
// 1 note every ~8 works
if (Math.random() < 0.125) {
setText("#hSub", microNotes[Math.floor(Math.random() * microNotes.length)]);
// after 2.5s restore subtitle if we have current
setTimeout(() => {
const cur = queue[qIndex] || null;
if (cur) setText("#hSub", cur.sub || "—");
}, 2500);
}
}

// ---------------- RITUAL ENGINE ----------------
async function ensureQueue(min = 18) {
if (mode !== "RITUAL") return;
if (queue.length >= min) return;

try {
showOverlaySub("Loading…");
const batch = await aicFetchRandomBatch(14);
batch.forEach(it => {
seen.add(it.provider + ":" + it.id);
queue.push(it);
});
showOverlaySub(`Loaded ${queue.length}`);
if (queue.length) hideOverlay();
} catch (e) {
console.error(e);
showOverlaySub("Loading failed. Retrying…");
}
}

function renderCurrent() {
const cur = queue[qIndex];
if (!cur || !cur.image) return;

setStageImage(cur.image);
setText("#hTitle", cur.title);
setText("#hSub", cur.sub);

maybeShowNote();
}

async function ritualStep() {
if (!running || humanStopped) return;

if (mode === "RITUAL") {
await ensureQueue(18);

// advance
qIndex = (qIndex + 1) % Math.max(queue.length, 1);
renderCurrent();

// keep queue growing (infinite feeling)
if (queue.length < 18) ensureQueue(18);
return;
}

// EXHIBITION mode: loop inside exhibition list
if (mode === "EXHIBITION") {
if (!queue.length) return;
qIndex = (qIndex + 1) % queue.length;
renderCurrent();
return;
}
}

function startRitual() {
running = true;
if (playBtn) playBtn.textContent = "⏸";
setText("#meta", `${fmtTime(seconds)} · running`);

ritualStep();
clearInterval(ritualTimer);
ritualTimer = setInterval(ritualStep, RITUAL_MS);
}

function stopRitual(reason = "") {
running = false;
if (playBtn) playBtn.textContent = "▶";
setText("#meta", `${fmtTime(seconds)} · paused${reason ? " · " + reason : ""}`);
if (ritualTimer) clearInterval(ritualTimer);
ritualTimer = null;
}

function toggleRitual() {
if (running) stopRitual("");
else startRitual();
}

// First human gesture stops the ritual (rule)
function firstHumanGesture() {
if (!humanStopped && running) {
humanStopped = true;
stopRitual("stopped by human");
}
}

// ---------------- SEARCH = GENERATE EXHIBITION ----------------
function openSearch() {
if (!searchPanel) return;
searchPanel.classList.toggle("open");
if (searchPanel.classList.contains("open") && searchInput) {
searchInput.focus();
renderSearchResults([]);
}
}

function renderSearchResults(list) {
if (!searchResults) return;
searchResults.innerHTML = list.map((x, idx) => `
<div class="resItem" data-idx="${idx}">
${x.title} <span style="opacity:.6">— ${x.sub}</span>
</div>
`).join("");

[...searchResults.querySelectorAll(".resItem")].forEach((el) => {
el.addEventListener("click", () => {
firstHumanGesture();
const idx = Number(el.getAttribute("data-idx"));
qIndex = idx;
renderCurrent();
if (searchPanel) searchPanel.classList.remove("open");
});
});
}

async function buildExhibitionFromQuery(query) {
const target = importanceTarget(query);
showOverlaySub(`Building exhibition…`);
// For now: single call (up to 100). Later we can paginate for 200+
const items = await aicSearchExhibition(query, target);

// If too few results, fall back to ritual stream but keep query as “lens”
if (items.length < 10) {
mode = "RITUAL";
showOverlaySub("Not enough works. Back to ritual…");
return;
}

// Switch mode
mode = "EXHIBITION";
humanStopped = false; // allow ritual in this mode
queue = items;
qIndex = 0;

// Intro minimal
setText("#hTitle", query);
setText("#hSub", `Exhibition · ${items.length} works`);

hideOverlay();
// start (or continue) with museum tempo
if (!running) startRitual();
else {
renderCurrent();
}

// Also show first work immediately
renderCurrent();
}

// ---------------- GLOBAL START ----------------
window.karmasynStart = async function () {
showOverlaySub("Loading…");
startClock();

// Default: Infinite “inevitable” ritual
mode = "RITUAL";
queue = [];
qIndex = 0;

await ensureQueue(18);
hideOverlay();

humanStopped = false;
startRitual();
};

// ---------------- CONTROLS ----------------
if (playBtn) {
playBtn.addEventListener("click", (e) => {
e.preventDefault();
firstHumanGesture();
toggleRitual();
});
}

if (searchBtn) {
searchBtn.addEventListener("click", (e) => {
e.preventDefault();
firstHumanGesture();
openSearch();
});
}

// iOS-safe submit
if (searchForm) {
searchForm.addEventListener("submit", async (e) => {
e.preventDefault();
firstHumanGesture();
const q = (searchInput?.value || "").trim();
if (!q) return;
await buildExhibitionFromQuery(q);
if (searchPanel) searchPanel.classList.remove("open");
});
}

// Avoid stopping ritual while typing
document.addEventListener("pointerdown", (e) => {
const t = e.target;
if (t && (t.tagName === "INPUT" || t.closest("#searchPanel"))) return;
firstHumanGesture();
}, { passive: true });

// ---------------- AUTOSTART ----------------
window.addEventListener("DOMContentLoaded", () => {
if (typeof window.karmasynStart === "function") window.karmasynStart();
});

})();
