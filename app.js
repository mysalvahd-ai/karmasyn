(() => {
"use strict";

const overlay = document.getElementById("homeOverlay");
const titleH1 = document.querySelector("#title h1");
const titleP = document.querySelector("#title p");
const meta = document.getElementById("meta");
const playBtn = document.getElementById("playBtn");
const searchBtn = document.getElementById("searchBtn");
const searchPanel = document.getElementById("searchPanel");
const searchInput = document.getElementById("searchInput");

const WORKS = [
"Caravaggio — The Calling of Saint Matthew",
"Klimt — The Kiss",
"Morandi — Natura morta",
"Basquiat — Untitled",
"Modigliani — Jeanne Hébuterne",
"Turner — Rain, Steam and Speed",
"Rothko — No. 14",
"Hokusai — The Great Wave",
"Vermeer — Girl with a Pearl Earring"
];

let idx = 0;
let timer = null;
let running = false;
let startedAt = null;
let humanStopped = false;

function mmss() {
if (!startedAt) return "00:00";
const s = Math.floor((Date.now() - startedAt) / 1000);
return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}

function setMeta(state){ meta.textContent = `${mmss()} · ${state}`; }

function render(note){
titleH1.textContent = WORKS[idx % WORKS.length];
titleP.textContent = note;
}

function startRitual(){
if (!startedAt) startedAt = Date.now();
running = true;
playBtn.textContent = "⏸";
setMeta("running");
render("RITUAL is running. Tap ▶ to pause.");

clearInterval(timer);
timer = setInterval(() => {
idx++;
render("RITUAL is running. Tap ▶ to pause.");
setMeta("running");
}, 3000);
}

function stopRitual(reason="paused"){
running = false;
playBtn.textContent = "▶";
clearInterval(timer);
timer = null;
setMeta(reason);
render("RITUAL is paused. Tap ▶ to resume.");
}

function toggleRitual(){
running ? stopRitual("paused") : startRitual();
}

// Regola: primo gesto umano ferma il rituale
function firstHumanGesture(){
if (!humanStopped && running){
humanStopped = true;
stopRitual("stopped by human");
}
}

// ⭐ FUNZIONE GLOBALE: chiamata dall'onclick nel HTML
window.karmasynStart = function(){
overlay.classList.add("hidden");
humanStopped = false; // reset
showRandomIIIF();
startRitual();
};

// Controls
playBtn.addEventListener("click", (e) => {
e.preventDefault();
firstHumanGesture();
toggleRitual();
});

searchBtn.addEventListener("click", (e) => {
e.preventDefault();
searchPanel.classList.toggle("open");
if (searchPanel.classList.contains("open")) searchInput.focus();
});

searchInput.addEventListener("keydown", (e) => {
if (e.key === "Enter") {
const q = (searchInput.value || "").trim().toLowerCase();
const found = WORKS.findIndex(w => w.toLowerCase().includes(q));
if (found >= 0) idx = found;
render(`SEEK: ${searchInput.value}`);
searchPanel.classList.remove("open");
setMeta("seek");
}
});

// Init
render("Tap the pill to begin.");
setMeta("idle");
})();
async function fetchJSON(url) {
const r = await fetch(url, { cache: "no-store" });
if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
return r.json();
}

function iiifImageFromManifest(manifest) {
// v3
let canvas = manifest.items?.[0] || null;
// v2 fallback
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

const direct = body?.id || body?.["@id"];
if (direct && /\.(jpe?g|png|webp)$/i.test(direct)) return direct;

const sid = service?.id || service?.["@id"];
if (!sid) throw new Error("IIIF: no image service");

return `${String(sid).replace(/\/$/, "")}/full/!2000,2000/0/default.jpg`;
}

function setStageImage(url) {
const stage = document.getElementById("stage");
if (!stage) return;

stage.innerHTML = "";
stage.style.position = "relative";

const img = new Image();
img.src = url;
img.decoding = "async";
img.loading = "eager";
img.style.position = "absolute";
img.style.inset = "0";
img.style.width = "100%";
img.style.height = "100%";
img.style.objectFit = "contain";

stage.appendChild(img);
}

async function showRandomIIIF() {
const list = await fetchJSON("./data/manifests.json");
const manifestUrl = list[Math.floor(Math.random() * list.length)];
const manifest = await fetchJSON(manifestUrl);
const imgUrl = iiifImageFromManifest(manifest);
setStageImage(imgUrl);
return { manifestUrl, imgUrl };
}
window.addEventListener("DOMContentLoaded", () => {
if (typeof window.karmasynStart === "function") {
window.karmasynStart();
}
});
