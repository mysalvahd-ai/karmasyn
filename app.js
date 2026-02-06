(() => {
// ---------- DOM SAFE HELPERS ----------
const $ = (sel) => document.querySelector(sel);
const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };

const overlay = $("#homeOverlay");
const stage = $("#stage");
const playBtn = $("#playBtn");
const searchBtn = $("#searchBtn");
const searchPanel = $("#searchPanel");
const searchInput = $("#searchInput");
const searchResults = $("#searchResults");

function hideOverlay() { if (overlay) overlay.classList.add("hidden"); }
function showOverlaySub(txt) { setText("#homeOverlay .sub", txt); }

// ---------- STATE ----------
let running = false;
let humanStopped = false;
let tickTimer = null;
let ritualTimer = null;
let seconds = 0;

let works = []; // list of { manifestUrl, label }
let currentIndex = 0;

// ---------- TIMER / META ----------
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

// ---------- IIIF CORE ----------
async function fetchJSON(url) {
const r = await fetch(url, { cache: "no-store" });
if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
return r.json();
}

function iiifImageFromManifest(manifest) {
// Presentation 3: manifest.items[0] => canvas
let canvas = manifest.items?.[0] || null;
// Presentation 2 fallback
if (!canvas && manifest.sequences?.[0]?.canvases?.length) {
canvas = manifest.sequences[0].canvases[0];
}
if (!canvas) throw new Error("IIIF: no canvas");

// v3 body/service
let body = canvas.items?.[0]?.items?.[0]?.body || null;
let service = body?.service ? (Array.isArray(body.service) ? body.service[0] : body.service) : null;

// v2 fallback
if (!body && canvas.images?.[0]) {
body = canvas.images[0].resource || canvas.images[0].body || null;
service = canvas.images[0].resource?.service || canvas.images[0].service || null;
if (Array.isArray(service)) service = service[0];
}

// direct image id
const direct = body?.id || body?.["@id"];
if (direct && /\.(jpe?g|png|webp)$/i.test(direct)) return direct;

const sid = service?.id || service?.["@id"];
if (!sid) throw new Error("IIIF: no image service");

// Safe size that many servers accept
return `${String(sid).replace(/\/$/, "")}/full/!2200,2200/0/default.jpg`;
}

function setStageImage(url) {
if (!stage) return;
stage.innerHTML = "";
stage.style.position = "absolute";
stage.style.inset = "0";

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

function manifestLabel(manifest) {
// Presentation 3: label can be {en:[...]} or string
const l = manifest.label;
if (!l) return "Untitled";
if (typeof l === "string") return l;
if (Array.isArray(l)) return l[0] || "Untitled";
// language map
const firstKey = Object.keys(l)[0];
const arr = l[firstKey];
return Array.isArray(arr) ? (arr[0] || "Untitled") : "Untitled";
}

async function showFromManifest(manifestUrl) {
const manifest = await fetchJSON(manifestUrl);
const imgUrl = iiifImageFromManifest(manifest);
setStageImage(imgUrl);

// headline
const title = manifestLabel(manifest);
setText("#hTitle", title);
// keep sub minimal (source host)
try {
const host = new URL(manifestUrl).host.replace(/^www\./, "");
setText("#hSub", host);
} catch {
setText("#hSub", "IIIF");
}

return { manifestUrl, imgUrl };
}

// ---------- WORKS LIST ----------
async function loadWorksList() {
// Your repo has data/manifest.json
// Accept 2 formats:
// 1) ["url1","url2",...]
// 2) [{manifest:"url", label:"..."}, ...]
const raw = await fetchJSON("./data/manifest.json");

if (Array.isArray(raw) && typeof raw[0] === "string") {
works = raw.map((u) => ({ manifestUrl: u, label: null }));
return;
}

if (Array.isArray(raw) && typeof raw[0] === "object") {
works = raw
.map((o) => ({
manifestUrl: o.manifest || o.url || o.manifestUrl,
label: o.label || o.title || null
}))
.filter((x) => !!x.manifestUrl);
return;
}

throw new Error("manifest.json format not recognized");
}

function pickRandomIndex() {
if (!works.length) return 0;
if (works.length === 1) return 0;
let i = Math.floor(Math.random() * works.length);
if (i === currentIndex) i = (i + 1) % works.length;
return i;
}

// ---------- RITUAL ----------
async function ritualStep() {
if (!running || humanStopped) return;

currentIndex = pickRandomIndex();
const item = works[currentIndex];

try {
await showFromManifest(item.manifestUrl);
} catch (e) {
console.error(e);
// keep running but show subtle info
setText("#hTitle", "—");
setText("#hSub", "IIIF load error (next)");
}
}

function startRitual() {
running = true;
setText("#meta", `${fmtTime(seconds)} · running`);
if (playBtn) playBtn.textContent = "⏸";

// step now, then every 3s
ritualStep();
clearInterval(ritualTimer);
ritualTimer = setInterval(ritualStep, 3000);
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

// First human gesture stops the ritual (your rule)
function firstHumanGesture() {
if (!humanStopped && running) {
humanStopped = true;
stopRitual("stopped by human");
}
}

// ---------- SEARCH ----------
function openSearch() {
if (!searchPanel) return;
searchPanel.classList.toggle("open");
if (searchPanel.classList.contains("open") && searchInput) {
searchInput.focus();
renderSearch("");
}
}

function renderSearch(q) {
if (!searchResults) return;
const query = (q || "").trim().toLowerCase();
const list = works
.map((w, idx) => ({ idx, manifestUrl: w.manifestUrl }))
.filter((x) => !query || x.manifestUrl.toLowerCase().includes(query))
.slice(0, 30);

searchResults.innerHTML = list.map((x) => `
<div class="resItem" data-idx="${x.idx}">
${x.manifestUrl}
</div>
`).join("");

// click jump
[...searchResults.querySelectorAll(".resItem")].forEach((el) => {
el.addEventListener("click", async () => {
firstHumanGesture();
const idx = Number(el.getAttribute("data-idx"));
currentIndex = idx;
searchPanel.classList.remove("open");
await showFromManifest(works[idx].manifestUrl);
});
});
}

// ---------- GLOBAL START ----------
window.karmasynStart = async function () {
showOverlaySub("Loading…");

try {
await loadWorksList(); // reads ./data/manifest.json
showOverlaySub(`Loaded ${works.length} manifests`);
startClock();
hideOverlay();

humanStopped = false; // reset rule
startRitual();
} catch (e) {
console.error(e);
showOverlaySub("Couldn’t load. Retrying…");
// retry
setTimeout(() => window.karmasynStart(), 1500);
}
};

// ---------- CONTROLS ----------
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

if (searchInput) {
searchInput.addEventListener("input", () => renderSearch(searchInput.value));
searchInput.addEventListener("keydown", (e) => {
if (e.key === "Enter") {
firstHumanGesture();
// jump to first
const first = searchResults?.querySelector(".resItem");
if (first) first.click();
}
});
}

// Any touch/click on stage counts as "first human gesture"
document.addEventListener("pointerdown", () => {
// don't stop if user is clicking inside search panel inputs
const active = document.activeElement;
if (active && (active.tagName === "INPUT" || active.closest("#searchPanel"))) return;
firstHumanGesture();
}, { passive: true });

// ---------- AUTOSTART ----------
window.addEventListener("DOMContentLoaded", () => {
if (typeof window.karmasynStart === "function") window.karmasynStart();
});

})();
